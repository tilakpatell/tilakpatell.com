import { describe, expect, it, vi } from 'vitest';
import { cellKey, cellOf, createChunks, RETRY_UPDATES } from './chunks';

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function make(over = {}) {
  const built = [];
  const disposed = [];
  const o = {
    size: 10, near: 12, far: 20,
    build: vi.fn((key, cx, cz) => { const h = { key, cx, cz, dispose: () => disposed.push(key) }; built.push(key); return h; }),
    prepare: vi.fn(async () => {}),
    ...over,
  };
  return { c: createChunks(o), o, built, disposed };
}

// run updates until nothing new gets started
async function settle(c, pos, heading, n = 40) {
  for (let i = 0; i < n; i++) { c.update(pos, heading); await flush(); }
}

describe('cell math', () => {
  it('floors, including negative coordinates', () => {
    expect(cellOf(0, 0, 10)).toEqual({ ix: 0, iz: 0 });
    expect(cellOf(9.99, 10, 10)).toEqual({ ix: 0, iz: 1 });
    expect(cellOf(-0.01, -10, 10)).toEqual({ ix: -1, iz: -1 });
    expect(cellOf(-10.01, -20.5, 10)).toEqual({ ix: -2, iz: -3 });
    expect(cellKey(-1, 2)).toBe('-1,2');
  });
});

describe('near, far and hysteresis', () => {
  it('builds only cells within near and shows them', async () => {
    const { c, built } = make();
    await settle(c, { x: 5, z: 5 }, { x: 0, z: 0 });
    expect(built).toContain('0,0');
    expect(built).toContain('1,0'); // box is 0 away at x=10
    expect(built).not.toContain('3,0'); // box starts at 30, 25 away
    expect(c.visible('0,0')).toBe(true);
    expect(c.visible('3,0')).toBe(false);
  });

  it('finds negative cells', async () => {
    const { c, built } = make();
    await settle(c, { x: -5, z: -5 }, { x: 0, z: 0 });
    expect(built).toContain('-1,-1');
    expect(c.visible('-1,-1')).toBe(true);
  });

  it('keeps a shown cell until past far, then hides it', async () => {
    const { c } = make();
    await settle(c, { x: 5, z: 5 }, { x: 0, z: 0 });
    expect(c.visible('0,0')).toBe(true);
    c.update({ x: 30, z: 5 }, { x: 0, z: 0 }); // 20 from the box: at far, not past
    expect(c.visible('0,0')).toBe(true);
    c.update({ x: 31, z: 5 }, { x: 0, z: 0 }); // 21 from the box
    expect(c.visible('0,0')).toBe(false);
  });

  it('does not flicker when oscillating across near', async () => {
    const { c } = make();
    await settle(c, { x: 5, z: 5 }, { x: 0, z: 0 });
    const seen = [];
    for (let i = 0; i < 20; i++) {
      c.update({ x: i % 2 ? 21 : 23, z: 5 }, { x: 0, z: 0 }); // 11 and 13 from cell 0,0
      await flush();
      seen.push(c.visible('0,0'));
    }
    expect(seen.every(Boolean)).toBe(true);
  });

  it('lets go past twice far and builds again when back', async () => {
    const { c, built, disposed } = make();
    await settle(c, { x: 5, z: 5 }, { x: 0, z: 0 });
    expect(c.cells()).toContain('0,0');
    c.update({ x: 5 + 60, z: 5 }, { x: 0, z: 0 });
    expect(disposed).toContain('0,0');
    expect(c.cells()).not.toContain('0,0');
    const n = built.filter((k) => k === '0,0').length;
    await settle(c, { x: 5, z: 5 }, { x: 0, z: 0 });
    expect(built.filter((k) => k === '0,0').length).toBe(n + 1);
  });

  it('hides but keeps a cell between far and twice far', async () => {
    const { c, disposed } = make();
    await settle(c, { x: 5, z: 5 }, { x: 0, z: 0 });
    c.update({ x: 40, z: 5 }, { x: 0, z: 0 }); // 30 away
    expect(c.visible('0,0')).toBe(false);
    expect(disposed).not.toContain('0,0');
    expect(c.cells()).toContain('0,0');
  });
});

describe('ahead bias', () => {
  it('wants cells ahead of the heading', async () => {
    const { c, built } = make({ near: 8, ahead: 30 });
    await settle(c, { x: 5, z: 5 }, { x: 1, z: 0 }); // looks along +x
    expect(built).toContain('3,0'); // ahead point at x=35
    expect(built).not.toContain('-3,0');
  });

  it('normalises the heading and ignores a zero one', async () => {
    const a = make({ near: 8, ahead: 30 });
    await settle(a.c, { x: 5, z: 5 }, { x: 100, z: 0 });
    expect(a.built).toContain('3,0');
    const b = make({ near: 8, ahead: 30 });
    await settle(b.c, { x: 5, z: 5 }, { x: 0, z: 0 });
    expect(b.built).not.toContain('3,0');
  });

  it('defaults ahead to size', async () => {
    const { c, built } = make({ near: 2 });
    await settle(c, { x: 5, z: 5 }, { x: 1, z: 0 });
    expect(built).toContain('1,0');
  });
});

describe('steps', () => {
  it('starts at most one step per update, and none while one is in flight', async () => {
    let release;
    const gate = new Promise((r) => { release = r; });
    const { c, o } = make({ prepare: vi.fn(() => gate) });
    c.update({ x: 5, z: 5 }, { x: 0, z: 0 });
    c.update({ x: 5, z: 5 }, { x: 0, z: 0 });
    c.update({ x: 5, z: 5 }, { x: 0, z: 0 });
    await flush();
    expect(o.build).toHaveBeenCalledTimes(1);
    release();
    await flush();
    c.update({ x: 5, z: 5 }, { x: 0, z: 0 });
    expect(o.build).toHaveBeenCalledTimes(2);
  });

  it('never builds one cell twice at once and nearest goes first', async () => {
    const { c, built } = make();
    c.update({ x: 5, z: 5 }, { x: 0, z: 0 });
    expect(built).toEqual(['0,0']);
  });

  it('awaits a build that returns a promise', async () => {
    const { c, o } = make({ build: vi.fn(async (key) => ({ key })) });
    await settle(c, { x: 5, z: 5 }, { x: 0, z: 0 });
    expect(o.prepare).toHaveBeenCalled();
    expect(c.visible('0,0')).toBe(true);
  });

  it('is not visible until prepared', async () => {
    let release;
    const { c } = make({ prepare: () => new Promise((r) => { release = r; }) });
    c.update({ x: 5, z: 5 }, { x: 0, z: 0 });
    await flush();
    expect(c.visible('0,0')).toBe(false);
    release();
    await flush();
    expect(c.visible('0,0')).toBe(true);
  });

  it('lets go of a cell that finished after it was left far behind', async () => {
    let release;
    const { c, disposed } = make({ prepare: () => new Promise((r) => { release = r; }) });
    c.update({ x: 5, z: 5 }, { x: 0, z: 0 });
    await flush();
    c.update({ x: 500, z: 5 }, { x: 0, z: 0 });
    release();
    await flush();
    expect(disposed).toContain('0,0');
    expect(c.visible('0,0')).toBe(false);
  });
});

describe('fixed cell list', () => {
  it('only knows the listed cells', async () => {
    const { c, built } = make({ cells: ['0,0', '5,5'] });
    await settle(c, { x: 5, z: 5 }, { x: 0, z: 0 });
    expect(built).toEqual(['0,0']);
  });
});

describe('failures', () => {
  it('skips a cell whose build throws, builds others, retries after a while', async () => {
    let fail = true;
    const { c, o } = make({
      build: vi.fn((key) => { if (key === '0,0' && fail) throw new Error('x'); return { key }; }),
    });
    await settle(c, { x: 5, z: 5 }, { x: 0, z: 0 }, 5);
    expect(c.visible('0,0')).toBe(false);
    expect(c.visible('1,0')).toBe(true); // grid not wedged
    const calls = o.build.mock.calls.filter((a) => a[0] === '0,0').length;
    expect(calls).toBe(1);
    fail = false;
    await settle(c, { x: 5, z: 5 }, { x: 0, z: 0 }, RETRY_UPDATES + 5);
    expect(c.visible('0,0')).toBe(true);
  });

  it('survives a rejected prepare and disposes the half-made handle', async () => {
    const { c, disposed } = make({ prepare: vi.fn(async (h) => { if (h.key === '0,0') throw new Error('x'); }) });
    await settle(c, { x: 5, z: 5 }, { x: 0, z: 0 }, 5);
    expect(c.visible('0,0')).toBe(false);
    expect(disposed).toContain('0,0');
    expect(c.visible('1,0')).toBe(true);
  });

  it('gives up on a cell that keeps failing', async () => {
    const { c, o } = make({ build: vi.fn((key) => { if (key === '0,0') throw new Error('x'); return { key }; }) });
    await settle(c, { x: 5, z: 5 }, { x: 0, z: 0 }, RETRY_UPDATES * 6);
    expect(o.build.mock.calls.filter((a) => a[0] === '0,0').length).toBeLessThanOrEqual(3);
  });
});

describe('prepareAll', () => {
  it('builds every listed cell and reports progress', async () => {
    const keys = ['0,0', '1,0', '2,0', '3,0'];
    const { c, built } = make({ cells: keys });
    const seen = [];
    await c.prepareAll((f) => seen.push(f), () => true);
    expect(built.sort()).toEqual(keys);
    expect(seen[seen.length - 1]).toBe(1);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(seen.length).toBeGreaterThan(1);
  });

  it('stops when alive turns false', async () => {
    const keys = ['0,0', '1,0', '2,0', '3,0'];
    const { c, built } = make({ cells: keys });
    let n = 0;
    await c.prepareAll(() => {}, () => ++n <= 2);
    expect(built.length).toBe(2);
  });

  it('afterwards update only decides what is drawn', async () => {
    const keys = ['0,0', '9,9'];
    const { c, o, disposed } = make({ cells: keys });
    await c.prepareAll(() => {}, () => true);
    const n = o.build.mock.calls.length;
    c.update({ x: 5, z: 5 }, { x: 0, z: 0 });
    expect(c.visible('0,0')).toBe(true);
    expect(c.visible('9,9')).toBe(false);
    c.update({ x: 5000, z: 5 }, { x: 0, z: 0 }); // far past twice far
    expect(disposed).toEqual([]);
    expect(o.build.mock.calls.length).toBe(n);
    c.update({ x: 95, z: 95 }, { x: 0, z: 0 });
    expect(c.visible('9,9')).toBe(true);
  });

  it('survives a failing cell and still finishes', async () => {
    const { c } = make({ cells: ['0,0', '1,0'], build: vi.fn((key) => { if (key === '0,0') throw new Error('x'); return { key }; }) });
    const seen = [];
    await c.prepareAll((f) => seen.push(f), () => true);
    expect(seen[seen.length - 1]).toBe(1);
  });

  it('needs a finite list', async () => {
    const { c } = make();
    await expect(c.prepareAll(() => {}, () => true)).rejects.toThrow();
  });
});

describe('dispose', () => {
  it('lets every cell go and ignores later updates', async () => {
    const { c, disposed, o } = make();
    await settle(c, { x: 5, z: 5 }, { x: 0, z: 0 });
    const had = c.cells().slice();
    c.dispose();
    expect(disposed.sort()).toEqual(had.sort());
    expect(c.cells()).toEqual([]);
    const n = o.build.mock.calls.length;
    c.update({ x: 5, z: 5 }, { x: 0, z: 0 });
    expect(o.build.mock.calls.length).toBe(n);
    expect(c.visible('0,0')).toBe(false);
  });

  it('disposes a handle once when let go during prepare', async () => {
    let release;
    let calls = 0;
    const { c } = make({
      build: vi.fn(() => ({ dispose: () => { if (++calls > 1) throw new Error('twice'); } })),
      prepare: () => new Promise((r) => { release = r; }),
    });
    c.update({ x: 5, z: 5 }, { x: 0, z: 0 });
    await flush();
    c.dispose();
    release();
    await flush();
    expect(calls).toBe(1);
  });

  it('skips prepare and disposes when let go during build', async () => {
    let release;
    const disposed = [];
    const prepare = vi.fn(async () => {});
    const { c } = make({
      build: () => new Promise((r) => { release = () => r({ dispose: () => disposed.push(1) }); }),
      prepare,
    });
    c.update({ x: 5, z: 5 }, { x: 0, z: 0 });
    c.dispose();
    release();
    await flush();
    expect(prepare).not.toHaveBeenCalled();
    expect(disposed).toEqual([1]);
  });
});

describe('prepareAll against update', () => {
  it('update neither builds nor lets go while it runs, and waits for a busy cell', async () => {
    let release;
    let first = true;
    const { c, o, disposed } = make({
      cells: ['0,0', '1,0'],
      prepare: vi.fn(() => (first ? ((first = false), new Promise((r) => { release = r; })) : Promise.resolve())),
    });
    c.update({ x: 5, z: 5 }, { x: 0, z: 0 }); // starts 0,0
    await flush();
    const p = c.prepareAll(() => {}, () => true);
    await flush();
    c.update({ x: 5000, z: 5 }, { x: 0, z: 0 });
    expect(disposed).toEqual([]);
    expect(o.build).toHaveBeenCalledTimes(1);
    release();
    await p;
    expect(o.build).toHaveBeenCalledTimes(2); // 0,0 not built twice
    expect(disposed).toEqual([]);
  });
});

describe('forget', () => {
  it('lets a ready cell go now and makes it afresh when next wanted', async () => {
    const { c, built, disposed } = make();
    await settle(c, { x: 5, z: 5 }, { x: 0, z: 0 });
    const before = built.filter((k) => k === '0,0').length;
    c.forget('0,0');
    expect(disposed).toContain('0,0');
    expect(c.visible('0,0')).toBe(false);
    await settle(c, { x: 5, z: 5 }, { x: 0, z: 0 });
    expect(built.filter((k) => k === '0,0').length).toBe(before + 1);
    expect(c.visible('0,0')).toBe(true);
  });

  it('a cell forgotten while it is made is disposed once it is done, never shown', async () => {
    let release;
    const { c, disposed } = make({ prepare: vi.fn(() => new Promise((r) => (release = r))) });
    c.update({ x: 5, z: 5 }, { x: 0, z: 0 });
    await flush();
    c.forget('0,0');
    release();
    await flush();
    expect(disposed).toEqual(['0,0']);
    expect(c.visible('0,0')).toBe(false);
  });

  it('forgetting a cell it never held does nothing', () => {
    const { c } = make();
    expect(() => c.forget('9,9')).not.toThrow();
  });
});
