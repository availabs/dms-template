import { StatusDotEdit, StatusDotView } from "./statusDot"

// ACLB status_dot column type — registry entry. Registered via theme.columnTypes
// (auto-registered in patterns/page/siteConfig.jsx), same wiring as parcel_plate.
export default {
    EditComp: StatusDotEdit,
    ViewComp: StatusDotView,
    cardHints: {
        // A legend row labels itself — the column header would just repeat it.
        defaultHideHeader: true,
    },
    // Per-column controls surfaced in the Card section toolbar.
    cardControls: [
        { type: 'select', label: 'Label', key: 'hideLabel',
            options: [
                { label: 'Dot + label', value: undefined },
                { label: 'Dot only', value: true },
            ],
        },
    ],
}
