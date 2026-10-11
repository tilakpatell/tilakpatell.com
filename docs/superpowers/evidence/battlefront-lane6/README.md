# Lane 6: Strike, Extraction, Ewok Hunt and Supremacy’s ground on the sim

Twelve seeded no-player rounds each, `node scripts/battlefront-balance.mjs --mode <id> --runs 12 --jobs 3`, on the arenas of `src/lib/battlefront/fixtures/modeArena.js` (each map’s field a plane through its mode’s spawns, crates round its objectives, walled on the edge of a 250 m margin; Hoth’s Original-era soldiers; the game’s players a side). The tables: [strike.txt](strike.txt), [extraction.txt](extraction.txt), [ewokhunt.txt](ewokhunt.txt), [supremacy.txt](supremacy.txt).

| mode | map | players | results | median | kills (Rebels · Empire) | stuck | off the navgrid |
|---|---|---|---|--:|---|--:|--:|
| Strike (`Domination`, bombs) | Naboo_01 | 8 · 8 | two rounds each, sides swapped: the Rebels (attacking second) faster 10, the Empire 2 | 6.95 min | 38.7 · 36.2 | 0 | 0 |
| Extraction | Jabba’s palace | 8 · 8 | the Rebels carry the cargo home 12 of 12 | 2.55 min | 21.3 · 21.0 | 0 | 0 |
| Ewok Hunt | Endor_04 | 15 troopers · 5 Ewoks | the troopers extracted 5, wiped 6, the night run out on them 1 | 8.1 min | 9.2 (Ewoks) · 71.3 | 0 | 0 |
| Supremacy (ground) | Geonosis_02 | 20 · 20 | the Rebels 10, the Empire 2, each by the other’s reinforcements | 3.75 min | 44.6 · 49.2 | 0 | 0 |

Reported, not tuned: Extraction’s attackers win every round (Jabba’s palace’s checkpoints lie 50 to 65 m apart in a straight line here, where the game walks a corridor); Strike’s second attackers win the faster in 10 of 12; Ewok Hunt’s five Ewoks on the Rebels’ rifles kill few. The arena test (`npm run test:ai`, `src/lib/battlefront/modes/arena.test.js`) holds seed 1 of each to a result inside 25 minutes, stuck 0 and off 0, and one battle from one seed.
