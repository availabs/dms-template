const Database = require('better-sqlite3');
const { Readable, pipeline } = require('stream');
const { Client } = require('pg');
const copyFrom = require('pg-copy-streams').from;

const HIGHWAY_TYPES = new Set([
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'unclassified',
  'residential',
  'motorway_link',
  'trunk_link',
  'primary_link',
  'secondary_link',
  'tertiary_link',
  'living_street',
]);

function toCopyCsvValue(value) {
  if (value == null) return '';
  const s = String(value);
  if (!/[|\n\r"]/.test(s)) return s;
  return `"${s.replaceAll('"', '""')}"`;
}

function rowsToDelimited(rows) {
  return rows.map((row) => row.map(toCopyCsvValue).join('|')).join('\n');
}

class OSMObjectHandler {
  constructor({ nodesTable, waysTable, relationsTable, dbConfig }) {
    this.nodesTable = nodesTable;
    this.waysTable = waysTable;
    this.relationsTable = relationsTable;
    this.db = new Database(':memory:');
    this.client = new Client(dbConfig);
    this.nodes = [];
    this.nodeIds = new Set();
    this.ways = [];
    this.relations = [];
    this.nodeStreamAmount = 100000;
    this.wayStreamAmount = 50000;
    this.relationStreamAmount = 75000;
  }

  initialize() {
    this.db.exec(`
      CREATE TABLE nodes_map(
        id INTEGER PRIMARY KEY,
        lon REAL,
        lat REAL
      )
    `);
    this.insertNodeStmt = this.db.prepare('INSERT OR REPLACE INTO nodes_map(id, lon, lat) VALUES (?, ?, ?)');
    this.lookupNodeStmt = this.db.prepare('SELECT id, lon, lat FROM nodes_map WHERE id = ?');
    return this.client.connect();
  }

  async finalize() {
    this.insertNodeStmt = null;
    this.lookupNodeStmt = null;
    this.db.close();
    await this.client.end();
  }

  async handleItems(items) {
    for (const item of items) {
      if (item.type === 'node') {
        this.insertNodeStmt.run(item.id, item.lon, item.lat);
        continue;
      }

      if (item.type === 'way') {
        const highway = item.tags && item.tags.highway;
        if (!HIGHWAY_TYPES.has(highway)) continue;

        const refs = item.refs || [];
        const linestring = [];
        for (const ref of refs) {
          const node = this.lookupNodeStmt.get(ref);
          if (!node) continue;
          this.addNode([node.id, node.lon, node.lat]);
          linestring.push(`${node.lon} ${node.lat}`);
        }
        if (linestring.length >= 2) {
          this.ways.push([
            item.id,
            `{${refs.join(', ')}}`,
            JSON.stringify(item.tags || {}),
            `LINESTRING(${linestring.join(', ')})`,
          ]);
        }
        continue;
      }

      if (item.type === 'relation' && item.tags && item.tags.type === 'restriction') {
        this.relations.push([
          item.id,
          JSON.stringify(item.members || []),
          JSON.stringify(item.tags || {}),
        ]);
      }
    }
  }

  addNode(node) {
    const osmId = node[0];
    if (this.nodeIds.has(osmId)) return;
    this.nodeIds.add(osmId);
    this.nodes.push(node);
  }

  async streamOSMObjects() {
    const jobs = [];
    if (this.nodes.length >= this.nodeStreamAmount) jobs.push(this.streamNodes());
    if (this.ways.length >= this.wayStreamAmount) jobs.push(this.streamWays());
    if (this.relations.length >= this.relationStreamAmount) jobs.push(this.streamRelations());
    await Promise.all(jobs);
  }

  async flushOSMObjects() {
    const jobs = [];
    if (this.nodes.length) jobs.push(this.streamNodes());
    if (this.ways.length) jobs.push(this.streamWays());
    if (this.relations.length) jobs.push(this.streamRelations());
    await Promise.all(jobs);
  }

  async streamNodes() {
    const rows = this.nodes;
    this.nodes = [];
    const readable = Readable.from([rowsToDelimited(rows)]);
    const copyStream = this.client.query(copyFrom(`
      COPY ${this.nodesTable}(osm_id, lon, lat)
      FROM STDIN WITH (FORMAT CSV, DELIMITER '|')
    `));
    await new Promise((resolve, reject) => pipeline(readable, copyStream, (err) => err ? reject(err) : resolve()));
  }

  async streamWays() {
    const rows = this.ways;
    this.ways = [];
    const readable = Readable.from([rowsToDelimited(rows)]);
    const copyStream = this.client.query(copyFrom(`
      COPY ${this.waysTable}(osm_id, refs, tags, wkb_geometry)
      FROM STDIN WITH (FORMAT CSV, DELIMITER '|')
    `));
    await new Promise((resolve, reject) => pipeline(readable, copyStream, (err) => err ? reject(err) : resolve()));
  }

  async streamRelations() {
    const rows = this.relations;
    this.relations = [];
    const readable = Readable.from([rowsToDelimited(rows)]);
    const copyStream = this.client.query(copyFrom(`
      COPY ${this.relationsTable}(osm_id, members, tags)
      FROM STDIN WITH (FORMAT CSV, DELIMITER '|')
    `));
    await new Promise((resolve, reject) => pipeline(readable, copyStream, (err) => err ? reject(err) : resolve()));
  }
}

module.exports = OSMObjectHandler;
