import { NowIndicatorEdit, NowIndicatorView } from "./nowIndicator"

// WCDB now_indicator column type — the "On Air · NOW · HH:MM am/pm"
// editorial eyebrow above a now-playing track. Pure chrome — no data binding
// (`origin: 'static'` on the section); the clock half pulls the viewer's
// local wall-clock time directly, so the indicator stays accurate without
// touching the row.
//
// Same shape as `stream_player`: a normal Card cell that owns one small
// visual element. The Card grid lays it out via the usual `cellSpan` /
// `cellRowSpan` knobs alongside the title / album / album-cover cells.
export default {
    EditComp: NowIndicatorEdit,
    ViewComp: NowIndicatorView,
    cardHints: {
        // Picker ships new instances with the header hidden — there is no
        // header to render here, just the pill + meta. Runtime behaviour is
        // still driven by the column's own `hideHeader` flag.
        defaultHideHeader: true,
    },
}
