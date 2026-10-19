### Task 11: Gates, the hand-off and the PR

**Files:**
- Modify: `docs/superpowers/HANDOFF-universe.md` ("Landed", "Left")
- Modify, only if it exists on `main` by now: `scripts/universe-endless-check.mjs`

- [ ] **Step 1: Bring `main` in with a merge** (never a rebase): `git fetch origin && git merge origin/main`.
  - If `scripts/universe-endless-check.mjs` has arrived (lane 2), call `shipOnChart(page)` after each of its steps and assert `drawn && inside`.
  - If it hasn't, the hand-off says so (Step 3).
- [ ] **Step 2: Run the gates.** Expected: all green, `health` within budget (`big-files`: `NavMap.jsx` and each new file under 800 lines; `kbd-styles` not up).
  - `npm run lint`
  - `npm test`
  - `npm run build`
  - `node scripts/health.mjs --check --skip build`
  - `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe`
- [ ] **Step 3: Update `HANDOFF-universe.md`.**
  - **"Landed"** gets a line for the chart: `src/components/universe/chart/`, `src/lib/gesture.js`, the nav map and mini-map on it, and `scripts/lib/navmap.mjs`.
  - **"Left"** loses the two map items this lane closed (the Citadel coordinates; the phone layout seen) and gains:
    - `nav.js`'s `chartAt`, `chartRadius`, `onChart` and `viewFor` are now unused by any component. Lane 6b, which owns `nav.js`, can retire them with their tests.
    - `where()`'s pilots and far fights carry no height, so they sit level with the ship. Lane 6b adds `y`.
    - The System level's traffic, and the Neighbourhood and Universe levels' generated places, events and visited systems, are lane 6b's, fed in as `Mark`s through `marks.js`.
    - The mini-map's `ship` prop waits for lane 4c's saved position (there is none with 3D off today).
    - `universe-endless-check.mjs`'s ship-marker step, if Step 1 couldn't add it.
- [ ] **Step 4: Commit and open the PR.**
  - The commit message is "Hand-off: the map's first half".
  - The PR body has the before and after table from the evidence README, the gates' results, the Interests chunk numbers, and the note that `galaxy/gesture.js` moved to `src/lib` with its test and no change for the galaxy (`galaxy-map-check` all ok).
  - Merge with a merge commit once CI is green.

---

## Self-review

- **Spec F coverage:**
  - The projection is pure and shared (Tasks 3 and 5, used in 8 and 9).
  - It is focus-centred with the ship by default (3, 6), on the 0.375 family re-centred (3).
  - Zoom by scroll, pinch and keys (2, 7, 10). Pan and re-centre (3, 7, 10).
  - 3D: looking down by default, stems with their sign, modifier and two-finger tilt and turn, one button back (2, 3, 7, 8, 10).
  - The ship's height and sector always on the chart (8, 10).
  - Levels, and labels thinned by priority (3, 4, 5, 6).
  - The ship's marker everywhere (3, 5, 8, 10).
  - Other pilots drawn (6, 8; at their x and z, level, until 6b).
  - The mini-map on the same projection and data, with wonders and moons and without the rings (9).
  - `navmap-check` picks by name (10). The phone layout is seen at 390 × 844 (10). The before shots come first (1).
  - Generated destinations, search, long trips and "nothing you can't go to" for generated places are lane 6b's, by the index plan.
- **Types:**
  - `Mark` is defined in Task 5 and produced in Task 6.
  - `View` is defined in Task 3.
  - `FRAMES.nav` and `FRAMES.mini` are used in Tasks 3, 5, 7, 8 and 9 under the same names.
  - `chartKey`'s actions (`zoomIn`, `zoomOut`, `back`) match the hook's `zoomIn`, `zoomOut` and `back`.
  - The `declutter` sides (`right`, `left`, `under`) match `navmap.css`'s `data-side`.
- **Review Focus:** each line's test is in its owning task: drag from a name (2, 10); typing (7, 10); no ship (6, 8, 9); degenerate numbers (3, 7); sideways phone (10).
