# kashyyyk: the game's level

From `levels/mp/kashyyyk_01` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs levels/mp/kashyyyk_01 --world kashyyyk --spot 260 -211`; do not edit by hand.

- 9679 instances in the arena (±1024 m), 1712 beyond it (the horizon), 100 left out under the ground (an interior: its own pack, `--inside`), 148 cells of 128 m
- 393 meshes (7 left out), 912 LOD files, 27.23 MB
- the far list 0.30 MB; terrain near 2.93 MB, far 3.61 MB; the spot's ground 134.49 m in the game
- textures missing from the bucket: 42

| | low | mid | high |
|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 20 (20 m, 400 m) | 39 (39 m, 780 m) | 303 (303 m, 6060 m) |
| meshes dropped (instances) | 23 (759) | 0 (0) | 0 (0) |
| worst place: triangles, calls | 719k, 307 | 1341k, 410 | 2698k, 522 |
| texture bytes (every map the level has) | 20.28 MB | 66.05 MB | 66.05 MB |

Dropped on low: o_kashyyykbase_decal_foam_01 ×52, o_nab_sackflat_01 ×5, beachbase_groundscrub_05 ×3, o_kas_shieldtribal_01 ×31, kashyyykbase_decalplane_01 ×55, square_shadow_01 ×24, o_kas_antenna_01_b ×12, hcvwa9_turbotank_hatch_01 ×16, o_kas_antenna_01_d ×12, o_kas_objectplatform_03 ×43, o_kas_pipeplatform_01_detail ×24, wreckn99_part_02 ×39, crate_02_s_dark ×232, wreckn99_part_05 ×19, o_kas_platformcommander_01 ×7, o_kas_ramp_d_01 ×1, o_kas_siloaddontree_s_01_a ×62, bd_fogbillboard_01 ×2, kashyyykbase_wateralgae_01_cluster_04 ×5, venator_int_ramp_01 ×1, o_kas_antennaaddontree_l_01_a ×108, o_kas_platformaddontree_damaged_s_01 ×3, vehicle_ground_mtt_static_donotuse ×3

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 237 | 24.7 KB | lane R's placed.js |
| actors.json | 0 | 0.4 KB | the scene's life rows |
| vehicles.json | 2 | 0.8 KB | the scene's rides and things |
| decals.json | 1 | 0.5 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 189 | 27.3 KB | fidelity X (nothing until it merges) |
| tracks.json | 30 | 11.6 KB | src/lib/three/animTracks.js |
| probes.json and probes/ | 7 | 675.8 KB | levelProbes.js, lane R's grid |
| shadow/far.png | 1 | 1479.5 KB | fidelity S (level.json's shadowCache) |
| scatter.json | 1 | 611.0 KB | fidelity N |

Not placed (no kind on the site yet, or scenery): tach_01 ×8, theed_event019a_mtt ×2, HCVwA9_Turbotank_SmallTurret_01 ×2, HCVwA9_Turbotank_Turrets_01 ×2, Vehicle_Air_LAAT_Gunship ×1, Vehicle_Air_VultureDroid ×6, Vehicle_Air_Vwing ×6, Vehicle_Ground_MTT_KeyFramed ×2, Vehicle_Ground_NR_N99_Persuader ×11, Vehicle_Stationary_Venator_Kashyyyk_Turret ×4. Decals skipped: none. Tracks of owners the pack lacks: 23.

<!-- physics -->
## Physics

The game's shapes (`node scripts/bf2017-physics.mjs`).

| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 293 | 3150 | 177160 | 0 | 15 | 0 | 3886884 |

| heaviest cells | colliders | trimesh triangles |
| --- | --- | --- |
| 1,-1 | 3261 | 180890 |
| 7,-2 | 3104 | 109914 |
| 6,-1 | 3053 | 160110 |
| 3,-1 | 3014 | 227204 |
| 7,-1 | 2919 | 96007 |
| 4,-1 | 2876 | 158267 |
| 4,0 | 2115 | 110544 |
| 0,-1 | 1916 | 113804 |
| 5,-1 | 1717 | 99013 |
| 0,-2 | 1488 | 189616 |
<!-- /physics -->
