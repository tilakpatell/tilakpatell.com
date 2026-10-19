import { describe, expect, it } from 'vitest';
import { buildWorld, groundAt, near } from './map';
import { CARDS, RINGS, keepQuests, newQuests, rain, stepQuests } from './quests';

const W = buildWorld();
const inside = (b, p, pad = 0) => p[0] > b.x0 - pad && p[0] < b.x1 + pad && p[2] > b.z0 - pad && p[2] < b.z1 + pad && p[1] > b.y0 - pad && p[1] < b.y1 + pad;
const hero = (p, mode = 'air') => ({ p: [...p], v: [0, 0, 0], mode });
// run the quests for t seconds with the hero where `at` puts him
function run(q, at, t, dt = 1 / 30) {
  const ev = [];
  for (let s = 0; s < t; s += dt) {
    const h = typeof at === 'function' ? at(s, q) : at;
    q = stepQuests(q, h, dt, W);
    ev.push(...q.ev);
  }
  return { q, ev };
}

describe('the ring course', () => {
  it('has ten rings, none of them in a building', () => {
    expect(RINGS).toHaveLength(10);
    for (const r of RINGS) for (const b of near(W, r.p[0], r.p[2], r.r + 2)) expect(inside(b, r.p, r.r * 0.6), `ring at ${r.p}`).toBe(false);
  });
  it('starts at the first ring, takes them in order and keeps the best time', () => {
    let q = newQuests();
    // fly from ring to ring, a straight line through each
    const path = (s) => {
      const k = Math.min(RINGS.length - 1, Math.floor(s / 2));
      const a = RINGS[Math.max(0, k - 1)].p;
      const b = RINGS[k].p;
      const f = k === 0 ? 1 : Math.min(1.3, (s - k * 2) / 1.5); // (on past each ring, through it)
      return hero([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f - 1, a[2] + (b[2] - a[2]) * f]);
    };
    const { q: done, ev } = run(q, path, 22);
    q = done;
    // (the first ring too, as the lesson starts: a mission counts it as one)
    expect(ev.filter((e) => e.type === 'ring').map((e) => e.n)).toEqual(RINGS.map((_, i) => i));
    expect(ev.some((e) => e.type === 'lesson-start')).toBe(true);
    const end = ev.find((e) => e.type === 'lesson-done');
    expect(end).toBeTruthy();
    expect(q.lesson.best).toBeCloseTo(end.time, 5);
    expect(q.lesson.on).toBe(false);
  });
  it('doesn’t count a ring flown round instead of through', () => {
    const q = { ...newQuests(), lesson: { on: true, next: 1, t: 0, best: null } };
    const r = RINGS[1].p;
    const { ev } = run(q, (s) => hero([r[0] + 30 - s * 20, r[1] + 25, r[2]]), 3);
    expect(ev.some((e) => e.type === 'ring')).toBe(false);
  });
});

describe('the title cards', () => {
  it('hides eight, one an episode, each somewhere he can get to', () => {
    expect(CARDS.map((c) => c.ep)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const at = CARDS.map((c) => c.at(W));
    for (const p of at) {
      expect(p[1]).toBeGreaterThanOrEqual(groundAt(p[0], p[2]));
      for (const b of near(W, p[0], p[2], 3)) expect(inside(b, p)).toBe(false);
    }
  });
  it('picks one up when he flies through it, once', () => {
    const p = CARDS[3].at(W);
    const { q, ev } = run(newQuests(), hero([p[0], p[1] - 1, p[2]]), 1);
    expect(q.cards).toEqual([4]);
    expect(ev.filter((e) => e.type === 'card')).toHaveLength(1);
  });
  it('keeps what was found', () => {
    expect(newQuests({ cards: [2, 5], best: 41.5, saved: 3 }).cards).toEqual([2, 5]);
  });
});

// run until an event comes, or give up after `max` seconds
function until(q, h, type, max = 120, dt = 1 / 30) {
  for (let s = 0; s < max; s += dt) {
    q = stepQuests(q, h, dt, W);
    if (q.ev.some((e) => e.type === type)) return q;
  }
  return q;
}

describe('rescues', () => {
  it('calls one in after a while, somewhere near him', () => {
    const q = until(newQuests(), hero([0, 200, 600]), 'emergency');
    expect(q.rescue).toBeTruthy();
    expect(q.rescue.t).toBeLessThan(1);
    expect(Math.hypot(q.rescue.p[0], q.rescue.p[2] - 600)).toBeLessThan(1600);
  });
  it('is saved by catching them and setting them down', () => {
    let q = until(newQuests(), hero([0, 200, 600]), 'emergency');
    const r = q.rescue;
    // catch them where they are, then come down
    ({ q } = run(q, (_, qq) => hero(qq.rescue ? [qq.rescue.p[0], qq.rescue.p[1] - 1, qq.rescue.p[2]] : [0, 0, 0]), 0.5));
    expect(q.rescue.carried).toBe(true);
    const g = [r.p[0] + 40, 0, r.p[2]];
    const { q: after, ev } = run(q, hero(g, 'ground'), 0.5);
    expect(ev.some((e) => e.type === 'saved')).toBe(true);
    expect(after.rescue).toBe(null);
    expect(after.saved).toBe(1);
  });
  it('says whose rescue a catch was: the city’s own, or one a mission put there', () => {
    let q = until(newQuests(), hero([0, 200, 600]), 'emergency');
    const grab = (qq) => run(qq, (_, x) => hero(x.rescue ? [x.rescue.p[0], x.rescue.p[1] - 1, x.rescue.p[2]] : [0, 0, 0]), 0.5).ev.find((e) => e.type === 'caught');
    expect(grab(q)).toMatchObject({ type: 'caught', source: 'city' });
    q = { ...q, rescue: { ...q.rescue, source: 'mission' } };
    expect(grab(q)).toMatchObject({ type: 'caught', source: 'mission' });
  });
  it('goes wrong if nobody catches them', () => {
    const q = until(newQuests(), hero([0, 200, 600]), 'emergency');
    const { ev, q: after } = run(q, hero([3000, 50, -3000]), 60);
    expect(ev.some((e) => e.type === 'missed')).toBe(true);
    expect(after.saved).toBe(0);
  });
});

describe('what was kept, when it’s garbage', () => {
  it('starts from nothing rather than falling over', () => {
    // (what a broken or hand-edited tp-inv-world-quests can hold, once parsed)
    for (const bad of [null, 'null', 'x', 42, true, [], [1, 2], { cards: 'abc', best: 'x', saved: '3' }, { cards: null, best: null, saved: null }]) {
      const q = newQuests(bad);
      expect(q.cards, JSON.stringify(bad)).toEqual([]);
      expect(q.lesson.best).toBe(null);
      expect(q.saved).toBe(0);
      expect(() => stepQuests(q, hero([0, 200, 600]), 1 / 30, W)).not.toThrow();
      expect(keepQuests(q)).toEqual({ cards: [], best: null, saved: 0 });
    }
  });
  it('keeps only the cards there are, once each, and sensible numbers', () => {
    const q = newQuests({ cards: ['x', 99, 5, 1, 1, 3.5, null, -2], best: -5, saved: -5 });
    expect(q.cards).toEqual([1, 5]);
    expect(q.lesson.best).toBe(null);
    expect(q.saved).toBe(0);
    expect(newQuests({ best: 0 }).lesson.best).toBe(null);
    expect(newQuests({ saved: 3.7 }).saved).toBe(3);
    // (and so the last card can still be found with seven of them in)
    const p = CARDS[7].at(W);
    const { q: after } = run(newQuests({ cards: [1, 2, 3, 4, 5, 6, 7, 7, 9] }), hero([p[0], p[1] - 1, p[2]]), 0.1);
    expect(after.cards).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('fast, or in big steps', () => {
  it('a tab hidden for a minute comes back as one short step, not a minute’s worth', () => {
    const q = newQuests();
    const after = stepQuests(q, hero([0, 200, 600]), 60, W);
    expect(q.nextCall - after.nextCall).toBeGreaterThan(0);
    expect(q.nextCall - after.nextCall).toBeLessThanOrEqual(0.05 + 1e-9);
    expect(after.ev).toEqual([]);
    // the lesson's clock the same
    const on = stepQuests({ ...newQuests(), lesson: { on: true, next: 1, t: 10, best: null } }, hero([0, 200, 600]), 60, W);
    expect(on.lesson.t).toBeLessThanOrEqual(10.05 + 1e-9);
    // and someone falling falls a twentieth of a second's worth, not to the ground
    let f = until(newQuests(), hero([0, 200, 600]), 'emergency');
    f = { ...f, rescue: { ...f.rescue, phase: 'fall', v: [0, -30, 0] } };
    const fell = stepQuests(f, hero([3000, 50, -3000]), 60, W);
    expect(fell.ev.some((e) => e.type === 'missed')).toBe(false);
    expect(fell.rescue).not.toBe(null);
    expect(Math.hypot(...fell.rescue.p.map((c, i) => c - f.rescue.p[i]))).toBeLessThanOrEqual(48 * 0.05 + 1e-9);
  });
  it('a step of nothing, or of NaN, leaves every clock where it was and a number', () => {
    let f = until(newQuests(), hero([0, 200, 600]), 'emergency');
    f = { ...f, rescue: { ...f.rescue, phase: 'fall' }, lesson: { on: true, next: 1, t: 10, best: null } };
    for (const dt of [NaN, -1, 0, undefined]) {
      const q = stepQuests(f, hero([3000, 50, -3000]), dt, W);
      expect(q.lesson.t).toBe(10);
      expect(q.rescue.t).toBe(f.rescue.t);
      for (const c of [...q.rescue.p, ...q.rescue.v]) expect(Number.isFinite(c)).toBe(true);
      const n = stepQuests(newQuests(), hero([0, 200, 600]), dt, W);
      expect(n.nextCall).toBe(newQuests().nextCall);
    }
  });
  it('picks up a card flown through flat out, at a slow frame rate', () => {
    // 260 m/s at 20 frames a second: 13 m a frame, never within reach of it on a frame
    const p = CARDS[3].at(W);
    const { q, ev } = run(newQuests(), (s) => hero([p[0] - 19.5 + 260 * s, p[1] - 1, p[2]]), 0.2, 0.05);
    expect(q.cards).toEqual([4]);
    expect(ev.filter((e) => e.type === 'card')).toHaveLength(1);
  });
  it('catches someone flown through flat out, at a slow frame rate', () => {
    const q = until(newQuests(), hero([0, 200, 600]), 'emergency');
    const c = [q.rescue.p[0], q.rescue.p[1] + 1, q.rescue.p[2]];
    const { ev } = run(q, (s) => hero([c[0], c[1] - 1, c[2] - 19.5 + 260 * s]), 0.2, 0.05);
    expect(ev.some((e) => e.type === 'caught')).toBe(true);
  });
  it('takes nothing from a jump across the map: only from flying', () => {
    // (the dev hook moving him, or the way back from space: not a flight through what's between)
    const p = CARDS[3].at(W);
    let q = stepQuests(newQuests(), hero([p[0] - 2000, p[1] - 1, p[2]]), 1 / 30, W);
    q = stepQuests(q, hero([p[0] + 2000, p[1] - 1, p[2]]), 1 / 30, W);
    expect(q.cards).toEqual([]);
    const r = RINGS[0];
    q = stepQuests(newQuests(), hero([r.p[0] - r.n[0] * 2000, r.p[1] - 1 - r.n[1] * 2000, r.p[2] - r.n[2] * 2000]), 1 / 30, W);
    q = stepQuests(q, hero([r.p[0] + r.n[0] * 2000, r.p[1] - 1 + r.n[1] * 2000, r.p[2] + r.n[2] * 2000]), 1 / 30, W);
    expect(q.lesson.on).toBe(false);
  });
});

describe('while he’s out in space', () => {
  // (out there his position is the space's, nothing to do with the city's)
  const up = (p, mode = 'air') => ({ ...hero([p[0], 60000 + p[1], p[2]], mode), zone: 'space' });
  it('the city goes on without him: whoever’s falling falls, and nobody else calls', () => {
    const q = until(newQuests(), hero([0, 200, 600]), 'emergency');
    const { q: after, ev } = run(q, up([0, 200, 600]), 120);
    expect(ev.some((e) => e.type === 'caught')).toBe(false);
    expect(ev.some((e) => e.type === 'missed')).toBe(true);
    expect(ev.some((e) => e.type === 'emergency')).toBe(false);
    expect(after.rescue).toBe(null);
    expect(after.nextCall).toBeGreaterThan(0);
  });
  it('someone in his arms stays there, and isn’t set down on the Moon', () => {
    let q = until(newQuests(), hero([0, 200, 600]), 'emergency');
    q = { ...q, rescue: { ...q.rescue, carried: true } };
    const { q: after, ev } = run(q, up([111000, 18000 - 60000 + 9000, -99000], 'ground'), 2);
    expect(ev.some((e) => e.type === 'saved')).toBe(false);
    expect(after.rescue?.carried).toBe(true);
    // and back in the city, he sets them down as ever
    const { ev: home } = run(after, hero([0, 0, 600], 'ground'), 0.1);
    expect(home.some((e) => e.type === 'saved')).toBe(true);
  });
  it('takes no card, and passes no ring, wherever he is out there', () => {
    // (a point out there that happens to have a card's numbers)
    const p = CARDS[7].at(W);
    const { q } = run(newQuests(), { ...hero([p[0], p[1] - 1, p[2]]), zone: 'space' }, 0.5);
    expect(q.cards).toEqual([]);
    const r = RINGS[0];
    const { q: l } = run(newQuests(), (s) => ({ ...hero([r.p[0] + r.n[0] * (s * 40 - 10), r.p[1] - 1 + r.n[1] * (s * 40 - 10), r.p[2] + r.n[2] * (s * 40 - 10)]), zone: 'space' }), 0.5);
    expect(l.lesson.on).toBe(false);
  });
});

describe('the plaza in episode 8: twelve falling at once', () => {
  const at = [30, 0, 45];
  it('falls from the tower’s top over the plaza, each caught once by flying through them, and counted the mission’s', () => {
    let q = rain(newQuests(), at, 12);
    expect(q.rain).toHaveLength(12);
    for (const r of q.rain) {
      expect(Math.hypot(r.p[0] - at[0], r.p[2] - at[2])).toBeLessThan(40);
      expect(r.p[1]).toBeGreaterThan(50);
    }
    // through the first one's path, and nowhere near the rest
    const first = q.rain[0];
    const ev = [];
    for (let s = 0; s < 1; s += 1 / 30) {
      q = stepQuests(q, hero([first.p[0], first.p[1] - 1 - 9.8 * s * s * 0.5, first.p[2]]), 1 / 30, W);
      ev.push(...q.ev);
    }
    const caught = ev.filter((e) => e.type === 'caught');
    expect(caught).toEqual([expect.objectContaining({ source: 'mission' })]);
    expect(q.rain.filter((r) => r.state === 'caught')).toHaveLength(1);
  });
  it('the ones nobody catches come down, and are missed', () => {
    let q = rain(newQuests(), at, 12);
    const ev = [];
    for (let s = 0; s < 12; s += 1 / 30) {
      q = stepQuests(q, hero([3000, 50, -3000]), 1 / 30, W);
      ev.push(...q.ev);
    }
    expect(ev.filter((e) => e.type === 'missed' && e.source === 'mission')).toHaveLength(12);
    expect(q.rain).toEqual([]);
  });
});
