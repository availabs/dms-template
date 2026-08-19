import { FilterPillEdit, FilterPillView } from "./filterPill"

// WCDB filter_pill column type — one segment of the admin's segmented
// "default-is-the-design" control (playlist review queue, DJ status, event
// state). The cell VALUE is the segment's count, so the column is normally a
// `count(*) FILTER (…)` calculated column; the label and the page variable it
// writes are per-column config (`pillLabel`, `paramKey`, `paramValue`,
// `activeWhenUnset`).
//
// The page variable must be registered in the PAGE's `filters` array or the
// write is silently dropped — see creating-interactive-pages.md Step 0.
export default {
  EditComp: FilterPillEdit,
  ViewComp: FilterPillView,
  cardHints: {
    // A pill states its own label; a Card header above it would say it twice.
    defaultHideHeader: true,
  },
}
