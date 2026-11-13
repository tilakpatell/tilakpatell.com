import { describe, expect, it } from 'vitest';
import { createChunkGrid3 } from './chunkGrid3';

// load everything asked for, at once (as a pool would, later)
const settle = (g, at) => {
  for (let i = 0; i < 200; i++) {
    const { ask } = g.update(at);
    if (!ask.length) return;
    for (const k of ask) {
      g.began(k);
      g.done(k, g.gen);
    }
  }
};

describe('the chunk grid in three dimensions', () => {
  it('finds the cell of any point, below nought included', () => {
    const g = createChunkGrid3({ size: 100, radius: 1 });
    expect(g.cellOf(0, 0, 0)).toEqual([0, 0, 0]);
    expect(g.cellOf(-0.5, 150, -100)).toEqual([-1, 1, -1]);
    expect(g.cellOf(-0, 99.999, 100)).toEqual([0, 0, 1]);
  });

  it('asks for the 27 round the player, its own first, then the six faces', () => {
    const g = createChunkGrid3({ size: 100, radius: 1, inFlight: 99 });
    const { ask } = g.update({ x: 50, y: 50, z: 50 });
    expect(ask).toHaveLength(27);
    expect(new Set(ask).size).toBe(27);
    expect(ask[0]).toBe('0,0,0');
    expect(new Set(ask.slice(1, 7))).toEqual(new Set(['1,0,0', '-1,0,0', '0,1,0', '0,-1,0', '0,0,1', '0,0,-1']));
  });

  it('breaks ties toward the way the player is heading, up and down too', () => {
    const g = createChunkGrid3({ size: 100, radius: 1, inFlight: 99 });
    const { ask } = g.update({ x: 50, y: 50, z: 50, heading: [0, 1, 0] });
    expect(ask.indexOf('0,1,0')).toBeLessThan(ask.indexOf('0,-1,0'));
    expect(ask[1]).toBe('0,1,0');
  });

  it('keeps no more in flight than it may', () => {
    const g = createChunkGrid3({ size: 100, radius: 1, inFlight: 2 });
    const { ask } = g.update({ x: 0, y: 0, z: 0 });
    expect(ask).toHaveLength(2);
    for (const k of ask) g.began(k);
    expect(g.update({ x: 0, y: 0, z: 0 }).ask).toHaveLength(0);
  });

  it('lets a cell go only past the radius and the band past it', () => {
    const g = createChunkGrid3({ size: 100, radius: 1, inFlight: 99 });
    settle(g, { x: 50, y: 50, z: 50 });
    expect(g.loaded.size).toBe(27);
    expect(g.update({ x: 150, y: 50, z: 50 }).drop).toEqual([]); // (the far face is 2 off: kept)
    const { drop } = g.update({ x: 250, y: 50, z: 50 });
    expect(drop).toHaveLength(9);
    expect(drop.every((k) => k.startsWith('-1,'))).toBe(true);
  });

  it('sitting on a face asks and drops nothing after the first settle', () => {
    const g = createChunkGrid3({ size: 100, radius: 1, inFlight: 99 });
    settle(g, { x: 99.5, y: 0, z: 0 });
    settle(g, { x: 100.5, y: 0, z: 0 });
    for (let i = 0; i < 100; i++) {
      const at = { x: i % 2 ? 99.5 : 100.5, y: 0, z: 0 };
      const { ask, drop, cancel } = g.update(at);
      expect([ask, drop, cancel]).toEqual([[], [], []]);
    }
  });

  it('refuses a cell that comes back after a reset, or once the player has gone on', () => {
    const g = createChunkGrid3({ size: 100, radius: 1, inFlight: 99 });
    const { ask } = g.update({ x: 0, y: 0, z: 0 });
    g.began(ask[0], g.gen);
    const old = g.gen;
    g.reset();
    expect(g.done(ask[0], old)).toBe(false);
    expect(g.loaded.size).toBe(0);
    g.update({ x: 0, y: 0, z: 0 });
    g.began('1,1,1', g.gen);
    const { cancel } = g.update({ x: 1e6, y: 0, z: 0 });
    expect(cancel).toContain('1,1,1');
    expect(g.done('1,1,1', g.gen)).toBe(false);
  });
});
