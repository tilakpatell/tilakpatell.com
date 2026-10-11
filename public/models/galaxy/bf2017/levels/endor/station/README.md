# endor/station: the game's level

From `s8_1/endor_04` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs s8_1/endor_04 --world endor --district station --spot 446 299 --keep ewok*,platformsystem*,bridgeportablesystem*,hangar*,detailhangar*,bunkersystem*,bs_01*,controlroom*,catwalk*,landingplatform*,storageunit*,courtyard*,floorboards*,endorbase*,landingpad*,cargo_shuttle*`; do not edit by hand.

- 8294 instances in the arena (±1024 m), 3 beyond it (the horizon), 3932 left out under the ground (an interior: its own pack, `--inside`), 38 cells of 128 m
- 580 meshes (3 left out), 1320 LOD files, 31.37 MB
- the far list 0.25 MB; terrain near 0.80 MB, far 0.12 MB; the spot's ground 225.30 m in the game
- textures missing from the bucket: 3

| | low | mid | high |
|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 20 (20 m, 400 m) | 30 (30 m, 600 m) | 43 (43 m, 860 m) |
| meshes dropped (instances) | 101 (2541) | 59 (1528) | 0 (0) |
| worst place: triangles, calls | 702k, 295 | 1280k, 447 | 2249k, 623 |
| texture bytes (every map the level has) | 31.77 MB | 103.56 MB | 103.56 MB |

Dropped on low: tuskencamp_pole_01b ×7, ms_forestbase_log_01_a ×4, forestbase_log_01_branch_b ×4, square_shadow_01 ×5, tuskencamp_hangingropestraight_01a ×2, forestbase_mudfloor_01 ×42, tuskencamp_hangingropestraight_01b ×2, forestbase_waterfall_foam_01 ×12, tuskencamp_hangingropestraightbone_01a ×5, tuskencamp_hangingropeangledbone_01a ×1, skinanimal_01_b ×2, ms_forestbase_log_01_b ×29, decalringvardos_01 ×4, watersplashsmall_01 ×102, forestbase_dirtwall_interiror_01 ×1, forestbase_treesmall_02_destroyedstump ×49, forestbase_caverockcluster_01 ×13, forestbase_treebackdrop_04 ×2, forestbase_treesplit_02 ×31, forestbase_roots_01_a ×51, tuskencamp_hangingropeangledbone_01b ×6, o_kam_antennae_s_01 ×6, forestbase_logsmall_01 ×74, forestbase_treesmall_01_destroyedstump ×56, forestbase_caverockmedium_02 ×42, forestbase_logmedium_02_b_addons_02 ×14, forestbase_logmedium_02_b_addons_01 ×14, forestbase_caverockcluster_moss_01 ×74, forestswamp_wateralgae_01_forest02cluster_01 ×1, entanceplatform_corner_01 ×2, forestbase_cavewallrocklarge_03a ×2, forestbase_loglarge_01_b_addons_02 ×2, forestbase_loglarge_01_b_addons_01 ×2, forestbase_logmedium_02_a_addons_02 ×34, forestbase_logmedium_02_a_addons_01 ×34, forestswamp_waterpads_01_forest02cluster_04 ×4, at_at_station_bunker_doorframe_01 ×1, forestbase_treesplit_01 ×27, forestbase_treebackdrop_03 ×4, entanceplatform_corner_02 ×3, forestbase_treestump_01 ×7, forestbase_caverockmedium_01 ×84, forestbase_logmedium_01 ×36, forestswamp_wateralgae_01_forest02cluster_04 ×5, forestbase_waterfallsmall_01 ×12, platformcluster_02 ×1, forestbase_treemedium_01_bottom ×136, forestbase_treemedium_01_top ×138, forestbase_treesmall_02_destroyedtrunk ×6, o_nab_oilsplatter_04 ×1, o_nab_oilsplatter_02 ×1, dirtdecals_06 ×2, o_nab_oilsplatter_03 ×26, hosefolding_01 ×1, entanceplatform_straight_02 ×3, tuskencamp_hangingropetriangle_01a ×8, hosefolding_04 ×1, controlpanellarge_04 ×2, forestbase_waterfallmedium_01 ×6, dsi_hangarsystem_decalarray_corner_01_b ×201, tuskencamp_hangingropetriangle_01b ×8, hosefolding_09 ×2, forest_treestump_03_b ×18, lightground_01 ×23, entanceplatform_straight_01 ×4, imperial_base_waterdrainage_01 ×1, forestbase_loglarge_01_b ×2, hosefolding_02 ×5, hosefolding_07 ×23, forestbase_treestump_04 ×32, forestbase_cavewallrocklarge_02a ×6, hosefolding_03 ×9, cavewallrocklarge01a_log_01 ×4, imperial_base_outergate_doorframe_small_01 ×1, forestbase_logmedium_02_b ×14, imperialshuttleplatform_01 ×1, forestbase_logmedium_01_addons_01 ×36, forestbase_logmedium_01_addons_a ×0, forestbase_cavewallrocklarge_01a ×6, forestbase_waterfallmediumrocks_01 ×6, forest_treestump_03 ×21, forestburnt_logmedium_01 ×4, forestbase_waterfallsmallrocks_01 ×17, forestbase_cliffhuge_01_waterstreams_02 ×9, forestbase_rocklarge_02 ×39, forestbase_cliffhuge_01_moss_cap_01 ×71, forestbase_logmedium_02_a ×34, forestbase_cliffhuge_01_waterstreams_01 ×11, platformcluster_03 ×1, imperial_base_outergate_doorframe_01 ×1, forestbase_cavewallrocklarge_01b ×23, forestbase_cliffhuge_01_moss_01 ×98, clusteredfloorgrill03d_forest01_01 ×1, imperial_base_wall_01 ×14, forestswamp_treelarge_02_bottom ×2, forestswamp_treelarge_02_top ×2, forestswamp_treelarge_01_bottom ×4, forestswamp_treelarge_01_top ×4, forestbase_rocklarge_03 ×200, imperialshuttletydirium_01_landmark ×2, forestbase_dirtwall_01 ×335

Dropped on mid: o_nab_oilsplatter_03 ×26, tuskencamp_pole_01b ×7, ms_forestbase_log_01_a ×4, forestbase_log_01_branch_b ×4, square_shadow_01 ×5, tuskencamp_hangingropestraight_01a ×2, forestbase_mudfloor_01 ×42, tuskencamp_hangingropestraight_01b ×2, forestbase_waterfall_foam_01 ×12, tuskencamp_hangingropestraightbone_01a ×5, tuskencamp_hangingropeangledbone_01a ×1, skinanimal_01_b ×2, ms_forestbase_log_01_b ×29, decalringvardos_01 ×4, watersplashsmall_01 ×102, forestbase_dirtwall_interiror_01 ×1, cable_floor_custom_03 ×2, forestbase_treesmall_02_destroyedstump ×49, forestbase_roots_01_d ×47, forestbase_caverockcluster_01 ×13, forestbase_treebackdrop_04 ×2, forestbase_treesplit_02 ×31, forestbase_roots_01_a ×51, tuskencamp_hangingropeangledbone_01b ×6, ms_forestbase_roots_01_b ×51, forestburnt_treestump_fire_04 ×2, o_kam_antennae_s_01 ×6, bd_antennaindustrial_01_c ×2, forestbase_logsmall_01 ×74, forestbase_treesmall_01_destroyedstump ×56, forestbase_caverockmedium_02 ×42, forestbase_logmedium_02_b_addons_02 ×14, forestbase_logmedium_02_b_addons_01 ×14, forestbase_caverockcluster_moss_01 ×74, forestswamp_wateralgae_01_forest02cluster_01 ×1, forestbase_waterfallsmall_02 ×8, entanceplatform_corner_01 ×2, forestbase_cavewallrocklarge_03a ×2, forestburnt_treestump_fire_03 ×4, forestbase_loglarge_01_b_addons_02 ×2, forestbase_loglarge_01_b_addons_01 ×2, forestbase_logmedium_02_a_addons_02 ×34, forestbase_logmedium_02_a_addons_01 ×34, forestswamp_waterpads_01_forest02cluster_04 ×4, at_at_station_bunker_doorframe_01 ×1, forestbase_treesplit_01 ×27, forestbase_treebackdrop_03 ×4, entanceplatform_corner_02 ×3, forestbase_rockmedium_02 ×180, forestbase_treestump_01 ×7, forestbase_waterfallsmallrocks_02 ×8, forestbase_caverockmedium_01 ×84, forestbase_logmedium_01 ×36, forestbase_logmedium_01b_addons_01 ×9, forestswamp_wateralgae_01_forest02cluster_04 ×5, forestbase_waterfallsmall_01 ×12, platformcluster_02 ×1, forestbase_treemedium_01_bottom ×136, forestbase_treemedium_01_top ×138

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 137 | 18.3 KB | lane R's placed.js |
| actors.json | 0 | 0.4 KB | the scene's life rows |
| vehicles.json | 0 | 0.0 KB | the scene's rides and things |
| decals.json | 0 | 0.1 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 699 | 105.4 KB | fidelity X (nothing until it merges) |
| tracks.json | 2 | 1.5 KB | src/lib/three/animTracks.js |
| probes.json and probes/ | 0 | 0.0 KB | levelProbes.js, lane R's grid |
| shadow/far.png | 0 | 0.0 KB | fidelity S (level.json's shadowCache) |
| scatter.json | 1 | 249.8 KB | fidelity N |

Not placed (no kind on the site yet, or scenery): forestbase_shrublarge_01_skinned ×222, forestbase_shrubmedium_01_skinned ×169, forestbase_shrubsmall_01_skinned ×35. Decals skipped: sub 2, texture 11. Tracks of owners the pack lacks: 23.

<!-- physics -->
## Physics

The game's shapes (`node scripts/bf2017-physics.mjs`).

| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 447 | 3992 | 193286 | 6 | 2 | 0 | 4386416 |

| heaviest cells | colliders | trimesh triangles |
| --- | --- | --- |
| 0,1 | 4251 | 236438 |
| -1,1 | 3643 | 233759 |
| -1,0 | 3591 | 268735 |
| 0,3 | 2488 | 153960 |
| 1,2 | 2427 | 162064 |
| 0,2 | 2385 | 154816 |
| 1,3 | 1916 | 147488 |
| 0,-1 | 1897 | 137135 |
| 0,-2 | 1627 | 91781 |
| 0,0 | 1437 | 81541 |
<!-- /physics -->
