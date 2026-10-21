# Avengers HQ PR 6: the heist record and the earned snap

The evidence for PR 6 of the fix, frame and hub plan (`docs/superpowers/plans/2026-10-18-avengers-hq-pr6-heist.md`). Measured in the container under SwiftShader on 2026-10-20, on `main` with PRs 1–5 merged in (through #1126).

## The pictures

- `before/titan.webp`, before: Titan’s column with two stones (the Power and Mind Stones) held. A Set it button on every stone, Snap live, and “Take them out”.
- `after/titan-locked.webp`, after: the same two stones. The list only reads Won or Not yet, Snap is locked (dimmed) with “4 stones left” under it, and `Next: Mjolnir` leads to the lawn.
- `after/summary.webp`, after: Tony’s snap at 1440 × 900 with all six stones and a heist record. The summary on glass over the dust: “1 day 2 hours” from the first stone to the sixth, and each building’s tries and best.
- `after/summary-phone.webp`, after: the same snap on a phone. Snap brings the panel to the middle of the screen, clear of the bar and the toast, and the summary rises there.
- `after/summary-phone-panel.webp`, after: the panel alone at 390 × 844, scrolling inside it.
- `after/migration.webp`, after: stones held from before this PR, with no record. Every span and try reads “Before records began”, and no record is written.
- `before/avengers.webp`, `after/avengers.webp`, `before/avengers-phone.webp` and `after/avengers-phone.webp`: the top of `/avengers`, unchanged. `after/invincible.webp` and `after/invincible-phone.webp`: `/invincible`, unchanged.

## The numbers

| | before (`main`) | after |
| --- | --- | --- |
| `/avengers` static closure | 85 files, 743 kB raw, 272 kB gzip | 87 files, 747 kB raw, 274 kB gzip (`hq/heist.js`, `titan/gate.js`, `HeistSummary.jsx`) |
| tests in `src/components/avengers` and `src/pages` | 40 files, 467 tests | 43 files, 493 tests |
| `npm test` | — | 19,204 tests, 6 skipped; 12 tests in 11 files outside this PR timed out under the run’s load (10 at 5 s, one timing budget) and pass alone |
| health | within budget | every metric as on `main` |
| `scripts/hq-links-check.mjs` | 34 `ok` in 2D, 6 in 3D | 34 `ok` in 2D, 6 in 3D |

The targets that share `hq/` (FL2’s `hq-shots.mjs`), with `main` shot twice:

| target | against `main` a | against `main` b | `main` a against b |
| --- | --- | --- | --- |
| `compound` | 0 | 2 (at most 33/255) | 2, the same |
| `invworld` | 0 | 0 | 0 |
| `viewer` | 0 | 120,232 | 120,232, the same |
| `thinkmark` | 889 (at most 11/255) | 889 | 0 |

ThinkMark lands in one of two states, 889 pixels apart in the street’s traffic: PR 4’s two `main` shots differed by exactly that. Two more shots of this branch and a third of `main` all match `main` a, pixel for pixel. `titan` is left out: its viewport shot holds the changed text column.

## The browser checks

A scratch script (not committed) on the dev server:

| part | before (`main`) | after |
| --- | --- | --- |
| `locked`: two stones held; Snap disabled, described by “4 stones left”; `Next: Mjolnir` to `#/avengers/lawn`; no socket or list buttons | FAIL (12 buttons, no `snap-left`) | ok |
| `next`: the Next link opens the lawn’s game, and Back pops to `/avengers` | — | ok |
| `tries`: two starts at the workshop and a checkpoint on the lawn write `{ stark: 2, thor: 1 }` and no stone | — | ok |
| `summary` at 1440 × 900 and 390 × 844: the span, seven rows, the workshop’s 4 tries and 12,345, the training center’s 1 try and 3 of 12 rooms; focus on its title; inside the stage, no sideways scroll, nothing under 11.2 px; `whatever` unlocked; it closes | — | ok, both sizes |
| `migration`: held stones with no record read “Before records began”, and nothing is written | — | ok |
| `flat`: without 3D and with reduced motion, the drawn gauntlet; the summary within 300 ms, not animated | — | ok |
| `free`: the interests card’s gauntlet, still free (now at `#/universe/marvel`, where `main` moved the card) | ok | ok |

`scripts/inv-world-check.mjs` (since `hq/` changed): the city up and every mission done. `scripts/hq-world-check.mjs`: the compound up, with its ground shots as before. The only errors in either are the dev server’s font 403s from the worktree’s linked `node_modules`.

`scripts/autopilot-check.mjs --only smoke --routes /avengers,/invincible`: both ok; `/` fails under SwiftShader, as on `main`. With `--phone`: everything green.

## Found on the way

- **The snap waited, unseen, on a phone.** Titan’s frames only run while its panel is on screen. On a phone the panel sits above the Snap button, so the snap, and the summary with it, waited until the visitor scrolled back up (the `summary` part at 390 × 844 timed out). Snap now brings the panel to the middle of the screen when it’s out of view.
- **With reduced motion and 3D, the snap never ended.** No loop runs there, so the scene’s snap never reached its end. Titan now hands the snap back to the page, which raises the summary at once.
- **The locked Snap looked live.** The house `.btn` has no disabled look, so the locked Snap showed as a bright purple button. It now dims as the interests card’s does.
