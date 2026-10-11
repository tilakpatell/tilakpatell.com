# hoth/game/hoth_01: the game's level

From `levels/mp/hoth_01` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs levels/mp/hoth_01 --world hoth --whole`; do not edit by hand.

- 21051 instances in the arena (±12531 m), 0 beyond it (the horizon), 0 left out under the ground (an interior: its own pack, `--inside`), 279 cells of 128 m
- whole: yes (the map's frame: origin 0, yaw 0; nothing fitted, low to 400 radii; sub-levels hoth_01, hoth_012, cloudy, highend, content, gamemodes, planetarymissions, mode6, mode9, fantasybattle, heroarena, teamdeathmatch, teamdeathmatch_skirmish, teamdeathmatch_online; left out mode6_intro, hvsvintro, gamemodes_automation, lobby, lobbysplitscreen, eor, cinematics, outro_team1, outro_team2, sunset; the mode layers' own meshes: fantasybattle 41, heroarena 12, mode6 10, mode9 11, planetarymissions 13, teamdeathmatch_online 12, teamdeathmatch_skirmish 10)
- 602 meshes (4 left out), 2274 LOD files, 70.90 MB
- the far list 0.64 MB; terrain near 1.85 MB, far 2.20 MB; the spot's ground 0.00 m in the game
- textures missing from the bucket: 7

| | low | mid | high | ultra |
|---|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 400 (400 m, 8000 m) | 1000 (1000 m, 20000 m) | 1000 (1000 m, 20000 m) | 1000 (1000 m, 20000 m) |
| meshes dropped (instances) | 0 (0) | 0 (0) | 0 (0) | 0 (0) |
| worst place: triangles, calls | 3345k, 905 | 3630k, 940 | 3860k, 956 | 5331k, 1010 |
| texture bytes (every map the level has) | 25.71 MB | 76.67 MB | 76.67 MB | 228.25 MB |

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 691 | 90.9 KB | lane R's placed.js |
| actors.json | 10 | 1.3 KB | the scene's life rows |
| vehicles.json | 31 | 2.7 KB | the scene's rides and things |
| decals.json | 0 | 0.1 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 404 | 59.2 KB | fidelity X (nothing until it merges) |
| tracks.json | 0 | 1.2 KB | src/lib/three/animTracks.js |
| probes.json and probes/ | 6 | 579.2 KB | levelProbes.js, lane R's grid |
| shadow/far.png | 1 | 2843.6 KB | fidelity S (level.json's shadowCache) |
| scatter.json | 1 | 47.8 KB | fidelity N |

Not placed (no kind on the site yet, or scenery): droidgonk_01 ×4. Decals skipped: none. Tracks of owners the pack lacks: 25.

<!-- physics -->
## Physics

The game's shapes (`node scripts/bf2017-physics.mjs`).

| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 449 | 3556 | 236905 | 3 | 23 | 0 | 5253344 |

| heaviest cells | colliders | trimesh triangles |
| --- | --- | --- |
| 1,-14 | 11334 | 473472 |
| 1,-13 | 9022 | 358518 |
| 0,-14 | 5511 | 348207 |
| 2,-14 | 4507 | 160337 |
| 0,-15 | 3163 | 109906 |
| 1,-15 | 3132 | 145603 |
| 0,-10 | 2503 | 107920 |
| 1,-12 | 2038 | 44946 |
| -1,-12 | 1979 | 44615 |
| 0,-13 | 1908 | 48442 |
<!-- /physics -->

## The navgrid and the frame check (lane G2)

- nav.bin: 961 × 996 cells of 2 m over the gameplay records (-1015.08, -2455.3394 to 905.04, -464.24), 798287 open, 153589 blocked by 36204 solids, 36898 cover slots, 7.71 MB
- the frame: 467 of 474 spawns stand within 2 m of the pack's ground, a floor or a piece's top (galacticAssault 212/219, hvv 24/24, blast 44/44, strike 160/160, extraction 4/4, arcade 23/23); the farthest: FantasyBattle_Logic:327 107.4 m, FantasyBattle_Logic:293 89.1 m, FantasyBattle_Logic:68 50.1 m, FantasyBattle_Logic:17 22.2 m, FantasyBattle_Logic:65 3.4 m
