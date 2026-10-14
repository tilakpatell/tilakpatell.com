# hoth/ga: the game's level

From `levels/mp/hoth_01` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs levels/mp/hoth_01 --world hoth --district ga --subs FantasyBattle --spot 205 -1540 --part --ultra`; do not edit by hand.

- 192 instances in the arena (±1024 m), 0 beyond it (the horizon), a mode’s part: above the ground and under it, no ground layer of its own, 20 cells of 128 m
- proxies by their shaders, never drawn (materials.jsonl: SS_Shadowmesh casts shadows only, SS_VirtualTextureOnly paints the terrain's virtual texture only): none
- never drawn as themselves (the NEVER rule: lighting proxies, light blockers, occluders, invisible collision, shadow-only meshes, destruction stages): atat_destruction_01_despawn_body_skinned_02 ×2, atat_destruction_01_despawn_head_skinned ×2, atat_destruction_01_despawn_neck_skinned ×2, atat_destruction_01_exterior_body ×2, atat_destruction_01_exterior_head ×2, atat_destruction_01_exterior_neck ×2, atat_destruction_01_interior_body ×2, atat_destruction_01_interior_head ×2, atat_destruction_01_interior_neck ×2, atat_destruction_01_leftover_body_skinned ×2, atat_destruction_01_leftover_head_skinned ×2, atat_destruction_01_leftover_neck_skinned ×2, hoth_01_event004_v006_despawn ×2
- 602 meshes (4 left out), 152 LOD files, 13.00 MB
- the far list 0.01 MB; terrain near 2.50 MB, far 2.20 MB; the spot's ground 362.30 m in the game
- textures missing from the bucket: 0
- ultra's maps held to 256.00 MB (lod.js's TEX_MB): 164.20 MB as the table gives them, 0 stepped down a size or more toward high's, normal and ORM first

| | low | mid | high | ultra |
|---|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 1000 (1000 m, 20000 m) | 1000 (1000 m, 20000 m) | 1000 (1000 m, 20000 m) | 1000 (1000 m, 20000 m) |
| meshes dropped (instances) | 0 (0) | 0 (0) | 0 (0) | 0 (0) |
| worst place: triangles, calls | 60k, 76 | 73k, 77 | 78k, 77 | 205k, 80 |
| texture bytes (every map the level has) | 7.15 MB | 23.36 MB | 23.36 MB | 156.59 MB |
| mesh bytes a tier can draw (its LODs, its meshes) | 1.73 MB | 3.25 MB | 4.88 MB | 13.00 MB |

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 691 | 88.8 KB | lane R's placed.js |
| actors.json | 10 | 1.0 KB | the scene's life rows |
| vehicles.json | 27 | 1.7 KB | the scene's rides and things |
| decals.json and tex/decals/ | 0 | 0.1 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 398 | 42.8 KB | fidelity X's effects |
| tracks.json | 0 | 1.2 KB | src/lib/three/animTracks.js |
| probes.json and probes/ | 6 (and 6 at 128² with the sun, for ultra) | 2885.2 KB | levelProbes.js, lane R's grid |
| shadow/far.png | 1 | 2843.6 KB | fidelity S (level.json's shadowCache) |
| enlighten/ | 0 | 0.0 KB | lane N3's light/baked.js (level.json's enlighten) |
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
| -3,4 | 195 | 5961 |
| -2,1 | 129 | 8388 |
| -1,-2 | 111 | 1375 |
| 0,-1 | 97 | 1838 |
| -1,1 | 88 | 4207 |
| -1,-1 | 69 | 1838 |
| 0,-2 | 69 | 352 |
| -1,2 | 66 | 2635 |
| 0,1 | 66 | 2635 |
| -2,3 | 58 | 2459 |
<!-- /physics -->

<!-- mode -->
## The mode

What each mesh is in the game (`node scripts/bf2017-level-mode.mjs hoth/ga`, scripts/lib/bf2017-level-mode.mjs; bf2-re findings/58): mode.json.

| | count | the rule |
| --- | --- | --- |
| doors | 10 (15 leaves) | PF_AutomaticDoor_Controller: the trigger box of the door's team, Sine EaseOut over the door's duration |
| gates | 2 (4 leaves) | the same controller, opened at the panel (the main session's gates.js) |
| static | 61 | stands (the end of round’s room inside the mode prefab never drawn) |
| pickup | 33 | the HH-12 shown while the pickup is enabled (the level graph); its crate stands |
| charge | 3 | shown while armed, until it goes off |
| wreck | 17 | shown once its vehicle is destroyed, until it spawns again |
| walker | 42 | a walker’s destruction stages and its fall’s dressing: hidden, played where the walker falls (its own rows) |
| gateRuin | 2 | shown once its gate is destroyed |
| walls | 104 (78 soldiers only) | OBBCollisionEntityData, fixed |
| unmatched | 0 | |
