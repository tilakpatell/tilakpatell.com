import { describe, expect, it } from 'vitest';
import { abilityOf, loadRulebook } from './rulebook.js';
import { QUEUE, ROLL, STATES, blocked, charges, createAbilities, end, hold, press, recharge, state, tick } from './abilities.js';

describe('abilities', () => {
  it('gives the roll two charges a bar and refills them over the recharge', () => {
    const abs = createAbilities([ROLL]);
    expect(charges(abs, 0)).toBe(2);
    expect(press(abs, 0, 0).fired).toBe(true);
    expect(press(abs, 0, 0.01).fired).toBe(true);
    expect(press(abs, 0, 0.02)).toEqual({ fired: false, why: 'recharging' });
    // (the second roll is active until 0.11 s: the recharge begins then, a charge every 2 s after)
    tick(abs, 2, 2);
    expect(charges(abs, 0)).toBe(0);
    tick(abs, 0.11, 2.11);
    expect(charges(abs, 0)).toBe(1);
    tick(abs, 2, 4.11);
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

  // finding 33: PlayerAbilityState Disabled/Recharge/Blocked/Ready/Activating/Active, BlockedPlayerAbilityIds
  it('names the game’s six states, and a grenade in the hand blocks the slots it names through its pull', () => {
    expect(STATES).toEqual(['disabled', 'recharge', 'blocked', 'ready', 'activating', 'active']);
    const grenade = { id: 'nade', activation: 0.32, active: 0.7, recharge: 35, channels: [], blocks: ['mid'] };
    const mid = { id: 'mid', activation: 0, active: Infinity, recharge: 25, channels: [] };
    const abs = createAbilities([grenade, mid]);
    expect(state(abs, 0)).toBe('ready');
    expect(press(abs, 0, 0).fired).toBe(true);
    expect(state(abs, 0)).toBe('activating');
    expect(state(abs, 1)).toBe('blocked');
    tick(abs, 0.32, 0.32);
    expect(state(abs, 0)).toBe('active');
    expect(press(abs, 1, 0.4)).toEqual({ fired: false, why: 'blocked' });
    tick(abs, 0.7, 1.02);
    expect(state(abs, 0)).toBe('recharge');
    expect(state(abs, 1)).toBe('ready');
    expect(state(abs, 9)).toBe('disabled');
  });

  it('holds an infinite ability active until its own event ends it, and only then recharges', () => {
    const sentry = { id: 'sentry', activation: 0.9, active: Infinity, recharge: 30, channels: [] };
    const abs = createAbilities([sentry]);
    press(abs, 0, 0);
    tick(abs, 0.9, 0.9);
    expect(state(abs, 0)).toBe('active');
    tick(abs, 19, 19.9);
    expect(state(abs, 0)).toBe('active');
    expect(charges(abs, 0)).toBe(0);
    expect(end(abs, 0, 19.9, 'heat')).toBe(true);
    expect(end(abs, 0, 19.9, 'heat')).toBe(false);
    const ev = tick(abs, 0.05, 19.95);
    expect(ev).toEqual([{ type: 'ability', id: 'sentry', slot: 0, phase: 'end', why: 'heat' }]);
    expect(state(abs, 0)).toBe('recharge');
    expect(recharge(abs, 0)).toBeCloseTo(0.05 / 30, 9);
    tick(abs, 30, 49.95);
    expect(state(abs, 0)).toBe('ready');
    expect(recharge(abs, 0)).toBe(1);
  });

  it('lowers a toggle on its second press once the retrigger cooldown has passed', () => {
    const shield = { id: 'shield', activation: 0, active: Infinity, recharge: 30, channels: [], retrigger: { cooldown: 2 } };
    const abs = createAbilities([shield]);
    expect(press(abs, 0, 0).fired).toBe(true);
    expect(tick(abs, 0.05, 0.05).map((e) => e.phase)).toEqual(['start', 'active']);
    expect(press(abs, 0, 1)).toEqual({ fired: false, why: 'blocked' });
    expect(state(abs, 0)).toBe('active');
    expect(press(abs, 0, 2)).toEqual({ fired: false, why: 'retriggered' });
    expect(tick(abs, 0.05, 2.05).map((e) => e.phase)).toEqual(['end']);
    expect(state(abs, 0)).toBe('recharge');
  });

  it('keeps a held ability active past its active time until it is let go', () => {
    const grenade = { id: 'nade', activation: 0.32, active: 0.7, recharge: 35, channels: [] };
    const abs = createAbilities([grenade]);
    press(abs, 0, 0);
    tick(abs, 0.32, 0.32);
    hold(abs, 0, true);
    tick(abs, 2, 2.32);
    expect(state(abs, 0)).toBe('active');
    hold(abs, 0, false);
    expect(tick(abs, 0.05, 2.37).map((e) => e.phase)).toEqual(['end']);
    expect(state(abs, 0)).toBe('recharge');
  });

  // (watched in the running game: a press that cannot act, the ability recharging or another one active on its
  // channel, is held for half a second and acts if the ability becomes able in that time; otherwise it is dropped)
  it('holds a press that cannot act yet for half a second, and drops it after', () => {
    const rows = [ROLL, { id: 'x', slot: 1, activation: 0, active: 0, recharge: 1, channels: [] }];
    const starts = (abs, from, to) => {
      let n = 0;
      for (let i = Math.round(from / 0.05) + 1; i <= Math.round(to / 0.05); i++) n += tick(abs, 0.05, Math.round(i * 0.05 * 1e6) / 1e6).filter((e) => e.phase === 'start').length;
      return n;
    };
    // pressed 0.4 s before it is ready again: held, and it goes off the step it is ready
    const held = createAbilities(rows);
    expect(press(held, 1, 0).fired).toBe(true);
    // (the first press's own start, read off before the count begins)
    expect(tick(held, 0, 0).map((e) => e.phase)).toEqual(['start', 'end']);
    expect(starts(held, 0, 0.6)).toBe(0);
    expect(press(held, 1, 0.6)).toEqual({ fired: false, why: 'recharging' });
    expect(starts(held, 0.6, 0.95)).toBe(0);
    expect(starts(held, 0.95, 1)).toBe(1);
    // pressed 0.6 s before: dropped, and the ability is ready and not used
    const dropped = createAbilities(rows);
    press(dropped, 1, 0);
    starts(dropped, 0, 0.4);
    expect(press(dropped, 1, 0.4)).toEqual({ fired: false, why: 'recharging' });
    expect(starts(dropped, 0.4, 1.5)).toBe(0);
    expect(state(dropped, 1)).toBe('ready');
    // blocked by another ability on its channel: it goes off when that one ends, if that is within the half second
    const two = createAbilities([ROLL, { id: 'a', slot: 1, activation: 0, active: 1, recharge: 5, channels: ['c'] }, { id: 'b', slot: 2, activation: 0, active: 0, recharge: 5, channels: ['c'] }]);
    press(two, 1, 0);
    starts(two, 0, 0.7);
    expect(press(two, 2, 0.7)).toEqual({ fired: false, why: 'blocked' });
    expect(starts(two, 0.7, 1.05)).toBe(1);
    // (the roll is the caller's to act on at the press: a roll with no charge is not held)
    const roll = createAbilities(rows);
    press(roll, 0, 0);
    press(roll, 0, 0.01);
    expect(press(roll, 0, 0.02).fired).toBe(false);
    expect(roll.queue).toHaveLength(0);
  });

  // (the game's own ability, read from its code: one state and one timer, Activating then Active then Recharge then
  // Ready, each for its own time; the recharge begins when the active time ends, not at the press)
  it('runs its activation, then its active time, and only then its recharge: 0.5 + 8 + 10 s to ready again', () => {
    const abs = createAbilities([{ id: 'x', activation: 0.5, active: 8, recharge: 10, channels: [] }]);
    const at = new Map();
    expect(press(abs, 0, 0).fired).toBe(true);
    let was = state(abs, 0);
    at.set(was, 0);
    for (let i = 1; i <= 400; i++) {
      const now = Math.round(i * 0.05 * 1e6) / 1e6;
      tick(abs, 0.05, now);
      const s = state(abs, 0);
      if (s !== was) at.set(s, now);
      was = s;
    }
    expect([...at.keys()]).toEqual(['activating', 'active', 'recharge', 'ready']);
    expect(at.get('active')).toBeCloseTo(0.5, 9);
    expect(at.get('recharge')).toBeCloseTo(8.5, 9);
    // (not at 10 s, a recharge begun at the press)
    expect(at.get('ready')).toBeCloseTo(18.5, 6);
  });
});
