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

