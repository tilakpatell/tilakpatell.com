### Task 13: The contact sheet

**Files:**
- Create: `scripts/planet-contact-sheet.mjs`
- Modify: `scripts/lib/flight-island.mjs:26-46`. Add `'scripts/planet-contact-sheet.mjs'` to `ISLAND.files`, so it goes when the flight goes.

**Interfaces:**
- Consumes: the modules below, loaded through Vite SSR as `scripts/flight-expanse-fixture.mjs:14-23` does:
  - `/src/components/expanse/flight/planets.js` (`planetSpecOf`)
  - `/src/components/expanse/gen/sector.js` (`makeSector`) and `/src/components/expanse/gen/seed.js` (`UNIVERSE`)
  - `/src/lib/land/flight/orbitMap.js` (`bakeOrbitMap`, `groundColour`) and `/src/lib/land/flight/field.js` (`planetField`)
  - `/src/lib/seeded.js`
  - sharp
- Produces: `node scripts/planet-contact-sheet.mjs [--count 24] [--seed 1] [--out lab/planets/contact]`, which works like this:
  - **Choosing.** A seeded draw picks a sector with x and z in −30…30, never (0, 0) or (1, 0), then a system and a planet. It keeps types rock, ice, desert, forest, lava and ocean, skips the roster and repeats, and stops at `count`.
  - **For each planet:**
    - `n-orbit.png`: `bakeOrbitMap(spec, { width: 512, height: 256 })`.
    - `n-ground.png`: 384 × 384 px, the chart’s middle 3 km square at 8 m a pixel. The colour is `groundColour` × `(0.55 + 0.45 × max(0, normal · sun))`, with the sun from the north-west, 40° up.
  - **The sheet.** `sheet.png` has 6 columns × 4 rows. Each tile is the orbit map at 384 × 192 over the ground, with an SVG caption: name, type, character and exotic.
  - **The index.** `index.json` lists `[{ n, id, name, type, character, exotic, weather, sky }]`.
  - It prints the folder. It exits 1 if it found fewer than `count` planets.
  - `lab/*` is git-ignored (`.gitignore`, “the contact sheets the model scripts write for looking over”), so nothing it writes is committed.

- [ ] **Step 1: Write the script, with a header in the house style: what, how to run, and where it writes**

- [ ] **Step 2: Run it**

Run: `node scripts/planet-contact-sheet.mjs`
Expected: prints `lab/planets/contact: 24 planets`. The folder holds 24 `-orbit.png`, 24 `-ground.png`, `sheet.png` and `index.json`.

- [ ] **Step 3: Look at the sheet**

Open `lab/planets/contact/sheet.png` (the Read tool shows it). Check four things:
- No two tiles of one system read as one planet recoloured.
- Every orbit map shows land, and sea where the type has it.
- No ground is a flat, featureless plane.
- The orbit map’s colours are the ground’s.

Where one fails, tune `TERRAIN`, `CLIMATE_SPHERE` or the variety’s tables in their own task’s test, then run again.

- [ ] **Step 4: Check the island**

Run: `node scripts/flight-island.mjs --check && npx vitest run scripts/flight-island.test.mjs scripts/lib/flight-island.test.mjs`
Expected: `ok   <n> files on the island, …`, then PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/planet-contact-sheet.mjs scripts/lib/flight-island.mjs
git commit -m "Add a contact sheet of 24 generated planets, from orbit and on the ground"
```

---

