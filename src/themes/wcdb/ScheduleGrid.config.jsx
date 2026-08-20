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

      // Version bar. `liveVersion` is what the public site currently shows;
      // `liveTargetSectionId` is the public section a publish would repoint.
      // Until that is set the publish confirmation still states the outgoing
      // version, the incoming one and its row count, and refuses an empty
      // version — it just says it has nowhere to point.
      liveVersion: '',
      liveRowCount: null,
      liveTargetSectionId: '',
    },
  },

  controls: {
    more: [
      { type: 'input', label: 'Grid title', key: 'gridTitle' },
      { type: 'input', label: 'Day 0 is', key: 'weekStartsOn' },
      { type: 'input', label: 'Add-modal param key', key: 'addParamKey' },
      { type: 'input', label: 'Edit-modal param key', key: 'editParamKey' },
      { type: 'input', label: 'Live version label', key: 'liveVersion' },
      { type: 'input', label: 'Live target section id', key: 'liveTargetSectionId' },
    ],
  },

  EditComp: ScheduleGridEdit,
  ViewComp: ScheduleGridView,
};
