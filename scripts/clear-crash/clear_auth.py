#!/usr/bin/env python3
"""Log in to the NYSDOT CLEAR Crash Data Viewer and return an ArcGIS Portal token.

Auth chain (all of it is the normal browser flow, just scripted):

    portal /oauth2/authorize            -> oauth_state
    portal /oauth2/saml/authorize       -> 302 to login.ny.gov (Okta) with SAMLRequest
    okta   /api/v1/authn                -> sessionToken   (MFA handled interactively)
    okta   /login/sessionCookieRedirect -> Okta session cookie, replays the SAMLRequest
    okta   SAML auto-POST form          -> portal ACS
    portal ACS                          -> 302 redirect_uri#access_token=...

The token is cached (0600) under ~/.cache/clear-cdv/ so a long extract campaign only logs
in once; portal tokens are requested with a 14-day expiry.

Credentials come from, in order:
  1. $CLEAR_USERNAME / $CLEAR_PASSWORD
  2. a credentials file (--creds, or $CLEAR_CREDS, or the default path below) holding a
     "user:password" line
  3. an interactive prompt
Never pass the password as a command-line argument.
"""

import argparse
import getpass
import json
import os
import re
import sys
import time
import urllib.parse as up
from pathlib import Path

import requests
from bs4 import BeautifulSoup

PORTAL = "https://clear.dot.ny.gov/portal"
CLIENT_ID = "MzC7GexR4ybYlSXh"
REDIRECT_URI = "https://clear.dot.ny.gov/clear/cdv/query"
OKTA = "https://login.ny.gov"
# portal max is 20160 minutes (14 days)
TOKEN_MINUTES = 20160

DEFAULT_CREDS = Path(
    "/home/alex/code/avail/dms-template/references/workzone_saftey/clear.txt"
)
CACHE_DIR = Path(os.environ.get("CLEAR_CACHE_DIR", Path.home() / ".cache" / "clear-cdv"))
TOKEN_FILE = CACHE_DIR / "token.json"

UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)


def log(msg):
    print(f"[auth] {msg}", file=sys.stderr, flush=True)


# --------------------------------------------------------------------------- creds


def read_credentials(creds_path=None):
    user = os.environ.get("CLEAR_USERNAME")
    pw = os.environ.get("CLEAR_PASSWORD")
    if user and pw:
        return user, pw

    path = Path(creds_path or os.environ.get("CLEAR_CREDS") or DEFAULT_CREDS)
    if path.is_file():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or line.startswith("http"):
                continue
            # "user:password" — password may itself contain ':'
            if ":" in line and " " not in line.split(":", 1)[0]:
                u, p = line.split(":", 1)
                if u and p:
                    return u.strip(), p
    log(f"no credentials in env or {path}; prompting")
    return input("NY.gov ID username: ").strip(), getpass.getpass("Password: ")


# --------------------------------------------------------------------------- cache


def load_cached_token(min_remaining_s=3600):
    try:
        d = json.loads(TOKEN_FILE.read_text())
    except Exception:
        return None
    if d.get("expires_at", 0) - time.time() < min_remaining_s:
        return None
    return d


def save_token(token, expires_at):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    TOKEN_FILE.write_text(json.dumps({"token": token, "expires_at": expires_at}))
    TOKEN_FILE.chmod(0o600)


# ----------------------------------------------------------------------------- okta


def okta_authn(s, username, password):
    """Primary auth + MFA. Returns a one-time sessionToken."""
    r = s.post(
        f"{OKTA}/api/v1/authn",
        headers={
            "X-Okta-User-Agent-Extended": "okta-signin-widget-7.19.0",
            "Origin": OKTA,
            "Referer": f"{OKTA}/",
            "Content-Type": "application/json",
        },
        json={
            "username": username,
            "password": password,
            "options": {
                "multiOptionalFactorEnroll": False,
                "warnBeforePasswordExpired": True,
            },
        },
        timeout=60,
    )
    try:
        d = r.json()
    except ValueError:
        raise SystemExit(f"Okta returned non-JSON ({r.status_code}): {r.text[:400]}")
    if r.status_code >= 400:
        raise SystemExit(
            f"Okta rejected the login [{r.status_code} {d.get('errorCode')}]: "
            f"{d.get('errorSummary')} causes={d.get('errorCauses')}"
        )

    while True:
        status = d.get("status")
        log(f"okta status: {status}")

        if status == "SUCCESS":
            return d["sessionToken"]

        if status in ("MFA_REQUIRED", "MFA_CHALLENGE"):
            d = okta_mfa(s, d)
            continue

        if status == "PASSWORD_EXPIRED":
            raise SystemExit(
                "NY.gov ID password has expired — reset it in a browser, then re-run."
            )
        if status == "LOCKED_OUT":
            raise SystemExit("NY.gov ID account is locked out — unlock it in a browser.")
        raise SystemExit(f"Unhandled Okta status {status}: {json.dumps(d)[:500]}")


def _verify(s, factor, state_token, **payload):
    href = factor["_links"]["verify"]["href"]
    r = s.post(
        href, json={"stateToken": state_token, **payload}, timeout=60
    )
    d = r.json()
    if r.status_code >= 400:
        raise SystemExit(f"MFA verify failed: {d.get('errorSummary') or r.text[:300]}")
    return d


def okta_mfa(s, d):
    state_token = d["stateToken"]
    emb = d.get("_embedded", {})

    if d.get("status") == "MFA_CHALLENGE":
        factor = emb["factor"]
    else:
        factors = emb.get("factors", [])
        if not factors:
            raise SystemExit("MFA required but no factors are enrolled.")
        if len(factors) == 1:
            factor = factors[0]
        else:
            print("\nSelect an MFA factor:", file=sys.stderr)
            for i, f in enumerate(factors):
                who = (f.get("profile") or {}).get("phoneNumber") or (
                    f.get("profile") or {}
                ).get("credentialId", "")
                print(
                    f"  [{i}] {f.get('factorType')} ({f.get('provider')}) {who}",
                    file=sys.stderr,
                )
            factor = factors[int(input("factor #: ").strip())]

    ftype = factor.get("factorType")
    log(f"MFA factor: {ftype}")

    if ftype == "push":
        d = _verify(s, factor, state_token)
        print("Approve the Okta Verify push on your phone…", file=sys.stderr)
        for _ in range(60):
            if d.get("status") == "SUCCESS":
                return d
            if d.get("factorResult") == "REJECTED":
                raise SystemExit("Push was rejected.")
            if d.get("factorResult") == "TIMEOUT":
                raise SystemExit("Push timed out.")
            time.sleep(3)
            d = _verify(s, factor, state_token)
        raise SystemExit("Gave up waiting for the push approval.")

    if ftype in ("sms", "call", "email"):
        _verify(s, factor, state_token)  # triggers the send
        code = input(f"Enter the {ftype} code: ").strip()
        return _verify(s, factor, state_token, passCode=code)

    # token:software:totp, token:hardware, question, …
    if ftype == "question":
        answer = getpass.getpass(
            f"{(factor.get('profile') or {}).get('questionText', 'Security question')}: "
        )
        return _verify(s, factor, state_token, answer=answer)

    code = input(f"Enter the {ftype} code: ").strip()
    return _verify(s, factor, state_token, passCode=code)


# --------------------------------------------------------------------------- portal


def get_portal_token(username=None, password=None, creds_path=None, force=False):
    if not force:
        cached = load_cached_token()
        if cached:
            log("using cached portal token")
            return cached["token"]

    if not (username and password):
        username, password = read_credentials(creds_path)

    s = requests.Session()
    s.headers.update({"User-Agent": UA, "Accept": "application/json"})

    # 1. start the OAuth flow, grab oauth_state
    r = s.get(
        f"{PORTAL}/sharing/rest/oauth2/authorize",
        params={
            "client_id": CLIENT_ID,
            "response_type": "token",
            "expiration": TOKEN_MINUTES,
            "redirect_uri": REDIRECT_URI,
        },
        timeout=60,
    )
    r.raise_for_status()
    m = re.search(r'"oauth_state"\s*:\s*"([^"]+)"', r.text)
    if not m:
        raise SystemExit("could not find oauth_state on the portal sign-in page")
    oauth_state = m.group(1)
    log("got oauth_state")

    # 2. hand off to the NY.GOV SAML IdP
    r = s.get(
        f"{PORTAL}/sharing/rest/oauth2/saml/authorize",
        params={"oauth_state": oauth_state},
        allow_redirects=False,
        timeout=60,
    )
    idp_url = r.headers.get("Location")
    if not idp_url or "login.ny.gov" not in idp_url:
        raise SystemExit(f"expected a redirect to login.ny.gov, got {r.status_code} {idp_url}")
    log("redirected to login.ny.gov (Okta)")

    # 3. Okta primary auth (+ MFA)
    session_token = okta_authn(s, username, password)
    log("got Okta sessionToken")

    # 4. trade the sessionToken for an Okta session cookie and replay the SAMLRequest
    r = s.get(
        f"{OKTA}/login/sessionCookieRedirect",
        params={"token": session_token, "redirectUrl": idp_url},
        timeout=60,
    )
    r.raise_for_status()

    # 5. the IdP returns an auto-POST form carrying the SAMLResponse
    soup = BeautifulSoup(r.text, "html.parser")
    form = soup.find("form")
    if not form or not form.find("input", {"name": "SAMLResponse"}):
        raise SystemExit(
            "no SAMLResponse form returned by Okta — the app assignment or the session "
            f"may have failed (final url {r.url})"
        )
    action = up.urljoin(r.url, form.get("action"))
    data = {
        i.get("name"): i.get("value", "")
        for i in form.find_all("input")
        if i.get("name")
    }
    log(f"posting SAMLResponse to {action}")

    r = s.post(action, data=data, allow_redirects=False, timeout=60)
    # 6. walk the redirects until the access_token fragment appears
    for _ in range(10):
        loc = r.headers.get("Location", "")
        if "access_token=" in loc:
            frag = up.urlparse(loc).fragment or up.urlparse(loc).query
            q = up.parse_qs(frag)
            token = q["access_token"][0]
            expires_in = int(q.get("expires_in", [TOKEN_MINUTES * 60])[0])
            save_token(token, time.time() + expires_in)
            log(f"portal token acquired (expires in {expires_in // 3600}h)")
            return token
        if r.status_code not in (301, 302, 303, 307, 308) or not loc:
            break
        r = s.get(up.urljoin(r.url, loc), allow_redirects=False, timeout=60)

    raise SystemExit(
        f"SAML round-trip finished without an access_token (last status {r.status_code}, "
        f"location {r.headers.get('Location')!r})"
    )


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--creds", help="path to a file holding a 'user:password' line")
    ap.add_argument("--force", action="store_true", help="ignore the cached token")
    ap.add_argument("--print-token", action="store_true",
                    help="print the token to stdout (it is a secret)")
    a = ap.parse_args()

    t = get_portal_token(creds_path=a.creds, force=a.force)
    print(t if a.print_token else f"OK — token cached at {TOKEN_FILE} ({len(t)} chars)")


if __name__ == "__main__":
    main()
