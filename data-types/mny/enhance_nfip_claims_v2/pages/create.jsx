import React from 'react'
import { get } from 'lodash-es'
import { useNavigate } from 'react-router'

const range = (start, end) => Array.from({ length: end + 1 - start }, (_, k) => k + start);

async function checkApiResponse(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text}`);
  }
}

export const getSrcViews = async ({falcor, pgEnv, setVersions, type}) => {
  await falcor.get(['uda', pgEnv, 'views', 'bySourceCategory', type]);
  const res = get(falcor.getCache(), ['uda', pgEnv, 'views', 'bySourceCategory', type, 'value']);
  setVersions({views: res})

  return {views: res}
}

export const formatDate = (dateString) => {
  const options = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  };
  return dateString ? new Date(dateString).toLocaleDateString(undefined, options) : ``;
};

export const RenderVersions = ({ value, setValue, versions, type }) => {
  return (
      <div className="flex justify-between group">
        <div className="flex-1 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
          <dt className="text-sm font-medium text-gray-500 py-5">Select {type} version:</dt>
          <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
            <div className="pt-3 pr-8">
              <select
                  className="w-full bg-white p-3 flex-1 shadow bg-grey-50 focus:bg-blue-100  border-gray-300"
                  value={value || ""}
                  onChange={e => {
                    setValue(e.target.value);
                  }}>
                <option value="" disabled key={type}>Select your option</option>
                {(versions.views || versions || [])
                    .sort((a, b) => (b.view_id) - (a.view_id))
                    .map(v =>
                        <option
                            key={v.view_id || v}
                            value={v.view_id || v}
                            className={`p-2 ${get(v, ["metadata", "authoritative"]) === "true" ? `font-bold` : ``}`}>
                          {get(v, "version") || v}
                          {v.view_id && ` (${v.view_id || ``} ${formatDate(v._modified_timestamp)})`}
                        </option>)
                }
              </select>
            </div>
          </dd>
        </div>
      </div>
  );
}

const CallServer = async ({ rtPfx, source, newVersion, viewNFIP, viewDDS, viewCounty, viewJurisdiction, viewBlockGroup, user }) => {
  const viewMetadata = [viewNFIP.view_id, viewDDS.view_id, viewCounty.view_id, viewJurisdiction.view_id];

  const url = `${rtPfx}/enhance_nfip_claims_v2/publish`;
  const body = JSON.stringify({
    table_name: source?.type || 'fima_nfip_claims_v2_enhanced',
    source_name: source?.name,
    existing_source_id: source?.source_id,
    view_dependencies: JSON.stringify(viewMetadata),
    version: newVersion || (new Date()).toLocaleString(),

    user_id: user?.id,
    email: user?.email,

    nfip_schema: viewNFIP.table_schema,
    nfip_table: viewNFIP.table_name,
    dds_schema: viewDDS.table_schema,
    dds_table: viewDDS.table_name,
    county_schema: viewCounty.table_schema,
    county_table: viewCounty.table_name,
    jurisdiction_schema: viewJurisdiction.table_schema,
    jurisdiction_table: viewJurisdiction.table_name,
    blockgroup_schema: viewBlockGroup.table_schema,
    blockgroup_table: viewBlockGroup.table_name,
  });

  const stgLyrDataRes = await fetch(url, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  });

  await checkApiResponse(stgLyrDataRes);
  const resJson = await stgLyrDataRes.json();
  console.log('[enhance_nfip_claims_v2] response', resJson);
};

function Create({ source, newVersion, baseUrl, context }) {
  const navigate = useNavigate();
  const ctx = React.useContext(context);
  const { user, falcor, datasources, API_HOST } = ctx || {};
  const pgEnv = (datasources || []).find(d => d.type === 'external')?.env || '';
  const rtPfx = `${API_HOST || ''}/dama-admin/${pgEnv}`;

  const [viewNFIP, setViewNFIP] = React.useState();
  const [viewDDS, setViewDDS] = React.useState();
  const [viewCounty, setViewCounty] = React.useState();
  const [viewBlockGroup, setViewBlockGroup] = React.useState();
  const [viewJurisdictions, setViewJurisdictions] = React.useState();
  const [versionsNFIP, setVersionsNFIP] = React.useState({ sources: [], views: [] });
  const [versionsDDS, setVersionsDDS] = React.useState({ sources: [], views: [] });
  const [versionsCounty, setVersionsCounty] = React.useState({ sources: [], views: [] });
  const [versionsBlockGroup, setVersionsBlockGroup] = React.useState({ sources: [], views: [] });
  const [versionsJurisdictions, setVersionsJurisdictions] = React.useState({ sources: [], views: [] });

  React.useEffect(() => {
    if (!falcor || !pgEnv) return;
    async function fetchData() {
      await getSrcViews({ falcor, pgEnv, setVersions: setVersionsNFIP, type: 'fima_nfip_claims_v2' });
      await getSrcViews({ falcor, pgEnv, setVersions: setVersionsDDS, type: 'disaster_declarations_summaries_v2' });
      await getSrcViews({ falcor, pgEnv, setVersions: setVersionsCounty, type: 'tl_county' });
      await getSrcViews({ falcor, pgEnv, setVersions: setVersionsBlockGroup, type: 'tl_blockgroup' });
      await getSrcViews({ falcor, pgEnv, setVersions: setVersionsJurisdictions, type: 'jurisdictions' });
    }
    fetchData();
  }, [falcor, pgEnv]);
  console.log('server call', rtPfx)
  return (
    <div className='w-full'>
      <RenderVersions value={viewNFIP} setValue={setViewNFIP} versions={versionsNFIP} type='NFIP' />
      <RenderVersions value={viewDDS} setValue={setViewDDS} versions={versionsDDS} type='Disaster Declarations Summary' />
      <RenderVersions value={viewCounty} setValue={setViewCounty} versions={versionsCounty} type='County' />
      <RenderVersions value={viewBlockGroup} setValue={setViewBlockGroup} versions={versionsBlockGroup} type='Block Group' />
      <RenderVersions value={viewJurisdictions} setValue={setViewJurisdictions} versions={versionsJurisdictions} type='Jurisdictions' />
      <button
        className='mx-6 p-1 text-sm border-2 border-gray-200 rounded-md'
        onClick={() => CallServer({
          rtPfx, source, newVersion, navigate, user,
          viewNFIP: versionsNFIP.views.find(v => v.view_id === parseInt(viewNFIP)),
          viewDDS: versionsDDS.views.find(v => v.view_id === parseInt(viewDDS)),
          viewCounty: versionsCounty.views.find(v => v.view_id === parseInt(viewCounty)),
          viewBlockGroup: versionsBlockGroup.views.find(v => v.view_id === parseInt(viewBlockGroup)),
          viewJurisdiction: versionsJurisdictions.views.find(v => v.view_id === parseInt(viewJurisdictions)),
        })}
      >
        {source?.source_id ? 'Add View' : 'Add Source'}
      </button>
    </div>
  );
}

export default Create
