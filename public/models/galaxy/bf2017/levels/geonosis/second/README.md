# geonosis/second: the game's level

From `s6_2/geonosis_02/levels/geonosis_02` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs s6_2/geonosis_02/levels/geonosis_02 --world geonosis --district second --spot 1838 -767 --subs geonosis_02,world_content,dunes,crashsite`; do not edit by hand.

- 5982 instances in the arena (±1024 m), 368 beyond it (the horizon), 385 left out under the ground (an interior: its own pack, `--inside`), 129 cells of 128 m
- 837 meshes (9 left out), 905 LOD files, 25.99 MB
- the far list 0.18 MB; terrain near 4.09 MB, far 3.04 MB; the spot's ground 114.47 m in the game
- textures missing from the bucket: 0

| | low | mid | high |
|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 20 (20 m, 400 m) | 56 (56 m, 1120 m) | 1000 (1000 m, 20000 m) |
| meshes dropped (instances) | 0 (0) | 0 (0) | 0 (0) |
| worst place: triangles, calls | 688k, 212 | 1345k, 292 | 2078k, 401 |
| texture bytes (every map the level has) | 20.49 MB | 63.27 MB | 63.27 MB |

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 400 | 46.1 KB | lane R's placed.js |
| actors.json | 0 | 0.5 KB | the scene's life rows |
| vehicles.json | 0 | 0.2 KB | the scene's rides and things |
| decals.json | 394 | 109.8 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 1456 | 233.1 KB | fidelity X (nothing until it merges) |
| tracks.json | 24 | 7.4 KB | src/lib/three/animTracks.js |
| probes.json and probes/ | 139 | 13417.1 KB | levelProbes.js, lane R's grid |
| shadow/far.png | 1 | 329.6 KB | fidelity S (level.json's shadowCache) |
| scatter.json | 1 | 879.0 KB | fidelity N |

Not placed (no kind on the site yet, or scenery): geo_homingspiderdroid_anim ×1, HomingSpiderDroidGunBottom ×1, HomingSpiderDroidGunTop ×1. Decals skipped: sub 164, texture 24. Tracks of owners the pack lacks: 24.

<!-- physics -->
## Physics

The game's shapes (`node scripts/bf2017-physics.mjs`).

| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 744 | 4657 | 657121 | 14 | 20 | 0 | 13405012 |

| heaviest cells | colliders | trimesh triangles |
| --- | --- | --- |
| -3,0 | 4535 | 298587 |
| -3,1 | 4152 | 281489 |
| -1,0 | 4099 | 279140 |
| -2,1 | 3969 | 320455 |
| -2,-1 | 3313 | 187366 |
| -3,-1 | 3224 | 199259 |
| -2,0 | 2988 | 262703 |
| -3,-2 | 2889 | 154173 |
| -1,1 | 2619 | 222871 |
| -4,1 | 2430 | 159241 |
<!-- /physics -->
