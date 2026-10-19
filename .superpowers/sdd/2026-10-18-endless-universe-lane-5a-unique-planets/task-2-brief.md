### Task 2: The sphere and the chart

**Files:**
- Create: `src/lib/land/flight/sphere.js`
- Test: `src/lib/land/flight/sphere.test.js`

**Interfaces:**
- Produces (every argument is a plain array, every direction a unit `[x, y, z]`):
  - `unit(v) → [x, y, z]`. It returns `v` itself when its length is within 1e−12 of 1, so normalising twice changes no bit; Task 10’s exact texel test rests on that.
  - `angleBetween(a, b) → radians`
  - `dirOfUv(u, v) → dir` and `uvOfDir(dir) → [u, v]`: the same layout as `landings/biomes.js:45` `uvOf`
  - `dirOfLatLon(lat, lon) → dir` and `latLonOfDir(dir) → [lat, lon]`, in degrees, the same as `landings/biomes.js:53-61`
  - `frameAt(at) → { up, east, north }`
    - `north` is +y projected onto the tangent plane. At a pole it’s −x projected.
    - `east = cross(north, up)`, so east points the way longitude grows.
  - `chartOf(at, radius) → { at: unit(at), radius, frame, toDir(x, z) → dir, toChart(dir) → [x, z] }`. Chart +x is east and −z is north.
    - `toDir`: with `d = hypot(x, z)` and `t = (x·east − z·north) / d`, it gives `at·cos(d/R) + t·sin(d/R)`, and `at` when `d = 0`.
    - `toChart` is the inverse inside the first turn (`d < πR`). At the antipode it gives `[πR, 0]`.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, expect, it } from 'vitest';
import { angleBetween, chartOf, dirOfLatLon, dirOfUv, frameAt, latLonOfDir, uvOfDir } from './sphere';

const near = (a, b, e = 1e-9) => a.every((v, i) => Math.abs(v - b[i]) < e);
const R = 20000;
const c = chartOf(dirOfLatLon(10, 20), R);

describe('the map’s layout', () => {
  it('is the landings’ (landings/biomes.js uvOf): u from −x toward +z, v 0 at the north pole', () => {
    expect(near(dirOfUv(0.5, 0.5), [1, 0, 0])).toBe(true);
    expect(near(dirOfUv(0.25, 0.5), [0, 0, 1])).toBe(true);
    expect(near(dirOfUv(0, 0.5), [-1, 0, 0])).toBe(true);
    expect(near(dirOfUv(0.3, 0), [0, 1, 0])).toBe(true);
    expect(near(uvOfDir([0, 0, 1]), [0.25, 0.5])).toBe(true);
    expect(near(dirOfLatLon(0, 0), dirOfUv(0.5, 0.5))).toBe(true);
    expect(near(latLonOfDir(dirOfLatLon(-33, 151)), [-33, 151], 1e-9)).toBe(true);
  });
});

describe('chartOf', () => {
  it('puts its middle at its spot, east along +x and north along −z', () => {
    expect(near(c.toDir(0, 0), dirOfLatLon(10, 20))).toBe(true);
    expect(latLonOfDir(c.toDir(500, 0))[1]).toBeGreaterThan(20);
    expect(latLonOfDir(c.toDir(0, -500))[0]).toBeGreaterThan(10);
  });

  it('walks hypot(x, z) metres along the great circle', () => {
    for (const [x, z] of [[300, 0], [-1200, 4000], [9000, -9000]]) expect(angleBetween(c.toDir(0, 0), c.toDir(x, z)) * R).toBeCloseTo(Math.hypot(x, z), 6);
  });

  it('reaches the far side at πR and comes round to where it was after 2πR', () => {
    for (const a of [0, 1, 2.5, 4]) {
      const [ux, uz] = [Math.cos(a), Math.sin(a)];
      const d = 3700;
      const once = d + 2 * Math.PI * R;
      expect(near(c.toDir(ux * d, uz * d), c.toDir(ux * once, uz * once), 1e-9)).toBe(true);
      expect(near(c.toDir(ux * Math.PI * R, uz * Math.PI * R), c.at.map((v) => -v), 1e-9)).toBe(true);
    }
  });

  it('reads a direction back to the chart inside the first turn', () => {
    for (const [x, z] of [[0, 0], [250, -40], [-30000, 12000], [50000, 20000]]) expect(near(c.toChart(c.toDir(x, z)), [x, z], 1e-6)).toBe(true);
  });

  it('has a frame at the poles too, and never answers NaN', () => {
    for (const at of [[0, 1, 0], [0, -1, 0]]) {
      const f = frameAt(at);
      expect([...f.east, ...f.north].every(Number.isFinite)).toBe(true);
      expect(Math.abs(f.east[0] * f.north[0] + f.east[1] * f.north[1] + f.east[2] * f.north[2])).toBeLessThan(1e-12);
    }
    for (const [x, z] of [[0, 0], [Math.PI * R, 0], [1e7, -3e6]]) expect(c.toDir(x, z).every(Number.isFinite)).toBe(true);
    expect(c.toChart(c.at.map((v) => -v)).every(Number.isFinite)).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/land/flight/sphere.test.js`
Expected: FAIL, `Failed to resolve import "./sphere"`.

- [ ] **Step 3: Implement `sphere.js` with the signatures above**

Add a header comment in the house style: what the file is for, “Pure: runs in Node and in a worker”, then the signature list.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/lib/land/flight/sphere.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/land/flight/sphere.js src/lib/land/flight/sphere.test.js
git commit -m "Map a planet's sphere: its layout and the chart round a landing spot"
```

---

