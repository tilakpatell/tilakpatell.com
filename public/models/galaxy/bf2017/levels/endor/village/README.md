# endor/village: the game's level

From `s2_1/levels/endor_02` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs s2_1/levels/endor_02 --world endor --district village --spot -386 71 --subs endor_02,art,content --keep ewok*`; do not edit by hand.

- 7281 instances in the arena (±1024 m), 3 beyond it (the horizon), 1489 left out under the ground (an interior: its own pack, `--inside`), 38 cells of 128 m
- 250 meshes (4 left out), 583 LOD files, 14.86 MB
- the far list 0.22 MB; terrain near 2.19 MB, far 1.40 MB; the spot's ground 540.56 m in the game
- textures missing from the bucket: 0

| | low | mid | high |
|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 20 (20 m, 400 m) | 30 (30 m, 600 m) | 40 (40 m, 800 m) |
| meshes dropped (instances) | 72 (2854) | 83 (2692) | 45 (1153) |
| worst place: triangles, calls | 717k, 263 | 1161k, 305 | 2362k, 430 |
| texture bytes (every map the level has) | 12.28 MB | 37.74 MB | 37.74 MB |

Dropped on low: imperial_stormtrooper_male_01_helmet_static ×1, waterplane_forest_06 ×1, forestbase_webmarac_01a_forest_06 ×42, tuskencamp_hangingropestraight_01a ×1, tuskencamp_sticks_01a ×10, forestbase_waterfall_foam_01_forest_06 ×7, tuskencamp_campfire_01a ×10, tuskencamp_boneornament_01a ×36, tuskencamp_hangingropestraightbone_01a ×5, atatlegcalf_01 ×1, atat_destroyed_part_01 ×4, at-st_01_wreckpart_leg_01 ×2, forestburnt_logsmall_fire_01 ×4, at-st_01_wreckpart_head_01 ×2, forestbase_logmedium_02_b_addons_02 ×2, forestbase_logmedium_02_b_addons_01 ×2, forestswamp_wateralgae_01 ×62, forestbase_waterfallsmall_02 ×1, forest06_logcave_01_b ×116, forestbase_caverockcluster_01 ×21, forestburnt_treestump_05 ×22, tuskencamp_hangingropestraight_01b ×41, forestbase_logmedium_02_a_addons_02 ×10, forestbase_logmedium_02_a_addons_01 ×10, forestbase_treesmall_02_destroyedtrunk ×1, atatleg_01 ×1, forestburnt_logsmall_01 ×24, forestbase_logsmall_01 ×75, forest06_waterfall_small_01 ×2, forestbase_treemedium_02_bottom ×3, forestbase_treemedium_02_bottom_nosound ×241, forestbase_treemedium_02_top ×278, forestbase_caverockmedium_02 ×39, forestbase_loglarge_01_b_addons_02 ×1, forestbase_loglarge_01_b_addons_01 ×1, forestburnt_treestump_fire_06 ×10, forestbase_rocksmall_01 ×254, forestbase_treemedium_01_bottom_burnt ×43, forestbase_cliffhuge_01_waterstreams_01_forest_06 ×1, forestswamp_wateralgae_01_forest02cluster_01 ×1, forestburnt_treestump_02 ×32, forestburnt_treestump_06 ×15, forestbase_loglarge_01_a_addons_02 ×2, forestbase_loglarge_01_a_addons_01 ×2, forestswamp_waterpads_01_forest02cluster_06 ×1, forestburnt_treestump_03_b_destructible_fire_01 ×8, forestbase_cliffhuge_01_waterstreams_01 ×2, forestbase_logmedium_02_b ×4, forestbase_treeshadow_01 ×4, forestburnt_treestump_fire_01 ×8, atat_destroyed_interior_01 ×1, forestbase_loglarge_01_b ×1, forestbase_treesmall_01 ×1, forestburnt_treestump_fire_04 ×14, forestbase_rocklarge_02 ×11, forestbase_loglarge_01_a ×2, forestswamp_treelarge_02_moss_03 ×9, forestbase_rockmedium_02 ×333, forestburnt_treestump_03 ×10, forestburnt_wooddebris_02 ×77, forestswamp_treelarge_02_moss_01 ×9, forestbase_waterfallsmallrocks_01 ×8, forestswamp_treelarge_02_moss_02 ×9, forestbase_waterfallsmallrocks_02 ×19, forestbase_treemedium_01_bottom_nosound ×241, forestbase_treemedium_01_top ×288, forestbase_logmedium_02_a ×19, forestbase_waterfallmediumrocks_01 ×5, forestbase_treemedium_02_bottom_burnt ×31, forestbase_cliffhuge_01_moss_cap_01 ×46, tuskencamp_hangingropetriangle_01a ×15, forestbase_caverockmedium_01 ×239

Dropped on mid: imperial_stormtrooper_male_01_helmet_static ×1, waterplane_forest_06 ×1, forestbase_webmarac_01a_forest_06 ×42, tuskencamp_hangingropestraight_01a ×1, atat_destroyed_part_02 ×1, tuskencamp_sticks_01a ×10, forestbase_waterfall_foam_01_forest_06 ×7, tuskencamp_campfire_01a ×10, at-st_01_wreckpart_leg_02 ×2, tuskencamp_boneornament_01a ×36, tuskencamp_hangingropestraightbone_01a ×5, forestbase_treesmall_01_destroyedstump ×6, atatlegcalf_01 ×1, atat_destroyed_part_01 ×4, tuskencamp_skullbantha_01 ×10, at-st_01_wreckpart_leg_01 ×2, forestburnt_logsmall_fire_01 ×4, at-st_01_wreckpart_head_01 ×2, at-st_01_wreckpart_body_01 ×2, forestbase_logmedium_02_b_addons_02 ×2, forestbase_logmedium_02_b_addons_01 ×2, forestswamp_wateralgae_01 ×62, tuskencamp_boneornament_01b ×8, tuskencamp_urnmedium_01a ×6, speederbike_01 ×1, forestbase_waterfallsmall_02 ×1, forest06_logcave_01_b ×116, forestbase_rockmedium_01 ×8, forestbase_logmedium_01 ×4, forest06_rootscave_01_a ×50, forestbase_caverockcluster_01 ×21, forestburnt_treestump_05 ×22, tuskencamp_hangingropestraight_01b ×41, forestburnt_treestump_fire_02 ×10, forestbase_logmedium_02_a_addons_02 ×10, forestbase_logmedium_02_a_addons_01 ×10, forestbase_treesmall_02_destroyedtrunk ×1, atatleg_01 ×1, forestburnt_logsmall_01 ×24, forestbase_logsmall_01 ×75, forest06_waterfall_small_01 ×2, forestbase_treemedium_02_bottom ×3, forestbase_treemedium_02_bottom_nosound ×241, forestbase_treemedium_02_top ×278, forestbase_caverockmedium_02 ×39, forestbase_loglarge_01_b_addons_02 ×1, forestbase_loglarge_01_b_addons_01 ×1, forestbase_logmedium_01_addons_01 ×4, forestbase_logmedium_01_addons_a ×69, forestbase_logmedium_01_addons_c ×0, forestbase_logmedium_01_addons_d ×11, forestburnt_treestump_fire_06 ×10, forestbase_rocksmall_01 ×254, forestbase_treemedium_01_bottom_burnt ×43, forestbase_cliffhuge_01_waterstreams_01_forest_06 ×1, forestswamp_wateralgae_01_forest02cluster_01 ×1, forestburnt_treestump_02 ×32, forestburnt_treestump_06 ×15, forestbase_loglarge_01_a_addons_02 ×2, forestbase_loglarge_01_a_addons_01 ×2, forestswamp_waterpads_01_forest02cluster_06 ×1, forestburnt_treestump_03_b_destructible_fire_01 ×8, forestbase_cliffhuge_01_waterstreams_01 ×2, forestbase_logmedium_02_b ×4, forestbase_treeshadow_01 ×4, forestburnt_treestump_fire_01 ×8, atat_destroyed_interior_01 ×1, forestbase_loglarge_01_b ×1, forestbase_treesmall_01 ×1, forestburnt_treestump_fire_04 ×14, forestbase_rocklarge_02 ×11, canopy_01 ×1, forestbase_loglarge_01_a ×2, forestswamp_treelarge_02_moss_03 ×9, forestbase_rockmedium_02 ×333, forestburnt_treestump_03 ×10, forestburnt_wooddebris_02 ×77, forestswamp_treelarge_02_moss_01 ×9, forestbase_waterfallsmallrocks_01 ×8, forestswamp_treelarge_02_moss_02 ×9, forestbase_waterfallsmallrocks_02 ×19, forestbase_treemedium_01_bottom_nosound ×241, forestbase_treemedium_01_top ×288

Dropped on high: tuskencamp_boneornament_01b ×8, waterplane_forest_06 ×1, forestbase_webmarac_01a_forest_06 ×42, forestbase_treesmall_02_destroyedstump ×2, tuskencamp_hangingropestraight_01a ×1, tuskencamp_urnmedium_01a ×6, speederbike_01 ×1, atat_destroyed_part_02 ×1, tuskencamp_sticks_01a ×10, forestbase_waterfall_foam_01_forest_06 ×7, tuskencamp_campfire_01a ×10, forestbase_rocksmall_02 ×6, at-st_01_wreckpart_leg_02 ×2, tuskencamp_boneornament_01a ×36, tuskencamp_hangingropestraightbone_01a ×5, forestbase_treesmall_01_destroyedstump ×6, atatlegcalf_01 ×1, atat_destroyed_part_01 ×4, tuskencamp_skullbantha_01 ×10, at-st_01_wreckpart_leg_01 ×2, forestburnt_logsmall_fire_01 ×4, at-st_01_wreckpart_head_01 ×2, at-st_01_wreckpart_body_01 ×2, forestbase_logmedium_02_b_addons_02 ×2, forestbase_logmedium_02_b_addons_01 ×2, forestswamp_wateralgae_01 ×62, forestbase_waterfallsmall_02 ×1, forest06_logcave_01_b ×116, forestbase_rockmedium_01 ×8, forestbase_logmedium_01 ×4, forest06_rootscave_01_a ×50, forestbase_caverockcluster_01 ×21, forestburnt_treestump_05 ×22, tuskencamp_hangingropestraight_01b ×41, forestburnt_treestump_fire_02 ×10, forestbase_logmedium_02_a_addons_02 ×10, forestbase_logmedium_02_a_addons_01 ×10, forestbase_treesmall_02_destroyedtrunk ×1, atatleg_01 ×1, forestburnt_logsmall_01 ×24, forestbase_logsmall_01 ×75, forest06_waterfall_small_01 ×2, forestbase_treemedium_02_bottom ×3, forestbase_treemedium_02_bottom_nosound ×241, forestbase_treemedium_02_top ×278

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 148 | 16.4 KB | lane R's placed.js |
| actors.json | 0 | 0.4 KB | the scene's life rows |
| vehicles.json | 0 | 0.0 KB | the scene's rides and things |
| decals.json | 0 | 0.1 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 232 | 36.3 KB | fidelity X (nothing until it merges) |
| tracks.json | 2 | 1.5 KB | src/lib/three/animTracks.js |
| probes.json and probes/ | 7 | 675.7 KB | levelProbes.js, lane R's grid |
| shadow/far.png | 0 | 0.0 KB | fidelity S (level.json's shadowCache) |
| scatter.json | 1 | 397.4 KB | fidelity N |

Not placed (no kind on the site yet, or scenery): forestbase_shrublarge_01_skinned ×75, forestbase_shrubmedium_01_skinned ×40, forestbase_shrubsmall_01_skinned ×26. Decals skipped: sub 2. Tracks of owners the pack lacks: 23.

<!-- physics -->
## Physics

The game's shapes (`node scripts/bf2017-physics.mjs`).

| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 182 | 1452 | 92874 | 0 | 3 | 0 | 2089848 |

| heaviest cells | colliders | trimesh triangles |
| --- | --- | --- |
| -1,-1 | 8995 | 378776 |
| -2,-2 | 5565 | 243667 |
| -1,-2 | 5390 | 253254 |
| -1,-3 | 2077 | 93480 |
| -2,-1 | 1893 | 85671 |
| 0,-1 | 1723 | 90337 |
| -2,-3 | 1527 | 74766 |
| -1,0 | 1195 | 59450 |
| 0,-2 | 859 | 47167 |
| -2,0 | 672 | 38881 |
<!-- /physics -->
