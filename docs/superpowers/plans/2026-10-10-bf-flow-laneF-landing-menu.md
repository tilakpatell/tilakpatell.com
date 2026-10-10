# Lane F: the landing menu, the deploy screen and the two bugs. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (one session, task by task; no review loops: the owner wants speed). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land on any galaxy world and be asked, in Battlefront's own cards, what to play: Galactic Assault, Starfighter Assault, Heroes vs Villains, Blast, the world's Story missions, Free roam; deploy as a hero or a 2017 trooper class before stepping out; and never again be refused a hero or held on the landing veil because a file is missing.

**Architecture:** Galaxy page code (budgets hold). A pure `surface/modes.js` joins `src/data/bf2017/modes.json` (the levels' mode layers, from the extractor's new `modes` command) with the site's own missions and the war to give each world its cards and where each goes; `ModeMenu.jsx` draws them over the landed world; `?mode=` resolves through `missionOf`; `HeroPanel.jsx` grows into `DeployPanel.jsx` (side → who → outfit → weapon → perks). In `scene.js`, `kitOut` gains a fallback chain and the prepare path a reporting veil.

**Spec:** `docs/superpowers/specs/2026-10-10-battlefront-flow-and-mods-design.md`, decisions 1, 2, 3, 7, 8, 9 and the two bugs.

## Global constraints

- Start from `main`. Own: `src/pages/GalaxySurface.jsx`, `GalaxyMission.jsx`, `src/components/galaxy/GalaxyPanel.jsx` (the mode lines only), `src/components/galaxy/surface/{ModeMenu.jsx,modes.js,DeployPanel.jsx,surface.css}`, `HeroPanel.jsx` (renamed), `scene.js` (`kitOut`, `fit`, the prepare's reporting only), `travel.js` (`surfaceProps`'s `mode`), `scripts/bf2017-data.mjs` and `scripts/lib/bf2017-rulebook-map.mjs` (the `modes` command, additive), `src/data/bf2017/modes.json`, `scripts/landing-check.mjs`, `src/components/worlds/LoadingVeil.jsx` (the "why" line and the button, additive).
- The galaxy's budget rows hold (`galaxy-check surface hoth` with `BUDGET=1` at low and high must not grow by more than the menu's own files); files under 800 lines; British spelling, curly quotes; one plain-sentence commit each; `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` before the PR.
- No sequel era: `modes.json` is written for the non-sequel levels only (`isSequel` refuses the rest).
- The asset base: in a cloud session set `VITE_ASSET_BASE=https://jzabcqboyemokwifmjmp.supabase.co/storage/v1/object/public/site-assets` for the dev server and `landing-check`; also run both without it, since the live site had none until the owner set the variable.

## File structure

| file | responsibility |
| --- | --- |
| `scripts/lib/bf2017-rulebook-map.mjs` | `modesOf(levelJson)`: the mode ids a level's `subworlds` carry (`MODE_LAYERS` already maps layer → mode; add `SpaceBattle → starfighter`, `Mode1 → supremacy`) |
| `scripts/bf2017-data.mjs modes` | writes `src/data/bf2017/modes.json`: `{ "<site world id>": { level, modes: [...], names: { id: string id } } }` for every non-sequel level, with the level and mode display strings (`ID_LEVEL_*`, `ID_GAMEMODE_*` from `strings/English.json`; the hashed-id rule is in that file's header) |
| `src/data/bf2017/modes.json` | the rulebook |
| `src/components/galaxy/surface/modes.js` (+ test) | `MODES` (id, name, about, icon), `modesFor(systemId, { missions, war, battlefront })` → cards with `state: 'live' \| 'soon' \| 'none'`, `why`, `to`; `missionForMode(systemId, mode)` → the mission id the surface runs, or `null` for free roam |
| `src/components/galaxy/surface/ModeMenu.jsx` (+ test) | the cards over the world, keyboard and touch, Esc closes to free roam, `Deploy` opens the deploy screen |
| `src/components/galaxy/surface/DeployPanel.jsx` (+ test) | `HeroPanel.jsx` renamed and grown: Side, Who (heroes and classes), Outfit, Weapon, Perks; Equip never disabled by a fetch |
| `src/components/galaxy/surface/scene.js` | `kitOut`'s fallback chain; the prepare's `report(step, file)` |
| `src/components/worlds/LoadingVeil.jsx` | the `waiting` line and the `onSkip` button |
| `src/pages/GalaxySurface.jsx` | `?mode=`, the menu's phase, the deploy screen |
| `src/pages/GalaxyMission.jsx`, `GalaxyPanel.jsx` | the cards as links |
| `scripts/landing-check.mjs` | the two timings |

## Tasks

### Task 1: The honest Equip (bug 1)

**Files:** `scene.js` (`kitOut`, `fit`), `src/components/galaxy/heroes.js` (a `fallback` field per hero: the committed Meshy figure's url for Luke, Han, Leia, Vader, Palpatine; `null` for the rest), `crewList.js` (read only), `pages/GalaxySurface.jsx` (the toast), `DeployPanel.jsx`.

- [ ] Step 1: In `kitOut`, when `loadPartyFigure` rejects or returns `null` for a `rig: 'walrus'` spec, try in order: the hero's `.lod1` cut alone (walrus.js's `cutsToLoad` with `light: true`), the hero's `fallback` figure (a Meshy body through the same `rigged()` path, `rig` unset), then the humanoid stand-in (`crew/stormtrooper.lod1.glb` or the kind the world's garrison wears, in the hero's colours off). Return `{ ..., stoodIn: 'light' | 'meshy' | 'standin' }`.
- [ ] Step 2: `fit` passes `stoodIn` through the `hero` event (`{ type: 'hero', who, ok: true, stoodIn }`); the page's toast says "Luke Skywalker, in a lighter body: the full one didn't arrive" (or "…stood in by a trooper") once; `ok: false` only when nothing at all loaded.
- [ ] Step 3: Unit test on `kitOut`'s chain with a loader that rejects the first URL (`scene.kitout.test.js`, the existing `footScene.walrus.test.js` pattern).
- [ ] Step 4: Check in the browser with `VITE_ASSET_BASE` unset: pick Luke on Hoth → he appears in a body and the toast says which; with it set → the game's body, no toast.

### Task 2: The landing veil (bug 2)

**Files:** `scene.js` (the prepare's steps), `surface/module.js`, `LoadingVeil.jsx`, `pages/GalaxySurface.jsx`, `pages/Galaxy.jsx` (the veil it shows on Land), `scripts/landing-check.mjs`.

- [ ] Step 1: Reproduce in a **fronted** headless tab (`landing-check.mjs`, `CHROME=Edge`, `ANGLE=d3d11` on the desktop; in the cloud SwiftShader is slow but must still finish): time each prepare step on `#/galaxy/hoth/surface` at `?quality=high`, with and without the base. Write the numbers into the PR. If the 33 % step never ends, find the promise (the `warm` of a figure whose file 404'd, the level pack's upload, or the KTX2 transcoder) and fix the cause.
- [ ] Step 2: The prepare reports `{ step, file }` through `progress` (the runtime's `usePrepareProgress`); every fetch in it goes through `assetBase.js`'s `withFallback` or has a `WAIT_MS` race of its own; a 404 resolves the step with the fallback of Task 1.
- [ ] Step 3: `LoadingVeil` shows "Waiting for <file>" after 10 s on one step and a "Go in anyway" button after 20 s (`onSkip`): the world starts with what is built, the rest arriving behind (the surface's streaming already does this for the level's cells).
- [ ] Step 4: `landing-check.mjs` asserts the Hoth landing is on screen under 25 s with the base and 30 s without, fronted, at high; the shots to `docs/superpowers/evidence/bf-flow/`.

### Task 3: `modes.json` from the levels

**Files:** `scripts/lib/bf2017-rulebook-map.mjs`, `scripts/bf2017-data.mjs`, `scripts/fixtures/bf2017/` (a cut `subworlds` list for Hoth and `sb_endor_01`), `src/data/bf2017/modes.json`, `src/lib/battlefront/rulebook.js` (`modesOf(world)`).

- [ ] Step 1: `modesOf(levelJson)` over `subworlds` names (`FantasyBattle → galacticAssault`, `HeroArena \| HeroesVsVillains → hvv`, `TeamDeathmatch → blast`, `Mode9 → strike`, `Mode6 → extraction`, `PlanetaryMissions → arcade`, `Mode1 → supremacy`, `SpaceBattle → starfighter`); the site world id from the level name (`hoth_01 → hoth`, `sb_endor_01 → endor` as a `space` entry, `geonosis_01 → geonosis`, `tatooine_01 → tatooine`, `kashyyyk_01 → kashyyyk`, `naboo_01 → naboo`, `yavin_01 → yavin`, `deathstar02_01 → deathstar`, `kamino_01 → kamino`, `endor_01 → endor`, `cloudcity_01 → bespin`, `scarif_02 → scarif`, `felucia_01 → felucia`, `jabbaspalace_01 → tatooine` as a second); sequel levels refused.
- [ ] Step 2: The mode and level names from `strings/English.json` (fetched with `bf2017-fetch.mjs web 'strings/*'`; the id is the hash in the file's header); write `names`.
- [ ] Step 3: Tests on the fixture; `node scripts/bf2017-data.mjs modes --root <web dir>` on the owner's export or the bucket; commit `modes.json` (small).

### Task 4: `modes.js` and the menu

**Files:** `surface/modes.js` (+ test), `surface/ModeMenu.jsx` (+ test), `surface.css`, `surface/missions/index.js` (`missionOf` accepts a mode), `travel.js` (`surfaceProps` carries `mode`), `pages/GalaxySurface.jsx`.

- [ ] Step 1: `modesFor(systemId, ctx)`: for each of `MODES` → `live` with `to` when the site runs it here (galacticAssault: an `assault` mission in `MISSIONS[system]`, or `battlefront.worlds[system]` once lane 5's route exists; starfighter: lane A's `STARFIGHTER[system]`, else the war's battle at this system if one is on, else `soon`; hvv, blast: lane H's missions; story: the world's chase/quest/`game.to`; free: always), `soon` with `why` when `modes.json` says the game's level has the layer and the site has no map yet, `none` with `why` when neither.
- [ ] Step 2: `ModeMenu.jsx`: the cards (the game's string for the name, one line `about`, the icon from `public/battlefront/icons/` or an inline SVG from the game's set, the state), arrow keys and Enter, Esc = free roam, a `Deploy` button that opens the deploy screen first, touch sizes; glass under text; the world visible and slowly orbiting behind (the title card's own camera move).
- [ ] Step 3: The page: after the title card (`phase === 'landing'` ends) the menu shows unless `?mode=` or `?mission=` named one or `local` remembers "don't ask again" (a toggle on the menu); choosing navigates to `?mode=<id>` (the surface rebuilds for a mission as it does for `?mission=` now); the Menu gains "Change mode".
- [ ] Step 4: `GalaxyMission.jsx` lists the same cards under the briefing (a `live` one links, a `soon` one says why); `GalaxyPanel.jsx`'s Land button gains the one-line list of what is live down there.
- [ ] Step 5: Tests: every landable world has at least Free roam and Story; Hoth has Galactic Assault live; a `soon` card carries a `why`; `?mode=galacticAssault` on Hoth resolves to `assault`.

### Task 5: The deploy screen

**Files:** `HeroPanel.jsx` → `DeployPanel.jsx` (+ test), `surface.css`, `src/data/bf2017/classes.json` (read), `heroes.js` (`sideOf(hero)`), `crewList.js` (the trooper kinds already there).

- [ ] Step 1: Side first: the world's era (`eraOf(sys)`) gives the two sides and their names and emblems from the war (`sides.js`); a hero's `lean` picks its side; the classes come from `classes.json` by side and era (Assault, Heavy, Officer, Specialist; the figure is the kind the crew list has for that faction: `rebel`/`hothtrooper`, `stormtrooper`/`snowtrooper`, `clone`, `battledroid`), with the game's icon and string.
- [ ] Step 2: Who: the heroes of that side and the four classes as cards; picking a class sets `hero` to `{ id: '<kind>', class: 'assault', gun: <the class's default weapon from classes.json> }` and the scene's party lead is that kind (the crew list row; the walrus loader as for any kind); Outfit, Weapon, Perks tabs as today.
- [ ] Step 3: Equip is never disabled by a fetch; the panel shows the fallback note from Task 1 when it applies.
- [ ] Step 4: Tests: a class pick yields a spec the scene accepts; the sides per era; Esc closes.

### Task 6: Docs, checks, PR

- [ ] `HANDOFF-battlefront.md` section "The flow and the mods": lane F's row done with the numbers; the spec's Departures; `docs/architecture.md` one line; `README.md` one line.
- [ ] Gates: lint, test, build, health; `galaxy-check surface hoth` with `BUDGET=1` at low and high; `landing-check`; the shots in the evidence folder.
- [ ] PR titled `Battlefront lane F: land, choose the mode, deploy`; merge `origin/main` first and keep both sides.
