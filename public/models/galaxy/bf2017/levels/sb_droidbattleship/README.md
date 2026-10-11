# sb_droidbattleship: the game's level

From `levels/space/sb_droidbattleship_01` (Star Wars Battlefront II, 2017, EA DICE; used with permission on this non-commercial fan project). Written by `node scripts/bf2017-level.mjs levels/space/sb_droidbattleship_01 --world sb_droidbattleship --spot 47 44 --subs SB_DroidBattleShip_01,Art,Art_LargeGameMode,Level_Design,SpaceBattle --drop SpaceBattle:jedicruiser_*,nowhere*,starcard*,Art:planet_*,Art:moon_* --share 0.5 --arena 6000`; do not edit by hand.

- 1732 instances in the arena (±6000 m), 146 beyond it (the horizon), no terrain: no ground layer, the instances alone, 153 cells of 128 m
- left out: SpaceBattle:jedicruiser_*, nowhere*, starcard*, Art:planet_*, Art:moon_*
- fitted to 0.5 of each tier's triangles and calls (drawn beside the galaxy's flight page)
- 183 meshes (0 left out), 394 LOD files, 22.60 MB
- the far list 0.05 MB; terrain none; the spot's ground 0.00 m in the game
- textures missing from the bucket: 2

| | low | mid | high |
|---|---|---|---|
| drawn out to (radii: a 1 m thing, a 20 m one) | 20 (20 m, 400 m) | 644 (644 m, 12880 m) | 1000 (1000 m, 20000 m) |
| meshes dropped (instances) | 1 (1) | 0 (0) | 0 (0) |
| worst place: triangles, calls | 264k, 157 | 675k, 216 | 1022k, 218 |
| texture bytes (every map the level has) | 9.73 MB | 31.96 MB | 31.96 MB |

Dropped on low: meshp_lucrehulk_shield_sphere ×1

