### Task 9: The pose carries its sector in 3D

**Files:**
- Modify:
  - `src/components/universe/online/protocol.js`:
    - `:30-31` (the doc)
    - `:78` (imports: Task 0's `parseSectorKey` and `sectorCentre`)
    - `:206-247` (`writePose`, `readPose`)
    - `:264` (`readShot`'s bound)
  - `src/components/universe/online/rosterWhere.js:12-50`
- Test: `protocol.test.js`, `rosterWhere.test.js`

**Interfaces:**
- Produces:
  - **`writePose`:**
    - when `sectorOf` gives an `E:` key, x, y and z are written from that sector's centre, and the key goes at `[10]`
    - on the middle layer the key is `'E:sx,sz'` and the centre's y is 0, so an older reader reads it exactly as before
  - **`readPose`:**
    - parses `[10]` with `parseSectorKey`, accepting either case and 2 or 3 numbers
    - clamps x, y and z to `±SEC_FAR` (62,000) of the sector's centre
    - a sectorless pose clamps x and z to `±FAR` and y to `±SEC_FAR`; the ±1,300 clamp is gone
    - `sec` comes back in `sectorKey` form
  - **`readShot`:** positions are bounded by ±1e12. The `from` check already holds a shot to its pilot. This fixes other pilots' shots past 90,000 being dropped.
  - **`rosterWhere`:** names the nearest system of `fullSector(SHARED, …parseSectorKey(sec), { things: false })` by 3D distance, within 12,000, keeping 16 sectors.

- [ ] **Step 1: Write the failing tests.**
  - **Replace** `protocol.test.js:174`'s `toBe(1300)` with `toBe(62000)`. The spec removes the clamp; say so in the PR.
  - **Add:**
    - `writePose({ ...ship, x: 185184.78, y: 70000, z: -121500 })[10]` is `'E:2,-1,1'`, with `[1]` close to `-50000`. Reading it back gives `y` close to `70000` and `sec` of `'E:2,-1,1'`.
    - A sectorless pose at y = 50,000 round-trips to 50,000 with no `sec`.
    - An older build's `[1, 2, 3, 0, 0, 0, 5, 0, 2, 100, 'E:2,-1']` reads `x: 240001, y: 2, z: -119997`, as today.
    - `'E:1,0,x'` and `'X:1,0'` read as no sector.
    - `readShot([500000, 0, 0, 1, 0, 0], { x: 500000, y: 0, z: 0, speed: 0 })` reads. A shot 1,000 from that pose doesn't.
  - **Add to `rosterWhere.test.js`:** a pose with `sec: 'E:1,0,1'` at the first system of `fullSector(SHARED, 1, 1, 0)` plus 50 names that system.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/online`. Expected: the new and replaced tests FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Poses carry their sector in 3D; the height clamp goes; old poses read as before"`
- [ ] **Step 6: Run PR 2.2's gate.** Run `node scripts/online-check.mjs --fake` and `node scripts/navmap-check.mjs` (expected: as on `main`). Open PR "Endless universe 2.2: no ceilings, and poses in 3D" and merge.

---

## PR 2.3: Camera-relative always

