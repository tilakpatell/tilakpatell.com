# scarif: the game's level

From `s9_3/scarif/levels/mp/scarif_02` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs s9_3/scarif/levels/mp/scarif_02 --world scarif --spawn --subs Scarif_02,Phase_02,Phase_02_Unique`; do not edit by hand.

- 4380 instances in the arena (±1024 m), 118 beyond it (the horizon), 22 left out under the ground (an interior: its own pack, `--inside`), 64 cells of 128 m
- 538 meshes (152 left out), 749 LOD files, 14.72 MB
- the far list 0.13 MB; terrain near 0.73 MB, far 0.16 MB; the spot's ground 213.10 m in the game
- textures missing from the bucket: 8

| | low | mid | high |
|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 169 (169 m, 3380 m) | 1000 (1000 m, 20000 m) | 1000 (1000 m, 20000 m) |
| meshes dropped (instances) | 0 (0) | 0 (0) | 0 (0) |
| worst place: triangles, calls | 658k, 315 | 771k, 335 | 837k, 340 |
| texture bytes (every map the level has) | 14.03 MB | 43.97 MB | 43.97 MB |

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 16 | 2.4 KB | lane R's placed.js |
| actors.json | 0 | 0.1 KB | the scene's life rows |
| vehicles.json | 0 | 0.0 KB | the scene's rides and things |
| decals.json | 0 | 0.1 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 12 | 1.8 KB | fidelity X (nothing until it merges) |
| tracks.json | 0 | 1.2 KB | src/lib/three/animTracks.js |
| probes.json and probes/ | 0 | 0.0 KB | levelProbes.js, lane R's grid |
| shadow/far.png | 1 | 836.1 KB | fidelity S (level.json's shadowCache) |
| scatter.json | 0 | 0.0 KB | fidelity N |

Not placed (no kind on the site yet, or scenery): none. Decals skipped: none. Tracks of owners the pack lacks: 25.

<!-- physics -->
## Physics

The game's shapes (`node scripts/bf2017-physics.mjs`).

| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 441 | 2808 | 121485 | 1 | 5 | 0 | 2816592 |

| heaviest cells | colliders | trimesh triangles |
| --- | --- | --- |
| -2,-1 | 4559 | 205004 |
| -1,-1 | 1926 | 76343 |
| -2,0 | 954 | 43126 |
| -3,-1 | 534 | 8416 |
| 0,-1 | 301 | 13309 |
| -1,-2 | 236 | 6723 |
| -2,-2 | 147 | 2188 |
| -3,0 | 117 | 5505 |
| -1,0 | 91 | 3119 |
| -6,0 | 50 | 0 |
<!-- /physics -->
