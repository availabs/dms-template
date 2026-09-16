# -*- coding: utf-8 -*-
"""Group the flat block list into the base plan's heading structure.

    python section_map.py <outdir>          (default: the Nassau baseplan out/)

Reads  <outdir>/blocks.json   ->  writes  <outdir>/sections.json  +  sections.md

A "section" is a heading plus everything under it until the next heading of any level.
Sections are what the crosswalk addresses: a slot is filled from one or more sections, cited
by block number, so the numbering must stay the one blocks.json/runs.json already use.

DIFFERENCES FROM THE WESTCHESTER ORIGINAL
  * no TOC region to skip. Westchester's dump began with a table of contents and hardcoded a
    start at block 562; the Hagerty dump opens directly on the Executive Summary at block 1.
    Hardcoding a start here would silently discard the first chapter.
  * `Style 2 Executive Summary` is a real heading in this document -- four of them, carrying
    the Executive Summary's own subsections. Treated as level 2 beneath the `TOC Heading`
    block that titles the chapter. Ignoring it would bury four sections in the preamble.
  * `SectionTitle` (the Bibliography) is level 1.
"""
import json, io, os, re, sys, collections

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "../../../../../../references/mny-transcribe/Nassau/context/baseplan/out")
OUT = os.path.abspath(OUT)

LEVEL = {"TOC Heading": 1, "SectionTitle": 1, "Style 2 Executive Summary": 2}


def level_of(b):
    s = b.get("style") or ""
    if s in LEVEL:
        return LEVEL[s]
    m = re.match(r"Heading (\d)", s)
    return int(m.group(1)) if m else None


def main():
    blocks = json.load(io.open(os.path.join(OUT, "blocks.json"), encoding="utf-8"))
    secs, cur = [], None
    orphan = []
    for b in blocks:
        lv = level_of(b) if b["kind"] == "p" else None
        if lv:
            cur = dict(n=b["n"], lvl=lv, style=b["style"], title=(b["text"] or "").strip(),
                       paras=[], tables=0, chars=0, captions=[])
            secs.append(cur)
            continue
        if cur is None:
            orphan.append(b["n"])
            continue
        if b["kind"] == "table":
            cur["tables"] += 1
        elif b.get("style") == "Caption":
            cur["captions"].append((b["text"] or "").strip())
        else:
            t = (b.get("text") or "").strip()
            if t:
                cur["paras"].append(dict(n=b["n"], style=b.get("style"), text=t))
                cur["chars"] += len(t)

    json.dump(secs, io.open(os.path.join(OUT, "sections.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    # a readable spine, for choosing crosswalk sources by eye
    lines = ["# Nassau base plan — section map", ""]
    for s in secs:
        ind = "  " * (s["lvl"] - 1)
        lines.append(f"{ind}- **[{s['n']}]** H{s['lvl']} {s['title']}  "
                     f"— {len(s['paras'])}p / {s['chars']}ch"
                     + (f" / {s['tables']}tbl" if s["tables"] else "")
                     + (f" / {len(s['captions'])}cap" if s["captions"] else ""))
    io.open(os.path.join(OUT, "sections.md"), "w", encoding="utf-8",
            newline="\n").write("\n".join(lines) + "\n")

    bylvl = collections.Counter(s["lvl"] for s in secs)
    print(f"sections: {len(secs)}   " +
          "  ".join(f"H{k}={v}" for k, v in sorted(bylvl.items())))
    print(f"prose chars in sections: {sum(s['chars'] for s in secs):,}")
    print(f"tables: {sum(s['tables'] for s in secs)}   "
          f"captions: {sum(len(s['captions']) for s in secs)}")
    if orphan:
        print(f"WARNING: {len(orphan)} block(s) before the first heading, not in any section: "
              f"{orphan[:10]}")
    print(f"-> sections.json + sections.md in {OUT}")


if __name__ == "__main__":
    main()
