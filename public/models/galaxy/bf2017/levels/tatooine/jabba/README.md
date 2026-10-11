# tatooine/jabba: the game's level

From `s2_2/levels/jabbaspalace_01` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs s2_2/levels/jabbaspalace_01 --world tatooine --district jabba --spot -22.9 20.8`; do not edit by hand.

- 11197 instances in the arena (±1024 m), 9 beyond it (the horizon), 473 left out under the ground (an interior: its own pack, `--inside`), 10 cells of 128 m
- 429 meshes (0 left out), 1348 LOD files, 19.16 MB
- the far list 0.34 MB; terrain near 1.10 MB, far 0.09 MB; the spot's ground 524.97 m in the game
- textures missing from the bucket: 2

| | low | mid | high |
|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 20 (20 m, 400 m) | 58 (58 m, 1160 m) | 1000 (1000 m, 20000 m) |
| meshes dropped (instances) | 16 (110) | 0 (0) | 0 (0) |
| worst place: triangles, calls | 219k, 315 | 539k, 450 | 1400k, 556 |
| texture bytes (every map the level has) | 21.26 MB | 54.90 MB | 54.90 MB |

Dropped on low: beachbase_sanddecal_01_a ×2, mudsplatter_05 ×1, dirtdecals_01 ×1, wallmountedcomputer_01_a ×5, beachbase_sanddecal_01_c ×3, mudsplatter_04 ×2, waterpuddledecals_01 ×2, leak_01_e ×25, sandpiledecal_01_b ×4, leak_02_b ×11, fansmall_01 ×2, bottom_01_a ×13, leak_01_d ×7, mudsplatter_03 ×5, leak_01_b ×22, cablessullustelectric_512_02 ×5

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
| 0,0 | 11959 | 273477 |
| 1,1 | 7458 | 193250 |
| 0,1 | 5286 | 140228 |
| 1,0 | 905 | 18775 |
| -1,0 | 798 | 33755 |
| -1,-1 | 345 | 17754 |
| 0,-1 | 207 | 7356 |
| -1,1 | 37 | 440 |
| -2,-6 | 1 | 0 |
| -4,-5 | 1 | 0 |
<!-- /physics -->
