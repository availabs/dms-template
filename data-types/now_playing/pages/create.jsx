/**
 * now_playing create / configure page.
 *
 * Two phases on the same component:
 *
 *   1. Pre-provision (no source.source_id yet) — collect stream name +
 *      ACR project/stream IDs, optionally a backfill window + bearer
 *      token; POST /now_playing/streams to create the DAMA source, view,
 *      and per-stream table; if backfill is checked, immediately POST
 *      /now_playing/streams/:sourceId/backfill.
 *
 *   2. Post-provision (source.source_id present) — fetch GET /streams/:id
 *      and render the webhook URL (with copy + rotate-secret), wiring
 *      instructions, and a live health panel. The user pastes the
 *      webhook URL into ACRCloud's "Result Callback URL" field; webhook
 *      detections start flowing into the same table the backfill writes
 *      to.
 *
 * The bearer token is single-use — typed into the form, sent to the
 * backfill route, dropped from React state on success/failure.
 *
 * Auth: the dms-server JWT middleware (`auth/jwt.js`) reads the token
 * verbatim from the `Authorization` request header. The auth context
 * exposes it at `user.token`. We attach it via a `useApi(context)` hook
 * so each subcomponent grabs the token from `DatasetsContext` directly
 * instead of getting it threaded through props.
 */

import React from 'react';
import { useNavigate } from 'react-router';

async function checkApiResponse(res) {
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
 * the top-level `Create` component renders an error in that case before
 * any subcomponent gets a chance to call the helpers.
 */
function useApi(context) {
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

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1 mb-3">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
      {hint ? <div className="text-xs text-gray-500">{hint}</div> : null}
    </div>
  );
}

function CopyField({ value }) {
  const [copied, setCopied] = React.useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error('clipboard copy failed:', e);
    }
  };
  return (
    <div className="flex gap-2">
      <input
        readOnly
        value={value || ''}
        className="flex-1 p-2 border rounded-md bg-gray-50 font-mono text-xs"
        onFocus={(e) => e.target.select()}
      />
      <button
        type="button"
        onClick={onCopy}
        className="px-3 py-1 text-sm border rounded-md bg-white hover:bg-gray-100"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function PreProvisionForm({ context, source, onProvisioned }) {
  const { rtPfx, postJson } = useApi(context);

  const [name, setName] = React.useState(source?.name || '');
  const [stationName, setStationName] = React.useState('');
  const [acrProjectId, setAcrProjectId] = React.useState('');
  const [acrStreamId, setAcrStreamId] = React.useState('');
  const [doBackfill, setDoBackfill] = React.useState(false);
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [bearerToken, setBearerToken] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);

  const canSubmit =
    name.trim().length > 0 &&
    (!doBackfill || (acrProjectId && acrStreamId && bearerToken));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const created = await postJson(`${rtPfx}/now_playing/streams`, {
        name: name.trim(),
        station_name: stationName.trim() || null,
        acr_project_id: acrProjectId.trim() || null,
        acr_stream_id: acrStreamId.trim() || null,
      });

      let backfillEtl = null;
      if (doBackfill) {
        const bf = await postJson(
          `${rtPfx}/now_playing/streams/${created.source_id}/backfill`,
          {
            acr_bearer_token: bearerToken,
            date_from: dateFrom || null,    // null = all-time
            date_to: dateTo || null,
          },
        );
        backfillEtl = bf.etl_context_id;
      }

      // Drop the token from state immediately (single-use).
      setBearerToken('');

      onProvisioned({
        source_id: created.source_id,
        view_id: created.view_id,
        webhook_url: created.webhook_url,
        backfill_etl_context_id: backfillEtl,
      });
    } catch (err) {
      console.error('[now_playing] provision failed:', err);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="w-full max-w-xl mx-auto p-4">
      <h2 className="text-lg font-semibold mb-4">Provision a now_playing stream</h2>

      <Field label="Stream name" hint="Shown in dataset listings (e.g. 'WCDB FM').">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="p-2 border rounded-md"
        />
      </Field>

      <Field label="Station call sign / display name" hint="Used by the Card section header.">
        <input
          value={stationName}
          onChange={(e) => setStationName(e.target.value)}
          placeholder="WCDB FM"
          className="p-2 border rounded-md"
        />
      </Field>

      <Field label="ACRCloud project ID" hint="Required if you want backfill or per-stream identification.">
        <input
          value={acrProjectId}
          onChange={(e) => setAcrProjectId(e.target.value)}
          placeholder="16608"
          className="p-2 border rounded-md"
        />
      </Field>

      <Field label="ACRCloud stream ID" hint="The s-XXXXXXXX identifier from the ACR Console.">
        <input
          value={acrStreamId}
          onChange={(e) => setAcrStreamId(e.target.value)}
          placeholder="s-Z0XwkcHp"
          className="p-2 border rounded-md"
        />
      </Field>

      <div className="border-t mt-4 pt-4">
        <label className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            checked={doBackfill}
            onChange={(e) => setDoBackfill(e.target.checked)}
          />
          <span className="text-sm font-medium">Backfill historical detections from ACR Console</span>
        </label>

        {doBackfill ? (
          <div className="pl-6 mt-2">
            <div className="flex gap-3">
              <Field label="From (optional)" hint="Leave blank for all-time.">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="p-2 border rounded-md"
                />
              </Field>
              <Field label="To (optional)">
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="p-2 border rounded-md"
                />
              </Field>
            </div>

            <Field
              label="ACRCloud Console bearer token"
              hint="Single-use. Sent to the worker for this backfill, then dropped — never stored."
            >
              <input
                type="password"
                value={bearerToken}
                onChange={(e) => setBearerToken(e.target.value)}
                autoComplete="off"
                className="p-2 border rounded-md font-mono text-xs"
              />
            </Field>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="text-sm text-red-600 mb-3 whitespace-pre-wrap">{error}</div>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit || busy}
        className="px-4 py-2 bg-blue-500 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold rounded-md"
      >
        {busy ? 'Provisioning...' : 'Create stream'}
      </button>
    </form>
  );
}

function PostProvisionPanel({ context, sourceId, initialBackfillEtl }) {
  const { rtPfx, postJson, getJson } = useApi(context);

  const [info, setInfo] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [rotating, setRotating] = React.useState(false);
  const [backfillEtl, setBackfillEtl] = React.useState(initialBackfillEtl || null);

  const refresh = React.useCallback(async () => {
    try {
      const data = await getJson(`${rtPfx}/now_playing/streams/${sourceId}`);
      setInfo(data);
    } catch (err) {
      setError(err.message);
    }
  }, [getJson, rtPfx, sourceId]);

  React.useEffect(() => {
    refresh();
    const t = setInterval(refresh, 12000);
    return () => clearInterval(t);
  }, [refresh]);

  const onRotate = async () => {
    if (!confirm('Rotate the webhook secret? You will need to re-paste the new URL into ACR.')) return;
    setRotating(true);
    try {
      await postJson(`${rtPfx}/now_playing/streams/${sourceId}/regenerate-secret`, {});
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setRotating(false);
    }
  };

  if (error && !info) {
    return <div className="p-4 text-red-600">Failed to load stream: {error}</div>;
  }
  if (!info) {
    return <div className="p-4 text-gray-500">Loading stream details…</div>;
  }

  const lastEvent = info.last_event_at
    ? new Date(info.last_event_at).toLocaleString()
    : 'No events yet — webhook may not be wired up.';

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <h2 className="text-lg font-semibold mb-1">{info.name}</h2>
      <div className="text-sm text-gray-500 mb-4">
        source_id {info.source_id} · view_id {info.view_id || '—'} · table {info.data_table || '—'}
      </div>

      <div className="border rounded-md p-4 mb-4 bg-blue-50">
        <div className="font-medium mb-2">Webhook URL</div>
        <CopyField value={info.webhook_url} />
        {info.base_url_source === 'localhost' ? (
          <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
            <strong>This URL points at <code>localhost</code> and ACR cannot reach it.</strong>
            {' '}Set <code>DMS_PUBLIC_URL</code> in the server's environment to the public hostname
            (e.g. <code>https://dmsserver.example.org</code>) and restart the server.
          </div>
        ) : null}
        {info.base_url_source === 'forwarded' ? (
          <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            URL derived from <code>X-Forwarded-Host</code>. Set <code>DMS_PUBLIC_URL</code> in the
            server's environment to make this deterministic.
          </div>
        ) : null}
        <ol className="text-sm text-gray-700 list-decimal pl-5 mt-3 space-y-1">
          <li>Open the ACRCloud Console → your project → this stream.</li>
          <li>Paste the URL above into the <span className="font-mono">Result Callback URL</span> field.</li>
          <li>Save. Detections start arriving within ~30s.</li>
        </ol>
        <button
          type="button"
          onClick={onRotate}
          disabled={rotating}
          className="mt-3 px-3 py-1 text-sm border rounded-md bg-white hover:bg-gray-100 disabled:opacity-50"
        >
          {rotating ? 'Rotating…' : 'Rotate webhook secret'}
        </button>
      </div>

      <div className="border rounded-md p-4 mb-4">
        <div className="font-medium mb-2">Health</div>
        <div className="text-sm">
          <div><span className="text-gray-500">Last event received:</span> {lastEvent}</div>
          {info.last_match ? (
            <div className="mt-2">
              <span className="text-gray-500">Last match:</span>{' '}
              <span className="font-medium">{info.last_match.title}</span>
              {info.last_match.artist_name ? <> — {info.last_match.artist_name}</> : null}
            </div>
          ) : null}
        </div>
      </div>

      <BackfillPanel
        context={context}
        sourceId={sourceId}
        info={info}
        initialEtlContextId={backfillEtl}
        onStarted={(etl) => setBackfillEtl(etl)}
      />
    </div>
  );
}

function BackfillPanel({ context, sourceId, info, initialEtlContextId, onStarted }) {
  const { rtPfx, postJson } = useApi(context);

  const [open, setOpen] = React.useState(Boolean(initialEtlContextId));
  const [token, setToken] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);
  const lastRun = info?.statistics?.backfill || null;

  const canSubmit = token.length > 0 && info?.acr_project_id && info?.acr_stream_id;

  const onRun = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await postJson(
        `${rtPfx}/now_playing/streams/${sourceId}/backfill`,
        {
          acr_bearer_token: token,
          date_from: dateFrom || null,
          date_to: dateTo || null,
        },
      );
      setToken('');   // single-use
      onStarted?.(res.etl_context_id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border rounded-md p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left font-medium"
      >
        Historical backfill {open ? '▾' : '▸'}
      </button>

      {!info?.acr_project_id || !info?.acr_stream_id ? (
        <div className="text-sm text-amber-600 mt-2">
          This stream has no ACR project/stream IDs configured — backfill is unavailable.
        </div>
      ) : null}

      {lastRun ? (
        <div className="text-xs text-gray-600 mt-2">
          Last run: started {lastRun.started_at || '?'},
          {' '}finished {lastRun.finished_at || '— still running —'},
          {' '}rows inserted {lastRun.rows_inserted ?? 0}
          {lastRun.last_error ? <span className="text-red-600"> · error: {lastRun.last_error}</span> : null}
        </div>
      ) : null}

      {open ? (
        <form onSubmit={onRun} className="mt-3">
          <div className="flex gap-3">
            <Field label="From (optional)" hint="Leave blank for all-time.">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="p-2 border rounded-md"
              />
            </Field>
            <Field label="To (optional)">
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="p-2 border rounded-md"
              />
            </Field>
          </div>

          <Field
            label="ACRCloud Console bearer token"
            hint="Single-use. Dropped after this request."
          >
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              className="p-2 border rounded-md font-mono text-xs"
            />
          </Field>

          {error ? <div className="text-sm text-red-600 mb-2">{error}</div> : null}

          <button
            type="submit"
            disabled={!canSubmit || busy}
            className="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md"
          >
            {busy ? 'Starting…' : 'Run backfill'}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function Create({ source, baseUrl, context }) {
  const navigate = useNavigate();
  const { pgEnv, baseUrl: ctxBaseUrl } = useApi(context);

  const [provisioned, setProvisioned] = React.useState(null);
  const sourceId = provisioned?.source_id || source?.source_id || null;

  if (!pgEnv) {
    return (
      <div className="w-full max-w-xl mx-auto p-4 border border-red-300 bg-red-50 rounded-md text-sm">
        <div className="font-semibold text-red-700 mb-2">No external datasource configured</div>
        <p>
          The <code>now_playing</code> create page needs an external (DAMA) datasource so it knows
          which <code>pgEnv</code> to call. Without it, the API URL would be
          <code className="ml-1">/dama-admin//now_playing/streams</code> — note the double slash.
        </p>
        <p className="mt-2">
          Fix: open the dataset pattern's settings in the DMS admin and add a datasource with
          <code className="ml-1">type: "external"</code> pointing at a configured pgEnv (e.g.
          <code>npmrds2</code>, <code>hazmit_dama</code>). The pattern reads its
          <code>dmsEnvId</code> to build this list — if you've already added one and it's still
          empty here, the dmsEnv config under that ID may not have a Postgres host set.
        </p>
      </div>
    );
  }

  if (!sourceId) {
    return (
      <PreProvisionForm
        context={context}
        source={source}
        onProvisioned={(p) => {
          setProvisioned(p);
          // Also navigate so a refresh lands back on the same stream.
          navigate(`${ctxBaseUrl || baseUrl || ''}/source/${p.source_id}`);
        }}
      />
    );
  }

  return (
    <PostProvisionPanel
      context={context}
      sourceId={sourceId}
      initialBackfillEtl={provisioned?.backfill_etl_context_id || null}
    />
  );
}

export default Create;
