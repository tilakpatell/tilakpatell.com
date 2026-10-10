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
