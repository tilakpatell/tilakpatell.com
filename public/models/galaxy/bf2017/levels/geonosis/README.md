# geonosis: the game's level

From `s5_1/levels/mp/geonosis_01` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs s5_1/levels/mp/geonosis_01 --world geonosis --spawn --subs geonosis_01,world_content,world_factory,content`; do not edit by hand.

- 7672 instances in the arena (±1024 m), 440 beyond it (the horizon), 401 left out under the ground (an interior: its own pack, `--inside`), 128 cells of 128 m
- 271 meshes (0 left out), 912 LOD files, 24.47 MB
- the far list 0.23 MB; terrain near 5.06 MB, far 3.06 MB; the spot's ground 165.84 m in the game
- textures missing from the bucket: 0

| | low | mid | high |
|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 20 (20 m, 400 m) | 30 (30 m, 600 m) | 1000 (1000 m, 20000 m) |
| meshes dropped (instances) | 51 (1844) | 0 (0) | 0 (0) |
| worst place: triangles, calls | 718k, 138 | 1333k, 248 | 2577k, 404 |
| texture bytes (every map the level has) | 20.37 MB | 64.15 MB | 64.15 MB |

Dropped on low: geo_emissive_plane_01 ×2, floor_03_0x256 ×11, square_shadow_01 ×1, floor_01_256x256 ×2, floor_04_256x256 ×2, geonosis_bones_ribcage_01 ×2, geo_desertcanyon_rockmedium_02 ×5, geo_laat_destroyed_01_engine_right_front ×15, geo_desertcanyon_rockmedium_01 ×18, geo_arenapillar_03 ×9, geo_laat_destroyed_01_engine_left ×10, geo_tarptriangle_01 ×3, geo_factorytunnel_01_midpart ×8, geo_tarpropes_01 ×1, geo_laat_destroyed_01_wing_right ×14, geo_laat_destroyed_01_door_left ×12, geo_laat_destroyed_01_door_right ×11, geo_arenapillar_01 ×2, at_te_cannonbroken ×12, baserockformationmedium_01 ×24, geo_baserockspiremedium_01_b ×24, desertcanyon_clifflarge_03_noterrainblend ×2, geo_baserockpuddle_01 ×7, rep_commandcenterdamaged_02 ×4, at_te_middlelegbottombroken ×25, baserockformationlarge_02_e ×15, at_te_middleclean ×12, geo_factoryentrancedoor_01 ×2, geo_factorytunnellong_01_c90 ×1, t_geo_baserockformationmedium_02_a ×19, t_geo_baserockformationmedium_02_b ×32, baserockwalllarge_01 ×3, geo_factorytunnel_01_t ×2, geo_desertcanyon_rockcluster_01a ×62, geo_laat_destroyed_01_bottom_back ×11, at_te_frontlegbroken ×23, baserockformationmedium_03 ×71, geo_baserockformationmedium_04_b ×73, geo_laat_destroyed_01_wing_left ×12, geo_factoryentrancewall_02 ×4, geo_factoryentranceceiling_01 ×2, baserockpile_01 ×454, baserockformationlarge_02_c ×50, geo_laat_destroyed_01_body_front ×14, at_te_backbroken ×13, desertcanyon_rockmedium_04 ×217, at_te_frontbroken ×13, geo_laat_destroyed_01_body_back ×14, geo_baserockformationmedium_04 ×90, geo_baserockformationlarge_01 ×58, desertcanyon_rockmedium_03_geo ×351

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 25 | 3.5 KB | lane R's placed.js |
| actors.json | 0 | 0.9 KB | the scene's life rows |
| vehicles.json | 0 | 0.3 KB | the scene's rides and things |
| decals.json | 121 | 36.6 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 196 | 29.4 KB | fidelity X (nothing until it merges) |
| tracks.json | 0 | 1.2 KB | src/lib/three/animTracks.js |
| probes.json and probes/ | 5 | 482.7 KB | levelProbes.js, lane R's grid |
| shadow/far.png | 1 | 34.2 KB | fidelity S (level.json's shadowCache) |
| scatter.json | 1 | 616.9 KB | fidelity N |

Not placed (no kind on the site yet, or scenery): dwarfspiderdroid_proxy_skinned ×12, dwarfspiderdroid_skinned ×27, geo_homingspiderdroid_anim ×13, rep_hardcellclass_01_scaled_skinned ×2, Ground_Vehicle_AT_TE ×24, HomingSpiderDroidGunBottom ×9, HomingSpiderDroidGunTop ×9, V_HardCellClass_01 ×2. Decals skipped: texture 53, sub 7. Tracks of owners the pack lacks: 25.

<!-- physics -->
## Physics

The game's shapes (`node scripts/bf2017-physics.mjs`).

| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 214 | 1719 | 305755 | 6 | 13 | 0 | 6263416 |

| heaviest cells | colliders | trimesh triangles |
| --- | --- | --- |
| 0,-1 | 7088 | 564156 |
| 0,0 | 5613 | 387052 |
| 0,-2 | 4993 | 384002 |
| -1,-1 | 4136 | 345035 |
| 0,-3 | 4028 | 252991 |
| 1,-1 | 3888 | 233937 |
| 0,1 | 3775 | 247154 |
| 1,0 | 3069 | 190487 |
| -1,-2 | 2747 | 191648 |
| 0,5 | 2725 | 224843 |
<!-- /physics -->
