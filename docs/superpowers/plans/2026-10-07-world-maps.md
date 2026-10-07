# World Maps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A corner minimap and a full map (on M) on every galaxy surface and every universe landing.

**Architecture:** One shared piece in `src/lib/worldmap/`: pure projection and baking modules plus a React component with an imperative handle (`setBase`, `update`). Each engine adapts its own data. The galaxy's adapter is `galaxy/surface/mapBase.js`, fed from `surface/scene.js`. The universe's adapter is `universe/landings/mapBase.js`, fed from `footScene.js` through `universe/scene.js`. The engines push data into the component the way the galaxy scene already pushes the compass into a ref.

**Tech Stack:** React 19, Three.js r186 (not used by the map itself; the map is a 2D canvas), vitest (Node, no DOM), Playwright with the pre-installed Chromium for browser checks.

**Spec:** `docs/superpowers/specs/2026-10-07-world-maps-design.md`

## Global Constraints

- World coordinates: metres `(x, z)`, north is +z, east is −x. The bearing is `atan2(dx, dz)`, as `galaxy/surface/scene.js`'s `compass()` has it.
- Minimap: round, 150 px across on desktop and 112 px on phones (`max-width: 640px`). Redraw at about 12 Hz.
- Minimap reach: 120 m of radius on a galaxy surface, 90 m on a universe landing.
- Heading-up; north-up under reduced motion (`useReducedMotion` from `src/lib/hooks`).
- Full map: `role="dialog"`, `aria-modal="true"`, labelled with the world's name. It opens on M or a tap on the minimap and closes on M, Escape or its × button. The game keeps running under it.
- A place not yet found shows as "?" on both maps, as on the compass.
- The universe's local picture is ±250 m, 256², re-baked once you are more than 120 m from its middle. The planet image copy is at most 2048 × 1024.
- Low-tier galaxy bake: 256², budgeted at under 80 ms; drop to 128² if it measures slower.
- Nothing new is sent over the network.
- Comments and docs follow the house voice: plain words, "you" for the player, no "we".

## Review Focus

- **Zones:** walking into a zone (cantina, temple) and out again. Expect the minimap to say "Inside · <name>" and pin to the door, then go back to normal outside. Task 5 tests this through `frameFor`.
- **The ship or quest target off the minimap:** expect an arrow on the rim pointing the true bearing at every heading. Task 1's `onRim` test covers all four quadrants with the view turned.
- **The universe planet image is a KTX2 (not readable):** expect a flat palette-colour picture and no Planet tab, with no exception thrown. Task 6 tests `planetPicture(null)`.
- **Walking far on a universe landing (over 120 m, then over 400 m):** expect the picture to re-centre, and places and footprints to stay where they are on the ground. Task 6 tests `toFrame` and the re-centring round trip at 400 m.
- **M while the touch controls or another dialog is up:** expect M to toggle only the map, and Escape to close the map before anything else. Task 5 and Task 7 browser checks press M, then Escape, and read `[aria-modal]`.

---

### Task 1: The map's projection (`src/lib/worldmap/project.js`)

**Files:**
- Create: `src/lib/worldmap/project.js`
- Test: `src/lib/worldmap/project.test.js`

**Interfaces:**
- Produces:
  - `view({ centre: [x, z], yaw: number, radius: number, size: number, headingUp: boolean }) → View`. A `View` is a plain object `{ centre, yaw, radius, size, scale, cos, sin }`, where `scale` is pixels per metre (`size / 2 / radius`). Heading-up turns the map so that `yaw` (the camera's bearing) points to the top. North-up ignores `yaw`.
  - `toPixel(v: View, [x, z]) → [px, py]`, with the canvas origin top-left and y down.
  - `toWorld(v: View, [px, py]) → [x, z]`.
  - `onRim(v: View, [x, z], inset: number) → { px, py, angle, off: boolean }`. A point inside the circle (radius `size / 2 − inset`) comes back as itself with `off: false`. A point outside comes back clamped to that circle along the same screen direction with `off: true`. `angle` is the screen angle (radians, clockwise from up) for an arrow.
  - `fit(area: { x0, z0, w, d }, w: number, h: number, pad: number) → View`: a north-up view centred on the area, its scale the largest that fits inside `w × h` less `pad` on each side, with `size = min(w, h)`.

- [ ] **Step 1: Write the failing tests** in `project.test.js`:
  - `it('puts the centre in the middle and north up when north-up')`: with `view({ centre: [10, 20], yaw: 1.2, radius: 100, size: 200, headingUp: false })`:
    - `toPixel(v, [10, 20])` is `[100, 100]`.
    - `toPixel(v, [10, 120])` is `[100, 0]` (north is up).
    - `toPixel(v, [-90, 20])` is `[200, 100]` (east, −x, is right).
  - `it('turns so the camera’s way is up when heading-up')`: with `yaw = Math.PI / 2` (looking toward +x, which is west), `toPixel(v, [centre[0] + 50, centre[1]])` is close to `[100, 50]`.
  - `it('round-trips toWorld(toPixel(p))')`: 20 points × 3 yaws, each within 1e-9.
  - `it('clamps off-map points to the rim with the true bearing')`: for each of N, E, S and W at 500 m with `size 200, radius 100, inset 8`:
    - `off` is true.
    - `Math.hypot(px − 100, py − 100)` is close to `92`.
    - `angle` matches `Math.atan2(px − 100, −(py − 100))`.
    - Repeat with `headingUp: true, yaw: 0.7`.
  - `it('fits an area into a box')`: `fit({ x0: −640, z0: −640, w: 1280, d: 1280 }, 800, 600, 20)` has scale `(600 − 40) / 1280` and its centre at `[0, 0]`.
- [ ] **Step 2: Run it and see it fail.** Run `npx vitest run src/lib/worldmap/project.test.js`. Expect FAIL: "Cannot find module './project'".
- [ ] **Step 3: Implement `project.js`** with the five exports above. Write the header comment in the house voice.
- [ ] **Step 4: Run it and see it pass.** Run `npx vitest run src/lib/worldmap/project.test.js`. Expect PASS.
- [ ] **Step 5: Commit.** `git add src/lib/worldmap/project.*` then `git commit -m "World maps: the projection (heading-up, the rim, fitting a world)"`.

### Task 2: The background picture (`src/lib/worldmap/bake.js`)

**Files:**
- Create: `src/lib/worldmap/bake.js`
- Test: `src/lib/worldmap/bake.test.js`

**Interfaces:**
- Produces:
  - `bakeBase({ area: { x0, z0, w, d }, size: number, colour: (x, z, out) => void, height: (x, z) => number, water: { level, kind, color, deep } | null }) → { data: Uint8ClampedArray, size, area }`.
    - `data` is RGBA sRGB bytes, row 0 at the north edge (`z0 + d`) and column 0 at the west edge (`x0 + w`), so the picture is drawn north-up and east-right with no flipping.
    - `colour` writes a linear colour into `out`.
    - Hillshade: light from the north-west. The factor is `clamp(0.75 + 0.6 * dot(n, L), 0.55, 1.25)`, where `n` is the normal from height differences over one texel and `L = normalize(1, 1.6, −1)` in `(east, up, north)` terms. Keep the light vector named so a test can check the direction.
    - Water by kind, under `water.level`:
      - `sea`, `swamp`, `salt`: mix `color` toward `deep` by `clamp(depth / 12, 0, 1)`.
      - `lava`: `#ff5a14` toward `#3a120a` by a hash noise at 6 m (crust patches).
      - `clouds`: `#e8e4ee`.
  - `footprints(solids: Array<{ type: 'circle', x, z, r } | { type: 'box', x, z, hw, hd, yaw }>, floors = []) → Array<{ kind: 'circle', x, z, r } | { kind: 'poly', pts: [[x, z]…] }>`.
    - Boxes become 4-corner polygons, turned as `walker.js` turns them: its own x along `(cos yaw, −sin yaw)`.
    - Floors (`{ x, z, r }` discs or `{ x, z, hw, hd, yaw }` boxes) are included the same way.
    - Circles under 0.6 m (posts, scatter) are dropped.
  - `toSrgbByte(c: number) → number`: exported for the universe adapter.

- [ ] **Step 1: Write the failing tests:**
  - `it('paints colour north-up, east to the right')`: colour red for `z > 0` and blue otherwise. Row 0 is red and the last row is blue. Then colour green for `x < 0` (east): the last column is green.
  - `it('fills water by kind under its level')`: height −5 everywhere.
    - With `{ level: 0, kind: 'sea', color: '#2060a0', deep: '#001030' }`, the pixel is bluish (b > r).
    - With `kind: 'lava'`, r > g > b.
    - With `kind: 'clouds'`, all three channels are > 200.
  - `it('shades slopes facing the north-west lighter than slopes facing the south-east')`: a ridge `height = abs(x + z)`. A pixel on the NW face is brighter than its mirror on the SE face.
  - `it('turns solids and floors into shapes, dropping posts')`:
    - A box `{ x: 0, z: 0, hw: 2, hd: 1, yaw: Math.PI / 2 }` gives a poly whose corners lie at |x| ≤ 1 and |z| ≤ 2.
    - A circle with r 0.3 is dropped.
    - A floor disc `{ x: 5, z: 5, r: 4 }` is kept.
- [ ] **Step 2: Run it and see it fail.** Run `npx vitest run src/lib/worldmap/bake.test.js`. Expect FAIL.
- [ ] **Step 3: Implement `bake.js`.** Re-use `three`'s `Color` for hex parsing (`new THREE.Color(hex)` is linear in r186's colour management).
- [ ] **Step 4: Run it and see it pass.** Expect PASS.
- [ ] **Step 5: Commit:** `"World maps: the background picture (colour, hillshade, water by kind, footprints)"`.

### Task 3: The component (`src/lib/worldmap/WorldMap.jsx`, `worldmap.css`, `draw.js`)

**Files:**
- Create: `src/lib/worldmap/WorldMap.jsx`, `src/lib/worldmap/worldmap.css`, `src/lib/worldmap/draw.js`, `src/lib/worldmap/legend.js`
- Test: `src/lib/worldmap/WorldMap.test.jsx` (static markup through `react-dom/server`'s `renderToStaticMarkup`), `src/lib/worldmap/legend.test.js`

**Interfaces:**
- Consumes: Task 1's `view`, `toPixel`, `onRim`, `fit`. Task 2's bake output (`{ data, size, area }`), which becomes an `ImageData` on a cached offscreen canvas.
- Produces:
  - `WorldMap` (default export), a `forwardRef` component with props `{ title: string, className?: string, reach: number, open: boolean, onOpen(open: boolean) }`. Its handle:
    - `setBase(base)`. The base is `{ title, area, picture: { data, size, area }, footprints, places: [{ id, name, at: [x, z], r, found }], tabs?: { planet: { image: CanvasImageSource, title } } }`.
    - `update(frame)`. The frame is `{ me: { x, z, yaw }, cam: number, mate?: [x, z], ship?: [x, z], quest?: [x, z], marks: [{ x, z, kind: 'hostile' | 'peer' | 'npc' | 'door', label? }], zone?: { name, door: [x, z] }, planet?: { me: [u, v], ship: [u, v], site: [u, v] } }`.
    - `update` only stores the frame. A `requestAnimationFrame` loop throttled to 12 Hz draws it, and stops while the tab is hidden.
  - `WorldMapView({ base, frame, open, tab, onTab, onClose, reduced })`: the full map's markup. Named export, so the test can render it.
  - `legendFor(base, frame) → Array<{ kind, label }>` in `legend.js`, pure. Only the kinds present appear: You, Mate, Ship, Quest, Place, Unfound place, Enemy, Pilot, Door.
  - `draw.js`:
    - `drawMini(ctx, v, picture, base, frame, { reduced })`: clip to the circle, draw the picture through the view's transform, footprints, marks, and you as an arrow in the middle. Add the N tick on the rim, and rim arrows from `onRim` for the ship and the quest.
    - `drawFull(ctx, v, picture, base, frame)`: the same at full size, north-up, with place names.
    - Colours come from CSS custom properties read once from the element (`--wm-you`, `--wm-mate`, `--wm-ship`, `--wm-quest`, `--wm-hostile`, `--wm-peer`, `--wm-place`).

- [ ] **Step 1: Write the failing tests:**
  - `legend.test.js`:
    - `it('lists only the kinds on the map')`: a base with 2 places (one found) plus a frame with a ship and one hostile gives `['You', 'Ship', 'Place', 'Unfound place', 'Enemy']` in that order.
    - `it('names the mate when there is one')`.
  - `WorldMap.test.jsx`:
    - `it('renders the full map as a labelled modal dialog with a list of places and distances')`: `renderToStaticMarkup(<WorldMapView base={…} frame={{ me: { x: 0, z: 0, yaw: 0 }, cam: 0, marks: [] }} open tab="here" />)` contains:
      - `role="dialog"`, `aria-modal="true"` and `aria-label="Map of Mustafar"`;
      - an `<li>` per place, reading `The lava river · 178 m` for a place at `[175, 25]` (rounded metres);
      - `?` for an unfound place.
    - `it('shows the Planet tab only when the base has one')`.
    - `it('says Inside · name in a zone')`.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/lib/worldmap`. Expect FAIL.
- [ ] **Step 3: Implement `legend.js`, then `WorldMap.jsx` and `draw.js`, then `worldmap.css`.**
  - CSS classes: `.wm-mini` (the round canvas button, `aria-label="Open the map"`), `.wm-full` (the dialog), `.wm-legend`, `.wm-places`, `.wm-tabs`.
  - Escape and M are handled by the page (Tasks 5 and 7) through `open` and `onOpen`. The component's × button calls `onOpen(false)`.
  - The canvas is sized by `devicePixelRatio`, capped at 2.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/lib/worldmap`. Expect PASS.
- [ ] **Step 5: Commit:** `"World maps: the minimap and the full map"`.

### Task 4: The galaxy's adapter (`src/components/galaxy/surface/mapBase.js`)

**Files:**
- Create: `src/components/galaxy/surface/mapBase.js`
- Test: `src/components/galaxy/surface/mapBase.test.js`

**Interfaces:**
- Consumes:
  - Task 2: `bakeBase`, `footprints`.
  - `groundPaint.js`: `groundPainter(site, grid)` gives `{ paint, height }`, and `mapAreaOf()`.
  - `terrain.js`: `heightGrid`, `makeHeight`.
  - `lavaRules.js`: `lavaOf`, `lavaAt`.
- Produces:
  - `mapBaseOf({ site, grid, found: string[], solids?: Array, floors?: Array, small?: boolean, painted?: { data: Uint8Array, size: number }, size?: number }) → base`, with the base shape from Task 3.
    - Picture size: `size`, else 256² when `small`, otherwise 384².
    - `painted` is the ground map's own bytes (`groundMap.texture.image.data`, RGBA sRGB with grass in A, row 0 at `z0`, column 0 at `x0`). When it is given, `colour(x, z, out)` reads the nearest texel back to linear instead of calling the painter, as the spec asks. Otherwise it calls `groundPainter(site, grid).paint`.
    - `water`: `site.water` where it's a lava, sea, swamp or salt kind. On a lava world the water level is replaced by `lavaAt` per point, which covers Nevarro's pools. That means `bakeBase`'s water check takes an optional `levelAt(x, z)`, which Task 2's signature allows as `water.levelAt`. Add that to Task 2's test as `it('a level by place: a pool here, dry there')`.
    - `site.noGround` (Bespin): the colour is clouds everywhere, no hillshade.
  - `placesOf(site, found) → [{ id, name, at, r, found }]`.
  - `frameFor({ me, camYaw, mate, ship, quest, targets, peers, zone, doors }) → frame`, pure.
    - Hostiles are targets with `hostile && hp > 0 && !down && spec?.side !== 'yours'`. Only those within 1.6 × 120 m of `me` are included.
    - `zone` is `{ name, door }` from a zone object.
- [ ] **Step 1: Write the failing tests:**
  - `it('covers the walkable square and marks places found and not')`: `siteOf('mustafar')` with `found = ['river']` has `area.w` 1280, 7 places, and only `river` found.
  - `it('paints Mustafar’s lava as lava')`: a pixel at the river's middle `[175, 25]` (column and row worked out from the area) has r > 150 and b < 80.
  - `it('Bespin is a sea of cloud with its decks on it')`: every pixel's channels are > 180, and `footprints` is non-empty when given `site.floors`.
  - `it('the frame keeps only live hostiles near you, and the zone’s door')`.
  - `it('reads the ground map’s own bytes when given them')`: a 2 × 2 `painted` whose north-east texel is pure red (row 1, column 0) gives a red north-east corner pixel when `site.water` is null.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/galaxy/surface/mapBase.test.js`. Expect FAIL.
- [ ] **Step 3: Implement `mapBase.js`.**
- [ ] **Step 4: Run them and see them pass.** Expect PASS.
- [ ] **Step 5: Commit:** `"World maps: the galaxy's worlds, as a map"`.

### Task 5: The galaxy, wired (`surface/scene.js`, `peers.js`, `SurfaceView.jsx`, `pages/GalaxySurface.jsx`, `surface.css`)

**Files:**
- Modify:
  - `src/components/galaxy/surface/scene.js`: build the base once after placement settles, keep it up to date, and send frames beside `compass()`.
  - `src/components/galaxy/surface/peers.js`: add `where() → [{ x, z, name }]` for each shown pilot's lead.
  - `src/components/galaxy/surface/SurfaceView.jsx`: pass `map` through props.
  - `src/pages/GalaxySurface.jsx`: mount `<WorldMap>`; M toggles it, Escape closes it.
  - `src/components/galaxy/surface/surface.css`: the minimap's place.
- Create: `scripts/map-check.mjs` (browser).

**Interfaces:**
- Consumes:
  - Task 4: `mapBaseOf`, `frameFor`.
  - Task 3: `WorldMap`'s handle `setBase` and `update`.
- Produces: `props.map` on the scene, a ref to the WorldMap handle, like `props.compass`.

- [ ] **Step 1: Write the browser check `scripts/map-check.mjs`.**
  - Model it on `scripts/lava-check.mjs`: reduced motion, game-time waits, `OUT`, `QUALITY`, `W`, `H`.
  - Galaxy mode: `node scripts/map-check.mjs galaxy mustafar,hoth,bespin,coruscant`. For each world:
    1. Wait for walk.
    2. Assert `.wm-mini` is visible, and screenshot.
    3. Press `m`: assert `[role=dialog][aria-modal=true]` with name `Map of <World>`, and screenshot.
    4. Press `Escape`: assert it's gone.
    5. Click `.wm-mini`: assert it opens. Press `m`: assert it closes.
    6. Teleport into the first zone's door with `__surfaceDo('zone', id)`: assert the minimap's text `Inside ·`.
  - Phone: viewport 390×844 with `hasTouch` adds a minimap screenshot.
- [ ] **Step 2: Run it against the current code and see it fail.** With the dev server up (`npx vite --port 5188 --host 127.0.0.1`), run `OUT=<scratch>/shots node scripts/map-check.mjs galaxy mustafar`. Expect `FAIL mustafar: no minimap`.
- [ ] **Step 3: Wire it in.**
  - `scene.js`:
    - `const mapState = { base: null, solids: 0, at: 0 }`.
    - `pushMap()` runs each frame after `compass()`.
      - If `!mapState.base`, or `world.solids.all.length` changed and at least 1 s has passed since the last change, rebuild with `mapBaseOf` and call `props.map.current?.setBase`. Pass `painted: groundMap?.texture.image.data` with its size when there is a ground map.
      - With no ground map (low tier), time the first bake with `performance.now()`. If it takes over 80 ms, bake again at `size: 128` from then on, as the spec's budget says.
      - Every 1/12 s, call `props.map.current?.update(frameFor(...))`. The quest target comes from the logic `compass()` already uses: extract it into a local `questTarget(p)` and use it in both.
      - Doors are `site.zones.map((z) => z.door.at)`.
  - `GalaxySurface.jsx`:
    - `const [mapOpen, setMapOpen] = useState(false)` and `const map = useRef(null)`.
    - In the key handler: `m` toggles, unless the focus is in an input. `Escape` closes the map first, before the quest list.
    - Hide the minimap while `phase === 'landing'`, as `.surface-compass` is hidden.
  - CSS:
    - Desktop: the minimap goes under `.surface-where`: `left: 16px; top: calc(var(--nav-h, 64px) + 96px)`.
    - Phones: `right: 12px; top: calc(var(--nav-h, 64px) + 128px)`, 112 px.
    - Check both by screenshot, and move it if it covers the HUD.
- [ ] **Step 4: Run the check and see it pass.** Run `node scripts/map-check.mjs galaxy mustafar,hoth,bespin,coruscant`. Expect no `FAIL` lines and exit 0. Read the screenshots: the minimap must not overlap `.surface-where`, `.surface-quest`, `.surface-health` or the touch buttons.
- [ ] **Step 5: Run the galaxy surface tests and lint.** Run `npx vitest run src/components/galaxy && npx eslint src/components/galaxy src/pages/GalaxySurface.jsx src/lib/worldmap`. Expect them all to pass.
- [ ] **Step 6: Commit:** `"World maps: a map on every galaxy world"`.

### Task 6: The universe's adapter (`src/components/universe/landings/mapBase.js`)

**Files:**
- Create: `src/components/universe/landings/mapBase.js`
- Test: `src/components/universe/landings/mapBase.test.js`

**Interfaces:**
- Consumes:
  - `foot.js`: `place`, `flat`, `vec`, `METRE`, `offset`.
  - `biomes.js`: `uvOf`.
  - Task 2: `toSrgbByte`.
- Produces:
  - `mapFrameAt(n: [x, y, z], fallbackF: [x, y, z]) → { n, f }`. `f` is `flat([0, 1, 0], n)`, or `fallbackF` within 2° of a pole.
  - `toFrame(frame, n, R) → [x, z]` in metres, the inverse of `place(frame, x, z, R)`: +z along `f`, +x along `n × f`.
  - `bakeLocal({ frame, R, read: (u, v) => [r, g, b] | null, size = 256, half = 250, fallback: [r, g, b] }) → { data, size, area: { x0: −half, z0: −half, w: 2 * half, d: 2 * half } }`. North-up as in Task 2, sampled through `place` then `uvOf`. `read` returns sRGB bytes (from the picture copy) or null, and null uses `fallback`.
  - `planetPicture(image: CanvasImageSource | null, { flip, max = 2048 }) → { canvas, read(u, v) } | null`: browser-only, guarded by `typeof document`, returns `null` for a null image.
  - `placesOn({ frame, R, spots }) → places` (doors labelled from `spot.label`, people from `spot.say.name`) and `footprintsOn({ frame, R, solids }) → footprints` (circles of `r / METRE` metres). It is not `solidsOn`, which `foot.js` already exports.
- [ ] **Step 1: Write the failing tests:**
  - `it('toFrame undoes place, out to 2 km')`: R 40 (map units), 30 random (x, z) within 2000 m, round trip within 0.01 m.
  - `it('the map frame faces the pole, and falls back near one')`.
  - `it('bakes north-up from a reader')`: a reader that returns red for v < 0.5 (the northern hemisphere) and blue otherwise, at a frame on the equator. Row 0 is red and the last row is blue.
  - `it('uses the fallback colour where the map can’t be read')`.
  - `it('places a door and a talker from spots, and solids as footprints')`.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/landings/mapBase.test.js`. Expect FAIL.
- [ ] **Step 3: Implement `mapBase.js`.**
- [ ] **Step 4: Run them and see them pass.** Expect PASS.
- [ ] **Step 5: Commit:** `"World maps: a universe landing, as a map"`.

### Task 7: The universe, wired (`footScene.js`, `universe/scene.js`, `UniverseMap.jsx`, `universe.css`)

**Files:**
- Modify:
  - `src/components/universe/footScene.js`:
    - Keep the readable planet image at landing: `S.mapImage = { image, flip }`, from `farMap[id]` or the body's map; else the `-sm` bitmap `lookOf` fetches.
    - Add `mapBase()`, which returns a base in the map frame, re-baked when needed and memoised by frame.
    - Add `mapFrame()`, which returns the frame: `me` and `mate` through `toFrame`; `ship` from `S.spot.n`; troops alive as hostiles; guests' walkers as peers; `planet: { me: uvOf(S.me.n), ship: uvOf(S.spot.n), site: uvOf(S.spot.n) }`.
    - Keep `mapBase().version`, a number that goes up on every re-bake.
  - `src/components/universe/scene.js`:
    - About 12 times a second while `onFoot() && foot.phase === 'walk'`, call `props.footMap.current?.update(foot.mapFrame())`.
    - When `foot.mapBase().version` changes, call `setBase`.
    - In `footKey`, `m` emits `{ type: 'foot', id: 'map' }`. The nav map stays on M in flight, because `onFoot()` returns before the flight `m` branch.
  - `src/components/universe/UniverseMap.jsx`: mount `<WorldMap>` while `onFoot`. Open it on the `foot/map` event, close it on Escape, and pass the `footMap` ref into the scene's props.
  - `src/components/universe/universe.css`: the minimap's place on foot. Check it against the health bar, the prompt and the touch buttons by screenshot.
  - `scripts/map-check.mjs`: universe mode, `node scripts/map-check.mjs universe breakingbad,middleearth`.
    - Land with `?spot` and the dev hooks that `scripts/landing-check.mjs` already uses: read that script, re-use its landing steps and keep them in step with it.
    - Assert the minimap and the dialog with both tabs.
    - Assert that M in flight still opens the nav map.

**Interfaces:**
- Consumes: Task 6's exports, Task 3's handle.
- Produces: `foot.mapBase()` and `foot.mapFrame()`.

- [ ] **Step 1: Extend `scripts/map-check.mjs` with universe mode, then run it and see it fail.** Expect `FAIL breakingbad: no minimap`.
- [ ] **Step 2: Wire it in** as listed under Files.
- [ ] **Step 3: Run the check and see it pass.** Run `node scripts/map-check.mjs universe breakingbad,middleearth`. Expect exit 0. Read the screenshots for overlaps on desktop and phone.
- [ ] **Step 4: Run the universe tests and lint.** Run `npx vitest run src/components/universe && npx eslint src/components/universe`. Expect them all to pass.
- [ ] **Step 5: Commit:** `"World maps: a map on every universe landing, and the planet's own"`.

### Task 8: Docs, the whole suite, the PR

**Files:**
- Modify:
  - `docs/architecture.md`: one entry for `src/lib/worldmap/`, plus a clause each in the galaxy surface and universe landings paragraphs.
  - `README.md`: one line where the worlds' controls are listed (M: the map). Check first that such a list exists, and skip this if not.

- [ ] **Step 1: Write the docs.**
- [ ] **Step 2: Run the full suite and lint.** Run `npx vitest run && npx eslint .`. Expect every file to pass and lint to be clean.
- [ ] **Step 3: Run the browser checks again.** Run both modes of `scripts/map-check.mjs`. Expect exit 0.
- [ ] **Step 4: Commit, push, open the PR, and merge when CI is green.**
