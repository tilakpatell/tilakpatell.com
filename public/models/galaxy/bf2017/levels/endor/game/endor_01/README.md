# endor/game/endor_01: the game's level

From `levels/mp/endor_01` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs levels/mp/endor_01 --world endor --whole`; do not edit by hand.

- 17864 instances in the arena (±1534 m), 0 beyond it (the horizon), 0 left out under the ground (an interior: its own pack, `--inside`), 51 cells of 128 m
- whole: yes (the map's frame: origin 0, yaw 0; nothing fitted, low to 400 radii; sub-levels endor_01, media, shared_art, endor_012, sunny, highend, gamemodes, mode6, teamdeathmatch, teamdeathmatch_online, teamdeathmatch_skirmish, mode9, fantasybattle, planetarymissions, heroarena; left out lobby, lobbysplitscreen, eor, cinematics, outro_team1, outro_team2, mode6_intro, gamemode_automation, hvsvintro, night, foggy; the mode layers' own meshes: fantasybattle 53, heroarena 12, mode6 10, mode9 12, planetarymissions 18, teamdeathmatch 3, teamdeathmatch_online 10, teamdeathmatch_skirmish 11)
- 689 meshes (3 left out), 2208 LOD files, 74.65 MB
- the far list 0.55 MB; terrain near 0.52 MB, far 0.12 MB; the spot's ground 0.00 m in the game
- textures missing from the bucket: 30

| | low | mid | high | ultra |
|---|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 400 (400 m, 8000 m) | 1000 (1000 m, 20000 m) | 1000 (1000 m, 20000 m) | 1000 (1000 m, 20000 m) |
| meshes dropped (instances) | 0 (0) | 0 (0) | 0 (0) | 0 (0) |
| worst place: triangles, calls | 2866k, 1236 | 3451k, 1325 | 4141k, 1373 | 6530k, 1500 |
| texture bytes (every map the level has) | 43.13 MB | 139.97 MB | 139.97 MB | 373.01 MB |

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 1319 | 188.5 KB | lane R's placed.js |
| actors.json | 34 | 4.2 KB | the scene's life rows |
| vehicles.json | 11 | 1.1 KB | the scene's rides and things |
| decals.json | 0 | 0.1 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 1019 | 157.2 KB | fidelity X (nothing until it merges) |
| tracks.json | 8 | 7.6 KB | src/lib/three/animTracks.js |
| probes.json and probes/ | 0 | 0.0 KB | levelProbes.js, lane R's grid |
| shadow/far.png | 1 | 832.5 KB | fidelity S (level.json's shadowCache) |
| scatter.json | 1 | 249.8 KB | fidelity N |

Not placed (no kind on the site yet, or scenery): forestbase_shrublarge_01_skinned ×222, forestbase_shrubmedium_01_skinned ×168, forestbase_shrubsmall_01_skinned ×35, Vehicle_Objective_Bomb ×1. Decals skipped: texture 11, sub 12. Tracks of owners the pack lacks: 22.

<!-- physics -->
## Physics

The game's shapes (`node scripts/bf2017-physics.mjs`).

| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 523 | 4844 | 268293 | 8 | 5 | 0 | 5949820 |

| heaviest cells | colliders | trimesh triangles |
| --- | --- | --- |
| 3,2 | 10849 | 544079 |
| 3,6 | 10777 | 368427 |
| 3,7 | 10207 | 375204 |
| 4,4 | 5994 | 298482 |
| 3,3 | 5715 | 330926 |
| 3,1 | 5123 | 230553 |
| 2,2 | 5092 | 146914 |
| 4,5 | 3664 | 243293 |
| 4,6 | 2906 | 219971 |
| 4,3 | 2393 | 118388 |
<!-- /physics -->

## The navgrid and the frame check (lane G2)

- nav.bin: 294 × 621 cells of 2 m over the gameplay records (164.886, 44.113200000000006 to 752.1769, 1284.2272), 110146 open, 41650 blocked by 43318 solids, 125198 cover slots, 6.50 MB
- the frame: 280 of 280 spawns stand within 2 m of the pack's ground, a floor or a piece's top (galacticAssault 60/60, hvv 31/31, strike 185/185, extraction 4/4)
