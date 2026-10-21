import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { LOOKS } from '../../galaxy/bodies';
import { SECTOR } from '../gen/grid';
import { makeSector } from '../gen/sector';
import { UNIVERSE } from '../gen/seed';
import { PLANET_TYPES } from '../gen/tables';
import { PLANET_NEAR, TYPE_LOOK, createSector, nebulaOf } from './sectors';

const named = (group, prefix) => {
  const out = [];
  group.traverse((o) => o.name.startsWith(prefix) && out.push(o));
  return out;
};
const camAt = (p) => {
  const cam = new THREE.PerspectiveCamera(60, 1, 1, 100000);
  cam.position.set(...p);
  cam.updateMatrixWorld();
  return cam;
};

// a small sector made by hand: two systems far apart, a wonder of each kind
const planet = (id, type, at) => ({ id, name: id, type, radius: 30, color: '#888888', at, orbit: 400, moons: 0, rings: type === 'ringed', seed: 1n });
const HAND = {
  id: 'E:5,0',
  sx: 5,
  sz: 0,
  seed: 1n,
  origin: [400000, 0, 0],
  systems: [
    {
      id: 'E:5,0:0',
      name: 'A',
      at: [390000, 0, 0],
      star: { class: 'G', color: '#fff4ea', size: 150 },
      planets: [planet('E:5,0:0:0', 'rock', [390400, 0, 0]), planet('E:5,0:0:1', 'gas', [390000, 0, 700])],
      faction: { id: 'x', name: 'X' },
      traffic: 0.5,
      hazard: null,
    },
    {
      id: 'E:5,0:1',
      name: 'B',
      at: [425000, 0, 20000],
      star: { class: 'M', color: '#ffb56c', size: 90 },
      planets: [planet('E:5,0:1:0', 'ocean', [425500, 0, 20000])],
      faction: { id: 'x', name: 'X' },
      traffic: 0.2,
      hazard: 'storm',
    },
  ],
  wonders: ['nebula', 'pulsar', 'derelict', 'rogue'].map((kind, k) => ({ id: `E:5,0:w${k}`, kind, name: kind, at: [400000 + k * 3000, 0, -20000], size: 400, seed: BigInt(k + 1) })),
  beacons: {},
};

describe('a generated sector, drawn', () => {
  it('has a look for every planet type, and every look is real', () => {
    for (const { type } of PLANET_TYPES) expect(LOOKS[TYPE_LOOK[type]], type).toBeTruthy();
    for (const id of Object.values(TYPE_LOOK)) expect(LOOKS[id], id).toBeTruthy();
  });

  it('adds a star per system and one Points for its specks', () => {
    const sector = makeSector(UNIVERSE, 2, -1);
    const s = createSector(sector);
    expect(s.group.name).toBe('sector:E:2,-1');
    expect(s.sector).toBe(sector);
    expect(named(s.group, 'star:')).toHaveLength(sector.systems.length);
    expect(named(s.group, 'far-stars')).toHaveLength(1);
    expect(named(s.group, 'wonder:')).toHaveLength(sector.wonders.length);
    expect(s.count()).toBeGreaterThan(sector.systems.length);
    s.dispose();
  });

  it('keeps everything in the sector’s own frame, small numbers', () => {
    const s = createSector(makeSector(UNIVERSE, 7, -9));
    const v = new THREE.Vector3();
    s.group.position.set(0, 0, 0);
    s.group.updateMatrixWorld(true);
    s.group.traverse((o) => {
      if (o === s.group) return;
      o.getWorldPosition(v);
      expect(Math.abs(v.x)).toBeLessThanOrEqual(SECTOR / 2 + 5000);
      expect(Math.abs(v.z)).toBeLessThanOrEqual(SECTOR / 2 + 5000);
    });
    s.dispose();
  });

  it('reanchors by moving only the group', () => {
    const s = createSector(HAND);
    expect(s.group.position.toArray()).toEqual([400000, 0, 0]);
    const before = s.group.children.map((c) => c.position.toArray());
    s.reanchor([390000, 10, -5]);
    expect(s.group.position.toArray()).toEqual([10000, -10, 5]);
    expect(s.group.children.map((c) => c.position.toArray())).toEqual(before);
    s.dispose();
  });

  it('builds a system’s planets when the camera comes near, and lets them go when it leaves', () => {
    const s = createSector(HAND);
    const root = new THREE.Group();
    root.add(s.group);
    s.update(0, 1 / 60, camAt([400000, 0, -60000]));
    expect(named(s.group, 'planet:')).toHaveLength(0);

    s.update(1, 1 / 60, camAt([390000, 0, 3000]));
    expect(named(s.group, 'planet:').map((p) => p.name)).toEqual(['planet:E:5,0:0:0', 'planet:E:5,0:0:1']);
    const p = s.group.getObjectByName('planet:E:5,0:0:0');
    expect(p.position.toArray()).toEqual([-9600, 0, 0]);

    // (just past PLANET_NEAR: kept, the hysteresis)
    s.update(2, 1 / 60, camAt([390000, 0, -PLANET_NEAR * 1.1]));
    expect(named(s.group, 'planet:')).toHaveLength(2);
    s.update(3, 1 / 60, camAt([390000, 0, -PLANET_NEAR * 1.5]));
    expect(named(s.group, 'planet:')).toHaveLength(0);

    // the other system's, near it
    s.update(4, 1 / 60, camAt([425000, 0, 22000]));
    expect(named(s.group, 'planet:').map((o) => o.name)).toEqual(['planet:E:5,0:1:0']);
    s.dispose();
  });

  it('takes the body builder it is given', () => {
    const made = [];
    const build = (look, opts) => {
      const group = new THREE.Group();
      const b = { group, look, opts, suns: null, disposed: false, update() {}, setSuns(s) { b.suns = s; }, dispose() { b.disposed = true; } };
      made.push(b);
      return b;
    };
    const s = createSector(HAND, { build });
    s.update(0, 1 / 60, camAt([390000, 0, 3000]));
    expect(made.map((b) => b.look)).toEqual([TYPE_LOOK.rock, TYPE_LOOK.gas]);
    expect(made[0].opts.r).toBe(30);
    expect(made[0].suns[0].dir.toArray().map((x) => Math.round(x * 1000) / 1000)).toEqual([-1, 0, 0]);
    s.dispose();
    expect(made.every((b) => b.disposed)).toBe(true);
  });

  it('disposes down to an empty group, out of its parent', () => {
    const root = new THREE.Group();
    const s = createSector(HAND, { lanes: [{ id: 'l1', tier: 'trunk', from: 'a', to: 'b', pts: [[390000, 0, 0], [400000, 0, 0], [410000, 0, 0]], length: 20000, name: 'L' }] });
    root.add(s.group);
    s.update(0, 1 / 60, camAt([390000, 0, 3000]));
    s.dispose();
    expect(s.group.children).toHaveLength(0);
    expect(s.group.parent).toBeNull();
    expect(root.children).toHaveLength(0);
  });

  it('hands each nebula to the renderer at its own place, and takes it back', () => {
    let h = 0;
    const nebulae = { add: vi.fn(() => ++h), remove: vi.fn() };
    const s = createSector(HAND, { nebulae });
    expect(nebulae.add).toHaveBeenCalledTimes(1);
    const d = nebulae.add.mock.calls[0][0];
    expect(d).toMatchObject({ id: 'E:5,0:w0', at: [400000, 0, -20000], r: 400, seed: 1n });
    expect(d.colors[0]).toBe('#b48cff');
    expect(d.colors[1]).toMatch(/^#[0-9a-f]{6}$/);
    expect(nebulaOf(HAND.wonders[0])).toEqual(d);
    s.dispose();
    expect(nebulae.remove).toHaveBeenCalledWith(1);
  });

  it('keeps a wonder for a nebula, with no Points in it and no speck for it', () => {
    const s = createSector(HAND, { nebulae: { add: () => 1, remove() {} } });
    const w = s.group.getObjectByName('wonder:E:5,0:w0');
    expect(w.isPoints).toBeFalsy();
    expect(w.children).toHaveLength(0);
    expect(named(s.group, 'far-stars')[0].geometry.attributes.position.count).toBe(HAND.systems.length + HAND.wonders.length - 1);
    s.dispose();
  });

  it('draws no nebula, and says nothing, with no renderer', () => {
    expect(() => createSector(HAND).dispose()).not.toThrow();
  });
});
