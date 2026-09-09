import React from 'react';
import { useNavigate } from 'react-router';

async function checkApiResponse(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text}`);
  }
}

/**
 * work_zone publish form.
 *
 * The form is generated from GET /stages rather than hardcoded, so a stage
 * landing on the server side (a new phase) shows up here — with its required
 * upstream source ids and the current threshold defaults — without a
 * client-side edit.
 */
export default function Create({ source, newVersion, baseUrl, context }) {
  const ctx = React.useContext(context) || {};
  const { user, datasources, API_HOST, type } = ctx;
  const navigate = useNavigate();
  const pgEnv = (datasources || []).find((d) => d.type === 'external')?.env || '';
  const rtPfx = `${API_HOST || ''}/dama-admin/${pgEnv}`;

  const [registry, setRegistry] = React.useState(null);
  const [stage, setStage] = React.useState('');
  const [name, setName] = React.useState(source?.name || '');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [inputs, setInputs] = React.useState({});
  const [overrides, setOverrides] = React.useState({});
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (!pgEnv) return;
    let live = true;
    (async () => {
      try {
        const res = await fetch(`${rtPfx}/work_zone/stages`);
        await checkApiResponse(res);
        const json = await res.json();
        if (!live) return;
        setRegistry(json);
        // Preselect the stage that produces the source type being created —
        // every stage-output type registers this same page.
        const runnable = (json.stages || []).filter((s) => s.runnable);
        const match = runnable.find((s) => s.sourceType === type);
        const pick = match || runnable[0];
        if (pick) setStage(pick.stage);
      } catch (e) {
        if (live) setError(e.message);
      }
    })();
    return () => { live = false; };
  }, [rtPfx, pgEnv, type]);

  const spec = (registry?.stages || []).find((s) => s.stage === stage) || null;
  const specs = registry?.thresholds?.specs || [];
  const sourceIdFields = spec ? [...spec.inputs, ...spec.optionalInputs] : [];

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const body = {
        stage,
        source_id: source?.source_id || null,
        source_values: { name, type: spec?.sourceType },
        name,
        user_id: user?.id,
        email: user?.email,
      };
      if (spec?.requiresWindow) {
        body.start_date = startDate;
        body.end_date = endDate;
      }
      for (const field of sourceIdFields) {
        if (inputs[field]) body[field] = Number(inputs[field]);
      }
      const thresholds = Object.fromEntries(
        Object.entries(overrides).filter(([, v]) => v !== '' && v !== undefined)
      );
      if (Object.keys(thresholds).length) body.thresholds = thresholds;

      const res = await fetch(`${rtPfx}/work_zone/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: user?.token || '' },
        body: JSON.stringify(body),
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

  const ready = Boolean(
    stage && spec?.runnable && (name || source?.source_id)
    && (!spec.requiresWindow || (startDate && endDate))
    && spec.inputs.every((f) => inputs[f])
  );

  return (
    <div className="max-w-2xl space-y-4 p-4">
      <h2 className="text-lg font-semibold">Run a Work Zone Pipeline Stage</h2>

      <div className="rounded border border-sky-400 bg-sky-50 p-3 text-sm text-sky-900">
        Each stage produces one DAMA source and is idempotent over its window —
        re-running a month replaces that month. Stages are built one phase at a
        time; a stage listed as “phase N” is declared but not runnable yet.
      </div>

      <label className="block">
        <span className="text-sm">Stage</span>
        <select
          className="mt-1 w-full rounded border px-2 py-1"
          value={stage}
          onChange={(e) => { setStage(e.target.value); setInputs({}); }}
        >
          <option value="">Select a stage…</option>
          {(registry?.stages || []).map((s) => (
            <option key={s.stage} value={s.stage} disabled={!s.runnable}>
              {`${s.stage} — ${s.label}${s.runnable ? '' : ` (phase ${s.phase}, not built)`}`}
            </option>
          ))}
        </select>
      </label>

      {spec && (
        <div className="rounded border bg-slate-50 p-3 text-sm text-slate-700">
          <div>{spec.desc}</div>
          <div className="mt-1 text-slate-500">
            {`Produces source type ${[spec.sourceType, ...spec.alsoProduces].join(' + ')}`}
            {spec.writesMeasures.length ? ` · measures ${spec.writesMeasures.join(', ')}` : ''}
          </div>
        </div>
      )}

      <label className="block">
        <span className="text-sm">Name</span>
        <input className="mt-1 w-full rounded border px-2 py-1" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      {spec?.requiresWindow && (
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
      )}

      {sourceIdFields.map((field) => (
        <label className="block" key={field}>
          <span className="text-sm">
            {field.replace(/_/g, ' ')}
            {spec.optionalInputs.includes(field) ? ' (optional)' : ''}
          </span>
          <input
            type="number"
            className="mt-1 w-full rounded border px-2 py-1"
            value={inputs[field] || ''}
            onChange={(e) => setInputs((p) => ({ ...p, [field]: e.target.value }))}
          />
        </label>
      ))}

      {spec && specs.length > 0 && (
        <details className="rounded border p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Thresholds (defaults from the recommendation report)
          </summary>
          <div className="mt-3 space-y-3">
            {specs.map((t) => (
              <label className="block" key={t.name}>
                <span className="text-sm">
                  {`${t.name} — ${t.measure}, default ${t.default} ${t.unit}`}
                </span>
                <input
                  type="number"
                  step="any"
                  placeholder={String(t.default)}
                  className="mt-1 w-full rounded border px-2 py-1"
                  value={overrides[t.name] ?? ''}
                  onChange={(e) => setOverrides((p) => ({ ...p, [t.name]: e.target.value }))}
                />
                <span className="text-xs text-slate-500">{t.desc}</span>
              </label>
            ))}
          </div>
        </details>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}

      <button
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        disabled={busy || !ready}
        onClick={submit}
      >
        {busy ? 'Queueing…' : 'Run stage'}
      </button>
    </div>
  );
}
