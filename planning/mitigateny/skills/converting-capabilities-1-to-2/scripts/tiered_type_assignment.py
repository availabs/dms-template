"""
Reusable "tier score + keyword boost + guardrail" engine for collapsing a set of possible
type/category values (whether they come from direct boolean flag columns, or have to be inferred
from free text) into ordered Primary/Secondary/Tertiary output fields.

This is a generalization of a client-supplied scoring methodology originally written for one field
(an "Action Type" classification) and adapted here for a different field ("Capability Type") with a
different item list. Re-parameterize TIER / KEYWORDS / guardrail sets for whatever taxonomy you're
actually assigning -- don't assume the original field's tiers or keywords transfer as-is.

Core idea per row:
1. Build a "selected" dict of {type_name: strength}, where strength is 'strong' (confirmed via a
   direct boolean flag, or a keyword hit in strong/narrative text) or 'moderate' (a weaker signal,
   e.g. a keyword hit only in a short-form name field) or 'fallback' (no real signal at all; used a
   coarse mapping from some other existing category field as a last resort).
2. Score each selected type: final_score = tier_score + boost, where boost is -2 (strong), -1
   (moderate), or 0 (fallback). Lower score = higher priority.
3. Sort ascending by score, tie-break by canonical list order.
4. Apply guardrails (structural dominance, ceilings, "always last" items, etc.) to adjust the
   ordering if needed.
5. Emit primary/secondary/tertiary from the first three entries.

Always log the strength/fallback reasoning per row (see `note` in the return value) -- the fallback
rate is itself a useful signal to report back to the user about how well the taxonomy fits the data.
"""

def clean(s):
    return (s or '').strip()


def build_selected_from_keywords(keywords_by_type, strong_text, weak_text):
    """
    Generic keyword-based type detection when no direct boolean flags exist for a type.
    strong_text: narrative/description-style text -- a hit here is a confident ('strong') match.
    weak_text: a short-form name/title field -- a hit here only, is a weaker ('moderate') match.
    keywords_by_type: {type_name: [keyword, keyword, ...]}
    Returns {type_name: 'strong'|'moderate'} for every type with at least one hit.
    """
    strong_text = (strong_text or '').lower()
    weak_text = (weak_text or '').lower()
    result = {}
    for t, kws in keywords_by_type.items():
        if any(kw in strong_text for kw in kws):
            result[t] = 'strong'
        elif any(kw in weak_text for kw in kws):
            result[t] = 'moderate'
    return result


def assign_primary_secondary_tertiary(
    matches,
    tier_by_type,
    types_order,
    tier1_types=frozenset(),
    tier1_3_types=frozenset(),
    planning_ceiling_types=frozenset(),
    outreach_lock_types=frozenset(),
    always_last_type=None,
    policy_ceiling_type=None,
):
    """
    matches: {type_name: 'strong'|'moderate'|'fallback'} -- the selected set for this row, already
             built (via booleans, keywords, or a fallback mapping -- see module docstring).
    tier_by_type: {type_name: int} structural tier score, lower = higher priority.
    types_order: canonical list of ALL possible type names, used only for tie-breaking.
    tier1_types: types that should dominate if present at all (Guardrail: Structural Dominance).
    tier1_3_types: broader "physical/high-tier" set used by the planning/policy ceiling guardrails.
    planning_ceiling_types: types that cannot be Primary if any tier1_3 type is present.
    outreach_lock_types: types that cannot be Primary unless they are the ONLY selected types.
    always_last_type: a single type (e.g. a generic "Other") that must always sort last if present.
    policy_ceiling_type: a single type that can only be Primary if its own match strength is
                          'strong' AND no tier1_3 type is present.

    Returns (primary, secondary, tertiary, note) where note is 'fallback' if any selected type came
    from a fallback strength, else 'matched'. Returns ('', '', '', 'no_match') if matches is empty.
    """
    if not matches:
        return '', '', '', 'no_match'

    scored = []
    for t, strength in matches.items():
        tier = tier_by_type[t]
        boost = -2 if strength == 'strong' else (-1 if strength == 'moderate' else 0)
        scored.append([t, tier + boost, tier, strength])
    scored.sort(key=lambda x: (x[1], types_order.index(x[0])))
    selected = [s[0] for s in scored]

    # Guardrail: structural/tier-1 dominance
    tier1_present = [s for s in scored if s[0] in tier1_types]
    if tier1_present:
        best = min(tier1_present, key=lambda x: x[1])
        if selected[0] not in tier1_types:
            selected.remove(best[0])
            selected.insert(0, best[0])

    tier1_3_present = any(s[0] in tier1_3_types for s in scored)

    # Guardrail: planning/ceiling types cannot be Primary if a higher-tier physical type exists
    if tier1_3_present and selected[0] in planning_ceiling_types:
        for i in range(1, len(selected)):
            if selected[i] not in planning_ceiling_types:
                selected[0], selected[i] = selected[i], selected[0]
                break

    # Guardrail: a policy/codes-style type needs a strong match to beat physical tiers
    if policy_ceiling_type and tier1_3_present and selected[0] == policy_ceiling_type:
        if matches.get(policy_ceiling_type) != 'strong':
            for i in range(1, len(selected)):
                if selected[i] != policy_ceiling_type:
                    selected[0], selected[i] = selected[i], selected[0]
                    break

    # Guardrail: outreach/education-style types can't be Primary unless they're the only ones
    if selected[0] in outreach_lock_types and not all(t in outreach_lock_types for t in selected):
        for i in range(1, len(selected)):
            if selected[i] not in outreach_lock_types:
                selected[0], selected[i] = selected[i], selected[0]
                break

    # Guardrail: a designated catch-all type always sorts last
    if always_last_type and always_last_type in selected and selected[-1] != always_last_type:
        selected.remove(always_last_type)
        selected.append(always_last_type)

    primary = selected[0] if selected else ''
    secondary = selected[1] if len(selected) > 1 else ''
    tertiary = selected[2] if len(selected) > 2 else ''
    note = 'fallback' if any(s == 'fallback' for s in matches.values()) else 'matched'
    return primary, secondary, tertiary, note


# --- Example wiring for a taxonomy like the real "Capability Type" run -------------------------
# (Replace with your own tiers/keywords/guardrail sets -- this is illustrative, not canonical.)
EXAMPLE_TYPES_ORDER = [
    'Planning', 'Codes/Ordinance', 'Establishing Long-Term Programs', 'Studies/Risk Assessment',
    'Project Scoping', 'Dam Rehabilitation/Removal', 'Large Flood Control', 'Community Infrastructure',
    'Acquisition/Elevation/Relocation', 'Floodproofing', 'Power', 'Coastal Protection',
    'Wetlands/Floodplains', 'Other Nature-Based Solutions', 'Education/Outreach', 'Preparedness & Response',
]
EXAMPLE_TIER = {
    'Dam Rehabilitation/Removal': 1, 'Large Flood Control': 1, 'Community Infrastructure': 1,
    'Coastal Protection': 1, 'Acquisition/Elevation/Relocation': 2, 'Floodproofing': 2,
    'Wetlands/Floodplains': 3, 'Power': 4, 'Codes/Ordinance': 5,
    'Planning': 6, 'Studies/Risk Assessment': 6, 'Project Scoping': 6, 'Establishing Long-Term Programs': 6,
    'Education/Outreach': 7, 'Preparedness & Response': 7, 'Other Nature-Based Solutions': 8,
}
EXAMPLE_TIER1 = {'Dam Rehabilitation/Removal', 'Large Flood Control', 'Community Infrastructure', 'Coastal Protection'}
EXAMPLE_TIER1_3 = EXAMPLE_TIER1 | {'Acquisition/Elevation/Relocation', 'Floodproofing', 'Wetlands/Floodplains'}
EXAMPLE_PLANNING_SET = {'Planning', 'Studies/Risk Assessment', 'Project Scoping', 'Establishing Long-Term Programs'}
EXAMPLE_OUTREACH_SET = {'Education/Outreach', 'Preparedness & Response'}
