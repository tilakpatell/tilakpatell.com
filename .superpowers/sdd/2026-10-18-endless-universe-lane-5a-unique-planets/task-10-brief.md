### Task 10: The orbit map

**Files:**
- Create: `src/lib/land/flight/orbitMap.js` and `src/lib/land/flight/orbitMap.test.js`

**Interfaces:**
- Consumes: `sphereField(spec).sample` and `SLOPE_STEP` (Task 4); `planetField` (Task 7); `chartedAt` (Task 8); `dirOfUv` (Task 2); `WATER_LOOKS` (Task 8); `noise3For`.
- Produces:
  - `ORBIT_MAP_SIZE = { low: [256, 128], mid: [256, 128], high: [512, 256], ultra: [512, 256] }`, and `orbitMapSize(tier) → { width, height }`, falling back to `mid`.
  - `PLANE_WINDOW = 40000` (metres across u; half that across v).
  - `groundColour(spec, { h, slope }) → { rgb: [r, g, b], water: boolean }`. The bytes are sRGB; the mixing is done in linear light. It is `lib/three/groundLook.js:165-176`’s rule at the mean of its noises:
    - The palette is `spec.ground?.palette ?? { ...spec.palette, hLow: 0, hHigh: 120 }` (`ground.js:38`’s fallback).
    - It starts at `mix(low, high, smoothstep(hLow, hHigh, h))`.
    - The accent mixes in at `accentCover × 0.5`.
    - Rock (× 0.98) mixes in by `smoothstep(rockAt, rockAt + 0.14, slope)`.
    - `wet` mixes in by `(1 − smoothstep(level, level + (band ?? 1.5), h)) × 0.75`.
    - **Under the water** (`spec.water && h < water.level`):
      - The water colour is `water.colour ?? WATER_LOOKS[kind].color`, mixed 0.15 toward `palette.accent` as at `water.js:26`.
      - Lava is `mix(that, glow, 0.6)`. Anything else is `mix(ground, water, opacity)`.
      - `water` is true.
  - `bakeOrbitMap(spec, { width = 256, height = 128 } = {}) → { width, height, rgba: Uint8ClampedArray, biome: Uint8Array }`. Texel `(i, j)` is at `dirOfUv((i + 0.5)/width, (j + 0.5)/height)`. Alpha is 0 under water and 255 elsewhere. There are three kinds of spec:
    - **Round:** `sample(dir)` gives `groundColour`’s colour and the biome.
    - **gas or ringed:** bands. Let `n = noise3For(seed, { frequency: 2.2, octaves: 4, warp: 0.25 })(dir)` and `t = sin((dir.y × B + 0.6n) × π)`, with B from 6 to 11, seeded. The colour is `mix(low, high, 0.5t + 0.5)`, with `accent` where `|n| > 0.55`. The biome is 0.
    - **Any other plane spec** (the seeded 13 and the named worlds): a window of the plane. It’s `x = (u − 0.5) × PLANE_WINDOW` and `z = (v − 0.5) × PLANE_WINDOW / 2`, with the slope from `planetField` at ±`SLOPE_STEP` as `sample`’s, and the biome `biomeAt(x, z)`.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, expect, it } from 'vitest';
import { ORBIT_MAP_SIZE, bakeOrbitMap, groundColour, orbitMapSize } from './orbitMap';
import { planetField } from './field';
import { chartedAt } from './generated';
import { SLOPE_STEP } from './sphereField';
import { dirOfUv } from './sphere';
import { planetSpecOf as specWith } from './planetSpec';
import { MOONS, lookupOf, randomSystems } from './fixtures/generated';
import { PLANETS, planetSpecOf } from './fixtures/expanse.js';

const rows = randomSystems(40, 6).flat();
const lookup = lookupOf(rows);
const round = rows.filter((r) => ['rock', 'ice', 'ocean', 'forest'].includes(r.type)).slice(0, 4).map((r) => specWith(r.id, { expanse: lookup }));

describe('bakeOrbitMap', () => {
  it('is 256 × 128 RGBA unless asked, and 512 × 256 on high and up', () => {
    const m = bakeOrbitMap(round[0], { width: 32, height: 16 });
    expect(m.rgba).toHaveLength(32 * 16 * 4);
    expect(m.biome).toHaveLength(32 * 16);
    expect(ORBIT_MAP_SIZE).toEqual({ low: [256, 128], mid: [256, 128], high: [512, 256], ultra: [512, 256] });
    expect(orbitMapSize('high')).toEqual({ width: 512, height: 256 });
    expect(orbitMapSize('nonsense')).toEqual({ width: 256, height: 128 });
  });

  it('is the same bytes twice', () => {
    expect(bakeOrbitMap(round[1], { width: 48, height: 24 })).toEqual(bakeOrbitMap(round[1], { width: 48, height: 24 }));
  });

  it('shows what the ground shows: each texel is the flight’s ground at the chart’s middle there', () => {
    const W = 64, H = 32;
    for (const spec of round) {
      const m = bakeOrbitMap(spec, { width: W, height: H });
      for (let k = 0; k < 12; k++) {
        const i = (k * 37) % W, j = (k * 11 + 3) % H;
        const g = planetField(chartedAt(spec, dirOfUv((i + 0.5) / W, (j + 0.5) / H)));
        const s = SLOPE_STEP;
        const gx = (g.heightAt(s, 0) - g.heightAt(-s, 0)) / (2 * s), gz = (g.heightAt(0, s) - g.heightAt(0, -s)) / (2 * s);
        const want = groundColour(spec, { h: g.heightAt(0, 0), slope: 1 - 1 / Math.hypot(1, gx, gz) });
        const at = (j * W + i) * 4;
        expect([...m.rgba.slice(at, at + 3)], `${spec.id} ${i},${j}`).toEqual(want.rgb);
        expect(m.rgba[at + 3]).toBe(want.water ? 0 : 255);
        expect(m.biome[j * W + i]).toBe(g.biomeAt(0, 0));
      }
    }
  });

  it('has no seam where it wraps: its last column meets its first as any two neighbours meet', () => {
    const W = 128, H = 64;
    const m = bakeOrbitMap(round[2], { width: W, height: H });
    const px = (i, j) => [...m.rgba.slice((j * W + i) * 4, (j * W + i) * 4 + 3)];
    const apart = (a, b) => Math.max(...a.map((v, c) => Math.abs(v - b[c])));
    let inner = 0, wrap = 0;
    for (let j = 0; j < H; j++) {
      for (let i = 1; i < W; i++) inner = Math.max(inner, apart(px(i - 1, j), px(i, j)));
      wrap = Math.max(wrap, apart(px(W - 1, j), px(0, j)));
    }
    expect(wrap).toBeLessThanOrEqual(inner + 8);
  });

  it('bakes every kind of spec and never throws: the fifty, a moon, a gas giant', () => {
    const gas = specWith(rows.find((r) => r.type === 'gas').id, { expanse: lookup });
    const moon = specWith(MOONS[0].id, { expanse: MOONS });
    for (const spec of [...PLANETS.map((p) => planetSpecOf(p.id)), moon, gas]) {
      const m = bakeOrbitMap(spec, { width: 16, height: 8 });
      expect(m.rgba, spec.id).toHaveLength(16 * 8 * 4);
    }
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/land/flight/orbitMap.test.js`
Expected: FAIL, `Failed to resolve import "./orbitMap"`.

- [ ] **Step 3: Implement `orbitMap.js`**

`sample(dir)` reads the same chart (`chartOf(dir, R)`) as `planetField(chartedAt(spec, dir))`, and `unit` leaves a unit vector alone, so the texel test can be exact. If it is off by one in a channel, the two paths differ in float order: make both go through `chartOf(dir, R).toDir`.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/lib/land/flight/orbitMap.test.js`
Expected: PASS, under a second.

- [ ] **Step 5: Commit**

```bash
git add src/lib/land/flight/orbitMap.js src/lib/land/flight/orbitMap.test.js
git commit -m "Bake a planet's orbit map from the ground the flight flies over"
```

---

