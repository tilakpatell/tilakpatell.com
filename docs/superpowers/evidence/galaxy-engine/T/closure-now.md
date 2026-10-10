# The surface's closure with lane T's twins in place

What `src/components/galaxy/surface/module.js` would still reach at the flip if every import of an original with a twin were moved to its twin and the surface's own ported files (sky, skyfog, water, weather, props/windows, props/core's shield, props/forest's shafts, activity's beam, the assault's posts) imported their `nodes/` materials, and `universe/post.js` were `nodes/post.js`. Worked out by following the imports with each original read as its twin (`shadingClosure.js`'s `importsOf` and `resolveImport`, `shading.test.js`'s exempt files left out). 55 files with GLSL at the start; 30 on the branch alone; 34 after `origin/main` was merged in on the evening of 2026-10-10 (main brought the game's effects, `lib/three/fx/marks.js` and `push.js` through `fx/gameFx.js`, the bolts' `lib/three/combat/bolts.js` through `blaster.js`, and the landings' `litter.js`), every one reached through these imports:

| Reached through | Files with GLSL behind it | What the surface takes from it |
|---|---|---|
| `universe/planets.js` | 11 (planets, stations, rmWorlds, planetShading, props, gateway, atmosphere, keySun, Cybertron's skin and war) | `loadModel`: `loadGLTF` and `cloneScene` from `lib/three/gltfCache`, which has no GLSL. Imported from there, the eleven go. |
| `universe/footScene.js` | 15 (footScene, portalFx, the landings' sky and reentry, furnish's worlds: Middle-earth, the office, Rick and Morty, Caribbean, Invincible, Cybertron, stage3d) | `PARTY`, `loadPartyFigure`, `loadSharedFigure`: the crew's figures. Needs the figure-loading slice of footScene as a GLSL-free file. |
| `rickmorty/portal/meshyCast.js` | 3 (meshyCast, toon, wardrobe/dress) | `createMeshyCast`, `MESHY`: the Rick and Morty cast figures. Needs twins of meshyCast's toon look and dress's recolour. |
| `rickmorty/cruiser3d.js` (dynamic) | 1 | `buildCruiser`: Rick's ship. Its ink is \`inkNodes\`'; its own patch needs a twin. |
| `universe/shipModels.js` | 1 (livery) | `buildShip`: the ships' paint. Needs a twin of `livery.js`. |
| `universe/landings/models.js` | 1 | `sizeFor` (placer.js): a pure function. |
| `lib/three/fx/gameFx.js` (marks, push), `lib/three/combat/bolts.js` (via blaster.js) | 3 | the game's effects and bolts, on main since this branch began: twins. |
| `lib/three/portalFx.js` | (in footScene's) | `createPortalFx`, `meshyJoints` (activity.js). Needs a twin. |

```
src/components/universe/planets.js [ShaderMaterial] via galaxy/surface/scene.js
src/components/universe/footScene.js [ShaderMaterial,onBeforeCompile] via galaxy/surface/scene.js
src/components/rickmorty/portal/meshyCast.js [onBeforeCompile] via galaxy/surface/scene.js
src/components/rickmorty/cruiser3d.js [onBeforeCompile] via galaxy/surface/scene.js
src/components/universe/livery.js [onBeforeCompile] via galaxy/surface/scene.js > universe/shipModels.js
src/components/universe/stations.js [ShaderMaterial,onBeforeCompile] via galaxy/surface/scene.js > universe/planets.js
src/components/universe/rmWorlds.js [ShaderMaterial,onBeforeCompile] via galaxy/surface/scene.js > universe/planets.js
src/components/galaxy/gateway.js [ShaderMaterial] via galaxy/surface/scene.js > universe/planets.js
src/components/cybertron/skin.js [onBeforeCompile] via galaxy/surface/scene.js > universe/planets.js
src/lib/three/atmosphere.js [ShaderMaterial] via galaxy/surface/scene.js > universe/planets.js
src/components/cybertron/war.js [ShaderMaterial] via galaxy/surface/scene.js > universe/planets.js
src/components/universe/props.js [onBeforeCompile] via galaxy/surface/scene.js > universe/planets.js
src/lib/three/keySun.js [onBeforeCompile] via galaxy/surface/scene.js > universe/planets.js
src/components/universe/planetShading.js [ShaderMaterial,onBeforeCompile] via galaxy/surface/scene.js > universe/planets.js
src/lib/three/portalFx.js [ShaderMaterial] via galaxy/surface/scene.js > universe/footScene.js
src/components/universe/landings/sky.js [ShaderMaterial] via galaxy/surface/scene.js > universe/footScene.js
src/components/universe/landings/litter.js [onBeforeCompile] via galaxy/surface/scene.js > universe/footScene.js
src/components/universe/reentry.js [ShaderMaterial] via galaxy/surface/scene.js > universe/footScene.js
src/lib/three/fx/marks.js [ShaderMaterial] via galaxy/surface/scene.js > lib/three/fx/gameFx.js
src/lib/three/fx/push.js [ShaderMaterial] via galaxy/surface/scene.js > lib/three/fx/gameFx.js
src/components/rickmorty/portal/toon.js [ShaderMaterial] via galaxy/surface/scene.js > rickmorty/portal/meshyCast.js
src/components/rickmorty/wardrobe/dress.js [onBeforeCompile] via galaxy/surface/scene.js > rickmorty/wardrobe/wear.js
src/components/universe/landings/models.js [onBeforeCompile] via galaxy/surface/scene.js > galaxy/surface/placer.js
src/lib/three/combat/bolts.js [ShaderMaterial] via galaxy/surface/scene.js > galaxy/surface/blaster.js
src/components/universe/landings/beacon.js [ShaderMaterial] via galaxy/surface/scene.js > universe/footScene.js > universe/landings/furnish.js
src/components/universe/landings/rickmorty.js [ShaderMaterial] via galaxy/surface/scene.js > universe/footScene.js > universe/landings/furnish.js
src/components/universe/landings/caribbean.js [onBeforeCompile] via galaxy/surface/scene.js > universe/footScene.js > universe/landings/furnish.js
src/components/middleearth/shire/props.js [onBeforeCompile] via galaxy/surface/scene.js > universe/footScene.js > universe/landings/furnish.js > universe/landings/middleearth.js
src/components/middleearth/kit.js [ShaderMaterial] via galaxy/surface/scene.js > universe/footScene.js > universe/landings/furnish.js > universe/landings/middleearth.js
src/components/cybertron/rollout/kaon.js [onBeforeCompile] via galaxy/surface/scene.js > universe/footScene.js > universe/landings/furnish.js > universe/landings/transformers.js
src/lib/three/facade.js [onBeforeCompile] via galaxy/surface/scene.js > universe/footScene.js > universe/landings/furnish.js > universe/landings/invincible.js
src/lib/stage3d.js [EffectComposer,ShaderPass,UnrealBloomPass,RenderPass,OutputPass] via galaxy/surface/scene.js > universe/footScene.js > universe/landings/furnish.js > universe/landings/middleearth.js > middleearth/shire/props.js
src/components/office/world/scenery.js [ShaderMaterial] via galaxy/surface/scene.js > universe/footScene.js > universe/landings/furnish.js > universe/landings/office.js > office/world/outside.js
src/components/office/world/windows.js [ShaderMaterial] via galaxy/surface/scene.js > universe/footScene.js > universe/landings/furnish.js > universe/landings/office.js > office/world/outside.js > office/world/scenery.js
435 files, 34 with GLSL
```
