# scarif: the game's level

From `s9_3/scarif/levels/mp/scarif_02` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs s9_3/scarif/levels/mp/scarif_02 --world scarif --spawn --subs Scarif_02,Phase_02,Phase_02_Unique --share low=0.6 --ultra`; do not edit by hand.

- 4383 instances in the arena (±1024 m), 114 beyond it (the horizon), 23 left out under the ground (an interior: its own pack, `--inside`), 67 cells of 128 m
- proxies by their shaders, never drawn (materials.jsonl: SS_Shadowmesh casts shadows only, SS_VirtualTextureOnly paints the terrain's virtual texture only): none
- never drawn as themselves (the NEVER rule: lighting proxies, light blockers, occluders, invisible collision, shadow-only meshes, destruction stages): mesh_light_cone_00 ×28
- fitted to a share of the tiers' rows: low 0.6
- 538 meshes (152 left out), 767 LOD files, 23.90 MB
- the far list 0.13 MB; terrain near 0.79 MB, far 0.16 MB; the spot's ground 212.95 m in the game
- textures missing from the bucket: 6
- ultra's maps held to 256.00 MB (lod.js's TEX_MB): 352.10 MB as the table gives them, 37 stepped down a size or more toward high's, normal and ORM first

| | low | mid | high | ultra |
|---|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 20 (20 m, 400 m) | 1000 (1000 m, 20000 m) | 1000 (1000 m, 20000 m) | 1000 (1000 m, 20000 m) |
| meshes dropped (instances) | 15 (304) | 0 (0) | 0 (0) | 0 (0) |
| worst place: triangles, calls | 210k, 188 | 793k, 340 | 828k, 340 | 1301k, 380 |
| texture bytes (every map the level has) | 14.49 MB | 45.60 MB | 45.60 MB | 243.80 MB |
| mesh bytes a tier can draw (its LODs, its meshes) | 8.33 MB | 12.10 MB | 14.72 MB | 23.90 MB |

Dropped on low: hangarcablefloor_s_128_01 ×4, controlroom_01_floorbeam_01_384x16x16 ×2, hosefolding_07 ×2, hosefolding_01 ×1, hangarcablefloor_s_512_02 ×1, hangarcablefloor_s_256_connector_02 ×3, cratelarge_03_support ×182, controlpanellarge_04 ×21, boxmedium_06_stack_01 ×10, fueltank_01 ×14, trainstation_01_door_02_a ×2, controlroom_01_wallroof_01_short_01_112x56x336_scarifversion ×4, generator_03_cap ×21, boxmedium_06_stack_03 ×33, controlroom_01_wall1panel_01_112x304x64 ×4

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 16 | 2.4 KB | lane R's placed.js |
| actors.json | 0 | 0.1 KB | the scene's life rows |
| vehicles.json | 0 | 0.0 KB | the scene's rides and things |
| decals.json and tex/decals/ | 0 | 0.1 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 12 | 1.7 KB | fidelity X's effects |
| tracks.json | 0 | 1.2 KB | src/lib/three/animTracks.js |
| probes.json and probes/ | 0 | 0.0 KB | levelProbes.js, lane R's grid |
| shadow/far.png | 1 | 836.1 KB | fidelity S (level.json's shadowCache) |
| scatter.json | 0 | 0.0 KB | fidelity N |

Not placed (no kind on the site yet, or scenery): none. Decals skipped: none. Tracks of owners the pack lacks: 25.

<!-- physics -->
## Physics

The game's shapes (`node scripts/bf2017-physics.mjs`).

| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 441 | 2808 | 121485 | 1 | 5 | 0 | 2816592 |

| heaviest cells | colliders | trimesh triangles |
| --- | --- | --- |
| -2,0 | 3264 | 135246 |
| -3,0 | 2324 | 100592 |
| -2,-1 | 973 | 37799 |
| -1,-1 | 836 | 34132 |
| -1,0 | 685 | 28238 |
| -3,-1 | 629 | 25324 |
| -2,-3 | 85 | 2304 |
| -4,0 | 75 | 540 |
| -2,1 | 72 | 1558 |
| -6,0 | 40 | 0 |
<!-- /physics -->

## Variations

Written by `node scripts/bf2017-variations.mjs scarif` from the level's 12 mesh variation databases (variations.json, 0.45 MB).

| meshes | with variations | applied by instances | by the level rule | mixed (default drawn) | textures missing from the bucket | maps not in the pack |
|---|---|---|---|---|---|---|
| 538 | 73 | 31 | 0 | 8 | 12 | 0 |
