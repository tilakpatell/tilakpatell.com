import { describe, expect, it, vi } from 'vitest';
import { cellSizeOf, createThingCells, drawRange } from './thingCells';

const thing = (x, z, { late = false } = {}) => {
  const e = { x, z, object: null, low: null };
  const object = { visible: true, name: `${x},${z}` };
  let resolve;
  e.done = new Promise((r) => (resolve = r)).then(() => (e.object = object));
  if (!late) resolve();
  e.resolve = resolve;
  e.obj = object;
  return e;
};
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('the grid and its range', () => {
  it('sizes cells by the world', () => {
    expect(cellSizeOf(590)).toBe(98);
    expect(cellSizeOf(120)).toBe(48);
  });
  it('draws as far as the fog lets you see, within limits', () => {
    expect(drawRange(0.00055, 98, 590).near).toBe(2360); // (thin air: the whole world)
    expect(drawRange(0.0042, 98, 590).near).toBeCloseTo(446, 0);
    expect(drawRange(0.0105, 98, 590).near).toBe(220);
    const r = drawRange(0.0042, 98, 590);
    expect(r.far).toBe(r.near + 98);
  });
});

describe('readying the cells before the world is shown', () => {
  it('prepares each cell once, with its things', async () => {
    const entries = [thing(5, 5), thing(10, 20), thing(300, 5)];
    const prepareCell = vi.fn(async () => {});
    const cells = createThingCells({ entries, size: 100, near: 220, far: 320, prepareCell });
    const seen = [];
    await cells.prepareAll((f) => seen.push(f));
    expect(prepareCell).toHaveBeenCalledTimes(2);
    expect(prepareCell.mock.calls.map((c) => c[0].length).sort()).toEqual([1, 2]);
    expect(seen.at(-1)).toBe(1);
    expect(cells.stats()).toMatchObject({ cells: 2, ready: 2 });
  });

  it('waits for a light copy that comes after its model', async () => {
    const e = thing(5, 5);
    let lowIn;
    e.done = e.done.then((o) => {
      e.low = new Promise((r) => (lowIn = r));
      return o;
    });
    const prepareCell = vi.fn(async () => {});
    const cells = createThingCells({ entries: [e], size: 100, near: 220, far: 320, prepareCell });
    const p = cells.prepareAll();
    await flush();
    expect(prepareCell).not.toHaveBeenCalled();
    lowIn();
    await p;
    expect(prepareCell).toHaveBeenCalledTimes(1);
  });

  it('stops waiting on loads once the hold is up', async () => {
    let t = 0;
    const late = thing(5, 5, { late: true });
    const prepareCell = vi.fn(async () => {});
    vi.useFakeTimers();
    try {
      const cells = createThingCells({ entries: [late], size: 100, near: 220, far: 320, prepareCell, now: () => t });
      const p = cells.prepareAll();
      t = 7000;
      await vi.advanceTimersByTimeAsync(7000);
      await p;
      expect(prepareCell).toHaveBeenCalledWith([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('what is drawn', () => {
  it('hides a ready cell past its range, with room before it shows again', async () => {
    const a = thing(5, 5);
    const b = thing(1005, 5);
    const cells = createThingCells({ entries: [a, b], size: 100, near: 220, far: 320, prepareCell: async () => {} });
    await cells.prepareAll();
    cells.update({ x: 0, z: 0 });
    expect(a.obj.visible).toBe(true);
    expect(b.obj.visible).toBe(false);
    cells.update({ x: 800, z: 0 }); // (b's cell 200 m off: within near)
    expect(b.obj.visible).toBe(true);
    expect(a.obj.visible).toBe(false);
    cells.update({ x: 700, z: 0 }); // (300 m: past near, within far)
    expect(b.obj.visible).toBe(true);
  });

  it('never hides a thing that holds a light', async () => {
    const b = thing(1005, 5);
    const c = thing(1010, 5);
    b.obj.traverse = (fn) => [b.obj, { isLight: true }].forEach(fn);
    const cells = createThingCells({ entries: [b, c], size: 100, near: 220, far: 320, prepareCell: async () => {} });
    await cells.prepareAll();
    cells.update({ x: 0, z: 0 });
    expect(b.obj.visible).toBe(true);
    expect(c.obj.visible).toBe(false);
  });

  it('keeps a thing drawn once a light is added to it after it was first hidden', async () => {
    const b = thing(1005, 5);
    const kids = [b.obj];
    b.obj.traverse = (fn) => kids.forEach(fn);
    const cells = createThingCells({ entries: [b], size: 100, near: 220, far: 320, prepareCell: async () => {} });
    await cells.prepareAll();
    cells.update({ x: 0, z: 0 });
    expect(b.obj.visible).toBe(false);
    // (back in range, a lamp lit in it, then out of range again)
    cells.update({ x: 1000, z: 0 });
    expect(b.obj.visible).toBe(true);
    kids.push({ isLight: true });
    cells.update({ x: 0, z: 0 });
    expect(b.obj.visible).toBe(true);
  });

  it('hides nothing while held (the floor not yet baked)', async () => {
    let held = true;
    const b = thing(1005, 5);
    const cells = createThingCells({ entries: [b], size: 100, near: 220, far: 320, prepareCell: async () => {}, hold: () => held });
    await cells.prepareAll();
    cells.update({ x: 0, z: 0 });
    expect(b.obj.visible).toBe(true);
    held = false;
    cells.update({ x: 0, z: 0 });
    expect(b.obj.visible).toBe(false);
  });

  it('leaves a cell not yet ready drawn, and readies the near ones as you walk', async () => {
    const a = thing(5, 5);
    const b = thing(1005, 5);
    const prepareCell = vi.fn(async () => {});
    const cells = createThingCells({ entries: [a, b], size: 100, near: 220, far: 320, prepareCell });
    cells.update({ x: 0, z: 0 }, { x: 1, z: 0 });
    expect(b.obj.visible).toBe(true);
    await flush();
    await flush();
    expect(prepareCell).toHaveBeenCalledTimes(1);
    expect(cells.stats().ready).toBe(1);
    cells.update({ x: 0, z: 0 });
    expect(a.obj.visible).toBe(true);
    expect(b.obj.visible).toBe(true); // (not ready: as it was)
  });
});
