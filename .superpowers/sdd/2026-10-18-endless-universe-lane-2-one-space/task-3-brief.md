### Task 3: Keep-outs

**Files:**
- Create: `src/components/expanse/gen/keepOuts.js`, `src/components/expanse/gen/keepOuts.test.js`

**Interfaces:**
- Consumes: `PLACES` (`universe/deep.js:266`), `SECTORS`, `SECTOR_RADIUS`, `sectorOf` (`universe/layout.js`).
- Produces:
  - `HOME_KEEP = 8000`
  - `KEEP_OUTS: [{ id, at, r }]`
  - `keepOutsNear(sx, sy, sz) → KEEP_OUTS` rows whose sphere meets that sector's cube
  - `clearOfKeepOuts(at, extent, outs = KEEP_OUTS) → boolean`: true when every distance from `at` to a sphere's centre is at least `r + extent`

- [ ] **Step 1: Write the failing tests.**
  - `KEEP_OUTS[0]` is `{ id: 'home', at: [0, 0, 0], r: 8000 }`.
  - Every `PLACES` row with `kind !== 'station'` and `sectorOf(...at) === 'main'` has a row with `r === 3 * reach`.
  - One row `{ id: 'rickmorty', at: SECTORS.rickmorty.origin, r: SECTOR_RADIUS.rickmorty + 4000 }`.
  - No row for a station or for a place inside the pocket.
  - `keepOutsNear(0,0,0)` includes `home`. `keepOutsNear(0,0,-1)` includes `rickmorty`. `keepOutsNear(5,0,5)` and `keepOutsNear(0,2,0)` are `[]`.
  - `clearOfKeepOuts([0,0,8040], 50)` is false, and `clearOfKeepOuts([0,0,8100], 50)` is true.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/expanse/gen/keepOuts.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** A sphere meets a cube when its distance to the cube's nearest point is at most `r`.
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Keep-outs round the hand-made places, as spheres"`

