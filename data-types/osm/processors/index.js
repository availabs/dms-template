const { extname } = require('path');
const processPbf = require('./osm-pbf.processor');

module.exports = async function processOSMUpload({ workingDirectory, osmFileName, schemaName, tableName, dbConfig }) {
  const extension = extname(osmFileName).toLowerCase();
  if (extension !== '.pbf') {
    throw new Error(`Unsupported OSM file type: ${extension}. Expected .pbf`);
  }

  return processPbf({ workingDirectory, osmFileName, schemaName, tableName, dbConfig });
};
