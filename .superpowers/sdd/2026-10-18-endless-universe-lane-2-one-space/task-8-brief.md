### Task 8: No ceiling, no floor, a round home and a round pocket

**Files:**
- Modify:
  - `src/components/universe/ship.js`:
    - `:197-226` (`homeAt`, `driveAlong`)
    - `:380-386` (`SPACE`, `OPEN_SPACE`)
    - `:445` (`space.homeAt(s.x, s.z)` becomes `(s.x, s.z, s.y)`)
    - `:494-574` (`step`'s edge, roof and pocket)
    - `:723-734` (`autopilot`'s ceiling clamp and `homeAt`)
  - `src/components/universe/deep.js:304` (`nearestPlace`'s home term)
  - `src/components/universe/curve.js:51-70` (the wall's geometry)
  - `src/components/universe/scene.js` (in place, no new lines):
    - `:1809` and `:1880`: `pilotSpace(SPACE, …)` becomes `pilotSpace(OPEN_SPACE, …)`
    - `:1833`: `frontSpace` spreads `OPEN_SPACE`
    - `:3398`: `holdReach(…, { …, space: OPEN_SPACE })`
    - `:4314`: the autopilot's fallback space is `OPEN_SPACE` instead of `undefined`
- Test: `src/components/universe/ship.test.js`, `src/components/universe/deep.test.js`, `src/components/universe/curve.test.js` (new)

**Interfaces:**
- Produces:
  - `SPACE.roof = ceilingAt`. `SPACE` is unchanged in behaviour (the authored map alone; every existing ship test).
  - `OPEN_SPACE = { ...SPACE, expanse: true, roof: null, homeAt: homeAt3, driveAlong: (x, y, z, f) => driveAlong(x, y, z, f, OPEN), driveAt: … }`
  - `homeAt3(x, z, y)`: home measured as a sphere
  - `driveAlong(x, y, z, f = null, { roof = true, round = false } = {})`: `roof: false` drops the home ceiling term at `:218-222`, and `round: true` uses `homeAt3`
  - `step` and `autopilot` turn back at, or clamp to, `space.roof(x, z)` only when `space.roof` is set
  - in the Rick and Morty sector, `step`'s turn-back and clamp use the 3D distance from its origin, a ball of `RM.edge`
  - from outside (`sec.expanse`), the pocket wall at `:558-571` pushes out along the 3D line
  - `ceilingAt` stays exported for `clearToStart` (`:336-342`) and any placement
  - `curve.js` draws the Curve as `SphereGeometry(sec.edge, 256, 64)` with the same shader: its band at the equator, the disc's height, as now. The wall is drawn where it stands.

- [ ] **Step 1: Write the failing tests.**

```js
describe('open space', () => {
  const up = (dir) => ({ ...spawn(null), pitch: dir * (Math.PI / 2 - 0.01) });
  const climb = (s0, dir) => {
    let s = s0, t = 0, edge = 0;
    while (Math.abs(s.y) < 100000 && t < 600) {
      const r = step(s, { throttle: 1, boost: true }, 1 / 20, SOLIDS, OPEN_SPACE);
      edge += r.events.filter((e) => e.type === 'edge').length;
      if (t > 1) expect(dir * (r.ship.y - s.y)).toBeGreaterThan(0);
      s = r.ship; t += 1 / 20;
    }
    return { s, t, edge };
  };
  it('has no roof, and SPACE keeps its own', () => {
    expect(OPEN_SPACE.roof).toBeNull();
    expect(SPACE.roof).toBe(ceilingAt);
  });
  it('flies 100,000 straight up from home, and straight down, never turned back, on the pulse drive', () => {
    for (const dir of [1, -1]) {
      const { s, t, edge } = climb(up(dir), dir);
      expect(edge).toBe(0);
      expect(Math.abs(s.y)).toBeGreaterThanOrEqual(100000);
      expect(t).toBeLessThan(600);
      expect(s.speed).toBeGreaterThan(SHIP.boost * 2);
    }
  });
  it('lets the autopilot climb to a park 30,000 above home', () => { /* a goal { id: 'high', at: [0, 30000, 2000], r: 10, reach: 20 } in OPEN_SPACE's goals; autopilot + step for up to 600 s: |y − 30000| < 5 */ });
  it('walls the Rick and Morty pocket as a ball, both ways, and nothing above it', () => {
    /* inside, at its middle, straight up at 40: never past RM.edge + 1e-6 from its origin in 3D, and an 'edge' event;
       outside, level at origin y + 7,000, flying across over it: no 'edge', and it crosses to the far side */
  });
});
```

  Also add:
  - In `deep.test.js`: `openness(0, 50000, 0)` is 1, and `nearestPlace(0, 50000, 0).gap` is close to `50000 − HOME_RADIUS` (within 1).
  - In `curve.test.js`: the wall's geometry is a `SphereGeometry` of radius `SECTORS.rickmorty.edge`.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/ship.test.js src/components/universe/deep.test.js src/components/universe/curve.test.js src/components/universe/sector.test.js`. Expected: the new tests FAIL. `sector.test.js` passes as it is: its pocket turn-back is at y = 0.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/universe`. Expected: PASS, with every existing ship, deep, sector and pilotGoal test unchanged.
- [ ] **Step 5: Commit.** `git commit -m "No ceiling or floor anywhere in the universe; home and the pocket as spheres"`

