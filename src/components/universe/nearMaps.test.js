import { describe, expect, it, vi } from 'vitest';
import { createNearMaps, evict, wanted } from './nearMaps';

// a texture that remembers being disposed
const tex = (url) => ({ isTexture: true, url, disposed: false, dispose() { this.disposed = true; } });
// a load whose promises the test resolves (or rejects) by hand
const loader = () => {
  const calls = [];
  const load = vi.fn((url) => new Promise((resolve, reject) => calls.push({ url, resolve: () => resolve(tex(url)), reject: () => reject(new Error(`no ${url}`)) })));
  return { load, calls };
};
const flush = () => new Promise((r) => setTimeout(r, 0));
// a planet the manager can work on: its near set is one file each
const planet = (id, x, set = [{ name: id, file: `${id}-hq.webp`, colour: true }]) => ({
  id,
  at: [x, 0, 0],
  r: 1,
  nearSet: () => set,
  swapMaps: vi.fn(),
  nearGeometry: vi.fn(),
});

describe('which planets want their near maps', () => {
  it('wants the planets within six radii, nearest first', () => {
    expect(wanted([0, 0, 0], [{ id: 'a', at: [10, 0, 0], r: 1 }, { id: 'b', at: [3, 0, 0], r: 1 }, { id: 'c', at: [5, 0, 0], r: 1 }], { near: 6 })).toEqual(['b', 'c']);
  });
  it('measures in each planet’s own radii', () => {
    expect(wanted([0, 0, 0], [{ id: 'big', at: [50, 0, 0], r: 10 }, { id: 'small', at: [8, 0, 0], r: 1 }], { near: 6 })).toEqual(['big']);
  });
  it('holds one it already has a little further out, so the edge doesn’t flicker', () => {
    const ps = [{ id: 'a', at: [7, 0, 0], r: 1 }];
    expect(wanted([0, 0, 0], ps, { near: 6 })).toEqual([]);
    expect(wanted([0, 0, 0], ps, { near: 6, hold: 8, resident: ['a'] })).toEqual(['a']);
  });
});

describe('the resident budget', () => {
  it('keeps the two nearest wanted and drops the rest', () => {
    expect(evict(['a', 'b'], ['c', 'b'], 2)).toEqual({ keep: ['c', 'b'], drop: ['a'] });
  });
  it('drops nothing while there is room', () => {
    expect(evict(['a'], ['a', 'b'], 2)).toEqual({ keep: ['a', 'b'], drop: [] });
  });
});

describe('the near maps, loaded and swapped', () => {
  it('wraps a near cloud map round before it goes up, as the far one does', async () => {
    const { load, calls } = loader();
    const near = createNearMaps({ level: 'high', load });
    const a = planet('a', 3, [{ name: 'a-clouds', file: 'a-clouds-hq.webp', colour: true }, { name: 'a', file: 'a-hq.webp', colour: true }]);
    near.update([0, 0, 0], [a]);
    calls.forEach((c) => c.resolve());
    await flush();
    const T2 = a.swapMaps.mock.calls[0][0];
    expect(T2['a-clouds'].wrapS).toBe(1000); // (THREE.RepeatWrapping)
    expect(T2.a.wrapS).toBeUndefined();
  });

  it('installs a planet’s near set when it arrives and the planet is still near', async () => {
    const { load, calls } = loader();
    const near = createNearMaps({ level: 'high', load });
    const a = planet('a', 3);
    near.update([0, 0, 0], [a]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(calls[0].url).toBe('/textures/universe/a-hq.webp');
    near.update([0, 0, 0], [a]); // (no second load while one's in flight)
    expect(load).toHaveBeenCalledTimes(1);
    calls[0].resolve();
    await flush();
    expect(a.swapMaps).toHaveBeenCalledTimes(1);
    expect(a.swapMaps.mock.calls[0][0].a.url).toBe('/textures/universe/a-hq.webp');
    expect(a.nearGeometry).toHaveBeenCalledWith(true, 'high');
    expect(near.resident()).toEqual(['a']);
  });

  it('does not install a set that arrives after the planet left', async () => {
    const { load, calls } = loader();
    const forget = vi.fn();
    const near = createNearMaps({ level: 'high', load, forget });
    const a = planet('a', 3);
    near.update([0, 0, 0], [a]);
    near.update([100, 0, 0], [a]); // (a fast fly-by: gone before the maps came)
    calls[0].resolve();
    await flush();
    expect(a.swapMaps).not.toHaveBeenCalled();
    expect(a.nearGeometry).not.toHaveBeenCalledWith(true, 'high');
    const t = await load.mock.results[0].value;
    expect(t.disposed).toBe(true);
    expect(forget).toHaveBeenCalledWith('/textures/universe/a-hq.webp');
    expect(near.resident()).toEqual([]);
  });

  it('disposes a dropped planet’s near set', async () => {
    const { load, calls } = loader();
    const near = createNearMaps({ level: 'high', load });
    const ps = [planet('a', 3), planet('b', 40), planet('c', 80)];
    const at = (x) => near.update([x, 0, 0], ps);
    at(0);
    calls[0].resolve();
    await flush();
    at(38); // b comes near; a is 35 out: dropped (only near ones are kept)
    calls[1].resolve();
    await flush();
    expect(ps[0].swapMaps).toHaveBeenLastCalledWith(null);
    expect(ps[0].nearGeometry).toHaveBeenLastCalledWith(false);
    expect((await load.mock.results[0].value).disposed).toBe(true);
    expect(near.resident()).toEqual(['b']);
  });

  it('keeps the two nearest when three are near, dropping the furthest', async () => {
    const { load, calls } = loader();
    const near = createNearMaps({ level: 'high', load });
    // three close together (C-137 and its moons): the ship by a and b
    const ps = [planet('a', 2), planet('b', 4), planet('c', 5.5)];
    near.update([0, 0, 0], ps);
    expect(calls.map((c) => c.url)).toEqual(['/textures/universe/a-hq.webp', '/textures/universe/b-hq.webp']);
    for (const c of calls) c.resolve();
    await flush();
    expect(near.resident().sort()).toEqual(['a', 'b']);
    // the ship moves on past a: now b and c are nearest; a goes
    near.update([5, 0, 0], ps);
    calls[2].resolve();
    await flush();
    expect(near.resident().sort()).toEqual(['b', 'c']);
    expect(ps[0].swapMaps).toHaveBeenLastCalledWith(null);
    expect((await load.mock.results[0].value).disposed).toBe(true);
    expect((await load.mock.results[1].value).disposed).toBe(false);
  });

  it('skips a planet with nothing to load and nothing to reshape', () => {
    const { load } = loader();
    const near = createNearMaps({ level: 'high', load });
    const station = { id: 's', at: [1, 0, 0], r: 1, nearSet: () => [] };
    near.update([0, 0, 0], [station]);
    expect(load).not.toHaveBeenCalled();
    expect(near.resident()).toEqual([]);
  });

  it('a missing map leaves the planet its standard one, the rest still come', async () => {
    const { load, calls } = loader();
    const near = createNearMaps({ level: 'high', load });
    const a = planet('a', 3, [
      { name: 'a', file: 'a-hq.webp', colour: true },
      { name: 'a-normal', file: 'a-normal-hq.webp', colour: false },
    ]);
    near.update([0, 0, 0], [a]);
    calls[0].resolve();
    calls[1].reject();
    await flush();
    const T2 = a.swapMaps.mock.calls[0][0];
    expect(Object.keys(T2)).toEqual(['a']);
  });

  it('falls back through a set’s files in order when one won’t load', async () => {
    const { load, calls } = loader();
    const near = createNearMaps({ level: 'ultra', load });
    const a = planet('a', 3, [{ name: 'a', file: 'a-xl.ktx2', fallback: 'a-hq.webp', colour: true }]);
    near.update([0, 0, 0], [a]);
    calls[0].reject();
    await flush();
    expect(calls[1].url).toBe('/textures/universe/a-hq.webp');
    calls[1].resolve();
    await flush();
    expect(a.swapMaps.mock.calls[0][0].a.url).toBe('/textures/universe/a-hq.webp');
  });

  it('does nothing on low or on a small screen', () => {
    for (const opts of [{ level: 'low' }, { level: 'high', small: true }]) {
      const { load } = loader();
      const near = createNearMaps({ ...opts, load });
      near.update([0, 0, 0], [planet('a', 2)]);
      expect(load).not.toHaveBeenCalled();
      expect(near.resident()).toEqual([]);
    }
  });

  it('puts every planet back and disposes its sets when the scene goes', async () => {
    const { load, calls } = loader();
    const near = createNearMaps({ level: 'high', load });
    const a = planet('a', 2);
    const b = planet('b', 3);
    near.update([0, 0, 0], [a, b]);
    calls[0].resolve();
    await flush();
    near.dispose();
    calls[1].resolve(); // (b's arrives after: never installed)
    await flush();
    expect(a.swapMaps).toHaveBeenLastCalledWith(null);
    expect(b.swapMaps).not.toHaveBeenCalled();
    expect((await load.mock.results[0].value).disposed).toBe(true);
    expect((await load.mock.results[1].value).disposed).toBe(true);
  });
});

describe('a planet that comes back before its old set arrived', () => {
  it('keeps the texture the loader’s cache gave both sets', async () => {
    const shared = tex('/textures/universe/a-hq.webp');
    const waiting = [];
    const load = vi.fn(() => new Promise((r) => waiting.push(() => r(shared))));
    const near = createNearMaps({ level: 'high', load });
    const a = planet('a', 3);
    near.update([0, 0, 0], [a]);
    near.update([100, 0, 0], [a]); // gone
    near.update([0, 0, 0], [a]); // back: a second set, the same cached texture
    expect(load).toHaveBeenCalledTimes(2);
    for (const go of waiting) go(); // (the old set lands first, then the new)
    await flush();
    expect(shared.disposed).toBe(false);
    expect(a.swapMaps).toHaveBeenCalledWith({ a: shared });
  });
});
