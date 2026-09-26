# The Bushi Oni × sortilege-vtt-l5r5e — plan and decision log

A **Legend of the Five Rings 5th Edition** campaign: a task force of low-ranked outsiders
investigating the murders of the Emperor's exemplars of Bushidō in Otosan Uchi. It is built as an
**instance** of `sortilege-vtt-l5r5e`. The process is `~/Sortilege/VTT/INSTANCES.md`. Portents &
Fortunes is the reference instance on this VTT; Caul (Daggerheart) and Blood & Other Drugs (VtM5e)
are the other examples.

Status words: **PROPOSED** (awaiting the owner), **(owner)** decided, **landed** built and proven.

## Where things are

| What | Where |
|---|---|
| This repo | `sortilege-inc/the-bushi-oni`, **PUBLIC** (created so by the owner 2026-09-26); cloned into `~/Sortilege/Campaigns/2026 The Bushi Oni/the-bushi-oni`; identity Jordan Peacock <jordan@sortilege.online>; `merge.ours.driver` set |
| Upstream | `sortilege-inc/sortilege-vtt-l5r5e` (private), remote `upstream`; forked at `312af2b` |
| Support folder | `../the-bushi-oni-support/` — never in the repo. `archive/` in Caul's buckets, filled from `~/Downloads/2026 The Bushi Oni` by `scripts/sort_downloads.py` (47,358 files moved, 0 left behind) |
| Dev | launch `bushi-oni` (site, 8749) and `bushi-oni-worker` (`wrangler dev`, 8799) |
| Work branch | `vtt-instance`; `main` is fast-forwarded to it at deploy |

### The archive (read 2026-09-26)

| Bucket | Holds |
|---|---|
| `foundry-export/<date>/actors/` | Foundry `l5r5e` actor exports, dated by file: **PCs** Kitsuki Hasumi (Dragon, Kitsuki Investigator, 01-06), Isawa Endo (Phoenix, Isawa Elementalist, 01-04), Bayushi Taigen (Scorpion; 12-01 Shiba Guardian → 01-04 Hida Defender); Iuchi Reijun (Unicorn, Meishōdō Master; *left the campaign*, 12-01 and 12-26); Kitsune Yuma (Fox, *backup character*, 02-17). **2025-10-27**: six pregens (named in the archive, not here: some are the GM's secrets). `logs/` a Foundry client log |
| `my-archivist-export/2026-01-24/` | Archivist recaps, moments and timelines for 2026-01-06 *The Summons* and 2026-01-20 *Interrogation & Investigation*; World Summary; 3 PC / 17 NPC / 13 location / 12 faction pages. **AI-generated from transcripts — raw material, never the site's voice** (Caul's *Omer's Rest* lesson; B&OD O2) |
| `transcriptions/` + `recordings/` | 2025-10-21 character creation; 2025-10-24 note to self; 2026-01-06; 2026-01-20 (parts 1, 2 and full); 2026-01-27 (**no Archivist recap**) |
| `reference/planning/` | The GM's design documents: campaign summary, *Revised* and *Final* campaign drafts, the 1120 reference, the Seven Imperial Advisors, investigation planning, *Parallel Investigation*, *Bushi Oni Characters* (the table's roster + GM notes), *L5R Rewrite Public.docx* |
| `reference/timeline/`, `reference/census/` | The Rokugan timeline workbook + its CSV sheets; the Imperial Census workbook + court/imperial CSVs |
| `reference/character-sheets/` | Blank FFG sheets (character, court, campaign, school worksheet, army, discord wheel) |
| `reference/l5r-wiki/` + `L5R Wiki.zip` | The 47,169-page l5r.fandom scrape — the same source `l5r-lore` indexes; kept as the campaign had it |
| `sourcebooks/` | *Little Truths* (3rd-party, already a corpus — see memory `little-truths-l5r5e-3rdparty`), Errata FAQ v20 |
| `art/` | `bushi-oni.png` key art; `portraits/` (33: PCs, NPCs, Midjourney variants); `tokens/` (9) |
| `maps/` | Otosan Uchi (png + xcf, two versions), the FFG Otosan Uchi map and poster tiles, castle/bathhouse battle maps, *Courts of Stone* Last Breath map |

## Decisions

**B1 — The fork (landed 2026-09-26).** The repo was empty, so there was nothing to move: `vtt-instance`
was set to `upstream/main` (`312af2b`) and the boundary files added on top. Instance-owned root files
per INSTANCES.md: `engine/config.js`, `worker/wrangler.jsonc` (Worker `the-bushi-oni`), `README.md`,
`.gitignore` (+`!.claude/skills/`), `.claude/launch.json`, `.gitattributes` (`merge=ours`).

**B2 — The family standards from the start (landed 2026-09-26).** `ownAdventure` + `hidePanes:
['adventure', 'notes']`, the `/gm/` gate ("The Magistrate's Papers"), `siteBooks: false`, robots
(upstream I19). Proven on :8749 — site title *The Bushi Oni*, the books' tabs closed, the robots meta
present, no console errors; `/gm/` shows the gate, *Enter* opens the GM page with Adventure and Notes
absent and the overview pane titled *The Bushi Oni*.

**B3 — PROPOSED: where the GM's material lives, given a public repo and several players.**
Portents (solo) and Caul keep the GM's material in the public `campaign/pack/seed.json`. Here, three
players at the table could read the solution — e.g. `reference/planning/Bushido_Oni_Campaign_Final.md`
names who ordered the murders, who carried them out and who the maho-tsukai is — readable
straight off GitHub. (This plan is public too, so it names no one.)
*Recommendation:* keep the repo public (the books publish as Portents' do), but **build the GM pack
into the support folder** (`the-bushi-oni-support/build/pack/bushi-oni-gm.json`) and load it once
through the Campaign pane's *Restore pack…*; the public repo carries only player-facing material.
Trade-off: a fresh browser does not self-seed — the GM restores the pack once per browser.
Alternative: a public seed like Portents (simplest; the solution is readable by the players).

**B4 — PROPOSED: the sources of truth.** Following B&OD O2: **Foundry for records** (the latest dated
export of each PC; a live pull over the relay when the owner supplies a key), **the GM's planning
documents for setting and the conspiracy**, **the Chronicle written by hand from the transcripts**
(the Archivist pages are raw material only).

**B5 — PROPOSED: who is a PC.** From *Bushi Oni Characters.md*: Kitsuki Hasumi, Isawa Endo, Bayushi
Taigen. Iuchi Reijun *left the campaign* (kept as an earlier version, not on the roster); Kitsune Yuma
is a *backup character* (a PC version held in reserve). The six 2025-10-27 pregens become NPCs; which of them are secret is the GM's to mark in the pack.

## Milestones

| | What | Status |
|---|---|---|
| M0 | Support folder sorted; fork; boundary; standards; local proof | **landed** 2026-09-26 |
| M1 | PCs into `campaign/dsl/` as `ACTOR Samurai` instances, converted from the Foundry exports by a script in `campaign/source/`, piloted on one PC and checked field by field (planted difference must fail), every version kept | waits on B4/B5 |
| M2 | NPCs (the pregens, then the named cast) as full statblocks on the corpus's NPC type | after M1 |
| M3 | GM material into the pack (overview, threads, places, people) by a deterministic converter + an independent every-word check | waits on B3 |
| M4 | Site tabs: home, Chronicle (sessions 2026-01-06, 01-20, 01-27, hand-written from the transcripts), Dramatis Personae from the layer, the Otosan Uchi map | after M1–M2 |
| M5 | Deploy: Worker `the-bushi-oni`, Pages, a domain — each step confirmed with the owner | owner's go |

## Decision log

- 2026-09-26 — Archive buckets follow Caul/B&OD; the Otosan Uchi map-and-poster set kept as its own
  folder under `maps/`; blank sheets under `reference/character-sheets/`; the wiki scrape under
  `reference/` rather than `sourcebooks/` (it is lore, not rules). Browser `(1)` duplicates of Foundry
  exports are different, older exports — each kept under its own file date, not overwritten.
- 2026-09-26 — Dev ports 8749/8799 (free across every launch.json under `~/Sortilege` and `~/.claude`).
- 2026-09-26 — `instance: null` until M1 — no empty stage scripts shipped.

## To resume

```bash
cd "~/Sortilege/Campaigns/2026 The Bushi Oni/the-bushi-oni"
git config merge.ours.driver true          # once per clone
git fetch upstream && git merge upstream/main   # never rebase; stash engine/config.js first if dirty
```
