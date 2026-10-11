# Lane G6: parity with the game, measured. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (one session, task by task; no review loops). Steps use checkbox (`- [ ]`) syntax.

**Goal:** "As close to the game as possible" has a number and a picture: a **ledger** of every level × mode saying what is the game's, what is hand, and what is missing (with a CI check that fails on regression); a **compare page** laying the site's shots from the level's own cameras beside the owner's screenshots of the real game from the same cameras; and a **gizmo overlay** in the game world drawing what the sim believes the layer is, to hold against the game.

**Architecture:** `scripts/bf2017-parity.mjs` reads `frontend.json` (G1; until merged, `modes.json` and the inclusion reading), the map rulebooks, the stage and hand files, `src/lib/battlefront/modes/*` (which exist), `index.js`'s `BUILT`, the HUD parts' widget names against the mode's widget list in `ui.json`, the packs' `level.json` (whole? published through `galaxyAssets.json`?), and the checks' evidence folders, and writes `docs/superpowers/evidence/bf2017-parity/ledger.md` and `ledger.json`. `scripts/bf2017-compare.mjs` drives the game world in headless Chromium through `window.__battlefront` to each camera of the level's rulebook (`cameras`, `locators`) and writes shots; a static page pairs them with `game/<level>/<camera>.jpg`. `src/components/battlefront/gizmos.js` draws the rulebook's rows as lines on the node renderer when `?gizmos=1`.

**Spec:** `2026-10-10-bf2017-galaxy-on-the-game-design.md`, decision 8.

**Narrowed beside PR #877 (read the spec's "Beside the accuracy design" first):** #877's maps lane (`claude/bf2017-maps`) writes a per-map ledger (`scripts/lib/bf2017-map-audit.mjs`, `scripts/bf2017-map-audit.mjs`, `docs/superpowers/evidence/bf2017-maps/ledger.md`, a CI check). **One ledger, not two:** Task 1's rows become the **mode columns** of that ledger (rules, sim, HUD, kits, prices, check, score per level × mode) added to its module and page once it lands (merge its branch; if it has not landed when you reach Task 1, write your module so its rows join by level key and tell the hand-off). Tasks 2 and 3 (the compare harness, the gizmo overlay) are yours alone.

## Global constraints

- Start from `main`. Own: `scripts/bf2017-parity.mjs` and its test, `scripts/bf2017-compare.mjs`, `scripts/lib/bf2017-parity.mjs` (pure, tested), `src/components/battlefront/gizmos.js` (and the one line in `module.js` that mounts it on `?gizmos=1`), `docs/superpowers/evidence/bf2017-parity/**`, the CI step (`.github/workflows/ci.yml`: `node scripts/bf2017-parity.mjs --check`), `HANDOFF-battlefront.md`'s status table (the ledger's summary).
- Never commits the owner's game screenshots' bytes beyond a thumbnail (`game/` is listed in `.gitignore` except `*.thumb.jpg` under 60 KB each); the compare page reads the full files locally.
- No new runtime code in `src/lib`; files under 800 lines; the usual gates.

## Tasks

### Task 1: the ledger

- [ ] `scripts/lib/bf2017-parity.mjs`: `ledgerRows({ frontend, maps, stages, modes, built, ui, packs, assets, evidence })` → one row per level × mode: `pack` (`whole` / `roam` / `none`, published yes/no, pieces drawn of the map's), `layer` (rows found: spawns, areas, volumes, prefabs; `none` when the map has no rows for the mode), `rules` (`game` when the mode needs no hand file, `hand` when its file exists, `missing`), `sim` (`done` when `modes/<id>.js` exists and `BUILT` has it), `hud` (widgets drawn of the mode's list in `ui.json`), `kits` (classes, heroes, reinforcements, vehicles offered of the team record's), `prices` (`game` / `hand` from `points.json`'s sources), `check` (green when an evidence shot exists for the pair), and a `score` 0–8 (one a column that is the game's). Tested on fixtures.
- [ ] `scripts/bf2017-parity.mjs` writes `ledger.md` (the table by level, a totals line, the hand values listed from `NOTES.md`) and `ledger.json`; `--check` compares to the committed `ledger.json` and fails if any row's score fell or a `done` became `missing`.
- [ ] The CI step; `npm run parity:bf2017`.

### Task 2: the compare harness

- [ ] `scripts/bf2017-compare.mjs <level> [--tier high] [--mode <id>]`: opens `/battlefront/<level>/<mode>` (or G1's `/galaxy/<system>/surface?level=&mode=`), waits for the pack, and for every camera of the level's rulebook (`cameras` by layer: the deploy cameras, the EOR and outro locators) sets the camera through `__battlefront.do('camera', { at, look, fov })` (a new `do` the module gains: one line in `module.js`, owned here) and shoots to `docs/superpowers/evidence/bf2017-parity/site/<level>/<camera>.jpg`; then builds `docs/superpowers/evidence/bf2017-parity/index.html`: a row a camera, the site's shot, the owner's `game/<level>/<camera>.jpg` where it exists (else an empty frame saying which camera to capture in the game: the deploy screen's view of that objective), a pixel difference (SSIM or mean absolute error on a 256-wide downscale) and a notes field read from `notes.md`.
- [ ] A README in the folder: how the owner takes the game's shots (the deploy screen of the mode shows the level from exactly these cameras; name the file by the rulebook's camera id, listed by the script with `--list`).
- [ ] Run it for Hoth's Galactic Assault and HvV at high in software GL (the owner's laptop for WebGPU); commit the site's shots as thumbnails.

### Task 3: the gizmo overlay

- [ ] `src/components/battlefront/gizmos.js`: `createGizmos(scene, map, mode)` draws, on the node renderer (`Line2`/`LineSegments` with node materials; nothing GLSL), the mode's spawns (a tick per team colour, pointing its yaw), spawn areas (polygons at their height), volumes (boxes), capture points (rings), OOB volumes (red), vehicle and walker paths (lines), the cameras (frusta), with a label each (`id`) through the HUD's marker projection; toggled by `?gizmos=1` or `do('gizmos', on)`; a legend part in the HUD.
- [ ] `gizmos.test.js`: the rows become the right count of objects; a mode with no rows draws nothing.
- [ ] A shot of Hoth's Galactic Assault with the overlay on, in the evidence.

### Task 4: docs, checks, PR

- [ ] `HANDOFF-battlefront.md`, "The sixth design": the ledger's totals as the status table (the script prints the markdown block to paste), G6's row; the spec's Departures.
- [ ] Gates: lint, test, build, health; `node scripts/bf2017-parity.mjs --check`.
- [ ] PR `Battlefront G6: parity with the game, measured`; merge `origin/main` first.
