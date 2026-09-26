#!/usr/bin/env python3
"""The GM's planning documents into the GM tabs (M3, PLAYBOOK §4b.2): the one-time move of the current
planning set into the campaign pack's GM material — gm.{overview, people, pc}, threads and the arc —
written into campaign/pack/seed.json, which fills the GM's campaign once (engine/state.js seed). After the
move the pack is the source, edited in the tabs; this script is the record of how the text was carried.

    python3 campaign/source/absorb_planning.py      # reads campaign/source/planning/, writes the seed

The documents are copied byte for byte into campaign/source/planning/ from the support folder's
archive/reference/planning/. DOCS below says which are carried and where; the superseded drafts are not
(campaign/PLAN.md, M3).

Deterministic, and no word is changed: a heading becomes a section's or a subsection's title (a deeper
heading, a **bold** line in its text); a table becomes a header line and a "- " list, its cells joined
by " · "; a code fence's lines become plain lines; a "---" rule is dropped; a nested or "* " list item
becomes "- "; a blank line is put between a list and the lines around it (system/l5r5e/gm-text.js draws a
block as a list only when every line is an item). The two plain-text notes files are carried whole, their
first line the title, their indentation dropped. campaign/source/check_planning.py proves it, heading by
heading, with its own reading of the documents.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'campaign/source/planning'
SEED = ROOT / 'campaign/pack/seed.json'

PCS = ['#BOpcKitsukiHasumi', '#BOpcIsawaEndo', '#BOpcBayushiTaigen']

# (file, id prefix, how). `how` routes each heading at the document's top level of sections:
#   {title: (destination, mode, about)} — destination overview | people | pc | threads | arc | prep
#   mode 'section' — the heading is a section, its children subsections (deeper ones, bold lines)
#   mode 'split'   — the heading is a section of its own text; each child is a section of its own
#   mode 'each'    — (threads, arc) each child is a thread / a scene; the heading's own text is the note
DOCS = [
    ('Bushido_Oni_Campaign_Final.md', 'bo-final', 2, {
        'Overview': ('overview', 'section', None),
        'The Seven Imperial Advisors': ('people', 'split', None),
        'The Three Conspiracies': ('overview', 'section', None),
        'The Murder Timeline': ('overview', 'section', None),
        "The Surviving Advisors' Positions": ('people', 'section', None),
        'Investigation Threads': ('threads', 'each', None),
        'The Task Force': ('overview', 'section', None),
        'Key NPCs': ('people', 'section', ['#BOgmNasuKogo', '#BOgmTsumeKunimichi']),
    }),
    ('bushi_oni_campaign_1120_reference.md', 'bo-1120', 1, {
        'Legend of the Five Rings: Campaign Reference': ('overview', 'section', None),
        'Part I: The State of the Empire (End of 1119)': ('overview', 'section', None),
        'Part II: Events of Early 1120 (January–April)': ('overview', 'section', None),
        'Part III: Major Plot Threads (1120–1124)': ('overview', 'section', None),
        'Part IV: Quick Reference': ('overview', 'section', None),
    }),
    ('l5r_investigation_planning.md', 'bo-prep-2026-01-27', 1, {
        'Bushy Oni Investigation - Session Planning': ('overview', 'prep', PCS),
    }),
    ('Bushi Oni Characters.md', 'bo-characters', 0, ('pc', PCS + ['#BOpcKitsuneYuma', '#BOgmHirumaKaede'])),
    ('Bushi Oni - Parallel Investigation.md', 'bo-parallel', 0, ('overview', None)),
]
# the session plan's scenes: the arc, under the date of the session they were prepared for; whether each
# was played is the GM's to mark (the transcript is too noisy to say, and the seed cannot flip it later)
PREP_SCENES, PREP_SESSION = 'Proposed Scene Structure', 'Prepared for 27 Jan 2026'


def slug(t):
    t = t.lower().replace('ō', 'o').replace('ū', 'u').replace('ē', 'e')
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')


def title_of(h):
    """A heading's words, its Markdown emphasis off."""
    return re.sub(r'\*+', '', h).strip()


def tree(text):
    """The Markdown as nested headings: {level, title, lines, kids}; the root is level 0."""
    root = {'level': 0, 'title': None, 'lines': [], 'kids': []}
    stack = [root]
    fence = False
    for line in text.split('\n'):
        if line.strip().startswith('```'):
            fence = not fence
            continue
        m = None if fence else re.match(r'^(#{1,6})\s+(.*?)\s*$', line)
        if m:
            node = {'level': len(m.group(1)), 'title': m.group(2), 'lines': [], 'kids': []}
            while stack[-1]['level'] >= node['level']:
                stack.pop()
            stack[-1]['kids'].append(node)
            stack.append(node)
        else:
            stack[-1]['lines'].append(('code', line) if fence else ('md', line))
    return root


def md(lines):
    """A heading's body lines as the GM tabs' Markdown."""
    out = []           # lines; '' separates blocks
    kind_prev = None
    table_head = None
    for k, line in lines:
        s = line.rstrip()
        if k == 'code':
            item, text = False, s.strip()
            if not text:
                out.append(''); kind_prev = None; continue
        else:
            if re.match(r'^\s*-{3,}\s*$', s):
                out.append(''); kind_prev = None; continue
            if re.match(r'^\s*\|.*\|\s*$', s):
                cells = [c.strip() for c in s.strip().strip('|').split('|')]
                if all(re.match(r'^:?-{2,}:?$', c) for c in cells):
                    continue
                if table_head is None:
                    table_head = True
                    item, text = False, ' · '.join(cells)
                else:
                    item, text = True, ' · '.join(cells)
            else:
                table_head = None
                m = re.match(r'^\s*[-*]\s+(.*)$', s)
                item, text = (True, m.group(1)) if m else (False, s.strip())
            if not text:
                out.append(''); kind_prev = None; continue
        if kind_prev is not None and kind_prev != item:
            out.append('')
        out.append(('- ' + text) if item else text)
        kind_prev = item
    t = '\n'.join(out)
    return re.sub(r'\n{3,}', '\n\n', t).strip()


def body(node, depth=0):
    """A node's text with its descendants folded in as **bold** title lines (for headings below a subsection)."""
    parts = [md(node['lines'])]
    for k in node['kids']:
        parts.append('**' + title_of(k['title']) + '**')
        parts.append(body(k, depth + 1))
    return '\n\n'.join(p for p in parts if p)


def section(node, pid, about=None):
    sec = {'id': pid + '-' + slug(title_of(node['title'])), 'title': title_of(node['title']), 'text': md(node['lines'])}
    subs = [{'id': sec['id'] + '-' + slug(title_of(k['title'])), 'title': title_of(k['title']), 'text': body(k)} for k in node['kids']]
    if subs:
        sec['sections'] = subs
    if about:
        sec['about'] = about
    return sec


def plain_doc(text):
    """A plain-text notes file: its first line the title, the rest its lines (indentation off)."""
    lines = text.replace('\r', '').split('\n')
    title = lines[0].strip()
    out, prev = [], None
    for l in lines[1:]:
        s = l.strip()
        if not s:
            out.append(''); prev = None; continue
        item = s.startswith('- ')
        if prev is not None and prev != item:
            out.append('')
        out.append(s)
        prev = item
    return title, re.sub(r'\n{3,}', '\n\n', '\n'.join(out)).strip()


def main():
    gm = {'overview': [], 'people': [], 'pc': []}
    threads, arc = [], []
    for fname, pid, top, how in DOCS:
        text = (SRC / fname).read_text(encoding='utf-8')
        if top == 0:
            dest, about = how
            title, t = plain_doc(text)
            sec = {'id': pid, 'title': title, 'text': t}
            if about:
                sec['about'] = about
            gm[dest].append(sec)
            continue
        root = tree(text)
        heads = root['kids'] if top == 1 else [k for h1 in root['kids'] for k in h1['kids']]
        if top == 2 and md(root['kids'][0]['lines']):
            sys.exit('%s: text under its title would be lost' % fname)
        seen = set()
        for node in heads:
            t = title_of(node['title'])
            if t not in how:
                sys.exit('%s: no home for %r' % (fname, t))
            seen.add(t)
            dest, mode, about = how[t]
            if mode == 'section':
                gm[dest].append(section(node, pid, about))
            elif mode == 'split':
                own = {'id': pid + '-' + slug(t), 'title': t, 'text': md(node['lines'])}
                gm[dest].append(own)
                for k in node['kids']:
                    gm[dest].append(section(k, pid, about))
            elif mode == 'each':          # threads
                if md(node['lines']):
                    sys.exit('%s: %r has text of its own' % (fname, t))
                for k in node['kids']:
                    threads.append({'id': pid + '-thread-' + slug(title_of(k['title'])), 'title': title_of(k['title']), 'text': body(k), 'open': True})
            elif mode == 'prep':          # the session plan: the scenes to the arc, the rest a prep section
                sec = {'id': pid, 'title': t, 'text': md(node['lines']), 'sections': [], 'about': about}
                for k in node['kids']:
                    kt = title_of(k['title'])
                    if kt == PREP_SCENES:
                        if md(k['lines']):
                            sys.exit('%s: %r has text of its own' % (fname, kt))
                        for sc in k['kids']:
                            st = title_of(sc['title'])
                            arc.append({'id': pid + '-' + slug(st), 'title': st, 'session': PREP_SESSION, 'text': body(sc), 'sections': [], 'played': False})
                    else:
                        sec['sections'].append({'id': pid + '-' + slug(kt), 'title': kt, 'text': body(k)})
                gm[dest].append(sec)
        if set(how) - seen:
            sys.exit('%s: not found: %s' % (fname, ', '.join(sorted(set(how) - seen))))

    ids = [x['id'] for l in (gm['overview'], gm['people'], gm['pc'], threads, arc) for x in l]
    ids += [y['id'] for l in (gm['overview'], gm['people'], gm['pc']) for x in l for y in x.get('sections') or []]
    dup = sorted({i for i in ids if ids.count(i) > 1})
    if dup:
        sys.exit('duplicate ids: ' + ', '.join(dup))

    seed = json.loads(SEED.read_text()) if SEED.exists() else {'kind': 'sortilege-vtt-campaign', 'version': 1}
    seed['arc'] = arc
    seed['threads'] = threads
    seed['gm'] = gm
    SEED.parent.mkdir(parents=True, exist_ok=True)
    SEED.write_text(json.dumps(seed, ensure_ascii=False, indent=1) + '\n')
    n = lambda l: sum(1 + len(x.get('sections') or []) for x in l)
    print('seed: overview %d, people %d, pc %d (sections+subsections), threads %d, arc %d' % (
        n(gm['overview']), n(gm['people']), n(gm['pc']), len(threads), len(arc)))


if __name__ == '__main__':
    main()
