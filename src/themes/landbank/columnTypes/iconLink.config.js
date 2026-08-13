import { IconLinkEdit, IconLinkView } from "./iconLink"
import icons from "../icons"
import { iconLinkTheme } from "./iconLink.theme"

// ACLB icon_link column type — registry entry. Registered via theme.columnTypes
// (auto-registered in patterns/page/siteConfig.jsx → registerColumnType, which
// mutates the shared registry the TABLE reads too, so this type is available in a
// Spreadsheet cell as well as a Card cell).
export default {
    EditComp: IconLinkEdit,
    ViewComp: IconLinkView,
    cardHints: {
        // An icon button labels itself with its tooltip; a header above it in a Card
        // would just repeat it. (A table column still shows its own header — that's
        // where the "Actions" label lives.)
        defaultHideHeader: true,
    },
    cardControls: [
        { type: 'select', label: 'Icon', key: 'iconName',
            options: [
                { label: 'None', value: undefined },
                ...Object.keys(icons).sort().map(name => ({ label: name, value: name })),
            ],
        },
        { type: 'input', inputType: 'text', label: 'Tooltip', key: 'iconTitle' },
        // With a label the cell renders as a real button rather than a bare hit
        // target — the design's "Edit record" / "Public listing" link actions.
        { type: 'input', inputType: 'text', label: 'Button Label', key: 'linkText' },
        { type: 'select', label: 'Button Style', key: 'linkVariant',
            displayCdn: ({ attribute }) => !!attribute.linkText,
            options: [
                { label: 'Secondary (default)', value: undefined },
                { label: 'Primary', value: 'primary' },
                { label: 'Ghost', value: 'ghost' },
            ],
        },
        // Includes the query key, e.g. "/admin/property-view?id=" — the row's param
        // is appended to whatever is typed here.
        { type: 'input', inputType: 'text', label: 'Link To (path + "?key=")', key: 'location' },
        { type: 'input', inputType: 'text', label: 'Param Column (blank = row id)', key: 'linkParamColumn' },
        { type: 'select', label: 'Icon Color', key: 'iconColor',
            options: [
                { label: 'Chrome (default)', value: undefined },
                ...Object.keys(iconLinkTheme.buttonColors).map(name => ({ label: name, value: name })),
            ],
        },
        { type: 'toggle', label: 'Open in New Tab', key: 'external' },
    ],
}
