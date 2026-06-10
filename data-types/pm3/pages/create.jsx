import React from 'react';
import { get } from 'lodash-es';
import { useNavigate } from 'react-router';

async function checkApiResponse(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text}`);
  }
}

const loadNpmrdsSources = async ({ falcor, pgEnv, setSources }) => {
  const lengthPath = ['uda', pgEnv, 'sources', 'length'];
  const lengthRes = await falcor.get(lengthPath);
  const length = get(lengthRes.json, lengthPath, 0);
  if (!length) {
    setSources([]);
    return;
  }

  const attrs = ['source_id', 'name', 'type', 'metadata'];
  await falcor.get([
    'uda', pgEnv, 'sources', 'byIndex',
    { from: 0, to: length - 1 },
    attrs,
  ]);

  const cache = falcor.getCache();
  const byIndex = get(cache, ['uda', pgEnv, 'sources', 'byIndex'], {});
  const npmrdsSources = Object.values(byIndex)
    .map((ref) => {
      const node = get(cache, ref.value, {});
      const flat = {};
      for (const k of attrs) {
        const v = node[k];
        flat[k] = v && typeof v === 'object' && '$type' in v ? v.value : v;
      }
      return flat;
    })
    .filter((src) => src.type === 'npmrds');

  setSources(npmrdsSources);
};

const submitPublish = async ({ rtPfx, source, npmrdsSourceId, years, percentTmc, newVersion, user }) => {
  const url = `${rtPfx}/pm3/publish`;
  const body = JSON.stringify({
    source_values: {
      name: source?.name,
      type: source?.type || 'pm3',
    },
    source_id: source?.source_id || null,
    npmrdsSourceId,
    years: years.map((y) => parseInt(y, 10)),
    percentTmc: percentTmc ?? 100,
    newVersion: newVersion || (new Date()).toLocaleString(),
    user_id: user?.id,
    email: user?.email,
  });

  const res = await fetch(url, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  });
  await checkApiResponse(res);
  return res.json();
};

function Create({ source, newVersion, baseUrl, context }) {
  const navigate = useNavigate();
  const ctx = React.useContext(context);
  const { user, falcor, datasources, API_HOST } = ctx || {};
  const pgEnv = (datasources || []).find((d) => d.type === 'external')?.env || '';
  const rtPfx = `${API_HOST || ''}/dama-admin/${pgEnv}`;
  const ctxBaseUrl = ctx?.baseUrl || baseUrl || '';

  const [npmrdsSources, setNpmrdsSources] = React.useState([]);
  const [npmrdsSourceId, setNpmrdsSourceId] = React.useState('');
  const [years, setYears] = React.useState([]);
  const [percentTmc, setPercentTmc] = React.useState(100);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!falcor || !pgEnv) return;
    loadNpmrdsSources({ falcor, pgEnv, setSources: setNpmrdsSources });
  }, [falcor, pgEnv]);

  const currentSource = React.useMemo(
    () => npmrdsSources.find((s) => s.source_id === parseInt(npmrdsSourceId, 10)),
    [npmrdsSources, npmrdsSourceId]
  );

  const availableYears = React.useMemo(() => {
    const meta = currentSource?.metadata?.npmrds_meta_layer_view_id;
    if (meta && typeof meta === 'object') {
      return Object.keys(meta).map((y) => parseInt(y, 10)).sort();
    }
    return Array.from({ length: 9 }, (_, i) => 2017 + i);
  }, [currentSource]);

  React.useEffect(() => {
    // drop selections no longer offered by the chosen source
    setYears((prev) => prev.filter((y) => availableYears.includes(y)));
  }, [availableYears]);

  const toggleYear = (y) => {
    setYears((prev) => (prev.includes(y) ? prev.filter((v) => v !== y) : [...prev, y].sort()));
  };

  const onPublish = async () => {
    if (!npmrdsSourceId || !years.length) return;
    setLoading(true);
    try {
      const result = await submitPublish({
        rtPfx, source, npmrdsSourceId, years, percentTmc, newVersion, user,
      });
      const { etl_context_id, source_id } = result || {};
      console.log('[pm3] response', result);
      if (source_id && etl_context_id) {
        navigate(`${ctxBaseUrl}/source/${source_id}/task/${etl_context_id}`);
      } else if (source_id) {
        navigate(`${ctxBaseUrl}/source/${source_id}`);
      }
    } catch (err) {
      console.error('[pm3] publish failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full m-5">
      <div className="flex items-center justify-center p-2">
        <div className="w-full max-w-xs mx-auto">
          <div className="flex flex-col pt-2">
            <div className="flex px-2 text-sm text-gray-600 capitalize">
              NPMRDS Production Source
            </div>
            <div className="flex pl-1">
              <select
                className="w-full p-1 bg-blue-100 hover:bg-blue-300 border rounded-md"
                value={npmrdsSourceId}
                onChange={(e) => setNpmrdsSourceId(e.target.value)}
              >
                <option value="">--</option>
                {npmrdsSources.map((s) => (
                  <option key={`pm3_npmrds_${s.source_id}`} value={s.source_id}>
                    {s.name} -- {s.source_id}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center p-2">
        <div className="w-full max-w-xs mx-auto">
          <div className="flex px-2 pb-1 text-sm text-gray-600 capitalize">Years</div>
          <div className="flex flex-wrap gap-2 pl-1">
            {availableYears.map((y) => (
              <label
                key={`pm3_year_${y}`}
                className={
                  !npmrdsSourceId
                    ? 'px-2 py-1 text-sm rounded-md cursor-not-allowed bg-gray-200 text-gray-500'
                    : years.includes(y)
                      ? 'px-2 py-1 text-sm rounded-md cursor-pointer bg-blue-500 text-white'
                      : 'px-2 py-1 text-sm rounded-md cursor-pointer bg-blue-100 hover:bg-blue-300'
                }
              >
                <input
                  type="checkbox"
                  className="hidden"
                  disabled={!npmrdsSourceId}
                  checked={years.includes(y)}
                  onChange={() => toggleYear(y)}
                />
                {y}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center p-2">
        <div className="w-full max-w-xs mx-auto">
          <div className="w-[50%]">
            <div className="flex px-2 pb-1 text-sm text-gray-600 capitalize">% of tmc</div>
            <div className="flex pl-1">
              <input
                type="number"
                min={0.1}
                max={100}
                step={0.1}
                className="w-full p-1 bg-blue-100 hover:bg-blue-300 border rounded-md"
                value={percentTmc}
                onChange={(e) => setPercentTmc(parseFloat(e.target.value))}
              />
            </div>
          </div>
        </div>
      </div>
      {npmrdsSourceId && years.length && source?.name ? (
        <div className="flex items-center justify-center p-2">
          <button
            onClick={onPublish}
            disabled={loading}
            className="cursor-pointer bg-blue-500 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
          >
            {loading ? 'Publishing...' : (source?.source_id ? 'Add View' : 'Add Source')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default Create;
