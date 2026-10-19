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

