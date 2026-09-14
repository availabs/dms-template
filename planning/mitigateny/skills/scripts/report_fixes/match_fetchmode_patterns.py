# -*- coding: utf-8 -*-
"""
Pair a duplicate pattern's data components with the source pattern's, so the T6
report can reuse the source `Fix ID` for a duplicate's matching row
(cataloguing-and-fixing-data-fetch-mode.md §5: the row key is
`(Fix ID, Pattern ID)`).

Why this is not `match_patterns.py`. That one consumes `scan_pattern.mjs`
output, which lists EVERY section on a page and is what the T5 alignment ladder
needs. `scan_fetchmode.mjs` lists only the *data components* - so the index
space is different (`draftIndex` is a position among all draft sections, but the
neighbours available for alignment are only the data ones). The ladder is the
same three tiers; the anchors are sparser.

The output is an id-ledger fragment - `{"<patternId>:<sectionId>": "T6-Cnnn"}` -
mergeable straight into `ledgers/t6-fetchmode-ids.json`, plus a per-tier report
so the weak matches stay reviewable instead of invisible.

usage:
  python match_fetchmode_patterns.py --source <scan.json> --source-ledger <ledger.json>
         --target <patternId>=<scan.json> [--target ...]
         --out-ledger <fragment.json> --out-report <report.json>
"""
import argparse, json, collections

ap = argparse.ArgumentParser()
ap.add_argument('--source', required=True, help='scan_fetchmode.mjs output for the SOURCE pattern')
ap.add_argument('--source-ledger', required=True, help='the T6 id ledger, for the source Fix IDs')
ap.add_argument('--target', action='append', required=True, help='<patternId>=<scan.json>')
ap.add_argument('--out-ledger', required=True)
ap.add_argument('--out-report', required=True)
args = ap.parse_args()


def load(path):
    return json.load(open(path, encoding='utf-8'))


def by_page(scan):
    """pageSlug -> [component, ...] in draftIndex order."""
    pages = collections.defaultdict(list)
    for c in scan['components']:
        pages[c['pageSlug']].append(c)
    for v in pages.values():
        v.sort(key=lambda c: c['draftIndex'])
    return pages


src_scan = load(args.source)
src_pattern = str(src_scan['patternId'])
src_pages = by_page(src_scan)
ledger = load(args.source_ledger)


def src_fix_id(section_id):
    return ledger.get('%s:%s' % (src_pattern, section_id))


fragment, report = {}, {'source': src_pattern, 'targets': {}}

for spec in args.target:
    tgt_pattern, tgt_path = spec.split('=', 1)
    tgt_scan = load(tgt_path)
    tgt_pages = by_page(tgt_scan)

    tiers = collections.Counter()
    unresolved, collisions, notes = [], [], []

    for slug, tcomps in sorted(tgt_pages.items()):
        scomps = src_pages.get(slug)
        if not scomps:
            tiers['page-absent-from-source'] += len(tcomps)
            for t in tcomps:
                unresolved.append({'page': slug, 'sectionId': t['sectionId'],
                                   'title': t['title'], 'reason': 'page not in source pattern'})
            continue

        # ── Tier A: trackingId, within the same page slug ──────────────────
        # trackingId is the primary key and survives duplication for most but
        # not all components (see the propagation skill). Scope it to the page:
        # a pattern can legitimately hold the same trackingId on two pages
        # (county_template shares sections between lightning/wind/tornado), and
        # a global map would resolve those arbitrarily.
        s_by_trk = collections.defaultdict(list)
        for s in scomps:
            if s.get('trackingId'):
                s_by_trk[s['trackingId']].append(s)

        matched = {}   # target index -> source component
        used_src = set()

        # trackingId is NOT unique within a page (measured on county_template
        # 2026-09-01: 208 components across 25 pages share one with a sibling -
        # `about_the_process` has five Cards on a single trackingId). Duplicating
        # a section in the admin UI copies it. So resolve a collision group by
        # (elementType, title, sourceId) before giving up: those DO line up
        # across patterns (1515010 "Overview" -> suffolk 2381013 "Overview").
        def disambiguate(t, cands):
            for keys in (('elementType', 'title', 'sourceId'),
                         ('elementType', 'title'),
                         ('elementType', 'sourceId')):
                narrowed = [c for c in cands
                            if all(c.get(k) == t.get(k) for k in keys)]
                if len(narrowed) == 1:
                    return narrowed[0], '+'.join(keys)
            return None, None

        for i, t in enumerate(tcomps):
            cands = s_by_trk.get(t.get('trackingId') or '__none__', [])
            cands = [c for c in cands if c['sectionId'] not in used_src]
            if len(cands) == 1:
                matched[i] = cands[0]
                used_src.add(cands[0]['sectionId'])
                tiers['A trackingId'] += 1
            elif len(cands) > 1:
                pick, on = disambiguate(t, cands)
                if pick is not None:
                    matched[i] = pick
                    used_src.add(pick['sectionId'])
                    tiers['A2 trackingId + %s' % on] += 1
                else:
                    collisions.append({'page': slug, 'sectionId': t['sectionId'],
                                       'title': t['title'],
                                       'trackingId': t.get('trackingId'),
                                       'candidates': [c['sectionId'] for c in cands]})

        # ── Tier B: neighbour alignment ────────────────────────────────────
        # Between two tier-A anchors, if the gap holds exactly one target and
        # one source component AND their element types agree, they are the same
        # component with a re-minted trackingId. Never guesses: a gap with two
        # candidates is left for tier C or unresolved.
        anchors = sorted(matched.keys())
        s_index = {c['sectionId']: j for j, c in enumerate(scomps)}
        bounds = [(-1, -1)] + [(a, s_index[matched[a]['sectionId']]) for a in anchors] \
                            + [(len(tcomps), len(scomps))]
        for (ta, sa), (tb, sb) in zip(bounds, bounds[1:]):
            t_gap = [i for i in range(ta + 1, tb) if i not in matched]
            s_gap = [j for j in range(sa + 1, sb) if scomps[j]['sectionId'] not in used_src]
            if len(t_gap) == 1 and len(s_gap) == 1:
                t, s = tcomps[t_gap[0]], scomps[s_gap[0]]
                # elementType alone is NOT enough for a fetch-mode report: the
                # bound source decides both the recommended value and the scope,
                # so pairing a `Hazards_of_Concern` Card with an
                # `AVAIL - Fusion Events V2` Card makes one Fix ID mean two
                # different fixes. Caught on `hurricane`, where the page order
                # diverged and tiers B/C crossed two Cards (T6-C289 / T6-C290).
                if t['elementType'] == s['elementType'] and t.get('sourceId') == s.get('sourceId'):
                    matched[t_gap[0]] = s
                    used_src.add(s['sectionId'])
                    tiers['B neighbour'] += 1

        # ── Tier C: identical page structure ──────────────────────────────
        # If the page holds the same number of data components in the same
        # element-type sequence, position is identity. Only applied to rows
        # still unmatched, so it never overrides a trackingId.
        def sig(cs):
            return [(c['elementType'], c.get('sourceId')) for c in cs]
        if len(tcomps) == len(scomps) and sig(tcomps) == sig(scomps):
            for i, t in enumerate(tcomps):
                if i in matched:
                    continue
                s = scomps[i]
                if s['sectionId'] in used_src:
                    continue
                matched[i] = s
                used_src.add(s['sectionId'])
                tiers['C page structure'] += 1

        # ── Tier D: attribute identity, ignoring trackingId ────────────────
        # The residue after A/B/C is dominated by components whose trackingId
        # diverged AND whose position moved, so neither anchor works - but which
        # are plainly the same component: same page, same element type, same
        # source, same non-empty title. Measured on the 2026-09-01 run, these
        # showed up as mirror-image artefacts (a template row "absent from the
        # duplicate" and a duplicate row "with no template counterpart", both
        # named `Local Capabilities Table`).
        #
        # Guard: exactly ONE unmatched candidate on EACH side. Two Cards named
        # `Local Capabilities Table` on one page stay unresolved rather than
        # being paired arbitrarily - the same never-guess rule as tier B.
        t_left = [i for i in range(len(tcomps)) if i not in matched]
        s_left = [j for j in range(len(scomps)) if scomps[j]['sectionId'] not in used_src]
        if t_left and s_left:
            def akey(c):
                return (c['elementType'], (c.get('title') or '').strip(), c.get('sourceId'))
            t_groups, s_groups = collections.defaultdict(list), collections.defaultdict(list)
            for i in t_left:
                if (tcomps[i].get('title') or '').strip():
                    t_groups[akey(tcomps[i])].append(i)
            for j in s_left:
                if (scomps[j].get('title') or '').strip():
                    s_groups[akey(scomps[j])].append(j)
            for k, tis in t_groups.items():
                sjs = s_groups.get(k, [])
                if len(tis) == 1 and len(sjs) == 1:
                    matched[tis[0]] = scomps[sjs[0]]
                    used_src.add(scomps[sjs[0]]['sectionId'])
                    tiers['D elementType+title+sourceId'] += 1

        for i, t in enumerate(tcomps):
            if i in matched:
                s = matched[i]
                fid = src_fix_id(s['sectionId'])
                if not fid:
                    notes.append({'page': slug, 'sectionId': t['sectionId'],
                                  'reason': 'matched source %s has no Fix ID in the ledger'
                                            % s['sectionId']})
                    continue
                fragment['%s:%s' % (tgt_pattern, t['sectionId'])] = fid
            else:
                tiers['unresolved'] += 1
                unresolved.append({
                    'page': slug, 'sectionId': t['sectionId'], 'title': t['title'],
                    'elementType': t['elementType'], 'sourceName': t.get('sourceName'),
                    'draftIndex': t['draftIndex'],
                    'reason': 'no trackingId, neighbour or structural match',
                })

    # A source Fix ID must not land on two components of one target pattern.
    seen = collections.Counter(v for k, v in fragment.items()
                               if k.startswith(tgt_pattern + ':'))
    dupes = {k: n for k, n in seen.items() if n > 1}

    report['targets'][tgt_pattern] = {
        'scan': tgt_path,
        'components': len(tgt_scan['components']),
        'pages': len(tgt_pages),
        'tiers': dict(tiers),
        'assigned': sum(1 for k in fragment if k.startswith(tgt_pattern + ':')),
        'trackingIdCollisions': collisions,
        'fixIdAssignedTwice': dupes,
        'notes': notes,
        'unresolved': unresolved,
    }
    print('%s: %d components, %d pages' % (tgt_pattern, len(tgt_scan['components']), len(tgt_pages)))
    for k in sorted(tiers):
        print('   %-26s %d' % (k, tiers[k]))
    if collisions:
        print('   !! %d trackingId collision(s)' % len(collisions))
    if dupes:
        print('   !! %d source Fix ID(s) assigned to 2+ target components' % len(dupes))
    if notes:
        print('   !! %d matched row(s) whose source has no ledger Fix ID' % len(notes))

json.dump(fragment, open(args.out_ledger, 'w', encoding='utf-8'), indent=1, sort_keys=True)
json.dump(report, open(args.out_report, 'w', encoding='utf-8'), indent=1)
print('\nledger fragment: %d assignment(s) -> %s' % (len(fragment), args.out_ledger))
print('report -> %s' % args.out_report)
