import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { addBodies } from '../gen/systems';
import { moonAt, orbitAt } from '../gen/orbits';
import { LOOKS } from '../../galaxy/bodies';
import { PLANET_TYPES } from '../gen/tables';
import { AHEAD, STAR_STRENGTH, TYPE_LOOK, buildReach, createNear } from './near';

const planet = (id, type, at, extra = {}) => ({ id, name: id, type, radius: 30, color: '#888888', at, orbit: 400, moons: 0, rings: false, seed: 7n, ...extra });
const SECTOR = addBodies({
  id: 'E:5,0',
  systems: [
    { id: 'A', at: [390000, 0, 0], star: { class: 'G', color: '#fff4ea', size: 150 }, planets: [planet('A:0', 'ringed', [390450, 0, 0], { radius: 60, moons: 2, rings: true }), planet('A:1', 'rock', [390000, 0, 900])] },
    { id: 'B', at: [390800, 0, 0], star: { class: 'M', color: '#ffb56c', size: 90 }, planets: [planet('B:0', 'ocean', [391200, 0, 0])] },
  ],
});
const [A, B] = SECTOR.systems;

const fakeBuild = () => {
  const made = [];
  const build = (look, opts) => {
    const b = { look, opts, group: new THREE.Group(), reach: opts.r * 1.05, suns: null, update: vi.fn(), setDetail: vi.fn(), dispose: vi.fn() };
    b.setSuns = (list) => (b.suns = list.map((x) => ({ dir: x.dir.clone(), color: x.color.clone() }))); // (as buildBody does: copied)
    made.push(b);
    return b;
  };
  return { made, build };
};
const named = (g, prefix) => {
  const out = [];
  g.traverse((o) => o.name.startsWith(prefix) && out.push(o));
  return out;
};

describe('the nearest systems, built whole', () => {
  it('has a look for every planet type, and every look is real', () => {
    for (const { type } of PLANET_TYPES) expect(LOOKS[TYPE_LOOK[type]], type).toBeTruthy();
    for (const id of Object.values(TYPE_LOOK)) expect(LOOKS[id], id).toBeTruthy();
  });

  it('builds a system before any of its bodies would be a disc past 512 px', () => {
    expect(buildReach(A)).toBe(A.reach + AHEAD * 150);
    // a body r across, AHEAD radii off, on a 1,080 px screen at flight.js's 34°
    const px = (2 * 150) / (2 * AHEAD * 150 * Math.tan((34 * Math.PI) / 360)) * 1080;
    expect(px).toBeLessThan(530);
  });

  it('builds nothing with the camera outside every reach', () => {
    const group = new THREE.Group();
    const { build, made } = fakeBuild();
    const near = createNear(group, { budget: { systemsBuilt: 1 }, build });
    near.update(SECTOR.systems, [0, 0, 0], 0, null);
    expect(made).toHaveLength(0);
    expect(near.built().size).toBe(0);
    expect(near.stars()).toEqual([]);
  });

  it('builds a system whose reach holds the camera: its star, planets, moons and rings, on their orbits', () => {
    const group = new THREE.Group();
    const { build, made } = fakeBuild();
    const prepare = vi.fn(() => Promise.resolve());
    const near = createNear(group, { budget: { systemsBuilt: 1 }, build, prepare });
    const cam = [A.at[0] - 200, 0, 0];
    near.update(SECTOR.systems, cam, 0, null);
    expect([...near.built()]).toEqual(['A']);
    expect(named(group, 'star:')).toHaveLength(1);
    const moons = A.planets[0].moonList;
    expect(moons.length).toBeGreaterThan(0);
    expect(made.filter((b) => b.opts.small)).toHaveLength(moons.length);
    expect(made.filter((b) => !b.opts.small).map((b) => b.look)).toEqual(['bespin', 'moon-dust']);
    expect(named(group, 'ring:')).toHaveLength(A.planets.filter((p) => p.ringBand).length);
    // (every mesh readied before it's shown)
    expect(prepare).toHaveBeenCalledTimes(1 + made.length + named(group, 'ring:').length);
    for (const t of [0, 1000]) {
      near.update(SECTOR.systems, cam, t, null);
      expect(made[0].group.position.toArray()).toEqual(orbitAt(A.planets[0], t));
      const m = made.find((b) => b.opts.small);
      expect(m.group.position.toArray()).toEqual(moonAt(moons[0], A.planets[0], t));
    }
    expect(near.stars()).toEqual([{ id: 'A', at: A.at, r: 150, colour: '#fff4ea', strength: STAR_STRENGTH.G, reach: A.reach * 3 }]);
    const solids = near.solids();
    expect(solids.map((s) => s.id)).toEqual(['A', 'A:0', ...moons.map((m) => m.id), 'A:1']);
    const row = solids[1];
    near.update(SECTOR.systems, cam, 2000, null);
    expect(near.solids()[1]).toBe(row); // (moved in place)
    expect(row.at).toEqual(orbitAt(A.planets[0], 2000));
  });

  it('lights each body from its star', () => {
    const { build, made } = fakeBuild();
    const near = createNear(new THREE.Group(), { budget: { systemsBuilt: 1 }, build });
    near.update(SECTOR.systems, [A.at[0] - 200, 0, 0], 0, null);
    const [{ dir }] = made[0].suns;
    const at = orbitAt(A.planets[0], 0);
    const want = new THREE.Vector3(A.at[0] - at[0], A.at[1] - at[1], A.at[2] - at[2]).normalize();
    expect(dir.distanceTo(want)).toBeLessThan(1e-9);
  });

  it('keeps a system to 1.3 × its reach, then lets it go and frees it', () => {
    const group = new THREE.Group();
    const { build, made } = fakeBuild();
    const near = createNear(group, { budget: { systemsBuilt: 1 }, build });
    near.update(SECTOR.systems, [A.at[0] - 200, 0, 0], 0, null);
    near.update(SECTOR.systems, [A.at[0] - buildReach(A) * 1.2, 0, 0], 0, null);
    expect(near.built().has('A')).toBe(true);
    near.update(SECTOR.systems, [A.at[0] - buildReach(A) * 1.4, 0, 0], 0, null);
    expect(near.built().has('A')).toBe(false);
    expect(made.every((b) => b.dispose.mock.calls.length === 1)).toBe(true);
    expect(named(group, 'star:')).toHaveLength(0);
    expect(near.solids()).toEqual([]);
  });

  it('builds as many as the budget allows where reaches overlap', () => {
    const cam = [(A.at[0] + B.at[0]) / 2, 0, 0];
    expect(Math.hypot(cam[0] - A.at[0])).toBeLessThan(A.reach);
    expect(Math.hypot(cam[0] - B.at[0])).toBeLessThan(B.reach);
    const one = createNear(new THREE.Group(), { budget: { systemsBuilt: 1 }, build: fakeBuild().build });
    one.update(SECTOR.systems, cam, 0, null);
    expect(one.built().size).toBe(1);
    const two = createNear(new THREE.Group(), { budget: { systemsBuilt: 2 }, build: fakeBuild().build });
    two.update(SECTOR.systems, cam, 0, null);
    expect([...two.built()].sort()).toEqual(['A', 'B']);
  });

  it('takes the ground’s octaves down with the quality step', () => {
    const { build, made } = fakeBuild();
    const near = createNear(new THREE.Group(), { budget: { systemsBuilt: 1 }, build });
    near.update(SECTOR.systems, [A.at[0] - 200, 0, 0], 0, null);
    near.setStep(2);
    expect(made[0].setDetail).toHaveBeenLastCalledWith(0.5);
    near.dispose();
    expect(near.built().size).toBe(0);
  });
});
