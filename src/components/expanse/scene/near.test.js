import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LOOKS } from '../../galaxy/bodies';
import { moonAt, orbitAt } from '../gen/orbits';
import { addBodies } from '../gen/systems';
import { HAND } from './fixtures/hand';
import { levelWeights } from './levels';
import { AHEAD, DISC_RADII, LET_GO, buildReach, createNear, strengthOf } from './near';
import { MOON_LOOK, TYPE_LOOK } from './sectors';

const SECTOR = addBodies(HAND);
const [A, B] = SECTOR.systems;
const [ROCK, GAS] = A.planets;
const RA = buildReach(A);

// a body builder that keeps what it's given and what's done to it
function fakeBuild() {
  const made = [];
  const build = (look, opts) => {
    const b = {
      group: new THREE.Group(),
      look,
      opts,
      radius: opts.r,
      reach: opts.r,
      suns: null,
      t: null,
      camera: null,
      detail: 1,
      disposed: false,
      update(t, camera) {
        b.t = t;
        b.camera = camera;
      },
      setSuns(list) {
        b.suns = list.map((s) => ({ dir: s.dir.clone(), color: s.color.clone() }));
      },
      setDetail(k) {
        b.detail = k;
      },
      dispose() {
        b.disposed = true;
      },
    };
    made.push(b);
    return b;
  };
  return { made, build };
}

// a near in a group of its own, its bodies faked
function nearOf({ systemsBuilt = 1, ...more } = {}) {
  const group = new THREE.Group();
  const fake = fakeBuild();
  const near = createNear(group, { budget: { systemsBuilt, expanseMs: 1.5 }, tier: 'mid', build: fake.build, ...more });
  return { group, near, made: fake.made };
}
// frames enough for whatever's wanted to be made and shown
const settle = (near, systems, cam, t = 0, frames = 100) => {
  for (let i = 0; i < frames; i++) near.update(systems, cam, t, null);
};
const named = (group, prefix) => {
  const out = [];
  group.traverse((o) => o.name.startsWith(prefix) && out.push(o.name.slice(prefix.length)));
  return out;
};
const above = (s, k) => [s.at[0], s.at[1] + k, s.at[2]];
const along = (s, k) => [s.at[0] + k, s.at[1], s.at[2]];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// a system copied `by` along x, with ids of its own
function moved(s, by, id) {
  const at = (p) => [p[0] + by, p[1], p[2]];
  return { ...s, id, at: at(s.at), planets: s.planets.map((p, j) => ({ ...p, id: `${id}:${j}`, at: at(p.at), seed: p.seed + 100n })) };
}
// A and a twin of it `gap` off along x
const twins = (gap) => addBodies({ ...HAND, systems: [HAND.systems[0], moved(HAND.systems[0], gap, 'E:5,0:9')] }).systems;

describe('a system’s build reach', () => {
  it('is its reach, or seven of a body’s radii past where it goes round its star', () => {
    let want = A.reach;
    for (const p of A.planets) {
      const d = dist(p.at, A.at);
      want = Math.max(want, d + DISC_RADII * p.radius);
      for (const m of p.moonList) want = Math.max(want, d + m.orbit + DISC_RADII * m.radius);
    }
    expect(RA).toBe(want);
    expect(RA).toBeGreaterThan(A.reach); // (the gas giant's 700 radii out)
    const bare = { ...A, planets: [] };
    expect(buildReach(bare)).toBe(bare.reach);
  });

  it('keeps every body seven of its radii from a camera outside it, wherever its orbit has it', () => {
    for (const t of [0, 777, 30000]) {
      const at = A.planets.flatMap((p) => {
        const P = orbitAt(p, t);
        return [[P, p.radius], ...p.moonList.map((m) => [moonAt(m, p, t), m.radius])];
      });
      for (let k = 0; k < 64; k++) {
        const u = (k + 0.5) / 64;
        const th = k * 2.4;
        const r = Math.sqrt(1 - (2 * u - 1) ** 2);
        const cam = [A.at[0] + RA * r * Math.cos(th), A.at[1] + RA * (2 * u - 1), A.at[2] + RA * r * Math.sin(th)];
        for (const [P, radius] of at) expect(dist(cam, P)).toBeGreaterThanOrEqual(DISC_RADII * radius - 1e-6);
      }
    }
  });
});

describe('the nearest systems, built', () => {
  it('builds nothing with the camera outside every reach', () => {
    const { group, near, made } = nearOf();
    settle(near, SECTOR.systems, above(A, AHEAD * RA + 10));
    expect(made).toHaveLength(0);
    expect(group.children).toHaveLength(0);
    expect(near.built().size).toBe(0);
    expect(near.stars()).toEqual([]);
    expect(near.solids()).toEqual([]);
  });

  it('builds the system whose reach holds the camera: its star, planets, moons and a ring for each ring band', () => {
    const { group, near, made } = nearOf();
    settle(near, SECTOR.systems, above(A, 0.5 * RA));
    expect(named(group, 'star:')).toEqual([A.id]);
    expect(named(group, 'planet:')).toEqual(A.planets.map((p) => p.id));
    expect(named(group, 'moon:')).toEqual(GAS.moonList.map((m) => m.id));
    expect(named(group, 'ring:')).toEqual([GAS.id]); // (the rock has no ring band)
    expect(GAS.ringBand).toBeTruthy();
    expect(ROCK.ringBand).toBeNull();
    // each planet in its type's look, each moon in its kind's, small
    expect(made.map((b) => b.look)).toEqual([TYPE_LOOK.rock, TYPE_LOOK.gas, ...GAS.moonList.map((m) => MOON_LOOK[m.type])]);
    expect(made[1].opts).toEqual({ r: GAS.radius, tier: 'mid' });
    for (const [b, m] of made.slice(2).map((b, q) => [b, GAS.moonList[q]])) expect(b.opts).toEqual({ r: m.radius, small: true, tier: 'mid' });
    expect([...near.built()]).toEqual([[A.id, RA]]);
    // B, 40,000 off, isn't
    expect(named(group, 'star:')).not.toContain(B.id);
  });

  it('puts the planets where their orbits have them on the shared clock, and the moons where theirs do', () => {
    const { group, near } = nearOf();
    const cam = above(A, 0.5 * RA);
    for (const t of [0, 1000]) {
      settle(near, SECTOR.systems, cam, t, t ? 1 : 100);
      for (const p of A.planets) {
        expect(group.getObjectByName(`planet:${p.id}`).position.toArray()).toEqual(orbitAt(p, t));
        for (const m of p.moonList) expect(group.getObjectByName(`moon:${m.id}`).position.toArray()).toEqual(moonAt(m, p, t));
      }
    }
    expect(dist(orbitAt(GAS, 0), orbitAt(GAS, 1000))).toBeGreaterThan(10); // (they moved)
    expect(group.getObjectByName(`star:${A.id}`).position.toArray()).toEqual(A.at);
    expect(group.getObjectByName(`star:${A.id}`).scale.x).toBe(A.star.size);
  });

  it('gives the star’s light and the solids, where they are, in arrays it keeps', () => {
    const { near } = nearOf();
    const cam = above(A, 0.5 * RA);
    settle(near, SECTOR.systems, cam, 0);
    expect(near.stars()).toEqual([{ id: A.id, at: A.at, r: A.star.size, colour: A.star.color, strength: strengthOf(A.star.class), reach: 3 * A.reach }]);
    const solids = near.solids();
    expect(solids.map((o) => o.id)).toEqual([A.id, ROCK.id, GAS.id, ...GAS.moonList.map((m) => m.id)]);
    expect(solids[0]).toEqual({ id: A.id, at: A.at, r: A.star.size, reach: A.star.size * 1.4 });
    const gas = solids[2];
    expect(gas.r).toBe(GAS.radius);
    expect(gas.reach).toBeCloseTo(GAS.radius * (LOOKS[TYPE_LOOK.gas].atmo?.top ?? 1), 12);
    expect(gas.at).toEqual(orbitAt(GAS, 0));
    near.update(SECTOR.systems, cam, 1000, null);
    expect(near.solids()).toBe(solids); // (the same array)
    expect(solids[2]).toBe(gas); // (the same entry, its place updated in it)
    expect(gas.at).toEqual(orbitAt(GAS, 1000));
    expect(solids[3].at).toEqual(moonAt(GAS.moonList[0], GAS, 1000));
    expect(near.stars()).toBe(near.stars());
  });

  it('keeps a system past its reach and lets it go past 1.3 of it, every body disposed', () => {
    const { group, near, made } = nearOf();
    settle(near, SECTOR.systems, above(A, 0.5 * RA));
    settle(near, SECTOR.systems, above(A, 1.2 * RA), 0, 1);
    expect(named(group, 'planet:')).toHaveLength(2);
    expect(near.built().has(A.id)).toBe(true);
    expect(LET_GO * RA).toBeLessThan(1.4 * RA);
    settle(near, SECTOR.systems, above(A, 1.4 * RA), 0, 1);
    expect(group.children).toHaveLength(0);
    expect(made.length).toBeGreaterThan(0);
    expect(made.every((b) => b.disposed)).toBe(true);
    expect(near.built().size).toBe(0);
    expect(near.stars()).toEqual([]);
    expect(near.solids()).toEqual([]);
  });

  it('lets a system go when it’s no longer among those it’s given (its sector gone)', () => {
    const { group, near, made } = nearOf();
    settle(near, SECTOR.systems, above(A, 0.5 * RA));
    near.update([B], above(A, 0.5 * RA), 0, null);
    expect(group.children).toHaveLength(0);
    expect(made.every((b) => b.disposed)).toBe(true);
    near.update([], above(A, 0.5 * RA), 0, null);
    expect(near.built().size).toBe(0);
  });

  it('builds as many as the budget says of those whose reaches hold the camera, the nearest first', () => {
    const [one, two] = twins(1500);
    const cam = along(one, 700); // (700 from the one, 800 from the other)
    expect(dist(cam, two.at)).toBeLessThan(buildReach(two));
    const a = nearOf({ systemsBuilt: 1 });
    settle(a.near, [two, one], cam);
    expect(named(a.group, 'star:')).toEqual([one.id]);
    const b = nearOf({ systemsBuilt: 2 });
    settle(b.near, [two, one], cam);
    expect(named(b.group, 'star:').sort()).toEqual([one.id, two.id].sort());
    expect([...b.near.built().keys()].sort()).toEqual([one.id, two.id].sort());
    expect(b.near.stars().map((s) => s.id).sort()).toEqual([one.id, two.id].sort());
  });

  it('gives its place to a nearer system that wants it only once the camera’s past its own reach', () => {
    const [one, two] = twins(1800);
    const R = buildReach(one);
    const { group, near } = nearOf({ systemsBuilt: 1 });
    settle(near, [one, two], along(one, 300));
    expect(named(group, 'star:')).toEqual([one.id]);
    // within its reach, its discs given up: kept, though the other's much
    // nearer and its reach holds the camera
    const inside = along(one, 0.93 * R);
    expect(dist(inside, two.at)).toBeLessThan(0.5 * dist(inside, one.at));
    expect(dist(inside, two.at)).toBeLessThan(buildReach(two));
    settle(near, [one, two], inside, 0, 5);
    expect(named(group, 'star:')).toEqual([one.id]);
    // past it, and the other much nearer: the other's
    settle(near, [one, two], along(one, 1.2 * R));
    expect(named(group, 'star:')).toEqual([two.id]);
  });

  it('makes a system a little a frame, by the budget’s time, and shows it whole once it’s all made', () => {
    let clock = 0;
    const { group, near, made } = nearOf({ timer: () => (clock += 10) }); // (each body takes longer than the budget)
    const cam = above(A, 0.5 * RA);
    const bodies = 1 + A.planets.length + GAS.moonList.length + 1; // (the star, the planets, the moons, the ring)
    const root = () => group.children[0];
    near.update(SECTOR.systems, cam, 0, null);
    expect(named(group, 'star:')).toEqual([A.id]);
    expect(made).toHaveLength(0);
    for (let k = 2; k < bodies; k++) {
      near.update(SECTOR.systems, cam, 0, null);
      expect(made.length, `frame ${k}`).toBe(Math.min(k - 1, A.planets.length + GAS.moonList.length));
      expect(root().visible).toBe(false);
      expect(near.built().size).toBe(0);
    }
    near.update(SECTOR.systems, cam, 0, null);
    expect(named(group, 'ring:')).toEqual([GAS.id]);
    expect(root().visible).toBe(true);
    expect(near.built().size).toBe(1);
  });

  it('readies each system’s meshes once, all of them, and shows it only when that’s done', async () => {
    const asked = [];
    let done;
    const prepare = (o) => {
      asked.push(o);
      return new Promise((res) => (done = res));
    };
    const { group, near } = nearOf({ prepare });
    const cam = above(A, 0.5 * RA);
    settle(near, SECTOR.systems, cam);
    expect(asked).toHaveLength(1);
    const [root] = asked;
    expect(root.parent).toBe(group);
    const meshes = [];
    group.traverse((o) => /^(star|planet|moon|ring):/.test(o.name) && meshes.push(o));
    expect(meshes).toHaveLength(1 + 2 + 2 + 1);
    for (const m of meshes) {
      let o = m;
      while (o && o !== root) o = o.parent;
      expect(o, m.name).toBe(root);
    }
    expect(root.visible).toBe(false);
    expect(near.built().size).toBe(0); // (its discs stay whole meanwhile)
    expect(near.solids().length).toBe(5); // (but it's there to hit)
    done();
    await Promise.resolve();
    expect(root.visible).toBe(true);
    expect([...near.built()]).toEqual([[A.id, RA]]);
    settle(near, SECTOR.systems, cam, 0, 10);
    expect(asked).toHaveLength(1);
  });

  it('readies nothing it let go before it was ready', async () => {
    let done;
    const { group, near } = nearOf({ prepare: () => new Promise((res) => (done = res)) });
    settle(near, SECTOR.systems, above(A, 0.5 * RA));
    near.update(SECTOR.systems, above(A, 2 * RA), 0, null);
    done();
    await Promise.resolve();
    expect(group.children).toHaveLength(0);
    expect(near.built().size).toBe(0);
  });

  it('lays each ring in its planet’s orbit plane, at the band’s radii, and fades it in as the system’s discs fade out', () => {
    const { group, near } = nearOf();
    const ring = () => group.getObjectByName(`ring:${GAS.id}`);
    const z = new THREE.Vector3();
    for (const t of [0, 1000, 30000]) {
      settle(near, SECTOR.systems, above(A, 0.5 * RA), t, t ? 1 : 100);
      const P = orbitAt(GAS, t);
      expect(ring().position.toArray()).toEqual(P);
      z.set(0, 0, 1).applyQuaternion(ring().quaternion);
      const r0 = new THREE.Vector3(P[0] - A.at[0], P[1] - A.at[1], P[2] - A.at[2]).normalize();
      expect(Math.abs(z.dot(r0))).toBeLessThan(1e-9);
    }
    const { parameters } = ring().geometry;
    expect(parameters.innerRadius).toBe(GAS.ringBand.inner);
    expect(parameters.outerRadius).toBe(GAS.ringBand.outer);
    const u = ring().material.uniforms;
    expect(u.uFade.value).toBe(1);
    for (const k of [0.9, 1.1]) {
      near.update(SECTOR.systems, above(A, k * RA), 0, null);
      expect(u.uFade.value).toBeCloseTo(levelWeights(k * RA, { reach: RA }).full, 12);
    }
    expect(u.uFade.value).toBe(0);
    expect(ring().material.transparent).toBe(true);
    expect(ring().material.depthWrite).toBe(false);
    expect(ring().material.side).toBe(THREE.DoubleSide);
  });

  it('bands each ring by its planet’s seed, no texture', () => {
    const looks = (systems) => {
      const { group, near } = nearOf({ systemsBuilt: 2 });
      settle(near, systems, along(systems[0], 700));
      const out = [];
      group.traverse((o) => o.name.startsWith('ring:') && out.push(o.material.uniforms));
      return out;
    };
    const [one, two] = looks(twins(1500));
    const [again] = looks(twins(1500));
    const pick = (u) => [u.uColor.value.toArray(), u.uWaves.value.toArray(), u.uPhases.value.toArray()];
    expect(pick(again)).toEqual(pick(one));
    expect(pick(two)).not.toEqual(pick(one));
    for (const v of Object.values(one)) expect(v.value?.isTexture ?? false).toBe(false);
  });

  it('lights each planet and moon from its star, the way it is as drawn, the map turned', () => {
    const turned = new THREE.Group();
    turned.rotation.y = 1;
    const { group, near, made } = nearOf();
    turned.add(group);
    settle(near, SECTOR.systems, above(A, 0.5 * RA), 1000);
    const want = (P) => new THREE.Vector3(A.at[0] - P[0], A.at[1] - P[1], A.at[2] - P[2]).applyAxisAngle(new THREE.Vector3(0, 1, 0), 1).normalize();
    const [rock, gas, moon] = made;
    for (const [b, P] of [[rock, orbitAt(ROCK, 1000)], [gas, orbitAt(GAS, 1000)], [moon, moonAt(GAS.moonList[0], GAS, 1000)]]) {
      expect(b.suns).toHaveLength(1);
      b.suns[0].dir.toArray().forEach((v, i) => expect(v).toBeCloseTo(want(P).getComponent(i), 9));
      expect(b.suns[0].color.toArray()).toEqual(new THREE.Color(A.star.color).toArray());
    }
  });

  it('runs each body’s own clock and the camera it’s given', () => {
    const { near, made } = nearOf();
    const camera = new THREE.PerspectiveCamera();
    for (let i = 0; i < 100; i++) near.update(SECTOR.systems, above(A, 0.5 * RA), 1.7e9, camera, 12.5);
    expect(made.every((b) => b.t === 12.5 && b.camera === camera)).toBe(true);
  });

  it('takes the pace’s step: the bodies’ ground detail goes from step 2, and comes back', () => {
    const { near, made } = nearOf();
    near.setStep(2);
    settle(near, SECTOR.systems, above(A, 0.5 * RA));
    expect(made.length).toBeGreaterThan(0);
    expect(made.every((b) => b.detail === 0)).toBe(true);
    near.setStep(1);
    expect(made.every((b) => b.detail === 1)).toBe(true);
  });

  it('gives a star’s light its strength by its class', () => {
    for (const c of ['O', 'B', 'A', 'F', 'G']) expect(strengthOf(c), c).toBe(0.9);
    for (const c of ['K', 'M']) expect(strengthOf(c), c).toBe(0.7);
    for (const c of ['white dwarf', 'neutron']) expect(strengthOf(c), c).toBe(0.4);
  });

  it('lets everything go on dispose', () => {
    const parent = new THREE.Group();
    const { group, near, made } = nearOf();
    parent.add(group);
    settle(near, SECTOR.systems, above(A, 0.5 * RA));
    near.dispose();
    expect(group.children).toHaveLength(0);
    expect(group.parent).toBe(parent); // (the group is the caller's)
    expect(made.every((b) => b.disposed)).toBe(true);
    expect(near.built().size).toBe(0);
    expect(near.solids()).toEqual([]);
  });
});
