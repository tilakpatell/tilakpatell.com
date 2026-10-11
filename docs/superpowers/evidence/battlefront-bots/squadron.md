# The bots lane: the squadron behaviour tree on a fixture flight

`node scripts/battlefront-squadron.mjs` on 2026-10-10 (late night): one fighter flying the game's dogfight tree (`PF_DogfightBehaviour`, read from the record into `src/data/bf2017/ai.squadron.json`, flown by `src/lib/battlefront/ai/squadron.js`) against three enemies circling 400 m round the middle at 90 m/s, the first of them sitting 90 m on the fighter's tail every other 20 s; twelve seeds (where everyone starts), 120 s each, a point-mass flight at 100 m/s and 1.2 rad/s a stick standing in for the fighters lane's flight model.

```
PF_DogfightBehaviour, 12 seeds, 120 s each: the share of ticks (%) in each node kind
seed | first shot s | first missile s | DogfightingAttack | DogfightingFlyForward | Loop | ProximateAreas | SideToSide | Turn | none
1 | 5.5 | 55.1 | 36.9 | 17.0 | 0.8 | 0.0 | 45.0 | 0.0 | 0.4
2 | 9.9 | 12.9 | 30.4 | 23.4 | 0.8 | 0.0 | 41.7 | 3.4 | 0.4
3 | 4.2 | 7.2 | 36.9 | 15.8 | 1.0 | 0.0 | 43.5 | 2.4 | 0.4
4 | 2.4 | 95.5 | 34.6 | 17.1 | 4.0 | 0.0 | 42.9 | 1.1 | 0.4
5 | 5.4 | 8.4 | 32.5 | 20.2 | 2.4 | 0.0 | 41.1 | 3.4 | 0.4
6 | 6.9 | 9.9 | 14.8 | 36.9 | 0.8 | 2.3 | 42.4 | 2.4 | 0.4
7 | 6.6 | 9.7 | 34.4 | 17.1 | 1.6 | 0.0 | 46.5 | 0.0 | 0.4
8 | 4.1 | 84.6 | 26.7 | 26.6 | 0.0 | 0.0 | 46.3 | 0.0 | 0.4
9 | 5.0 | 8.0 | 14.5 | 34.6 | 1.5 | 9.9 | 38.1 | 1.2 | 0.2
10 | 3.8 | 6.8 | 21.4 | 32.0 | 0.0 | 1.6 | 43.4 | 1.2 | 0.4
11 | 0.2 | 83.6 | 26.1 | 26.0 | 1.6 | 0.0 | 44.6 | 1.2 | 0.4
12 | 5.4 | — | 27.5 | 24.2 | 3.2 | 0.0 | 44.8 | 0.0 | 0.4
mean | 5.0 |  | 28.1 | 24.2 | 1.5 | 1.1 | 43.4 | 1.4 | 0.4
```

What it says:

- The tree attacks a target between the attack node's 100 and 500 m (a quarter of its time), flies on when there is none in that band, and when the chaser sits on its tail inside 125 m and 75° it evades through the evade node's own sequence: a weave (`SideToSide`), then one of the random manoeuvres by the record's weights (loops, turns, a timed fly-on, another weave). That is the 40-odd per cent of `SideToSide`.
- It fires its cannon within 5 s on average (0.2 to 9.9 s): bursts of the cannon rule's 2 s, 1.5 s apart. A missile waits for the missile rule's 3 s lock inside the fire cone, so it comes late or not at all while the chaser keeps it weaving (seed 12).
- `ProximateAreas` brings it back when it strays past 1.5 km from the middle (the fixture's area). The single-player nodes (`FlyFormation`, `ProximateWaypoints`, `FlyTo`, `AdvancedManeuver`) are not flown (`unreadNodes`); the multiplayer dogfight tree has none.
- "none" is the tick a sequence finishes and hands over.
