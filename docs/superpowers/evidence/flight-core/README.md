# The flight core’s evidence

What the one-flight-combat-core lane (`docs/superpowers/plans/2026-10-24-one-flight-combat-core.md`) was held to. The baseline is main’s code at the lane’s tooling commit, `034d4c8` (main bar one DEV hook), taken in a worktree of that commit while the moves and fixes went on in the checkout. Every later gate compares against it.

The shots and reports are not committed. They are under `$S` (`/tmp/flight-core` in the session that took them), named below, so a later session can take them again with the same commands.

## The baseline (034d4c8)

### Size and health

- Scenes: `src/components/universe/scene.js` 6409 lines, `src/components/galaxy/scene.js` 3092.
- `node scripts/health.mjs --check --skip build`: within budget. big-files 22, boundary-breaks 484, cycles 5, kbd-styles 68.
- Bundle (`npm run build`, then `node scripts/autopilot-check.mjs --only bundle`): total JS 28,527 kB in 1297 chunks; entry 96 kB.

### The universe map’s poses

`node scripts/universe-check.mjs --quality <tier> --lock --out "$S/run<r>/<tier>"`, twice a tier (`run1`, `run2`). Each of the four runs: 14 `ok`, no `FAIL`; the lock held at the 13 flying poses, and `landing-middleearth` locked on foot.

Draw calls and triangles a pose, run 1:

| Pose | High: calls | High: triangles | Low: calls | Low: triangles |
|---|---:|---:|---:|---:|
| overview | 99 | 540,710 | 98 | 486,656 |
| falcon-sun | 81 | 525,608 | 84 | 476,115 |
| middleearth-limb | 39 | 106,408 | 39 | 32,742 |
| rickmorty | 43 | 109,402 | 40 | 33,866 |
| gaming | 42 | 74,350 | 43 | 43,090 |
| caribbean | 43 | 156,168 | 43 | 82,500 |
| middleearth | 39 | 106,408 | 39 | 32,740 |
| breakingbad | 67 | 102,474 | 64 | 26,938 |
| office | 41 | 62,608 | 41 | 18,244 |
| belt | 46 | 465,862 | 46 | 418,924 |
| maw | 43 | 77,374 | 43 | 71,878 |
| landing-middleearth | 128 | 181,867 | 76 | 52,326 |
| station | 69 | 510,882 | 71 | 456,870 |
| far-rim | 42 | 85,164 | 42 | 38,254 |

Run 2 differs a little at some poses: low `station` 71 → 69 calls and 456,870 → 456,840 triangles, `far-rim` 38,254 → 38,230 triangles (low) and 85,164 → 85,166 (high). The floors take those spans in, so a later gate is held to the spread two runs of the same code show, not to one run’s exact count.

### The floors

`node scripts/shot-compare.mjs "$S/run1/<tier>" "$S/run2/<tier>" --write floor-<tier>.json`, then the same pair checked `--floor floor-<tier>.json`: within the floor, both tiers.

- `floor-high.json`, `floor-low.json`: for each image, the share of pixels more than 8 levels off between the two runs (and the largest difference); for each pose, the calls and triangles each run drew, and the overlay’s marks.
- Pixels change a lot between two runs of the same code: about a quarter of the pixels at a typical pose, over half at `belt` and `falcon-sun`, where the drawing depends on timing. So the pixel floors catch a picture that has gone wrong, not a small change. The exact gates are the calls, the triangles and the overlay’s marks.

### The galaxy

All run against a dev server on the worktree, from the same worktree, at load averages of 5 to 10 on four cores (the universe runs and the lane’s own work beside them). The page is drawn in software at about one frame a second, so a check that times a flight or a key held for a while can miss under that load. Each FAIL is listed as it was, to judge later runs against.

- `OUT="$S/galaxy-hud" node scripts/galaxy-hud-check.mjs`: 258 `ok`, 8 `FAIL`:
  - 1440×900 and 1366×657: a press on a power that isn’t ready (ultimate) is refused and says why (0%);
  - 1440×900, 1280×720, 1366×657: the radar’s way-to-go dot dead ahead at the top (x 0.20 to 0.21, y 0.16 to 0.17);
  - 1280×720 and 1152×720: the target block is shown;
  - 375×667 touch: the jump and the chip meet.
- `pickups`: 10 `FAIL`, all timed: the fly-through, the fire counts, the bubble and repair after it, the power cell’s charge, the model’s turn.
- `hangar`: 2 `FAIL`. One is on main already and not this lane’s: “the secondary line says it fires on the universe map only”. The other is a 120 s wait for the jump to Endor to end, under load.

### The probes

`node scripts/flight-probe.mjs <scenario> --url …`, at `034d4c8`:

| Scenario | Result | Cleared by |
|---|---|---|
| `order` (lines 0, 1, 2) | ok: hunter first; the Citadel first, no rock; the rock first. Line 2 prints `no state.kills yet` | — |
| `crash` | ok: rounds 2, bolts 2 in flight, and still 2 and 2 three frames on | — |
| `crash --expect clear` | FAIL: nothing left once the crash began (rounds 1, bolts 2) | Task 20 (B11) |
| `galaxy-bolt` | ok: the hunter takes it | — |
| `reach` | FAIL: seismic’s lead pip off at 12 out (on) | Task 13 (B4) |
| `unique-pilots` | ok: the hunters asked (4), never the other pilots | — |

`tap`, `threats` and `galaxy-capital` came later, each with its own before and after (below).

### Three sizes

`node scripts/autopilot-check.mjs --routes /universe,/galaxy --shots 9900 --viewport <w>x<h> [--phone] --skip lint,test,build`, at 1440×900, 390×844 and 844×390, kept as `$S/universe-<w>x<h>.webp` and `$S/galaxy-<w>x<h>.webp`. The universe map’s shots show the map. The galaxy’s show the page saying the browser draws without a graphics chip (autopilot-check doesn’t pass the software-GL gate), so each run reports `/galaxy: no canvas: the 3D never started`. The galaxy’s pictures at each size are galaxy-hud-check’s own instead: `$S/galaxy-hud/hud-<size>.png`, with `-keys` and `-chips`.

### Shots

- `$S/run1/{high,low}/<pose>.webp`, `<pose>.hud.webp`, and the report `$S/run1/<tier>.json`; the same under `run2`.
- `$S/galaxy-hud/`, `$S/galaxy-pickups/`, `$S/galaxy-hangar/`.
- `$S/probes.txt`, `$S/health.txt`, `$S/bundle.txt`, `$S/sizes-<w>x<h>.txt`.

## Accepted: a torpedo lets go of a live target (B3)

A round now homes on its target by id, looked up each step among the scene’s foes (`sight.find`). A target that leaves those lists while still alive is let go, and the round flies on straight. That happens when:

- another pilot turns hidden, safe or an ally;
- the capital ship is passed (`!destroyerHere`);
- the Citadel is past `SIEGE_NEAR`;
- the NX-5 is past 900;
- a dive or a frozen frame skips the lock block, so `find` reads the last list.

These are the scenes’ lists, not roundRules’ rule: `roundRules.test.js` pins the rule (gone, straight on; back, homing again), not each case.

## B4: seismic’s lead pip

On at 6 out, off at 12 (before: on at both). Shots: `$S/t13/before/reach-{6,12}.png` and `$S/t13/after/reach-{6,12}.png`.

## B6: a tap on a target in front of a planet

Before: FAIL (the planet took the tap; the lock was the guns’ own). After: ok, locked by hand. Shots: `$S/t15/before/tap.png`, `$S/t15/after/tap.png`.

## B7: threat arrows

Vader held 20 behind at the far rim, the hunters gone: before, 0 arrows; after, 1, and no lock. Shots: `$S/t16/before/threats.png`, `$S/t16/after/threats.png`.

## B10: the galaxy’s capital ship

A Star Destroyer brought in, the ship 20 out on a shield part, line 0 held: before, nothing of it hit (the galaxy’s hit list had no capital source); after, a shield part takes it. Shots: `$S/t19/before/galaxy-capital.png`, `$S/t19/after/galaxy-capital.png`.

## B12: the galaxy’s difficulty

`OUT=… node scripts/galaxy-hud-check.mjs difficulty`, flown at Outlaw: before, the hunters read nothing (null) and the shields came back at 12.00 a second (8.40 wanted); after, Outlaw and 8.40.
