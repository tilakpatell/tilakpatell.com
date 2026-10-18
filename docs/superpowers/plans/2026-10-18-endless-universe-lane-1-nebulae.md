# Endless universe, lane 1: nebulae and the sky. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every nebula in the universe is drawn by one renderer fixed in the world. That covers the Veil, the Cradle, the Expanse's generated nebulae and lane 4a's pockets to come. A nebula shifts with parallax, rolls with the stars, grows as you come in and fogs you when you fly into it. The universe's sky stops baking clouds into its cube, and the landmarks that are left lose their screen-aligned quad.

**Architecture:**
- **A pure half, tested in Node:**
  - `nebula/budget.js`: the tier rows.
  - `nebula/rules.js`: where a cloud is drawn, its level, its shape, inside or not, the fog's layers and its young stars.
  - `nebula/volume.js`: a tiling 3D noise volume.
- **A drawing half, two instanced draws:**
  - `nebula/index.js` and `nebula/shaders.js` draw every cloud in one draw. Each cloud is a camera-facing quad that ray-marches its sphere through the noise volume. Its step count is set by distance and the tier, and its young stars come in near it.
  - `nebula/fog.js` draws the fog layers round the camera in a second draw, only while you are inside a cloud.
- **Placing:** state is absolute doubles, drawn camera-relative. A cloud past the far plane is pulled in along its own direction, shrunk by the same factor, so its direction and its angle are its true ones.
- **Wiring:**
  - Deep space owns the one renderer and updates and disposes it, so `scene.js`'s `render()` and dispose block are untouched.
  - The Expanse's sectors borrow the renderer through `createExpanse`'s existing `make` option.

**Tech Stack:**
- three.js 0.186 on the classic `WebGLRenderer`. The universe module is still `'glsl'` (`src/components/universe/module.js:11-12`), so these are GLSL `ShaderMaterial`s with a `Data3DTexture`. The node-renderer twin is the universe port's job (engine floor FL3), not this lane's.
- Vitest (`npx vitest run <path>`).
- Playwright-driven check scripts under `scripts/`.

**Spec:** `docs/superpowers/specs/2026-10-18-endless-universe-design.md`. Section D and "What done looks like" item 5 are this lane's. The index plan is `docs/superpowers/plans/2026-10-18-endless-universe.md`, and its Global Constraints apply here too.

**The API, and where it differs from the brief.** The brief's shape is kept. The four refinements, each forced by the code:

```
createNebulae({ renderer, tier }) → { group, add(desc) → handle, remove(handle), update(camera), inside(position) → { id, depth } | null, dispose() }
desc = { id: string, at: [x, y, z], r: number, colors: string[], seed: number | bigint | string, form?: 'cloud' | 'shell' | 'nursery' }
```

1. **`group` is returned.** The caller adds it under the map, and the renderer reads the camera in the map's space through it.
2. **`update(camera)` has no `dt`.** Nothing in a nebula moves with time; it stays put. ESLint's `no-unused-vars` fails a trailing unused `dt`, and a caller passing one is harmless.
3. **`desc.form` is optional, defaulting to `'cloud'`.**
   - It keeps the Veil a remnant's broken shell and the Cradle a nursery with a bright heart (`deepspace.js:742-818` draws them so today).
   - Lane 4a's supernova remnants (catalogue 7) can use `'shell'`.
4. **Handles are forgiving.**
   - `remove` of a stale handle, or after `dispose()`, does nothing. `scene.js:6192` disposes deep space before the Expanse at `:6195`, so a sector's `remove` runs after its renderer is gone.
   - The same `id` added twice draws once, until every handle for it is removed.

## Global Constraints

**The owner's rules** (`docs/superpowers/HANDOFF-universe.md:52-66`) all hold:
- Pure first: tests before drawing.
- Before shots on `main` before any picture changes.
- Draw calls and triangles no higher at any checked route, numbers said.
- One PR, CI green, a merge commit, never a force-push.
- Before the PR: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.
- Existing tests stay green and are not loosened.
- No new dependency.
- British spelling, curly quotes, comments that say why in the file's voice, no model names.

**`scene.js`** (6,226 lines) must not grow:
- Touch only:
  - the imports (`:207-209`)
  - the sky block (`:646-668`)
  - the `buildDeepSpace` line (`:672`)
  - the `createExpanse` options (`:734-742`)
  - the landmarks call (`:746-748`)
- Don't touch `render()`, the dev hooks, `paceTo` or the dispose block.
- The PR says the line count before and after. This plan's net is about −19.

**Files owned elsewhere:**
- Lane 2's, not touched: `expanse/gen/*`, the rest of `expanse/scene/*`, `ship.js`, `deep.js`, `nav.js`, `NavMap.jsx`, `MiniMap.jsx`, `lib/land/*`.
- `expanse/scene/sectors.js` is lane 2's file. Only its nebula lines and the nebula's speck change here (index plan `:171-172`).

**The measure:**
- `glsl-sites` (607 today, budget 619, `docs/health/budgets.json:8`) doesn't rise. The lane adds at most two `ShaderMaterial` sites in `nebula/` and removes two: `sectors.js:97` and `landmarks.js:270`.
- `big-files` (30) doesn't rise.
- New files stay under 800 lines.

**Pictures and numbers:**
- `/galaxy` keeps every pixel. The new sky option defaults to today's bake.
- `post.js` is untouched.
- **Warm-up:** every new material exists, hidden, from `createNebulae`, so `prepareScene` (`scene.js:5897-5908`, "every shader (hidden things too)") links it before the map is seen.
- **Budget numbers:** they live in `nebula/budget.js` until lane 2's `universe/budget.js` exists and absorbs them (spec H). Don't import a file that isn't on `main`.
- **The bloom:** the gas tops out under it (`look.js`, threshold 1.7). Young stars may go over it, as the sparks did.
- **Download:** `WORLD_MB['/universe']` stays at 6 (`src/components/worlds/worlds.js:15`). Nothing new is downloaded; the volume is made in code.

## Review Focus

1. **Past the far plane, or on foot under a day sky.**
   - Cases: a generated nebula a sector away, or the Veil seen from across the core. On a landing in full day, `camera.far` is 31.5 and the dome is at 30 (`landings/sky.js:80-81`).
   - Expected: the cloud is drawn at its true direction and angle inside the far plane, never clipped, and hidden behind the dome by day.
   - Pinned in Task 2 (placement) and Task 4 (the on-foot case).
2. **Handles across lifecycles.**
   - Cases: a sector disposed after deep space, the same id added twice, a stale handle.
   - Expected: no throw, no ghost cloud, nothing doubled.
   - Pinned in Task 4.
3. **Degenerate geometry.**
   - Cases: the camera exactly at a nebula's middle or on its edge; a landmark straight overhead.
   - Expected: no NaN, no black screen, no flipped quad.
   - Pinned in Task 2 (centre) and Task 7 (overhead).
4. **Overlapping nebulae.**
   - Case: inside one cloud while another is in view.
   - Expected: the deepest cloud's fog, both clouds drawn far to near, neither marched over the ship.
   - Pinned in Task 5.
5. **What a generator hands in.**
   - Cases: bigint seeds (`expanse/gen/seed.js`), one colour or none, an unknown tier or form, a non-finite position.
   - Expected: normalised, or a clear `TypeError` at `add`, never a black or NaN cloud.
   - Pinned in Task 2.

---

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

### Task 2: The rules and the budget (pure)

**Files:**
- Create: `src/components/universe/nebula/budget.js`
- Create: `src/components/universe/nebula/budget.test.js`
- Create: `src/components/universe/nebula/rules.js`
- Create: `src/components/universe/nebula/rules.test.js`

**Interfaces:**
- Consumes: `PALETTE` from `src/components/universe/palette.js` (pure).
- Produces, in `budget.js`:
  - `NEBULA_BUDGET = { low, mid, high }`. Each row is `{ volume, farSteps, nearSteps, nearMax, fog, stars, drawn }`:

    | | volume | farSteps | nearSteps | nearMax | fog | stars | drawn |
    |---|---|---|---|---|---|---|---|
    | low | 32 | 4 | 12 | 1 | 2 | 16 | 8 |
    | mid | 48 | 5 | 20 | 1 | 3 | 32 | 12 |
    | high | 64 | 6 | 32 | 2 | 4 | 64 | 16 |

    - `volume`: the noise volume's side, in voxels
    - `farSteps` / `nearSteps`: march steps at the far and near levels
    - `nearMax`: how many clouds may be near at once
    - `fog`: the number of fog layers
    - `stars`: young stars per near cloud
    - `drawn`: the most clouds drawn at once
  - `nebulaBudget(tier: string) → row`: `'ultra'` (lib/device's detail level, never its tier) reads `high`, and an unknown tier reads `mid`.
  - A header line says lane 2's `universe/budget.js` takes these rows over.
- Produces, in `rules.js` (no three.js):
  - Constants:
    - `NEAR = 4`: in radii; inside this is the near level
    - `FADE = 0.2`
    - `LIMIT = 0.98`: the share of `camera.far` a cloud is drawn within
    - `INSIDE_MIN = 0.02`
    - `FOG_NEAR = 8`
    - `FOG_FAR = 3000`
  - `FORMS = { cloud, shell, nursery }`, each `{ inner, peak, outer, flat, core }`:
    - cloud `{ inner: -1, peak: 0.35, outer: 1, flat: 0.55, core: 1 }`
    - shell `{ inner: 0.45, peak: 0.72, outer: 0.98, flat: 0.8, core: 1 }`
    - nursery `{ inner: -1, peak: 0.2, outer: 1, flat: 0.6, core: 2.2 }`
  - `FORM_INDEX = { cloud: 0, shell: 1, nursery: 2 }`
  - `checkDesc(desc) → { id, at, r, colors: [c0, c1, c2], seed, form }`. It pads `colors` by repeating; none gives `[PALETTE.nebula]`×3. An unknown form becomes `'cloud'`. It throws `TypeError` on a missing `id`, a non-finite `at`, or `r` that isn't > 0.
  - `seedOf(seed: number | bigint | string) → [a, b, c]`, each in [0, 1). FNV-1a over `String(seed)`, then three splitmix steps.
  - `envelope(form: string, p: [x, y, z]) → 0…1`, where `p` is in radii from the middle, in the map's axes.
  - `placement(at, r, cam, limit) → { centre: [x, y, z], radius, scale, dist }`:
    - `centre` is camera-relative
    - `dist = |at − cam|`
    - `scale = min(1, limit / dist)`
    - `centre = (at − cam) · scale`
    - `radius = r · scale`
  - `detailAt(dist, r) → 0…1`: 1 inside `NEAR·r·(1 − FADE)`, 0 past `NEAR·r·(1 + FADE)`, smoothstep between.
  - `stepsAt(detail, row) → integer`: `round(farSteps + (nearSteps − farSteps) · detail)`.
  - `insideOf(entries: [{ id, at, r, form }], position) → { id, depth } | null`. The deepest entry whose envelope at `position` is at least `INSIDE_MIN` wins, with `depth` that envelope.
  - `fogLayers(row, r) → number[]`: `row.fog` radii, ascending and geometric, from `FOG_NEAR` to `min(0.5·r, FOG_FAR)`.
  - `youngStars(desc, n) → [{ at: [x, y, z] (units from the middle), size, bright, pal }]`, seeded from `seedOf(desc.seed)`. The spread is 0.6 for a shell, 0.35 for a nursery and 0.5 for a cloud, with y squashed by 0.45. The size and brightness follow `deepspace.js:815-818`'s draws.

- [ ] **Step 1: Write the failing tests.**

```js
// rules.test.js (budget.test.js likewise: every row present, no number smaller on a stronger tier; nebulaBudget('ultra') is high, nebulaBudget('?') is mid)
const sub = (a, b) => a.map((v, i) => v - b[i]);
const len = (a) => Math.hypot(...a);
describe('where a nebula is drawn', () => {
  const at = [-13380, 505, 28350], r = 700;
  it('keeps it where it is, whatever the camera', () => {
    for (const cam of [[0, 0, 0], [5000, 0, 0], [123456.7, -800, 1e6]]) {
      const p = placement(at, r, cam, 1e12);
      p.centre.forEach((v, i) => expect(cam[i] + v / p.scale).toBeCloseTo(at[i], 6));
    }
  });
  it('draws it at its true angle, 2·atan(r / d), with no floor', () => {
    for (const d of [2000, 9000, 45000, 1e6, 1e7]) {
      const p = placement([d, 0, 0], r, [0, 0, 0], 44100);
      expect(2 * Math.atan(p.radius / len(p.centre))).toBeCloseTo(2 * Math.atan(r / d), 12);
    }
    expect(2 * Math.atan(placement([1e7, 0, 0], r, [0, 0, 0], 44100).radius / 44100)).toBeLessThan(1e-3); // (the old floor was 14°, 0.244)
  });
  it('pulls a far one inside the far plane along its own direction', () => {
    const p = placement([0, 0, -200000], r, [0, 0, 0], 44100);
    expect(len(p.centre)).toBeCloseTo(44100, 6);
    expect(p.centre[2]).toBeLessThan(0);
    expect(p.scale).toBeCloseTo(44100 / 200000, 12);
    expect(p.dist).toBe(200000);
  });
  it('is whole with the camera at its very middle', () => {
    expect(placement(at, r, at, 44100)).toEqual({ centre: [0, 0, 0], radius: r, scale: 1, dist: 0 });
  });
});
describe('its levels', () => {
  it('is near inside four radii, far past them, smooth between', () => {
    expect(detailAt(4 * 700 * 0.79, 700)).toBe(1);
    expect(detailAt(4 * 700 * 1.21, 700)).toBe(0);
    expect(detailAt(4 * 700, 700)).toBeCloseTo(0.5);
    expect(stepsAt(0, NEBULA_BUDGET.high)).toBe(6);
    expect(stepsAt(1, NEBULA_BUDGET.high)).toBe(32);
  });
});
describe('its shape', () => {
  it('fills a cloud from its heart to its edge, flattened toward the map’s plane', () => {
    expect(envelope('cloud', [0, 0, 0])).toBe(1);
    expect(envelope('cloud', [1.01, 0, 0])).toBe(0);
    expect(envelope('cloud', [0, 0.5, 0])).toBeLessThan(envelope('cloud', [0.5, 0, 0]));
  });
  it('leaves a shell hollow and a nursery hot at the heart', () => {
    expect(envelope('shell', [0, 0, 0])).toBe(0);
    expect(envelope('shell', [0.72, 0, 0])).toBe(1);
    expect(FORMS.nursery.core).toBeGreaterThan(1);
    expect(envelope('nebulous?', [0.2, 0, 0])).toBe(envelope('cloud', [0.2, 0, 0]));
  });
});
describe('inside', () => {
  const veil = { id: 'veil', at: [0, 0, 0], r: 700, form: 'cloud' };
  it('says how deep, and nothing outside', () => {
    expect(insideOf([veil], [0, 0, 0])).toEqual({ id: 'veil', depth: 1 });
    expect(insideOf([veil], [707, 0, 0])).toBeNull();
  });
  it('names the deeper of two that overlap', () => {
    const other = { id: 'b', at: [600, 0, 0], r: 700, form: 'cloud' };
    expect(insideOf([veil, other], [550, 0, 0]).id).toBe('b');
  });
  it('is not inside a shell’s hollow middle', () => expect(insideOf([{ ...veil, form: 'shell' }], [0, 0, 0])).toBeNull());
});
describe('the fog’s layers', () => {
  it('starts clear of the ship and grows by one ratio', () => {
    const l = fogLayers(NEBULA_BUDGET.high, 700);
    expect(l).toHaveLength(4);
    expect(l[0]).toBe(8); // (the chase camera is at most 2.5 behind the ship: flight.js's CHASE)
    expect(l.at(-1)).toBeCloseTo(350);
    expect(l[2] / l[1]).toBeCloseTo(l[1] / l[0], 9);
    expect(fogLayers(NEBULA_BUDGET.high, 1e5).at(-1)).toBe(3000);
  });
});
describe('a description', () => {
  it('takes the seeds generators make, and keeps them apart', () => {
    for (const s of [7, 7n, 'veil', 2n ** 63n + 5n]) for (const v of seedOf(s)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
    expect(seedOf(7n)).toEqual(seedOf(7n));
    expect(seedOf('veil')).not.toEqual(seedOf('cradle'));
  });
  it('fills in colours and form, and refuses what can’t be drawn', () => {
    expect(checkDesc({ id: 'a', at: [0, 0, 0], r: 5, colors: ['#123456'], seed: 1 }).colors).toEqual(['#123456', '#123456', '#123456']);
    expect(checkDesc({ id: 'a', at: [0, 0, 0], r: 5, seed: 1, form: 'blob' })).toMatchObject({ colors: [PALETTE.nebula, PALETTE.nebula, PALETTE.nebula], form: 'cloud' });
    expect(() => checkDesc({ id: 'a', at: [0, NaN, 0], r: 5, seed: 1 })).toThrow(TypeError);
    expect(() => checkDesc({ id: 'a', at: [0, 0, 0], r: 0, seed: 1 })).toThrow(TypeError);
    expect(() => checkDesc({ at: [0, 0, 0], r: 5, seed: 1 })).toThrow(TypeError);
  });
});
describe('young stars', () => {
  it('are the same for a seed, inside the cloud, wider in a shell', () => {
    const d = { id: 'v', at: [0, 0, 0], r: 700, seed: 'v', form: 'shell' };
    expect(youngStars(d, 16)).toEqual(youngStars(d, 16));
    expect(youngStars(d, 16)).toHaveLength(16);
    const spread = (f) => youngStars({ ...d, form: f }, 64).reduce((s, x) => s + Math.hypot(...x.at), 0);
    expect(spread('shell')).toBeGreaterThan(spread('nursery'));
  });
});
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/nebula`. Expected: FAIL, because `./rules` and `./budget` can't be resolved.

- [ ] **Step 3: Implement `budget.js` and `rules.js`** to the Interfaces above.

The one formula the tests don't fix, written so `shaders.js` can mirror it line for line (GLSL's `smoothstep` is undefined with its edges reversed, so the falling edge is written `1 − smoothstep`):

```
ρ   = length([p.x, p.y / flat, p.z])
env = ρ ≥ 1 ? 0 : (1 − smoothstep(peak, outer, ρ)) × (inner < 0 ? 1 : smoothstep(inner, peak, ρ))
```

`checkDesc` copies `at` to a fresh array, so a caller mutating its own array later doesn't move the cloud.

- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run src/components/universe/nebula`. Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/components/universe/nebula
git commit -m "Nebulae: the pure rules and the tier rows"
```

---

### Task 3: The noise volume (pure)

**Files:**
- Create: `src/components/universe/nebula/volume.js`
- Create: `src/components/universe/nebula/volume.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `fbm3(x, y, z, { period = 4, octaves = 4, seed = 1 }) → 0…1`: value noise on an integer lattice that wraps every `period · 2^o` cells at octave `o`.
  - `noiseVolume(size: number, seed = 1) → Uint8Array(size³ · 2)`:
    - R is the gas, `fbm3` at `seed`. G is the colour mix and dust, at `seed + 1`.
    - Voxel `(i, j, k)` samples at `(i / size · period, …)`, so the volume tiles under `RepeatWrapping`.
    - It is cached by `size:seed`; a second call returns the same array.
  - The method: one lattice of random values per octave, interpolated trilinearly. It is not hashed per corner, so 64³ stays near 60 ms.

- [ ] **Step 1: Write the failing tests.**

```js
describe('the noise volume', () => {
  it('repeats exactly over its period', () => {
    for (const [x, y, z] of [[0.3, 1.7, 2.2], [3.9, 0.1, 0.5]]) expect(fbm3(x + 4, y, z)).toBeCloseTo(fbm3(x, y, z), 12); // (x + 4 rounds its fraction in the last bit)
  });
  it('is the same for a seed and different for another', () => {
    expect(fbm3(1.2, 2.3, 0.4, { seed: 3 })).toBe(fbm3(1.2, 2.3, 0.4, { seed: 3 }));
    expect(fbm3(1.2, 2.3, 0.4, { seed: 3 })).not.toBe(fbm3(1.2, 2.3, 0.4, { seed: 4 }));
  });
  it('fills size³ two-channel voxels with contrast, and is made once', () => {
    const v = noiseVolume(32, 1);
    expect(v).toHaveLength(32 ** 3 * 2);
    for (const c of [0, 1]) {
      let lo = 255, hi = 0;
      for (let i = c; i < v.length; i += 2) { lo = Math.min(lo, v[i]); hi = Math.max(hi, v[i]); }
      expect(lo).toBeLessThan(40);
      expect(hi).toBeGreaterThan(215);
    }
    expect(noiseVolume(32, 1)).toBe(v);
  });
  it('has no seam where it wraps', () => {
    const v = noiseVolume(32, 1);
    const at = (i, j, k) => v[((k * 32 + j) * 32 + i) * 2];
    let seam = 0, step = 0;
    for (let j = 0; j < 32; j++) for (let k = 0; k < 32; k++) { seam += Math.abs(at(31, j, k) - at(0, j, k)); step += Math.abs(at(15, j, k) - at(16, j, k)); }
    expect(seam).toBeLessThan(step * 2);
  });
});
```

- [ ] **Step 2: Run and see it fail.** Run `npx vitest run src/components/universe/nebula/volume.test.js`. Expected: FAIL, because `./volume` can't be resolved.
- [ ] **Step 3: Implement `volume.js`** to the Interfaces above. Remap each channel's own minimum and maximum to 0…255, so the thresholds in the shader have the whole range.
- [ ] **Step 4: Run and see it pass.** Run the same command. Expected: PASS. Note the time `noiseVolume(64, 1)` takes in Node in the commit body.
- [ ] **Step 5: Commit.** `git add src/components/universe/nebula/volume*` then `git commit -m "Nebulae: a tiling 3D noise volume, made in code"`.

---

### Task 4: The renderer: clouds and their young stars

**Files:**
- Create: `src/components/universe/nebula/shaders.js` (GLSL strings only, so no `glsl-sites`)
- Create: `src/components/universe/nebula/index.js`
- Create: `src/components/universe/nebula/index.test.js`
- Create: `src/components/universe/__fixtures__/glsl.js`: `RESERVED`, the list now at `landmarks.test.js:117`, and `reservedIn(src) → string[]`.

**Interfaces:**
- Consumes:
  - from Task 2: `nebulaBudget`, `checkDesc`, `seedOf`, `placement`, `detailAt`, `stepsAt`, `insideOf`, `youngStars`, `FORMS`, `FORM_INDEX`, `LIMIT`
  - from Task 3: `noiseVolume`
- Produces: `createNebulae({ renderer = null, tier = 'mid' } = {}) → { group, add, remove, update, inside, dispose }`, as at the top of this plan.
  - `group.name` is `'nebulae'`. It holds two meshes, made at create and hidden until needed: `'nebula-clouds'` (this task) and `'nebula-fog'` (Task 5).
  - Instance attributes on `nebula-clouds` that tests and Task 5 read, by these names:
    - `aCentre`: vec3, camera-relative and scaled
    - `aRadius`: scaled
    - `aDist`: the true distance
    - `aDetail`: 0…1
    - `aStart`: where the march starts along the ray, scaled; 0 outside
    - `aKind`: 0 a cloud, 1 a young star
  - The other attributes are the implementer's to pack: colours, seed, form, steps, a star's size and brightness.

**How it draws** (the decisions the tests don't fix):
- **The mesh:**
  - One `Mesh` with an `InstancedBufferGeometry` of a 2 × 2 quad, sized for `row.drawn × (1 + row.stars)`.
  - A `ShaderMaterial` with the `MAX_STEPS = row.nearSteps` define.
  - Premultiplied blending (`CustomBlending`, `One`, `OneMinusSrcAlpha`), `transparent`, `depthTest: true`, `depthWrite: false`.
  - `frustumCulled: false`, `renderOrder: -5`.
- **Each frame (`update`):**
  - `camMap = group.worldToLocal(camera.getWorldPosition(v))`. The mesh's `position` is `camMap`, so its `modelViewMatrix`, made in doubles on the CPU, carries the camera-relative instances.
  - `limit = camera.far · LIMIT`.
  - Each cloud goes through `placement`. A cloud whose scaled sphere is outside the camera's frustum (`THREE.Frustum`, tested in the world) is left out.
  - What's left is sorted far to near by `dist` and kept to the nearest `row.drawn`. Only the nearest `row.nearMax` get `detailAt`; the rest get 0.
  - A cloud with detail > 0 has its `youngStars(desc, row.stars)` written right after it, faded by its detail. None far, so the baseline poses gain no triangles.
  - `instanceCount` is what was written, and `visible = instanceCount > 0`.
- **The vertex shader, a cloud:**
  - `c = (modelViewMatrix · aCentre).xyz` and `D = |c|`.
  - When `D ≤ 1.02 · aRadius`, it draws a full-screen quad in clip space at the depth of `aStart` (or of 4 × near), with the view ray from a `uTan` uniform (`tan(fov/2)·aspect`, `tan(fov/2)`).
  - Otherwise it draws a view-facing square covering the sphere's silhouette, `h = R·D / √(D² − R²)` at its own plane. That plane is the scaled centre when `aRadius` was scaled, and the front, `max(D − R, 4·near)`, when not.
  - A scaled cloud sits at the far plane's depth, behind a day landing's dome. A near one is hidden by anything solid in front of it.
- **The fragment shader, a cloud:**
  - Intersect the ray with the sphere `(c, R)`, giving `t0 = max(entry, aStart)` and `t1 = exit`.
  - Take `steps` samples from `t0` to `t1`, jittered by interleaved gradient noise.
  - Each sample goes to the map's axes as `p = transpose(mat3(modelViewMatrix)) · (rd·t − c) / R`. That is how the cloud rolls with the stars and never with the camera.
  - At each sample:
    - **Density:** `envelope(form, p) × gas`. The gas is `smoothstep(0.3, 0.8, R channel at p·1.3 + seed)`, plus, with `detail`, a finer tap at four times the frequency.
    - **Colour:** `c0` and `c1` mixed by the G channel, `c2` where the gas is thickest.
    - **Dust:** where G passes 0.7, which dims what's behind.
    - **Accumulation:** Beer–Lambert, with the step length in radii (`(t1 − t0) / steps / R`), so the picture doesn't depend on the step count or the scale.
  - Stop early when the transmittance falls under 0.02.
  - Output is premultiplied `(light, 1 − transmittance)`.
  - The look's constants start at `EMIT 1.5` and `ABSORB 2.0`. Tune them against the before shots and say which way each moved.
- **A young star:** a sprite in clip space of `clamp(size · uScale / aDist, 2, 30)` px, `uScale` set in `onBeforeRender` as `deepspace.js:1262-1266` does. It uses `deepspace` `SPARK_FRAG`'s falloff and adds light only (alpha 0).
- **The forms in GLSL:** `uForms` is a `vec4[3]` (inner, peak, outer, flat) and `uCore` a `float[3]`, both filled from `FORMS`. The numbers have one source.
- **The volume texture:**
  - A `Data3DTexture` of `noiseVolume(row.volume, 1)`, `RGFormat`, `RepeatWrapping` on all three axes, linear, no mips.
  - `renderer?.initTexture(volume)` at create, so it's uploaded before the first frame.
  - This replaces the puff texture (256² RGBA) and the landmarks' atlas (up to 2048 × 1024 with mips). Say both sizes in the PR.

- [ ] **Step 1: Write the failing tests** in `index.test.js`:

```js
const cam = (p, look, far = 45000) => {
  const c = new THREE.PerspectiveCamera(34, 16 / 9, 0.08, far);
  c.position.set(...p); c.lookAt(...look); c.updateMatrixWorld(true);
  return c;
};
const made = (tier = 'high') => { const parent = new THREE.Group(); const n = createNebulae({ tier }); parent.add(n.group); return { parent, n }; };
const clouds = (n) => n.group.getObjectByName('nebula-clouds');
const attr = (n, name, i) => { const a = clouds(n).geometry.attributes[name]; return Array.from({ length: a.itemSize }, (_, k) => a.array[i * a.itemSize + k]); };
const VEIL = { id: 'veil', at: [1e6, 200, -3e5], r: 900, colors: ['#5b3fd1', '#d14f9a', '#3fb7d1'], seed: 7n, form: 'shell' };

it('starts with nothing drawn and every material already made', () => {
  const { n } = made();
  expect(n.group.name).toBe('nebulae');
  expect(clouds(n).visible).toBe(false);
  expect(n.group.getObjectByName('nebula-fog')).toBeTruthy();
  n.update(cam([0, 0, 0], [0, 0, -1]));
  expect(clouds(n).visible).toBe(false);
});
it('draws an added nebula round the camera, in one draw', () => {
  const { n } = made();
  n.add(VEIL);
  const eye = [1e6, 200, -3e5 + 12000];
  n.update(cam(eye, VEIL.at));
  expect(clouds(n).visible).toBe(true);
  expect(clouds(n).geometry.instanceCount).toBe(1);
  expect(clouds(n).position.toArray()).toEqual(eye);
  attr(n, 'aCentre', 0).forEach((v, i) => expect(v).toBeCloseTo(VEIL.at[i] - eye[i], 2));
  expect(attr(n, 'aRadius', 0)[0]).toBeCloseTo(900, 3);
});
it('keeps it where it is when the camera moves 5,000 sideways', () => {
  const { n } = made();
  n.add(VEIL);
  for (const dx of [0, 5000]) {
    const eye = [1e6 + dx, 200, -3e5 + 20000];
    n.update(cam(eye, [eye[0], 200, -3e5]));
    attr(n, 'aCentre', 0).forEach((v, i) => expect(eye[i] + v).toBeCloseTo(VEIL.at[i], 1));
  }
});
it('puts one past the far plane inside it, at its true angle', () => {
  const { n } = made();
  n.add({ ...VEIL, at: [0, 0, -300000] });
  n.update(cam([0, 0, 0], [0, 0, -1]));
  const c = attr(n, 'aCentre', 0);
  expect(Math.hypot(...c)).toBeLessThanOrEqual(45000 * 0.98 + 1e-6);
  expect(attr(n, 'aRadius', 0)[0] / Math.hypot(...c)).toBeCloseTo(900 / 300000, 8); // (float32 attributes)
  expect(attr(n, 'aDist', 0)[0]).toBeCloseTo(300000, 1);
});
it('on foot under a day sky, sits behind the dome', () => {
  const { n } = made();
  n.add({ ...VEIL, at: [0, 0, -20000] });
  n.update(cam([0, 0, 0], [0, 0, -1], 31.5)); // (landings/sky.js: SKY_R 30, seenTo 31.5)
  expect(Math.hypot(...attr(n, 'aCentre', 0))).toBeGreaterThan(30);
});
it('leaves out what is behind the camera', () => {
  const { n } = made();
  n.add({ ...VEIL, at: [0, 0, 20000] });
  n.update(cam([0, 0, 0], [0, 0, -1]));
  expect(clouds(n).visible).toBe(false);
});
it('draws the nearest, at most the tier’s count, far to near, only the nearest in detail', () => {
  const { n } = made('low');
  for (let i = 0; i < 20; i++) n.add({ ...VEIL, id: `n${i}`, at: [0, 0, -1000 - i * 3000], r: 400 }); // (the nearest within 4 radii: near)
  n.update(cam([0, 0, 0], [0, 0, -1]));
  const k = clouds(n).geometry.instanceCount;
  const clouds8 = Array.from({ length: k }, (_, i) => i).filter((i) => attr(n, 'aKind', i)[0] === 0); // (its young stars are the other instances)
  expect(clouds8).toHaveLength(nebulaBudget('low').drawn);
  const d = clouds8.map((i) => attr(n, 'aDist', i)[0]);
  expect(d).toEqual([...d].sort((a, b) => b - a));
  expect(clouds8.filter((i) => attr(n, 'aDetail', i)[0] > 0)).toHaveLength(nebulaBudget('low').nearMax);
});
it('gives a near nebula its young stars, and a far one none', () => {
  const { n } = made('high');
  n.add({ ...VEIL, at: [0, 0, -1500] });
  n.update(cam([0, 0, 0], [0, 0, -1]));
  expect(clouds(n).geometry.instanceCount).toBe(1 + nebulaBudget('high').stars);
  n.update(cam([0, 0, 60000], [0, 0, -1]));
  expect(clouds(n).geometry.instanceCount).toBe(1);
});
it('forgives handles: twice, stale, the same id twice, after dispose', () => {
  const { parent, n } = made();
  const a = n.add(VEIL), b = n.add(VEIL);
  n.update(cam([1e6, 200, -3e5 + 12000], VEIL.at));
  expect(clouds(n).geometry.instanceCount).toBe(1);
  n.remove(a); n.remove(a); n.remove(12345);
  n.update(cam([1e6, 200, -3e5 + 12000], VEIL.at));
  expect(clouds(n).visible).toBe(true);
  n.remove(b);
  n.update(cam([1e6, 200, -3e5 + 12000], VEIL.at));
  expect(clouds(n).visible).toBe(false);
  n.dispose();
  expect(parent.children).toHaveLength(0);
  expect(() => n.remove(b)).not.toThrow();
  expect(() => n.update(cam([0, 0, 0], [0, 0, -1]))).not.toThrow();
});
it('refuses what can’t be drawn, at add', () => {
  expect(() => made().n.add({ id: 'x', at: [0, NaN, 0], r: 5, seed: 1 })).toThrow(TypeError);
});
it('takes its forms’ numbers from rules.js, and names nothing reserved', () => {
  const m = clouds(made().n).material;
  expect(m.uniforms.uForms.value.map((v) => v.toArray())).toEqual(['cloud', 'shell', 'nursery'].map((f) => [FORMS[f].inner, FORMS[f].peak, FORMS[f].outer, FORMS[f].flat]));
  expect(reservedIn(m.vertexShader + m.fragmentShader)).toEqual([]);
});
```

- [ ] **Step 2: Run and see them fail.** Run `npx vitest run src/components/universe/nebula/index.test.js`. Expected: FAIL, because `./index` can't be resolved.
- [ ] **Step 3: Implement `shaders.js`, `index.js` and the fixture** as above. Use one `ShaderMaterial` helper per file, so `glsl-sites` counts one site per file. `nebula-fog` is created here as an empty hidden mesh; Task 5 gives it its draw.
- [ ] **Step 4: Run and see them pass.** Run `npx vitest run src/components/universe/nebula`. Expected: PASS.
- [ ] **Step 5: Lint and measure.** Run `npx eslint src/components/universe/nebula` and `node scripts/health.mjs --only glsl-sites`. Expected: no findings, and at most 609 (Task 7 and Task 9 take two back).
- [ ] **Step 6: Commit.** `git add src/components/universe/nebula src/components/universe/__fixtures__/glsl.js` then `git commit -m "Nebulae: one renderer, every cloud fixed in the world in one draw"`.

---

### Task 5: Inside: the fog round the ship

**Files:**
- Create: `src/components/universe/nebula/fog.js`
- Create: `src/components/universe/nebula/fog.test.js`
- Modify: `src/components/universe/nebula/index.js` (`update` wires it; `inside` exposes `insideOf`)
- Modify: `src/components/universe/nebula/shaders.js` (`FOG_VERT`, `FOG_FRAG`, sharing the cloud's field chunk)
- Test: `src/components/universe/nebula/index.test.js` (two more tests)

**Interfaces:**
- Consumes: `fogLayers` and `insideOf` from Task 2; the volume texture and the field chunk from Task 4.
- Produces:
  - `createFog({ volume, row }) → { mesh, show(cloud, layers), hide(), dispose() }`, where `cloud = { centre: [x, y, z] (the nebula's middle less the camera, true units), r, colours: THREE.Color[3], seed: [a, b, c], form: number, depth: number }`.
  - `mesh` is the `nebula-fog` mesh. Each layer is one instance: a full-screen quad at the depth of its radius, in clip space, drawn far to near.
  - Instance attribute `aLayer`: vec2 of the radius and the thickness to the layer inside it.
  - `inside(position)` on the renderer returns `insideOf(live entries, position)`.

**How it draws:**
- **Every frame:** `update` calls `insideOf(entries, camMap)`.
- **Inside:**
  - `fog.show` gets that nebula with `fogLayers(row, r)`, and the fog mesh shows `row.fog` instances.
  - Every cloud whose sphere holds the camera gets `aStart = layers.at(-1) · scale`. Its march starts past the fog, so nothing is counted twice and nothing is marched over the ship.
- **Outside:** `fog.hide()`.
- **Each layer's fragment:**
  - The point is `q = ray · radius` (view space), taken to the map's axes as `p = transpose(mat3(modelViewMatrix)) · (q − c) / r`. The same field as the cloud gives world-fixed wisps that stream past as you fly.
  - `alpha = 1 − exp(−density · thickness / r · ABSORB_FOG)`, with the colour the cloud's palette at `p`, then multiplied by `uDepth`.
  - The ship's light: `uGlow · density · exp(−|q − (0, 0, −2)|² / 36)`, a warm white two units ahead of the eye, where the ship is in the chase view.
- **Depth:** depth-tested at each layer's radius. Anything nearer than a layer hides that layer, so near things are clearer than far ones. The ship, at most 2.5 behind the eye, is in front of the first layer at 8.
- **Render order:** `renderOrder: -4`, after the clouds.

- [ ] **Step 1: Write the failing tests.**

```js
// fog.test.js
it('shows its layers far to near, and hides', () => {
  const f = createFog({ volume: new THREE.Data3DTexture(new Uint8Array(2), 1, 1, 1), row: nebulaBudget('high') });
  f.show({ centre: [0, 0, -100], r: 700, colours: [new THREE.Color(), new THREE.Color(), new THREE.Color()], seed: [0.1, 0.2, 0.3], form: 0, depth: 0.8 }, fogLayers(nebulaBudget('high'), 700));
  expect(f.mesh.visible).toBe(true);
  expect(f.mesh.geometry.instanceCount).toBe(4);
  const radii = [0, 1, 2, 3].map((i) => f.mesh.geometry.attributes.aLayer.getX(i));
  expect(radii).toEqual([...radii].sort((a, b) => b - a));
  expect(f.mesh.material.uniforms.uDepth.value).toBe(0.8);
  f.hide();
  expect(f.mesh.visible).toBe(false);
  f.dispose();
});
// index.test.js
it('fogs you inside, and starts the cloud’s march past the fog', () => {
  const { n } = made('high');
  n.add({ ...VEIL, form: 'cloud', at: [0, 0, -100] });
  n.update(cam([0, 0, 0], [0, 0, -1]));
  expect(n.group.getObjectByName('nebula-fog').visible).toBe(true);
  expect(attr(n, 'aStart', 0)[0]).toBeCloseTo(fogLayers(nebulaBudget('high'), 900).at(-1), 6);
  expect(n.inside([0, 0, 0])).toMatchObject({ id: 'veil' });
  n.update(cam([0, 0, 5000], [0, 0, -1]));
  expect(n.group.getObjectByName('nebula-fog').visible).toBe(false);
  expect(attr(n, 'aStart', 0)[0]).toBe(0);
});
it('inside two at once: the deeper one’s fog, both drawn far to near', () => {
  const { n } = made('high');
  n.add({ ...VEIL, id: 'a', form: 'cloud', at: [0, 0, -300] });
  n.add({ ...VEIL, id: 'b', form: 'cloud', at: [0, 0, 600] });
  n.update(cam([0, 0, 0], [0, 0, -1]));
  expect(n.inside([0, 0, 0]).id).toBe('a');
  const all = Array.from({ length: clouds(n).geometry.instanceCount }, (_, i) => i);
  const both = all.filter((i) => attr(n, 'aKind', i)[0] === 0);
  expect(both.map((i) => attr(n, 'aDist', i)[0])).toEqual([600, 300]);
  for (const i of both) expect(attr(n, 'aStart', i)[0]).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run and see them fail.** Run `npx vitest run src/components/universe/nebula`. Expected: FAIL (`./fog` can't be resolved, and the fog stays hidden).
- [ ] **Step 3: Implement `fog.js`, the fog shaders and the wiring in `index.js`.** Start at `ABSORB_FOG 1.2`, tuned at the `in-nebula` pose (Task 10).
- [ ] **Step 4: Run and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit.** `git add src/components/universe/nebula` then `git commit -m "Nebulae: inside one, its fog and wisps round the ship, lit by it"`.

---

### Task 6: The sky's clouds, left out for the universe

**Files:**
- Modify: `src/components/galaxy/sky.js`:
  - the header at `:34-39`: document `clouds`
  - the signature at `:370`
  - `setSystem` at `:505-509`
- Modify: `src/components/galaxy/sky.test.js`
- Modify: `src/components/galaxy/nodes/sky.js`: the twin, at `:382` and `:494-496`. The twin must take what its original takes, or `nodes/sky.test.js`'s parity breaks at the universe's port.
- Modify: `src/components/galaxy/nodes/sky.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `createSky({ small, level, renderer, beacons, clouds = true })`. With `clouds: false`, `setSystem` still draws `nebulaeFrom(sys, rand)`, so the stars after them land where they always did, but sets every `uNebCol` to black. The bake's nebula term is then exactly 0. The bake shader is untouched, so `/galaxy`'s picture can't move.

- [ ] **Step 1: Write the failing tests.**

```js
// sky.test.js
describe('its clouds', () => {
  const kashyyyk = systemById('kashyyyk');
  it('bakes without them when asked, every star where it was', () => {
    const a = createSky({ clouds: false }), b = createSky();
    a.setSystem(kashyyyk); b.setSystem(kashyyyk);
    const ma = bakeOf(a), mb = bakeOf(b);
    for (const c of ma.uniforms.uNebCol.value) expect(c.toArray()).toEqual([0, 0, 0]);
    expect(mb.uniforms.uNebCol.value.map((c) => c.getHex())).toEqual(nebulaeOf(kashyyyk).map((n) => new THREE.Color(n.color).getHex()));
    expect(ma.uniforms.uSeed.value).toBe(mb.uniforms.uSeed.value);
    expect(Array.from(a.group.children[1].geometry.attributes.position.array)).toEqual(Array.from(b.group.children[1].geometry.attributes.position.array));
  });
  it('leaves the galaxy’s sky as it was, for every system', () => {
    for (const s of SYSTEMS) {
      const sky = createSky();
      sky.setSystem(s);
      expect(bakeOf(sky).uniforms.uNebCol.value.map((c) => c.getHex())).toEqual(nebulaeOf(s).map((n) => new THREE.Color(n.color).getHex()));
      sky.dispose();
    }
  });
});
// nodes/sky.test.js: the "same uniforms by name and value" loop at :68-83 runs again with { clouds: false } on both
```

`bakeOf` is `nodes/sky.test.js:34-38`'s helper. Copy it into `sky.test.js` beside `fakeRenderer`; the scene is `fakeRenderer`'s last `render` call. If `fakeRenderer` doesn't record it yet, add `this.scene = scene` to its `render`.

- [ ] **Step 2: Run and see them fail.** Run `npx vitest run src/components/galaxy/sky.test.js src/components/galaxy/nodes/sky.test.js`. Expected: FAIL: the colours aren't black.
- [ ] **Step 3: Implement** the option in both files, as one expression at the colour line: `u.uNebCol.value[i].set(clouds ? nb.color : 0x000000)`.
- [ ] **Step 4: Run and see them pass.** Same command. Expected: PASS, the rest of both files unchanged.
- [ ] **Step 5: Commit.** `git add src/components/galaxy/sky.js src/components/galaxy/sky.test.js src/components/galaxy/nodes/sky.js src/components/galaxy/nodes/sky.test.js` then `git commit -m "Galaxy sky: an option to bake without its clouds, off by default"`.

---

### Task 7: The landmarks: world-up, depth-tested, no nebula drawn

**Files:**
- Modify: `src/components/universe/landmarks.js`:
  - the header at `:1-31`
  - `LANDMARKS` at `:60-71`: the two nebula rows move to the end
  - `NEBULAE` (new)
  - `quadAxes` (new)
  - `VERT` at `:102-134`: world-up
  - `FRAG` at `:136-204`: the nebula branch at `:187-193` goes, and the pulsar becomes the `else`
  - deleted: `NOISE` (`:83-100`), `PAINT_*` (`:206-236`), `cellSize` (`:238-239`) and the atlas (`:262-286`)
  - `createLandmarks` at `:241`: takes `{ skyFar }`
  - `update` at `:311-340`: nebula rows get `aK` 0 and their groups are never hidden. `ks[i]` keeps `landK`, so `kOf` still feeds `scene.js:785`'s names.
- Modify: `src/components/universe/landmarks.test.js` (the reserved-word test reads the fixture's `RESERVED`)
- Modify: `src/components/universe/scene.js:746-748`: the comment, and `createLandmarks(map, { skyFar: SKY_FAR })`

**Why the nebula rows stay as data:**
- `aim.js:40-45` makes them places to aim and jump at.
- `farStars.js:62` keeps them off the far stars through `LANDMARK_IDS`.
- `scene.js:785` reads their `kOf` for names.

Kept last and outside `instanceCount`, they cost no triangles. The landmark draw goes from 10 instances to 8 (−4 triangles at every pose), which pays for the far clouds' quads.

The instance attributes stay sized for every row, with `aK` 0 written for the nebula rows. That way the existing tests that read an attribute at a `LANDMARKS` index, such as `landmarks.test.js:90`'s `k('veil')`, read what they did.

**Interfaces:**
- Consumes: `checkDesc` (Task 2), in its test.
- Produces:
  - `quadAxes(dir: [x, y, z]) → { right, up }`:
    - unit vectors, perpendicular to `dir` and to each other
    - `up` has y ≥ 0
    - reference vector the map's +y; within 0.999 of it, the map's +x
  - `NEBULAE = [{ id: 'veil', …, form: 'shell' }, { id: 'cradle', …, form: 'nursery' }]`: `at` from `WONDERS`, `r`, `colors: w.colors`, `seed: id`.
  - `createLandmarks(parent, { skyFar }) → { mesh, update, kOf, dispose }`, as before.

**The vertex shader:**
- `f = normalize(aCenter − uCam)`, with `uCam` the camera in the parent's space, already worked out in `update` as `camAt`.
- `right` and `up` as `quadAxes`, and the corner `aCenter + (right·x + up·y) · extent`, through `projectionMatrix · modelViewMatrix`.
- The Maw's axis is taken in that basis: `vAxis = (axis·right, axis·up, −axis·f)`, so its fragment code is unchanged.
- `depthTest: true`.
- The far-plane clamp at `:133` stays, and its test at `:127-133` with it.

- [ ] **Step 1: Write the failing tests** (added; every existing test stays as it is):

```js
it('hands its nebulae to the renderer, every one deep space has', () => {
  expect(NEBULAE.map((d) => d.id)).toEqual(WONDERS.filter((w) => w.kind === 'nebula').map((w) => w.id));
  for (const d of NEBULAE) {
    const w = WONDERS.find((x) => x.id === d.id);
    expect(checkDesc(d)).toMatchObject({ at: w.at, r: w.r, colors: w.colors });
  }
  expect(NEBULAE.map((d) => d.form)).toEqual(['shell', 'nursery']);
});
it('draws only what isn’t a nebula, those rows first', () => {
  const lm = createLandmarks(new THREE.Group(), { skyFar: 24000 });
  const drawn = LANDMARKS.filter((l) => l.kind !== 'nebula').length;
  expect(lm.mesh.geometry.instanceCount).toBe(drawn);
  expect(LANDMARKS.slice(0, drawn).every((l) => l.kind !== 'nebula')).toBe(true);
  lm.dispose();
});
it('never draws a nebula or hides its group, and still says where its name shows', () => {
  const g = {};
  const lm = createLandmarks(new THREE.Group(), { skyFar: 24000 });
  const veil = WONDERS.find((w) => w.id === 'veil');
  const i = LANDMARKS.findIndex((l) => l.id === 'veil');
  for (const off of [30000, 2000]) {
    lm.update(camAt(veil.at[0] + off, veil.at[1], veil.at[2]), 0, { sector: 'main', groups: (id) => (g[id] ??= new THREE.Group()) });
    expect(lm.mesh.geometry.attributes.aK.getX(i)).toBe(0);
    expect(g.veil?.visible ?? true).toBe(true);
  }
  expect(lm.kOf('veil')).toBe(0);
  lm.update(camAt(veil.at[0] + 30000, veil.at[1], veil.at[2]), 0, { sector: 'main', groups: () => null });
  expect(lm.kOf('veil')).toBe(1);
  lm.dispose();
});
it('stands upright in the world, not on the screen, even straight overhead', () => {
  for (const d of [[0, 0, -1], [0.6, 0.3, -0.74], [0, 1, 0], [0, -1, 0], [1e-9, 1, 0]]) {
    const l = Math.hypot(...d);
    const dir = d.map((v) => v / l);
    const { right, up } = quadAxes(dir);
    const dot = (a, b) => a.reduce((s, v, k) => s + v * b[k], 0);
    for (const v of [right, up]) { expect(Math.hypot(...v)).toBeCloseTo(1, 9); expect(dot(v, dir)).toBeCloseTo(0, 9); }
    expect(dot(right, up)).toBeCloseTo(0, 9);
    expect(up[1]).toBeGreaterThanOrEqual(0);
  }
  const lm = createLandmarks(new THREE.Group(), { skyFar: 24000 });
  expect(lm.mesh.material.vertexShader).not.toMatch(/mv\.xy\s*\+=/);
  expect(lm.mesh.material.depthTest).toBe(true);
  lm.dispose();
});
```

- [ ] **Step 2: Run and see them fail.** Run `npx vitest run src/components/universe/landmarks.test.js`. Expected: the four new tests FAIL; the existing ones pass.
- [ ] **Step 3: Implement** as above, and update `scene.js:746-748`.
- [ ] **Step 4: Run** `npx vitest run src/components/universe/landmarks.test.js src/components/universe/aim.test.js src/components/universe/farStars.test.js`. Expected: all PASS. aim and far stars are untouched, so they're unchanged.
- [ ] **Step 5: Commit.** `git add src/components/universe/landmarks.js src/components/universe/landmarks.test.js src/components/universe/scene.js` then `git commit -m "Landmarks: upright in the world, depth-tested; the nebulae go to their renderer"`.

---

### Task 8: Deep space and the sky, wired

**Files:**
- Modify: `src/components/universe/deepspace.js`:
  - the header at `:24-28` and `:48`
  - the imports at `:64-65`
  - delete `puffTexture` (`:305-332`)
  - the signature at `:545`
  - the nebulae at `:714-870`, which become `place(w)` plus `nebulae.add(…)`
  - delete the young-star `Points` (`:1250-1268`)
  - `update` at `:1441-1450`: `nebulae.update(camera)` replaces the puff sort
  - the return at `:1436`: adds `nebulae`
  - `dispose` at `:1474`: `nebulae.dispose()` first
- Modify: `src/components/universe/deepspaceShaders.js`: delete `:549-628` (`PUFF_VERT`, `PUFF_FRAG`, `SPARK_VERT`, `SPARK_FRAG`; nothing else imports them)
- Create: `src/components/universe/mapSky.js`
- Create: `src/components/universe/mapSky.test.js`
- Modify: `src/components/universe/scene.js`:
  - delete the `createSky` and `SYSTEMS` imports at `:207-208`
  - add `import { createMapSky } from './mapSky'`
  - `:646-668` becomes three lines
  - `:672` passes `renderer`

**Interfaces:**
- Consumes: `createNebulae` (Tasks 4–5); `NEBULAE` (Task 7); `createSky({ clouds })` (Task 6).
- Produces:
  - `buildDeepSpace({ small, tier, renderer }) → { …as before, nebulae }`. `nebulae` is the one renderer, its `group` under deep space's `group`.
  - `createMapSky(parent, { renderer, small, level, post }) → { sky, followDrawn }`. It is `scene.js:646-668` moved whole, with `clouds: false`, so the names `render()` uses (`followDrawn` at `:5220`, `:5951`, `:6009`; `sky` at `:5299`, `:6203`) stay.

The scene now reads, at the old sky block:

```js
  // the sky (mapSky.js): the galaxy's band, dust and stars as Kashyyyk sees
  // them, its clouds left out: every nebula is a place now (nebula/)
  const { sky, followDrawn } = createMapSky(map, { renderer, small, level: device().detail, post });
```

- [ ] **Step 1: Write the failing test** `mapSky.test.js`. `vi.mock('../galaxy/sky')` captures `createSky`'s options and returns one shared stub, `{ group, setSystem, setRatio, prepare: () => Promise.resolve(), bake }`, with `beforeEach(() => vi.clearAllMocks())`:

```js
it('bakes the universe’s sky as Kashyyyk’s, without its suns, beacons or clouds', () => {
  const parent = new THREE.Group();
  createMapSky(parent, { renderer: null, small: true, level: 'low', post: { ratio: 1 } });
  expect(createSky).toHaveBeenCalledWith({ small: true, level: 'low', renderer: null, beacons: false, clouds: false });
  expect(stub.setSystem).toHaveBeenCalledWith(expect.objectContaining({ id: 'kashyyyk', suns: [] }));
  expect(parent.children).toContain(stub.group);
});
it('tells the sky the post’s ratio once a change', () => {
  const post = { ratio: 1 };
  const { followDrawn } = createMapSky(new THREE.Group(), { renderer: null, post });
  followDrawn(); post.ratio = 0.75; followDrawn(); followDrawn();
  expect(stub.setRatio.mock.calls).toEqual([[1], [0.75]]);
});
```

- [ ] **Step 2: Run and see it fail.** Run `npx vitest run src/components/universe/mapSky.test.js`. Expected: FAIL, because `./mapSky` can't be resolved.
- [ ] **Step 3: Implement `mapSky.js`**, moving the block verbatim with its comments, and make the `scene.js` changes above.
- [ ] **Step 4: Rewire `deepspace.js`** as listed. For each nebula wonder, `nebula(w)` is now:
  - `place(w)`, so `groupOf('veil')`, the names and `farStars` keep their group
  - `nebulae.add(NEBULAE.find((d) => d.id === w.id))`

  Rewrite the header's Veil and Cradle paragraph to say they're drawn by `nebula/`, fixed in the world.
- [ ] **Step 5: Run the tests and the build.** Run `npx vitest run src/components/universe` and `npm run build`. Expected: PASS, and a build with no missing export.
- [ ] **Step 6: Look at it.**
  - Run `npm run dev`, open `/#/universe`, and fly toward the Veil, then into the Cradle.
  - The clouds show where the landmarks did; the sky has no baked clouds.
  - The console has no shader error. A GLSL compile error shows here first, and Node can't catch it.
- [ ] **Step 7: Count and commit.**
  - `wc -l src/components/universe/scene.js` must be under 6226. Write the number in the commit body.
  - Run `node scripts/health.mjs --only glsl-sites,big-files`.

```bash
git add src/components/universe/deepspace.js src/components/universe/deepspaceShaders.js src/components/universe/mapSky.js src/components/universe/mapSky.test.js src/components/universe/scene.js
git commit -m "Deep space draws the Veil and the Cradle with the nebula renderer; the map's sky moves out of scene.js"
```

---

### Task 9: The Expanse's nebulae

**Files:**
- Modify: `src/components/expanse/scene/sectors.js`:
  - the header at `:1-17`
  - `WONDER.nebula` stays as the colour at `:42`; `PUFFS` at `:47` goes
  - delete the puff shaders and `nebula()` (`:52-112`)
  - the signature at `:114`
  - the nebula branch at `:151-154`
  - the specks at `:160-167`: a nebula has none; its cloud is its far self
  - `dispose` at `:220-226`
- Modify: `src/components/expanse/scene/sectors.test.js`
- Modify: `src/components/universe/scene.js`: `:209` adds `import { createSector } from '../expanse/scene/sectors'`, and `:734-742` adds the `make` option

**Interfaces:**
- Consumes: the renderer's `add` and `remove` (Task 4), through `deep.nebulae` (Task 8).
- Produces:
  - `createSector(sector, { tier, skyFar, build, nebulae = null })`. With `nebulae`, each nebula wonder is added on build and removed on `dispose`; without one, a nebula isn't drawn.
  - The wonder's `wonder:<id>` object is now an empty `Group` at its place, so names, picks and `sectors.test.js:69` hold.
  - `nebulaOf(w) → desc` (exported). It keeps today's colours: `rngOf(w.seed)`'s first draw is the hue, as at `:80-81`. It returns `{ id: w.id, at: [...w.at] (absolute), r: w.size, colors: ['#b48cff', <that hue at s 0.7, l 0.55>], seed: w.seed }`.
  - `scene.js` passes `make: (s, o) => createSector(s, { ...o, nebulae: deep.nebulae })` to `createExpanse`. Its `make` option exists (`expanse.js:49`, called at `:138`), so `expanse.js` is untouched.
- **To lane 2:** the contract the index plan (`:171-172`) asks lane 2 to keep is the one `add` on build and the one `remove` on dispose. Whichever lane merges second resolves that call site.

- [ ] **Step 1: Write the failing tests:**

```js
it('hands each nebula to the renderer at its own place, and takes it back', () => {
  let h = 0;
  const nebulae = { add: vi.fn(() => ++h), remove: vi.fn() };
  const s = createSector(HAND, { nebulae });
  expect(nebulae.add).toHaveBeenCalledTimes(1);
  const d = nebulae.add.mock.calls[0][0];
  expect(d).toMatchObject({ id: 'E:5,0:w0', at: [400000, 0, -20000], r: 400, seed: 1n });
  expect(d.colors[0]).toBe('#b48cff');
  expect(d.colors[1]).toMatch(/^#[0-9a-f]{6}$/);
  expect(nebulaOf(HAND.wonders[0])).toEqual(d);
  s.dispose();
  expect(nebulae.remove).toHaveBeenCalledWith(1);
});
it('keeps a wonder for a nebula, with no Points in it and no speck for it', () => {
  const s = createSector(HAND, { nebulae: { add: () => 1, remove() {} } });
  const w = s.group.getObjectByName('wonder:E:5,0:w0');
  expect(w.isPoints).toBeFalsy();
  expect(w.children).toHaveLength(0);
  expect(named(s.group, 'far-stars')[0].geometry.attributes.position.count).toBe(HAND.systems.length + HAND.wonders.length - 1);
  s.dispose();
});
it('draws no nebula, and says nothing, with no renderer', () => {
  expect(() => createSector(HAND).dispose()).not.toThrow();
});
```

- [ ] **Step 2: Run and see them fail.** Run `npx vitest run src/components/expanse/scene/sectors.test.js`. Expected: the three new tests FAIL; the existing six PASS.
- [ ] **Step 3: Implement** as above, including the two `scene.js` lines.
- [ ] **Step 4: Run** `npx vitest run src/components/expanse src/components/universe`. Expected: PASS.
- [ ] **Step 5: Look at it.** In `npm run dev`, set `window.__universeDebug.state.ship.x = 400000` and wait for a sector with a nebula. Its cloud grows as you fly at it and fogs you inside, and the console is clean. Then run `node scripts/health.mjs --only glsl-sites` and expect no more than Task 1's 607.
- [ ] **Step 6: Commit.** `git add src/components/expanse/scene/sectors.js src/components/expanse/scene/sectors.test.js src/components/universe/scene.js` then `git commit -m "Expanse: generated nebulae drawn by the nebula renderer, not 512 px points"`.

---

### Task 10: The poses and the browser measure

**Files:**
- Modify: `src/components/universe/poses.js` (two poses and a `nebula` branch in `poseFor`)
- Modify: `src/components/universe/poses.test.js` (the name list at `:15` grows by two, plus two tests)
- Modify: `scripts/universe-check.mjs:29` (`'in-nebula'` appended to `POSES`)
- Create: `scripts/lib/nebula-measure.mjs`
- Create: `scripts/lib/nebula-measure.test.mjs`
- Create: `scripts/nebula-check.mjs`

**Interfaces:**
- Consumes: `NEBULAE` and `insideOf`; the dev hooks as they are (`window.__universe().pose`, `.frames`; `__universeDebug.{ scene, camera, state, post, THREE }`). The page's dev hooks in `scene.js` are not touched.
- Produces:
  - **Poses:**
    - `'in-nebula': { nebula: 'cradle', inside: 0.45, back: 1.6, rise: 0.3 }`: 0.45 of its radius in from its middle on the home side, facing its heart.
    - `'veil-side': { nebula: 'veil', out: 20000, aside: 0.105, back: 1.6, rise: 0.3 }`: on the home side, looking `aside` of it the way the Maw pose does (`poses.js:107-113`), so the Veil sits about 6° right of the middle.
  - **In `nebula-measure.mjs`:**
    - `diffMask({ on, off, width, height }, threshold = 12) → Uint8Array`: luminance differences of RGBA buffers.
    - `centroid(mask, width) → { x, y, n }`
    - `bestRotation(a, b, { width, height, about: [x, y], radius, range = 60, step = 1 }) → degrees`: the angle that best turns luminance image `a` about `about` into `b`, inside `radius`.
  - **`nebula-check.mjs --url <dev server> [--quality high] [--out lab/universe/nebula-check.json]`:**
    - It opens `/universe` as `universe-check.mjs:156-181` does: the same storage keys and the same two waits. A dev server is required (`npx vite`), so it carries no server code.
    - Exit 1 on a failed measure or a console error.

**What `nebula-check.mjs` does:**
1. **Pose A.**
   - Hold `'veil-side'` with the grain off.
   - Shoot with `scene.getObjectByName('nebulae').visible` true, then false.
   - Project `scene.getObjectByName('deep-veil')` through the camera to pixels.
2. **Parallax.**
   - Add `5000 ×` the view's right vector (`(1, 0, 0)` turned by `state.held.view.quat`) to `state.held.view.target`, wait two frames, and shoot both again.
   - **Measured:** the centroid shift of `diffMask(on, off)` between A and B.
   - **Predicted:** the projected shift.
   - **Pass:** the predicted shift is at least 100 px, and the measured one is within `max(8 px, 10 %)` of it.
3. **Roll.**
   - Hold `'veil-side'` again and turn `state.held.view.quat` 30° about its own z.
   - **The cloud:** `bestRotation` of the cloud's difference image about its centroid, A against rolled.
   - **The stars:** the same on the clouds-off shots about the screen's middle.
   - **Pass:** the stars turn 30 ± 3°, and the cloud turns within 3° of the stars. On `main` the landmark's texture didn't turn.
4. **Inside.**
   - Hold `'in-nebula'` and shoot on and off.
   - **Pass:** the difference covers at least 60 % of the frame.
5. **Report.** Write the JSON, listing the shifts, the angles and the share.

- [ ] **Step 1: Write the failing tests.**

```js
// nebula-measure.test.mjs, on synthetic images (no browser)
const W = 200, H = 120;
const img = (f) => { const d = new Uint8Array(W * H * 4); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = f(x, y); d.set([v, v, v, 255], (y * W + x) * 4); } return d; };
const blob = (cx, cy) => img((x, y) => 255 * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / 50));
const ell = (deg) => { const a = (deg * Math.PI) / 180; return img((x, y) => { const u = (x - 100) * Math.cos(a) + (y - 60) * Math.sin(a), v = -(x - 100) * Math.sin(a) + (y - 60) * Math.cos(a); return (u > -20 && u < 30 && Math.abs(v) < 4) || (v > -20 && v < 4 && Math.abs(u + 16) < 4) ? 255 : 0; }); };
const black = img(() => 0);
it('finds a blob and how far it moved', () => {
  const a = centroid(diffMask({ on: blob(60, 50), off: black, width: W, height: H }), W);
  const b = centroid(diffMask({ on: blob(100, 50), off: black, width: W, height: H }), W);
  expect(b.x - a.x).toBeCloseTo(40, 0);
});
it('says nothing, not NaN, of an empty frame', () => {
  expect(centroid(diffMask({ on: black, off: black, width: W, height: H }), W)).toEqual({ x: 0, y: 0, n: 0 });
});
it('finds how far a shape turned, and that a shape that didn’t turn didn’t', () => {
  expect(Math.abs(bestRotation(ell(0), ell(30), { width: W, height: H, about: [100, 60], radius: 50 }) - 30)).toBeLessThanOrEqual(1);
  expect(bestRotation(ell(0), ell(0), { width: W, height: H, about: [100, 60], radius: 50 })).toBe(0);
});
// poses.test.js
it('puts in-nebula inside the Cradle’s gas, the eye too', () => {
  const p = poseFor('in-nebula');
  const cradle = NEBULAE.find((d) => d.id === 'cradle');
  expect(insideOf([cradle], p.at).depth).toBeGreaterThan(0.5);
  expect(insideOf([cradle], p.eye)).not.toBeNull();
});
it('puts veil-side 20,000 off, the Veil right of the middle, still in view 5,000 to the right', () => {
  const p = poseFor('veil-side');
  const veil = WONDERS.find((w) => w.id === 'veil').at;
  const view = norm(sub(p.look, p.eye));
  const off = Math.acos(dot(view, norm(sub(veil, p.eye))));
  expect(off).toBeGreaterThan(0.08); expect(off).toBeLessThan(0.13);
  const right = norm([-view[2], 0, view[0]]);
  const moved = p.eye.map((v, i) => v + right[i] * 5000);
  expect(Math.acos(dot(view, norm(sub(veil, moved))))).toBeLessThan(0.45); // (inside the lens's half-width at 16:9)
});
```

- [ ] **Step 2: Run and see them fail.** Run `npx vitest run scripts/lib/nebula-measure.test.mjs src/components/universe/poses.test.js`. Expected: FAIL (the module is missing; the poses are unknown).
- [ ] **Step 3: Implement** the poses, the measure module and `nebula-check.mjs` as above. `bestRotation` samples bilinearly and scores by mean absolute difference inside the radius.
- [ ] **Step 4: Run and see them pass.** Same command. Expected: PASS.
- [ ] **Step 5: Run the check.** Run `npx vite --port 5173` in one shell and `node scripts/nebula-check.mjs --url http://127.0.0.1:5173` in another. Expected: three `ok` lines (parallax, roll, inside) and exit 0. If a measure fails, the fault is in Tasks 4–5, not the threshold: no threshold moves to pass.
- [ ] **Step 6: The whole-route check.** If `scripts/universe-endless-check.mjs` is on `main`, add its nebula step: fly into the Cradle and run the three measures through `scripts/lib/nebula-measure.mjs`. If it isn't, Task 11's hand-off says so for whichever lane merges second.
- [ ] **Step 7: Commit.** `git add src/components/universe/poses.js src/components/universe/poses.test.js scripts/universe-check.mjs scripts/lib/nebula-measure.mjs scripts/lib/nebula-measure.test.mjs scripts/nebula-check.mjs` then `git commit -m "Nebulae: an inside pose, and a browser measure of parallax, roll and fog"`.

---

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
