# Battlefront 2017, lane screens: the game's screens from the widget trees. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** The Battlefront world's screens are the game's: the start screen, the main menu, Play and its multiplayer category with the mode, level and planet cards, the loading screen with its film and hint, the spawn screen, the in-game menu, the end-of-round sequence, the kill screen and the scoreboard, each drawn from its `UIWidgetBlueprint` tree at the game's positions, sizes, colours and faces, with the HUD's crosshairs and markers as the game's vector shapes; the route runs through them.

**Architecture:** The extractor (`scripts/lib/bf2017-rulebook-ui.mjs`, new, beside lane 0's `bf2017-rulebook-look.mjs` which flattened the HUD widgets) writes four rulebooks; `src/lib/bf2017/ui/` resolves a screen's tree into boxes, texts, fonts, shapes and links; one kit component (`src/runtime/hud/Screen.jsx`) draws any resolved tree; the game's screens under `src/components/battlefront/screens/` are thin: a `Screen` with the data it needs and the actions it sends. The deploy screen lane 5 wrote stays as the fallback.

**Tech Stack:** `scripts/bf2017-data.mjs`; `src/lib/bf2017/ui/index.js` (`widget`, `colour`, `fontFor`, `placeWidget`), `strings.js`, `icons.js`, `films.js`, `fonts.css` (lane M; the fonts' PR #873 may land under you: merge `origin/main` first); `src/runtime/hud/` (Film.jsx, GameIcon.jsx, Reticle.jsx); `src/components/battlefront/` (lane 5: `BattlefrontWorld.jsx`, `hud/`, `battle.js`, `module.js`); `src/components/galaxy/surface/ModeMenu.jsx`, `DeployPanel.jsx`, `landLine.js` (lane F); React, Vitest, `scripts/battlefront-check.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-accuracy-design.md` (§1.3, §3 "Lane screens", §4, §5).

## Global Constraints

- The era rule: the sequel's screens, modes, levels and planets (`isSequel` on the information assets' level and planet ids; the `S1`, `S9*`, `A3` screens) are left out and listed.
- No commercial font ships: `fontFor` maps the trees' faces onto the open faces as lane M set it; a face the map lacks falls to `--font-bf-text`.
- The UI bitmaps are not in the bucket: a `bitmap` element draws its shape or icon fallback and the screen lists the bitmap it wanted (`bitmaps.json`'s missing list grows).
- Lane 5's `DeployScreen.jsx` and HUD parts stay and pass their tests; the galaxy's landing menu (lane F) keeps its layout and takes `info.json`'s names and order.
- A screen is keyboard-navigable and a dialog where the game's is modal; reduced motion stills the films and the trails.
- Files under 800 lines; British spelling and curly quotes; commits one plain sentence with the attribution lines.

## Review Focus

1. **A screen whose tree names a widget the era rule excludes**: the element is skipped and the screen still resolves (task 1's test).
2. **A text whose string key is missing**: the key is shown, never an empty box (task 2's test).
3. **A shape with inner paths** (a ring crosshair): the SVG uses even-odd fill and matches the triangulated points' bounds (task 1's test).
4. **The route at `/battlefront/hoth/galacticAssault` with no screens data** (a failed import): the world still opens with lane 5's deploy screen (task 5's test).
5. **The end-of-round sequence on a tab in the background**: it advances on time, not frames (task 4).

---

### Task 1: The extractor

**Files:**
- Create: `scripts/lib/bf2017-rulebook-ui.mjs` (`screensOf(root, { era })`: every `UI/Frontend/Screens/**` and `UI/InGame/{Spawn,InGameMenu,EndOfRound,Hud/KillScreen,Hud/Scoreboard}/**` `UIWidgetBlueprint` as `{ name, elements: [{ id, type, anchor, size, offset, position, colour, alpha, font, text, widget, shape, bitmap, list, children }], links: [{ from, to }], states }` (the element fields as lane 0's `bf2017-rulebook-look.mjs` reads them: reuse its readers); `shapesOf(root)`: each `DiceUIVectorShapeAsset` → `{ name, rect, paths: [{ colour, alpha, d, inner: [d] }], points }` (corners to an SVG path with the record's radii: miter corners as lines, rounded as arcs); `infoOf(root)`: the `GameModeInformationAsset`, `LevelInformationAsset`, `PlanetInformationAsset` rows and `GameModesListInformationAsset`'s order, each with its string keys, tile and icon keys, and the level/planet links; `loadingOf(root)`: the `WSUILoadingScreenAsset`s and their hints' string keys by mode and level)
- Modify: `scripts/bf2017-data.mjs` (`screens`, `shapes`, `info`, `loading` → `src/data/bf2017/screens.json`, `shapes.json`, `info.json`, `loading.json`; `all` includes them)
- Test: `scripts/lib/bf2017-rulebook-ui.test.mjs` (fixtures: `MainMenuScreen`, `MainMenuWidget` (trimmed), `Crosshairs_Ability_Dooku`, `UI/Data/GameModes/SpaceBattles`, `UI/Data/GameModes/Levels/EchoBase`, one loading-screen asset)

- [ ] **Step 1: Failing tests**: the main menu's tree has the breadcrumb and the menu widget as children with their anchors and the six list cells with their string keys and link targets; the Dooku crosshair's path bounds equal its `LayoutRect`; Review Focus 1 and 3; `info.json`'s Space Battles row names its tile key and `SB_Endor_01`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; regenerate from the bucket (`bf2017-fetch.mjs data 'UI/**'`), commit the four files (sizes in the commit message).
- [ ] **Step 5: Commit** `The game's screens, shapes, mode cards and loading screens are rulebooks`.

### Task 2: The resolver and the shapes

**Files:**
- Modify: `src/lib/bf2017/ui/index.js` (`screen(name, { viewport, data }) → { name, boxes: [{ id, type, x, y, w, h, colour, alpha, font, text, shape, icon, film, link, children }], links, states }`: every element placed by `placeWidget` on the viewport, texts through `text()` with `data` for the `{0}` fills, fonts through `fontFor`, shapes by name; `shape(name) → { viewBox, paths }`; `info(kind, id)`; `loading(mode, level) → { film, hint }` (the film from lane M's `films.js` by the level's planet, the hint drawn by seed))
- Create: `src/lib/bf2017/ui/shapes.js` (`shapeSvg(shape, { colour, size })` → an SVG string / React props; the game's colour unless overridden)
- Test: `src/lib/bf2017/ui/screens.test.js`, `shapes.test.js` (Review Focus 2; the main menu at 1920 × 1080 places the menu widget's cell list within 1 px of the record; at 1280 × 720 scaled by the shorter side)

- [ ] **Step 1: Failing tests.** **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `A screen's tree resolves to boxes, texts, faces and shapes at the game's layout`.

### Task 3: The kit's Screen

**Files:**
- Create: `src/runtime/hud/Screen.jsx` (`<Screen tree={…} onLink={(to) => …} onAction={(id) => …} focus />`: containers, texts, shapes (SVG), icons (`GameIcon`), films (`Film`), lists (the cells as buttons with arrow-key and Enter navigation as the game's navigation frame), the state groups as class names; a modal `role="dialog"` when the tree says so; no layout of its own: every box is the tree's), `src/runtime/hud/screen.css` (the game's palette through `colour()`; the trails and reveals off under reduced motion)
- Modify: `src/runtime/hud/Reticle.jsx` (takes a `shape` and draws it in place of its own ring when given), `src/runtime/hud/index.js` (exports)
- Test: `src/runtime/hud/screen.test.jsx` (renders the main menu fixture; Tab and arrows move the focus through the cells; Enter calls `onLink` with the cell's target; the reticle with a shape renders the SVG)

- [ ] **Step 1: Failing tests.** **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `The kit draws any of the game's screens from its tree`.

### Task 4: The game's screens

**Files:**
- Create: `src/components/battlefront/screens/Start.jsx` (the start screen on the Frontend stage: lane M's `heroStage.js` scene behind, the logo film, press-any-key), `MainMenu.jsx`, `Play.jsx` (Play → the multiplayer category → the mode cards from `info.json` with lane M's tiles; a mode's levels and planets as the game lists them; a card the site cannot play yet greyed with the game's "coming" state), `Loading.jsx` (the loading tree: the film, the hint, the veil's progress in the tree's bar; lane F's `gpuWork.js` wait rule kept), `Spawn.jsx` (the `SpawnOverlayScreen` tree over lane 5's `offerRows`: the classes, reinforcements, heroes and vehicles in the game's cells with their icons and costs; Enter deploys as before; falls back to `DeployScreen.jsx` when the tree is absent), `InGameMenu.jsx` (resume, change class, options stub, leave), `EndOfRound.jsx` (the `EndOfRoundSequenceAsset` steps on a clock: the outcome declaration widget, the score log, the top players, the hero stage with the winners' end poses from lane A's `endPose`), `KillScreen.jsx` (the kill screen's tree with its 36 icons: who, with what, from where), `Scoreboard.jsx` (the game's scoreboard tree over lane 5's rows), `index.js`
- Modify: `src/components/battlefront/BattlefrontWorld.jsx` (the flow: Start → MainMenu → Play → Loading → Spawn → HUD; `InGameMenu` on Escape; `EndOfRound` on the battle's end; `KillScreen` on the player's death; the HUD's reticle takes the weapon's crosshair shape by the game's name (`shapes.json`: `Crosshairs_<weapon>`), the markers their shapes), `src/components/battlefront/hud/BattlefrontHud.jsx` (the reticle and markers), `src/App.jsx` (`/battlefront` with no level opens Start; `/battlefront/:level/:mode` arrives through Loading)
- Test: `src/components/battlefront/screens/screens.test.jsx` (each screen renders from the rulebook; Review Focus 4 and 5; the spawn fallback)

- [ ] **Step 1: Failing tests.** **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `npx vitest run src/components/battlefront`.
- [ ] **Step 5: Commit** `The Battlefront world opens through the game's own screens`.

### Task 5: The galaxy's cards agree

**Files:**
- Modify: `src/components/galaxy/surface/ModeMenu.jsx`, `landLine.js`, `src/components/galaxy/GalaxyPanel.jsx` (the mode names, descriptions, order and tiles from `info.json` through `info()`; the layout stays lane F's), `src/components/galaxy/surface/DeployPanel.jsx` (the class and hero names and icons from the same rows)
- Test: `src/components/galaxy/surface/ModeMenu.test.jsx` (the cards' names are the game's strings; the order the game's list order)

- [ ] **Step 1: Failing tests.** **Step 2** → FAIL. **Step 3: Implement.** **Step 4** → PASS.
- [ ] **Step 5: Commit** `The galaxy's mode menu names its cards as the game does`.

### Task 6: The walk and the shots

**Files:**
- Modify: `scripts/battlefront-check.mjs` (`--screens`: Start → MainMenu → Play → Multiplayer → the Hoth card → Loading → Spawn → deploy → the HUD → Escape → InGameMenu → `__battlefront.do('win')` → EndOfRound; a shot of each; the kill screen by `do('die')`; no console error; the boxes of three screens read from the DOM against the resolver's within 1 px)
- Create: `docs/superpowers/evidence/bf2017-screens/README.md` (the shots; SwiftShader at low, the WebGPU leg on the owner's laptop)

- [ ] **Step 1**: run it; fix what it finds. **Step 2: Commit** `The screens' walk, with its shots`.

### Task 7: The hand-off and the PR

- [ ] `HANDOFF-bf2017.md`, "The sixth design", the screens row: screens drawn / in the rulebook, shapes, the bitmaps wanted, the fonts mapped, what stays lane 5's; a line in `HANDOFF-battlefront.md`'s lane 5 row pointing here.
- [ ] `npm run lint`, `npx vitest run scripts/lib/bf2017-rulebook-ui.test.mjs src/lib/bf2017 src/runtime/hud src/components/battlefront src/components/galaxy/surface/ModeMenu.test.jsx src/components/galaxy/surface/DeployPanel.test.jsx`, `npm run build`, `node scripts/health.mjs --check --skip build`, `npm run coverage:bf2017` (`UI/**` record groups used; the shapes and information assets).
- [ ] Merge `origin/main` (lane 5 and lane M are live: keep both sides), push, open the PR; merge it yourself when CI is green.
