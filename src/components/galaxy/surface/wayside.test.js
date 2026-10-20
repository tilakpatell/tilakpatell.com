import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { REGION, laidOn, regionsAround, waysideAt } from './wayside';
import { PROPS } from './props';
import { SURFACE_MODELS } from './catalog';

const green = { reach: 590, ground: { seed: 92 }, flora: { biome: 'temperate' } };
const bare = { reach: 590, ground: { seed: 71 }, flora: { biome: 'dry' } };
const regions = (site) => {
  const out = [];
  for (let i = -12; i < 12; i++) for (let j = -12; j < 12; j++) out.push(waysideAt(site, i, j));
  return out;
};

describe('waysideAt', () => {
  it('is the same place every visit, and another region another', () => {
    expect(waysideAt(green, 4, -3)).toEqual(waysideAt(green, 4, -3));
    const some = regions(green).filter(Boolean);
    expect(new Set(some.map((w) => w.id)).size).toBe(some.length);
  });

  it('holds a place in about half the regions, none in or by the core', () => {
    const all = regions(green);
    const some = all.filter(Boolean);
    expect(some.length / all.length).toBeGreaterThan(0.4);
    expect(some.length / all.length).toBeLessThan(0.65);
    expect(some.every((w) => Math.hypot(...w.at) >= 590 + 300)).toBe(true);
    expect(waysideAt(green, 0, 0)).toBeNull();
  });

  it('stands each place inside its region, its things about it on the ground’s plan', () => {
    for (let i = -6; i < 6; i++)
      for (let j = -6; j < 6; j++) {
        const w = waysideAt(green, i, j);
        if (!w) continue;
        expect(w.at[0]).toBeGreaterThanOrEqual(i * REGION);
        expect(w.at[0]).toBeLessThanOrEqual((i + 1) * REGION);
        expect(w.things.length).toBeGreaterThanOrEqual(3);
        for (const t of w.things) expect(Math.hypot(t.at[0] - w.at[0], t.at[1] - w.at[1])).toBeLessThan(15);
      }
  });

  it('turns up camps, ruins and downed fighters on a green world, outposts and wrecks on a bare one', () => {
    const kinds = (site) => new Set(regions(site).filter(Boolean).map((w) => w.kind));
    expect([...kinds(green)].sort()).toEqual(['camp', 'ruin', 'wreck']);
    expect([...kinds(bare)].sort()).toEqual(['camp', 'outpost', 'wreck']);
    const ships = regions(bare).filter((w) => w?.kind === 'wreck').map((w) => w.things[0]);
    expect(ships.every((t) => t.kind === 'downed' && Math.abs(t.opts.roll) >= 0.3 && t.lie === t.opts.metres * 0.45)).toBe(true);
    expect(new Set(ships.map((t) => t.opts.ship))).toEqual(new Set(['xwing', 'ywing', 'tie']));
  });

  it('stands only things the scene can place', () => {
    const kinds = new Set([...regions(green), ...regions(bare)].filter(Boolean).flatMap((w) => w.things.map((t) => t.kind)));
    expect(kinds.size).toBeGreaterThan(8);
    for (const k of kinds) expect(Boolean(PROPS[k] || SURFACE_MODELS[k]), k).toBe(true);
  });
});

describe('waysideAt on the land', () => {
  // (a region's land: a steep ramp but for a flat shelf in its south-west)
  const shelf = ([i, j]) => (x, z) => (x < (i + 0.4) * REGION && z < (j + 0.4) * REGION ? 0 : 0.6 * (x + z));

  it('goes on flat ground in its region where the first spot is steep, the same every visit', () => {
    let moved = 0;
    for (let i = -6; i < 6; i++)
      for (let j = -6; j < 6; j++) {
        const first = waysideAt(green, i, j);
        if (!first) continue;
        const height = shelf([i, j]);
        const w = waysideAt(green, i, j, height);
        expect(w).toEqual(waysideAt(green, i, j, height));
        expect(w.kind).toBe(first.kind);
        expect(w.at[0]).toBeGreaterThanOrEqual(i * REGION);
        expect(w.at[0]).toBeLessThanOrEqual((i + 1) * REGION);
        if (w.at[0] !== first.at[0]) moved++;
      }
    expect(moved).toBeGreaterThan(10);
  });

  it('stays where it was on flat land', () => {
    for (let i = 2; i < 6; i++) for (let j = 2; j < 6; j++) expect(waysideAt(green, i, j, () => 3)).toEqual(waysideAt(green, i, j));
  });
});

describe('regionsAround', () => {
  it('lists the regions whose middles are within reach', () => {
    const near = regionsAround(5200, -3100, 1600);
    expect(near).toContainEqual([5, -4]);
    expect(near.every(([i, j]) => Math.hypot((i + 0.5) * REGION - 5200, (j + 0.5) * REGION + 3100) <= 1600)).toBe(true);
    expect(near.length).toBeGreaterThan(4);
  });
});

describe('laidOn', () => {
  it('stands a thing on the land’s own height', () => {
    expect(laidOn({ kind: 'tent', at: [10, 20] }, (x, z) => x + z)).toEqual({ kind: 'tent', at: [10, 20], abs: true, y: 30 });
  });

  it('lays a long thing along the slope under it, its nose up the hill and its side to the slope across', () => {
    // (rising 0.4 a metre to +z and 0.2 to +x; the thing faced along +x)
    const land = (x, z) => 0.2 * x + 0.4 * z;
    const t = laidOn({ kind: 'downed', at: [0, 0], yaw: Math.PI / 2, lie: 10 }, land);
    const o = new THREE.Object3D();
    o.rotation.set(t.pitch, t.yaw, t.roll, 'YXZ');
    o.updateMatrixWorld();
    // (its nose, its +z, and its side, its +x, both lie in the land's plane)
    for (const v of [new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)]) {
      const w = v.applyMatrix4(o.matrixWorld);
      expect(w.y).toBeCloseTo(land(w.x, w.z), 6);
    }
  });
});
