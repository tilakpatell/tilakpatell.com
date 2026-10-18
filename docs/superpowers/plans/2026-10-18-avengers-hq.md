# Avengers HQ: fix, frame and hub Implementation Plan (index)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/avengers` work and hang together: the broken games fixed, one full-screen game screen with a way out and a way on, a link for every building, an ops board under the world that is also the no-3D view, an earned snap with a heist summary, Ricochet and Infiltration playable in 2D, and the code splits every later piece needs.

**Architecture:**
- Seven pull requests, merged in order, each green on its own. Each has its own plan file (below); this index holds the rules every PR keeps, the order and what each hands the next.
- The world’s two oversized files are split first with no visible change, so every later PR edits small files. Pure modules carry every rule (`world/links.js`, `hq/gameScreen.js`, `board/records.js`, `hq/heist.js`, the 2D views’ controllers) and are tested in Node; React components draw them.
- The page keeps one route key for `/avengers/:place?`, so the compound stays mounted while a building’s game opens over it.

**Tech Stack:** React 19, react-router-dom 7, three.js 0.186 on the site’s world runtime (`src/runtime/`), Vite 8, Vitest 5, playwright-core 1.56 driving the check scripts under `scripts/`.

**Spec:** `docs/superpowers/specs/2026-10-18-avengers-hq-fix-and-hub-design.md` (as amended in `30dd1241`). Every PR reads it whole; the spec wins over any plan.

## Global Constraints

**Content:**
- Nothing in this work draws a figure, suit or mark of any Marvel character, in code or generated. The 2D views are abstract markers (lines, squares, chevrons, triangles, plain discs); the board and records are text and the stones’ existing colours; the heist summary is text over the existing Titan scene, which is not changed. The credited models are only posed and moved, as now.
- Copy: British spelling, curly quotes, sentence case, no Oxford comma, the key first in a prompt. Half stones read as whose half: “Clint’s half of the Soul Stone”. No model names in code, docs or commits.

**Keep what visitors have:**
- Every `tp-hq-*` key keeps its name and shape; the board reads them through `runtime/saves`’ plain `get`, unregistered. New keys only: `tp-hq-lawn-boss`, `tp-hq-heist` (registered, version 1) and the per-game 3D choice keys of PR 4.
- Every achievement, sound, ghost and dev hook (`__HQWORLD__`, `__HQ__`) keeps working. No test is skipped, loosened or deleted; an assertion a later PR changes is changed to the new truth with equal strength.

**Code shape (`docs/health/RULES.md`):**
- Files under 800 lines; splits by the barrel recipe, pixel-identical before and after (`docs/superpowers/evidence/engine-floor/FL2-avengers/tools/hq-shots.mjs` is the pixel gate).
- Worlds are islands; no new cross-world import. `avengers/hq` is shared with Invincible, Mario 64 and the Marvel landing: `hq/HQFrame.jsx` keeps its props and picture, and any PR that changes `hq/` runs `scripts/inv-world-check.mjs` with identical shots.
- One runtime renderer and one live 3D view a page; no new renderers or animation loops; the HQ modules stay `'glsl'`.
- Tests beside their files, each under one second, no network.
- The HQ games keep their own key lists until open draft #1028 (which edits `guide/pages.js` and `runtime/hud/*`) merges; touch `guide/pages.js` only as PR 3 says, minimally.

**Every PR, before it is done:**
- `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, then `git checkout public/github.json`.
- `scripts/autopilot-check.mjs --before` on `main`, then `--routes /avengers,/invincible --shots` and `--phone`; read the screenshots.
- From PR 3 on, `scripts/hq-links-check.mjs` (added in PR 3) prints `all ok`; the `/avengers` closure’s size from `dist/.vite/manifest.json` is stated in the PR.
- One PR, CI green, a merge commit. Never merge red, never force-push, never rebase another session’s branch.

## Review Focus

The five failures most likely to bite a visitor, and the PR whose tests pin each:

1. **A returning visitor’s saves.** Stones, bests, Ricochet’s progress, Infiltration’s level and the tour’s best written by today’s code read back correctly on the board, including missing or corrupt values; stones won before the heist record existed show “before records began”. Pinned by PR 5 (`board/records.test.js` fixtures for every key’s real shape) and PR 6 (`hq/heist.test.js` migration).
2. **Back does what the visitor means.** Back from a game opened by a door or the board returns to `/avengers`; Back from a game opened by a shared link replaces with `/avengers` rather than leaving the site; an unknown slug lands on `/avengers`. Pinned by PR 3 (`links.test.js`, the back decision) and `hq-links-check.mjs` in every later PR.
3. **One game’s 3D switch stays in that game.** Turning a game’s 3D off, or a card’s Try 3D, never changes the site’s setting or drops the compound to 2D. Pinned by PR 4 (`hq/gameScreen.test.js`) and PR 5 (the card’s Try 3D).
4. **Leaving mid-game.** Browser Back, Esc or a hidden tab during play pauses or closes cleanly; returning shows the veil, then the compound, never a blank. Pinned by PR 4 and its browser check.
5. **Other worlds that share `hq/`.** Invincible’s ThinkMark and Mario 64 look and run the same after PRs 1, 2 and 4. Pinned by `scripts/inv-world-check.mjs` in those PRs.

## The pull requests

| PR | Plan | What it does | Hands the next |
| --- | --- | --- | --- |
| 1 | `2026-10-18-avengers-hq-pr1-splits.md` | Splits `world/rules.js` into `world/rules/*` and `world/scene.js` into `world/scene/*` behind barrels; the compound takes the HUD kit by its parts, dropping the Battlefront data from `/avengers` | `world/rules/progress.js`, `world/scene/doors.js`, the pinned 91 barrel names |
| 2 | `2026-10-18-avengers-hq-pr2-fixes.md` | Thwip’s bell, Prime’s arrival, Ricochet’s disposal, Trick Shot’s round and stone, the lawn’s boss checkpoint, one `STONE_OF`, `HALF_OF`, `:disabled`, the copy fixes, Things to do at 8/8 | `progress(earned, unlocked)`, `HALF_OF`, `startBoss` |
| 3 | `2026-10-18-avengers-hq-pr3-links.md` | `/avengers/:place?`, `world/links.js`, Back, the palette, to-do, tour and guide links, the portal’s Space Stone rule, `scripts/hq-links-check.mjs` | `linkOf`, `placeOf`, `gameOf`, `hqState` |
| 4 | `2026-10-18-avengers-hq-pr4-game-screen.md` | `hq/HQGame.jsx` full screen with its bar, the per-game 3D choice, touch help, pause, `hq/Results.jsx`, the return toast, warm on approach (`world/warm.js`), the veil on return, Repulsor’s start gate | `Results`, `HQGame`’s `flat` prop, `switchFor`, the per-game 3D keys |
| 5 | `2026-10-18-avengers-hq-pr5-ops-board.md` | The ops board and records strip, the page’s new order with the closed Archive | `readBest`, `FLAT_READY` |
| 6 | `2026-10-18-avengers-hq-pr6-heist.md` | `tp-hq-heist`, `recordTry`, the earned snap and the summary over the dust | `recordTry(placeId)` |
| 7 | `2026-10-18-avengers-hq-pr7-flat-games.md` | Ricochet 2D and Infiltration 2D over their real rules | |

Each PR’s plan names its exact files, interfaces, tests and checks. A PR starts from `main` after the one before it has merged, and re-reads the line numbers in its plan against `main` before editing: the plans were written from `ddb364bf`.
