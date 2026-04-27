/**
 * Two-source LOTTR diff query — gated off by default. Used historically to
 * compare new_data vs pm3_db results during PM3 migration; preserved for
 * follow-up tasks but never invoked by the current worker.
 */
const { BIN_NAMES } = require('./constants');

const DATASET_COMPARISON_THRESHOLD = 0.01;

const DATA_SOURCES = [
  { name: 'new_data', bins: ['ALL', 'AMP', 'PMP', 'WE', 'MIDD'] },
  { name: 'old_data', bins: ['ALL', 'AMP', 'PMP', 'WE', 'MIDD'] },
  { name: 'pm3_dama', bins: ['ALL', 'AMP', 'PMP', 'WE', 'MIDD'] },
  { name: 'pm3_db',   bins: ['AMP', 'PMP', 'WE', 'MIDD'] },
];

function generateAnalysisSql({ dataTableName, leftSourceName, rightSourceName, threshold = DATASET_COMPARISON_THRESHOLD }) {
  const left = DATA_SOURCES.find((d) => d.name === leftSourceName);
  const right = DATA_SOURCES.find((d) => d.name === rightSourceName);
  const conditional = Object.values(BIN_NAMES)
    .filter((bin) => left.bins.includes(bin) && right.bins.includes(bin))
    .map((bin) => `ABS("${bin}_${leftSourceName}_lottr" - "${bin}_${rightSourceName}_lottr") > ${threshold}`)
    .join(' AND ');
  return `SELECT * FROM ${dataTableName} WHERE ${conditional};`;
}

module.exports = { generateAnalysisSql };
