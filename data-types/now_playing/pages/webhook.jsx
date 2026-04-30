/**
 * Webhook info / backfill page for an existing now_playing source.
 *
 * Lives at `${pageBaseUrl}/${source_id}/webhook` (the datasets pattern's
 * SourcePage builds the route from `path: '/webhook'` in the page
 * config). The Create page navigates here after a successful provision
 * so the user can see the webhook URL and trigger backfills without
 * having to remember a deep URL.
 *
 * Reads the live, more-detailed stream record from
 * GET /now_playing/streams/:id — the basic `source` row passed in by
 * SourcePage doesn't have `webhook_url`, `base_url_source`, or
 * `last_event_at`.
 */

import React from 'react';
import { useApi } from './_helpers';
import { Field, CopyField } from './_ui';

function BackfillPanel({ context, sourceId, info, onStarted }) {
  const { rtPfx, postJson } = useApi(context);

  const [open, setOpen] = React.useState(false);
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
      setToken('');
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

function Webhook({ source, params, context }) {
  const { pgEnv, rtPfx, postJson, getJson } = useApi(context);
  const sourceId = params?.id || source?.source_id || source?.id;

  const [info, setInfo] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [rotating, setRotating] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (!sourceId || !pgEnv) return;
    try {
      const data = await getJson(`${rtPfx}/now_playing/streams/${sourceId}`);
      setInfo(data);
    } catch (err) {
      setError(err.message);
    }
  }, [getJson, rtPfx, sourceId, pgEnv]);

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

  if (!pgEnv) {
    return (
      <div className="w-full max-w-xl mx-auto p-4 text-sm text-red-700">
        No external datasource configured — cannot load stream details.
      </div>
    );
  }
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
        onStarted={() => refresh()}
      />
    </div>
  );
}

export default Webhook;
