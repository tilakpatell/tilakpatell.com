# Rapier

**Version** `@dimforge/rapier3d-compat@0.21.0` and `@dimforge/rapier3d-simd-compat@0.21.0` (both pinned, no caret, always the same version) · **Page owner** `src/lib/physics/` · **Decision** none recorded; the reasons are in `docs/superpowers/specs/2026-10-08-natural-worlds-design.md` (“Rapier, not cannon-es”)

## What it is, and why it is here

A rigid-body physics engine written in Rust and run as WebAssembly: bodies, colliders, a heightfield, a ray-cast vehicle controller, sleeping and contact events. The site uses it for the worlds you drive or land in, following Bruno Simon’s folio-2025 (`src/lib/physics/world.js`’s header). The natural-worlds design chose it over cannon-es because a heightfield world that streams colliders in and out wants Rapier’s heightfield, sleeping and solver, and his vehicle numbers port verbatim.

## Where it is used

The census rows are in [README.md](README.md): Rapier is imported by one file, `src/lib/physics/engine.js`, and only dynamically, the first time `createPhysics` or `preload` (`src/lib/physics/world.js`) is called. Which build: the SIMD one where the browser validates a SIMD probe (`src/lib/wasm/features.js`), the plain one else, or when the SIMD one won’t come up; [webassembly.md](webassembly.md) has the why and the numbers.

The rest of the site reaches it through `src/lib/physics/`:

- `src/components/universe/landings/physics.js` and `src/components/universe/landings/bodies.js`: landings on the universe map.
- `src/components/universe/footScene.js`: walking on a landed planet.

## How the site uses it

- **Bodies are data.** `createPhysics(opts)` gives `add(desc)`, `remove(body)` and `step(dt)`; a body is a description (`type`, `position`, `colliders`, `group`, `onHit`), never a hand-built Rapier object (`world.js`’s header lists the full shape).
- **A fixed step**, times the time scale, with an accumulator and at most `maxSubsteps` a call, so a car drives the same on a slow screen and a fast one and a tab coming back doesn’t launch it.
- **A floating origin.** `onOrigin(shift)` moves every body (and a round planet’s centre) in one call, velocities kept, for an endless land.
- **Three collision groups**, his verbatim: `floor` meets everything, `object` meets everything and bumpers, `bumper` meets objects only; `src/lib/physics/groups.js` adds `character`, `hurtbox`, `zone` and the query-only `projectile` and `sight`.
- **The pieces beside it**: `src/lib/physics/vehicle.js` (his car on Rapier’s ray-cast vehicle controller), `src/lib/physics/heightfield.js` (land as a floor), `src/lib/physics/props.js`, `src/lib/physics/pusher.js` and `src/lib/physics/catch.js`.
- **A figure is a character** (`src/lib/physics/character.js`): a kinematic capsule on Rapier’s `KinematicCharacterController`, moved once a substep by an intent (a velocity, a facing, a jump) from the world’s `onSubstep` hook, with its own gravity, a knock a hit adds (a kinematic body takes no impulse: the knock is a velocity the controller carries along walls), autostep, snap-to-ground, slopes, and a push on dynamic bodies. `prev` is its pose before the last substep, for drawing by `alpha`.
- **The eyes are queries** (`src/lib/physics/queries.js`): `ray`, `sweep`, `overlap`, `floorAt`, `project`, as plain numbers, against the world after its last step, on a per-frame budget (`budget.js`): a refused call answers `undefined`, so a caller keeps its last answer and never sees through a wall. Groups are `groups.js`’s: the three of his, and `character`, `hurtbox`, `zone`, with two query-only groups (`projectile`, `sight`); `filterOf(...names)` builds a query’s filter.
- **Sensors and tags** (`world.js`): a collider desc gains `sensor` and `tag`, a body desc `onEnter` and `onLeave` (collision events), a `Body` gains `attach(desc)` and `detach(collider)`, and `src/lib/physics/zones.js` is a sensor volume over them; `tagOf(collider)` names what a query hit. (`hurtbox.js`, sensor capsules by region on a figure, is lane P2’s of the Battlefront physics design and comes with it.)
- **Colliders from names.** A model made with its physics (nodes named `physical`, their children `cuboid`, `ball`, `cylinder`, `capsule`, `hull` or `trimesh`, sized by their scale) gives its bodies through `src/lib/three/colliders.js`’s `collidersOf(model)`, its rules pure in `src/lib/physics/fromModel.js`; `scripts/gen3d/web.mjs` keeps the nodes through the web cut, the planet landings read them before a hand-written body, and `docs/assets/colliders.md` is the page a modeller reads.
- **A worker stands ready, off** (GPU-first lane N5). `createPhysics({ worker: true })` runs the same engine in a module Worker (`src/lib/physics/worker.js`, spoken to by `src/lib/physics/workerClient.js`) behind the same face: `add`, `remove`, `step`, `alpha`, `onOrigin`, `sleepOutside`, `awake` and a Body’s `position`, `quaternion`, `sleeping`, `push`, `wake`, `reset`, `enable`, `onHit`, `onEnter`, `onLeave`. A step’s poses come back as rows of `[±id, x, y, z, qx, qy, qz, qw]` in a `Float32Array` transferred both ways (`src/lib/physics/poses.js`; two buffers, keyed by id so a body added and removed between steps has no row), one frame behind; `drawn()` draws between the last two by `alpha`; queries (`query(kind, …)`, `queries.js`’s) are answered with the next step. Where no Worker can be made, its engine doesn’t come up within 5 s, or the world passes a `lost` function, it is the main-thread engine, and `status().worker` says which. It doesn’t carry `RAPIER`, `world`, `onSubstep`, `tagOf`, `attach` or `detach` (Rapier’s objects live in the worker), so a world with a character or a vehicle stays on the main thread. **Off everywhere** (`worker: false`, the default): lane X2 measured the Battlefront’s whole CPU step at 0.5 ms a frame and a hop costs 0.1 to 0.5 ms (the GPU-first research note), so it is switched on only for a world whose step is measured over 2 ms a frame on the owner’s laptop; lane N5’s `x2-profile.mjs --breaks 100` is the measure (`docs/superpowers/evidence/gpu-first/N5/README.md`).
- **Debris** (lane N5): a break is split by `src/lib/physics/breaks.js` (pure) into hulls for pieces over 0.5 m, at most 8 a break and 64 live (a ragdoll’s points counted on the same cap: `src/lib/three/ragdollPhysics.js`’s `cap`), and a GPU burst for the rest (`src/lib/three/particles/debris.js`); a hull asleep 2 s leaves the engine for a static instance.
- **It never throws at a world**: bad numbers put a body back where it began, a throwing `onHit` goes to `onError`, a failed load (offline) is not cached so the next call tries again, and a load that fails or never comes is a named `WasmError` within 20 s (`src/lib/wasm/load.js`), which the Battlefront catches and goes on without the engine.

## What the site does not use, and why

- **The bundler-plugin build** (`@dimforge/rapier3d`): the `-compat` build inlines its wasm, so Vite needs no plugin and the engine loads in Node for the tests.
- **Rapier’s debug renderer**: `src/lib/physics/` has no three.js and no DOM; a world draws its bodies from `position()` and `quaternion()`.
- **A static import**: nothing imports Rapier at module scope, so no page but the one driving downloads it; and of the two builds, only the one chosen.
- **The threaded builds**: they need a cross-origin-isolated page (COOP and COEP headers), which GitHub Pages can’t send ([webassembly.md](webassembly.md)).

## Rules

- Import Rapier only in `src/lib/physics/engine.js`, dynamically (its header; nothing measures this, `node scripts/stack-census.mjs` shows the count). The worker (`worker.js`) imports `world.js`, which reaches it through `engine.js` and `lib/wasm/load` like the page: one import site still.
- The worker stays off until a world’s step is measured over 2 ms a frame on the laptop (`worker.js`’s header); the measure is `node scripts/x2-profile.mjs --breaks 100` and the laptop’s table in `docs/superpowers/evidence/gpu-first/N5/README.md`.
- No SharedArrayBuffer: the poses cross by transfer (GitHub Pages can’t isolate the page; the npm build is single-threaded anyway).
- The two builds move together: `src/lib/physics/engine.test.js` runs one scene through both and holds them to the same numbers.
- `src/lib/physics/` stays pure: no three.js, no DOM, tested against the real engine in Node (`src/lib/physics/world.test.js` and the tests beside each file; `docs/health/RULES.md`, “Logic apart from drawing”).
- A world that loads Rapier counts it in its download size (`WORLD_MB` in `src/components/worlds/worlds.js`, the autopilot’s standing rules).
- A character moves only in `onSubstep` (its `move`); nothing writes a figure’s pose between substeps. A brain outputs an intent, never a transform.
- A moving body is never a trimesh (it falls through the ground); use a hull (`world.js`’s header).

## Upgrading

The version is pinned without a caret, unlike the site’s other packages; the commit that added it gives no reason, so keep it exact until one is recorded.

```
npm install @dimforge/rapier3d-compat@<version> @dimforge/rapier3d-simd-compat@<version> --save-exact
npx vitest run src/lib/physics
npm run build
node scripts/health.mjs --check --skip build
```

Then land on a planet on the universe map and kick a barrel by hand: the tests hold the numbers to tolerances, not the feel. Last upgrade: not recorded; record the next one here, with what it broke. The SIMD build was added at 0.21.0 on 2026-10-11 (lane X2): `world.load.test.js` mocked the plain build alone and had to mock both.

## Gotchas

- **Step before you ask.** Rays and shape queries only see what has been added or moved once a step has run (`world.js`’s header).
- **The first step is slow.** Rapier’s first step costs many times what the rest do; `preload()` loads and warms the engine while the ship comes down (`world.js`’s header).
- **The controller catches on a heightfield’s edges** at its default normal nudge (1e-4): a run along a tile’s triangles stalled a frame about once a second. `character.js` sets 0.01, measured over 900 substeps across five headings with no catch.
- **The controller never resolves a penetration it starts in.** A figure placed inside a solid (a spawn on a slope’s wrong side) stays there; `character.js` pushes it out along each overlapping solid’s contact normal (`intersectionsWithShape` and `contactCollider`) before its first move.
- **A shape cast with no motion answers null**, not a resting overlap; `queries.js`’s `sweep` asks `intersectionsWithShape` for a motion under a millimetre.
- **A floor-only filter admits objects and characters**: they wear his “all” bit, which the pinned values keep. Name `object` too and expect both.
- **A worker’s answer is a frame late.** What a Body says through the worker is the step before the one just asked for (the hop); `flush()` waits for it in a test. A worker that dies mid-run is reported once and steps nothing more: its world’s state is gone with it.
- **Workers build as ES modules** (`vite.config.js`’s `worker.format`): as an iife the physics worker inlined both Rapier builds into one 9 MB file; as a module it is 22 KB and loads the one build it needs.
- **Rapier wakes what it finds touching.** A field of props placed asleep on the ground would all wake on landing; `world.js` keeps a body placed asleep asleep through its first step.
