/**
 * RITIS / NPMRDS client for npmrds_raw.  ⚠️ LIVE-ONLY GLUE — NOT UNIT-TESTED.
 *
 * ── IRON-CLAD RATE LIMIT ──────────────────────────────────────────────────
 * Initiates RITIS downloads. NEVER call this from a test (tests inject a fake
 * client). At most ONE download/day, only with explicit user permission — the
 * RITIS account's limits are shared with other AVAIL production work.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Heavy deps (puppeteer/axios/otplib/extract-zip) are lazily required INSIDE
 * methods so this module loads fine where they're absent (e.g. test/CI hosts).
 * The DMS server image must add Chrome/Puppeteer for a real run.
 *
 * Ported structurally from the legacy avail-falcor npmrds_raw helpers. The exact
 * Puppeteer selectors / RITIS payloads must be re-confirmed during the first
 * user-approved manual publish.
 */
const { loadRitisConfig } = require('./config');
const { extractPDAAppStore, getFileName } = require('./parse');

const VEHICLE_SOURCES = ['npmrds2_combined', 'npmrds2_passenger', 'npmrds2_truck'];
const MAX_TMC_BATCH = 7000;
const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 min — RITIS job completion poll
const MAX_POLLS = 500;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function makeRitisClient(cfgOverride) {
  const cfg = cfgOverride || loadRitisConfig();
  let cookies = null;

  async function login() {
    const puppeteer = require('puppeteer');
    const { authenticator } = require('otplib');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu',
        '--disable-dev-shm-usage', '--single-process', '--no-zygote'],
    });
    try {
      const page = await browser.newPage();
      await page.goto(cfg.url);
      await page.waitForSelector('#login-email');
      await page.type('input[name=email]', cfg.username);
      await page.type('input[name=password]', cfg.password);
      await page.click('button[type=submit]');
      // TOTP 2FA
      const token = authenticator.generate(cfg.totpSecret);
      await page.waitForSelector('#twoFactorCode-code');
      await page.type('#twoFactorCode-code', token);
      await page.click('.Button.variant-default.size-wide');
      await page.waitForFunction(() => window.location.hostname === 'npmrds.ritis.org', { timeout: 20000 });
      await page.waitForSelector('.menu-item-content', { timeout: 10000 });
      cookies = await page.cookies();
      return cookies;
    } finally {
      await browser.close();
    }
  }

  async function getCookies({ refresh = false } = {}) {
    if (refresh || !cookies) await login();
    return cookies;
  }

  function cookieHeader() {
    return (cookies || []).map((c) => `${c.name}=${c.value}`).join('; ');
  }

  async function getLatestAvailableDate() {
    await getCookies({ refresh: true });
    // Puppeteer-scrapes the download page's date widget. Selector behavior must
    // be re-confirmed in the manual run (legacy: getLatestDate()).
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu',
        '--disable-dev-shm-usage', '--single-process', '--no-zygote'],
    });
    try {
      const page = await browser.newPage();
      await page.setCookie(...cookies);
      await page.goto('https://npmrds.ritis.org/analytics/download/');
      await page.waitForSelector('#SimpleDropDown-DropDownOrLabel');
      await page.click('#SimpleDropDown-DropDownOrLabel');
      const handle = await page.waitForSelector('.date-range-wrapper.upper-date input');
      return await handle.evaluate((el) => el.value); // 'MM/DD/YYYY'
    } finally {
      await browser.close();
    }
  }

  async function fetchAtlasVersions() {
    const axios = require('axios');
    const { data: html } = await axios.get('https://npmrds.ritis.org/analytics/download/', {
      headers: { Cookie: cookieHeader() },
    });
    return extractPDAAppStore(html); // rawDataSourcesFromServer
  }

  async function getRegionTmcs({ year, stateCode, includeFullTmcNetwork = true }) {
    const axios = require('axios');
    const sources = await fetchAtlasVersions();
    const withVersions = (sources || []).find((s) => (s.metadata_versions || []).length > 1);
    const yToV = (withVersions ? withVersions.metadata_versions : []).reduce(
      (acc, v) => { acc[v.display_name] = v.id; return acc; }, {});
    const atlas_version_id = yToV[year === 2016 ? 2017 : year];
    const states_and_counties = { [stateCode]: [] };

    const tmcResp = await axios.post('https://npmrds.ritis.org/api/region_tmcs/', {
      datasource_id: 'npmrds2_passenger', atlas_version_id, states_and_counties,
      zip_codes: [], directions: [], road_classes: [], states_and_counties_title: stateCode,
      segment_type: 'TMC', include_full_tmc_network: includeFullTmcNetwork, country_code: 'USA', tool_id: '3',
    }, { headers: { Cookie: cookieHeader() } });
    const regionTmcs = (tmcResp.data || []).map((r) => r.tmc);

    const tmcToGeo = [];
    for (let i = 0; i < regionTmcs.length; i += MAX_TMC_BATCH) {
      const segments = regionTmcs.slice(i, i + MAX_TMC_BATCH);
      const geoResp = await axios.post('https://npmrds.ritis.org/api/direct_database_query_road_coordinates/', {
        datasource_id: 'npmrds2_passenger', atlas_version_id, geo_limit: segments.length,
        include_full_tmc_network: includeFullTmcNetwork, country_code: null, tool_id: '3', segments,
      }, { headers: { Cookie: cookieHeader() } });
      for (const f of geoResp.data?.geojson?.features || []) {
        const g = f.geometry;
        const wkt = g.type === 'LineString'
          ? `MULTILINESTRING((${g.coordinates.map((c) => c.join(' ')).join(',')}))`
          : `MULTILINESTRING(${g.coordinates.map((l) => `(${l.map((c) => c.join(' ')).join(',')})`).join(',')})`;
        tmcToGeo.push({ tmc: f.id, wkb_geometry: wkt });
      }
    }
    return { regionTmcs, tmcToGeo, atlas_version_id };
  }

  async function requestAndAwaitDownloads({ regionTmcs, name, startDate, endDate, averagingWindowSize = 0, atlas_version_id }) {
    const axios = require('axios');
    const { generateDateRanges } = require('./dates');
    const DATE_RANGES = generateDateRanges(startDate, endDate);
    const submitted = [];
    for (const source of VEHICLE_SOURCES) {
      const includeUni = source !== 'npmrds2_combined';
      const body = {
        TMCS: regionTmcs, DATE_RANGES, NAME: name, ROAD_PROVIDER: source,
        ROAD_DETAILS: [{ SEGMENT_IDS: regionTmcs, DATASOURCE_ID: source, ATLAS_VERSION_ID: atlas_version_id }],
        DESCRIPTION: '', AVERAGING_WINDOW_SIZE: averagingWindowSize,
        COLUMNS: ['speed', 'average_speed', 'reference_speed', 'travel_time_minutes', 'data_density'],
        ADD_NULL_RECORDS: false, TRAVEL_TIME_UNITS: 'seconds', SEND_NOTIFICATION_EMAIL: false,
        INCLUDE_SPEED_BINS_AND_PERCENTILES: false, COUNTRY_CODE: 'USA',
        ...(includeUni ? { INCLUDE_NPMRDS_UNI_DIR_COLUMNS: true } : {}),
      };
      const { data } = await axios.post('https://npmrds.ritis.org/export/submit/', body, {
        headers: { Cookie: cookieHeader() },
      });
      submitted.push({ uuid: data.uuid, vehicle_class: source });
      await delay(2000);
    }
    // Poll until all jobs SUCCEEDED.
    for (let i = 0; i < MAX_POLLS; i++) {
      const { data: history } = await axios.post('https://npmrds.ritis.org/api/user_history/',
        { uuids: '' }, { headers: { Cookie: cookieHeader() } });
      const statuses = submitted.map((s) => (history || []).find((h) => h.uuid === s.uuid));
      if (statuses.every((h) => h && h.hadoop_status && h.hadoop_status.state === 'SUCCEEDED')) {
        await delay(30000); // belt-and-suspenders
        return submitted;
      }
      await delay(POLL_INTERVAL_MS);
    }
    throw new Error('npmrds_raw: RITIS export jobs did not complete in time');
  }

  async function downloadAndExtract({ downloads, workDir }) {
    const axios = require('axios');
    const extract = require('extract-zip');
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const dir = workDir || fs.mkdtempSync(path.join(os.tmpdir(), 'npmrds_raw_'));
    const out = [];
    for (const dl of downloads) {
      const resp = await axios.get(`https://npmrds.ritis.org/export/download/${dl.uuid}?dl=1`, {
        responseType: 'stream',
      });
      const base = getFileName(resp.headers['content-disposition']) || `${dl.uuid}`;
      const zipPath = path.join(dir, `${base.replace(/\.zip$/, '')}_${dl.uuid}.zip`.replace(/-/g, '_'));
      await new Promise((res, rej) => {
        const w = fs.createWriteStream(zipPath);
        resp.data.pipe(w); w.on('finish', res); w.on('error', rej);
      });
      const extDir = path.join(dir, 'extracted');
      await extract(zipPath, { dir: extDir });
      out.push({
        vehicle_class: dl.vehicle_class,
        csvPath: path.join(extDir, fs.readdirSync(extDir).find((f) => /\.csv$/i.test(f) && !/TMC_Identification/i.test(f))),
        tmcIdentificationPath: path.join(extDir, 'TMC_Identification.csv'),
      });
    }
    return out;
  }

  return {
    getCookies,
    getLatestAvailableDate,
    getRegionTmcs,
    requestAndAwaitDownloads,
    downloadAndExtract,
  };
}

module.exports = { makeRitisClient, VEHICLE_SOURCES };
