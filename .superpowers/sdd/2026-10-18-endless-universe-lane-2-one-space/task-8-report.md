# Task 8 report: No ceiling, no floor, a round home and a round pocket

Status: DONE (with one deviation from the brief, in autopilot's rise limit, explained under Concerns 1)
Commit: `367e8a699` "No ceiling or floor anywhere in the universe; home and the pocket as spheres" (on `claude/endless-universe-lane-2-2-no-ceilings`, not pushed)

## What I built

### `src/components/universe/ship.js`
- `homeAt(x, z)` is unchanged: it's level, for the authored map. New `homeAt3(x, z, y = 0)` (exported) measures home as a ball round the sun. Both share one private `homeFrom(d)`.
- `driveAlong(x, y, z, f = null, { roof = true, round = false } = {})`. `roof: false` drops the home ceiling term from the drive. `round: true` uses `homeAt3`. With the defaults it behaves as before.
- `SPACE.roof = ceilingAt`. `SPACE` behaves as before.
- `OPEN_SPACE = { ...SPACE, expanse: true, roof: null, homeAt: homeAt3, driveAlong: (x,y,z,f) => driveAlong(x,y,z,f,OPEN), driveAt: (x,y,z) => driveAlong(x,y,z,null,OPEN) }`, where `OPEN = { roof: false, round: true }`.
- Roof lookup, per the controller's ruling: a single helper, `roofOf(space) = 'roof' in space ? space.roof : space.ceilingAt`. `step()` and `autopilot()` both use it. The galaxy's `makeSpace` (which has `ceilingAt` and no `roof`) keeps its ceiling, and `roof: null` means no roof.
- `step()`:
  - The sector now comes from the ship's 3D position: `sectorById(sectorOf(s.x, s.y, s.z))`, no longer the level `sectorOut(s.x, s.z)`.
  - In the Rick and Morty sector (`ball`), the distance used for the turn-back and the clamp is the 3D distance from its origin. The clamp also scales y. The turn-back points the nose straight back at the middle.
  - The main sector's edge is level, as before. With `space.expanse` it is Infinity, as before.
  - Ceiling and floor: `ceiling = roof ? roof(x, z) : Infinity`. The round-out runs only when `roof` is set. Past-the-ceiling easing and the edge flag become no-ops when there's no roof.
  - From outside (`sec.expanse`), the pocket wall pushes the ship out along the 3D line from the pocket's middle (y included).
  - `space.homeAt(s.x, s.z, s.y)` in the boost's push.
- `autopilot()`:
  - The height clamp uses `roofOf` (no clamp when there's no roof).
  - `homeAt` is passed y everywhere: `odFor(x, z, y)`, `stopFrom`'s `od(x, z, y)`, and `vmax`.
  - The rise limit is 1.2 rad under a roof and 1.5 rad without one. See Concerns 1.
- `ceilingAt` is still exported, and `clearToStart` still uses it for placement.
- The header comment now says the open universe has no ceiling or floor.

### `src/components/universe/deep.js`
- `nearestPlace`'s home term is now `Math.sqrt(x*x + y*y + z*z) - HOME_RADIUS`, so home is a ball.

### `src/components/universe/curve.js`
- `SphereGeometry(sec.edge, 256, 2)`, per the controller's ruling (not the plan's 256×64). It has 512 triangles and 256 segments round, the same as the old open cylinder.
- The vertex shader passes `vPos = position`. The fragment shader uses `h = vPos.y / 1820.0` (`(DEEP.ceiling * 1.3).toFixed(1)` is put into the GLSL from the JS value) and `u = vUv.x`. `DoubleSide`, the blending, `depthWrite`, `renderOrder` and the rest are unchanged.
- The header comment now says it's a ball, and explains why its coarse caps don't matter: the band sits on its middle row, right on the edge, and the glow fades out within about 1,500 of the disc.

### `src/components/universe/scene.js` (edited in place, no new lines)
- `pilotSpace(OPEN_SPACE, …)` at :1809 and :1880.
- `frontSpace` spreads `OPEN_SPACE` (both the object and its goals) at :1833.
- `holdReach(…, { …, space: OPEN_SPACE })` at :3398.
- The autopilot's fallback is `OPEN_SPACE` instead of `undefined` at :4314.
- `SPACE` is no longer used in scene.js, so I dropped it from the import (lint is clean).
- Line count: 6226 before, 6226 after.

### Tests
- `ship.test.js`: added `OPEN_SPACE` to the import and the brief's `open space` describe block. The given code is verbatim. I wrote the three `/* … */` tests in full:
  - **Autopilot to a park 30,000 up:** goal `{ id: 'high', at: [0, 30000, 2000], r: 10, reach: 20 }` added to `OPEN_SPACE.goals`. The park is `{ x: 0, y: 30000, z: 2024, heading: 0 }`. The loop runs autopilot + step at 1/20 s until done or 600 s, then checks `|y − 30000| < 5`. It's done at about 110 s, at y = 29999.96.
  - **The pocket as a ball:**
    - Inside: from the pocket's middle, straight up at 40, throttle 1 with boost, solids `[]`, for 60 s. At every step the 3D distance from the origin is ≤ `RM.edge + 1e-6`, and at least one 'edge' event fires.
    - Outside: level at origin y + 7,000, starting at z = origin + edge + 500, heading 0, flying across. There are no 'edge' events, and it ends with z < origin − edge − 500.
- `deep.test.js`: added `nearestPlace` to the import. New test: `openness(0, 50000, 0) === 1`, and `|nearestPlace(0, 50000, 0).gap − (50000 − HOME_RADIUS)| < 1`.
- `curve.test.js` (new):
  - the wall is a `THREE.SphereGeometry` with radius `SECTORS.rickmorty.edge`
  - it's positioned at the pocket's origin
  - `index.count / 3 ≤ 512`
  - `dispose()` removes it

No existing test was changed.

## TDD evidence

**RED.** Before implementing, I ran `npx vitest run src/components/universe/ship.test.js src/components/universe/deep.test.js src/components/universe/curve.test.js src/components/universe/sector.test.js`. Result: 6 failed, 93 passed. `sector.test.js` passed, as the brief predicts.
- curve: `expected CylinderGeometry{…} to be an instance of SphereGeometry`
- deep: `expected +0 to be 1`
- has no roof: `expected undefined to be null`
- flies 100,000 straight up: `expected -0.1367015984770319 to be greater than 0` (the ceiling turned it back)
- autopilot climb: `expected 28602.000001303055 to be less than 5`
- pocket ball: `expected 6000.252011628617 to be less than or equal to 6000.000001`

**After the first implementation** (which followed the brief exactly), only the autopilot climb still failed: `expected 17075.47443412342 to be less than 5`. I traced it (see Concerns 1), made the narrow fix, and it passed.

**GREEN.**
- `npx vitest run src/components/universe`: 167 files and 1889 tests passed (14.6 s).
- Every existing ship, deep, sector and pilotGoal test is green and unchanged.
- The four focused files: 99/99. The slowest new test takes 115 ms, so there's no timeout risk.
- Extra check: I also ran `src/components/galaxy`, `src/components/expanse`, `src/components/rickmorty/world` and `src/lib/space` (318 files) because the galaxy uses `step`/`autopilot` with its own space.
  - The failures there were six files on the Windows baseline list, plus five files that timed out at 5 s under load: cabs, surface/knocks, missions/blast, sitePhysics, rickmorty/world/rules. None of them touch ship.js.
  - Rerun on their own, those five passed (164/164).
- One-off check of the scene's real autopilot trips in OPEN_SPACE, in a temporary file I deleted before the commit; nothing was added to the suite. It ran the existing autopilot scenarios with `OPEN_SPACE` passed to both `autopilot` and `step`: every universe from the edge and from y ±12, every wonder, and the upside-down takeover. All of them parked, with no bumps or crashes and level with the stop.

**Lint and health.**
- `npx eslint` on all 7 touched files: clean.
- `node scripts/health.mjs --check --skip build`: **within budget**. boundary-breaks 486/489; big-files 30/30, where health counts scene.js as 6227, its own count, and the file didn't change length.
- Prettier isn't enforced (lint is eslint only, and HEAD's files fail prettier too), so I reformatted nothing.

## Self-review
- I checked the diff line by line.
- `SPACE`:
  - The edge, ceiling, drive and autopilot paths are the same as before, with one exception: inside the pocket the turn-back is now a ball too. This is deliberate, for consistency. Since Task 7, `sectorOf` treats a point outside the ball as outside the pocket. So under the old level clamp, a SPACE ship near the rim at height counted as out in the Expanse and was pushed outward by the pocket wall. With the ball clamp, a ship inside can never reach that state.
  - The only existing test that touches this (`sector.test.js`'s pocket turn-back) flies at y = 0, where the ball and the cylinder are the same.
- Galaxy: `makeSpace` has no `roof` key, so `roofOf` falls back to its `ceilingAt` and it keeps its ceiling. Its `homeAt: () => 0` ignores the extra y. Galaxy positions stay in sector 0,0,0 → 'main', as before.
- `roof: null` survives the spreads in `pilotSpace` and `frontSpace`, so those spaces have no roof either.
- The curve shader: interpolating the object-space position is exact on the flat triangles. The middle row is at y ≈ 0, so the band is on the edge. Triangle count: 512.
- Comments say why, in the file's style. No new on-screen text, assets or dependencies.

## Concerns
1. **Deviation: autopilot rise limit (ship.js, in `autopilot`, outside the brief's :723-734 range).**
   - What failed: the brief's test "lets the autopilot climb to a park 30,000 above home" can't pass with only the ceiling clamp removed. The rise was clamped to ±1.2 rad (69°). The ship reached the stop's column at y ≈ 4,300. From there the stop's level direction flips back and forth while the nose is 69° up. So the nose is always about 0.73 rad off the way it wants to go. The boost needs `off < 0.25`, so it drops to cruise and weaves round under the stop. It gained about 14 units a second and reached only y ≈ 12,900 in 600 s.
   - The fix: `const steepest = roof ? 1.2 : 1.5`. Under a roof the limit is 1.2 as before, so SPACE and the galaxy are unchanged. Without a roof it's 1.5 (86°), so near the column the nose stays within about 0.14 rad, the boost stays on, and the ship goes nearly straight up and parks.
   - Effect on normal trips: the limit only binds when `2.5·ty − 0.4·vy > 2.57·max(dist, 1)`. On normal trips between authored places that's at most the last few units of the final approach. The OPEN_SPACE check above shows those trips still park cleanly.
   - Please confirm this is acceptable, or tell me what you'd prefer (for example, widening the limit only when |ty| is large).
2. **The Curve's caps.** With 2 rows the "ball" is a double cone. Above and below the band, the surface leans in toward the poles; at 600 above the disc it's about 570 inside the true ball. All that's drawn there is the faint glow, which is gone by about 1,500. I followed the controller's ruling; the browser check should confirm it reads the same from inside.
3. **Minor, not changed:** `OPEN_SPACE.boostAt`, `brakeAt` and `coastAt` are SPACE's. If a caller left out the `open` argument, they'd fall back to SPACE's `driveAt`, which still has the home ceiling term. Every caller (`step`, `autopilot`, `stopFrom`) passes `open`, so nothing is affected today. I left it as the brief specifies.
4. The wall is drawn only while the camera is in the sector (`here` comes from scene.js, which I didn't change). Now a ship can fly over the pocket at height, but from outside it sees no wall, as before.

## Files changed
- `src/components/universe/ship.js`
- `src/components/universe/deep.js`
- `src/components/universe/curve.js`
- `src/components/universe/scene.js` (5 lines edited in place, plus the import; still 6226 lines)
- `src/components/universe/ship.test.js`
- `src/components/universe/deep.test.js`
- `src/components/universe/curve.test.js` (new)
