### Task 2: The rules and the budget (pure)

**Files:**
- Create: `src/components/universe/nebula/budget.js`
- Create: `src/components/universe/nebula/budget.test.js`
- Create: `src/components/universe/nebula/rules.js`
- Create: `src/components/universe/nebula/rules.test.js`

**Interfaces:**
- Consumes: `PALETTE` from `src/components/universe/palette.js` (pure).
- Produces, in `budget.js`:
  - `NEBULA_BUDGET = { low, mid, high }`. Each row is `{ volume, farSteps, nearSteps, nearMax, fog, stars, drawn }`:

    | | volume | farSteps | nearSteps | nearMax | fog | stars | drawn |
    |---|---|---|---|---|---|---|---|
    | low | 32 | 4 | 12 | 1 | 2 | 16 | 8 |
    | mid | 48 | 5 | 20 | 1 | 3 | 32 | 12 |
    | high | 64 | 6 | 32 | 2 | 4 | 64 | 16 |

    - `volume`: the noise volume's side, in voxels
    - `farSteps` / `nearSteps`: march steps at the far and near levels
    - `nearMax`: how many clouds may be near at once
    - `fog`: the number of fog layers
    - `stars`: young stars per near cloud
    - `drawn`: the most clouds drawn at once
  - `nebulaBudget(tier: string) → row`: `'ultra'` (lib/device's detail level, never its tier) reads `high`, and an unknown tier reads `mid`.
  - A header line says lane 2's `universe/budget.js` takes these rows over.
- Produces, in `rules.js` (no three.js):
  - Constants:
    - `NEAR = 4`: in radii; inside this is the near level
    - `FADE = 0.2`
    - `LIMIT = 0.98`: the share of `camera.far` a cloud is drawn within
    - `INSIDE_MIN = 0.02`
    - `FOG_NEAR = 8`
    - `FOG_FAR = 3000`
  - `FORMS = { cloud, shell, nursery }`, each `{ inner, peak, outer, flat, core }`:
    - cloud `{ inner: -1, peak: 0.35, outer: 1, flat: 0.55, core: 1 }`
    - shell `{ inner: 0.45, peak: 0.72, outer: 0.98, flat: 0.8, core: 1 }`
    - nursery `{ inner: -1, peak: 0.2, outer: 1, flat: 0.6, core: 2.2 }`
  - `FORM_INDEX = { cloud: 0, shell: 1, nursery: 2 }`
  - `checkDesc(desc) → { id, at, r, colors: [c0, c1, c2], seed, form }`. It pads `colors` by repeating; none gives `[PALETTE.nebula]`×3. An unknown form becomes `'cloud'`. It throws `TypeError` on a missing `id`, a non-finite `at`, or `r` that isn't > 0.
  - `seedOf(seed: number | bigint | string) → [a, b, c]`, each in [0, 1). FNV-1a over `String(seed)`, then three splitmix steps.
  - `envelope(form: string, p: [x, y, z]) → 0…1`, where `p` is in radii from the middle, in the map's axes.
  - `placement(at, r, cam, limit) → { centre: [x, y, z], radius, scale, dist }`:
    - `centre` is camera-relative
    - `dist = |at − cam|`
    - `scale = min(1, limit / dist)`
    - `centre = (at − cam) · scale`
    - `radius = r · scale`
  - `detailAt(dist, r) → 0…1`: 1 inside `NEAR·r·(1 − FADE)`, 0 past `NEAR·r·(1 + FADE)`, smoothstep between.
  - `stepsAt(detail, row) → integer`: `round(farSteps + (nearSteps − farSteps) · detail)`.
  - `insideOf(entries: [{ id, at, r, form }], position) → { id, depth } | null`. The deepest entry whose envelope at `position` is at least `INSIDE_MIN` wins, with `depth` that envelope.
  - `fogLayers(row, r) → number[]`: `row.fog` radii, ascending and geometric, from `FOG_NEAR` to `min(0.5·r, FOG_FAR)`.
  - `youngStars(desc, n) → [{ at: [x, y, z] (units from the middle), size, bright, pal }]`, seeded from `seedOf(desc.seed)`. The spread is 0.6 for a shell, 0.35 for a nursery and 0.5 for a cloud, with y squashed by 0.45. The size and brightness follow `deepspace.js:815-818`'s draws.

- [ ] **Step 1: Write the failing tests.**

```js
// rules.test.js (budget.test.js likewise: every row present, no number smaller on a stronger tier; nebulaBudget('ultra') is high, nebulaBudget('?') is mid)
const sub = (a, b) => a.map((v, i) => v - b[i]);
const len = (a) => Math.hypot(...a);
describe('where a nebula is drawn', () => {
  const at = [-13380, 505, 28350], r = 700;
  it('keeps it where it is, whatever the camera', () => {
    for (const cam of [[0, 0, 0], [5000, 0, 0], [123456.7, -800, 1e6]]) {
      const p = placement(at, r, cam, 1e12);
      p.centre.forEach((v, i) => expect(cam[i] + v / p.scale).toBeCloseTo(at[i], 6));
    }
  });
  it('draws it at its true angle, 2·atan(r / d), with no floor', () => {
    for (const d of [2000, 9000, 45000, 1e6, 1e7]) {
      const p = placement([d, 0, 0], r, [0, 0, 0], 44100);
      expect(2 * Math.atan(p.radius / len(p.centre))).toBeCloseTo(2 * Math.atan(r / d), 12);
    }
    expect(2 * Math.atan(placement([1e7, 0, 0], r, [0, 0, 0], 44100).radius / 44100)).toBeLessThan(1e-3); // (the old floor was 14°, 0.244)
  });
  it('pulls a far one inside the far plane along its own direction', () => {
    const p = placement([0, 0, -200000], r, [0, 0, 0], 44100);
    expect(len(p.centre)).toBeCloseTo(44100, 6);
    expect(p.centre[2]).toBeLessThan(0);
    expect(p.scale).toBeCloseTo(44100 / 200000, 12);
    expect(p.dist).toBe(200000);
  });
  it('is whole with the camera at its very middle', () => {
    expect(placement(at, r, at, 44100)).toEqual({ centre: [0, 0, 0], radius: r, scale: 1, dist: 0 });
  });
});
describe('its levels', () => {
  it('is near inside four radii, far past them, smooth between', () => {
    expect(detailAt(4 * 700 * 0.79, 700)).toBe(1);
    expect(detailAt(4 * 700 * 1.21, 700)).toBe(0);
    expect(detailAt(4 * 700, 700)).toBeCloseTo(0.5);
    expect(stepsAt(0, NEBULA_BUDGET.high)).toBe(6);
    expect(stepsAt(1, NEBULA_BUDGET.high)).toBe(32);
  });
});
describe('its shape', () => {
  it('fills a cloud from its heart to its edge, flattened toward the map’s plane', () => {
    expect(envelope('cloud', [0, 0, 0])).toBe(1);
    expect(envelope('cloud', [1.01, 0, 0])).toBe(0);
    expect(envelope('cloud', [0, 0.5, 0])).toBeLessThan(envelope('cloud', [0.5, 0, 0]));
  });
  it('leaves a shell hollow and a nursery hot at the heart', () => {
    expect(envelope('shell', [0, 0, 0])).toBe(0);
    expect(envelope('shell', [0.72, 0, 0])).toBe(1);
    expect(FORMS.nursery.core).toBeGreaterThan(1);
    expect(envelope('nebulous?', [0.2, 0, 0])).toBe(envelope('cloud', [0.2, 0, 0]));
  });
});
describe('inside', () => {
  const veil = { id: 'veil', at: [0, 0, 0], r: 700, form: 'cloud' };
  it('says how deep, and nothing outside', () => {
    expect(insideOf([veil], [0, 0, 0])).toEqual({ id: 'veil', depth: 1 });
    expect(insideOf([veil], [707, 0, 0])).toBeNull();
  });
  it('names the deeper of two that overlap', () => {
    const other = { id: 'b', at: [600, 0, 0], r: 700, form: 'cloud' };
    expect(insideOf([veil, other], [550, 0, 0]).id).toBe('b');
  });
  it('is not inside a shell’s hollow middle', () => expect(insideOf([{ ...veil, form: 'shell' }], [0, 0, 0])).toBeNull());
});
describe('the fog’s layers', () => {
  it('starts clear of the ship and grows by one ratio', () => {
    const l = fogLayers(NEBULA_BUDGET.high, 700);
    expect(l).toHaveLength(4);
    expect(l[0]).toBe(8); // (the chase camera is at most 2.5 behind the ship: flight.js's CHASE)
    expect(l.at(-1)).toBeCloseTo(350);
    expect(l[2] / l[1]).toBeCloseTo(l[1] / l[0], 9);
    expect(fogLayers(NEBULA_BUDGET.high, 1e5).at(-1)).toBe(3000);
  });
});
describe('a description', () => {
  it('takes the seeds generators make, and keeps them apart', () => {
    for (const s of [7, 7n, 'veil', 2n ** 63n + 5n]) for (const v of seedOf(s)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
    expect(seedOf(7n)).toEqual(seedOf(7n));
    expect(seedOf('veil')).not.toEqual(seedOf('cradle'));
  });
  it('fills in colours and form, and refuses what can’t be drawn', () => {
    expect(checkDesc({ id: 'a', at: [0, 0, 0], r: 5, colors: ['#123456'], seed: 1 }).colors).toEqual(['#123456', '#123456', '#123456']);
    expect(checkDesc({ id: 'a', at: [0, 0, 0], r: 5, seed: 1, form: 'blob' })).toMatchObject({ colors: [PALETTE.nebula, PALETTE.nebula, PALETTE.nebula], form: 'cloud' });
    expect(() => checkDesc({ id: 'a', at: [0, NaN, 0], r: 5, seed: 1 })).toThrow(TypeError);
    expect(() => checkDesc({ id: 'a', at: [0, 0, 0], r: 0, seed: 1 })).toThrow(TypeError);
    expect(() => checkDesc({ at: [0, 0, 0], r: 5, seed: 1 })).toThrow(TypeError);
  });
});
describe('young stars', () => {
  it('are the same for a seed, inside the cloud, wider in a shell', () => {
    const d = { id: 'v', at: [0, 0, 0], r: 700, seed: 'v', form: 'shell' };
    expect(youngStars(d, 16)).toEqual(youngStars(d, 16));
    expect(youngStars(d, 16)).toHaveLength(16);
    const spread = (f) => youngStars({ ...d, form: f }, 64).reduce((s, x) => s + Math.hypot(...x.at), 0);
    expect(spread('shell')).toBeGreaterThan(spread('nursery'));
  });
});
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/nebula`. Expected: FAIL, because `./rules` and `./budget` can't be resolved.

- [ ] **Step 3: Implement `budget.js` and `rules.js`** to the Interfaces above.

The one formula the tests don't fix, written so `shaders.js` can mirror it line for line (GLSL's `smoothstep` is undefined with its edges reversed, so the falling edge is written `1 − smoothstep`):

```
ρ   = length([p.x, p.y / flat, p.z])
env = ρ ≥ 1 ? 0 : (1 − smoothstep(peak, outer, ρ)) × (inner < 0 ? 1 : smoothstep(inner, peak, ρ))
```

`checkDesc` copies `at` to a fresh array, so a caller mutating its own array later doesn't move the cloud.

- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/universe/nebula`. Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/components/universe/nebula
git commit -m "Nebulae: the pure rules and the tier rows"
```

---

