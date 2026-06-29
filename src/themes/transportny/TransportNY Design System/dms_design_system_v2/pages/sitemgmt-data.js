/* Site Management / QA / Ticketing — shared mock data (classic script → window.SITEMGMT).
 *
 * The PAGE INVENTORY is REAL: the live page list across the four delivery
 * surfaces (tsmo2 / freightatlas2 / npmrds-DMS / npmrds-transportNY), pulled
 * 2026-06-23. QA / ticket / status values are realistic PLACEHOLDERS.
 *
 * Single source of truth: every page's open-bug counts, the RAG rollups, and the
 * ticket lists on every screen are DERIVED from `tickets` + `pages` here, so all
 * four mockups stay consistent (same #ids, severities, and counts everywhere).
 */
(function () {
  var OPEN = ['Triage', 'In progress', 'In review'];        // vs Resolved / Closed

  var surfaces = [
    { key: 'tsmo2',      label: 'TSMO',                  sub: 'tsmo2 · DMS',          link: 'tsmo-home.html' },
    { key: 'fa2',        label: 'Freight Atlas',         sub: 'freightatlas2 · DMS',  link: 'freight-atlas-home.html' },
    { key: 'npmrds_dms', label: 'NPMRDS (DMS)',          sub: 'npmrds2 · DMS',        link: null },
    { key: 'npmrds_tny', label: 'NPMRDS (transportNY)',  sub: 'src/sites/npmrds',     link: null },
  ];

  // build: Not started | In progress | Built (draft) | Published
  // qa:    Needs QA | In review | Changes requested | Conditional sign-off | Approved
  // data:  Real | Partial | Mock
  var pages = [
    // ── tsmo2 (10) — freshly built drafts, QA/publish is the gap ───────────────
    { id: 'tsmo2:home',           surface: 'tsmo2', name: 'Home',                route: '/home',           build: 'Built (draft)', qa: 'Conditional sign-off', data: 'Real',    owner: 'AM', updated: '2026-06-23' },
    { id: 'tsmo2:congestion_v2',  surface: 'tsmo2', name: 'Congestion (v2)',     route: '/congestion_v2',  build: 'Built (draft)', qa: 'In review',            data: 'Real',    owner: 'AM', updated: '2026-06-23' },
    { id: 'tsmo2:reliability_v2', surface: 'tsmo2', name: 'Reliability (v2)',    route: '/reliability_v2', build: 'Built (draft)', qa: 'In review',            data: 'Partial', owner: 'AM', updated: '2026-06-23' },
    { id: 'tsmo2:incidents_v2',   surface: 'tsmo2', name: 'Incidents v2',        route: '/incidents_v2',   build: 'In progress',   qa: 'Needs QA',             data: 'Mock',    owner: 'RG', updated: '2026-06-20' },
    { id: 'tsmo2:workzones_v2',   surface: 'tsmo2', name: 'Work Zones v2',       route: '/workzones_v2',   build: 'In progress',   qa: 'Needs QA',             data: 'Partial', owner: 'RG', updated: '2026-06-20' },
    { id: 'tsmo2:incident_search',surface: 'tsmo2', name: 'Incident Search',     route: '/incident_search',build: 'Built (draft)', qa: 'In review',            data: 'Real',    owner: 'DH', updated: '2026-06-22' },
    { id: 'tsmo2:corridor_view',  surface: 'tsmo2', name: 'Corridor View',       route: '/corridor_view',  build: 'Built (draft)', qa: 'Approved',             data: 'Real',    owner: 'DH', updated: '2026-06-22' },
    { id: 'tsmo2:incident_view',  surface: 'tsmo2', name: 'Incident View',       route: '/incident_view',  build: 'Built (draft)', qa: 'In review',            data: 'Partial', owner: 'DH', updated: '2026-06-18' },
    { id: 'tsmo2:about',          surface: 'tsmo2', name: 'About TSMO',          route: '/about',          build: 'Built (draft)', qa: 'Approved',             data: 'Real',    owner: 'AM', updated: '2026-06-22' },
    { id: 'tsmo2:methodology',    surface: 'tsmo2', name: 'Data & Methodology',  route: '/methodology',    build: 'Built (draft)', qa: 'Approved',             data: 'Real',    owner: 'AM', updated: '2026-06-22' },
    // ── freightatlas2 (7) — earliest stage, the project's red surface ──────────
    { id: 'fa2:home',             surface: 'fa2', name: 'Home',                  route: '/home',                build: 'Built (draft)', qa: 'Changes requested', data: 'Partial', owner: 'JC', updated: '2026-06-16' },
    { id: 'fa2:freight_atlas',    surface: 'fa2', name: 'Freight Atlas (map)',   route: '/freight_atlas',       build: 'In progress',   qa: 'Needs QA',          data: 'Mock',    owner: 'JC', updated: '2026-06-14' },
    { id: 'fa2:maps_gallery',     surface: 'fa2', name: 'Maps Gallery',          route: '/maps_gallery',        build: 'In progress',   qa: 'Needs QA',          data: 'Mock',    owner: 'JC', updated: '2026-06-14' },
    { id: 'fa2:freight_map_gallery', surface: 'fa2', name: 'Freight Map Gallery',route: '/freight_map_gallery', build: 'Not started',   qa: 'Needs QA',          data: 'Mock',    owner: 'JC', updated: '2026-06-10' },
    { id: 'fa2:about',            surface: 'fa2', name: 'About',                 route: '/about',               build: 'Built (draft)', qa: 'In review',         data: 'Partial', owner: 'SP', updated: '2026-06-15' },
    { id: 'fa2:about_the_plan',   surface: 'fa2', name: 'About & The Plan',      route: '/about_the_plan',      build: 'In progress',   qa: 'Needs QA',          data: 'Mock',    owner: 'SP', updated: '2026-06-12' },
    { id: 'fa2:page_3',           surface: 'fa2', name: 'Page 3 (scratch)',      route: '/page_3',              build: 'Not started',   qa: 'Needs QA',          data: 'Mock',    owner: '—',  updated: '2026-06-08' },
    // ── npmrds (DMS / npmrds2) (5) — mature, the green surface ─────────────────
    { id: 'npmrds_dms:home',      surface: 'npmrds_dms', name: 'Home',           route: '/home',          build: 'Published', qa: 'Approved', data: 'Real', owner: 'DH', updated: '2026-05-30' },
    { id: 'npmrds_dms:map_21',    surface: 'npmrds_dms', name: 'MAP 21',         route: '/map_21',        build: 'Published', qa: 'Approved', data: 'Real', owner: 'DH', updated: '2026-05-30' },
    { id: 'npmrds_dms:macro_tool',surface: 'npmrds_dms', name: 'Macro Tool',     route: '/macro_tool',    build: 'Published', qa: 'Approved', data: 'Real', owner: 'RG', updated: '2026-06-02' },
    { id: 'npmrds_dms:analysis',  surface: 'npmrds_dms', name: 'Analysis',       route: '/analysis',      build: 'Published', qa: 'Approved', data: 'Real', owner: 'RG', updated: '2026-06-02' },
    { id: 'npmrds_dms:routes',    surface: 'npmrds_dms', name: 'Routes',         route: '/analysis/routes',build: 'Published',qa: 'Approved', data: 'Real', owner: 'RG', updated: '2026-06-02' },
    // ── npmrds site (transportNY) (10) — in production, minor legacy debt ──────
    { id: 'npmrds_tny:home',          surface: 'npmrds_tny', name: 'Home',           route: '/',              build: 'Published',     qa: 'Approved',            data: 'Real', owner: 'DH', updated: '2026-04-28' },
    { id: 'npmrds_tny:map',           surface: 'npmrds_tny', name: 'Map',            route: '/map',           build: 'Published',     qa: 'Conditional sign-off',data: 'Real', owner: 'DH', updated: '2026-05-12' },
    { id: 'npmrds_tny:analysis',      surface: 'npmrds_tny', name: 'Analysis',       route: '/analysis',      build: 'Published',     qa: 'Conditional sign-off',data: 'Real', owner: 'RG', updated: '2026-05-12' },
    { id: 'npmrds_tny:pm3',           surface: 'npmrds_tny', name: 'PM3 / MAP-21',   route: '/map21',         build: 'Published',     qa: 'Approved',            data: 'Real', owner: 'RG', updated: '2026-04-30' },
    { id: 'npmrds_tny:batch_reports', surface: 'npmrds_tny', name: 'Batch Reports',  route: '/batchreportsnew',build: 'Published',    qa: 'In review',           data: 'Real', owner: 'DH', updated: '2026-06-05' },
    { id: 'npmrds_tny:incident_view', surface: 'npmrds_tny', name: 'Incident View',  route: '/incidents/:id', build: 'Published',     qa: 'Approved',            data: 'Real', owner: 'DH', updated: '2026-05-20' },
    { id: 'npmrds_tny:tmc_page',      surface: 'npmrds_tny', name: 'TMC Page',       route: '/tmc/:tmc',      build: 'Published',     qa: 'Approved',            data: 'Real', owner: 'RG', updated: '2026-05-18' },
    { id: 'npmrds_tny:folders',       surface: 'npmrds_tny', name: 'Folders',        route: '/folders',       build: 'Published',     qa: 'Approved',            data: 'Real', owner: 'RG', updated: '2026-05-02' },
    { id: 'npmrds_tny:route_creation',surface: 'npmrds_tny', name: 'Route Creation', route: '/route_creation',build: 'Built (draft)', qa: 'In review',           data: 'Partial',owner: 'SP', updated: '2026-06-09' },
    { id: 'npmrds_tny:cms',           surface: 'npmrds_tny', name: 'CMS / Docs',     route: '/docs',          build: 'Published',     qa: 'Approved',            data: 'Real', owner: 'SP', updated: '2026-05-25' },
  ];

  // Each ticket targets a real page id. Severity: Blocker|Major|Minor|Polish.
  // Priority: Now|Next|Later. Status drives "open" (Triage/In progress/In review).
  var tickets = [
    { id: 101, title: 'Atlas map tiles fail to load on staging',                 page: 'fa2:freight_atlas',    severity: 'Blocker', priority: 'Now',   status: 'Triage',      assignee: 'JC', reporter: 'Client', opened: '2026-06-21', updated: '2026-06-22', labels: ['maps', 'staging'],
      desc: 'The Freight Atlas map renders a grey canvas on staging — vector tiles never load.', steps: '1. Open /freight_atlas on staging  2. Wait for map  3. Tiles never appear', expected: 'Base map + freight layers render', actual: 'Grey canvas, console 403 on tile endpoint', env: { route: '/freight_atlas', browser: 'Chrome 126', viewport: '1440×900' },
      comments: [{ who: 'Client', when: '2026-06-21', text: 'Blocking the demo on Thursday.' }, { who: 'JC', when: '2026-06-22', text: 'Tile token missing on staging — chasing infra.' }] },
    { id: 102, title: 'Gallery thumbnails 404 in production bucket',             page: 'fa2:maps_gallery',     severity: 'Blocker', priority: 'Now',   status: 'In progress', assignee: 'JC', reporter: 'QA',     opened: '2026-06-20', updated: '2026-06-23', labels: ['gallery', 'assets'],
      desc: 'Half the gallery thumbnails 404 — asset paths point at the dev bucket.', steps: '1. Open Maps Gallery  2. Observe broken images', expected: 'All thumbnails load', actual: '404 on /dev-assets/*', env: { route: '/maps_gallery', browser: 'Firefox 128', viewport: '1280×800' },
      comments: [{ who: 'QA', when: '2026-06-20', text: '9 of 18 thumbnails broken.' }] },
    { id: 103, title: 'Filter chips overflow / wrap on mobile',                  page: 'fa2:maps_gallery',     severity: 'Major',   priority: 'Next',  status: 'Triage',      assignee: 'JC', reporter: 'QA',     opened: '2026-06-19', updated: '2026-06-19', labels: ['responsive'],
      desc: 'Filter chips overflow their row below 480px and overlap the grid.', steps: '1. Open gallery at 390px wide', expected: 'Chips wrap cleanly', actual: 'Chips overlap thumbnails', env: { route: '/maps_gallery', browser: 'Mobile Safari', viewport: '390×844' }, comments: [] },
    { id: 104, title: 'Hero stat-strip still shows placeholder figures',         page: 'fa2:home',             severity: 'Major',   priority: 'Now',   status: 'In review',   assignee: 'SP', reporter: 'Client', opened: '2026-06-17', updated: '2026-06-22', labels: ['data', 'home'],
      desc: 'The home hero stat-strip shows the lorem placeholder numbers, not the bottleneck / truck-parking / PHFS / NHFP datasets.', steps: '1. Open Freight Atlas home', expected: 'Real stat figures', actual: 'Placeholder "00.0" values', env: { route: '/home', browser: 'Chrome 126', viewport: '1440×900' }, comments: [{ who: 'SP', when: '2026-06-22', text: 'Datasets identified; wiring the cards now.' }] },
    { id: 105, title: 'TRANSEARCH methodology PDFs not linked',                  page: 'fa2:about_the_plan',   severity: 'Major',   priority: 'Next',  status: 'Triage',      assignee: 'SP', reporter: 'Client', opened: '2026-06-15', updated: '2026-06-15', labels: ['content'],
      desc: 'The 6 TRANSEARCH methodology PDFs referenced in About & The Plan are not uploaded or linked.', steps: '1. Open About & The Plan  2. Click any methodology link', expected: 'PDF opens', actual: 'Dead link', env: { route: '/about_the_plan', browser: 'Chrome 126', viewport: '1440×900' }, comments: [] },
    { id: 106, title: 'Region filter zeroes the grouped-join corridor count',    page: 'tsmo2:congestion_v2',  severity: 'Major',   priority: 'Now',   status: 'In progress', assignee: 'AM', reporter: 'AM',     opened: '2026-06-23', updated: '2026-06-23', labels: ['filter', 'uda'],
      desc: 'On §04 worst-corridors, selecting a Region drops the grouped-join count to zero (a latent length-path bug in the joined section).', steps: '1. Open /congestion_v2  2. Pick a Region', expected: 'Corridors for that region', actual: 'Empty table', env: { route: '/congestion_v2?region=…', browser: 'Chrome 126', viewport: '1440×900' }, comments: [{ who: 'AM', when: '2026-06-23', text: 'Statewide works; region path needs the length route fix.' }] },
    { id: 107, title: "Blank URL params → 'Error getting length'",               page: 'tsmo2:reliability_v2',  severity: 'Major',   priority: 'Now',   status: 'Resolved',    assignee: 'AM', reporter: 'Client', opened: '2026-06-23', updated: '2026-06-23', labels: ['filter', 'fixed'],
      desc: 'reliability_v2 with blank params (?region=&system=) threw "Error getting length"; empty filter values hit numeric columns.', steps: '1. Open /reliability_v2?region=&year_record=2024&system=', expected: 'Page renders (no filter)', actual: 'Error getting length', env: { route: '/reliability_v2?region=&system=', browser: 'Chrome 126', viewport: '1440×900' }, comments: [{ who: 'AM', when: '2026-06-23', text: 'Fixed in buildUdaConfig — empty filter values now dropped. Verified.' }] },
    { id: 108, title: 'Batch export drops the last TMC in a corridor',           page: 'npmrds_tny:batch_reports', severity: 'Major', priority: 'Next', status: 'Resolved',   assignee: 'DH', reporter: 'QA',     opened: '2026-06-03', updated: '2026-06-06', labels: ['export', 'legacy'],
      desc: 'CSV batch export omits the final TMC of each corridor (off-by-one in the range).', steps: '1. Run a batch report  2. Export CSV  3. Compare TMC counts', expected: 'All TMCs present', actual: 'Last TMC missing', env: { route: '/batchreportsnew', browser: 'Chrome 125', viewport: '1440×900' }, comments: [{ who: 'DH', when: '2026-06-06', text: 'Fixed the inclusive bound; QA re-checked.' }] },
    { id: 109, title: 'NPMRDS freshness card note line not rendering',           page: 'tsmo2:home',           severity: 'Minor',   priority: 'Later', status: 'In review',   assignee: 'AM', reporter: 'AM',     opened: '2026-06-23', updated: '2026-06-23', labels: ['cards'],
      desc: 'The freshness card renders its value but the prose note line is blank (sibling cards behave the same — config, not a regression).', steps: '1. Open /home  2. Scroll to Data Freshness', expected: 'Note line shows', actual: 'Note line empty', env: { route: '/home', browser: 'Chrome 126', viewport: '1440×900' }, comments: [] },
    { id: 110, title: 'Y-axis label overlaps the plot at narrow widths',         page: 'npmrds_tny:analysis',  severity: 'Minor',   priority: 'Later', status: 'Triage',      assignee: 'RG', reporter: 'QA',     opened: '2026-05-11', updated: '2026-05-11', labels: ['charts', 'responsive'],
      desc: 'Below ~1100px the analysis chart Y-axis label overlaps the plotting area.', steps: '1. Open Analysis at 1024px', expected: 'Label clears the plot', actual: 'Overlap', env: { route: '/analysis', browser: 'Edge 125', viewport: '1024×768' }, comments: [] },
    { id: 111, title: "Legend swatch colors don't match the layer",             page: 'npmrds_tny:map',       severity: 'Minor',   priority: 'Later', status: 'Triage',      assignee: 'DH', reporter: 'QA',     opened: '2026-05-10', updated: '2026-05-10', labels: ['maps', 'legend'],
      desc: 'Map legend swatches use the old palette; the rendered layer uses the new one.', steps: '1. Open Map  2. Compare legend vs layer', expected: 'Colors match', actual: 'Mismatch', env: { route: '/map', browser: 'Chrome 126', viewport: '1440×900' }, comments: [] },
    { id: 112, title: 'Keyword search sluggish over 150k events',                page: 'tsmo2:incident_search',severity: 'Minor',   priority: 'Next',  status: 'In review',   assignee: 'DH', reporter: 'QA',     opened: '2026-06-21', updated: '2026-06-22', labels: ['search', 'perf'],
      desc: 'Multi-column keyword search takes 2–3s on the full 152k-event store.', steps: '1. Open Incident Search  2. Type a keyword', expected: '<1s', actual: '2–3s', env: { route: '/incident_search', browser: 'Chrome 126', viewport: '1440×900' }, comments: [{ who: 'DH', when: '2026-06-22', text: 'Debounced; eyeing a trigram index.' }] },
    { id: 113, title: 'Strip-map header spacing is tight',                       page: 'tsmo2:corridor_view',  severity: 'Polish',  priority: 'Later', status: 'Triage',      assignee: 'AM', reporter: 'AM',     opened: '2026-06-22', updated: '2026-06-22', labels: ['polish'],
      desc: 'Tier-3 polish: the strip-map header sits a touch close to the heatmap; needs a few px.', steps: '1. Open Corridor View', expected: 'Comfortable spacing', actual: 'Tight', env: { route: '/corridor_view', browser: 'Chrome 126', viewport: '1440×900' }, comments: [] },
    { id: 114, title: 'Tooltip clips at the viewport edge',                      page: 'npmrds_dms:macro_tool',severity: 'Minor',   priority: 'Later', status: 'Resolved',    assignee: 'RG', reporter: 'QA',     opened: '2026-05-28', updated: '2026-06-01', labels: ['tooltip'],
      desc: 'Macro Tool tooltip was clipped when the hovered cell sat at the right edge.', steps: '1. Hover a right-edge cell', expected: 'Tooltip flips inward', actual: 'Clipped', env: { route: '/macro_tool', browser: 'Chrome 125', viewport: '1440×900' }, comments: [{ who: 'RG', when: '2026-06-01', text: 'Added edge collision flip.' }] },
  ];

  // taxonomy → tailwind badge classes
  var buildColor = { 'Not started': 'bg-slate-100 text-slate-500', 'In progress': 'bg-amber-100 text-amber-700', 'Built (draft)': 'bg-sky-100 text-sky-700', 'Published': 'bg-emerald-100 text-emerald-700' };
  var qaColor    = { 'Needs QA': 'bg-slate-100 text-slate-500', 'In review': 'bg-indigo-100 text-indigo-700', 'Changes requested': 'bg-rose-100 text-rose-700', 'Conditional sign-off': 'bg-amber-100 text-amber-700', 'Approved': 'bg-emerald-100 text-emerald-700' };
  var sevColor   = { 'Blocker': 'bg-rose-600 text-white', 'Major': 'bg-orange-500 text-white', 'Minor': 'bg-amber-400 text-amber-950', 'Polish': 'bg-slate-300 text-slate-700' };
  var sevDot     = { 'Blocker': 'bg-rose-600', 'Major': 'bg-orange-500', 'Minor': 'bg-amber-400', 'Polish': 'bg-slate-400' };
  var prioColor  = { 'Now': 'bg-rose-50 text-rose-700 ring-1 ring-rose-200', 'Next': 'bg-amber-50 text-amber-700 ring-1 ring-amber-200', 'Later': 'bg-slate-50 text-slate-500 ring-1 ring-slate-200' };
  var dataColor  = { 'Real': 'bg-emerald-100 text-emerald-700', 'Partial': 'bg-amber-100 text-amber-700', 'Mock': 'bg-slate-100 text-slate-500' };
  var ragColor   = { green: 'bg-emerald-500', amber: 'bg-amber-400', red: 'bg-rose-500' };

  var BUILD_WT = { 'Not started': 0, 'In progress': 0.5, 'Built (draft)': 0.8, 'Published': 1 };

  var SITEMGMT = {
    asOf: '2026-06-23', surfaces: surfaces, pages: pages, tickets: tickets,
    buildColor: buildColor, qaColor: qaColor, sevColor: sevColor, sevDot: sevDot,
    prioColor: prioColor, dataColor: dataColor, ragColor: ragColor,
    OPEN: OPEN,
    isOpen: function (t) { return OPEN.indexOf(t.status) !== -1; },
    ticketsFor: function (pageId) { return tickets.filter(function (t) { return t.page === pageId; }); },
    openTicketsFor: function (pageId) { return tickets.filter(function (t) { return t.page === pageId && OPEN.indexOf(t.status) !== -1; }); },
    bugsFor: function (pageId) {
      var b = { Blocker: 0, Major: 0, Minor: 0, Polish: 0 };
      this.openTicketsFor(pageId).forEach(function (t) { b[t.severity]++; });
      return b;
    },
  };
  SITEMGMT.page = function (id) { return pages.filter(function (p) { return p.id === id; })[0]; };
  SITEMGMT.ticket = function (id) { return tickets.filter(function (t) { return t.id === Number(id); })[0]; };
  SITEMGMT.surface = function (key) { return surfaces.filter(function (s) { return s.key === key; })[0]; };
  SITEMGMT.rag = function (p) {
    var b = this.bugsFor(p.id);
    if (p.qa === 'Changes requested' || b.Blocker > 0 || b.Major > 0) return 'red';
    if (p.build === 'Published' && p.qa === 'Approved') return 'green';
    return 'amber';
  };
  SITEMGMT.compute = function () {
    var self = this, P = pages, n = P.length;
    var sum = function (f) { return P.reduce(function (a, p) { return a + f(p); }, 0); };
    var bugs = { Blocker: 0, Major: 0, Minor: 0, Polish: 0 };
    tickets.forEach(function (t) { if (self.isOpen(t)) bugs[t.severity]++; });
    var per = {};
    surfaces.forEach(function (s) {
      var ps = P.filter(function (p) { return p.surface === s.key; });
      var pb = { Blocker: 0, Major: 0, Minor: 0, Polish: 0 };
      ps.forEach(function (p) { var b = self.bugsFor(p.id); pb.Blocker += b.Blocker; pb.Major += b.Major; pb.Minor += b.Minor; pb.Polish += b.Polish; });
      var rags = ps.map(function (p) { return self.rag(p); });
      per[s.key] = {
        pages: ps.length,
        pct: Math.round(100 * ps.reduce(function (a, p) { return a + BUILD_WT[p.build]; }, 0) / (ps.length || 1)),
        published: ps.filter(function (p) { return p.build === 'Published'; }).length,
        approved: ps.filter(function (p) { return p.qa === 'Approved'; }).length,
        bugs: pb,
        rag: rags.indexOf('red') !== -1 ? 'red' : (rags.every(function (r) { return r === 'green'; }) ? 'green' : 'amber'),
      };
    });
    return {
      total: n,
      published: sum(function (p) { return p.build === 'Published' ? 1 : 0; }),
      approved: sum(function (p) { return p.qa === 'Approved' ? 1 : 0; }),
      dataReal: sum(function (p) { return p.data === 'Real' ? 1 : 0; }),
      pctComplete: Math.round(100 * sum(function (p) { return BUILD_WT[p.build]; }) / n),
      bugs: bugs,
      openTickets: tickets.filter(function (t) { return self.isOpen(t); }).length,
      perSurface: per,
      overallRag: bugs.Blocker > 0 ? 'red' : (bugs.Major > 0 ? 'amber' : 'green'),
    };
  };

  if (typeof window !== 'undefined') window.SITEMGMT = SITEMGMT;
  if (typeof module !== 'undefined' && module.exports) module.exports = SITEMGMT;
})();
