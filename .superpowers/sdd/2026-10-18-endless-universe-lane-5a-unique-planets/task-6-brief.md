### Task 6: The variety

**Files:**
- Create: `src/lib/land/flight/variety.js` and `src/lib/land/flight/variety.test.js`
- Modify: `src/lib/land/flight/fixtures/generated.js`. Add `randomSystems(planets, seed) → row[][]` and `lookupOf(rows) → (id) → row`.

**Interfaces:**
- Consumes: `familyOf`, `SEEDED_EXPANSE` and `TYPE_LOOK` (`planetTables.js`); `canonicalId`; `parseSpaceId`; `fold`; `hash64`; `seeded`; `CHARACTERS` and `TERRAIN`.
- Produces:
  - `FAMILIES[family] → { slots: [[hue°, lightness]…], sat: [lo, hi] }`. `ringed` uses `gas`’s.
  - `colourDistance([h1, l1], [h2, l2]) → hypot(Δh°/15, Δl/0.08)`, with Δh measured round the hue circle.
  - `dominantOf(palette, water = null) → [h°, l]`: the HSL of the mix of `low` and `high`, or of `water.colour` when given (an ocean’s).
  - `SLOT_JITTER = { hue: 2, light: 0.01 }`.
  - `varietyOf(row) → { family, dominant: [h, l], palette, water, character, sky, weather, flora, fauna, exotic, poiKinds }`, where:
    - `palette = { low, high, rock, accent, deep, skyLow, skyHigh }` (hex)
    - `water = { kind: 'sea' | 'lava', colour? } | null`
    - `character = { kind, sea, peaks } | null`
    - `sky = { low, high, haze, clouds, cloudColour, rings: Boolean(row.rings), moons: row.moons ?? 0 }`
    - `weather = { kind, amount }`
    - `flora = { family, density, pick } | null`, with `pick` in 0…1 choosing a tree in Task 9
    - `fauna = { density, plans: [{ body, role, tint, group }] } | null`
    - `exotic = null | 'crystal' | 'glowing' | 'floating' | 'spires'`
    - `poiKinds` is from `'ruins' | 'wreck' | 'outpost' | 'monolith' | 'signal'`, 0–3 of them.

**Rules that decide what the tests check:**

- **Streams.** Each aspect draws from its own stream, `seeded(fold(BigInt(row.seed)) ^ SALT[aspect])`, with a fixed salt for each aspect. Adding an aspect then never moves another.
- **The palette slot.** A planet’s dominant colour is a slot of its family, with no sibling rows read. That way the result is a function of the row alone (Review Focus 3).
  - The system key is the id without its last part; a moon’s key is its parent.
  - The index is the id’s last number, `j` (or `k` for a moon).
  - `perm` is a seeded shuffle of the family’s slot indices, seeded by `hash64('slots', systemKey)`. The slot is `slots[perm[index]]`, nudged by a jitter of up to `SLOT_JITTER` from the planet’s own stream.
  - Two siblings of one family get different slots, because their indices differ.
  - Siblings of different families stay apart because the table keeps every family’s slots apart (the first test).
  - **In a system with seeded planets** (sector (1, 0)’s systems 0–2), seeded siblings take the first indices, 0…s−1.
    - The slot list is the family’s slots that sit at least `1 + 2·jitter` from every seeded sibling’s template colour (`dominantOf(TYPE_LOOK[type].palette)`).
    - The index is `j − s`.
    - This still needs no sibling rows: `SEEDED_EXPANSE` names the seeded planets and their types.
- **The dominant colour** is `dominantOf`’s: the mix of `low` and `high`, or an ocean planet’s water colour.
- **The slot table** (starting values; the first test holds the property):

| family | hues (°) | lightness | saturation |
|---|---|---|---|
| lava | 335, 0, 25, 50 | 0.10, 0.21 | 0.15–0.35 |
| rock | 335, 0, 25, 50 | 0.33, 0.45 | 0.10–0.45 |
| desert | 20, 42, 64 | 0.58, 0.70, 0.82 | 0.35–0.60 |
| forest | 85, 108, 131, 154 | 0.26, 0.38 | 0.30–0.55 |
| ocean (its water) | 178, 200, 222, 244 | 0.28, 0.40 | 0.40–0.70 |
| ice | 178, 200, 222, 244 | 0.80, 0.92 | 0.15–0.45 |
| gas (and ringed) | 266, 289, 312 at 0.55 and 0.67; 20, 42 at 0.94 | | 0.25–0.55 |

- **The palette from the slot `(h, s, l)`.**
  - `low` is `hsl(h, s, l − 0.05)`; `high` is `hsl(h + 6, 0.9s, l + 0.05)`; `deep` is `hsl(h, s, 0.7l)`; `rock` is `hsl(h + 10, 0.6s, 0.6l)`.
  - `accent` depends on the family:
    - lava: `hsl(15–35, 1, 0.55)`
    - forest: `hsl(h + 25, s + 0.1, l + 0.12)`
    - desert: `hsl(h − 12, s, l − 0.1)`
    - rock: `hsl(h + 15, s, l + 0.15)`
    - ice: `hsl(h, s, l − 0.08)`
    - gas: `hsl(h + 40, s, l)`
    - ocean: its sand is `low` and `high` drawn from desert’s range, and its accent is the water.
- **Water.** ocean: `'sea'` with `colour` the slot. forest: `'sea'` with `colour` from `hsl(195–215, 0.45, 0.3)`. lava: `'lava'`. Others: null.
- **Character weights by family.** gas and ringed have none. `sea` and `peaks` are drawn from `TERRAIN`.
  - rock: craters 3, mesas 2, canyons 2, ridges 1, plateaus 1
  - ice: ridges 2, plateaus 2, continents 2, craters 1
  - desert: dunes 3, mesas 2, canyons 2, plateaus 1
  - forest: continents 3, ridges 1, plateaus 1, archipelago 1
  - lava: ridges 2, craters 2, canyons 1, continents 1
  - ocean: archipelago 3, continents 2
- **Sky** (its hue, `skyLow` as L/S, `skyHigh` as L/S, haze, clouds):
  - ice: 195–215, .88/.3, .62/.45, .1–.4, .2–.5
  - desert: 200–215, .82/.45, .58/.5, .2–.5, 0–.2
  - forest: 190–210, .86/.35, .55/.55, .1–.35, .3–.7
  - ocean: 185–205, .88/.35, .55/.6, .1–.3, .4–.8
  - lava: 10–25, .32/.55, .1/.5, .6–.9, .1–.3
  - rock: the ground’s hue ± 15, .7/.25, .4/.3, .2–.5, 0–.1
  - gas: the dominant hue + 20, .85/.4, .6/.5, .4–.7, .7–1
  - `palette.skyLow` and `skyHigh` are the sky’s.
  - `cloudColour`: `#f2f4f6` (ice, forest, ocean), `#5a5048` (lava), `#d8c4a0` (desert, rock), `palette.high` (gas).
- **Weather weights** (amount 0.2–1):
  - ice: snow 3, none 2
  - desert: dust 3, none 2
  - lava: ash 4, none 1
  - forest: rain 3, spores 1, none 2
  - ocean: rain 3, none 2
  - rock: dust 1, none 3
  - gas: none
  - An exotic `glowing` planet has spores.
- **Flora families and density.**
  - forest: forest 0.8–1.6 or temperate 0.6–1.2, evenly
  - ocean: ocean 0.4–1
  - desert: desert 0.1–0.5
  - ice: ice 0–0.3
  - lava: volcanic 0–0.3
  - rock: desert 0–0.2
  - gas: null
- **Fauna density.** ice 0.3–1, desert 0.2–0.8, forest 0.6–1.4, ocean 0.4–1. rock: 0 four times in five, else 0.2–0.5. lava: 0 nine times in ten, else 0.2–0.4. gas: null.
  - A planet has 1–3 plans, each a different body: `beast` (herd, [4, 8]), `flyer` (flock, [4, 8]) or `walker` (wander, [1, 3]).
  - A plan’s tint is the palette’s `rock` or `accent`.
- **Exotic.** A planet is exotic when its exotic stream draws under 0.05; the four kinds are equally likely.
- **POIs.** The count weights are 0: 1, 1: 3, 2: 3, 3: 2. gas and ringed have none.
  - Kind weights: ruins 3, wreck 2, outpost 2, monolith 1, signal 2.
  - A held system (one with a faction) doubles the outpost’s weight, and pirates double the wreck’s.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, expect, it } from 'vitest';
import { CHARACTERS } from './characters';
import { FAMILIES, SLOT_JITTER, colourDistance, dominantOf, varietyOf } from './variety';
import { SEEDED_EXPANSE, TYPE_LOOK } from './planetTables';
import { randomSystems } from './fixtures/generated';

const templateDominant = (type) => dominantOf(TYPE_LOOK[type].palette);

describe('the palette slots', () => {
  it('keep every slot of every family apart, jitter and all, within a family and across', () => {
    const all = Object.entries(FAMILIES).filter(([f]) => f !== 'ringed').flatMap(([f, { slots }]) => slots.map((s) => [f, s]));
    const gap = 1 + 2 * Math.hypot(SLOT_JITTER.hue / 15, SLOT_JITTER.light / 0.08);
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(colourDistance(all[i][1], all[j][1]), `${all[i][0]} ${all[i][1]} · ${all[j][0]} ${all[j][1]}`).toBeGreaterThanOrEqual(gap);
    for (const { slots } of Object.values(FAMILIES)) expect(slots.length).toBeGreaterThanOrEqual(8);
  });
});

describe('varietyOf', () => {
  const systems = randomSystems(500, 1);

  it('gives every pair of siblings a hue and lightness distance of at least 1 (500 planets)', () => {
    expect(systems.flat().length).toBeGreaterThanOrEqual(500);
    for (const rows of systems) {
      const v = rows.map(varietyOf);
      for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) expect(colourDistance(v[i].dominant, v[j].dominant), `${rows[i].id} ${rows[j].id}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('keeps a generated planet clear of its seeded siblings', () => {
    const seededIn = (sys) => SEEDED_EXPANSE.filter(([id]) => id.startsWith(`${sys}:`));
    for (const sys of ['e:1,0:1', 'e:1,0:2']) for (let j = 3; j < 7; j++) for (const type of ['rock', 'ice', 'desert', 'forest', 'lava', 'ocean', 'gas']) {
      const v = varietyOf({ id: `${sys}:${j}`, name: 'X', type, seed: String(1000n + BigInt(j)), system: { faction: null, traffic: 0, hazard: null } });
      for (const [id, t] of seededIn(sys)) expect(colourDistance(v.dominant, templateDominant(t)), `${sys}:${j} ${type} · ${id}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('is the planet’s alone: the same row gives the same variety, with no sibling read', () => {
    const row = systems[3][0];
    expect(varietyOf({ ...row })).toEqual(varietyOf(row));
    expect(varietyOf.length).toBe(1);
  });

  it('keeps each type in its family', () => {
    for (const row of systems.flat()) {
      const v = varietyOf(row);
      const box = FAMILIES[v.family].slots;
      expect(box.some((s) => colourDistance(s, v.dominant) <= Math.hypot(SLOT_JITTER.hue / 15, SLOT_JITTER.light / 0.08) + 1e-9), row.id).toBe(true);
    }
  });

  it('spreads the kinds: every character, weather, POI kind and flora family shows; about one in twenty is exotic', () => {
    const v = randomSystems(2000, 2).flat().map(varietyOf);
    const seen = (f) => new Set(v.map(f).flat().filter(Boolean));
    expect([...seen((x) => x.character?.kind)].sort()).toEqual([...CHARACTERS].sort());
    for (const w of ['none', 'rain', 'snow', 'dust', 'ash', 'spores']) expect(seen((x) => x.weather.kind).has(w), w).toBe(true);
    for (const k of ['ruins', 'wreck', 'outpost', 'monolith', 'signal']) expect(seen((x) => x.poiKinds).has(k), k).toBe(true);
    for (const f of ['forest', 'temperate', 'desert', 'ice', 'ocean', 'volcanic']) expect(seen((x) => x.flora?.family).has(f), f).toBe(true);
    const share = v.filter((x) => x.exotic).length / v.length;
    expect(share).toBeGreaterThan(0.03);
    expect(share).toBeLessThan(0.07);
  });

  it('takes a moon as its family, its siblings by moon index', () => {
    const moon = (k, type) => varietyOf({ id: `e:3,-2:1:0:${k}`, name: 'M', type, seed: String(77n + BigInt(k)), parent: 'e:3,-2:1:0' });
    expect(moon(0, 'rocky').family).toBe('rock');
    expect(moon(1, 'icy').family).toBe('ice');
    expect(colourDistance(moon(0, 'rocky').dominant, moon(1, 'rocky').dominant)).toBeGreaterThanOrEqual(1);
  });
});
```

`randomSystems(planets, seed)` builds systems until there are `planets` rows. Each system:
- is in a seeded sector with x and z in −40…40, never (1, 0) or (0, 0)
- has a system index 0–23 and 1–7 planets with indices `0…n−1`
- draws each planet’s type with the generator’s weights: rock 5, ice 3, gas 3, lava 1.5, ocean 1.5, desert 2, forest 1, ringed 1
- gives each planet a seed (a string bigint), a radius within its type’s range (`expanse/gen/tables.js:25-90`), moons 0–3, rings at 5 %
- gives each planet `system: { faction: null | { id: 'empire' }, traffic: 0…1, hazard: null | 'pirates' }`

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/land/flight/variety.test.js`
Expected: FAIL, `Failed to resolve import "./variety"`.

- [ ] **Step 3: Build `variety.js` and the fixture by the rules above**

If the slot test fails, move the slot the message names; don’t move the threshold.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/lib/land/flight/variety.test.js`
Expected: PASS, under a second.

- [ ] **Step 5: Commit**

```bash
git add src/lib/land/flight/variety.js src/lib/land/flight/variety.test.js src/lib/land/flight/fixtures/generated.js
git commit -m "Give each generated planet its own colours, land, sky, weather, life and places"
```

---

