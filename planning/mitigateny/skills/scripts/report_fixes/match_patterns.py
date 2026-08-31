#!/usr/bin/env python
"""Match every row of a report tab from a SOURCE pattern into TARGET patterns.

The county drafts are duplicates of `county_template`, so a fix applied to the
template has a counterpart in each duplicate — but the counterpart's section id
is different, and nothing in the report knows about it. This builds that mapping.

Three tiers, strongest first. Each row records which tier matched it, so a
reviewer can see how much to trust it:

  A  trackingId identical
     Duplication preserves `trackingId` for most sections, and it works even for
     rows whose source section has since been dereferenced (the row still exists,
     it just is not on the page any more).

  B  neighbour alignment
     Duplication mints a FRESH trackingId for some components. Align the two
     pages' section arrays on the ids that DID match by trackingId, then accept
     the single candidate sitting in the corresponding gap, and only if its
     element type matches.

  C  page structure identical
     Some pages come out of duplication with every trackingId reset, leaving B no
     anchors. If both pages have the same section count AND the same element-type
     sequence, match by index.

usage:
  python match_patterns.py --tab tab.csv --source scan_<src>.json \
      --target <patternId>=scan_<id>.json [--target ...] --out dup_rows.json
"""
import argparse
import collections
import csv
import json


def load_args():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tab', required=True, help='CSV export of the report tab (source pattern rows)')
    ap.add_argument('--source', required=True, help='scan_pattern.mjs output for the source pattern')
    ap.add_argument('--target', action='append', required=True, metavar='patternId=scan.json')
    ap.add_argument('--trk', help='optional {sectionId: {trk: ...}} map, for rows whose section '
                                  'is no longer on its page (see trk_for_tab in the skill)')
    ap.add_argument('--id-column', default='Draft section ID')
    ap.add_argument('--page-column', default='Page')
    ap.add_argument('--out', required=True)
    return ap.parse_args()


def align(src_page, tgt_page):
    """source index -> target section, anchored only on unambiguous trackingId agreement."""
    if not src_page or not tgt_page:
        return {}
    by_trk = collections.defaultdict(list)
    for s in tgt_page['sections']:
        if s['trk']:
            by_trk[s['trk']].append(s)
    out = {}
    for s in src_page['sections']:
        hits = by_trk.get(s['trk'], [])
        if len(hits) == 1:
            out[s['i']] = hits[0]
    return out


def main():
    a = load_args()
    rows = list(csv.DictReader(open(a.tab, encoding='utf-8-sig')))
    src = json.load(open(a.source))
    targets = {}
    for t in a.target:
        pid, f = t.split('=', 1)
        targets[pid] = json.load(open(f))
    trk_map = json.load(open(a.trk)) if a.trk else {}

    # trackingId of each source row: from the scan if the section is still on its
    # page, else from the supplied map (a dereferenced section still has a row).
    src_trk, src_idx = {}, {}
    for slug, pg in src['pages'].items():
        for s in pg['sections']:
            src_trk[s['id']] = s['trk']
            src_idx[(slug, s['id'])] = s
    for sid, v in trk_map.items():
        src_trk.setdefault(sid, v.get('trk'))

    alignments = {(slug, pid): align(src['pages'].get(slug), tgt['pages'].get(slug))
                  for slug in src['pages'] for pid, tgt in targets.items()}

    out, stats, unresolved = [], collections.Counter(), collections.defaultdict(list)
    for r in rows:
        sid, slug = r[a.id_column], r[a.page_column]
        t = src_trk.get(sid)
        for pid, tgt in targets.items():
            tp = tgt['pages'].get(slug)
            if not tp:
                stats[(pid, 'page absent from this pattern')] += 1
                unresolved[pid].append((r.get('Fix ID'), slug, 'page absent'))
                continue
            hit = basis = None
            cand = [s for s in tp['sections'] if t and s['trk'] == t]
            if len(cand) == 1:
                hit, basis = cand[0], 'trackingId'
            elif len(cand) > 1:
                hit, basis = cand[0], 'trackingId (AMBIGUOUS - first taken, review)'
            else:
                me = src_idx.get((slug, sid))
                if me:
                    A = alignments[(slug, pid)]
                    prev = [k for k in A if k < me['i']]
                    nxt = [k for k in A if k > me['i']]
                    if prev and nxt:
                        lo, hi = A[max(prev)]['i'], A[min(nxt)]['i']
                        used = {v['i'] for v in A.values()}
                        gap = [d for d in tp['sections']
                               if lo < d['i'] < hi and d['i'] not in used
                               and str(d['et']) == str(me['et'])]
                        if len(gap) == 1:
                            hit, basis = gap[0], 'neighbour alignment'
                    if hit is None:
                        ss, ts = src['pages'][slug]['sections'], tp['sections']
                        if (len(ss) == len(ts)
                                and [str(x['et']) for x in ss] == [str(x['et']) for x in ts]):
                            hit, basis = ts[me['i']], 'page structure identical, matched by index'
            if hit:
                stats[(pid, basis)] += 1
                out.append({'sourceRow': {k: r[k] for k in r},
                            'pattern': pid, 'slug': slug, 'sourceId': sid,
                            'targetId': hit['id'], 'targetPageId': tp['pageId'],
                            'targetTags': hit['tags'], 'targetTitle': hit['title'],
                            'targetEt': hit['et'], 'targetIdx': hit['i'],
                            'targetLevel': hit['level'], 'targetHideInView': hit['hideInView'],
                            'basis': basis})
            else:
                stats[(pid, 'UNRESOLVED')] += 1
                unresolved[pid].append((r.get('Fix ID'), slug, r.get('Section title'), r.get('Notes')))

    for (pid, basis), n in sorted(stats.items()):
        print(f'  {n:>4}  {pid}  {basis}')
    json.dump(out, open(a.out, 'w'))
    print(f'\nmatched {len(out)} of {len(rows) * len(targets)} (rows x targets) -> {a.out}')
    for pid, v in unresolved.items():
        print(f'\n--- UNRESOLVED in {pid} ({len(v)}) ---')
        for x in v:
            print('   ', x)
    print('\nAn UNRESOLVED row usually means the component does not exist in that pattern — '
          'it was added to the source AFTER the duplicate was made. Verify one before assuming '
          'it is a matching failure.')


if __name__ == '__main__':
    main()
