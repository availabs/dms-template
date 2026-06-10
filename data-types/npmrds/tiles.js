/**
 * Per-year layer-view tiles metadata (MapLibre source + layer spec) and the
 * remove-flow tile pruning. Ported from legacy metadata.worker.mjs /
 * publish.route.js (removeByYear).
 */

function makeTiles({ pgEnv, prodURL = '', sourceId, viewId, year, timestamp = Date.now() }) {
  const layerName = `s${sourceId}_v${viewId}`;
  const tilesetName = `${pgEnv}_${layerName}_${year}_${timestamp}`;
  return {
    sources: [
      {
        id: tilesetName,
        source: {
          tiles: [
            `${prodURL}/dama-admin/${pgEnv}/tiles/${viewId}/{z}/{x}/{y}/t.pbf?cols=tmc&filter=year=${year}`,
          ],
          format: 'pbf',
          type: 'vector',
        },
      },
    ],
    layers: [
      {
        id: `${layerName}_tMultiLineString`,
        type: 'line',
        paint: { 'line-color': 'black', 'line-width': 1 },
        source: tilesetName,
        'source-layer': `view_${viewId}`,
      },
    ],
  };
}

// Drop tile sources whose URL carries the removed year, plus their layers.
function removeByYear(sources, layers, yearToRemove) {
  const filteredSources = (sources || []).filter((sourceObj) => {
    const hasYear = (sourceObj?.source?.tiles || []).some((tileUrl) =>
      tileUrl.includes(`year=${yearToRemove}`)
    );
    return !hasYear;
  });
  const remainingSourceIds = filteredSources.map((sourceObj) => sourceObj?.id);
  const filteredLayers = (layers || []).filter((layerObj) =>
    remainingSourceIds.includes(layerObj.source)
  );
  return { sources: filteredSources, layers: filteredLayers };
}

module.exports = { makeTiles, removeByYear };
