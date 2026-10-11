# tatooine/jabba: the game's level

From `s2_2/levels/jabbaspalace_01` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs s2_2/levels/jabbaspalace_01 --world tatooine --district jabba --spot -22.9 20.8 --ultra`; do not edit by hand.

- 11196 instances in the arena (±1024 m), 9 beyond it (the horizon), 473 left out under the ground (an interior: its own pack, `--inside`), 10 cells of 128 m
- proxies by their shaders, never drawn (materials.jsonl: SS_Shadowmesh casts shadows only, SS_VirtualTextureOnly paints the terrain's virtual texture only): palace_01_shadowmesh (shadow proxy)
- never drawn as themselves (the NEVER rule: lighting proxies, light blockers, occluders, invisible collision, shadow-only meshes, destruction stages): mesh_light_cone_00 ×20, mesh_enlightenproxy_02 ×7, palace_01_shadowmesh ×1
- 429 meshes (1 left out), 1356 LOD files, 20.39 MB
- the far list 0.34 MB; terrain near 1.10 MB, far 0.09 MB; the spot's ground 524.97 m in the game
- textures missing from the bucket: 1
- ultra's maps held to 256.00 MB (lod.js's TEX_MB): 359.04 MB as the table gives them, 54 stepped down a size or more toward high's, normal and ORM first

| | low | mid | high | ultra |
|---|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 20 (20 m, 400 m) | 58 (58 m, 1160 m) | 1000 (1000 m, 20000 m) | 1000 (1000 m, 20000 m) |
| meshes dropped (instances) | 14 (444) | 0 (0) | 0 (0) | 0 (0) |
| worst place: triangles, calls | 217k, 315 | 539k, 449 | 1400k, 555 | 1570k, 603 |
| texture bytes (every map the level has) | 21.29 MB | 54.96 MB | 54.96 MB | 244.13 MB |
| mesh bytes a tier can draw (its LODs, its meshes) | 11.57 MB | 16.34 MB | 19.15 MB | 20.39 MB |

Dropped on low: wallmountedcomputer_01_a ×5, fansmall_01 ×2, pipessystem_palace_small_s32_01 ×30, machinewallmedium_03 ×6, machinewallmedium_02 ×4, fx_7medicassistant_01 ×1, cablessullustelectric_512_02 ×5, box_s_04 ×33, pipessystem_palace_small_detail_connector_01 ×53, beachbase_sanddecal_01_a ×2, machinewallmedium_04 ×14, machinegenerator_02 ×5, scrapgeneric_s_03 ×218, controlpanelsmall_02 ×66

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 648 | 76.3 KB | lane R's placed.js |
| actors.json | 0 | 0.2 KB | the scene's life rows |
| vehicles.json | 0 | 0.0 KB | the scene's rides and things |
| decals.json and tex/decals/ | 0 | 0.1 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 411 | 47.2 KB | fidelity X's effects |
| tracks.json | 0 | 1.2 KB | src/lib/three/animTracks.js |
| probes.json and probes/ | 65 (and 65 at 128² with the sun, for ultra) | 31255.7 KB | levelProbes.js, lane R's grid |
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
