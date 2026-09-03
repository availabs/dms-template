export const createReportButtonTheme = {
  // Right-aligned inside its section (Alex, 2026-09-02): the button is a header ACTION and the
  // design clusters actions at the row's right edge — on the Reports page it sits beside "New
  // route" with the mockup's 8px gap, on 2208581 it closes up against the search trigger. `flex
  // w-full` (not `inline-flex`) so the wrapper spans the section and `items-end` has room to
  // work; the error line, when it renders, right-aligns under the button the same way.
  wrapper: 'flex w-full flex-col items-end gap-1',
  icon: 'w-4 h-4',
  label: '',
  error: 'text-xs text-red-500 mt-1',
};
