import { ShowBlockNavEdit, ShowBlockNavView } from './ShowBlockNav';

// Registry entry for the WCDB ShowBlockNav section, shipped by the THEME via
// `theme.pageComponents` like ScheduleGrid.
//
// WHAT IT IS. A time-block navigator over a recurring weekly schedule. Bound
// (dataWrapper) to the schedule source joined to shows, it works out which
// block the page is looking at — the show on air, or a 2-hour automation
// slice when nothing is scheduled — names it, and steps to the previous /
// next block. The block's edges are PUBLISHED as two page variables
// (`from` / `to`, ISO instants), so any data section on the page filters to
// the block with two ordinary leaves:
//
//   { col: 'received_at', op: 'gte', usePageFilters: true, searchParamKey: 'from' }
//   { col: 'received_at', op: 'lt',  usePageFilters: true, searchParamKey: 'to'   }
//
// The two keys must be REGISTERED on the page (`page.filters`, see
// creating-interactive-pages.md step 0) or the writes are dropped.
//
// WHY A SECTION AND NOT A CARD. A Card renders the rows it is given; this
// has to look at the WHOLE week to find the neighbours of a block and the
// gaps between shows, and it writes page state. No arrangement of cells over
// a row set does that.
export default {
  name: 'Show Block Nav',
  type: 'showBlockNav',
  useDataSource: true,
  useDataWrapper: true,
  useGetDataOnPageChange: true,
  showPagination: false,
  themeKey: 'showBlockNav',

  defaultState: {
    filters: { op: 'AND', groups: [] },
    columns: [],
    data: [],
    externalSource: { columns: [] },
    join: { sources: {} },
    display: {
      // Whole week in one fetch; pageSize is still required (getData derives
      // its range from it — undefined → NaN → the data request never fires).
      pageSize: 500,
      usePagination: false,
      fetchMode: 'smart',

      // Station time and the automation slice length.
      tz: 'America/New_York',
      blockMinutes: 120,

      // Optional inline padding for the strip (see ShowBlockNav.jsx `inset`).
      inset: '',

      // Page variables written (registered on the page by the author).
      fromParamKey: 'from',
      toParamKey: 'to',

      // Which column plays which role. Joined columns resolve by their bare
      // name too (`shows.name` ↔ `name`).
      idField: 'airing_id',
      showIdField: 'show_id',
      dayField: 'day',
      startField: 'start',
      endField: 'end',
      titleField: 'name',
      djField: 'on_air_name',
      departmentField: 'department',

      // Copy.
      showEyebrow: 'Show',
      automationEyebrow: 'Automation',
      automationTitle: 'Automation',
      automationMeta: 'Music on rotation',
      liveLabel: 'On air',
      nowLabel: 'Now',
    },
  },

  controls: {
    more: [
      { type: 'input', label: 'Station timezone', key: 'tz' },
      { type: 'input', inputType: 'number', label: 'Automation block (minutes)', key: 'blockMinutes' },
      { type: 'input', label: 'Inset (CSS padding, e.g. 24px 24px 16px)', key: 'inset' },
      { type: 'input', label: 'From param key', key: 'fromParamKey' },
      { type: 'input', label: 'To param key', key: 'toParamKey' },
      { type: 'input', label: 'Day field', key: 'dayField' },
      { type: 'input', label: 'Start field', key: 'startField' },
      { type: 'input', label: 'End field', key: 'endField' },
      { type: 'input', label: 'Title field', key: 'titleField' },
      { type: 'input', label: 'DJ field', key: 'djField' },
      { type: 'input', label: 'Department field', key: 'departmentField' },
      { type: 'input', label: 'Show eyebrow', key: 'showEyebrow' },
      { type: 'input', label: 'Automation eyebrow', key: 'automationEyebrow' },
      { type: 'input', label: 'Automation title', key: 'automationTitle' },
      { type: 'input', label: 'Automation meta', key: 'automationMeta' },
      { type: 'input', label: 'Live pill label', key: 'liveLabel' },
      { type: 'input', label: 'Now link label', key: 'nowLabel' },
    ],
  },

  EditComp: ShowBlockNavEdit,
  ViewComp: ShowBlockNavView,
};
