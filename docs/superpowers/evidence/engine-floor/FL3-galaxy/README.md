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

### The galaxy’s own, what it borrows, and the cockpit’s cabs (the second pull request)

| twin | original | parity cases | dB | % off (at most) |
| --- | --- | --- | --- | --- |
| `galaxy/nodes/sky.js` | `galaxy/sky.js` (5 sites) | `galaxy:sky:*` (4: Hoth, Kashyyyk, Tatooine, low and mid) | 49.5 to 51.5 | 0.01 |
| `galaxy/nodes/skyStreaks.js` | `skyStreaks.js` | `galaxy:skyStreaks*` (3) | 66.6 to 75.5 | 0.00 |
| `galaxy/nodes/fx.js` | `fx.js` | `galaxy:fx:*` (3) | 61.0 to 67.9 | 0.00 |
| `galaxy/nodes/placesDraw.js` | `placesDraw.js` | `galaxy:places*` (3) | 54.7 to 58.0 | 0.00 |
| `galaxy/nodes/levelArea.js`, `areaWeather.js` | `levelArea.js`, `areaWeather.js` | `galaxy:levelArea:*`, `galaxy:areaWeather:*` (9: Kamino, Fondor) | 52.2 to 68.0 | 0.03 |
| `galaxy/nodes/interdictor.js`, `tunnel.js` | `interdictor.js`, `tunnel.js` | `galaxy-interdictor:*`, `galaxy-tunnel:*` (4) | 53.7 to 60.7 | 0.00 |
| `galaxy/nodes/rocks.js`, `rocksPlaced.js` | `rocks.js`, `rocksPlaced.js` | `galaxy-rocks:*` (5) | 62.3 to 66.7 | 0.00 |
| `galaxy/nodes/bodies.js`, `bodyShaders.js`, `bodyFamilies.js` | `bodies.js`, `bodyShaders.js` (the planets) | `galaxy-bodies:*` (19: every family, from orbit and near, two suns, the shield, the game’s skins, the night side) | 54.6 to 63.1 | 0.00 |
| `galaxy/nodes/world.js`, `worldParts.js`, `spacePieces.js` | `world.js`, `spacePieces.js` | `galaxy-world:*` (10: Endor’s shield, Coruscant’s lanes, whole systems) | 52.4 to 81.9 | 0.00 |
| `galaxy/nodes/post.js` | `universe/post.js`’s `createPost`, with the cockpit drawn over the scene | `galaxy-post:cab`, `:open` | 39.2, 40.8 | 1.11 |
| `universe/battleFxNodes.js`, `battleSceneNodes.js` | `battleFx.js`, `battleScene.js` | `universe:battleFx:*` (5), `universe:battleScene` | 40.9 to 74.8 | 0.45 |
| `universe/beltNodes.js`, `crashNodes.js`, `trailNodes.js` | `belt.js`, `crash.js`, `trail.js` | `universe-belt:*`, `-crash:*`, `-trail:*` (11) | 57.1 to 73.1 | 0.00 |
| `universe/setpiecesNodes.js`, `cmeNodes.js`, `sunNodes.js` | `setpieces.js`, `cme.js`, `sun.js` | `universe:setpieces:*`, `:cme:*`, `:sun:*` (10) | 55.5 to 76.7 | 0.00 |
| `universe/powerFxNodes.js`, `online/pilotsNodes.js` | `powerFx.js`, `online/pilots.js` (which reaches GLSL through the livery) | `universe-powerFx:*` (7), `universe-pilots:ship` | 59.9 to 81.1 | 0.00 |
| `cockpit/kitNodes.js`, `spaceNodes.js`, `vehicles/cruiserNodes.js` (+ `Parts`) | `kit.js`, `space.js`, `vehicles/cruiser.js` | `cockpit-kit:*`, `-space:*`, `-cruiser:*` (10) | 50.1 to 66.6 | 0.06 |
| `cockpit/vehicles/rvNodes.js` (+ eight parts, each under 800 lines) | `vehicles/rv.js` (3,024 lines) | `cockpit-rv:*` (7) | 49.7 to 54.3; the crew 36.3 to 45.0 | 1.50 |

What runs differently on the node renderer, and the rule each twin keeps for it:

- **Points are sprites.** The node renderer draws a point one pixel wide, so every `Points` (stars, beacons, glows, the lanes, dust, sparks, the town’s lights) is a `PointsNodeMaterial` on an instanced `Sprite`, its size the GLSL’s `gl_PointSize` over the DPR. A point whose centre is off the picture is clipped at the edge where WebGL dropped it whole; the area weather’s clouds are held to 1,024 pixels, WebGL’s own point limit on ANGLE.
- **Sprites whose `center` differs get their own program** (`keyed`, `lib/three/hookNodes.js`): two shared one and both took the first’s.
- **Clipping planes on a material are ignored**: the broken flagship’s halves sit in a `ClippingGroup` each.
- **WGSL’s rules**: a falling `smoothstep` written as a rising one turned over; no texture sampled under a branch (the planets’ scans read with `textureGrad` from slopes taken before it); no `pow` of a negative.
- **A `ShaderMaterial`’s defaults kept**: fog off, a single pass, no tone mapping where its GLSL had no such chunk.
- **The post**: three’s TSL bloom fixes its mips’ weights, so the galaxy’s falloff goes through its per-mip tints (exact at the galaxy’s radius, 0); the cockpit pass takes the scene’s picture as its background, so the cab’s glass and additive lamps blend over the scene as they did in the composer’s buffer. Its WebGPU leg, where that background is read by screen position, is the one to watch on the owner’s machines.
- **The crew’s case** (the RV’s, turned to Jesse and Walt) varies run to run on Jesse’s skinned model, whose textures the headless browser sometimes fails to decode; the RV’s own materials are the cab’s case, 53.2 dB.
- **One original bug kept**: the cruiser’s ink outline never drew round a skinned mesh (three flips a skinned normal on a back-side material, so the shell went inward); the twin keeps it, so Morty matches. A fix belongs in both files at once.
- Non-shader code a twin needs from a file that holds GLSL is copied, the unit test holding it to the original’s numbers; FL4 deletes the originals.

### The second pull request’s checks

`npm run lint` clean. `npm test`: eight files over their limit under the full suite’s load (the hulls’ timing test, the Blast and Galactic Assault simulations, Albuquerque’s and the map raster’s), each green run alone; none touched here.

## The checks (the shared twins’ pull request)

`npm run lint` clean; `npm run build` clean; `node scripts/health.mjs --check --skip build` within budget (`glsl-sites` 619: twins are new files, and the count falls at the flip). `npm test`: 17 files over their 5 s limit under the full suite’s load (the parity builds of other twins on the same four cores), each green run alone (`npx vitest run <file>`), none of them this lane’s.

## The flip (the third pull request)

`galaxy/module.js` says `shading: 'nodes'`; every import the galaxy reached GLSL through takes the twin (`scene.js`, `spaceLevel.js`, `cabs.js`, `powers.js`, `warfront.js`, `warpieces/{endor,hangar,run}.js`, `speedLines.js`); `universe/planets.js`’s one-line `loadModel` is written in `scene.js`. The galaxy warms and prepares the node renderer’s way, as the surface does: the hooked materials swapped for their twins (`twinScene`), every program made through `compileAsync` with what is hidden shown and nothing culled for the call (else the engine trails, hidden until the ship first moves, were linked in play), then one small draw through the post.

`node docs/superpowers/evidence/perf/tools/glsl-closure.mjs src/components/galaxy/module.js`: 627 files reached, **0 with GLSL** (53 before). `src/runtime/shading.test.js` green.

`glsl-sites` stays 619: the measure counts every file under `src/`, and the originals stay until FL4 (the twins’ rule). Ten of the galaxy’s own originals are reached by nothing but their tests and parity cases after the flip (`world`, `skyStreaks`, `placesDraw`, `spacePieces`, `rocks`, `rocksPlaced`, `levelArea`, `areaWeather`, `interdictor`, `tunnel`: about 13 sites); `sky`, `fx` and `bodies` are still the universe map’s and the Expanse’s.

### The world’s parity

Named views in development (`world.view(name)`, the earth module’s pattern, `galaxy/module.js` and `scene.js`): `hub` (the system as it opens), `orbit` (Tatooine from orbit, its limb across the view), `fleet` (the system’s garrison ship against the planet). Two shots of a view on the classic renderer are the same picture (∞ dB). `node scripts/gpu-parity.mjs /galaxy/tatooine --before 4ad61edb --view hub,orbit,fleet` (the before: the views’ commit, the galaxy still `'glsl'`):

| view | leg | backend | dB | % off |
| --- | --- | --- | --- | --- |
| hub | webgl | nodes-webgl | 53.71 | 0.00 |
| orbit | webgl | nodes-webgl | 53.98 | 0.00 |
| fleet | webgl | nodes-webgl | 53.41 | 0.00 |
| all | webgpu | | | not run: the container has no WebGPU device (“a fallback adapter: no GPU under WebGPU”); the owner’s machines |

### The probe

`VIEW=960x600@1 GPU=webgl QUALITY=<low|high> node scripts/perf-probe.mjs galaxy` (the default 1470 × 956 at 2× is all SwiftShader’s fill at under a frame a second, so the window is smaller), classic from the views’ commit and the flip back to back, the play phase’s row (main thread ms: median and worst 1 %), with both fixes below in:

| quality | run | ready s | late pipelines | main median | worst 1 % | fly main | KB uploaded a frame |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Low | classic | 56.2 | 0 | 501 | 1004 | 437 | 11 |
| Low | nodes-webgl | 62.7 | 0 | **349** | **694** | 352 | 56 |
| High | classic #1 | 66.4 | 0 | 791 | 1548 | 726 | 9 |
| High | nodes-webgl #1 | 100.7 | 0 | 1045 | 2255 | 1040 | 80 |
| High | classic #2 | 64.3 | 0 | 782 | 1608 | 781 | 16 |
| High | nodes-webgl #2 | 84.5 | 0 | 1036 | 2306 | 1014 | 75 |
| either | webgpu | | | | | | not run: the owner’s machines |

**Low: the node renderer is faster** (median 501 → 349 ms, worst 1 % 1004 → 694). **High: it is slower, about a third**, and the gate (no slower, both levels) **does not hold in the container**. What was found:

- In the container the main thread’s time at High is SwiftShader’s: the fly phase’s profile is inside GL calls waiting on the graphics process (`drawArrays`, `bufferSubData`, `clearBufferfi`); the galaxy’s own JavaScript is about 20 ms a frame. The whole frame measured with the queue drained: about 1.43 s against 1.17 s, nearly all of it the scene pass (1,150 against 850 ms); the post costs the same (~290 ms).
- Each part hidden in turn: the planet saves 440 ms on nodes against 392 on classic, the sky sphere 119 against 94, the stars 124 against 17, the ship about the same. The stars were 12,000 instanced quads where the GLSL drew points: **fixed**, a star is one triangle round its square (1,103 → 1,021 ms; `galaxy:sky` parity unchanged, 49.5 to 51.3 dB). The planet’s and the sky’s extra cost is their node programs’ (the planet’s about 42 KB of fragment shader; WGSL’s rules make it sample its scans outside its branches, where the GLSL skipped them), spread across the pass with no one draw to name.
- **The late pipeline: fixed** (the engine trails, linked in play; see above). Late pipelines 1 → 0, every program made in load.
- The ~8 MB a phase of the first runs was a burst of frames that never drew (the main thread running ahead of a backlogged graphics process while a link was pending), gone with the late pipeline, and the probe adding a ranged `bufferSubData`’s whole source array; what is uploaded a frame is about 61 KB, most of it three’s instance matrices sent whole as a uniform buffer.
- Ready is 20 to 35 s later than classic’s: SwiftShader links the planet’s large program slowly, and 68 programs are made up front where classic linked some in play.

What is left for the High gate is the owner’s call (below in the pull request): a software rasteriser’s fill is not a chip’s, the WebGPU rows are the owner’s machines’, and the planet’s program is the one to make cheaper if a real chip shows the same third.
