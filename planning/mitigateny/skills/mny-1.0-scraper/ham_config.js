// Hamilton County MNY 1.0 taxonomy (discovered via inspect_hamilton.js).
// JURIS strings are the EXACT dropdown text (note lowercase "lake"/"pleasant") — required for click matching.
module.exports = {
  BASE: 'https://hamilton.mitigateny.org',
  HAZARDS: ["Avalanche","Coastal Hazards","Coldwave","Drought","Earthquake","Flooding","Hail","Heat Wave","Hurricane","Ice Storm","Landslide","Lightning","Snow Storm","Tornado","Tsunami/Seiche","Volcano","Wildfire","Wind"],
  EXTRA_HAZARD_PAGES: ["Other Hazards"], // captured as county pages, not profiled per-jurisdiction
  JURIS: ["Arietta (Town)","Benson (Town)","Hope (Town)","Indian lake (Town)","Inlet (Town)","Lake pleasant (Town)","Long lake (Town)","Morehouse (Town)","Speculator (Village)","Wells (Town)"],
};
