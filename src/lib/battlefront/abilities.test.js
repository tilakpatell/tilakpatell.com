import { describe, expect, it } from 'vitest';
import { abilityOf, loadRulebook } from './rulebook.js';
import { QUEUE, ROLL, blocked, charges, createAbilities, press, tick } from './abilities.js';

describe('abilities', () => {
  it('gives the roll two charges a bar and refills them over the recharge', () => {
    const abs = createAbilities([ROLL]);
    expect(charges(abs, 0)).toBe(2);
    expect(press(abs, 0, 0).fired).toBe(true);
    expect(press(abs, 0, 0.01).fired).toBe(true);
    expect(press(abs, 0, 0.02)).toEqual({ fired: false, why: 'recharging' });
    tick(abs, 2, 2);
    expect(charges(abs, 0)).toBe(1);
    tick(abs, 2, 4);
    expect(charges(abs, 0)).toBe(2);
  });

  it('blocks a press on a channel another ability is using', () => {
    const rb = loadRulebook();
    const choke = abilityOf(rb, 'Ability_DarthVader_ForceChoke_02');
    const rage = { ...abilityOf(rb, 'Ability_Vader_FocusRage'), slot: 'right' };
    const abs = createAbilities([{ ...choke, slot: 'left' }, rage]);
    expect(press(abs, 'left', 0).fired).toBe(true);
    const ev = tick(abs, 0.1, 0.1);
    expect(ev.map((e) => e.phase)).toEqual(['start', 'active']);
    expect(blocked(abs, 'right')).toBe(true);
    expect(press(abs, 'right', 0.2)).toEqual({ fired: false, why: 'blocked' });
    tick(abs, 1.5, 1.6);
    expect(blocked(abs, 'right')).toBe(false);
    expect(press(abs, 'right', 1.7).fired).toBe(true);
  });

  it('queues a press during an activation and fires it on the next tick', () => {
    const slow = { id: 'slow', activation: 0.1, active: 0, recharge: 4, cost: 0.5, channels: [] };
    const abs = createAbilities([slow, { ...ROLL, slot: 1 }]);
    expect(press(abs, 0, 0).fired).toBe(true);
    expect(press(abs, 1, 0.05)).toEqual({ fired: false, why: 'queued' });
    for (let i = 1; i < QUEUE; i++) press(abs, 1, 0.05);
    expect(press(abs, 1, 0.05).why).toBe('blocked');
    const ev = tick(abs, 0.1, 0.1);
    expect(ev.filter((e) => e.id === ROLL.id && e.phase === 'start')).toHaveLength(2);
  });

  it('lets a queued press lapse after half a second', () => {
    const slow = { id: 'slow', activation: 1, active: 0, recharge: 4, cost: 1, channels: [] };
    const abs = createAbilities([slow, { ...ROLL, slot: 1 }]);
    press(abs, 0, 0);
    press(abs, 1, 0);
    const ev = tick(abs, 1, 1);
    expect(ev.some((e) => e.id === ROLL.id)).toBe(false);
  });
});
