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

