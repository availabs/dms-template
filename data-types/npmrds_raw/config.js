/**
 * RITIS credential loading for npmrds_raw.
 *
 * Secrets live in a GITIGNORED, per-environment `ritis.config.json` in this
 * plugin dir (never committed). Shape: { url, username, password, totpSecret }.
 * Copy the values from the legacy avail-falcor npmrds_raw/ritis.config.json at
 * deploy time. Nothing here is logged.
 */
const { readFileSync, existsSync } = require('fs');
const { join } = require('path');

const REQUIRED = ['url', 'username', 'password', 'totpSecret'];

function validateRitisConfig(cfg) {
  const c = cfg || {};
  const missing = REQUIRED.filter((k) => !c[k]);
  if (missing.length) {
    // Never include secret values — only the names of missing keys.
    throw new Error(`ritis.config.json is missing required key(s): ${missing.join(', ')}`);
  }
  return { url: c.url, username: c.username, password: c.password, totpSecret: c.totpSecret };
}

function loadRitisConfig(configPath = join(__dirname, 'ritis.config.json')) {
  if (!existsSync(configPath)) {
    throw new Error(
      `RITIS config not found at ${configPath}. Create a gitignored ritis.config.json ` +
      `with { url, username, password, totpSecret } (copy from the legacy npmrds_raw/ritis.config.json).`
    );
  }
  let raw;
  try {
    raw = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (e) {
    throw new Error(`Could not parse ritis.config.json at ${configPath}: ${e.message}`);
  }
  return validateRitisConfig(raw);
}

module.exports = { validateRitisConfig, loadRitisConfig, REQUIRED };
