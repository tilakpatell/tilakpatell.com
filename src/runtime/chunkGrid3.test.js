import { describe, expect, it } from 'vitest';
import { createChunkGrid3, parseCell } from './chunkGrid3';

// the reference ordering: a cube of cells nearest first, ties in the order
// of a scan (y, then z, then x, each low to high)
const wantedCells = (cx, cy, cz, r) => {
  const list = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) list.push([dx, dy, dz, dx * dx + dy * dy + dz * dz]);
    }
  }
  list.sort((a, b) => a[3] - b[3]);
  return list.map(([dx, dy, dz]) => `${cx + dx},${cy + dy},${cz + dz}`);
};

const chebyshev = (key, c) => {
  const k = parseCell(key);
  return Math.max(Math.abs(k[0] - c[0]), Math.abs(k[1] - c[1]), Math.abs(k[2] - c[2]));
};

// every cell of the boxes [lo, hi] on each axis
const box = (lo, hi) => {
  const keys = new Set();
  for (let y = lo[1]; y <= hi[1]; y++) {
    for (let z = lo[2]; z <= hi[2]; z++) for (let x = lo[0]; x <= hi[0]; x++) keys.add(`${x},${y},${z}`);
  }
  return keys;
};

// drives a grid along a path of points, its answers landing `late` updates
// after each was begun; counts what it asked, dropped and cancelled
const drive = (g, path, late = 0) => {
  const asked = new Map();
  const dropped = [];
  const cancelled = [];
  const due = []; // [update it lands at, key, gen]
  path.forEach((at, i) => {
    for (const [when, key, gen] of due.filter((d) => d[0] <= i)) {
      due.splice(due.findIndex((d) => d[0] === when && d[1] === key), 1);
      g.done(key, gen);
    }
    const { ask, drop, cancel } = g.update(at);
    dropped.push(...drop);
    cancelled.push(...cancel);
    for (const key of ask) {
      asked.set(key, (asked.get(key) ?? 0) + 1);
      g.began(key);
      if (late === 0) g.done(key, g.gen);
      else due.push([i + late, key, g.gen]);
    }
  });
  return { asked, dropped, cancelled };
};

describe('createChunkGrid3', () => {
  it('finds the cell of a point, negatives and -0 included', () => {
    const g = createChunkGrid3({ size: 16, radius: 2 });
    expect(g.cellOf(-0.5, 15.9, -16)).toEqual([-1, 0, -1]);
    expect(g.cellOf(16, -16, 32)).toEqual([1, -1, 2]);
    const zero = g.cellOf(-0, -0, -0);
    expect(zero.every((v) => Object.is(v, 0))).toBe(true);
    expect(g.size).toBe(16);
    expect(g.radius).toBe(2);
    expect(g.gen).toBe(0);
  });

  it('names a cell "cx,cy,cz" and reads one back', () => {
    const g = createChunkGrid3({ size: 16, radius: 0 });
    expect(g.update({ x: -20, y: 40, z: 1 }).ask).toEqual(['-2,2,0']);
    expect(parseCell('-2,2,0')).toEqual([-2, 2, 0]);
    expect(parseCell('0,-0,7').every((v, i) => Object.is(v, [0, 0, 7][i]))).toBe(true);
  });

  it('at radius 1 asks for the 27 cells, the centre first, then the 6 faces', () => {
    const g = createChunkGrid3({ size: 16, radius: 1, inFlight: 100 });
    const { ask, drop, cancel } = g.update({ x: 1, y: 1, z: 1 });
    expect(ask).toHaveLength(27);
    expect(new Set(ask)).toEqual(box([-1, -1, -1], [1, 1, 1]));
    expect(ask[0]).toBe('0,0,0');
    expect(new Set(ask.slice(1, 7))).toEqual(
      new Set(['1,0,0', '-1,0,0', '0,1,0', '0,-1,0', '0,0,1', '0,0,-1']),
    );
    // then the 12 edges, then the 8 corners
    for (const k of ask.slice(7, 19)) expect(parseCell(k).filter(Boolean)).toHaveLength(2);
    for (const k of ask.slice(19)) expect(parseCell(k).filter(Boolean)).toHaveLength(3);
    expect(drop).toEqual([]);
    expect(cancel).toEqual([]);
  });

  it('breaks ties toward the heading, up included', () => {
    const g = createChunkGrid3({ size: 16, radius: 1, inFlight: 100 });
    const { ask } = g.update({ x: 1, y: 1, z: 1, heading: [0, 1, 0] });
    expect(ask[0]).toBe('0,0,0');
    expect(ask[1]).toBe('0,1,0');
    expect(ask.indexOf('0,1,0')).toBeLessThan(ask.indexOf('0,-1,0'));
    expect(ask.indexOf('1,1,0')).toBeLessThan(ask.indexOf('1,-1,0'));
    expect(ask.indexOf('1,1,1')).toBeLessThan(ask.indexOf('1,-1,1'));
    // still nearest first: every face before any edge
    expect(ask.indexOf('0,-1,0')).toBeLessThan(ask.indexOf('1,1,0'));
    // the heading's length doesn't matter, only its way
    expect(g.cells(1, 1, 1, { heading: [0, 5, 0] })).toEqual(ask);
    const ahead = g.cells(1, 1, 1, { heading: [-1, 0, 0] });
    expect(ahead[1]).toBe('-1,0,0');
  });

  it('with no heading orders cells exactly as the reference does', () => {
    const g = createChunkGrid3({ size: 16, radius: 2 });
    const [cx, cy, cz] = g.cellOf(-40, 75, -3);
    expect(g.cells(-40, 75, -3)).toEqual(wantedCells(cx, cy, cz, 2));
    expect(g.cells(-40, 75, -3, { radius: 1 })).toEqual(wantedCells(cx, cy, cz, 1));
  });

  it('caches the ordering for the same cell', () => {
    const g = createChunkGrid3({ size: 16, radius: 1 });
    const a = g.cells(1, 1, 1);
    expect(g.cells(15, 2, 3)).toBe(a);
    expect(g.cells(1, 17, 1)).not.toBe(a);
    expect(g.cells(1, 1, 1, { heading: [0, 0, 1] })).not.toEqual(a);
  });

  it('keeps at most inFlight cells in flight', () => {
    const g = createChunkGrid3({ size: 16, radius: 1 });
    const first = g.update({ x: 0, y: 0, z: 0 }).ask;
    expect(first).toHaveLength(8);
    for (const k of first) g.began(k);
    expect(g.flying.size).toBe(8);
    expect(g.update({ x: 0, y: 0, z: 0 }).ask).toEqual([]);
    expect(g.done(first[0], 0)).toBe(true);
    expect(g.loaded.has(first[0])).toBe(true);
    expect(g.flying.has(first[0])).toBe(false);
    const next = g.update({ x: 0, y: 0, z: 0 }).ask;
    expect(next).toHaveLength(1);
    expect(first).not.toContain(next[0]);
  });

  it('refuses a done from an old gen', () => {
    const g = createChunkGrid3({ size: 16, radius: 1 });
    g.update({ x: 0, y: 0, z: 0 });
    g.began('0,0,0', 0);
    g.gen = 1;
    expect(g.done('0,0,0', 0)).toBe(false);
    expect(g.loaded.size).toBe(0);
    expect(g.flying.size).toBe(0);
  });

  it('with hysteresis drops nothing until Chebyshev 3, on any axis', () => {
    const g = createChunkGrid3({ size: 16, radius: 1 });
    g.update({ x: 0, y: 0, z: 0 });
    g.began('0,0,0');
    expect(g.done('0,0,0', 0)).toBe(true);
    // two cells off on every axis at once (Chebyshev 2): kept
    expect(g.update({ x: 2 * 16 + 1, y: 2 * 16 + 1, z: -2 * 16 + 1 }).drop).toEqual([]);
    expect(g.update({ x: 1, y: -2 * 16 + 1, z: 1 }).drop).toEqual([]);
    expect(g.loaded.has('0,0,0')).toBe(true);
    // three cells up (Chebyshev 3): dropped
    expect(g.update({ x: 1, y: 3 * 16 + 1, z: 1 }).drop).toEqual(['0,0,0']);
    expect(g.loaded.has('0,0,0')).toBe(false);
  });

  it('sitting on a face asks and drops nothing after the first settle', () => {
    const size = 16;
    const g = createChunkGrid3({ size, radius: 1, inFlight: 100 });
    const path = Array.from({ length: 100 }, (_, i) => ({ x: size + (i % 2 ? 0.5 : -0.5), y: 3, z: 3 }));
    // the first settle: one update on each side of the face
    drive(g, path.slice(0, 2));
    expect(g.loaded).toEqual(box([-1, -1, -1], [2, 1, 1]));
    const { asked, dropped, cancelled } = drive(g, path.slice(2));
    expect(asked.size).toBe(0);
    expect(dropped).toEqual([]);
    expect(cancelled).toEqual([]);
  });

  it('sitting on a face while answers come late asks for each cell once', () => {
    const size = 16;
    const g = createChunkGrid3({ size, radius: 1 });
    const path = Array.from({ length: 100 }, (_, i) => ({ x: size + (i % 2 ? 0.5 : -0.5), y: 3, z: 3 }));
    const { asked, dropped, cancelled } = drive(g, path, 5);
    const want = box([-1, -1, -1], [2, 1, 1]);
    expect(new Set(asked.keys())).toEqual(want);
    for (const n of asked.values()) expect(n).toBe(1);
    expect(dropped).toEqual([]);
    expect(cancelled).toEqual([]);
    expect(g.loaded).toEqual(want);
    expect(g.flying.size).toBe(0);
  });

  it('sitting on a corner, -0 included, asks for each cell once', () => {
    const g = createChunkGrid3({ size: 16, radius: 1 });
    const side = (on) => (on ? 0.5 : -0.5);
    const path = Array.from({ length: 200 }, (_, i) => ({
      x: i % 3 === 0 ? -0 : side(i & 1),
      y: side(i & 2),
      z: i % 5 === 0 ? -0 : side(i & 4),
    }));
    const { asked, dropped, cancelled } = drive(g, path, 3);
    const want = box([-2, -2, -2], [1, 1, 1]);
    expect(new Set(asked.keys())).toEqual(want);
    for (const n of asked.values()) expect(n).toBe(1);
    expect(dropped).toEqual([]);
    expect(cancelled).toEqual([]);
    expect(g.loaded).toEqual(want);
  });

  it('keeps flights within the band, cancels those past it, and refuses their done', () => {
    const g = createChunkGrid3({ size: 16, radius: 1, inFlight: 100 });
    const ask = g.update({ x: 0, y: 0, z: 0 }).ask;
    for (const k of ask) g.began(k);
    // centre to cell 2 on y: the row at y -1 is 3 off, past the band
    const { cancel } = g.update({ x: 1, y: 2 * 16 + 1, z: 1 });
    expect(new Set(cancel)).toEqual(box([-1, -1, -1], [1, -1, 1]));
    for (const k of cancel) expect(g.flying.has(k)).toBe(false);
    for (const k of g.flying.keys()) expect(chebyshev(k, [0, 2, 0])).toBeLessThanOrEqual(2);
    for (const k of cancel) expect(g.done(k, 0)).toBe(false);
    for (const k of cancel) expect(g.loaded.has(k)).toBe(false);
    // a flight within the band still lands
    expect(g.done('0,0,0', 0)).toBe(true);
    expect(g.loaded.has('0,0,0')).toBe(true);
  });

  it("a done out of range clears its own flight but no one else's", () => {
    const g = createChunkGrid3({ size: 16, radius: 1 });
    g.update({ x: 0, y: 0, z: 0 });
    g.began('1,0,0');
    g.update({ x: -16 * 2 + 1, y: 0, z: 0 }); // cancelled here
    g.began('1,0,0'); // a stale re-begin, same gen
    expect(g.done('1,0,0', 0)).toBe(false);
    expect(g.flying.has('1,0,0')).toBe(false);
    g.update({ x: 0, y: 0, z: 0 });
    g.began('0,0,0', 5);
    expect(g.done('0,0,0', 0)).toBe(false);
    expect(g.flying.get('0,0,0')).toBe(5);
  });

  it('failed clears a flight of the same gen, or any when gen is not given', () => {
    const g = createChunkGrid3({ size: 16, radius: 1 });
    g.began('0,0,0', 0);
    g.failed('0,0,0', 1);
    expect(g.flying.has('0,0,0')).toBe(true);
    g.failed('0,0,0', 0);
    expect(g.flying.has('0,0,0')).toBe(false);
    g.began('1,0,0');
    g.failed('1,0,0');
    expect(g.flying.size).toBe(0);
  });

  it('unload lets go of a loaded cell so it is asked for again', () => {
    const g = createChunkGrid3({ size: 16, radius: 0 });
    g.update({ x: 0, y: 0, z: 0 });
    g.began('0,0,0');
    g.done('0,0,0', 0);
    expect(g.update({ x: 0, y: 0, z: 0 }).ask).toEqual([]);
    g.unload('0,0,0');
    expect(g.update({ x: 0, y: 0, z: 0 }).ask).toEqual(['0,0,0']);
  });

  it('update can change the radius', () => {
    const g = createChunkGrid3({ size: 16, radius: 1, inFlight: 1000 });
    expect(g.update({ x: 0, y: 0, z: 0, radius: 2 }).ask).toHaveLength(125);
    expect(g.radius).toBe(2);
  });

  it('reset hands back everything, bumps the gen and voids earlier flights', () => {
    const g = createChunkGrid3({ size: 16, radius: 1 });
    const ask = g.update({ x: 0, y: 0, z: 0 }).ask;
    for (const k of ask) g.began(k);
    g.done(ask[0], 0);
    const { drop, cancel } = g.reset();
    expect(drop).toEqual([ask[0]]);
    expect(new Set(cancel)).toEqual(new Set(ask.slice(1)));
    expect(g.loaded.size).toBe(0);
    expect(g.flying.size).toBe(0);
    expect(g.gen).toBe(1);
    for (const k of ask) expect(g.done(k, 0)).toBe(false);
    expect(g.loaded.size).toBe(0);
    g.reset(7);
    expect(g.gen).toBe(7);
  });

  it('a jump far away cancels every flight and drops every cell', () => {
    const g = createChunkGrid3({ size: 120000, radius: 1, inFlight: 100 });
    const ask = g.update({ x: 0, y: 0, z: 0 }).ask;
    for (const k of ask.slice(0, 10)) g.began(k);
    for (const k of ask.slice(0, 5)) g.done(k, 0);
    for (const k of ask.slice(10)) g.began(k);
    const { drop, cancel, ask: there } = g.update({ x: 1.2e8, y: 0, z: 0 });
    expect(new Set(drop)).toEqual(new Set(ask.slice(0, 5)));
    expect(new Set(cancel)).toEqual(new Set([...ask.slice(5, 10), ...ask.slice(10)]));
    expect(there[0]).toBe('1000,0,0');
    for (const k of ask) expect(g.done(k, 0)).toBe(false);
    expect(g.loaded.size).toBe(0);
  });
});
