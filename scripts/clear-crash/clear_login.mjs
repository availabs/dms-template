#!/usr/bin/env node
/**
 * Log in to CLEAR (NYSDOT Crash Data Viewer) and cache an ArcGIS Portal token.
 *
 * The portal federates to NY.GOV (Okta at login.ny.gov). Okta's classic
 * /api/v1/authn is blocked for this org (403 E0000006), so the sign-in is driven in a
 * real browser; everything after this step is plain HTTP with the token.
 *
 * Runs headful by default when a DISPLAY is available so MFA can be completed by hand.
 * The Okta session + portal cookies are persisted, so later runs usually go through
 * untouched (use --headless once a session exists).
 *
 *   node clear_login.mjs [--headless] [--headful] [--fresh] [--timeout 300]
 *
 * Writes ~/.cache/clear-cdv/token.json   {token, expires_at}   (0600)
 *        ~/.cache/clear-cdv/state.json   browser storage state (0600)
 *
 * Credentials: $CLEAR_USERNAME/$CLEAR_PASSWORD, else a "user:password" line in
 * $CLEAR_CREDS (default: dms-template/references/workzone_saftey/clear.txt).
 */
import { chromium } from '/home/alex/code/avail/dms-template/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORTAL = 'https://clear.dot.ny.gov/portal';
const CLIENT_ID = 'MzC7GexR4ybYlSXh';
const REDIRECT_URI = 'https://clear.dot.ny.gov/clear/cdv/query';
const TOKEN_MINUTES = 20160; // 14 days, the portal max
const AUTH_URL = `${PORTAL}/sharing/rest/oauth2/authorize?client_id=${CLIENT_ID}`
  + `&response_type=token&expiration=${TOKEN_MINUTES}`
  + `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

const CACHE_DIR = process.env.CLEAR_CACHE_DIR || path.join(os.homedir(), '.cache', 'clear-cdv');
const TOKEN_FILE = path.join(CACHE_DIR, 'token.json');
const PROFILE_DIR = path.join(CACHE_DIR, 'profile');
const DEFAULT_CREDS = '/home/alex/code/avail/dms-template/references/workzone_saftey/clear.txt';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const TIMEOUT = Number(arg('--timeout', 300)) * 1000;
// my.ny.gov (the NY.gov ID login behind Okta) is fronted by F5 Shape bot defense, which
// resets headless Chromium outright. Headful real Chrome is the only reliable path.
const headless = has('--headless');
const MANUAL = has('--manual');
const STOP_AT_LOGIN = has('--stop-at-login');

const log = (...a) => console.error('[login]', ...a);

function credentials() {
  if (process.env.CLEAR_USERNAME && process.env.CLEAR_PASSWORD) {
    return { user: process.env.CLEAR_USERNAME, pass: process.env.CLEAR_PASSWORD };
  }
  const p = process.env.CLEAR_CREDS || DEFAULT_CREDS;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('http')) continue;
    const i = t.indexOf(':');
    if (i > 0 && !t.slice(0, i).includes(' ')) {
      return { user: t.slice(0, i), pass: t.slice(i + 1) };
    }
  }
  throw new Error(`no "user:password" line found in ${p}`);
}

function writeSecret(file, data) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(file, data, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
}

/** Fill whatever sign-in form Okta is showing (classic widget or Identity Engine). */
async function fillIfPresent(page, selectors, value) {
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.count().catch(() => 0)) {
      if (await el.isVisible().catch(() => false)) {
        await el.fill(value);
        return true;
      }
    }
  }
  return false;
}

// my.ny.gov is a JSF app ("loginform:username"); the Okta selectors are kept as a
// fallback in case NY ever moves the credential step back to login.ny.gov.
const USER_SEL = ['input[name="loginform:username"]', '#okta-signin-username',
  'input[name="identifier"]', 'input[name="username"]',
  'input[autocomplete="username"]', 'input[type="email"]'];
const PASS_SEL = ['input[name="loginform:password"]', '#okta-signin-password',
  'input[name="credentials.passcode"]', 'input[name="password"]', 'input[type="password"]'];
const SUBMIT_SEL = ['button[name="loginform:signinButton"]', '#okta-signin-submit',
  'input[type="submit"]', 'button[type="submit"]',
  'button:has-text("Sign In")', 'button:has-text("Next")', 'button:has-text("Verify")'];

async function main() {
  let user = '', pass = '';
  if (!MANUAL) ({ user, pass } = credentials());
  log(MANUAL ? 'manual sign-in (browser window)'
             : `signing in as ${user} (${headless ? 'headless' : 'headful'})`);

  if (has('--fresh')) fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  // A persistent profile keeps the my.ny.gov / Okta session between runs, so the
  // interactive step is only needed when that session finally expires.
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless,
    channel: 'chrome',
    viewport: { width: 1360, height: 950 },
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const browser = ctx.browser() || { close: () => ctx.close() };
  const page = ctx.pages()[0] || (await ctx.newPage());

  // Resolve as soon as the OAuth redirect carries the token — the CDV app itself never
  // has to finish loading.
  let token = null, expiresIn = TOKEN_MINUTES * 60;
  const captured = new Promise((resolve) => {
    const grab = (url) => {
      const i = url.indexOf('access_token=');
      if (i < 0 || !url.startsWith(REDIRECT_URI)) return;
      const q = new URLSearchParams(url.slice(url.indexOf('#') >= 0 ? url.indexOf('#') + 1 : i));
      if (!q.get('access_token')) return;
      token = q.get('access_token');
      expiresIn = Number(q.get('expires_in') || expiresIn);
      resolve();
    };
    page.on('framenavigated', (f) => { if (f === page.mainFrame()) grab(f.url()); });
    page.on('response', (r) => { const l = r.headers()['location']; if (l) grab(l); });
  });

  if (has('--trace')) {
    page.on('framenavigated', (f) => {
      if (f === page.mainFrame()) log('nav ->', f.url().slice(0, 160));
    });
    page.on('requestfailed', (r) =>
      log('requestfailed', r.url().slice(0, 160), r.failure()?.errorText));
    page.on('response', (r) => {
      if (r.request().resourceType() === 'document') log('doc', r.status(), r.url().slice(0, 160));
    });
  }

  await page.goto(AUTH_URL, { waitUntil: 'networkidle', timeout: 60000 });

  // "Sign in to ArcGIS Enterprise with  [NY.GOV] [ArcGIS login]" — the federated-login
  // buttons are rendered by the portal's JS, so click the deepest node holding the label.
  if (!token && page.url().includes('/oauth2/')) {
    const clicked = await page.evaluate(() => {
      const el = [...document.querySelectorAll('a,button,div,span,li,p')]
        .find((e) => e.children.length === 0 && /^\s*NY\.GOV\s*$/i.test(e.textContent || ''));
      if (!el) return false;
      (el.closest('a,button,[role=button]') || el).click();
      return true;
    });
    if (clicked) {
      log('choosing the NY.GOV enterprise login');
      await page.waitForURL(/login\.ny\.gov|access_token=/, { timeout: 60000 }).catch(() => {});
    } else {
      log('no NY.GOV button found on the sign-in page');
    }
  }

  // my.ny.gov serves an F5 Shape JS challenge first and only then the real form.
  if (!token && page.url().includes('my.ny.gov')) {
    log('waiting for the my.ny.gov form (bot-defense challenge)');
    await page.waitForSelector('input[type=password]', { timeout: 90000 }).catch(() => {});
  }

  if (STOP_AT_LOGIN) {
    await page.waitForLoadState('networkidle').catch(() => {});
    log(`stopped at ${page.url()}`);
    const form = await page.evaluate(() => ({
      title: document.title,
      url: location.href,
      inputs: [...document.querySelectorAll('input,button')]
        .filter((e) => e.offsetParent !== null || e.type === 'hidden')
        .slice(0, 25)
        .map((e) => ({ tag: e.tagName, type: e.type, name: e.name, id: e.id,
                       value: e.type === 'password' ? '' : (e.value || '').slice(0, 30),
                       text: (e.innerText || '').trim().slice(0, 30) })),
    }));
    console.log(JSON.stringify(form, null, 1));
    await ctx.close();
    return;
  }

  if (!token && !MANUAL && /login\.ny\.gov|my\.ny\.gov/.test(page.url())) {
    await page.waitForLoadState('domcontentloaded');
    if (await fillIfPresent(page, USER_SEL, user)) {
      log('filled username');
      if (!(await fillIfPresent(page, PASS_SEL, pass))) {
        // Identity Engine splits identifier and password across two screens
        for (const s of SUBMIT_SEL) {
          const b = page.locator(s).first();
          if (await b.count().catch(() => 0) && await b.isVisible().catch(() => false)) {
            await b.click(); break;
          }
        }
        await page.waitForTimeout(2000);
        await fillIfPresent(page, PASS_SEL, pass);
      }
      log('filled password, submitting');
      for (const s of SUBMIT_SEL) {
        const b = page.locator(s).first();
        if (await b.count().catch(() => 0) && await b.isVisible().catch(() => false)) {
          await b.click(); break;
        }
      }
    } else {
      log('no sign-in form found — the saved session may already be valid');
    }
  }

  if (!token) {
    log(`waiting for the OAuth redirect (up to ${TIMEOUT / 1000}s)`);
    if (!headless) log('complete any MFA prompt in the browser window');
    const timer = new Promise((_, rej) =>
      setTimeout(() => rej(new Error('timed out waiting for the portal token')), TIMEOUT));
    try {
      await Promise.race([captured, timer]);
    } catch (e) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      await page.screenshot({ path: path.join(CACHE_DIR, 'login-failure.png'), fullPage: true })
        .catch(() => {});
      fs.writeFileSync(path.join(CACHE_DIR, 'login-failure.html'), await page.content());
      log(`stuck at ${page.url()}`);
      log(`dumped login-failure.{png,html} to ${CACHE_DIR}`);
      await browser.close();
      throw e;
    }
  }

  writeSecret(TOKEN_FILE, JSON.stringify({
    token, expires_at: Math.floor(Date.now() / 1000) + expiresIn,
  }));
  await ctx.close();

  log(`token cached to ${TOKEN_FILE} (valid ${(expiresIn / 86400).toFixed(1)} days)`);
  if (has('--print-token')) process.stdout.write(token + '\n');
}

main().catch((e) => { console.error('[login] FAILED:', e.message); process.exit(1); });
