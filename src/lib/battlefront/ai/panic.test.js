import { describe, expect, it } from 'vitest';
import { aiOf, loadRulebook } from '../rulebook.js';
import { panicRow, panicStep, panicking } from './panic.js';

const ai = aiOf(loadRulebook());
const mp = ai.difficulties['multiplayer:default'];
const coop = ai.difficulties['cooperative:normal'];
const frag = (at, team = 2, collided = true) => ({ at, team, collided, dead: false, row: { radius: 6 } });
const half = () => 0.5;

describe('a panic, as the source and the difficulty rows have it', () => {
  it('reads the multiplayer rows: grenades alone, 2 s, a draw before it shows', () => {
    expect(panicRow(mp)).toMatchObject({ total: 2, blast: 0.85, grenade: true, weapon: false, pre: [0.12, 0.25] });
    expect(panicRow(coop)).toMatchObject({ total: 5, weapon: true });
  });

  it('begins at an enemy grenade come to ground inside its blast times the row’s share, after the drawn pre-panic', () => {
    const state = {};
    const p = panicStep(state, { at: [0, 0, 0], team: 1, grenades: [frag([3, 0, 0])], now: 10, row: mp, rand: half });
    expect(p.from).toEqual([3, 0, 0]);
    expect(panicking(p, 10.1)).toBe(false);
    expect(panicking(p, 10.2)).toBe(true);
    // (over 2 s after it began)
    panicStep(state, { at: [0, 0, 0], team: 1, grenades: [], now: 12.1, row: mp, rand: half });
    expect(state.panic).toBe(null);
  });

  it('is not begun by a grenade still in the air, a friend’s, or one outside the share of its blast', () => {
    const none = (g) => panicStep({}, { at: [0, 0, 0], team: 1, grenades: [g], now: 1, row: mp, rand: half });
    expect(none(frag([3, 0, 0], 2, false))).toBeFalsy();
    expect(none(frag([3, 0, 0], 1))).toBeFalsy();
    expect(none(frag([5.2, 0, 0]))).toBeFalsy();
  });

  it('comes of suppression held over the row’s level for its time only where the row says so', () => {
    const run = (row) => {
      const state = {};
      for (let t = 0; t <= 2; t += 0.2) panicStep(state, { at: [0, 0, 0], team: 1, suppressed: 0.9, tactics: { value: 0.85, time: 1 }, dt: 0.2, now: t, row, rand: half });
      return state.panic;
    };
    expect(run(mp)).toBeFalsy();
    expect(run(coop)).toBeTruthy();
  });
});
