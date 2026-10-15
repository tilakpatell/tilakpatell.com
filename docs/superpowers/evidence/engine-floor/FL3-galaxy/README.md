# FL3, the galaxy: the closure, the twins, the before and the after

Lane FL3 of the engine floor for the galaxy in space (`/galaxy/:system?`, `src/components/galaxy/module.js`, `fromScene`’s default `'glsl'`). The design: `docs/superpowers/specs/2026-10-15-engine-floor-design.md` §4.4; the plan: `docs/superpowers/plans/2026-10-15-engine-floor-laneFL3-ports.md`; the method: lane T’s (`2026-10-10-galaxy-engine-laneT-surface-port.md`). The surfaces (`galaxy/surface/module.js`) are `'nodes'` already and are not this lane’s.

The port is cut into pull requests that each stand: the shared twins first, the galaxy’s own second, what it borrows third, the flip last. Each section below is filled by the pull request that lands it.

## The closure (2026-10-15, `d6b68730`)

`node docs/superpowers/evidence/perf/tools/glsl-closure.mjs src/components/galaxy/module.js`: 660 files reached, 53 with GLSL (the hand-off’s 54 was counted on 2026-10-13). By where they live, and how the galaxy reaches them (`scene.js` unless said):

| where | files with GLSL | the way in | what the port does |
| --- | --- | --- | --- |
| `lib/three` with a twin | `core`, `foliage`, `groundmap`, `house`, `ink`, `puffs`, `recolour`, `wind` | `world.js` → `bodies.js` → `surface/kit.js`; `house.js` itself | the flip imports the twins (`surface/nodes/kit.js` is the kit on them) |
| `lib/three` without a twin | `atmosphere`, `rock`, `speedLines`, `keySun` | `bodies.js`, `universe/belt.js`, `galaxy/speedLines.js`, `universe/planets.js` | `atmosphereNodes`, `rockNodes` (with `noiseNodes`, the twin of `noiseGlsl`’s string), `speedLinesNodes`; `keySun` is reached only through `planets.js` (below) |
| the galaxy’s own | `sky`, `skyStreaks`, `fx`, `world`, `bodies`, `rocks`, `rocksPlaced`, `placesDraw`, `levelArea`, `areaWeather`, `interdictor`, `tunnel`, `gateway` | | a twin each under `galaxy/nodes/` |
| the surface’s (read, not edited) | `surface/sky`, `surface/props/shaders`, `surface/props/windows` | `levelArea.js`, `surface/kit.js` | twins exist (`surface/nodes/sky.js`, `props.js`) |
| the universe map’s | `planets`, `planetShading`, `stations`, `rmWorlds`, `props`, `post`, `battleFx`, `setpieces`, `cme`, `sun`, `crash`, `belt`, `trail`, `powerFx`, `livery` | | below |
| Cybertron’s | `skin`, `war` | `universe/planets.js` | gone with `planets.js` |
| the cockpit’s | `kit`, `space`, `vehicles/rv`, `vehicles/cruiser` | `freeKit`; `cabs.js` → the RV’s and the cruiser’s cabs | below |
| Rick and Morty’s | `cruiser3d`, `portal/meshyCast`, `portal/toon`, `wardrobe/dress` | `cruiser3d.js`; the cruiser’s cab | twins exist |

### What the closure need not reach

- `universe/planets.js` is imported for `loadModel(url)` alone, one line (`loadGLTF(url).then((g) => g && cloneScene(g))`); the flip calls `gltfCache` itself, and with it go `planets`, `planetShading`, `stations`, `rmWorlds`, `props`, `gateway`, `keySun` and Cybertron’s `skin` and `war`: nine files, no twin needed.
- `universe/post.js`’s `createPost` has its twin in `surface/nodes/post.js` (lane T), the same calls.
- `universe/shipModels.js` (the livery) has its twin, `universe/shipModelsNodes.js` (lane T).

## The twins

| twin | original | test | parity case | dB | % off |
| --- | --- | --- | --- | --- | --- |

## The before

The probe’s first run (`QUALITY=low node scripts/perf-probe.mjs galaxy`, 2026-10-15) ran beside seven parity builds on the container’s four cores and is not a number: it is run again on a quiet machine before the flip.

## The after
