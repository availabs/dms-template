import { IconTextEdit, IconTextView } from "./iconText"
import icons from "../icons"
import { iconTextTheme } from "./iconText.theme"

// ACLB icon_text column type — registry entry. Registered via theme.columnTypes
// (auto-registered in patterns/page/siteConfig.jsx), same wiring as status_dot.
export default {
    EditComp: IconTextEdit,
    ViewComp: IconTextView,
    cardHints: {
        // The sentence IS the label; a column header above it would just repeat it.
        defaultHideHeader: true,
    },
    // Per-column controls surfaced in the Card section toolbar. Options are built
    // from the registries themselves so a new glyph or hue shows up in the picker
    // the moment it lands in icons.jsx / iconText.theme.js.
    cardControls: [
        { type: 'select', label: 'Icon', key: 'iconName',
            options: [
                { label: 'None', value: undefined },
                ...Object.keys(icons).sort().map(name => ({ label: name, value: name })),
            ],
        },
        { type: 'select', label: 'Icon Color', key: 'iconColor',
            options: [
                { label: 'Inherit text color', value: undefined },
                ...Object.keys(iconTextTheme.iconColors).map(name => ({ label: name, value: name })),
            ],
        },
        { type: 'select', label: 'Icon Size', key: 'iconSize',
            options: [
                { label: 'Small (default)', value: undefined },
                ...Object.keys(iconTextTheme.iconSizes).map(name => ({ label: name, value: name })),
            ],
        },
    ],
}
