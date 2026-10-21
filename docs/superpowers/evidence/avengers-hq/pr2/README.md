# Avengers HQ PR 2: the fixes

The evidence for PR 2 of the fix, frame and hub plan (`docs/superpowers/plans/2026-10-18-avengers-hq-pr2-fixes.md`). Measured in the container under SwiftShader on 2026-10-19, on `main` with PR 1 (#1103) merged in.

## The fixes, each pinned by a test

| game | before | after | pinned by |
| --- | --- | --- | --- |
| Thwip | the bell at 100 s was a toast; an idle jog won at about 220 s | the bell ends the run as a loss, “Late for school.”; school reached in the bell’s own step still counts | `thwip/rules.test.js` › the bell (8 seeds idle lose; the autopilot still wins in 48–56 s) |
| Repulsor Range | Ultron Prime died on its 9 s approach to a unibeam, so it never attacked | Prime can’t be hit until it arrives; shots pass through it to what’s behind | `repulsor/rules.test.js` › volleys and summons before it falls, seeds 1–4 |
| Trick Shot | rounds ended when 10–12 arrows ran out, 11–20 s into a 45–55 s clock; the stone at 250 | a 44-arrow quiver, so a round lasts its clock; the stone at 625, where a fair archer wins about 40 % of seeds | `trickshot/rules.test.js` › rounds, the fair and steadier archers, the idle archer |
| Hold the Lawn | a loss restarted at wave 1, about 4.3 minutes from the boss | once the boss’s wave is reached (`tp-hq-lawn-boss`), a loss offers “Restart at the boss” or “From wave 1” | `lawn/rules.test.js` › the checkpoint (four tests) |
| Ricochet | each room’s rebuild left its geometries, cloned materials and canvas and bone textures on the GPU | `freeRoom()` gives each back once, keeping the materials made once | `ricochet/free.test.js`; the browser read below |
| The compound | “Things to do” stuck at 7/8; Clint’s half read as the whole Soul Stone; copy promised an army and six stones for the portal | 8/8 once Thwip is won; “Clint’s half of the Soul Stone”; the copy matches the page | `world/labels.test.js`, `world/rules.test.js` › 8/8 |

## In the browser

A scratch script (not committed) drove each fix on the dev server through the dev hooks:

- `todo`: with every stone and the `spidey` achievement, the Menu reads “Things to do · 8/8”; without the achievement, 7/8.
- `thwip`: at 99.99 s with school far off, the title reads “Late for school.” with an Again button.
- `lawn`: the checkpoint opens on wave 8 with five hearts; after a loss there, the overlay shows “Restart at the boss” and “From wave 1” (`lawn-checkpoint.webp`).
- `trickshot`: 44 ticks in exactly two rows, clear of the wind gauge, the trick chips and the touch buttons, at 1024 × 640 and 390 × 844 (`trickshot.webp`, `trickshot-phone.webp`).
- `ricochet`: with both rooms built once, `renderer.info.memory` reads 264 geometries and 182 textures before and after ten rebuilds (room 1, room 1, room 2, …).

`scripts/autopilot-check.mjs --only smoke --routes /avengers,/invincible`: both ok (`avengers.webp`, `invincible.webp`); `/` fails under SwiftShader, as on `main`.

## The measure and the size

- `npm run build` green; `node scripts/health.mjs --check --skip build` within budget.
- `/avengers` static closure: 82 files 721 kB raw 265 kB gzip after PR 1 → 83 files 724 kB raw 266 kB gzip (`ricochet/free.js` and the labels).
- `npm test`: 18,774 passed; three scans (`scripts/assets-upload.test.mjs`, `scripts/conflict-markers.test.mjs`, `galaxy/models.test.js`) failed under the full run’s load and pass alone; this PR touches nothing they read.
