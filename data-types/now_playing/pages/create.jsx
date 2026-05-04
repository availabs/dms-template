/**
 * now_playing create page.
 *
 * Pre-provision only: collects stream name + ACR project/stream IDs and
 * (optionally) a backfill window + bearer token, POSTs
 * `/now_playing/streams` to create the DAMA source/view/table, fires the
 * backfill task if requested, then navigates to
 * `${baseUrl}/source/${source_id}/webhook` so the user can copy the
 * callback URL into ACR.
 *
 * The bearer token is single-use — typed into the form, sent to the
 * backfill route, dropped from React state immediately on success or
 * failure.
 *
 * Auth: routes here require JWT auth. The token is read from
 * `DatasetsContext` at the call site by `useApi(context)`; no need to
 * thread `user` through props.
 */

import React from 'react';
import { useNavigate } from 'react-router';
import { useApi } from './_helpers';
import { Field } from './_ui';

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

function Create({ source, baseUrl, context }) {
  const navigate = useNavigate();
  const { pgEnv, baseUrl: ctxBaseUrl } = useApi(context);

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

  return (
    <PreProvisionForm
      context={context}
      source={source}
      onProvisioned={(p) => {
        const root = ctxBaseUrl || baseUrl || '';
        navigate(`${root}/source/${p.source_id}/webhook`);
      }}
    />
  );
}

export default Create;
