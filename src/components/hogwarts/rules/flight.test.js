import { describe, expect, it } from 'vitest';
import { BROOM, KMH, LESSON, forwardOf, hit, lessonAct, lessonBot, lessonFly, lessonResult, mount, newLesson, ringsRound, stepBroom, through, velocity } from './flight';

const still = { fwd: 0, side: 0, up: 0, down: 0, boost: false };
// fly for t seconds, a frame at a time, gathering the events
function fly(h, input, t, opts = {}, dt = 1 / 60) {
  const ev = [];
  for (let s = 0; s < t - 1e-9; s += dt) {
    h = stepBroom(h, typeof input === 'function' ? input(h, s) : input, dt, opts);
    ev.push(...h.ev);
  }
  return { h, ev };
}
const up = (y = 30) => ({ ...mount({ x: 0, y, z: 0 }), ev: [] });

describe('the broom', () => {
  it('mounts with a hop, hovering just off the floor', () => {
    const h = mount({ x: 3, y: 2, z: 4, yaw: 1 });
    expect(h.mode).toBe('air');
    expect(h.p[1]).toBeCloseTo(2 + BROOM.hop);
    expect(h.ev).toContain('mount');
    // and hangs there with nothing held
    const r = fly(h, still, 3, { floorAt: () => 2 }).h;
    expect(r.mode).toBe('air');
    expect(r.p[1]).toBeCloseTo(2 + BROOM.hop, 1);
  });
  it('W goes at a cruise, Shift with it flat out at 90 km/h', () => {
    const cruise = fly(up(), { ...still, fwd: 1 }, 6).h;
    expect(cruise.spd).toBeCloseTo(50 * KMH, 1);
    const flat = fly(up(), { ...still, fwd: 1, boost: true }, 6).h;
    expect(flat.spd * 3.6).toBeCloseTo(90, 0);
    // never faster
    expect(fly(up(), { ...still, fwd: 1, boost: true }, 30).h.spd * 3.6).toBeLessThanOrEqual(90 + 1e-6);
  });
  it('goes where it faces', () => {
    const h = fly({ ...up(), yaw: Math.PI / 2 }, { ...still, fwd: 1 }, 4).h;
    expect(h.p[0]).toBeGreaterThan(20);
    expect(Math.abs(h.p[2])).toBeLessThan(1e-6);
    const v = velocity(h);
    const f = forwardOf(h.yaw);
    expect(v[0] / h.spd).toBeCloseTo(f[0]);
  });
  it('S brakes to a hover faster than letting go does', () => {
    const fast = fly(up(), { ...still, fwd: 1, boost: true }, 6).h;
    const braked = fly(fast, { ...still, fwd: -1 }, 1).h;
    const coasted = fly(fast, still, 1).h;
    expect(braked.spd).toBeLessThan(coasted.spd);
    expect(fly(fast, { ...still, fwd: -1 }, 3).h.spd).toBe(0);
  });
  it('banks with A and D, and the bank turns it: D to the right, tighter slow than fast', () => {
    const go = (spd) => fly({ ...up(), spd }, (h) => ({ ...still, fwd: h.spd > 0 ? spd / BROOM.top : 0, boost: spd > BROOM.cruise, side: 1 }), 1.5);
    const slow = go(8).h;
    const fast = go(BROOM.top).h;
    expect(slow.bank).toBeGreaterThan(0.5);
    // facing +z, right is −x: D turns yaw down
    expect(slow.yaw).toBeLessThan(0);
    expect(Math.abs(slow.yaw)).toBeGreaterThan(Math.abs(fast.yaw));
    const left = fly({ ...up(), spd: 10 }, { ...still, side: -1, fwd: 0.7 }, 1).h;
    expect(left.yaw).toBeGreaterThan(0);
  });
  it('turns on the spot in a hover', () => {
    const h = fly(up(), { ...still, side: 1 }, 2).h;
    expect(Math.abs(h.yaw)).toBeGreaterThan(1.5);
    expect(Math.hypot(h.p[0], h.p[2])).toBeLessThan(0.5);
  });
  it('climbs with Space and sinks with C', () => {
    expect(fly(up(), { ...still, up: 1 }, 3).h.p[1]).toBeGreaterThan(30 + 12);
    expect(fly(up(), { ...still, down: 1 }, 3).h.p[1]).toBeLessThan(30 - 12);
  });
  it('can’t climb past the ceiling', () => {
    const h = fly(up(BROOM.ceiling - 30), { ...still, up: 1 }, 40).h;
    expect(h.p[1]).toBeLessThanOrEqual(BROOM.ceiling + 0.01);
    expect(h.p[1]).toBeGreaterThan(BROOM.ceiling - 5);
    // and over it (thrown there), it brings you down
    expect(fly(up(BROOM.ceiling + 10), still, 5).h.p[1]).toBeLessThan(BROOM.ceiling + 1);
  });
  it('lands you when you come down onto the floor slowly', () => {
    const r = fly(up(6), { ...still, down: 1 }, 4, { floorAt: () => 1 });
    expect(r.h.mode).toBe('ground');
    expect(r.h.p[1]).toBe(1);
    expect(r.ev).toContain('land');
    // and Space takes you up again
    const off = stepBroom(r.h, { ...still, up: 1 }, 1 / 60);
    expect(off.mode).toBe('air');
    expect(off.ev).toContain('takeoff');
  });
  it('skims the floor at speed rather than landing', () => {
    const r = fly({ ...up(3), spd: 20 }, { ...still, fwd: 1, boost: true, down: 1 }, 3, { floorAt: () => 0 });
    expect(r.h.mode).toBe('air');
    expect(r.h.p[1]).toBeCloseTo(BROOM.clear, 3);
  });
  it('a Bludger costs two seconds of tumble and height, the keys dead meanwhile', () => {
    const h0 = { ...up(20), spd: 20 };
    const hitBy = hit(h0, [1, 0, 0]);
    expect(hitBy.tumble).toBe(BROOM.tumble);
    const r = fly(hitBy, { ...still, up: 1, fwd: 1, boost: true }, 1.9);
    expect(r.h.tumble).toBeGreaterThan(0);
    expect(r.h.p[1]).toBeLessThan(20 - 5);
    expect(r.h.spd).toBeLessThan(h0.spd);
    const after = fly(r.h, { ...still, up: 1 }, 0.3);
    expect(after.ev).toContain('steady');
    expect(after.h.tumble).toBe(0);
  });
  it('stops at a post and a stand, losing its speed into them', () => {
    const post = { x: 0, z: 10, r: 0.5 };
    const r = fly({ ...up(10), spd: 20 }, { ...still, fwd: 1, boost: true }, 1.5, { solids: [post] });
    expect(r.h.p[2]).toBeLessThan(10);
    expect(r.ev).toContain('bump');
    const stand = { x0: -20, x1: 20, z0: 15, z1: 25, y0: 0, y1: 15 };
    const s = fly({ ...up(10), spd: 20 }, { ...still, fwd: 1, boost: true }, 2, { solids: [stand] }).h;
    expect(s.p[2]).toBeLessThanOrEqual(15 - BROOM.r + 1e-6);
    // over its top, free
    const over = fly({ ...up(20), spd: 20 }, { ...still, fwd: 1, boost: true }, 2, { solids: [stand] }).h;
    expect(over.p[2]).toBeGreaterThan(25);
  });
});

describe('the flying lesson', () => {
  const rings = ringsRound([0, 0, 0], { radius: 40, height: 8 });
  it('three rings round the lawn, each facing along the lap', () => {
    expect(rings).toHaveLength(3);
    for (const g of rings) expect(Math.hypot(g.p[0], g.p[2])).toBeCloseTo(40);
  });
  it('a step through a ring’s middle counts, beside it doesn’t', () => {
    const g = { p: [0, 5, 0], yaw: 0, r: 3 };
    expect(through(g, [0, 5, -1], [0, 5, 1])).toBe(true);
    expect(through(g, [0, 5, 1], [0, 5, -1])).toBe(true);
    expect(through(g, [4, 5, -1], [4, 5, 1])).toBe(false);
    expect(through(g, [0, 5, 1], [0, 5, 2])).toBe(false);
  });
  it('goes Up, mount, the rings in order, and down by Madam Hooch', () => {
    let l = newLesson(rings);
    expect(lessonAct(l).what).toBe('up');
    l = lessonAct(lessonAct(l).lesson).lesson;
    expect(l.step).toBe('rings');
    // the second ring first doesn’t count
    const g1 = rings[1];
    const n = [Math.sin(g1.yaw), 0, Math.cos(g1.yaw)];
    const skip = lessonFly(l, [g1.p[0] - n[0], g1.p[1], g1.p[2] - n[2]], [g1.p[0] + n[0], g1.p[1], g1.p[2] + n[2]]);
    expect(skip.lesson.ring).toBe(0);
    expect(lessonResult(l)).toBe(null);
  });
  it('the bot flies it from the grass, inside a minute and a half, for ten points', () => {
    let l = newLesson(rings);
    let h = null;
    let t = 0;
    while (l.step !== 'done' && t < 90) {
      const inp = lessonBot(l, h ?? { p: [0, 0, -50], yaw: 0, spd: 0 });
      if (inp.act) {
        l = lessonAct(l).lesson;
        if (l.step === 'rings') h = mount({ x: 0, y: 0, z: -50 });
      } else if (h) {
        const from = h.p;
        h = stepBroom(h, inp, 1 / 30, { floorAt: () => 0 });
        l = lessonFly(l, from, h.p, h.mode === 'ground').lesson;
      }
      t += 1 / 30;
    }
    expect(l.step).toBe('done');
    expect(lessonResult(l)).toEqual({ type: 'lesson', id: 'flying', done: true, points: LESSON.points });
  });
});
