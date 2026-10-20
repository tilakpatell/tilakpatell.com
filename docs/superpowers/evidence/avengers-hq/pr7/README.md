# Avengers HQ PR 7: Ricochet and Infiltration in 2D

The evidence for PR 7 of the fix, frame and hub plan (`docs/superpowers/plans/2026-10-18-avengers-hq-pr7-flat-games.md`). Measured in the container under SwiftShader on 2026-10-20, on `main` with PRs 1–6 merged in (through #1129).

## The pictures

Without 3D, before:
- `before/training-no-3d.webp`: the training center showed the old toy, with “The stone here is won in the 3D game.” and Try 3D.
- `before/operations-no-3d.webp`: the same for Operations.

Without 3D, after:
- `after/ricochet-2d-menu.webp`: Ricochet in 2D, its rooms menu on dense glass over the room.
- `after/ricochet-2d.webp`: room 12 from above, aimed at 40°. Steel walls are solid lines, the mat hatched, glass dashed, the door and switch small toggles, the bots squares (the armoured one double-outlined), the hostage an open circle and the thrower a chevron. The dotted preview is in the accent.
- `after/ricochet-2d-phone.webp`: room 1 on a phone, with the restart button at 44 px.
- `after/infiltration-2d-menu.webp`: Infiltration in 2D, its start card with the touch words.
- `after/infiltration-2d.webp`: level 1 from above. The guard is a triangle with his torch shaded, Natasha a filled chevron, and the file and the exit simple icons.
- `after/infiltration-2d-phone.webp`: level 8 on a phone, 23.7 px a tile, with the Wait, Bite, restart and levels buttons.
- `after/mind-stone-2d.webp`: room 12 cleared in 2D with three stars. “The Mind Stone is yours” on the card, the save at room 12.
- `after/soul-half-2d.webp`: level 8 cleared in 2D, Natasha’s half of the Soul Stone, the card’s buttons above S.H.I.E.L.D.’s file.
- `after/board-no-3d.webp`: the board without 3D. The two cards read “Win … here in 2D” with Play in 2D, and five buildings still offer Try 3D.

With 3D, from the smoke check:
- `before/training.webp` and `after/training.webp`: the training center. The bar read `3D game: on` and now offers `Play in 2D`.
- `after/operations.webp`: the same for Operations.
- `before/training-phone.webp`, `after/training-phone.webp` and `after/operations-phone.webp`: the same on a phone; the bar fits.

## The numbers

Where Start’s bottom edge sat without 3D, in px (Ricochet’s first room button, Infiltration’s Go in):

| game | 1024 × 640 before | after | 390 × 844 before | after |
| --- | --- | --- | --- | --- |
| Ricochet (training) | no 2D view (the toy) | 456 | no 2D view | 564 |
| Infiltration (operations) | no 2D view (the toy) | 434 | no 2D view | 574 |

| | before (`main`) | after |
| --- | --- | --- |
| `/avengers` static closure | 116 files, 984 kB raw, 364 kB gzip | 116 files, 985 kB raw, 364 kB gzip (`FLAT_READY`’s two ids) |
| Ricochet’s chunk | 8.7 kB raw, 3.6 kB gzip; CSS 2.5 kB | 20.2 kB raw, 7.2 kB gzip; CSS 4.7 kB |
| Infiltration’s chunk | 17.1 kB raw, 6.5 kB gzip; CSS 7.8 kB | 29.3 kB raw, 9.8 kB gzip; CSS 10.6 kB |
| tests in `src/components/avengers` | 40 files, 484 tests | 48 files, 531 tests |
| `npm test` | — | 19,601 tests, 7 skipped (the seventh from `main`; this PR adds none); 6 in files this PR doesn’t touch timed out under the run’s load and pass alone. The end card’s two tests came after that run and pass with the 531 above |
| health | within budget | every metric as on `main` |
| `scripts/hq-links-check.mjs` | 34 `ok` in 2D, 6 in 3D | 34 `ok` in 2D, 6 in 3D; its door, double-Esc and reload parts now open the training center’s 2D view |

The `/avengers` closure grew from 747 kB to 984 kB on `main` itself between PR 6 and this PR (`crews`, `hunterRules` and `sheet` joined it from another change); this PR adds 1 kB.

The targets that share `hq/` (FL2’s `hq-shots.mjs`), with `main` shot two and three times:

| target | against `main` a | against `main` b | `main` a against b |
| --- | --- | --- | --- |
| `invworld` | 0 | 0 | 0 |
| `viewer` | 0 | 120,232 | 120,232, the same |
| `compound` | 2 (at most 16/255) | 87 | 87 (a against c: 85; b against c: 2) |
| `thinkmark` | 739 | 889 | 1,628 (b against c: 0) |

A third `main` shot and a second shot of this branch settle both. ThinkMark: the branch’s second shot matches `main` a pixel for pixel. The compound never matches itself on `main` (85, 87 and 2 pixels between its three runs). Every shot of the branch is within 2 pixels of a `main` shot, and those 2 pixels are the page’s scroll pill in the bottom-left corner (x 7, y 789–794), where `main` b and c differ too.

`ricochet` and `widow` are left out: their bar now reads “Play in 2D” by design.

## The browser checks

A scratch script (not committed) on the dev server, `tp-3d` set raw as `lib/gpu.js` stores it:

| part | before (`main`) | after |
| --- | --- | --- |
| `fit`: each 2D view comes up without 3D, Start in view, `Play in 3D` in the bar, no “won in the 3D game” | FAIL ×4 (no 2D view) | ok ×4 |
| `mind`: room 12 cleared in three throws through the 2D view’s controller; the Mind Stone, the save at room 12 with three stars, the card, a try in the heist record | — | ok |
| `soul`: level 8 solved in 2D; Natasha’s half, `tp-hq-widow-level` at 8, the card, a try | — | ok |
| `touch` (390 × 844): a tap shows the step’s preview and “Tap again to go.”, a second tap takes it; level 8 with no sideways scroll; every tool button at least 44 px | — | ok |
| `switch` (3D): the bar’s `Play in 2D` turns this game’s own 3D off and draws the room (`tp-hq-3d-ricochet` = `"off"`, `tp-3d` still `on`); a room cleared in 2D opens the next in 3D; Back finds the compound in 3D | — | ok |
| `pause`: a hidden tab pauses a throw in flight (the bar reads Resume, pressed; the room’s clock stops); Resume runs it again and it lands | — | ok |
| `keys`: Space on a room button starts the room, on a tool button does nothing to the room, on the view throws | — | ok |
| `board`: five Try 3D, Play in 2D on the training center and Operations, “Win the Mind Stone here in 2D”; “Mind Stone: won back” once it is | — | ok |

`scripts/inv-world-check.mjs` (`hq/` changed): the city up and every mission done. `scripts/hq-world-check.mjs`: the compound up. The only errors in either are the dev server’s font 403s from the worktree’s linked `node_modules`.

`scripts/autopilot-check.mjs --only smoke --routes /avengers/training,/avengers/operations,/avengers,/invincible`: all four ok; `/` fails under SwiftShader, as on `main`. With `--phone`: everything green (a first run under the parity shots’ load failed `/` alone; rerun on a quiet machine, all green).

## Found on the way

- **Ricochet’s 2D menu sat on glass meant for 3D.** The overlay is 0.35 at its centre, which suits the dark 3D canvas. Over the 2D room, the steel walls, the bots and the aim line showed through the words. The 2D view’s menu, pause and card now sit on glass of 0.8 to 0.92.
- **The 2D angle readout lagged a mouse.** A mouse aims as it moves, but the bar’s angle only changed on a key or a release. The frame loop now writes it, as it writes the room’s moving parts.
- **Infiltration’s end card hid its buttons.** S.H.I.E.L.D.’s file, eight rows on the last level, sat above Play again, Next and Back and pushed them below the fold at 1024 × 640, in 3D and in 2D. The card gains an `after` slot under its buttons, and the file goes there.
