import React from "react"
import { ThemeContext, getComponentTheme } from "../../../dms/packages/dms/src/ui/useTheme"
import { provenanceBadgeTheme } from "./provenanceBadge.theme"

// WCDB provenance_badge column type — where a playlist row CAME FROM, which is
// the fact the whole admin playlist design turns on.
//
// Four states, and the look depends on the value, which is exactly the case the
// decision ladder says a small column type is for (a formatFn can only change
// the text):
//
//   Gap        kind = 'no-match'  — the matcher heard something it could not
//              identify. Drawn in the alert colour: it is the row a DJ is here
//              to fix, not an error in the page.
//   nn%        an automatic match, showing ACRCloud's own confidence. Below the
//              review threshold it takes the alert colour and an Alert glyph —
//              "incorrectly added" is DETECTABLE here, not a matter of opinion.
//   By DJ      typed by a human. Never overwritten by the matcher
//              (normalize.js guards on provenance).
//   Corrected  an automatic match a human fixed; the original detection is kept
//              underneath in original_* so the correction is reversible.
//
// Reads three sibling row fields, which a Card cell cannot do on its own:
// `provenance`, `kind` and `score`. Column config: `scoreField`, `kindField`,
// `provenanceField` (all defaulted), and `threshold`.

export const ProvenanceBadgeView = ({
  value,
  row,
  scoreField = "score",
  kindField = "kind",
  provenanceField = "provenance",
  threshold = 60,
  className,
}) => {
  const { theme: themeFromContext = {} } = React.useContext(ThemeContext) || {}
  const t = { ...provenanceBadgeTheme, ...getComponentTheme(themeFromContext, "provenanceBadge") }
  const { UI } = React.useContext(ThemeContext) || {}
  const Icon = UI?.Icon

  const field = (name) => {
    const v = row?.[name]
    return v?.value ?? v
  }
  // The cell's own value is the provenance when the column is bound to it;
  // fall back to the named field so the badge works wherever it is placed.
  const provenance = (value?.value ?? value) ?? field(provenanceField)
  const kind = field(kindField)
  const score = field(scoreField)

  if (kind === "no-match") {
    return (
      <span className={`${t.gap} ${className || ""}`} title="Nothing identified — talk, a live set, or a track the matcher missed">
        Gap
      </span>
    )
  }
  if (provenance === "dj") {
    return <span className={`${t.byDj} ${className || ""}`} title="Added by hand — the matcher never overwrites this row">By DJ</span>
  }
  if (provenance === "corrected") {
    return <span className={`${t.corrected} ${className || ""}`} title="Edited by hand — the original detection is kept underneath">Corrected</span>
  }

  if (score === undefined || score === null || score === "") return null
  const low = Number(score) < Number(threshold)
  return (
    <span className={`${low ? t.scoreLow : t.score} ${className || ""}`} title="ACRCloud match confidence">
      {low && Icon ? <Icon icon="Alert" className={t.scoreIcon} /> : null}
      {`${score}%`}
    </span>
  )
}

// A row's provenance is set by what happened to it (the matcher wrote it, or a
// save through the fix-a-track modal did) — never typed into a cell.
export const ProvenanceBadgeEdit = ProvenanceBadgeView
