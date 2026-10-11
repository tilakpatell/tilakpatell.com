# tatooine/jabba-inside: the game's level

From `s2_2/levels/jabbaspalace_01` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs s2_2/levels/jabbaspalace_01 --world tatooine --district jabba-inside --inside --spot -22.9 20.8`; do not edit by hand.

- 473 instances in the arena (±1024 m), 0 beyond it (the horizon), 11206 left out above the ground (the world outside: its own pack), 5 cells of 128 m
- 429 meshes (0 left out), 291 LOD files, 3.65 MB
- the far list 0.01 MB; terrain near 1.10 MB, far 0.09 MB; the spot's ground 524.97 m in the game
- textures missing from the bucket: 0

| | low | mid | high |
|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 1000 (1000 m, 20000 m) | 1000 (1000 m, 20000 m) | 1000 (1000 m, 20000 m) |
| meshes dropped (instances) | 0 (0) | 0 (0) | 0 (0) |
| worst place: triangles, calls | 130k, 116 | 143k, 117 | 170k, 117 |
| texture bytes (every map the level has) | 3.32 MB | 8.63 MB | 8.63 MB |

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 648 | 76.3 KB | lane R's placed.js |
| actors.json | 0 | 0.2 KB | the scene's life rows |
| vehicles.json | 0 | 0.0 KB | the scene's rides and things |
| decals.json | 0 | 0.1 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 411 | 60.1 KB | fidelity X (nothing until it merges) |
| tracks.json | 0 | 1.2 KB | src/lib/three/animTracks.js |
| probes.json and probes/ | 65 | 6274.0 KB | levelProbes.js, lane R's grid |
| shadow/far.png | 1 | 339.5 KB | fidelity S (level.json's shadowCache) |
| scatter.json | 1 | 33.7 KB | fidelity N |

Not placed (no kind on the site yet, or scenery): none. Decals skipped: none. Tracks of owners the pack lacks: 25.

<!-- physics -->
## Physics

The game's shapes (`node scripts/bf2017-physics.mjs`).

| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 373 | 3176 | 88190 | 3 | 14 | 0 | 2210384 |

| heaviest cells | colliders | trimesh triangles |
| --- | --- | --- |
| 0,0 | 1500 | 20543 |
| 1,1 | 34 | 0 |
| 0,1 | 11 | 312 |
| -1,-1 | 1 | 0 |
| 1,0 | 1 | 0 |
<!-- /physics -->
