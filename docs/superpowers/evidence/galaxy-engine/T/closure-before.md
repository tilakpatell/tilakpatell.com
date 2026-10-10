# The surface's closure at the start of lane T

Every code file `src/components/galaxy/surface/module.js` reaches (`src/runtime/shadingClosure.js`'s `closure`, tests left out), and the GLSL names each one uses (`glslSites`), on 2026-10-10 at the branch's start (`da9fafa1`, `main` at `92801fbd` plus the design). This is the list the flip has to bring to nothing: `shading.test.js` fails a `'nodes'` module while any row is left.

| File | Sites |
|---|---|
| `src/components/cybertron/rollout/kaon.js` | onBeforeCompile |
| `src/components/cybertron/skin.js` | onBeforeCompile |
| `src/components/cybertron/war.js` | ShaderMaterial |
| `src/components/galaxy/gateway.js` | ShaderMaterial |
| `src/components/galaxy/surface/activity.js` | ShaderMaterial |
| `src/components/galaxy/surface/missions/assaultScene.js` | ShaderMaterial |
| `src/components/galaxy/surface/props/core.js` | ShaderMaterial |
| `src/components/galaxy/surface/props/forest.js` | ShaderMaterial |
| `src/components/galaxy/surface/props/windows.js` | onBeforeCompile |
| `src/components/galaxy/surface/sky.js` | ShaderMaterial |
| `src/components/galaxy/surface/skyfog.js` | onBeforeCompile |
| `src/components/galaxy/surface/water.js` | ShaderMaterial |
| `src/components/galaxy/surface/weather.js` | ShaderMaterial |
| `src/components/middleearth/kit.js` | ShaderMaterial |
| `src/components/middleearth/shire/props.js` | onBeforeCompile |
| `src/components/office/world/scenery.js` | ShaderMaterial |
| `src/components/office/world/windows.js` | ShaderMaterial |
| `src/components/rickmorty/cruiser3d.js` | onBeforeCompile |
| `src/components/rickmorty/portal/meshyCast.js` | onBeforeCompile |
| `src/components/rickmorty/portal/toon.js` | ShaderMaterial |
| `src/components/rickmorty/wardrobe/dress.js` | onBeforeCompile |
| `src/components/universe/footScene.js` | ShaderMaterial, onBeforeCompile |
| `src/components/universe/landings/beacon.js` | ShaderMaterial |
| `src/components/universe/landings/caribbean.js` | onBeforeCompile |
| `src/components/universe/landings/models.js` | onBeforeCompile |
| `src/components/universe/landings/rickmorty.js` | ShaderMaterial |
| `src/components/universe/landings/sky.js` | ShaderMaterial |
| `src/components/universe/livery.js` | onBeforeCompile |
| `src/components/universe/planetShading.js` | ShaderMaterial, onBeforeCompile |
| `src/components/universe/planets.js` | ShaderMaterial |
| `src/components/universe/post.js` | EffectComposer, ShaderPass, UnrealBloomPass, RenderPass |
| `src/components/universe/props.js` | onBeforeCompile |
| `src/components/universe/reentry.js` | ShaderMaterial |
| `src/components/universe/rmWorlds.js` | ShaderMaterial, onBeforeCompile |
| `src/components/universe/stations.js` | ShaderMaterial, onBeforeCompile |
| `src/lib/stage3d.js` | EffectComposer, ShaderPass, UnrealBloomPass, RenderPass, OutputPass |
| `src/lib/three/atmosphere.js` | ShaderMaterial |
| `src/lib/three/core.js` | onBeforeCompile |
| `src/lib/three/dust.js` | onBeforeCompile |
| `src/lib/three/facade.js` | onBeforeCompile |
| `src/lib/three/foliage.js` | onBeforeCompile |
| `src/lib/three/frameGuard.js` | onBeforeCompile |
| `src/lib/three/grass.js` | onBeforeCompile |
| `src/lib/three/groundLook.js` | onBeforeCompile |
| `src/lib/three/grounding-bake.js` | ShaderMaterial |
| `src/lib/three/grounding.js` | ShaderMaterial, onBeforeCompile |
| `src/lib/three/groundmap.js` | onBeforeCompile |
| `src/lib/three/house.js` | onBeforeCompile |
| `src/lib/three/ink.js` | onBeforeCompile |
| `src/lib/three/keySun.js` | onBeforeCompile |
| `src/lib/three/matcap.js` | onBeforeCompile |
| `src/lib/three/portalFx.js` | ShaderMaterial |
| `src/lib/three/puffs.js` | onBeforeCompile |
| `src/lib/three/recolour.js` | onBeforeCompile |
| `src/lib/three/wind.js` | onBeforeCompile |

371 files in the closure, 55 with GLSL, 67 sites.

Most of the rows are reached through two imports of `surface/scene.js`: `universe/planets.js` (for `loadModel`, which brings the map's planets, stations and Cybertron) and `universe/footScene.js` (for `PARTY` and `loadPartyFigure`, which brings the landings' furnishings: Middle-earth, the office, Rick and Morty, Invincible). The surface draws none of those worlds: its import of the two functions is what puts them in the closure.
