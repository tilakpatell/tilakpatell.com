# FL3, the universe map: onto the node renderer

Lane FL3 of the engine floor (`docs/superpowers/plans/2026-10-15-engine-floor-laneFL3-ports.md`) for the universe map, by the session that moved it onto the runtime (FL2, #1016). Branch `claude/engine-floor-fl3-universe`, on FL2’s until #1016 merges.

## The closure (2026-10-16, on FL2’s branch)

`node docs/superpowers/evidence/perf/tools/glsl-closure.mjs src/components/universe/module.js`: 516 files reached, 75 with GLSL, 182 sites (`scripts/health/glsl-sites.mjs`’s count, comments left out). 31 already have a twin beside them or under the world’s `nodes/` (lane T, #1011, #1014); 44 have none, 107 sites:

| world | files without a twin |
| --- | --- |
| the universe map’s own | 28 |
| Cybertron (the landings’ rollout, war, skin) | 3 |
| the galaxy (the surface’s props shaders and windows, the gateway) | 3 |
| `lib/three` (facade, keySun, explosions) | 3 |
| Middle-earth (the kit, the Shire’s props) | 2 |
| Scranton (the scenery, the windows) | 2 |
| `lib/stage3d.js` (an `EffectComposer`) | 1 |
| the Expanse’s sectors, Dickansh’s phone | 2 |

The ten files that belong to other worlds are reached through the map’s landings and its walk on foot (`landings/`, `footScene.js`), which build those worlds’ kits. Their twins are their own lanes’ (FL3 Middle-earth, Cybertron, Scranton and so on), or `lib/three`’s for anyone (new files only), and the map cannot be flipped to `'nodes'` while one of them is still GLSL. `lib/stage3d.js` goes when its last world leaves it (FL2).

| file | sites | lines | twin |
| --- | --- | --- | --- |
| `components/cybertron/skin.js` | 2 | 172 | none yet |
| `components/cybertron/rollout/kaon.js` | 1 | 168 | none yet |
| `components/cybertron/war.js` | 1 | 389 | none yet |
| `components/dickansh/galaxyPhone.js` | 1 | 270 | none yet |
| `components/expanse/scene/sectors.js` | 1 | 236 | none yet |
| `components/galaxy/gateway.js` | 3 | 246 | none yet |
| `components/galaxy/surface/props/shaders.js` | 2 | 57 | none yet |
| `components/galaxy/surface/props/windows.js` | 2 | 87 | none yet |
| `lib/stage3d.js` | 15 | 424 | none yet |
| `lib/three/explosions.js` | 2 | 239 | none yet |
| `lib/three/keySun.js` | 2 | 29 | none yet |
| `lib/three/facade.js` | 1 | 133 | none yet |
| `components/middleearth/kit.js` | 3 | 833 | none yet |
| `components/middleearth/shire/props.js` | 1 | 3379 | none yet |
| `components/office/world/scenery.js` | 2 | 177 | none yet |
| `components/office/world/windows.js` | 1 | 427 | none yet |
| `components/universe/post.js` | 13 | 583 | none yet |
| `components/universe/planetShading.js` | 9 | 288 | none yet |
| `components/universe/rmWorlds.js` | 5 | 540 | none yet |
| `components/universe/stations.js` | 5 | 1540 | none yet |
| `components/universe/footScene.js` | 3 | 3300 | none yet |
| `components/universe/reentry.js` | 3 | 606 | none yet |
| `components/universe/citadelSiege.js` | 3 | 378 | none yet |
| `components/universe/infall.js` | 3 | 251 | none yet |
| `components/universe/scene.js` | 2 | 6227 | none yet |
| `components/universe/landmarks.js` | 2 | 359 | none yet |
| `components/universe/deepspace.js` | 2 | 1485 | none yet |
| `components/universe/landings/litter.js` | 1 | 473 | none yet |
| `components/universe/landings/rickmorty.js` | 1 | 122 | none yet |
| `components/universe/landings/caribbean.js` | 1 | 148 | none yet |
| `components/universe/landings/beacon.js` | 1 | 130 | none yet |
| `components/universe/landings/models.js` | 1 | 147 | none yet |
| `components/universe/landings/sky.js` | 1 | 150 | none yet |
| `components/universe/farStars.js` | 1 | 201 | none yet |
| `components/universe/supernova.js` | 1 | 231 | none yet |
| `components/universe/removerView.js` | 1 | 342 | none yet |
| `components/universe/engines.js` | 1 | 241 | none yet |
| `components/universe/farFights.js` | 1 | 242 | none yet |
| `components/universe/front.js` | 1 | 328 | none yet |
| `components/universe/curve.js` | 1 | 83 | none yet |
| `components/universe/gunPortalFx.js` | 1 | 189 | none yet |
| `components/universe/sectorPortals.js` | 1 | 101 | none yet |
| `components/universe/planets.js` | 1 | 1455 | none yet |
| `components/universe/props.js` | 1 | 176 | none yet |
| `components/cockpit/space.js` | 5 | 407 | `components/cockpit/spaceNodes.js` |
| `components/cockpit/vehicles/cruiser.js` | 5 | 867 | `components/cockpit/vehicles/cruiserNodes.js` |
| `components/cockpit/vehicles/rv.js` | 3 | 3025 | `components/cockpit/vehicles/rvNodes.js` |
| `components/cockpit/kit.js` | 2 | 506 | `components/cockpit/kitNodes.js` |
| `components/galaxy/sky.js` | 5 | 646 | `components/galaxy/nodes/sky.js` |
| `components/galaxy/bodies.js` | 2 | 577 | `components/galaxy/nodes/bodies.js` |
| `components/galaxy/fx.js` | 1 | 238 | `components/galaxy/nodes/fx.js` |
| `lib/three/foliage.js` | 6 | 192 | `lib/three/foliageNodes.js` |
| `lib/three/ink.js` | 3 | 153 | `lib/three/inkNodes.js` |
| `lib/three/puffs.js` | 3 | 297 | `lib/three/puffsNodes.js` |
| `lib/three/rock.js` | 3 | 169 | `lib/three/rockNodes.js` |
| `lib/three/wind.js` | 2 | 150 | `lib/three/windNodes.js` |
| `lib/three/recolour.js` | 2 | 94 | `lib/three/recolourNodes.js` |
| `lib/three/core.js` | 2 | 311 | `lib/three/coreNodes.js` |
| `lib/three/house.js` | 2 | 382 | `lib/three/houseNodes.js` |
| `lib/three/groundmap.js` | 2 | 173 | `lib/three/groundmapNodes.js` |
| `lib/three/atmosphere.js` | 1 | 261 | `lib/three/atmosphereNodes.js` |
| `lib/three/dust.js` | 1 | 157 | `lib/three/dustNodes.js` |
| `lib/three/portalFx.js` | 1 | 56 | `lib/three/portalFxNodes.js` |
| `components/rickmorty/wardrobe/dress.js` | 4 | 138 | `components/rickmorty/wardrobe/dressNodes.js` |
| `components/rickmorty/cruiser3d.js` | 2 | 141 | `components/rickmorty/cruiser3dNodes.js` |
| `components/rickmorty/portal/meshyCast.js` | 1 | 76 | `components/rickmorty/portal/meshyCastNodes.js` |
| `components/rickmorty/portal/toon.js` | 1 | 127 | `components/rickmorty/portal/toonNodes.js` |
| `components/universe/setpieces.js` | 3 | 619 | `components/universe/setpiecesNodes.js` |
| `components/universe/sun.js` | 2 | 170 | `components/universe/sunNodes.js` |
| `components/universe/livery.js` | 2 | 116 | `components/universe/liveryNodes.js` |
| `components/universe/trail.js` | 2 | 351 | `components/universe/trailNodes.js` |
| `components/universe/crash.js` | 2 | 320 | `components/universe/crashNodes.js` |
| `components/universe/battleFx.js` | 2 | 411 | `components/universe/battleFxNodes.js` |
| `components/universe/cme.js` | 2 | 282 | `components/universe/cmeNodes.js` |
| `components/universe/belt.js` | 1 | 190 | `components/universe/beltNodes.js` |
