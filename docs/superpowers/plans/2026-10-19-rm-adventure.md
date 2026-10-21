# The Rick and Morty adventure: the plan's index

> **For agentic workers:** this is the index. Each phase has its own task-by-task plan, written when the phase starts (from the spec and what the phases before it landed), at `docs/superpowers/plans/2026-10-19-rm-adventure-p<N>-<slug>.md`. A phase's plan goes once its work is merged (P0's to P6's have). REQUIRED SUB-SKILL for a phase plan: superpowers:subagent-driven-development or superpowers:executing-plans.

**Spec:** `docs/superpowers/specs/2026-10-19-rm-adventure-design.md`

**Goal:** one story through every Rick and Morty place, the dull places made into games as the story reaches them, and Schmeckles once the owner's currency is on `main`.

## How the phases go

- One pull request a phase, from its own branch off `main`, merged before the next phase starts.
- Each phase raises `READY` in `src/components/rickmorty/adventure/episodes.js` by one, to the episode it makes playable, and adds that episode to `scripts/rm-story-check.mjs`.
- Each phase's plan opens by reading what the phases before it changed (`git log -- src/components/rickmorty/adventure`), so its names match what's there, not what this index guessed.
- Done for a phase: its episode played start to finish on a fresh save by `scripts/rm-story-check.mjs`; every new rule tested; shots of its places before and after (`scripts/c137-shots.mjs`); `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` green.

## The phases

| phase | READY | what it lands | new game kinds |
| --- | --- | --- | --- |
| P0 | 1 | the engine, the save, the dial's lock and Free roam, the links, the toys ticking when played, the HUD's card and Story tab, episode 1 *Wiped* | none |
| P1 | 2 | episode 2 *Arcade money*: a walkway cabinet at Blips and Chitz made playable | `cabinet` |
| P2 | 3 | episode 3 *House guests* (Total Rickall, Dr. Wong, the sewer run: all exist) | none |
| P3 | 4 | episode 4 *Small problems*: the Microverse, Anatomy Park | `power` |
| P4 | 5 | episode 5 *Heat*: the cruiser's chase; the `fly` task ticks on the first chase won | `chase` |
| P5 | 6 | episode 6 *Bad deals*: Needful Things, the vat of acid | `deal`, `freeze` |
| P6 | 7 | episode 7 *The Jerry problem*: the Jerryboree, St. Gloopy Noops | `find` |
| P7 | 8 | episode 8 *Prime time*: the cable studio, Get Schwifty | `sequence`, `rhythm` |
| P8 | 9 | episode 9 *Fairy tales*: Fantasy World | `climb` |
| P9 | 10 | episode 10 *The Citadel*: the Citadel shows the story's objective and card | none |
| P10 | 11 | episode 11 *The sector*: Bird World, Gear World, Pluto | (uses `climb`, `sequence`, `deal`) |
| P11 | 12 | episode 12 *Big score*: Heist-Con | (uses `hunt`, `collect`, `sequence`) |
| P12 | 13 | episode 13 *Evil Rick* (all exist) | none |
| P13 | 13 | Schmeckles: `purse.js`, `pay.js`, `perks.js`, the bench and the Exchange, coordinates for sale, outfits | none |
| close | 13 | the worlds' hand-off, `docs/architecture.md`, the README's lines, the backlog, the tour's and the guide's destination counts | none |

## The gate before P13

P13 starts only when the owner's currency work is on `main`. Its plan opens by reading what landed (`git log --oneline -- src/components/universe/economy.js src/components/universe/EconomyProvider.jsx` and any new wallet module) and writes `purse.js` against it. Until then, P1 to P12 go on; their kinds take `perks` with every value at zero (spec, section 5).

## Not touched by any phase

Draft PR #1028's files (`src/components/universe/economy.js` and the arsenal's); the galaxy's planet engine and Gazorpazorp (`2026-10-08-rm-worlds-design.md`); any model file.
