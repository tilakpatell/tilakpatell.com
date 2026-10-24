import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { moonAt, orbitAt } from '../gen/orbits';
import { addBodies } from '../gen/systems';
import { createDiscs, pickDiscs } from './discs';
import { HAND } from './fixtures/hand';
import { FAR, discPx, levelWeights, realAt } from './levels';
import { MOON_LOOK, TYPE_LOOK, WONDER, WONDER_SPECK, lookColour } from './sectors';

const SECTOR = addBodies(HAND);
const [A, B] = SECTOR.systems;
const GAS = A.planets[1];
const ALL_A = [A.id, ...A.planets.map((p) => p.id), ...A.planets.flatMap((p) => p.moonList.map((m) => m.id))];
const ALL_B = [B.id, ...B.planets.map((p) => p.id)];

// a far layer that keeps what it's given, a list a frame
function fakeFar() {
  const frames = [];
  let rows = null;
  return {
    frames,
    last: () => frames.at(-1),
    byId: () => new Map(frames.at(-1).map((row) => [row.id, row])),
    discs: {
      begin() {
        rows = [];
      },
      push(x, y, z, r, cr, cg, cb, lx, ly, lz, alpha, id) {
        rows.push({ at: [x, y, z], r, colour: [cr, cg, cb], light: [lx, ly, lz], alpha, id });
      },
      end() {
        frames.push(rows);
      },
    },
  };
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const rgb = (hex) => new THREE.Color(hex).toArray();
const from = (a, b) => a.map((v, i) => v - b[i]);

// a point 10,000 from A's star and 40,000 from B's (above the line between them)
function between() {
  const ab = from(B.at, A.at);
  const d = Math.hypot(...ab);
  const u = ab.map((v) => v / d);
  const c = (d * d + 1e8 - 1.6e9) / (2 * d * 1e4); // (the cosine at A, between B and the camera)
  const s = Math.sqrt(1 - c * c);
  return A.at.map((v, i) => v + 1e4 * (c * u[i] + (i === 1 ? s : 0)));
}

// two hundred lone stars in a 60,000 cube, none within 2,000 of the x axis
function field(count = 200) {
  let seed = 1;
  const rng = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const systems = Array.from({ length: count }, (_, i) => ({
    id: `E:9,9:${i}`,
    at: [rng() * 60000 - 30000, (rng() < 0.5 ? -1 : 1) * (2000 + rng() * 28000), rng() * 60000 - 30000],
    star: { class: 'G', color: '#ffffff', size: 100 },
    planets: [],
  }));
  return addBodies({ id: 'E:9,9', systems, wonders: [] });
}
const alphas = (far) => new Map(far.last().map((row) => [row.id, row.alpha]));
// the most any disc's alpha moved between two frames, one that came or went counted from nothing
function moved(was, now) {
  let most = 0;
  for (const id of new Set([...was.keys(), ...now.keys()])) most = Math.max(most, Math.abs((now.get(id) ?? 0) - (was.get(id) ?? 0)));
  return most;
}
const LENS = { fovY: 34, height: 1080 }; // the chase's lens on a 1,080 px screen, as levels.test.js has it
// the most any disc came or went in pixels between two frames of rows by id
// (its alpha's change times its size from `cam`), but those `skip` says
function movedPx(was, now, cam, skip = () => false) {
  let most = 0;
  for (const id of new Set([...was.keys(), ...now.keys()])) {
    if (skip(id)) continue;
    const row = now.get(id) ?? was.get(id);
    most = Math.max(most, Math.abs((now.get(id)?.alpha ?? 0) - (was.get(id)?.alpha ?? 0)) * discPx(dist(row.at, cam), row.r, LENS));
  }
  return most;
}

describe('picking discs', () => {
  // four numbers a candidate: where it is and its radius
  const xyzr = (rows) => Float64Array.from(rows.flat());

  it('keeps the nearest it may, far to near', () => {
    const c = xyzr([[0, 0, -5000, 10], [0, 0, -1000, 10], [0, 0, -3000, 10], [0, 0, -2000, 10], [0, 0, -4000, 10]]);
    expect([...pickDiscs(c, 5, [0, 0, 0], { far: FAR, max: 3 })]).toEqual([2, 3, 1]);
    expect([...pickDiscs(c, 5, [0, 0, 0], { far: FAR, max: 10 })]).toEqual([0, 4, 2, 3, 1]);
    expect([...pickDiscs(c, 2, [0, 0, 0], { far: FAR, max: 10 })]).toEqual([0, 1]); // (the first n alone)
    expect([...pickDiscs(c, 5, [0, 0, 0], { far: FAR, max: 0 })]).toEqual([]);
  });

  it('drops anything past the far plane by more than its radius', () => {
    const c = xyzr([[45050, 0, 0, 100], [45050, 0, 0, 10], [0, 45000, 0, 0], [0, 0, -45101, 100]]);
    expect([...pickDiscs(c, 4, [0, 0, 0], { far: 45000, max: 10 })]).toEqual([0, 2]);
  });

  it('breaks a tie by index: the lower is the nearer, kept first and drawn last', () => {
    const c = xyzr([[1000, 0, 0, 1], [0, 1000, 0, 1], [0, 0, 1000, 1], [-1000, 0, 0, 1]]);
    expect([...pickDiscs(c, 4, [0, 0, 0], { far: FAR, max: 2 })]).toEqual([1, 0]);
    expect([...pickDiscs(c, 4, [0, 0, 0], { far: FAR, max: 4 })]).toEqual([3, 2, 1, 0]);
  });

  it('measures from the camera, however far out', () => {
    const c = xyzr([[1e9 + 100, 0, 0, 1], [1e9 - 50, 0, 0, 1], [1e9 + 46000, 0, 0, 1]]);
    expect([...pickDiscs(c, 3, [1e9, 0, 0], { far: FAR, max: 1 })]).toEqual([1]);
    expect([...pickDiscs(c, 3, [1e9, 0, 0], { far: FAR, max: 5 })]).toEqual([0, 1]);
  });
});

describe('the discs, fed', () => {
  it('pushes a system 10,000 off whole, and one 40,000 off fading in at the far plane', () => {
    const far = fakeFar();
    const discs = createDiscs(far, { budget: { discs: 100 } });
    const cam = between();
    expect(dist(cam, A.at)).toBeCloseTo(10000, 6);
    expect(dist(cam, B.at)).toBeCloseTo(40000, 6);
    discs.feed([SECTOR, null], cam, 0); // (a null among them is none)
    const got = far.byId();
    expect(ALL_A.length).toBe(5); // (the star, two planets, two moons)
    for (const id of ALL_A) expect(got.get(id)?.alpha, id).toBe(1);
    for (const id of ALL_B) {
      expect(got.get(id)?.alpha, id).toBeGreaterThan(0);
      expect(got.get(id).alpha, id).toBeLessThan(1);
    }
    expect(got.get(B.id).alpha).toBeCloseTo(levelWeights(40000, { reach: B.reach }).disc, 12);
  });

  it('pushes nothing from a sector past the far plane', () => {
    const far = fakeFar();
    createDiscs(far, { budget: { discs: 100 } }).feed([SECTOR], [0, 0, 0], 0);
    expect(far.last()).toEqual([]);
  });

  it('draws a star shining in its colour, a planet and a moon lit from their star in their look’s, and a wonder as its ball', () => {
    const far = fakeFar();
    createDiscs(far, { budget: { discs: 100 } }).feed([SECTOR], between(), 1000);
    const got = far.byId();
    const star = got.get(A.id);
    expect(star.at).toEqual(A.at);
    expect(star.r).toBe(150);
    expect(star.colour).toEqual(rgb('#fff4ea'));
    expect(star.light).toEqual([0, 0, 0]);

    const p = got.get(GAS.id);
    expect(p.r).toBe(100);
    expect(p.colour).toEqual(rgb(lookColour(TYPE_LOOK.gas)));
    p.light.forEach((v, i) => expect(v).toBeCloseTo(A.at[i] - p.at[i], 6));

    for (const m of GAS.moonList) {
      const row = got.get(m.id);
      expect(row.r).toBe(m.radius);
      expect(row.colour).toEqual(rgb(lookColour(MOON_LOOK[m.type])));
      row.light.forEach((v, i) => expect(v).toBeCloseTo(A.at[i] - row.at[i], 6));
    }

    const [nebula, pulsar, derelict, rogue] = SECTOR.wonders;
    expect(got.has(nebula.id)).toBe(false); // (a nebula is its puffs, lane 1's)
    for (const [w, colour] of [[pulsar, WONDER.pulsar.color], [derelict, WONDER.derelict.dark], [rogue, WONDER.rogue.dark]]) {
      const row = got.get(w.id);
      expect(row.at).toEqual(w.at);
      expect(row.r).toBe(w.size * WONDER[w.kind].r);
      expect(row.colour).toEqual(rgb(colour));
      expect(row.light).toEqual([0, 0, 0]);
      expect(row.alpha).toBe(1);
    }
  });

  it('puts the planets and moons where their orbits have them on the shared clock', () => {
    const far = fakeFar();
    const discs = createDiscs(far, { budget: { discs: 100 } });
    const at = {};
    for (const t of [0, 1000]) {
      discs.feed([SECTOR], between(), t);
      const got = far.byId();
      for (const s of SECTOR.systems)
        for (const p of s.planets) {
          expect(got.get(p.id).at).toEqual(orbitAt(p, t));
          for (const m of p.moonList) expect(got.get(m.id).at).toEqual(moonAt(m, p, t));
        }
      at[t] = got.get(GAS.id).at;
    }
    expect(dist(at[0], at[1000])).toBeGreaterThan(10); // (they move)
    expect(at[0]).toEqual(GAS.at);
  });

  it('gives a system up to its built bodies over the last fifth of its reach, all of it together', () => {
    const far = fakeFar();
    const discs = createDiscs(far, { budget: { discs: 100 } });
    discs.feed([SECTOR], [A.at[0], A.at[1] + 0.9 * A.reach, A.at[2]], 0);
    let got = far.byId();
    const fading = levelWeights(0.9 * A.reach, { reach: A.reach }).disc;
    expect(fading).toBeGreaterThan(0);
    expect(fading).toBeLessThan(1);
    for (const id of ALL_A) expect(got.get(id)?.alpha, id).toBeCloseTo(fading, 12);

    discs.feed([SECTOR], [A.at[0], A.at[1] + 300, A.at[2]], 0);
    got = far.byId();
    for (const id of ALL_A) expect(got.has(id), id).toBe(false);
    for (const id of ALL_B) expect(got.has(id), id).toBe(true);
  });

  it('keeps a system whole that isn’t built, whatever its reach, when told what is', () => {
    const inside = [A.at[0], A.at[1] + 300, A.at[2]];
    for (const [none, some] of [[[], [A.id]], [new Set(), new Set([A.id])]]) {
      let ids = none;
      const far = fakeFar();
      const discs = createDiscs(far, { budget: { discs: 100 }, built: () => ids });
      discs.feed([SECTOR], inside, 0);
      for (const id of ALL_A) expect(far.byId().get(id)?.alpha, id).toBe(1);
      ids = some;
      discs.feed([SECTOR], inside, 0);
      for (const id of ALL_A) expect(far.byId().has(id), id).toBe(false);
    }
  });

  it('gives a built system up by the reach it’s built within, when told it', () => {
    const R = 2 * A.reach;
    let built = new Map([[A.id, R]]);
    const far = fakeFar();
    const discs = createDiscs(far, { budget: { discs: 100 }, built: () => built });
    const at = (k) => [A.at[0], A.at[1] + k, A.at[2]];
    discs.feed([SECTOR], at(1.5 * A.reach), 0); // (past its own reach, within the one it's built in)
    for (const id of ALL_A) expect(far.byId().has(id), id).toBe(false);
    discs.feed([SECTOR], at(0.9 * R), 0);
    const fading = levelWeights(0.9 * R, { reach: R }).disc;
    expect(fading).toBeGreaterThan(0);
    expect(fading).toBeLessThan(1);
    for (const id of ALL_A) expect(far.byId().get(id)?.alpha, id).toBeCloseTo(fading, 12);
    built = new Map();
    discs.feed([SECTOR], at(300), 0); // (one the map hasn't is unbuilt)
    for (const id of ALL_A) expect(far.byId().get(id)?.alpha, id).toBe(1);
  });

  it('gives a wonder up to its ball where the ball is real', () => {
    const pulsar = SECTOR.wonders[1];
    const real = realAt({ r: pulsar.size * WONDER_SPECK });
    const far = fakeFar();
    const discs = createDiscs(far, { budget: { discs: 100 } });
    discs.feed([SECTOR], [pulsar.at[0], pulsar.at[1] + real, pulsar.at[2]], 0);
    expect(far.byId().get(pulsar.id).alpha).toBe(1);
    discs.feed([SECTOR], [pulsar.at[0], pulsar.at[1] + 0.9 * real, pulsar.at[2]], 0);
    expect(far.byId().get(pulsar.id).alpha).toBeCloseTo(levelWeights(0.9 * real, { reach: real }).disc, 12);
    discs.feed([SECTOR], [pulsar.at[0], pulsar.at[1] + 0.5 * real, pulsar.at[2]], 0);
    expect(far.byId().has(pulsar.id)).toBe(false);
  });
});

describe('the budget', () => {
  it('draws no more than it allows, and never pops at its edge: a disc comes and goes at nothing', () => {
    const sector = field();
    const within = sector.systems.filter((s) => dist(s.at, [0, 0, 0]) < FAR).length;
    expect(within).toBeGreaterThan(100); // (so the budget's edge is crossed all the way)
    const far = fakeFar();
    const discs = createDiscs(far, { budget: { discs: 20 } });
    let was = new Map();
    let most = 0;
    let count = 0;
    // 900 units a second at 60 frames a second: 15 a frame
    for (let x = -15000; x <= 15000; x += 15) {
      discs.feed([sector], [x, 0, 0], 0);
      const now = alphas(far);
      count = Math.max(count, now.size);
      if (x > -15000) most = Math.max(most, moved(was, now));
      was = now;
    }
    expect(count).toBe(20);
    expect(most).toBeLessThanOrEqual(0.05);
  });

  it('takes a new budget, cut or raised, over frames: no disc comes or goes by more than 4 px in one', () => {
    const sector = field();
    const cam = [0, 0, 0];
    const settled = (budget) => {
      const far = fakeFar();
      createDiscs(far, { budget: { discs: budget } }).feed([sector], cam, 0);
      return far.byId();
    };
    const far = fakeFar();
    const discs = createDiscs(far, { budget: { discs: 40 } });
    discs.feed([sector], cam, 0);
    expect(far.last().length).toBe(40);
    for (const budget of [5, 40, 12, 40]) {
      discs.setBudget({ discs: budget });
      let was = far.byId();
      let most = 0;
      let frames = 0;
      for (let frame = 1; frame <= 200; frame++) {
        discs.feed([sector], cam, 0);
        const now = far.byId();
        const px = movedPx(was, now, cam);
        if (px > 0) frames = frame;
        most = Math.max(most, px);
        was = now;
      }
      expect(most, `to ${budget}`).toBeLessThanOrEqual(4);
      expect(frames, `to ${budget}`).toBeGreaterThan(1); // (it took frames)
      expect(frames, `to ${budget}`).toBeLessThan(200); // (and settled)
      const want = settled(budget);
      expect(was.size, `to ${budget}`).toBe(want.size);
      for (const [id, row] of want) expect(was.get(id)?.alpha, id).toBeCloseTo(row.alpha, 12);
    }
  });

  it('spends itself on what it draws: a system given up to its built bodies takes none of it', () => {
    const far = fakeFar();
    createDiscs(far, { budget: { discs: 3 } }).feed([SECTOR], [A.at[0], A.at[1] + 300, A.at[2]], 0);
    const [, pulsar, derelict, rogue] = SECTOR.wonders; // (the nearest three, 24,000 to 28,000 off)
    expect([...far.byId().keys()].sort()).toEqual([pulsar.id, derelict.id, rogue.id].sort());
    for (const row of far.last()) expect(row.alpha, row.id).toBe(1);
  });

  it('eases its edge in where a system it had given up comes back, so nothing beyond it pops', () => {
    // a system of a dozen planets in the 200 stars, flown out of at 15 a frame
    const planets = Array.from({ length: 12 }, (_, i) => {
      const orbit = 300 + 150 * i;
      const at = [orbit * Math.cos(2.4 * i), 0, orbit * Math.sin(2.4 * i)];
      return { id: `E:9,9:s:${i}`, name: 'p', type: 'rock', radius: 20, color: '#888888', at, orbit, moons: 0, rings: false, seed: 1n };
    });
    const home = { id: 'E:9,9:s', at: [0, 0, 0], star: { class: 'G', color: '#ffffff', size: 100 }, planets };
    const sector = addBodies({ id: 'E:9,9', systems: [...field().systems, home], wonders: [] });
    const { reach } = sector.systems.at(-1);
    const far = fakeFar();
    const discs = createDiscs(far, { budget: { discs: 20 } });
    const ours = (id) => id === home.id || id.startsWith(`${home.id}:`);
    let was = null;
    let most = 0;
    let back = 0;
    for (let x = 0; x <= 1.2 * reach; x += 15) {
      const cam = [x, 0, 0];
      discs.feed([sector], cam, 0);
      const now = far.byId();
      if (was) most = Math.max(most, movedPx(was, now, cam, ours));
      if (!back && [...now.keys()].some(ours)) back = x;
      was = now;
    }
    expect(back).toBeGreaterThan(0.75 * reach); // (it was given up, and came back)
    expect(back).toBeLessThan(0.85 * reach);
    expect(most).toBeLessThanOrEqual(4);
  });
});
