# tatooine: the game's level

From `levels/mp/tatooine_01` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs levels/mp/tatooine_01 --world tatooine --spot -194.3 272.8 --subs tatooine_01,content,content_024`; do not edit by hand.

- 16631 instances in the arena (±1024 m), 1 beyond it (the horizon), 48 left out under the ground (an interior: its own pack, `--inside`), 48 cells of 128 m
- 643 meshes (44 left out), 2073 LOD files, 41.07 MB
- the far list 0.51 MB; terrain near 2.69 MB, far 0.21 MB; the spot's ground 65.06 m in the game
- textures missing from the bucket: 3

| | low | mid | high |
|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 20 (20 m, 400 m) | 30 (30 m, 600 m) | 46 (46 m, 920 m) |
| meshes dropped (instances) | 110 (3381) | 65 (1404) | 0 (0) |
| worst place: triangles, calls | 358k, 315 | 665k, 450 | 1053k, 629 |
| texture bytes (every map the level has) | 33.44 MB | 81.92 MB | 81.92 MB |

Dropped on low: dirtdecals_01 ×3, cable256_01 ×3, cable384_01 ×2, dirtdecals_05 ×7, dirtdecals_03 ×8, tat_carpetmedium_doublesided_01 ×7, cablessullustelectric_512_01 ×8, moseisley_house_trim_01 ×1, pf_market_stall_11_cups_combined ×2, tat_carpetlarge_doublesided_01 ×2, dirtdecals_04 ×12, o_tatooinemarket_animal_03 ×8, tat_carpetsmall_01 ×43, cablessullustelectric_512_02 ×27, pillowrectanglewall_01 ×4, hangingskin_b_01 ×28, pf_market_trash_01_combined ×5, pf_market_stall_05c_vase_s_02_combined ×2, o_obj_tat_pole_01 ×24, o_nab_rope_01 ×13, square_shadow_01 ×2, tableside_01 ×3, tableside_02 ×5, awning_market_hangingcloth_02_a ×11, wallsystem_lightplane_01 ×26, cable256hanging_01 ×1, animalhanging_c_01 ×72, o_tatooinemarket_fruit_07 ×33, tat_carpetmedium_01 ×49, bbq_05 ×77, waterpurifierhanging_static_01 ×27, pillowsquarewall_01 ×19, o_nab_boxmarketstand_01 ×78, pf_market_stall_05c_vase_s_01_combined ×2, o_nab_rope_02 ×21, windchime_01 ×77, o_tatooinemarket_animal_02 ×33, animalhanging_b_01 ×87, miscprop_s_02 ×27, o_tatooinemarket_fruit_02 ×21, moseisley_carpetrolled_01 ×15, moseisley_wallposter_02 ×14, animalhanging_a_01 ×121, dirtdecals_06 ×6, hangingskin_c_01 ×42, moseisley_wallposter_01 ×11, driedspices_b_01 ×177, moseisley_wallposter_09 ×13, pipessystem_palace_small_s1024_01 ×2, machinewallmedium_01 ×25, pf_market_trash_05_combined ×11, tat_carpetlargehanging_01 ×4, o_moseisley_rockedge_m_01_b ×5, awning_market_hangingcloth_01 ×6, wed_15septoidtreadwell_01_static ×3, controlpanelsmall_03 ×49, ra7_01_sequenced ×13, pf_market_stall_02_cups_combined ×17, o_tatooinemarket_fruit_03 ×35, o_nab_pillowlong_flat_01 ×19, driedspices_c_01 ×138, pipessystem_palace_small_detail_a_01 ×23, cantina_doortrim_01 ×4, vaporator_01 ×4, moseisley_clothhangingpole_03 ×15, moseisley_wallposter_08 ×11, pf_market_stall_07_animalcooked_01_combined ×24, o_tatooinemarket_animal_01 ×47, machinewallmedium_02 ×47, moseisley_carpetrolled_02 ×17, transporterhangar_01_hose_b ×13, traymetal_01 ×36, moseisley_clothhangingpole_05 ×17, moseisley_clothhangingpole_04 ×23, driedspices_a_01 ×97, pipewall_01 ×72, o_tatooinemarket_animal_04 ×93, wok_01 ×184, transporterhangar_01_hose_c ×13, moseisley_carpetdraped_02 ×11, lampceiling_02 ×12, scrapmetal_c_01 ×11, pipemedium_01 ×29, machinewallmedium_03 ×110, catwalksystemplatformdestruction_s256_256x128x128_01 ×3, pipessystem_palace_small_detail_d_01 ×83, o_moseisley_rockedge_m_01_a ×2, controlroom_blastdoor_door_01 ×1, pipessystem_palace_small_c64_bold_b_01 ×17, o_moseisley_rockedge_m_01_e ×17, vasesmall_06 ×48, tat_carpetlarge_01 ×55, moseisley_clothhangingwall_01 ×14, droidtorture_02 ×19, wall_01_arch_door ×30, awning_market_hangingcloth_02_b ×21, pipessystem_palace_small_s128_01 ×51, pipessystem_01_clusteredpart_01 ×16, machine_s_02 ×16, pf_junk_04_scrapgeneric_s_01_combined ×11, o_obj_tat_pillartech_01 ×7, o_nab_sackflat_01 ×37, pipewall_02 ×73, controlroom_blastdoor_frame_01 ×1, pf_junk_03_jak_gastank_s_01_combined ×10, pf_pipeswall_02_combined ×27, o_tatooinemarket_fruit_06 ×101, waterpurifierhanging_01 ×189, moseisley_cantina_01_bar ×1, larshomesteaddoor_01_320x256_d ×12

Dropped on mid: o_nab_coffeeplatter_01 ×3, dirtdecals_01 ×3, cablessullustelectric_1024_01 ×6, cable256_01 ×3, cable384_01 ×2, moseisley_wallposter_11 ×7, dirtdecals_05 ×7, instrument_s_03 ×12, dirtdecals_06 ×6, dirtdecals_03 ×8, moseisley_wallposter_10 ×7, pillowsquarewall_02 ×2, tat_carpetmedium_doublesided_01 ×7, cablessullustelectric_512_01 ×8, moseisley_wallposter_09 ×13, moseisley_house_trim_01 ×1, pf_market_stall_11_cups_combined ×2, tat_carpetlarge_doublesided_01 ×2, pf_market_stall_02_cups_combined ×17, cablesystemsmall_handle_01 ×68, dirtdecals_04 ×12, pf_market_stall_07_animalcooked_01_combined ×24, hangingskin_a_01 ×14, tat_carpetmediumhanging_01 ×2, o_tatooinemarket_animal_03 ×8, moseisley_clothhangingwall_ring_01 ×27, tat_carpetsmall_01 ×43, cablessullustelectric_512_02 ×27, pillowrectanglewall_01 ×4, hangingskin_b_01 ×28, pf_market_trash_01_combined ×5, pf_market_stall_05c_vase_s_02_combined ×2, o_obj_tat_pole_01 ×24, o_nab_rope_01 ×13, driedspices_a_01 ×97, square_shadow_01 ×2, tableside_01 ×3, tableside_02 ×5, awning_market_hangingcloth_02_a ×11, wallsystem_lightplane_01 ×26, cable256hanging_01 ×1, moseisley_wallposter_08 ×11, animalhanging_c_01 ×72, o_tatooinemarket_fruit_07 ×33, o_nab_coffeeset_01 ×23, o_tatooinemarket_animal_04 ×93, pillowsquarecnr_01 ×12, tat_carpetmedium_01 ×49, pf_market_stall_04_coffeepot_l_01_combined ×2, generator_m_02 ×5, bbq_05 ×77, waterpurifierhanging_static_01 ×27, pillowsquarewall_01 ×19, o_nab_boxmarketstand_01 ×78, pf_market_stall_05c_vase_s_01_combined ×2, o_nab_rope_02 ×21, windchime_01 ×77, o_tatooinemarket_animal_02 ×33, animalhanging_b_01 ×87, catwalksystemplatform_c270_128x128x128_01 ×2, vase_s_01 ×50, catwalksystemplatform_s128_128x128x64_01 ×4, miscprop_s_02 ×27, o_tatooinemarket_fruit_02 ×21, moseisley_clothhangingpole_05 ×17

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 170 | 19.8 KB | lane R's placed.js |
| actors.json | 27 | 3.3 KB | the scene's life rows |
| vehicles.json | 5 | 0.4 KB | the scene's rides and things |
| decals.json | 1 | 0.5 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 383 | 57.7 KB | fidelity X (nothing until it merges) |
| tracks.json | 7 | 6.1 KB | src/lib/three/animTracks.js |
| probes.json and probes/ | 0 | 0.0 KB | levelProbes.js, lane R's grid |
| shadow/far.png | 1 | 1183.4 KB | fidelity S (level.json's shadowCache) |
| scatter.json | 0 | 0.0 KB | fidelity N |

Not placed (no kind on the site yet, or scenery): bantha_01 ×8, dewback_01 ×9, dewback_01_saddle ×9, droidgonk_01 ×4, eopie_01 ×15, eopie_01_saddle ×15, facepatroldroid_01 ×5, profogg_01 ×29, scurrier_01 ×10, wed_15septoidtreadwell_01 ×3. Decals skipped: none. Tracks of owners the pack lacks: 23.

<!-- physics -->
## Physics

The game's shapes (`node scripts/bf2017-physics.mjs`).

| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 561 | 5598 | 212739 | 2 | 15 | 0 | 4968824 |

| heaviest cells | colliders | trimesh triangles |
| --- | --- | --- |
| 2,-2 | 18020 | 684209 |
| 1,-2 | 15677 | 674980 |
| 0,-2 | 9256 | 316627 |
| 3,-2 | 8140 | 360425 |
| 0,-1 | 5596 | 178073 |
| 2,-1 | 4935 | 202973 |
| 1,-1 | 4399 | 182849 |
| 3,-1 | 3729 | 147962 |
| 2,-3 | 2912 | 101250 |
| -1,-1 | 2580 | 125495 |
<!-- /physics -->
