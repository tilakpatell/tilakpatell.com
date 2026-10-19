# Task 7 report

Commit 31dceb3d8 "Landmarks: upright in the world, depth-tested; the nebulae go to their renderer".

## Implemented
- landmarks.js: header rewritten; nebula rows moved last and kept outside `instanceCount` (DRAWN = 8); `NEBULAE` (form map veil->shell, cradle->nursery); `quadAxes` (reference +y, +x when |y| > 0.999; if up.y < 0 right and up are both negated, which faces the quad the same way, for the near-pole case); VERT world-up (`uCam` uniform = camAt, f = normalize(aCenter - uCam), same rule in GLSL), `vAxis = (axis.right, axis.up, -axis.f)`; FRAG nebula branch, `NOISE`, `PAINT_*`, `cellSize`, the atlas, `aCell` and the `renderer`/`small`/`level` arguments deleted; the pulsar is the `else`; `depthTest: true`; update writes aK 0 for nebula rows, never touches their groups, `ks[i]` keeps landK so `kOf` still feeds scene.js names. The far-plane clamp stays.
- landmarks.test.js: imports `RESERVED` from the fixture; 4 new tests as in the brief; existing tests untouched.
- scene.js: comment and `createLandmarks(map, { skyFar: SKY_FAR })` only. Lines 6226 before, 6226 after.
- glsl-sites: 608 -> 607.

## TDD
RED (before implementing): `Tests 4 failed | 12 passed (16)`: NEBULAE undefined, instanceCount 10 vs 8, aK 1 vs 0, quadAxes not a function.
GREEN: `npx vitest run landmarks aim farStars` -> 3 files, 38 tests passed. (One extra fix after the first green run: the [1e-9,1,0] case gave up.y = -1e-9, handled by the half-turn above.)

## Lint
eslint on the three files: clean.

## Browser compile check
lab/universe/landmarks-lab.{html,js}, landmarks-shot.mjs (uncommitted, gitignored); vite on 127.0.0.1:5199 (default host bound localhost only and playwright got ECONNREFUSED), chromium-1248 via swiftshader. Views: maw, mawRoll (camera rolled 0.7 rad), overhead (camera directly under the Maw, landmark straight above), ember. Result: `shader errors: []`, 1 draw call each, no console errors (one 404, the favicon). PNGs in scratchpad: landmarks-maw/mawRoll/overhead/ember.png. Saw: the Maw drawn correctly (disk ellipse, shadow, photon ring), Twins' glare in frame; the overhead view shows a face-on swirling disk with no flip or glitch; the rolled view keeps the world's orientation. Server stopped. Requested single path landmarks-lab.png was not made; four per-view files instead.

## Concerns
- The quad's pole fallback has a discontinuity at |f.y| = 0.999 (spec'd behaviour; only matters for a landmark within ~2.6 degrees of straight up/down).
- The Maw quad is shaded with `uCam`/aCenter in the parent's space; assumes the parent has no non-uniform scale (as before).
