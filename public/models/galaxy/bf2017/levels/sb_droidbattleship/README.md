# sb_droidbattleship: the game's level

From `levels/space/sb_droidbattleship_01` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs levels/space/sb_droidbattleship_01 --world sb_droidbattleship --spot 47 44 --subs SB_DroidBattleShip_01,Art,Art_LargeGameMode,Level_Design,SpaceBattle --drop SpaceBattle:jedicruiser_*,nowhere*,starcard*,Art:planet_*,Art:moon_* --share 0.5 --arena 6000 --ultra`; do not edit by hand.

- 1732 instances in the arena (±6000 m), 146 beyond it (the horizon), no terrain: no ground layer, the instances alone, 153 cells of 128 m
- left out: SpaceBattle:jedicruiser_*, nowhere*, starcard*, Art:planet_*, Art:moon_*
- never drawn as themselves (the NEVER rule: lighting proxies, light blockers, occluders, invisible collision, shadow-only meshes, destruction stages): none
- fitted to a share of the tiers' rows: low 0.5, mid 0.5, high 0.5, ultra 0.5
- 183 meshes (0 left out), 470 LOD files, 56.31 MB
- the far list 0.05 MB; terrain none; the spot's ground 0.00 m in the game
- textures missing from the bucket: 2
- ultra's maps held to 256.00 MB (lod.js's TEX_MB): 254.48 MB as the table gives them, 0 stepped down a size or more toward high's, normal and ORM first

| | low | mid | high | ultra |
|---|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 20 (20 m, 400 m) | 644 (644 m, 12880 m) | 1000 (1000 m, 20000 m) | 1000 (1000 m, 20000 m) |
| meshes dropped (instances) | 1 (1) | 0 (0) | 0 (0) | 0 (0) |
| worst place: triangles, calls | 264k, 157 | 675k, 216 | 1022k, 218 | 2178k, 222 |
| texture bytes (every map the level has) | 9.73 MB | 31.96 MB | 31.96 MB | 242.69 MB |
| mesh bytes a tier can draw (its LODs, its meshes) | 5.87 MB | 13.04 MB | 22.60 MB | 56.31 MB |

Dropped on low: meshp_lucrehulk_shield_sphere ×1

## The map's other parts

Written beside level.json by `scripts/bf2017-level-parts.mjs` (lane E0); a part the map lacks is an empty file.

| part | count | bytes | read by |
|---|---|---|---|
| lights.json | 1558 | 206.3 KB | lane R's placed.js |
| actors.json | 0 | 0.1 KB | the scene's life rows |
| vehicles.json | 0 | 2.1 KB | the scene's rides and things |
| decals.json and tex/decals/ | 16 | 437.1 KB | lane Q4's src/lib/three/decals/ |
| effects.json | 702 | 84.3 KB | fidelity X's effects |
| tracks.json | 12 | 3.7 KB | src/lib/three/animTracks.js |
| probes.json and probes/ | 0 | 0.0 KB | levelProbes.js, lane R's grid |
| shadow/far.png | 1 | 443.8 KB | fidelity S (level.json's shadowCache) |
| scatter.json | 0 | 0.0 KB | fidelity N |

Not placed (no kind on the site yet, or scenery): JediCruiser_Turrets_01 ×12, JediCruiser_Turrets_02 ×3, LucrehulkClass_DroidBattleShip_QuadLaserCannon_01 ×12, LucrehulkClass_DroidBattleShip_QuadLaserCannon_02 ×18, Vehicle_Air_ARC170 ×12, Vehicle_Air_AWingRZ3 ×1, Vehicle_Air_BTLYWing ×31, Vehicle_Air_DroidTriFighter ×18, Vehicle_Air_MillenniumFalcon ×1, Vehicle_Air_N1Starfighter ×1, Vehicle_Air_Scimitar ×1, Vehicle_Air_Slave1 ×1, Vehicle_Air_TieAdvancedX1 ×1, Vehicle_Air_TieBomber ×1, Vehicle_Air_TieFighter ×1, Vehicle_Air_TieFighterFirstOrder ×1, Vehicle_Air_TieInterceptor ×1, Vehicle_Air_VultureDroid ×19, Vehicle_Air_Vwing ×13, Vehicle_Air_XWing_T65 ×1, Vehicle_Air_XWing_T70 ×1, Vehicle_Air_Xwing_Red5 ×1, Vehicle_Air_Xwing_T70BlackOne ×1, Vehicle_Air_YWing ×1, VenatorStarDestroyer_HeavyTurret ×32, VenatorStarDestroyer_SideTurret ×8. Decals skipped: sub 32, outside 32. Tracks of owners the pack lacks: 24.

<!-- physics -->
## Physics

The game's shapes (`node scripts/bf2017-physics.mjs`).

| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 134 | 2024 | 297607 | 0 | 3 | 0 | 6124992 |

| heaviest cells | colliders | trimesh triangles |
| --- | --- | --- |
| -1,-1 | 1551 | 375894 |
| 1,1 | 727 | 39550 |
| 1,-3 | 613 | 27388 |
| 3,-7 | 571 | 26957 |
| -1,-4 | 502 | 23739 |
| -2,-3 | 462 | 23820 |
| 1,-2 | 429 | 22711 |
| 7,-4 | 407 | 22302 |
| -2,2 | 398 | 20953 |
| 9,3 | 377 | 20828 |
<!-- /physics -->
