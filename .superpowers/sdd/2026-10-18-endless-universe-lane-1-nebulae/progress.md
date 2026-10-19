# SDD ledger — plan: docs/superpowers/plans/2026-10-18-endless-universe-lane-1-nebulae.md

Spec: docs/superpowers/specs/2026-10-18-endless-universe-design.md (section D, H, done-item 5). Branch: claude/endless-universe-lane-1-nebulae from origin/main ddb364bf3.

## Pre-flight scan

| Pair / task | Produces → consumes | Found |
|---|---|---|
| T1 ↔ T11 | before numbers (14 poses × 3 tiers, perf, shots) → after comparison | consistent: both name the 14 universe-check poses + the 10 baseline keys |
| T2 ↔ T4 | nebulaBudget, checkDesc, seedOf, placement, detailAt, stepsAt, insideOf, youngStars, FORMS, FORM_INDEX, LIMIT → index.js | consistent; T4 test fixtures checked by hand (detail/stars counts, frustum, far-plane scale) |
| T2 ↔ T5 | fogLayers, insideOf → fog wiring | consistent: T5 aStart expectation = fogLayers(high,900).at(-1)=450 at scale 1 |
| T2 ↔ T7 | checkDesc → landmarks test | consistent: WONDERS veil/cradle have r and 3 colours (deep.js:111-112) |
| T2 ↔ T10 | insideOf → poses test | consistent |
| T2 ↔ T8 (youngStars sizes from deepspace.js:815-818) | T8 deletes those lines | Ruling R2 below |
| T3 ↔ T4 | noiseVolume → Data3DTexture | consistent |
| T4 ↔ T5 | nebula-fog empty hidden mesh, field chunk, volume → fog.js | consistent: T4 test only checks the fog mesh exists |
| T4 ↔ T7 | __fixtures__/glsl.js RESERVED (from landmarks.test.js:117) → landmarks.test.js reads it | consistent; list exists at :117 |
| T4 ↔ T8 (SPARK_FRAG falloff) | T8 deletes SPARK_FRAG from deepspaceShaders.js | Ruling R2 below |
| T6 ↔ T8 | createSky({ clouds }) → mapSky.js | consistent; nebulaeOf/systemById/bakeOf/fakeRenderer exist (sky.js:355, nodes/sky.test.js:34) |
| T7 ↔ T8 | NEBULAE (landmarks.js) → deepspace.js | consistent; no import cycle (landmarks → deep only) |
| T7 ↔ T8 ↔ T9 (scene.js) | :746-748 / :207-208, :646-672 / :209, :734-742 | disjoint lines; net ≈ −19 as planned |
| T8 ↔ T9 | deep.nebulae → make option | consistent; expanse.js:138 calls make(s, { tier, reduced }); map space is absolute (expanse root at origin, sector at middle − origin) so desc.at absolute is right |
| T9 ↔ lane 2 | sectors.js nebula lines | lane 2 not merged at start; resolve at merge |
| T10 ↔ lane 2 | universe-endless-check.mjs | not on main at start; T10 step 6 goes to hand-off unless it lands |
| T1 self | commands, outputs | flags to be confirmed by implementer against scripts |
| T2 self | tests vs formula | consistent (checked envelope/detail/inside numbers by hand); fogLayers last must be exactly 3000 (toBe) |
| T3 self | tests vs method | consistent |
| T4 self | tests vs drawing rules | consistent |
| T5 self | tests vs wiring | consistent (two-cloud case: 600/300, both aStart>0) |
| T6 self | tests vs one-expression change | consistent |
| T7 self | tests vs instanceCount 10→8, aK 0 for nebula rows | consistent |
| T8 self | mapSky test vs moved block | consistent |
| T9 self | HAND fixture (sectors.test.js:23-50) vs expectations | consistent: w0 nebula at [400000,0,-20000], size 400, seed 1n |
| T10 self | poses test vs pose defs | consistent |
| T11 self | gates, numbers | consistent |

Ruling: R1 branch is claude/endless-universe-lane-1-nebulae (the dispatch's), not the plan's claude/endless-lane1-nebulae — the dispatch names it and the controller brief binds — cost if wrong: none, a name.
Ruling: R2 Task 2's youngStars sizes and Task 4's young-star falloff copy deepspace's math into nebula/ rather than import it — Task 8 deletes deepspace.js:815-818 and SPARK_FRAG, so an import would break there — cost if wrong: a few duplicated lines until Task 8 removes the originals.
Ruling: R3 Task 1 runs alone, before Task 2, not in parallel with it — the skill forbids parallel implementers in one worktree and the before numbers must come from main's code — cost if wrong: wall-clock only.

## Tasks
Task 1: dispatched (base ddb364bf3)
Note: coordinator stopped T1's high-tier universe-check (CPU-quiet rule for the BF2 session); implementer told to wait on D:/Custom BFEngine/.locks/cpu-quiet before every heavy run and re-run. Every later dispatch carries the rule.
Task 1: implementer DONE_WITH_CONCERNS (commit ba920b4cd); concerns: 0/0 cells at 6 pose×tier (missed frames), galaxy shot via scratch script past the software gate, perf OUT is a dir. Review dispatched (package review-ddb364bf3..ba920b4cd.diff).
Task 1: review: spec ❌ / Needs fixes — Important: six 0/0 before cells (+ high far-rim) unusable for T11; one sample per cell, noisy. Minor (deferred): say which perf phase T11 gates on; mid run 2 had 19 late pipelines.
Ruling: R4 Task 1's fix round (browser re-measure) runs while Task 2's implementer writes pure, unimported files under nebula/ — disjoint paths, and unimported files don't change the built picture, so the before stays main's — cost if wrong: a git index.lock retry, or CPU noise in SwiftShader frame counts (counts, not times, are what universe-check gives).
Task 2: dispatched (base ba920b4cd), in parallel with T1 fix round 1 per R4.
Task 2: implementer DONE (commit a93fd5fe1, 17 tests). Review dispatched (review-ba920b4cd..a93fd5fe1.diff).
Ruling: R5 Task 3's implementer runs alongside T1's fix and T2's review — disjoint new files, pathspec commits (`git commit -- <paths>`) so no one's staged files ride in another's commit — cost if wrong: a stray file in the wrong commit, fixable by a follow-up commit.
Task 3: dispatched (base a93fd5fe1).
Note: session hit an API rate limit (429); T1 fix (mid-run: second samples done, no commit) and T3 (committed 81a90c5a8, no report) resumed by SendMessage.
Task 2: review: spec ✅, Important: fogLayers descends for r < 16 (0.5·r < FOG_NEAR). Minors (deferred unless folded): nebulaBudget/youngStars inherited-key lookups (folded into fix), checkDesc doesn't validate colour strings or a missing seed, FORMS/NEBULA_BUDGET not frozen, fogLayers with fog 0 returns [far], test gaps (at copy, two-colour pad, -0, NaN insideOf, young stars containment).
Ruling: R6 fogLayers returns [] when 0.5·r <= FOG_NEAR (a cloud too small to fog the ship from inside shows no fog) — the reviewer offered clamp or []; [] keeps "ascending, inside the cloud" true without a fog wider than the cloud — cost if wrong: a cloud under 16 units across has no inside fog.
Task 2: fix round 1/5 dispatched (resume implementer; FIX_BASE a93fd5fe1… note T3's 81a90c5a8 sits between).
Task 3: implementer DONE_WITH_CONCERNS (commit 81a90c5a8; 64³ ≈ 100 ms in Node on a busy machine, plan said ~60). Review: spec ✅, quality Approved.
Task 3: minor (deferred): seam test checks x/R only (y, z, G untested); 64³ volume ~100 ms on the main thread at create — confirm on a device in T4/T8; lattice cache never evicted (small).
Task 3: complete (commits a93fd5fe1..81a90c5a8, review clean)
Task 2: fix round 1 done (commit 3707359ae); scoped re-review dispatched (review-81a90c5a8..3707359ae.diff).
Task 2: fix round 1/5 (3 addressed, 0 open — fogLayers [] for tiny r, Object.hasOwn in nebulaBudget and youngStars; commits 81a90c5a8..3707359ae)
Task 2: minor (deferred): fogLayers' [] must be handled by T5's fog consumer (carried into T5 dispatch).
Task 2: complete (commits ba920b4cd..3707359ae, review clean; T3's 81a90c5a8 interleaved)
Task 4: dispatched (base 3707359ae), opus; T1 fix round 1 still running in parallel (pathspec commits).
Ruling: R7 Task 6 (galaxy sky option) runs alongside Task 4 and T1's fix — disjoint files, pathspec commits, and nothing of T4 feeds T6 — cost if wrong: a stray file in a commit, fixed by a follow-up commit.
Task 6: dispatched (base 3707359ae), sonnet, parallel per R7.
Ledger fix: briefs 4–11 were generated late (the batch command was refused); T6 worked from the plan text, T4 told the brief now exists. Task 6: implementer DONE (a34bd1083, 21 tests).
Task 6: review: spec ✅, quality Approved. Minor (deferred): nodes/sky.test.js ~:102 brace-less nested for reads oddly; stars test compares positions only.
Task 6: complete (commits 3707359ae..a34bd1083, review clean)
Task 1: fix round 1 done (commit 768eb2c1a): second sample all tiers; three cells re-run alone; landing-middleearth befores at high (60) and mid (85) rest on one re-run each.
Task 1: fix round 1/5 (2 addressed, 0 open — zero cells re-measured, second sample + max rule; commits a34bd1083..768eb2c1a)
Task 1: minor (deferred): high/mid landing-middleearth befores (60, 85) rest on one re-run each vs low's 99 — T11 looks twice before calling a regression; a before may pair calls and tris from different samples; perf has two runs per tier only; galaxy before shot taken via a scratch script past the software-renderer gate (T11 must shoot the after the same way).
Task 1: complete (commits ddb364bf3..768eb2c1a, review clean after 1 fix round)
Task 4: implementer DONE (commit 5337751e1, 37 tests, glsl-sites 608). Browser lab: no shader errors, 2 calls/view, gas max 0.645 linear; found+fixed back-face culling (DoubleSide + forceSinglePass). Concerns: far-level diagonal hatching at 6 steps (IGN jitter); nebula-fog is a placeholder Mesh until T5; look dim-ish (EMIT/ABSORB unchanged). Review dispatched (review-768eb2c1a..5337751e1.diff).
Ruling: R8 Task 7 (landmarks) starts while Task 4's review runs — T7 reads only T4's committed fixture and T2's checkDesc, touches disjoint files, pathspec commits — cost if wrong: a T4 fix that changes the fixture means a one-line T7 follow-up.
Task 7: dispatched (base 5337751e1), sonnet, parallel with T4 review per R8.
Task 7: implementer DONE (commit 31dceb3d8, 38 tests across landmarks/aim/farStars, glsl-sites 608→607, scene.js 6226 unchanged). Browser lab clean incl. overhead Maw. Review dispatched (review-5337751e1..31dceb3d8.diff).
Task 7: review: spec ✅, quality Approved. Minor (deferred): basis snaps at |f.y| = 0.999 (glare rotates within ~2.6° of vertical); overhead test doesn't pin GLSL = quadAxes or a level `right` / handedness; depth test now lets a near body occlude the landmark in the crossfade band.
Task 7: complete (commits 5337751e1..31dceb3d8, review clean)
Task 4: review: spec ✅ with partial miss (EMIT/ABSORB not tuned vs before shots); Needs fixes — Important (plan-mandated): the inside full-screen ray uses uTan and ignores the camera's view offset (scene.js:1291 setViewOffset, flight.js cover), so inside gas shifts ~34–190 px and jumps at D = 1.02R; T5's fog would inherit it.
Ruling: R9 the inside ray is built from the projection matrix with its lens shift, (ndc + P[8,9]) / P[0,5], not the brief's uTan = (tan·aspect, tan) — the scene camera always carries setViewOffset, and the spec's "rolls with the stars, fly into it" needs the inside gas to line up with the rest — cost if wrong: none for a camera without an offset (the two agree there).
Ruling: R10 park T4 Minor 1 (far-depth clamp 0.999999 lets far gas draw over a body 35–45k out) — it is the landmarks' own epsilon, and a tighter one risks quantising to the cleared depth in a 24-bit buffer — cost if wrong: gas over a wonder's disc in that band; T8's look check watches for it.
Task 4: minor (deferred to T8/T10 tuning): far-level IGN hatching at 4–6 steps (march the flattened ellipsoid or more far steps); EMIT/ABSORB not yet tuned vs the before shots; "scaled" by ratio not a flag; culling test asserts flags only.
Task 4: fix round 1/5 dispatched (resume implementer): R9 ray + Node test; folded minors: module-level handle counter, curly quotes in JS comments.
