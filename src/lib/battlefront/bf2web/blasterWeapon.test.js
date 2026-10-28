import { describe, expect, it } from 'vitest';
import golden from './fixtures/blaster.json';
import { differs, fixed, ulpsApart } from './fixtures/golden.js';
import { BOLT_END, E11, createBlaster, falloffDamage, rngNext, rngSeedForTick, status, tick } from './blasterWeapon.js';

// bf2-web's blaster driver (WebPort/physics/player/blaster-driver.cpp) played through the JavaScript: left +x, up +y,
// forward +z at (0, 1.6, 0), and for the wall scenario a plane z = wall that the bolt's segment crosses
const CAMERA = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1.6, 0];
const input = (trigger) => ({ trigger, camera: CAMERA, muzzle: CAMERA });
const f = Math.fround;
const wallRay = (wall) => (from, to) => {
  if (wall <= 0 || !(from[2] < wall && to[2] >= wall)) return null;
  const k = f(f(wall - from[2]) / f(to[2] - from[2]));
  return { fraction: k, normal: [0, 0, -1], position: from.map((p, i) => f(p + f(f(to[i] - p) * k))), material: 7, part: 3 };
};

const SCENARIOS = {
  hold() {
    const w = createBlaster();
    const shots = [];
    let overheatTick = -1;
    let clearTick = -1;
    for (let t = 0; t < 300; t++) {
      tick(w, input(true));
      for (const s of w.shots) shots.push([s.tick, fixed(s.heat, 6), fixed(s.cone, 6), s.yawOffset, s.pitchOffset]);
      const st = status(w);
      if (st.overheated && overheatTick < 0) overheatTick = st.ticks;
      if (!st.overheated && overheatTick >= 0 && clearTick < 0) clearTick = st.ticks;
    }
    return { scenario: 'hold', shots, overheatTick, clearTick };
  },
  release() {
    const w = createBlaster();
    for (let t = 0; t < 24 + 55; t++) tick(w, input(t >= 24));
    const cones = [];
    for (let t = 0; t < 60; t++) {
      tick(w, input(false));
      cones.push(fixed(status(w).cone, 6));
    }
    const heatAtRelease = status(w).heat;
    for (let t = 0; t < 120; t++) tick(w, input(false));
    return { scenario: 'release', cones, heatAfter2s: fixed(heatAtRelease, 6), heatAfter6s: fixed(status(w).heat, 6), shots: status(w).ticks };
  },
  tap() {
    const out = { scenario: 'tap' };
    for (const second of [31, 33]) {
      const w = createBlaster();
      const ticks = [];
      for (let t = 0; t < 60; t++) {
        tick(w, input(t === 29 || t === second));
        for (const s of w.shots) ticks.push(s.tick);
      }
      out[`press${second + 1}`] = ticks;
    }
    return out;
  },
  wall() {
    const results = [];
    for (const wall of [10, 30, 50, 0]) {
      const w = createBlaster();
      let fired = -1;
      for (let t = 0; t < 200; t++) {
        tick(w, input(fired < 0), wallRay(wall));
        if (w.shots.length && fired < 0) fired = w.shots[0].tick;
        if (w.results.length) {
          const r = w.results[0];
          results.push({ wall, fired, tick: r.tick, end: r.end, z: fixed(r.position[2], 4), distance: fixed(r.distance, 4), damage: fixed(r.damage, 4), material: r.material, age: fixed(r.age, 4), vz: fixed(r.velocity[2], 4) });
          break;
        }
      }
    }
    return { scenario: 'wall', results };
  },
  rng() {
    let state = rngSeedForTick(1000);
    const seed = state;
    const draws = [];
    for (let i = 0; i < 4; i++) {
      const [v, s] = rngNext(state);
      state = s;
      draws.push(v);
    }
    return { scenario: 'rng', seed, draws };
  },
};

const run = (name) => SCENARIOS[name]();

describe('the E-11, against bf2-web', () => {
  for (const [name, { records }] of Object.entries(golden.scenarios)) {
    it(`${name}: what the native driver printed, to its precision`, () => {
      // the shots' offsets are a cone's radius times sinf and cosf of a drawn angle: a float apart at most
      expect(differs(records[0], run(name), { ulps: name === 'hold' ? 1 : 0 })).toBeNull();
    });
  }

  it('lands every offset of a held trigger on bf2-web’s float but one, which is a float apart', () => {
    const ours = run('hold').shots;
    const theirs = golden.scenarios.hold.records[0].shots;
    const apart = theirs.flatMap((s, i) => [3, 4].map((k) => ulpsApart(s[k], ours[i][k])));
    expect(Math.max(...apart)).toBe(1);
    expect(apart.filter((u) => u > 0)).toHaveLength(1);
  });
});

// bf2-web's gate's checks (WebPort/tests/blaster-weapon.mjs), read off the JavaScript
describe('the E-11, as bf2-web’s gate reads it', () => {
  it('fires on the tick after the 0.8 s deploy, then every 6 ticks, and overheats on the 25th bolt', () => {
    const { shots, overheatTick, clearTick } = run('hold');
    expect(shots[0][0]).toBe(25);
    expect(shots.slice(1, 25).every((s, i) => s[0] - shots[i][0] === 6)).toBe(true);
    expect(shots[0][1]).toBeCloseTo(0.04, 6);
    expect(shots[24][1]).toBe(1);
    expect(overheatTick).toBe(shots[24][0]);
    expect(Math.abs((clearTick - overheatTick) / 30 - (1 + 1 / 0.45))).toBeLessThanOrEqual(2 / 30);
  });

  it('widens the cone from 0.05° by 0.08° a bolt to 0.7°, every offset inside it', () => {
    const { shots } = run('hold');
    expect(shots[0][2]).toBeCloseTo(0.05, 6);
    expect(shots[1][2]).toBeCloseTo(0.13, 6);
    expect(shots[20][2]).toBeCloseTo(0.7, 6);
    expect(shots.every((s) => Math.hypot(s[3], s[4]) <= (s[2] * Math.PI) / 180 + 1e-7)).toBe(true);
  });

  it('holds the cone 0.2 s after a release, then lets it fall 1° a second; holds the heat 5 s', () => {
    const { cones, heatAfter2s, heatAfter6s } = run('release');
    expect(cones.slice(0, 4).every((c) => Math.abs(c - cones[0]) < 1e-6)).toBe(true);
    expect(cones[20] - cones[21]).toBeCloseTo(1 / 30, 4);
    expect(cones[59]).toBeCloseTo(0.05, 6);
    expect(heatAfter2s).toBeGreaterThan(0.3);
    expect(heatAfter6s).toBeLessThan(heatAfter2s);
  });

  it('buffers a press for 0.1 s while the interval runs, and drops an older one', () => {
    const { press32, press34 } = run('tap');
    expect(press32).toEqual([30]);
    expect(press34).toEqual([30, 36]);
  });

  it('sweeps a 700 m/s bolt tick by tick and hurts by the falloff over its distance', () => {
    const at = (wall) => run('wall').results.find((r) => r.wall === wall);
    for (const [wall, ticks] of [[10, 1], [30, 2], [50, 3]]) {
      expect(at(wall)).toMatchObject({ end: BOLT_END.hit, tick: at(wall).fired + ticks, material: 7 });
      expect(at(wall).z).toBeCloseTo(wall, 3);
    }
    expect(at(10).damage).toBeCloseTo(36, 4);
    expect(at(30).damage).toBeCloseTo(36 - ((at(30).distance - 20) / 20) * 17, 3);
    expect(at(50).damage).toBeCloseTo(19, 4);
    expect(at(0).end).toBe(BOLT_END.timeout);
    expect(at(0).z).toBeCloseTo(2100, 1);
  });

  it('falls off from 36 to 19 between 20 and 40 m', () => {
    expect(falloffDamage(E11, 5)).toBe(36);
    expect(falloffDamage(E11, 30)).toBeCloseTo(27.5, 5);
    expect(falloffDamage(E11, 90)).toBe(19);
  });
});
