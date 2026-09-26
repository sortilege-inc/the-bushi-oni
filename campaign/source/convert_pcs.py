#!/usr/bin/env python3
"""
convert_pcs.py — one-way conversion of the player characters' Foundry sheets into the campaign's DSL
layer, as instances of the corpus's ACTOR "Samurai".

    python3 campaign/source/convert_pcs.py

The record is campaign/source/foundry/: the Foundry `l5r5e` actor exports, copied BYTE FOR BYTE from
the support folder's archive (the-bushi-oni-support/archive/foundry-export/<date>/actors/). SHEETS below
names which export is each character's current sheet and which are archived versions.

campaign/dsl/bushi-oni-pcs.actor carries each sheet in every field the Samurai ACTOR declares, in the
corpus's pregen conventions (Portents' convert_norikage.py): skills as "Name N" strings, techniques,
advantages, disadvantages, titles and bonds as references to the corpus's own entities by hash
(corpus_index.py finds the root DEF of a name), gear as names. What the sheet adds: the stance, the XP
spent and its ledger, and — where Foundry's name for an item is not the corpus's (a specifier such as
"Dark Secret (In love with …)", a clan suffix such as "(Crab)") — the Foundry name verbatim in
^"As Recorded", so nothing the table wrote is lost. School abilities (and a title's ability) come with
the School (and the Title), as in Portents. An archived sheet is its own DEF, ^"Version Of" the current.

Anything that does not resolve stops the conversion — nothing is dropped silently.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(HERE, 'campaign/source'))
from corpus_index import load, resolve  # noqa: E402

SAMURAI = '#L5R003xY4zA6bC8dE0fG2hI ^"Samurai"'
TECH, ADV, DIS = '#L5R350fG9hI1jK3lM5nO7p ^"Technique"', '#L5R263hI5jK7lM9nO1pQ3r ^"Advantage"', '#L5R264sT6uV8wX0yZ2aB4c ^"Disadvantage"'
TITLE, BOND = '#L5R463nO5pQ7rS9tU1vW3x ^"Title"', '#L5R262wX4yZ6aB8cD0eF2g ^"Bond"'
FOUNDRY = os.path.join(HERE, 'campaign/source/foundry')

# (id, the name the character goes by, [(export, version label or None for the current sheet)])
SHEETS = [
    ('#BOpcKitsukiHasumi', 'Kitsuki Hasumi', [('fvtt-Actor-kitsuki-hasumi-1OU8cpsBQL7Jq8ea.2026-01-06.json', None)]),
    ('#BOpcIsawaEndo', 'Isawa Endo', [('fvtt-Actor-isawa-endo-9kviwZhYsPXY7lGx.2026-01-04.json', None)]),
    ('#BOpcBayushiTaigen', 'Bayushi Taigen', [('fvtt-Actor-bayushi-taigen-Wc1j7VDOVXJDRqq9.2026-01-04.json', None),
                                              ('fvtt-Actor-bayushi-taigen-Wc1j7VDOVXJDRqq9.2025-12-01.json', 'Foundry export · 1 Dec 2025')]),
    # the backup character: Foundry's name carries the tag "[backup character]"; the entity is named as the person
    ('#BOpcKitsuneYuma', 'Kitsune Yuma', [('fvtt-Actor-kitsune-yuma[backup-character]-OADa0UOcFVEbsyEm.2026-02-17.json', None)]),
]

MARTIAL = {'melee': 'Martial Arts [Melee]', 'ranged': 'Martial Arts [Ranged]', 'unarmed': 'Martial Arts [Unarmed]'}
# Foundry's name → the corpus's, where they differ by more than a clan suffix, a specifier or the apostrophe
ALIAS = {'Sword Saint': 'Sword-Saint', 'Lover': 'Lover Bond'}
ADVANTAGE_TYPES, DISADVANTAGE_TYPES = {'distinction', 'passion'}, {'adversity', 'anxiety'}
COMES_WITH = {'school_ability', 'mastery_ability', 'title_ability'}
GEAR = {'weapon', 'armor', 'item'}


def q(s):
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n') + '"'


def corpus_name(name):
    """The corpus's name for a Foundry item name: apostrophe, then a trailing (Clan) / [spec] / ": spec" off."""
    n = name.replace('\u2019', "'").strip()
    n = ALIAS.get(n, n)
    base = re.sub(r'\s*(\([^)]*\)|\[[^\]]*\])$', '', n)
    base = base.split(':')[0].strip()
    return ALIAS.get(base, base)


def html_text(h):
    """Foundry's rich text as plain text: one line per paragraph (or <br>), tags off, entities decoded, empty lines dropped."""
    import html
    parts = re.split(r'</p>|<br\s*/?>', h or '')
    lines = [html.unescape(re.sub(r'<[^>]+>', '', x)).strip() for x in parts]
    return '\n'.join(x for x in lines if x)


def school_name(s):
    return re.sub(r'\s+School$', '', re.sub(r'\s*\[[^\]]*\]$', '', s.strip()))


class Unresolved(Exception):
    pass


def ref(D, kind, name):
    n = corpus_name(name) if kind != 'raw' else name
    h, why = resolve(D, n)
    if not h:
        # a specifier the corpus spells in the name itself (e.g. "Ally [Name]", "Dark Secret (Void)")
        h2, _ = resolve(D, name.replace('\u2019', "'"))
        if h2:
            return h2, name.replace('\u2019', "'")
        raise Unresolved('%s: %s' % (name, why))
    return h, n


def fields(D, d, archived=False):
    s = d['system']; idn = s['identity']; so = s['social']
    techs, adv, dis, titles, bonds, recorded, ledger, gear = [], [], [], [], [], [], [], []
    for it in d['items']:
        t, si, nm = it['type'], it['system'], it['name']
        used = si.get('xp_used') or 0
        if used:
            ledger.append('%d · %s · rank %s' % (used, nm, si.get('bought_at_rank')))
        if t == 'technique':
            if si.get('technique_type') in COMES_WITH:
                continue
            h, cn = ref(D, 'technique', nm); techs.append('%s ^"%s"' % (h, cn))
        elif t == 'peculiarity':
            h, cn = ref(D, 'peculiarity', nm)
            k = si.get('peculiarity_type')
            if k in ADVANTAGE_TYPES: adv.append('%s ^"%s"' % (h, cn))
            elif k in DISADVANTAGE_TYPES: dis.append('%s ^"%s"' % (h, cn))
            else: raise Unresolved('%s: a peculiarity of no known kind (%s)' % (nm, k))
        elif t == 'title':
            h, cn = ref(D, 'title', nm); titles.append('%s ^"%s"' % (h, cn))
        elif t == 'bond':
            h, cn = ref(D, 'bond', nm); bonds.append('%s ^"%s"' % (h, cn))
        elif t in GEAR:
            gear.append(nm); continue
        elif t == 'advancement':
            continue
        else:
            raise Unresolved('%s: an item of no known type (%s)' % (nm, t))
        if cn != nm.replace('\u2019', "'"):
            recorded.append(nm)
    sch = school_name(idn['school'])
    if not resolve(D, sch)[0]:
        raise Unresolved('school %s → %s: not in the corpus' % (idn['school'], sch))
    skills = []
    for grp in s['skills'].values():
        for k, v in grp.items():
            if v:
                skills.append('%s %d' % (MARTIAL.get(k, k.title()), v))
    m = {k: (v or 0) for k, v in s['money'].items()}          # an empty field (None) is none of it
    money = [x for x in ('%d koku' % m.get('koku', 0), '%d bu' % m.get('bu', 0), '%d zeni' % (m.get('zeni', 0) + (s.get('zeni') or 0))) if not x.startswith('0 ')]
    r = s['rings']
    P = [
        '^"Name" STRING %s FIXED' % q(NAME),
        '^"Clan" STRING %s FIXED' % q(idn['clan']),
        '^"Family" STRING %s FIXED' % q(idn['family']),
        '^"School" STRING %s' % q(sch),
        '^"School Rank" INTEGER %d' % idn['school_rank'],
        '^"Roles" LIST OF STRING [%s]' % ', '.join(q(x.strip()) for x in idn['roles'].split(',') if x.strip()),
        '^"Rings" DEF { ' + ' '.join('^"%s" INTEGER %d' % (k.title(), r[k]) for k in ('air', 'earth', 'fire', 'water', 'void')) + ' }',
        '^"Honor" INTEGER %d' % so['honor'], '^"Glory" INTEGER %d' % so['glory'], '^"Status" INTEGER %d' % so['status'],
        '^"Endurance" INTEGER %d' % s['endurance'], '^"Composure" INTEGER %d' % s['composure'],
        '^"Focus" INTEGER %d' % s['focus'], '^"Vigilance" INTEGER %d' % s['vigilance'],
        '^"Void Points" INTEGER %d' % s['void_points']['max'],
        '^"Ninjō" STRING %s' % q(so['ninjo']),
        '^"Giri" STRING %s' % q(so['giri']),
        '^"Skills" LIST OF STRING [%s]' % ', '.join(q(x) for x in skills),
        '^"Techniques" LIST OF %s [%s]' % (TECH, ', '.join(techs)),
        '^"Advantages" LIST OF %s [%s]' % (ADV, ', '.join(adv)),
        '^"Disadvantages" LIST OF %s [%s]' % (DIS, ', '.join(dis)),
    ]
    if titles: P.append('^"Titles" LIST OF %s [%s]' % (TITLE, ', '.join(titles)))
    if bonds: P.append('^"Bonds" LIST OF %s [%s]' % (BOND, ', '.join(bonds)))
    P += [
        '^"Equipment" LIST OF STRING [%s]' % ', '.join(q(x) for x in gear + money),
        '^"Bushido" DEF { ^"Paramount Tenet" STRING %s ^"Less Significant Tenet" STRING %s }' % (q(so['bushido_tenets']['paramount']), q(so['bushido_tenets']['less_significant'])),
        '^"Experience" INTEGER %d' % s['xp_total'],
        # what the sheet adds to the ACTOR's fields
        '^"Experience Spent" INTEGER %d' % sum((it['system'].get('xp_used') or 0) for it in d['items']),
    ]
    if ledger: P.append('^"Experience Ledger" LIST OF STRING [%s]' % ', '.join(q(x) for x in ledger))
    P.append('^"Stance" STRING %s' % q(s['stance'].title()))
    for key, label in (('description', 'Description'), ('notes', 'Notes')):
        if html_text(s[key]):
            P.append('^"%s" STRING %s' % (label, q(html_text(s[key]))))
    if archived:
        P += ['^"Strife" INTEGER %d' % s['strife']['value'], '^"Fatigue" INTEGER %d' % s['fatigue']['value']]
    if recorded: P.append('^"As Recorded" LIST OF STRING [%s]' % ', '.join(q(x) for x in recorded))
    return P


def block(h, name, P, comment):
    return '    # %s\n    %s ^"%s" DEF {\n        EXTENDS %s\n        PROPERTIES {\n%s\n        }\n    }\n' % (
        comment, h, name, SAMURAI, '\n'.join('            ' + p for p in P))


NAME = None


def main():
    global NAME
    D = load()
    only = sys.argv[1:]          # pilot: convert_pcs.py '#BOpcKitsukiHasumi'
    blocks, errors = [], []
    for pid, name, versions in SHEETS:
        if only and pid not in only:
            continue
        NAME = name
        for f, label in versions:
            d = json.load(open(os.path.join(FOUNDRY, f), encoding='utf-8'))
            try:
                if label is None:
                    blocks.append(block(pid, name, fields(D, d), 'The current sheet: foundry/%s.' % f))
                else:
                    date = f.rsplit('.', 2)[1]
                    P = ['^"Version Of" %s ^"%s"' % (pid, name), '^"Version Label" STRING %s' % q(label), '^"Version Date" STRING %s' % q(date)] + fields(D, d, archived=True)
                    blocks.append(block(pid + date.replace('-', ''), '%s (%s)' % (name, label.split(' · ')[1]), P, 'Archived: foundry/%s.' % f))
            except Unresolved as e:
                errors.append('%s (%s): %s' % (name, f, e))
    if errors:
        print('\n'.join('UNRESOLVED ' + e for e in errors)); sys.exit(1)
    text = '''EXTENSION "BushiOni_Characters" {
    NAME "The Bushi Oni — the player characters"
    VERSION "0.1.0"
    SPEC_VERSION "0.5"
    RELEASE_DATE "2026-09-26"
    DEPENDS_ON "L5R5e_Core_Core"

    # The task force: instances of the Samurai ACTOR in the corpus's pregen conventions. Converted from
    # campaign/source/foundry/ (the Foundry exports, byte for byte) by campaign/source/convert_pcs.py;
    # campaign/source/check_pcs.py reads the built layer back against them field by field.

%s}
''' % '\n'.join(blocks)
    out = os.path.join(HERE, 'campaign/dsl/bushi-oni-pcs.actor')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w', encoding='utf-8').write(text)
    print('wrote campaign/dsl/bushi-oni-pcs.actor: %d sheets' % len(blocks))


if __name__ == '__main__':
    main()
