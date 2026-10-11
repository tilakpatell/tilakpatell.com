# Battlefront lane 1: the skirmish table

`node scripts/battlefront-balance.mjs --skirmish --runs 10 --profile` on 2026-10-10: twenty bots a side (the Rebels team 1, the Empire team 2, classes round-robin), Hoth's arena navgrid (`src/lib/battlefront/fixtures/hothFlat.js`: the map's bounds, a plane fitted through its 474 spawns, 1,835 solids made up round the Galactic Assault volumes, 27,540 cover slots), three minutes of sim, no player, no mode and so no respawns. "Stuck" is a bot alive, not in cover or hiding, on one spot for 20 s; "offNav" a bot off walkable ground at a 100th step. The arena test (`npm run test:ai -- src/lib/battlefront`) asserts seed 1's row.

```
seed  kills1  kills2  alive1  alive2  stuck  offNav  ms
1       19      9       11      1       0       0       1777  
2       17      11      9       3       0       0       2051  
3       19      7       13      1       0       0       2093  
4       19      14      6       1       0       0       2146  
5       18      12      8       2       0       0       1734  
6       20      9       11      0       0       0       1906  
7       11      18      2       9       0       0       2071  
8       19      6       14      1       0       0       2089  
9       14      19      1       6       0       0       3124  
10      20      10      10      0       0       0       1587  

10 runs, 20 a side, 180 s: kills 17.6 (Rebels) to 11.5 (Empire); more alive at the end: Rebels 8, Empire 2, even 0; stuck 0, off the navgrid 0; 2057.8 ms a run
profile: think 30.3 %, bolts.step 2.0 %, findPath 25.2 %
```

What it says:

- Both sides kill in every run (6 to 20 a side), nobody is stuck and nobody leaves the navgrid; a run is about 2 s of Node.
- The Rebels win 8 of 10. Nothing in the rules favours them (the two sides' classes carry the same health and the same guns' numbers: A280/E-11, RT-97C/DLT-19, DH-17/RK-3, DLT-20A/DLT-19X); they open on Hoth's defenders' side of the front, where the made-up walls round the volumes are, and the Empire walks into them. Lane 2's stages, spawn waves and objectives are what should even this out (the spec's 40 to 60 percent is for Galactic Assault, not this).
- Time goes to thinking (cover queries, perception's line tests) and finding paths, a quarter each; bolts are cheap.

## The bots lane (the sixth design): the game's targeting, cover queries and difficulties

`node scripts/battlefront-balance.mjs --skirmish [--difficulty <name>] [--pve]`, 2026-10-10 (late night): `main` as the lane found it, after the targeting (`ai/targeting.js`: the AI system's scores and the squad coordinator), after the cover queries (`ai/coverQuery.js`: the tactics' own queries in the selection form with the modes' objective term, `cover.js` the fallback; a bot that has fled into its cover hides there), then the same at three of the game's difficulties (`ai/difficulty.js`: the reaction before a first shot, the aim's settling, the aim widened at a sprinting or crouching target, the aim lever), and the Skirmish bots (`--pve`: the PvE templates, tactics and AI system, their abilities). Main had already drifted from the table above (the Empire's 11.5 kills to 7.7, from lane 2's changes).

| run | kills (Rebels) | kills (Empire) | more alive: Rebels / Empire / even | stuck | off | ms a run |
|---|---|---|---|---|---|---|
| `main` (`3883c758`) | 18.3 | 7.7 | 9 / 1 / 0 | 0 | 0 | 2,330 |
| + targeting | 17.3 | 7.8 | 9 / 1 / 0 | 0 | 0 | 3,128 |
| + cover queries | 15.9 | 10.2 | 6 / 4 / 0 | 0 | 0 | 3,002 |
| `--difficulty rookie` | 18.9 | 7.5 | 10 / 0 / 0 | 0 | 0 | 4,726 |
| `--difficulty normal` | 18.8 | 6.7 | 9 / 1 / 0 | 0 | 0 | 2,975 |
| `--difficulty expert` | 19.6 | 5.8 | 10 / 0 / 0 | 0 | 0 | 2,815 |
| `--difficulty normal --pve` | 12.0 | 11.0 | 5 / 4 / 1 | 0 | 0 | 13,868 |

The cover-queries run's seeds:

```
seed  kills1  kills2  alive1  alive2  stuck  offNav  ms
1       9       20      0       11      0       0       2460  
2       19      4       16      1       0       0       3741  
3       20      1       19      0       0       0       2754  
4       20      4       16      0       0       0       3744  
5       11      20      0       9       0       0       2870  
6       20      7       13      0       0       0       4111  
7       10      20      0       10      0       0       2266  
8       11      20      0       9       0       0       2479  
9       19      3       17      1       0       0       2505  
10      20      3       17      0       0       0       3088  

10 runs, 20 a side, 180 s: kills 15.9 (Rebels) to 10.2 (Empire); more alive at the end: Rebels 6, Empire 4, even 0; stuck 0, off the navgrid 0; 3001.8 ms a run
```

What it says:

- Stuck and off stay 0 in every run. Two things on the way would have broken that and were fixed, not tuned: a bot that fled into the cover its flee query chose stood there in the flee state (it now hides there), and the flee query's angle measured from the bot rejected the spot the bot stood on (the angle is now left out there, not read as 0°).
- The game's cover queries even the skirmish (the Empire's kills 7.7 to 10.2) once the modes' objective term is carried into them; without it (the first cut) the routs went both ways and Galactic Assault's attackers stalled in cover (the lane 2 table's rows). Seed 1 can still be a rout, so the arena test counts the kills over seeds 1 to 3, at least two a run on average for each side.
- A difficulty is the bots' on both sides here, so it shifts nothing between them by design; what it does change is how fast a fight is decided, and the harder rows let the side that already has the ground (the Rebels on Hoth's defenders' side) press it: expert 19.6 to 5.8. Against a player, rookie's bots also wait 0.54 to 2.88 s before a first shot (expert 0.15 to 0.8), aim 1.5 times wider (expert 0.7), and hit for three quarters.
- The Skirmish bots fight each other evenly (12.0 to 11.0) and use their abilities, but cost about four and a half times the thinking: their PvE queries look further (Attack_PvE's 70 m, held to 40) and test lines of fire. The line tests are scored last and skipped for a slot that cannot win.
