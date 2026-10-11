# The surface's closure at the flip

What `src/components/galaxy/surface/module.js` reaches now that it says `shading: 'nodes'`, by `shading.test.js`'s own measure (`shadingClosure.js`'s `closure` and `glslSites`, the test's exempt files left out): **401 files, none with GLSL**. `shading.test.js` passes with the module on `'nodes'`.

| | Files reached | With GLSL |
|---|---|---|
| Before lane T (`closure-before.md`) | 371 | 55 |
| Every twin in place, before this round (main merged in, 2026-10-10 evening) | 435 | 34 |
| At the flip (rebased on main, 2026-10-10 night) | 401 | 0 |

## How the last 34 went

| Reached through | Files with GLSL behind it | What was done |
|---|---|---|
| `universe/planets.js` | 11 | The surface took only `loadModel`, which is `lib/three/gltfCache`'s `loadGLTF` and `cloneScene`; scene.js imports those directly. |
| `universe/footScene.js` | 15 | The figure loading moved, unchanged, to `universe/footFigures.js` (GLSL-free, the wardrobe injected: `figuresWith({ bodyAsset, bodyKind, dress })`). footScene binds it with the classic wardrobe and keeps every export; the surface's `nodes/figures.js` binds it with `wearNodes`. |
| `lib/three/portalFx.js` | (in footScene's) | `portalFxCore.js` (the swallow) and the GLSL disc in `portalFx.js`; `portalFxNodes.js` is the disc in TSL. |
| `rickmorty/portal/meshyCast.js`, `toon.js`, `wardrobe/dress.js`, `wear.js` | 3 | Each split into a GLSL-free core (`meshyCastCore`, `toonCore`, `dressCore`, `wearCore`) and its GLSL looks; the `Nodes` files wrap the same cores. `gear.js` takes `toon` from `toonCore`, so the wardrobe doesn't reach `InkPass`. |
| `rickmorty/cruiser3d.js` | 1 | `cruiser3dCore.js` and `cruiser3dNodes.js` (the glass dome as hooks). |
| `universe/shipModels.js`, `livery.js` | 1 | `shipModelsCore.js` and `liveryCore.js`, with `shipModelsNodes.js` and `liveryNodes.js`. |
| `universe/landings/models.js` | 1 | `sizeFor` moved to `landings/sizing.js`, which models.js re-exports. |
| `lib/three/fx/gameFx.js` (`marks`, `push`), `lib/three/combat/bolts.js` | 3 | Cores and `Nodes` files for each. |
| The surface's own: sky, water, weather, skyfog, windows, kit | (counted in 55) | `skyDome.js` and `waterCore.js` hold the workings; `sky.js` and `water.js` wrap them in their shaders as before (twin-parity's reference), `nodes/sky.js` and `nodes/water.js` in node materials. `kit.js` splits into `kitCore.js` and its looks (`nodes/kit.js` on the node renderer); the props take their parts from `kitCore`. The beam, the command posts, the hvv wall, the Gungans' shield and the canopy's shafts use their `nodes/` makers in place. |

The imports were moved by one rewrite over the surface's files, each imported name checked against the twin's exports. The GLSL originals other worlds use keep every export and behave as before.

## On the node renderer, a hook on a classic material

A node hook (`wear`, `wind`, `litWindows`…) given a classic material hands back its node twin. `hookNodes.asNode` keeps one twin per classic material, so the hook lands on the twin that the house's `adopt` or `twinScene` later puts on the object; scene.js swaps (`twinScene`) as things are warmed and before the first draw. The kit makes its materials as node materials from the start (`nodes/kit.js`'s `material: asNode`).
