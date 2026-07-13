import { ParcelPlateEdit, ParcelPlateView } from "./parcelPlate"

// ACLB parcel_plate column type — registry entry. Registered via
// theme.columnTypes (auto-registered in patterns/page/siteConfig.jsx).
//
// cardHints opt the plate out of the field chrome so the hatched survey
// surface bleeds to the card edges and defaults to the full card width —
// the same shape as wcdb's portrait_banner.
export default {
    EditComp: ParcelPlateEdit,
    ViewComp: ParcelPlateView,
    cardHints: {
        fullBleed: true,
        spanFullColumns: true,
        defaultHideHeader: true,
    },
    // Per-column controls surfaced in the Card section toolbar.
    cardControls: [
        { type: 'input', label: 'Length Column', key: 'lengthColumn',
            placeHolder: 'parcel_length_ft' },
        { type: 'input', label: 'Status Column (hatch variant)', key: 'statusColumn',
            placeHolder: 'property_status' },
        { type: 'select', label: 'Plate Height', key: 'plateHeight',
            options: [
                { label: 'Default (h-36)', value: undefined },
                { label: 'Tall (h-52)', value: 'tall' },
                { label: 'Short (h-28)', value: 'short' },
            ],
        },
        { type: 'select', label: 'Corner Tag', key: 'showCornerTag',
            options: [
                { label: 'Hidden', value: undefined },
                { label: '"Parcel survey"', value: true },
            ],
        },
    ],
}
