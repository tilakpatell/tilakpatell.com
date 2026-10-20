# Avengers HQ PR 3: links and navigation

The evidence for PR 3 of the fix, frame and hub plan (`docs/superpowers/plans/2026-10-18-avengers-hq-pr3-links.md`). Measured in the container under SwiftShader on 2026-10-19, on `main` with PRs 1 and 2 merged in.

## The pictures

- `avengers.webp`, after: `/avengers` from the smoke check; the compound as before.
- `invincible.webp`, after: `/invincible`, unchanged.
- `hq-links-cold.webp`, after: `/avengers/workshop` opened cold, its game over the page in Stark’s colours.
- `hq-links-3d.webp`, after: the compound drawn once a cold 3D link’s game has closed.
- `hq-links-palette.webp`, after: “ricochet” in the command palette picks Avengers HQ · Ricochet, under Worlds.

## The numbers

| | before | after |
| --- | --- | --- |
| addresses of the compound’s buildings | 0 | 8 (`/avengers/workshop` … `/avengers/hangar`) |
| the palette | “Avengers HQ” under Easter eggs | nine rows under Worlds: the compound and each game |
| `/avengers` static closure | 83 files, 724 kB raw, 266 kB gzip (after PR 2) | 84 files, 726 kB raw, 267 kB gzip (`links.js`) |
| `npm test` | 18,774 passed (PR 2’s run) | 18,790 passed, none failed |
| `scripts/hq-links-check.mjs` | — | 34 `ok` without `--3d`, 6 `ok` with it; `all ok` both |

Health: within budget, nothing moved. Nothing under `src/components/avengers/hq` or `src/runtime/hud` changes, so `scripts/inv-world-check.mjs` was not run.

## The checks

- `npm run lint` clean; `npm test` 18,790 passed; `npm run build` green; `node scripts/health.mjs --check --skip build` within budget.
- `scripts/autopilot-check.mjs --only smoke --routes /avengers,/invincible,/avengers/gate,/avengers/nowhere`: all four ok (`/avengers/nowhere` lands on `/avengers`); `/` fails under SwiftShader, as on `main`.
- `scripts/hq-links-check.mjs`: every address opens its game cold in Stark’s colours and Esc replaces it with `/avengers`; a card pushes the address and keeps the scroll; the browser’s Back, Esc and the Back button each go back in the page; two Escs at once go back once; a reload opens the game again and Esc returns to the entry behind it; a half of the Soul Stone won shows on the card after the browser’s Back; an unknown address is the compound; the hangar’s toy opens the portal only with the Space Stone; the palette lists every game under Worlds and a game picked there closes to the compound; a jump from one game to another through the palette replaces it in place.
- With `--3d`: a cold link opens the gate’s game before the compound is built, Back replaces it, and the compound builds after; `__HQWORLD__.enter` pushes the address, Back pops it, and he is back outside the gate.
