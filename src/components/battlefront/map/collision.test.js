import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPhysics } from '../../../lib/physics/world.js';
import { buildNav } from '../../../lib/battlefront/nav.js';
import { CULL_RADIUS, armCaster, createLevelCollision } from './collision.js';

// lane P0's fixture pack: snow piles 0.9 m tall at (10, 0, 10), (20, 0, 10), (30, 0, 10) in cell 0,0
const PACK = new URL('../../../../scripts/fixtures/bf2017/physics/pack/', import.meta.url);
const fixture = JSON.parse(readFileSync(new URL('level.json', PACK), 'utf8'));
const loadBin = async (file) => {
  const b = readFileSync(new URL(file, PACK));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
const ORIGIN = [205, 362.3, -1540];
const pack = { ...fixture, origin: ORIGIN, yaw: 0 };

let physics;
beforeEach(async () => {
  physics = await createPhysics({ gravity: 0 });
});

// the pile at pack (10, ·, 10), in the export's frame
const pile = (p = pack) => {
  const c = Math.cos(p.yaw);
  const s = Math.sin(p.yaw);
  return [p.origin[0] + 10 * c - 10 * s, p.origin[1], p.origin[2] + 10 * s + 10 * c];
};

async function loaded(p = pack) {
  const col = createLevelCollision({ pack: p, loadBin, physics });
  await col.add('0,0', await loadBin('cells/0_0.bin'), 'near');
  col.update(Infinity);
  return col;
}

describe('the level’s collision for the camera', () => {
  it('sweeps a ball in the export’s frame into the pile the pack placed', async () => {
    const col = await loaded();
    const [x, y, z] = pile();
    // (from 5 m west of the pile, 0.5 m up, eastward)
    const d = col.sweep([x - 5, y + 0.5, z], [1, 0, 0], 10, CULL_RADIUS);
    expect(d).toBeGreaterThan(1.5);
    expect(d).toBeLessThan(5);
    expect(col.sweep([x - 5, y + 3, z], [1, 0, 0], 10, CULL_RADIUS)).toBeNull();
    expect(col.stats().bodies).toBe(3);
  });

  it('takes the near band only, and lets a cell go when it leaves it', async () => {
    const col = createLevelCollision({ pack, loadBin, physics });
    await col.add('0,0', await loadBin('cells/0_0.bin'), 'mid');
    col.update(Infinity);
    expect(col.stats().bodies).toBe(0);
    await col.add('0,0', await loadBin('cells/0_0.bin'), 'near');
    col.update(Infinity);
    expect(col.stats().bodies).toBe(3);
    await col.add('0,0', await loadBin('cells/0_0.bin'), 'mid');
    expect(col.stats().bodies).toBe(0);
    await col.add('0,0', await loadBin('cells/0_0.bin'), 'near');
    col.update(Infinity);
    col.drop('0,0');
    const [x, y, z] = pile();
    expect(col.sweep([x - 5, y + 0.5, z], [1, 0, 0], 10, CULL_RADIUS)).toBeNull();
  });

  it('turns the question by the pack’s yaw', async () => {
    const turned = { ...pack, yaw: Math.PI / 2 };
    const col = await loaded(turned);
    const [x, y, z] = pile(turned);
    const d = col.sweep([x, y + 0.5, z - 6], [0, 0, 1], 12, CULL_RADIUS);
    expect(d).not.toBeNull();
    expect(d).toBeLessThan(6);
  });

  it('adds nothing after it is put away', async () => {
    const col = createLevelCollision({ pack, loadBin, physics });
    col.dispose();
    await col.add('0,0', await loadBin('cells/0_0.bin'), 'near');
    col.update(Infinity);
    expect(physics.world.bodies.len()).toBe(0);
  });
});

describe('the camera’s arm', () => {
  const flat = () => 0;
  it('stops at the ground when nothing else is nearer', () => {
    const cast = armCaster({ heightAt: flat });
    // (straight down from 1 m: the ground's clearance first)
    expect(cast([0, 1, 0], [0, -1, 0], 3)).toBeCloseTo(0.8, 5);
    expect(cast([0, 1, 0], [1, 0, 0], 3)).toBeNull();
  });

  it('takes the nearer of the ground and the level’s shapes', () => {
    const collision = { sweep: (from, dir, len, r) => (r === CULL_RADIUS ? 0.5 : null) };
    const cast = armCaster({ heightAt: flat, collision });
    expect(cast([0, 1, 0], [1, 0, 0], 3)).toBe(0.5);
    expect(cast([0, 1, 0], [0, -1, 0], 3)).toBe(0.5);
    const far = armCaster({ heightAt: flat, collision: { sweep: () => 2 } });
    expect(far([0, 1, 0], [0, -1, 0], 3)).toBeCloseTo(0.8, 5);
  });

  it('reads the navgrid’s solids where there is no engine', () => {
    const nav = buildNav({ heightAt: flat, bounds: { min: [-20, -20], max: [20, 20] }, cell: 2, solids: [{ at: [2, 1, 0], half: [0.5, 1, 5], yaw: 0 }] });
    const cast = armCaster({ heightAt: flat, nav });
    expect(cast([0, 1, 0], [1, 0, 0], 3)).toBeCloseTo(1.5, 5);
    expect(cast([0, 1, 0], [-1, 0, 0], 3)).toBeNull();
  });
});
