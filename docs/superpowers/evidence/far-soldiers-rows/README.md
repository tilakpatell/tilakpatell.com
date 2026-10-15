# Far soldiers as rows

The numbers behind stage 1 of [the plan](../../plans/2026-10-13-far-soldiers-as-rows.md): a Battlefront soldier past the band’s distance (`src/components/battlefront/figures/band.js`) drawn as instances of one draw a part (`src/lib/three/figureRows/`) instead of as its skinned figure.

Since these numbers were taken, `main` has gained the performance lanes’ P4 (`figures/lod.js`): a far body is animated every second or fourth frame and its bones are left out of the graph’s walk between. With rows on, a row’s body keeps that rate and its rows are placed from the bones as P4 last left them, every frame (`figures.test.js`). Nothing below was measured with P4 in.

This page was a section of `docs/superpowers/evidence/gpu-first/N1/README.md`, which the docs audit removed; the section moved here with the branch. Its three pictures were committed beside it at `6c0379524` and are out of the tree by the evidence folder’s rule (data and text only): `git show 6c0379524:docs/superpowers/evidence/gpu-first/N1/<name>.png > <name>.png` brings one back.

## The desk, 2026-10-13: stage 1

The plan: `docs/superpowers/plans/2026-10-13-far-soldiers-as-rows.md`. Branch `claude/bf-soldier-rows`. Three builds are in what follows, and each number belongs to one: the dev-server sections were taken at the branch's base `7cc7b2792` (#966) with its first commits on it; the round-size table on the built site at `2d09ca6db`, with `main` at `b0a8474dc` merged (the bots' logic, a round's sizes, the lights' index buffer, the landing and menu); and `main` was merged once more after that (`1d6324998`: the picked skins worn, the Instant Action screens), on which the tests, the build and the health check were run and nothing was measured or looked at in a page. Past the band's distance (91 m at ultra, `figures/band.js`) a living soldier is not drawn as a figure. The distance is the site's own economy: the plan called it the game's last character LOD distance, and the game's code, read the same day (`D:\bf2-ghidra\lod64\DECISIONS.md`), says a trooper is on its last LOD from 42 m at Ultra and is drawn so, skinned, to about 500 m. Past the band: every part of it, its gun's meshes too, is an instance of one draw a part (`lib/three/figureRows/`), posed from its own bones once a frame. Its mixer and its bones go on as before (stage 1). `?rows=off` keeps every soldier a figure.

Everything below was taken with the game itself open on the machine and other sessions using it. Between pages ten minutes apart the same mode's frame moved from 9 to 26 ms, so **a number is comparable only with another from the same page**, and a gain in milliseconds grows with the load it was taken under. Edge 154 headless, the RTX 5090, WebGPU, 2,560 × 1,440, uncapped, local dev (`--mode bucketcheck`), `tp-quality` ultra, Hoth, a round begun in place at 24 a side (`do('round', { mode: 'supremacy', bots: { friendly: 23, enemy: 24 } })`): 48 soldiers, 358 meshes. The scripts and their JSON are in the worktree's `.scratch-check/` (git-excluded, as this file's other sources are): they are named here, not committed.

## Two faults of the measuring itself, found late

- **The dev server drew the level without its compressed textures.** Its `node_modules` is a junction to another worktree's, and vite refused the Basis transcoder as outside its serving list (a 403 in every page; the server's log: "the snow did not land"). The ground was flat and the rocks bare in every picture. So every dev-server frame below, the first two sections' and the walk's, is of a lighter picture than a visitor's. The comparisons inside one page had the same picture on both sides; the "visitor's frame" is not a visitor's picture. The built site serves the transcoder (no response refused) and is what the last table here was taken on.
- **Every page test before the merge was on the dev server at the old base.** On the built, merged site the only things checked are the round-size table below, when the rows arrive, and that no soldier was neither a row nor a visible figure in 35 s by the branch's own bookkeeping.

## The round's size, rows off and on (the built site, the merged branch)

tilak-a6's `frames.mjs` (`lag-cpu-path/.scratch-check`), with the rows switched off and on in 4 s windows, four pairs a size, inside the same page (`frames-rows.mjs`, `out/frames-rows-built-<n>.json`). `vite build --mode bucketcheck` of `2d09ca6db` (this branch with `main` at `b0a8474dc` merged), `vite preview`, Edge headless, 1,920 × 1,080, the quality level not pinned, a round begun through the door at each size and 40 s given for the rows to arrive. The game open on the same card: relative numbers. Each size had the player alive and the pace level at 1 in every window.

| a side | living bots | every soldier a figure, frame p50 (two runs) | rows on (two runs) |
|---|---|---|---|
| 8 | 13 / 14 | 12.2 / 21.7 ms | 7.0 / 13.7 ms |
| 13 | 22 / 23 | 19.8 / 27.2 | 9.3 / 15.7 |
| 20 | 37 / 37 | 27.8 / 27.8 | 12.5 / 12.8 |
| 32 | 61 / 61 | 46.3 / 44.8 | 21.6 / 21.7 |

The two larger sizes repeat. The two smaller do not: in the second run they are slower than the first's and, with rows, 13 a side is slower than 20, which more bots cannot explain; they ran first in that page. From 37 to 61 bots a bot costs 0.71 to 0.77 ms a frame as a figure (tilak-a6 measured 0.75) and 0.37 to 0.38 ms as a row.

**This is the most favourable view there is for rows, and not a round's cost.** In this flow the player stands where the round deploys them and the bots go to their posts: 45 s in, the nearest bot was 118 m from the camera and all 39 were rows (`where.mjs`). A bot within the band is a figure and costs a figure's rate or more, so a round costs between the two columns by how many bots are near. The pages before the merge, where 8 to 18 soldiers stood within 80 m, left the soldiers at 26 to 45 % of their cost as figures. What the 0.37 ms a row is spent on was not profiled on this build; the timers below, from the old base, put it in the mixers, the matrix walk and the placing.

When the rows arrive (`rows-arrive.mjs`, `rows-dip.mjs`, 20 a side): none for the first 6 s, while the shaders of the level and of the rows' own parts are built off the frame (up to 217 pending); twenty by 10 s; all the far soldiers from 30 s. In one run no soldier was a row at 15 s either, though twenty had been at 10 s and 14 of the 15 parts read as ready: **not explained**, and a second run's record ran out before that moment.

## What the soldiers cost, and what rows take off (the dev server, before the merge)

One page, the mode switched every 4 s for five rounds. "Hidden": no soldier drawn. `_source`: `.scratch-check/soldiers-ab.mjs`, `out/soldiers-ab-<tag>.json`.

| page (tag) | pace level | every soldier a figure, frame p50 | far soldiers as rows | hidden | rows take off the frame | the soldiers' drawn cost, rows / figures |
|---|---|---|---|---|---|---|
| `main` before this branch (`base-1`) | not recorded | 33.1 ms | | 9.9 | | 23.2 ms as figures |
| the same (`base-2`) | not recorded | 33.9 | | 9.1 | | 24.8 |
| `rows-1` | 0 at the end | 53.2 | 35.4 | 21.5 | 17.8 ms | 13.9 / 31.7 (44 %) |
| `rows-2` | 1 at the end | 57.0 | 37.1 | 21.0 | 19.9 | 16.1 / 36.0 (45 %) |
| `rows-3` | 1 throughout | 53.1 | 33.7 | 23.6 | 19.4 | 10.1 / 29.5 (34 %) |
| `rows-5` | 0 throughout | 63.6 | 36.1 | 26.3 | 27.5 | 9.8 / 37.3 (26 %) |
| `page-on-1` | 1 throughout | 61.2 | 39.8 | 24.9 | 21.4 | 14.9 / 36.3 (41 %) |
| `page-on-2` | 0 throughout | 40.2 | 22.0 | 11.7 | 18.2 | 10.3 / 28.5 (36 %) |
| `?rows=off` (`page-off-1`) | 4 throughout | 59.4 | | 21.1 | | 38.3 as figures |
| `?rows=off` (`page-off-2`) | 0 throughout | 31.2 | | 8.7 | | 22.5 |

In six pages rows took 17.8 to 27.5 ms off a 40 to 64 ms frame and left the soldiers' drawn cost at 26 to 45 % of what it is as figures. It is a range, not a figure: the battles differ page to page (8 to 18 soldiers within 80 m; 28 to 39 as rows) and so does the load. 28 to 40 of the 48 stood past 91 m. Draw calls a frame: 590 to 729 as figures on the four pages that never made a row, 429 to 708 switched to figures inside a rows page, 212 to 381 with rows, 42 hidden. The pace level is the page's own quality step (`paceLevel`); it was recorded per mode only from `rows-3` on, and a page at another level draws another chain.

One run is left out and named: `rows-4-notimers`, where the player never deployed, so all 47 soldiers were far and were rows (4.2 ms for them as rows against 37.0 as figures). It is another scene, taken once. It was meant to show what the probe's own timers cost; that is not measured.

**The plan's goal is not shown to be met.** With rows the soldiers still cost 10 to 16 ms drawn. Most of that is the near soldiers, still figures.

## The JavaScript that rows do not touch

The probe's timers round the frame's own calls (p50, ms a frame; paid whether the soldiers are drawn or hidden, so the switch test above cannot see it). `_source`: the same JSON's `js`.

| | `rows-1` | `rows-3` | `rows-5` | `page-on-2` |
|---|---|---|---|---|
| `figures.update` (the 48 mixers) | 4.3 | 4.2 | 4.2 | 2.8 |
| `scene.updateMatrixWorld` (the whole scene: 48 × 254 bones, the level, the lights) | 6.1 | 6.2 | 7.7 | 4.7 |
| `figures.place` (the rows written and sent) | 1.8 | 2.0 | 2.3 | 1.4 |

Placing, taken apart inside real frames (`place-inframe.mjs`, two pages, 20 to 21 ms frames, 32 and 35 rows): 1.18 and 1.07 ms a frame, of which the 24 uploads (587 to 632 KB, the rows in use and no more) are 0.24 and 0.21 ms and reading the bones and writing the rows 0.94 and 0.85 ms. Timed back to back in a loop the same call is 0.43 ms (`place-cost.mjs`); why it is two and a half times that in a frame is not shown.

## The picture

A held page (the world's step replaced, so nothing moves) with the camera lifted 120 m off a group, FOV 9°: a body is about 120 pixels tall. `_source`: `rows-shots.mjs`, `out/rows-<tag>.json`.

- **The chain off** (`?post=off`, `nopost2`): the visitor's own view is the same to the bit. Through the long lens, 70.9 and 73.3 dB over the frame, 86 and 62 pixels of 3.7 million off by more than 8 of 255, all on the soldiers' outlines (`rows-chain-off-pair.png`, rows left, figures right: in the history, above). Before one fault of this branch was fixed it was 54.8 dB: a gun in the hand takes no shadow as a figure and took one as a row.
- **The chain on** (`chain2`): rows and figures differ by more than the temporal filter's noise. In one view two rows pictures 1.5 s apart agree to 4 of 255 (65 to 69 dB over the soldiers' boxes) and the figures' picture is 33 to 40 dB from them; in the other, 29 to 34 dB against a noise of 37 to 42. At the visitor's own view it is inside the noise (47.5 dB against 44.1). `rows-chain-on-triple.png` (in the history): rows, figures, rows again. **The plan's picture test (a row is the picture of the figure) is not met with the chain on.**

The difference is in the velocity the scene pass writes (`rows-mrt.mjs`, the pass's own target read back; a texel is counted when it is more than a pixel from the frame's common velocity, which is under half a pixel and changes every frame):

| held page, still camera | texels off | of them inside the soldiers' boxes | largest |
|---|---|---|---|
| `?rows=off`, no row ever made, three reads | 26,915 / 26,924 / 26,982 | 26,915 / 26,924 / 26,978 | 41,900 px |
| the same with `?skin=whole`, three reads | 19,536 / 19,499 / 19,491 | all | 30,855 px |
| rows on, two reads | 0 / 0 | | 0 |
| the same page, rows switched off | 18,442 | 18,400 | 35,563 px |

So the figures write a velocity of tens of thousands of pixels on their own texels while nothing moves, on a page where this branch drew nothing and with or without the cut skins; the rows write the frame's own. The pass's other attachments (normal, diffuse, metal and rough) differ between rows and figures by no more than two reads of one mode do. In motion (`rows-motion.mjs`, a 41 × 41 block round one running soldier, 40 frames): as a figure nearly every texel of it is wrong in every frame (85,352 against 3,390 within 2 px of its real motion), at about 3,500 px, drifting by the soldier's own motion each frame; as a row most of its texels are within 2 px of its real motion in 36 of 40 frames. **Why the figures do this is not found.** That the figures' aliased look comes from it is the natural reading and is not tested.

The rows' velocity is not exact either. In that run two frames at a change of direction were about 2 px off, two where the soldier's root jumped 18 px read near zero (an instance new that frame is given no movement of its own, by design; whether that was the case is not known), and about a third of the moving texels in the block were more than 2 px from the root's motion, which a body's own limbs would also be: the test cannot tell the two apart.

## The band's edge

`edge.mjs`: the camera dollied in from 100 m to 76 m and back, twice, on one soldier of 8 parts, half a metre a frame. In 209 frames it was placed in the rows in 131 and had all 8 meshes in the main pass's list in 78; never both, never neither. It changed four times, at the band's own 91 m and 81.9 m (to its feet). That is this branch's bookkeeping and three's list, not pixels. The same soldier from the same place at 84 m as a row and as a figure: 39 dB, against 52.1 dB for the same view as a row before and after the walk (`rows-edge-84m-pair.png`, row left, figure right: in the history). **A soldier's look steps at the edge** between the row's smooth outline and the figure's stepped one. It was looked at held, through a long lens; at a visitor's field of view (55°) the soldier is about 30 pixels tall there, and that was not looked at, nor in motion. The view had no ground under the soldier: the shadow that a figure casts and a row does not was not looked at.

## A visitor's frame

No profiler and no timer on the page; a page a mode; all at pace level 0 with the player alive throughout. `_source`: `walk24.mjs`, `out/walk24-<tag>.json`.

| 24 a side, frame p50 / p95 | every soldier a figure (`?rows=off`) | far soldiers as rows |
|---|---|---|
| standing 8 s | 31.6 / 42.2 and 31.7 / 41.7 ms | 27.7 / 38.1 and 19.6 / 37.1 ms |
| walking 12 s | 32.6 / 49.1 and 25.9 / 42.5 | 22.6 / 45.7 and 19.8 / 40.2 |
| frames over 33 ms, standing / walking | 95 / 172 and 107 / 81 | 37 / 55 and 26 / 56 |

These are separate pages, so the difference between the columns (4 to 12 ms) is weaker evidence than the switch test's, and it is about half as large; 24 to 30 soldiers were rows here. The slow frames move little. At 8 a side the four pages sat at pace levels 0, 1, 2 and 0, so only one of each mode compares: as figures 20.6 ms standing and 23.7 walking, with rows 10.1 and 11.8. One of the 24-a-side pages with rows was faster than the 8-a-side page as figures, which the soldiers cannot explain: **the walk cannot say, on this machine today, whether 24 a side with rows costs what 8 a side does on `main`.** The chip's own time was 3.5 to 4.5 ms a frame throughout.

## Where the code differs from the plan (the code wins; each said here)

| plan | code | why |
|---|---|---|
| `writeRow(array, row, layout, boneMatrices, rootInverse)` | `writeRow(array, row, layout, skeleton, rootInverse, root)`: the bones' own world matrices and inverses, and the root in the row's first matrix | `skeleton.boneMatrices` is float32 in the world: a tenth of a millimetre at 1,300 m. Worked out from the bones in doubles and re-based first, the row keeps a hundredth; `pose.test.js` still holds it to the sixteen floats `skeleton.update()` leaves |
| one row an instance | two: the pose now and the pose of the frame before | the velocity pass |
| `place(part, i, skeleton, rootMatrixWorld)`, `count` | `begin()`, `place(part, i, skeleton, root, was)`, `send()`; `count` kept | `was` is the instance it was last frame, so the pose of the frame before is its own when the instances are packed anew |
| the root is the instance's | a skin's root is its node's place only | three skins in the node's frame and comes back out through it, which leaves the node's origin as the point a vertex is pulled about when its weights do not sum to one (a file's are bytes: off by up to 1/255) |
| a soldier in the band is a row | once every part of it has been drawn once (`part.ready`) | `pipelineGuard.js` leaves an object out of the frame until its shader and pipeline have landed: a figure hidden for a row not yet drawn would be drawn by nobody |
| the texture uploaded, only the rows in use | `sendRows`: through the device's own queue | three's WebGPU backend sends a DataTexture whole (it reads no update range in r186). The one place the folder reaches inside three |
| a capability test | `canDrawRows`: the node renderer on WebGPU | the row path was not tried on WebGL 2 |
| stage 2 (Task 6) | not built | below |

## Stage 2: not built, and why

The plan builds it only if stage 1 shows the mixers and the bones are what is left. They are part of it, not most. With rows on, what the soldiers still cost is, in order: the near soldiers drawn as figures (10 to 16 ms in the switch test), then the mixers and the matrix walk for all 48 (2.8 to 4.3 and 4.7 to 7.7 ms, of which the far soldiers' share is perhaps two thirds of the mixers and less of the walk, not measured apart), then placing (1.1 to 2.3 ms, most of it reading the same bones). Stage 2 would take the far soldiers' share of the last two: a few milliseconds under this load, less on a quiet machine. It also draws a far soldier at the nearest of sixteen sampled phases, which is no longer the figure's own pose, so it changes the picture and wants its own review. And stage 1 itself leaves open what is listed below. Left for its own plan.

## Not shown, not done

- Any number from a quiet machine. The same mode of the same build (no soldier drawn) ran at 9 to 12 ms a frame in four of these pages and at 21 to 26 ms in the other six.
- Whether the goal is met (above).
- Why skinned figures write the velocity they do. It is on `main` and outside this branch; it makes the plan's picture test unpassable with the chain on and makes the hand-over visible.
- The hand-over at a visitor's field of view and in motion; the far soldiers' missing shadows on the snow (at low and mid the game's own shadow distance is past the band, so rows casting none is a loss there by the plan's own count).
- A single missing frame on screen at the hand-over (the accounting is bookkeeping). A part is marked ready the first time three draws it in any pass; the guard holds objects by pass and was still holding 2 to 24 in most frames after the rows arrived. Whether a row can be ready in one pass and held out of the picture's own is not ruled out.
- The lens factor on the band (`band.js`'s `zoomOf`) in the page: every soldier camera is at 55° today, where it is exactly 1. Unit tests only.
- A frame at 63 bots taken apart, on the merged build.
- The row path on WebGL 2; a kind whose body is swapped while its rows are drawn, in the page (covered by `figures.test.js` against a stand-in only); more soldiers of a kind than 64 in the page (`rows.test.js` only).
- What the probe's timers cost.
