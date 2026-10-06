# Dagobah's *Do or Do Not*, and missions on foot

Lothal's star map (`2026-10-06-quest-missions-design.md`) made a mission a quest, but every mission still started on a ride. Most of the briefings left are on foot (Dagobah, Kamino, Sorgan, Scarif's vault), so a mission can now leave `ride` out: you start standing at `start`, facing `yaw`, and Again puts you back there (out of anywhere you've gone into, off anything you've got on).

## Dagobah: Do or Do Not

The briefing's three objectives, on Dagobah's swamp (`sites/forest.js`, its quests in `sites/quests.js`):

1. **The run**: from the camp, through the swamp with Yoda on your back (he rides there, and talks), six gates round the dry ground to the mouth of the cave, inside 45 s. The water slows you; the gates keep mostly to the dry land, so knowing the way pays.
2. **Keep calm**: into the cave, and face what's inside (the dark figure the world's own *The cave* quest has), with Yoda off your back: he waits outside, as in the film.
3. **The X-wing**: go to the bog where it sank, and raise it (E). It rises now, for this and for the world's own *Size matters not*: the bogged X-wing answers a `raise` signal by lifting out of the water over four seconds, levelling as it comes, and hanging there just over the bog.

Won: the time over the whole mission, stars (under 80 s, under 110 s), your best, the `dagobahraise` achievement. Lost: out of time on the run, or knocked down.

## How

- `missions/index.js`: Dagobah's mission, no `ride`; `reset` (effects to undo when it starts again: the X-wing back in the bog).
- `surface/scene.js`: a mission without a ride starts you walking at its start; Again leaves the place you're in, gets you off what you're riding and puts you there; `effects` gain `carry` (a prop on your back: `{ carry: 'yoda' }`, `{ carry: null }`).
- `props/forest.js`: `xwingbog` takes the `raise` signal.
- `systems.js`: Dagobah's game live, "Walk it now"; its `how` says what's built (the dry ground is quicker, the cave, the ship), not the wobble-to-lift idea it had.

## Done when

- Tests: every mission's ride is one there is, or none; a mission on foot starts at a spot on dry ground; the run's gates are on Dagobah and end at the cave; the last step is at the X-wing.
- In Chromium: `/galaxy/dagobah/surface?mission=raise` starts on foot by the camp with Yoda on your back and the first gate on the compass; development hooks reach won and lost; Again puts you back; no console errors.
