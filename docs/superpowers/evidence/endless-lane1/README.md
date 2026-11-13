# Endless universe, lane 1: nebulae and the sky. The evidence

The numbers behind lane 1's claims (`plans/2026-10-18-endless-universe-lane-1-nebulae.md`). Every number here was taken in headless Chromium on SwiftShader (software GL), at 1280 × 720, with four timed frames a pose: the frame times compare only with each other, the draw calls and triangles with any run.

## Before, on `main` (4b8a6313, 2026-11-12)

`node scripts/universe-check.mjs --quality <tier> --frames 4`, the 14 poses, a whole frame's draw calls and triangles (`before-<tier>.json`). The `/universe` shot is `before-universe.webp` (`scripts/autopilot-check.mjs --before`).

| pose | high calls | high tris | mid calls | mid tris | low calls | low tris |
|---|---|---|---|---|---|---|
| overview | 98 | 540,628 | 102 | 493,336 | 101 | 490,314 |
| falcon-sun | 81 | 525,606 | 85 | 476,932 | 84 | 472,262 |
| middleearth-limb | 39 | 106,406 | 41 | 35,124 | 39 | 32,744 |
| rickmorty | 40 | 107,532 | 27 | 36,229 | 40 | 33,864 |
| gaming | 43 | 80,348 | 45 | 45,468 | 43 | 43,088 |
| caribbean | 43 | 156,166 | 45 | 84,878 | 43 | 82,498 |
| middleearth | 39 | 106,406 | 41 | 35,118 | 39 | 32,738 |
| breakingbad | 64 | 100,604 | 66 | 29,316 | 64 | 26,936 |
| office | 41 | 62,606 | 28 | 20,607 | 41 | 18,242 |
| belt | 46 | 465,860 | 52 | 422,014 | 49 | 423,396 |
| maw | 51 | 81,120 | 38 | 81,757 | 47 | 75,616 |
| landing-middleearth | 129 | 181,887 | 0 | 0 | 76 | 52,322 |
| station | 69 | 510,880 | 70 | 458,964 | 68 | 456,604 |
| far-rim | 42 | 85,168 | 29 | 40,593 | 42 | 38,232 |

Mid's `landing-middleearth` read 0 calls (the landing wasn't drawn when the frame was counted) and a few mid poses read 13 or so calls fewer than high and low (`rickmorty`, `office`, `maw`, `far-rim`): the count moves between runs in software GL, so a pose is compared against its own tier's before, and one that moves is run again.

- `scene.js`: 6,505 lines.
- `glsl-sites` 611 (budget 613), `big-files` 22.

`/galaxy` has no before shot: in software GL it stops at its “needs a graphics chip” card (twice, `scripts/autopilot-check.mjs --routes /galaxy`), so the 3D never starts. Its picture is pinned instead by `galaxy/sky.test.js`: with the new `clouds` option left at its default, every system's bake gets the same nebula colours as before, and the bake's shader is not touched.

## The browser check (`scripts/nebula-check.mjs`, high, at 9a081a787)

Before `scene.js` is wired (the sky still bakes its clouds; lane 2's PR 2.4 lands first), with the grown clouds (the Veil's gas 5,500, the Cradle's 6,000). `nebula-check.json`:

- **Parallax:** the Veil's centroid moved 288.5 px for 5,000 sideways, its projection 296 (within 10 %).
- **Roll:** the view turned 30° about its axis; two of the map's points projected say the picture turned 30°, the cloud turned 30°. (On `main` the landmark's picture didn't turn.)
- **Inside:** in the Cradle the fog covers 96 % of the frame.

The shots: `check-veil-side` (20,000 off), `check-veil-near` and `check-veil-rolled` (16,500 off, centred, before and after the roll), `check-in-cradle` and `check-in-cradle-off` (the same frame with the nebulae hidden).
