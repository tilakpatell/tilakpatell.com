# Battlefront lane 2: the Galactic Assault table

`node scripts/battlefront-balance.mjs --assault --runs 20 --jobs 4` on 2026-10-10: Hoth’s Galactic Assault, twenty bots a side (the Empire, team 2, attacking; the Rebels, team 1, defending), Hoth’s arena navgrid (`src/lib/battlefront/fixtures/hothFlat.js`), no player, each round stepped to a result or 25 minutes. The arena test (`npm run test:ai -- src/lib/battlefront`) asserts seed 1’s row.

```
seed  winner  why  stage  minutes  kills1  kills2  heroes1  heroes2  ms
1       Empire  objectives  2       13.7    92      80      0       0       35839 
2       Rebels  wiped       1       15.4    150     103     0       0       35274 
3       Empire  objectives  2       14.1    128     92      0       0       36826 
4       Rebels  wiped       1       17.6    150     108     0       0       32668 
5       Empire  objectives  2       18.3    154     98      0       0       56779 
6       Rebels  wiped       1       15.8    150     107     0       0       36151 
7       Rebels  wiped       1       15.4    150     86      0       0       34248 
8       none    -           2       25      189     129     0       0       68588 
9       Empire  objectives  2       9.1     68      62      0       0       22046 
10      Empire  objectives  2       13.4    78      77      0       0       37610 
11      Empire  objectives  2       17.6    167     130     0       0       49718 
12      Rebels  wiped       1       17.2    150     139     0       0       41971 
13      Empire  objectives  2       9.5     71      75      0       0       22012 
14      Empire  objectives  2       10.4    85      62      0       0       28086 
15      Empire  objectives  2       13.3    115     103     0       0       36360 
16      Rebels  wiped       1       14.5    150     101     0       0       32708 
17      Empire  objectives  2       11.6    116     92      0       0       27608 
18      Rebels  wiped       1       16.5    150     119     0       0       41852 
19      Rebels  wiped       1       17.5    150     92      0       0       42549 
20      Empire  objectives  2       10.8    91      82      0       0       27317 

20 rounds, 20 a side: the Empire (attacking) wins 11, the Rebels 8, no result in 25 min 1; median 14.95 min; kills 127.7 (Rebels) to 96.8 (Empire); heroes 0.0 to 0.0; stuck 0, off the navgrid 0; 37310.5 ms a round
```

What it says:

- The attackers win 11 of 20 (the spec’s band is 8 to 12), the defenders 8, and one round (seed 8) had no result at 25 minutes: its escape stage ran 15 minutes before the tickets were gone, and the last attackers were still being hunted down at the bell. The median round is 15 minutes (the band is 8 to 18). Nobody was stuck and nobody left the navgrid.
- The attackers always win the walkers’ stage on this setting (in earlier settings the Rebels’ bombing runs brought both walkers down in 1 to 12 rounds of 20; see below): the Rebels’ eight wins are all at the hangars, by tickets. When the Empire gets through the hangars it takes the fuel in 2 to 12 minutes.
- No bot bought a hero: the commander buys a reinforcement as soon as a bot can (the plan’s order: a hero if affordable, else a reinforcement), so balances reach 1,000 and are spent long before 4,000. Reinforcements are bought throughout.
- A round is 37 s of Node on average (22 to 69 s), 3 min 36 s for the twenty on four processes.

## How it got here: every change, in order

Each line is a 20-seed sweep (a few early ones 5 or 12) after the change named; “attackers” is the Empire’s wins, “none” rounds with no result at 25 minutes.

| change | attackers | defenders | none | median | note |
| --- | --- | --- | --- | --- | --- |
| first run: tickets 300 (+60 a stage), capture from −1, uplinks fire at will, the bombing run opens the walkers only | 1 of 5 | 0 | 4 | 25 | the hangars and the tickets drag past 25 min |
| path searches capped (`FAR` 80 m, legs of `LEG` 40 m, `SEARCH_CELLS` 6,000) and the uplinks’ consoles unwalled in the fixture | | | | | a minute of battle from 21 s to 1 s of Node: 5,741 of 7,294 searches had hit the cap, most toward the walled-in consoles |
| `BOMBING_RUN` 0.1 of each walker’s health a run | 0 of 12 | 11 | 1 | 2.3 | ten runs in two minutes: the walkers always fall |
| one run in the air at a time, consoles open only with a walker within `UPLINK_RANGE` 150 m | 1 of 8 | 0 | 7 | 25 | runs now rare; the walkers always arrive |
| `UPLINK_RANGE` 250, `BOMBING_RUN` 0.15, `TICKETS_START` 150 (+50) | 6 of 12 | 6 | 0 | 17 | |
| `BOMBING_RUN` 0.2 | 7 | 13 | 0 | 18.7 | |
| `ADVANTAGE_MAX` 6 (from 4) | 9 | 9 | 2 | 18.9 | the hangars fall more often; the rounds run long |
| `TICKETS_START` 110 (+40) | 6 | 14 | 0 | 14.9 | |
| commander `WEIGHTS.guard` 0.6 (from 0.3) | 2 | 17 | 1 | 15.7 | reverted |
| spawns favouring the third of the area nearest the objectives; a deployed bot takes its squad’s orders at once | 1 | 19 | 0 | 13.8 | the defenders, already beside the hangars, gained most: the spawn rule reverted, the orders kept |
| orders at once alone | 4 | 16 | 0 | 13.6 | |
| capture points open at 0 (the plan’s `PF_CapturePoint` 0 to 1), not −1 | 3 | 17 | 0 | 15 | |
| bots on a take or escort order never flee | 0 | 20 | 0 | 5.1 / 12.6 | steady defenders at the uplinks called many more runs; narrowed to take and escort, still worse: reverted |
| `AIM_SCALE` 1.5 (both sides’ aim boxes wider: fewer deaths a minute, so tickets last against the fixed capture time) | 5 | 15 | 0 | 15.9 | |
| `AIM_SCALE` 2 | 7 | 13 | 0 | 16.4 | |
| `AIM_SCALE` 2.5 | 9 | 11 | 0 | 17.2 | |
| `BOMBING_RUN` 0.2 (kept) | 9 | 11 | 0 | 16.7 | two rounds to the walkers’ fall |
| a bot that cannot step into its path’s next cell leaves it out for `AVOID` 10 s (a door the grid calls open and the body does not fit) | 6 | 14 | 0 | 17.3 | stuck bots 2 → 0 |
| `AIM_SCALE` 3, `TICKETS_START` 100 | 12 | 8 | 0 | 17.6 | |
| `TICKETS_START` 90 (+40): **the setting shipped** | 11 | 8 | 1 | 15.4 | the table above |

The outcome of one seed is chaotic: a small change to any bot’s path changes who meets whom, so the sweeps move by two or three wins without a change of balance. The levers in the order the plan gives them: `AIM_SCALE` (`modes/galacticAssault.js`, set on the sim, so the skirmish keeps 1), `ADVANTAGE_MAX` (`modes/objectives.js`), `TICKETS_START` and `TICKETS_TOP_UP`, the commander’s `WEIGHTS`; and the two of the walkers’ stage, `BOMBING_RUN` and `UPLINK_RANGE`.

## The skirmish after lane 2

`node scripts/battlefront-balance.mjs --skirmish --runs 10`: kills 18.3 (Rebels) to 7.7 (Empire), the Rebels ahead in 9, stuck 0, off 0, 2.1 s a run (lane 1’s was 17.6 to 11.5, the Rebels ahead in 8). Two lane 2 changes moved it: the uplinks’ consoles are no longer walled in by the fixture (lane 1’s walls closed every volume too small for a door), and goals over 80 m are walked to by 40 m legs. The skirmish arena’s “both sides kill” now asks for more than 3 each (seed 1: 20 to 5).
