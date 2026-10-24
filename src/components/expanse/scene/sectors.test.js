import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LOOKS } from '../../galaxy/bodies';
import { createFarStars } from '../../universe/shared/far';
import { SECTOR } from '../gen/grid';
import { makeSector } from '../gen/sector';
import { UNIVERSE } from '../gen/seed';
import { addBodies } from '../gen/systems';
import { PLANET_TYPES } from '../gen/tables';
import { realAt } from './levels';
import { TYPE_LOOK, WONDER, WONDER_SPECK, createSector, slotOf } from './sectors';

const named = (group, prefix) => {
  const out = [];
  group.traverse((o) => o.name.startsWith(prefix) && out.push(o));
  return out;
};
// a hex colour's bytes
const bytes = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
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

  it('draws its wonders and nothing else: its stars are the far layer’s, its systems near.js’s', () => {
    const sector = makeSector(UNIVERSE, 2, -1);
    const s = createSector(sector);
    expect(s.group.name).toBe('sector:E:2,-1');
    expect(s.sector).toBe(sector);
    expect(named(s.group, 'wonder:')).toHaveLength(sector.wonders.length);
    for (const prefix of ['star:', 'planet:', 'far-stars']) expect(named(s.group, prefix), prefix).toHaveLength(0);
    expect(s.count()).toBe(sector.wonders.length);
    s.dispose();
  });

  it('hands its stars and wonders to a slot of the far layer, from its middle', () => {
    const sector = addBodies(makeSector(UNIVERSE, 2, -1));
    const slot = slotOf(sector);
    const n = sector.systems.length + sector.wonders.length;
    expect(slot.key).toBe(sector.id);
    expect(slot.centre).toEqual(sector.origin);
    expect(slot.count).toBe(n);
    expect(slot.at).toBeInstanceOf(Float32Array);
    expect(slot.color).toBeInstanceOf(Uint8Array);
    expect(slot.r).toBeInstanceOf(Float32Array);
    expect([slot.at.length, slot.color.length, slot.r.length]).toEqual([3 * n, 3 * n, n]);
    const each = [
      ...sector.systems.map((sys) => [sys.at, sys.star.color, sys.star.size]),
      ...sector.wonders.map((w) => [w.at, WONDER[w.kind].color, w.size * WONDER_SPECK]),
    ];
    each.forEach(([at, color, r], i) => {
      for (let k = 0; k < 3; k++) expect(slot.at[i * 3 + k]).toBeCloseTo(at[k] - sector.origin[k], 2);
      expect([...slot.color.subarray(i * 3, i * 3 + 3)]).toEqual(bytes(color));
      expect(slot.r[i]).toBe(Math.fround(r));
    });
    // and the far layer takes it as it is
    const far = createFarStars(new THREE.Group(), { places: [], skyFar: 24000, slots: [400] });
    far.setSlot(0, slot);
    expect([...far.points.geometry.attributes.aSize.array.subarray(0, n)]).toEqual([...slot.r]);
    far.dispose();
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

  it('shows a wonder only within where it’s real, as its speck has it', () => {
    const s = createSector(HAND);
    const root = new THREE.Group();
    root.add(s.group);
    for (const w of HAND.wonders) {
      const real = realAt({ r: w.size * WONDER_SPECK });
      const obj = s.group.getObjectByName(`wonder:${w.id}`);
      s.update(0, 1 / 60, camAt([w.at[0], w.at[1] + 0.95 * real, w.at[2]]));
      expect(obj.visible, w.kind).toBe(true);
      s.update(0, 1 / 60, camAt([w.at[0], w.at[1] + 1.05 * real, w.at[2]]));
      expect(obj.visible, w.kind).toBe(false);
    }
    // (moved with the group: where it is, not where the numbers in it are)
    const w = HAND.wonders[1];
    s.reanchor([390000, 0, 0]);
    s.update(0, 1 / 60, camAt([w.at[0] - 390000, w.at[1] + 10, w.at[2]]));
    expect(s.group.getObjectByName(`wonder:${w.id}`).visible).toBe(true);
    s.dispose();
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
});
