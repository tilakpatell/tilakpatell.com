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

## B13: the galaxy’s touch buttons

Fire, pressed and the thumb then drifting off it: before, (false, false), let go as the thumb left; after, (true, false), held till the thumb lifts, at 390×844 and 375×667 (`$S/quiet-base.txt`, `$S/quiet-head.txt`). FIRE and BOOST are in the kit’s capitals now, as the universe map’s are.

## After (368c7af4)

The lane’s last code commit, measured as the baseline was: the universe map from a worktree of the commit, both tiers, against `run1` and the floors.

### Size and health

| Measure | Before (034d4c8) | After | Held to |
|---|---:|---:|---|
| `universe/scene.js` | 6409 lines | 6319 (−90) | the plan’s −250: not reached |
| `galaxy/scene.js` | 3092 lines | 2996 (−96) | the plan’s −230: not reached |
| boundary-breaks | 484 | 475 | 475 |
| kbd-styles | 68 | 66 | falling |
| big-files | 22 | 22 | 22 or fewer |
| cycles | 5 | 5 | 5 or fewer |
| bundle (total JS; chunks; entry) | 28,527 kB; 1297; 96 kB | 28,556 kB; 1299; 96 kB (main’s 109 newer commits merged in) | — |

The scenes shrank less than the plan hoped: the core took what both scenes ran alike, and each scene kept the code that feeds it (its candidates, its hit sources, its HUD record’s parts). The health ratchet (`--ratchet --pr 1242`) set the budgets at the new values: boundary-breaks 489 → 475, kbd-styles 70 → 66, big-files 30 → 22, hud-kit 1 → 0, glsl-sites 619 → 613, renderers 16 → 14.

Every new file is under 400 lines; the largest are `lib/combat/flight/targeting.js` (314), `scripts/flight-hud-style-check.mjs` (296), `runtime/hud/flight/flight.css` (278), `flightHud.js` (266), `FlightHud.jsx` (253), `flightCore.scenario.test.js` (221), `frame.js` (220) and `guns.js` (211).

### The flight core over a held fight

`npx vitest run --config vitest.flight.config.js`: 60 targets, 40 bolts in flight, one locked, the sight, the guns’ step, the HUD’s record and its writer each frame, in Node.

| Case | Held to | Measured (three runs) |
|---|---|---|
| a frame’s time | 0.3 ms at the 95th | 0.075 to 0.108 ms |
| writes, a locked frame | 6 at most | 5 |
| writes, with three threat arrows moving | 12 at most | 7 |
| writes, the map’s view | none | 0 |
| made by the record and the guns over a moving fight (600 frames) | under 4096 bytes | 0 |
| made by the writer over an unchanged frame, every part shown (600 frames) | under 4096 bytes | 0 |
| made by the sight, a frame | `track` alone plus 1024 bytes | 25.9 KB against `track`’s 25.4 KB |
| a radar draw | 0.5 ms at the 95th | 0.021 to 0.025 ms |

Allocation is counted by V8’s sampling heap profiler, only what is made under the measured loop, so neither a collection nor the harness moves it. The scenario found the frame loop making a few hundred bytes a frame (the threat arrows’ lists, the nose taken apart as an array, numbers handed to calls the engine didn’t inline, a distance kept among the writer’s `last` values, the card’s words and its hull share, two closures a frame, the kit’s per-call record, and the altitude’s element and number read through one load), and `368c7af4` takes each out. `track` itself makes about 25 KB a frame at 60 candidates (a record a candidate, the sort’s copies, a new lock each frame): that is today’s targeting rule, the most the frame loop makes, and a later lane’s to slim.

### The universe map’s poses

`universe-check.mjs --quality <tier> --lock`, from a worktree of `368c7af4`. All 28 poses `ok`; the lock held at every flying pose and on foot at `landing-middleearth`. A star marks a number outside the two baseline runs’ span.

| Pose | High: calls | High: triangles | Low: calls | Low: triangles |
|---|---:|---:|---:|---:|
| overview | 98 | 540,630 | 98 | 488,071* |
| falcon-sun | 81 | 525,608 | 80 | 471,574 |
| middleearth-limb | 39 | 106,408 | 43* | 33,454 |
| rickmorty | 43 | 109,402 | 40 | 33,866 |
| gaming | 42 | 74,350 | 43 | 43,090 |
| caribbean | 43 | 156,168 | 43 | 82,500 |
| middleearth | 39 | 106,408 | 39 | 32,740 |
| breakingbad | 65* | 102,406* | 64 | 26,938 |
| office | 41 | 62,608 | 41 | 18,244 |
| belt | 46 | 465,862 | 62* | 429,450* |
| maw | 43 | 77,376* | 55* | 79,770* |
| landing-middleearth | 128 | 181,895* | 116 | 126,666 |
| station | 69 | 510,882 | 73* | 457,552* |
| far-rim | 42 | 85,194* | 42 | 38,234 |

- **The overlay.** Every flying pose’s overlay differs from the baseline’s in one thing: the distance’s words. The lock said “24” for a target 6.1 units off, and says “6.1” now (Task 23’s fix); maw’s way says “1013” where it said “3.9k”. The marks, their places, sizes and flags are the baseline’s.
- **The pixels.** Over the floor at some poses, both the scene and the `.hud` shot. The HUD’s pixels move with Phase C on purpose (the distance’s words, the face, the reticle’s line). The scene’s move with timing, as the two baseline runs show.
- **The counts.** Most are the baseline’s, or within a few triangles of it. The starred ones are not judged yet:
  - high `breakingbad` (2 calls and 68 triangles fewer; its low tier is exact);
  - low `belt` (16 calls more) and `maw` (12 more), whose shots show nothing extra on screen at maw and the belt’s rocks moved on;
  - low `station`, `overview` and `middleearth-limb` (a few calls or a thousand triangles).

  None of those poses draws anything the lane changed in the 3D: a gate of one run each, taken while the machine was busy, can’t tell a lane change from a hunter’s shots or a ship arriving. The quiet back-to-back runs that decide it are under Left.

### Left

These checks did not run at the final commit; the branch merged before them, at the owner’s word.

- **The quiet back-to-back.** The starred poses above, run baseline then `368c7af4` with nothing else running, twice: `universe-check.mjs --quality <tier> --lock --poses <list>` from a worktree of each. A count that differs in both orders is the lane’s; one that comes and goes is timing.
- **The checkout-to-checkout pass.** The worktrees draw without KTX2 textures and with fallback fonts (Task 2’s finding). Check `034d4c8` out in the main checkout, run both tiers, then the final commit, and compare calls, triangles and the overlay.
- **The galaxy at the final commit.** `galaxy-hud-check.mjs` and its `pickups` and `hangar` runs. The last quiet comparison, at `2b907ee` (Phase B’s end), found no galaxy regression: 10 FAIL, every one of a kind the baseline’s 16 have. Phase C’s galaxy changes were checked at their own tasks: the vitals saying Shields at every size, the lock’s words at 0.7 rem, and the touch sizes, where 3 FAIL were left, all the jump meeting a chip or the comms on an upright phone (on main already).
- **The probes at the final commit.** `flight-probe.mjs` with `order` (lines 0 to 2), `crash`, `crash --expect clear`, `galaxy-bolt`, `reach`, `unique-pilots`, `tap`, `threats`, `galaxy-capital` and `wing-radar`. Each passed at its own task.
- **Three sizes.** `autopilot-check.mjs --routes /universe,/galaxy` at 1440×900, 390×844 and 844×390.
- **A whole-branch review.** The lane’s tasks were each built test first, and Task 26’s map and checker had a review of their own. No fresh review read the whole branch; the calls made while building are below for it to weigh.

### The calls made while building

Each was a decision where the plan was silent, wrong or overtaken, with what it costs if it was wrong.

- **Gates.** The worktrees draw without KTX2 or the site’s fonts, so gates stayed worktree to worktree, and the checkout pass above is what covers that (cost: a KTX2- or font-dependent change shows only there). Per-task browser gates ran at the phase ends, a phase over the floor to be bisected over its commits. The galaxy’s baseline was taken under load and every later galaxy run was judged line by line against it (cost: a real galaxy FAIL that matches a load FAIL’s line hides till a quiet run). Calls and triangles are held to the two baseline runs’ spread, not one run’s count.
- **The cluster’s word.** “Shields” on both maps, not “Deflectors” (the owner’s call). The style check’s only difference on the cluster is that label’s width.
- **The style check.** It renders the markup from the source through Vite, counts only text an element draws, and leaves tokens out of its differences unless asked (cost: a changed token read by nothing it measures goes unreported). Every page holds every sheet, so the universe map now has the galaxy’s kill X on its reticle, as C4 intends.
- **The writer.** It looks for the cluster’s parts again when they are missing or gone from the page (on foot they come and go). The overlay keeps one place in FlightHud’s markup with a ship or without, so the galaxy’s WarHud and StarfighterHud don’t remount (fixed by structure; no DOM test shows a remount).
- **A nav goal with no reach** draws a 34 px diamond where the universe map wrote nothing (cost: one diamond’s size).
- **Allocation.** Measured by V8’s sampling heap profiler, not heapUsed after a collection: heapUsed moved by kilobytes with nothing made. The sight is held to `track` plus a kilobyte a frame, not a kilobyte over 600 frames, since `track` makes 25 KB a frame and the sight’s other rules (the lead, the assist’s angles) about half a kilobyte (cost: up to a kilobyte a frame more unflagged).
- **Records over numbers.** `onScreen` and `edgeOf` take the projected point, and `edgeOf` turns the way round for a point behind the camera (only the flight HUD calls them). The target card is `{ name, dist, tough, hp }` as the lock’s record is, not `hp` null (only `frame.js` makes it and `flightHud.js` reads it).
- **Probes.** Several hold or wait longer than the plan wrote (unique-pilots, galaxy-bolt, tap, galaxy-capital), because the page draws about a frame a second in software (cost: none, probes only).

### Deferred minors

- `.universe-siege` is 0.66 rem, the map’s own slot, under the kit’s 0.7 floor.
- The jump button meets a chip or the comms at the top of 390×844 and 375×667 when three chips are up: on main already.
- The radar’s hostiles include rocks, the Citadel’s parts and a capital’s parts, as the spec’s radar line has it.
- The universe map counts no PvP kill of yours in the cluster.
- The galaxy never drains the capital pieces’ events, and its kill mark doesn’t keep the frame loop busy.
- The kit’s on-foot heat reads `heat` on two objects in one call’s arguments, the pattern that made an object a frame for the altitude; on foot, outside the flight scenario, not measured.
