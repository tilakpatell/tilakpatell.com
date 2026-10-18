# Middle-earth’s Sheet Made True Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The 800 × 560 sheet of the Middle-earth map drawn from Tolkien’s geography as data (miles from Hobbiton, every number sourced) through one tested projection that every consumer reads, so the places, rivers, ranges, forests and coasts stand in their true relations.

**Architecture:** `geography.js` holds the research note’s frame, places, lines and areas in miles; `sheet.js` projects them onto the sheet and derives the arrays `mapData.js` used to hold by hand (`mapData.js` becomes a re-export, so the painters change only where ranges become polylines); `road.js`, `chapters.js`, `hidden.js`, `mapFlight.js` and the backdrop’s framing read `placeAt` instead of literals. The before-and-after shots are the proof that pixels moved on purpose.

**Tech Stack:** plain JS data and pure functions, vitest, the existing canvas painter (`mapPaint.js`) and the hub’s scene (`MapBackdrop3D.js`, `mapDiorama.js`), `scripts/autopilot-check.mjs` for the shots.

**Spec:** `docs/superpowers/specs/2026-10-18-the-road-design.md` §4.11 (the lane) and `docs/research/2026-10-18-middle-earth-map-geography.md` (the numbers: §1 the frame, §2 the places, §3 the lines and areas, §4 the Ring’s road, §5 what is wrong today, §6 the checks).

## Global Constraints

- Starts after #1023 (FL2 Middle-earth) has merged: `git fetch origin main && git checkout -B main origin/main` first; the branch `claude/middle-earth-sheet`.
- The backdrop’s `api` keeps every member and signature `MapHub.jsx` and `pages/MiddleEarth.jsx` call; the chapters’ `spot` and `zoom` stay; `SHEET` stays `{ w: 800, h: 560 }`.
- No new dependency; nothing downloaded; no map image copied, traced or measured: every number from the note, with its source in a comment.
- British spelling, curly quotes; every file under 800 lines; every pure file tested, under a second, no canvas.
- The four checks before each push; `git checkout public/github.json` after a build; never skip or quieten a test.

## Review Focus

1. **A chapter’s fly-down lands where the diorama stands**: `pages/MiddleEarth.jsx` passes `placeOf(id).at` as the spot; the diorama’s landmark for that stop must be at the same sheet point; `mapDiorama`’s `ROAD` reads `STOPS`, so `chapters.test.js` asserts every chapter’s `at` equals `stopOf(chapter)`’s `[x, y]` (Task 3).
2. **The flat map’s hidden-place clicks**: `hiddenAt(x, y)` uses `reach` in sheet units; Orthanc, Minas Tirith and Edoras move, and their `reach` must still not overlap a pin; `hidden.test.js` asserts no hidden place within 20 units of a chapter’s `at` (Task 3).
3. **Labels at the whole-map zoom**: more names (Fornost, Tharbad, Dol Amroth, Pelargir…) must not pile up; `labels.test.js` gains a case over the new `PLACES` at the hub’s framing with the overlap count no higher than today’s (Task 5).
4. **The opening flight stays in frame**: `mapFlight.js`’s keyframes from `STOPS` and the end frame from the stops’ bounds; `mapFlight.test.js` asserts every keyframe’s `at` is a stop’s point and the last is the computed framing (Task 4).
5. **A sea path that closes**: `SEAS` paths must be closed SVG paths that start and end on the sheet’s edge, or `paintMap` fills the land; `sheet.test.js` asserts each generated sea path begins with `M` and ends with `Z` and its first point lies on an edge (Task 2).

---

### Task 1: The geography

**Files:**
- Create: `src/components/middleearth/geography.js`, `geography.test.js`

**Interfaces:**
- Produces: `export const FRAME = { origin: 'hobbiton', milesPerUnit: 2, sheetOrigin: [210, 165], east: [-420, 1180], south: [-330, 790] }` (the note §1’s 2-mile mapping); `PLACES: [{ id, name, east, south, kind: 'town' | 'city' | 'fortress' | 'hill' | 'pass' | 'gate' | 'ford' | 'haven' | 'mountain' | 'ruin' | 'wood' | 'lake' | 'sea' | 'region', source, confidence: 'S' | 'D' | 'E' }]` for every row of the note §2 (82), ids kebab-case (`hobbiton`, `bag-end`, `bywater`, `bucklebury`, `bree`, `weathertop`, `last-bridge`, `ford-of-bruinen`, `rivendell`, `high-pass`, `redhorn`, `moria`, `east-gate`, `mirrormere`, `lorien`, `caras-galadhon`, `dol-guldur`, `argonath`, `rauros`, `amon-hen`, `tol-brandir`, `dead-marshes`, `black-gate`, `henneth-annun`, `cross-roads`, `minas-morgul`, `cirith-ungol`, `mount-doom`, `barad-dur`, `osgiliath`, `minas-tirith`, `cair-andros`, `pelargir`, `dol-amroth`, `edoras`, `helms-deep`, `dunharrow`, `isengard`, `fangorn`, `tharbad`, `lond-daer`, `grey-havens`, `fornost`, `annuminas`, `carn-dum`, `gundabad`, `carrock`, `erebor`, `dale`, `esgaroth`, `iron-hills`, `umbar`, `sea-of-rhun`, `sea-of-nurnen`, …); `LINES: [{ id, kind: 'coast' | 'range' | 'river' | 'road', points: [[east, south], …], width?, dark? }]` from §3 (the coast, the Misty, White, Grey and Blue Mountains, the Iron Hills, the Mountains of Mirkwood, the Ered Lithui and the Ephel Dúath with `dark: true`, the fifteen rivers with `width` thin or wide, the five roads); `AREAS: [{ id, kind: 'forest' | 'lake' | 'sea' | 'marsh', points | ellipse: { at, rx, ry }, tint? }]` (the nine forests, `lorien` with `tint: 'gold'`, Mirkwood `'dark'`; the lakes and seas; the Dead Marshes and the Nindalf as `marsh`); `LABELS: [{ name, east, south }]` (ERIADOR, THE SHIRE, RHOVANION, ROHAN, GONDOR, MORDOR, HARAD, RHÛN, LINDON, ENEDWAITH); `ROAD_MILES = { hobbiton: 0, bree: 135, weathertop: 240, rivendell: 458, moria: 798, lorien: 920, 'amon-hen': 1309, 'dead-marshes': 1421, 'black-gate': 1475, 'cirith-ungol': 1613, 'mount-doom': 1779 }`; `DATES = { hobbiton: '23 September 3018', … }` from §4.

- [ ] **Step 1: Write the failing tests**: every id unique; every place inside `FRAME`’s bounds; every row has a non-empty `source`; the note §6’s checks within tolerance: `dist('hobbiton', 'minas-tirith')` within 1 % of 895 and `minas-tirith.south === 600`; `dist('rivendell', 'hollin-ridge')` within 5 % of 135; `dist('moria', 'east-gate')` within 5 % of 40; Osgiliath within 20 miles north-east of Minas Tirith; Fornost within 10 of 100 north of Bree; Annúminas within 10 of 100 west of Fornost; the Ered Lithui line’s length within 5 % of 400; `ROAD_MILES` strictly increasing in road order; every `LINES` point inside the bounds; a `range` line with `dark` only for Mordor’s two.
- [ ] **Step 2: Run** `npx vitest run src/components/middleearth/geography.test.js` → FAIL.
- [ ] **Step 3: Write** `geography.js` from the note, a source comment on every row (the note’s inline citations).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Middle-earth: the geography in miles, every number sourced`.

### Task 2: The projection and the derived sheet

**Files:**
- Create: `src/components/middleearth/sheet.js`, `sheet.test.js`
- Modify: `src/components/middleearth/mapData.js` (becomes `export { SHEET, PLACES, REGIONS, SEAS, RIVERS, RANGES, FORESTS, MARSHES, LAKES, ROADS } from './sheet'` plus the unchanged `peaks`, `range`, `wood` helpers with `range` and `peaks` taking a polyline `[[x, y], …]`; the old `(x0, y0, x1, y1)` form accepted as a one-segment polyline)

**Interfaces:**
- Produces: `project(east, south) → [x, y]` (`x = sheetOrigin[0] + east / milesPerUnit`, `y = sheetOrigin[1] + south / milesPerUnit`); `unproject(x, y) → [east, south]`; `placeAt(id) → [x, y]` (throws on an unknown id); `pathOf(points, { closed = false, tension = 0.5 }) → string` (an SVG path through a Catmull-Rom, `M … C … Z`); `roadFraction(stopId) → 0…1` from `ROAD_MILES`; the derived `PLACES` (the sheet’s `[name, x, y]` rows for the `kind`s the sheet names: towns, cities, fortresses, havens, the ruin, the gate, the mountain; `hobbiton` left out as today, the stops drawn by the painter), `REGIONS`, `SEAS` (closed paths from the coast line and the sheet’s west and south edges, and the Sea of Rhûn’s and Núrnen’s areas), `RIVERS` (`[path, thin]`), `RANGES` (`[points, dark]`), `FORESTS` (`[points | ellipse, seed, count, kind]`), `MARSHES`, `LAKES`, `ROADS`.

- [ ] **Step 1: Write the failing tests**: `project(0, 0)` is `[210, 165]`; `project(675, 600)` is `[547.5, 465]`; `unproject(project(e, s))` round-trips; `placeAt('minas-tirith')` equals that; every derived place inside the sheet; each `SEAS` path starts with `M`, ends with `Z`, first point on an edge; the relations of the spec §4.11 as tests (Minas Tirith west of the Anduin’s path at its row; Osgiliath on it; Weathertop a third of Bree→Rivendell within 0.05; Rivendell west of the Misty Mountains’ polyline at its row; the Isen’s path never crosses the White Mountains’ polyline; Cirith Ungol within 10 units of the Ephel Dúath’s polyline and `mount-doom` within 25 units of it; `dead-marshes` north-west of `black-gate`; Mordor’s box 400 × 240 miles within 10 %; `MORDOR`’s label inside the box; the Brandywine’s first point at Lake Evendim and last on the coast); the road ratios of the note §5’s table within 8 %; `roadFraction('rivendell')` within 0.01 of 0.257.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `sheet.js`; make `mapData.js` the re-export; update `peaks` and `range` to polylines.
- [ ] **Step 4: Run** `npx vitest run src/components/middleearth` → PASS (the existing tests that read `mapData` still pass).
- [ ] **Step 5: Commit** `Middle-earth: the sheet projected from the geography`.

### Task 3: The stops, the chapters and the hidden places

**Files:**
- Modify: `src/components/middleearth/road.js` (`STOPS` rows take `...xy(placeAt(id))` with the ids `hobbiton, bree, weathertop, rivendell, moria, lorien, amon-hen, dead-marshes, black-gate, cirith-ungol, mount-doom`; the texts unchanged), `chapters.js` (`at: placeAt(stop)`), `hidden.js` (`at: placeAt('isengard' | 'minas-tirith' | 'edoras')`), `chapters.test.js`, `hidden.test.js` (new if none)

- [ ] **Step 1: Write the failing tests**: every chapter’s `at` equals its stop’s `[x, y]`; no hidden place within 20 units of a chapter’s `at`; `STOPS` in road order have increasing `x` from Hobbiton to the Black Gate.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Middle-earth: the stops and the places read the sheet`.

### Task 4: The flight, the framing and the diorama

**Files:**
- Modify: `src/components/middleearth/mapFlight.js` (keyframes’ `at` from `STOPS` by id; the last frame from `framing()`), `mapFlight.test.js`, `MapBackdrop3D.js` (`framing() → { at, zoom }` from the stops’ bounds with a margin of 40 units, replacing `[452, 322]` and `3.05`; exported for the test), `mapDiorama.js` (its hand-placed rivers, ranges and woods read `sheet.js`’s `RIVERS`, `RANGES`, `FORESTS` where it builds them; the landmarks already stand on `STOPS`), `MapBackdrop.jsx` (the flat sheet: nothing but the new arrays), `Map.jsx` (the polyline ranges)

- [ ] **Step 1: Write the failing tests** (`mapFlight.test.js`): every keyframe’s `at` is a stop’s point; the last keyframe equals `framing()`; `framing().at` is the stops’ bounds’ centre.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `npm run dev`, `#/middle-earth`: the whole map from the Grey Havens to Barad-dûr in frame, the diorama’s landmarks on the new places, the flight along the new road.
- [ ] **Step 5: Commit** `Middle-earth: the flight and the framing follow the stops`.

### Task 5: The painter and the labels

**Files:**
- Modify: `src/components/middleearth/mapPaint.js` (ranges along polylines, rivers from the generated paths, forests as polygons, the coast from the sea paths, a `marsh` hatch (short horizontal dashes in the ink at 0.35), lakes, the roads as a dotted line at 0.25, the new names at the sheet’s small size), `hub/labels.js` only if a rule must change, `hub/labels.test.js` (the overlap case)

- [ ] **Step 1: Write the failing test**: `cullLabels` over the new `PLACES` projected at the hub’s framing hides no more than today’s count plus the new names that fall within 72 px of a shown one (record today’s count first on `main`).
- [ ] **Step 2: Run** → FAIL or PASS (if it passes, keep it as the pin). **Step 3: Implement** the painter’s changes.
- [ ] **Step 4: Run** → PASS; `paintMap(1024)` under 150 ms in Chromium (a `console.time` in DEV, removed after).
- [ ] **Step 5: Commit** `Middle-earth: the sheet painted from the lines`.

### Task 6: The shots and the pull request

- [ ] **Step 1:** On `main` before any change (do this first, at Task 1’s start, and keep the pictures): `node scripts/autopilot-check.mjs --skip lint,test --routes /middle-earth,/middle-earth/shire,/middle-earth/moria,/middle-earth/mordor --shots sheet --before` and `--phone`.
- [ ] **Step 2:** After Task 5: the same without `--before`; `Read` each pair; the hub whole and the three places’ framings; the diorama’s landmarks on their new places; nothing cut off; the flat map (`tp-map3d` off) the same picture.
- [ ] **Step 3:** The four checks; `docs/architecture.md`’s Middle-earth sentence names `geography.js` and `sheet.js`; `docs/superpowers/HANDOFF-the-road.md`’s sheet row; push `claude/middle-earth-sheet`; the pull request with the pairs and the note’s §5 list each marked fixed; merge when CI is green.
