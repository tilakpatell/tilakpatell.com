### Task 9: Life and places from the variety

**Files:**
- Modify: `src/lib/land/flight/lifeTables.js:369-406`. Make it `expanseLife(type, biomes, system, fauna = null)`, and have `lifeFor` pass `spec.fauna ?? null`.
- Modify: `src/lib/land/flight/landmarkTables.js`. Add `POI_KITS`, `FLORA_TRUNKS`, `EXOTIC_KIT` and `landmarkRowsOf` after `LANDMARKS` (126); `clutterKitOf` (222-224) reads `spec.flora` and `spec.exotic`.
- Modify: `src/components/expanse/flight/landmarks.js:146`. It becomes `const rows = landmarkRowsOf(spec, poi);`.
- Test: `lifeTables.test.js`, `landmarkTables.test.js`, `src/components/expanse/flight/landmarks.test.js`

**Interfaces:**
- Consumes: the spec’s `fauna`, `flora`, `exotic` and `pois[].kind` (Task 8).
- Produces:
  - **`expanseLife` with a `fauna` argument.** When `fauna` is given (not null), it replaces the `FAUNA[type]` row (line 392):
    - Each plan is `gnd({ beast: 'grazer', flyer: 'skimmer', walker: 'strider' }[body], role, 0.3 × fauna.density, group, { body, tint, kind: 'wild', ...(body === 'flyer' ? { alt: [6, 50] } : {}) })`.
    - With `density` 0 there are no fauna rows.
    - Rows for factions and pirates are as today.
  - **`POI_KITS[kind] → rows`.** Rows use `one` and `ring`, with only the kinds and kit models `LANDMARKS` already uses, and at least `LANDMARK_MIN` rows each:
    - **ruins:** `one('ruins')`, `one('stonehead', [30, 10], 2.4)`, `one('ruins', [-40, 22], 0.7)`, `one('stonehead', [-12, -34], 0.9, 0.7)`
    - **wreck:** `{ ...one(k('Spaceship_RaeTheRedPanda'), [0, 0], 0.6, 4), pitch: 0.35, roll: -0.5 }`, `one('crates', [18, 6], 0.4)`, `one('barrel', [-14, 10])`, `one('fire', [8, -14])`
    - **outpost:** `base(36)`
    - **monolith:** `one(k('MetalSupport'), [0, 0], 0, 9)`, `...ring(k('Rock_Large_1'), 5, 26, 1.2)`
    - **signal:** `one(k('Roof_Radar'), [0, 0], 0, 5)`, `one(k('Roof_Antenna'), [12, 4], 0.5, 5)`, `one(k('SolarPanel_Ground'), [-14, 6], 0.4, 3)`, `...ring('lamp', 3, 20)`
  - **`FLORA_TRUNKS`.** The four green trees already in the tables: `GiantPine_2` 4.6, `GiantPine_4` 4.8, `GiantPine_5` 5 and `CommonTree_3` 5 (from the naturemega kit).
  - **`EXOTIC_KIT`:**
    - `glowing: { trunk: Tree_Light_1, size 3 }`
    - `floating: { trunk: Tree_Floating_1, size 3 }`
    - `spires: { spire: Tree_Spikes_2, size 1.4 }`
    - `crystal: {}` (crystal is the code-built clutter kind)
    - All are from the space kit.
  - `landmarkRowsOf(spec, poi) → rows | undefined`: `LANDMARKS[spec?.id]?.[poi?.id] ?? POI_KITS[poi?.kind]`.
  - **`clutterKitOf(spec)`.** It’s today’s two tables, then `{ trunk: FLORA_TRUNKS[floor(pick × 4)] }` when `spec.flora?.family` is forest or temperate, then `EXOTIC_KIT[spec.exotic]`.

- [ ] **Step 1: Write the failing tests**

In `lifeTables.test.js`:
- `'lets a generated planet’s fauna walk it, scaled by its density'`. Call `expanseLife('forest', biomes, { faction: null, traffic: 0, hazard: null }, { density: 1, plans: [{ body: 'beast', role: 'herd', tint: '#806040', group: [4, 8] }, { body: 'flyer', role: 'flock', tint: '#c0c0c0', group: [4, 8] }] })`. Its `ground` has two rows: `model: 'figure'`, `perKm2: 0.3`, the bodies in order, and `alt` on the flyer.
- `'has no wild rows with no fauna'`: with `{ density: 0, plans: [...] }`, `ground` has no `kind: 'wild'` row.

In `landmarkTables.test.js`:
- Extend `'names only kit models the kits have, and no rig'`’s `named` list with `POI_KITS`’ kit rows and with `FLORA_TRUNKS` and `EXOTIC_KIT` values. Keep `'dresses the ground only in trees with green leaves'` as it is; `EXOTIC_KIT` isn’t green on purpose and isn’t in it.
- Add `'stands every generated POI kind on at least LANDMARK_MIN things'`.
- Add `'gives a generated planet a tree from its flora, and an exotic one its own'`. For `clutterKitOf({ id: 'e:3,-2:0:1', type: 'forest', flora: { family: 'forest', pick: 0.6 } })`, `trunk.name` is `'GiantPine_5'`. With `exotic: 'glowing'` as well, `trunk.name` is `'Tree_Light_1'`.
- Add `'reads a generated POI’s rows by its kind, a named one by its id'`.

In `landmarks.test.js`, add `'stands a generated POI from its kind’s list'`. `placementsFor({ id: 'e:3,-2:1:0', type: 'rock' }, { id: 'poi-0', kind: 'outpost', at: [100, 200], r: 80 }, { heightAt: () => 5 }).list.length` is at least 3.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/land/flight/lifeTables.test.js src/lib/land/flight/landmarkTables.test.js src/components/expanse/flight/landmarks.test.js`
Expected: FAIL. The fourth argument is ignored, and `POI_KITS` and `landmarkRowsOf` are missing.

- [ ] **Step 3: Implement the tables and the readers**

- [ ] **Step 4: Run the flight’s tests, and the lock**

Run: `npx vitest run src/lib/land/flight src/components/expanse/flight`
Expected: PASS. `the roster` passes because the 50 have `fauna`, `flora` and `exotic` null, and `planets.test.js:45-51` still sees the seeded life as it was.

- [ ] **Step 5: Commit**

```bash
git add src/lib/land/flight/lifeTables.js src/lib/land/flight/lifeTables.test.js src/lib/land/flight/landmarkTables.js src/lib/land/flight/landmarkTables.test.js src/components/expanse/flight/landmarks.js src/components/expanse/flight/landmarks.test.js
git commit -m "Let a generated planet's fauna, trees and places come from its variety"
```

---

