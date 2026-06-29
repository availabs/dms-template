/**
 * Live TRANSCOM API client (xcmdata.org HistoricalEventSearch).
 *
 * Ported from the legacy avail-falcor authTokenController.js (puppeteer SSO
 * login that harvests the jwt + JSESSIONID/XSRF/Anti-Forgery cookies) plus
 * getEventIds.js / getTranscomEvents.js (the two REST calls).
 *
 * NEVER used by tests — workers receive a fake via makeWorker deps. This
 * module can only be verified against the live TRANSCOM SSO.
 *
 * Credentials come from TRANSCOM_USERNAME / TRANSCOM_PASSWORD env vars
 * (the legacy code hardcoded "nysdotuser"/"nysdotuser" with a "set to the
 * .env" TODO — honored here, with the legacy value as the fallback).
 *
 * puppeteer is loaded lazily so environments that never run a live transcom
 * ingest don't need it installed.
 */
const { partitionTimestampsByMonth } = require('./dates.js');

const SSO_LOGIN_URL = 'https://xcmdfe1.xcmdata.org/SSO/#!/login';
const HISTORICAL_EVENT_SEARCH_URL = 'https://xcmdfe1.xcmdata.org/SSO/#!/home/app/HistoricalEventSearch';
const EVENT_GRID_URL = 'https://eventsearch.xcmdata.org/HistoricalEventSearch/xcmEvent/getEventGridData';
const EVENT_BY_ID_URL = 'https://eventsearch.xcmdata.org/HistoricalEventSearch/xcmEvent/getEventById';
const REFERER = 'https://eventsearch.xcmdata.org/HistoricalEventSearch/?appId=88';

const REQUIRED_COOKIES = ['JSESSIONID', 'XSRF-Cookie', 'Anti-Forgery-Cookie'];
const SSO_COOKIE_NAMES = [
  '_ga', 'sso_displayName', 'sso_orgName', 'sso_token', 'sso_orgLogo',
  'sso_orgSiteUrl', 'sso_rightorgLogo', 'sso_rightorgSiteUrl', 'sso_FooterData',
  '_ga_6YYDNHMN43', 'sso_jwtToken', '_ga_H5QEG6G104',
];
const DEFAULT_SLEEP_MS = 5 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class AuthTokenCollector {
  constructor(username, password) {
    this._username = username;
    this._password = password;
    this._page = null;
    this.browserPromise = null;
    this.tokenPromise = null;
    this.refreshInterval = null;
    this.pageCookies = null;
    this.historicalEventSearchCookies = null;
  }

  async getToken() {
    if (!this.browserPromise) await this.start();
    let token;
    while (!(token = await this.tokenPromise)) await sleep(1000);
    return token;
  }

  async getCookies() {
    if (!this.browserPromise) await this.start();
    let cookies;
    while (!(cookies = await this.pageCookies)) await sleep(1000);
    return cookies.reduce((acc, { name, value }) => { acc[name] = value; return acc; }, {});
  }

  async awaitHistoricalCookies(maxRefreshes = 5) {
    let n = 0;
    while (!REQUIRED_COOKIES.every((name) => this.historicalEventSearchCookies
      && this.historicalEventSearchCookies[name])) {
      if (++n > maxRefreshes) throw new Error('Refresh count error in auth');
      await sleep(3000);
    }
    return this.historicalEventSearchCookies;
  }

  async start() {
    if (this.browserPromise) return;
    let puppeteer;
    try {
      puppeteer = require('puppeteer'); // lazy — only a live ingest needs it
    } catch (e) {
      throw new Error(
        'transcom: the live TRANSCOM client requires puppeteer (npm i puppeteer) — '
        + 'tests and non-transcom deployments never load it.'
      );
    }

    try {
      this.browserPromise = puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      });
      const browser = await this.browserPromise;
      const page = await browser.newPage();
      this._page = page;
      await page.setRequestInterception(true);
      page.on('request', (request) => request.continue());

      page.on('response', async (response) => {
        if (!/HistoricalEventSearch/.test(response.url())) return;
        const setCookieHeader = response.headers()['set-cookie'];
        if (!setCookieHeader) return;
        const cookieStrings = Array.isArray(setCookieHeader)
          ? setCookieHeader
          : setCookieHeader.split(/\n|,(?=[^;]+=[^;]+)/);
        for (const cookieStr of cookieStrings) {
          const [pair] = cookieStr.trim().split(';');
          const [key, value] = pair.split('=');
          if (key && value && REQUIRED_COOKIES.includes(key.trim())) {
            this.historicalEventSearchCookies = this.historicalEventSearchCookies || {};
            this.historicalEventSearchCookies[key.trim()] = value.trim();
          }
        }
      });

      await page.goto(SSO_LOGIN_URL);
      await page.waitForNetworkIdle();
      await page.waitForSelector('.login-inner-box');

      const usernameInput = await page.$('.login-inner-box #lgnName');
      const passwordInput = await page.$('.login-inner-box input[type="password"]');
      const loginButton = await page.$('.login-inner-box button[data-ng-click="lgn.doLogin();"]');
      if (!usernameInput || !passwordInput || !loginButton) throw new Error('loginBox not found');

      await usernameInput.type(this._username);
      await passwordInput.type(this._password);
      await sleep(2000);
      await loginButton.click();
      await sleep(5000);

      await page.goto(HISTORICAL_EVENT_SEARCH_URL, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(2000);
      while (page.url() !== HISTORICAL_EVENT_SEARCH_URL) {
        await page.goto(HISTORICAL_EVENT_SEARCH_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        await sleep(3000);
      }

      this.refreshInterval = setInterval(async () => {
        try {
          await sleep(2000);
          this.tokenPromise = page.evaluate(() => {
            try {
              // eslint-disable-next-line no-undef
              const { jwtToken } = JSON.parse(localStorage.getItem('user'));
              return jwtToken;
            } catch (err) { return undefined; }
          });
          this.pageCookies = page.cookies();
        } catch (err) {
          await this.close();
          throw new Error(`AuthTokenCollector: error refreshing token - ${err.message}`);
        }
      }, 5000);
    } catch (error) {
      await this.close();
      throw new Error(`AuthTokenCollector: error starting - ${error.message}`);
    }
  }

  async close() {
    if (this.browserPromise) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      const browser = await this.browserPromise;
      this.browserPromise = null;
      await browser.close();
    }
  }
}

async function buildHeaders(tokenCollector) {
  const token = await tokenCollector.getToken();
  const cookies = await tokenCollector.getCookies();
  const hes = await tokenCollector.awaitHistoricalCookies();

  const cookieStr = [
    `JSESSIONID=${hes.JSESSIONID}`,
    SSO_COOKIE_NAMES.map((n) => `${n}=${cookies[n]}`).join('; '),
    `XSRF-Cookie=${hes['XSRF-Cookie']}`,
    `Anti-Forgery-Cookie=${hes['Anti-Forgery-Cookie']}`,
  ].join('; ');

  return {
    accept: 'application/json, text/plain, */*',
    'accept-language': 'en-US,en;q=0.9',
    authenticationtoken: `Bearer ${token}`,
    'content-type': 'application/json',
    'x-xsrf-token': hes['XSRF-Cookie'],
    cookie: `${cookieStr};`,
    Referer: REFERER,
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}

/**
 * makeTranscomClient({ username, password }) -> {
 *   collectEventIdsForTimeRange(startTs, endTs),  // 'YYYY-MM-DD HH:MM:SS'
 *   downloadEvents(eventIds),
 *   close(),
 * }
 * This object shape IS the injectable dep contract the workers consume.
 */
function makeTranscomClient({
  username = process.env.TRANSCOM_USERNAME,
  password = process.env.TRANSCOM_PASSWORD,
} = {}) {
  // No committed fallback creds (repo rule). The legacy hardcoded value lives in
  // avail-falcor transcom workers ("set to the .env" TODO) — set the env vars instead.
  if (!username || !password) {
    throw new Error(
      'TRANSCOM credentials missing: set TRANSCOM_USERNAME / TRANSCOM_PASSWORD env vars (no committed defaults).'
    );
  }
  const tokenCollector = new AuthTokenCollector(username, password);

  return {
    async collectEventIdsForTimeRange(startTimestamp, endTimestamp) {
      const eventIds = [];
      for (const [partStart, partEnd] of partitionTimestampsByMonth(startTimestamp, endTimestamp)) {
        await sleep(DEFAULT_SLEEP_MS);
        const headers = await buildHeaders(tokenCollector);
        const res = await fetch(`${EVENT_GRID_URL}?m=${Math.random()}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            eventCategoryIds: '1,2,3,4,13',
            eventStatus: '',
            eventType: '',
            state: '',
            county: '',
            city: '',
            reportingOrg: '',
            facility: '',
            primaryLoc: '',
            secondaryLoc: '',
            eventDuration: null,
            startDateTime: partStart,
            endDateTime: partEnd,
            orgID: '15',
            direction: '',
            iseventbyweekday: 1,
            tripIds: '',
          }),
        });
        const { data: events } = JSON.parse(await res.text());
        eventIds.push(...(events || []).map((e) => e.id));
      }
      return eventIds;
    },

    async downloadEvents(eventIds) {
      await sleep(DEFAULT_SLEEP_MS);
      const headers = await buildHeaders(tokenCollector);
      const reqUrl = `${EVENT_BY_ID_URL}?id=${eventIds.join('&id=')}&m=${Math.random()}`;
      const response = await fetch(reqUrl, { method: 'GET', headers });
      const { data } = await response.json();
      return data;
    },

    async close() {
      await tokenCollector.close();
    },
  };
}

module.exports = { makeTranscomClient, AuthTokenCollector };
