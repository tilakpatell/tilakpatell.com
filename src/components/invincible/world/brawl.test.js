import { describe, expect, it } from 'vitest';
import { BRAWL, canGrab, counterOpen, diveDamage, newBrawl, stepBrawl } from './brawl';

// Mark on the ground at the origin, looking north (−z), or as told
const mark = (o = {}) => ({ p: [0, 0, 0], v: [0, 0, 0], mode: 'ground', look: [0, 0, -1], alt: 0, landed: null, impact: null, ...o });
const foe = (id, at, o = {}) => ({ id, kind: 'mauler', at, grabbable: true, foe: true, ...o });
const none = { fist: false, punched: false, up: false, guard: false, pound: false };
// steps of 1/30 s for `t` seconds, collecting the outs
function run(b, t, input, m = mark(), world = { things: [] }) {
  const out = [];
  for (let s = 0; s < t - 1e-9; s += 1 / 30) {
    const r = stepBrawl(b, typeof input === 'function' ? input(s) : input, typeof m === 'function' ? m(s) : m, world, 1 / 30);
    b = r.b;
    out.push(...r.out);
  }
  return { b, out };
}
const kinds = (out) => out.map((o) => o.kind);

describe('the grab and the throw', () => {
  const world = { things: [foe(1, [0, 1, -3]), foe(2, [0, 1, -4.2]), foe(3, [0, 21, -2], { kind: 'seismic', grabbable: false })] };
  it('a hold of 0.25 s within reach grabs the nearest grabbable, once', () => {
    const held = { ...none, fist: true };
    let r = run(newBrawl(), 0.2, held, mark(), world);
    expect(kinds(r.out)).not.toContain('grab');
    r = run(r.b, 0.1, held, mark(), world);
    expect(r.out.filter((o) => o.kind === 'grab')).toEqual([expect.objectContaining({ kind: 'grab', target: 1 })]);
    expect(r.b.carry).toMatchObject({ id: 1, kind: 'mauler' });
    expect(kinds(run(r.b, 1, held, mark(), world).out)).not.toContain('grab');
  });
  it('grabs nothing out of reach, and nothing that can’t be held', () => {
    expect(canGrab(mark(), foe(1, [0, 1, -3]))).toBe(true);
    expect(canGrab(mark(), foe(1, [0, 1, -6]))).toBe(false);
    expect(canGrab(mark(), foe(3, [0, 1, -2], { grabbable: false }))).toBe(false);
    const r = run(newBrawl(), 0.5, { ...none, fist: true }, mark(), { things: [foe(1, [0, 1, -9])] });
    expect(r.b.carry).toBe(null);
  });
  it('lets go as a throw, at his speed plus 30 m/s the way he looks', () => {
    let r = run(newBrawl(), 0.3, { ...none, fist: true }, mark(), world);
    const flying = mark({ mode: 'air', v: [0, 0, -20], alt: 50 });
    r = run(r.b, 1 / 30, none, flying, world);
    const t = r.out.find((o) => o.kind === 'throw');
    expect(t.target).toBe(1);
    expect(Math.hypot(...t.v)).toBeCloseTo(20 + BRAWL.throw.add, 6);
    expect(t.v[2]).toBeLessThan(0);
    expect(r.b.carry).toBe(null);
  });
  it('slams what he carries into the ground over 40 m/s: two hits and a crater', () => {
    const carrying = run(newBrawl(), 0.3, { ...none, fist: true }, mark(), world).b;
    const soft = run(carrying, 1 / 30, { ...none, fist: true }, mark({ landed: { speed: 30, at: [5, 0, 5] } }), world);
    expect(kinds(soft.out)).not.toContain('slam');
    expect(soft.b.carry).not.toBe(null);
    const hard = run(carrying, 1 / 30, { ...none, fist: true }, mark({ landed: { speed: 55, at: [5, 0, 5] } }), world);
    expect(hard.out.find((o) => o.kind === 'slam')).toMatchObject({ target: 1, hits: BRAWL.slam.hits, crater: true, at: [5, 0, 5] });
    expect(hard.b.carry).toBe(null);
    // into a tower's face, likewise, and the tower's named for the city to mark
    const wall = run(carrying, 1 / 30, { ...none, fist: true }, mark({ mode: 'air', impact: { speed: 48, at: [9, 30, 9], tower: 17 } }), world);
    expect(wall.out.find((o) => o.kind === 'slam')).toMatchObject({ target: 1, hits: 2, tower: 17 });
  });
});

describe('the dive', () => {
  it('does one hit from 30 m to three from 200 m, linear between and floored', () => {
    expect(diveDamage(30)).toBe(1);
    expect(diveDamage(200)).toBe(3);
    expect(diveDamage(114)).toBe(1);
    expect(diveDamage(115)).toBe(2);
    expect(diveDamage(10)).toBe(1);
    expect(diveDamage(900)).toBe(3);
  });
  it('goes on Space in the air over a foe from 30 m up, and lands its hits', () => {
    const below = { things: [foe(4, [3, 1, 2])] };
    const high = mark({ mode: 'air', p: [0, 60, 0], alt: 60 });
    const low = mark({ mode: 'air', p: [0, 25, 0], alt: 25 });
    expect(kinds(stepBrawl(newBrawl(), { ...none, up: true }, low, below, 1 / 30).out)).not.toContain('dive');
    expect(kinds(stepBrawl(newBrawl(), { ...none, up: true }, mark({ mode: 'air', p: [80, 60, 0], alt: 60 }), below, 1 / 30).out)).not.toContain('dive');
    const r = stepBrawl(newBrawl(), { ...none, up: true }, high, below, 1 / 30);
    expect(r.out.find((o) => o.kind === 'dive')).toMatchObject({ target: 4, at: [3, 1, 2], speed: BRAWL.dive.speed });
    const down = stepBrawl(r.b, none, mark({ landed: { speed: 90, at: [3, 0, 2] } }), below, 1 / 30);
    expect(down.out.find((o) => o.kind === 'diveHit')).toMatchObject({ target: 4, hits: diveDamage(60), crater: true });
    expect(down.b.dive).toBe(null);
  });
});

describe('the block and the counter', () => {
  const ahead = { things: [foe(5, [0, 1, -2.5])] };
  it('blocks on the ground with Shift held facing a foe, and not otherwise', () => {
    expect(stepBrawl(newBrawl(), { ...none, guard: true }, mark(), ahead, 1 / 30).b.guard).toBe(true);
    expect(stepBrawl(newBrawl(), { ...none, guard: true }, mark({ look: [0, 0, 1] }), ahead, 1 / 30).b.guard).toBe(false);
    expect(stepBrawl(newBrawl(), { ...none, guard: true }, mark({ mode: 'air' }), ahead, 1 / 30).b.guard).toBe(false);
    expect(stepBrawl(newBrawl(), none, mark(), ahead, 1 / 30).b.guard).toBe(false);
  });
  it('a blocked swing opens a 0.6 s window in which a punch counts double', () => {
    let r = stepBrawl(newBrawl(), { ...none, guard: true }, mark(), { ...ahead, blocked: 1 }, 1 / 30);
    expect(counterOpen(r.b)).toBe(true);
    const later = run(r.b, 0.5, none, mark(), ahead);
    expect(counterOpen(later.b)).toBe(true);
    r = stepBrawl(later.b, { ...none, punched: true }, mark(), ahead, 1 / 30);
    expect(r.out).toContainEqual(expect.objectContaining({ kind: 'counter', power: 2 }));
    expect(counterOpen(r.b)).toBe(false);
    const late = run(stepBrawl(newBrawl(), none, mark(), { ...ahead, blocked: 1 }, 1 / 30).b, 0.7, none, mark(), ahead);
    expect(counterOpen(late.b)).toBe(false);
    expect(stepBrawl(late.b, { ...none, punched: true }, mark(), ahead, 1 / 30).out).toContainEqual(expect.objectContaining({ kind: 'punch', power: 1 }));
  });
});

describe('another hero’s fists (./heroes.js)', () => {
  it('make a punch and a counter worth more: Omni-Man’s 2 and 3, Thragg’s 2 and 4', () => {
    const power = (fists, counter) => stepBrawl({ ...newBrawl(), counter: counter ? 0.5 : 0 }, { ...none, punched: true }, mark(), { things: [] }, 1 / 30, { fists }).out[0].power;
    expect([power(1, false), power(1, true)]).toEqual([1, 2]);
    expect([power(1.5, false), power(1.5, true)]).toEqual([2, 3]);
    expect([power(2, false), power(2, true)]).toEqual([2, 4]);
  });
});

describe('the ground pound', () => {
  const near = { things: [foe(6, [10, 1, 0])] };
  it('goes on C on the ground with a foe within 40 m, then not again for 4 s', () => {
    const r = stepBrawl(newBrawl(), { ...none, pound: true }, mark(), near, 1 / 30);
    expect(r.out.find((o) => o.kind === 'pound')).toMatchObject({ at: [0, 0, 0], r: BRAWL.pound.r, speed: BRAWL.pound.speed });
    expect(kinds(run(r.b, 3.8, { ...none, pound: true }, mark(), near).out)).not.toContain('pound');
    expect(kinds(run(r.b, 4.2, { ...none, pound: true }, mark(), near).out)).toContain('pound');
    expect(kinds(stepBrawl(newBrawl(), { ...none, pound: true }, mark(), { things: [foe(6, [60, 1, 0])] }, 1 / 30).out)).not.toContain('pound');
    expect(kinds(stepBrawl(newBrawl(), { ...none, pound: true }, mark({ mode: 'air' }), near, 1 / 30).out)).not.toContain('pound');
  });
});

describe('a hidden tab', () => {
  it('takes a minute as one short step', () => {
    const r = stepBrawl(newBrawl(), { ...none, fist: true }, mark(), { things: [] }, 60);
    expect(r.b.hold).toBeCloseTo(0.05, 9);
    const c = stepBrawl({ ...newBrawl(), counter: 0.6, pound: 4 }, none, mark(), { things: [] }, 60);
    expect(c.b.counter).toBeCloseTo(0.55, 9);
    expect(c.b.pound).toBeCloseTo(3.95, 9);
    expect(stepBrawl(newBrawl(), none, mark(), { things: [] }, NaN).b.hold).toBe(0);
  });
});
