### Task 5: Ids, moons and who may build

**Files:**
- Modify: `src/lib/land/flight/expanse.js` (add `canonicalId`)
- Modify: `src/lib/land/flight/planetTables.js`. Add `SEEDED_EXPANSE`, `MOON_FAMILY`, `familyOf` and `PLANE_CLIMATE`; the last is moved from `planetSpec.js:43` unchanged.
- Modify: `src/lib/land/flight/planetSpec.js:43` (`CLIMATE` becomes the imported `PLANE_CLIMATE`), `:56-74` (`specOf` adds `ROSTER_EXTRA`) and `:76-88` (id handling)
- Modify: `src/lib/land/flight/lifeTables.js:396-406`. `EXPANSE_ID` becomes `canonicalId`.
- Modify: `src/components/expanse/flight/planets.js:24-42`, then regenerate `src/lib/land/flight/fixtures/expanse.json` with `node scripts/flight-expanse-fixture.mjs`
- Modify: `src/lib/land/flight/fixtures/generated.js` (add `MOONS`)
- Test: `src/lib/land/flight/planetSpec.test.js`, `src/lib/land/flight/lifeTables.test.js` and `src/components/expanse/flight/planets.test.js`

**Interfaces:**
- Consumes: `parseSpaceId` and `spaceId` from `src/lib/space/address.js` (index Task 0).
- Produces:
  - `canonicalId(id) → string | null`. It returns the lower-case `spaceId([sx, sy, sz], system, planet[, moon])` for a planet or moon id. For anything else it returns null: a system, a wonder, junk or a non-string.
    - It first checks the id against `/^e:-?\d+,-?\d+(?:,-?\d+)?(?::\d+){2,3}$/i`, then parses it.
    - So its strictness doesn’t hang on how lenient `address.js` is.
  - `SEEDED_EXPANSE`: the 13 `[id, type]` pairs of `fixtures/expanse.json`, in order. They are `e:1,0:0:0` gas, `:0:1` forest, `:0:2` lava, `:0:3` ice, `:0:4` rock, `:0:5` ice, `:0:6` desert, `:1:0` desert, `:1:1` ocean, `:1:2` rock, `:2:0` gas, `:2:1` ocean and `:2:2` rock.
  - `MOON_FAMILY = { rocky: 'rock', icy: 'ice' }` and `familyOf(type) → MOON_FAMILY[type] ?? type`.
  - `ROSTER_EXTRA = { kind: 'planet', parent: null, buildable: true, round: null, character: null, sky: null, weather: null, flora: null, fauna: null, exotic: null }`, exported from `planetSpec.js`.
  - `planetSpecOf(id, { expanse })` takes one of three paths:
    - A named world is today’s spec plus `ROSTER_EXTRA`.
    - A seeded id (canonical, in `SEEDED_EXPANSE`) is today’s template spec (lines 85-87) plus `ROSTER_EXTRA`.
    - Any other planet or moon whose row the lookup has, and whose `familyOf(type)` is in `TYPE_BIOMES`, is for now the template spec of its family. It carries `{ ...ROSTER_EXTRA, kind: 'moon' | 'planet', parent: <planet id> | null, buildable: false }`. Task 8 replaces this branch.
  - A moon row (the contract with lane 2): `{ id, name, type: 'rocky' | 'icy', seed: string, radius?, system, parent }`.
  - In `planets.js`:
    - `rowOf` adds `radius: p.radius`, `moons` (a count: `p.moons` when it’s a number, otherwise its length) and `rings: Boolean(p.rings)`.
    - `expanseRow(id)` parses through `canonicalId` and `parseSpaceId`. It returns null for `sy !== 0`, because lane 2’s 3D generator answers the other layers. A moon goes through `moonRowOf(p, s, k)`.
    - `moonRowOf(p, s, k)` is exported and reads `p.moonList?.[k]`. **That field is lane 2’s (its plan: planets gain `moonList` of `{ id, k, name, type, seed, radius, orbit, phase, revs, tilt }`).** Whichever lane merges second makes the names meet, a one-line change. Until then a moon id resolves to null in the app; the lib side is tested with `MOONS`.

- [ ] **Step 1: Write the failing tests**

In `planetSpec.test.js`:

```js
import { SEEDED_EXPANSE } from './planetTables';
import { ROSTER_EXTRA } from './planetSpec';
import { MOONS } from './fixtures/generated';

describe('ids, moons and the build flag', () => {
  it('reads an Expanse id in either case and with its height written, to one canonical id', () => {
    const s = planetSpecOf('e:1,0:0:1');
    expect(planetSpecOf('E:1,0:0:1')).toEqual(s);
    expect(planetSpecOf('e:1,0,0:0:1')).toEqual(s);
    expect(s.id).toBe('e:1,0:0:1');
  });

  it('refuses what isn’t a planet or a moon, and never throws', () => {
    for (const id of ['e:1,0', 'e:1,0:0', 'e:1,0:w1', 'e:1,0:0:1:', 'e:1,0:0:1x', ' e:1,0:0:1', 'e:1,0:0:-1', 'e:1,0:0:1:9', null, 42]) expect(planetSpecOf(id), String(id)).toBeNull();
  });

  it('lists the thirteen seeded Expanse planets as the roster’s last thirteen', () => {
    expect(SEEDED_EXPANSE).toEqual(EXPANSE.map((r) => [r.id, r.type]));
  });

  it('lets the fifty be built on, and gives them nothing new', () => {
    for (const p of PLANETS) expect(Object.fromEntries(Object.keys(ROSTER_EXTRA).map((k) => [k, planetSpecOf(p.id)[k]])), p.id).toEqual(ROSTER_EXTRA);
  });

  it('lands a moon from its row: rocky as rock, icy as ice, its planet named, not to be built on', () => {
    const [rocky, icy] = MOONS;
    expect(specWith(rocky.id, { expanse: MOONS })).toMatchObject({ id: rocky.id, kind: 'moon', parent: rocky.parent, type: 'rock', buildable: false });
    expect(specWith(icy.id.toUpperCase(), { expanse: MOONS })).toMatchObject({ id: icy.id, type: 'ice' });
  });
});
```

In `lifeTables.test.js`, add `'finds a moon’s system on its row'`: `systemOf(MOONS[0].id, { expanse: MOONS })` equals `MOONS[0].system`, and `lifeFor(specWith(MOONS[0].id, { expanse: MOONS }), { expanse: MOONS })` has `air` and `ground` arrays.

In `planets.test.js`:
- `'carries the universe radius, moons and rings on a row'`: for `far` (`planets.test.js:37`’s), `expanseRow(far.id)` matches `{ radius: far.radius, moons: far.moons, rings: Boolean(far.rings) }`.
- `'reads a moon from the generator’s moon rows'`: `moonRowOf({ id: 'E:3,-2:1:0', moonList: [{ name: 'Ostra', type: 'rocky', seed: 12345n }] }, { faction: null, traffic: 0.2, hazard: null }, 0)` equals `{ id: 'e:3,-2:1:0:0', name: 'Ostra', type: 'rocky', seed: '12345', system: { faction: null, traffic: 0.2, hazard: null }, parent: 'e:3,-2:1:0' }`.
- `'reads a planet id with its height written'`: `expanseRow('E:1,0,0:0:1')` equals `expanseRow('e:1,0:0:1')`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/land/flight src/components/expanse/flight/planets.test.js`
Expected: FAIL. `SEEDED_EXPANSE`, `ROSTER_EXTRA`, `MOONS` and `moonRowOf` are missing, and `'e:1,0,0:0:1'` reads as null.

- [ ] **Step 3: Build it**
  - Write the pieces in the order of the Interfaces block.
  - The `MOONS` fixture is two rows of `'e:3,-2:1:0'`, moons `:0` (rocky) and `:1` (icy), with seeds as strings and `system: { faction: null, traffic: 0.2, hazard: null }`.
  - Then run `node scripts/flight-expanse-fixture.mjs`, which rewrites `fixtures/expanse.json` with the three new row fields.

- [ ] **Step 4: Run them, and the lock**

Run: `npx vitest run src/lib/land/flight src/components/expanse/flight`
Expected: PASS. That includes `the roster`, `TERRAIN_VERSION` and `planets.test.js`’s `'makes the rows the fixture holds'`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/land/flight src/components/expanse/flight/planets.js src/components/expanse/flight/planets.test.js
git commit -m "Read planet and moon ids through the space address; only the fifty may be built on"
```

---

