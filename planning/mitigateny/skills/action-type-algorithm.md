# Inferring Action Type — the tier-and-guardrail algorithm

**Status:** owner-specified, 2026-08-21. Authoritative.
**Companion:** [`action-type-tiers.csv`](./action-type-tiers.csv) — the same tiers reconciled against
the live 17-option `primary_/secondary_/tertiary_action_type` vocabulary, with substitutions.

> **Why this file exists.** The algorithm was specified in conversation and, for a while, lived
> *nowhere else*. A context summary preserved only the guardrail **names** — "5.1 Structural
> Dominance, 5.2 Max Jump Limit…" — which is not enough to implement from. It was recovered from the
> session transcript on 2026-08-24 and written down here. **Any rule an owner gives verbally belongs
> in a file the same day.**

Action types are **inferred from the action's Name and Description**. Detection produces a *set* of
applicable types; this algorithm ranks that set and picks the top three.

## 1. Assign base tier scores

Lower is stronger.

| Tier | Score | Action types |
|---|---|---|
| 1 | 1 | Dam Rehabilitation/Removal · Other Large Flood Control (Levees, Floodwalls; Safe Rooms) · Community Infrastructure (Drainage, Underground Utilities) · Coastal Protection |
| 2 | 2 | Acquisition, Elevation or Relocation · Floodproofing, other |
| 3 | 3 | Wetlands/Floodplains |
| 4 | 4 | Power (Microgrids, Emergency Power for Critical Facilities) |
| 5 | 5 | Codes/ Ordinance/ Zoning/ Policy/ Law/ Governance |
| 6 | 6 | Planning · Studies and/or Risk Assessment · Project Scoping · Establishing Long-Term Programs |
| 7 | 7 | Education, Awareness, Outreach · Preparedness & Response |
| 8 | 8 | Other |

## 2. Apply guardrails

- **5.1 Structural Dominance** — if any Tier 1 type is present, Primary MUST come from Tier 1.
  Exception: another Tier 1 with a better (lower) score.
- **5.2 Max Jump Limit** — no type may move up more than 2 positions relative to its tier.
- **5.3 Planning Ceiling** — if any Tier 1–3 type is present, Planning / Studies / Scoping /
  Programs CANNOT be Primary.
- **5.4 Policy Ceiling** — if any Tier 1–3 type is present, Codes/Policy cannot be Primary
  unless it has Boost = −2 **and** no Tier 1 exists.
- **5.5 Outreach Lock** — Education and Preparedness can NEVER be Primary unless they are the
  ONLY selected types.
- **5.6 Other is Last** — `Other` is always lowest priority.

## 3. Final sorting

Sort by final score ascending, apply the guardrails, then break ties by:
1. more specific over more general
2. more permanent over more temporary
3. original column order

## 4. Assign outputs

Primary = highest ranked · Secondary = second · Tertiary = third (each only if it exists).

## Implementation notes

**Two guardrails are inert, deliberately.** 5.2 and 5.4 both reference a *Boost* score-adjustment
step the specification never defines. Implemented as `final score = tier score`, which makes 5.2
unreachable and collapses 5.4 into the same shape as 5.3. Conservative and deterministic — and
flagged rather than silently patched, because inventing a boost rule would activate two dormant
guardrails at once.

**Set BOTH vocabularies.** The live Actions source carries 16 boolean `action_type_*` columns *and*
three P/S/T selects. The tiered names are the **booleans**. Write the booleans for truth and the
three selects for the ranked top three.

**Two Tier-1 types have no P/S/T option** and need a substitution — always setting the true boolean
alongside, so nothing is lost:

| Ranked type | Written to P/S/T as | Boolean also set |
|---|---|---|
| Coastal Protection | `Infrastructure Projects` | `coastal_protection` |
| Dam Rehabilitation/Removal | `Large Flood Control - Dams, Levees, Floodwalls; Safe Rooms` | `dam_rehabilitation_removal` |

**Three P/S/T options had no tier** and were assigned one: `Infrastructure Projects` → Tier 1 ranked
last (structural, so the guardrails fire, but it loses to any more specific Tier-1 type);
`Risk/Vulnerability Assessment` → Tier 6 after `Studies and/or Risk Assessment`;
`Prevention/Mitigation Projects` → Tier 8 but ahead of `Other`, so 5.6 still holds.
