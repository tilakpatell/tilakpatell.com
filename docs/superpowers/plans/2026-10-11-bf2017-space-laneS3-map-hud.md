# Battlefront 2017, lane S3: the map and the HUD on the game’s front end. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR. Starts from `origin/main`.

**Goal:** the galaxy’s holomap, its side panels and the war’s HUD wear the game’s front end where the game has the piece: a globe for every planet with a skin, the game’s faction icons for the four sides it has, the game’s sprites on the galaxy’s buttons where the meaning matches, the war HUD’s bars and lines in the Starfighter Assault widgets’ layout.

**Spec:** `docs/superpowers/specs/2026-10-11-bf2017-galaxy-in-space-design.md`, decision 6; the fifth design’s lane M section of `docs/superpowers/HANDOFF-bf2017.md` (the icons: `icon(name)`, `src/data/bf2017/icons.json`, `/ui/bf2017/<family>.svg`; the fonts; the strings); the screens lane’s section (the widget trees, `starfighterHud.js`); lane K’s and the space lane’s sections (`bf2017-sky.mjs --globes`, `globes.json`, `PICTURES`, `SKINS`).

**Tech stack:** `src/components/galaxy/{HoloMap,HoloSide,KeysCard,WarCard,WarLegend,WarStrip,WarLayers,WarHud,FlightCluster,Briefing,GalaxyPanel,Emblem}.jsx`, `src/components/galaxy/{globes,emblems}.js`, `src/lib/bf2017/icons.js`, `scripts/bf2017-sky.mjs`, `src/data/galaxy/space/globes.json`, `galaxy.css`, `warmap.css`.

## Global constraints

- A game sprite replaces a Remix icon only where `icons.json` has an icon with the same meaning (a map pin for a map pin, a fleet for a fleet); where it has none, Remix stays and the hand-off says so. No icon of the sequel era.
- A globe is rendered from a skin the site already has (lane K’s and, as they land, E5’s), at the front end’s 96 px (`_source`: lane K’s cut), WebP with alpha, through `bf2017-sky.mjs --globes`; a world with only a lit picture keeps its picture globe; a procedural world keeps its CSS dot and is named.
- The emblems: the four sides the game has (`side:rebels`, `side:empire`, `side:republic`, `side:separatists` through `icon('side:*')`) take the game’s; `newrepublic`, `remnant` and `hutt` keep the site’s crests, named in the hand-off.
- The UI rules of `docs/health/RULES.md` (contrast, touch targets, phone width) hold; snapshot tests updated where they exist, never deleted.
- One PR, draft, `origin/main` merged in before it keeping both sides; the five checks; never a test skipped or quieted. British spelling, curly quotes, `_source` on every number.

## Review focus

1. **Every page that lists systems** (HoloMap, GalaxyPanel, the mission page) renders at phone width with the new globes without a layout break (`HoloMap.test.jsx` or its snapshot).
2. **The icons resolve.** Every `icon('…')` the lane adds names an id in `icons.json` (`icons.test.js`), and the sprite loads once per family.
3. **Nothing of S1’s or S2’s files** is touched (`models.js`, `scene.js`, the shaders): this lane is `.jsx`, `emblems.js`, `globes.js`, the CSS and the globes script.

---

### Task 1: A globe for every skinned planet

- Modify: `scripts/bf2017-sky.mjs` (`--globes` renders a globe from a `SKINS` row’s colour map (and clouds where the skin has them) for every skinned world without a front-end picture: bespin, endor, kamino, naboo; E5’s as their skins land), `src/data/galaxy/space/globes.json`, `src/components/galaxy/globes.js` (the lookup covers skinned worlds), `HoloMap.jsx` (the disc wears the globe where one exists)
- Test: `globes.test.js` (every skinned world and every picture world has a globe row; a procedural world has none), `HoloMap.test.jsx` (the disc’s image for naboo, the dot for alderaan)
- [ ] Failing test → FAIL → implement, run `--globes`, publish the WebPs (`assets-publish.mjs --only 'models/galaxy/space/globes/*'`; a refused bucket write goes to the parent session, session_01282C5tuJnxtHN4SCrT1kct, with the branch, the commit and the globs) → PASS. Commit `A globe for every planet with a skin`.

### Task 2: The game’s faction icons

- Modify: `src/components/galaxy/emblems.js` (the four sides resolve to `icon('side:*')`’s sprite; the others keep their paths), `Emblem.jsx` (renders a sprite reference or a path), `WarLegend.jsx`, `WarCard.jsx`, `WarStrip.jsx`, `WarLayers.jsx` (through `Emblem`; no change where they already do)
- Test: `emblems.test.js` (the four sides name the game’s ids; `hutt` keeps its path), `Emblem.test.jsx`
- [ ] Failing test → FAIL → implement → PASS. Commit `The war’s four sides wear the game’s icons`.

### Task 3: The game’s sprites on the galaxy’s buttons

- Modify: `src/lib/bf2017/icons.js` (`ICON_FOR` rows for the galaxy’s button meanings that `icons.json` has: the SpaceBattles and Planets families), `HoloMap.jsx`, `HoloSide.jsx`, `KeysCard.jsx`, `FlightCluster.jsx`, `Briefing.jsx`, `GalaxyPanel.jsx` (a `GameIcon` where a row exists, Remix where none), `galaxy.css`, `flight.css` (the sprite sized to the touch target)
- Test: `icons.test.js` (every new row resolves), each component’s test or snapshot (updated, with the Remix fallbacks still rendering)
- [ ] Failing test → FAIL → implement → PASS; a shot of the hub at phone width and at 1,600 × 900. Commit `The galaxy’s buttons on the game’s sprites where it has them`.

### Task 4: The war HUD on the widgets

- Modify: `WarHud.jsx` and `warmap.css` (the battle line and the objective bars in the Starfighter Assault widgets’ layout from `starfighterHud.js`: the bar’s proportions, the fonts, the colours the screens lane recorded; the text as it was), `StarfighterHud.jsx` (nothing, unless a shared piece moves to a small `hudBits.jsx`)
- Test: `WarHud.test.jsx` (the bars’ values and the line), `StarfighterHud.test.jsx` unchanged and passing
- [ ] Failing test → FAIL → implement → PASS; shots of a war and a space battle at high. Commit `The war HUD in the game’s widget layout`.

### Task 5: The hand-off and the PR

- Modify: `docs/superpowers/HANDOFF-bf2017.md` (this lane’s section: Done / Where the code and the plan differed / Left (the sides and the buttons the game has no icon for, named; the procedural worlds without a globe) / Checking it; the lanes table row with the PR number and this session’s id)
- Test: the five checks; `node scripts/autopilot-check.mjs --routes /galaxy --only smoke`
- [ ] Shots in `docs/superpowers/evidence/bf2017-space/s3/`; `origin/main` merged keeping both sides; the draft PR; message the parent session with the PR number, the head sha and the checks. Commit `Lane S3: the hand-off`.
