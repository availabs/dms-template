import { ScheduleGridEdit, ScheduleGridView } from './ScheduleGrid';

// Registry entry for the WCDB ScheduleGrid section, shipped by the THEME (via
// `theme.pageComponents`) rather than by the library: the 7×24 week is a WCDB
// design, and the brand's own folder is where it stays editable alongside the
// mockup it came from.
//
// dataWrapper-bound like any data section — the binding (schedule joined to
// shows) is authored in the section's Data settings, and `display.*Field` names
// which column plays which role, so the same grid works over any airings-shaped
// source rather than hardcoding WCDB's column names.
export default {
  name: 'Schedule Grid',
  type: 'scheduleGrid',
  useDataSource: true,
  useDataWrapper: true,
  useGetDataOnPageChange: true,
  showPagination: false,
  themeKey: 'scheduleGrid',

  defaultState: {
    // The full dataWrapper scaffolding. A section that omits any of
    // filters/columns/data/externalSource gets a fresh default state seeded on
    // mount — which silently takes `display` down with it.
    filters: { op: 'AND', groups: [] },
    columns: [],
    data: [],
    externalSource: { columns: [] },
    join: { sources: {} },
    display: {
      // pageSize is required even without pagination: getData derives its fetch
      // range from it, and an undefined one makes the range NaN — the length
      // query fires and the data request silently never does.
      pageSize: 500,
      usePagination: false,
      fetchMode: 'smart',

      gridTitle: 'The week',
      weekStartsOn: 'Mon',

      // Which column plays which role.
      idField: 'airing_id',
      dayField: 'day',
      startField: 'start',
      endField: 'end',
      titleField: 'name',
      iconField: 'icon',
      djField: 'dj_id',

      // Action params the grid publishes on click. They must match the
      // `modalParamKey` of the add/edit modal section groups on the page.
      addParamKey: 'add_airing',
      editParamKey: 'edit_airing',

      // Publish target: the PATTERN whose pages a publish repoints. Every section on
      // every page of it bound to the same `source_id` is rewritten, in both
      // `sections` and `draft_sections`.
      //
      // Nothing names the pages, deliberately. The schedule feeds far more than the
      // schedule page — the home on-air rail, the show page, station info, events,
      // the playlist: 26 sections across 8 pages — and a hand-kept list of them goes
      // stale the moment a ninth appears. Section ids are worse still: a published
      // page keeps a separate copy of every section from its draft, and the seed mints
      // fresh ids on each run.
      liveTargetPattern: 'wcdb_main',
      // Optional restriction: comma-separated page ids to limit the publish to.
      // Empty (normal) = every page in the pattern.
      liveTargetPageIds: '',

      // Sources whose INGEST tags rows with what was on air, and so have to follow a
      // publish too. The now_playing stream resolves each detection's show from
      // `source.metadata.schedule.view_id`; leave that behind and new tracks keep being
      // attributed to last semester's shows. Comma-separated DAMA source ids — stable
      // for the life of the source, unlike the section ids this used to track.
      taggingSourceIds: '',

      // Open the grid on the version the public site is PUBLISHED with rather than on
      // this section's saved data binding, which drifts the first time anyone publishes.
      // Set false to pin the section to its binding.
      openOnPublishedVersion: true,

      // Fallbacks for the version bar when no target page is set. Once one is,
      // the bar reads the live version off the sections themselves and ignores
      // these — a hand-typed "Version 1 · v10" is a claim nothing verifies.
      liveVersion: '',
      liveRowCount: null,
    },
  },

  controls: {
    more: [
      { type: 'input', label: 'Grid title', key: 'gridTitle' },
      { type: 'input', label: 'Day 0 is', key: 'weekStartsOn' },
      { type: 'input', label: 'Add-modal param key', key: 'addParamKey' },
      { type: 'input', label: 'Edit-modal param key', key: 'editParamKey' },
      { type: 'input', label: 'Live target pattern', key: 'liveTargetPattern' },
      { type: 'input', label: 'Limit to page ids (optional)', key: 'liveTargetPageIds' },
      { type: 'input', label: 'Tagging source ids', key: 'taggingSourceIds' },
      { type: 'toggle', label: 'Open on published version', key: 'openOnPublishedVersion' },
      { type: 'input', label: 'Live version label (fallback)', key: 'liveVersion' },
    ],
  },

  EditComp: ScheduleGridEdit,
  ViewComp: ScheduleGridView,
};
