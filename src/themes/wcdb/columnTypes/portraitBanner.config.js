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
        // Height is owned by the banner component itself (resolved against
        // theme.portraitBanner.bannerHeights via the column's `bannerHeight`
        // prop). Don't set a cardHints.height here — it would clamp the
        // outer cell to a fixed pixel value and the banner inside (which
        // may be taller, e.g. `full` ≈ calc(100vh - 220px), or flex-fill)
        // would either overflow or leave dead space above/below.
        defaultHideHeader: true,
    },
    // Column-type controls injected into the Card section's per-column
    // toolbar (Card.config.jsx flattens these into `inHeader` and auto-scopes
    // them by `attribute.type === 'portrait_banner'` & `isEdit`).
    cardControls: [
        { type: 'select', label: 'Banner Height', key: 'bannerHeight',
            options: [
                { label: 'Default (theme)', value: undefined },
                { label: 'Fill parent', value: 'fill' },
                { label: 'Full (calc 100vh − 220px)', value: 'full' },
                { label: 'Tall (640px)', value: 'tall' },
                { label: 'Medium (400px)', value: 'medium' },
                { label: 'Small (240px)', value: 'small' },
            ],
        },
    ],
}
