import React from 'react';
import { useNavigate } from 'react-router';

async function checkApiResponse(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text}`);
  }
}

const getAtom = (v) => (v && typeof v === 'object' && 'value' in v ? v.value : v);

function SourceViewPicker({ label, sources, sourceId, setSourceId, views, viewId, setViewId }) {
  return (
    <div className="flex gap-3">
      <label className="block flex-1">
        <span className="text-sm">{label} source</span>
        <select
          className="mt-1 w-full rounded border px-2 py-1"
          value={sourceId || ''}
          onChange={(e) => { setSourceId(e.target.value ? Number(e.target.value) : null); setViewId(null); }}
        >
          <option value="">— select —</option>
          {sources.map((s) => (
            <option key={s.source_id} value={s.source_id}>{s.name} (#{s.source_id})</option>
          ))}
        </select>
      </label>
      <label className="block flex-1">
        <span className="text-sm">{label} view</span>
        <select
          className="mt-1 w-full rounded border px-2 py-1"
          value={viewId || ''}
          onChange={(e) => setViewId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">— select —</option>
          {views.map((v) => (
            <option key={v.view_id} value={v.view_id}>
              v{v.view_id}{v.version ? ` — ${v.version}` : ''}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export default function Create({ source, newVersion, baseUrl, context }) {
  const ctx = React.useContext(context) || {};
  const { user, datasources, API_HOST, falcor } = ctx;
  const navigate = useNavigate();
  const pgEnv = (datasources || []).find((d) => d.type === 'external')?.env || '';
  const rtPfx = `${API_HOST || ''}/dama-admin/${pgEnv}`;

  const [name, setName] = React.useState(source?.name || '');
  const [sources, setSources] = React.useState([]);
  const [viewsBySource, setViewsBySource] = React.useState({});

  // publish refs
  const [tmcSpeedSourceId, setTmcSpeedSourceId] = React.useState(null);
  const [tmcSpeedViewId, setTmcSpeedViewId] = React.useState(null);
  const [mpoSourceId, setMpoSourceId] = React.useState(null);
  const [mpoViewId, setMpoViewId] = React.useState(null);

  // add refs
  const [rawSourceId, setRawSourceId] = React.useState(null);
  const [rawViewId, setRawViewId] = React.useState(null);
  const [prodViewId, setProdViewId] = React.useState(null);
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);

  // Already provisioned ⇒ show the Add form; otherwise the Publish form.
  const isProvisioned = !!source?.source_id && !!source?.metadata?.npmrds_tmc_meta_source_id;

  // Load the source list once (pickers filter it by type client-side).
  React.useEffect(() => {
    if (!falcor || !pgEnv) return;
    let live = true;
    (async () => {
      try {
        const lenResp = await falcor.get(['uda', pgEnv, 'sources', 'length']);
        const length = getAtom(lenResp?.json?.uda?.[pgEnv]?.sources?.length) || 0;
        if (!length) return;
        await falcor.get([
          'uda', pgEnv, 'sources', 'byIndex',
          { from: 0, to: length - 1 },
          ['source_id', 'name', 'type', 'metadata'],
        ]);
        const cache = falcor.getCache();
        const byIndex = cache?.uda?.[pgEnv]?.sources?.byIndex || {};
        const byId = cache?.uda?.[pgEnv]?.sources?.byId || {};
        const out = [];
        Object.values(byIndex).forEach((ref) => {
          const id = Array.isArray(ref?.value) ? ref.value[ref.value.length - 1] : null;
          const row = id != null ? byId[id] : null;
          if (!row) return;
          out.push({
            source_id: Number(getAtom(row.source_id) ?? id),
            name: getAtom(row.name),
            type: getAtom(row.type),
            metadata: getAtom(row.metadata),
          });
        });
        if (live) setSources(out);
      } catch (e) {
        console.error('[npmrds create] source list load failed:', e);
      }
    })();
    return () => { live = false; };
  }, [falcor, pgEnv]);

  // Load views for one source on demand.
  const loadViews = React.useCallback(async (srcId) => {
    if (!falcor || !pgEnv || !srcId || viewsBySource[srcId]) return;
    try {
      const lenResp = await falcor.get(['uda', pgEnv, 'sources', 'byId', srcId, 'views', 'length']);
      const length = getAtom(lenResp?.json?.uda?.[pgEnv]?.sources?.byId?.[srcId]?.views?.length) || 0;
      let views = [];
      if (length) {
        await falcor.get([
          'uda', pgEnv, 'sources', 'byId', srcId, 'views', 'byIndex',
          { from: 0, to: length - 1 },
          ['view_id', 'version', 'metadata'],
        ]);
        const cache = falcor.getCache();
        const byIndex = cache?.uda?.[pgEnv]?.sources?.byId?.[srcId]?.views?.byIndex || {};
        const viewsById = cache?.uda?.[pgEnv]?.views?.byId || {};
        views = Object.values(byIndex)
          .map((ref) => (Array.isArray(ref?.value) ? ref.value[ref.value.length - 1] : null))
          .filter((id) => id != null && viewsById[id])
          .map((id) => ({
            view_id: Number(getAtom(viewsById[id].view_id) ?? id),
            version: getAtom(viewsById[id].version),
            metadata: getAtom(viewsById[id].metadata),
          }));
      }
      setViewsBySource((prev) => ({ ...prev, [srcId]: views }));
    } catch (e) {
      console.error('[npmrds create] views load failed:', e);
    }
  }, [falcor, pgEnv, viewsBySource]);

  React.useEffect(() => { if (tmcSpeedSourceId) loadViews(tmcSpeedSourceId); }, [tmcSpeedSourceId, loadViews]);
  React.useEffect(() => { if (mpoSourceId) loadViews(mpoSourceId); }, [mpoSourceId, loadViews]);
  React.useEffect(() => { if (rawSourceId) loadViews(rawSourceId); }, [rawSourceId, loadViews]);
  React.useEffect(() => { if (isProvisioned) loadViews(source.source_id); }, [isProvisioned, source, loadViews]);

  // Pre-fill the add date range from the chosen raw view's metadata.
  React.useEffect(() => {
    const v = (viewsBySource[rawSourceId] || []).find((x) => x.view_id === rawViewId);
    if (v?.metadata?.start_date) setStartDate(v.metadata.start_date);
    if (v?.metadata?.end_date) setEndDate(v.metadata.end_date);
  }, [rawViewId, rawSourceId, viewsBySource]);

  const ofType = (t) => sources.filter((s) => s.type === t);

  const publish = async () => {
    setError(null); setBusy(true);
    try {
      const res = await fetch(`${rtPfx}/npmrds/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: user?.token || '' },
        body: JSON.stringify({
          name,
          user_id: user?.id,
          email: user?.email,
          tmcSpeedViewId, tmcSpeedSourceId,
          mpoBoundariesViewId: mpoViewId, mpoBoundariesSourceId: mpoSourceId,
        }),
      });
      await checkApiResponse(res);
      const { etl_context_id, source_id } = await res.json();
      navigate(`${baseUrl}/source/${source_id}/task/${etl_context_id}`);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const add = async () => {
    setError(null); setBusy(true);
    try {
      const res = await fetch(`${rtPfx}/npmrds/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: user?.token || '' },
        body: JSON.stringify({
          source_id: source.source_id,
          view_id: prodViewId,
          npmrds_raw_view_ids: [rawViewId],
          startDate, endDate,
          user_id: user?.id,
          email: user?.email,
        }),
      });
      await checkApiResponse(res);
      const { etl_context_id, source_id } = await res.json();
      navigate(`${baseUrl}/source/${source_id}/task/${etl_context_id}`);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-2xl space-y-4 p-4">
      {!isProvisioned && (
        <>
          <h2 className="text-lg font-semibold">Create NPMRDS Source</h2>
          <p className="text-sm text-gray-600">
            Provisions the npmrds + npmrds_meta sources, the ClickHouse prod and
            tmc_meta tables, and the PostGIS geometry table. The tmc_speed and MPO
            boundaries references are required — they feed the metadata spatial join.
          </p>
          <label className="block">
            <span className="text-sm">Name</span>
            <input className="mt-1 w-full rounded border px-2 py-1" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <SourceViewPicker
            label="TMC speed" sources={ofType('tmc_speed')}
            sourceId={tmcSpeedSourceId} setSourceId={setTmcSpeedSourceId}
            views={viewsBySource[tmcSpeedSourceId] || []} viewId={tmcSpeedViewId} setViewId={setTmcSpeedViewId}
          />
          <SourceViewPicker
            label="MPO boundaries" sources={ofType('mpo_boundaries')}
            sourceId={mpoSourceId} setSourceId={setMpoSourceId}
            views={viewsBySource[mpoSourceId] || []} viewId={mpoViewId} setViewId={setMpoViewId}
          />
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
            disabled={busy || !name || !tmcSpeedSourceId || !tmcSpeedViewId || !mpoSourceId || !mpoViewId}
            onClick={publish}
          >
            {busy ? 'Provisioning…' : 'Provision'}
          </button>
        </>
      )}

      {isProvisioned && (
        <>
          <h2 className="text-lg font-semibold">Add NPMRDS Raw Data</h2>
          <p className="text-sm text-gray-600">
            Moves one npmrds_raw view into the production table and rebuilds the
            year&apos;s metadata (directionality, congestion, spatial joins, tiles).
            One raw view (one calendar year) per run.
          </p>
          <label className="block">
            <span className="text-sm">Production view</span>
            <select
              className="mt-1 w-full rounded border px-2 py-1"
              value={prodViewId || ''}
              onChange={(e) => setProdViewId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— select —</option>
              {(viewsBySource[source.source_id] || []).map((v) => (
                <option key={v.view_id} value={v.view_id}>v{v.view_id}{v.version ? ` — ${v.version}` : ''}</option>
              ))}
            </select>
          </label>
          <SourceViewPicker
            label="NPMRDS raw" sources={ofType('npmrds_raw')}
            sourceId={rawSourceId} setSourceId={setRawSourceId}
            views={viewsBySource[rawSourceId] || []} viewId={rawViewId} setViewId={setRawViewId}
          />
          <div className="flex gap-3">
            <label className="block flex-1">
              <span className="text-sm">Start date</span>
              <input type="date" className="mt-1 w-full rounded border px-2 py-1" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="block flex-1">
              <span className="text-sm">End date</span>
              <input type="date" className="mt-1 w-full rounded border px-2 py-1" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
            disabled={busy || !prodViewId || !rawViewId || !startDate || !endDate}
            onClick={add}
          >
            {busy ? 'Adding…' : 'Add Data'}
          </button>
        </>
      )}
    </div>
  );
}
