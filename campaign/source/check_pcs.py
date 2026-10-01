#!/usr/bin/env python3
"""
check_pcs.py — the conversion's proof for the player characters: each sheet, read back from the BUILT
layer (campaign/data/campaign.js — rebuild first), field by field against its Foundry export in
campaign/source/foundry/.

    python3 campaign/source/check_pcs.py            # every sheet in convert_pcs.SHEETS and GM_SHEETS
    python3 campaign/source/check_pcs.py '#BOpcKitsukiHasumi'

The expected values are read from the export here, not taken from the converter; only the list of
sheets and the two name aliases are shared. Every key of the export's `system` is compared or named in
NOT_CARRIED with the reason. Exit 1 on any difference.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(HERE, 'campaign/source'))
from convert_pcs import SHEETS, GM_SHEETS, FOUNDRY, ALIAS, SCHOOL_ALIAS  # noqa: E402

# each group of sheets against its own built layer (a book of its own)
LAYERS = [(SHEETS, 'campaign/data/campaign.js'), (GM_SHEETS, 'campaign/data-gm/campaign-gm.js')]

NOT_CARRIED = {
    'soft_locked': "Foundry's sheet lock",
    'notes': None, 'description': None,
    'techniques': "Foundry's allowed-technique-type switches; the corpus's School carries them",
    'prepared': "Foundry's prepared toggle",
    'xp_spent': 'Foundry stores 0 and computes it; Experience Spent is the sum of the items\' xp_used (checked)',
    'xp_saved': 'Foundry stores 0',
    'template': "Foundry's creation template (\"core\")",
    'twenty_questions': 'the creation answers; their results are the sheet (rings, skills, peculiarities — checked)',
    'zeni': 'in Equipment as "N zeni" (checked)',
    'money': 'in Equipment as "N koku/bu/zeni" (checked)',
    'is_afflicted_or_compromised': "Foundry's derived flag",
    'fatigue': 'value in archived versions (checked); max = Endurance',
    'strife': 'value in archived versions (checked); max = Composure',
    'void_points': 'max = Void Points (checked); value is the live tracker',
    'endurance': None, 'composure': None, 'focus': None, 'vigilance': None, 'identity': None, 'rings': None,
    'social': None, 'skills': None, 'stance': None, 'xp_total': None,
}
COMES_WITH = {'school_ability', 'mastery_ability', 'title_ability'}


def built(path):
    src = open(os.path.join(HERE, path), encoding='utf-8').read()
    return json.loads(re.search(r'var d=(\{.*\});var T=window\.L5R5E', src, re.S).group(1))['entities']


def arg(a):
    for k in ('s', 'c', 'i', 'b', 'w'):
        if k in a:
            return a[k]
    if 'l' in a:
        return [arg(x) for x in a['l']]
    return a.get('h')


def props(e):
    out = {}
    for p in e.get('props', []):
        vk = p.get('vk')
        if vk in ('scalar', 'enum'):
            out[p['name']] = p.get('value', p.get('default'))
        elif vk == 'list':
            out[p['name']] = [arg(x) for x in p.get('items', [])]
        elif vk == 'def':
            out[p['name']] = {f['name']: f.get('value') for f in p.get('fields', [])}
        elif vk == 'ref':
            out[p['name']] = (p.get('ref') or {}).get('hash')
    return out


def text_of(h):
    from html.parser import HTMLParser
    class P(HTMLParser):
        def __init__(self):
            super().__init__(convert_charrefs=True); self.lines, self.cur = [], ''
        def handle_starttag(self, tag, a):
            if tag == 'br': self.lines.append(self.cur); self.cur = ''
        def handle_endtag(self, tag):
            if tag == 'p': self.lines.append(self.cur); self.cur = ''
        def handle_data(self, x):
            self.cur += x
    p = P(); p.feed(h or ''); p.close(); p.lines.append(p.cur)
    return '\n'.join(x.strip() for x in p.lines if x.strip())


def plain(n):
    """Foundry's item name as the corpus names it: apostrophe, alias, then a trailing (x) / [x] / ": x" off."""
    n = n.replace('’', "'").strip()
    if n in ALIAS:
        return ALIAS[n]
    if n in ('Ally [Name]', 'Shadowlands Taint (Air)', 'Stalked by [Creature]'):   # corpus entities whose names carry the brackets
        return n
    # corpus entities whose names carry the colon: each Iaijutsu Cut is its own kata (core p.
    # techniques; Path of Waves), held through Taigen's Sword Saint title
    if n in ('Iaijutsu Cut: Crossing Blade', 'Iaijutsu Cut: Sword and Sheath'):
        return n
    n = re.sub(r'\s*(\([^)]*\)|\[[^\]]*\])$', '', n).split(':')[0].strip()
    return ALIAS.get(n, n)


def held(items):
    """Every item the character holds, a title's own items after it: a technique bought through a
    title lives in that title's `system.items`, not at the top level (Taigen's Sword Saint kata, Kaede's
    Gunsō techniques). Fragile Peace's M4 found the same blind spot in this check's sibling."""
    for i in items:
        yield i
        if i['type'] == 'title':
            subs = (i.get('system') or {}).get('items') or []
            for j in (subs.values() if isinstance(subs, dict) else subs):
                yield j


def compare(label, name, d, P, archived=None):
    s, rows = d['system'], []
    def eq(field, old, new):
        rows.append((field, old, new, old == new))
    idn, so, items = s['identity'], s['social'], d['items']
    eq('name = the id\'s', name, P.get('Name'))
    eq('Foundry\'s name, verbatim (Foundry Name, or Name when the same)', d['name'], P.get('Foundry Name', P.get('Name')))
    eq('identity.clan', idn['clan'], P.get('Clan'))
    eq('identity.family', idn['family'], P.get('Family'))
    sch = re.sub(r' School$', '', re.sub(r' \[[^\]]+\]$', '', idn['school']))
    eq('identity.school (less " School", "[Clan]"; SCHOOL_ALIAS)', SCHOOL_ALIAS.get(sch, sch), P.get('School'))
    eq('identity.school_rank', idn['school_rank'], P.get('School Rank'))
    eq('identity.roles (an empty one is none)', [x.strip() for x in idn['roles'].split(',') if x.strip()], P.get('Roles'))
    for r in ('air', 'earth', 'fire', 'water', 'void'):
        eq('rings.' + r, s['rings'][r], (P.get('Rings') or {}).get(r.title()))
    for k in ('honor', 'glory', 'status'):
        eq('social.' + k, so[k], P.get(k.title()))
    eq('social.ninjo', so['ninjo'], P.get('Ninjō'))
    eq('social.giri', so['giri'], P.get('Giri'))
    eq('social.bushido_tenets.paramount', so['bushido_tenets']['paramount'], (P.get('Bushido') or {}).get('Paramount Tenet'))
    eq('social.bushido_tenets.less_significant', so['bushido_tenets']['less_significant'], (P.get('Bushido') or {}).get('Less Significant Tenet'))
    for k in ('endurance', 'composure', 'focus', 'vigilance'):
        eq(k, s[k], P.get(k.title()))
    eq('void_points.max', s['void_points']['max'], P.get('Void Points'))
    eq('stance', s['stance'].title(), P.get('Stance'))
    eq('xp_total', s['xp_total'], P.get('Experience'))
    eq('Σ items xp_used', sum(i['system'].get('xp_used') or 0 for i in items), P.get('Experience Spent'))
    eq('ledger = items with xp_used', [(i['system']['xp_used'], i['name']) for i in items if i['system'].get('xp_used')],
       [(int(x.split(' · ')[0]), x.split(' · ')[1]) for x in P.get('Experience Ledger', [])])
    nz = sorted((k, v) for g in s['skills'].values() for k, v in g.items() if v)
    got = sorted((re.sub(r'^Martial Arts \[(\w+)\]$', lambda m: m.group(1).lower(), x.rsplit(' ', 1)[0]).lower(), int(x.rsplit(' ', 1)[1])) for x in P.get('Skills') or [])
    eq('skills (every non-zero rank)', nz, got)
    eq('techniques, a title\'s own included (less the school/title ability)', [plain(i['name']) for i in held(items) if i['type'] == 'technique' and i['system'].get('technique_type') not in COMES_WITH], P.get('Techniques'))
    eq('peculiarities: distinction + passion', [plain(i['name']) for i in items if i['type'] == 'peculiarity' and i['system']['peculiarity_type'] in ('distinction', 'passion')], P.get('Advantages'))
    eq('peculiarities: adversity + anxiety', [plain(i['name']) for i in items if i['type'] == 'peculiarity' and i['system']['peculiarity_type'] in ('adversity', 'anxiety')], P.get('Disadvantages'))
    eq('titles', [plain(i['name']) for i in items if i['type'] == 'title'], P.get('Titles', []))
    eq('bonds', [plain(i['name']) for i in items if i['type'] == 'bond'], P.get('Bonds', []))
    money = s.get('zeni') or 0
    eq('gear names + money', [i['name'] for i in items if i['type'] in ('weapon', 'armor', 'item')] + (['%d zeni' % money] if money else []), P.get('Equipment'))
    eq('as recorded: every item (and school) name the corpus spells otherwise', [i['name'] for i in held(items) if i['type'] in ('technique', 'peculiarity', 'title', 'bond') and i['system'].get('technique_type') not in COMES_WITH and plain(i['name']) != i['name'].replace('’', "'")] + ([idn['school']] if sch in SCHOOL_ALIAS else []), P.get('As Recorded', []))
    eq('money koku/bu/zeni all 0 (an empty field counts as 0)', {'koku': 0, 'bu': 0, 'zeni': 0}, {k: (v or 0) for k, v in s['money'].items()})
    for key in ('description', 'notes'):
        # the rich text read here with the stdlib parser, not the converter's regex
        eq(key + ' (as text, a line a paragraph)', text_of(s[key]), P.get(key.title(), ''))
    left = [i['type'] + ':' + i['name'] for i in items if i['type'] not in ('technique', 'peculiarity', 'title', 'bond', 'weapon', 'armor', 'item', 'advancement')]
    eq('no item of another type', [], left)
    if archived:
        eq('strife.value', s['strife']['value'], P.get('Strife'))
        eq('fatigue.value', s['fatigue']['value'], P.get('Fatigue'))
        eq('version label', archived[0], P.get('Version Label'))
        eq('version date', archived[1], P.get('Version Date'))
    extra = sorted(set(s) - set(NOT_CARRIED))
    eq('every system key accounted for', [], extra)
    bad = [r for r in rows if not r[3]]
    print('== %s: %d fields, %d differ' % (label, len(rows), len(bad)))
    for f, o, n, ok in bad:
        print('   DIFFERS  %-44s export=%r  built=%r' % (f, o, n))
    return len(rows), len(bad)


def main():
    only = sys.argv[1:]
    total = bad = sheets = 0
    for group, path in LAYERS:
        E = built(path)
        for pid, name, versions in group:
            if only and pid not in only:
                continue
            for f, label in versions:
                d = json.load(open(os.path.join(FOUNDRY, f), encoding='utf-8'))
                date = f.rsplit('.', 2)[1]
                eid = pid if label is None else pid + date.replace('-', '')
                if eid not in E:
                    print('== %s: NOT IN %s' % (eid, path)); bad += 1; continue
                P = props(E[eid])
                if label is not None and P.get('Version Of') != pid:
                    print('== %s: Version Of %r, expected %s' % (eid, P.get('Version Of'), pid)); bad += 1
                n, b = compare('%s ← %s' % (eid, f), name, d, P, (label, date) if label else None)
                total += n; bad += b; sheets += 1
    print('check_pcs: %s — %d fields compared across %d sheets, %d differ' % ('OK' if not bad else 'FAILED', total, sheets, bad))
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
