---
name: rokugan-voice
description: The house style and writing voice for The Bushi Oni campaign site (adapted from Portents & Fortunes') — modelled on the L5R5e .lore corpus in titterpig-dsl-l5r5e. Use this whenever writing or revising any prose for this project: lore and Atlas/gazetteer entries, Dramatis Personae bios and NPC descriptions, chronicle and session write-ups, location and region descriptions, GM notes behind the veil, or the blurbs on index and section pages. Load it even for small edits — a paragraph rewritten in the wrong register is the most common way this site drifts. Also use it when asked to "write it up", "add an entry", "describe this place/person", or "make this sound right".
---

# The Rokugan voice

The site's prose is modelled on the `.lore` files in `~/Sortilege/Titterpig/DSL/titterpig-dsl-l5r5e/0.5/`
— gazetteer prose written from inside the world's own scholarly tradition. Read a section of
`writ-of-wilds-wilderness.lore` or `writ-of-wilds-dragon-clan.lore` before a large piece of work; the
rhythm is easier to catch than to describe.

The short version: **an informed observer, writing down what is so, in the present tense, without
flourish — and letting the facts do the work that adjectives usually get asked to do.**

For anything under `gm/`, load the **`gm-prep-notes`** skill as well
(`~/Personal/Projects/Custom-Claude-Skills/gm-prep-notes/SKILL.md`, symlinked into `~/.claude/skills/`). It
governs what belongs in a GM document at all; this file governs how the sentences sound. Where they
disagree about `gm/`, that one wins.

## The four things that make it work

### 1. Fact, then consequence

Nothing is described for atmosphere alone. A detail earns its place by implying something about how
life works here. This is the single most load-bearing habit; if you internalise one thing, this is it.

> Weak: *The terraces are ancient and beautiful, a testament to generations of labour.*
> Right: *Terraces require constant repair, because winter frost swells the ground and pushes the walls outward. A terrace that goes one season unattended slumps. A terrace that goes three is gone.*

The second version contains a clock, a labour requirement, and a way to read abandonment off a
hillside. The first contains an opinion.

When you write a sentence of description, ask what a person could *do* with it, or *infer* from it.
If the answer is nothing, cut it or replace it with something load-bearing.

### 2. Attributed belief, not adjudicated metaphysics

The narrator reports what people hold, and by whom it is held. It does not rule on whether the kami
are real, whether a prophecy binds, or whose theology is correct. This is what keeps the setting
playable: the campaign runs on unresolved claims.

> Weak: *The kami had abandoned the shrine, causing the strange weather.*
> Right: *One theory holds that kami abandon shrines that fall into disrepair or that offend them, and manifest their element somewhere else, as strange weather or worse.*

Useful attributive frames: *One theory holds… · The Agasha consider… · Elders use these as warnings… ·
shugenja attest… · Nobody local necessarily distinguishes… · It is said…* (use the last sparingly —
it's the weakest, because it names no one).

Corollary: when two factions disagree, say so. Disagreement is texture and it is free. The Shiba
classify one way and the Agasha another; the thing being classified is indifferent to both.

### 3. Term, then gloss

Native vocabulary is used freely and glossed immediately, in-line, without ceremony — an appositive
or a parenthetical, never a footnote and never a glossary aside that stops the sentence.

> *a jinmaku (camp curtain)* · *the nanushi, a commoner appointed to speak for the settlement* ·
> *hokora — a stone box with an open front, set at a bend in the road* ·
> *its torii, the gate marking the boundary between ordinary ground and sacred ground, rotted through at the base*

Gloss on first use in a given page or entry, then use the term bare. Trust the reader afterward.

### 4. Restraint, with a strictly rationed lyric

The register is plain. It permits roughly one image per section, and it is always concrete and
visual rather than abstract and grand — white ribbons of meltwater that never appear to reach
anything; a signal that has never been lit in a thousand years. Then it returns to plain statement.

Purple is not the enemy of this voice; *unearned* purple is. An image is earned when it is a real
observation. It is unearned when it is a mood applied to the surface of a thing.

## Sentence and paragraph mechanics

- **Present tense** for the standing state of the world. Past tense only for history and events.
- **Third person, no address.** No *you*, no *we*, no rhetorical questions, no exclamation. World-facing
  prose does not know the reader exists. This now holds on the GM page too — it was formerly the
  exception, and that carve-out is retired.
- **Paragraphs of 2–5 sentences**, one idea each.
- **Rhythm:** mostly medium declaratives; occasionally a longer sentence carrying a clause of
  consequence; then a short one to land it. Vary it, but do not perform the variation.
- **Prose over bullets.** Bullets are for genuine enumerations — a list of clans, a table of ranks.
  If a bulleted list is really four assertions in a row, it wants to be a paragraph.
- **Concrete scale**, always: *an hour's travel · one in three · two paces deep · twice a year ·
  three hundred li*. Never *many*, *countless*, *ages past*.
- **Deadpan for the sting.** The dry note is delivered flat, never nudged. *Even monks are not immune
  to the allure of political power.* If a line would work with a wink, remove the wink.

## Register map — this site's surfaces

The voice is one voice, but the distance from the subject changes by surface. Getting this wrong is
the usual failure mode, so check which one you're in before writing.

| Surface | Register |
|---|---|
| `campaign/docs/home.html`, the map notes | Gazetteer voice: what the task force knows of the situation, stated plainly. |
| `campaign/docs/personae.html` | Gazetteer voice, one step closer. Describe each person as the task force has seen them and nothing more — **this site is public and the players read it**: never let a GM fact from the pack, the planning documents or a GM character's sheet into a player page, and never set two clues side by side so the page draws a conclusion the table has not. |
| `campaign/docs/chronicle.html` | Narrative register. Same discipline — concrete, unhedged, no purple — following three people through time, past tense for events, their reasoning and doubt allowed. Written from the session transcripts (`the-bushi-oni-support/archive/transcriptions/`), never from the Archivist recaps alone; transcript speaker labels are unreliable, so attribute a line only where the content makes the speaker certain. Still no second person. |
| The GM tabs (the pack: Overview, Scenes, Threads, Cast, Party) | **Reference, not essay** — governed by the `gm-prep-notes` skill, which outranks this file there. |
| The characters' sheets (`campaign/dsl*/`) | Mechanical, generated from Foundry by `campaign/source/convert_pcs.py`; never hand-written. |

## Hard constraints inherited from the project

These are not stylistic preferences and they outrank everything above.

- **Never paraphrase rules text.** Spells, techniques, statblock traits and actions, opportunity
  tables, condition effects and severity tables are reproduced **verbatim** from the L5R5e corpus at
  `~/Sortilege/Titterpig/DSL/titterpig-dsl-l5r5e/0.5`. Whitespace, HTML escaping, and dice-glyph
  substitution are the only permitted transforms. Own prose *about* the rules is free.
- **Never invent canon that the corpus already settles.** Check the corpus before describing a
  place, family, title, creature, or practice. If it is genuinely undefined there, it is yours to
  define — say so in the GM notes with a `YOURS` tag rather than letting an invention pass as source.
- **Never inline images as base64.** Reference real files.
- **Keep the mystery intact.** Player-facing pages hold only what the table has learned in play. When in
  doubt, leave it to the GM tabs.

## Naming and orthography

- Macrons where the word takes them: *kihō, shūji, Kyūden, bō, daimyō, rōnin, Togashi Yokuni*. Be
  consistent within a page; the corpus itself is not always consistent, so prefer the macron form.
- Peasants bear a single given name, no family name. Samurai are *Family Given* — Togashi Norikage,
  Seiya Mori — and are referred to by family name or full name, not by given name alone.
- Titles are glossed on first use: *nanushi*, *daimyō*, *ise zumi*, *sōhei*, *shugenja*.
- Use **they/them** for anyone whose gender the sources and the table have not established. Do not
  infer it from a name.

## Anti-patterns

Each of these is something that will actually show up if you're not watching for it.

- **Adjective stacking.** *Ancient, mysterious, timeless mountains.* Pick the one true detail instead.
- **The antithesis pair.** *Is the mountain sleeping because of you, or merely alongside you?* The
  second half is the first half negated, with an adverb (*merely*, *only*, *really*) doing the
  sneer. It sounds like a distinction and carries none. Ask the plain question.
- **The escalating second question.** A fair question, then a more intimate one about whether the
  subject has admitted it: *…Have you ever said the difference out loud? · Which do you use more?*
  One question is the question.
- **The doom tail.** *…and he does not know it yet. · …a question you never asked him, and now
  can't.* A clause appended to promise consequences the scene has not earned.
- **The recursive self-knowledge move.** *a belief you have never tested, and know you have never
  tested.* Awareness folded back on itself to sound deep.
- **Abstract nouns where a plain one exists.** *said the difference out loud · where does that
  ordering come from.* You cannot say a difference out loud.
- **The narrator rating its own material.** *Now enormously pointed. · He noted, and it matters,
  that…* If it is pointed, it will be pointed without the label.
- **Summary in place of specifics.** *The village was struggling.* → *Perhaps one in three terraces is worked. The rest have gone to thistle and stonecrop, their walls bowed and spilled.*
- **The narrator having feelings.** *Tragically, the village would not survive.* The prose does not editorialise; the facts are permitted to be sad on their own.
- **Hedging as a tic.** *Perhaps, maybe, some might say* used to sound careful. Hedge only by
  attributing a claim to someone. Otherwise state it.
- **Anachronism and modern idiom.** *Infrastructure, logistics, community outreach, resources* in
  world-facing prose. Say what is actually meant: roads, supply, the temple's teaching, food and
  timber.
- **Explaining the theme.** If a passage tells the reader what it means, cut that sentence. The
  emptied village and the leaning torii do not need a paragraph explaining that they rhyme.
- **Second person leaking in** from GM notes into world-facing pages.
- **The document describing itself.** *This section is the one that is true. What stays on this page
  is only what a card cannot hold.* Never, on any surface. See `gm-prep-notes` rule 1.
- **Keeping the corpse.** Struck-through text, `SUPERSEDED` markers, *prep had X, now Y*. Correct the
  fact and delete the old one; git is the history.
- **Arguing for the material.** *Why Earth is the right element…* A GM page carries the decision, not
  its defence.
- **Saying it four ways.** A fact, then a "the consequence is…" paragraph, then a numbered taxonomy,
  then an OPEN restating it. Pick the usable form and stop.

## Before you call it done

- Is every descriptive sentence load-bearing — could someone act on it or infer from it?
- Is every metaphysical or contested claim attributed to someone who holds it?
- Is each in-world term glossed on first use, and bare thereafter?
- No second person, no rhetorical questions, no exclamation? (The one exception is a question
  bank on `gm/` — questions written to be put to the player aloud. Everything else on `gm/`,
  including the prose around such a list, is third person.)
- At most one lyric image in this section, and is it a real observation?
- Numbers concrete, tense consistent, macrons consistent?
- Any rules text reproduced **verbatim**?
- On `gm/`: nothing struck through, nothing describing the document, nothing arguing for its own
  ideas, no claim made twice in two registers?

## A worked example

The brief: *add White Flower Village to the Atlas.*

> **Weak** — *White Flower Village is a small, remote village nestled in the beautiful Dragon
> mountains. Life is hard here, and the villagers struggle to survive, but they endure with
> quiet dignity. Now change is coming, and nothing will be the same.*

Every sentence is a mood. Nothing can be acted on, nothing is attributed, the last line is the
narrator promising drama.

> **Right** — *White Flower Village comes into view from above, which means the terraces below it
> are visible before any roof is. How much of that cut hillside is green, and how much is thistle,
> is the first fact the village offers about itself. It grows wheat and barley rather than rice; the
> season is too short and the water too cold for paddy. Under Seiya Mori's consolidation order it is
> a receiving village, and the households arriving on the eastern track have no history with the
> households already here — a jostling for position with no settled order to resolve it against.*

Vantage, a diagnostic a character can perform, a crop fact with its reason, and a consequence that
generates play. Same length. No adjectives doing work that facts should do.
