/**
 * Shared client-side helpers for now_playing pages.
 *
 * Non-component utilities live here in a `.js` file (NOT `.jsx`) so the
 * sibling page components stay Vite-Fast-Refresh-clean — the page tree's
 * convention is that `.jsx` files export only React components, and any
 * mixed-export file kicks the whole module out of HMR. Hooks count as
 * non-component exports for that purpose, hence `useApi` lives here.
 *
 * Auth: the dms-server JWT middleware reads the token verbatim from the
 * `Authorization` request header (`auth/jwt.js`). The auth context
 * exposes the token at `user.token`. `useApi(context)` pulls the user
 * from `DatasetsContext` itself, so call sites don't have to thread
 * `user` through props.
 */

import React from 'react';

export async function checkApiResponse(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text.slice(0, 500)}`);
  }
}

/**
 * Read auth + DAMA wiring from the datasets context and return helpers
 * pre-bound to the current user's token. Components call this at the
 * top of their body — no need to pass `user` / `rtPfx` as props.
 *
 * Returns `{ rtPfx: '' }` when no external datasource is configured;
 * the top-level page component is expected to render a clear error in
 * that case before calling any helper.
 */
export function useApi(context) {
  const ctx = React.useContext(context) || {};
  const { user, datasources, API_HOST, baseUrl } = ctx;
  const pgEnv = (datasources || []).find((d) => d.type === 'external')?.env || '';
  const rtPfx = pgEnv ? `${API_HOST || ''}/dama-admin/${pgEnv}` : '';

  return React.useMemo(() => {
    const authHeaders = () => (user?.token ? { Authorization: user.token } : {});

    async function postJson(url, body) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body || {}),
      });
      await checkApiResponse(res);
      return res.json();
    }

    async function getJson(url) {
      const res = await fetch(url, { method: 'GET', headers: { ...authHeaders() } });
      await checkApiResponse(res);
      return res.json();
    }

    return { user, pgEnv, rtPfx, baseUrl, postJson, getJson };
  }, [user, pgEnv, rtPfx, baseUrl]);
}
