### Task 8: Generated specs

**Files:**
- Create: `src/lib/land/flight/generated.js` and `src/lib/land/flight/generated.test.js`
- Modify: `src/lib/land/flight/planetSpec.js`. Task 5’s non-roster branch now returns `generatedSpecOf(row, family)`.
- Modify: `src/lib/land/flight/planetTables.js`. Add `WATER_LOOKS`, moved unchanged from `water.js:14-19`.
- Modify: `src/components/expanse/flight/water.js`:
  - `:14-19` becomes `import { WATER_LOOKS as LOOKS }`.
  - `:26`’s colour becomes `w.colour ?? look.color`.

**Interfaces:**
- Consumes: `varietyOf` (Task 6); `roundBiomes`, `TYPE_LOOK`, `TYPE_BIOMES`, `expand` and `PLANE_CLIMATE` (`planetTables.js`); `sphereField` and `CLIMATE_SPHERE` (Task 4); `chartOf` and `angleBetween` (Task 2); `fold`.
- Produces:
  - `groundRadius(row) → metres`: `15000 + 45000 × clamp((row.radius − 18) / 52, 0, 1)`. It’s 15,000 for a moon or a missing radius.
  - `POI_NAMES = { ruins: 'Ruins', wreck: 'A crashed ship', outpost: 'An outpost', monolith: 'A monolith', signal: 'A signal' }`.
  - `generatedSpecOf(row, family) → spec`, with all 17 roster keys plus the `ROSTER_EXTRA` keys:
    - **`kind`, `parent`, `buildable`.** `kind` is `'moon'` when the id has a moon part. `parent` is `row.parent ?? null`. `buildable` is false.
    - **The variety fields.** `exotic`, `sky`, `weather`, `flora`, `fauna` and `character` are the variety’s. `palette` is `variety.palette`.
    - **`fog`.** `{ near: round(1500 − 900·haze), far: round(21000 − 9000·haze) }`.
    - **`clutter`.** It’s `TYPE_LOOK[family].clutter` with `trunk` and `spire` rows’ `perKm2` times `flora.density`. Then the exotic’s rows are added: crystal adds `{ kind: 'crystal', perKm2: 25, depth: 5 }`. glowing and floating add a `trunk` row at 14 if there’s none. spires adds `{ kind: 'spire', perKm2: 30, depth: 5, size: 1.4 }`.
    - **`ground`.** It’s `TYPE_LOOK[family].ground`, with its palette’s `low`, `high`, `rock`, `accent` and `deep` swapped for the variety’s.
      - `hLow` is `(water?.level ?? 0) + 2`, and `hHigh` is `clamp(peaks × 0.5, 60, 500)`.
      - A template `wet` keeps its colour and band, with `level` set to the water’s.
    - **gas and ringed:** a plane cloud deck as today, recoloured.
      - `round: null`, `soft: true`, `climate: PLANE_CLIMATE`.
      - `biomes: expand(TYPE_BIOMES[family], seed)`.
      - `pois: []`, `water: null`.
    - **Every other family:** round.
      - `round: { radius: groundRadius(row), at }`, `soft: false`, `step: 0`, `pits: []`.
      - `climate: CLIMATE_SPHERE`, `biomes: roundBiomes(family)`.
      - `water: variety.water && { kind, level: 0, colour? }`.
      - `landmarks: []`, `hero: null`.
  - **The POIs**, for each of `variety.poiKinds` in turn.
    - The candidates are `FIB_512`’s first 256 directions, turned by a seeded rotation and read in seeded order.
    - A POI takes the first candidate that meets all three rules:
      - `sphereField(spec0).sample(d).h > (water?.level ?? −∞) + 4`
      - `slope < 0.12`
      - at least 0.3 rad from every POI already placed
    - `spec0` is the spec with `pois: []`.
    - It gets `{ id: 'poi-<n>', name: POI_NAMES[kind], kind, dir, r: 60–140, edge: 80–120 }`. A kind with no candidate is skipped.
  - **The chart’s origin.** `round.at` is the first POI’s `dir`, else the first candidate that is dry and gentle, else candidate 0. Each POI’s `at` is then `chartOf(round.at, radius).toChart(dir)`, rounded to centimetres, with `+ 0` so no −0 is left.
  - `seed` is `fold(BigInt(row.seed))`, as the seeded planets’ is (`planetSpec.js:49`).
  - `chartedAt(spec, dir) → spec`. For a round spec, `round.at` becomes `unit(dir)` and every POI’s `at` is charted again; everything else stays. A plane spec comes back unchanged.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, expect, it } from 'vitest';
import { POI_NAMES, chartedAt, generatedSpecOf, groundRadius } from './generated';
import { sphereField } from './sphereField';
import { angleBetween, dirOfUv } from './sphere';
import { planetSpecOf as specWith } from './planetSpec';
import { MOONS, lookupOf, randomSystems } from './fixtures/generated';
import { PLANETS, planetSpecOf } from './fixtures/expanse.js';

// every key a roster spec has (its 17 and ROSTER_EXTRA's)
const KEYS = Object.keys(planetSpecOf('hoth'));
const rows = randomSystems(60, 4).flat();
const lookup = lookupOf(rows);
const landable = rows.filter((r) => !['gas', 'ringed'].includes(r.type)).slice(0, 40);

describe('generatedSpecOf', () => {
  it('makes a round planet of every landable type, and a moon, with every field a spec has', () => {
    for (const r of [...landable, ...MOONS]) {
      const s = specWith(r.id, { expanse: (id) => lookup(id) ?? MOONS.find((m) => m.id === id) ?? null });
      for (const k of KEYS) expect(k in s, `${r.id} ${k}`).toBe(true);
      expect(s.round.radius).toBeGreaterThanOrEqual(15000);
      expect(s.round.radius).toBeLessThanOrEqual(60000);
      expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    }
  });

  it('sizes the ground from the universe radius', () => {
    expect(groundRadius({ radius: 18 })).toBe(15000);
    expect(groundRadius({ radius: 70 })).toBe(60000);
    expect(groundRadius({ radius: 140 })).toBe(60000);
    expect(groundRadius({ radius: 44 })).toBe(37500);
    expect(groundRadius({})).toBe(15000);
  });

  it('puts its places on dry, gentle land, apart, and starts the chart at the first', () => {
    for (const r of landable) {
      const s = specWith(r.id, { expanse: lookup });
      const f = sphereField(s);
      s.pois.forEach((p, i) => {
        expect(POI_NAMES[p.kind]).toBe(p.name);
        expect(f.sample(p.dir).h).toBeGreaterThan((s.water?.level ?? -Infinity) + 3);
        for (const q of s.pois.slice(0, i)) expect(angleBetween(p.dir, q.dir)).toBeGreaterThanOrEqual(0.3);
      });
      if (s.pois.length) expect(Math.hypot(...s.pois[0].at)).toBe(0);
    }
  });

  it('gives the seeded thirteen no new places', () => {
    for (const p of PLANETS.slice(37)) expect(planetSpecOf(p.id).pois).toEqual([]);
  });

  it('charts again at any spot: the origin and the POIs move, nothing else', () => {
    const s = specWith(landable[0].id, { expanse: lookup });
    const t = chartedAt(s, dirOfUv(0.1, 0.3));
    expect(angleBetween(t.round.at, dirOfUv(0.1, 0.3))).toBeLessThan(1e-12);
    expect({ ...t, round: null, pois: null }).toEqual({ ...s, round: null, pois: null });
    expect(t.pois.map((p) => p.dir)).toEqual(s.pois.map((p) => p.dir));
  });

  it('is the same spec from any lookup that knows the row (the universe’s or the flight’s)', () => {
    for (const r of landable.slice(0, 10)) expect(specWith(r.id, { expanse: [r] })).toEqual(specWith(r.id, { expanse: lookup }));
  });

  it('wears its variety in the flight: the sky in its palette, the haze in its fog', () => {
    const s = specWith(landable[1].id, { expanse: lookup });
    expect(s.palette.skyLow).toBe(s.sky.low);
    expect(s.fog.far).toBe(Math.round(21000 - 9000 * s.sky.haze));
  });

  it('keeps a gas giant a plane cloud deck, recoloured', () => {
    const g = rows.find((r) => r.type === 'gas');
    const s = specWith(g.id, { expanse: lookup });
    expect(s).toMatchObject({ round: null, soft: true, pois: [], water: null, buildable: false });
  });

  it('shows several biomes on its sphere', () => {
    let many = 0;
    for (const r of landable) {
      const f = sphereField(specWith(r.id, { expanse: lookup }));
      const count = new Map();
      for (let j = 0; j < 32; j++) for (let i = 0; i < 64; i++) { const b = f.biomeAt(dirOfUv((i + 0.5) / 64, (j + 0.5) / 32)); count.set(b, (count.get(b) ?? 0) + 1); }
      const big = [...count.values()].filter((n) => n >= 0.03 * 2048).length;
      expect(big, r.id).toBeGreaterThanOrEqual(2);
      if (big >= 3) many++;
    }
    expect(many / landable.length).toBeGreaterThanOrEqual(0.9);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/land/flight/generated.test.js`
Expected: FAIL, `Failed to resolve import "./generated"`.

- [ ] **Step 3: Build `generated.js`, wire it into `planetSpec.js`, and move `WATER_LOOKS`**

If `'shows several biomes'` fails, raise `CLIMATE_SPHERE.stretch` (Task 4) a tenth at a time; that test is the decision, the number is tuning.

- [ ] **Step 4: Run the flight’s tests, and the lock**

Run: `npx vitest run src/lib/land/flight src/components/expanse/flight`
Expected: PASS. `the roster` and `planets.test.js` both pass; `'flies to any Expanse planet by id'` now gets a round spec.

- [ ] **Step 5: Commit**

```bash
git add src/lib/land/flight src/components/expanse/flight/water.js
git commit -m "Build every generated planet and moon round, from its own variety"
```

---

