# kashyyyk/second: the game's level

From `s7/levels/kashyyyk_02` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs s7/levels/kashyyyk_02 --world kashyyyk --district second --spot 1166 -271`; do not edit by hand.

- 8017 instances in the arena (±1024 m), 495 beyond it (the horizon), 92 left out under the ground (an interior: its own pack, `--inside`), 159 cells of 128 m
- 836 meshes (13 left out), 708 LOD files, 20.20 MB
- the far list 0.24 MB; terrain near 4.11 MB, far 3.61 MB; the spot's ground 173.13 m in the game
- textures missing from the bucket: 0

| | low | mid | high |
|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 41 (41 m, 820 m) | 118 (118 m, 2360 m) | 1000 (1000 m, 20000 m) |
| meshes dropped (instances) | 0 (0) | 0 (0) | 0 (0) |
| worst place: triangles, calls | 719k, 244 | 1347k, 316 | 2036k, 384 |
| texture bytes (every map the level has) | 15.47 MB | 49.45 MB | 49.45 MB |

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 515 | 54.5 KB | lane R's placed.js |
| actors.json | 0 | 0.3 KB | the scene's life rows |
| vehicles.json | 0 | 0.2 KB | the scene's rides and things |
| decals.json | 339 | 92.2 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 729 | 113.9 KB | fidelity X (nothing until it merges) |
| tracks.json | 24 | 7.4 KB | src/lib/three/animTracks.js |
| probes.json and probes/ | 12 | 1158.4 KB | levelProbes.js, lane R's grid |
| shadow/far.png | 1 | 79.3 KB | fidelity S (level.json's shadowCache) |
| scatter.json | 1 | 650.8 KB | fidelity N |

Not placed (no kind on the site yet, or scenery): HCVwA9_Turbotank_SmallTurret_01 ×3, HCVwA9_Turbotank_Turrets_01 ×3. Decals skipped: sub 173. Tracks of owners the pack lacks: 24.

<!-- physics -->
## Physics

The game's shapes (`node scripts/bf2017-physics.mjs`).

| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 722 | 5426 | 527286 | 9 | 17 | 0 | 10955972 |

| heaviest cells | colliders | trimesh triangles |
| --- | --- | --- |
| -3,-1 | 2704 | 145856 |
| -1,-1 | 2398 | 120714 |
| -3,0 | 2382 | 104291 |
| -6,0 | 2278 | 128546 |
| -1,0 | 2247 | 111692 |
| -2,-1 | 2114 | 119253 |
| -4,-1 | 2052 | 143816 |
| -3,1 | 1955 | 100386 |
| -4,0 | 1675 | 99812 |
| -5,4 | 1546 | 156783 |
<!-- /physics -->
