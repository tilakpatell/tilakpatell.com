import { describe, expect, it } from 'vitest';
import { classOf, loadRulebook, weaponOf } from './rulebook.js';
import { field } from './fixtures/field.js';
import { buildNav } from './nav.js';
import { HEAD_MULTIPLIER, TIME_FOR_CORPSE, capsulesOf, hurt, move, newSoldier, speedOf, tick } from './soldier.js';

const rb = loadRulebook();
const ASSAULT = classOf(rb, 'l-orig-assault');
const make = (over = {}) => newSoldier(ASSAULT, { id: 's1', team: 1, at: [0, 0, 0], weapon: weaponOf(rb, ASSAULT.weapon), ...over });

describe('soldiers', () => {
  it('take their health from the class row', () => {
    const s = make();
    expect(s.hp).toBe(150);
    expect(s.hpMax).toBe(150);
    expect(s.gun.row.id).toBe(ASSAULT.weapon);
  });

  it('take damage by part, the head multiplied', () => {
    const s = make();
    hurt(s, { damage: 35, part: 'chest', now: 0 });
    expect(s.hp).toBe(115);
    const t = make();
    hurt(t, { damage: 35, part: 'head', now: 0 });
    expect(t.hp).toBeCloseTo(150 - 35 * HEAD_MULTIPLIER, 9);
  });

  it('regenerate after the class’s delay at its rate', () => {
    const s = make();
    hurt(s, { damage: 100, now: 0 });
    for (let t = 0.05; t < 5.99; t += 0.05) tick(s, 0.05, t);
    expect(s.hp).toBe(50);
    tick(s, 0.05, 6);
    tick(s, 1, 7);
    expect(s.hp).toBeCloseTo(50 + 30 * 1.05, 6);
    tick(s, 10, 17);
    expect(s.hp).toBe(150);
  });

  it('go down at no health, and are gone after the corpse time', () => {
    const s = make();
    expect(hurt(s, { damage: 200, now: 1 })).toBe('down');
    expect(s.alive).toBe(false);
    expect(s.state).toBe('dying');
    tick(s, TIME_FOR_CORPSE - 0.1, TIME_FOR_CORPSE + 0.9);
    expect(s.state).toBe('dying');
    tick(s, 0.1, TIME_FOR_CORPSE + 1);
    expect(s.state).toBe('down');
    expect(hurt(s, { damage: 10, now: 7 })).toBeNull();
  });

  it('carry the game’s capsules, the head on top, lower when crouched', () => {
    const s = make();
    const head = capsulesOf(s).find((c) => c.part === 'head');
    expect(head.b[1] + head.r).toBeCloseTo(1.7, 6);
    expect(head.r).toBe(0.16);
    s.stance = 'crouch';
    const low = capsulesOf(s).find((c) => c.part === 'head');
    expect(low.b[1] + low.r).toBeCloseTo(1.15, 6);
    expect(capsulesOf(s).map((c) => c.part)).toEqual(['head', 'chest', 'hips', 'armL', 'armR', 'legL', 'legR']);
  });

  it('walk, sprint and crouch at the character physics’ speeds', () => {
    const s = make();
    expect(speedOf(s)).toBe(3.8);
    s.sprint = true;
    expect(speedOf(s)).toBeCloseTo(3.8 * 1.57, 9);
    s.stance = 'crouch';
    expect(speedOf(s)).toBe(2.5);
  });

  it('are stopped by the wall', () => {
    const nav = buildNav(field());
    const s = make({ at: [0, 0, 10] });
    for (let i = 0; i < 200; i++) move(s, [0, 1], 0.05, nav);
    expect(s.at[2]).toBeLessThan(19.5);
    expect(s.at[2]).toBeGreaterThan(18.5);
    // sliding along it when going slantwise
    const t = make({ at: [0, 0, 18.9] });
    move(t, [1, 1], 0.05, nav);
    expect(t.at[0]).toBeGreaterThan(0);
  });
});
