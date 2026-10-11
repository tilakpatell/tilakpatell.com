# tatooine/game/tatooine_01: the game's level

From `levels/mp/tatooine_01` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs levels/mp/tatooine_01 --world tatooine --whole`; do not edit by hand.

- 17218 instances in the arena (±18347 m), 0 beyond it (the horizon), 0 left out under the ground (an interior: its own pack, `--inside`), 48 cells of 128 m
- whole: yes (the map's frame: origin 0, yaw 0; nothing fitted, low to 400 radii; sub-levels tatooine_01, content_024, content, tatooine_012, lighting_sunny, highend, gamemodes, mode9, heroarena, teamdeathmatch, teamdeathmatch_online, teamdeathmatch_skirmish, fantasybattle, mode6, modec, mode1, planetarymissions; left out cinematics, outro_team1, outro_team2, lobby, eor, lobbysplitscreen, hvsvintro, gamemodes_automation, mode6_intro, lighting_night, lighting_sunset; the mode layers' own meshes: fantasybattle 23, heroarena 10, mode6 10, mode9 12, modec 12, planetarymissions 13, teamdeathmatch_online 10, teamdeathmatch_skirmish 10)
- 643 meshes (44 left out), 2194 LOD files, 56.56 MB
- the far list 0.53 MB; terrain near 0.48 MB, far 0.21 MB; the spot's ground 0.00 m in the game
- textures missing from the bucket: 3

| | low | mid | high | ultra |
|---|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 400 (400 m, 8000 m) | 1000 (1000 m, 20000 m) | 1000 (1000 m, 20000 m) | 1000 (1000 m, 20000 m) |
| meshes dropped (instances) | 0 (0) | 0 (0) | 0 (0) | 0 (0) |
| worst place: triangles, calls | 2731k, 814 | 2960k, 845 | 3054k, 871 | 3566k, 949 |
| texture bytes (every map the level has) | 36.18 MB | 90.55 MB | 90.55 MB | 205.63 MB |

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 170 | 19.7 KB | lane R's placed.js |
| actors.json | 27 | 3.8 KB | the scene's life rows |
| vehicles.json | 8 | 0.8 KB | the scene's rides and things |
| decals.json | 1 | 0.5 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 383 | 57.2 KB | fidelity X (nothing until it merges) |
| tracks.json | 7 | 6.1 KB | src/lib/three/animTracks.js |
| probes.json and probes/ | 0 | 0.0 KB | levelProbes.js, lane R's grid |
| shadow/far.png | 1 | 1183.4 KB | fidelity S (level.json's shadowCache) |
| scatter.json | 0 | 0.0 KB | fidelity N |

Not placed (no kind on the site yet, or scenery): bantha_01 ×8, dewback_01 ×9, dewback_01_saddle ×9, droidgonk_01 ×4, eopie_01 ×15, eopie_01_saddle ×15, facepatroldroid_01 ×5, profogg_01 ×29, scurrier_01 ×10, wed_15septoidtreadwell_01 ×3, Vehicle_Objective_Bomb ×1. Decals skipped: none. Tracks of owners the pack lacks: 23.

<!-- physics -->
## Physics

The game's shapes (`node scripts/bf2017-physics.mjs`).

| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 561 | 5598 | 212739 | 2 | 15 | 0 | 4968824 |

| heaviest cells | colliders | trimesh triangles |
| --- | --- | --- |
| 0,0 | 16140 | 634607 |
| -1,0 | 11765 | 469647 |
| 1,0 | 11555 | 499485 |
| -1,1 | 7619 | 283564 |
| 0,1 | 6997 | 268231 |
| -2,1 | 6833 | 261347 |
| 1,1 | 6420 | 252996 |
| -2,0 | 4827 | 192129 |
| 2,1 | 2965 | 99854 |
| 2,0 | 2570 | 140803 |
<!-- /physics -->

## The navgrid and the frame check (lane G2)

- nav.bin: 1005 × 685 cells of 2 m over the gameplay records (-1007.772, -691.4672 to 1000.8166, 677.3725), 640871 open, 46132 blocked by 87209 solids, 110617 cover slots, 10.07 MB
- the frame: 461 of 465 spawns stand within 2 m of the pack's ground, a floor or a piece's top (galacticAssault 150/154, hvv 25/25, blast 81/81, strike 159/159, extraction 4/4, arcade 42/42); the farthest: FantasyBattle_Logic:3 85.1 m, FantasyBattle_Logic:31 85 m, FantasyBattle_Logic:41 73.6 m, FantasyBattle_Logic:33 73.2 m
