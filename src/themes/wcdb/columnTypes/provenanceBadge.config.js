import { ProvenanceBadgeEdit, ProvenanceBadgeView } from "./provenanceBadge"

// WCDB provenance_badge column type — the playlist log's per-row "where did
// this come from" chip: an ACRCloud confidence score, a Gap, `By DJ`, or
// `Corrected`. The look depends on the value (and on two sibling fields), which
// is the case a small column type exists for.
//
// Bind it to the `provenance` column and give the section `kind`, `score` and
// `provenance` (the last two `selectOnly` if they render nowhere else) so the
// fields the badge reads off `row` are actually fetched.
export default {
  EditComp: ProvenanceBadgeEdit,
  ViewComp: ProvenanceBadgeView,
  cardHints: {
    defaultHideHeader: true,
  },
}
