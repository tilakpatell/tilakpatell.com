### Task 11: After, the numbers, the hand-off

**Files:**
- Modify: `docs/superpowers/evidence/endless-lane1/README.md` (the after numbers beside the before)
- Create: `docs/superpowers/evidence/endless-lane1/after-*.json` and `after-*.webp`
- Modify: `lab/universe/baseline/{high,mid,low}.json`: add the `in-nebula` key only
- Create: `lab/universe/baseline/{high,mid,low}/in-nebula.webp`
- Modify: `docs/superpowers/HANDOFF-universe.md` ("Landed" and "Left")

**Interfaces:**
- Consumes: everything above.
- Produces: the PR.

- [ ] **Step 1: The repo's gates.** Run:

```bash
npm run lint
npm test
npm run build
node scripts/health.mjs --check --skip build
```

Expected:
- All green.
- `glsl-sites` ≤ 607 and `big-files` ≤ 30.
- `scene.js` at least 15 lines shorter than 6226 (say the number).

- [ ] **Step 2: The poses after.** Run `node scripts/universe-check.mjs --quality <tier> --out lab/universe/lane1-after/<tier>` for high, mid and low. Expected, at each tier:
- For the ten baseline poses and the other four, `calls` and `triangles` are ≤ Task 1's own.
- Copy `in-nebula`'s entry and shot into `lab/universe/baseline/`. It is new, so it becomes the baseline (spec H).
- **A pose over its before is a stop.** Name what drew more, from `renderer.info` with the nebula group hidden through `__universeDebug.scene`, and fix it in its task.
  - This plan's accounting is: the sparks' `Points` gone (−1 call where it was drawn), one cloud draw (+1 where a cloud is in view), and the landmark draw 10 → 8 instances (−4 triangles) against 2 a far cloud.
  - A pose that still comes out over is reported to the owner in the PR, never merged as is.
- [ ] **Step 3: Frame time.** Run `perf-probe universe` at mid and low, as in Task 1. Expected: p50 and p95 within Task 1's measured spread of the before.
- [ ] **Step 4: Pictures.** Run:

```bash
node scripts/autopilot-check.mjs --routes /universe --shots endless-lane1
node scripts/autopilot-check.mjs --skip lint,test,build --routes /galaxy --shots endless-lane1-galaxy
```

Expected:
- `/galaxy`'s after has no changed pixel against its before (`sharp`: raw buffers equal). A changed pixel means Task 6 is wrong.
- `/universe`'s after goes beside its before in the evidence folder.
- [ ] **Step 5: Smoke and the other checks.** Run:

```bash
node scripts/autopilot-check.mjs --only smoke --routes /universe,/fly
node scripts/landing-check.mjs
node scripts/nebula-check.mjs --url <dev server>
```

Expected: all exit 0. The landmarks are drawn on foot, so the landing check matters.
- [ ] **Step 6: The hand-off.** Update `HANDOFF-universe.md`:
  - **"Landed":**
    - `nebula/` and its API
    - `NEBULAE`
    - the sky's `clouds` option
    - `mapSky.js`
    - the two poses
    - `nebula-check.mjs`
  - **"Left":**
    - `nebula/budget.js` waits for lane 2's `universe/budget.js`.
    - The pace's steps don't yet lower the nebula's steps. That's one `setLevel` in `paceTo`, `scene.js:4980-4992`, outside this lane's lines.
    - `farStars` specks are still fixed-size points: true in direction, no angular size. Gargantuans (lane 4a) should take `placement()` for their true angle.
    - The nebula step in `universe-endless-check.mjs`, if it wasn't there to add.
    - A cloud with something solid inside it fogs that thing by its whole chord, not just the part in front. The scene's depth is the post's, and `post.js` is shared.
    - `palette.js:9`'s comment still names landmarks.js as painting the Veil.
- [ ] **Step 7: Commit and open the PR.**
  - Commit: `git add docs/superpowers lab/universe/baseline`, then `git commit -m "Nebulae lane: the after numbers and the hand-off"`.
  - Push `claude/endless-lane1-nebulae`.
  - Open the PR against `main` with:
    - the numbers table: ten poses × three tiers, calls and triangles, before and after
    - `in-nebula`'s new numbers
    - the frame times
    - `scene.js`'s line count before and after
    - the texture memory the volume replaced
    - the before and after shots
    - the nebula-check report
  - Merge with a merge commit once CI is green.
