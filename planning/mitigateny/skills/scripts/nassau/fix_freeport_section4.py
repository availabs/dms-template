"""
Repair Freeport's section-4 capability descriptions.

THE BUG. `extract_independent_plan.py` located each section-4 heading with a plain
`text.find(heading)`. In a 177-page PDF the FIRST occurrence of every heading is its
TABLE OF CONTENTS line, not the section itself -- so all 20 capabilities were captured as
bare headings with an empty description, and the dot-leader TOC text was what got matched.
Same class as the four silent Phase-6 parser bugs: the extractor succeeded, the output was
just empty.

  4.1 EMERGENCY WARNING SYSTEM   TOC hit  @ 13,624    body @ 256,947

Fix: find the occurrence that is NOT followed by dot leaders, and take the text up to the
next `4.N` heading as the body.

WHY IT MATTERED BEYOND COMPLETENESS. Section 4's own preamble calls these "a summary of
accomplishments", and every body describes something the Village DID -- grades elevated,
check valves installed, 4,500 linear feet of utilities buried for $1,188,000, window film
fitted. Several TITLES read like problem statements ("FLOODING ON ROADS", "IMPACT OF
FLOODING ON RESIDENTIAL AND COMMERCIAL PROPERTIES", "REDUCE WIND DAMAGES"), so the open
"which of the 20 are capabilities and which are problem statements?" question would have
been answered WRONG from the titles alone. With the bodies present, all 20 are
capabilities. The triage question is settled by evidence.

Usage: python fix_freeport_section4.py [--dry]
"""
import json, io, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
CTX = os.path.dirname(HERE)
EX = os.path.join(CTX, "extracted")
GEOID = "3627485"
DRY = "--dry" in sys.argv

txt = io.open(os.path.join(EX, "freeport_pdf.txt"), encoding="utf-8").read()

# Locate the body occurrence of "4.1 <TITLE>": the one not trailed by dot leaders.
starts = [m.start() for m in re.finditer(r"4\.1\s+EMERGENCY WARNING SYSTEM", txt)]
body_start = next(i for i in starts if "...." not in txt[i:i + 120])
# Section 5 (or the appendix) ends it; bound generously and let the split do the work.
seg = txt[body_start:body_start + 30000]

# Split on each "4.N TITLE" heading.
chunks = re.split(r"(?=\n?4\.\d+\s+[A-Z])", seg)
sections = {}
order = []
for c in chunks:
    m = re.match(r"\s*4\.(\d+)\s+(.+?)\n(.*)", c, re.S)
    if not m:
        continue
    num, title, body = m.group(1), m.group(2), m.group(3)
    title = re.sub(r"\s+", " ", title).strip()
    # Stop if we have run past section 4 into section 5. The chapter heading is
    # "5 MITIGATION STRATEGY" -- a bare number with NO decimal, so a `5\.\d+` pattern
    # misses it entirely and 4.20 silently swallowed ~9,000 chars of the next chapter
    # (development analysis, 2014-plan changes). Caught only because 4.20 came out
    # 5x longer than any sibling: LENGTH IS THE TELL for a missed section boundary.
    body = re.split(r"\n\s*5(?:\.\d+)?\s+[A-Z]", body)[0]
    body = re.sub(r"\s*\n\s*", " ", body)
    body = re.sub(r"\s{2,}", " ", body).strip()
    # Drop page furniture: running footers and bare page numbers.
    body = re.sub(r"\s*Village of Freeport[^.]{0,80}?(Plan|Update)\s*", " ", body)
    body = re.sub(r"\s+\d{1,3}\s*$", "", body).strip()
    if title in sections:
        continue
    sections[title] = body
    order.append((int(num), title))

print(f"parsed {len(sections)} section-4 bodies from the PDF body text")
for n, t in sorted(order):
    print(f"  4.{n:<3d} {t[:56]:58s} {len(sections[t]):5d} chars")

# ----------------------------------------------------------------- patch the record
P = os.path.join(EX, "annexes", GEOID + ".json")
R = json.load(io.open(P, encoding="utf-8"))
targets = [c for c in R["capabilities"]
           if c["source_table"] == "Summary of Existing Capabilities"]
print(f"\n{len(targets)} capability rows to repair")


def norm(s):
    return re.sub(r"[^A-Z0-9]", "", (s or "").upper())


bytitle = {norm(t): b for t, b in sections.items()}
filled, misses = 0, []
for c in targets:
    b = bytitle.get(norm(c["capability_name"]))
    if not b:
        misses.append(c["capability_name"])
        continue
    if not DRY:
        c["description"] = b
    filled += 1

print(f"matched {filled}/{len(targets)}")
for m in misses:
    print("  UNMATCHED:", m)

# Assertions -- the point of the exercise is that nothing stays empty and nothing is invented.
assert not misses, f"{len(misses)} heading(s) had no body; refusing to write a partial fix"
assert filled == len(targets) == 20, f"expected 20, filled {filled}"
if not DRY:
    for c in targets:
        assert c["description"].strip(), c["capability_name"]
    # Idempotent: this script is safe to re-run (and was, to correct the 4.20 boundary),
    # so the note must not accumulate one copy per run.
    NOTE = ("section-4 capability descriptions repaired 2026-08-24: the original extraction "
            "matched each heading's TABLE OF CONTENTS line instead of its body, leaving all "
            "20 descriptions empty (see scripts/fix_freeport_section4.py)")
    w = R.setdefault("warnings", [])
    if NOTE not in w:
        w.append(NOTE)
    json.dump(R, io.open(P, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"\nwrote {P}")
else:
    print("\n--dry: nothing written")
