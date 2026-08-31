"""Extract an INDEPENDENT jurisdictional HMP (a standalone plan, not a consultant annex).

Built for and validated on the Village of Freeport's 2020 All Hazard Mitigation Plan
(PDF-only, 177 pages). The technique is the point, not the constants:

  A PDF text layer destroys TABLE geometry but preserves "Label: value" runs. So in a
  standalone plan the LABELLED PROSE is the recoverable source and the summary tables are
  the lossy duplicate -- the opposite of a consultant annex, where tables are everything.

usage: extract_independent_plan.py <extracted-text.txt> <geoid> [out.json]
"""
import collections
import io
import json
import os
import re
import sys

# The action instrument: "Action 1.1.1: <name>" then labelled fields until the next Action.
ACTION = re.compile(r'\bAction\s+(\d+(?:\.\d+){1,2})\s*:\s*', re.I)
GOAL = re.compile(r'\bGoal\s+(\d+)\s*:\s*([^\n]{4,160}?)(?=\s+Objective|\s+Goal\s+\d|\Z)', re.I)
OBJECTIVE = re.compile(r'\bObjective\s+(\d+\.\d+)\s*:\s*([^\n]{4,200}?)(?=\s+Action\s+\d|\Z)', re.I)

ACTION_FIELDS = ['Priority/timetable', 'Priority', 'Responsible Party', 'Estimated Cost',
                 'Source of Funds', 'Financial and Political Feasibility', 'Hazards Addressed',
                 'Progress Since 2014 Plan', 'Progress Since 2014', 'Progress since 2014']
FIELD_RE = re.compile(r'(' + '|'.join(re.escape(f) for f in ACTION_FIELDS) + r')\s*:?\s*', re.I)

# committee members appear as "Name, Organization, Title" or "Name - Organization"
MEMBER = re.compile(r'^([A-Z][a-z]+(?:\s+[A-Z]\.)?\s+[A-Z][a-zA-Z\'\-]+)\s*[,–-]\s*(.+)$')


def flatten(text):
    """One long normalised string; PDF line breaks carry no meaning here."""
    return ' '.join(text.split())


def strip_running_heads(text, phrases):
    for p in phrases:
        text = text.replace(p, ' ')
    return text


def parse_actions(seg):
    """Split on 'Action N.N.N:' then read the labelled fields inside each block."""
    hits = list(ACTION.finditer(seg))
    out = []
    for i, m in enumerate(hits):
        end = hits[i + 1].start() if i + 1 < len(hits) else len(seg)
        block = seg[m.end():end]
        num = m.group(1)
        # the action NAME runs to the first labelled field
        fm = FIELD_RE.search(block)
        name = (block[:fm.start()] if fm else block).strip(' .')
        rec = {'action_number': num, 'action_name': flatten(name),
               'goal': num.split('.')[0], 'objective': '.'.join(num.split('.')[:2])}
        # walk the labelled fields
        marks = list(FIELD_RE.finditer(block))
        for j, fmark in enumerate(marks):
            stop = marks[j + 1].start() if j + 1 < len(marks) else len(block)
            key = fmark.group(1).strip().lower().replace('/', '_').replace(' ', '_')
            key = re.sub(r'progress_since_2014.*', 'progress_since_2014', key)
            val = flatten(block[fmark.end():stop]).strip(' .;')
            if key not in rec or len(val) > len(rec.get(key, '')):
                rec[key] = val
        out.append(rec)
    return out


def main():
    src = sys.argv[1]
    geoid = sys.argv[2]
    out_path = sys.argv[3] if len(sys.argv) > 3 else \
        'references/mny-transcribe/Nassau/context/extracted/independent_' + geoid + '.json'

    raw = io.open(src, encoding='utf-8').read()
    pages = {int(m.group(1)): m.group(2) for m in
             re.finditer(r'===== PAGE (\d+) =====(.*?)(?=(?:===== PAGE )|\Z)', raw, re.S)}
    npages = len(pages)
    body = ' '.join(pages[p] for p in sorted(pages))
    body = strip_running_heads(body, ['Village of Freeport All Hazard Mitigation Plan'])
    flat = flatten(body)

    rec = {'geoid': geoid, 'source': os.path.basename(src), 'pages': npages,
           'document_class': 'independent-jurisdictional-plan', 'warnings': []}

    # ---- chapter spine: read the TABLE OF CONTENTS, not the body ---------
    # Heading detection over flattened body text is unreliable -- critical-facility address
    # lines ("14 ROUTE ROAD", "2810 MERRICK RD EAS") match a numbered-heading pattern, and
    # running heads repeat. The ToC's "N.N TITLE .... page" rows are unambiguous.
    toc_pages = [p for p in sorted(pages) if p <= 8]
    toc = '\n'.join(pages[p] for p in toc_pages)
    spine, seen = [], set()
    for m in re.finditer(r'^\s*(\d+(?:\.\d+){0,2})\s+([A-Z][^\n]{5,80}?)\s*\.{3,}\s*(\d+)\s*$',
                         toc, re.M):
        num, title, page = m.group(1), ' '.join(m.group(2).split()), int(m.group(3))
        if (num, title) in seen:
            continue
        seen.add((num, title))
        spine.append({'number': num, 'title': title, 'page': page})
    rec['spine'] = spine
    if len(spine) < 20:
        rec['warnings'].append(f'only {len(spine)} ToC entries parsed - check the ToC page range')

    # ---- goals / objectives / actions ------------------------------------
    i = flat.rfind('GOALS, OBJECTIVES, AND ACTIONS')
    strategy = flat[i:] if i >= 0 else flat
    rec['goals'] = [{'number': m.group(1), 'text': flatten(m.group(2))}
                    for m in GOAL.finditer(strategy)]
    rec['objectives'] = [{'number': m.group(1), 'text': flatten(m.group(2))}
                         for m in OBJECTIVE.finditer(strategy)]
    rec['actions'] = parse_actions(strategy)

    # ---- planning committee: LINE-anchored, on unflattened text ----------
    # The roster is one member per LINE ("Ray Horton, Freeport Police Department, Chief of
    # Police"). Flattening the text first destroys the only delimiter there is, so this runs
    # against the raw per-page text.
    raw_lines = [ln.strip() for p in sorted(pages) for ln in pages[p].split('\n')]
    members, in_roster = [], False
    for ln in raw_lines:
        if 'PLANNING PROCESS' in ln.upper():
            in_roster = True
        elif re.match(r'^\s*1\.6\b|COMMUNITY PROFILE', ln.upper()):
            in_roster = False
        if not in_roster or not ln:
            continue
        m = MEMBER.match(ln)
        if not m:
            continue
        rest = [x.strip() for x in m.group(2).split(',')]
        members.append({'name': m.group(1).strip(),
                        'organization': rest[0] if rest else '',
                        'title': rest[1] if len(rest) > 1 else '',
                        'raw': ln})
    ded, seenm = [], set()
    for x in members:
        if x['name'] in seenm:
            continue
        seenm.add(x['name'])
        ded.append(x)
    rec['committee'] = ded
    if not ded:
        rec['warnings'].append('no committee members parsed - the roster shape differs')

    # ---- capability sections (numbered prose, chapter 4) -----------------
    caps = [h for h in spine if re.match(r'^4\.\d+$', h['number'])]
    rec['capability_sections'] = caps

    # ---- hazard profiles (chapter 3) -------------------------------------
    haz = [h for h in spine if re.match(r'^3\.\d+$', h['number'])]
    rec['hazard_profiles'] = haz

    # ---- summary ---------------------------------------------------------
    fieldcov = collections.Counter()
    for a in rec['actions']:
        for k in a:
            if k not in ('action_number', 'action_name', 'goal', 'objective'):
                fieldcov[k] += 1
    rec['counts'] = {'spine_headings': len(spine), 'goals': len(rec['goals']),
                     'objectives': len(rec['objectives']), 'actions': len(rec['actions']),
                     # len(ded), not len(members) -- the DEDUPED list
                     'committee': len(ded),
                     'capability_sections': len(caps),
                     'hazard_profiles': len(haz)}
    rec['action_field_coverage'] = dict(fieldcov)

    io.open(out_path, 'w', encoding='utf-8').write(json.dumps(rec, indent=1, ensure_ascii=False))
    print(f'wrote {out_path}')
    for k, v in rec['counts'].items():
        print(f'  {k:22s} {v}')
    print('  action field coverage:')
    for k, v in sorted(fieldcov.items(), key=lambda x: -x[1]):
        print(f'      {k:38s} {v}/{len(rec["actions"])}')
    print('\n  goals:')
    for g in rec['goals']:
        print(f'      {g["number"]}: {g["text"][:88]}')
    print('\n  hazard profiles:', [h['title'][:26] for h in haz])
    print('\n  first 3 actions:')
    for a in rec['actions'][:3]:
        print(f'      {a["action_number"]}  {a["action_name"][:74]}')
        for k in ('priority_timetable', 'responsible_party', 'estimated_cost', 'source_of_funds',
                  'hazards_addressed', 'progress_since_2014'):
            if a.get(k):
                print(f'            {k:22s} {a[k][:78]}')


if __name__ == '__main__':
    main()
