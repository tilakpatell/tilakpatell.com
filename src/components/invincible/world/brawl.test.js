import { describe, expect, it } from 'vitest';
import { BRAWL, diveDamage, diveTarget, grabbable, newBrawl, stepBrawl } from './brawl';
import { FLY } from './flight';
import { KINDS, newFoes, spawnFoes } from './foes';
import { groundAt } from './map';

const STREET = [50, 0, 0]; // outside the bank, east of the plaza
const g = (x, z) => groundAt(x, z);
const hero = (p, { v = [0, 0, 0], mode = 'air' } = {}) => ({ p: [...p], v: [...v], mode, face: 0 });
const onStreet = (dx = 0, dz = 0, v) => hero([STREET[0] + dx, g(STREET[0] + dx, STREET[2] + dz), STREET[2] + dz], { v, mode: 'ground' });
const look = [0, 0, -1];
const idle = { punchHeld: false, look, dive: false, block: false, pound: false, landed: null };
const mauler = (dx = 0, dz = -3) => spawnFoes(newFoes(), 'mauler', 1, [STREET[0] + dx, 0, STREET[2] + dz]);
const flaxanAt = (p) => ({ ...newFoes(), on: true, foes: [{ id: 9, kind: 'flaxan', state: 'fight', p: [...p], v: [0, 0, 0], hits: 0, cool: 9, phase: 0, t: 0 }], next: 10 });

function run(b, f, h, t, input = idle, dt = 0.05) {
  const ev = [];
  let push = null;
  let cap = null;
  for (let s = 0; s < t - 1e-9; s += dt) {
    const r = stepBrawl(b, f, typeof h === 'function' ? h(s, f, b) : h, typeof input === 'function' ? input(s, f, b) : input, dt);
    b = r.b;
    f = r.foes;
    ev.push(...r.ev);
    push = r.push ?? push;
    cap = r.cap;
  }
  return { b, f, ev, push, cap };
}

describe('a dive’s blows', () => {
  it('is one from the lowest height, three from the highest, whole numbers between', () => {
    expect(diveDamage(BRAWL.diveFrom)).toBe(1);
    expect(diveDamage(BRAWL.diveMax)).toBe(3);
    expect(diveDamage(115)).toBe(2);
    expect(diveDamage(10)).toBe(1);
    expect(diveDamage(1000)).toBe(3);
  });
});

describe('taking hold', () => {
  it('needs the punch held a quarter second, then takes the Mauler in front', () => {
    const f = mauler();
    const h = onStreet();
    const short = run(newBrawl(), f, h, 0.2, { ...idle, punchHeld: true });
    expect(short.b.held).toBeNull();
    const { b, f: f2, ev, cap } = run(newBrawl(), f, h, 0.3, { ...idle, punchHeld: true });
    expect(b.held).toEqual({ what: 'foe', id: f.foes[0].id });
    expect(f2.foes[0].state).toBe('held');
    expect(ev.filter((e) => e.type === 'grab')).toHaveLength(1);
    // on his fist, ahead of him
    expect(Math.hypot(f2.foes[0].p[0] - h.p[0], f2.foes[0].p[2] - h.p[2])).toBeLessThan(2);
    expect(cap).toBeCloseTo(FLY.top * BRAWL.carry);
  });
  it('never takes Doc Seismic, nor anyone out of reach', () => {
    const f = spawnFoes(newFoes(), 'seismic', 1, STREET);
    expect(grabbable(f, hero([f.foes[0].p[0], f.foes[0].p[1] - 1, f.foes[0].p[2] + 1]), look)).toBeNull();
    expect(grabbable(mauler(0, -40), onStreet(), look)).toBeNull();
  });
  it('takes a car of the traffic’s when no foe is in reach', () => {
    const h = onStreet();
    const { b, f, ev } = run(newBrawl(), newFoes(), h, 0.3, { ...idle, punchHeld: true }, 0.05);
    expect(b.held).toBeNull();
    let r = { b: newBrawl(), foes: { ...newFoes(), on: true }, ev: [] };
    const evs = [];
    for (let i = 0; i < 6; i++) {
      r = stepBrawl(r.b, r.foes, h, { ...idle, punchHeld: true }, 0.05, { cars: [[h.p[0], h.p[1] + 1, h.p[2] - 3]] });
      evs.push(...r.ev);
    }
    expect(r.b.held).toEqual({ what: 'car', id: 0, car: 0 });
    expect(r.foes.cars[0].held).toBe('mark');
    expect(evs.some((e) => e.type === 'grab' && e.what === 'car')).toBe(true);
    expect(f.cars ?? []).toHaveLength(0);
    expect(ev).toHaveLength(0);
  });
});

describe('throwing and slamming', () => {
  const held = () => {
    const f = mauler();
    const r = run(newBrawl(), f, onStreet(), 0.3, { ...idle, punchHeld: true });
    return { b: r.b, f: r.f };
  };
  it('lets go at his speed and then some, the way he looks; the landing is a blow and a stagger', () => {
    const { b, f } = held();
    const h = hero([STREET[0], g(...STREET) + 30, STREET[2]], { v: [0, 0, -10] });
    const r = stepBrawl(b, f, h, { ...idle, punchHeld: false }, 0.05);
    expect(r.b.held).toBeNull();
    const t = r.ev.find((e) => e.type === 'hurl');
    expect(t.v[2]).toBeCloseTo(-(10 + BRAWL.throwPlus));
    expect(r.foes.foes[0].state).toBe('thrown');
    const landed = run(r.b, r.foes, h, 4);
    expect(landed.ev.some((e) => e.type === 'thrownLanded')).toBe(true);
    expect(landed.f.foes[0].hits).toBe(1);
    expect(landed.f.foes[0].state).toBe('stagger');
    expect(landed.f.foes[0].p[1]).toBeGreaterThanOrEqual(g(landed.f.foes[0].p[0], landed.f.foes[0].p[2]) - 1e-6);
  });
  it('a slam from a landing at speed, still holding: two blows and a crater', () => {
    const { b, f } = held();
    const r = stepBrawl(b, f, onStreet(0, 0, [0, -45, 0]), { ...idle, punchHeld: true, landed: { type: 'slam', speed: 45 } }, 0.05);
    expect(r.ev.map((e) => e.type)).toEqual(expect.arrayContaining(['carrySlam', 'crater', 'hit']));
    expect(r.foes.foes[0].hits).toBe(BRAWL.slamHits);
    expect(r.foes.foes[0].state).toBe('stagger');
    expect(r.b.held).toBeNull();
    // a soft landing is no slam
    const soft = stepBrawl(b, f, onStreet(), { ...idle, punchHeld: true, landed: { type: 'land', speed: 5 } }, 0.05);
    expect(soft.b.held).not.toBeNull();
  });
  it('a slam with a Flaxan in hand knocks it out', () => {
    const f = flaxanAt([STREET[0], g(...STREET) + 1.5, STREET[2] - 2]);
    const got = run(newBrawl(), f, onStreet(), 0.3, { ...idle, punchHeld: true });
    expect(got.b.held?.what).toBe('foe');
    const r = stepBrawl(got.b, got.f, onStreet(), { ...idle, punchHeld: true, landed: { type: 'slam', speed: 60 } }, 0.05);
    expect(r.foes.foes[0].state).toBe('ko');
    expect(r.ev.some((e) => e.type === 'ko')).toBe(true);
  });
});

describe('a dive', () => {
  it('wants a foe well under him, then drops him onto it; the blows grow with the height', () => {
    const f = mauler();
    const low = hero([STREET[0], g(...STREET) + 10, STREET[2] - 3]);
    expect(diveTarget(f, low)).toBeNull();
    const high = hero([STREET[0], g(...STREET) + 150, STREET[2] - 3]);
    expect(diveTarget(f, high)?.id).toBe(f.foes[0].id);
    const r = stepBrawl(newBrawl(), f, high, { ...idle, dive: true }, 0.05);
    expect(r.b.dive?.id).toBe(f.foes[0].id);
    expect(r.push[1]).toBeLessThan(-80);
    expect(Math.hypot(...r.push)).toBeCloseTo(BRAWL.diveSpeed);
    // and down beside it: the blows
    const near = hero([STREET[0], g(...STREET) + 1, STREET[2] - 3], { v: [0, -90, 0] });
    const hit = stepBrawl(r.b, r.foes, near, idle, 0.05);
    const d = hit.ev.find((e) => e.type === 'diveHit');
    expect(d.hits).toBe(diveDamage(r.b.dive.from));
    expect(d.hits).toBe(2);
    expect(hit.foes.foes[0].hits).toBe(2);
    expect(hit.b.dive).toBeNull();
    expect(hit.ev.some((e) => e.type === 'crater')).toBe(true);
  });
  it('is off while he’s carrying something', () => {
    const f = mauler();
    const got = run(newBrawl(), f, onStreet(), 0.3, { ...idle, punchHeld: true });
    const r = stepBrawl(got.b, got.f, hero([STREET[0], g(...STREET) + 150, STREET[2]]), { ...idle, punchHeld: true, dive: true }, 0.05);
    expect(r.b.dive).toBeNull();
  });
});

describe('the ground pound', () => {
  it('sends a ring out that floors a Flaxan near the ground and staggers a Mauler, once each', () => {
    let f = mauler(10, 0);
    f = { ...f, foes: [...f.foes, { id: 50, kind: 'flaxan', state: 'fight', p: [STREET[0] + 20, g(STREET[0] + 20, STREET[2]) + 1, STREET[2]], v: [0, 0, 0], hits: 0, cool: 9, phase: 0, t: 0 }, { id: 51, kind: 'flaxan', state: 'fight', p: [STREET[0] + 20, g(STREET[0] + 20, STREET[2]) + 12, STREET[2]], v: [0, 0, 0], hits: 0, cool: 9, phase: 0, t: 0 }] };
    const r = run(newBrawl(), f, onStreet(), 1.5, (s) => ({ ...idle, pound: s < 0.05 }));
    expect(r.ev.filter((e) => e.type === 'pound')).toHaveLength(1);
    expect(r.f.foes.find((e) => e.id === 50).state).toBe('ko');
    expect(r.f.foes.find((e) => e.id === 51).state).toBe('fight'); // (12 m up: out of the ring's reach)
    expect(r.f.foes[0].state).toBe('stagger');
    expect(r.b.pound).toBeGreaterThan(0);
    // another press inside the wait does nothing
    const again = stepBrawl(r.b, r.f, onStreet(), { ...idle, pound: true }, 0.05);
    expect(again.ev.some((e) => e.type === 'pound')).toBe(false);
    // the ring is gone once it's run out
    const gone = run(r.b, r.f, onStreet(), 2);
    expect(gone.f.rings.filter((q) => q.mine)).toHaveLength(0);
  });
  it('a tab hidden a minute moves the ring one step, not sixty seconds', () => {
    const r = stepBrawl(newBrawl(), { ...newFoes(), on: true }, onStreet(), { ...idle, pound: true }, 60);
    const r2 = stepBrawl(r.b, r.foes, onStreet(), idle, 60);
    expect(r2.foes.rings[0].r).toBeCloseTo(2 * BRAWL.pound.speed * 0.05);
  });
});

describe('a block', () => {
  it('stands when Shift is held on the ground with a foe in front and near; not in the air, not carrying', () => {
    const f = mauler();
    expect(stepBrawl(newBrawl(), f, onStreet(), { ...idle, block: true }, 0.05).b.blocking).toBe(true);
    expect(stepBrawl(newBrawl(), f, hero([STREET[0], g(...STREET) + 5, STREET[2]]), { ...idle, block: true }, 0.05).b.blocking).toBe(false);
    expect(stepBrawl(newBrawl(), mauler(0, -20), onStreet(), { ...idle, block: true }, 0.05).b.blocking).toBe(false);
    expect(stepBrawl(newBrawl(), f, onStreet(), idle, 0.05).b.blocking).toBe(false);
  });
  it('the Mauler’s numbers stand for a held thing’s height', () => {
    expect(KINDS.mauler.h).toBeGreaterThan(2);
  });
});
