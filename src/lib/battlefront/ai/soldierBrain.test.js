import { describe, expect, it } from 'vitest';
import { seeded } from '../../seeded.js';
import { aiOf, classOf, loadRulebook, weaponOf } from '../rulebook.js';
import { buildNav, lineClear, shields } from '../nav.js';
import { field } from '../fixtures/field.js';
import { newSoldier } from '../soldier.js';
import { createBrain, patternStep, think } from './soldierBrain.js';

const rb = loadRulebook();
const ai = aiOf(rb);
const nav = buildNav({ ...field(), cover: ai.cover.constants });
const open = buildNav({ heightAt: () => 0, bounds: { min: [-100, -100], max: [100, 100] }, cell: 2, solids: [], cover: ai.cover.constants });

function bot(at, over = {}) {
  const cls = classOf(rb, 'l-orig-assault');
  const s = newSoldier(cls, { id: 'me', team: 1, at, weapon: weaponOf(rb, cls.weapon), rand: seeded(1) });
  return createBrain(s, { ai, rand: seeded(1), ...over });
}

const see = (brain, id, at, visible = true) => {
  brain.me.beliefs[id] = { id, at: { x: at[0], y: at[1], z: at[2] }, vel: { x: 0, y: 0, z: 0 }, confidence: 1, visible, seenAt: 0, hostile: true };
};

const world = (n, extra = {}) => ({ nav: n, lineClear: (a, b) => lineClear(n, a, b), shields, squad: null, objective: null, enemies: [], taken: new Map(), ...extra });

describe('the soldier brain', () => {
  it('takes the class’s template and tactics', () => {
    const b = bot([0, 0, 0]);
    expect(b.role).toBe('rifleman');
    expect(b.tactics.engage.distance).toBe(40);
  });

  it('attacks an enemy 30 m off in the open, firing only with a clear line', () => {
    const b = bot([0, 0, -50]);
    see(b, 'them', [0, 1.2, -20]);
    const i = think(b, world(open), 1);
    expect(['attack', 'cover']).toContain(i.mode);
    expect(i.fire).toBe(true);
    // the same with the wall between
    const w = bot([0, 0, 5]);
    see(w, 'them', [0, 1.2, 35]);
    const j = think(w, world(nav), 1);
    expect(['attack', 'cover']).toContain(j.mode);
    expect(j.fire).toBe(false);
  });

  it('advances on an enemy past its engage distance', () => {
    const b = bot([0, 0, -80]);
    see(b, 'them', [0, 1.2, -20]);
    const i = think(b, world(open), 1);
    expect(i.mode).toBe('advance');
    expect(i.goal).toEqual([0, -20]);
  });

  it('falls back toward its squad when suppressed with no cover near', () => {
    const b = bot([0, 0, -50]);
    b.s.suppressed = 1;
    see(b, 'them', [0, 1.2, -20]);
    const i = think(b, world(open, { squad: { centre: [-10, -60], posture: 'hold' } }), 1);
    expect(i.mode).toBe('hide');
    expect(i.goal).not.toBeNull();
    // further from the threat than it was
    expect(Math.hypot(i.goal[0], i.goal[1] + 20)).toBeGreaterThan(30);
    expect(i.fire).toBe(false);
  });

  it('flees when its squad breaks', () => {
    const b = bot([0, 0, -50]);
    see(b, 'them', [0, 1.2, -20]);
    const i = think(b, world(open, { squad: { centre: [0, -50], posture: 'retreat' } }), 1);
    expect(i.mode).toBe('flee');
    expect(i.goal[1]).toBeLessThan(-50);
  });

  it('follows its leader with no enemy in mind', () => {
    const b = bot([0, 0, 0]);
    const i = think(b, world(open, { squad: { leader: 'boss', posture: 'hold' }, leaderAt: [20, 20] }), 1);
    expect(i.mode).toBe('follow');
    expect(i.goal).toEqual([20, 20]);
  });

  it('fires on its firing pattern’s set bits', () => {
    const b = bot([0, 0, 0]);
    b.pattern = ai.patterns.find((p) => p.id === 1);
    b.frame = 0;
    const fired = [];
    for (let f = 0; f < 12; f++) fired.push(patternStep(b));
    expect(fired).toEqual(b.pattern.bits.slice(0, 12));
    expect(fired[0]).toBe(true);
  });
});
