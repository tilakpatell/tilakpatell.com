# Collision with buildings: what was measured (2026-10-10)

The Battlefront world's soldiers now walk round Hoth's buildings, rocks and trenches, and the camera's arm stops at them. The plan was the research report's (`research-collision.md`, §4). The numbers here come from running the committed pack through the scripts below on the site's own machine, in Node.

## The data

`node scripts/bf2017-physics.mjs public/models/galaxy/bf2017/levels/hoth` put the game's shapes into the pack. Its outputs are committed:

| meshes with shapes | hulls | mesh triangles | capsules | spheres | dropped | bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 432 | 3,539 | 236,905 | 3 | 23 | 0 | 5,249,252 |

- `level.json` went from 273,044 to 448,106 bytes. It is written compactly now, and its keys stay in the pack's own order (`ground` is still last). Only the physics section is sorted.
- `physics/` holds 432 files.

`node scripts/bf2017-nav.mjs public/models/galaxy/bf2017/levels/hoth --map hoth` built `nav.bin`:

- The grid is 961 × 996 cells of 2 m over `maps/hoth.json`'s bounds, with a 0.5 m fine grid.
- 5,728 bodies went in; none were refused.
- The build took 42–44 s. The output is 226,866 bytes deflated.

## Paths from the spawns to the objectives

Both tables use the 219 Galactic Assault spawns. Each team's path starts from its first enabled spawn: `FantasyBattle_Logic:17` for team 2 and `FantasyBattle_Logic:28` for team 1. The paths go to the middles of the mode's 22 volumes. A* searched up to 10⁶ cells. The column for the bots' search uses lane 1's `MAX_EXPAND`, which is 20,000 cells.

**Capsule radius 0.3** (the record's `PhysicalRadius`). This is the version written to the pack.

| nav source | solid cells | spawns not walkable | paths found (team 2 / team 1) | found within the bots' 20,000 cells | metres walked (team 2 / team 1) | nav build |
| --- | --- | --- | --- | --- | --- | --- |
| ground only | 0 | 8 of 219 | 22 / 22 of 22 | 0 / 20 | 28,606 / 4,123 | 256 ms |
| ground and the capsule mask (r 0.3) | 57,280 | 14 of 219 | 22 / 22 of 22 | 1 / 20 | 29,749 / 4,441 | 516 ms |

**Capsule radius 0.6** (a dry run with `--radius 0.6`, chosen by hand):

| nav source | solid cells | spawns not walkable | paths found (team 2 / team 1) | found within the bots' 20,000 cells | metres walked (team 2 / team 1) | nav build |
| --- | --- | --- | --- | --- | --- | --- |
| ground only | 0 | 8 of 219 | 22 / 22 of 22 | 0 / 20 | 28,606 / 4,123 | 259 ms |
| ground and the capsule mask (r 0.6) | 62,015 | 14 of 219 | 22 / 22 of 22 | 1 / 20 | 29,955 / 4,557 | 618 ms |

What the tables show:

- With the mask, every objective is still reachable for both teams.
- The walks get 4–8 % longer because they go round things.
- The six extra spawns that are not walkable are inside or against shapes. Deploying moves them to the nearest open ground (`sim.js` uses `nearestMainland`).
- The research measured the same grid at 57,278 solid cells and 22 / 22. The two extra cells here come from this build's probe.
- **Team 2's spawn is about 1.3 km from the objectives.** A* finds a path within the bots' 20,000-cell search from almost none of its 22 volumes, with or without the mask. This is lane 1's search limit and was true before this change. The bots aim at nearer goals, so it is not this topic's to fix, but it is worth knowing.

## The camera's level physics at runtime

This was run in Node with `createLevelCollision` from `map/collision.js` and lane P0's `createLevelPhysics`, high tier. It used the 3 × 3 near cells round team 1's spawn at (132.2, 319.2, −1286.2).

- 1,943 bodies and 8,934 colliders. Adding them and running `update(Infinity)` took 1,004 ms. On the page, `update(4)` spreads this across frames.
- 24 ball sweeps (r 0.15, 40 m) at chest height round the spawn all hit a shape, between 2.9 and 34.7 m away. The frames agree: the export frame's question is turned into the pack's frame.
- Of the 782 mask cells within 60 m of the spawn, 765 have a shape under them when a ball (r 0.3) is swept down from above in the engine.
  - The high tier's budget dropped 221 of the cells' bodies (lane P0's `budgetCell`, which drops the lightest hulls first).
  - With no budget (2,832 bodies, 13,438 colliders), 777 of the 782 cells have a shape under them.
  - The last 5 were not looked into.
  - So the camera passes through the hulls the budget drops. The soldiers do not, because the mask was built from every shape.

## The tests

- `src/lib/battlefront/navMask.test.js` (8)
- `src/lib/battlefront/nav.mask.test.js` (6)
- `scripts/lib/bf2017-nav.test.mjs` (5)
- `src/components/battlefront/battle.mask.test.js` (2)
- `src/components/battlefront/map/collision.test.js` (7)
- `src/components/battlefront/map/level.test.js` (+2)
- `src/components/galaxy/shared/shared.test.js` (the face now lends `createLevelPhysics` and `wantsEngine`)
