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

