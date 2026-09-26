#!/usr/bin/env python3
"""corpus_index.py — find a name's entity in titterpig-dsl-l5r5e/0.5, the corpus the VTT's books are built from.

A name the corpus defines more than once is resolved to its ROOT — the DEF that does not EXTEND another
entity of the same name (a pregen's or an NPC's local copy extends the rule it copies) — preferring a
core-* file. Anything still ambiguous, or absent, is returned as such for the caller to refuse.
"""
import os, re, glob

CORPUS = os.environ.get('L5R5E_CORPUS', os.path.expanduser('~/Sortilege/Titterpig/DSL/titterpig-dsl-l5r5e/0.5'))
DEF = re.compile(r'^\s*(#[A-Za-z0-9]+) \^"((?:[^"\\]|\\.)*)" DEF \{')
EXT = re.compile(r'^\s*EXTENDS (#[A-Za-z0-9]+) \^"((?:[^"\\]|\\.)*)"')


def load():
    defs = {}   # name -> [ {hash, file, extends:(hash,name)|None} ]
    for path in sorted(glob.glob(os.path.join(CORPUS, '*'))):
        if not os.path.isfile(path):
            continue
        lines = open(path, encoding='utf-8').read().split('\n')
        for i, line in enumerate(lines):
            m = DEF.match(line)
            if not m:
                continue
            ext = None
            for nxt in lines[i + 1:i + 4]:
                e = EXT.match(nxt)
                if e:
                    ext = (e.group(1), e.group(2)); break
                if nxt.strip() and not nxt.strip().startswith('#'):
                    break
            defs.setdefault(m.group(2), []).append({'hash': m.group(1), 'file': os.path.basename(path), 'extends': ext})
    return defs


def resolve(defs, name):
    """(hash, None) for one root; (None, reason) otherwise."""
    cands = defs.get(name, [])
    if not cands:
        return None, 'not in the corpus'
    roots = [c for c in cands if not (c['extends'] and c['extends'][1] == name)]
    if len(roots) > 1:
        core = [c for c in roots if c['file'].startswith('l5r5e-0.5-core-')]
        if len(core) == 1:
            roots = core
    if len(roots) == 1:
        return roots[0]['hash'], None
    return None, 'ambiguous: ' + ', '.join('%s (%s)' % (c['hash'], c['file']) for c in (roots or cands))
