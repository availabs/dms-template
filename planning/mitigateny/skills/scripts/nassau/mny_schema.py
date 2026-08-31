"""
Shared schema access + payload validation for the Nassau Phase-7 builders.

Every builder emits rows through `validate()` here, so a value that does not exist in the
live select vocabulary fails at build time rather than silently landing in the database.
Phase 6 taught this the hard way: four parser bugs were silent because nothing asserted.

--------------------------------------------------------------------------------------
STORAGE ENCODINGS -- calibrated, not declared
--------------------------------------------------------------------------------------
The declared column `type` in a source's config disagrees with what is actually stored in
several places. These facts were measured against ~20,000 live rows during the Suffolk load
(2026-08-17, see scripts/suffolk/build_hoc.py) and re-confirmed against the 1,190 seeded
Nassau HOC rows on 2026-08-24. Where the two disagree, the stored form wins -- it is what
the UI reads back.

  HOC       general_vulnerability / other_comments  declared `lexical`, stored PLAIN STRING
  HOC       vulnerability checkboxes                stored "Yes" / "No"
  HOC       hazard                                  stored DISPLAY LABEL ("Ice storm",
                                                    "Flooding"), NOT the declared lowercase
                                                    codes ("icestorm", "riverine")
  HOC       geoid_county                            bare INT;  geoid_juris  list[str]
  HOC       likelihood                              probability band, no source -> never set
  CAPS      checkboxes                              stored "x"  (NOT "Yes" -- differs from HOC)
  CAPS      geoid_juris                             bare STRING (scalar)
  ROLES     geoid_juris                             list[str]   -> the --filter trap applies
  PART      geoid_juris                             bare STRING (scalar)
  ACTIONS   checkboxes                              stored "x" -- and ALSO "1" on some rows;
                                                    two conventions coexist live. "x" chosen to
                                                    match Capabilities.
  ACTIONS   county / county_geoid                   BOTH conventions exist live, in one dataset.
                                                    A 4-row sample (Delaware, Fulton) stores bare
                                                    strings; all 131 existing NASSAU rows store
                                                    ARRAYS -- ["Nassau"], ["36059"]. Arrays chosen:
                                                    they match this county's own rows AND the
                                                    declared multiselect type.
                                                    LESSON: a 4-row sample is not a calibration.
                                                    Acting on it would have silently reformatted
                                                    131 live rows on the first update pass. Sample
                                                    the rows you are actually going to touch.
  ACTIONS   geoid_juris                             bare scalar (declared `select`)

ACTIONS was calibrated on 2026-08-24 against live view 1074456 (18,908 rows), which retires the
earlier note that it could not be. Nassau is still the first county to LOAD it -- Suffolk scoped
it out -- so there is no load precedent, only a read one.

--------------------------------------------------------------------------------------
THE --filter TRAP IS DRIVEN BY THE *DECLARED* TYPE
--------------------------------------------------------------------------------------
Suffolk documented that `--filter` fails on array-valued columns. The sharper statement,
measured on Actions 2026-08-24: the filter is compiled from the column's DECLARED type, and a
filter on anything declared `multiselect` returns 0 rows REGARDLESS of what is stored.

    geoid_juris=36025   -> 80   declared select        works
    action_name=...     ->  1   declared text          works
    county=Delaware     ->  0   declared multiselect   BROKEN -- such rows demonstrably exist
    county_geoid=36025  ->  0   declared multiselect   BROKEN

`county` stores a bare string and still cannot be filtered. So "is the stored value an array?"
is the wrong question -- check the declared type. This cost a wrong conclusion during Phase 7:
`county=Nassau` returned 0 and was briefly read as "Nassau has no existing actions", when in
fact it has 189 across 38 jurisdictions.
"""
import json, io, os

HERE = os.path.dirname(os.path.abspath(__file__))
CTX = os.path.dirname(HERE)
EX = os.path.join(CTX, "extracted")

# dataset key -> (source id, view id, source-instance, live-dump file)
DATASETS = {
    "hoc":           ("1473470", "1473471", "hazards_of_concern",       "live_1473470.json"),
    "capabilities":  ("1068273", "1172519", "capabilities_catalogue",   "live_1068273.json"),
    "roles":         ("1473295", "1473296", "roles",                    "live_roles_raw.json"),
    "participation": ("1473468", "1473469", "participation",            "live_1473468.json"),
    "actions":       ("1029065", None,      "actions_revised",          "live_actions_raw.json"),
    "jurisdictions": ("1346449", None,      "jurisdictions",            None),
}

# How a ticked checkbox is stored, per dataset. Calibrated above; actions is a guess.
CHECKBOX = {
    "hoc": "Yes",
    "capabilities": "x",
    "actions": "x",          # UNCALIBRATED -- see module docstring
    "roles": "x",
    "participation": "x",
}

# geoid_juris shape per dataset: True = bare scalar, False = list[str].
# This also decides whether `--filter geoid_juris=<geoid>` works at all (it does NOT for
# list-valued columns -- the filter compiles to data->>'geoid_juris' and compares against
# the JSON text '["3629113"]'). Getting this wrong silently defeats the duplicate guard.
GEOID_SCALAR = {
    "hoc": False, "capabilities": True, "roles": False,
    "participation": True, "actions": True,
}

# ----------------------------------------------------------------------------------------
# Columns whose DECLARED option list is stale, with the vocabulary that is actually stored.
#
# HOC `hazard` declares 19 lowercase codes (`riverine`, `icestorm`, `other`) but every one
# of the 1,190 seeded Nassau rows -- and the 20,000 rows Suffolk measured -- stores a
# DISPLAY LABEL instead ("Flooding", "Ice storm", "Other"). Validating against the declared
# list would reject every correct value. Validating against nothing would let a typo through,
# so the observed vocabulary is written out here explicitly.
STORED_VOCAB = {
    ("hoc", "hazard"): [
        "Avalanche", "Coastal Hazards", "Drought", "Earthquake", "Extreme Cold",
        "Extreme Heat", "Flooding", "Hail", "Hurricane", "Ice storm", "Landslide",
        "Lightning", "Snowstorm", "Tornado", "Tsunami/Seiche", "Wildfire", "Wind",
        "Other",   # proven: 271 live rows, 10 of them seen during the Suffolk load
    ],
}

_cache = {}


def attrs(ds):
    """Attribute list for a dataset, from its committed live dump."""
    if ds in _cache:
        return _cache[ds]
    _, _, _, f = DATASETS[ds]
    if f is None:
        raise KeyError(f"no live schema dump committed for '{ds}'")
    o = json.load(io.open(os.path.join(EX, f), encoding="utf-8"))
    cur = o.get("data", o)
    cfg = cur.get("config")
    if isinstance(cfg, str):
        cfg = json.loads(cfg)
    _cache[ds] = cfg["attributes"]
    return _cache[ds]


def columns(ds):
    """name -> attribute dict, excluding calculated/SQL pseudo-columns."""
    out = {}
    for c in attrs(ds):
        n = c.get("name") or ""
        # Calculated columns carry raw SQL in `name`; they are not writable.
        if c.get("type") == "calculated" or "(" in n or " as " in n.lower():
            continue
        out[n] = c
    return out


def options(ds, col):
    """Option value list for a select/multiselect, else None."""
    c = columns(ds).get(col)
    if not c:
        return None
    if (ds, col) in STORED_VOCAB:
        return list(STORED_VOCAB[(ds, col)])
    o = c.get("options")
    if not isinstance(o, list):
        return None
    return [str(x.get("value", x) if isinstance(x, dict) else x) for x in o]


def validate(ds, data, where="", allow=()):
    """
    Check one row's data dict against the live schema.

    Returns a list of human-readable problems. Empty list means clean. Deliberately
    returns rather than raises so a builder can report every bad row in one pass instead
    of dying on the first.
    """
    cols = columns(ds)
    errs = []
    for k, v in data.items():
        if k in allow:
            continue
        if k not in cols:
            errs.append(f"{where}: unknown column '{k}'")
            continue
        t = cols[k].get("type")
        opts = options(ds, k)
        if v in (None, "", [], {}):
            continue
        if t == "select" and opts:
            if str(v) not in opts:
                errs.append(f"{where}: {k}={v!r} not in the live vocabulary")
        elif t == "multiselect" and opts:
            for x in (v if isinstance(v, list) else [v]):
                if str(x) not in opts:
                    errs.append(f"{where}: {k} value {x!r} not in the live vocabulary")
        elif t == "checkbox":
            want = CHECKBOX[ds]
            if str(v) not in (want, "No", ""):
                errs.append(f"{where}: {k}={v!r} is not the {ds} checkbox encoding {want!r}")
    return errs


def require(ds, data, where=""):
    """Problems for required columns left empty. Separate from validate() because a
    review surface is allowed to be incomplete; a load payload is not."""
    out = []
    for n, c in columns(ds).items():
        if c.get("required") and data.get(n) in (None, "", [], {}):
            out.append(f"{where}: required column '{n}' is empty")
    return out


if __name__ == "__main__":
    print(f"{'dataset':14s} {'source':9s} {'cols':>5s}  {'selects':>7s}  checkbox  geoid")
    for ds in DATASETS:
        try:
            c = columns(ds)
        except KeyError as e:
            print(f"{ds:14s} {DATASETS[ds][0]:9s}     --  (no live dump committed)")
            continue
        nsel = sum(1 for k in c if c[k].get("type") in ("select", "multiselect"))
        g = "scalar" if GEOID_SCALAR.get(ds) else "list"
        print(f"{ds:14s} {DATASETS[ds][0]:9s} {len(c):5d}  {nsel:7d}  "
              f"{CHECKBOX.get(ds,'?'):8s}  {g}")
