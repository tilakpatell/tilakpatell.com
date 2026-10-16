# Planets, generation, rigging and the asset pipeline: where the site is on 2026-10-08

Date: 2026-10-08. Read-only surveys of the code on `main` (after PRs #622 natural-worlds Phase 1, #624 the Quaternius packs, #629), made for the kit-worlds design (`docs/superpowers/specs/2026-10-08-kit-worlds-design.md`). Each says what IS, with line numbers of that checkout, and ends with the specs it checked against and their status.


---

# 1. The planets

Site: the site repo. Read-only survey of the universe map's planets, the Star Wars galaxy's planets, their textures, pipelines, LOD, budgets and the two 2026-10-06/07 specs' status. Everything below is what IS in the code; no proposals.

## 0. The budgets planets live under (src/lib/budgets.js, src/lib/detail.js)

`src/lib/budgets.js:24-29` BUDGET_ROWS (how MUCH a level draws), `budget(level)` falls back to high:

| level | tris | calls | modelsMB | props | lod1 | grass | terrain | cut | water |
|---|---|---|---|---|---|---|---|---|---|
| low | 0.8e6 | 350 | 20 | 0.5 | true | 0.25 | 0.5 | `.lo` | 0.5 |
| mid | 1.5e6 | 500 | 40 | 0.75 | true | 0.5 | 0.75 | `''` | 0.75 |
| high | 3e6 | 700 | 60 | 1 | true | 1 | 1 | `.hq` | 1 |
| ultra | Infinity | 1500 | 240 | 1.5 | false | 2 | 2 | `.ultra` | 2 |

`src/lib/detail.js:30-35` DETAIL (how FINE):

| level | tex | texMax | seg | modelTex | lod | clearcoat |
|---|---|---|---|---|---|---|
| low | 0.5 | 512 | 0.5 | 512 | 0.6 | 0 |
| mid | 1 | 1024 | 0.75 | 1024 | 0.8 | 0 |
| high | 1 | 2048 | 1 | 4096 | 1 | 0 |
| ultra | 2 | 4096 | 2 | 8192 | 1.5 | 1 |

Helpers: `detailLevel()` (detail.js:41-44, reads gpu() then device().detail), `texScale(design,{level,max})` (:52-61, power-of-two scale, floor MIN_TEXELS=32), `seg(n,{level,min})` (:67-69, never under 6), `modelTexCap`, `lodScale`, `strained()` (:75-77: ultra → capDetail('high') when frames stay late).

Observed: the universe planets never call `budget()`, `texScale()` or `seg()`. planets.js hard-codes its own segment counts (`T.small ? [44,28] : [64,40]` at planets.js:1221; NEAR_SEG at :1212) and planetMaps.js picks files by `level` name string only. The only detail.js import in the planet files is `detailLevel()` (planetMaps.js:12, nearMaps.js:27). Atmosphere steps do scale by level through `stepsFor` (atmosphere.js:139-140: low 0.5, mid 0.625, high 1, ultra 2 × base 8 → 4/5/8/16).

## 1. The universe map's data (universes.js, scale.js, layout.js)

- `src/components/universe/universes.js`: CORE (6 stations, `size × STATION` where STATION = 7*3 = 21, :32) → home 12.6, experience 12.18, projects 12.6, resume 10.92, contact 11.76, terminal 10.92. FANDOMS (:135, `size × (portal ? GATE : PLANET)`, PLANET = 28*3 = 84, GATE = 28): starwars 150.08 (gate, `airless`, `portal`), music 52.08, middleearth 55.44, transformers 58.8, marvel 53.76, breakingbad 50.4, office 48.72, rickmorty 50.4, gaming 47.04, travel 57.12, caribbean 52.08, invincible 53.76. MOONS (:349-, MOON = 21): gazorpazorp 8.82, squanch 8.4, birdworld 9.24, gearworld 7.98, pluto 7.56, snakeplanet 8.4, nuptia 7.98, resort 8.4, cronenberg 9.24, purge 8.4 — ten Rick-and-Morty-sector worlds.
- `air` per planet (universes.js): music {#ffb060, 1.2, top 1.05}; middleearth {#9fc4ff, 1.8, 1.05, sunset #ffb070}; transformers {#a98cff, 0.9, 1.04}; marvel {#ffd27a, 1.4, 1.05}; breakingbad {#ffd9a8, 1.6, 1.045, sunset #ff8a50}; office null; rickmorty {#b8ff5a, 2.0, 1.05, flat:true}; gaming null; travel {#8fc1ff, 2.2, 1.05}; caribbean {#bfe4ff, 2.4, 1.055}; invincible {#ffc9a0, 2.8, 1.06}; every moon has one (density 1.0–1.8, top 1.04–1.07).
- `src/components/universe/scale.js`: LENGTH 0.26 (ship), HOME_SCALE 3, WORLD_SCALE 3, SPREAD 4, STAR_SCALE 2, HOLE_SCALE 2.5. No imports.
- `src/components/universe/layout.js`: core stations on a ring RING=140 (:62); fandoms on a golden-angle spiral, FIRST = 2000×4 = 8000, STEP = 330×4 = 1320, HEIGHT = 560×4/2 = 1120 (:25-27); moons on their own spiral (SECTOR_FIRST 900, STEP 450, HEIGHT 300) round SECTORS.rickmorty.origin [0,0,-48000] (:47); SUN {at:[0,0,0], r:75} (:65); REACH per body = size × (reach ?? core 2.0 : 1.9) (:76). POSITIONS :80-98.
- `src/components/universe/catalog.js` is NOT about planets: it is the hangar's price catalogue (parts/modules/paints, BANDS :26-34). Nothing planet-related in it.

## 2. The universe map's planets: how built (planets.js, planetShading.js, planetMaps.js, nearMaps.js, atmosphere.js, sun.js)

### 2.1 buildPlanet (planets.js:1215-1403)
- Every body starts as `SphereGeometry(u.size, 64, 40)` (44×28 on `T.small`) with a plain `MeshStandardMaterial({color: palette.base, roughness 1})` (:1221-1225). A `spinner` group turns it; `spin = 0.05 + rng(id-spin)() × 0.05` rad/s for non-core (:1292).
- Air: `halo()` (planetShading.js:58-70: BackSide sphere at radius × AIR=1.2 (entry.js:33), additive ShaderMaterial, pow(1−x,3) falloff, lit by uLight) for every non-core non-airless body; plus a marched `createAtmosphere` shell on tiers ≠ low when `u.air` exists (planets.js:1234-1237): segments [96,64] ([64,40] small), `steps: stepsFor(tier, 8)`, inner = cos(π/seg[1]), `flat` for rickmorty, uSunDir shared with the planet's sun vector. Shell on → halo hidden (:1242). `setAir('shell'|'halo')` (:1343-1351) is the pace's switch (step ≥3 → halo).
- `airGlow(mat, rim, {night, sun})` (planetShading.js:74-105) is injected into every non-core MeshStandardMaterial via onBeforeCompile: a rim-emissive term and, when `p.night` is set, `texture2D(uNight, vMapUv) × 1.5 × smoothstep(0.12,−0.3,day)`. With a shell the rim strength is zeroed (planets.js:1281).
- `styleFor(u,T,{tier})` (planetShading.js:111-117) → cloud layer name per planet (CLOUDS table :111: middleearth, breakingbad, rickmorty, caribbean, invincible, travel), `alpha` flag, rough map, `detail` (true unless core/portal/FLAT{rickmorty,gaming}/low). `groundHooks` (:141-176) injects: cloud shadows (`diffuseColor.rgb *= 1 − 0.55 × uCloudOn × mix(cl.a, cl.g, uCloudAlpha)`), a 256² fbm `detailTile()` tiled 96×48 fading in from uCamDist 3 → 1.3 radii, roughness floor 0.22 if there's a rough map.
- keyHook (lib/three/keySun) when `key` given (:1278).
- Near geometry: `NEAR_SEG = { high:[160,100], ultra:[320,200], mid:[96,60] }` (:1212); `nearGeometry(on, level)` (:1258-1268) swaps body and cloud sphere to a finer SphereGeometry made once per mesh; undefined if the builder replaced the geometry (Office's crumple) or core.
- `swapMaps = mapSwapper(group, T, mapsOf(id))` (:1291; planetMaps.js:117-153): walks every material's MAP_SLOTS and every uniform `.value` and swaps the texture object by identity, copying wrap/repeat/offset/colorSpace/anisotropy.
- Per frame `update(t, camera, live)` (:1364-1372): body.rotation.y; `shell.update(group.getWorldPosition)` when visible; `ground.uCloudTurn` from cloud mesh rotation; every `orbit.set(t)`; every `p.tick` fn when `live`. `light(colour, ratio)` (:1335-1338) copies the key colour for Cybertron and dpr for Dot Matrix. `near(d)` (:1314-1316) feeds uCamDist. `setLevel(l)` (:1320-1327): l≥2 kills ground detail, l≥3 kills cloud shadows and shell.
- `mount(model, name)` (:1377-1401): fit() into a slot's holder, `s.skin` hides the body material (no slot in planets.js sets `skin`; grep shows the field only read here — see §2.4), a tick for sway/hop/chomp.
- MODELS (:1409-1423): 13 GLB loads (sitar, optimus-orbit, megatron-orbit, marvel, breakingbad, saucer, gaming, mario, piranha, pearl-far, venator, star-destroyer ×2), loaded through `gltfLoader().loadAsync` one by one (:1427-1436) — NOT through gltfCache's `loadGLTF` (`loadModel` at :1404 wraps gltfCache but is unused by loadModels).

### 2.2 Every body on the universe map (BUILDERS, planets.js:235-1207, stations.js, rmWorlds.js)

Map files are in `public/textures/universe/` (40 MB dir total, 98 files; sizes are bytes; px = pixel dims). Default file at high = `<name>.webp`; mid/low = `-sm` where one exists; ultra start = `-hq` where one exists; ultra near = `-xl.ktx2` (4096×2048, UASTC, 1 mip level, supercompression 2) where one exists (planetMaps.js:50-54). `K8` set is EMPTY (`public/textures/universe/k8.json` = `[]`), so no 8192 map is ever requested.

| id | r (map units) | how made | its maps (px / bytes) | orbit props | atmosphere | per-frame ticks |
|---|---|---|---|---|---|---|
| starwars (gate) | 150.08 | NOT a planet: `p.body.material.visible=false`, `buildGateway(r)` (planets.js:236-262) | none (starwars.webp 1024² 79 KB, -hq 2048 310 KB, -sm, starwars-glow, alderaan.webp 512×256 exist in the dir but NOTHING in src/ loads them: orphans of the old Death-Star planet) | 3 orbits: cruiser r×1.38 speed .14; two Star Destroyers r×1.3/1.34 speed .1/.09; slots cruiser/escort1/escort2 | airless, no halo | gate.update(t,camera) |
| music | 52.08 | texture map: Jupiter recoloured saffron (giants.mjs) on MeshStandardMaterial roughness 1 (:265) | music.webp 1024×512 116 KB, -sm 512 35 KB, -hq 2048 350 KB, -xl.ktx2 5.59 MB | 1 orbit r×1.2 tilt −.55 speed .2 (sitar slot r×.78); 6 TorusGeometry strings (5×200 segs each) + a 512×4 painted band RingGeometry(128) | shell #ffb060 d1.2 top 1.05 + halo | strings pluck decay |
| middleearth | 55.44 | texture map (middleearth.mjs, baked from Tolkien's map geo) with normal + rough + emissive glow + night; cloud sphere r×1.01 (72×48 / 44×28) child of body (:300-330) | middleearth 1024 49 KB/-sm 16/-hq 137/-xl 3.51 MB; -normal 1024 31 KB/-sm 7/-hq 164; -rough 1024 14 KB; -night 1024 1.6 KB/-sm; -glow 1024 1.1 KB; -clouds 1024 204 KB/-sm 70/-hq 583 | 1 orbit r×1.55 tilt .42 speed .22 carrying the One Ring (ringGeometry(160), 2048×256 painted tengwar emissive) | shell #9fc4ff d1.8 top 1.05 sunset #ffb070 | sky sway; ring spin + emissive pulse |
| transformers | 58.8 | texture map (build-cybertron-planet.mjs) map+normal, roughness .55 metalness .45, `cybertronSkin` shader hook (energon colour lerp, night cities), `createWar` fireballs (5 / 3 small) (:333-402) | transformers.webp 2048×1024 519 KB / -sm 1024 155 KB (NO -hq, NO -xl); -normal 2048 545 KB / -sm 143 KB; -glow-sm 1024 430 KB (lossless; the 2048 transformers-glow.webp 1.16 MB is the Cybertron page's, planet3d.js:181) | 1 orbit r×1.55 tilt .3 speed .12, Optimus on holder + Megatron on `rival` group 0.55 rad apart | shell #a98cff d0.9 top 1.04 | skin uTime+uEnergon; battle.update(t,camera,.85) |
| marvel | 53.76 | texture map: Saturn recoloured (giants.mjs) (:419) | marvel 1024 89 KB/-sm 25/-hq 326/-xl 5.63 MB | 6 Infinity Stones InstancedMesh (glowingGems) + 6 Sprites on r×1.3 at t×.3; 1 orbit r×1.55 tilt −.4 speed .16 (gauntlet slot) | shell #ffd27a d1.4 top 1.05 | 6 instance matrices + 6 sprite positions per frame |
| breakingbad | 50.4 | texture map (breakingbad.mjs: New Mexico geo) map+normal(1.3)+rough+night; cloud sphere r×1.008 (64×40) alphaMap child of group (:469-566) | breakingbad 1024 74 KB/-sm 24/-hq 255/-xl 5.84 MB; -normal 1024 122 KB/-sm 29/-hq 531; -rough 5 KB; -night 1024 2.3 KB/-sm; -clouds 1024 10 KB/-sm | 5 shard InstancedMesh on r×1.32 at t×.26; 4 elementTile groups on r×1.68 facing camera; 1 orbit r×1.5 tilt 1.0 speed .2 (RV slot) | shell #ffd9a8 d1.6 top 1.045 sunset #ff8a50 | sky.rotation; 5 instance matrices; 4 tiles getWorldQuaternion+copy per frame |
| office | 48.72 | texture map (office.mjs letterhead) on MeshPhysicalMaterial with sheen .6, normal, rough; geometry REPLACED by a 12-plane-cut crumpled SphereGeometry (112×72 / 64×44) with seam-normal fix (:568-630) → nearGeometry is `undefined` for it | office 1024 22 KB/-sm 8/-hq 59/-xl 735 KB; -normal 1024 26 KB/-sm 10/-hq 71; -rough 3 KB; fallback `paper-normal` 512² tiled 4×2 | 1 orbit r×1.5 tilt .32 speed .28 with bossMug (props.js) | `air: null` → halo only (rim #7f8aa0) | mug rotation |
| rickmorty | 50.4 | texture map (rickmorty.mjs cel-inked) map + emissive glow + rough, `celShade` hook; cloud sphere r×1.012 (64×40) celShade ink 0 (:633-688) | rickmorty 1024 137 KB/-sm 50/-hq 346/-xl 1.33 MB; -glow 8 KB; -rough 36 KB; -clouds 1024 107 KB/-sm 47/-hq 224 | 1 orbit r×1.55 tilt .36 speed .24 (saucer slot) + a SWIRL_GLSL portal plane r×.8 on the orbit plane facing camera | shell #b8ff5a d2.0 top 1.05 `flat:true` (two-band cartoon shell, atmosphere.js:98-106) | portal uniform t + quaternion; sky rotation |
| gaming | 47.04 | PROCEDURAL in-browser: 256×128 pixel map painted by value-noise (4 octaves) in 4 greens with NearestFilter, `ditherShade` hook (Bayer 4×4, dpr uniform), 256×128 pixel-cloud shell r×1.025 (64×40) alphaTest, up to 70 peaks ×2 voxel InstancedMesh (:690-818) | none on disk | Mario on the pole (`hop`), Piranha on the body (`chomp`), 1 orbit r×1.55 tilt −.3 speed .22 (Game Boy slot) | `air: null` → halo only (rim #6f9a1c) | cloud rotation; dpr uniform |
| travel (Earth) | 57.12 | texture map (build-universe-textures.py, Solar System Scope) map + rough + night; cloud sphere r×1.012 (64×40, NO small variant) alphaMap; 5 TubeGeometry routes from globeData() merged (:1152-1202) | earth 2048×1024 148 KB/-sm 1024 44 KB/-hq 4096×2048 500 KB (no -xl); earth-night 2048 83 KB/-sm/-hq 4096 348 KB; earth-clouds 1024 141 KB/-sm 38/-hq 2048 545 KB; earth-rough 1024 27 KB | none (no model slot) | shell #8fc1ff d2.2 top 1.05 | clouds rotation |
| caribbean | 52.08 | texture map (caribbean.mjs) map+normal(1.2)+rough+night; cloud r×1.01 alphaMap; falls back to an in-browser 1024×512 painted island map if T.caribbean missing (:820-887) | caribbean 1024 37 KB/-sm 15/-hq 100/-xl 3.17 MB; -normal 1024 19 KB/-hq 132 (no -sm); -rough 11 KB; -night 1 KB; -clouds 1024 30 KB/-sm 12/-hq 70 | 1 orbit r×1.5 tilt .22 speed .2 (Black Pearl slot r×.9) | shell #bfe4ff d2.4 top 1.055 | sky rotation |
| invincible | 53.76 | texture map (build-invincible-planet.mjs) map+normal(1.35)+emissive glow (pulsing 2–3.2)+rough+night; dust sphere r×1.016; fallback painted map (:889-1150) | invincible 1024 47 KB/-sm 20 (no -hq/-xl); -normal 1024 235 KB/-hq 2048 699 KB; -glow 5 KB; -night 1024 21 KB/-sm 6; -clouds 1024 12 KB/-sm 5; -rough 30 KB | 150 (70 small) debris rocks InstancedMesh RE-PLACED EVERY FRAME (:1002-1013); dust RingGeometry(128); broken moon IcosahedronGeometry(r×.17, detail 4/3) on orbit r×2.15 + 6 chunk meshes; 2 flyers each: orbit + core sphere + sprite + 2 TubeGeometry(80×8) trails + shockwave ring | shell #ffc9a0 d2.8 top 1.06 | rocks 150 matrices/frame; moon chunks; flyers' halo opacity, rings |
| 6 core stations | 10.9–12.6 | stations.js builders (merged hull meshes, lights shader); `bigSign` 768×216 painted plane | plates/hull 512² tiling maps | per station (not planets) | none (core: no halo, no shell, no airGlow) | facing(sign) + station ticks |
| 10 RM moons | 7.56–9.24 | PROCEDURAL GLSL ground (rmWorldsGlsl.js: 482 lines, `rmSurface` per moon, fbm in fragment, time uniform) via `wear()` (rmWorlds.js:40-75) + celShade; props: fireworks (squanch), clouds+flocks (birdworld), gears (gearworld), charon (pluto), serpents (snakeplanet), bands (nuptia), field (resort) | none on disk | per-moon props on orbits | every moon has `air` → shell + halo | uRmTime per frame; props' ticks |

Common: every non-core body gets `airGlow` (rim + optional night map), `groundHooks` (cloud shadow / detail mottle / rough floor) per styleFor, `keyHook`. Every body is one `SphereGeometry(64,40)` (44×28 on small) + a halo BackSide sphere of the same segments + (tier≠low & air) a shell sphere [96,64]. So a textured fandom planet is at minimum 3 sphere draws (body, halo hidden or shell, clouds) plus its props and orbit models.

### 2.3 LOD on the universe map
- There is no THREE.LOD and no distance-stepped mesh for any planet. The only distance-driven changes are:
  1. `farPlaces.js`: past FAR_REAL = 24000 (:25) from the camera a place's group is hidden and a single Points draw shows it as a sprite at SKY_FAR = 24000 (deepspace.js:70), blended over FADE = 2000 (:26). One draw call, no texture, every tier (:14-15). Covers fandoms, moons, wonders and the sun (:62-66), not the stations.
  2. `scene.js:4867-4873`: `p.update(t, camera, live)` where `live = px > 2 && frustum.intersectsSphere(radius×2.6)` — the ticks (props' motion) are skipped when the body is under 2 px tall or off-screen; the body spin, shell centre, orbits still run for ALL bodies every frame (planets.js:1365-1370; 12 fandom + 10 moons + 6 stations = 28 bodies).
  3. `nearMaps.js` (createNearMaps, scene.js:693): for the ≤2 planets within NEAR = 6 radii (held to 7.5) the finer map set is fetched, uploaded in 8 MB slices, swapped in by identity, and the sphere re-made at NEAR_SEG (high 160×100, ultra 320×200, mid 96×60). Off entirely on low and on `small`.
  4. `lights()` scene.js:4601-4610: the two nearest bodies get `near(d)` for the detail-mottle fade (3 → 1.3 radii).
  5. The pace (`setLevel`, planets.js:1320): level 2 drops ground detail, 3 drops cloud shadows and swaps the shell for the halo.
- lib/detail's `lodScale`, `seg`, `texScale` are not used by the planets. `budget(level).lod1` is not read here.

### 2.4 Per-frame cost (what planets.js does each frame, for every body, scene.js:4867-4874)
- `group.getWorldPosition` + distance + px estimate + frustum test ×28.
- `update`: `body.rotation.y`; `shell.update(group.getWorldPosition())` (when shell visible); `ground.uCloudTurn`; `orbit.set(t)` for each orbit; and, if live, every tick (Invincible's 150-rock InstancedMesh rewrite + 6 chunks + 2 flyers; Marvel's 6 stones + 6 sprites; Breaking Bad's 5 shards + 4 camera-facing tiles; Cybertron's war particles; the RM moons' props).
- `near.update(camera.position, planets)`: for each planet with a near set, `getWorldPosition` + sort every frame (nearMaps.js:140-151).
- `lights()`: the sun vector of each planet rotated by state.yaw (`applyAxisAngle`) ×28 + a sort of 28 for the nearest two.
- The shell shader marches STEPS (4/5/8/16 by level) per fragment over a BackSide sphere of 96×64 at radius×top for every planet with air that's in view; the halo (when it's the one shown) is a BackSide sphere at radius×1.2.
- The sun (sun.js:142-168): 96×64 sphere with simplex-noise surface (3 snoise warps + 2 cells + 2 granule octaves per fragment) and a corona plane (3 snoise per fragment) re-facing the camera each frame.
- `scene.js:4645` `p.light(key.color, post.ratio)` ×28 per frame; `:4659 p.setLevel(pace.level)` ×28 when the pace steps.

### 2.5 Models on orbit (planets.js:1409-1436)
13 GLBs loaded via `gltfLoader().loadAsync` (not the gltfCache), each `fit()` into its slot; the slot's `turn` sway tick per frame. public/models/universe/: breakingbad.glb 168 KB, marvel.glb 146 KB, gaming.glb 116 KB, mario.glb 147 KB, piranha.glb 119 KB, venator.glb 383 KB, star-destroyer.glb 473 KB (loaded twice for two escorts through the loader cache); the sitar is /models/sketchfab/sitar.glb, Optimus/Megatron /models/cybertron/*-orbit.glb, the saucer /games/meshy/saucer.glb, the Pearl /games/caribbean/pearl-far.glb. No `skin` slot exists in any builder (grep `skin:` in universe/ finds only footScene colours), so `mount`'s "model takes the sphere's place" branch (planets.js:1386-1391) is dead code today. The dir also holds death-star.glb 568 KB, death-star.hq.glb 2.44 MB, falcon, slave1, trench, cr90, tie-interceptor, xwing-traffic, rv-wings (traffic/deep-space, not planets).

## 3. The texture pipelines (what generates what, from what)

Four separate pipelines write into the one directory `public/textures/universe/`:

1. `scripts/build-fandom-planets.mjs` (25 lines) → `scripts/planets/<id>.mjs` on the shared kit `scripts/planets/sphere.mjs` (377 lines: mulberry32 `rand`, 3D Perlin `perlin`, `fbm`/`ridged`/`billow`, spherical `cells`, `eachTexel`, `normalMap(height,w,h,strength)`, `blur`, SVG `raster` via sharp, `save(data,w,h,ch,name,sizes)` which writes WebP at each listed size and KTX2 for `-xl` via `scripts/ktx2.mjs` (UASTC, XL_MAX 6 MB, K8_MAX 24 MB; `PLANETS_8K=1` bakes at 8192×4096)). Bakers: middleearth (324 lines + middleearth-geo.mjs 182: coasts, rivers, ranges, forests, cities as SVG paths; azimuthal projection about 35°N), breakingbad (334 + geo 178: real New Mexico in degrees), caribbean (311 + geo 188: real charts), rickmorty (170: cel-inked biomes by region id), office (158: letterhead raster + 8 great-circle folds), giants (90: fetches Solar System Scope's 8K Jupiter/Saturn from Wikimedia into node_modules/.cache/universe and recolours → music, marvel). Bake size 4096×2048 (8192×4096 with --ultra), then Lanczos down. Outputs per baker listed in §2.2.
2. `scripts/build-universe-textures.py` (367 lines, Pillow+numpy): fetches Solar System Scope maps (Commons API) and ambientCG 1K zips (Metal plates, Paper001) into node_modules/.cache/universe. Writes: `starwars` (Mercury under plates: Death Star's old skin, :294) and `starwars-glow` (:295) — both now unused by the universe; `earth` 2048×1024 (+ -sm, --hq 4096), `earth-rough` (from the day map's sea, :304), `earth-night` (Commons 1920px copy ×1.3 warm, :306), `earth-clouds` (:307), `alderaan` 512×256 (:310, unused by src), `sun` 1024×512 (:311), `sky` 4096×2048 (:351, Earth page's background; --hq 8192×4096 1.2 MB), `plates`/`plates-normal`/`plates-rough`, `hull`/`hull-normal`/`hull-rough`, `paper-normal` (512², :362). `--ultra` writes `earth-8k.ktx2` and adds 'earth' to k8.json (:242-253) — not done (k8.json is []).
3. `scripts/build-cybertron-planet.mjs` (975 lines): worked at CY_W=4096 in 3D noise, saved `transformers.webp` 2048, `-sm` 1024, `-normal` 2048/-sm, `-glow` 2048 lossless (packed R energon / G fires / B cities) and `-glow-sm` 1024 (:969-975). Its own `save` via sharp; does not use sphere.mjs.
4. `scripts/build-invincible-planet.mjs` (314 lines): W=2048 in 3D noise; `invincible` 1024/-sm 512, `-normal` 1024/-hq 2048, `-glow`, `-night`/-sm, `-clouds`/-sm, `-rough` (:294-302). Own `save`; does not use sphere.mjs.
5. `scripts/bake-universe-sky.mjs` (207): `sky-glow.webp` 4096 + `-sm` 2048 from ESO eso0932a — the universe map's sky, not a planet.
(Also `scripts/build-earth.mjs` writes `public/textures/earth/` for the Earth WORLD page from NASA Blue Marble — a fifth, separate Earth pipeline from the universe map's `earth.webp`.)

Three different noise/normal-map/save implementations exist: sphere.mjs (perlin + `normalMap` + sharp `save` with sizes list), build-cybertron-planet.mjs (its own noise and `save`), build-invincible-planet.mjs (its own), plus the Python one. Size conventions differ: fandom bakers emit `-xl/-hq/''/-sm`; Cybertron emits only `''` (2048) and `-sm` (1024) — so its "standard" is 2048 where every other planet's is 1024, and planetMaps.js special-cases it (`hq:false`, MAPS :31-33); Invincible emits `-hq` only for the normal.


## 4. The Star Wars galaxy's planets (galaxy/systems.js, bodies.js, bodyShaders.js, world.js, scene.js, travel.js, gateway.js)

### 4.1 How many, and what
`systems.js` has 18 systems (grep `^    id:` = 18): tatooine, hoth, endor, yavin, alderaan, bespin, dagobah, mustafar, coruscant, naboo, kashyyyk, kamino, geonosis, scarif, nevarro, mandalore, lothal, sorgan. 17 have a `body: { look, r }` (alderaan's is `null`, systems.js:364: rubble). 2 have a `parent` gas giant (endor → `endor-giant` r 260 at [-1350,240,-1650] :255; yavin → `yavin` r 240 at [1250,-150,1500] :321). 18 moons across the systems (grep `look: 'moon-'`), each `{ look, r (1.4–4), orbit (84–260), speed (.004–.012), tilt, phase }`, e.g. tatooine 3 moons (:153-155), hoth 3, bespin 1, coruscant 2, naboo 2, kashyyyk 1, mandalore 2, lothal 2, sorgan 2. Body radii: tatooine 40, hoth 36, endor 30, yavin4 26, bespin 110, dagobah 28, mustafar 28, coruscant 46, naboo 34, kashyyyk 38, kamino 32, geonosis 34, scarif 32, nevarro 30, mandalore 32, lothal 34, sorgan 30 (all in map units; the ship is 0.26 long; `fitSystem` grows a planet wider than its biggest ship, systems.js:30). Only ONE system is built at a time (`enter(sys)` disposes the last, galaxy/scene.js:404-412).

### 4.2 How a body is made (bodies.js:268-424): entirely PROCEDURAL, no texture files
- `LOOKS` (bodies.js:45-204): 23 hand-authored looks in 7 `FAMILIES` (:30-38): desert (tatooine, geonosis, mandalore), ice (hoth), lush (endor, yavin4, kashyyyk, dagobah, naboo, lothal, sorgan, scarif, kamino), city (coruscant), lava (mustafar, nevarro), gas (endor-giant, yavin, bespin), moon (moon-grey, moon-ice, moon-dust, moon-rust). Each look = `pal` (≤8 colour slots → `uPal[8]`), `p` (≤8 params → `uP0`,`uP1` Vector4s), `flags` (#defines: CRATERS, SCARS, SWAMP, ISLANDS, RIVERS, STORMS…), `bump`, optional `clouds {cover, sharp, drift, scale, color}` (→ `uCloud`), `atmo` (→ the shared `createAtmosphere` shell), `shield` (Scarif), `detail` [flat, steep] scan roles.
- One `ShaderMaterial` per body: `surfaceFrag(family, slots)` (bodyShaders.js:740) joins NOISE + SURFACE_HEAD + CLOUDS + ATMO + the family's GLSL + DETAIL + SURFACE_MAIN. 3D value noise with analytic derivatives on the object-space unit sphere; `octs(f) = clamp(log2(0.45/(gFoot·f)) + uNearOct, 1, uMaxOct + uNearOct)` (:66) — octave count by the pixel's footprint; relief is a normal tilt from the noise gradient (the sphere stays smooth for collisions). Clouds, the atmosphere's inscatter and up to 2 suns are in the same pass (:692-735).
- Geometry: `SEG = { big:[128,96], small:[64,48], moon:[64,48] }`, doubled at ultra (`segmentsFor`, :229-230). MAX_OCT small 5 / big 9 / ultra 11 (:231); `defines.FBM_OCT = 11 + 4` at ultra (:313).
- Near detail from orbit: `nearOctaves({tier, pxTall})` (:241) → 2 extra octaves on high, 4 on ultra, when the body is over NEAR_PX = 300 px tall; eased at NEAR_EASE 0.1 octave/frame in `surface.onBeforeRender` (:335-344). `nearRelief` (bodyShaders.js:652) adds a fine grain in that band.
- DETAIL scans: `detailScans(L)` (:212) picks two roles from `public/cc0/galaxy/<role>/{color,normal,arm}.webp` (1024² each; 23 roles, 13 MB total, index.json credits Poly Haven CC0), loaded via `loadScan(id, { xl: tier==='ultra' })`. `coreFiles` (lib/three/core.js:39-41) asks for `-xl.ktx2/.webp` only where index.json has `xl`: NO role has one today, so ultra wears the 1K set. Tiled at TILE 0.45 world units (bodies.js:214). Not on small, not on low (:317).
- Atmosphere: `createAtmosphere` with the body's `shared` uniforms (same sun & air as the ground), segments [96,64] ([48,32] moon/small), steps 7 (14 at ultra) (:354). Shield sphere at 1.12 r for Scarif (:362-370).
- `update(t)` (:380-388): uTime, uCenter, uRot from the world matrix; `setSuns`, `setDetail(k)` (:400-402: uMaxOct = 4 + (maxOct−4)·k) — scene.js:1844-1848 drives `detail` from `post.sharpness` (0 when `capDetail`) so a struggling frame rate lowers every body's octave cap.
- world.js (:166-212): the planet spins at SPIN (`frac((t·SPIN)/TAU)·TAU`), the parent at 0.6×, each moon orbits on its `holder` (tilt) and its solid's `at` is rewritten per frame; every body's `update(t % 3600)` per frame. `setDetail` fans out to every body (:907-909).
- No THREE.LOD, no impostor: a system's bodies are always drawn at full shader cost while the system is loaded; the far gas giant is the same shader at r 240–260.
- Measured (lab/baseline/surface-high.json, the landed surfaces, not orbit): tatooine 76 calls / 819k tris / 100 textures / 186 programs / 18.6 MB GLB; endor 234 / 3.35M / 75 / 129 / 12.7 MB (over the high row's 3M); naboo 352 calls / 20.8 MB. lab/universe/baseline/high.json (1280×720): overview 150 calls / 1.20M tris; middleearth-limb 69 / 440k; rickmorty 57 / 216k; caribbean 58 / 278k; gaming 58 / 196k; landing-middleearth 92 / 260k. The `middleearth`, `breakingbad` and `office` 2.4-radii poses the plan added (poses.js:33-35) are NOT in that baseline file.

### 4.3 The gate on the universe map (galaxy/gateway.js, 245 lines)
The Star Wars "planet" is `buildGateway(r)`: STARS = 7000 (2600 small) Points in a spiral DISC 2.7 gate-radii wide, tilted [0.52,0,0.18], turning at 0.018 rad/s, systems marked from names.js SYSTEM_MARKS, and a camera-facing ring with a star tunnel. The sphere stays, invisible (planets.js:241).

### 4.4 The dive and the landing (travel.js, 64 lines)
`planDive(ship, r)` (:46-50): from the ship's distance d0 straight down the radial to `d1 = min(d0, r × 1.08)`; `diveAt(dive, age)` (:53-59) eases with k³ over DIVE = 1.4 s, nose on the planet; scene.js:1903 adds `34 × k²` degrees of FOV; `prefetchSurface()` (:42) imports `./surface/scene` and `./surface/module` while still flying; `surfaceProps(system, …)` (:23-40) carries system id, hero, loadout, found/done lists and `effects` (who holds the world) to the surface. Nothing of the body's `look`, palette or atmosphere crosses over: the surface is built from `sites/*.js` by system id.

## 5. The galaxy worlds' surfaces (galaxy/surface/)

A landed world's ground, sky and biome are NOT derived from systems.js or bodies.js. `sites/index.js:72` `SITES = { ...desert, ...ice, ...forest, yavin, ...core, coruscant, ...edge, bespin, ...outer }` — one hand-authored site object per landable system id (17; 5,958 lines across sites/*.js), and `siteOf(id)` (:84) assembles it. Each site carries its own `sky` ({ zenith, horizon, below, haze, hazeColor, suns[{az, el, color, size, glow}], clouds, stars, bodies[] } — sky.js draws a dome from these; Tatooine's at desert.js:38-55 has two suns and two moon discs, authored by hand, not read from systems.js's `suns` or `moons`), `fog`, `light`, `ground` ({ detail: a scan role e.g. 'sand', detailLook, seed, wind, layers: [{type: swell|dunes|mesas|mountains…}] (terrain.js, pure heights), palette: { low, high, rock, accent, deep, hLow, hHigh, rockAt, accentCover, ripple, grain, mark } (ground.js shader by height and slope) }), `water`, `weather`, `places`, `scatter`, `life`, `quests`. systems.js contributes only `faction` (for the garrison, surface/scene.js:349) and the LANDABLE list; travel.js's `surfaceProps` contributes `effects`. So the orbital body's colours (bodies.js LOOKS.tatooine.pal) and the ground's colours (sites/desert.js palette) are two separate hand-picked sets that nothing keeps in agreement; likewise the orbit atmosphere's `air()` colour vs the site's `sky.zenith/horizon`. At ultra the ground is a `SPLAT` of scans (splat.js `splatOf(site)`, ground.js:99/142/276), terrain gets `relief` (terrain.js:41), water `FOAM_DETAIL` (water.js:256), all from `amountsFor({level, small})` (amounts.js:27) over `budget(level)`. Per-site ground scans are the same 1024² Poly Haven set the orbital bodies tile (`public/cc0/galaxy/`).


## 6. The specs and plans: status against the code

### 6.1 `docs/superpowers/specs/2026-10-06-planets-overhaul-design.md` (200 lines)
Despite its name it is about the GALAXY SURFACES' landmarks and props (sites/*.js, catalog/*.js, props/*.js), not planets as spheres. Its 12 checkpoints are a surface-asset ladder (Sketchfab → owner's Meshy → Meshy-from-reference → kit). Observed in code: `public/models/galaxy/surface/` holds 242 files, 35 of them `*.lod1.glb`, 146 MB; `surface/catalog/` has 18 files, 5 of which contain `made: 'meshy'` entries; 14 `solids: 'built'` entries; the placer wraps LOD1 via `surfaceLodUrl`/`wantsLod` (placer.js:335, 340, 414-415; `wantsLod` reads `detailLevel()`), so Engine changes 1–3 exist. Its per-world budget was replaced by lib/budgets.js (the spec says so, :115-121). Which of checkpoints 3–11 (per-world asset passes) are done is not recorded in this spec; the surface baseline shows every world under the 700-call ceiling but endor at 3.35M tris over the 3M row (lab/baseline/surface-high.json).

### 6.2 `docs/superpowers/specs/2026-10-07-planets-and-universe-upgrade-design.md` (99 lines) and its plan `plans/2026-10-07-planets-and-universe-upgrade.md` (225 lines)
Lane 1 (fandom planets): ALL DONE.
- Task 1 nearMaps: `nearMaps.js` (143) + test (199) exist with `wanted`, `evict`, `createNearMaps`; `swapMaps`/`mapsOf` in planetMaps.js; wired at scene.js:693 and :4874. (Handoff: PR #488.)
- Task 2 `-xl` KTX2: `mapFile(name,'ultra')` → `-xl.ktx2` for the 7 colour maps (planetMaps.js:50-54); seven `-xl.ktx2` files on disk (0.74–5.84 MB); planets.test.js:301-306 covers it. (PR #498.)
- Task 3 near geometry: `NEAR_SEG`, `nearSegments`, `nearGeometry` (planets.js:1212-1268). (PR #498.)
- Task 4 Breaking Bad: `breakingbad-geo.mjs` (178). (PR #504.) Task 5 Caribbean: `caribbean-geo.mjs` (188). (PR #506.) Task 6 Office: office.mjs rebaked (title a sixth, 8 folds, 12 cuts). (PR #508.) Task 7 Middle-earth: Harad ridges, Ephel Dúath, canopy, `-hq` normal ×2 (middleearth.mjs:317). (PR #509.)
- Task 8 evidence: poses `middleearth`, `breakingbad`, `office` at 2.4 (poses.js:33-35); HANDOFF-universe.md updated with measurements (+0 calls, +78–80k tris on high per pose, under the +40 / +0.35M budget). NOT done: those three poses are absent from `lab/universe/baseline/high.json` (only middleearth-limb, rickmorty, gaming, caribbean, landing-middleearth are there), so the baseline was not regenerated.
Lane 2: 
- Task 1 (`claude/universe-ship-pace`): no branch of that name remains locally or on origin (`git branch -r | grep -ci pace` = 0) and no commit mentions it; the handoff doesn't record it. Status UNKNOWN from the code (either merged under another name or abandoned).
- Task 2 galaxy bodies sharp from orbit: DONE (`nearOctaves` bodies.js:241, `uNearOct` in `octs`, `nearRelief` bodyShaders.js:652).
- Task 3 minefield + escort: DONE (`minefield.js` 158 + test, `escort.js` 64 + test, director.js EVENTS :87 and the comments :33-38).
- Task 4 eclipse + riftExit: DONE (`eclipse.js` 110 + test; `riftExit(fromId, rand, sector, saw)` nav.js:254; scene.js:3643 passes `where.sun` through `canEclipse`).
Lane 3 (landings match the maps): DONE. `landings/biomes.js` (158) with `classify`, `uvOf`, `biomeAt`, `towardLand`, `sampleMap` (:26-131) + test (232); `biomes:` on 6 planets in landings.js (middleearth, breakingbad, rickmorty, travel, caribbean, invincible); footScene.js:1811-1952 samples the `-sm` map, `towardLand`, sets `S.biome`; the `?spot=lat,lon` DEV query at footScene.js:1824-1828. Handoff item 4 marked done.

### 6.3 `docs/superpowers/plans/2026-10-07-ultra-planets.md` (106 lines, Lane B of the quality-modes spec)
- Task 1 budgets: DONE (`src/lib/budgets.js`, `budgets.test.js` 43 lines).
- Task 2 amounts: DONE (`surface/amounts.js` 62 + test 68, `amountsFor` :27).
- Task 3 terrain relief: DONE (`makeRaw(ground, { relief })` terrain.js:41-45).
- Task 4 splat: DONE (`surface/splat.js` 45 + test; `SPLAT` define in ground.js:142/178/238/276).
- Task 5 the 8192 `-xl` scan set: CODE DONE (`coreFiles(role,{xl})` core.js:39-41 + core.test.js 161; `scripts/galaxy-textures.mjs --ultra` :13-25), DATA NOT MADE: `public/cc0/galaxy/index.json` has no `xl` on any of its 23 roles and no `*-xl.*` file exists; ultra wears the 1K scans (the plan's "until it's made" fallback, galaxy-textures.mjs:25).
- Task 6 seat: DONE (`surface/seat.js` 18 + test).
- Task 7 water: DONE (`FOAM_DETAIL` water.js:256-350).
- Task 8 sky/atmo/bodies at ultra: DONE (`stepsFor` atmosphere.js:139-140; `segmentsFor` bodies.js:230; `nearOctaves` ultra = 4; `createSky(site, { clouds })` sky.js header).
- Task 9 universe planets at 8192: CODE DONE (`NEAR_SEG.ultra = [320,200]` planets.js:1212; `K8`/`nearSet` with `-8k.ktx2 → -xl → -hq` planetMaps.js:58-77; `sphere.mjs` `-8k` path :161-193 with `PLANETS_8K`; `build-universe-textures.py --ultra` :242-253), DATA NOT MADE: `k8.json` is `[]`, no `*-8k.ktx2` on disk (the plan/handoff say they're baked on the owner's machine and are "too big to keep in the repository").
- Task 10 evidence: DONE in part: `docs/superpowers/evidence/ultra-planets/` holds `<world>-{feet,ground,landing}-{high,ultra}.webp` for dagobah, endor (and more, listing cut at 12) + README; `lab/baseline/` has only `surface-high.json` and `surface-mid.json` — no `surface-ultra.json`, no `surface-low.json`.

## 7. Weaknesses, as observed in the code

1. **Four texture pipelines for one directory.** `scripts/planets/sphere.mjs` (fandom bakers), `scripts/build-universe-textures.py` (Earth, sun, sky, plates, hull, paper — Python/Pillow), `scripts/build-cybertron-planet.mjs` (its own noise, its own `save`, 975 lines), `scripts/build-invincible-planet.mjs` (its own, 314 lines) all write `public/textures/universe/`, with three JS `save()`s and one Python `save()`, three noise libraries (sphere.mjs's Perlin, Cybertron's, Invincible's) and inconsistent size suffixes: fandoms ship `-xl/-hq/''/-sm` (4096/2048/1024/512), Cybertron ships `''`=2048 and `-sm`=1024 with no `-hq`/`-xl`, Invincible ships `-hq` for its normal only, Earth ships `''`=2048 and `-hq`=4096 WebP (no KTX2). planetMaps.js:30-37 hand-encodes every exception in MAPS. A fifth Earth pipeline (`scripts/build-earth.mjs` → `public/textures/earth/`, 8192 WebP from NASA) exists for the Earth world page and shares nothing with the map's `earth.webp`.
2. **Orphan files shipped.** `starwars.webp` (79 KB), `starwars-hq.webp` (310 KB), `starwars-sm.webp` (18 KB), `starwars-glow.webp`, `alderaan.webp` (32 KB) are written by build-universe-textures.py (:294-295, :310) and referenced by nothing in `src/` (the Star Wars place is a gate since gateway.js; the galaxy's Alderaan is `body: null`). `sky.webp`/`sky-hq.webp` (534 KB + 1.2 MB) are the Earth page's, kept in the universe dir.
3. **Large textures loaded up front.** `loadTextures` (planetMaps.js:95-114) loads EVERY one of the 47 entries of MAPS for the whole map at start (measured from the files on disk: low/mid 1.91 MB, high 4.05 MB, ultra 7.79 MB of WebP, 47 files each) → all decoded and uploaded before the first frame; among them on high: transformers 519 KB (2048²), transformers-normal 545 KB (2048), transformers-glow-sm 430 KB, sky-glow 525 KB (4096×2048), earth 148 + earth-night 83 + earth-clouds 141, middleearth-clouds 204, rickmorty 137, music 116 … plus all the `-rough`, `-glow`, `-night` maps for planets the ship may never approach. On ultra it loads the `-hq` of everything (earth-hq 4096×2048 500 KB, earth-night-hq 348 KB, earth-clouds-hq 545 KB, middleearth-clouds-hq 583 KB, breakingbad-normal-hq 531 KB, invincible-normal-hq 699 KB …) — the handoff's "Left 1" says ultra "still loads the -hq set up front for every planet". GPU memory: each 2048×1024 RGBA map is 8 MB raw (+33% mips); a 4096×2048 is 32 MB; the `-xl` KTX2 (UASTC) stays compressed. The Cybertron page separately loads the 1.16 MB lossless `transformers-glow.webp`.
4. **No real LOD on the universe map.** Every one of the 28 bodies is a 64×40 sphere (2,560 quads) + a halo sphere of the same count + (with air) a 96×64 shell, drawn whenever within 24,000 units and in the frustum, regardless of screen size; a planet 3 px tall still pays its body, shell (an 8-step march per fragment) and clouds. The only size-based cut is `live` (ticks skipped under 2 px, scene.js:4872). The far-impostor switch (farPlaces.js) is a single hard distance (24,000 − 2,000 fade), not a screen-size rule. lib/detail's `lodScale`/`seg`/`texScale` and budgets.js's `lod1` are unused by planets.js; segment counts and NEAR_SEG are hard-coded per tier.
5. **Per-frame CPU cost that scales with the whole map, not the view.** scene.js:4601-4610 rotates 28 sun vectors and sorts 28 distances every frame; :4867-4873 does `getWorldPosition` + frustum test ×28; nearMaps.js:140-151 does `getWorldPosition` + sort ×(planets with near sets) every frame; `p.light()` ×28 (:4645). Invincible rewrites 150 instance matrices (:1002-1013) plus 6 chunk transforms, 2 flyer halos and rings each frame it is live; Marvel 12 transforms; Breaking Bad 5 + 4 `getWorldQuaternion`/`invert` per frame; the RM moons' props (fireworks, flocks, serpents) each their own ticks.
6. **Spheres without surface detail.** Music and Marvel are a single colour map (no normal, no rough, no night, no clouds; planets.js:265, :419); gaming is a 256×128 pixel map by design; the 6 core stations are untextured except 512² `plates`/`hull` tiles; the 10 RM moons are pure fragment-shader fbm (no maps). Earth has no normal map (only rough/night/clouds, :1152-1159). Caribbean's normal has no `-sm`. The universe's `groundHooks` "detail" is one 256² fbm tile (planetShading.js:120-138) tiled 96×48 on every planet alike, fading in over 3 → 1.3 radii. The galaxy's bodies tile 1024² scans at TILE 0.45 world units.
7. **Shader-variant and program count.** Each planet material composes 2–4 onBeforeCompile hooks (airGlow + groundHooks + keyHook + celShade/ditherShade/cybertronSkin) with their own cache keys; planets.test.js:221 holds the map's own variants to ≤ 24. The galaxy's `surfaceFrag` is specialised per family and flags; its baseline shows 69–186 programs per landed world (surface-high.json). The atmosphere shell is compiled per `steps` and `flat` (atmosphere.js:158).
8. **Hand-painted things that are tables waiting to be data.** (a) `BUILDERS` in planets.js: 12 fandom builders of 50–260 lines each repeat the same shape — build a MeshStandardMaterial from `T[id]`, `T[id+'-normal']`, `-rough`, `-glow`, `-night`; make a cloud sphere at r×1.008–1.025 with 64×40/44×28 segments and spin it at 0.05–0.09 rad/s; make an `orbit()` at r×1.5–1.55 for the model slot — differing only in constants (middleearth :300-330, breakingbad :476-491, caribbean :826-845, invincible :898-920, travel :1152-1168, rickmorty :637-660). The cloud-layer name and alpha flag are a separate hand table in planetShading.js:111 (CLOUDS) and the night map is set by hand in each builder (`p.night = T[...]`), while `mapsOf(id)` (planetMaps.js:84-87) already derives the names from the id. (b) The galaxy's `LOOKS` (bodies.js) and the surface `sites/*.js` sky/ground palettes are two independent hand-authored colour sets per world, with systems.js's `suns`/`moons` re-authored by hand as `sky.suns`/`sky.bodies` in each site (desert.js:46-55). (c) The 6 station builders in stations.js (1,539 lines) and the 10 RM-moon GLSL surfaces (rmWorldsGlsl.js, 482 lines) are code per place. (d) `MAPS` in planetMaps.js:30-37 hand-lists which sizes each of 47 names comes in instead of reading the directory or a bake manifest; planets.test.js:28-41 then checks the files exist.
9. **Dead/unused paths.** `mount`'s `s.skin` branch (planets.js:1386-1391) is never reached (no slot sets `skin`); `loadModel` (planets.js:1404) is exported but `loadModels` uses a fresh `gltfLoader()` instead of the gltfCache, so the two Star Destroyer escorts parse `star-destroyer.glb` (473 KB) through the loader's own cache rather than the page-wide one; `nearSet`'s K8 branch and `sphere.mjs`'s `-8k` path have no data to act on; `coreFiles`' `xl` branch likewise.
10. **Missing baselines/evidence.** `lab/universe/baseline/high.json` lacks the three 2.4-radii poses the plan added; `lab/baseline/` lacks `surface-ultra.json` and `surface-low.json`; endor's landed surface (3.35M tris) is over the high row's 3M ceiling.
11. **Scale asymmetry between the two maps.** Universe fandom planets are r 47–59 map units with 1024–4096 equirect maps; the galaxy's bodies are r 26–110 drawn by per-pixel fbm with 1024² scans; the two atmosphere systems share `lib/three/atmosphere.js` but the universe planets march 8 steps at high (planets.js:1235 `stepsFor(tier, 8)`) and the galaxy's 7 (bodies.js:354), with different segment counts ([96,64] both for the big shell, but the universe halo at [64,40]).


---

# 2. World generation and props

Repo: the site repo. All paths below are relative to it. Line numbers from the working tree today.

## 1. Galaxy surface props: the builder contract (src/components/galaxy/surface/props/)

- `props/index.js` (34 lines) merges per-group PROPS and SCATTER tables: `PROPS = {...generic, ...desert, ...ice, ...forest, ...core, ...edge, ...bespin, ...outer, ...inside, ...insideCore, ...insideForest, ...insideBespin, ...echo}`; `SCATTER = {...genericScatter, ...desertScatter, ...iceScatter, ...forestScatter, ...coreScatter, ...edgeScatter, ...bespinScatter, ...outerScatter}` (index.js:32-33).
- Builder contract (index.js:1-18): `(kit, opts) → { object, solids?, floors?, update?(t,dt), signal? }`. object is a THREE object in metres standing on y=0 facing +z. `solids` are `{circle:[x,z,r]}` or `{box:[x,z,hw,hd,yaw]}` with optional `top`, `base`, `tag`. `floors` are what you can stand on.
- Scatter builder contract (index.js:15-17): `(kit, opts) → { parts: [{geometry, material, local?}], radius }` — "drawn instanced", radius = footprint at scale 1 (null = walk through).
- File sizes: core.js 1811, forest.js 2006, edge.js 1344, ice.js 1050, desert.js 351, bespin.js 339, generic.js 202, outer.js 115, echo.js 165, inside*.js 184-344.
- **All props are procedural geometry built in code**, not GLBs. E.g. generic.js `atat` (generic.js:33-110) uses `loft`/`trap8` from `universe/trafficKit` + BoxGeometry/CylinderGeometry; `pad`, `crates`, `lamp`, `fire` (generic.js:135-181) all assemble `part(geometry, {at, rot, scale, color, to})` lists and call `k.build(parts, {name})`. The SCATTER entries `rock` and `stones` (generic.js:186-200) use `rockGeometry(seed, {sharp, detail, flat})` from kit.js and return `{parts:[{geometry: k.geometry([...]), material: k.mats[to]}], radius}`.
- core.js header (core.js:1-7) says these props are "what a world places when there's no model of it (yet, catalog/core.js), and what there's no model of at all" — i.e. the catalog (GLB models) takes precedence when a model exists; code-built props are the fallback.

### kit.js (src/components/galaxy/surface/kit.js, 571 lines) — the material/bake kit
- `createKit({seed, scans, wind, load})` (kit.js:359) returns `{ mats, own, rand, geometry, ready, wind, moving(root), tick(dt), build(parts,{shadows,name}), dispose() }` (kit.js:496-544).
- `build(parts)` groups parts by material role (`p.to`), bakes each group into ONE mesh per material via `bake(list, density)` from `universe/trafficKit` with vertex colours (kit.js:518-534). So a code-built prop = one Group with ~1 Mesh per material (paint/metal/stone/...).
- `geometry(parts)` = `bake(parts, density)` → a single geometry "for instancing" (kit.js:492-493).
- Material roster (kit.js:383-421): paint, metal, stone, rock, redrock, mossrock, adobe, wood, concrete, tiles, deck, cloth, bark, leaf, needles, foliage, fronds, broadleaf, crown, strands, blades, dark, glass, glow. All `MeshStandardMaterial` with `vertexColors: true`.
- Foliage cards: `needles`, `foliage`, `fronds`, `broadleaf`, `strands` are DoubleSide alpha-cut (`alphaTest: 0.3, alphaToCoverage: true`) materials with canvas-painted textures: `needleTexture` (kit.js:55-113), `leafTexture` (kit.js:120-157, "Bruno Simon's foliage card, forty-odd pointed leaves filling a disc"), `frondTexture` (kit.js:162-199), `broadLeafTexture` (kit.js:204-258), `strandTexture` (kit.js:263-299). `keepCoverage(t, cut=0.3)` (kit.js:303-339) hand-builds mip levels with alpha scaled to preserve coverage.
- Foliage lighting/wind wiring (kit.js:427-446): for needles/foliage/crown (kind 'tree') and fronds/broadleaf/strands/blades/cloth (kind 'shrub'), applies `wrapLighting(mat, {wrap:0.45, backScatter:0.35})`, `faceless(mat)` for DoubleSide, and `wind(mat, {kind, time: windTime, dir})` from `src/lib/three/foliage.js`. One shared `windTime` uniform (kit.js:422), ticked by `kit.tick(dt)` (kit.js:513).
- Scans (kit.js:321-357): Poly Haven CC0 scans from `public/cc0/galaxy/index.json`, roles in `KIT_ROLES`/`LOOKS`; `ready` promise dresses materials triplanar via `wear()` from `lib/three/core` once loaded (kit.js:460-489). "Twins" (kit.js:450-451) = UV-dressed clones for moving things.
- Shapes: `rockGeometry(seed, {sharp, detail, flat})` (kit.js:549-566) = deformed IcosahedronGeometry(0.5, detail) with 5 random bumps; `dome`, `ring`, `cyl`, `box` helpers (kit.js:569-571).

## 2. placer.js (src/components/galaxy/surface/placer.js, 598 lines) — how a galaxy world puts things down

- Header (placer.js:1-7): a kind with a model (catalog/*.js, Sketchfab/Meshy) is that model; one without (or whose GLB fails to load) is built in code (props/*.js); neither → left out. "Scattered kinds (rocks by the hundred, palms, huts) are drawn instanced: one draw for all of them."
- `createPlacer({parent, kit, world, warm, shadowOnly, seated})` → `{ group, put(spec), scatter(kind, items, {opts, solid, model}), ready, update(t,dt,you), setZone, signal, dispose }` (placer.js:203-437).
- `loadGlb(url)` (placer.js:46-58): page-wide `Map` cache url → promise via `gltfLoader()`; `hasModel(kind) = Boolean(SURFACE_MODELS[kind])` (placer.js:59); `usesModel(spec)` (placer.js:63) honours `model:false` and a catalog `styles` list.
- `loadModel(kind, url)` (placer.js:94-132): loads the GLB, applies catalog `turn` (squared), `look`, `tint`, and `detail` scan via `withDetail` (detail.js) on all tiers but low.
- `put(spec)` (placer.js:290-370): spec `{kind, at:[x,z], yaw, pitch, roll, scale, y, sink, abs, solid, model, opts, zone, url, fog}`. Ground height from `world.heightAt(x,z)` (placer.js:214-218). Three branches: `spec.url` (any site GLB, scaled to `metres`), `usesModel(spec)` (catalog GLB clone; `cloneModel` uses SkeletonUtils clone for skinned), else `build(spec, at)` → PROPS builder. Built props are cached per `kind|JSON(opts)` and `.clone()`d unless they have `update`/`signal` (placer.js:235-245).
- LOD for single placed models (placer.js:349-360): if `wantsLod(kind, level)`, wraps in `THREE.LOD` (`withLod`, placer.js:482-497), fetches `<kind>.lod1.glb` after the full one and adds it at `lodDistance(radius) = max(60, 3*radius)` (placer.js:480).
- `scatter(kind, items, opts)` (placer.js:372-444): builds a `Matrix4` per item (compose position/yaw/scale with optional `stretch`), then `instanceParts(parts)` makes **one `THREE.InstancedMesh` per part** (geometry+material), `setMatrixAt` for every item, `computeBoundingSphere`, adds to group (placer.js:383-395). If the kind has a GLB model, the GLB's meshes become the parts (each non-skinned mesh's geometry/material with its world matrix as `local`) (placer.js:409-421); otherwise `SCATTER[kind](kit, opts)` or `partsOf(PROPS[kind](...))` (placer.js:441-443). Solids: `world.solids.circle` per item when `radius` (placer.js:404).
- Scattered-model LOD (placer.js:422-440): when `wantsLod`, loads lod1 GLB, makes a second set of InstancedMeshes, and `splits.push({full, low, xs, zs, r: lodDistance(radius)})`. `fillSplit` (placer.js:466-470) copies near items' matrices into the full meshes and far items' into the low meshes via `splitNear` (near.js), re-done whenever `you` moves > `NEAR.step = 8` m (placer.js:38, 417-424).
- Shadow stand-ins (placer.js:446-460): with `shadowOnly`, scattered meshes don't cast; a `casterFor` InstancedMesh (MeshBasicMaterial colorWrite:false, count ≤ `NEAR.max=512`) holds only instances within `NEAR.r=70` m of you (`nearInstances`, near.js).
- `seated` (ultra only, amounts.js) seats each thing on the lowest ground under its footprint via `seatY` (seat.js) (placer.js:222-232).
- Zones (placer.js:207-211, 418-422): `rooms` group hidden until `setZone(inZone)`.

## 3. catalog/ (src/components/galaxy/surface/catalog/) — the GLB model registry

- `index.js:24-25`: `GROUPS = {common, desert, ice, forest, core, clonewars, edge, people, outer, rebels, three, made, fill, library, audit, battlefront}` merged into `SURFACE_MODELS` keyed by kind (later groups override earlier: "battlefront last"). URLs: `/models/galaxy/surface/<kind>.glb`, `<kind>.lod1.glb`, `<kind>.ultra.glb` (index.js:26-31). `wantsLod(kind, level) = Boolean(models[kind]?.lod) && budget(level).lod1` (index.js:35).
- Counts (regex `^  name: {` per file): audit 20, battlefront 10, clonewars 2, common 6, core 8, desert 22, edge 2, fill 25, forest 9, ice 7, library 43, made 18, outer 25, people 11, rebels 6, three 1 → **215 catalog entries**. `public/models/galaxy/surface/` holds 242 files, 35 of them `*.lod1.glb`.
- Entry fields (library.js:1-10, made.js:1-17): `uid` (Sketchfab), `made:'meshy'`, `as`, `metres`, `along`, `yaw`, `up`, `turn`, `tris`, `tex`, `rig`, `anim`, `lod`, `hero`, `solids:'built'`, `styles`, `detail` (scan role), `detailLook`, `tint`, `look`, `recolor`, `cluster` (common.js:4-5: `[kind,x,z,yaw,y]` members, e.g. `crates` cluster of impcrate/longcrate/barrels/cooler/rustycrate at common.js:19).
- Vegetation GLBs in the catalog are few: `palm` (edge.js:11, lod:true, 3000 tris, "six hundred palms are most of Scarif's triangles"), `sorganfern` (outer.js:24, 900 tris), `lavarock` (outer.js:26), `dagocypress` (rebels.js:11, 22 m, 7500 tris), `yavintree` (rebels.js:14, 30 m, 6000 tris), wroshyr (made.js:43, Meshy). On disk: palm.glb, palm.lod1.glb, sorganfern.glb, yavintree.glb, lavarock.glb (no dagocypress.glb file found by the grep `tree|pine|palm|fern|bush|rock|grass`).
- Everything else vegetal (redwood, spruce, fern, gnarltree, reeds, wroshyr fallback, karst, jungletree, plant, bush, fungus, log) is code-built in props/forest.js.

## 4. props/forest.js (2006 lines) — how galaxy trees are built

- `instanced(k, parts)` (forest.js:22-26): groups parts by material role → `[{geometry: k.geometry(list), material: k.mats[to]}]`, one geometry per material.
- Trunks: `trunkGeometry(profile, {seg, furrow, ridges, lean, seed})` (forest.js:49) = lathe-like profile with furrows.
- Needle sprays: `spray(len, w, at, a, d, twist, color, shade)` (forest.js:176-185) = a `PlaneGeometry(w, len, 1, 2)` card with `coneNormals`, material `needles`, `uv:true`.
- `canopy(at, s, {flat, color, seed, density, to})` (forest.js:195-229, exported; used by core.js too): "as Bruno Simon builds his bushes": a solid `crown`-material core (`blob` icosahedron with `spherifyNormals`) plus n = clamp(8..90, 2.2πR²/(cs²·0.5)·density) `PlaneGeometry(size,size)` cards (cs ≤ 3 m) placed on the ellipsoid skin, `lookAt(face)` outward, normals spherified to the clump's ellipsoid, per-vertex `shade` darkening deeper/lower. **These are card-clump crowns, not SDF, not billboards, not GLB crowns.**
- Species: `redwoodParts` (h=68, 7 clumps of 6 sprays + buttress roots + `lo` variant, forest.js:231-283), `spruceParts` (h=22, 12 whorls × 9 sprays + a dark ConeGeometry `crown` core, forest.js:285-319), `fernParts` (9 `frond()` cards with `upNormals`, forest.js:321-334), `gnarlParts` (350), `reedParts` (414), `wroshyrParts` (h=74, 442), `karstParts` (488), `jungleParts` (h=36, 522), `plantParts`, `bushParts`, `fungusParts`, `logParts` (557-596).
- `SCATTER` (forest.js:598-611): redwood, spruce, fern, gnarltree, reeds, wroshyr, karst, jungletree, plant, bush, fungus, log → each `{parts: instanced(k, xParts(o).parts), radius}`. `TREES` (forest.js:615-650) are the same species as single `PROPS` builders with `k.build` + circle solids.
- Non-tree props in the file: lightshafts (728), ewokhut (740), ewoktree (776), ropebridge, drums, atst (889), bunker, shieldgen, lambda, pyre, traps, wookieehouse, kachirho (H=230, 1276), catamaran, yodapod, barricade, atrt, atap, yodahut, yoda, ghostben, xwingbog, cavetree, floatrocks, dragonsnake, bogwing, hangarfloor, massassi (1845), ruin, lookout, parked. `PROPS = {...TREES, ...ENDOR, ...KASHYYYK, ...DAGOBAH, ...YAVIN}` (forest.js:2003).

## 5. Galaxy sites: how each world places props (hand lists + seeded scatter)

- A site is pure data (sites/index.js:1-69). Relevant keys: `things` (placer specs at world positions), `places[].things` (relative to a place), `scatter: [{kind, n, within:[r0,r1], scale:[a,b], solid?, opts?, flat?, clear?, dry?, above?, sink?, stretch?, model?}]` (sites/index.js:24-25). `SITES = {...desert, ...ice, ...forest, yavin, ...core, coruscant, ...edge, bespin, ...outer}` (sites/index.js:72). sites/*.js total 5958 lines.
- **Hand-placed**: `things` arrays are literal coordinate lists, e.g. Endor's `{ kind: 'redwood', at: [-22, 24], model: false, opts: { seed: 31, h: 64, r: 2.4 } }` (sites/forest.js:260-261); the Ewok village is 5 trees computed from polar `{a, d, h}` rows (sites/forest.js:17-41). `grove(seed, n, r0, r1, kinds, [lo,hi])` in sites/stand.js:7-16 is an LCG-seeded ring helper that returns placer specs "placed one by one rather than scattered, so a stand off the screen isn't drawn".
- **Seeded scatter** (scene.js:263-287): one `rng(site.ground.seed ?? 1)` for the site; for each scatter row, rejection-sample up to `s.n * amounts.scatter` items in the annulus `[r0, r1]` (uniform-by-area `sqrt(r0²+r·(r1²−r0²))`), skipping any within `v.r + (s.clear ?? 4)` of `avoid` (every place's flat/r and the landing spot r=30), any with `grid.normalAt(x,z)[1] < s.flat`, any under water level + `s.above ?? 0.2`; yaw random, `scale = lo + (hi-lo)·r()^1.6`, `sink = s.sink ?? 0.1`, optional `stretch`. Then `placer.scatter(s.kind, items, {opts, solid, model})` (scene.js:338). Endor example rows (sites/forest.js:279-301): redwood n=320/150/100 within [60,280], 300/140 `lo:true` within [280,640], 200 within [600,1300] non-solid; spruce 160; fern 1100+1500+160+500+700; log 70; bush 380+260; plant 320; fungus 240.
- `amounts.scatter` (amounts.js:52, 36): `budget(level).props` on big screens, 0.6 on small screens. `SCATTER[kind].canopy` (a radius) paints tree shade into the ground map (scene.js:292).
- Scatter placement happens all at once at scene build, over the whole walkable square (HALF=640 m, terrain.js:22) — **no chunking, no streaming**; the only distance logic is placer's near/far instance split and shadow stand-ins (section 2).
- Other SCATTER kinds besides forest's: generic `rock`, `stones`; core `nabootree` (trunk + 5 `canopy` lobes, core.js:1756-1781), `spire` (Geonosis), `buoy`, `grass` tuft (core.js:1783-1810); edge `lavacrack`, `tuft`, `palm` (edge.js:1226-1270); ice `iceblock`, `snowdrift`, `snowrock` (ice.js:1023-1050); bespin `cloudblock`, `cloudcity`; outer `glassshard`; desert `SCATTER = {}` (desert.js:351).

## 6. Galaxy terrain, ground, ground paint, grass

### terrain.js (180 lines) — pure heightfield
- `HALF = 640`, `REACH = 590`, `FAR = 9000` (terrain.js:21-24). Layers come from `src/lib/land/layers.js` (`LAYERS`, terrain.js:16, 28): `makeRaw(ground, {relief})` sums `LAYERS[l.type](x, z, l, seed + i*101)` over `ground.layers` plus optional `fineRelief` (2 fbm octaves at 12 m / 6 m, heights 0.26/0.1, ultra only) (terrain.js:36-50). `levelled(raw, flats)` eases flats in with smoothstep (terrain.js:54-73), `dug(height, pits)` cuts pits (terrain.js:79-95), `makeHeight = dug(levelled(makeRaw(...)))` (terrain.js:97).
- `gridLines(n, grow)` (terrain.js:103-115): uniform cells over ±HALF, then geometrically growing (`grow`) rings out to ±FAR. `heightGrid(height, {n=256, grow=1.08})` (terrain.js:120-179) samples a `Float32Array(w*w)` and gives `heightAt(x,z)` (barycentric on the drawn triangles) and `normalAt`. amounts.js: HIGH n=256 grow=1.08, SMALL n=160 grow=1.13, ultra n = 256·budget.terrain (amounts.js:28-29, 50).

### ground.js (364 lines)
- `groundMesh(grid, material)` (ground.js:288-323): ONE `BufferGeometry` for the whole world from the heightGrid's lines × heights (w×w vertices, Uint32 index, `computeVertexNormals`), `receiveShadow`, name 'ground'. No chunks.
- `groundMaterial(site, {small, map, splat})` (ground.js:50-286): a `MeshStandardMaterial` with a custom program (`customProgramCacheKey 'galaxy-ground[:map][:splat]'`, ground.js:282) that colours by height/slope palette (`uLow/uHigh/uRock/uAccent/uDeep/uHeights`), noise from `noiseTex.js`, `uMarks` canvas texture for footprints (`createMarks`, ground.js:326-362), a detail scan (`uScan`, `uScanN`) triplanar up close (`gTri`, ground.js:147) fading between `near`/`far`, and at ultra a 4-layer splat (`splatOf(site)`, ground.js:99, 183-194). Reads the ground map via `GROUND_GLSL` from lib/three/groundmap (ground.js:41).

### groundPaint.js (119 lines) and surface/grass.js (74 lines)
- `groundPainter(site, grid, {shade})` → `{paint(x,z,out) → grass, height(x,z)}` (groundPaint.js:66-118): re-states the ground shader's palette rule in JS (low/high by height with wandering noise, accent patches, deep hollows, rock strata on slope > rockAt, wet band), paints grass colour (`site.grass.mid`/`dry`) by `coverAt`, and darkens by `SHADE = {colour: 0.75, grass: 0.4}` under tree crowns bucketed in 40 m cells (groundPaint.js:32-52). `mapAreaOf()` = ±HALF square (groundPaint.js:37).
- `coverAt(grid, site, x, z)` (grass.js:24-50): 0 on steep ground (`slope: [0.84, 0.94]` normal-y fade), under water + `above`, within `places[].flat.r + 6` and 26-32 m of the landing spot; drifts via 3-octave fbm at `scale` (default 90 m) thresholded by `cover` (default 0.7). `coverMap` (grass.js:55-74) bakes RGBA (cover, tall, dry) at 256 texels over the square.
- scene.js:339-345: `createGrass({ground: groundMap, wind, side: amounts.grass.side, size, height: site.grass.h[1], width, root: 0.35})` from lib/three/grass only where `pieces.grass`.

## 7. src/lib/three/ — the shared foliage/grass/wind/LOD/ground libraries

### foliage.js (224 lines) — the foliage trick: normal transfer + wrap lighting + vertex wind. NOT SDF, NOT billboards, NOT GLB crowns.
- Header (foliage.js:1-10): "a canopy built of a dozen faceted blobs lights as a dozen flat things… the same blobs with their normals pointing out from the middle of the whole crown light as one soft volume" — the Blender hull-normal-transfer trick done at build time. Cites docs/research/2026-10-06-ground-grass-foliage-techniques.md §2 and §7.
- Exports: `spherifyNormals(geometry, {centre, radii, keep=0.25})` (foliage.js:31-58) rewrites each vertex normal toward the ellipsoid's outward direction, keeping `keep` of the original; `liftNormals(geometry, {keep})` (foliage.js:63-75) turns normals toward +Y (for blades/ferns); `wrapShader`/`wrapLighting(material, {wrap=0.5, backScatter=0.25})` (foliage.js:85-128) patches `lights_lambert_pars_fragment`/`lights_physical_pars_fragment` to add `(dotNLWrap − dotNL)` diffuse plus a back-scatter term; `facelessShader`/`faceless(material)` (foliage.js:136-158) removes `normal *= faceDirection` so a double-sided card is lit by its (crown) normal on both faces; `WIND = {tree: {height 7, strength 0.16, trunkHz 0.45, leafHz 2.6, leaf 0.025}, shrub: {height 1.3, strength 0.05, trunkHz 0.8, leafHz 3.4, leaf 0.012}}` (foliage.js:165-168); `windShader`/`wind(material, {kind, time, dir})` (foliage.js:175-224) injects after `begin_vertex` a Crysis-style bend by height² plus a flutter, phase from `instanceMatrix[3].xyz` under `USE_INSTANCING` (so it works on InstancedMesh).
- All hooks go through `onBeforeCompile` + `customProgramCacheKey` suffixes (`|wrap`, `|faceless`, `|wind`).

### grass.js (lib/three, 161 lines) — Bruno Simon's grass
- `createGrass({ground, wind, side=280, size=40, height, width, root, seed})` (grass.js:116-160): ONE `BufferGeometry` of side² triangles (78,400 at 280) with an `aBlade` attribute (centre xz + rand) (grass.js:32-60); a `MeshLambertMaterial` whose vertex shader wraps the patch round `uGrassCentre` with `mod()` so it follows the player, samples `groundGrass/groundHeight/groundColour` from the ground map (GROUND_GLSL) and `windOffset` from wind.js's WIND_GLSL, turns each blade to face the camera, and fades at the patch edge (grass.js:62-95). `frustumCulled = false`, no shadows. `update(centre)` sets the centre each frame.
- Not instanced: it's one static mesh with per-blade attributes; the blades are relocated in the shader.

### wind.js (115 lines)
- `createWind({strength=0.45, angle})` (wind.js:74) → `{uniforms, glsl, update(dt), set, sway(material,{strength,height}), dispose}`; `WIND_GLSL` (wind.js:20-31): `windOffset(xz)` = two lookups in a tiling noise texture scrolling along `uWindDir` (Bruno's Wind.js). Used by lib/three/grass. The galaxy kit's plants use foliage.js's `wind()` instead but share the same angle (kit.js:425, scene.js:331).

### lod.js (84 lines) — instanced LOD bands (used by Middle-earth? see §9)
- `lodBand(dist, bands, prev, hysteresis)` (lod.js:20-28) and `createLodSet({items, levels, bands, hysteresis=0.1, every=0.5, move=20})` (lod.js:38-83): each level is one `InstancedMesh` holding the matrices (and optional colours) of all items; `sort(camera)` recomputes each item's band by XZ distance and copies the right items' matrices into each level's mesh (`DynamicDrawUsage`), re-sorting every 0.5 s or after 20 m of camera movement. Header: "THREE.LOD is one object per thing, which a few hundred trees can't afford". Cites ground-grass-foliage-design.md §5.

### rock.js (168 lines) — universe-map rock material
- `rng(seed)` (rock.js:25), `rock(seed, {craters})` lumpy geometry ~1 unit (rock.js:39), `ROCK_RELIEF` (rock.js:118), `rockMaterial({tier, scale})` (rock.js:120), `rockHook(mat, ...)` (rock.js:124): 3D-noise pitted MeshStandardMaterial for the belt/meteors. Not used by the galaxy surface (which uses kit.js's `rockGeometry`).

### groundmap.js (172 lines)
- `paintGround({area, size, paint})` → RGBA bytes (groundmap.js:34); `GROUND_GLSL` (groundmap.js:53) declares `groundColour(xz)`, `groundGrass(xz)`, `groundHeight(xz)`; `groundPaintShader` (66); `createGroundMap({area, size=512, heightSize, paint, height})` → `{texture, heightTexture, uniforms, glsl, colourAt, grassAt, heightAt, paint(material), dispose}` (groundmap.js:87). After Bruno's Terrain.js.

### groundwork.js (388 lines), grounding.js (525 lines)
- `groundWorld({renderer, scene, floor, area, sun, casters, skip, movers, shade, bounce, height, tier, matcap, lights, auto, follow, clip, keepShadows})` → `{bake(), rebake(sun), update(), track(), untrack(), blobs, mask, stats, dispose()}` (groundwork.js:105): bakes a floor shadow/sky mask on the GPU (grounding-bake.js), turns the shadow pass off, applies `floorShadow`, `bounce`, `standIn`, `createBlobShadows` from grounding.js (grounding.js:223, 260, 374, 461). Bruno's folio-2019 look.

### house.js (381 lines) — API only
- `LOOK` (house.js:41), `houseShader(shader, {fog, ground}, chunks)` (125), `createHouse(look)` → `{uniforms, toneMapping, exposure, material(opts), adopt(root), set(look), light({sun, hemi}), sky({...}), ground(map, {height, strength, offset})}` (150), `shadowFor(mood)` (272), `houseOn({renderer, scene, sun, hemi, ambient, env, ...})` (292), `envLevel` (343), `shadowFromEnv` (374). One look across every material: coloured shade, sky-coloured fog, ground-map bounce.

## 8. Middle-earth: the Shire and Edoras — hand-coded kits, hand-placed layouts, seeded rings

### Shire (src/components/middleearth/shire/)
- `props.js` (3378 lines) is NOT a coordinate list: it is a procedural **builder kit**. Header (props.js:1-16): "The Shire, made in code… A building's fixed parts are merged into one mesh per material". Helpers: `rng` mulberry32 (props.js:32), `tf`, `B`, `cyl`, `ball`, `lathe`, `tube(points, r0, r1, {gnarl, seed})` (216), `blob(r, {detail, amp, freq, seed})` (240), `boxUV` (91), `fillColor` (130), `prep` (148), `parts()` builder with `.add(material, geo, {p, r, s})`, `.at(p, r, fn)`, `.build(parent)` merging per material via `mergeGeometries` (169-205). Canvas textures painted in code: grass, thatch, planks, plaster, leaves, bark, slate, signs (430-700).
- `createShireKit(renderer)` (props.js:3226) returns `{mats, paint, setNight, K, hobbitHole, bagEnd, mill, barn, greenDragon, bridge, partyTree, oaks, rootTree, pavilion, cart, sheep, dog, blackRider, scarecrow, beehive, wheelbarrow, barrel, hayBale, mailbox, bench, lampPost, mushroom, signpost, washingLine, fencePost, fenceRail, fenceRails, hedge, crops, flower, ...}` (props.js:3339-3374). Re-exported helpers at props.js:3378 are reused by Edoras.
- **Trees**: `partyTree(K)` (props.js:1962) = `tube` trunk/limbs + `crownBlobs(centres, ...)` (props.js:1950-1957) = deformed `blob()` icosahedra scaled `[1, 0.86, 1]` with `foliageColor` vertex colours — solid blob crowns, no cards. `oaks()` (props.js:2031-2068) returns 3 variants `{trunk, crown, height}` each `mergeAll`ed; `rootTree(K)` (2070).
- **Only GLB** in the walkable Shire: Bag End's door leaf, `/models/sketchfab/bag-end-door.glb` via `loadDoorLeaf(radius)` (models.js:1-8, 18-20).
- **Placement** (scene.js): hand-placed landmarks from constants in rules.js (`HOLES`, `MILL`, `BRIDGE`, `PARTY_TREE`, `BARN`, `ROOT_TREE`, `PAVILION`, `INN`, `BAG_END`): `for (const h of HOLES) placed(kit.hobbitHole(...), h.x, h.z)` (scene.js:181), `placed(kit.partyTree(), PARTY_TREE.x, PARTY_TREE.z, ...)` (187); lamp posts from a literal list `[[-20,-2],[0,-6],[16,-6],[32,-2],[12.9,9],[12.9,22]]` (scene.js:232). **Trees are seeded**: `TREES` in rules.js:176-188 = up to 64 rejection-sampled spots (`seeded(23)`, r 12..WORLD.radius−10, `clearOf(x,z,4)`, min 5.5 m apart, 3 kinds); scene.js:235-254 instances each oak variant's trunk and crown with `instances(geometry, material, list, {shadow: tier === 'high'})` (ground.js:345-366: one `THREE.InstancedMesh` per geometry, `setMatrixAt`, optional `setColorAt`). A far rim of 260·`many` `farTree()` blobs (towns/bake.js:47-66: cylinder + 3 icosahedra, vertex colours) is instanced with `MeshLambertMaterial` (scene.js:256-262). Hedges instanced per 2.4 m segment along `HEDGES` (scene.js:265-279). Crowns sway via `wind.sway(mats.crown, {strength 0.5, height 6})` (scene.js:248).
- Ground (shire/ground.js:1-5): "one mesh, shaped by ./rules.js's height and painted by its ground map… the flowers on top, instanced so thousands cost one draw. The grass is lib/three/grass's". Materials wear the core kit's scans by role (`SHIRE_CORE`, dress.js:6-19).

### Edoras (src/components/middleearth/towns/edoras/)
- `props.js` (3085 lines): same procedural-kit pattern; imports `boxUV, fillColor, lathe, rng, tf, tube` from shire/props (props.js:25). Header (props.js:15-19): "Fixed parts are merged one mesh per material; the stockade's logs, the grass and the flowers are instanced." Zero `.glb`/`gltf` references. `createEdorasKit(renderer, {tier})` (props.js:2964). InstancedMesh sites: stockade logs (props.js:2233), flowers (2707), tufts (2730), flower glow (2751); scene.js:217-219 (an instanced crowd + banners).
- `layout.js` (209 lines, pure): `hillHeight(x,z)` analytic mound + fbm plain + ridged White Mountains past z=420 (layout.js:36-46); `HOUSES` = 70 seeded rejection-sampled halls (`seeded(907)`, layout.js:77-99); `BARROWS` 16 (101), `PEAKS` 6 (191); hand constants `MEDUSELD`, `ROAD`, `STAIR`, `TERRACE`, `HALL`, `PILLARS`, `TABLES`, colliders. So Edoras = analytic terrain + seeded house ring + hand-placed landmarks.

## 9. Rick and Morty dimensions (src/components/rickmorty/world/dimensions/, 5508 lines)

- Data: `DESTINATIONS = [...ROWS1, ...ROWS2, ...ROWS3]` (destinations.js:25); each row is `place(i, {id, name, note, kind: 'room'|'outdoor', deep, wide, sky, ceiling, people, extras, spots, solids, tasks, say, done, ...})` (place.js:40) with everything in metres `dx, dz` from the place's middle; the place's column is x∈[−470, −330], z = 900 + 100·i (place.js:5-9). rows1.js is literal hand-written data (rows1.js:6-30). 10 of them are `PLANETS` reached from the universe map (destinations.js:32).
- Builders: one `build<Id>(kit)` per file, lazy-imported from a table in world/scene.js (`froopyland: () => import('./dimensions/froopyland').then(m => m.buildFroopyland)`, scene.js:106). `stage(kit, id, {ground, groundTile, floor, wall, ...})` (stage.js:27) makes the room shell (`makeRoom` from interiors/shell), an outdoor sky dome (`makeSky(560, d.sky)`) + a `tiledPaint` canvas ground, the portal home, and fetches the Meshy cast people (stage.js:1-13). Returns `{R, d, A, cx, cz, P(dx,dz), figure, people, done(light, update), hunt, calm}`.
- Geometry is a fluent primitive kit: `R.frame(x, z, yaw).ball(...).cyl(...).box(...).glow(...).decal(...)` — e.g. Froopyland's 5 candy hills and 5 lollipop trees are literal `[dx, dz, r, colour]` lists (froopyland.js:18-33). **No GLB scenery, no scatter, no instancing, no terrain heightfield**: flat painted ground, hand-listed primitives. People/creatures are Meshy GLBs (`RIGGED` from portal/meshyCast, stage.js:19).

## 10. Chunk streaming today: src/runtime/chunkGrid.js + src/components/minecraft/stream.js

- `createChunkGrid({size, radius, inFlight=8, hysteresis=1})` (chunkGrid.js:38) is pure bookkeeping: `cellOf(x,z)`, `cells(x,z,{radius,heading})` (cached ordering nearest-first, then along heading, chunkGrid.js:24-37), `update({x,z,heading,radius}) → {ask, drop, cancel}` (chunkGrid.js:62-86: cancels in-flight cells outside radius, drops loaded cells outside radius+hysteresis, asks up to `inFlight − flying.size` new cells), `began/done/failed(key, gen)`, `unload`, `reset(gen)` with a generation counter so late answers are refused (chunkGrid.js:88-120).
- Minecraft's `createStream({workers, chunks})` (stream.js:25): `createChunkGrid({size: 16, radius: 10, inFlight: 8, hysteresis: 2})` (stream.js:26); `load()` (stream.js:51-80) runs `grid.update` with the player's position and `g.renderDistance`, cancels stale, and for each `ask` sends `workers.request('minecraft', {type:'chunk', key, seed, cx, cz, priority, edits})`; on answer checks `grid.done(k, gen)` then `addChunk` and `chunks.setMesh(cx, cz, s, msg.meshes[s])` per 16 sections. "No three.js: the scene's chunks come in as { setMesh, drop }" (stream.js:9-10).
- Other runtime chunk services on main: `src/runtime/origin.js` (floating origin), `src/runtime/workers.js` (pool). Only Minecraft uses `createChunkGrid` today (see §13 grep).

## 11. Natural worlds: what was promised vs what exists (PR #622 merged = Phase 1)

Spec: docs/superpowers/specs/2026-10-08-natural-worlds-design.md (150 lines). Plan: docs/superpowers/plans/2026-10-08-natural-worlds.md (220 lines). Hand-off: docs/superpowers/HANDOFF-worlds.md. Git: `0f12f12e Merge pull request #622 from tilakpatell/claude/natural-worlds-p1`; commits `3f3a5963 feat(physics): his car, his numbers`, `89de998a docs(natural-worlds): Phase 1's previews, status…`.

Phase table (spec:131-140): 1 `lib/land` + `lib/physics` (pure, tested, nothing drawn) → `claude/natural-worlds-p1`; 2 `lib/three` pieces (landmap, land, river, tracks, puffs, leaves, windLines, view; grass takes tracks) → `-p2`; 3 Expanse surface world `/universe/expanse/:seed` on rt.chunks/workers/origin → `-p3` (needs PR #600, which IS merged: `283bcee0 Merge pull request #600 … infinite-worlds-p3`); 4 adoption (on foot, gen3d buggy, fandom landings' rivers, galaxy surfaces' tracks, Albuquerque on lib/physics) one PR per world.

**Phase 1 — DONE (on main):**
- `src/lib/land/`: `layers.js` (79 lines; `LAYERS` moved here from galaxy terrain.js, `fieldAt(spec,x,z)`; galaxy/surface/terrain.js:16 imports it back), `spec.js` (123 lines; `hashSeed`, `LAND_TYPES` = temperate/desert/ice/ocean/volcanic, `landSpec(seed, type)` → `{seed, type, sea, relief, rivers:{perRegion,width,depth,meander}, palette, kit:{perCell, kinds}, gravity, wind, sun}`; kit per type: temperate `{perCell: 24, kinds: ['tree','rock','crate']}`, desert 8 rock/crate, ice 10, ocean 16 tree/rock/crate, volcanic 8 — spec.js:45-99), `rivers.js` (321 lines; `REGION=1024`, `STEP=8`, `regionRivers`, `riversNear`, `clipRivers`, `nearestRiverPoint`, `lakeAt`; rivers fill and spill lakes up to 8), `cell.js` (297 lines; `CELL=64`, `N=65`, `MASK=128`, `MAX_DEPTH=3`, `makeCell(spec,cx,cz) → {cx, cz, heights Float32Array(65²), water Float32Array(65²) NaN where dry, mask Uint8Array(128²×4) R paving/G grass/B depth/A flow, props [{kind,x,y,z,yaw,scale}]}`, `cellMesh(heights,{step})` with 2 m skirts, `heightAt`, `waterAt`). Props per cell: seeded Poisson disc, spacing `max(2, 64/sqrt(perCell·2))`, kind random from `kinds`, trees only on grass, rocks on slopes/banks, crates near flat (cell.js:182-215).
- `src/lib/physics/`: `world.js`, `heightfield.js`, `props.js`, `vehicle.js`, `catch.js` (+ tests); `package.json:35` has `"@dimforge/rapier3d-compat": "0.21.0"`. `scripts/land-preview.mjs` exists; previews in docs/superpowers/previews/.
- HANDOFF status table (HANDOFF-worlds.md:42-47) lists only design and Phase 1 rows. Phase 1 findings recorded (HANDOFF:49): Rapier heightfield is row-major transposed, splits `(ix+1,iz)–(ix,iz+1)`; car holds ~5.5 m/s.
- Importers of `lib/land` today: galaxy/surface/terrain.js, lib/physics/props.js, lib/physics/heightfield.js — **no renderer or world consumes a cell yet.**

**Phase 2 — NOT STARTED:** none of `src/lib/three/{puffs,tracks,river,landmap,land,leaves,windLines,view}.js` exist (checked 2026-10-08). Plan checkboxes for Tasks 2.1-2.5 and 3.1-3.5 are all `- [ ]` (plan:118-214). What Phase 2 promised for trees (spec:36, 85): `puffs.js` = Bruno's 80 cards of 0.8 m in a unit sphere, radius `1 − rng³`, normals `lerp(card, sphere, 0.85)` via foliage.js's `spherifyNormals`, cards facing the fixed camera direction, cut-out an SDF blob texture made once in a canvas, rotated by `|windOffset|·2.2`, two-tone `mix(a,b,smoothstep(0,1,n·l))`, one InstancedMesh per species, trunks a separate InstancedMesh, LOD through lib/three/lod.js. Water: `river.js` with his shallows (contour bands, 9-tap blur on high/ultra). `tracks.js` ring-buffer ribbons into a 512² top-down target over 40 m. `view.js` chase camera FOV 25 with the "optimal area".
**Phase 3 — NOT STARTED:** no `src/components/expanse/` directory; `expanse` appears in src only in `src/components/worlds/registry.js` (+test) as a registry key/`worldUrl`.

## 12. Infinite-worlds status (docs/superpowers/specs/2026-10-07-infinite-worlds-design.md, 123 lines; plan 330 lines)

Sub-projects (spec:99-111): 0 smooth worlds; 1 install packs; 2 store+registry; 3 chunk services (`runtime/chunkGrid.js`, `workers.js`, `origin.js`, Minecraft on them); 4 the Expanse (sectors generated, drawn, laned); 5 landing on the Expanse (generated surfaces: "flat fbm cells of 64 m, props scattered per cell"); 6 worlds for others (Nostr). Merged on main: `cd39d689 #606 infinite-worlds-p1`, `3859b60d #589 infinite-worlds-p2`, `e0eb0127 #601 infinite-worlds-p2-saves`, `283bcee0 #600 infinite-worlds-p3`. **Phases 4 and 5 are not merged**: no `expanse` directory under src/components/universe (only `sector*.js` for the existing map and `worlds/registry.js` keying a planet kind). `src/runtime/origin.js` (`ORIGIN_CELL = 50000`, origin.js:13) and `workers.js` exist. Natural-worlds Phase 3 is defined as superseding infinite-worlds Phase 5 (natural-worlds plan:211).

## 13. The two 2026-10-06 foliage specs: what landed

- **docs/superpowers/specs/2026-10-06-foliage-landscape-design.md** (status "final, owner decisions taken"; plan `2026-10-06-foliage-landscape.md`, 88 unchecked `- [ ]`, 0 checked). Its §2.0 file plan (spec:255-289) names `lib/three/leaves.js`, `surface/cover.js`, `surface/plan.js`, `surface/flora/{palette,materials,cards,patch,trees,under,far,shell}.js`, `placer.js` "pooled InstancedMeshes per kind; createLodSet rings; 3-way GLB split". **Of those, none of flora/, plan.js, cover.js, leaves.js exist.** What does exist from its F1/F2 scope: `surface/skyfog.js` (122 lines, sky-coloured fog), `surface/grass.js` (74 lines, coverAt/coverMap), `lib/three/foliage.js` (`faceless`, `wrapLighting`, `wind`), the kit's card materials (kit.js). Git: `d2a69113 Galaxy surface: Bruno Simon's foliage and grass, the films' ground`, `a0ff1443 Forest worlds: broad-leaved canopies in leaves, foliage that stays thick far off, Yavin's jungle as the film's`.
- **docs/superpowers/specs/2026-10-06-ground-grass-foliage-design.md** (status "researched and specified… owner has not reviewed"): §1 foliage.js, §2 grass.js, §3 `surface.js` `hexTile`, §4 `contactShadow.js`, §5 LOD ("three InstancedMeshes per kind, near/mid/card… hysteresis 0.1, re-sorted every 0.5 s or 20 m", citing the Shire's `chunker` and the HQ `impostorForest`), §6 tiers; the example world is Albuquerque. Landed: `lib/three/foliage.js`, `lib/three/grass.js`, `lib/three/lod.js` (exactly §5's bands/hysteresis/0.5 s/20 m). Not landed: `contactShadow.js` (absent), `hexTile` in surface.js (no match). **`createLodSet` has zero callers** outside lod.js itself (grep). Albuquerque's `world/life.js`/`scene.js` use InstancedMesh (5 and 4 sites) but not lod.js.
- Impostor precedent that does exist: `src/components/avengers/hq/kit/impostor.js` — `bakeImpostor(renderer, object, {size=512, environment, lightDir,...})` (impostor.js:10) renders a model to a texture once; `impostorForest(imp, points, {fog})` (impostor.js:47) draws camera-facing cards; used by avengers/hq/kit/world.js only.

## 14. Quaternius packs (PR #624 `claude/quaternius-assets`, merged a06d43ff) — where they are used today

- Doc: `docs/assets/quaternius.md`. Nine packs on the GitHub release `assets-quaternius` (~1.5 GB) and unpacked in repo `tilakpatell/tilakverse-assets`: `ual1`, `ual2` (animation libraries), `city` (235 MB), `street` (4), `furniture` (3), `space` (37), `farm` (7), `nature` (414 MB: birch, maple, pine, palm, dead trees, bushes, flowers, grass, rocks), `naturemega` (718 MB source: 5 of each of birch/cherry/pine/giant pine/twisted/dead/common, bushes, ferns, clover, flowers, grasses, wheat, mushrooms, rocks, rock paths, pebbles). The doc's "best for" column names the Shire, Lothlórien, Naboo, Yavin 4 for `nature`/`naturemega` and the R&M dimensions for `space`.
- Fetch: `scripts/assets-fetch.mjs` (`PACKS` table at assets-fetch.mjs:24-34; `node scripts/assets-fetch.mjs <pack>` → `lab/assets/<pack>/`, git-ignored; big packs in `.part-a/-b…` joined on fetch). `lab/` currently holds only `baseline`, `galaxy`, `universe` — no `lab/assets/` checkout in this clone.
- **In src, the only Quaternius use is animation clips**: `src/lib/three/clipLibrary.js:70-86+` maps ~45+ clips to `/games/meshy/ual-<name>.glb` baked by `scripts/ual-bake.mjs` (118 `ual-*.glb` files in public/games/meshy); `src/components/galaxy/pack.js:88` preloads `'/games/meshy/ual-*.glb'`; `surface/saberBody.js` uses `ual-saber.glb` (public/cc0/README.md:20); `scripts/preview/ualRetarget.js`, `scripts/meshy-actions.mjs` reference UAL. The grep for `quaternius|lab/assets|assets-fetch|naturemega|ual2|UAL` over src+scripts hits 205 lines in 18 files, all animation-related (clipLibrary, figureCalls, emote, office/people, rickmorty Portal3D/meshyCast, universe footScene tests, galaxy pack/scene/saberBody) plus the fetch/bake scripts. **No nature, city, space, furniture, farm or street GLB has been imported into public/models or referenced by any world.** `scripts/credits.mjs` has no Quaternius kit entry yet (doc says to add one when models go in). The only "birch" on disk is Sketchfab's `public/models/galaxy/surface/sorganbirch.glb` (catalog/outer.js:22).

## 15. Summary tables

### How each world places props
| World | Landmarks | Vegetation / filler | Source of geometry |
|---|---|---|---|
| Galaxy surfaces (17 sites, sites/*.js 5958 lines) | hand `things` lists with literal `at:[x,z]` (+ `grove()` seeded rings, stand.js) | `scatter` rows → rejection-sampled annuli at scene build (scene.js:263-287), `placer.scatter` → one InstancedMesh per part | catalog GLB (215 kinds, Sketchfab/Meshy) if present, else code-built props/*.js (~8,000 lines); trees mostly code-built (forest.js) except palm, sorganbirch/fir/fern, dagocypress, yavintree (yavin site uses built `jungletree` instead) |
| Shire | hand constants in rules.js (HOLES, MILL, BRIDGE…), `placed(kit.x(), x, z)` in scene.js | `TREES` 64 seeded spots (rules.js:176) → `instances()` per oak variant; 260 far rim `farTree` blobs; hedges per segment; flowers instanced (ground.js) | all code (props.js 3378 lines) except bag-end-door.glb |
| Edoras | layout.js constants; `HOUSES` 70 seeded (layout.js:77) | stockade logs, tufts, flowers instanced (props.js:2233-2751); no trees | all code (props.js 3085 lines, 0 GLB) |
| Rick & Morty dimensions | `place()` rows with literal `dx,dz`; builder per file using `R.frame().ball().cyl().box()` | none scattered; hand lists (froopyland.js:18-33) | primitives; people are Meshy GLBs |
| Minecraft | n/a | chunk-streamed voxels via `createChunkGrid` + worker | voxel mesher |
| Expanse (natural worlds) | — | `lib/land/cell.js` Poisson props per 64 m cell (data only) | nothing drawn yet |

### InstancedMesh
- `grep -rn InstancedMesh src` (non-test): **263 lines in 112 files** construct one. Heaviest: dotmatrix/scene.js 9, avengers/widow 7, avengers/tesseract 7, rickmorty arcade 6, Portal3D 6, invincible life 5, albuquerque life 5, edoras props 4, galaxy props/edge 4, universe planets/footScene/deepspace 3 each. Galaxy surface's main site is `placer.js:384` (every scatter part) plus `casterFor` (placer.js:449) and `lod` split meshes (placer.js:432).
- Shared helpers: galaxy `placer.scatter` (placer.js:372); Shire `instances()` (shire/ground.js:345); lib/three `createLodSet` (unused); lib/three `createBlobShadows` (grounding.js:461, one instanced draw).

### LOD today
- Galaxy single models: `THREE.LOD` with `<kind>.lod1.glb` at `max(60, 3·radius)` m, only for catalog entries with `lod:true` (35 lod1 files) and when `budget(level).lod1` (placer.js:349-360, 478-497).
- Galaxy scattered models: two InstancedMesh sets (full/low) re-split by distance every 8 m walked (`fillSplit`, placer.js:466-470); code-built scatter has no LOD except a `lo:true` builder option used for far rings (e.g. redwood within [280,640] and [600,1300], sites/forest.js:282-284; jungletree [640,1400], sites/yavin.js:211).
- Shadows: scattered things cast only via near stand-ins within 70 m, ≤512 instances (placer.js:38, 446-460; near.js).
- Shire: a far-rim `farTree` ring (no bands); Edoras: a `Q.around` quality knob on log segments (props.js:2233). `lib/three/lod.js` bands exist but nothing calls them.

### Foliage drawing per world
- Galaxy: code-built card clumps — `canopy()` (forest.js:195) = `crown` core + 8-90 `PlaneGeometry` leaf cards with spherified normals, `needles` sprays on conifers, `fronds` cards on ferns; materials alpha-cut `alphaToCoverage`, `wrapLighting`, `faceless`, vertex `wind` (kit.js:427-446). Textures painted in canvas (kit.js:55-299) with coverage-preserving mips. Ground map darkens under crowns (`SCATTER[kind].canopy` radii: jungletree 10, redwood 7, wroshyr 10, gnarltree 6, forest.js:1995-2001). Naboo: `nabootree` = 5 canopy lobes (core.js:1756). Yavin: built `jungletree` ×710 near + 180 far, plus 2300 ferns/plants (sites/yavin.js:209-218). Scarif: Sketchfab `palm` GLB ×600 instanced with lod1 (sites/edge.js:529). Sorgan: Sketchfab `sorganfir` ×60 scattered + `grove`s of sorganbirch/fir (sites/outer.js:110-129). Grass: lib/three/grass (one 78,400-triangle mesh wrapped round the player, reading the ground map).
- Shire: solid deformed-icosahedron blob crowns with vertex colours (`crownBlobs`, props.js:1950), `wind.sway` on `mats.crown`; grass from lib/three/grass + instanced flowers.
- Edoras: no trees; instanced tufts/flowers.
- Rick & Morty: spheres/cylinders (`ball`/`cyl`) hand-placed.
- Avengers HQ: Poly Haven fir GLBs via `impostorForest` cards; Avengers compound lawn: its own instanced blade grass (avengers/world/grass.js).

### Pure/testable pieces a new generator could reuse (as they exist)
- `src/lib/land/`: `landSpec`, `LAYERS`/`fieldAt`, `regionRivers`/`riversNear`, `makeCell` (heights, water, mask, props), `cellMesh`, `heightAt`, `waterAt`.
- `src/runtime/chunkGrid.js` (`createChunkGrid`), `src/runtime/workers.js`, `src/runtime/origin.js`; the Minecraft `stream.js` loop as the pattern.
- `src/lib/three/`: `foliage.js` (spherifyNormals, liftNormals, wrapLighting, faceless, wind), `grass.js` (createGrass over a ground map), `wind.js` (createWind, WIND_GLSL), `groundmap.js` (createGroundMap, GROUND_GLSL), `lod.js` (createLodSet, unused), `house.js`, `groundwork.js`/`grounding.js`.
- Galaxy: `kit.js` (`createKit`, materials, `rockGeometry`, `bake` via trafficKit), `placer.js` (`createPlacer.scatter`, near/far split, shadow stand-ins), `props/forest.js` (`canopy`, species builders, `SCATTER`), `terrain.js` (`heightGrid`), `groundPaint.js`, `surface/grass.js` (`coverAt`).


---

# 3. Rigging and animation

Read-only inventory of what exists. Paths relative to the site repo.

## 1. Asset inventory: public/games/meshy/

- `ls public/games/meshy | wc -l` = **641 entries** (639 .glb files + 2 dirs `crowd/`, `rollout/`), `du -sh` = **102M**.
- Per-character files: `<name>.glb` (full skinned body, 0.4–1.1 MB each, e.g. rick.glb 1,018,176 B, rickprime.glb 1,091,876 B, councilrick-a.glb 450,280 B) plus per-character `-idle`, `-walk`, `-run` (and sometimes `-sit`) clip GLBs (~25–68 KB each). ~100 named characters (rick, morty, summer, beth, jerry, birdperson, squanchy, meeseeks, …).
- Clip-only GLBs (skeleton+animation, no mesh) in four families:
  - `act-*.glb`: **113 files, 7.7 MB** (Meshy animation library: act-bow, act-dance.gangnam, act-die.gut, act-sit.doze, act-look.around … 23–174 KB each).
  - `ual-*.glb`: **118 files, 2,321,200 B (2.5 MB)**, 10.8–39.9 KB each — Quaternius Universal Animation Library clips retargeted onto the Meshy skeleton by scripts/ual-bake.mjs. Full list: aim.pistol(.down/.up), arms.folded, backflip, bandage, cast(.double)(.enter)/cast.idle, celebrate, chop, counter.{angry,give,idle,show}, crawl(.idle), cross, crouch(.fwd.left/.fwd.right/.walk), cry, dance.ual, die/die.2, drive, eat, farm.{harvest,plant,water}, fish.{cast,idle,reel}, hit.{chest,head,knock,shoulder.l,shoulder.r,stomach}, idle.calm, interact, jab, jog(.back/.back.left/.back.right/.fwd.left/.fwd.right/.left/.right), jump.{land,loop,start}, kipup, kneel.fix, lantern, lean.rail, lie.{down,up}, lifted(.fall/.land), melee.{combo,hook,knee}, mine, nod, open.chest, pickup(.kneel), push, reload, roll, saber, shake, shoot.pistol, sit.{enter,exit,ground,ground.enter,ground.exit,idle,idle2,idle3,nod,talk}, sprint, surprise, swim(.idle), sword.{a,b,c,block,dash,heavy,light.a,light.b,light.c}, talk, throw, tired, torch, turn.around, walk.{back.left,back.right,formal,fwd.left,fwd.right,left,right}, zombie.{bite,idle,scratch,walk}.
  - `clips-*.glb`: **13 files, 740 KB** (cheer, dance, drink, fall, happy, hit, punch, scared, shoot, shot, sitcross, taunt, wave; 33–103 KB).
  - `loco-{a,b,c}.glb` + `loco-{a,b,c}-{idle,walk,run}.glb`: 12 files, 2.9 MB (three loco bodies 824–926 KB + 9 clips).
- `crowd/`: 35 small crowd-variant bodies (astronautmorty … wizardrick). `rollout/`: bumblebee-car.glb, bumblebee-idle.glb.
- Non-humanoid GLBs present at top level: cromulon.glb, cronenberg.glb, cruiser.glb, garage.glb, pickle.glb, saucer.glb, snowball.glb (no per-character clip files for these).

## 2. The one skeleton: Meshy's 24-bone humanoid

Defined as data in `src/lib/three/meshyRig.fixture.js:24-49` (`MESHY_BONES`, measured from `public/models/galaxy/crew/luke.glb`, offsets in cm under an `Armature` group scaled 0.01 → metres, line 57). The 24 bones, parent in parentheses:

```
Hips(root) → Spine02 → Spine01 → Spine → neck → Head → head_end
                                    Head → headfront
                            Spine → LeftShoulder → LeftArm → LeftForeArm → LeftHand
                            Spine → RightShoulder → RightArm → RightForeArm → RightHand
Hips → LeftUpLeg → LeftLeg → LeftFoot → LeftToeBase
Hips → RightUpLeg → RightLeg → RightFoot → RightToeBase
```
Rest pose is an A-pose (fixture.js:4). Hips rest at y=95.5 cm (luke); `RICK_HIPS = 90.233` (clipLibrary.js:37) is the rig-unit hips height of Rick's clips, used as the retarget baseline. No finger, jaw, eye or twist bones. `head_end` and `headfront` are leaf/marker bones.

- `rig.js:67` `MESHY` = the 12 names whose presence marks a figure as "on Meshy's skeleton": Hips, Spine02, Spine01, Spine, neck, Head, LeftArm, RightArm, LeftUpLeg, RightUpLeg, LeftToeBase, RightToeBase (`rig.js:283` `const meshy = MESHY.every(n => names.has(n))`). Only then can a figure play the shared library (`has()` at rig.js:420-422; `figureCalls.js:74` `fromLibrary = library && …`).
- `animator.js:66-69` `MESHY_MASKS`: `upper` = Spine02, Spine01, Spine, neck, Head, LeftShoulder, LeftArm, LeftForeArm, LeftHand, RightShoulder, RightArm, RightForeArm, RightHand (13); `lower` = Hips, LeftUpLeg, LeftLeg, LeftFoot, LeftToeBase, RightUpLeg, RightLeg, RightFoot, RightToeBase (9). Layers sample only quaternion tracks on masked bones (`partsOf`, animator.js:301-313).
- `locomotion.js:103` `NAMES` the 16 bones locomotion turns; `rig` true iff Hips + both UpLeg/Leg/Foot exist (line 123).
- Other skeletons tolerated by `rig.js` ROLES table (rig.js:116-134): Mixamo (`mixamorig:` prefix stripped), Unreal (`upperarm_l`, `thigh_l`, `pelvis`), Character Creator (`CC_Base_`), High Moon Transformers (`l_arm02_shoulder_xb`…), Transformers Prime (`humerus.l`, `thigh.l`). These get posed by role only (procedural `pose()`), and may run their OWN clips through the animator via `MESHY_ROLE` aliasing (rig.js:68-85, 284-286), but cannot borrow the Meshy library. Per the header comment rig.js:1-4 the HD figures come "rigged four different ways (Meshy's, Mixamo's, an Unreal one, Character Creator's)".

## 3. How a clip is applied

**One `THREE.AnimationMixer` per figure instance**, no sharing, no instanced skinning:
- `rig.js:235` `figure(template)` does `cloneSkinned(template.scene)` (SkeletonUtils.clone) per copy, clones every material (rig.js:258-262), and lazily builds `createAnimator(model, …)` on first `act/play/base/react` (`live()` rig.js:319-341).
- `animator.js:144` `const mixer = new THREE.AnimationMixer(model)`; actions via `mixer.clipAction` (line 152). Idle/walk/run all `.play()` at once, weights managed by hand so they sum to exactly 1 (`weigh()` animator.js:436-451; comment lines 2-4: "three.js fills a total under 1 with the bind pose").
- Base = locomotion blend (idle/walk/run) or a base state (sit.idle, crouch…) with `.enter/.exit` routing (`route()` animator.js:224-243). One `full` slot one-shot over it. `upper`/`lower` layers are NOT mixer actions: sampled through `track.createInterpolant()` and slerped onto masked bones after `mixer.update` (`lay()` animator.js:116-123, `after()` 614-626).
- Clip sharing: library files are fetched once per URL (`clipLibrary.js:305-318` `files` Map); `forFigure()` makes one retargeted copy per `${name}:${key}` where key = `rig${templateId}@${h}` (rig.js:337; clipLibrary.js:340-358), so all copies of one template share a clip copy, but each still has its own mixer + AnimationAction.
- Retarget (`clipLibrary.js:375-389`): copies only `*.quaternion` tracks and scales `Hips.position` by `hipsY/from`; all other position/scale tracks dropped. Heading fix: `heading()`/`faceForward()` (lines 395-421) rotate every hips quaternion about `up` so the clip's mean yaw matches the walk's (Meshy's idle stands turned sideways, rig.js:321-328).
- Stride measurement: `strideOf()` locomotion.js:52-97 plays the clip through 48 samples with `mixer.update(0)` watching toe bones; cached per `${clip.uuid}:${key}` in `strideCache` (line 117). Walk/run then have `timeScale = 0` and `action.time` set by ground-covered phase (locomotion.js:205-213) so feet don't skate.
- Locomotion extras laid on after the mixer via `rotateWorld` (ik.js:75-83): hips yaw toward strafe heading with spine counter-turn 0.45/0.33/0.22 (locomotion.js:236-240), lean, pitch, air tuck, landing crouch, hurt flinch (lines 244-283).
- `rig.js` `pose()` on an animated figure = a layer slerped over the mixer result at next tick (rig.js:379-391 `lay()`, 505-513); on a figure with no clips, straight onto bones (`place()` rig.js:346-368 uses `aim()` per SEGMENT).
- `ik.js`: pure two-bone IK (`elbowFor`, `reach`), `aimBone`, `rotateWorld`, `palmFrame`, `spring`; used by universe/gunplay.js (header ik.js:4-5).
- `ragdoll.js`: no physics engine; damped angular springs per joint + gravity torque + decaying noise, `rotateWorld` applied over the clip pose each `step(dt)` (ragdoll.js:57-94). Caps swing at 1.35 rad.
- `gait.js`: for figures WITHOUT clips (toy figures, creatures, built people): `createGait({stride, cadence, seed}).step(dt, speed) → {phase, amount, run}`, plus `turn`, `breathe`, `sway` (statue bob/roll "until it's rigged", gait.js:23-28).

## 4. Per-frame animation budget rules (`src/lib/three/animBudget.js`)

- `createAnimBudget({ near = 12, far = 40, max = 64 })` (line 32). `rate(pos, camera, inView)`: not in view → **0**; distance² > far² → **0.25**; > near² → **0.5**; else if `full >= max` → **0.5**, otherwise count it and → **1** (lines 37-46). `frame()` resets the full-rate count once per rendered frame. First-asked-first-served, so callers ask nearest first.
- `budgetClock(seed)` (line 55): accumulates `dt` (clamped to `LONGEST = 0.1` s) and a phase `share += rate`, stepping only when share ≥ 1; golden-ratio seeded start so figures at one rate spread across frames. At rate 0 held time is dropped (no catch-up leap).
- Same scheme inside `animator.update(dt, {lodRate})` (animator.js:582-603) and `rig.tick(dt, {lodRate})` (rig.js:477-483): `st.share += clamp(lodRate,0,1)`, skip until ≥1, step by accumulated time. Header animBudget.js:4-5: "takes over from the Citadel's every-third-frame and actors.js's every-fourth throttles."
- Other clamps: animator `LONGEST=0.1` (line 71), fades `FADE=0.2`, `BASE_FADE=0.3`, chest look `CHEST=0.3` rad; `ragdoll` dt ≤ 0.05; `ik.spring` dt ≤ 0.05; gait dt ≤ 0.1.

## 5. UAL retarget: Quaternius rig bone names vs Meshy's (`scripts/ual-bake.mjs`, `scripts/preview/ualRetarget.js`)

Source: Quaternius Universal Animation Library, "a 53-bone Rigify rig named DEF-*" (ualRetarget.js:1-2), Godot GLB. Free pack at `scripts/preview/.ual/ual.glb` (git-ignored, 6.7 MB, ual-bake.mjs:37-40); paid packs at `lab/assets/ual1/Unreal-Godot/UAL1.glb` and `lab/assets/ual2/Unreal-Godot/UAL2.glb` (ual-bake.mjs:213), fetched via `scripts/assets-fetch.mjs ual1 ual2`.

`UAL_MAP` (ualRetarget.js:26-49), 22 of Meshy's 24 bones mapped (head_end, headfront unmapped):

| UAL (DEF-*) | Meshy |
|---|---|
| DEF-hips | Hips |
| DEF-spine001 | Spine02 |
| DEF-spine002 | Spine01 |
| DEF-spine003 | Spine |
| DEF-neck | neck |
| DEF-head | Head |
| DEF-shoulderL / R | LeftShoulder / RightShoulder |
| DEF-upper_armL / R | LeftArm / RightArm |
| DEF-forearmL / R | LeftForeArm / RightForeArm |
| DEF-handL / R | LeftHand / RightHand |
| DEF-thighL / R | LeftUpLeg / RightUpLeg |
| DEF-shinL / R | LeftLeg / RightLeg |
| DEF-footL / R | LeftFoot / RightFoot |
| DEF-toeL / R | LeftToeBase / RightToeBase |

Method (ualRetarget.js:6-14, 160-191, 194-248): world-space delta retarget. Each target bone gets the source bone's world rotation away from its rest (`face · Qs · Qs_rest⁻¹ · face⁻¹`), times an `align` swing that points the target's rest bone direction onto the source's (AIM table, lines 53-70; `setFromUnitVectors`), times the target's rest; converted to parent-local; quaternion hemisphere kept continuous. Hips position delta scaled by `hipsK` = ratio of hips-above-toes heights (line 190). Sampled at `FPS = 30` (ual-bake.mjs:60), LINEAR interpolation. The target is Luke's skeleton read straight from `luke.glb` nodes at rest (`restRig`, ual-bake.mjs:220-235).

Output: one GLB per clip, `public/games/meshy/ual-<name>.glb`, containing just the Armature node tree (no mesh), one animation named as `CLIPS` names it, extras `{ hips, source: "Quaternius UAL <Name>" }` (ual-bake.mjs:360). Sets `life`, `pro`, `ual2` write rotations as **normalized Int16** (`short: true`, line 357: "half a float's bytes… a turn moves by about 1e-4 rad"). The `saber` set writes one file `ual-saber.glb` with `Sword_Idle` + `Sword_Attack`, body bones only (`BODY` line 62: Hips, Spine02, Spine01, Spine, neck, both legs; arms/head/hands left out for gunplay/saber.js to pose), plus `strike`/`low`/`back` extras from `attackTimes()` (lines 245-275). `--report` measures drift from the mannequin per bone (lines 293-336).

Sets: `life` 36 clips (free pack), `pro` 33 clips (UAL1), `ual2` 48 clips (UAL2), `saber` 1 file → **118 files** on disk, matching 118 `ual-` entries in CLIPS (clipLibrary.js:74-192; the saber file is referenced by saberBody.js, not CLIPS).

Note (ualRetarget.js:3-4): "A spike for scripts/preview/heroes-ual.html … (nothing in the site runs it)" — retargeting is offline-only; the browser only loads the baked GLBs.

## 6. Other scripts

- `scripts/anim-check.mjs` (746 lines): headless-Chromium check of every rigged figure on a route via `window.__THREE_DEVTOOLS__` hook (lines 41-50). Per figure: planted-toe drift (limit `LIMIT = 0.15` m/s, line 61; `PLANT = 0.03` m, `WINDOW = 0.6` s), bind-pose detection (`BIND_EPS = 0.01`), lockstep detection (`PHASE_TOL = 0.001`). Reports "`N figures in S scenes, M in view; F frames, W s on the wall, T s in the world`" (line 549). It measures foot drift and phase, **not** per-figure CPU/GPU cost — no ms-per-figure numbers are produced. Exit 1 on drift over limit; `--strict` adds bind-pose/lockstep failures. Usage: `node scripts/anim-check.mjs --route '#/c-137' [--seconds 6] [--frames 20] [--range 40] [--gpu]`.
- `scripts/fbx-to-glb.mjs` (50 lines): FBX → GLB through three's FBXLoader + GLTFExporter in headless Chromium via `scripts/preview/fbx-to-glb.html`, "skeleton, skin and clips kept" (line 3); for Sketchfab uploads whose auto-glTF broke. Does no rigging.
- `scripts/meshy-import.mjs` (62 lines): gltf-transform pipeline (dequantize, weld, simplify to triangle budget, dedup, prune, WebP textures, meshopt) for 7 non-humanoid Meshy models (`MODELS` lines 22-30: optimus-prime 24k tris, megatron 24k, x-wing 16k, slave-i 12k, republic-attack-cruiser 12k, mario 12k, piranha-plant 8k) into `public/models/meshy/`. No rigging or animation step.

## 7. Galaxy surface: how figures/creatures/mounts are animated (`src/components/galaxy/surface/`)

`figureFor()` priority (actors.js:455-458): `spec.model === false` → built figure; else `WALKERS[kind]` → walkerFigure; else `crewFigure` (Meshy human); else `modelFigure` (catalog GLB); else `buildFigure` (shapes); else `propFigure` (props/*.js).

**Six animation paths exist today:**

1. **Meshy crew humans** (`crew.js:1-4`): "rigged on a humanoid skeleton and walked with Rick's clips, borrowed (universe/footScene.js's loadPartyFigure), on an animator of its own". Each gets its own `createAnimator`; library clips via `animatorCalls`. `c.still` figures (Jabba) just breathe by scaling the model (crew.js:46-60). Crew GLBs live in `public/models/galaxy/crew/` (luke.glb 729,196 B etc.).

2. **Catalog models with their own clips** (`modelFigureOf`, actors.js:325-446): `createAnimator(scene, {clips, seed, up, bones, clipSpeed})` on **any** skeleton (line 343); `meshy` test = Hips, LeftUpLeg, RightUpLeg, Spine02, Head all bones (line 335); non-Meshy rigs get `feetOf()` lowest-bone-per-side as stand-in toes so `strideOf` can measure (lines 283-302, 341-342). Library access only if `meshy`. Catalog rows with `rig: true, anim:{…}` (the non-humanoid ones animated by their OWN baked clips):
   - `atat` (ice.js:9): `anim: { walk: 'Walk' }`, 22.5 m, 40k tris
   - `atte` (core.js:12): `{ walk: 'Action' }`, 22 m
   - `atst` (forest.js:8): `{ idle: 'ATST Armature|Stationary pose', walk: 'ATST Armature|Walking action' }`
   - `atap` (forest.js:21): `{ idle: 'Armature|Idle', walk: 'Armature|Walker Walk' }`
   - `bantha` (desert.js:12): `{ walk: 'Bantha_Walk' }`
   - `rancor` (desert.js:19): `{ idle: 'Unreal Take' }` (idle only)
   - `ig11` (outer.js:11): `{ idle: 'Take 001' }`; `c3po` (people.js:17): `{ idle: 'mixamo.com' }`
   - `stormtrooper` (people.js:8): `{ walk: 'GltfAnimation 0' }`; `clone` (people.js:12): mixamo idle+walk; `superdroid` (people.js:16): `{ idle: 'at attention', walk: 'walk guns up' }`
   A walk-only rig stopping "finishes its step onto a foot" (`settle`, actors.js:354-377, `CREEP = 0.25`, `CONTACT = 0.04`).

3. **Statues given legs** (`legRig.js`): Sketchfab models with no skeleton and a catalog `legs:{crotch}` row (gungan core.js:8, kaminoan :19, geonosian :20, ewok forest.js:11). `findLegs` slices the point cloud, builds a 7-bone skeleton (Hips, L/R UpLeg, Leg, Foot: legRig.js:210-232), computes `skinIndex/skinWeight` per vertex (`legWeights`, lines 236-249), binds a `SkinnedMesh`, cached per template, then `cloneSkinned` per copy. Walks by `legGait/legPose` (ground-paced phase), hips dip + breathe (lines 282-285). `anim: null`, `NO_CALLS`.

4. **Rigid walkers cut at joints** (`walkers.js`): only `atrt` in `WALKERS` (lines 36-50). `splitParts` assigns each triangle to body/thigh/shin/foot and hangs sub-meshes on pivots; `gaitStep` phase by ground / `(step/stance)` (lines 92-98); `legAngles` two-bone IK in the leg plane (73-87); foot kept flat. Rider = a `crewFigure('clone')` put in `base('sit')` and posed every frame by `poseRider` IK (walkers.js:236-243, 259-263).

5. **Built-from-shapes figures** (`figures.js`): 44 `PEOPLE` kinds + 7 `BEASTS` (bantha, dewback, tauntaun, kaadu, wampa, rancor, nerf) + hutt + astromech. Legs are Groups rotated by sine of a **time-based** phase: person `phase += dt * (2.5 + move*6)` (figures.js:435), beast `phase += dt * (1.8 + move*5)` (line 580), hip `rotation.x = sw * l.x` (582), body bob (583), head wander (584-585). Hutt breathes by scaling (652-658). Astromech just tilts (694-696). These do NOT use gait.js's ground-paced phase.

6. **Props that walk** (`propFigure`, actors.js:420-437 → props/*.js `update(t, dt, move)`): the shape-built AT-AT in `props/generic.js:32-76`: 4 legs each hip+knee group, `cycle += dt * 0.32 * move`, `hip.rotation.x = sin(a)*0.2*move`, `knee.rotation.x = -max(0, sin(a+0.9))*0.42*move`, body bob 0.25 m, roll 0.012 rad. `props/ice.js:943-963` `atatfar` walks it on a 240 m beat at 2.2 m/s. `props/edge.js:750` AT-ACT is a taller AT-AT. Time-based, not ground-paced.

**Mounts/rides** (`rides.js`, `riders.js`): `RIDES` tauntaun/kaadu/bantha have `figure:` = a figures.js creature "walking under you" (rides.js:4-5, 22-26); the rider is posed by `poseRider()` two-bone IK (`reach`, `aimBone`, `rotateWorld` from ik.js) onto `SEATS[kind]` hand/foot/hips points measured off each model (riders.js:27-34), "every frame after its animator's done", over whatever sat clip it's on. Requires `fig.bones.Hips` (Meshy skeleton) else returns false (riders.js:~60).

**Droids/machines** (`machine: true` rows: droideka, cloudcar, dwarfspider, homingspider, mousedroid, astromech, r5, probe): no legs animation at all; `scene.position.y = rest.y + sin(clock*9+seed)*0.004*tall` hum (actors.js:401-404).

**Non-rigged, non-walking catalog models**: `createGait` + `sway()` bob/roll by ground covered + `breathe()` scale (actors.js:405-413) — "none frozen, none gliding".

**Per-figure throttle in actors.js**: `a.tick = budgetClock(actors.length)` (line 523); `stepFigure` rate `d < FAR(60 m) ? 1 : small ? 0 : 0.25` (lines 699-700, FAR line 464) — NOT the distance/`max=64` `createAnimBudget`; animators are stepped in ≤0.1 s chunks up to 0.4 s (`for (let left = Math.min(dt, 0.4)…)` line 394). Head/hands "show" only under `LIVELY = 45` m (line 465). Motion derived from the brain's displacement via `bodyFrom(a.prev, now, by)` (line 705); a jump over `LEAP = 4` m counts as a teleport (speed 0).

## 8. Middle-earth / Edoras (`src/components/middleearth/`)

- **Folk are built in code** (folk.js:1-16): `makeToyFigure` toys (mapFigures.js) dressed for Rohan, meshes merged per moving group (`pack()` folk.js:62-108 keeps body, head, legs, arms, torso, neck as pivots, bakes colour into vertices, 4 shared materials: glow/metal/cloth/matte). Toy `pose(f, t, {moving, wave, talk, speed})` (mapFigures.js:254-277) is **time-based**: `sw = sin(t * 13 * speed)`, legs `rotation.z = ±sw*0.75`, bob `|cos(t*13)|*0.07`.
- **Cast upgrade**: folk.js:547 calls `castFigure(f, as, look, { town: 'edoras', role: rider/henchman → 'folk' else 'cast' })`. cast3d.js:1-18: Meshy toy-style figures in `public/models/middleearth/cast/<name>.glb` (**29 characters, 116 GLBs, 15 MB**: each a body + own `-idle/-walk/-run`; names: aragorn arwen bilbo boromir breeman butterbur easterling elf elrond eowyn faramir frodo galadriel gandalf gandalfwhite gimli goblin gondorguard hobbit legolas merry orc pippin rohirrim rosie sam saruman theoden uruk), made by `scripts/meshy-middleearth.mjs` (Meshy rigger's free walk/run + library idle). One template per name, `SkeletonUtils.clone` per copy, put inside the toy's group, toy parts hidden; the toy keeps walking if the GLB 404s. `role: 'folk'` stays a toy on `tier === 'low'` (cast3d.js:91). `tickCast(root, camera, dt)` steps every ready figure with `createAnimBudget({ near: 14, far: 50, max: MAX[tier] })`, `MAX = { high: 48, mid: 20, low: 8 }` (cast3d.js:174, 505-507), frustum-sphere in-view test (line 486).
- **Edoras figure count** (scene.js:168-180, 202-210): 10 named persons (gimli ×2 variants, legolas, aragorn, gandalf, theoden ×2, grima, eowyn, hama) + 2 door guards (layout.js:67-70) + 8 henchmen + 6 feasters = **28 toy/cast persons**, + Snowmane + 3 horses (procedural, weathertop's `gallop()`), + ghosts (online players as Gimli).
- **The host of Rohan = GPU vertex-animated InstancedMesh** (folk.js:961-1035, scene.js:213-238): one merged flat-shaded horse+rider+spear+shield mesh of "a few hundred triangles"; per-vertex `aRig` attribute (x>0.5 → leg, x-1 its stride offset; y,z the leg pivot; w the paint class); `MeshLambertMaterial.onBeforeCompile` injects `RIG_MOVE` GLSL that rotates leg vertices about their pivot by `sin((uCyc + off) * 2π)` and rocks/bobs the body, phase hashed from `instanceMatrix[3].xz`; uniforms `uCyc/uReach/uRide` driven by `createStride` (creatures.js:136) on the CPU once per frame. Count `n = min(1000, round(1000 * many))`, `many = 1 / 0.6 / 0.35` by tier (scene.js:113, 216) → **up to 1000 instanced riders + ⌈n/7⌉ banner instances, 2 draw calls**. This is the only shader-driven rig on the site (grep `aRig|uCyc` → folk.js only).

## 9. Universe foot scene (`src/components/universe/footScene.js`, 3328 lines)

- `crews.js` is **pure data** (dialogue lines, ship ids, speakers; crews.js:1-5). Figures come from footScene.
- `rigged()` (footScene.js:161-200): builds bones map, scales by `head_end→toes` height, `createAnimator(model, { clips: own, bones, hipsY, up, unit: METRE, seed, key })` (line 177), `animatorCalls` (179); `update(dt, move, motion)` → `calls.tick; anim.locomote; anim.update(dt)` with **no lodRate** (lines 185-189) — footScene does not import animBudget.
- `rigScene()` (273-302): every Meshy figure gets **Rick's idle/walk/run** via `borrowClips()` + `retarget(clip, hipsY)` (line 291), idle/run `faceForward`'d to the walk's heading (295-298). `loadSharedFigure(url)` (315-332): one template per URL, `cloneSkinned` copies share geometry/materials. Galaxy crew.js reuses these (`loadPartyFigure`, `loadSharedFigure`).
- Galaxy crew GLBs (`public/models/galaxy/crew/`: **46 GLBs, 26 MB**, 56 `CREW` entries in crewList.js) carry **no clips of their own** (0 `-idle` files) — `scripts/meshy-galaxy.mjs:4-7`: "They have no clips of their own: footScene.js's loadPartyFigure gives every figure … Rick's idle, walk and run". Troopers (`public/models/galaxy/troops/`: 16 GLBs, 2.9 MB, 10 bodies + 6 `clip-*.glb`) were Battlefront II statics auto-rigged by Meshy (`scripts/meshy-troopers.mjs:1-11`).
- Figures at once: party of 2 (lead + crewmate) + troop squads of `min(5, 2 + S.squads + rand(0..1))` each (line 2590), another squad of 3 on a call (2632). `TROOP_CLIPS` preloaded: hit.chest, hit.head, die.fwd, die.back, die.blown (line 376).

## 10. Other worlds using the layer (import census, `grep -rl` over src/components)

- `lib/three/animator`: caribbean 1, cybertron 1, galaxy 3, middleearth 1, office 2, rickmorty 1, universe 1.
- `lib/three/figureCalls`: galaxy 4, middleearth 1, rickmorty 1, universe 1.
- `lib/three/gait`: albuquerque 3, avengers 3, cybertron 1, deathstar 1, dotmatrix 2, galaxy 3, mario64 2, middleearth 8, office 3, rickmorty 7, universe 1.
- `lib/three/animBudget`: albuquerque 1 (budgetClock), galaxy 1 (budgetClock in actors.js), middleearth 1 (createAnimBudget), rickmorty 1 (createAnimBudget). Only **two** `createAnimBudget` callers: `rickmorty/citadel/scene.js:188` `{ near: 12, far: 40, max: high 40 / mid 24 / low 14 }` and `middleearth/cast3d.js:506` `{ near: 14, far: 50, max: 48/20/8 }`.
- `lib/three/rig` (pose-by-role figures): avengers 2, cybertron 1, invincible 5, mario64 1. Cybertron also has `game/autorig.js` (builds a rig.js-named skeleton from a one-piece robot's shape, rigid per-vertex weights, autorig.js:1-11).
- `lib/three/clipLibrary`: 10 worlds. `lib/ai/body`: cybertron, galaxy 7, office, rickmorty 5. `lib/ai/react`: avengers, caribbean 3, cybertron, office, rickmorty, universe.
- Citadel crowd (`rickmorty/citadel/crowd.js`): still copies drawn as InstancedMesh, breathing in the vertex shader (lines 7-9); the nearest `LIVE_N = { high: 12, mid: 6, low: 0 }` within `LIVE_REACH = 28` m promoted to live animators (lines 42-43), of 10 `LIVE` kinds (people.js:67).

## 11. GPU / instanced skinning / vertex-animation textures: none

- grep for `boneTexture|BatchedMesh|vertex animation|bakedAnimation|animation texture` in src → only `lib/three/gpuWork.js:177` (a cache-key string that flags isSkinnedMesh/isInstancedMesh). No VAT, no instanced `SkinnedMesh`, no shared skeleton across instances. Every rigged figure is a `SkeletonUtils.clone` with its own `AnimationMixer` and CPU-side skinning matrices (three.js's standard `Skeleton` bone-matrix texture per SkinnedMesh).
- The two shader-driven crowds (Edoras host `aRig`, Citadel still-crowd breathing) are **rigid per-vertex pivot rotations in GLSL**, not skinning.

## 12. Docs status

- `docs/research/2026-10-07-rigging-and-models.md` (25 lines): Meshy auto-rig "24 bones: no fingers, no twist bones"; every humanoid on Rick's borrowed clips; recommends riders IK (done: riders.js), one procedural walker (done: AT-RT), per-character Meshy clips, re-rig heroes with Mixamo/AccuRIG (not done), UAL CC0 clips (done: 118 baked).
- `docs/research/2026-10-07-character-audit.md` (2105 lines, 104 character systems). Creatures section (519-535) findings as of 10-07: walk-only models froze mid-stride (`timeScale 0`), AT-AT feet skate, ride mounts are figures.js shapes though Meshy statics exist, no attack animation for rancor/acklay. Code today: `settle()` in actors.js addresses the mid-stride freeze; `strideOf` via `feetOf()` addresses pacing for non-Meshy rigs.
- Spec `2026-10-07-living-characters-design.md` (244 lines) W0–W7. **Done when** (line 240) names `src/lib/three/{clipLibrary,locomotion,animator,gait,animBudget}.js` + `src/lib/ai/{body,react,needs,social}.js`: **all exist** (sizes: animator 25,719 B; clipLibrary 27,723; locomotion 14,469; gait 4,273; animBudget 2,816; body 5,360; react 5,747; needs 6,129; social 13,984; plus lib/emote.js 7,986) and `docs/architecture.md:15` names them (but still says "thirty-six clips from Quaternius" vs 118 on disk).
- Plans: `living-characters-core.md` 0/49 boxes checked, `-w2.md` 0/13, `-w3-w7.md` 0/4 (checkboxes never ticked; the import census above is the real status). W3–W7 plan line 20: Middle-earth cast = "29 figures, each with its own -idle|walk|run.glb" — matches disk.

## 13. Making new models (`scripts/gen3d/README.md`)

Owner's Windows GPU desktop; image/prompt → TRELLIS.2-4B (`trelliscpp` C++/GGML on Windows CUDA, ~80–220 s at res 1024, or `trellis2` reference in WSL) or Hunyuan3D-2 multi-view (`--engine hunyuan`, 3–4 pictures); Pixal3D (TRELLIS.2 fine-tune) when following an image; concept images via Z-Image-Turbo/FLUX. Output ~300k tris + 2048² PBR → Blender bake to low mesh (`bake.mjs`) → `web.mjs` (same gltf-transform pipeline as meshy-import) → `public/models/gen3d/<name>.glb` in three cuts (.hq/plain/.lo). Made so far: tie-fighter, tie-interceptor, x-wing (9 files). Jobs via GitHub issue label `gen3d` + self-hosted runner. **It does not rig or animate**: the only rig mention is `upright.mjs:3-4` ("so a rig made from it later (Meshy's, from a URL) sees it standing") — rigging remains Meshy's cloud auto-rigger via the `scripts/meshy-*.mjs` `rig` step (5 credits) and clips from Meshy's animation library (3 credits a clip).

## 14. Counts at a glance

- One skeleton: Meshy 24-bone (22 mapped from UAL; 12-name test in rig.js; 16 used by locomotion; 13 upper + 9 lower masks).
- `CLIPS` registry: **254** entries = 4 Rick + 13 Meshy shared + 6 trooper + 118 UAL + 113 Meshy act. On disk in `public/games/meshy/`: 113 act (7.7 MB) + 118 ual (2.5 MB) + 13 clips (740 KB) + 294 per-character `-idle/-walk/-run/-sit` files + 101 bodies/props; 639 GLBs, 102 MB total.
- Per-scene live animators: galaxy surface = every actor within 60 m at rate 1, beyond at 0.25 (0 on small devices); no hard cap. Edoras: ≤28 cast persons under `max 48/20/8` full-rate, plus up to 1000 shader-instanced riders. Citadel: ≤12 live + instanced still crowd under `max 40/24/14`. Universe foot: 2 party + ≤5 per squad, every frame, no budget.
- Measured cost: none reported by any script; `anim-check.mjs` measures foot drift (≤0.15 m/s), bind-pose and lockstep only.


---

# 4. The asset and render pipeline

Sections: 1 loader stack · 2 renderer/pace/LOD/matcap · 3 house look + core wear + antiTile · 4 device tiers + budget table (verbatim) · 5 runtime backends/quality/assets/modules · 6 public/ sizes + top 25 files · 7 offline scripts (what every GLB gets) · 8 measured GLB extensions/meshopt coverage/texture sizes · 9 how calls/tris are measured · 10 GLB import convention · 11 WebGPU/nodes status · 12 docs: conclusions and status in code.

Repo: the site repo. All paths below are relative to that root unless absolute. Read-only survey; no designs proposed.

## 1. Loader stack (runtime)

**One GLTFLoader for the whole site** — `src/lib/three/gltf.js`.
- `SiteGLTFLoader extends GLTFLoader` (gltf.js:40-59). `gltfLoader()` (gltf.js:61-67) creates it once and calls `loader.setMeshoptDecoder(MeshoptDecoder)` from `three/examples/jsm/libs/meshopt_decoder.module.js` (gltf.js:25, 64). Header comment line 1-2: "Meshopt is always on (every GLB here is meshopt-compressed)".
- **No Draco.** `grep -ri draco src scripts` → see section 1a below for the exact result.
- **KTX2 / Basis Universal: lazy.** `ktx2Loader({ renderer })` (gltf.js:91-109) dynamically `import('three/examples/jsm/loaders/KTX2Loader.js')`, `setWorkerLimit(max(1, min(2, hardwareConcurrency-1)))` (gltf.js:95), `detectSupport(renderer ?? probeRenderer())` (gltf.js:96) and attaches to the shared GLTFLoader (gltf.js:98). `probeRenderer()` (gltf.js:72-86) is a throwaway webgl2/webgl context exposing `extensions.has/get` so support can be detected before the real renderer exists. Transcoder (basis_transcoder.js/.wasm) is "bundled by Vite from three's own URL" and only downloaded on the first decode (gltf.js:88-90).
- `usesBasisu(data)` (gltf.js:114-124) sniffs the GLB JSON chunk (or .gltf text) for the string `KHR_texture_basisu` so the KTX2 loader is only fetched for files that carry it. `SiteGLTFLoader.parse` (gltf.js:41-58) awaits `ktx2Loader()` first when `!this.ktx2Loader && usesBasisu(data)`.
- On parse, every scene is passed through `fitTextures(scene)` (gltf.js:44) → textures.js:313-330: every map on a non-transparent material halved on a 2D canvas until ≤ `modelTexCap()` (textures.js:283-307); compressed (KTX2) textures instead have their top mips dropped (`mipsOver`, textures.js:263-267, 285-292). Transparent/alphaTest/alphaMap materials are skipped (textures.js:320).
- `loadGltf(url, { renderer, fresh, prepare })` (gltf.js:146-167): per-URL `Map<url, Promise<gltf|null>>` cache (gltf.js:126); fetch via `THREE.FileLoader` arraybuffer (gltf.js:130-138) then `parseAsync`; failures resolve `null` and are forgotten (gltf.js:155-159). `fresh: true` returns `copy()` (gltf.js:175-181; SkeletonUtils.clone for skinned, else `clone(true)`). Geometry/materials/textures shared between copies.
- `prepare(root, { renderer, shadows, receive, cullSkinned })` (gltf.js:187-198): castShadow/receiveShadow where asked, `frustumCulled=false` on skinned meshes, `sharpenTree` (anisotropy), `userData.prepared` guard.
- `tune(material, rules)` / `tuneTree` / `SHIP_PROFILE` (gltf.js:211-255): clamps generator defaults (Meshy/Sketchfab metalness 1 on plastic etc.). SHIP_PROFILE: roughness [0.42,0.72], metalness {metal 0.65, paint 0.1}, envMapIntensity 1.3 (gltf.js:236-241).

**Second cache layer** — `src/lib/three/gltfCache.js` (80 lines): `loadGLTF(url, { loader })` → per-URL promise cache (gltfCache.js:30-51), uses `gltfLoader().loadAsync` (so meshopt+KTX2 come along), `sharpenTree` on the original. `cloneScene(gltf)` (gltfCache.js:53-70) clones and gives each copy its *own* materials (one per original material, so shared materials stay shared within a copy). `gltfStats()` counts requests/parses in DEV only. Two parallel caches exist (gltf.js `parsed` and gltfCache.js `cache`); they do not share entries.

**Textures** — `src/lib/three/textures.js` (330 lines).
- `sharpen(texture, { renderer, color, repeat, wrap, mipmaps, aniso })` (textures.js:42-60): anisotropy = `anisotropyFor(renderer max, budget().aniso)` (16 desktop / 4 phone / 1 weak per header comment lines 5-8), colorSpace sRGB or NoColorSpace, wrap/repeat, optional mipmaps off.
- `loadTexture(url, …)` (textures.js:139-162): per-URL cache; `.ktx2` URLs route through `ktx2Loader` (textures.js:144-145); otherwise `ImageBitmapLoader` when `imageBitmapOk()` (not Safari<17, not Firefox<98; textures.js:104-114) with `imageOrientation:'flipY', premultiplyAlpha:'none'` (textures.js:126), else `TextureLoader`.
- `variant(url, '-sm', use)` (textures.js:90-99) → the `-sm` / `-512` file for a smaller tier.
- `warm(renderer, what, { idle, perSlice=2 })` (textures.js:199-229): `renderer.initTexture` ahead of the first frame, optionally spread over `requestIdleCallback` slices.
- `detailCanvas(w, h, { level, max })` (textures.js:238-246): a 2D canvas for code-painted textures scaled by `texScale` (×2 at ultra, ×½ at low).
- `MAP_SLOTS` (textures.js:36): 17 slots incl. clearcoat/sheen/transmission/thickness.

**Detail table** — `src/lib/detail.js:36-41` (verbatim):
```
  level   texture scale  ceiling  segments  model maps kept  LOD reach  clearcoat
  low     ½              512      ½         512              0.6        –
  mid     1              1024     ¾         1024             0.8        –
  high    1              2048     1         4096             1          –
  ultra   2              4096     2         8192             1.5        on
```
Code: `DETAIL = { low:{tex:.5,texMax:512,seg:.5,modelTex:512,lod:.6,clearcoat:0}, mid:{tex:1,texMax:1024,seg:.75,modelTex:1024,lod:.8,clearcoat:0}, high:{tex:1,texMax:2048,seg:1,modelTex:4096,lod:1,clearcoat:0}, ultra:{tex:2,texMax:4096,seg:2,modelTex:8192,lod:1.5,clearcoat:1} }` (detail.js:366-371). `MIN_TEXELS = 32` (detail.js:375). `strained()` (detail.js:412-414) drops ultra→high via `capDetail('high')` when frames stay late with pixel ratio already minimum.

- **1a. Draco**: `grep -rin draco src scripts` → 0 matches. No DRACOLoader anywhere; only meshopt + KTX2.

## 2. Renderer, pace, LOD, matcap

**`src/lib/three/renderer.js`** (415 lines) — WebGL only here.
- `createRenderer(canvas, { alpha=true, antialias=true, ratio=2, toneMapping=NoToneMapping, exposure=1, onLost, onSlow, guard=false })` (renderer.js:43-122): `new THREE.WebGLRenderer({ canvas, alpha, antialias: antialias && budget().antialias, powerPreference:'high-performance', stencil:false, preserveDrawingBuffer })` (renderer.js:48). `outputColorSpace = SRGBColorSpace` (renderer.js:52). `quiet()` turns off `debug.checkShaderErrors` outside DEV (renderer.js:285-288; perf-probe sets `window.__tpNoShaderChecks`).
- Pixel ratio: `maxRatio(cap=2) = pixelRatio(cap)` from lib/device (renderer.js:14); `fitRatio(w,h,ratio,{side,pixels})` clamps to GPU max texture/renderbuffer/viewport side (`maxSide`, renderer.js:29-33); drawing-buffer only resized when w/h/r actually change (renderer.js:66-74).
- `watchdog({ ratio, set, onSlow, floor=0.75, slow=22 })` (renderer.js:137-193): 2.5s / ≥45-frame windows, drops top 5% slowest, typical ≥22ms (≈45fps) twice in a row → pixel ratio −0.25 (floor 0.75); if two steps don't give ≥8% improvement, revert and settle. At floor, `onSlow` once.
- `disposeTree`, `texturesUnder`, `uploadTexture(s)` (renderer.js:196-246). `singlePass(root)` (renderer.js:262-271): `forceSinglePass` on additive or flat transparent double-sided materials.
- `precompile(renderer, root, camera, scene, target)` (renderer.js:311-321) → `compileSlices` from gpuWork (KHR_parallel_shader_compile, CAP 4000ms); `precompilePasses` for EffectComposer passes (renderer.js:326-341), with `primeOutputPass` setting OutputPass defines up front for three r180 (renderer.js:359-379).
- `releaseContext` (renderer.js:411-415): deferred `forceContextLoss` once no precompile is in flight (idle + 1s).

**`src/lib/three/pace.js`** (134 lines) — resolution scaler for world scenes. `STEPS = [1, 0.85, 0.72, 0.6, 0.5]` (pace.js:39). `createPace({ steps, window=20, missed=0.25, settle=600, wait=4000, longest=60000, floorRuns=5, onFloor=strained, climb=true })` (pace.js:41): a frame is "late" when `dt > max(beat*1.5, 16.67*1.25)+1` (pace.js:92); ≥25% late in a 20-frame run → step down; clean for `hold` ms → step up (hold doubles to 60s if it drops straight back). At the softest step for 5 runs → `strained()` (ultra→high). `climb:false` for the world runtime (buffer reallocs cost more than they save, pace.js:26-29).

**`src/lib/three/lod.js`** (84 lines) — not THREE.LOD. `createLodSet({ items, levels, bands, hysteresis=0.1, every=0.5, move=20 })` (lod.js:36): each level is one `InstancedMesh`; re-sorts instance matrices per band every 0.5s or on 20m camera move; `lodBand` has hysteresis dead zone (lod.js:19-27). Distance is XZ-only (lod.js:52). Spec ref: ground-grass-foliage-design §5.

**`src/lib/three/matcap.js`** (125 lines) — explicitly "the shading model of Bruno Simon's folio (folio-2019)" (matcap.js:1-2). Differences stated in the header: Bruno paints in Blender; here `bakeMatcap(renderer, {roughness, metalness, size=128}, {sun, hemi, env})` (matcap.js:60-88) renders a `SphereGeometry(1,64,48)` + `MeshStandardMaterial` under copies of the world's hemi+sun (sun elevation clamped 15°–75°, from upper-left-front) + env into a 128² HalfFloat RenderTarget with mipmaps, cached per renderer by `matcapKey` (light colours/intensities/elevation/env uuid, roughness, metalness, size; matcap.js:45-47). `matcapFor(material, renderer, lights)` (matcap.js:97-118) converts Standard/Lambert/Phong/Toon → `MeshMatcapMaterial` keeping color/map/normalMap/vertexColors/side/alphaTest/transparent/opacity/flatShading/fog and carrying over `onBeforeCompile`/`customProgramCacheKey` (wind sway). Glowing (emissive) materials are left alone. Header caveat (matcap.js:13-15): "A matcap's light turns with the camera (Bruno's camera never turns; ours orbit), so it suits what is seen in passing: far rims of hills and trees, scattered rocks and crates, not the street the camera looks along."


## 3. The house look (`src/lib/three/house.js`, 381 lines) vs Bruno's MeshDefaultMaterial

Header (house.js:1-5): "One look for every world, after Bruno Simon's folio-2025 (its one MeshDefaultMaterial) and Active Theory's one lighting include (docs/research/2026-10-06-why-theirs-look-expensive.md)". It is NOT one material: it is an `onBeforeCompile` patch applied to every lit material (Standard/Lambert/Phong/Toon; `LIT`, house.js:147) a world hands over, with one shared uniform set per world (house.js:153-165).

What it does (three things, house.js:7-24):
1. **Shade is a colour** (`LOOK_GLSL`, house.js:78-89, inserted before `#include <opaque_fragment>`): `k = luma(outgoingLight - emissive) / luma(albedo * uLookRef)`; `shade = (1 - smoothstep(edge.x, edge.y, k)) * mix`; metals exempt (`*= 1 - metalnessFactor` under `#ifdef STANDARD`); `outgoingLight = mix(light, albedo * uLookShadow, shade) + emissive`. Defaults `LOOK` (house.js:41-54): `shadow: 0x9d93c4`, `edge: [0.16, 0.82]`, `mix: 1`.
2. **Fog is the sky** (`FOG_SKY`, house.js:91-96, replaces three's `fog_fragment` chunk line): fog colour = `mix(fogColor, houseSky(viewDir), uLookFogMix)`; `houseSky(d)` (house.js:72-75) = below horizon `fogLow*fogBelow`, above `mix(fogLow, fogHigh, pow(d.y, .5))`, plus `halo * pow(dot(d, sunDir), 6)`. Defaults: `fogLow 0xf6dfb0`, `fogHigh 0x3f7ccc`, `fogBelow 0.92`, `halo 0x000000`, `fogMix 1`.
3. **Ground bounce** (`BOUNCE_VS/FS`, house.js:98-119, after `#include <color_fragment>`, only when `house.ground(map)` is called with a lib/three/groundmap): downward faces within `uLookBounce.x` (1.5 m) of the ground take `groundColour(xz)` into their albedo: `lkNear = (1 - (y - groundHeight)/1.5)^2 * strength(0.5)`, `lkDown = clamp((-n.y + 0.6)*1.5)`. Comment: "(Bruno's light bounce, 1.5 m deep)" (house.js:24).

Tone mapping: `toneMapping: THREE.NeutralToneMapping`, `exposure: 1.4` multiplier over the world's ACES-era exposure (house.js:50-53, 208-209, 294-297).
`house.light({sun, hemi, ambient, env})` (house.js:234-242): `uLookRef` = (sun + hemi + ambient)/π + env mean radiance × intensity — the "full light" the shade ratio is measured against.
`house.material(opts)` (house.js:222-226): a `MeshLambertMaterial` already patched ("no specular, the illustrated finish").
`shadowFor(mood)` (house.js:272-280): shadow colour = sky light hue lerped 0.35 toward `VIOLET 0x7a6ad8`, scaled to luma `0.42 * luma(sky) * hemi` ("pale lilac under a day sky, deep blue at night, never grey"). `shadowFromEnv` (house.js:374-381) same from an HDR's mean radiance (`envLevel`, house.js:343-369).
`houseOn({ renderer, scene, sun, hemi, ambient, env, keepExposure, toneMap, look })` (house.js:292-338): one-call setup; registers with `frameGuard.guardOf(renderer).adopt` so late-arriving objects are patched before compile (house.js:305); `follow({ adopt })` recomputes ref light and shadow colour per frame.

**No palette / colour-ramp step.** `grep -n palette src/lib/three/house.js` → see §3a. The house does shade-colour, sky-fog, ground-bounce; it does not quantise or remap albedo to a palette, and it does not replace materials (so each world's N materials remain N shader programs, differing by `customProgramCacheKey` suffix `|house[:ground][:nofog]`, house.js:194).

**Core wear (`src/lib/three/core.js`, 268 lines)** is the second half of house-look: a triplanar CC0 Poly Haven scan kit (`public/cc0/galaxy/<role>/{color,normal,arm}.webp`, index.json; core.js:1-11, 33-43) multiplied into `diffuseColor` after `map_fragment` (`FRAG_COLOUR`, core.js:104-111; weights `pow(abs(n),4)`), with UDN-style triplanar normal added after `normal_fragment_maps` (core.js:115-129). `wear(material, scan, { metres=2, strength=0.55, normal=0.8, mean=0.8 })` (core.js:151-177); `dress(materials, roles, …)` (core.js:215-233) folds a material's own map mean colour into `color` and drops map/normalMap unless `keep`; skipped on tier `low` (core.js:216). At ultra, `coreFiles(role, { xl: true })` asks for `color-xl.ktx2|webp` / `normal-xl.*` 8192 maps (core.js:39-43) where `scripts/galaxy-textures.mjs --ultra` has made them. `rolesFor(materials)` (core.js:255-268) maps material names → roles by regex (`ROLE_NAMES`, core.js:241-254) and excludes `NOT_WORN` names (core.js:240).

- 3a: `grep -n -i palette src/lib/three/house.js` → 0 matches. No palette step in the house look.

**`src/lib/three/surface.js` antiTile** (184 lines): `antiTile(material, { angle=0.61, scale=1, frequency=0.045, mix=1, axis='xz', detail=null })` (surface.js:27, 132-164). Blends a second rotated/shifted copy of map/roughnessMap/metalnessMap/aoMap/normalMap weighted by 2-octave value noise of world position (`atW = smoothstep(.3,.7, noise*.65 + noise2*.35) * mix`, surface.js:111); optional `detail` tiling normal fading out by `range` 24 m (surface.js:99-104, 135). Cost: one extra fetch per blended map; disabled on tier `low` (surface.js:132). `detailNormal({ size=256, seed=7, strength=2.2 })` (surface.js:168-184) paints a tiling FBM height→normal into a CanvasTexture. Expands three's chunk `#include`s so must be applied last (surface.js:17-19).

## 4. Device tiers and the quality-level budget table (verbatim)

**`src/lib/device.js`** (277 lines). `classifyDevice(...)` (device.js:80-104): tier `low` if software WebGL, memory ≤2 GB (≤3 on phone), cores ≤2, or phone with `WEAK_GPU` (Mali-4xx/T/G31/51/52, Adreno 2xx–5xx, PowerVR, SGX, VideoCore, Vivante, Tegra 3/4; device.js:51); else `mid` if phone, memory ≤4 GB or screen <700; else `high`. `detail` = `ultra` for tier high unless `gpuGrade(renderer) === 'mid'` (then `high`); a localStorage cap (`tp-detail-cap`, per renderer name) and overrides (`?quality=` URL or `tp-quality` localStorage) apply (device.js:72-77, 99-102). `LEVELS = ['low','mid','high','ultra']` (device.js:47). `HEAVY_MB = 3` (device.js:268); `worldCheck(mb)` asks before downloading a ≥3 MB world on a mid-tier phone, anything >1 MB on low/saveData, or when storage free < 4× mb (device.js:269-277).

`BUDGETS` renderer numbers (device.js:61-66, verbatim):
```
ultra: { tier: 'high', ratio: 2, minRatio: 1.5, antialias: true, samples: 8, shadows: true, shadowMap: 4096, bloom: 1, aniso: 16, stars: 1 },
high:  { tier: 'high', ratio: 2, minRatio: 1.25, antialias: true, samples: 4, shadows: true, shadowMap: 2048, bloom: 1, aniso: 16, stars: 1 },
mid:   { tier: 'mid', ratio: 1.5, antialias: true, samples: 2, shadows: true, shadowMap: 1024, bloom: 0.5, aniso: 4, stars: 0.6 },
low:   { tier: 'low', ratio: 1, antialias: false, samples: 0, shadows: false, shadowMap: 512, bloom: 0, aniso: 1, stars: 0.35 },
```
`pixelRatio(cap=2, tier) = min(cap, b.ratio, max(dpr, b.minRatio ?? 0) * sharpness())` (device.js:245-249) — high/ultra supersample a 1× monitor to 1.25×/1.5× ("Active Theory's getDPR does the same", device.js:58-59). `sharpness()` from localStorage `tp-sharpness` 0.5–2 (device.js:212-215).

**`src/lib/budgets.js`** (32 lines, every row; budgets.js:9-13 comment table and 24-29 code, verbatim):
```
  level  triangles  calls  models MB  props  LOD1  grass  terrain  gen3d cut  water
  low    0.8M       350    20         0.5    yes   0.25   0.5      .lo        0.5
  mid    1.5M       500    40         0.75   yes   0.5    0.75     (plain)    0.75
  high   3M         700    60         1      yes   1      1        .hq        1
  ultra  none       1500   240        1.5    no    2      2        .ultra     2
```
```js
export const COLUMNS = ['tris', 'calls', 'modelsMB', 'props', 'lod1', 'grass', 'terrain', 'cut', 'water'];
export const BUDGET_ROWS = Object.freeze({
  low: row(0.8e6, 350, 20, 0.5, true, 0.25, 0.5, '.lo', 0.5),
  mid: row(1.5e6, 500, 40, 0.75, true, 0.5, 0.75, '', 0.75),
  high: row(3e6, 700, 60, 1, true, 1, 1, '.hq', 1),
  ultra: row(Infinity, 1500, 240, 1.5, false, 2, 2, '.ultra', 2),
});
export const budget = (level) => BUDGET_ROWS[level] ?? BUDGET_ROWS.high;
```
Comment (budgets.js:15-18): "Ultra has no triangle ceiling (Infinity) and keeps the full model at every distance (no LOD1 swap); its gate is the draw calls, the download and, on a real graphics chip, the frame time. The design: docs/superpowers/specs/2026-10-07-quality-modes-design.md §2." "Pure and free of three.js, so the QA scripts read the same table in Node (scripts/galaxy-check.mjs holds every world to its level's row)" (budgets.js:6-7).

## 5. Runtime: WebGL / WebGPU backends, quality, assets, modules

**`src/runtime/webgl.js`** (68 lines): `createWebGL(canvas, { budget, onLost, invalidate, alpha, toneMapping, exposure })` (webgl.js:46-68) wraps lib/three/renderer's `createRenderer` with `guard: { invalidate }` (frameGuard) and exposes `makeGfx({ backend:'webgl', compile: precompile, upload: uploadTextures, post: buildComposer })`. `buildComposer(renderer, passes, size)` (webgl.js:20-42): EffectComposer from data `[{kind:'render'}, {kind:'bloom', strength=.5, radius=.4, threshold=.85}, {kind:'shader', material}, {kind:'output'}]` (RenderPass / UnrealBloomPass / ShaderPass / OutputPass).

**`src/runtime/webgpu.js`** (90 lines): `createWebGPU(canvas, …)` (webgpu.js:54-90): `import('three/webgpu')` → `WebGPURenderer({ canvas, alpha, antialias, powerPreference:'high-performance' })`, `await renderer.init()`, device-lost → `onLost` ("the runtime comes back on WebGL", webgpu.js:5-6). `compile` = `renderer.compileAsync` settled at 4000 ms (webgpu.js:72). `buildPostProcessing(renderer, passes)` (webgpu.js:18-52) loads `three/webgpu` + `three/tsl` + `three/addons/tsl/display/BloomNode.js` and builds `PostProcessing` with `tsl.pass(scene, camera).getTextureNode()` and `bloom(node, …)`; a `shader` pass throws "a shader pass needs the webgl backend" (webgpu.js:33). Header (webgpu.js:3-5): "Only a 'nodes' module gets it (backend.js): it can't run a ShaderMaterial, an onBeforeCompile patch or an EffectComposer". `hasWebGPU = navigator.gpu` (webgpu.js:14).

**`src/runtime/module.js`** (101 lines): `SHADINGS = ['glsl', 'nodes']` (module.js:18); `validateModule` defaults `shading` to `'glsl'` (module.js:25-27). Module contract: `{ id, shading, mb, label?, ratio?, sharpness?, create(rt, props) }` (module.js:5). `fromScene(id, create, { shading='glsl', mb=0, … })` wraps a lib/three/useScene scene (module.js:47-101); `onSlow` → `scene.lowerQuality(STEPS.length)` (module.js:72).

**`src/runtime/shading.test.js`** (44 lines): every `src/components/**/module.js` whose source matches `/shading:\s*'nodes'/` has its whole folder scanned for `FORBIDDEN = [RawShaderMaterial, ShaderMaterial, onBeforeCompile, EffectComposer]` (shading.test.js:13, 24, 34-43). Plus fixture `src/runtime/fixtures/nodesWorld.js`. Which modules are 'nodes' today: see §5a.

**`src/runtime/quality.js`** (108 lines): `createQuality({ tier, detail, pace=createPace(), floorAfter=2500, dpr=Infinity, sharp=sharpness() })` (quality.js:27): budget row = `BUDGETS[detail] ?? BUDGETS[tier]` (quality.js:31); `ratio = min(budget.ratio, dpr*k) * scale` (quality.js:54) — note the runtime caps at `dpr` (a 1× screen draws at 1, quality.js:7-8), unlike lib/device's `pixelRatio` which supersamples with `minRatio`; `frame(now)` drives `pace.frame` and after `floorAfter` ms at the last step emits level `STEPS.length` (=5) once so a module sheds effects (quality.js:69-92); `retune(level)` swaps the budget row live (quality.js:59-61).

**`src/runtime/assets.js`** (102 lines): `createAssets({ loaders, forget, concurrency=2 })` (assets.js:13): per-URL cache with owners/retained, priority prefetch queue with 2 in flight (assets.js:39-56), `drop(id)` forgets everything a module owned unless retained/other owners (assets.js:93-98); loaders are injected (lib/three/textures', gltf's, audio's).

## 6. Sizes under public/ (du -sh, 2026-10-08)

```
13M   public/models/albuquerque
64M   public/models/c137
2.9M  public/models/cockpit
29M   public/models/cybertron
7.3M  public/models/dickansh
212M  public/models/galaxy
17M   public/models/gen3d
9.0M  public/models/invincible
1.7M  public/models/mario64
1.5M  public/models/marvel
3.0M  public/models/meshy
428K  public/models/metherria
15M   public/models/middleearth
9.0M  public/models/music
2.8M  public/models/office
19M   public/models/sketchfab
16M   public/models/universe
52K   public/models/wardrobe
45M   public/textures
14M   public/cc0
424K  public/hdri
804M  public (total)
```
25 largest files under public (MB):
```
22.20  public/eagler/1.12.2.bin
12.92  public/eagler/1.8.8.bin
8.91   public/models/galaxy/deathstar2.hq.glb
5.57   public/textures/universe/breakingbad-xl.ktx2
5.37   public/textures/universe/marvel-xl.ktx2
5.33   public/textures/universe/music-xl.ktx2
4.08   public/models/sketchfab/optimus-transform.glb
3.60   public/models/cybertron/megatron-foc.glb
3.35   public/textures/universe/middleearth-xl.ktx2
3.27   public/models/gen3d/tie-interceptor.hq.glb
3.25   public/models/galaxy/deathstar2.glb
3.23   public/models/galaxy/surface/ds2sky.glb
3.18   public/models/gen3d/x-wing.hq.glb
3.02   public/textures/universe/caribbean-xl.ktx2
3.01   public/models/galaxy/surface/wroshyrgreat.glb
2.97   public/hq/models/fir-sapling.glb
2.95   public/models/gen3d/tie-fighter.hq.glb
2.92   public/models/dickansh/gopuram.glb
2.83   public/eagler/worlds/the-plaza-1-8-8.bin
2.74   public/models/galaxy/surface/arena.glb
2.68   public/models/universe/war/hacienda.glb
2.59   public/models/galaxy/surface/varykino.glb
2.59   public/models/sketchfab/falcon-hd.glb
2.57   public/models/galaxy/surface/theed.glb
2.55   public/models/galaxy/crew/dindjarin.glb
```

## 7. Offline scripts: what compression every GLB gets

**`scripts/ktx2.mjs`** (298 lines): `report | convert <files> [--out] [--etc1s] [--slots color,normal,arm,other] [--level 2] [--rdo 1] [--quality 200] [--flip]`. Encoder = `basisu` npm binary (ktx2.mjs:54-75). `DEFAULTS = { level: 2, rdo: 1.0, quality: 200, zstd: 18 }` (ktx2.mjs:79). UASTC by default: `-ktx2 -mipmap -uastc -uastc_level 2 -uastc_rdo_l 1 -ktx2_zstandard_level 18`, `-linear` for non-colour roles (ktx2.mjs:90-97). GLB: gltf-transform NodeIO with ALL_EXTENSIONS + meshopt encoder/decoder (ktx2.mjs:165-169); textures rewritten in place as `image/ktx2` under `KHR_texture_basisu` required (ktx2.mjs:253-276), the rest of the file (meshopt, quantisation, materials) untouched. `verdict()` rule (ktx2.mjs:243-251): convert when GPU bytes fall, download ≤1.25× and PSNR ≥34 dB; JPEG normals → "regenerate from source as UASTC"; ≥2048 wide → "consider (GPU memory)"; else keep WebP. Header (ktx2.mjs:4-14): a 1K map is 1.3 MB as UASTC vs 5.3 MB RGBA; UASTC ≈3× the download of WebP; ETC1S 25–31 dB "too lossy for anything seen close".

**`scripts/flatten-glb.mjs`** (270 lines): posterises a GLB's base-colour atlas (k-means ≤16 colours, `--scale 2` lanczos upscale + median(3), optional `--palette` pull 0.5; flatten-glb.mjs:235-256) or `--vertex` writes COLOR_0 and drops the atlas (flatten-glb.mjs:116-150, 219-233); sets roughness 0.85 metal 0, drops normal/MR maps unless `--keep-normal`/`--keep-pbr` (flatten-glb.mjs:147, 259-261); writes with `prune()` + `meshopt({ level: 'medium' })` (flatten-glb.mjs:264). Atlas re-encoded WebP q92 (flatten-glb.mjs:253).

**`scripts/sketchfab-import.mjs`** (99 lines; one model, walkable worlds): gltf-transform `dedup(), metalRough(), prune()` (sketchfab-import.mjs:47); if tris > budget×1.15 → `weld() + simplify({ MeshoptSimplifier, ratio: tris/before, error: 0.004 })` (line 48); defaults `--tex 1024 --tris 60000` (lines 30-31; header says 40000); stood on ground/centred/scaled to `--size` metres (lines 83-93); then `prune(), textureCompress({ sharp, webp, resize [tex,tex], quality 82 }), meshopt({ level:'medium' })` (line 95). Output: meshopt GLB with WebP textures.

**`scripts/sketchfab-batch.mjs`** (281 lines; models seen small, → `public/models/sketchfab/`, credits into `src/data/modelCredits.json`): `MODELS` table (sketchfab-batch.mjs:44-60) e.g. `xwing-hd` tris 100000, tex 2048, maps 1024; `falcon-hd` 70000/2048/1024; `sitar` 9000/512; `minas-tirith` 14000 bare; `orthanc` 6000 bare; `bag-end-door` 4000/1024/512. Pipeline (lines 257-264): `dequantize, flatten, [prune | bare() | onOneSheet(tex)], [unweld, cropToUse] (own), prune, join({keepNamed:false}), weld, simplified(tris, error 0.01, seams), dedup, prune, textureCompress(webp q85; colour at tex, data maps at maps), meshopt({ level: 'high' })`. `onOneSheet` (lines 166-227) packs every material's colour map into one PNG atlas with 4px gutters and one material → one draw. Credits require `asset.extras.{source,author,license}` from the Sketchfab download (line 245).

**`scripts/kenney.mjs`** (97 lines; CC0 Kenney kits → `public/games/kenney/`): `npx @gltf-transform/cli@4 optimize src out --compress meshopt --texture-compress webp --texture-size 256 --simplify false` (kenney.mjs:87). Credits written to `public/games/credits.json` (kenney.mjs:88).

**`scripts/galaxy-lod.mjs`** (307 lines; far-off ships → `public/models/galaxy/lod/<kind>.glb`): reads kinds from `src/components/universe/glbFleet.js` and `src/components/galaxy/models.js` (lines 36-49); bakes base colour × texture (sampled at 256²) × vertex colour + emissive into COLOR_0 (lines 101-169); welds (lines 173-208); `simplifyWithAttributes` → `Prune` → `simplifySloppy` to `TARGET = { fighter: 1500, other: 4000 }` triangles (lines 31, 212-242); writes one primitive, positions Int16 normalised, colours Uint8, `KHR_mesh_quantization` + `EXT_meshopt_compression` QUANTIZE (lines 248-285). UVs, normals, textures dropped.

**`scripts/galaxy-surface-lod.mjs`** (129 lines; buildings > `LOD_OVER = 20000` tris → `<kind>.lod1.glb`, drawn past 3× radius by placer.js `withLod`): `weld(), simplify({ ratio 0.25, error 0.05, lockBorder:false }), prune()`, textures halved (`textureCompress webp q80 resize size/2`) when >128, `meshopt({ level:'medium' })`; falls back to `simplifySloppy` if careful kept > `WORTH = 0.65`; skips LOD when still >65% (lines 28-29, 65-89). Rigged kinds (catalogue `rig: true`) skipped (lines 94-100).

**`scripts/galaxy-textures.mjs`** (183 lines; Poly Haven → `public/cc0/galaxy/<role>/`): 32 `ROLES` (lines 43-85: adobe, stone, metal, paint, bark, wood, concrete, rock, sand, snow, grass, needles, leaves, mud, ash, redsoil, gravel, beach, tiles, deck, redrock, mossrock, dryground, stones, aerialrock, snowfield, moss, swampmud, paving). 1K set: colour → "detail map" (luma-centred to `mean`, chroma kept at `keep`; lines 94-107) WebP q82 1024², normal WebP q82 1024², ARM WebP q80 512² (lines 148-150). `index.json` keeps `metres` from Poly Haven dimensions (line 152). `--ultra`: 8192² `color-xl`/`normal-xl` as KTX2 UASTC level 1 (rdo 1→3→6 until ≤ `XL_MAX` 48 MB; lines 111-127), flipY, WebP q84 only where ktx2 verdict says keep (normals always KTX2). Header: "85 MB where an 8192 WebP decodes to 256 MB" (line 19-20). Output committed; site never calls Poly Haven at runtime (line 29-30).

**`scripts/office-simplify.mjs`** (35 lines): one file `public/models/office/plant.glb`, mesh `low.008` to ≤1800 tris via `MeshoptSimplifier.simplify(…, error 0.05, ['LockBorder'])`, rewritten `meshopt({ level: 'high' })` (lines 11-34).

**`scripts/assets-fetch.mjs`** (74 lines): raw Quaternius packs from a GitHub release `assets-quaternius` into git-ignored `lab/assets/<pack>/` (lines 18-20). `PACKS` (lines 24-34): ual1 49 MB, ual2 53, city 235, street 4, furniture 3, space 37, farm 7, nature 414 (3 parts), naturemega 718 (4 parts). Docs: `docs/assets/quaternius.md`.

**`scripts/packs.mjs`** (117 lines): Vite build plugin `world-packs` (lines 79-105) → `dist/packs/<slug>.json` + `index.json` manifests from `src/components/worlds/packs.js` PACKS: each world's JS/CSS chunks (from `.vite/manifest.json`) + its public files (globs), with sha256-16 hashes and a version hash `v` (lines 43-54); for the runtime installer (`src/runtime/install.js`). Fails the build when a world's source names an asset its pack misses (`scripts/pack-check.mjs`).

**Summary of what compression every imported GLB gets:** meshopt (`EXT_meshopt_compression`, levels: sketchfab-import/flatten/surface-lod `medium`; sketchfab-batch/office-simplify `high`; galaxy-lod QUANTIZE + `KHR_mesh_quantization`; kenney via CLI `optimize --compress meshopt`) plus WebP textures (q80–92, ≤256/512/1024/2048 per script). KTX2 only via `scripts/ktx2.mjs convert` run by hand on chosen files, and automatically for the `-xl` 8192 core scans and `public/textures/universe/*-xl.ktx2`. No Draco anywhere. Runtime loader comment asserts "every GLB here is meshopt-compressed" (gltf.js:1-2).

## 8. Measured: GLB extensions, meshopt coverage, texture sizes in use (this checkout, 2026-10-08)

Scan of every `.glb` under `public/` (1631 GLBs, 2744 embedded images; script run in this session):
- `extensionsUsed` counts: `EXT_meshopt_compression` 1312, `KHR_mesh_quantization` 968, `EXT_texture_webp` 868, `KHR_materials_emissive_strength` 56, `KHR_materials_specular` 53, `KHR_materials_unlit` 29, `KHR_texture_transform` 20, `KHR_texture_basisu` 10, `KHR_materials_transmission` 7, `KHR_materials_clearcoat` 4. **No `KHR_draco_mesh_compression` anywhere.**
- GLBs **without** meshopt: 319 (13.3 MB in all): `public/games/meshy` 231 of 699 (9.7 MB; the `act-*.glb` animation clips), `public/models/middleearth/cast` 87 of 116 (3.4 MB; `<name>-{idle,run,walk}.glb`, 24–68 KB each), `public/models/sketchfab/avengers/spiderman-moves.glb` (122 KB). Every other `public/models/*` folder is 100% meshopt. So the loader comment "every GLB here is meshopt-compressed" (gltf.js:1-2) is true of all mesh models; the exceptions are small animation-only clip files.
- Embedded image MIME: `image/webp` 2732, `image/ktx2` 12 (the 10 GLBs with `KHR_texture_basisu`: `public/hq/models/{barrel,barrier,crate,lamp,rocks,shelves,toolchest,tyre}.glb` per `npm run ktx2:hq` (package.json:31, `--slots normal`) and `public/models/galaxy/deathstar2.glb` + `deathstar2.hq.glb`; the hq one also still carries a 4096² WebP).
- Embedded texture longest side: 4096 ×7, 2048 ×265, 1536 ×22, 1024 ×1005, 768 ×12, 512 ×939, 256 ×370, 128 ×98. The 4096s: `models/galaxy/deathstar2.hq.glb` (4096² WebP 1.54 MB), `models/gen3d/{tie-fighter,tie-interceptor,x-wing}.hq.glb` (4096² each), `models/universe/death-star.hq.glb` (3 × 4096×2048).
- Standalone images under public (801 png/webp/jpg/ktx2): longest side 8192 ×3 (`textures/earth/day.webp` 8192×4096 1.40 MB, `textures/universe/sky-hq.webp` 1.14 MB, `textures/earth/night.webp` 0.65 MB), 4096 ×24 (the 7 `textures/universe/*-xl.ktx2` at 4096×2048, 0.70–5.57 MB; `hq/sky/*/sky.jpg` 4096×2048; earth clouds/relief/water), 2048 ×31, 1600 ×19, 1280 ×34.
- Loose KTX2 files: exactly 7, all `public/textures/universe/<planet>-xl.ktx2` (breakingbad 5.57 MB, marvel 5.37, music 5.33, middleearth 3.35, caribbean 3.02, rickmorty 1.27, office 0.70). No `-xl.ktx2` in `public/cc0/galaxy/` (the 8192 ultra core set is not in this checkout; `galaxy-textures.mjs:22-25`: "too big to keep in the repository... made on the owner's machine and published with the site").
- `public/hdri`: one file, `office.hdr` 429 KB. Top-level `public/`: models 418M, games 131M, audio 86M, hq 52M, textures 45M, eagler 40M, photos 15M, cc0 14M.
- Max texture the runtime will keep: `modelTexCap` 8192 at ultra, 4096 high, 1024 mid, 512 low (detail.js:366-371); shadow maps 4096/2048/1024/512 (device.js:62-65); `renderer.capabilities` limits via `maxSide` (renderer.js:29-33).

## 9. How draw calls and triangles are measured

- **`scripts/galaxy-check.mjs`** (197 lines; the QA gate): in the page, takes `renderer.info` (`window.__galaxyDebug.renderer` or `window.__surfaceScene.renderer`), sets `info.autoReset = false`, and over 4 s of rAF records `{ calls: info.render.calls, triangles: info.render.triangles, points, lines }` per frame (resetting each frame), plus `info.memory.geometries/textures`, `info.programs.length`, frame p50/p95, pixel ratio (galaxy-check.mjs:134-170). Also `glbMB` = bytes of GLBs fetched (line 173). Holds each world to `limitsFor` from `scripts/galaxy-budget.mjs` (31 lines): `calls = min(row.calls, base.calls×1.1)×scale`, `tris = row.tris===Infinity ? Infinity : min(row.tris, base.triangles×1.1)×scale` (KNOWN_OVER worlds held to their own baseline), `mb = row.modelsMB×scale`, `frame = quality==='ultra' && realGpu ? 16.7×scale : Infinity` (galaxy-budget.mjs:15-22). `KNOWN_OVER = { endor: '3.35M triangles at high, 2.04M at mid…' }` (galaxy-budget.mjs:11-13). `overBy` lists what failed (galaxy-budget.mjs:25-31).
- **`scripts/perf-probe.mjs`** (501 lines; `npm run perf`): Playwright Chromium (Mac: `--use-angle=metal --disable-gpu-vsync --disable-frame-rate-limit`; Linux: swiftshader; perf-probe.mjs:404) at VIEW `1470x956@2`. Injects a `recorder()` that monkey-patches `WebGL2RenderingContext.prototype` / `WebGLRenderingContext.prototype`: `drawElements`/`drawArrays`/`drawElementsInstanced`/`drawArraysInstanced` counted (`draws += 1`, `tris += count/3 [× instances]` when mode === TRIANGLES=4; perf-probe.mjs:146-161); `linkProgram`, `compileShader`, `getProgramParameter`, `getShaderParameter`, `texImage2D/texSubImage2D/texImage3D/texStorage2D/compressedTexImage2D`, `generateMipmap`, `bufferData/bufferSubData`, `readPixels` timed per frame with bytes estimated (RGBA ×4; `texStorage2D` ×1.33; compressed = byteLength) (perf-probe.mjs:107-145); calls >20 ms get a 3-frame stack (perf-probe.mjs:60-70). Also observes `long-animation-frame` entries (perf-probe.mjs:164-175). Per phase (load/settle/idle/move…) prints secs, fps, p50/p95/p99/max, >50 ms and >100 ms counts, links, texMB, bufMB, mean draws, mean ktris (perf-probe.mjs:210-249, 475-480). Journeys: universe, galaxy, travel, surface, avengers, shire, abq, c137, cybertron, invincible, earth, minecraft, minecraftWalk, music, scranton, citadel, dotmatrix, caribbean (perf-probe.mjs:280-385). Sets `window.__tpNoShaderChecks = true` (perf-probe.mjs:420). Optional `PROFILE=1` CDP CPU profile per phase, `TRACE=1` times draws, `STACKS=1`. Output `OUT/perf-probe.json`.
- The settings panel's live readout (`DeviceReadout.jsx`, per quality-modes spec §3) reads `rt.gfx` `renderer.info` as well.

## 10. GLB import convention: is there a doc?

There is **no single "GLB import convention" document**. What exists:
- `docs/architecture.md:78` (textures and models paragraph: one loader, meshopt, lazy KTX2, `prepare`/`tune`, antiTile) and `docs/architecture.md:116-118` (gen3d is the first choice for new models: "welded, WebP, meshopt, under 4 MB"; Sketchfab via `sketchfab-batch.mjs`/`sketchfab-import.mjs`; credits in `src/data/modelCredits.json`).
- `scripts/gen3d/README.md` ("its README is the manual", architecture.md:116) and `scripts/gen3d/budget.mjs` `TIERS` (budget.mjs:10-14): `hq` 120000 faces / 4096 tex / 10 MB (detail ultra+high), `mid` 60000 / 2048 / 4 MB, `lo` 20000 / 1024 / 1.5 MB; `ULTRA` 300000 / 8192 / 24 MB (budget.mjs:21); `MAX_BYTES = 4 MB` (budget.mjs:15). `scripts/gen3d/web.mjs` makes the three cuts (dequantize, weld, simplify with error loosened 0.01→1 until budget met, textureCompress WebP, meshopt; web.mjs:1-9, 37-41). `src/lib/three/gen3d.js` `CUTS = { ultra:'.ultra', high:'.hq', mid:'', low:'.lo' }` (gen3d.js:12), HEAD-checks `.ultra` existence (gen3d.js:29-45).
- `scripts/meshy-import.mjs` `MODELS` table (name → [tris, tex, what]; e.g. optimus-prime 24000/1024, x-wing-fighter 16000/1024, piranha-plant 8000/512; meshy-import.mjs:22-30).
- Per-script headers (sketchfab-import, sketchfab-batch, kenney, galaxy-lod, galaxy-surface-lod, flatten-glb, ktx2) each state their own rules (§7). The planets-overhaul spec's per-model polygon table (props ≤15k, houses ≤40k, landmarks ≤90k) is cited by the quality-modes spec (quality-modes-design.md:24-27).
- `README.md:419-424` lists the ktx2/model-scout/meshy/sketchfab commands. `docs/assets/quaternius.md` documents the raw packs.
- Credits conventions: `scripts/credits.mjs` builds `CREDITS.md` from `src/data/modelCredits.json` (Sketchfab, CC-BY), `public/games/credits.json` + `public/games/caribbean/credits.json` (CC0 scans/kits incl. Kenney; license strings `CC0 1.0`, `BY-SA`, `permission`), `public/hq/CREDITS.md` (table rows), `public/cc0/README.md` (hand-listed) (credits.mjs:1-8, 31-80); `site()` classifies Poly Haven / ambientCG / Kenney by URL (credits.mjs:76).

## 11. WebGPU / nodes path: where it stands

- Backend choice: `src/runtime/backend.js` `pickBackend({ gpu, shading, override, lost })` → `'webgpu'` only when `navigator.gpu` exists AND the module declares `shading: 'nodes'` (or `?gpu=webgpu` / localStorage `tp-gpu` override), `'webgl'` otherwise and always after a WebGPU device loss (backend.js:3-17). Used at `src/runtime/runtime.js:205`.
- **Modules that are 'nodes' today: none in `src/components`.** `grep -rn "shading:\s*'nodes'" src` → only `src/runtime/fixtures/nodesWorld.js:9` (a lit cube test fixture, 40 lines). Every real world module (earth, mario64, minecraft, deathstar/inside, galaxy…) is `glsl` (the default, module.js:25-27).
- `three/webgpu` and `three/tsl` are imported only in `src/runtime/webgpu.js` (dynamic imports, webgpu.js:21, 55). No TSL node materials, no `compute()`/`storage()`/`instancedArray` anywhere in `src`. three is `^0.186.1` (package.json:53).
- **Could TSL compute be used anywhere today?** Only inside a module that satisfies `shading.test.js`'s ban (no `ShaderMaterial`, `RawShaderMaterial`, `onBeforeCompile`, `EffectComposer` in its folder; shading.test.js:13). That excludes every world that uses the house look (`house.js` patches via `onBeforeCompile`), core wear, antiTile, grounding, grass/wind — i.e. all 36 scene files that import `houseOn/createHouse` (§3a list) and the 20 that import core/surface. The WebGPU backend also refuses `shader` post passes (webgpu.js:33) and offers only render+bloom via TSL `PostProcessing` (webgpu.js:21-32). So: the plumbing (renderer init, device-lost fallback, compileAsync, TSL bloom) exists and is tested against a fixture; no shipping world can take it without dropping the GLSL `onBeforeCompile` layer. The house-look spec lists "WebGPU, TSL" as out of scope (house-look-design.md:86-88).

## 12. The docs: what they concluded and what came of them

### `docs/research/2026-10-06-bruno-simon-folio.md` (162 lines; folio-2019, HEAD 540f135) — in ten lines
1. The 2019 folio has **no lights, no shadow maps, no lightmaps**: 13 matcaps (128², ~5 KB each) picked by node-name regex; counts shadeWhite 181, shadeBrown 129, shadeOrange 80, shadeGreen 30.
2. A **shader bounce**: downward faces near the floor tinted toward `#d04500` with `clamp(1 - z/1.75)*0.5` squared × `clamp((dot(n,-up)+0.6)*1.5)`.
3. A **baked floor-shadow mask per area** (512² palette PNG, 25–85 KB) on a transparent plane; **blob shadows** under movers slid away from a fixed sun; the ground is a 2×2 DataTexture gradient on a far-plane quad.
4. Shadows are never grey; all three grounding layers share one warm orange; colours via `convertLinearToSRGB`.
5. ~94k static triangles, 361 nodes, Draco, ~2 MB total.
6. Physics: cannon 0.6.2, gravity −13, `contactEquationStiffness 1000` (spongy), RaycastVehicle (mass 40, suspensionStiffness 50), props 0.1–1.5 kg, analog ramped steering, auto-flip, impact-velocity sound; pitfall: variable timestep.
7. Rendering: pixel ratio 2, no MSAA, tilt-shift blur + glow pass.
8. The later approach (Journey portal, folio-2025): "the light is in the texture, the material is Basic"; 2025 uses a palette texture indexed by UV, KTX2, Draco, instancing, Rapier, TSL/WebGPU.
9. Audit of this site at the time: 784 MeshStandardMaterial, 86 DirectionalLight, 220 castShadow, 35 shadow-map scenes, `lightMap` 0, `MeshMatcapMaterial` 0, no physics engine — but a better texture pipeline (one loader, ImageBitmap, anisotropy, KTX2, caching, warm-up).
10. Conclusion: "What it lacks is what the folio's textures carry: light, soft shadow and bounce." → spec `2026-10-06-baked-look-and-toy-physics-design.md`.

### `docs/superpowers/specs/2026-10-06-baked-look-and-toy-physics-design.md` (484 lines) — status in code
Spec: §1 `lib/three/grounding.js` (masks, bounce, blobs); §2 `scripts/bake-floor-shadows.mjs`; §3 `lib/three/matcap.js` + `scripts/matcaps.mjs`; §4 `src/lib/physics/` (cannon-es, toy settings); Albuquerque as the example; "Implementation notes (Step 1, as built)" at line 405.
- **Built:** `src/lib/three/grounding.js` (floorShadow / standIn / bounce / createBlobShadows / loadFloorShadow), `grounding-bake.js`, `groundwork.js` (`groundWorld` one-call: shadow pass off, mask, bounce, blobs, optional matcaps), `scripts/bake-floor-shadows.mjs` → `public/albuquerque/shadow/{city,rv,arches-w,arches-e}.webp` + index.json (present). `groundWorld` is used by galaxy/surface, rickmorty world + citadel, cybertron game; `groundTown` (middleearth/towns/grounded.js) by the Shire and every Middle-earth town.
- **Matcaps:** `src/lib/three/matcap.js` built (renders in-browser, not a `scripts/matcaps.mjs` offline bake — that script does not exist). `matcapFor` is called only from `groundwork.js:162` for the `matcap: [...]` roots a world names; today only the Shire (`matcap: [rimTrees]`, shire/scene.js:879) and Bree (`matcap: [rimTrees]`, bree/scene.js:781) pass any. No world's main geometry is matcap-shaded; `MeshMatcapMaterial` appears in src only in matcap.js and groundwork.js's LIT check.
- **Physics:** the spec said cannon-es; what exists is `src/lib/physics/{world,vehicle,props,heightfield,catch}.js` on `@dimforge/rapier3d-compat 0.21.0` (package.json:35), "Rapier, Bruno Simon's way (folio-2025's Physics.js)" with a fixed 1/60 s accumulator and floating origin (world.js:1-8). `grep createPhysics|physics/vehicle src/components` → **no component imports it yet**; it is library + tests only.

### `docs/superpowers/specs/2026-10-07-house-look-design.md` (88 lines) — status
Pieces 1–6 (house look, ground map, grass+wind, repaint via `flatten-glb.mjs`, supersampling `minRatio 1.25` PR #421, `?debug` panel) and the core kit: **all present** — `house.js`, `groundmap.js`, `grass.js`, `wind.js`, `core.js`, `flatten-glb.mjs`, `device.js` `minRatio`, `lib/debugPanel.js`. House look adopted by 36 scene files (§3a), core kit by 20. The spec's upstream doc `docs/research/2026-10-06-why-theirs-look-expensive.md` is **not in the repo** (referenced by house.js:3, groundmap.js, grass.js, wind.js, debugPanel.js, architecture.md and two specs).

### `docs/superpowers/specs/2026-10-07-quality-modes-design.md` (232 lines) — status
§1 Auto→ultra on laptops: in `device.js:72-77`. §2 budget table: `src/lib/budgets.js` verbatim (§4 above); `galaxy-check.mjs` reads it; gen3d `ULTRA` cut in `budget.mjs:21` and `lib/three/gen3d.js`. §3 settings panel: `src/components/settings/` (per spec; `tp-settings`, `tp-sharpness` read by `device.js:212`). §4 lanes: `galaxy-textures.mjs --ultra` exists (8192 KTX2 core set, not in checkout); universe `-xl.ktx2` planet maps exist at 4096×2048 (7 files), not 8192; `KNOWN_OVER.endor` still over the row (galaxy-budget.mjs:11-13).

### `docs/superpowers/specs/2026-10-07-smooth-worlds-design.md` (86 lines) — the GPU queue: status
§1 `src/lib/three/gpuWork.js`: **built** (`fence`, `uploadSlices`, `compileSlices`, `warmDraw`, `prepareScene`, `markLinked/knownLinked`; gpuWork.js:16-24). `prepareScene` used by galaxy, galaxy/surface, universe, office/stage3d, avengers/hq/engine, runtime.js, useScene.js, stage3d.js, LoadingVeil/loadingSteps. §2 `frameGuard.js`: **built** (wraps `renderBufferDirect` and `render`; `guard(renderer, { uploadMB, compileMs, frame, invalidate })`; `adopt` hook used by `houseOn`, house.js:305); installed by `createRenderer` when `guard` is passed (renderer.js:56; default `false`) and by the runtime's WebGL backend (`guard: { invalidate }`, webgl.js:47). §3 `LoadingVeil.jsx` + `loadingSteps.js`: present under `src/components/worlds/`. Floor-bake IndexedDB cache: `grep indexedDB src/lib/three/grounding-bake.js` → **no match** (not built as specified). §4 `calibrate.js`: **built** (`BUDGET = 12` ms GPU time, `EXT_disjoint_timer_query_webgl2`, `tp-calibration`; calibrate.js:1-22), used by universe/scene.js, runtime.js, pace.js (`set(level)` ceiling). §5 chunks: `runtime/chunkGrid.js`, `workers.js`, `origin.js` present.
