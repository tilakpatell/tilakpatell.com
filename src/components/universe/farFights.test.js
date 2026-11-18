import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FAR, MIN_ANGLE, SKY, createFarFights, fightLabel, impostorFor, isFar, pickFightNode, skyPlace } from './farFights';
import { NODES } from './waypoints';
import { REGIONS, regionAt } from './regions';
import { POSITIONS } from './layout';
import { WONDERS } from './deep';

// a seeded random, so a pick is the same every run; the seed is mixed
// first, so neighbouring seeds don’t start alike
const seeded = (s = 7) => {
  let seed = Math.imul(s ^ (s >>> 16), 2654435761) >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
};
const dist = (a, b) => Math.hypot(a.x - b[0], a.y - b[1], a.z - b[2]);

describe('far fights', () => {
  it('is far past 2,000 from the camera, and only then', () => {
    expect(FAR).toBe(2000);
    expect(isFar([0, 0, 2001], { x: 0, y: 0, z: 0 })).toBe(true);
    expect(isFar([0, 0, 1999], { x: 0, y: 0, z: 0 })).toBe(false);
    expect(isFar({ x: 3000, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })).toBe(true);
  });

  it('gives a bigger fight more points, within bounds', () => {
    const small = impostorFor({ at: [0, 0, 0], size: 4, bolts: 0 });
    const big = impostorFor({ at: [0, 0, 0], size: 40, bolts: 0 });
    expect(big.points).toBeGreaterThan(small.points);
    expect(Number.isInteger(small.points)).toBe(true);
    expect(impostorFor({ at: [0, 0, 0], size: 0, bolts: 0 }).points).toBeGreaterThanOrEqual(8);
    expect(impostorFor({ at: [0, 0, 0], size: 1e6, bolts: 0 }).points).toBe(impostorFor({ at: [0, 0, 0], size: 1e5, bolts: 0 }).points);
  });

  it('flickers faster the more bolts are flying, within bounds', () => {
    const calm = impostorFor({ at: [0, 0, 0], size: 6, bolts: 0 });
    const hot = impostorFor({ at: [0, 0, 0], size: 6, bolts: 12 });
    expect(calm.flicker).toBeGreaterThan(0);
    expect(hot.flicker).toBeGreaterThan(calm.flicker);
    expect(impostorFor({ at: [0, 0, 0], size: 6, bolts: 1e6 }).flicker).toBeLessThanOrEqual(12);
  });

  it('names the region a fight is in, or the void', () => {
    const me = POSITIONS.middleearth;
    expect(regionAt(...me).name).toBe('The Old Roads');
    expect(fightLabel(me)).toBe('Fighting in the Old Roads');
    expect(fightLabel({ x: me[0], y: me[1], z: me[2] })).toBe('Fighting in the Old Roads');
    expect(fightLabel(POSITIONS.office)).toBe('Fighting in Earthside');
    expect(fightLabel(WONDERS.find((w) => w.id === 'maw').at)).toBe('Fighting near the Maw');
    expect(fightLabel([0, 0, 0])).toBe('Fighting in the home system');
    // (a point a long way from everything)
    const voidAt = [0, 0, 200000];
    expect(regionAt(...voidAt)).toBeNull();
    expect(fightLabel(voidAt)).toBe('Fighting in the void');
  });
});

describe('skyPlace', () => {
  const cam = { x: 100, y: 0, z: -200 };
  it('leaves a fight inside the sky where it is, at least a few pixels across', () => {
    const near = skyPlace([100, 0, 2800], cam, 40);
    expect(near.at).toEqual([100, 0, 2800]);
    expect(near.spread).toBe(40);
    const far = skyPlace([100, 0, 19800], cam, 40);
    expect(far.at).toEqual([100, 0, 19800]);
    expect(far.spread).toBeCloseTo(20000 * MIN_ANGLE, 6);
  });

  it('brings one past the sky in to it along the same line, the same size to the eye', () => {
    const at = [30100, 4000, 39800];
    const d = Math.hypot(30000, 4000, 40000);
    const p = skyPlace(at, cam, 40);
    expect(Math.hypot(p.at[0] - cam.x, p.at[1] - cam.y, p.at[2] - cam.z)).toBeCloseTo(SKY, 4);
    // (the same direction, and the same angle across)
    expect((p.at[0] - cam.x) / SKY).toBeCloseTo(30000 / d, 6);
    expect((p.at[2] - cam.z) / SKY).toBeCloseTo(40000 / d, 6);
    expect(p.spread / SKY).toBeCloseTo(MIN_ANGLE, 6);
    expect(SKY).toBeLessThan(30000); // (inside the camera's far plane)
  });
});

describe('pickFightNode', () => {
  const ship = { x: 0, y: 0, z: 0 };

  it('picks a node of the region you’re headed for, further than FAR from you', () => {
    for (const r of REGIONS.slice(1)) {
      for (let s = 1; s < 8; s++) {
        const n = pickFightNode({ ship, headedFor: r.id, rand: seeded(s) });
        expect(n, r.id).not.toBeNull();
        expect(NODES).toContain(n);
        expect(n.region).toBe(r.id);
        expect(dist(ship, n.at)).toBeGreaterThan(FAR);
      }
    }
  });

  it('picks a random beacon further than FAR when you’re headed nowhere', () => {
    const seen = new Set();
    for (let s = 1; s < 40; s++) {
      const n = pickFightNode({ ship, headedFor: null, rand: seeded(s) });
      expect(n.kind).toBe('beacon');
      expect(dist(ship, n.at)).toBeGreaterThan(FAR);
      seen.add(n.id);
    }
    expect(seen.size).toBeGreaterThan(3);
    // (the home system’s beacons are under FAR from its middle)
    expect([...seen].some((id) => id.startsWith('beacon:home'))).toBe(false);
  });

  it('never picks one within FAR, falling back to a beacon, and gives null when there’s none', () => {
    // sitting on Middle-earth’s beacon, headed there: its own nodes are all near
    const b = NODES.find((n) => n.id === 'beacon:veil'); // (the Old Roads': its biggest member is the Veil)
    const here = { x: b.at[0], y: b.at[1], z: b.at[2] };
    for (let s = 1; s < 20; s++) {
      const n = pickFightNode({ ship: here, headedFor: 'middleearth', rand: seeded(s) });
      expect(dist(here, n.at)).toBeGreaterThan(FAR);
    }
    expect(pickFightNode({ ship, headedFor: null, rand: seeded(1), nodes: [] })).toBeNull();
    expect(pickFightNode({ ship, headedFor: 'home', rand: seeded(1), nodes: NODES.filter((n) => n.region === 'home') })).toBeNull();
  });
});

describe('createFarFights', () => {
  const camera = new THREE.PerspectiveCamera();
  const fight = (id, at, extra = {}) => ({ id, at, size: 6, hot: 0.5, ...extra });

  it('draws a cluster for each far fight and none for one within FAR', () => {
    const scene = new THREE.Scene();
    const ff = createFarFights(scene);
    camera.position.set(0, 0, 0);
    ff.update(1 / 60, [fight('a', [0, 0, -5000]), fight('b', [0, 0, -1000]), fight('c', { x: 4000, y: 0, z: 0 })], camera);
    const shown = scene.children.filter((o) => o.isPoints && o.visible);
    expect(shown).toHaveLength(2);
    for (const p of shown) expect(p.material.blending).toBe(THREE.AdditiveBlending);
    expect(shown.map((p) => p.position.toArray())).toEqual(expect.arrayContaining([[0, 0, -5000], [4000, 0, 0]]));
    ff.dispose();
    expect(scene.children.filter((o) => o.isPoints)).toHaveLength(0);
  });

  it('reuses its clusters frame to frame, and hides one once the fight’s gone', () => {
    const scene = new THREE.Scene();
    const ff = createFarFights(scene);
    camera.position.set(0, 0, 0);
    ff.update(1 / 60, [fight('a', [0, 0, -5000])], camera);
    const first = scene.children.filter((o) => o.isPoints);
    const geo = first.map((p) => p.geometry);
    const mats = new Set(first.map((p) => p.material));
    for (let i = 0; i < 30; i++) ff.update(1 / 60, [fight('a', [0, 0, -5000]), fight('b', [5000, 0, 0])], camera);
    const now = scene.children.filter((o) => o.isPoints);
    expect(now.length).toBe(first.length); // (a pool, made once)
    expect(now.map((p) => p.geometry)).toEqual(geo);
    expect(new Set(now.map((p) => p.material)).size).toBe(mats.size); // (one material for all of them)
    ff.update(1 / 60, [], camera);
    expect(scene.children.filter((o) => o.isPoints && o.visible)).toHaveLength(0);
    ff.dispose();
  });

  it('draws a bigger fight with more points, and a hotter one flickering faster', () => {
    const scene = new THREE.Scene();
    const ff = createFarFights(scene);
    camera.position.set(0, 0, 0);
    ff.update(1 / 60, [fight('small', [0, 0, -5000], { size: 4, hot: 0 }), fight('big', [5000, 0, 0], { size: 40, hot: 1 })], camera);
    const at = (z) => scene.children.find((o) => o.isPoints && o.visible && o.position.z === z);
    const small = at(-5000);
    const big = at(0);
    expect(big.geometry.drawRange.count).toBeGreaterThan(small.geometry.drawRange.count);
    expect(big.userData.flicker).toBeGreaterThan(small.userData.flicker);
    ff.dispose();
  });
});
