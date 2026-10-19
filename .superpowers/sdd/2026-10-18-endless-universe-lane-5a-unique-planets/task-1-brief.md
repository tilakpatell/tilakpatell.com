### Task 1: Lock the roster

The lock comes before any change, so every later task is held to it.

**Files:**
- Modify: `src/lib/land/flight/planetSpec.test.js` (imports at 1-7; append after 160)

**Interfaces:**
- Consumes: today’s `planetSpecOf`, `lifeFor` and `PLANETS` (`fixtures/expanse.js`), `planetField` (`field.js:35`) and `clutterKitOf` (`landmarkTables.js:222`).
- Produces: the `the roster` test, over the 17 fields a spec has today (`ROSTER_KEYS`). Every later task runs it.

- [ ] **Step 1: Write the lock**

```js
import { planetField } from './field';
import { clutterKitOf } from './landmarkTables';
// (and add lifeFor to the existing fixtures/expanse.js import)

// The fifty as the endless universe found them (its spec, section E: “The 50
// roster planets keep their plane ground exactly as it is”): every field the
// flight read then, the ground under five points, their life and clutter kits.
const ROSTER_LOCK = '';
const ROSTER_KEYS = ['id', 'name', 'seed', 'type', 'climate', 'biomes', 'pois', 'pits', 'palette', 'clutter', 'step', 'soft', 'ground', 'water', 'fog', 'landmarks', 'hero'];
const ROSTER_POINTS = [[0, 0], [1234.5, -987.25], [-15000, 8000], [30000, 30000], [-4321, -27000]];
function rosterHash() {
  const text = JSON.stringify(PLANETS.map(({ id }) => {
    const s = planetSpecOf(id);
    const f = planetField(s);
    return [ROSTER_KEYS.map((k) => s[k] ?? null), ROSTER_POINTS.map(([x, z]) => f.heightAt(x, z).toFixed(4)), lifeFor(s), clutterKitOf(s)];
  }));
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

describe('the roster', () => {
  it('is as it was: the fifty’s fields, ground, life and kits', () => {
    expect(rosterHash()).toBe(ROSTER_LOCK);
  });
});
```

- [ ] **Step 2: Run it on the unchanged code to read the value**

Run: `npx vitest run src/lib/land/flight/planetSpec.test.js -t "the roster"`
Expected: FAIL, `expected '<8 hex>' to be ''`. Paste the 8 hex digits into `ROSTER_LOCK`.

- [ ] **Step 3: Run it again**

Run: `npx vitest run src/lib/land/flight/planetSpec.test.js`
Expected: PASS, every test in the file.

- [ ] **Step 4: Commit**

```bash
git add src/lib/land/flight/planetSpec.test.js
git commit -m "Lock the fifty roster planets before the endless universe changes the flight"
```

---

