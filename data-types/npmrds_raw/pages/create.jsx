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
  const [state, setState] = React.useState('NY');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [averagingWindowSize, setAveragingWindowSize] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${rtPfx}/npmrds_raw/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: user?.token || '' },
        body: JSON.stringify({
          source_id: source?.source_id || null,
          source_values: { name, type: 'npmrds_raw' },
          name,
          states: [state],
          startDate,
          endDate,
          averagingWindowSize: Number(averagingWindowSize) || 0,
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

  return (
    <div className="max-w-xl space-y-4 p-4">
      <h2 className="text-lg font-semibold">Create NPMRDS Raw Source</h2>

      <div className="rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
        ⚠️ Publishing initiates a RITIS download (three export jobs). RITIS limits are
        shared across AVAIL work — <strong>do not initiate more than one download per
        day</strong> without explicit approval.
      </div>

      <label className="block">
        <span className="text-sm">Name</span>
        <input className="mt-1 w-full rounded border px-2 py-1" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-sm">State</span>
        <input className="mt-1 w-full rounded border px-2 py-1" value={state} onChange={(e) => setState(e.target.value)} />
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
        <span className="text-sm">Averaging window (minutes; 0 = 5-min epochs)</span>
        <input type="number" className="mt-1 w-full rounded border px-2 py-1" value={averagingWindowSize} onChange={(e) => setAveragingWindowSize(e.target.value)} />
      </label>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <button
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        disabled={busy || !name || !state || !startDate || !endDate}
        onClick={submit}
      >
        {busy ? 'Publishing…' : 'Publish'}
      </button>
    </div>
  );
}
