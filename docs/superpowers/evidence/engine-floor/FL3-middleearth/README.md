# FL3, Middle-earth: the closure, the twins, the before and the after

Lane FL3 of the engine floor for Middle-earth (`/middle-earth/:place?`, `src/components/middleearth/module.js`, `'glsl'` since FL2’s #1023). The design: `docs/superpowers/specs/2026-10-15-engine-floor-design.md` §4.4; the plan: `docs/superpowers/plans/2026-10-15-engine-floor-laneFL3-ports.md`; the method: lane T’s and the galaxy’s (`FL3-galaxy/README.md`).

The port is cut into pull requests that each stand, as the galaxy’s was: the shared twins and the runtime’s views on the node renderer first, Middle-earth’s own twins next, the flip last. Each section below is filled by the pull request that lands it.

## The closure (2026-10-18, `91e6f05b`)

The module itself reaches no GLSL: its pictures are made by the page’s components, so the closure is the page’s. `node docs/superpowers/evidence/perf/tools/glsl-closure.mjs src/pages/MiddleEarth.jsx`: 519 files reached, 43 with GLSL, 132 sites (`glsl-sites`’ count, comments left out).

| where | files (sites) | what the port does |
| --- | --- | --- |
| `lib/stage3d.js` | 1 (15: the composer’s chain) | reached for its helpers (`hot`, `canvasTexture`, `disposeTree`, `GRADE`, the sizing) since FL2; the flip takes the helpers from a file without the chain, and the grade becomes the node chain’s `grade` kind (a TSL twin of `GRADE`) |
| `lib/three` with a twin | `core` (2), `foliage` (6), `grass` (1), `groundmap` (2), `grounding` (7), `grounding-bake` (3), `house` (2), `matcap` (5), `wind` (2): 30 | the flip imports the twins |
| `lib/three` without a twin | `flatLitter` (1) | `flatLitterNodes.js` |
| Middle-earth’s own | 31 files, 86 sites: `kit` (3), `Bridge3D` (1), `Gorgoroth3D` (3), `rush/scene` (1), `shire/` `ground` (2), `fx` (2), `sky` (1), `props` (1); `towns/` `ground` (1), `rain` (2), `ghosts` (1), `wraiths` (3), and each town’s `scene` and `props`: Moria (1, 14), Mount Doom (`doom/props`, 12), Weathertop (1, 5), Amon Hen (1, 5), Lothlórien (1, 4), Cirith Ungol (`props`, 4), Rivendell (1, 3), Minas Tirith (`props`, 3), Orthanc (1, 2), Edoras (`props` 2, `folk` 2), the Dead Marshes (1, 1), Bree (`scene`, 1) | a twin each under `middleearth/nodes/` |

## The runtime’s views on the node renderer

Nothing in `src/runtime/views.js` changed for the node renderer: a view’s box is the renderer’s viewport and scissor, its state the renderer’s own, and while it draws, `getDrawingBufferSize` says the view’s size, which is what the node chain’s scene pass sizes itself from (`PassNode` reads it), so a stage’s chain is the view’s size, as its composer was. Two things are the classic renderer’s only and do nothing on the node one: an opaque view’s alpha cleared to one (`solid()`, through three’s WebGL state cache, which the node renderer hasn’t got; a stage’s chain writes alpha one itself, its `grade` pass’s last step), and the frame guard (`lib/three/frameGuard.js`: the node renderer compiles asynchronously and draws what’s ready).

The stage (`nodes/stage.js`) is `../stage.js`’s face on a view, its chain the runtime’s node chain (`rt.gfx.post`: the scene, bloom, `grade`, output). What it took from `lib/stage3d.js` and holds no shader is copied into `lib/three/stage3dNodes.js` with `GRADE` in TSL (after the tone map and the sRGB encoding, as the classic chain’s `OutputPass` then `GRADE`). Two things found on the way:

- UnrealBloomPass glows three times its strength (three’s composite, `3.0 * bloomStrength`, “for backwards compatibility with previous alpha-based intensity”); the TSL bloom the strength alone. The stage hands it over three times over (the galaxy surface’s `UNREAL`): `middleearth:stage:bloom` went from 16.5 dB, 80.17 % off, to 64.6 dB, 0.00 %. (The shots below are at Low in software, where the budget has no bloom.)
- The house look (`lib/three/houseNodes.js`’s `adopt`) swaps each classic material on an object for its node twin (`hookNodes`’ `asNode`), which copied each property once; a town goes on holding its classic materials (a kit’s `mats.lantern`) and lights them each night by `emissiveIntensity`, which the twin never saw: Bree’s lamps and windows were out (24.3 dB, 18.32 % off). A twin now reads and writes each of its classic material’s own properties through to it, its version counting both: Bree 39.1 dB, 0.67 % off. (`asNode` is lane T’s; the galaxy’s and the other node worlds’ twins only gain by it, nothing of theirs wrote to a classic material after the swap and drew the twin.)

The towns’ environments (Ring3D and five towns’ `props.js`) prefilter through `three/webgpu`’s `PMREMGenerator`: the classic one’s passes are GLSL and threw on the node renderer, so the Ring never drew.

## The twins

Each GLSL site of Middle-earth’s own is moved verbatim out of its file into a sibling `*Shaders.js` (the original imports it, unchanged in behaviour) and twinned in TSL under `middleearth/nodes/`, the same path, the same exports; the kit, the stage, the rain, a town’s ground, the ghosts and the Shire’s ground, sky and fx are whole-file twins. The originals stay, orphaned by the flip, for their parity cases; FL4 deletes them. `node scripts/twin-parity.mjs middleearth` (256 × 256, `nodes-webgl` against WebGL 2, SwiftShader), 2026-10-18:

| twin (under `middleearth/`, unless named) | cases | dB | % off (at most) |
| --- | --- | --- | --- |
| `nodes/kit.js` (lava, sky dome, particles) | 5 | 54.8 to 72.7 | 0.00 |
| `nodes/stage.js`, `lib/three/stage3dNodes.js` (`GRADE`, bloom) | 4 | 64.6 to 68.8 | 0.00 |
| `lib/three/flatLitterNodes.js` (the Shire’s leaves) | 3 | 60.6 to 61.2 | 0.00 |
| `nodes/towns/rain.js` | 3 | 49.6 to 70.3 | 0.05 |
| `nodes/towns/ground.js` (terrain, tufts, puddles) | 3 | 56.9 to 65.5 | 0.00 |
| `nodes/shire/` `ground`, `sky`, `fx`, `propsShaders` | 11 | 52.4 to Infinity | 0.00 |
| `nodes/rush/sceneShaders.js` (the Ring’s rush) | 1 | 62.5 | 0.00 |
| `nodes/bridgeShaders.js` | 1 | 57.1 | 0.00 |
| `nodes/gorgorothShaders.js` | 3 | 62.4 to 63.7 | 0.00 |
| `nodes/towns/ghosts.js` | 2 | 57.7 to 62.3 | 0.00 |
| `nodes/towns/wraithsShaders.js` (the Nazgûl) | 3 | 39.8 to 55.8 | 0.18 |
| `nodes/towns/edoras/folkShaders.js` (the host of Rohan) | 3 | 55.2 to 55.6 | 0.00 |
| `nodes/towns/moria/` `scene`, `props` | 18 | 52.0 to 80.0 | 0.01 |
| `nodes/towns/doom/` (`props` in three) | 14 | 50.3 to 67.4 | 0.08 |
| `nodes/towns/weathertop/` | 7 | 53.9 to Infinity | 0.00 |
| `nodes/towns/amonhen/` | 7 | 54.2 to 66.4 | 0.00 |
| `nodes/towns/lorien/` | 11 | 52.5 to 60.2 | 0.00 |
| `nodes/towns/cirithungol/` | 6 | 53.5 to 66.8 | 0.00 |
| `nodes/towns/rivendell/` | 4 | 54.0 to 56.2 | 0.00 |
| `nodes/towns/minastirith/` | 3 | 58.1 to 68.8 | 0.00 |
| `nodes/towns/orthanc/` | 5 | 58.7 to 60.7 | 0.00 |
| `nodes/towns/edoras/propsShaders.js` | 3 | 53.1 to 69.2 | 0.00 |
| `nodes/towns/marshes/` | 3 | 57.7 to 68.0 | 0.00 |
| `nodes/towns/bree/sceneShaders.js` | 1 | 71.6 | 0.00 |
| a town’s lamps (`middleearth-lamps.js`: point lights in the house look, with fog) | 5 | 62.1 to 75.4 | 0.00 |

- *The Nazgûl’s Ring face* (`wraiths:ring-half`, `wraiths:ring`): the GLSL original’s face never compiles on three r186 (`totalEmissiveRadiance *= vColor`, a `vec3` by the `vec4` the vertex colours are), so the classic side draws the Nazgûl without it and logs the shader error; the twin keeps the same face out, as the live page has it. Its fix (`vColor.rgb`) changes main’s pictures and is left to the owner.
- Since the flip a kit builds the twin’s materials, so the host’s and the Nazgûl’s cases build the GLSL’s on the classic side on the kit’s own uniforms (the Nazgûl’s kit there built on a node renderer of its own, whose night isn’t drawn).

## The before

TO COME

## The after

TO COME
