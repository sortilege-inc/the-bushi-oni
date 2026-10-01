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
| `reference/planning/` | The GM's design documents: campaign summary, *Revised* and *Final* campaign drafts, the 1120 reference, the Seven Imperial Advisors, investigation planning, *Parallel Investigation*, *Bushi Oni Characters* (the table's roster + GM notes). (*L5R Rewrite Public.docx*, a third-party rules rewrite, was removed by the owner 2026-09-27.) |
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
Boundary proven in throwaway clones (a fake upstream commit editing `engine/config.js`'s title line
and appending to `engine/app.js`): without the driver the merge exits 1, `CONFLICT … engine/config.js`;
with it the merge exits 0, `config.js` keeps *The Bushi Oni* (0 upstream lines) and `app.js` takes the
upstream change.

**B2 — The family standards from the start (landed 2026-09-26).** `ownAdventure` + `hidePanes:
['adventure', 'notes']`, the `/gm/` gate ("The Magistrate's Papers"), `siteBooks: false`, robots
(upstream I19). Proven on :8749 — site title *The Bushi Oni*, the books' tabs closed, the robots meta
present, no console errors; `/gm/` shows the gate, *Enter* opens the GM page with Adventure and Notes
absent and the overview pane titled *The Bushi Oni*.

**B3 — (owner, 2026-09-26) the Portents way: the GM's material is the public `campaign/pack/seed.json`.**
The owner chose it over the recommendation below, knowing the players can read it.
Portents (solo) and Caul keep the GM's material in the public `campaign/pack/seed.json`. Here, three
players at the table could read the solution — e.g. `reference/planning/Bushido_Oni_Campaign_Final.md`
names who ordered the murders, who carried them out and who the maho-tsukai is — readable
straight off GitHub. (This plan is public too, so it names no one.)
*Recommendation:* keep the repo public (the books publish as Portents' do), but **build the GM pack
into the support folder** (`the-bushi-oni-support/build/pack/bushi-oni-gm.json`) and load it once
through the Campaign pane's *Restore pack…*; the public repo carries only player-facing material.
Trade-off: a fresh browser does not self-seed — the GM restores the pack once per browser.
Alternative: a public seed like Portents (simplest; the solution is readable by the players).

**B4 — (owner, 2026-09-26) the sources of truth.** Following B&OD O2: **Foundry for records** (the latest dated
export of each PC; a live pull over the relay when the owner supplies a key), **the GM's planning
documents for setting and the conspiracy**, **the Chronicle written by hand from the transcripts**
(the Archivist pages are raw material only).

**B5 — (owner, 2026-09-26) who is a PC.** From *Bushi Oni Characters.md*: Kitsuki Hasumi, Isawa Endo, Bayushi
Taigen. Iuchi Reijun *left the campaign* (kept as an earlier version, not on the roster); Kitsune Yuma
is a *backup character* (a PC version held in reserve). The six 2025-10-27 pregens become NPCs; which of them are secret is the GM's to mark in the pack.

## Milestones

| | What | Status |
|---|---|---|
| M0 | Support folder sorted; fork; boundary; standards; local proof | **landed** 2026-09-26 |
| M1 | PCs into `campaign/dsl/` as `ACTOR Samurai` instances, converted from the Foundry exports by a script in `campaign/source/`, piloted on one PC and checked field by field (planted difference must fail), every version kept | **landed** 2026-09-26 |
| M2 | The six 2025-10-27 pregens as **GM characters**: full sheets like the PCs, in a layer (a book) of their own | **landed** 2026-09-26 |
| M3 | GM material into the pack (overview, threads, places, people) by a deterministic converter + an independent every-word check | **landed** 2026-09-26 |
| M4 | Site tabs: home, Chronicle (sessions 2026-01-06, 01-20, 01-27, hand-written from the transcripts), Dramatis Personae (the named cast — no statblocks exist for them), the Otosan Uchi map | **landed** 2026-09-26 |
| M5 | Deploy: Worker `the-bushi-oni`, Pages at the default github.io address (owner, 2026-09-26) | **landed** 2026-09-26 |

**M1 — the player characters (landed 2026-09-26).** `campaign/source/foundry/` holds the five Foundry
exports byte for byte (`cmp` against the archive: identical). `convert_pcs.py` writes
`campaign/dsl/bushi-oni-pcs.actor` — Hasumi, Endo, Taigen (current 2026-01-04 + the 2025-12-01 sheet as a
version) and Yuma; `corpus_index.py` resolves every technique, peculiarity, title and bond to its root
DEF in the corpus, and the conversion stops on anything unresolved. `check_pcs.py` reads the BUILT layer
back against the exports with its own parsing.
- Pilot (Hasumi): `check_pcs.py '#BOpcKitsukiHasumi'` → 40 fields, 0 differ. Planted Honor 45→46 and a
  dropped skill in the DSL → exit 1, both named; restored → 0 differ.
- All: `build_layer.sh` → OK (214 strings, 0 uncovered/short/unsourced; 5 ids, none the corpus's; every
  reference resolves); `check_pcs.py` → **209 fields across 5 sheets, 0 differ**. The first full run
  failed on Taigen's and Yuma's Foundry notes/description (backstory the converter had dropped); they are
  now carried as `Description`/`Notes` text.
- Browser (:8749): the Characters tab lists the four under *The Bushi Oni* (the version is not a fifth);
  Taigen's sheet shows every field; on `/gm/` Party, Hasumi's derived values from the corpus's formulas
  are Endurance 8, Composure 6, Focus 5, Vigilance 2 — the export's. No console errors. (On the public
  site's character page the derived line reads "?" for every character, corpus pregens included —
  upstream behaviour with the core book not loaded there, not the layer's.)

**M2 — the GM's characters (owner, 2026-09-26: "convert them as full sheets, like the PCs, but track them
separately, as GM PCs"; landed 2026-09-26).** The corpus gives no formula for an NPC's conflict ranks, so an
NPC statblock would have meant inventing numbers; the owner chose full sheets. The six exports (copied byte
for byte, `cmp` identical) are `GM_SHEETS` in `convert_pcs.py`, written to `campaign/dsl-gm/bushi-oni-gm-pcs.actor`
and built as a second layer — its own book, *The Bushi Oni — GM characters* (`campaign-gm` → `campaign/data-gm/`),
loaded before the players' so the players' book leads the shelf.
- Resolving them needed an explicit alias table (a spelling, a case, a " Bond" suffix, and four of the
  corpus's templated entries filled in by the table — e.g. `Blackmail on [Name]`, `Support of [One Group]`)
  and one school alias (Foundry's "Shoshuro Shadoweaver" = the corpus's *Shosuro Shadowweaver*, Celestial
  Realms). Foundry's own wording is kept verbatim in `As Recorded`, and Foundry's actor name (with its XP
  and title, e.g. "… 74 XP (Gunsō, Rank 3)") in `Foundry Name`.
- `build_layer.sh campaign/dsl-gm campaign-gm "The Bushi Oni — GM characters" campaign/data-gm` → OK (339
  strings, 0 uncovered/short/unsourced; 6 ids, none the corpus's; every reference resolves).
- `check_pcs.py` → **455 fields across 11 sheets, 0 differ**. The first run failed on two corpus entities
  whose names carry brackets (*Shadowlands Taint (Air)*, *Stalked by [Creature]*) — the check's list, not
  the data; planted Glory +1 on one GM character → exit 1, named; restored → 0 differ.
- Browser (:8749): the Characters tab shows *The Bushi Oni* (4) then *The Bushi Oni — GM characters* (6);
  the GM's party picker labels each with its book. No console errors.

**M3 — the GM's material into the GM tabs (landed 2026-09-26).** `campaign/source/planning/` holds the five
carried documents byte for byte (`cmp` identical); `absorb_planning.py` writes `campaign/pack/seed.json`
(public, B3) and `engine/config.js` names it as `defaultCampaign.seed`. Headings become sections and
subsections (deeper ones bold lines), tables a header line and a list, the code-fence diagram plain lines;
no word changes.
- Where it went: the *Final* draft's overview, conspiracies, murder timeline and task force → **Overview**;
  the advisors, their positions and the key NPCs → **Cast** (the key-NPC section linked to the two GM
  characters it names); its three investigation threads → **Threads**; the 1120 reference's four parts →
  **Overview**; the 27 Jan session plan's seven scenes → **Scenes** ("Prepared for 27 Jan 2026", none marked
  played), its state, order and GM notes → an Overview section; *Bushi Oni Characters* → **Party** notes
  (linked to the PCs, Yuma and Hiruma Kaede); *Parallel Investigation* → **Overview**.
- `check_planning.py` (its own tokenizer, heading by heading, both directions) → **PASS: 5 documents, 98
  headings, 7,779 words, 0 failures**; the 7,779 matches an independent count of every body word. Planted
  a dropped word, a swapped pair and an added word → exit 1, all three named; restored → PASS.
- Browser (:8749 `/gm/`): the seed filled the local campaign (72 entries, the party member kept); Overview,
  Cast and Scenes render it, the diagram and the table as lines; no console errors.

**M4 — the site tabs (landed 2026-09-26).** Four campaign tabs lead the site (`campaign/site/site.js`):
*The Bushi Oni* (home), *Chronicle*, *Dramatis Personae*, *Otosan Uchi* (the map). Documents are
`campaign/docs/*.html` drawn into `.bo-doc` and styled by `campaign/site/bo.css` from the VTT's own tokens; the
map is a pan/zoom viewer (`campaign/site/map.js`) over two images; `campaign/site/portraits.js` gives the PCs'
live sheets their portraits. Art is `campaign/assets/` (19 portraits at 480px, the key art, both maps as webp).
The voice is the project skill `.claude/skills/rokugan-voice` (adapted from Portents').
- The Chronicle (three sessions, ~4,400 words) was written from the three transcripts read in full, with the
  Archivist recaps as a skeleton only. Checked back against the transcripts claim by claim; seven overreaches
  fixed before commit (e.g. an unreliable-speaker line no longer attributed; Tsume Rin's pronoun; "that
  morning" for Ujiaki's departure, which the transcript does not say).
- The Dramatis Personae (22 people) carries only what the table learned; an entry that set two clues side by
  side was cut back so the page draws no conclusion the players have not.
- `campaign/source/check_docs.py` → **OK, 40 links and sources, 0 broken** (planted a bad anchor and a
  missing image → both named, exit 1). Browser (:8749): every tab renders with no console errors and no broken
  image; the map toggles (`#map/plan`), zooms and drags; home cards open each PC's sheet; Hasumi's live sheet
  on `/gm/` shows her portrait; at 375px no horizontal scroll; `#chronicle/session-two` lands clear of the header.

**M5 — deployed (owner, 2026-09-26: "default, go ahead").** Worker `the-bushi-oni` →
https://the-bushi-oni.sortilege.workers.dev (version `b9d07e2e`), `ALLOWED_ORIGIN` https://sortilege-inc.github.io;
`engine/config.js` names it. Proven with curl: POST /session from the github.io origin → 200 and a room code;
GET /session/<code> → 200 `{"exists":true}`; POST from a foreign origin → 403 `origin not allowed`.
`.nojekyll` added (Blood & Other Drugs: Jekyll dies on front matter). `main` fast-forwarded to `vtt-instance`;
Pages from `main` at https://sortilege-inc.github.io/the-bushi-oni/ (build `built` for `6f5de39`, HTTPS enforced;
default branch set to `main`). Live proof: `/`, `/gm/`, robots.txt, config, the docs, the seed, both layers and
the books all 200 over HTTPS; in a fresh browser the site renders the campaign tabs with no console errors, `/gm/`
shows the gate and self-seeds the GM tabs from the public pack, and *Start session* opened live room `ZJFTV`,
which the Worker confirms (`GET /session/ZJFTV` → 200 `{"exists":true}`). The two-device proof is the owner's
first session with a player. Redeploy the Worker after any upstream
change to `engine/ops.js` or `system/l5r5e/ops.js`: `cd worker && npx wrangler deploy`.

## Decision log

- 2026-09-26 — Archive buckets follow Caul/B&OD; the Otosan Uchi map-and-poster set kept as its own
  folder under `maps/`; blank sheets under `reference/character-sheets/`; the wiki scrape under
  `reference/` rather than `sourcebooks/` (it is lore, not rules). Browser `(1)` duplicates of Foundry
  exports are different, older exports — each kept under its own file date, not overwritten.
- 2026-09-26 — Dev ports 8749/8799 (free across every launch.json under `~/Sortilege` and `~/.claude`).
- 2026-09-26 — Owner: B3 public seed, B4 and B5 as proposed, and the push (publishes the books' `data/`, as Portents does).
- 2026-09-26 — `instance: null` until M1 — no empty stage scripts shipped.
- 2026-09-26 — M1: Iuchi Reijun (left the campaign) is **not** converted — her two exports stay in the
  archive. Yuma's Foundry name carries "[backup character]"; the entity is *Kitsune Yuma*. Void Points =
  Foundry's `void_points.max` (every export's live trackers read 0 — out of play), as Portents took the
  maximum. XP spent = the sum of the items' own `xp_used` (Foundry stores `xp_spent` 0 and computes it);
  the ledger lists each such item. A Foundry name the corpus spells otherwise (a specifier, a clan
  suffix, "Sword Saint" = `Sword-Saint`, "Lover" = `Lover Bond`) is kept verbatim in `As Recorded`.
  School and title abilities come with the School/Title (Portents). An empty `koku` (None) is 0.
- 2026-09-26 — M3: carried the **current** planning set — *Final* (28 Dec), the 1120 reference (6 Jan), the
  27 Jan session plan, and the two March notes files. **Not carried**, as superseded: *Campaign Summary*,
  *Revised* and *Seven Imperial Advisors* (all 25 Dec) — their advisors and conspiracies are not the
  ones *Final* and play use (the Archivist's NPCs are *Final*'s); they stay in the archive, and adding
  any later is safe (the seed only adds new ids). *L5R Rewrite Public.docx* is a third-party rules
  rewrite, not campaign material — not carried. The planned scenes are all `played: false`: the
  transcript cannot say reliably which were run, and the seed can never flip `played`; the GM marks them.
- 2026-09-26 — M4 spellings: *Kitsuki Kagi* (the owner's own notes; the Archivist writes *Kāgi*), *Asako
  Kikue* (the portrait's file name; the Archivist writes *Kikuë*), *Tsume Rin* (the transcript and the
  Archivist; the portrait file is `tsume-ren`), *Daidoji Masahiro* (the planning documents). The Chronicle
  says Taigen was absent on 20 Jan (his player was) and uses the GM's own explanation from 27 Jan.
- 2026-09-26 — M4 art: portraits and both maps are the archive's own files. Some portraits are published card
  art (Aramoro, Kachiko, Dairu, Shoju, Satoshi, Shizue) and both maps are the owner's stitched scans of the
  published Otosan Uchi map and poster — published on a public site, like the books' text (owner's B3/push).
- 2026-10-01 — Upstream I20 merged (owner: "merge the fix into the Bushi Oni instance too"): the GM
  Inspector's party sheet without its duplicated blocks (`f39afa9`, Portents' decision 80): the live sheet's
  own blocks, then only skills, advantages, the rest of the gear and the biography folded; one GM-notes
  heading; versions oldest first. Client files only, so the Worker needs no redeploy. Proven headless
  through the real controls with Kitsuki Hasumi added as the GM page adds a PC: 13 of 13, 0 console errors.
- 2026-10-01 — Upstream I21 merged (`3d1f7c0`): every technique on the live sheet. I20 had left the Techniques
  block naming only those with a check of their own that were already loaded. Kitsuki Hasumi's 4 of 4 named,
  headless, with 0 console errors.
- 2026-10-01 — **Techniques bought through a title, restored (owner: "fix the Bushi Oni bug").** Foundry keeps
  them in the title's own `system.items`; `convert_pcs.py` read only the top level, and `check_pcs.py` did too,
  so it passed them. Found by Fragile Peace's M4 (its F10) in the same code. 25 techniques were missing:
  Taigen +4, and +4 more in his December version (Sword Saint, Kenshinzen, Yojimbo); Yuma +2 (Elemental
  Legionnaire); and the GM characters Aarav +4, Kaede +4 (Gunsō), Yukiko +2, Kogo +1, Kunimichi +4. Both
  scripts now read a title's own items. Against the old layers the new check fails 8 sheets (11 fields); after,
  455 fields, 0 differ. `Iaijutsu Cut: Crossing Blade` and `: Sword and Sheath` keep their full names, being
  corpus kata of their own. Layers 0.1.2 (players) and 0.1.1 (GM).
- 2026-10-01 — Upstream I22 merged: a clan's mon is asked for only where the art has one. Kitsune Yuma (Fox)
  logged 404s on every draw before (headless, at `7329162`); none after. Taigen and Yuma show all their
  techniques, 0 console errors.

## To resume

```bash
cd "~/Sortilege/Campaigns/2026 The Bushi Oni/the-bushi-oni"
git config merge.ours.driver true          # once per clone
git fetch upstream && git merge upstream/main   # never rebase; stash engine/config.js first if dirty
```
