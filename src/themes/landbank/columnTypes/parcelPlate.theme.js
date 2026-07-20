// Parcel plate — theme tokens for the lot-geometry survey thumbnail.
// The hatched surfaces (.lb-plate, .lb-lot, .lb-lot-sky, .lb-lot-slate) ship
// in the landbank theme's CSS additions (theme.js LANDBANK_CSS) — this file
// only maps roles onto those classes plus the label/empty typography.
export const parcelPlateTheme = {
  // The plate surface. Height comes from `heights[plateHeight || 'default']`.
  plate: 'lb-plate relative w-full flex items-center justify-center overflow-hidden',
  heights: {
    default: 'h-36',   // fresh-listing / featured record cards (design h-36/h-40)
    tall: 'h-52',      // hero record card (design h-52)
    short: 'h-28',
  },
  // The lot rectangle. Variant selects the hatch color; the status→variant
  // map keys raw row values (e.g. property_status) onto variants.
  lots: {
    default: 'lb-lot',
    rehab: 'lb-lot-sky',
    muted: 'lb-lot-slate',
  },
  lotVariantByValue: {
    'ACLB Project': 'rehab',
    'Sold': 'muted',
  },
  // Dimension labels (22′ / 105′) — metaXS mono without the uppercase axis.
  dimLabel: "font-meta text-[9.5px] font-medium text-[#475A66] absolute pointer-events-none",
  // Corner tag ("PARCEL SURVEY") and the no-dimensions fallback.
  cornerTag: "font-meta text-[9.5px] font-medium uppercase tracking-[0.14em] text-[#8CA0AB] bg-white/80 px-2 py-1 rounded absolute top-3 right-3",
  emptyLabel: "font-meta text-[9.5px] font-medium uppercase tracking-[0.14em] text-[#8CA0AB]",
};
