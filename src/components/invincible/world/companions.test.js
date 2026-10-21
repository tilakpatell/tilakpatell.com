import { describe, expect, it } from 'vitest';
import { COMPANION } from './lines';
import { DAD, EVE, newDad, newEve, stepDad, stepEve } from './companions';

const LOOP = { cx: 0, cz: 0, rad: 400, y: 160, speed: 32 };
const sense = (o = {}) => ({ hero: [5000, 100, 5000], heroV: [0, 0, 0], heroMode: 'air', lesson: null, mission: null, foes: [], talk: false, time: 'noon', ...o });
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function runEve(e, secs, s, dt = 1 / 30) {
  const ev = [];
  for (let t = 0; t < secs; t += dt) {
    const r = stepEve(e, typeof s === 'function' ? s(e, t) : s, dt);
    e = r.eve;
    ev.push(...r.ev);
  }
  return { eve: e, ev };
}
function runDad(d, secs, s, dt = 1 / 30) {
  const ev = [];
  for (let t = 0; t < secs; t += dt) {
    const r = stepDad(d, typeof s === 'function' ? s(d, t) : s, dt);
    d = r.dad;
    ev.push(...r.ev);
  }
  return { dad: d, ev };
}

describe('Eve', () => {
  it('flies her loop', () => {
    const e0 = newEve(LOOP);
    const { eve } = runEve(e0, 5, sense());
    expect(eve.state).toBe('patrol');
    expect(d3(eve.p, e0.p)).toBeGreaterThan(50);
  });

  it('comes over when he hangs still within 300 m for 4 s, to within 6 m, with a line', () => {
    const e0 = newEve(LOOP);
    const hero = [e0.p[0] + 150, e0.p[1], e0.p[2]];
    const { eve, ev } = runEve(e0, 12, sense({ hero }));
    expect(eve.state).toBe('intercept');
    expect(d3(eve.p, hero)).toBeLessThanOrEqual(EVE.beside + 0.5);
    expect(ev.some((e) => e.type === 'line' && e.who === 'eve' && COMPANION.eveMeet.includes(e.text))).toBe(true);
  });

  it('flies her loop over the towers on it, never into one', () => {
    // a 300 m tower a quarter of the way round
    const tower = [LOOP.cx, LOOP.cz + LOOP.rad * 0.7];
    const roof = (x, z) => (Math.hypot(x - tower[0], z - tower[1]) < 40 ? 300 : 0);
    let e = newEve({ ...LOOP, roof });
    let low = Infinity;
    for (let t = 0; t < 30; t += 1 / 30) {
      e = stepEve(e, sense(), 1 / 30).eve;
      if (Math.hypot(e.p[0] - tower[0], e.p[2] - tower[1]) < 40) low = Math.min(low, e.p[1]);
    }
    expect(low).toBeGreaterThan(300);
  });

  it('does not come over before 4 s', () => {
    const e0 = newEve(LOOP);
    const hero = [e0.p[0] + 150, e0.p[1], e0.p[2]];
    expect(runEve(e0, 3, sense({ hero })).eve.state).toBe('patrol');
  });

  it('flies 8 m off his left when he flies off from beside her, for 40 s, then back to her loop', () => {
    const e0 = newEve(LOOP);
    let hero = [e0.p[0] + 100, e0.p[1], e0.p[2]];
    let { eve } = runEve(e0, 10, sense({ hero }));
    expect(eve.state).toBe('intercept');
    // off he goes, north (+z) at 40 m/s
    const v = [0, 0, 40];
    const fly = (e, t) => sense({ hero: [hero[0], hero[1], hero[2] + 40 * t], heroV: v });
    ({ eve } = runEve(eve, 6, fly));
    expect(eve.state).toBe('escort');
    const at = [hero[0], hero[1], hero[2] + 40 * 6];
    // his left, heading +z, is +x
    expect(Math.abs(eve.p[0] - (at[0] + EVE.left))).toBeLessThan(3);
    expect(d3(eve.p, [at[0] + EVE.left, at[1], at[2]])).toBeLessThan(6);
    hero = at;
    ({ eve } = runEve(eve, 36, (e, t) => sense({ hero: [hero[0], hero[1], hero[2] + 40 * t], heroV: v })));
    expect(eve.state).toBe('patrol');
  });

  it('waits beside him 45 s at most, then flies on, and won’t come back till he’s been off', () => {
    const e0 = newEve(LOOP);
    const hero = [e0.p[0] + 100, e0.p[1], e0.p[2]];
    let { eve } = runEve(e0, 10, sense({ hero }));
    expect(eve.state).toBe('intercept');
    ({ eve } = runEve(eve, 45, sense({ hero })));
    expect(eve.state).toBe('patrol');
    ({ eve } = runEve(eve, 10, sense({ hero })));
    expect(eve.state).toBe('patrol');
    // off past 300 m, and back: she'll come again
    ({ eve } = runEve(eve, 0.2, sense({ hero: [hero[0] + 5000, hero[1], hero[2]] })));
    ({ eve } = runEve(eve, 15, (e) => sense({ hero: [e.p[0] + 100, e.p[1], e.p[2]] })));
    expect(eve.state).toBe('intercept');
  });

  it('goes for a foe within 400 m and knocks one out every 8 s', () => {
    const e0 = newEve(LOOP);
    const foe = [e0.p[0] + 300, e0.p[1], e0.p[2]];
    const { eve, ev } = runEve(e0, 17, sense({ foes: [foe] }));
    expect(eve.state).toBe('fight');
    expect(ev.filter((e) => e.type === 'eveHit').length).toBe(2);
    expect(ev.find((e) => e.type === 'eveHit').foe).toBe(0);
  });

  it('says a word as she goes for a foe, if he’s near enough to hear it', () => {
    const e0 = newEve(LOOP);
    const foe = [e0.p[0] + 300, e0.p[1], e0.p[2]];
    const near = runEve(e0, 1, sense({ foes: [foe], hero: [e0.p[0] - 50, e0.p[1], e0.p[2]] }));
    expect(near.ev.filter((e) => e.type === 'line' && COMPANION.eveFight.includes(e.text))).toHaveLength(1);
    const far = runEve(e0, 1, sense({ foes: [foe] }));
    expect(far.ev.some((e) => e.type === 'line')).toBe(false);
  });

  it('stops to talk when he presses E beside her, then waits', () => {
    const e0 = newEve(LOOP);
    const hero = [e0.p[0] + 3, e0.p[1], e0.p[2]];
    const r = stepEve(e0, sense({ hero, talk: true }), 1 / 30);
    expect(r.eve.state).toBe('talk');
    expect(r.ev.some((e) => e.type === 'line' && e.who === 'eve')).toBe(true);
    const { eve } = runEve(r.eve, 2, sense({ hero }));
    expect(d3(eve.p, r.eve.p)).toBeLessThan(0.5);
  });

  it('takes a minute away as one short step', () => {
    const e0 = newEve(LOOP);
    const { eve } = stepEve(e0, sense(), 60);
    expect(d3(eve.p, e0.p)).toBeLessThanOrEqual(EVE.fast * 0.05 + 1e-6);
  });
});

describe('Dad', () => {
  it('watches over downtown by day', () => {
    const { dad } = runDad(newDad(), 2, sense());
    expect(dad.state).toBe('watch');
    expect(d3(dad.p, DAD.watch)).toBeLessThan(1);
  });

  it('follows 50 m behind and 20 m above at the rings, with a line at each of the first three', () => {
    const hero = [0, 30, 0];
    const v = [0, 0, 30];
    let lesson = { on: true, next: 0, t: 1 };
    let d = newDad();
    let all = [];
    for (let ring = 0; ring < 5; ring++) {
      lesson = { ...lesson, next: ring, t: 1 + ring * 5 };
      const r = runDad(d, 5, sense({ hero, heroV: v, lesson }));
      d = r.dad;
      all = all.concat(r.ev);
    }
    expect(d.state).toBe('lesson');
    expect(d3(d.p, [0, 50, -50])).toBeLessThan(3);
    const lines = all.filter((e) => e.type === 'line' && e.who === 'omni');
    expect(lines.length).toBe(3);
    expect(lines.every((e) => COMPANION.dadRing.includes(e.text))).toBe(true);
  });

  it('has a word for the first ring, though the lesson starts once he’s through it', () => {
    const r = runDad(newDad(), 0.5, sense({ hero: [0, 30, 0], lesson: { on: true, next: 1, t: 0.2 } }));
    expect(r.ev.filter((e) => e.type === 'line')).toEqual([{ type: 'line', who: 'omni', text: COMPANION.dadRing[0] }]);
  });

  it('grows impatient once the lesson passes 90 s', () => {
    const hero = [0, 30, 0];
    const r = runDad(newDad(), 1, sense({ hero, lesson: { on: true, next: 6, t: 95 } }));
    expect(r.ev.some((e) => e.type === 'line' && COMPANION.dadSlow.includes(e.text))).toBe(true);
  });

  it('stands on the porch at dusk and night', () => {
    const porch = [-2040, 0.3, 250];
    const { dad } = runDad(newDad({ porch }), 90, sense({ time: 'dusk' }));
    expect(dad.state).toBe('home');
    expect(d3(dad.p, porch)).toBeLessThan(1);
  });

  it('has a word for him when he comes up to the porch, once a visit', () => {
    const porch = [-2040, 0.3, 250];
    let r = runDad(newDad({ porch }), 90, sense({ time: 'dusk' }));
    expect(r.ev.some((e) => e.type === 'line')).toBe(false);
    const by = sense({ time: 'dusk', hero: [porch[0] + 4, 0, porch[2] + 3] });
    r = runDad(r.dad, 10, by);
    const homeLines = (ev) => ev.filter((e) => e.type === 'line' && e.who === 'omni' && COMPANION.dadHome.includes(e.text));
    expect(homeLines(r.ev)).toHaveLength(1);
    r = runDad(runDad(r.dad, 2, sense({ time: 'dusk' })).dad, 2, by);
    expect(homeLines(r.ev)).toHaveLength(1);
  });

  it('leads the spar through his points, waiting at each until Mark is within 20 m', () => {
    const points = [
      [0, 100, 0],
      [300, 120, 0],
      [300, 140, 300],
      [0, 120, 300],
    ];
    let d = newDad({ watch: [0, 100, -10] });
    let r = runDad(d, 8, sense({ mission: 'ep7', spar: points, hero: [0, 100, -300] }));
    d = r.dad;
    expect(d.state).toBe('spar');
    expect(d.next).toBe(0); // (he's not come within 20 m)
    expect(d3(d.p, points[0])).toBeLessThan(1);
    r = runDad(d, 1, sense({ mission: 'ep7', spar: points, hero: [0, 100, 10] }));
    expect(r.ev).toContainEqual({ type: 'dadAt', i: 0 });
    expect(r.dad.next).toBe(1);
  });

  it('flies a whole frame of the dev clock, in steps: 0.15 s is 9 m at 60 m/s', () => {
    const d = newDad({ watch: [0, 100, 0] });
    const { dad } = stepDad(d, sense({ mission: 'ep7', spar: [[600, 100, 0]], hero: [0, 100, 0] }), 0.15);
    expect(d3(dad.p, d.p)).toBeCloseTo(DAD.fast * 0.15, 3);
  });

  it('takes a minute away as one short step', () => {
    const d = newDad({ watch: [0, 100, 0] });
    const { dad } = stepDad(d, sense({ mission: 'ep7', spar: [[600, 100, 0]], hero: [0, 100, 0] }), 60);
    expect(d3(dad.p, d.p)).toBeLessThanOrEqual(DAD.fast * 0.05 + 1e-6);
  });
});
