import { describe, expect, it } from 'vitest';
import { FLY, newHero, stepHero } from './flight';
import { WORLD, buildWorld } from './map';
import { BODIES, SPACE, altitudeOf, intoSpace, outOfSpace, overBody, stepSpace, turnUp, upOver } from './orbit';

const W = buildWorld();
const still = { fwd: 0, side: 0, up: 0, down: 0, boost: false, run: false, jump: false, look: [0, 1, 0] };
function go(h, input, t, dt = 1 / 30) {
  const ev = [];
  for (let s = 0; s < t; s += dt) {
    h = stepSpace(h, typeof input === 'function' ? input(h, s) : input, dt);
    ev.push(...h.ev);
  }
  return { h, ev };
}
const toward = (h, c) => {
  const d = [c[0] - h.p[0], c[1] - h.p[1], c[2] - h.p[2]];
  const l = Math.hypot(...d);
  return d.map((v) => v / l);
};

describe('leaving the sky', () => {
  it('lets him climb out of the city’s air, and says when he’s through', () => {
    let h = { ...newHero({ x: 0, y: WORLD.ceiling - 200, z: 0 }), mode: 'air' };
    const ev = [];
    for (let s = 0; s < 4; s += 1 / 30) {
      h = stepHero(h, { ...still, boost: true, look: [0, 1, 0] }, 1 / 30, W);
      ev.push(...h.ev);
    }
    expect(ev.filter((e) => e.type === 'exit')).toHaveLength(1);
  });
  it('puts him over the city, where he left it, going the same way', () => {
    const h = { ...newHero({ x: 300, y: WORLD.ceiling, z: -200 }), mode: 'air', v: [0, 250, 0], spd: 250, dir: [0, 1, 0] };
    const s = intoSpace(h);
    expect(s.zone).toBe('space');
    expect(altitudeOf(s)).toBeCloseTo(WORLD.ceiling, -1);
    expect(s.v[1]).toBeCloseTo(250, 5);
  });
});

describe('in space', () => {
  const start = () => intoSpace({ ...newHero({ x: 0, y: WORLD.ceiling, z: 0 }), mode: 'air', v: [0, 200, 0], spd: 200, dir: [0, 1, 0] });
  it('drifts where he was going, with nothing to slow him but himself', () => {
    const { h } = go(start(), still, 2);
    expect(altitudeOf(h)).toBeGreaterThan(WORLD.ceiling + 50);
  });
  it('goes far faster flat out than in the air', () => {
    const { h } = go(start(), { ...still, boost: true }, 6);
    expect(Math.hypot(...h.v)).toBeGreaterThan(SPACE.top * 0.9);
    expect(SPACE.top).toBeGreaterThan(FLY.top * 10);
  });
  it('gets to the Moon and stands on it', () => {
    const moon = BODIES.find((b) => b.id === 'moon');
    const { h, ev } = go(start(), (hh) => ({ ...still, boost: true, look: toward(hh, moon.c) }), 90);
    expect(ev.some((e) => e.type === 'land' && e.body === 'moon')).toBe(true);
    expect(h.mode).toBe('perch');
    expect(Math.hypot(h.p[0] - moon.c[0], h.p[1] - moon.c[1], h.p[2] - moon.c[2])).toBeCloseTo(moon.r, 0);
  });
  it('jumps off it again', () => {
    const moon = BODIES.find((b) => b.id === 'moon');
    const landed = go(start(), (hh) => ({ ...still, boost: true, look: toward(hh, moon.c) }), 90).h;
    const { h } = go(landed, (_, s) => ({ ...still, jump: s === 0 }), 1);
    expect(h.mode).toBe('air');
    expect(Math.hypot(h.p[0] - moon.c[0], h.p[1] - moon.c[1], h.p[2] - moon.c[2])).toBeGreaterThan(moon.r + 5);
  });
  it('comes back down into the air, and over the city again', () => {
    const { h, ev } = go(start(), { ...still, down: 1, look: [0, -1, 0], boost: true }, 10);
    expect(ev.some((e) => e.type === 'reenter')).toBe(true);
    const back = outOfSpace(h);
    expect(back.zone).toBe('city');
    expect(back.p[1]).toBeLessThan(WORLD.ceiling);
    expect(Math.abs(back.p[0])).toBeLessThanOrEqual(WORLD.half);
    expect(back.v[1]).toBeLessThan(0);
  });
});

describe('low over the Moon or Mars', () => {
  const mars = BODIES.find((b) => b.id === 'mars');
  const up = mars.c.map((c) => -c / Math.hypot(...mars.c)); // (the side that faces the Earth)
  const at = (alt) => ({ ...intoSpace({ ...newHero({ x: 0, y: WORLD.ceiling, z: 0 }), mode: 'air' }), p: mars.c.map((c, i) => c + up[i] * (mars.r + alt)), v: [0, 0, 0] });
  const along = turnUp([0, 0, 1], up); // (a way across the ground)
  it('says how high he is over the nearest of them', () => {
    expect(overBody(at(50).p)).toBeCloseTo(50, 3);
    expect(overBody([0, 0, 0])).toBeGreaterThan(SPACE.low);
  });
  it('flies at the air’s speeds there, flat out too, and holds still when let go', () => {
    const cruise = go(at(60), { ...still, fwd: 1, look: along }, 3).h;
    expect(Math.hypot(...cruise.v)).toBeLessThanOrEqual(SPACE.lowCruise + 1e-6);
    expect(Math.hypot(...cruise.v)).toBeGreaterThan(SPACE.lowCruise * 0.9);
    const fast = go(at(60), { ...still, fwd: 1, boost: true, look: along }, 3).h;
    expect(Math.hypot(...fast.v)).toBeLessThanOrEqual(SPACE.lowTop + 1e-6);
    const stopped = go(cruise, still, 3).h;
    expect(Math.hypot(...stopped.v)).toBeLessThan(1);
  });
  it('comes down out of space at speed and slows to them', () => {
    const coming = { ...at(SPACE.low + 2000), v: up.map((c) => -c * SPACE.cruise) };
    const down = { ...still, fwd: 1, look: up.map((c) => -c) };
    const slowed = go(coming, down, 5).h;
    expect(overBody(slowed.p)).toBeLessThan(SPACE.low);
    expect(Math.hypot(...slowed.v)).toBeLessThanOrEqual(SPACE.lowCruise + 1e-6);
    expect(go(slowed, down, 15).h.mode).toBe('perch');
    const above = go(at(SPACE.low + 3000), { ...still, fwd: 1, look: along }, 3).h;
    expect(Math.hypot(...above.v)).toBeGreaterThan(SPACE.lowTop);
  });
  it('rises off the ground he is over, up as it is there', () => {
    const { h } = go(at(60), { ...still, up: 1, look: along }, 2);
    expect(overBody(h.p)).toBeGreaterThan(60 + SPACE.lowCruise);
  });
});

describe('which way is up out there', () => {
  const mars = BODIES.find((b) => b.id === 'mars');
  const n = mars.c.map((c) => -c / Math.hypot(...mars.c));
  const over = (alt) => mars.c.map((c, i) => c + n[i] * (mars.r + alt));
  const near = (a, b) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));
  it('is away from the ground low over a body, the sky’s up far from them, and turns between', () => {
    near(upOver(over(50)), n);
    near(upOver(over(SPACE.low + SPACE.blend + 10)), [0, 1, 0]);
    const mid = upOver(over(SPACE.low + SPACE.blend / 2));
    expect(Math.hypot(...mid)).toBeCloseTo(1, 6);
    expect(mid[1]).toBeGreaterThan(n[1]);
  });
  it('turns a look into that frame and back', () => {
    near(turnUp([0, 1, 0], n), n);
    near(turnUp([0.3, 0.2, -0.9], [0, 1, 0]), [0.3, 0.2, -0.9]);
    const v = [0.6, 0, 0.8];
    near(turnUp(turnUp(v, n), n, true), v);
    // (a look along the ground stays along it)
    expect(turnUp(v, n).reduce((s, c, i) => s + c * n[i], 0)).toBeCloseTo(0, 6);
    near(turnUp([1, 0, 0], [0, -1, 0]).map(Math.abs), [1, 0, 0]);
  });
});
