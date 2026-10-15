# The heroes in the sim: balance and the page (PR #974, 2026-10-15)

What the heroes' kit (`src/lib/battlefront/hero.js`, `heroKit.js`, `heroAbilities.js`, `heroBlaster.js`, `cards.js`, `ai/heroBrain.js`) does to a battle with no hero in it, what it does with one a side, and a hero bought on the page.

## Balance, with no hero bought

`node scripts/battlefront-balance.mjs`, on `main` at `c5c6c80c4` and on the branch with it merged: the same, row for row. No bot buys a hero in these.

`--skirmish` (10 runs, 20 a side, 180 s):

```
seed  kills1  kills2  alive1  alive2  stuck  offNav
1       13      15      5       7       0       0
2       19      16      4       1       0       0
3       17      8       12      3       0       0
4       14      13      7       6       0       0
5       13      15      5       7       0       0
6       16      12      8       4       0       0
7       15      12      8       5       0       0
8       14      16      4       6       0       0
9       18      12      8       2       0       0
10      20      4       16      0       0       0
kills 15.9 (Rebels) to 12.3 (Empire); more alive at the end: Rebels 7, Empire 3; stuck 0, off the navgrid 0
```

`--assault --runs 4 --seed 1` (20 a side, to 25 minutes):

```
seed  winner  why     stage  minutes  kills1  kills2  heroes1  heroes2
1     Rebels  wiped   1      18.7     150     204     0        0
2     Rebels  wiped   1      17.4     150     198     0        0
3     Rebels  wiped   1      17.6     150     178     0        0
4     Rebels  wiped   1      20.9     150     185     0        0
the Empire (attacking) wins 0, the Rebels 4; median 18.15 min; kills 150.0 (Rebels) to 191.3 (Empire); stuck 0, off the navgrid 0
```

## A hero a side

Four Galactic Assault rounds on the branch, the same seeds, in which one bot a side is taken back to the deploy screen at the first step and deployed as a hero through the sim's own `deploy` (each hero: its kills as a hero / when it fell / the abilities it pressed). No step threw; stuck 0 and off the navgrid 0 in each.

```
seed  heroes                  winner  why         stage  minutes  kills1  kills2  light hero      dark hero
1     hansolo v bossk         Rebels  wiped       1      17.8     150     215     3 / 77 s / 8    9 / 580 s / 59
2     leia v bobafett         Rebels  wiped       1      17.5     150     173     1 / 39 s / 7    2 / 279 s / 17
3     lando v iden            Empire  objectives  2      10.7     45      158     1 / 37 s / 6    4 / stood / 59
4     chewbacca v darthvader  none    -           2      25.0     188     243     4 / 67 s / 9    16 / 271 s / 38
```

The light side's hero, defending, falls inside 80 s each time; the dark side's lasts minutes (Iden the whole round). Before main's bots changed (the merge of 2026-10-13), the same Vader took 113 kills in 11 minutes: the saber kit against trooper bots is not tuned.

## The page

Headless Chromium on SwiftShader, the Vite dev server, `/battlefront/hoth/galacticAssault`, with three of Bossk's cards in the Collection's store (`bf-collection`). The bucket was out of the container's reach, so the level's pack never came and the ground was the navgrid's (`do('where')`: no body).

1. The first spawn screen: a trooper's first life (the world rests under it, the game's pre-round, so its offers stand as they came).
2. 4,000 Battle Points through the check door (`do('points', 4000)`), then `do('die')`.
3. The next spawn screen: Bossk's tile, bought: 600 health, the V-10, his three cards by name (SPREADING THE DISEASE, LINGERING DIOXIS, TRAP ARMING SPEED), his three abilities by name.
4. Space: he rose 1.6 m and came down where he stood.
5. Q: the Dioxis grenade activating, Predator Instincts and the mines blocked by the records.
6. `?`: the guide's Battlefront page, Space a hero's jump and Space twice the dodge.

No page error and no console error.
