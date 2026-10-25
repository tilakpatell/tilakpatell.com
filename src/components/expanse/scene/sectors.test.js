import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LOOKS } from '../../galaxy/shared/bodies';
import { createFarStars } from '../../universe/shared/far';
import { SECTOR } from '../gen/grid';
import { makeSector } from '../gen/sector';
import { UNIVERSE } from '../gen/seed';
import { addBodies } from '../gen/systems';
import { PLANET_TYPES, WONDERS, WONDER_KINDS } from '../gen/tables';
import { createDiscs } from './discs';
import { FAR, levelWeights } from './levels';
import { createNearThings, pickNear } from './nearThings';
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

  it('draws its nebulae and nothing else: its stars are the far layer’s, its systems near.js’s, its other wonders near things', () => {
    for (const sector of [makeSector(UNIVERSE, 1, -1), HAND]) {
      const nebulae = sector.wonders.filter((w) => w.kind === 'nebula');
      expect(nebulae.length).toBeGreaterThan(0);
      expect(nebulae.length).toBeLessThan(sector.wonders.length);
      const s = createSector(sector);
      expect(s.group.name).toBe(`sector:${sector.id}`);
      expect(s.sector).toBe(sector);
      expect(named(s.group, 'wonder:').map((o) => o.name)).toEqual(nebulae.map((w) => `wonder:${w.id}`));
      for (const prefix of ['star:', 'planet:', 'far-stars']) expect(named(s.group, prefix), prefix).toHaveLength(0);
      expect(s.count()).toBe(nebulae.length);
      s.dispose();
    }
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

  it('shows a nebula’s cloud where it is, not where the numbers in it are, moved with the group', () => {
    const s = createSector(HAND);
    const w = HAND.wonders.find((one) => one.kind === 'nebula');
    s.reanchor([390000, 0, 0]);
    s.update(0, 1 / 60, camAt([w.at[0] - 390000, w.at[1] + 10, w.at[2]]));
    expect(s.group.getObjectByName(`wonder:${w.id}`).visible).toBe(true);
    s.update(0, 1 / 60, camAt([w.at[0], w.at[1] + 10, w.at[2]]));
    expect(s.group.getObjectByName(`wonder:${w.id}`).visible).toBe(false);
    s.dispose();
  });

  it('shows a nebula’s cloud, which has no disc, out to where all of it is within the far plane, fading over the last fifth of that', () => {
    const s = createSector(HAND);
    const w = HAND.wonders.find((one) => one.kind === 'nebula');
    const cloud = s.group.getObjectByName(`wonder:${w.id}`);
    const real = FAR - w.size;
    const m = cloud.material;
    // added as it was, all of it times the blend's constant alpha
    expect([m.blending, m.blendEquation, m.blendSrc, m.blendDst]).toEqual([THREE.CustomBlending, THREE.AddEquation, THREE.ConstantAlphaFactor, THREE.OneFactor]);
    expect([m.blendSrcAlpha, m.blendDstAlpha]).toEqual([THREE.ConstantAlphaFactor, THREE.OneFactor]);
    for (const k of [0, 0.5, 0.8]) {
      s.update(0, 1 / 60, camAt([w.at[0], w.at[1] + k * real, w.at[2]]));
      expect(cloud.visible, `${k}`).toBe(true);
      expect(m.blendAlpha, `${k}`).toBe(1);
    }
    for (const k of [0.85, 0.9, 0.99]) {
      s.update(0, 1 / 60, camAt([w.at[0], w.at[1] + k * real, w.at[2]]));
      expect(cloud.visible, `${k}`).toBe(true);
      expect(m.blendAlpha, `${k}`).toBeCloseTo(levelWeights(k * real, { reach: real }).full, 6);
    }
    s.update(0, 1 / 60, camAt([w.at[0], w.at[1] + real + 1, w.at[2]]));
    expect(cloud.visible).toBe(false);
    s.dispose();
  });

  it('draws every wonder at every distance as its ball or cloud, its disc or its speck', () => {
    // each kind at the least and the most the table makes it, HAND's, and a real sector's
    const sized = WONDERS.flatMap(({ kind, size }, j) => size.map((sz, q) => ({ id: `E:5,0:s${j}${q}`, kind, name: kind, at: [400000 + j * 6000, 0, 20000 + q * 6000], size: sz, seed: BigInt(2 * j + q + 1) })));
    const sectors = [HAND, { ...HAND, wonders: sized }, makeSector(UNIVERSE, 1, -1)];
    // how much of a cloud shows: none hidden, else its blend's constant alpha
    const cloudOf = (o) => (!o.visible ? 0 : o.material.blendAlpha);
    // a ball: a near thing's (nearThings.js), drawn whole while it's picked
    const near = createNearThings(new THREE.Group());
    const ball = (sector, at, id) => {
      near.update(pickNear([sector], at), null, 0);
      return near.shown().has(id) ? 1 : 0;
    };
    // the discs, into a far layer's writer that keeps a frame's rows (with
    // no budget to speak of, their edge is the far plane's from the first),
    // told what's drawn near
    const rows = [];
    const discs = createDiscs({ discs: { begin: () => (rows.length = 0), push: (...a) => rows.push({ id: a[11], alpha: a[10] }), end() {} } }, { budget: { discs: Infinity }, shown: near.shown });
    const camera = camAt([0, 0, 0]);
    const kinds = new Set();
    for (const sector of sectors) {
      const s = createSector(sector);
      for (const w of sector.wonders) {
        kinds.add(w.kind);
        const obj = s.group.getObjectByName(`wonder:${w.id}`);
        const one = { ...sector, wonders: [w], systems: [] };
        for (let d = 0; d <= 60000; d += 100) {
          const at = [w.at[0], w.at[1] + d, w.at[2]];
          camera.position.set(...at);
          camera.updateMatrixWorld();
          s.update(0, 1 / 60, camera);
          const shown = obj ? cloudOf(obj) : ball(one, at, w.id);
          discs.feed([one], at);
          const disc = rows.find((r) => r.id === w.id)?.alpha ?? 0;
          // (its slot's speck, as the far layer's shader has it: in over the far plane's last fifth)
          const speck = levelWeights(d, { reach: 0 }).speck;
          const drawn = shown + disc + speck;
          if (!(drawn >= 0.5)) expect.fail(`${w.id}, a ${w.kind} of size ${w.size}, at ${d}: ${drawn.toFixed(3)} of it drawn`);
        }
      }
      s.dispose();
    }
    expect([...kinds].sort()).toEqual([...WONDER_KINDS].sort());
    near.dispose();
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
