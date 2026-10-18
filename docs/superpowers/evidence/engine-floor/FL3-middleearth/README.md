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

TO COME

## The twins

TO COME

## The before

TO COME

## The after

TO COME
