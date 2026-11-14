# Endless universe, lane 1: nebulae and the sky. The evidence

The numbers behind lane 1's claims (`plans/2026-10-18-endless-universe-lane-1-nebulae.md`). Every number here was taken in headless Chromium on SwiftShader (software GL), at 1280 × 720, with four timed frames a pose: the frame times compare only with each other, the draw calls and triangles with any run.

## Before, on `main` (4b8a6313, 2026-11-12), the first before

Taken before lane 2's one space landed; kept for the record. The comparison below is against `main` as lane 1 merged it (`main-<tier>.json`).

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

## Before and after, like for like (2026-11-14)

`main` at 5f54821ae (lane 2's one space merged, #1304), measured from a worktree with its own `node_modules`, against this branch at 08eee366a; `node scripts/universe-check.mjs --quality <tier> --frames 3`, the fourteen poses, a whole frame's draw calls and triangles: `main-<tier>.json` and `after-<tier>.json`. (The look's later commit, 8474282bf, changed two shader numbers and a texture lookup, no draw.)

| pose | high calls | high tris | mid calls | mid tris | low calls | low tris |
| --- | --: | --: | --: | --: | --: | --: |
| `overview` | 96 → 95 | 567,353 → 567,413 † | 96 → 95 | 518,617 → 518,677 † | 99 → 94 | 523,136 → 518,551 |
| `falcon-sun` | 79 → 77 | 552,331 → 552,311 | 79 → 78 | 503,595 → 503,655 † | 78 → 77 | 503,549 → 503,609 † |
| `middleearth-limb` | 37 → 36 | 133,131 → 133,111 | 37 → 36 | 67,387 → 67,367 | 37 → 36 | 64,743 → 64,721 |
| `rickmorty` | 38 → 37 | 134,257 → 134,237 | 38 → 37 | 68,513 → 68,493 | 38 → 37 | 65,865 → 65,845 |
| `gaming` | 41 → 40 | 107,073 → 107,055 | 41 → 40 | 75,121 → 75,103 | 41 → 40 | 75,089 → 75,071 |
| `caribbean` | 41 → 41 | 182,891 → 182,873 | 41 → 41 | 117,147 → 117,129 | 41 → 41 | 114,499 → 114,481 |
| `middleearth` | 37 → 37 | 133,131 → 133,113 | 37 → 37 | 67,387 → 67,369 | 37 → 37 | 64,739 → 64,721 |
| `breakingbad` | 62 → 62 | 127,329 → 127,325 | 62 → 62 | 61,585 → 61,581 | 62 → 62 | 58,937 → 58,933 |
| `office` | 39 → 38 | 89,331 → 89,313 | 39 → 38 | 52,891 → 52,873 | 39 → 38 | 50,243 → 50,225 |
| `belt` | 44 → 42 | 492,585 → 492,565 | 44 → 42 | 450,953 → 450,933 | 44 → 42 | 450,925 → 450,905 |
| `maw` | 41 → 41 | 104,097 → 104,087 | 42 → 41 | 105,404 → 103,891 | 41 → 41 | 103,881 → 103,857 |
| `landing-middleearth` | 131 → 129 | 207,673 → 192,943 | 117 → 116 | 138,058 → 138,038 | 117 → 116 | 137,738 → 137,720 |
| `station` | 67 → 65 | 537,605 → 537,585 | 67 → 65 | 488,869 → 488,849 | 67 → 65 | 488,837 → 488,821 |
| `far-rim` | 40 → 38 | 111,897 → 111,867 | 40 → 38 | 70,257 → 70,239 | 40 → 38 | 70,225 → 70,207 |

**Draw calls are no higher at any pose or tier.** † marks the three readings where the triangles are higher, each by 60: a station's welder's torch (`stations.js:836`, an 80-triangle icosahedron that flickers, `torch.visible` set from the clock) was drawn in that frame on the branch and not on `main`, less the landmarks' 20. A per-object draw list at the overview (the renderer's `renderBufferDirect` wrapped for one frame, 20 frames after the pose; `drawlist-overview-*.json`, an object's parents, geometry, material and triangles) shows the torch on both trees when both catch it lit; what else differs is the landmarks' draw and the young stars' `Points` (gone on the branch), and a ship `main` had loaded by then and the branch hadn't yet. `main`'s own `falcon-sun` at mid read 80 calls and 503,675 triangles on a second run.

What moved, where: the Veil's and the Cradle's puffs, their young stars' `Points` and the landmarks' two nebula squares are gone; the nebula renderer's one draw comes in where a cloud is in view; the landmarks' draw is skipped when none of its squares is (it used to be made every frame). Inside a cloud the fog is one draw more (`in-nebula`, a new pose: mid 38 calls, 100,677 triangles; `veil-side` 34 and 42,997: `after-nebula-poses-mid.json`).

What was let go: the landmarks' painted atlas (up to 2048 × 1024 RGBA with mips, about 11 MB at high) and the puffs' 256² RGBA texture; the noise volume that replaces them is 64³ × 2 bytes at high (0.5 MB), made in code.

`scene.js`: 6,455 lines before the wiring, 6,432 after (6,433 with the merge's other lines).

### The shots

From the same eye on `main` and the branch, at high (`before-*.webp`, `after-*.webp`):

- `home`: the `far-rim` pose. On `main` a baked cloud rides the camera (bottom left); on the branch the sky has none.
- `veil-20000`: the Veil 20,000 off. On `main` the painted landmark, at least 14° across; on the branch the cloud at its true size (its gas 5,500 from its middle), a broken shell.
- `in-cradle`: 2,700 from the Cradle's middle. On `main` that is outside its small cloud; on the branch it is inside its gas, the fog round the ship and the stars through it.
