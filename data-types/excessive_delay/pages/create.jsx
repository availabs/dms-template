import React from 'react';
import { useNavigate } from 'react-router';

async function checkApiResponse(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text}`);
  }
}

// "2019, 2021-2023" → [2019, 2021, 2022, 2023]. Gaps are fine — backfill runs
// fill the known 2019-2020 hole one year at a time.
function parseYears(input) {
  const out = [];
  for (const part of String(input || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const range = part.match(/^(\d{4})\s*-\s*(\d{4})$/);
    if (range) {
      for (let y = Number(range[1]); y <= Number(range[2]); y++) out.push(y);
    } else if (/^\d{4}$/.test(part)) {
      out.push(Number(part));
    } else {
      return null;
    }
  }
  return out.length ? [...new Set(out)].sort((a, b) => a - b) : null;
}

export default function Create({ source, newVersion, baseUrl, context }) {
  const ctx = React.useContext(context) || {};
  const { user, datasources, API_HOST, falcor } = ctx;
  const navigate = useNavigate();
  const pgEnv = (datasources || []).find((d) => d.type === 'external')?.env || '';
  const rtPfx = `${API_HOST || ''}/dama-admin/${pgEnv}`;

  const [name, setName] = React.useState(source?.name || '');
  const [sources, setSources] = React.useState([]);
  const [npmrdsSourceId, setNpmrdsSourceId] = React.useState('');
  const [transcomSourceId, setTranscomSourceId] = React.useState('');
  const [yearsInput, setYearsInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);

  // Load the source list once for the two pickers.
  React.useEffect(() => {
    if (!falcor || !pgEnv) return;
    let live = true;
    (async () => {
      try {
        const lenResp = await falcor.get(['uda', pgEnv, 'sources', 'length']);
        const length = lenResp?.json?.uda?.[pgEnv]?.sources?.length || 0;
        if (!length) return;
        const resp = await falcor.get([
          'uda', pgEnv, 'sources', 'byIndex',
          { from: 0, to: length - 1 },
          ['source_id', 'name', 'type'],
        ]);
        const byIndex = resp?.json?.uda?.[pgEnv]?.sources?.byIndex || {};
        const list = Object.values(byIndex)
          .filter((s) => s && s.source_id)
          .map((s) => ({ source_id: s.source_id, name: s.name, type: s.type }));
        if (live) setSources(list);
      } catch (e) {
        console.error('[excessive_delay] source list load failed:', e);
      }
    })();
    return () => { live = false; };
  }, [falcor, pgEnv]);

  const npmrdsOptions = sources.filter((s) => (s.type || '').startsWith('npmrds'));
  const transcomOptions = sources.filter((s) => (s.type || '').startsWith('transcom'));
  const years = parseYears(yearsInput);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${rtPfx}/excessive_delay/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: user?.token || '' },
        body: JSON.stringify({
          source_id: source?.source_id || null,
          name,
          selectedNpmrdsSourceId: Number(npmrdsSourceId),
          selectedTranscomSourceId: Number(transcomSourceId),
          years,
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

  const sourceSelect = (label, value, setValue, options) => (
    <label className="block">
      <span className="text-sm">{label}</span>
      <select
        className="mt-1 w-full rounded border px-2 py-1"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      >
        <option value="">Select…</option>
        {(options.length ? options : sources).map((s) => (
          <option key={s.source_id} value={s.source_id}>
            {s.name} ({s.type})
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="max-w-xl space-y-4 p-4">
      <h2 className="text-lg font-semibold">Create Excessive Delay Source</h2>
      <p className="text-sm text-gray-600">
        Computes monthly excessive-delay buckets (total, non-recurrent,
        construction / accident / other) from NPMRDS travel times and Transcom
        congestion data. Runs as a queued task — years can be added later to
        fill gaps.
      </p>

      <label className="block">
        <span className="text-sm">Name</span>
        <input className="mt-1 w-full rounded border px-2 py-1" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      {sourceSelect('NPMRDS production source', npmrdsSourceId, setNpmrdsSourceId, npmrdsOptions)}
      {sourceSelect('Transcom congestion source', transcomSourceId, setTranscomSourceId, transcomOptions)}

      <label className="block">
        <span className="text-sm">Years (e.g. "2021, 2022" or "2016-2023" — gaps allowed)</span>
        <input
          className="mt-1 w-full rounded border px-2 py-1"
          value={yearsInput}
          onChange={(e) => setYearsInput(e.target.value)}
          placeholder="2021, 2022"
        />
      </label>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <button
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        disabled={busy || !name || !npmrdsSourceId || !transcomSourceId || !years}
        onClick={submit}
      >
        {busy ? 'Publishing…' : 'Publish'}
      </button>
    </div>
  );
}
