/**
 * pm3's customizable download — an ADAPTER over the shared ogr2ogr pipeline, not a second one.
 *
 * The macroview's download builder (src/themes/transportny/components/macroview/downloadBuilder.jsx)
 * lets a viewer pick a column set, a geography scope and a format. It used to POST that to the
 * generic `gis-dataset/create-download`, which reads none of it: `downloadProps` was destructured
 * away, there was no WHERE clause anywhere in the pipeline, the result was filed under the fileType
 * while the client waited on a content hash, and each run REPLACED `metadata.download` instead of
 * merging into it. "Region 8 only" and "statewide" produced byte-identical files that the client
 * could never find.
 *
 * The fix is split by ownership:
 *
 *   · dama/upload/workers/create-download.js — the shared worker — gained four general
 *     capabilities: `where` (→ ogr2ogr `-where`), `downloadKey` (the metadata.download key), a
 *     MERGE instead of a replace, and `extraFiles` (a README/manifest zipped alongside the
 *     export). Every datatype benefits; nothing about pm3 leaked in.
 *
 *   · this module owns only what is pm3-specific: translating the macroview's geography chips into
 *     SQL, naming the file after the selection, validating both against the source's declared
 *     columns, refusing the formats pm3 does not publish, and composing the manifest
 *     (downloadManifest.js). Then it delegates to `gis/create-download`.
 *
 * WHY `OR` ACROSS FAMILIES. The chips are written into the pm3 map layer's `dynamic-filters` with
 * `filterMode: "any"` (comp.jsx), and core's `buildLayerUdaFilterOptions` turns that into
 * `{filterGroups: {op: 'OR', groups: [...]}}` — so the map, and every panel side-query that reports
 * the row count the builder promises, treats two selected families as a UNION. Region 8 (8,016 rows
 * on view 3740) OR Albany County (1,274) = 9,290 rows, which is what `-where` reproduces exactly.
 * ANDing them would make the download disagree with the number printed on the button.
 */

const { createHash } = require('crypto');
const {
  MANIFEST_FILE_NAME, buildDownloadManifest, yearsForExport,
} = require('./downloadManifest.js');

const WORKER_PATH = 'gis/create-download';

/**
 * The formats a pm3 download may be asked for. A SUBSET of what the shared pipeline can emit
 * (`OUTPUT_TYPES` in create-download.js), checked here so an unsupported format is a 400 rather
 * than a task that dispatches a WARN and then writes an empty `metadata.download` entry.
 *
 * Two absences are deliberate and neither is a capability gap in the pipeline:
 *
 *   · **`GeoJSON` is refused as a matter of pm3 policy** (stated by Alex, 2026-08-24). The shared
 *     worker still offers it and other datatypes may legitimately use it — this is pm3's rule,
 *     enforced at pm3's route, not a change to the pipeline. No rationale is recorded because none
 *     was given; the obvious candidate is size (52,127 MultiLineString features as GeoJSON is
 *     enormous next to a GPKG or a zipped shapefile) but that is a guess and is not written down
 *     here as if it were the reason.
 *   · **`json` was never producible.** ogr2ogr emits no plain-JSON driver, so enabling it would
 *     mean a second, non-ogr2ogr writer in the worker. Declined — see the task doc's Phase 3.
 *
 * Both refusals are 400s that name the format, and neither is offered by the download builder, so
 * the UI and the route agree rather than the UI drawing a control the server rejects.
 */
const SUPPORTED_FILE_TYPES = ['CSV', 'GPKG', 'ESRI Shapefile'];

const parseJson = (v) => (typeof v === 'string' ? (v ? JSON.parse(v) : {}) : (v || {}));

/**
 * A single-quoted SQL literal. Values reach us from a request body and are spliced into a clause
 * that ogr2ogr pushes down to Postgres verbatim, so this is the only thing standing between a chip
 * value and the server. Column names are NOT escaped here — they are checked against the source's
 * declared column list instead, which is a much stronger guarantee than quoting.
 */
function sqlLiteral(value) {
  const s = String(value);
  // A NUL cannot survive into a Postgres text literal, and it is never a real chip value.
  // (Spaces ARE legitimate: "Ulster County Transportation Council" is a real mpo_name.)
  if (s.includes('\u0000')) throw new Error('geography filter value contains a NUL byte');
  return `'${s.replace(/'/g, "''")}'`;
}

/**
 * The macroview's geography chips → one SQL boolean expression, or `null` for statewide.
 *
 * `geographyFilter` is the chip array: `[{ name, label, value, type }]`, where `type` IS the source
 * column (`county` · `mpo_name` · `region_code` · `urban_code`) and `value` is the raw column value.
 * `[]` means statewide, which is exactly what the builder's "statewide" scope sends.
 *
 * @param {Array} geographyFilter
 * @param {Set<string>} declaredColumns - the source's `metadata.columns` names
 * @returns {string|null}
 */
function buildGeographyWhere(geographyFilter, declaredColumns) {
  if (!Array.isArray(geographyFilter) || geographyFilter.length === 0) return null;

  const byColumn = new Map();
  for (const chip of geographyFilter) {
    const column = chip && chip.type;
    if (!column) throw new Error('geography filter entry is missing `type` (the source column)');
    if (declaredColumns && !declaredColumns.has(column)) {
      throw new Error(`geography filter column "${column}" is not a column of this source`);
    }
    if (chip.value === undefined || chip.value === null || chip.value === '') {
      throw new Error(`geography filter on "${column}" has no value`);
    }
    if (!byColumn.has(column)) byColumn.set(column, []);
    const values = byColumn.get(column);
    if (!values.includes(String(chip.value))) values.push(String(chip.value));
  }

  // Column order is the chips' first-seen order so the clause (and therefore the derived cache key)
  // is a deterministic function of the request.
  const clauses = [...byColumn.entries()].map(
    ([column, values]) => `"${column}" IN (${values.map(sqlLiteral).join(', ')})`
  );

  return clauses.length === 1 ? clauses[0] : `(${clauses.join(' OR ')})`;
}

/**
 * A short, readable token for the geography scope, for the file name.
 * Statewide → "statewide". One or two values → the values. More → "<column>-<n>sel", because a
 * file name listing 30 counties is not a file name.
 */
function geographyToken(geographyFilter) {
  if (!Array.isArray(geographyFilter) || geographyFilter.length === 0) return 'statewide';

  const byColumn = new Map();
  for (const chip of geographyFilter) {
    if (!chip || !chip.type) continue;
    if (!byColumn.has(chip.type)) byColumn.set(chip.type, []);
    const values = byColumn.get(chip.type);
    if (!values.includes(String(chip.value))) values.push(String(chip.value));
  }
  if (!byColumn.size) return 'statewide';

  return [...byColumn.entries()]
    .map(([column, values]) =>
      values.length <= 2 ? `${column}-${values.join('-')}` : `${column}-${values.length}sel`)
    .join('_');
}

/**
 * The download's file name stem.
 *
 * The generic name is `{source_name}_s{source}_v{view}_{version}` — it describes the VIEW, so every
 * subset of one view collides on one file. This one carries the selection: year, measure, geography
 * and a short hash of the exact request, so a downloaded file is self-describing and two different
 * column subsets are two different files.
 */
function buildDownloadFileNameBase({
  sourceName, source_id, view_id, version, measure, geographyFilter, downloadKey,
}) {
  const parts = [sourceName || 'pm3', `s${source_id}`, `v${view_id}`];
  if (version) parts.push(String(version));
  if (measure) parts.push(String(measure));
  parts.push(geographyToken(geographyFilter));
  if (downloadKey) parts.push(String(downloadKey).slice(0, 8));
  return parts.join('_');
}

/**
 * The cache key, when the caller does not supply one.
 *
 * The macroview computes `hashString(fileNameBase)` — a SHA-256 over version + sorted columns +
 * geography + fileType — and polls `metadata.download[<that hash>]`, so when it sends the hash we
 * use it VERBATIM: that is what makes the client's "already built, just take it" path work without
 * a client-side change. This is the fallback for any other caller (a curl, a script), keyed on the
 * same facts so it is stable across runs and distinct per subset.
 */
function deriveDownloadKey({ view_id, columns, where, fileType }) {
  const canonical = JSON.stringify({
    view_id: Number(view_id),
    columns: [...(columns || [])].sort(),
    where: where || null,
    fileType: fileType || null,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * POST /dama-admin/:pgEnv/pm3/create-download
 *
 * Body (the macroview's payload, plus `uniqueFileNameBase`):
 *   { source_id, view_id, columns, fileTypes, user_id, email,
 *     uniqueFileNameBase,                    // the client's content hash — the cache key
 *     downloadProps: { geographyFilter, measure } }
 *
 * Response: `{ etl_context_id, source_id }` — the datatype route contract; `etl_context_id` IS the
 * task id, which is what /events/query polls.
 */
function createDownloadHandler(helpers) {
  return async function pm3CreateDownload(req, res) {
    const { pgEnv } = req.params;
    const {
      source_id, view_id, columns, fileTypes, user_id, email,
      uniqueFileNameBase, downloadProps, groupedByColumn,
    } = req.body || {};

    try {
      if (!source_id || !view_id) {
        return res.status(400).json({ error: 'source_id and view_id are required' });
      }
      if (!Array.isArray(fileTypes) || fileTypes.length === 0) {
        return res.status(400).json({ error: 'fileTypes (non-empty array) is required' });
      }
      const badTypes = fileTypes.filter((t) => !SUPPORTED_FILE_TYPES.includes(t));
      if (badTypes.length) {
        return res.status(400).json({
          error: `unsupported fileTypes: ${badTypes.join(', ')}. `
            + `Supported: ${SUPPORTED_FILE_TYPES.join(', ')}`,
        });
      }
      if (!Array.isArray(columns) || columns.length === 0) {
        return res.status(400).json({ error: 'columns (non-empty array) is required' });
      }

      const db = helpers.getDb(pgEnv);
      const viewTable = db.type === 'postgres' ? 'data_manager.views' : 'views';
      const sourceTable = db.type === 'postgres' ? 'data_manager.sources' : 'sources';

      const { rows } = await db.query(`
        SELECT s.name AS source_name, s.metadata AS source_metadata,
               v.version, v.metadata AS view_metadata
        FROM ${sourceTable} AS s
        INNER JOIN ${viewTable} AS v ON v.source_id = s.source_id
        WHERE v.view_id = $1 AND v.source_id = $2
      `, [view_id, source_id]);

      if (!rows[0]) {
        return res.status(404).json({ error: `view ${view_id} not found on source ${source_id}` });
      }
      const { source_name, version } = rows[0];

      // Validate against the SOURCE's declared columns, not the physical relation. That list is the
      // cross-DAMA contract (data-types/CLAUDE.md § metadata.columns), it is what populates the
      // builder's own column picker, and it is dialect-agnostic — pm3's published relation is a
      // VIEW over `<table_name>_metrics`, so an information_schema lookup would have to know that.
      const declared = parseJson(rows[0].source_metadata).columns;
      if (!Array.isArray(declared) || declared.length === 0) {
        return res.status(409).json({
          error: `source ${source_id} declares no metadata.columns; a download cannot be validated `
            + 'against it. Re-run the pm3 publish, which writes the column list.',
        });
      }
      const declaredColumns = new Set(declared.map((c) => c && c.name).filter(Boolean));

      const unknown = columns.filter((c) => !declaredColumns.has(c));
      if (unknown.length) {
        // ogr2ogr's `-select` DROPS an unknown field with an `ERROR 1:` on stderr and still exits 0,
        // so without this the download silently arrives missing the column that was asked for.
        return res.status(400).json({
          error: `unknown columns for source ${source_id}: ${unknown.join(', ')}`,
        });
      }
      if (groupedByColumn && !declaredColumns.has(groupedByColumn)) {
        return res.status(400).json({ error: `unknown groupedByColumn: ${groupedByColumn}` });
      }

      let where;
      try {
        where = buildGeographyWhere(downloadProps && downloadProps.geographyFilter, declaredColumns);
      } catch (err) {
        return res.status(400).json({ error: `bad geographyFilter: ${err.message}` });
      }

      const measure = downloadProps && downloadProps.measure;
      const downloadKey = uniqueFileNameBase
        || deriveDownloadKey({ view_id, columns, where, fileType: fileTypes[0] });

      const fileNameBase = buildDownloadFileNameBase({
        sourceName: source_name,
        source_id,
        view_id,
        version,
        // Only if it is a real column of this source — the measure is decoration in the name, and a
        // stale persisted measure token must not be able to make the name lie.
        measure: declaredColumns.has(measure) ? measure : null,
        geographyFilter: downloadProps && downloadProps.geographyFilter,
        downloadKey,
      });

      // THE MANIFEST. A pm3 CSV is 330 columns with no room to say that 2024 blends three coverage
      // regimes or that `anchor_fallback = 1` rows must come out of a trend, and a download is
      // where those caveats get detached from the data. Built from the request, so a 2017 export
      // and a 2025 export ship different READMEs, and from `lib/eras.js`, so moving the anchor
      // window moves every manifest with it. Failure is a 500 by the outer catch, not a
      // manifest-less zip.
      const years = yearsForExport({ version, viewMetadata: parseJson(rows[0].view_metadata) });
      const manifest = buildDownloadManifest({
        sourceName: source_name,
        sourceId: source_id,
        viewId: view_id,
        version,
        years,
        columns,
        where,
        geographyFilter: (downloadProps && downloadProps.geographyFilter) || [],
        fileType: fileTypes.join(', '),
      });

      const taskId = await helpers.queueTask({
        workerPath: WORKER_PATH,
        sourceId: source_id,
        source_id,
        view_id,
        user_id,
        email,
        fileTypes,
        columns,
        groupedByColumn: groupedByColumn || null,
        where,
        downloadKey,
        fileNameBase,
        extraFiles: [{ name: MANIFEST_FILE_NAME, content: manifest }],
      }, pgEnv);

      return res.json({ etl_context_id: taskId, source_id });
    } catch (err) {
      console.error('[pm3] create-download failed:', err);
      return res.status(500).json({ error: err.message });
    }
  };
}

module.exports = {
  WORKER_PATH,
  SUPPORTED_FILE_TYPES,
  buildGeographyWhere,
  geographyToken,
  buildDownloadFileNameBase,
  deriveDownloadKey,
  createDownloadHandler,
};
