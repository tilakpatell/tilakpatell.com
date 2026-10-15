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
| `lib/three/speedLinesNodes.js` | `speedLines.js` | `speedLinesNodes.test.js` | `speedlines:stretched` | 61.4 | 0.00 |
| `lib/three/atmosphereNodes.js` | `atmosphere.js` | `atmosphereNodes.test.js` | `atmosphere:space` | 69.3 | 0.00 |
| | | | `atmosphere:space-two-suns` | 68.5 | 0.00 |
| | | | `atmosphere:flat` | 65.0 | 0.00 |
| | | | `atmosphere:inside` | 58.8 | 0.00 |
| `lib/three/noiseNodes.js` | `noiseGlsl.js` (a string, no site) | `noiseNodes.test.js` | `noise:hash13`, `hash33`, `noise`, `noised`, `noised2`, `fbm`, `fbmd` (each function drawn raw) | 52.1 to 52.9 | 0.00 |
| `lib/three/rockNodes.js` | `rock.js` | `rockNodes.test.js` | `rock:high` | 60.5 | 0.00 |
| | | | `rock:low` | 59.5 | 0.00 |
| | | | `rock:hook` | 61.2 | 0.00 |
| | | | `rock:shared` (one material on four instanced meshes and a plain one, as the belt has it) | 62.4 | 0.00 |

Each on the `webgl` leg (`nodes-webgl`, SwiftShader) in the container, `node scripts/twin-parity.mjs <case>`; the `webgpu` leg is the owner’s machines’ and is not run here. What a twin does differently, and why:

- `speedLinesNodes`, `atmosphereNodes`: `fog: false` on the node material (a `ShaderMaterial` never took fog; a node material does by default); the atmosphere’s shell `toneMapped: false` too, its GLSL having no tone-mapping chunk.
- `atmosphereNodes`: `inscatter(u, { steps })` is the march as a typed `Fn(ro, rd, tMax)` returning the colour in `xyz` and what gets through in `w`, `STEPS` baked as the loop’s count; the march’s early returns are a `select`, so it is valid WGSL. `atmosphereParams`, `stepsFor`, `skyColoursFor` are copied, not imported (`atmosphere.js` holds the `ShaderMaterial`); FL4 deletes the original.
- `noiseNodes`: `noiseWith(uSeed, { octaves })` returns the GLSL’s functions bound to one seed (`octaves` the GLSL’s `FBM_OCT`), each built once as a shader function; the seed is passed into each as an argument (read from outside a function’s body, three declares it only in the first program the function is built into, and a second, a material shared by two meshes, failed to compile).
- `rockNodes`: `rng`, `rock` copied (as above); `ROCK_RELIEF` a uniform node whose `.value` the universe map’s pace still writes; `rockHook` returns the node material, as the other node hooks do, so its caller uses what it returns.

## The checks (the shared twins’ pull request)

`npm run lint` clean; `npm run build` clean; `node scripts/health.mjs --check --skip build` within budget (`glsl-sites` 619: twins are new files, and the count falls at the flip). `npm test`: 17 files over their 5 s limit under the full suite’s load (the parity builds of other twins on the same four cores), each green run alone (`npx vitest run <file>`), none of them this lane’s.

## The before

The probe’s first run (`QUALITY=low node scripts/perf-probe.mjs galaxy`, 2026-10-15) ran beside seven parity builds on the container’s four cores and is not a number: it is run again on a quiet machine before the flip.

## The after
