# -*- coding: utf-8 -*-
"""Build the Westchester Base Plan fill spec: one entry per target Annotation slot.

Reads  ../out/crosswalk.json  (emission order matters - M-list order in build_crosswalk.py)
       ../out/baseplan/sections.json  (paragraph-level source text)
Writes ../out/fill_spec.json   - {slot_id, page_id, slot_title, status, blocks[], sources[], chars}
       ../out/fill_spec.md     - human-reviewable rendering of every block

Block shape matches lexical.mjs buildRootBlocks2: {"t":"p"|"h"|"ul", "text"/"items", "tag"}

Faithfulness rules
------------------
* Text is copied verbatim from sections.json. Nothing is reworded.
* The document's own list styling decides list markup: `Bullet 1` / `List Paragraph`
  become <ul> items; every other style stays a paragraph. We never invent list
  structure where the document has none.
* Tables are never transcribed (they are not in `paras` at all; the platform renders them).
* PARA_RULES restricts a (section -> slot) pair to specific paragraphs, for the
  paragraph-level distributions decided in D1-SO-2/-3 and D4.
* SENT_RULES splits a single paragraph at a sentence boundary ([1783] only).
* LEAD_INS add an h3 above a merged block so two sources stay legible in one box.
"""
import json, io, re, os, collections

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'out')

STATUS = 'local_review_needed'   # C2: NOT shmp_sourced_content - this is county prose

# ---------------------------------------------------------------- paragraph rules
# (doc_block, slot_id) -> list of paragraph block numbers to include, in this order
PARA_RULES = {
    # D1-SO-2 - distribute the plan-wide Executive Summary [562]
    (562, '2449721'): [563],
    (562, '2450060'): [566],
    (562, '2450098'): [567],
    (562, '2463655'): [568],
    # D1-SO-3 - distribute Background [589]; 594 and 599-602 dropped as 44 CFR boilerplate
    (589, '2449714'): [590, 591],
    (589, '2449721'): [592],
    (589, '2449737'): [593, 598],
    # D1-SO-1 (C1-revised) - [1844] only; [1845]-[1848] are navigation
    (1843, '2450060'): [1844],
    # D4 [757] - narration only ([758], [761]); table 760 is data
    (757, '2449784'): [758, 761],
}

# (doc_block, slot_id) -> {para: n, take: 'first'|'rest'}  sentence-level split
SENT_RULES = {
    (1783, '2450098'): {'para': 1784, 'take': 'first'},
    (1783, '2450104'): {'para': 1784, 'take': 'rest'},
}
# for the 'rest' case the following paragraphs come along too
SENT_TAIL = {(1783, '2450104'): [1785, 1786]}

# (doc_block, slot_id) -> (tag, heading text)
# Rule: within one box, either EVERY merged source carries an h3 or NONE does --
# with one allowed exception, a lead-in on the FINAL source, because nothing
# unheaded follows it. A heading above source A followed by an unheaded source B
# makes B read as part of A. check_lead_ins() enforces this.
LEAD_INS = {
    # lead-in on the LAST source only; the native prose reads first, unheaded
    (643,  '2453621'): ('h3', 'Future Population Projections'),
    (757,  '2449784'): ('h3', 'Open Space'),
    (1730, '2449756'): ('h3', 'Shared Socioeconomic Pathways'),
    (1825, '2450067'): ('h3', 'Local Funding Capabilities'),
    (589,  '2449737'): ('h3', 'What Has Changed Since the Last Plan'),
    (572,  '2463655'): ('h3', 'Formal Adoption'),
    # 2450060 - three sources. [566] is a bare intro paragraph; both remaining
    # sources are headed with the document's own H4 titles.
    (1843, '2450060'): ('h3', 'About this Assessment'),
    (1851, '2450060'): ('h3', 'Planning and Regulatory Capabilities'),
    # 2449748 - three genuinely distinct subsections, all headed verbatim
    # from the document's own headings.
    (1926, '2449748'): ('h3', 'Monitoring and Progress Tracking'),
    (1929, '2449748'): ('h3', 'Evaluating Method and Schedule'),
    (1936, '2449748'): ('h3', 'Plan Updating Approach'),
    # 2466023 (Drought) - the only hazard page where Overview and General
    # Vulnerability both merge into Local Hazard Summary. Both headed.
    (993,  '2466023'): ('h3', 'Overview'),
    (999,  '2466023'): ('h3', 'General Vulnerability'),
    # DELIBERATELY NO LEAD-IN:
    #  (609, '2449856')  - [610] is the topic sentence for [620]'s enumeration;
    #                      they read as continuous prose, which is the whole
    #                      reason [609] was mapped here. A heading breaks that.
    #  (1783, '2450104') - the definitions flow straight into the goals list.
    #  2449721, 2450098  - continuous exec-summary / strategy-overview prose.
}

LIST_STYLES = {'Bullet 1', 'List Paragraph'}


def split_first_sentence(t):
    """Split at the first sentence boundary. Returns (first, rest)."""
    m = re.search(r'(?<=[.!?])\s+(?=[A-Z(])', t)
    if not m:
        return t, ''
    return t[:m.start()].strip(), t[m.end():].strip()


def blocks_from_paras(paras):
    """Paragraph dicts -> block descriptors, grouping consecutive list-styled runs."""
    out, buf = [], []
    for p in paras:
        text = (p.get('text') or '').strip()
        if not text:
            continue
        if p.get('style') in LIST_STYLES:
            buf.append(text)
            continue
        if buf:
            out.append({'t': 'ul', 'items': buf}); buf = []
        out.append({'t': 'p', 'text': text})
    if buf:
        out.append({'t': 'ul', 'items': buf})
    return out


def check_lead_ins(spec):
    """Flag boxes where an unheaded source follows a headed one.

    A heading above source A followed by an *unheaded* source B makes B read as
    part of A. So the headed sources must form a contiguous suffix: once one
    source carries an h3, every later source in the box must too. That admits
    all three intended shapes -

      none headed              continuous prose (2449721, 2450098, 2449856)
      only the last headed     native prose first, merged addition after
      unheaded intro, then
        every later one headed 2450060: [566] intro, then two headed subsections

    - and rejects only the genuine mislabelling case.
    """
    warn = []
    for e in spec:
        if len(e['sources']) < 2:
            continue
        headed = [(s['doc_block'], e['slot_id']) in LEAD_INS for s in e['sources']]
        if not any(headed):
            continue
        first = headed.index(True)
        bad = [s['doc_block'] for s, h in zip(e['sources'][first:], headed[first:]) if not h]
        if bad:
            warn.append((e['slot_id'], e['slot_title'], bad))
    return warn


def main():
    secs = {s['n']: s for s in json.load(io.open(os.path.join(OUT, 'baseplan', 'sections.json'), encoding='utf-8'))}
    cw = json.load(io.open(os.path.join(OUT, 'crosswalk.json'), encoding='utf-8'))

    mapped = [r for r in cw if r['slot_id'] and r['confidence'] in ('HIGH', 'MEDIUM', 'LOW') and r['doc_block']]

    slots = collections.OrderedDict()
    unresolved = []

    for r in mapped:
        n, sid = r['doc_block'], str(r['slot_id'])
        sec = secs.get(n)
        if not sec:
            unresolved.append((n, sid, 'section missing')); continue
        by_n = {p['n']: p for p in sec['paras']}
        key = (n, sid)

        # --- pick the source paragraphs
        if key in SENT_RULES:
            rule = SENT_RULES[key]
            src = by_n.get(rule['para'])
            if not src:
                unresolved.append((n, sid, 'sentence para %s missing' % rule['para'])); continue
            first, rest = split_first_sentence((src.get('text') or '').strip())
            take = first if rule['take'] == 'first' else rest
            if not take:
                unresolved.append((n, sid, 'sentence split produced nothing')); continue
            blocks = [{'t': 'p', 'text': take}]
            for extra in SENT_TAIL.get(key, []):
                p = by_n.get(extra)
                if p:
                    blocks += blocks_from_paras([p])
                else:
                    unresolved.append((n, sid, 'tail para %s missing' % extra))
            used = [rule['para']] + SENT_TAIL.get(key, [])
        elif key in PARA_RULES:
            want = PARA_RULES[key]
            picked = []
            for b in want:
                if b in by_n:
                    picked.append(by_n[b])
                else:
                    unresolved.append((n, sid, 'para %s missing' % b))
            blocks = blocks_from_paras(picked)
            used = want
        else:
            blocks = blocks_from_paras(sec['paras'])
            used = [p['n'] for p in sec['paras']]

        if not blocks:
            unresolved.append((n, sid, 'no blocks produced')); continue

        # --- optional h3 lead-in
        lead = LEAD_INS.get(key)
        if lead:
            blocks = [{'t': 'h', 'tag': lead[0], 'text': lead[1]}] + blocks

        e = slots.setdefault(sid, {
            'slot_id': sid, 'page_id': r['page_id'], 'page_title': r['page_title'],
            'slot_title': r['slot_title'], 'slot_order': r['slot_order'],
            'status': STATUS, 'blocks': [], 'sources': [],
        })
        e['blocks'] += blocks
        e['sources'].append({'doc_block': n, 'doc_heading': sec['title'],
                             'paras': used, 'confidence': r['confidence']})

    # --- char counts
    for e in slots.values():
        c = 0
        for b in e['blocks']:
            c += len(b.get('text', '')) + sum(len(i) for i in b.get('items', []))
        e['chars'] = c

    spec = list(slots.values())
    lead_warnings = check_lead_ins(spec)
    json.dump(spec, io.open(os.path.join(OUT, 'fill_spec.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)

    # --- human-reviewable rendering
    with io.open(os.path.join(OUT, 'fill_spec.md'), 'w', encoding='utf-8') as f:
        f.write('# Westchester Base Plan fill spec\n\n')
        f.write('%d slots, %d characters, status `%s`, all to `draft_sections`.\n\n'
                % (len(spec), sum(e['chars'] for e in spec), STATUS))
        for e in sorted(spec, key=lambda x: (x['page_title'], x['slot_order'] or 0)):
            f.write('## `%s` %s / %s (ord %s) - %d ch\n\n'
                    % (e['slot_id'], e['page_title'], e['slot_title'], e['slot_order'], e['chars']))
            f.write('Sources: %s\n\n' % ', '.join(
                '[%s] %s (paras %s, %s)' % (s['doc_block'], s['doc_heading'],
                                            '+'.join(str(x) for x in s['paras']), s['confidence'])
                for s in e['sources']))
            for b in e['blocks']:
                if b['t'] == 'h':
                    f.write('### %s\n\n' % b['text'])
                elif b['t'] == 'ul':
                    for i in b['items']:
                        f.write('- %s\n' % i)
                    f.write('\n')
                else:
                    f.write('%s\n\n' % b['text'])
            f.write('---\n\n')

    # --- summary
    multi = [e for e in spec if len(e['sources']) > 1]
    print('slots in spec:          %d' % len(spec))
    print('total characters:       %d' % sum(e['chars'] for e in spec))
    print('total blocks:           %d' % sum(len(e['blocks']) for e in spec))
    print('slots with >1 source:   %d' % len(multi))
    print('list blocks emitted:    %d' % sum(1 for e in spec for b in e['blocks'] if b['t'] == 'ul'))
    print('h3 lead-ins emitted:    %d' % sum(1 for e in spec for b in e['blocks'] if b['t'] == 'h'))
    if lead_warnings:
        print('\nLEAD-IN WARNINGS (%d) - a heading would mislabel the source after it:' % len(lead_warnings))
        for sid, title, bad in lead_warnings:
            print('   %s %s : unheaded sources %s' % (sid, title, bad))
    else:
        print('lead-in check:          clean')
    if unresolved:
        print('\nUNRESOLVED (%d):' % len(unresolved))
        for u in unresolved:
            print('   doc [%s] -> %s : %s' % u)
    else:
        print('unresolved:             0')


if __name__ == '__main__':
    main()
