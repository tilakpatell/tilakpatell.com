# kashyyyk/game/kashyyyk_01: the game's level

From `levels/mp/kashyyyk_01` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs levels/mp/kashyyyk_01 --world kashyyyk --whole`; do not edit by hand.

- 15177 instances in the arena (±17896 m), 0 beyond it (the horizon), 0 left out under the ground (an interior: its own pack, `--inside`), 509 cells of 128 m
- whole: yes (the map's frame: origin 0, yaw 0; nothing fitted, low to 400 radii; sub-levels kashyyyk_01, gamemodes, fantasybattlesprops, heroarena, planetarymissions, fantasybattle, smallmodesreflections_day, mode6, teamdeathmatch, teamdeathmatch_online, teamdeathmatch_skrimish, smallmodesprops, content, lighting, overcast, overcast2, interior, highend; left out gamemode_automation, hvsvintro, mode6_intro, cinematics, outro_team1, outro_team2, lobby, eor, lobbysplitscreen, night; the mode layers' own meshes: fantasybattle 32, heroarena 10, mode6 10, planetarymissions 12, smallmodesprops 71, teamdeathmatch_online 10, teamdeathmatch_skrimish 10)
- 393 meshes (7 left out), 1277 LOD files, 57.43 MB
- the far list 0.46 MB; terrain near 3.72 MB, far 3.61 MB; the spot's ground 0.00 m in the game
- textures missing from the bucket: 43

| | low | mid | high | ultra |
|---|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 400 (400 m, 8000 m) | 1000 (1000 m, 20000 m) | 1000 (1000 m, 20000 m) | 1000 (1000 m, 20000 m) |
| meshes dropped (instances) | 0 (0) | 0 (0) | 0 (0) | 0 (0) |
| worst place: triangles, calls | 3045k, 653 | 3729k, 694 | 4108k, 735 | 6450k, 789 |
| texture bytes (every map the level has) | 24.12 MB | 77.35 MB | 77.35 MB | 215.39 MB |

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 237 | 25.2 KB | lane R's placed.js |
| actors.json | 0 | 0.5 KB | the scene's life rows |
| vehicles.json | 2 | 0.9 KB | the scene's rides and things |
| decals.json | 1 | 0.5 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 202 | 29.7 KB | fidelity X (nothing until it merges) |
| tracks.json | 30 | 11.6 KB | src/lib/three/animTracks.js |
| probes.json and probes/ | 7 | 675.8 KB | levelProbes.js, lane R's grid |
| shadow/far.png | 1 | 1479.5 KB | fidelity S (level.json's shadowCache) |
| scatter.json | 1 | 611.0 KB | fidelity N |

Not placed (no kind on the site yet, or scenery): kashyyykbase_tree_s_01_skinned ×53, tach_01 ×8, theed_event019a_mtt ×2, HCVwA9_Turbotank_SmallTurret_01 ×2, HCVwA9_Turbotank_Turrets_01 ×2, Vehicle_Air_LAAT_Gunship ×1, Vehicle_Air_VultureDroid ×6, Vehicle_Air_Vwing ×6, Vehicle_Ground_MTT_KeyFramed ×2, Vehicle_Ground_NR_N99_Persuader ×11, Vehicle_Stationary_Venator_Kashyyyk_Turret ×4. Decals skipped: none. Tracks of owners the pack lacks: 23.

<!-- physics -->
## Physics

The game's shapes (`node scripts/bf2017-physics.mjs`).

| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 293 | 3150 | 177160 | 0 | 15 | 0 | 3886884 |

| heaviest cells | colliders | trimesh triangles |
| --- | --- | --- |
| 2,-4 | 5383 | 513782 |
| 2,-3 | 3719 | 285200 |
| 9,-3 | 3450 | 106260 |
| 10,-3 | 3135 | 110639 |
| 6,-3 | 2801 | 152967 |
| 3,-2 | 2500 | 129014 |
| 9,-4 | 2487 | 87274 |
| 3,-3 | 2440 | 159216 |
| 8,-3 | 2377 | 117389 |
| 5,-3 | 2271 | 176921 |
<!-- /physics -->

## The navgrid and the frame check (lane G2)

- nav.bin: 2046 × 1827 cells of 2 m over the gameplay records (-1125.1129, -2173.024 to 2966.5676, 1479.1163), 2409085 open, 62356 blocked by 56265 solids, 278489 cover slots, 32.45 MB
- the frame: 358 of 377 spawns stand within 2 m of the pack's ground, a floor or a piece's top (galacticAssault 260/276, hvv 26/26, blast 54/57, extraction 4/4, arcade 14/14); the farthest: FantasyBattle_Logic:281 508 m, FantasyBattle_Logic:214 486.8 m, FantasyBattle_Logic:417 380.9 m, FantasyBattle_Logic:315 374.8 m, FantasyBattle_Logic:212 290.9 m
