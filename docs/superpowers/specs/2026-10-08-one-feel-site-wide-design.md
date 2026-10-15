# One feel, every world: the design

Date: 2026-10-08. Lane: one feel, site-wide. Rests on `docs/research/2026-10-06-bruno-simon-folio.md`, `docs/research/2026-10-08-folio-2025-physics-terrain-streaming.md` and `docs/superpowers/specs/2026-10-07-house-look-design.md` (the first round: the house look, the core kit, the Shire’s `?debug` panel), and on `2026-10-08-natural-worlds-design.md` (Rapier, his car, the Expanse surface).

## The brief

The owner read Bruno Simon’s folio-2025 and named seven things it does, and six to change here: one art style a world (a master material with a palette, a soft shadow edge, shadows that are a colour, bounce from the ground); tone mapping chosen on purpose, with bloom for emissives only; every hit a sound, a puff and a shake, props light, asleep and instanced; the car in two halves, a physics half and a visible half that exaggerates it; a debug panel behind `?debug` in every world; and colliders made from names in the model file, so a physics prop is modelled and exported, never coded.

Site-wide: every world of the universe, the galaxy and its surfaces, the universe map and its landings, and every game on a page. Nothing drawn is left out; what is left as it is, is left on purpose and says why.

## What the site already has, and the gap

The first round did more of this than the brief assumes. The work here is the gap, not a rebuild.

| Bruno’s | here already | the gap |
| --- | --- | --- |
| one material: palette, soft edge, shadow as a colour, bounce, fog in one shader | `lib/three/house.js`: a patch on every lit material (`houseOn`), shade as a colour with a soft edge, the sky as fog, the ground’s bounce (`ground(map)`); every world on it bar the listed exceptions | no palette; a world may still mix scans (`lib/three/core.js`’s kit, `lib/cc0`, `lib/hdri`’s sets), toon ramps (C-137, the cruiser) and realistic standard materials in one frame; no world says which art it is |
| tone mapping on purpose; bloom threshold 1, strength 0.25 | the house tone mapper is Neutral; `houseOn` sets it on 14 worlds | 12 scenes still set ACES, `lib/stage3d.js` says ACES in its header and defaults bloom to threshold 0.82 and strength 0.65; 43 bloom sites, every threshold under 1, so lit white surfaces glow |
| hits: sound by force, positioned; props 0.1, asleep, instanced | `lib/physics/world.js`: `onHit(force, at)` at `hitThreshold` 15; `props.js` sleeps dynamic props; the Expanse pools its props in `InstancedMesh`; `universe/sounds.js` has `impactSound(near)`; `avengers/hq/feel.js` has trauma shake, hitstop and a fov punch; `lib/three/view.js` has `shake(k)` | nothing joins them: no hit on the Expanse makes a sound, a puff or a shake; the landings’ hits make a sound only; the worlds without Rapier (Albuquerque’s `bump`, Cybertron’s `bump` event, Invincible’s crash, the galaxy surface’s `bump`) each do their own thing or nothing; the shake lives in one world’s folder; no dust puff exists; the pool is the Expanse’s own |
| the car in two halves | `lib/physics/vehicle.js` is his car, his numbers; `expanse/surface/buggy.js` hangs the wheels on the springs, spins and steers them | no squash, no lean, no antenna; Albuquerque’s Aztek, the office’s cars, Cybertron’s truck and the galaxy’s speeders lean by a sine or not at all |
| a debug panel, every value wired | `lib/debugPanel.js` (`?debug`, sliders, colour wells, copy as code) | wired in three scenes (the Shire, the galaxy surface, the tesseract); no world module exposes its values; the runtime knows nothing of it |
| `physical`, `fixed`, `dynamic` in a mesh name make its body | nothing reads a mesh name for physics; a landing’s model names its body on its spec | the convention, the reader, the step in `scripts/gen3d/web.mjs`, and the docs |
| day, weather, wind, fog and light read one set of values | `lib/three/wind.js` (one wind in seven pieces), the house’s uniforms (one set a world) | out of scope here (not in the six); noted for a later lane |

## Goals

Measured before and after, at the fixed routes `scripts/autopilot-check.mjs` already shoots, on `high`:

| what | today | target |
| --- | --- | --- |
| worlds that mix a scan with a toon ramp in one frame (`art-mix`, a new measure) | counted by the measure’s first run | 0 |
| worlds without a `look.js` that names their art, tone and bloom (`looks.test.js`) | 17 of 17 | 0 |
| bloom sites with a threshold under 1 and no reason beside it | 43 | 0 |
| scenes setting ACES | 12 | 0 (Neutral by the house, or `tone: 'none'` with its reason) |
| a Rapier hit over the threshold that makes no sound, puff or shake | every one | none; the Expanse’s crates and the landings’ barrels first |
| vehicles with a visible half (squash, lean, antenna) | 0 of 6 | 6 of 6 |
| world modules with `tune()` behind `?debug` | 0 | every module in `src/components/*/module.js`, and every `createStage` scene through `stage.tune` |
| a GLB whose `_physical` nodes become bodies | none | a fixture in the tests and the landings’ next gen3d prop |

By eye, in each pull request: before and after of the lane’s routes, side by side.

## Non-goals

- Bruno’s shared day cycle and weather (his point 5): one lane later, on the house’s uniforms.
- WebGPU and TSL: every change is GLSL on the classic renderer, in files the WebGPU lane ports later. `src/runtime/shading.test.js` still holds every module to `'glsl'`.
- New models, new textures from a service, a new dependency (no Tweakpane, no lil-gui: `lib/debugPanel.js` stays plain DOM).
- Gameplay: no rule, key, save, achievement or sound a visitor has is changed. A new sound is added, never swapped.
- Rewriting a world’s UVs onto the palette texture. The palette is for what is built in code and for new props; a modelled thing keeps its maps.

## Constraints (the standing rules that bite here)

- `src/lib` and `src/lib/physics` import no React and no DOM; `src/lib/physics` imports no three. Pure rules first, tested in Node (`docs/health/RULES.md`).
- A shared piece goes down to `src/lib` or `src/runtime`; a world imports another world only through its `index.js` (the boundary measure).
- Every number a tier reads comes from `lib/budgets` or `lib/device`.
- British spelling, curly quotes, plain sentences; comments say why, in the file’s voice.
- Every `onBeforeCompile` composes with the hook already on the material and sets `customProgramCacheKey`.
- A file stays under 800 lines; the measure’s `big-files` budget does not rise.
- Draw calls and triangles at every checked route at or under today’s; a rise is a finding.
- No model names in code, docs or commits.

## The shape, in six pieces

### 1. One art a world (`src/components/<world>/look.js`, `src/lib/three/palette.js`, the `art-mix` measure)

Every world and page game gets a `look.js`, the one place that says what it looks like:

```js
export const LOOK = {
  art: 'painted' | 'scanned' | 'own',   // painted: flat colours, the house look, no scans; scanned: the core kit and PBR, the house look; own: a renderer of its own kind, with `why`
  palette: ['#…', …],                    // painted only: the world’s colours, six to sixteen
  tone: 'house' | 'none',                // house: Neutral through houseOn; none: `why`
  bloom: { threshold: 1, strength: 0.25, radius: 0.4 } | false,  // under 1: `why`
  shadow: 0x…,                           // optional: the look’s shadow colour (else shadowFor from the sky light)
  why: { tone?: '…', bloom?: '…', art?: '…' },
};
```

`src/components/worlds/looks.test.js` reads every folder `WORLD_MB` names (and the game scenes the roster lists) as the browser would and fails a missing `look.js`, an `art` that isn’t one of the three, a `bloom.threshold` under 1 without `why.bloom`, a `tone: 'none'` without `why.tone`, a `painted` palette outside six to sixteen colours, and two palette colours closer than 0.08 in OKLab (the universe’s `palette.test.js` has the distance).

`src/lib/three/palette.js`, Bruno’s palette texture, for what the site builds in code: `createPalette(hexes)` → `{ texture (a 16 × 1 sRGB DataTexture, nearest, no mips), uv(i) → [u, v], colour(i) → Color, material(opts) (one house Lambert with `map: texture`), paint(geometry, i) (every UV to cell i), dispose() }`. A painted world’s new props (the Expanse’s crates and buggy, the Shire’s furniture, Albuquerque’s cars, the office’s cars) share one material and merge into one draw where they are static. `palette.test.js` holds `uv` to the cell’s centre and `paint` to a geometry’s UV count.

A `scanned` world keeps `lib/three/core.js` and its PBR sets, and the house look over them; it has no toon ramp. A `painted` world has no `wear`, `dress`, `loadPbr` or `loadCore` call and no realistic normal map on a flat colour. C-137 is painted (its toon ramp and ink are its art; `lib/three/house.js` already takes a toon material); the galaxy surfaces, Albuquerque, the office and the compound are scanned; the Shire and the towns are scanned today and stay so (the kit was asked for); the Expanse is painted. The measure `scripts/health/art-mix.mjs` counts the world folders whose import closure (`src/runtime/shadingClosure.js`’s `closure`) reaches both a toon ramp (`MeshToonMaterial`, `gradientMap`) and a scan (`lib/three/core`, `lib/cc0`, `lib/hdri`’s `loadPbr`) and is budgeted at its first value, to fall.

### 2. Tone and bloom on purpose (`src/lib/stage3d.js`, `src/runtime/webgl.js`, every scene that sets a tone mapper or a bloom)

The house tone mapper is Neutral (decided in the first round) and this makes it the default: `createStage`’s renderer is Neutral at the house exposure (`LOOK.exposure`, 1.4, lifted once as `houseOn` does) and its header says so; `runtime/webgl.js` and `runtime/webgpu.js` default to Neutral too; `createRenderer` keeps `NoToneMapping` as its own default (the core pages’ scenes author their colours as final, which is the brief’s other allowed choice, and `look.js` isn’t theirs). The 12 ACES sites go: each becomes `houseOn` (where the world is lit) or `tone: 'none'` with its `why` (dot-matrix’s dither, Mario 64’s N64, Earth’s globe shaders, the cockpit viewer, the hyperspace jump, as the first round listed).

Bloom: `lib/three/bloom.js` exports `BLOOM = { threshold: 1, strength: 0.25, radius: 0.4 }`, his numbers; `createStage` and `runtime/webgl.js`’s `post` default to it, and a scene passes its `look.js`’s bloom. With the threshold at 1 only what is over white glows, so each world lifts what should glow (`stage3d`’s `hot(hex, k)`: lamps, engines, sabers, portals, neon, the Tesseract) to an emissive intensity over 1, and a lit white wall stops glowing. The before and after screenshots are the check: a glow that vanished is a missed emissive, not a reason to lower the threshold. Bloom stays off on `low` as today.

### 3. Hits (`src/lib/impact.js`, `src/lib/sfx.js`, `src/lib/three/dust.js`, `src/lib/three/feel.js`, `src/lib/three/pool.js`)

One wiring, used by every world that has something to hit:

- `src/lib/impact.js` (pure): `createImpacts({ threshold = 15, full = 120, gap = 0.1, now })` → `{ hit(force, at, key?) → { gain, pitch, dust, shake } | null }`: Bruno’s law, `gain = clamp((force − threshold) / (full − threshold))²`, a pitch drawn in `0.85…1.15`, `dust = gain` puffs rounded to `1…6`, `shake = 0.15 × gain`, and `null` inside `gap` seconds of the last hit on the same key (his 100 ms throttle). Tested.
- `src/lib/sfx.js` gains `thud({ gain, pitch, at, listener })`: a synthesised knock (a short band-passed burst and a low sine, as `impactSound` is built) through a `PannerNode` at `at` relative to `listener` (a position and a forward), so a crate behind you is behind you. Nothing downloaded. Off-line renderable for the test.
- `src/lib/three/dust.js`: `createDust({ count = 256, colour })` → `{ mesh, burst(at, n, up), update(dt), dispose() }`: one `InstancedMesh` of soft cards cut from `puffs.js`’s blob, each rising, swelling and fading in the vertex shader from a start time; one draw a world. Its shader is tested pure as `puffShader` is.
- `src/lib/three/feel.js`: `avengers/hq/feel.js` moved down whole (its tests with it); `avengers/hq/feel.js` becomes a re-export so no HQ game changes. `lib/three/view.js`’s `shake` stays for the chase camera; a world with a `feel` passes `feel.trauma`, one with a chase view passes `view.shake`.
- `src/lib/three/pool.js`: the Expanse scene’s `pool(geometry, material, count, name)` moved down whole; the Expanse imports it.
- `src/lib/three/impacts.js` ties them: `wireImpacts({ sfx, dust, shake, listener, rules = createImpacts() })` → `onHit(force, at, key)`: a function to hand to `physics.add`’s `onHit`, `addVehicle`’s `onHit`, `addProps`’s kinds and `createLandingPhysics`’s `onHit`, and to call from a world’s own events.

Where it goes: the Expanse (the vehicle’s chassis and every crate and barrel; the listener is the buggy); the landings and the foot scene (`heard` becomes `onHit`); Albuquerque (`out.bump` in m/s, scaled to a force by the car’s mass so the same law holds); Cybertron’s `bump` event; Invincible’s crash and hard landing; the galaxy surface’s `bump`; Roy’s and the tide’s own shakes stay but take the dust and the thud. Every dynamic prop that comes through `addProps` or the landings is asleep until touched (already) and light (crates 0.02, barrels 0.1, his); the landings’ repeated kinds (barrels, crates, buckets, hay bales) draw through `pool.js`, one draw a kind.

### 4. The car in two halves (`src/lib/vehicleFeel.js`, `src/lib/three/vehicleBody.js`)

The physics half is `lib/physics/vehicle.js` and stays. The visible half is new and pure:

- `src/lib/vehicleFeel.js`: `createVehicleFeel(opts)` → `{ step({ forwardSpeed, forwardAccel, lateralAccel, steer, airborne, landed, hit }, dt) → { squash, roll, pitch, antenna: [x, z] }, reset() }`. The body is a damped spring on three axes: `pitch` leans back under acceleration and forward under braking (`±0.05` rad at full, his Albuquerque fake kept as the law), `roll` into the turn from lateral acceleration and steer (`±0.11` rad), `squash` a vertical spring that compresses on landing by the landing speed and on a hit by its gain and rings back (`stiffness 120, damping 8`); the antenna is his spring (`speedStrength 10, damping 0.035, pullBackStrength 0.02`, from the research note) driven by the chassis’s acceleration, stepped at the fixed step. Every number is a named constant the panel binds. Tested: at rest everything is zero; a step of constant acceleration pitches back and settles; a landing squashes and rings down under 1 s; the antenna lags a start and overshoots a stop.
- `src/lib/three/vehicleBody.js`: `attachVehicleBody({ group, body (the chassis mesh or meshes), antenna (a mesh, optional, its base at the group’s origin) })` → `{ apply(feel) }`: scales the body by `1 − squash` in y and `1 + squash / 2` in x and z about its base, sets its pitch and roll, bends the antenna by the spring’s tip.

Who takes it: the Expanse buggy (an antenna mesh added in the palette’s `dark`), Albuquerque’s Aztek (its sine lean replaced; `rules.js`’s `stepCar` already gives speed, slide and yaw rate, which feed `lateralAccel`), the office’s cars (lean on turns only), Cybertron’s truck form, the galaxy surface’s speeders and bikes (roll into the turn, squash on landing), C-137’s ship in `world/ship.js` (roll and pitch as a hover), the universe map’s ship (its flight model already rolls; it takes the antenna law for its own aerials only if it has one, else nothing: say so in `look.js`’s `why`).

### 5. The panel everywhere (`src/runtime/debug.js`, `src/lib/debugPanel.js`, `src/lib/three/houseTuning.js`, `src/lib/physics/carTuning.js`, `src/lib/stage3d.js`)

- `lib/debugPanel.js` gains `type: 'bool'` and `'select'` (`options`), a `save` (the values kept under `tp-tune-<id>` in `sessionStorage` so a reload keeps them while tuning; nothing persists past the tab) and `open(groups)` / `close()` so one panel serves worlds that come and go.
- `src/runtime/debug.js`: `rt.debug`, made by the runtime when `debugOn(location)`; `rt.mount` asks the world `world.tune?.()` for its groups after `ready` and opens the panel with the module’s id as its title; `rt.unmount` closes it. The contract in `module.js`’s header: `tune?() → groups`.
- `createStage` gains `stage.tune(groups)` for the page games, which opens the same panel when `debugOn()`; and a `bloom` group of its own (threshold, strength, radius) that every stage gets for free.
- Shared group builders, so a world writes two lines: `lib/three/houseTuning.js`’s `houseGroups(house)` (the first round’s Shire groups, generalised: shadow, edge, mix, exposure, bounce, fog), `lib/physics/carTuning.js`’s `carGroups(vehicle)` (engine force, top speed, brake, steering, suspension stiffness and damping, friction slip: set live through the controller), `lib/vehicleFeel.js`’s `feelGroups(feel)`, `lib/impact.js`’s `impactGroups(rules)`, `lib/three/bloom.js`’s `bloomGroups(pass)`.
- Every module and every stage scene in the roster calls them. The Shire’s and the galaxy surface’s `tune.js` move onto `houseGroups` and keep their own extras.

### 6. Colliders from names (`src/lib/physics/fromModel.js`, `src/lib/three/colliders.js`, `scripts/gen3d/web.mjs`, `docs/assets/colliders.md`)

The convention, his: a node whose name has `physical` in it is a body; `dynamic` or `kinematic` in the name picks the type, else `fixed`; its direct children named `cuboid*`, `ball*`, `cylinder*`, `capsule*`, `hull*` or `trimesh*` are its colliders, their size from the child’s scale (a cuboid’s half-extents `scale / 2`, a ball’s radius `scale.y / 2`, a cylinder’s `[scale.y / 2, scale.x / 2]`), their place from the child’s local position and rotation; a body with no such child gets one cuboid from its own box. `mass` from `userData.mass` or, dynamic, the kind’s default (0.1). A `physical` node is never drawn.

- `src/lib/physics/fromModel.js` (pure): `bodiesFromNodes(nodes)` where a node is `{ name, position, quaternion, scale, children, box?, userData? }` → `[{ name, desc }]` for `physics.add`. Tested on hand-written node lists, one per shape, and on the rules above.
- `src/lib/three/colliders.js`: `collidersOf(root)` walks a loaded model, builds the node list from its objects (world transforms relative to `root`), hides each `physical` node, returns the descs. Tested on a `Group` built in Node.
- `scripts/gen3d/web.mjs` keeps node names through meshopt and the cut (it names what it writes), and `docs/assets/colliders.md` is the page a modeller reads: the names, a Blender screenshot’s worth of words, and the one line to add a prop.
- The landings’ `furnish.js` prefers a model’s `_physical` nodes over `spec.body` when it has them; the Expanse takes its next gen3d prop the same way. `docs/stack/physics-rapier.md` gains the convention under “How the site uses it”.

## The roster: every world and game, and what each takes

Pieces: 1 art, 2 tone and bloom, 3 hits, 4 car, 5 panel, 6 colliders. A dash is “not this one, and `look.js` says why”.

| world or game | files | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| the Expanse surface | `expanse/surface/` | painted | house | chassis, crates, barrels | buggy | module | props |
| the universe map | `universe/scene.js`, `post.js`, `shipyard/showroom.js` | own (`universe/palette.js` is its palette) | own post, says why | — | — | module | — |
| landings and the foot scene | `universe/landings/`, `universe/footScene.js` | scanned | house | barrels and the rest | — | module | furnish |
| the galaxy map | `galaxy/scene.js` | own (space) | own post | — | — | module | — |
| the galaxy surfaces and sites | `galaxy/surface/`, `sites/` | scanned | house | bump | speeders, bikes | module (its `tune.js` onto houseGroups) | — |
| the Death Star, the trench, inside | `deathstar/DeathStar3D.js`, `Trench3D.js`, `inside/` | scanned | house | hits in the trench and inside | — | stage, module | — |
| the cockpit and the hyperspace jump | `cockpit/scene.js`, `hyperspace3d/scene.js` | own | none, why | — | — | stage | — |
| Middle-earth: the Shire, 12 towns, the rush, the bridge, the ring, Gorgoroth, the map backdrop | `middleearth/` | scanned (the ring: own) | house (the backdrop: none, why) | the rush’s hits | — | module and stage; the Shire’s `tune.js` onto houseGroups | — |
| Albuquerque, the casa, Metherria | `albuquerque/` | scanned | house (Metherria: ACES goes) | bump | the Aztek | module | — |
| the office: the floor, the tour, the toss, the world | `office/` | scanned | house (its `stage3d.js` goes onto `lib/stage3d`) | the toss’s hits | the cars | stage | — |
| Cybertron: the world, the game, roll out, the planet, the transformation | `cybertron/` | scanned (the game’s plated stage: own) | house | bump | the truck | stage, module | — |
| the Avengers compound and the HQ games (lawn, repulsor, ricochet, smash, tesseract, thwip, titan, trickshot, widow, the world) | `avengers/` | scanned | house through `hq/engine.js` | every game’s hits onto `lib/three/feel.js` and dust | — | engine (one `tune` for all, each game adds its own) | — |
| Invincible: the world, thinkmark, the viewer | `invincible/` | scanned | house | crash, hard landing | — | module | — |
| C-137: the world, Roy, the sewer, the citadel, the portal, the wardrobe, the cruiser, the planets, the backdrop | `rickmorty/` | painted (toon and ink are its art) | house | Roy’s and the ship’s hits | the ship | stage | — |
| the Caribbean tide | `caribbean/tide/` | own (the sea shader) | house | the tide’s hits | — | stage | — |
| Dot Matrix, Mario 64, Minecraft | `dotmatrix/`, `mario64/`, `minecraft/` | own, why (a dither, the N64, the game’s flat light) | none, why | — | — | module | — |
| Earth | `earth/` | own (the globe’s shaders) | none, why | — | — | module | — |
| Music’s room | `music/world/` | scanned | house | — | — | module | — |
| Dick-ansh, the cartridges, the GPU stage, the contact plane, the ambience, the experience motifs, the mist, the lamplight, the globe, Akshardham | `dickansh/`, `projects/cartridges/`, `stages/gpu3d/`, `contact/plane/`, `ambience/`, `experience/motif3d/`, `mist/`, `peace/`, `travel/` | page scenes: own (colours authored as final) | none, by `createRenderer`’s default; Dick-ansh’s ACES and the cartridges’ Neutral go | — | — | — | — |

## Testing

- Pure, in Node: `palette.test.js`, `impact.test.js`, `sfx.test.js` (the thud rendered off-line: a peak within 30 ms, its gain by the law), `dust.test.js` (the shader on stubs), `feel.test.js` (moved), `pool.test.js`, `vehicleFeel.test.js`, `vehicleBody.test.js` (a Group in Node), `fromModel.test.js`, `colliders.test.js`, `debugPanel.test.js` (the new types, `save`), `runtime/debug.test.js` (opened on `ready`, closed on unmount, nothing without `?debug`), `looks.test.js`, `art-mix.test.mjs` under `scripts/health/`.
- Every lane: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, `node scripts/autopilot-check.mjs --only smoke --routes <its routes>` with before and after shots in the pull request, and for a driven world `node scripts/perf-probe.mjs expanseDrive` quoting the worst frame.
- By hand, in dev: `?debug` opens the panel on the lane’s world; a hit makes a thud, a puff and a shake; the car leans into a turn and squashes on landing.

## Rollout

Two phases. Phase 1 is five lanes at once from `main`, each owning its files, each proving its piece on one world; Phase 2 is six lanes at once after Phase 1 is on `main`, each owning a group of worlds and applying every piece to them. One pull request a lane, merged on its own when CI is green; a lane that needs another’s file waits for its merge rather than editing it.

Phase 1 (the pieces):

| lane | branch | owns | proves on |
| --- | --- | --- | --- |
| 1A the art | `claude/one-feel-art` | `lib/three/palette.js`, `lib/three/bloom.js`, `lib/stage3d.js`’s defaults and header, `runtime/webgl.js` and `webgpu.js` defaults, `scripts/health/art-mix.mjs`, `components/worlds/looks.test.js`, `docs/health/RULES.md` (a paragraph: one art a world) | the Shire’s `look.js` and the Expanse’s (`painted`, its buggy and crates on the palette) |
| 1B the hits | `claude/one-feel-hits` | `lib/impact.js`, `lib/sfx.js`’s `thud`, `lib/three/dust.js`, `lib/three/feel.js` (moved), `lib/three/pool.js` (moved), `lib/three/impacts.js` | the landings and the foot scene (every barrel a thud, a puff, a shake) |
| 1C the car | `claude/one-feel-car` | `lib/vehicleFeel.js`, `lib/three/vehicleBody.js`, `lib/physics/carTuning.js` | the Expanse buggy (an antenna added) |
| 1D the panel | `claude/one-feel-panel` | `lib/debugPanel.js`, `runtime/debug.js`, `runtime/module.js`’s header, `lib/three/houseTuning.js`, `lib/stage3d.js`’s `tune` | the galaxy surface’s `tune.js` onto `houseGroups`, and Earth’s module (`tune` with its own values) |
| 1E the colliders | `claude/one-feel-colliders` | `lib/physics/fromModel.js`, `lib/three/colliders.js`, `scripts/gen3d/web.mjs`, `docs/assets/colliders.md`, `docs/stack/physics-rapier.md` | a fixture GLB in the tests; the landings’ `furnish.js` reads `_physical` nodes |

1A and 1D both touch `lib/stage3d.js`: 1A its defaults and header, 1D its `tune`; whichever merges second merges `main` first and keeps both. 1B and 1E both touch the landings: 1B `physics.js` and `footScene.js`’s `heard`, 1E `furnish.js` only.

Phase 2 (every world), each lane applying all six pieces to its worlds by the roster, one pull request a lane (a lane with many worlds may make two):

| lane | branch | worlds |
| --- | --- | --- |
| 2A Middle-earth | `claude/one-feel-middleearth` | the Shire, the 12 towns, the rush, the bridge, the ring, Gorgoroth, the map backdrop |
| 2B Star Wars | `claude/one-feel-starwars` | the galaxy map, the surfaces and sites, the Death Star, the trench, inside, the cockpit, the hyperspace jump |
| 2C the universe | `claude/one-feel-universe` | the map, the landings, the foot scene, the shipyard, the Expanse (its remaining pieces) |
| 2D the cities | `claude/one-feel-cities` | Albuquerque, the casa, Metherria, the office, Cybertron |
| 2E the games | `claude/one-feel-games` | the compound and the HQ games, Invincible, the Caribbean tide |
| 2F the rest | `claude/one-feel-rest` | C-137, Dot Matrix, Mario 64, Minecraft, Earth, Music, Dick-ansh, the cartridges, the GPU stage, the page scenes |

The handoff `docs/superpowers/HANDOFF-universe.md` carries the status table; each lane fills its row before it stops.

## Change of course (2026-10-08, evening)

While Phase 1 ran, the owner told the car lane: the Expanse car game is not wanted (“I don’t care about the car”), what he wants is how polished Bruno’s *game mechanics* feel, on *his* games, all of them. So:

- The Expanse surface (`src/components/expanse/surface/`, `/universe/expanse/:seed`) is removed by that lane (`claude/remove-expanse`); lane 1C’s pull request #700 is closed. Its pure pieces (`lib/vehicleFeel.js`, `lib/three/vehicleBody.js`, `lib/physics/carTuning.js`) stay on the branch `claude/one-feel-car` for a Phase 2 lane that gives a vehicle of its own (the Aztek, Optimus’s truck, the galaxy’s speeders, C-137’s ship) the same springs; nothing else of that lane lands.
- Every mention of the Expanse in the roster, the goals and Phase 2’s lane 2C is void; lane 2C keeps the map, the landings and the foot scene.
- **Phase 2 is game feel first.** Each lane works its games in this order and stops at the look only when the feel is done: every action answered (a hit gives a sound sized by its force, a puff, a small shake and, for a heavy one, a few frames of hitstop: pieces 3 and `lib/three/feel.js`’s `hitstop`); things react physically (props scatter when struck, asleep until then; secondary motion from springs, never a fixed sine); input forgiving (controls ease in and out; a jump has coyote time and a buffered press; nothing sticky or dropped); the camera calm (eased, leading the player, never snapping; a shake decays); nothing dead-ends (a respawn is quick, every action works the first time). Then piece 1 and 2 (art, tone, bloom), then 5 (the panel), then 6 where a GLB meets Rapier.
- The six pieces, the interfaces and the tests stand as written; only their order and the Expanse change.
- The second round’s design, `2026-10-08-game-feel-design.md`, rests on an audit of every game (`docs/research/2026-10-08-game-feel-audit.md`) and replaces this design’s Phase 2: the game-feel tiers first, then this design’s per-world look checklist.

## Decisions

- **Neutral, not ACES or AgX.** The first round chose it and 14 worlds are tuned to it; the brief allows either choice made everywhere. The page scenes keep “none, colours as final”, the brief’s other allowed choice, because their colours come from the page’s theme (`lib/three/theme.js`) and were authored to be shown exactly.
- **A palette texture for code-built things only.** Bruno models in Blender onto his palette; our models are generated with their own atlases, and repainting them is the first round’s `flatten-glb.mjs`, offline. The palette earns its keep where the site builds geometry in code: one material, one draw.
- **One hit law for every world, Rapier or not.** The worlds without Rapier report a bump speed; the law takes a force, so each scales by the mass of what bumped (the Aztek 1,500 kg, Optimus’s truck 20,000 kg, Mark 80 kg) and the same thresholds hold. The feel is tuned once.
- **The shake moves down, the law stays.** `feel.js`’s trauma model is already good and used by eleven games; it moves to `lib/three/` whole so nothing about those games changes, and the Expanse keeps its chase view’s roll spring, fed the same trauma.
- **No dependency for the panel.** `lib/debugPanel.js` already does what Tweakpane would; a dependency needs a stack page and a reason, and “Bruno uses it” is not one.
- **His collider names, our shapes.** `physical`, `fixed`, `dynamic`, `cuboid`, `ball`, `cylinder`, `hull`, `trimesh` are his; `capsule` is added because `lib/physics` has it; `tube` is not (it is his word for a cylinder).
