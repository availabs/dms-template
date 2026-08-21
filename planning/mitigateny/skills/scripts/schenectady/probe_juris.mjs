// Probe: identify host/app for the jurisdictions dataset + annex page.
const IDS = [1346449, 1346450, 2304232, 2304223];
const HOSTS = ['https://dmsserver.availabs.org'];
const APPS = ['mitigat-ny-prod'];

function atom(v){ return v && v.$type === 'atom' ? v.value : v; }
async function graph(host, paths){
  const body = 'method=get&paths=' + encodeURIComponent(JSON.stringify(paths));
  const r = await fetch(host + '/graph', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body });
  if(!r.ok) throw new Error('HTTP '+r.status+' '+await r.text());
  return r.json();
}

for (const host of HOSTS){
  for (const app of APPS){
    try {
      const j = await graph(host, [['dms','data',app,'byId',IDS,['id','type','app']]]);
      const b = j.jsonGraph?.dms?.data?.[app]?.byId || {};
      console.log(`\n=== host=${host} app=${app} ===`);
      for (const id of IDS){
        const row = b[String(id)];
        if(!row){ console.log(`  ${id}: (null)`); continue; }
        console.log(`  ${id}: type=${JSON.stringify(atom(row.type))} app=${JSON.stringify(atom(row.app))}`);
      }
    } catch(e){ console.log(`host=${host} app=${app} ERR ${e.message}`); }
  }
}
