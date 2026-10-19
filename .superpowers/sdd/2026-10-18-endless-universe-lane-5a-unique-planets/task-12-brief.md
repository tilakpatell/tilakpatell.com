### Task 12: Worlds you can’t build on

**Files:**
- Modify: `src/components/expanse/flight/shared.js:58-73` (`db`, `loader`, `owner`), `:131-137` (`build`) and `:219-222` (`prompt`)
- Test: `src/components/expanse/flight/shared.test.js`

**Interfaces:**
- Consumes: `spec.buildable` (Task 5).
- Produces: `readOnly = spec.buildable === false`, which does four things:
  - `db` is null, so there’s no loader, no sign-in and no durable read or write.
  - `build()` toasts “Nothing can be built on this world.” and places nothing, the visit’s own turrets included.
  - `prompt()` gives `{ build: false, unbuild: false, kept: false, ... }`.
  - The room (poses and shots, nothing durable) works as before.
  - A spec with no `buildable` key (the test’s hand-made ones) is as today.

- [ ] **Step 1: Write the failing tests**

```js
describe('a world nothing may be built on', () => {
  const generated = { id: 'e:3,-2:0:1', pois: [], buildable: false };

  it('says so, and places nothing, kept or not', async () => {
    const w = world({ spec: generated });
    await flush();
    w.shared.step(0.016, low(), snap(['KeyB']));
    await flush();
    expect(w.loader.placed).toHaveLength(0);
    expect(w.toasts()).toEqual(['Nothing can be built on this world.']);
    expect(w.draw.structures.size).toBe(0);
  });

  it('never reaches the durable world: no loader, nothing held', async () => {
    const w = world({ spec: generated });
    await flush();
    w.shared.step(0.016, low(), snap());
    expect(w.loader.updates).toBe(0);
    expect(w.shared.prompt(low())).toMatchObject({ build: false, unbuild: false, kept: false });
    expect(w.shared.built()).toEqual([]);
  });

  it('keeps the room: shots still go out', async () => {
    const w = world({ spec: generated });
    await flush();
    w.shared.step(0.016, low(), snap([], ['fire']));
    expect(w.online.sent.some(([t]) => t === 'shot')).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/expanse/flight/shared.test.js -t "nothing may be built"`
Expected: FAIL. A turret is placed and the toast is “Turret built.”.

- [ ] **Step 3: Implement the `readOnly` branches**

- [ ] **Step 4: Run the whole file to see it pass**

Run: `npx vitest run src/components/expanse/flight/shared.test.js`
Expected: PASS. Every existing test is unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/expanse/flight/shared.js src/components/expanse/flight/shared.test.js
git commit -m "Keep generated planets read-only: nothing built, nothing written"
```

---

