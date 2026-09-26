#!/usr/bin/env python3
"""The gate for M3: every word of the carried planning documents (campaign/source/planning/) is in the GM
tabs' seed (campaign/pack/seed.json), under its own heading, in order — and the seed holds nothing else.
Independent of absorb_planning.py: it reads the documents line by line with its own tokenizer, and the
seed by its titles; only the list of files and their id prefixes is shared.

    python3 campaign/source/check_planning.py        # exit 0 = every heading's words match

Allowed differences, and only these: Markdown marks (#, *, `, |, a "- " or "* " bullet, a "---" rule, a
table's |---| row, a code fence), the " · " the move puts between a table's cells, indentation, and the
one-line title of a document whose h1 has no text under it.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'campaign/source'))
from absorb_planning import DOCS  # noqa: E402  (the one table the two share: which files, which id prefix)

SEED = ROOT / 'campaign/pack/seed.json'


def words(t):
    out = []
    for w in t.split():
        w = w.replace('*', '').replace('`', '').replace('|', '')
        if w and w not in ('-', '>', '·'):
            out.append(w)
    return out


def key(h):
    return ' '.join(words(h.lstrip('#')))


def doc_blocks(text, plain):
    """{heading: [words]} and the order; a plain notes file is one block titled by its first line."""
    if plain:
        lines = text.replace('\r', '').split('\n')
        return {key(lines[0]): words('\n'.join(lines[1:]))}, [key(lines[0])]
    blocks, order, cur, fence = {}, [], None, False
    for line in text.split('\n'):
        if line.strip().startswith('```'):
            fence = not fence
            continue
        if not fence and re.match(r'^#{1,6}\s', line):
            cur = key(line)
            if cur in blocks:
                sys.exit('two headings %r in one document — the check cannot key them' % cur)
            blocks[cur] = []
            order.append(cur)
            continue
        if not fence and (re.match(r'^\s*-{3,}\s*$', line) or re.match(r'^\s*\|(\s*:?-{2,}:?\s*\|)+\s*$', line)):
            continue
        if cur is None:
            if words(line):
                sys.exit('text before the first heading: ' + line[:60])
            continue
        blocks[cur] += words(line)
    return blocks, order


def seed_blocks(entries, headings):
    """{title: [words]} from seed entries: a title, its text split at **bold** lines that are headings."""
    out = {}

    def put(k, ws):
        if k in out:
            sys.exit('the seed has two blocks titled %r' % k)
        out[k] = ws

    def text(title, t):
        k, ws = key(title), []
        for line in (t or '').split('\n'):
            m = re.match(r'^\*\*(.+)\*\*$', line.strip())
            if m and key(m.group(1)) in headings:
                put(k, ws)
                k, ws = key(m.group(1)), []
                continue
            ws += words(line)
        put(k, ws)

    for e in entries:
        text(e['title'], e.get('text'))
        for s in e.get('sections') or []:
            text(s['title'], s.get('text'))
    return out


def main():
    seed = json.loads(SEED.read_text())
    gm = seed['gm']
    every = gm['overview'] + gm['people'] + gm['pc'] + seed['threads'] + seed['arc']
    bad = n_words = n_blocks = 0
    claimed = set()
    for fname, pid, top, how in DOCS:
        text = (ROOT / 'campaign/source/planning' / fname).read_text(encoding='utf-8')
        want, order = doc_blocks(text, top == 0)
        mine = [e for e in every if e['id'] == pid or e['id'].startswith(pid + '-')]
        claimed |= {e['id'] for e in mine}
        have = seed_blocks(mine, set(want))
        for k in order:
            if k not in have:
                if want[k] == [] and not any(e['title'] for e in mine if key(e['title']) == k):
                    # an empty heading: a document's title, or a scene group, carried as structure only
                    n_blocks += 1
                    continue
                print('FAIL %s: heading %r is not in the seed' % (fname, k)); bad += 1; continue
            n_blocks += 1
            n_words += len(want[k])
            if have[k] != want[k]:
                bad += 1
                print('FAIL %s: %r' % (fname, k))
                for i, (a, b) in enumerate(zip(want[k], have[k])):
                    if a != b:
                        print('   doc : ' + ' '.join(want[k][max(0, i - 6):i + 8]))
                        print('   seed: ' + ' '.join(have[k][max(0, i - 6):i + 8]))
                        break
                else:
                    print('   %d words in the document, %d in the seed' % (len(want[k]), len(have[k])))
        for k in have:
            if k not in want:
                print('FAIL %s: the seed has %r, which the document does not' % (fname, k)); bad += 1
    stray = [e['id'] for e in every if e['id'] not in claimed]
    if stray:
        print('FAIL entries in the seed from no document: %s' % stray); bad += 1
    print('%s: %d documents, %d headings, %d words — %d failures' % ('PASS' if not bad else 'FAIL', len(DOCS), n_blocks, n_words, bad))
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
