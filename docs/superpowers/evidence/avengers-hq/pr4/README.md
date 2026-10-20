# Avengers HQ PR 4: the game screen

The evidence for PR 4 of the fix, frame and hub plan (`docs/superpowers/plans/2026-10-18-avengers-hq-pr4-game-screen.md`). Measured in the container under SwiftShader on 2026-10-19 and 2026-10-20, on `main` with PRs 1–3 merged in (and `main` merged in again at the end, through #1104).

## The pictures

- `before/workshop.webp`, before: `/avengers/workshop` at 1440 × 900, the game in a box under the place’s header, Start low on the page.
- `after/workshop.webp`, after: the same address, the game filling the window under one slim bar (the name, `3D game: on`, `Back Esc`). Suit up is still disabled: the stage hadn’t drawn its first frame when the picture was taken, and Repulsor now waits for it.
- `before/workshop-phone.webp` and `after/workshop-phone.webp`: the top of the workshop at 390 × 844, before and after; the two-line header becomes the bar.
- `after/workshop-phone-full.webp`, after: the whole phone screen once the stage draws. The touch help shows, the key list doesn’t, and the bar fits.
- `after/results.webp`, after: Bruce Banner’s lab lost, on the one results card: score against best, Play again, `Next: Tony Stark’s workshop` and Back to the compound.
- `after/toy-try-3d.webp`, after: the workshop with its own 3D off, on the toy, with “The stone here is won in the 3D game.” and Try 3D.
- `after/avengers-phone.webp`, after: `/avengers` on a phone, the compound loading as before.
- `after/invincible.webp`, after: `/invincible`, unchanged.

## The numbers

Where Start’s bottom edge sat, in px from the top of the window (the first `.btn-primary` in the start overlay, or Ricochet’s first room button):

| game | 1024 × 640, before | after | 390 × 844, before | after |
| --- | --- | --- | --- | --- |
| workshop (Repulsor Range) | 635 | 524 | 653 | 658 |
| lawn (Hold the Lawn) | 624 | 513 | 619 | 689 |
| training (Ricochet) | 546 | 435 | 579 | 578 |
| range (Trick Shot) | 680 ✗ | 538 | 656 | 678 |
| operations (Infiltration) | 578 | 411 | 564 | 541 |
| lab (Smash Run) | 665 ✗ | 510 | 704 | 672 |
| gate (Thwip!) | 647 ✗ | 497 | 682 | 661 |
| hangar (Tesseract Run) | 673 ✗ | 531 | 696 | 709 |

✗: below the fold. After, every Start is in view at both sizes; the phone rows move a little because the touch help replaces the key list there.

| | before | after |
| --- | --- | --- |
| `/avengers` static closure | 84 files, 726 kB raw, 267 kB gzip | 85 files, 733 kB raw, 269 kB gzip (`warm.js`, `welcome.js` and `hq/gameScreen.js`’s share) |
| `kbd-styles` (health) | 69 on `main` | 68; every other metric as on `main` |
| tests in `src/components/avengers` | 29 files, 386 tests | 35 files, 438 tests |
| `npm test` | — | 18,969 passed, 6 skipped (the one file skipped on `main` too), none failed |
| `scripts/hq-links-check.mjs` | `all ok` | 34 `ok` without `--3d`, 6 with it; `all ok` both |

The Invincible targets that share `hq/` (FL2’s `hq-shots.mjs`, 90 frames, low quality), against `origin/main`:

| target | pixels that differ | |
| --- | --- | --- |
| `invworld` | 0 | |
| `viewer` | 0 | the first `main` shot differed from every later one, `main`’s and this PR’s alike; two more of each match pixel for pixel |
| `thinkmark` | 739 (at most 17/255) | not stable on `main` itself: two `main` shots differ by 889 pixels, in the same strip of traffic at the bottom of the street |

## The browser checks

A scratch script (not committed) drove the screen on the dev server through the dev hooks, `tp-3d` set raw as `lib/gpu.js` stores it:

- `fit`: the table above; at 1024 × 640 every bar is at most 56 px tall; on the phone the touch help shows, no key list shows and every bar button is at least 44 px. ok.
- `gate`: before the workshop’s stage draws, Suit up is disabled and the game stays `ready`; once it draws, a click starts wave 1. ok.
- `pause`: Pause in the lab’s bar is pressed, reads `Paused` and stops the run’s clock; on the gate, a hidden tab pauses Thwip. ok.
- `own3d`: with the workshop’s own 3D off, the toy shows the line and Try 3D, there is no 3D screen, Back finds the compound still in 3D and `tp-3d` untouched; Try 3D turns this game’s 3D on (`tp-hq-3d-repulsor` = `"on"`). ok.
- `siteoff`: with the site’s 3D off in Settings, Try 3D draws the workshop in 3D; Back finds the compound on its cards and `tp-3d` still `off`. ok.
- `results`: a loss in the lab shows Play again, Back and `Next: …` as a link that replaces the entry and opens that building’s game; a win in the hangar offers Open the portal. ok.
- `back`: after Back from a game, the veil reads “Back to the compound” until the compound draws again; then the stones chip pulses and the toast names the next building. ok.
- `warm`: standing 12 m from the workshop’s door fetches `RepulsorRange.jsx` and its `scene.js`; entering then shows no “Opening the door…” and the bar is up within a second. ok.

`scripts/inv-world-check.mjs` (since `hq/` changed) and `scripts/hq-world-check.mjs` ran after as before. Their only errors are the dev server’s 403s for fonts and the basis transcoder, read through the worktree’s linked `node_modules`, the same before and after. The compound’s nine shots match the before ones in draw calls and triangles, except `roof`. That one is taken while he falls from 32 m, timed in real time, so it frames differently from run to run.

## The checks

- `npm run lint` clean; `npm test` as above; `npm run build` green; `node scripts/health.mjs --check --skip build` within budget.
- `scripts/autopilot-check.mjs --only smoke --routes /avengers/workshop,/invincible,/avengers`: all three ok; `/` fails under SwiftShader, as on `main`. With `--phone` and `/avengers/gate` added: everything green.

## Found on the way

- **The compound never drew again after a game.** This had been broken since PR 3. When a game closed, the compound’s stage was taken back, but nothing told React, so the compound waited on a frame it never asked for. `hq/useStage.js` now listens to the runtime and counts its changes, so the render that needs the stage happens. Pinned in `hq/useStage.test.js`; the `back` part above is the browser proof.
- **`hq-links-check.mjs`’s palette jump:** it now waits for the new game’s title, not just the address, since a jump runs through a router transition.
