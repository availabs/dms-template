const fs = require('fs');
const path = require('path');
const Busboy = require('busboy');

const worker = require('./worker');

const UPLOAD_DIR = process.env.DAMA_ETL_DIR || path.join(__dirname, '../../src/dms/packages/dms-server/var/tmp-etl');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

async function extractZip(zipPath, targetDir) {
  const extract = require('extract-zip');
  await extract(zipPath, { dir: path.resolve(targetDir) });
}

function findPbfFile(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name.startsWith('__')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findPbfFile(fullPath);
      if (found) return found;
      continue;
    }

    if (path.extname(entry.name).toLowerCase() === '.pbf') {
      return fullPath;
    }
  }

  return null;
}

module.exports = {
  workers: {
    'osm/upload': worker,
  },
  routes: (router, helpers) => {
    router.post('/upload', async (req, res) => {
      const { pgEnv } = req.params;
      const busboy = Busboy({ headers: req.headers });

      const fields = {};
      let savedFilePath = null;
      let savedFileName = null;
      let writePromise = null;

      const workDir = path.join(UPLOAD_DIR, `osm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
      fs.mkdirSync(workDir, { recursive: true });

      busboy.on('field', (name, value) => {
        fields[name] = value;
      });

      busboy.on('file', (fieldname, stream, info) => {
        const { filename } = info;
        savedFileName = filename;
        savedFilePath = path.join(workDir, filename);
        const out = fs.createWriteStream(savedFilePath);
        stream.pipe(out);
        writePromise = new Promise((resolve, reject) => {
          out.on('finish', resolve);
          out.on('error', reject);
          stream.on('error', reject);
        });
      });

      busboy.on('finish', async () => {
        try {
          if (!savedFilePath || !writePromise) {
            console.error('[osm] upload rejected: no file uploaded');
            return res.status(400).json({ error: 'No file uploaded' });
          }
          await writePromise;
          let queuedFilePath = savedFilePath;
          let queuedFileName = savedFileName;

          if (path.extname(savedFileName).toLowerCase() === '.zip') {
            const extractDir = path.join(workDir, 'unzipped');
            fs.mkdirSync(extractDir, { recursive: true });
            await extractZip(savedFilePath, extractDir);

            const extractedPbfPath = findPbfFile(extractDir);
            if (!extractedPbfPath) {
              return res.status(400).json({ error: 'ZIP upload must contain a .pbf file' });
            }

            queuedFilePath = extractedPbfPath;
            queuedFileName = path.relative(workDir, extractedPbfPath);
          }

          const categories = fields.categories ? JSON.parse(fields.categories) : [['OSM']];
          const userId = fields['user.id'] ? Number(fields['user.id']) : null;
          const sourceValues = {
            name: fields.name,
            type: fields.type || 'gis_dataset',
            categories,
          };

          if (!sourceValues.name) {
            console.error('[osm] upload rejected: missing name field');
            return res.status(400).json({ error: 'name is required' });
          }

          let sourceId = fields.source_id ? Number(fields.source_id) : null;
          let isNewSourceCreate = false;
          if (!sourceId) {
            isNewSourceCreate = true;
            const created = await helpers.createDamaSource({
              ...sourceValues,
              ...(userId ? { user_id: userId } : {}),
            }, pgEnv);
            sourceId = created.source_id;
          }

          const taskId = await helpers.queueTask({
            workerPath: 'osm/upload',
            sourceId,
            source_id: sourceId,
            user_id: userId,
            osm_file_path: queuedFilePath,
            osm_file_name: queuedFileName,
            working_directory: workDir,
            isNewSourceCreate,
          }, pgEnv);
          res.json({ etl_context_id: taskId, source_id: sourceId });
        } catch (err) {
          console.error('[osm] upload route failed:', err);
          if (err?.stack) console.error(err.stack);
          res.status(500).json({ error: err.message });
        }
      });

      busboy.on('error', (err) => {
        console.error('[osm] busboy failed:', err);
        if (err?.stack) console.error(err.stack);
        res.status(500).json({ error: err.message || 'Upload failed' });
      });

      req.pipe(busboy);
    });
  },
};
