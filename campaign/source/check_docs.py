#!/usr/bin/env python3
"""check_docs.py — every image and link in the campaign's documents (campaign/docs/*.html) and portraits
(campaign/site/portraits.js) resolves: a file exists for each src, and each #tab/path link names one of the
site's campaign tabs with an anchor in its document, or a character of the built layers.

    python3 campaign/source/check_docs.py      # exit 0 = nothing broken
"""
import glob
import os
import re
import sys
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
os.chdir(ROOT)
# tab id → the document it draws (campaign/site/site.js); `characters` is the VTT's own tab
DOC_OF = {'bushi-oni': 'home', 'chronicle': 'chronicle', 'personae': 'personae', 'map': 'map'}


def main():
    anchors = {Path(f).stem: set(re.findall(r'id="([^"]+)"', Path(f).read_text())) for f in glob.glob('campaign/docs/*.html')}
    chars = set()
    for f in glob.glob('campaign/dsl*/*.actor'):
        chars |= set(re.findall(r'^\s*(#BO\w+) \^"', Path(f).read_text(), re.M))
    n = bad = 0
    for f in sorted(glob.glob('campaign/docs/*.html')):
        s = Path(f).read_text()
        for src in re.findall(r'(?:src|data-src)="([^"]+)"', s):
            n += 1
            if not os.path.isfile(src):
                print('MISSING  %s: %s' % (f, src)); bad += 1
        for h in re.findall(r'href="([^"]+)"', s):
            n += 1
            if not h.startswith('#'):
                print('EXTERNAL %s: %s' % (f, h)); continue
            parts = [urllib.parse.unquote(p) for p in h[1:].split('/')]
            if parts[0] == 'characters':
                if len(parts) > 1 and parts[1] not in chars:
                    print('NO CHARACTER %s: %s' % (f, h)); bad += 1
            elif parts[0] not in DOC_OF:
                print('NO TAB   %s: %s' % (f, h)); bad += 1
            elif len(parts) > 1 and parts[0] != 'map' and parts[1] not in anchors[DOC_OF[parts[0]]]:
                print('NO ANCHOR %s: %s' % (f, h)); bad += 1
    for src in re.findall(r"'(campaign/[^']+)'", Path('campaign/site/portraits.js').read_text()):
        n += 1
        if not os.path.isfile(src):
            print('MISSING  portraits.js: %s' % src); bad += 1
    print('check_docs: %s — %d links and sources, %d broken' % ('OK' if not bad else 'FAILED', n, bad))
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
