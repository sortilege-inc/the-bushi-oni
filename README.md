# The Bushi Oni

A **Legend of the Five Rings 5th Edition** campaign, run as an **instance** of
[`sortilege-vtt-l5r5e`](https://github.com/sortilege-inc/sortilege-vtt-l5r5e): a fork of the VTT
that owns `campaign/` and a few per-deployment root files, and never edits upstream.

- `/` — the site: the campaign's tabs, then the VTT's reference tabs and dice (the books' own text
  is off on the public site; the GM turns it on per browser in Settings).
- `/gm/` — the GM's table, behind a gate.
- `campaign/` — the campaign's own material; `campaign/PLAN.md` is the plan and decision log.

Pull upstream with a merge, never a rebase:

```bash
git config merge.ours.driver true   # once per clone
git fetch upstream && git merge upstream/main
```

The instance-owned files (`.gitattributes`, `merge=ours`) keep this repo's copy on every pull; a key
upstream adds to `engine/config.js` is carried by hand. The process is `~/Sortilege/VTT/INSTANCES.md`.
