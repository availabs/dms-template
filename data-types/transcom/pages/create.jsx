import React from 'react';
import { useNavigate } from 'react-router';

async function checkApiResponse(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text}`);
  }
}

export default function Create({ source, newVersion, baseUrl, context }) {
  const ctx = React.useContext(context) || {};
  const { user, datasources, API_HOST } = ctx;
  const navigate = useNavigate();
  const pgEnv = (datasources || []).find((d) => d.type === 'external')?.env || '';
  const rtPfx = `${API_HOST || ''}/dama-admin/${pgEnv}`;

  const [name, setName] = React.useState(source?.name || '');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [geomSourceId, setGeomSourceId] = React.useState('');
  const [prodSourceId, setProdSourceId] = React.useState('');
  const [map21SourceId, setMap21SourceId] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${rtPfx}/transcom/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: user?.token || '' },
        body: JSON.stringify({
          source_id: source?.source_id || null,
          source_values: { name, type: 'transcom' },
          name,
          start_date: startDate,
          end_date: endDate,
          geom_source_id: Number(geomSourceId),
          npmrds_production_source_id: Number(prodSourceId),
          map21_source_id: Number(map21SourceId),
          user_id: user?.id,
          email: user?.email,
        }),
      });
      await checkApiResponse(res);
      const { etl_context_id, source_id } = await res.json();
      navigate(`${baseUrl}/source/${source_id}/task/${etl_context_id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const ready = name && startDate && endDate && geomSourceId && prodSourceId && map21SourceId;

  return (
    <div className="max-w-xl space-y-4 p-4">
      <h2 className="text-lg font-semibold">Create TRANSCOM Events Source</h2>

      <div className="rounded border border-sky-400 bg-sky-50 p-3 text-sm text-sky-900">
        Publishing crawls the TRANSCOM HistoricalEventSearch API for the date
        range (month by month), then enriches events with NYSDOT categories and
        the matched TMC network. Congestion attribution and the event→TMC
        expansion are separate runs (<code>/congestion/publish</code>,{' '}
        <code>/event_tmc</code>) once events are in.
      </div>

      <label className="block">
        <span className="text-sm">Name</span>
        <input className="mt-1 w-full rounded border px-2 py-1" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
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
      <label className="block">
        <span className="text-sm">NPMRDS geometry source id</span>
        <input type="number" className="mt-1 w-full rounded border px-2 py-1" value={geomSourceId} onChange={(e) => setGeomSourceId(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-sm">NPMRDS production source id</span>
        <input type="number" className="mt-1 w-full rounded border px-2 py-1" value={prodSourceId} onChange={(e) => setProdSourceId(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-sm">MAP-21 source id</span>
        <input type="number" className="mt-1 w-full rounded border px-2 py-1" value={map21SourceId} onChange={(e) => setMap21SourceId(e.target.value)} />
      </label>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <button
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        disabled={busy || !ready}
        onClick={submit}
      >
        {busy ? 'Publishing…' : 'Publish'}
      </button>
    </div>
  );
}
