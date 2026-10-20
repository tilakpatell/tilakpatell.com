# Avengers HQ PR 5: the ops board and records

The evidence for PR 5 of the fix, frame and hub plan (`docs/superpowers/plans/2026-10-18-avengers-hq-pr5-ops-board.md`). Measured in the container under SwiftShader on 2026-10-20, on `main` with PRs 1–4 merged in (through #1122).

## The pictures

- `before/avengers.webp` and `after/avengers.webp`: `/avengers` at 1440 × 900 from the smoke check, the compound flying in on top, unchanged.
- `before/avengers-phone.webp` and `after/avengers-phone.webp`: the same at 390 × 844, unchanged.
- `after/invincible.webp` and `after/invincible-phone.webp`: `/invincible`, unchanged.
- `after/board-no-3d.webp`, after: without 3D, the map from the air on top and the ops board under it; seven cards offer Try 3D (the gate’s Thwip! has no stone) and none offers Go there.
- `after/records.webp`, after: the board for a returning visitor (the Power Stone, Clint’s half, a swing tour of 41.3 s, a best style of 2,450, two backpacks, Ricochet at room 4 with six stars, two achievements): the strip reads 1 of 6, 3/8, 0:41.3, 2,450, 2 of 12 and 2 of 14, and each card its own record.
- `after/board-phone.webp`, after: the board on a phone, the cards in one column, no sideways scroll.
- `after/archive-closed.webp`, after: the Archive closed under Titan, the credits last.

## The numbers

| | before (`main`) | after |
| --- | --- | --- |
| `/avengers` static closure | 85 files, 734 kB raw, 269 kB gzip | 85 files, 743 kB raw, 272 kB gzip |
| the page’s height on a phone without 3D | 9,761 px | 6,100 px |
| `npm test` | 1,694 files, 19,123 tests passed, 6 skipped | 1,697 files, 19,148 passed, 6 skipped (one health scan timed out under the run’s load and passes alone) |
| health | within budget | every metric as on `main` |
| `scripts/hq-links-check.mjs` | 34 `ok` in 2D, 6 in 3D | 34 `ok` in 2D, 6 in 3D; this PR’s version (the board’s `#hq-card-<id>` and its Play link) fails on `main` at the first card, as it should |

Nothing under `src/components/avengers/hq` or `src/runtime` changes, so `scripts/inv-world-check.mjs` was not run.

## The browser checks

A scratch script (not committed) on the dev server, `tp-3d` set raw as `lib/gpu.js` stores it:

- `height`: 6,100 px against 9,761. ok.
- `air`: without 3D the map is on top, the board under it, the cards in `LINKS` order; no Go there, seven Try 3D, the notice offers Settings and no “Turn 3D on”; a pin focuses its card and brings it into view. ok.
- `try3d`: a card’s Try 3D opens `/avengers/training`, sets `tp-hq-3d-ricochet` to `"on"`, draws the game in 3D and leaves `tp-3d` off; Esc finds the compound on its cards. ok.
- `order`: the compound, the board, the worlds, Titan, the closed Archive and the credits last; no GIPHY request until the Archive opens, and the soundboard inside it then. ok.
- `records`: the strip and the cards as above, and the saves read are left as they were. ok.
- `hud`: the compound’s Menu and the strip both read 3/8. ok.
- `go`: in 3D, a card’s Go there brings the compound into view, focuses it and stands him at that building. ok.
- `phone`: no sideways scroll, every card’s button and the Archive’s summary at least 44 px, one column. ok.

The pin’s check waits 4 s for the page to settle before the click. Under SwiftShader the page’s first seconds paint at 2–6 frames a second, and a smooth scroll waits on frames. With reduced motion, the card is in view 17 ms after the click; once settled, `main` and this PR both run about 100 frames in 3 s.

`scripts/hq-world-check.mjs`: the compound up in 31.6 s. The seven shots on the ground match PR 4’s in draw calls and triangles. The two taken mid-fall (`roof`, `high`), which are timed in real time, are a draw call apart. The only errors are the dev server’s font 403s from the worktree’s linked `node_modules`.

`scripts/autopilot-check.mjs --only smoke --routes /avengers,/invincible`: both ok; `/` fails under SwiftShader, as on `main`. With `--phone`: everything green.

## Found on the way

`avengers.css` reset the records strip’s and the cards’ margins to 0 after the utilities, so the strip sat on the lead and the cards on the strip. The resets go (Tailwind’s preflight already zeroes a `dl`’s and an `ol`’s margins), and the markup’s `mt-6` and `mt-8` show.
