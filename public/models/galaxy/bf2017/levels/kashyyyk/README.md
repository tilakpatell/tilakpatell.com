# kashyyyk: the game's level

From `levels/mp/kashyyyk_01` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs levels/mp/kashyyyk_01 --world kashyyyk --spot 260 -211`; do not edit by hand.

- 9679 instances in the arena (±1024 m), 1712 beyond it (the horizon), 85 left out under the ground (an interior: its own pack, `--inside`), 148 cells of 128 m
- 393 meshes (7 left out), 882 LOD files, 26.80 MB
- the far list 0.30 MB; terrain near 2.93 MB, far 3.61 MB; the spot's ground 134.49 m in the game
- textures missing from the bucket: 0

| | low | mid | high |
|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 24 (24 m, 480 m) | 50 (50 m, 1000 m) | 1000 (1000 m, 20000 m) |
| meshes dropped (instances) | 0 (0) | 0 (0) | 0 (0) |
| worst place: triangles, calls | 693k, 293 | 1332k, 376 | 2606k, 484 |
| texture bytes (every map the level has) | 20.28 MB | 66.05 MB | 66.05 MB |

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 237 | 24.7 KB | lane R's placed.js |
| actors.json | 0 | 0.4 KB | the scene's life rows |
| vehicles.json | 2 | 0.8 KB | the scene's rides and things |
| decals.json | 1 | 0.5 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 189 | 27.3 KB | fidelity X (nothing until it merges) |
| tracks.json | 30 | 11.6 KB | src/lib/three/animTracks.js |
| probes.json and probes/ | 7 | 675.8 KB | levelProbes.js, lane R's grid |
| shadow/far.png | 1 | 1479.5 KB | fidelity S (level.json's shadowCache) |
| scatter.json | 1 | 611.0 KB | fidelity N |

Not placed (no kind on the site yet, or scenery): tach_01 ×8, theed_event019a_mtt ×2, HCVwA9_Turbotank_SmallTurret_01 ×2, HCVwA9_Turbotank_Turrets_01 ×2, Vehicle_Air_LAAT_Gunship ×1, Vehicle_Air_VultureDroid ×6, Vehicle_Air_Vwing ×6, Vehicle_Ground_MTT_KeyFramed ×2, Vehicle_Ground_NR_N99_Persuader ×11, Vehicle_Stationary_Venator_Kashyyyk_Turret ×4. Decals skipped: none. Tracks of owners the pack lacks: 23.

<!-- physics -->
## Physics

The game's shapes (`node scripts/bf2017-physics.mjs`).

| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 293 | 3150 | 177160 | 0 | 15 | 0 | 3886884 |

| heaviest cells | colliders | trimesh triangles |
| --- | --- | --- |
| 1,-1 | 3261 | 180890 |
| 7,-2 | 3104 | 109914 |
| 6,-1 | 3053 | 160110 |
| 3,-1 | 3014 | 227204 |
| 7,-1 | 2919 | 96007 |
| 4,-1 | 2876 | 158267 |
| 4,0 | 2115 | 110544 |
| 0,-1 | 1916 | 113804 |
| 5,-1 | 1717 | 99013 |
| 0,-2 | 1488 | 189616 |
<!-- /physics -->
