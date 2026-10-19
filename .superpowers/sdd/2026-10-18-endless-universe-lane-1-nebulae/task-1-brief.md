### Task 1: Before, on `main`

The owner's rule: the before shots and numbers come from `main`, before any picture changes.

**Files:**
- Create: `docs/superpowers/evidence/endless-lane1/README.md` (the numbers table, filled in Task 11)
- Create: `docs/superpowers/evidence/endless-lane1/before-{high,mid,low}.json`
- Create: `docs/superpowers/evidence/endless-lane1/before-universe.webp`
- Create: `docs/superpowers/evidence/endless-lane1/before-galaxy.webp`
- Create: `docs/superpowers/evidence/endless-lane1/before-perf-{mid,low}.json`

**Interfaces:**
- Consumes: nothing.
- Produces: the before numbers every later comparison reads.

- [ ] **Step 1: Branch from `main`** after the index plan's Task 0 has merged:

```bash
git fetch origin main
git switch -c claude/endless-lane1-nebulae origin/main
```

- [ ] **Step 2: Shoot the two routes.**

```bash
node scripts/autopilot-check.mjs --skip lint,test --routes /universe --shots endless-lane1 --before
node scripts/autopilot-check.mjs --skip lint,test,build --routes /galaxy --shots endless-lane1-galaxy --before
```

Expected: exit 0, writing `public/changes/endless-lane1-before.webp` and `public/changes/endless-lane1-galaxy-before.webp`. Copy them into the evidence folder as `before-universe.webp` and `before-galaxy.webp`. Don't commit `public/changes/`: this isn't a ship's-log entry.

- [ ] **Step 3: Measure every pose at each tier.**

```bash
node scripts/universe-check.mjs --quality high --out lab/universe/lane1-before/high
node scripts/universe-check.mjs --quality mid --out lab/universe/lane1-before/mid
node scripts/universe-check.mjs --quality low --out lab/universe/lane1-before/low
```

Expected:
- Exit 0, each printing an `ok` line for the 14 poses (`scripts/universe-check.mjs:29`) with `calls` and `tris`.
- Copy `lab/universe/lane1-before/<tier>.json` to the evidence folder as `before-<tier>.json`. `lab/universe/*` is gitignored except `baseline/`.

- [ ] **Step 4: Take the frame times, twice** (the second run is the noise floor).

```bash
QUALITY=mid OUT=docs/superpowers/evidence/endless-lane1/before-perf-mid.json node scripts/perf-probe.mjs universe
QUALITY=low OUT=docs/superpowers/evidence/endless-lane1/before-perf-low.json node scripts/perf-probe.mjs universe
```

Expected: a table a phase. Run each again to `-2.json` and note the p50 and p95 spread between the two runs in the README.

- [ ] **Step 5: Record and commit.** Write the README: a table of the ten baseline poses (`lab/universe/baseline/high.json`'s keys) × three tiers × calls and triangles, plus the spread. Record:
- `wc -l src/components/universe/scene.js` (6226)
- `node scripts/health.mjs --only glsl-sites,big-files` (607, 30)

```bash
git add docs/superpowers/evidence/endless-lane1
git commit -m "Nebulae lane: the before shots and numbers, from main"
```

---

