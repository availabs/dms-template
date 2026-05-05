import { PortraitBannerEdit, PortraitBannerView } from "./portraitBanner"

// WCDB DJ portrait card column type. Registered via theme.columnTypes;
// auto-registered in patterns/page/siteConfig.jsx alongside theme.pageComponents.
//
// The column's value is interpreted as either a numeric hue (0..1) or a
// string that gets hashed to a stable hue. Initials overlay on top of the
// gradient when the value is a string.
//
// cardHints opt the column out of the field chrome so the banner reaches
// the card edges and owns its visual surface.
export default {
    EditComp: PortraitBannerEdit,
    ViewComp: PortraitBannerView,
    cardHints: {
        fullBleed: true,
        spanFullColumns: true,
        height: 200,
        defaultHideHeader: true,
    },
}
