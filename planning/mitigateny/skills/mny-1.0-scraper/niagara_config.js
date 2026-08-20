// Niagara County MNY 1.0 taxonomy (discovered via inspect_niagara.js 2026-07-24).
// JURIS strings are the EXACT dropdown text (note the quirky "city ( City)" token with a leading space
// and lowercase "city") — required for click matching. "County subdivisions not defined (Town)" is a
// Census artifact and is intentionally excluded.
module.exports = {
  COUNTY: 'Niagara',
  FIPS: '36063',
  SITE: 'https://niagara.mitigateny.org/',
  SLUG: 'niagara',                 // output filename prefix -> niagara-lhmp-v1.md etc.
  BASE: 'https://niagara.mitigateny.org',
  HAZARDS: ["Avalanche","Coastal Hazards","Coldwave","Drought","Earthquake","Flooding","Hail","Heat Wave","Hurricane","Ice Storm","Landslide","Lightning","Snow Storm","Tornado","Tsunami/Seiche","Volcano","Wildfire","Wind"],
  EXTRA_HAZARD_PAGES: ["Other Hazards"],
  JURIS: [
    "Barker (Village)",
    "Cambria (Town)",
    "Gasport (Village)",
    "Hartland (Town)",
    "Lewiston (Town)",
    "Lewiston (Village)",
    "Lockport (Town)",
    "Lockport city ( City)",
    "Middleport (Village)",
    "Newfane (Town)",
    "Newfane (Village)",
    "Niagara (Town)",
    "Niagara Falls city ( City)",
    "North Tonawanda city ( City)",
    "Pendleton (Town)",
    "Porter (Town)",
    "Ransomville (Village)",
    "Rapids (Village)",
    "Royalton (Town)",
    "Sanborn (Village)",
    "Somerset (Town)",
    "South Lockport (Village)",
    "Tonawanda Reservation (Town)",
    "Tuscarora Nation Reservation (Town)",
    "Wheatfield (Town)",
    "Wilson (Town)",
    "Wilson (Village)",
    "Youngstown (Village)",
  ],
};
