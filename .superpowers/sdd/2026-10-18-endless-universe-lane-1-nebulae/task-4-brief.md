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

