### Task 7: Sector keys in 3D, and the pocket as a ball

**Files:**
- Modify: `src/components/universe/layout.js:61-76` (`sectorOf`, `expanseSector`), `src/components/universe/layout.test.js`

**Interfaces:**
- Consumes: Task 0's `sectorAt`, `sectorKey`, `parseSectorKey` and `sectorCentre`.
- Produces: `sectorOf(x, y, z)`:
  - `'rickmorty'` when within `RM.edge + 1` of the pocket's origin in 3D (with `z < SECTOR_SPLIT`, as now)
  - `'main'` when in sector `0,0,0` and within the main edge on the level, as now
  - otherwise `sectorKey(...sectorAt(x, y, z))`

  `sectorById` reads 3-number keys through `parseSectorKey`. `inExpanse`, `mapSectorOf` and `sectorOut` keep their signatures.

- [ ] **Step 1: Add the failing tests** to `layout.test.js` (every existing assertion stays):
  - `sectorOf(0, 70000, 0)` is `'E:0,0,1'`, and `sectorOf(0, 50000, 0)` is `'main'`.
  - `sectorOf(0, 5000, -66000)` is `'rickmorty'`, `sectorOf(0, 6500, -66000)` is `'E:0,-1'`, and `sectorOf(4500, 4500, -66000)` is `'E:0,-1'`.
  - `sectorById('E:1,-2,3').origin` is `[120000, 360000, -240000]`.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/layout.test.js src/components/universe/sector.test.js`. Expected: the new assertions FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Sectors keyed in 3D; the Rick and Morty pocket a ball"`

