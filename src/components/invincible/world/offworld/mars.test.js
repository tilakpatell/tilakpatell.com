import { describe, expect, it } from 'vitest';
import { ASTRO, BASE, FRAME, GATES, GATE_R, HOST, MARS, RANGE, SITE, groundAt, nearMars, nearestLost, newMars, stepMars, toLocal, toWorld } from './mars';
import { SWARM } from './swarm';

const len = (v) => Math.hypot(v[0], v[1], v[2]);
const dist = (a, b) => len([a[0] - b[0], a[1] - b[1], a[2] - b[2]]);
// a hero in the world's frame, from a place in the site's
const heroAt = (l, look = [0, 0, 1]) => ({ p: toWorld(l), mode: 'perch', look: FRAME.e1.map((v, i) => v * look[0] + FRAME.n[i] * look[1] + FRAME.e2[i] * look[2]) });
function run(m, secs, hero, input = { punch: false }, dt = 1 / 30) {
  const ev = [];
  let hurt = 0;
  for (let t = 0; t < secs; t += dt) {
    const r = stepMars(m, typeof hero === 'function' ? hero(m, t) : hero, typeof input === 'function' ? input(m, t) : input, dt);
    m = r.mars;
    ev.push(...r.ev);
    hurt += r.hurt;
  }
  return { m, ev, hurt };
}

describe('the site', () => {
  it('is the point of Mars that faces the Earth, its frame on the ground there', () => {
    expect(dist(SITE, MARS.c)).toBeCloseTo(MARS.r, 3);
    // up is toward the Earth (the origin)
    expect(FRAME.n[0] * -MARS.c[0] + FRAME.n[1] * -MARS.c[1] + FRAME.n[2] * -MARS.c[2]).toBeGreaterThan(0);
    for (const [a, b] of [
      [FRAME.n, FRAME.e1],
      [FRAME.n, FRAME.e2],
      [FRAME.e1, FRAME.e2],
    ])
      expect(Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2])).toBeLessThan(1e-9);
    const l = [30, 5, -40];
    expect(toLocal(toWorld(l)).map((v) => Math.round(v * 1000) / 1000)).toEqual(l);
    expect(groundAt(0, 0)).toBe(0);
    expect(groundAt(300, 0)).toBeLessThan(-5);
    expect(dist(toWorld([300, groundAt(300, 0), 0]), MARS.c)).toBeCloseTo(MARS.r, 3);
  });
  it('is drawn within 30 km of the planet and not beyond', () => {
    expect(RANGE.load).toBe(30000);
    expect(nearMars(toWorld([0, 29000, 0]))).toBe(true);
    expect(nearMars(toWorld([0, 31000, 0]))).toBe(false);
    expect(nearMars([0, 0, 0])).toBe(false);
  });
  it('has three gates home, high over the ground, each on the way up', () => {
    expect(GATES).toHaveLength(3);
    let last = 0;
    for (const g of GATES) {
      const up = dist(g, MARS.c) - MARS.r;
      expect(up).toBeGreaterThan(250);
      expect(up).toBeGreaterThan(last);
      last = up;
    }
    expect(GATE_R).toBe(150);
  });
});

describe('the Martian mission', () => {
  it('starts with four astronauts out there, the host by the base, the swarm on it', () => {
    const m = newMars(100);
    expect(m.astronauts.map((a) => a.state)).toEqual(['lost', 'lost', 'lost', 'lost']);
    expect(m.host.state).toBe('stand');
    expect(m.swarm.bodies).toHaveLength(100);
    expect(nearestLost(m, toWorld([-100, 0, 50]))).toEqual(toWorld(m.astronauts[0].p));
  });
  it('each astronaut is carried to the ship, one at a time', () => {
    let m = newMars(50);
    for (let i = 0; i < 4; i++) {
      const a = BASE.astronauts[i];
      let r = run(m, 0.2, heroAt([a[0], groundAt(a[0], a[2]), a[2]]));
      m = r.m;
      expect(r.ev.find((e) => e.type === 'pick')).toMatchObject({ id: i });
      expect(m.astronauts[i].state).toBe('carried');
      // another beside him is not taken while one is in his arms
      r = run(m, 0.2, heroAt([BASE.ship[0], groundAt(BASE.ship[0], BASE.ship[2]), BASE.ship[2]]));
      m = r.m;
      expect(r.ev.find((e) => e.type === 'aboard')).toMatchObject({ id: i, n: i + 1 });
    }
    expect(m.aboard).toBe(4);
    expect(ASTRO.aboard).toBe(8);
  });
  it('the host is put down at twelve blows, and the swarm dies with it', () => {
    let m = newMars(50);
    const at = [HOST.p[0], groundAt(HOST.p[0], HOST.p[2]), HOST.p[2] + 2.5];
    const hero = heroAt(at, [0, 0, -1]);
    const ev = [];
    for (let i = 0; i < 12; i++) {
      const r = run(m, 0.6, hero, (q, t) => ({ punch: t === 0 }));
      m = r.m;
      ev.push(...r.ev);
    }
    expect(ev.filter((e) => e.type === 'hostHit')).toHaveLength(11);
    expect(ev.some((e) => e.type === 'hostDown')).toBe(true);
    expect(m.host.state).toBe('down');
    expect(m.swarm.alive).toBe(false);
    expect(HOST.hits).toBe(12);
  });
  it('the host swings at him in reach, and the swarm bites him when it is on him', () => {
    const m0 = newMars(50);
    const at = [HOST.p[0], groundAt(HOST.p[0], HOST.p[2]), HOST.p[2] + 2];
    const { ev, hurt } = run(m0, 5, heroAt(at));
    expect(ev.some((e) => e.type === 'hostSwing')).toBe(true);
    expect(hurt).toBeGreaterThan(HOST.hurt);
  });
  it('a punch into the swarm scatters it', () => {
    const m0 = newMars(50);
    const mid = m0.swarm.mid;
    const r = run(m0, 0.2, heroAt([mid[0], mid[1] - 1, mid[2] - 1.5], [0, 0, 1]), (q, t) => ({ punch: t === 0 }));
    expect(r.ev.some((e) => e.type === 'scatter')).toBe(true);
    expect(r.m.swarm.scatter).toBeGreaterThan(SWARM.scatter - 0.5);
  });
});
