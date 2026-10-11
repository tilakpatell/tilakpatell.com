# yavin/game/yavin_01: the game's level

From `levels/mp/yavin_01` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs levels/mp/yavin_01 --world yavin --whole`; do not edit by hand.

- 14577 instances in the arena (±1375 m), 0 beyond it (the horizon), 0 left out under the ground (an interior: its own pack, `--inside`), 71 cells of 128 m
- whole: yes (the map's frame: origin 0, yaw 0; nothing fitted, low to 400 radii; sub-levels yavin_01, yavin_012, streamed_in_props, media, gamemodes, modec, teamdeathmatch, teamdeathmatch_online, teamdeathmatch_skirmish, mode9, heroarena, fantasybattle, planetarymissions, mode6, mode1, lighting3, sunny, highend; left out lobby, eor, lobbysplitscreen, gamemode_automation, hvsvintro, mode6_intro, cinematics, outroteam1, outroteam2, sunset; the mode layers' own meshes: fantasybattle 19, heroarena 10, mode1 16, mode6 10, mode9 13, modec 12, planetarymissions 14, teamdeathmatch_online 11, teamdeathmatch_skirmish 10)
- 722 meshes (5 left out), 2274 LOD files, 105.75 MB
- the far list 0.44 MB; terrain near 0.56 MB, far 0.14 MB; the spot's ground 0.00 m in the game
- textures missing from the bucket: 16

| | low | mid | high | ultra |
|---|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 400 (400 m, 8000 m) | 1000 (1000 m, 20000 m) | 1000 (1000 m, 20000 m) | 1000 (1000 m, 20000 m) |
| meshes dropped (instances) | 0 (0) | 0 (0) | 0 (0) | 0 (0) |
| worst place: triangles, calls | 2602k, 1232 | 3264k, 1334 | 3898k, 1349 | 6884k, 1455 |
| texture bytes (every map the level has) | 45.12 MB | 131.94 MB | 131.94 MB | 329.04 MB |

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 328 | 38.0 KB | lane R's placed.js |
| actors.json | 15 | 2.6 KB | the scene's life rows |
| vehicles.json | 7 | 0.9 KB | the scene's rides and things |
| decals.json | 0 | 0.1 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 280 | 41.3 KB | fidelity X (nothing until it merges) |
| tracks.json | 1 | 1.3 KB | src/lib/three/animTracks.js |
| probes.json and probes/ | 2 | 193.1 KB | levelProbes.js, lane R's grid |
| shadow/far.png | 1 | 1629.0 KB | fidelity S (level.json's shadowCache) |
| scatter.json | 1 | 311.7 KB | fidelity N |

Not placed (no kind on the site yet, or scenery): droidgonk_01 ×4, stintarils_01 ×4, woolamander_01 ×14, yavinbase_bush_large_01_c_skinned ×70, yavinbase_bush_large_01_skinned_02 ×57, yavinbase_bush_medium_02_skinned ×169, yavinbase_bush_palm_large_01_skinned ×66, yavinbase_tree_small_01_b_skinned ×31, yavinbase_tree_small_01_skinned ×78, Vehicle_Air_TieFighter ×3, Vehicle_Air_UWing_Gunship ×1, Vehicle_Air_XWing_T65 ×3, Vehicle_Objective_Bomb ×2. Decals skipped: sub 7. Tracks of owners the pack lacks: 24.

<!-- physics -->
## Physics

The game's shapes (`node scripts/bf2017-physics.mjs`).

| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 499 | 5136 | 161997 | 4 | 4 | 0 | 4165388 |

| heaviest cells | colliders | trimesh triangles |
| --- | --- | --- |
| 0,5 | 7309 | 310547 |
| 3,5 | 6193 | 202689 |
| 2,5 | 5461 | 199620 |
| -1,5 | 4569 | 165357 |
| 1,5 | 4566 | 240530 |
| 3,4 | 3909 | 214379 |
| 2,4 | 3906 | 206815 |
| 1,4 | 3561 | 272323 |
| 0,4 | 3554 | 194723 |
| 4,5 | 1977 | 126174 |
<!-- /physics -->

## The navgrid and the frame check (lane G2)

- nav.bin: 1228 × 767 cells of 2 m over the gameplay records (-1176.4, -152.4 to 1278.8, 1381.2), 886932 open, 32348 blocked by 49547 solids, 84882 cover slots, 9.63 MB
- the frame: 487 of 488 spawns stand within 2 m of the pack's ground, a floor or a piece's top (galacticAssault 0/1, hvv 32/32, blast 66/66, strike 157/157, supremacy 132/132, extraction 4/4, arcade 96/96); the farthest: FantasyBattle_Logic:253 103.7 m
