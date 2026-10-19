### Task 4: The field on the sphere

**Files:**
- Modify: `src/lib/land/flight/biomes.js:34-48`. `biomeWeights(spec, x, z)` becomes `weightsAt(spec.biomes, ...climateOf(spec)(x, z))`. Export `weightsAt(biomes, t, m) → number[]`, which is today’s body from line 35 on, unchanged.
- Modify: `src/lib/land/flight/planetTables.js`. After `TYPE_LOOK` (608-617), add `ROUND_ROUGH` and `roundBiomes`.
- Create: `src/lib/land/flight/sphereField.js` and `src/lib/land/flight/sphereField.test.js`
- Modify: `src/lib/land/flight/fixtures/generated.js` (add `roundSpec`)

**Interfaces:**
- Consumes: `groundOf` and `TERRAIN` (Task 3); `chartOf`, `angleBetween` and `dirOfLatLon` (Task 2); `noise3For`.
- Produces:
  - `ROUND_ROUGH[biomeId] → multiplier` (keyed by the template ids `TYPE_BIOMES` gives):
    - ice: plains 0.7, shelf 0.3, range 2.2, glacier 0.8, valley 0.6
    - desert: jundland 1.2, dunesea 0.8, plateau 0.6, chott 0.25, wastes 0.9
    - forest: redwoods 1, savannah 0.6, range 2.2, lakes 0.4, desert 0.7
    - lava: fields 1, volcanoes 2, ash 0.6, glass 0.3
    - ocean: islands 1, volcano 1.6, reef 0.3, deep 0.5
    - rock: plains 0.6, mesas 1.2, badlands 1.6, craters 1
  - `roundBiomes(family) → [{ id, at, reach, base, rough, relief: [] }]`: from `TYPE_BIOMES[family]`, with no scatter, plus each id’s `ROUND_ROUGH`.
  - The round spec (what `sphereField` reads):

    ```
    { id, seed: int32, type: family, biomes: roundBiomes(family),
      character: { kind, sea, peaks },
      round: { radius: metres, at: dir },
      water: { kind, level, colour? } | null,
      pois: [{ id, name, kind, dir, at: [x, z], r, edge }] }
    ```
  - `CLIMATE_SPHERE = { frequency: 1.6, octaves: 3, stretch: 1.5 }` and `SLOPE_STEP = 8` (metres).
  - `sphereField(spec) → { heightAt(dir), biomeAt(dir), climateAt(dir) → [t, m], sample(dir) → { h, slope, biome } }`. The rules:
    - **Climate.** `t = 0.55·(1 − |dir.y|) + 0.45·n_t` and `m = n_m`. Both noises are `noise3For` of the unit direction (seeds `seed` and `seed + 1`), mapped to 0…1, then stretched about 0.5 by `stretch` and clamped to 0…1.
    - **Height.** `soft(groundOf(dir).h + Σ w_b·(base_b + rough_b·hills) + detail)`.
      - `hills` is `fbm(p, 1/520, 4) × 26`; `detail` is `(2·fbm(p, 1/70, 3) − 1) × 3`.
      - `soft` presses the range into −200…1150. Above 900 it’s `900 + 250·tanh((h − 900)/250)`. Below −150 it’s `−150 − 50·tanh((−150 − h)/50)`.
    - **POI flats.** These are `flats.js`’s rule on the sphere. The distance is `radius × angleBetween(dir, poi.dir)`. The level is the raw height at `poi.dir`. `edge` defaults to `max(8, 0.6r)`.
    - **Biomes.** `biomeAt` is the heaviest of `weightsAt(spec.biomes, t, m)`.
    - **Sample.** `sample(dir)` reads `h`, then four heights at ±`SLOPE_STEP` along `chartOf(dir, radius)`’s x and z.
      - The gradient `g` comes from central differences, and `slope = 1 − 1/hypot(1, g)`. That’s `groundLook.js`’s `1 − normal.y`.
      - The biome is `biomeAt(dir)`.
  - `fixtures/generated.js`: `roundSpec({ type = 'rock', kind = 'craters', seed = 7, radius = 20000, sea, peaks } = {})`.
    - It assembles the round spec above by hand: `round.at = dirOfLatLon(0, 0)` and `water` `{ kind: 'sea', level: 0 }` for ocean and forest, else null.
    - It has one POI: `{ id: 'poi-0', name: 'Ruins', kind: 'ruins', dir: dirOfLatLon(5, 10), at: [0, 0], r: 120, edge: 100 }`. Its `at` isn’t read by `sphereField`.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, expect, it } from 'vitest';
import { CLIMATE_SPHERE, SLOPE_STEP, sphereField } from './sphereField';
import { CHARACTERS } from './characters';
import { angleBetween, chartOf, dirOfLatLon, dirOfUv } from './sphere';
import { randomDirs, roundSpec } from './fixtures/generated';

const TYPES = ['rock', 'ice', 'desert', 'forest', 'lava', 'ocean'];

describe('sphereField', () => {
  it.each(TYPES.flatMap((type, i) => [[type, CHARACTERS[i]], [type, CHARACTERS[i + 2]]]))('%s, %s: finite, within −200…1200, never more than 60 m in 4 m', (type, kind) => {
    const spec = roundSpec({ type, kind });
    const f = sphereField(spec);
    for (const [i, d] of randomDirs(800, 5).entries()) {
      const h = f.heightAt(d);
      expect(h).toBeGreaterThanOrEqual(-200);
      expect(h).toBeLessThanOrEqual(1200);
      if (angleBetween(d, spec.pois[0].dir) * spec.round.radius < 240) continue;
      const n = chartOf(d, spec.round.radius).toDir(Math.cos(i) * 4, Math.sin(i) * 4);
      expect(Math.abs(f.heightAt(n) - h)).toBeLessThanOrEqual(60);
    }
  });

  it('has no seam where the map wraps nor at the poles', () => {
    const f = sphereField(roundSpec({ type: 'ice', kind: 'ridges' }));
    for (let i = 1; i < 200; i++) {
      const v = i / 200;
      expect(Math.abs(f.heightAt(dirOfUv(1 - 1e-9, v)) - f.heightAt(dirOfUv(1e-9, v)))).toBeLessThan(0.01);
    }
    for (const pole of [0, 1]) {
      const hs = Array.from({ length: 36 }, (_, k) => f.heightAt(dirOfUv(k / 36, pole === 0 ? 1e-6 : 1 - 1e-6)));
      expect(Math.max(...hs) - Math.min(...hs)).toBeLessThan(1);
    }
  });

  it('holds a POI flat at the land’s own height there', () => {
    const spec = roundSpec();
    const f = sphereField(spec);
    const at = spec.pois[0].dir;
    const level = f.heightAt(at);
    expect(f.heightAt(chartOf(at, spec.round.radius).toDir(110, 0))).toBeCloseTo(level, 6);
  });

  it('samples what it answers: sample(dir).h is heightAt(dir), its slope 0…1, its biome biomeAt(dir)', () => {
    const f = sphereField(roundSpec({ type: 'desert', kind: 'mesas' }));
    for (const d of randomDirs(50, 8)) {
      const s = f.sample(d);
      expect(s.h).toBe(f.heightAt(d));
      expect(s.slope).toBeGreaterThanOrEqual(0);
      expect(s.slope).toBeLessThan(1);
      expect(s.biome).toBe(f.biomeAt(d));
    }
    expect(SLOPE_STEP).toBe(8);
    expect(CLIMATE_SPHERE.frequency).toBe(1.6);
  });

  it('is colder at the poles than at the equator, on the whole', () => {
    const f = sphereField(roundSpec({ type: 'forest', kind: 'continents' }));
    const mean = (lat) => Array.from({ length: 72 }, (_, k) => f.climateAt(dirOfLatLon(lat, k * 5))[0]).reduce((a, b) => a + b) / 72;
    expect(mean(0)).toBeGreaterThan(mean(80) + 0.2);
  });
});
```

Also export `biomes.js`’s `climateOf`; its header already lists it, at line 12. Then add a `biomes.test.js` case, `'weightsAt is biomeWeights given the climate'`: at 20 points, `biomeWeights(hoth, x, z)` must equal `weightsAt(hoth.biomes, ...climateOf(hoth)(x, z))`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/land/flight/sphereField.test.js src/lib/land/flight/biomes.test.js`
Expected: FAIL. `./sphereField`, `weightsAt` and `roundSpec` don’t exist.

- [ ] **Step 3: Build it**

Do it in this order: `weightsAt` and the exported `climateOf`, then `ROUND_ROUGH` and `roundBiomes`, then `sphereField.js`, then `roundSpec`.

- [ ] **Step 4: Run them, and the lock**

Run: `npx vitest run src/lib/land/flight`
Expected: PASS, `the roster` included. That proves `weightsAt` moved nothing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/land/flight/biomes.js src/lib/land/flight/biomes.test.js src/lib/land/flight/planetTables.js src/lib/land/flight/sphereField.js src/lib/land/flight/sphereField.test.js src/lib/land/flight/fixtures/generated.js
git commit -m "Grow a generated planet's ground on its sphere: climate, biomes, heights, flats"
```

---

