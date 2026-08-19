import { RowActionEdit, RowActionView } from "./rowAction"

// WCDB row_action column type — the end-of-row affordance (`Edit`, `+ Add`).
// Bind it to the row's PRIMARY KEY: the cell's value is what a `click_publish`
// provider publishes (which is how the edit modal knows which row it is), while
// the label it renders comes from `actionLabel` / `actionIcon` / `actionStyle`.
export default {
  EditComp: RowActionEdit,
  ViewComp: RowActionView,
  cardHints: { defaultHideHeader: true },
}
