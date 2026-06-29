/**
 * In-process HPMS TTM 2023-spec validator.
 *
 * Mirrors references/hpms/dama/validate-hpms-ttm-2023.cjs but takes SPEC by
 * argument and returns the report object instead of printing. Used by the
 * worker after writing the CSV — fails the task if any errors are found.
 *
 * Returns `{ file, delim, validatedRows, headerIssues, errors, summary }`.
 *   - `errors` is a Map<columnName, { count, samples: [{row, msg, value}] }>
 *   - `summary` is a small object suitable for embedding in a task event
 */

const fs = require('fs');
const { SPEC, DELIMITER, normalizeHeader } = require('./hpms-spec-2023.js');

function parseLine(line, delim) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === delim) { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function detectDelimiter(firstLine) {
  const pipes  = (firstLine.match(/\|/g) || []).length;
  const commas = (firstLine.match(/,/g)  || []).length;
  return pipes > commas ? '|' : ',';
}

function validateFile(file, { limit = 5, forcedDelim = null } = {}) {
  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  if (!lines.length) {
    return {
      file, delim: forcedDelim || DELIMITER, validatedRows: 0,
      headerIssues: { missing: [], extra: [], nonPipe: false },
      errors: new Map(),
      summary: { rows: 0, errorCount: 0, missing: [], extra: [] },
    };
  }
  const delim = forcedDelim || detectDelimiter(lines[0]);
  const headerRaw = parseLine(lines[0], delim);
  const headerNorm = headerRaw.map(normalizeHeader);

  const specNorm = SPEC.map((f) => normalizeHeader(f.name));
  const missing = SPEC.filter((f) => !headerNorm.includes(normalizeHeader(f.name))).map((f) => f.name);
  const extra   = headerRaw.filter((h) => !specNorm.includes(normalizeHeader(h)));

  const idx = {};
  for (let i = 0; i < headerNorm.length; i++) idx[headerNorm[i]] = i;

  const errors = new Map();
  const bump = (name, row, msg, value) => {
    if (!errors.has(name)) errors.set(name, { count: 0, samples: [] });
    const e = errors.get(name);
    e.count++;
    if (e.samples.length < limit) e.samples.push({ row, msg, value });
  };

  let validatedRows = 0;
  for (let r = 1; r < lines.length; r++) {
    const parts = parseLine(lines[r], delim);
    if (parts.length === 1 && parts[0].trim() === '') continue;
    validatedRows++;
    if (parts.length !== headerRaw.length) {
      bump('__row__', r + 1, `expected ${headerRaw.length} columns, got ${parts.length}`, '');
    }

    const fSystem = (parts[idx['fsystem']] ?? '').replace(/^"|"$/g, '').trim();
    const isInterstate = fSystem === '1';

    for (const field of SPEC) {
      const key = normalizeHeader(field.name);
      const colIdx = idx[key];
      if (colIdx === undefined) continue;
      const rawVal = parts[colIdx] ?? '';
      const val = rawVal.replace(/^"|"$/g, '').trim();

      if (val === '') {
        if (field.required) bump(field.name, r + 1, 'required but empty', rawVal);
        else if (field.interstateOnly && isInterstate)
          bump(field.name, r + 1, 'required on Interstate (fsystem=1) but empty', rawVal);
        continue;
      }

      const err = field.rule(val);
      if (err) bump(field.name, r + 1, err, rawVal);
    }
  }

  const errorCount = [...errors.values()].reduce((s, e) => s + e.count, 0);
  const summary = {
    rows: validatedRows,
    errorCount,
    missing,
    extra,
    topErrors: [...errors.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([name, info]) => ({ column: name, count: info.count, sample: info.samples[0] })),
  };

  return { file, delim, validatedRows, headerIssues: { missing, extra, nonPipe: delim !== '|' }, errors, summary };
}

module.exports = { validateFile };
