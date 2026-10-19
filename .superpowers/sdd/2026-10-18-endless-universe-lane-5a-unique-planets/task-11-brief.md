### Task 11: The bake in a worker, cached in memory

**Files:**
- Create: `src/lib/land/flight/orbitMap.worker.js` and `src/lib/land/flight/orbitMap.worker.test.js`
- Create: `src/lib/land/flight/orbitMaps.js` and `src/lib/land/flight/orbitMaps.test.js`

**Interfaces:**
- Consumes: `bakeOrbitMap` and `orbitMapSize` (Task 10); `createWorkerPool`’s face (`runtime/workers.js:14-17`): `define(name, make, { size })`, `request(name, msg) → Promise<answer | null>` and `close(name)`.
- Produces:
  - **The worker.** Given `{ key, spec, width, height }`, it posts `{ key, width, height, rgba, biome }` with `[rgba.buffer, biome.buffer]` transferred. It ignores `{ type: 'cancel' }`. Its header follows `terrain.worker.js:1-7`.
  - `ORBIT_WORKER = 'flight-orbit-map'` and `makeOrbitWorker() → new Worker(new URL('./orbitMap.worker.js', import.meta.url), { type: 'module' })`. There’s precedent for a worker in lib in `lib/level/png16Off.js:14`.
  - `createOrbitMaps({ workers, make = makeOrbitWorker, cap = 16 }) → { get(spec, tier) → Promise<map | null>, peek(spec, tier) → map | null, stats() → { cached, flying }, dispose() }`, where:
    - It calls `workers.define(ORBIT_WORKER, make, { size: 1 })` once.
    - The key is `` `${spec.id}:${width}x${height}` ``.
    - It answers from the cache or from the bake already in flight.
    - A null answer resolves null and isn’t cached.
    - It keeps at most `cap` maps and drops the least recently used.
    - `dispose` closes the pool’s group and clears the cache.

- [ ] **Step 1: Write the failing tests**

`orbitMap.worker.test.js` follows `mapWorker.test.js`’s pattern: a `globalThis.self` with `postMessage`, then `await import('./orbitMap.worker.js')`.
- `'answers a bake with its buffers handed over'`, using `roundSpec()` at 16 × 8.
- `'says nothing to a cancel'`.

`orbitMaps.test.js` uses a fake pool, `{ define, request: vi.fn(async (name, msg) => answers.shift()?.(msg) ?? null), close: vi.fn() }`:

```js
it('bakes once for two asks at once, and serves the next from memory', async () => {
  const maps = createOrbitMaps({ workers: pool, make: () => null });
  const [a, b] = await Promise.all([maps.get(spec, 'mid'), maps.get(spec, 'mid')]);
  expect(a).toBe(b);
  expect(pool.request).toHaveBeenCalledTimes(1);
  expect(pool.request.mock.calls[0][1]).toMatchObject({ key: `${spec.id}:256x128`, width: 256, height: 128, spec });
  expect(await maps.get(spec, 'low')).toBe(a);
  expect(maps.peek(spec, 'mid')).toBe(a);
});
```

And these, one assertion line each:
- `'asks the high tier for the big map'`: the request’s key ends `:512x256`.
- `'forgets the least recently used past its cap'`: with `cap: 2`, ask for A, B, C, then A again. `request` has been called 4 times. `peek(C)` is still a map, and `peek(B)` is null: B went when A came back.
- `'answers null for a cancelled or failed bake, keeps nothing, asks again next time'`: the first answer is null, so `get` resolves null and `peek` is null. Asking again calls `request` a second time.
- `'closes its workers on dispose'`: `pool.close` is called with `ORBIT_WORKER`, and `stats().cached` is 0.
- `'stores nothing'`: read the source of `orbitMaps.js` and `orbitMap.js` (`readFileSync`). Neither matches `/localStorage|indexedDB|rt\.store|rt\.saves/`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/land/flight/orbitMap.worker.test.js src/lib/land/flight/orbitMaps.test.js`
Expected: FAIL, the modules don’t exist.

- [ ] **Step 3: Implement the worker and `orbitMaps.js`**

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/lib/land/flight/orbitMap.worker.test.js src/lib/land/flight/orbitMaps.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/land/flight/orbitMap.worker.js src/lib/land/flight/orbitMap.worker.test.js src/lib/land/flight/orbitMaps.js src/lib/land/flight/orbitMaps.test.js
git commit -m "Bake orbit maps in a worker and keep them in memory only"
```

---

