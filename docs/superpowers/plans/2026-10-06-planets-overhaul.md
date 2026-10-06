# The planets overhaul — implementation plan

> **For agentic workers:** the owner asked for no subagents. Execute with
> superpowers:executing-plans, in order, one checkpoint at a time. Steps use
> checkbox (`- [ ]`) syntax.

**Goal:** Every landmark and close-up prop on the seventeen landable worlds
is a textured, accurate, game-quality model, within a measured performance
budget. The work is delivered in merged checkpoints.

**Architecture:**
- The surface catalogue (`src/components/galaxy/surface/catalog`) gains
  made (Meshy) entries, built solids under models, and LOD1s.
- Assets come from a ladder: Sketchfab first, then the owner's models, then
  Meshy from real reference pictures (Wookieepedia), then improved kit
  builds.
- Each world group is a checkpoint, verified with `scripts/galaxy-check.mjs`
  against `lab/baseline/`.

**Tech Stack:**
- three r186, React 19, Vite 8, Vitest.
- `@gltf-transform`, meshoptimizer, sharp, basisu (`scripts/ktx2.mjs`).
- Meshy API (`image-to-image`, `image-to-3d`, `multi-image-to-3d`,
  `retexture`), Sketchfab Data API, the Wookieepedia MediaWiki API.

**Spec:** `docs/superpowers/specs/2026-10-06-planets-overhaul-design.md`

**Lanes (agreed with the owner, 2026-10-06).** Two sessions run this plan
at once. The front lane (`claude/sharp-carson-h9c6mp`) keeps the engine
and goes from checkpoint 3 forwards. The back lane
(`claude/wizardly-noether-5dlsg9`, plan
`2026-10-06-planets-back-lane.md`) takes checkpoints 11, 10 and 9, in that
order, and the planets as seen from space. Neither edits the other's
worlds. Before starting a checkpoint, check `main` for the other lane's
merges and skip anything already done.

## Global Constraints

- No subagents.
- Never print or commit `SKETCHFAB_API_TOKEN`, `MESHY_API_KEY` or
  `MESHY_KEY`.
- No sequel-trilogy (Ep 7–9) content.
- Don't touch the ship-customisation files: `shipModels.js`, `hulls.js`,
  `livery.js`, `modules.js`, `outfit.js`, `paint.js`, `Hangar.jsx`.
- Don't swap `xwing-hd.glb` or `falcon-hd.glb`. Keep
  `/models/universe/falcon.glb`.
- Meshy prompts never name the films, their characters or places.
- Reference pictures stay in `lab/refs/`, never committed. Their
  Wookieepedia file names go in the tasks JSON.
- Licences:
  - Sketchfab: CC-BY 4.0 family (by, by-sa, by-nc, by-nc-sa) or CC0,
    credited in `src/data/modelCredits.json`.
  - Meshy-made: listed in `public/cc0/README.md`.
  - Nothing described as ripped or extracted from a game.
- Per-model budgets:

  | Size class | Triangles | Maps |
  |---|---|---|
  | Small props | ≤ 15k | 512 |
  | Houses and vehicles | ≤ 40k | 1024 |
  | Landmarks | ≤ 90k | 2048 |

  An LOD1 is required over 20k triangles. A GLB is ≤ 2.5 MB, or ≤ 4 MB
  with `hero: true`.
- Per-world budget, at the landing, high quality: calls and triangles ≤
  baseline +10%, and never over 600 calls or 2.5M triangles. Model bytes
  ≤ 40 MB.
- Commits end with:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01Wmw65yyvV2Td5cUTKwLG3j`.
- **Checkpoint close**, at the end of every checkpoint:
  1. `npm run lint && npm test && npm run build`, all green.
  2. Run `galaxy-check` on its worlds, within budget.
  3. Make the before/after sheet and send it to the owner.
  4. Push `claude/sharp-carson-h9c6mp`.
  5. Open a PR to `main` and merge it.
  6. Reset the branch:
     `git fetch origin main && git checkout -B claude/sharp-carson-h9c6mp origin/main`.

## Review Focus

1. **A model fails to load** (network, 404). The world still shows the
   built prop, with its solids and floors: the placer's fallback must
   survive `solids: 'built'` and LODs. Test it in Task 1.2.
2. **Walking into a building replaced by a model** (cantina, hangar, Echo
   Base). You still stand on its floors and can't walk through its walls.
   Check in-world with `__surfaceDo('teleport', …)` on every world with
   `solids: 'built'`.
3. **A phone or low tier.** Maps over the device's ceiling are cut by
   `lib/detail`. Check that a 2048 landmark doesn't break `QUALITY=low`:
   galaxy-check low on each checkpoint's worlds.
4. **Leaving and landing again.** No GPU memory growth, since models are
   cached by URL and LOD1s too. Land twice in one session in galaxy-check
   (`LIVE=1`, two ids the same) and compare textures/geometries.
5. **A repeated landmark seen from afar** (Theed ×13, Coruscant towers).
   LOD1 swaps without popping into the wrong place: same origin, same yaw,
   same scale. Test the LOD wrapper's transform in Task 1.3.

---

## Checkpoint 1: the asset engine

### Task 1.1: Made entries in the catalogue

**Files:**
- Modify:
  - `src/components/galaxy/surface/catalog/catalog.test.js`
  - `public/cc0/README.md` (a "galaxy surface" line in "Not CC0: made for
    this site")
- Create: `src/components/galaxy/surface/catalog/made.js` (Meshy-made
  kinds, its own group `made`)
- Modify: `src/components/galaxy/surface/catalog/index.js` (add the
  `made` group)

**Interfaces:**
- Produces:
  - A catalogue entry is either `{ uid, as, metres, … }` (Sketchfab) or
    `{ made: 'meshy', as, metres, hero?, lod?, solids? }`.
  - `madeKinds(readme: string) → Set<string>` (exported from
    `catalog/index.js`): the kinds in the README's
    `models/galaxy/surface/{a,b,…}.glb` list.

- [ ] **Step 1: Write the failing test.** In `catalog.test.js`, split the
  "brought in" test:
  - a Sketchfab entry needs a `uid` and a credit;
  - a made entry needs `made === 'meshy'`, no `uid`, and its kind in
    `madeKinds(README)`;
  - both need the file;
  - size < 2.5 MB, or < 4 MB when `hero`.

  Add one made kind (`theed`, after Task 1.4 fetches it; until then the
  test uses a fixture entry) to see it fail.
- [ ] **Step 2: Run** `npx vitest run src/components/galaxy/surface/catalog`.
  Expect FAIL: `madeKinds is not a function`.
- [ ] **Step 3: Implement** `madeKinds`, `made.js`, the README line and the
  group.
- [ ] **Step 4: Run the tests.** PASS.

### Task 1.2: Built solids and floors under a model

**Files:**
- Modify:
  - `src/components/galaxy/surface/placer.js`: split `build` into
    `make(spec)` and `applyBuilt(made, spec, at, world, sinks)`;
    `put` with `SURFACE_MODELS[kind].solids === 'built'` calls `make`,
    `applyBuilt`, then disposes the made object's geometry.
- Create: `src/components/galaxy/surface/placer.test.js`

**Interfaces:**
- Produces:
  - `applyBuilt(made, spec, at, world, { updates, signals, object: boolean })`:
    adds the solids (unless `spec.solid === false`) and the floors, turned
    by `spec.yaw` and scaled by `spec.scale`.
  - With `object: false` it does not add `made.update` or `made.signal`,
    since their meshes are gone.

- [ ] **Step 1: Write the failing tests.**

  ```js
  it('keeps a built thing's floors and walls without its meshes', () => {
    const world = fakeWorld(); // { solids: { box: spy, circle: spy }, floors: [] }
    const made = { object: new THREE.Group(), solids: [{ box: [0, 0, 4, 2] }], floors: [{ x: 3, z: 0, y: 1, hw: 2, hd: 2 }] };
    applyBuilt(made, { yaw: Math.PI / 2, scale: 2 }, [10, 0, 0], world, { updates: [], signals: [], object: false });
    expect(world.solids.box).toHaveBeenCalledWith(10, 0, 8, 4, Math.PI / 2, expect.anything());
    expect(world.floors[0]).toMatchObject({ x: 10, z: -6, y: 2 });
  });
  ```

  Add a second test: with `spec.solid === false`, no solids are added and
  floors still are.
- [ ] **Step 2: Run them.** FAIL: `applyBuilt` is not exported.
- [ ] **Step 3: Implement.**
  - The model's own box footprint is skipped when `solids: 'built'`.
  - On load failure, `build` runs as today (its object included).
- [ ] **Step 4: Run** `npx vitest run src/components/galaxy/surface`. PASS.

### Task 1.3: Surface LOD1s

**Files:**
- Modify:
  - `scripts/galaxy-lod.mjs`: a `surface` mode. For each catalogue kind
    with `tris > 20000`, write `public/models/galaxy/surface/<kind>.lod1.glb`
    with 25% of the triangles (meshopt simplify, `lockBorder` off, error
    0.02) and maps at half size.
  - `placer.js`: `put` wraps the clone in `THREE.LOD` when the entry has
    `lod: true`.
  - `catalog.test.js`: every entry with `tris > 20000` (or a made one over
    20k) has `lod: true`; every `lod: true` has its file; each LOD1 is
    < 40% of its model's bytes.

**Interfaces:**
- Produces:
  - `lodDistance(radius) → metres`, which is `Math.max(60, 3 * radius)`
    (exported from `placer.js`).
  - `withLod(full: Object3D, low: Object3D, radius) → THREE.LOD`: the
    position, rotation and scale sit on the LOD, the children at the
    identity.

- [ ] **Step 1: Write the failing tests.**

  ```js
  it('switches far enough out', () => { expect(lodDistance(10)).toBe(60); expect(lodDistance(50)).toBe(150); });
  it('swaps in place', () => {
    const lod = withLod(new THREE.Group(), new THREE.Group(), 50);
    expect(lod.levels.map((l) => l.distance)).toEqual([0, 150]);
    expect(lod.levels.every((l) => l.object.position.lengthSq() === 0)).toBe(true);
  });
  ```

- [ ] **Step 2: Run them.** FAIL.
- [ ] **Step 3: Implement.**
  - Load the full model first. Load the LOD1 after `ready`, so the first
    view doesn't wait for it; until it arrives, the LOD has one level.
  - Run `node scripts/galaxy-lod.mjs surface` for the existing models over
    20k triangles (adobe, jeditemple, arena, tipoca, fortress, …).
- [ ] **Step 4: Run tests.** PASS. `ls public/models/galaxy/surface/*.lod1.glb`.

### Task 1.4: The reference-to-model pipeline

**Files:**
- Modify (and commit for the first time):
  - `scripts/meshy-galaxy-buildings.mjs`
  - `scripts/meshy-galaxy-buildings-tasks.json`
- Create: `scripts/galaxy-refs.mjs`, the Wookieepedia scout (from
  `lab/refs/scout.mjs`): `refs <kind> <page…>` makes a numbered contact
  sheet; `ref <kind> <File:…> [crop x,y,w,h]` saves the full picture to
  `lab/refs/<kind>.jpg`.

**Interfaces:**
- Produces (`BUILDINGS` entry fields):
  - `ref`: a Wookieepedia file title, or a list of them for multi-view.
  - `crop: [x, y, w, h]` as fractions.
  - `lift`: what to lift out ("the domed palace on the cliff").
  - The rest as today: `metres`, `along`, `tris`, `tex`, `hero`,
    `solids`.
- Steps:
  - `lift` runs `image-to-image`, `nano-banana`, `reference_image_urls:
    [dataURI(ref)]`, with the prompt built from `lift` and `SHOT`. Its
    output goes to `lab/meshy/buildings/<kind>-lift.png`.
  - `models` uses the lifted image when it exists, otherwise the ref. Two
    or more refs use `multi-image-to-3d`.
  - `fetch` also writes the LOD1 (Task 1.3's code, imported) and prints
    the triangle count and bytes.
  - `sheet <kind>` writes `lab/meshy/buildings/<kind>-gate.jpg`: the ref,
    the lift, and the model at three quarters and close up
    (`lab/viewer/shot.mjs`).

- [ ] **Step 1: Run** `node scripts/galaxy-refs.mjs refs theedpalace "Theed Royal Palace"`.
  The sheet lists the 19 pictures.
- [ ] **Step 2: Run** `theed` through `fetch` (its model is already paid
  for). Then `sheet theed`. Look at it. Theed passes the gate (owner
  approved).
- [ ] **Step 3: Add `theed` to `catalog/made.js`** (`metres: 35`,
  `along: 'x'`, `lod: true`) and to the README line. Run the catalogue
  tests. PASS.
- [ ] **Step 4: Check in the browser.** Run
  `OUT=lab/cp1 node scripts/galaxy-check.mjs surface naboo` and
  `node lab/viewer/surface-at.mjs naboo theed`. The halls are the model, on
  the ground, facing their plaza.

### Task 1.5: The budget check

**Files:**
- Modify: `scripts/galaxy-check.mjs`.
  - Count `.glb` bytes from `page.on('response')`.
  - With `BUDGET=<baseline.json>`, compare each world's calls, triangles
    and model bytes with the constraints, and set `process.exitCode = 1`
    on a breach. Print one line per world: `world calls tris MB pass|FAIL`.

- [ ] **Step 1: Run** `BUDGET=lab/baseline/high.json JSON=1 node scripts/galaxy-check.mjs surface tatooine`.
  Expect `pass` (nothing has changed yet).
- [ ] **Step 2: Lower the limit by hand** (`BUDGET_SCALE=0.5`). Expect
  `FAIL` and exit 1. Then remove the override.

### Checkpoint 1 close

Run the checkpoint close (Global Constraints). PR title: "Galaxy planets:
the asset engine (made models, LODs, built floors under models), Theed's
halls".

---

## Checkpoint 2: surface performance

Execute Tasks 11, 12, 13 and 14 of
`docs/superpowers/plans/2026-10-05-galaxy-upgrade-phase-1.md` as written.
Start Task 11 from `origin/claude/galaxy-perf-task11-wip` (925aba6f):
cherry-pick its placer and near.js work, then finish the rest:
- `sun.shadow.camera.layers.enable(SHADOW_LAYER)`;
- `placer.update(me().st)`;
- zone groups in actors;
- `setZone` calls.

Add to Task 11:
- **Scatter LOD.** A scattered kind with `lod: true` keeps two
  InstancedMeshes, full and LOD1. They are refreshed with the shadow
  casters, when the player has moved more than 8 m: instances within
  `lodDistance` go in the full mesh, the rest in the LOD1.
- **Test:** `splitNear(xs, zs, x, z, r) → { near: Int32Array, far: Int32Array }`,
  which partitions all indices.

Checkpoint close. PR: "Galaxy planets: near-only shadows, zones, shared
props and people, lighter CPU, surface bugs".

---

## World checkpoints (3–11): the procedure

Each world checkpoint runs these tasks over its hero list.

### Task W.1: Source each hero

For each kind in the checkpoint's list:

- [ ] **Search Sketchfab.** Run
  `node lab/bscout/search.mjs "<query>" <kind>` (2–3 queries) and look at
  its contact sheet. Shortlist models that look right, are textured, are
  under the budget after simplification, and carry an allowed licence that
  isn't marked ripped.
- [ ] **Download and render** the shortlist:
  `node lab/bscout/fetch.mjs <uid>`, then `node lab/viewer/shot.mjs`.
  Gate: does it look like the reference, and is it better than the built
  one at its place?
- [ ] **If nothing passes,** use the reference route:
  - `node scripts/galaxy-refs.mjs refs <kind> "<page>"`, then pick and
    `ref` it;
  - add the `BUILDINGS` entry;
  - run `lift`, then gate the lift;
  - run `models`, `fetch` and `sheet`, then gate.

  Before `models`, print the credits it will spend and the balance. If the
  balance is short, stop and tell the owner how many credits the
  checkpoint still needs.
- [ ] **Record the decision** in the checkpoint's evidence file:
  `lab/cp<N>/decisions.md` (kind, source, why).

### Task W.2: Bring them in

- [ ] **Sketchfab models:** add the entry to the world's
  `catalog/<group>.js` and run
  `node scripts/sketchfab-surface.mjs <group> <kind…>`.
- [ ] **Meshy models:** add them to `catalog/made.js` and the README line.
- [ ] **Walkable or partly solid built kinds** get `solids: 'built'`, and
  the model is sized to the built one's footprint (`lab/sizes.txt`).
- [ ] **Run** `node scripts/galaxy-lod.mjs surface <kind…>`.
- [ ] **For landmarks marked `hero`,** run
  `node scripts/ktx2.mjs report public/models/galaxy/surface/<kind>.glb`.
  Convert the normal maps (`--slots normal`) where the report says it's
  worth it.
- [ ] **Run** `npx vitest run src/components/galaxy/surface`. PASS.

### Task W.3: Place and dress

- [ ] **Check placement.** For each place in the world
  (`node lab/viewer/surface-at.mjs <world> <place>`), check:
  - it stands on the ground, with no float and no sink;
  - it faces the right way;
  - it is the right scale against people (a door is 2.2–3 m);
  - it doesn't overlap paths or other things.

  Fix `sites/<group>.js` (`yaw`, `scale`, `sink`, `at`) where not.
- [ ] **Teleport into every `solids: 'built'` kind.** You stand on its
  floors, and walls stop you.
- [ ] **Replace remaining blocky close-up props** (crates, lamps, stalls,
  tents) with the shared prop set from checkpoint 3 where it fits.

### Task W.4: Verify and close

- [ ] **Budget at high and low:**
  `BUDGET=lab/baseline/high.json OUT=lab/cp<N> JSON=1 node scripts/galaxy-check.mjs surface <worlds>`,
  then `QUALITY=low`. All pass.
- [ ] **Make the before/after sheet** for each world: `lab/baseline/<world>.png`
  against the new shot, plus the place shots. Then the gate sheets of each
  new model. Send them to the owner with SendUserFile.
- [ ] **Commit**, one per world: "Galaxy planets: <world>'s <things>, as
  real models".
- [ ] **Checkpoint close.**

---

## Checkpoint 3: Tatooine (and the shared prop set)

**Heroes:**

| Kind | Source |
|---|---|
| `palace` | The owner's citadel, retextured (retexture task `01a10f8f…` already paid). `solids: 'built'`. |
| `homestead` | The Lars igloo and courtyard pit. Sketchfab tatkit/tatset pieces first, otherwise refs "Lars homestead". `solids: 'built'`. |
| `cantina` | `solids: 'built'`. Exterior from tatkit/mosbldg/starport, otherwise refs "Chalmun's Spaceport Cantina". |
| `dockingbay` | `solids: 'built'`. |
| `benhut` | |
| `sandcrawler` | |
| `krayt` | The skeleton. |
| `escapepod` | |

**Shared prop set** (used on every world from here on): `crates`,
barrels, `lamp`, `stall`, `tent`, `fire` (the ring and logs, the fire
itself kept built). Use one consistent Sketchfab set where one exists.

Keep built: `sarlacc` (a pit in the ground), `needle` (rock), effects.

**Already downloaded and unreviewed:** tatkit `b5a2140f…`, tatset
`e1a2af1e…`, mosbldg `e5c41d42…`, starport `20863d78…` (in
`/tmp/sketchfab-surface`, `lab/sf`).

**Credits:** up to 110 if the homestead, cantina and docking bay all need
Meshy.

## Checkpoint 4: Naboo

**Heroes:**

| Kind | Notes |
|---|---|
| `theedpalace` | Ref: `File:Theed_Palace_full.jpg` and the film stills on "Theed Royal Palace" (contact sheet #4 is the cliff-top wing). Multi-view if two clean lifts. `hero`. |
| `hangar` | Theed's hangar. `solids: 'built'`. |
| `n1fighter` | |
| `royalship` | |
| `aat` | |
| `mtt` | |
| `bongo` | |
| `otohgunga` | |
| `varykino` | |
| `stonehead` | |
| `boomas` | |

Keep built: `plaza` (walkable), `waterfall`, `grove`, `shield`, `ruins`.

## Checkpoint 5: Hoth

**Heroes:**

| Kind | Notes |
|---|---|
| `echobase` | The hangar mouth in the cliff. `solids: 'built'`. The model is the door and hangar front, the cliff stays terrain. |
| `ioncannon` | Keeps its signals: `solids: 'built'`. The firing effect stays built on top. |
| `gr75` | |
| `parkedxwing` | The galaxy's X-wing model, its LOD. |
| `atatfar` | The existing `atat` model, scaled. |
| `hothgenerator` | |
| `tauntaunpen` | |
| `eweb` | |
| `probewreck` | |
| `hanshelter` | |
| `wampacave` | The mouth. |
| `snowtrench` | |

## Checkpoint 6: Endor

**Heroes:**

| Kind | Notes |
|---|---|
| `shieldgen` | Dish and platform. Refs "Endor shield generator bunker" (#9 is a clean render of the dish). The bunker is already a model. |
| `ewokhut` | Scatter, `lod`. |
| `redwood` | Real trunk with bark, `lod`. |
| `drums` | |
| `pad` | |

Keep built: `ewoktree` (decks and stairs are floors), `ropebridge`,
`lightshafts`, `nettrap`, `logtrap`, `pyre`.

## Checkpoint 7: Bespin

**Heroes:**

| Kind | Notes |
|---|---|
| `cloudcity` | Tower. Refs "Cloud City" #11 and #3. |
| `bespinplatform` | `solids: 'built'`. |
| `bespinbridge` | `solids: 'built'`. |
| `bespindeck` | `solids: 'built'`. |
| `carbonchamber` | `solids: 'built'`. |
| `reactorshaft` | `solids: 'built'`. |
| `diningroom` | `solids: 'built'`. |
| `weathervane` | |
| `carbonite` | |
| `cargosled` | |

## Checkpoint 8: Mustafar

**Heroes:**

| Kind | Notes |
|---|---|
| `mining` | The facility. Refs "Klegger Corp Mining Facility" #1 and #10. `hero`. `solids: 'built'`. |
| `collector` | The arm. |
| `droidplatform` | |
| `mpad` | |
| `vadermeditation` | |

Keep built: `volcano`, `lavafall`, `lavaspout`, `smoke`.

## Checkpoint 9: Kashyyyk, Dagobah, Yavin 4

**Heroes:**

| World | Kind | Notes |
|---|---|---|
| Kashyyyk | `wookieehouse` | Refs "Kachirho" #10 and "Kashyyyk" #0. |
| Kashyyyk | `catamaran` | |
| Kashyyyk | `barricade` | |
| Kashyyyk | `wroshyr` | Trunk, `lod`. |
| Kashyyyk | `kachirho` | Keep the built decks with `solids: 'built'` under a model, or keep it built and re-dress it. |
| Dagobah | `yodahut` | |
| Dagobah | `xwingbog` | The galaxy's X-wing, tilted and sunk. |
| Dagobah | `gnarltree` | |
| Dagobah | `cavetree` | |
| Dagobah | `dragonsnake` | |
| Yavin 4 | `massassi` | `solids: 'built'`, `hero`. |
| Yavin 4 | `parked` | X-wing and Y-wing: the galaxy's models. |
| Yavin 4 | `lookout` | |
| Yavin 4 | `ruin` | |

## Checkpoint 10: Coruscant, Kamino, Geonosis

**Heroes:**

| World | Kind | Notes |
|---|---|---|
| Coruscant | `skyscraper` ×18 | Sketchfab `cf2f3b9d…` (DanielAndersson), `lod`, shared. |
| Coruscant | `senate` | |
| Coruscant | `republica` | |
| Coruscant | `dexdiner` | `solids: 'built'`. |
| Coruscant | `club` | `solids: 'built'`. |
| Coruscant | `works` | |
| Coruscant | `statue` | |
| Coruscant | `cplatform` | |
| Kamino | `kpad` | |
| Kamino | `kmast` | |
| Kamino | `slave1` | Sketchfab; it also removes the space stand-in. |
| Geonosis | `hive` ×14 | `lod`. |
| Geonosis | `atte` | |
| Geonosis | `coresphere` | |
| Geonosis | `foundry` | |
| Geonosis | `geohangar` | |
| Geonosis | `solarsailer` | |
| Geonosis | `commandpost` | |
| Geonosis | `pillars` | |

## Checkpoint 11: Scarif and the Outer Rim

**Heroes:**

| World | Kind | Notes |
|---|---|---|
| Scarif | `citadel` | `hero`. |
| Scarif | `scarifshield` | |
| Scarif | `masterswitch` | |
| Scarif | `pad` | |
| Nevarro | `cantina` | Nevarro's own style: the shared prop set plus adobe. |
| Nevarro | `stall` | |
| Mandalore, Lothal, Sorgan | — | The shared props. Lothal's and Sorgan's huts by the Sketchfab or ref route. |

## Checkpoint 12: the owner's A-wing, and the evidence

- **The A-wing.** `lab/uploads/glb/sentinel.glb` replaces
  `public/models/galaxy/awing.glb`, through `scripts/sketchfab-galaxy.mjs`'s
  squeeze, or the meshy-buildings `fetch` squeeze with `along: 'z'`. Then:
  - remove the `galaxy-awing` credit and add it to the README;
  - run `galaxy-lod`;
  - run `galaxy-check space` with an A-wing nearby.
- **The evidence write-up.**
  `docs/superpowers/reports/2026-10-planets.md` has, per world, the
  baseline and final counts and bytes, and the before/after shots. It also
  lists the open issues to raise: the Luke and Leia figures flagged as
  possible game rips, and the unused revolver upload.
- **Checkpoint close.**
