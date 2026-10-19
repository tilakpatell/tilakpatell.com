### Task 1: Fingerprint today's middle layer; grid over the address

**Files:**
- Create: `src/components/expanse/gen/fixtures/fingerprint.js` (the projection and the sector list), `src/components/expanse/gen/fixtures/fingerprint.json` (written once, from unchanged code), `src/components/expanse/gen/fingerprint.test.js`
- Modify: `src/components/expanse/gen/grid.js:1-24`

**Interfaces:**
- Consumes: Task 0's `SECTOR`, `sectorAt`, `sectorCentre`, `sectorKey` from `src/lib/space/address.js`.
- Produces:
  - `PRINTED`: the 25 `[sx, sz]`
  - `plainSector(sector, { systems?, wonders? }) → object`: today's fields only, bigints as strings, cut to the first `systems` systems and `wonders` wonders
  - `digest(plain) → hex sha256`
  - `grid.js` keeps `SECTOR`, `sectorAt(x, z)`, `sectorId`, `parseSector` and `sectorCentre(sx, sz)` with today's results

- [ ] **Step 1: Write the fixture module and the test.** `fixtures/fingerprint.js` exports:
  - `PRINTED = [[1,0],[0,1],[-1,0],[0,-1],[1,1],[0,0],[1,-1],[-1,1],[-1,-1],[2,0],[0,2],[-2,0],[0,-2],[2,-1],[3,-2],[1,2],[5,5],[-3,-6],[7,-9],[-7,4],[12,0],[0,-12],[100,3],[-40,17],[250,-250]]`. The first five are `flight/planets.js:23`'s SECTORS, where the 13 seeded planets come from.
  - `plainSector`, which picks these fields in this order:
    - the sector: `id, sx, sz, seed, origin`
    - each system: `id, i, name, designation, at, seed, culture, star, faction, traffic, hazard`, and its `planets`
    - each planet: `id, name, type, radius, color, at, orbit, moons, rings, seed`
    - each wonder: `id, kind, name, at, size, seed`
    - `beacons` `n, e, s, w`
  - `digest`, using `node:crypto`.

```js
// fingerprint.test.js
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRINTED, digest, plainSector } from './fixtures/fingerprint';
import { makeSector } from './sector';
import { UNIVERSE } from './seed';

const FILE = new URL('./fixtures/fingerprint.json', import.meta.url);
const today = () => Object.fromEntries(PRINTED.map(([sx, sz]) => {
  const s = makeSector(UNIVERSE, sx, sz);
  return [s.id, { systems: s.systems.length, wonders: s.wonders.length, sha256: digest(plainSector(s)) }];
}));

describe('the middle layer, fingerprinted', () => {
  it('pins 25 sectors, the seeded planets’ five first', () => {
    expect(PRINTED).toHaveLength(25);
    expect(PRINTED.slice(0, 5)).toEqual([[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1]]);
  });
  it('makeSector makes today’s sectors, field for field', () => {
    // (written once, from the generator as it was on main; never rewritten)
    if (!existsSync(FILE) && process.env.FINGERPRINT_WRITE) writeFileSync(FILE, `${JSON.stringify(today(), null, 2)}\n`);
    expect(today()).toEqual(JSON.parse(readFileSync(FILE, 'utf8')));
  });
});
```

- [ ] **Step 2: Run it and see it fail.** Run `npx vitest run src/components/expanse/gen/fingerprint.test.js`. Expected: FAIL with ENOENT, because there is no fixture yet.
- [ ] **Step 3: Write the fixture from today's generator.** The generator files must be untouched when you do this. Run `FINGERPRINT_WRITE=1 npx vitest run src/components/expanse/gen/fingerprint.test.js`, then the same command without the variable. Expected: PASS, 2 tests. The JSON has 25 keys, and `E:0,0` shows `systems: 0`.
- [ ] **Step 4: Rewrite `grid.js` as wrappers.**
  - `SECTOR` is re-exported from the address module.
  - `sectorAt(x, z)` is `[sx, sz]` of `sectorAt(x, 0, z)`.
  - `sectorId(sx, sz)` is `sectorKey(sx, 0, sz)`.
  - `sectorCentre(sx, sz)` is `sectorCentre(sx, 0, sz)`.
  - `parseSector` keeps its own strict regex: only 2-number keys with an upper-case `E:`, as `grid.test.js:23-36` demands.
- [ ] **Step 5: Run the grid and fingerprint tests.** Run `npx vitest run src/components/expanse/gen`. Expected: PASS, with `grid.test.js` unchanged.
- [ ] **Step 6: Commit.** `git commit -m "Fingerprint the Expanse's middle layer; grid over the shared address"`

