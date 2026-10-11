# kessel: the game's level

From `s3/levels/kessel_01` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs s3/levels/kessel_01 --world kessel --spot 0 -53 --subs Kessel_01,Art --ultra`; do not edit by hand.

- 6308 instances in the arena (±1024 m), 53 beyond it (the horizon), 41 left out under the ground (an interior: its own pack, `--inside`), 38 cells of 128 m
- proxies by their shaders, never drawn (materials.jsonl: SS_Shadowmesh casts shadows only, SS_VirtualTextureOnly paints the terrain's virtual texture only): none
- never drawn as themselves (the NEVER rule: lighting proxies, light blockers, occluders, invisible collision, shadow-only meshes, destruction stages): kes_enlightenshadowblocker_01 ×18, enlightenmesh_genericsquare ×6, kes_maininteriorlightblocker_01 ×1
- 393 meshes (0 left out), 995 LOD files, 23.89 MB
- the far list 0.19 MB; terrain near 0.10 MB, far 0.01 MB; the spot's ground 578.00 m in the game
- textures missing from the bucket: 0
- ultra's maps held to 256.00 MB (lod.js's TEX_MB): 556.49 MB as the table gives them, 193 stepped down a size or more toward high's, normal and ORM first

| | low | mid | high | ultra |
|---|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 20 (20 m, 400 m) | 30 (30 m, 600 m) | 170 (170 m, 3400 m) | 1000 (1000 m, 20000 m) |
| meshes dropped (instances) | 165 (3999) | 126 (3008) | 0 (0) | 0 (0) |
| worst place: triangles, calls | 718k, 157 | 1349k, 239 | 2698k, 496 | 3499k, 534 |
| texture bytes (every map the level has) | 20.24 MB | 60.79 MB | 60.79 MB | 243.92 MB |
| mesh bytes a tier can draw (its LODs, its meshes) | 5.54 MB | 10.30 MB | 19.81 MB | 23.89 MB |

Dropped on low: o_kes_cave_stalagmite_04 ×21, leak_02_c ×6, yavintemple_pipe_support_02 ×27, leak_01_c ×7, leak_02_c ×13, kes_minepipessmall_c45_01 ×83, kes_minepipesmallbracket_01 ×320, kes_mineelevatordooropen_01 ×5, kes_minegate_01_a ×5, kes_minegate_01_b ×5, kes_minepipelargevaultend_512_01 ×4, kes_barrel_01_a ×8, kes_light_02 ×150, cablessystemsmall_handle_short_02 ×144, kes_wire_01 ×18, kes_hammer_01 ×15, kes_groundplate_01_b ×14, kes_camera_01 ×31, kes_miningshovel_01 ×28, kes_minedoorlights_01 ×24, cablesystemsmall_handle_01 ×19, kes_minepipessmall_c90_01 ×33, kes_minecorridorjunctionbridge_01 ×2, kes_light_01 ×44, kes_vaultwallpipes_768_01 ×2, kes_rebelrope_01 ×3, kes_coreroompowercore_01 ×1, kes_minepipelarge_c90_01_c ×7, kes_minedoorlargeramp_01 ×3, kes_mineelevatorcabin_01 ×5, cablessullustelectric_1024_01 ×70, o_kes_cave_stalagmite_01 ×110, kes_miningpick_01 ×19, kes_controlroomwallconsole_03 ×1, kes_minecorridorceilinglight_128_01 ×6, kes_controlroomchair_01 ×12, kes_barrel_01_b ×95, kes_groundplate_01_a ×10, kes_minepipelarge_c90_01_a ×18, kes_minecorridorlight_01 ×43, kes_minepipelarge_c45_01_c ×11, kes_barrel_02 ×44, kes_minecorridorjunctionwall_128_02 ×1, kes_controlroomdoorframe_512_01 ×1, kes_barrel_03 ×34, kes_controlroomwallconsole_02 ×2, kes_minecorridorjunctionbarrier_02 ×1, kes_vaultwallpipes_512_01 ×2, o_kes_cave_stalagmite_02 ×112, kes_crate_01 ×88, kes_minecorridorjunctionbridgerailing_01 ×2, kes_controlroomwallconsole_04 ×1, cablessullustelectric_512_01 ×32, kes_controlroomwall_office_01 ×2, kes_controlroompanellarge_06 ×10, cablessullustelectric_512_02 ×46, kes_wallhook_01 ×115, kes_minepipelarge_c45_01_a ×25, kes_controlroompanellarge_05 ×26, kes_powerstation_01_a ×36, o_kes_cave_stalagmite_06 ×27, kes_minecorridorwall_c90_02 ×1, kes_machinerysmall_01 ×16, kes_ladder_01 ×3, kes_controlroomwalldroidstation_128_01 ×6, kes_controlroomceilingrimoffice_01 ×1, kes_minepipelarge_c90_01_d ×78, kes_controlroomwall64_01 ×14, kes_controlroompillar_01 ×4, kes_controlroomdoorframesingle_512_01 ×4, kes_turret_01 ×9, kes_minecorridorjunctionwall_128_01 ×5, kes_vent_01 ×158, kes_controlroomvistasmall_01 ×1, kes_machinerymedium_01 ×17, kes_minecorridordoorframejunction_01 ×4, kes_minecorridorceilinglight_256_01 ×20, kes_minepipebracketlarge_512_01 ×59, kes_minecorridorwall_128_01 ×11, kes_minedoorlargegenerator_01 ×2, kes_controlroomwall_office_02 ×1, kes_minecorridorjunctionwallwindow_128_01 ×7, kes_controlroomceilingrim_128_01 ×33, hosefolding_04 ×4, kes_controlroomceiling_128_01 ×12, kes_controlroomwallcorner_01 ×12, kes_controlroomshutters_01 ×4, kes_minepipelarge_c45_01_d ×123, kes_controlroomwalldoor_01 ×6, kes_controlroomdesk_01 ×2, kes_vaultpipesceiling_01_b ×1, kes_vaultpipesceiling_01_a ×1, kes_minedoorlargebase_02 ×2, kes_minetunneldetail_02 ×2, kes_controlroomwallconsole_01 ×4, kes_minecorridorjunctionbarrier_01 ×2, kes_controlroomwall_128_01 ×44, kes_vaultplatform_512_01 ×5, kes_controlroompillarceiling_01 ×18, kes_mineelevatormachinery_01 ×5, kes_minepipessmall_256_01 ×204, cablessullustelectric_1024_02 ×97, kes_vaultwall_768_01 ×2, kes_minetunnelsmallc90_01 ×1, kes_vaultwallpipes_1024_01 ×2, kes_controlroomvistablocker_01 ×1, kes_vaultwall_512_01_b ×3, kes_vaultwall_512_01_a ×3, kes_minetunnelsmall_1024_01 ×1, kes_minedoorframesmall_01_a ×7, kes_corridordoorframelarge_01 ×2, kes_minepipesmall_512_01 ×103, kes_minetunnelsmallgate_01 ×1, kes_vaultwallend_01 ×1, kes_mineelevatordoorframe_01 ×5, kes_vaultwallpillar_01_b ×4, kes_vaultwallpillar_01_a ×4, kes_minedoorclamps_01 ×1, kes_minedoorclamps_02 ×3, kes_rockshaftstorage_01 ×1, o_kes_cave_stalagmite_05 ×304, kes_minepipelarge_256_01 ×121, kes_minecorridorwall_256_01 ×36, kes_antennae_01 ×8, kes_minecorridordoorframe_01 ×23, kes_vaultwallcables_01 ×2, kes_wall_bd_01n ×2, kes_room03_tube_10 ×1, kes_minegateframe_01 ×7, kes_room03_tube_09 ×1, kes_caveceilingopening_01 ×4, kes_wall_bd_01k ×2, kes_room05_tube_12 ×1, kes_room02_tube_03 ×1, kes_room02_tube_05 ×1, kes_minetunnelsmalltintersection_1024_01 ×1, kes_room05_tube_11 ×1, kes_minepipelarge_512_01 ×176, kes_wall_bd_01j ×2, kes_machinerylarge_01_a ×46, kes_cliff_01_c ×4, kes_vaultentranceendwall_01 ×2, kes_room03_tube_01 ×1, kes_room03_tube_02 ×1, kes_cliff_01_d ×3, kes_minedoorlarge_01 ×4, kes_room03_tube_07 ×1, kes_controlroomvista_01 ×1, kes_wall_bd_01p ×2, kes_room03_tube_08 ×1, kes_wall_bd_01o ×2, kes_minetunneldetail_01 ×15, kes_room03_tube_06 ×1, kes_wall_bd_01m ×2, kes_wall_bd_01h ×2, kes_room01_tube_04 ×1, kes_cliff_01_b ×3, kes_tower_01_c ×5, kes_room05_tube_06 ×1, kes_room02_tube_04 ×1, kes_room01_tube_06 ×1, kes_room01_tube_05 ×1, kes_room01_tube_08 ×1, kes_room01_tube_09 ×1, kes_volcanicsulfurrockmoundlarge_01 ×6

Dropped on mid: o_kes_cave_stalagmite_04 ×21, leak_02_c ×6, yavintemple_pipe_support_02 ×27, leak_01_c ×7, leak_01_e ×28, leak_02_c ×13, kes_drill_01_base ×8, kes_drill_01_top ×9, kes_minecorridorwall_c90_01 ×1, kes_minecorridorjunctionwall_128_02 ×1, kes_minepipessmall_c45_01 ×83, kes_minedoorsmall_01_a ×2, kes_minedoorsmall_01_b ×2, kes_coreroompayloadhoses_01 ×2, kes_minepipesmallbracket_01 ×320, kes_coreroompayloadrack_01 ×2, cablessullustelectric_512_02 ×46, kes_minecorridorwall_c90_02 ×1, kes_vaultpipelarge_512_01 ×8, kes_mineelevatordooropen_01 ×5, kes_vaultpipelargebracket_02 ×6, kes_minegate_01_a ×5, kes_minegate_01_b ×5, kes_vaultpipelarge_512_02 ×10, kes_minepipelargevaultend_512_01 ×4, kes_minecorridorjunctionbridge_01 ×2, kes_minecorridorjunctionwall_128_01 ×5, kes_controlroomvistasmall_01 ×1, kes_light_01 ×44, kes_minecorridordoorframejunction_01 ×4, kes_vaultwallpipes_768_01 ×2, kes_rebelrope_01 ×3, kes_controlroomwall_office_02 ×1, kes_minecorridorjunctionwallwindow_128_01 ×7, kes_coreroompowercore_01 ×1, kes_minedoorlargeramp_01 ×3, kes_mineelevatorcabin_01 ×5, cablessullustelectric_1024_01 ×70, o_kes_cave_stalagmite_01 ×110, kes_minecorridorjunctionbarrier_02 ×1, kes_vaultwallpipes_512_01 ×2, o_kes_cave_stalagmite_02 ×112, kes_minedoorlargesupportwall_01 ×4, kes_panelwall_04 ×8, kes_barrel_01_a ×8, kes_light_02 ×150, kes_controlroompanelsmall_01 ×4, cablessystemsmall_handle_short_02 ×144, kes_wire_01 ×18, kes_hammer_01 ×15, kes_groundplate_01_b ×14, kes_camera_01 ×31, kes_miningshovel_01 ×28, kes_controlroomwalldoor_01 ×6, kes_controlroomdesk_01 ×2, kes_powerstation_01_a ×36, o_kes_cave_stalagmite_06 ×27, kes_minedoorlights_01 ×24, kes_minepipelarge_c90_01_b ×6, cablesystemsmall_handle_01 ×19, kes_minepipessmall_c90_01 ×33, kes_minepipelarge_c90_01_c ×7, kes_minecorridorjunctionwall_128_03 ×1, kes_miningpick_01 ×19, kes_controlroomwallconsole_03 ×1, kes_minecorridorceilinglight_128_01 ×6, kes_controlroomchair_01 ×12, kes_barrel_01_b ×95, kes_minecorridorjunctionwallbridge_128_01 ×2, kes_controlroompanellarge_01 ×9, kes_groundplate_01_a ×10, kes_minepipelarge_c90_01_a ×18, kes_minecorridorlight_01 ×43, kes_minepipelarge_c45_01_c ×11, kes_barrel_02 ×44, kes_controlroomdoorframe_512_01 ×1, kes_barrel_03 ×34, kes_controlroomwallconsole_02 ×2, kes_crate_01 ×88, kes_minecorridorjunctionbridgerailing_01 ×2, kes_transportcart_01 ×19, kes_minepipelargeendconnection_01 ×36, kes_mineelevatordoorframe_02 ×2, kes_minepipelarge_c45_01_b ×18, kes_controlroomwallconsole_04 ×1, kes_minecorridorjunctionpanel_01 ×8, cablessullustelectric_512_01 ×32, kes_controlroomwall_office_01 ×2, kes_controlroompanelmedium_01 ×35, kes_controlroompanellarge_06 ×10, kes_wallhook_01 ×115, kes_container_01 ×29, kes_minepipelarge_c45_01_a ×25, kes_controlroompanellarge_05 ×26, kes_vaultplatform_512_01 ×5, kes_vaultpipesceiling_01_b ×1, kes_vaultpipesceiling_01_a ×1, kes_minedoorlargebase_02 ×2, kes_minetunneldetail_02 ×2, kes_controlroomwallconsole_01 ×4, kes_minecorridorjunctionbarrier_01 ×2, kes_controlroompillarceiling_01 ×18, kes_mineelevatormachinery_01 ×5, kes_minepipessmall_256_01 ×204, cablessullustelectric_1024_02 ×97, kes_vaultwall_768_01 ×2, kes_minepipelarge_256_01 ×121, kes_minetunnelsmallc90_01 ×1, kes_vaultwallpipes_1024_01 ×2, kes_controlroomvistablocker_01 ×1, kes_minecorridorwall_256_01 ×36, kes_antennae_01 ×8, kes_minecorridordoorframe_01 ×23, kes_vaultwall_512_01_b ×3, kes_vaultwall_512_01_a ×3, kes_minetunnelsmall_1024_01 ×1, kes_minedoorframesmall_01_a ×7, kes_corridordoorframelarge_01 ×2, kes_minepipesmall_512_01 ×103, kes_minetunnelsmallgate_01 ×1, kes_vaultwallend_01 ×1, kes_mineelevatordoorframe_01 ×5, kes_vaultwallpillar_01_b ×4, kes_vaultwallpillar_01_a ×4, kes_minedoorclamps_01 ×1, kes_minedoorclamps_02 ×3

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 374 | 40.2 KB | lane R's placed.js |
| actors.json | 0 | 0.4 KB | the scene's life rows |
| vehicles.json | 0 | 0.0 KB | the scene's rides and things |
| decals.json and tex/decals/ | 0 | 0.1 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 338 | 38.9 KB | fidelity X's effects |
| tracks.json | 0 | 1.2 KB | src/lib/three/animTracks.js |
| probes.json and probes/ | 24 (and 24 at 128² with the sun, for ultra) | 11540.8 KB | levelProbes.js, lane R's grid |
| shadow/far.png | 1 | 386.2 KB | fidelity S (level.json's shadowCache) |
| scatter.json | 1 | 30.2 KB | fidelity N |

Not placed (no kind on the site yet, or scenery): none. Decals skipped: none. Tracks of owners the pack lacks: 25.

<!-- physics -->
## Physics

The game's shapes (`node scripts/bf2017-physics.mjs`).

| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 328 | 3066 | 331936 | 0 | 10 | 0 | 6708784 |

| heaviest cells | colliders | trimesh triangles |
| --- | --- | --- |
| -1,0 | 8763 | 766405 |
| -1,-1 | 3894 | 355618 |
| -1,1 | 3446 | 683791 |
| 0,0 | 3336 | 235926 |
| 0,-1 | 867 | 42156 |
| 0,-3 | 354 | 14234 |
| 0,-2 | 48 | 3348 |
| 0,1 | 48 | 984 |
| 1,0 | 27 | 1352 |
| 3,-4 | 10 | 0 |
<!-- /physics -->

## Variations

Written by `node scripts/bf2017-variations.mjs kessel` from the level's 13 mesh variation databases (variations.json, 0.24 MB).

| meshes | with variations | applied by instances | by the level rule | mixed (default drawn) | textures missing from the bucket | maps not in the pack |
|---|---|---|---|---|---|---|
| 393 | 36 | 12 | 0 | 18 | 13 | 0 |
