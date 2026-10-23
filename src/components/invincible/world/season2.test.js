import { describe, expect, it } from 'vitest';
import { ANGSTROM_AT, BEAST_AT, DROWNED_GATES, LEVY_PORTALS, MIRROR_AT, SEASON2 } from './season2';
import { DIM_IDS, PORTAL_R, PORTAL_SPEED } from './dimensions';
import { MISSIONS, STORY, feedMission, missionOf, nextStory, startMission, stepOf } from './missions';
import { CITY, buildWorld, near } from './map';

const W = buildWorld();
const inside = (b, p) => p[0] > b.x0 && p[0] < b.x1 && p[2] > b.z0 && p[2] < b.z1 && p[1] > b.y0 && p[1] < b.y1;
const at = (p, extra = {}) => ({ type: 'at', p, mode: 'air', speed: 0, ...extra });
function feed(p, events) {
  const out = [];
  for (const ev of events) {
    const r = feedMission(p, ev);
    p = r.progress;
    out.push(...r.out);
  }
  return { p, out };
}

describe('season two', () => {
  it('is listed after season one, and the board’s next after episode 8 is Angstrom', () => {
    expect(SEASON2.map((m) => m.id)).toEqual(['levy', 'sequids', 'beast']);
    expect(MISSIONS.at(-1).id).toBe('beast');
    expect(STORY.slice(-3)).toEqual(['levy', 'sequids', 'beast']);
    expect(nextStory(['ep1', 'ep2', 'ep3', 'ep4', 'ep5', 'ep6', 'ep7', 'ep8'])).toBe('levy');
    expect(missionOf('levy').start.after).toContain('ep8');
  });
  it('“Every version of you” has three portals round downtown, a thing in each dimension, then Angstrom at home', () => {
    const m = missionOf('levy');
    const portals = m.steps.filter((s) => s.type === 'through' && s.portal);
    expect(portals).toHaveLength(4);
    for (const s of portals) {
      expect(s.r).toBe(PORTAL_R);
      expect(s.speed).toBe(PORTAL_SPEED);
      // in the air over downtown, in no tower
      expect(s.at[1]).toBeGreaterThan(60);
      expect(Math.hypot(s.at[0], s.at[2])).toBeLessThan(400);
      expect(near(W, s.at[0], s.at[2], PORTAL_R, []).some((b) => inside(b, s.at))).toBe(false);
    }
    const dims = m.steps.map((s) => s.dimension);
    expect(dims).toEqual(['home', 'burnt', 'burnt', 'drowned', 'drowned', 'mirror', 'mirror', 'home']);
    for (const d of dims) expect(DIM_IDS).toContain(d);
    expect(m.steps[1]).toMatchObject({ type: 'catch', n: 1, source: 'mission', dimension: 'burnt' });
    expect(m.steps[3]).toMatchObject({ type: 'race', gates: DROWNED_GATES, dimension: 'drowned' });
    for (const g of DROWNED_GATES) expect(g[1]).toBeGreaterThan(12 + 10);
    expect(m.steps[5]).toMatchObject({ type: 'defeat', kind: 'mirror', n: 1, spawn: [['mirror', 1, MIRROR_AT]], dimension: 'mirror' });
    expect(m.steps[7]).toMatchObject({ type: 'defeat', kind: 'angstrom', n: 1, spawn: [['angstrom', 1, ANGSTROM_AT]], dimension: 'home' });
    expect(m.achievement).toBe('levy');
    expect(Object.keys(LEVY_PORTALS)).toEqual(['burnt', 'drowned', 'mirror', 'home']);
  });
  it('plays through: each step begins with its dimension, and the end is the achievement', () => {
    const m = missionOf('levy');
    let p = startMission('levy');
    expect(stepOf(p).dimension).toBe('home');
    const through = (q) => [at([q[0] - 30, q[1], q[2]]), at(q, { speed: 40 })];
    let r = feed(p, through(m.steps[0].at));
    p = r.p;
    expect(r.out.find((o) => o.type === 'step')).toMatchObject({ i: 1, dimension: 'burnt' });
    r = feed(p, [{ type: 'caught', source: 'mission' }]);
    p = r.p;
    expect(p.step).toBe(2);
    r = feed(p, through(m.steps[2].at));
    p = r.p;
    expect(r.out.find((o) => o.type === 'step')).toMatchObject({ i: 3, dimension: 'drowned' });
    r = feed(p, DROWNED_GATES.map((g) => at(g)));
    p = r.p;
    expect(p.step).toBe(4);
    r = feed(p, through(m.steps[4].at));
    p = r.p;
    expect(r.out.find((o) => o.type === 'step')).toMatchObject({ i: 5, dimension: 'mirror', spawn: [['mirror', 1, MIRROR_AT]] });
    r = feed(p, [{ type: 'ko', kind: 'mirror', id: 1 }]);
    p = r.p;
    expect(p.step).toBe(6);
    r = feed(p, through(m.steps[6].at));
    p = r.p;
    expect(r.out.find((o) => o.type === 'step')).toMatchObject({ i: 7, dimension: 'home', spawn: [['angstrom', 1, ANGSTROM_AT]] });
    r = feed(p, [{ type: 'ko', kind: 'angstrom', id: 2 }]);
    p = r.p;
    expect(p.done).toBe(true);
    expect(r.out.find((o) => o.type === 'done')).toMatchObject({ achievement: 'levy' });
  });
  it('its points are in the city', () => {
    for (const q of [...Object.values(LEVY_PORTALS), ...DROWNED_GATES, MIRROR_AT, ANGSTROM_AT]) {
      expect(q[0]).toBeGreaterThan(CITY.x0);
      expect(q[0]).toBeLessThan(CITY.x1);
      expect(q[2]).toBeGreaterThan(CITY.z0);
      expect(q[2]).toBeLessThan(CITY.z1);
    }
  });
});

describe('Battle Beast', () => {
  it('is Cecil’s lesson in panels, then the fight on the GDA’s pad', () => {
    const m = missionOf('beast');
    expect(m.steps.map((s) => s.type)).toEqual(['use', 'defeat']);
    expect(m.steps[0].id).toBe('panels');
    expect(m.steps[1]).toMatchObject({ kind: 'beast', n: 1, spawn: [['beast', 1, BEAST_AT]] });
    expect(m.achievement).toBe('beast');
    let p = startMission('beast');
    let r = feed(p, [{ type: 'use', id: 'panels' }]);
    p = r.p;
    expect(r.out.find((o) => o.type === 'step')).toMatchObject({ i: 1, spawn: [['beast', 1, BEAST_AT]] });
    r = feed(p, [{ type: 'ko', kind: 'beast', id: 3 }]);
    expect(r.p.done).toBe(true);
    expect(r.out.find((o) => o.type === 'done')).toMatchObject({ achievement: 'beast' });
  });
});
