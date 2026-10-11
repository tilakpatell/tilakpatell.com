# hoth/outpost: the game's level

From `s9_3/hoth_02` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs s9_3/hoth_02 --world hoth --district outpost --spot 90 -1250 --subs Hoth_02,Content,Mode1 --ultra`; do not edit by hand.

- 5834 instances in the arena (±1024 m), 339 beyond it (the horizon), 168 left out under the ground (an interior: its own pack, `--inside`), 152 cells of 128 m
- proxies by their shaders, never drawn (materials.jsonl: SS_Shadowmesh casts shadows only, SS_VirtualTextureOnly paints the terrain's virtual texture only): none
- never drawn as themselves (the NEVER rule: lighting proxies, light blockers, occluders, invisible collision, shadow-only meshes, destruction stages): none
- 163 meshes (3 left out), 494 LOD files, 17.05 MB
- the far list 0.18 MB; terrain near 2.51 MB, far 2.20 MB; the spot's ground 331.45 m in the game
- textures missing from the bucket: 4
- ultra's maps held to 256.00 MB (lod.js's TEX_MB): 270.09 MB as the table gives them, 5 stepped down a size or more toward high's, normal and ORM first

| | low | mid | high | ultra |
|---|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 34 (34 m, 680 m) | 129 (129 m, 2580 m) | 1000 (1000 m, 20000 m) | 1000 (1000 m, 20000 m) |
| meshes dropped (instances) | 0 (0) | 0 (0) | 0 (0) | 0 (0) |
| worst place: triangles, calls | 708k, 133 | 1348k, 162 | 1578k, 183 | 2187k, 200 |
| texture bytes (every map the level has) | 9.52 MB | 30.94 MB | 30.94 MB | 242.42 MB |
| mesh bytes a tier can draw (its LODs, its meshes) | 4.22 MB | 6.74 MB | 9.82 MB | 17.05 MB |

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 12 | 1.2 KB | lane R's placed.js |
| actors.json | 0 | 0.2 KB | the scene's life rows |
| vehicles.json | 19 | 1.3 KB | the scene's rides and things |
| decals.json and tex/decals/ | 0 | 0.1 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 140 | 15.4 KB | fidelity X's effects |
| tracks.json | 0 | 1.2 KB | src/lib/three/animTracks.js |
| probes.json and probes/ | 0 | 0.1 KB | levelProbes.js, lane R's grid |
| shadow/far.png | 0 | 0.0 KB | fidelity S (level.json's shadowCache) |
| scatter.json | 1 | 52.3 KB | fidelity N |

Not placed (no kind on the site yet, or scenery): NT_Turret_AA_Crait ×1. Decals skipped: none. Tracks of owners the pack lacks: 25.

<!-- physics -->
## Physics

The game's shapes (`node scripts/bf2017-physics.mjs`).

| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 128 | 1421 | 64346 | 2 | 6 | 0 | 1610060 |

| heaviest cells | colliders | trimesh triangles |
| --- | --- | --- |
| 0,-1 | 1864 | 47458 |
| 0,0 | 1838 | 34769 |
| -1,0 | 1758 | 33522 |
| 0,-2 | 1739 | 39395 |
| -1,-3 | 1714 | 40674 |
| -1,-2 | 1551 | 42940 |
| 0,-3 | 1531 | 38176 |
| -2,-2 | 1497 | 33735 |
| 1,-2 | 1465 | 33528 |
| -1,-1 | 1363 | 30021 |
<!-- /physics -->

## Variations

Written by `node scripts/bf2017-variations.mjs hoth/outpost` from the level's 8 mesh variation databases (variations.json, 0.11 MB).

| meshes | with variations | applied by instances | by the level rule | mixed (default drawn) | textures missing from the bucket | maps not in the pack |
|---|---|---|---|---|---|---|
| 162 | 17 | 9 | 0 | 2 | 12 | 0 |
