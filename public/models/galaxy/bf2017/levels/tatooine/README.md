# tatooine: the game's level

From `levels/mp/tatooine_01` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs levels/mp/tatooine_01 --world tatooine --spot -194.3 272.8 --subs tatooine_01,content,content_024 --ultra`; do not edit by hand.

- 16631 instances in the arena (±1024 m), 1 beyond it (the horizon), 48 left out under the ground (an interior: its own pack, `--inside`), 48 cells of 128 m
- proxies by their shaders, never drawn (materials.jsonl: SS_Shadowmesh casts shadows only, SS_VirtualTextureOnly paints the terrain's virtual texture only): none
- never drawn as themselves (the NEVER rule: lighting proxies, light blockers, occluders, invisible collision, shadow-only meshes, destruction stages): mesh_enlightenproxy_02 ×26, mesh_light_cone_00 ×12, mesh_enlightenproxy_01 ×6, invalidatelightplane_01 ×1
- 643 meshes (44 left out), 2113 LOD files, 52.37 MB
- the far list 0.51 MB; terrain near 2.69 MB, far 0.21 MB; the spot's ground 65.06 m in the game
- textures missing from the bucket: 2
- ultra's maps held to 256.00 MB (lod.js's TEX_MB): 407.70 MB as the table gives them, 136 stepped down a size or more toward high's, normal and ORM first

| | low | mid | high | ultra |
|---|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 20 (20 m, 400 m) | 30 (30 m, 600 m) | 46 (46 m, 920 m) | 1000 (1000 m, 20000 m) |
| meshes dropped (instances) | 103 (3888) | 63 (1954) | 0 (0) | 0 (0) |
| worst place: triangles, calls | 360k, 314 | 670k, 450 | 1053k, 629 | 3643k, 901 |
| texture bytes (every map the level has) | 34.02 MB | 83.98 MB | 83.98 MB | 243.94 MB |
| mesh bytes a tier can draw (its LODs, its meshes) | 17.17 MB | 29.02 MB | 41.07 MB | 52.37 MB |

Dropped on low: pf_market_stall_11_cups_combined ×2, tableside_01 ×3, o_tatooinemarket_animal_03 ×8, tableside_02 ×5, pillowrectanglewall_01 ×4, hangingskin_b_01 ×28, cable256_01 ×3, pf_market_stall_05c_vase_s_01_combined ×2, pillowsquarewall_01 ×19, o_tatooinemarket_fruit_02 ×21, pf_market_trash_01_combined ×5, o_tatooinemarket_animal_02 ×33, cablessullustelectric_512_01 ×8, cable384_01 ×2, moseisley_house_trim_01 ×1, waterpurifierhanging_static_01 ×27, o_tatooinemarket_fruit_07 ×33, o_tatooinemarket_fruit_03 ×35, wed_15septoidtreadwell_01_static ×3, miscprop_s_02 ×27, windchime_01 ×77, bbq_05 ×77, moseisley_carpetdraped_02 ×11, animalhanging_a_01 ×121, awning_market_hangingcloth_02_a ×11, animalhanging_c_01 ×72, cablessullustelectric_512_02 ×27, animalhanging_b_01 ×87, driedspices_b_01 ×177, catwalksystemplatformdestruction_s256_256x128x128_01 ×3, cable256hanging_01 ×1, wok_01 ×184, moseisley_wallposter_02 ×14, displaymarket_02 ×29, moseisley_wallposter_01 ×11, o_nab_boxmarketstand_01 ×78, controlpanelsmall_03 ×49, o_tatooinemarket_animal_01 ×47, o_nab_pillowlong_flat_01 ×19, bbq_04 ×67, moseisley_wallposter_09 ×13, o_moseisley_rockedge_m_01_b ×5, moseisley_carpetrolled_02 ×17, vaporator_01 ×4, machinewallmedium_02 ×47, ra7_01_sequenced ×13, moseisley_carpetdraped_04 ×12, moseisley_cantina_01_bar ×1, pf_junk_03_jak_gastank_s_01_combined ×10, driedspices_c_01 ×138, traymetal_01 ×36, hangingskin_c_01 ×42, pf_street_14_cratemetal_01_combined ×9, moseisley_carpetrolled_01 ×15, moseisley_clothhangingpole_05 ×17, machinewallmedium_01 ×25, displaystand_01 ×18, pipessystem_palace_small_detail_a_01 ×23, machine_s_02 ×16, lampceiling_02 ×12, gonk_01 ×16, o_obj_tat_standdisplay_02 ×51, cagehanging_01 ×121, machinewallmedium_04 ×147, waterpurifierhanging_01 ×189, moseisley_clothhangingpole_03 ×15, o_obj_tat_pillartech_01 ×7, pipessystem_palace_small_detail_d_01 ×83, moseisley_wallposter_08 ×11, cratemetal_01 ×75, pipessystem_palace_small_c64_bold_b_01 ×17, curtain_01_a ×3, braziermarket_01 ×104, transporterhangar_01_hose_b ×13, curtain_02_a ×3, catwalksystemplatformstairs_128x128x256_02 ×6, transporterhangar_01_hose_c ×13, pf_pipeswall_02_combined ×27, moseisley_add_on_05 ×10, o_nab_clothhanginga_01_tatooine ×20, miscpropmachinemedium_03 ×23, o_liv_gtaw74_01 ×7, pf_junk_04_scrapgeneric_s_01_combined ×11, wallgreeble_01 ×240, moseisley_clothhangingpole_04 ×23, pipewall_01 ×72, pf_street_04_a_combined ×23, moseisley_clothhangingpole_02 ×18, bbq_02 ×75, pf_box_m_01_stack_01_combined ×2, table_01 ×78, barrelplastic_01 ×96, ventilationunit_01 ×54, tat_carpetlargehanging_01 ×4, transporterhangar_01_hose_a ×13, pipemedium_01 ×29, pipessystem_palace_small_c90_64_01 ×83, awning_market_hangingcloth_02_b ×21, pipessystem_palace_small_s128_01 ×51, pf_market_trash_03_combined ×36, tat_carpetsmall_01 ×43, pf_street_05_crate_m_01_combined ×27, o_obj_tat_pole_01 ×24

Dropped on mid: o_nab_coffeeplatter_01 ×3, pillowsquarewall_02 ×2, pf_market_stall_02_cups_combined ×17, pf_market_stall_11_cups_combined ×2, hangingskin_a_01 ×14, moseisley_clothhangingwall_ring_01 ×27, tableside_01 ×3, o_tatooinemarket_animal_03 ×8, tableside_02 ×5, instrument_s_03 ×12, driedspices_a_01 ×97, pillowrectanglewall_01 ×4, pillowsquarecnr_01 ×12, o_nab_coffeeset_01 ×23, moseisley_wallposter_11 ×7, o_tatooinemarket_animal_04 ×93, hangingskin_b_01 ×28, moseisley_wallposter_10 ×7, cable256_01 ×3, catwalksystemplatform_c270_128x128x128_01 ×2, pf_market_stall_05c_vase_s_01_combined ×2, pillowsquarewall_01 ×19, pf_market_stall_07_animalcooked_01_combined ×24, o_tatooinemarket_fruit_02 ×21, pf_market_trash_01_combined ×5, vase_s_01 ×50, o_tatooinemarket_animal_02 ×33, cablessullustelectric_512_01 ×8, moseisley_wallposter_09 ×13, cable384_01 ×2, catwalksystemplatform_s128_128x128x64_01 ×4, moseisley_house_trim_01 ×1, waterpurifierhanging_static_01 ×27, displaymarket_01 ×22, o_tatooinemarket_fruit_07 ×33, generator_m_02 ×5, o_tatooinemarket_fruit_03 ×35, pf_market_stall_04_coffeepot_l_01_combined ×2, wed_15septoidtreadwell_01_static ×3, miscprop_s_02 ×27, windchime_01 ×77, cablessullustelectric_1024_01 ×6, bbq_05 ×77, moseisley_carpetdraped_02 ×11, animalhanging_a_01 ×121, vase_s_04 ×79, catwalksystemplatformcover_s256_256x128x128_01 ×2, awning_market_hangingcloth_02_a ×11, cablesystemsmall_handle_01 ×68, animalhanging_c_01 ×72, cablessullustelectric_512_02 ×27, animalhanging_b_01 ×87, pipessystem_palace_small_c90_64_01 ×83, driedspices_b_01 ×177, torch_s_01 ×70, vasesmall_06 ×48, moseisley_clothhangingpole_05 ×17, catwalksystemplatformdestruction_s256_256x128x128_01 ×3, messengerdroid_01 ×6, cable256hanging_01 ×1, droidtorture_02 ×19, moseisley_carpetdraped_03 ×3, wok_01 ×184

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 170 | 19.8 KB | lane R's placed.js |
| actors.json | 27 | 3.3 KB | the scene's life rows |
| vehicles.json | 5 | 0.4 KB | the scene's rides and things |
| decals.json and tex/decals/ | 1 | 1067.7 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 383 | 44.1 KB | fidelity X's effects |
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
