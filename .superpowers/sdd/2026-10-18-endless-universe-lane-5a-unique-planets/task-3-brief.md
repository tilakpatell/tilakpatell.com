### Task 3: 3D noise and the terrain characters

**Files:**
- Modify: `src/lib/land/flight/fnl.js` (add after `noiseFor`, line 38) and `src/lib/land/flight/fnl.test.js`
- Create: `src/lib/land/flight/characters.js`, `src/lib/land/flight/characters.test.js`, and `src/lib/land/flight/fixtures/generated.js`
- Modify: `docs/stack/fastnoise-lite.md`
  - “Where it is used” gains `characters.js` and `sphereField.js`.
  - The “3D noise” bullet under “What the site does not use” goes; a line under “How the site uses it” replaces it.
  - The Gotchas gain a 3D warp note: three noises, as the 2D warp is two.

**Interfaces:**
- Consumes: `unit` and `dirOfLatLon` (Task 2).
- Produces:
  - `noise3For(seed, { type, frequency, octaves, lacunarity, gain, fractal, warp }) → (x, y, z) → −1…1`. It takes the same options as `noiseFor`; the warp is three noises at half the frequency.
  - `cells3For(seed, { frequency, jitter = 1 }) → (x, y, z) → distance ≥ 0`. This is FastNoiseLite’s Cellular with `CellularReturnType.Distance` and the Euclidean distance; the wrapper adds 1 so it reads from 0 up.
  - `CHARACTERS = ['continents', 'archipelago', 'canyons', 'mesas', 'dunes', 'craters', 'ridges', 'plateaus']`.
  - `TERRAIN[kind] → { shape, sea: [lo, hi], peaks: [lo, hi], lift }`.
  - `groundOf({ kind, sea, peaks }, seed, radius) → (dir) → { h: metres, land: 0…1 }`.
  - `FIB_512`: 512 Fibonacci-sphere directions.
  - `fixtures/generated.js`: `randomDirs(n, seed) → dir[]`.

**The recipes** (starting values, my call; tune by Task 13’s sheet). `shape` is `noise3For(seed, { frequency: TERRAIN[kind].shape, octaves: 5 })` of the unit direction.

- **The threshold.** `s0` is the `sea` quantile of `shape` over `FIB_512`, so the measured sea share is the asked one.
- **Lift.**
  - Where `shape ≥ s0`: `(shape − s0) × lift`.
  - Under it: `(shape − s0) × 420` on a planet with water. On a dry planet it’s `× lift`, and `sea` is then the share of dry basins.
- **Land.** `land = smoothstep(s0, s0 + 0.12, shape)`.
- **Layers.** `p = dir × radius` in metres, and `ridged(p, f, oct)` and `fbm(p, f, oct)` are `noise3For` mapped to 0…1. Each layer is added to the lift.

| kind | shape | sea | peaks (m) | lift (m) | layer |
|---|---|---|---|---|---|
| continents | 1.3 | 0.35–0.6 | 300–900 | 260 | `ridged(p, 1/2600, 5) × peaks × land²` |
| archipelago | 3.2 | 0.62–0.8 | 150–450 | 200 | `ridged(p, 1/1400, 4) × peaks × land²` |
| canyons | 1.0 | 0–0.15 | 150–350 | 60 | `land × (0.5·peaks − peaks × (1 − |2·fbm(p, 1/3200, 3) − 1|)^8)` |
| mesas | 1.0 | 0–0.15 | 60–160 | 60 | `land × peaks × smoothstep(0.55, 0.6, fbm(p, 1/1800, 4))` |
| dunes | 0.9 | 0–0.1 | 20–60 | 40 | `land × peaks × crest^1.6 × (0.35 + 0.65·smoothstep(0.3, 0.7, fbm(p, 1/1800, 2)))`. `crest` is `ridged` of `(p.x, 2.6·p.y, p.z)` at 1/300 with 3 octaves and gain 0.45 |
| craters | 1.0 | 0–0.1 | 80–250 | 60 | `land × peaks × (bowl(cells3(p, 1/3500)) + 0.3·bowl(cells3(p, 1/900)))`. `bowl(d)` is `−(1 − (d/0.6)²)` for `d < 0.6`, else `0.3·exp(−((d − 0.6)/0.12)²)` |
| ridges | 1.1 | 0–0.3 | 600–1100 | 200 | `land × ridged(p, 1/1600, 5) × peaks` |
| plateaus | 1.0 | 0–0.3 | 80–200 | 0 | `peaks × Σk=1..3 smoothstep(s0 + 0.12k, s0 + 0.12k + 0.03, shape)` |

- [ ] **Step 1: Write the failing tests**

In `fnl.test.js`, add a `describe('noise3For')` with these tests:
- `'gives the same value for the same seed and point, and differs between seeds'`
- `'stays in [−1, 1] over 1,000 points'`
- `'is continuous: two points a millimetre apart differ by under 1e−3'`
- `'warps in 3D'`: `warp: 200` differs from `warp: 0` at one point
- `'takes every type and fractal it names'`

Add a `describe('cells3For')` with one test: `'is a distance from 0 up, the same twice'`.

`characters.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { CHARACTERS, TERRAIN, groundOf } from './characters';
import { chartOf } from './sphere';
import { randomDirs } from './fixtures/generated';

const mid = ([a, b]) => (a + b) / 2;
const step4 = (dir, R, a) => chartOf(dir, R).toDir(Math.cos(a) * 4, Math.sin(a) * 4);

describe('the terrain characters', () => {
  it('are the eight the spec names', () => {
    expect(CHARACTERS).toEqual(['continents', 'archipelago', 'canyons', 'mesas', 'dunes', 'craters', 'ridges', 'plateaus']);
  });

  it.each(CHARACTERS)('%s: finite, within −190…1150 m, never more than 60 m in 4 m, at 15 km and 60 km', (kind) => {
    for (const R of [15000, 60000]) {
      const g = groundOf({ kind, sea: mid(TERRAIN[kind].sea), peaks: TERRAIN[kind].peaks[1] }, 11, R);
      for (const [i, d] of randomDirs(1000, 3).entries()) {
        const { h, land } = g(d);
        expect(Number.isFinite(h)).toBe(true);
        expect(h).toBeGreaterThanOrEqual(-190);
        expect(h).toBeLessThanOrEqual(1150);
        expect(land).toBeGreaterThanOrEqual(0);
        expect(land).toBeLessThanOrEqual(1);
        expect(Math.abs(g(step4(d, R, i)).h - h), `${kind} ${R}`).toBeLessThanOrEqual(60);
      }
    }
  });

  it('puts the sea where it says: the share under 0 within 0.05 of `sea`', () => {
    for (const kind of ['continents', 'archipelago']) for (const sea of TERRAIN[kind].sea) {
      const g = groundOf({ kind, sea, peaks: mid(TERRAIN[kind].peaks) }, 5, 30000);
      const under = randomDirs(2000, 9).filter((d) => g(d).h < 0).length / 2000;
      expect(Math.abs(under - sea), `${kind} ${sea}`).toBeLessThanOrEqual(0.05);
    }
  });

  it('gives each its mark: ridges stand tall, craters dig in, dunes stay low', () => {
    const hs = (kind, peaks) => randomDirs(1500, 4).map((d) => groundOf({ kind, sea: 0.05, peaks }, 21, 25000)(d).h).sort((a, b) => a - b);
    expect(hs('ridges', 1000)[Math.floor(1500 * 0.95)]).toBeGreaterThanOrEqual(350);
    const cr = hs('craters', 200);
    expect(cr[Math.floor(1500 * 0.05)]).toBeLessThanOrEqual(cr[750] - 60);
    const du = hs('dunes', 40);
    expect(du[1499] - du[750]).toBeLessThanOrEqual(200);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/land/flight/fnl.test.js src/lib/land/flight/characters.test.js`
Expected: FAIL. `noise3For` and `./characters` don’t exist.

- [ ] **Step 3: Build it**
  - `noise3For` and `cells3For` go in `fnl.js`. Name the class nowhere else.
  - `characters.js` follows the table.
  - `fixtures/generated.js` gets `randomDirs`: `seeded(seed)` (`lib/seeded.js`), then `z = 2r − 1` and an angle, which is uniform on the sphere.
  - Update the stack page.
  - If a slope assertion fails, lower that kind’s frequency or peaks in `TERRAIN`; don’t loosen the test.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/lib/land/flight/fnl.test.js src/lib/land/flight/characters.test.js docs/stack/stack.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/land/flight/fnl.js src/lib/land/flight/fnl.test.js src/lib/land/flight/characters.js src/lib/land/flight/characters.test.js src/lib/land/flight/fixtures/generated.js docs/stack/fastnoise-lite.md
git commit -m "Give the flight 3D noise and eight terrain characters on a sphere"
```

---

