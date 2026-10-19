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

