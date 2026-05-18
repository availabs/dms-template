import { StreamPlayerEdit, StreamPlayerView } from "./streamPlayer"

// WCDB stream_player column type — renders the round "Listen live" play
// button. It is a *normal* Card cell (not fullBleed, no auto full-row
// placement), so the section author can park it on the grid via the
// usual `cellSpan` / `cellRowSpan` knobs alongside the data cells.
//
// Earlier revisions of this column type tried to render the entire player
// (album art + title + on-air pill + progress bar + meta strip) inside one
// cell. That conflicts with how the Card section is meant to work — one
// cell per attribute, the grid does the layout. Reverting to "one job per
// column type" lets the cells grid carry real layout meaning.
export default {
    EditComp: StreamPlayerEdit,
    ViewComp: StreamPlayerView,
    cardHints: {
        // No data binding — the picker should ship new instances with the
        // header hidden by default. The renderer itself ignores this flag;
        // the column's own `hideHeader` is what drives runtime behaviour.
        defaultHideHeader: true,
    },
}
