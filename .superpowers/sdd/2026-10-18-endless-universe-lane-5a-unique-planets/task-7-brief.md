### Task 7: The flight’s field on a round planet

**Files:**
- Modify: `src/lib/land/flight/field.js:35-65`. Add the round branch first, and add `fieldKey`.
- Modify: `src/components/expanse/flight/terrain.worker.js:20-21`. Cache by `fieldKey(spec)`, not `spec.id`.
- Test: `src/lib/land/flight/field.test.js` and `src/components/expanse/flight/mapWorker.test.js`

**Interfaces:**
- Consumes: `chartOf` (Task 2); `sphereField` (Task 4); `roundSpec` (fixture).
- Produces:
  - `planetField(spec)`: for `spec.round`, `heightAt(x, z)` is `sphereField(spec).heightAt(chart.toDir(x, z))`, with `chart = chartOf(spec.round.at, spec.round.radius)`. `biomeAt` works the same way. A plane spec takes today’s path unchanged.
  - `fieldKey(spec) → string`: `spec.id` for a plane, and `` `${spec.id}@${spec.round.at.join(',')}` `` for a round spec.

- [ ] **Step 1: Write the failing tests**

```js
import { fieldKey } from './field';
import { sphereField } from './sphereField';
import { roundSpec } from './fixtures/generated';

describe('planetField on a round planet', () => {
  const spec = roundSpec({ type: 'ice', kind: 'ridges', radius: 18000 });
  const g = planetField(spec);
  const R = spec.round.radius;

  it('reads the sphere through the chart: its middle is the spot', () => {
    expect(g.heightAt(0, 0)).toBe(sphereField(spec).heightAt(spec.round.at));
  });

  it('comes round to the same ground after 2πR, any way it flies', () => {
    for (const a of [0, 0.7, 2, 3.9, 5.5]) for (const d of [10, 2500, 41000]) {
      const [ux, uz] = [Math.cos(a), Math.sin(a)];
      const k = d + 2 * Math.PI * R;
      expect(g.heightAt(ux * k, uz * k)).toBeCloseTo(g.heightAt(ux * d, uz * d), 6);
    }
  });

  it('is finite and gentle out to three turns, the far side included', () => {
    const rnd = seeded(13);
    for (let i = 0; i < 1500; i++) {
      const d = rnd() * 3 * Math.PI * R, a = rnd() * Math.PI * 2;
      const [x, z] = [Math.cos(a) * d, Math.sin(a) * d];
      const h = g.heightAt(x, z);
      expect(Number.isFinite(h)).toBe(true);
      const b = rnd() * Math.PI * 2;
      expect(Math.abs(g.heightAt(x + Math.cos(b) * 4, z + Math.sin(b) * 4) - h)).toBeLessThanOrEqual(60);
    }
    for (let k = 0; k < 16; k++) expect(Number.isFinite(g.heightAt(Math.cos(k) * Math.PI * R, Math.sin(k) * Math.PI * R))).toBe(true);
  });

  it('keys a round field by its spot, a plane one by its id', () => {
    expect(fieldKey(planetSpecOf('hoth'))).toBe('hoth');
    expect(fieldKey(spec)).not.toBe(fieldKey({ ...spec, round: { ...spec.round, at: [0, 1, 0] } }));
  });
});
```

In `mapWorker.test.js`, add `'keeps a round planet’s fields apart by spot'`:
- Ask the worker for leaf `leafOf(6, 0, 0)` with `n: 9` twice.
- The first spec is `roundSpec()`.
- The second is the same spec with `round.at: [0, 0, 1]`.
- The two answers’ `heights` differ.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/land/flight/field.test.js src/components/expanse/flight/mapWorker.test.js`
Expected: FAIL. `fieldKey` is missing, and a round spec reaches `stackOf` and its empty relief, so the heights are flat.

- [ ] **Step 3: Implement the branch and the key; switch the worker’s `fields` Map to `fieldKey`**

- [ ] **Step 4: Run them, and the lock**

Run: `npx vitest run src/lib/land/flight src/components/expanse/flight`
Expected: PASS, `the roster` included.

- [ ] **Step 5: Commit**

```bash
git add src/lib/land/flight/field.js src/lib/land/flight/field.test.js src/components/expanse/flight/terrain.worker.js src/components/expanse/flight/mapWorker.test.js
git commit -m "Fly a round planet as a plane: the chart round the landing spot"
```

---

