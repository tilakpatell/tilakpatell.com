import { describe, expect, it } from 'vitest';
import { classOf, loadRulebook } from './rulebook.js';
import { field } from './fixtures/field.js';
import { buildNav } from './nav.js';
import { capsulesOf, newSoldier } from './soldier.js';
import { createBolts, fire, step } from './bolts.js';

const rb = loadRulebook();
const nav = buildNav(field());
const body = (at, team = 2) => {
  const s = newSoldier(classOf(rb, 'd-orig-assault'), { id: `t${at.join()}`, team, at });
  return { id: s.id, team, alive: true, at: s.at, capsules: capsulesOf(s) };
};
const shot = (bolts, from, dir, extra = {}) => fire(bolts, { from, dir, speed: 700, range: 200, ttl: 3, team: 1, owner: 'me', now: 0, ...extra });

describe('bolts', () => {
  it('hit a body in one step and name the part', () => {
    const bolts = createBolts();
    shot(bolts, [0, 1.2, 0], [0, 0, 1]);
    const ev = step(bolts, 0.05, { bodies: [body([0, 0, 30])], nav: null });
    const hit = ev.find((e) => e.type === 'hit');
    expect(hit).toBeTruthy();
    expect(hit.part).toBe('chest');
    expect(hit.dist).toBeGreaterThan(29);
    expect(bolts.list).toHaveLength(0);
  });

  it('stop at a solid between two covers', () => {
    const bolts = createBolts();
    shot(bolts, [0, 1, 0], [0, 0, 1]);
    const all = [];
    for (let i = 0; i < 3; i++) all.push(...step(bolts, 0.05, { bodies: [body([0, 0, 40])], nav }));
    expect(all.some((e) => e.type === 'hit')).toBe(false);
    const wall = all.find((e) => e.type === 'wall');
    expect(wall.at[2]).toBeCloseTo(19.5, 5);
  });

  it('pass friends by and count a near miss on an enemy', () => {
    const bolts = createBolts();
    shot(bolts, [0, 1.2, 0], [0, 0, 1]);
    const ev = step(bolts, 0.05, { bodies: [body([0, 0, 10], 1), body([1.5, 0, 15])], nav: null });
    expect(ev.some((e) => e.type === 'hit')).toBe(false);
    expect(ev.filter((e) => e.type === 'near')).toHaveLength(1);
    // once per bolt
    expect(step(bolts, 0.05, { bodies: [body([1.5, 0, 15])], nav: null }).some((e) => e.type === 'near')).toBe(false);
  });

  it('are gone past their range', () => {
    const bolts = createBolts();
    shot(bolts, [0, 50, 0], [0, 0, 1], { range: 50 });
    const ev = [];
    for (let i = 0; i < 3; i++) ev.push(...step(bolts, 0.05, { bodies: [], nav: null }));
    expect(ev.map((e) => e.type)).toEqual(['gone']);
  });
});
