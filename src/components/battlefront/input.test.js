import { describe, expect, it } from 'vitest';
import { createInput, ROLL_TAP } from './input.js';

// a window that only collects listeners, and a clock the test moves
function harness() {
  const on = {};
  const win = { addEventListener: (t, f) => ((on[t] ??= []).push(f)), removeEventListener: (t, f) => (on[t] = (on[t] ?? []).filter((g) => g !== f)) };
  let t = 0;
  const input = createInput({ win, now: () => t });
  input.attach();
  const key = (code, down) => on[down ? 'keydown' : 'keyup']?.forEach((f) => f({ code, preventDefault() {}, repeat: false }));
  return { input, key, at: (s) => (t = s), on };
}

describe('the player’s hands', () => {
  it('walks forward on W and strafes on D', () => {
    const { input, key } = harness();
    key('KeyW', true);
    expect(input.read().move).toEqual([0, 1]);
    key('KeyD', true);
    const m = input.read().move;
    expect(m[0]).toBeCloseTo(Math.SQRT1_2, 6);
    expect(m[1]).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it('rolls on Space tapped twice inside the window, and jumps on one', () => {
    const { input, key, at } = harness();
    at(1);
    key('Space', true);
    key('Space', false);
    expect(input.read()).toMatchObject({ jump: true, roll: false });
    at(1 + ROLL_TAP - 0.05);
    key('Space', true);
    expect(input.read().roll).toBe(true);
    // (a press is read once)
    expect(input.read().roll).toBe(false);
    at(5);
    key('Space', false);
    key('Space', true);
    expect(input.read()).toMatchObject({ roll: false, jump: true });
  });

  it('maps the abilities, the vent, the scoreboard and the deploy', () => {
    const { input, key } = harness();
    key('Digit2', true);
    key('KeyR', true);
    key('Tab', true);
    key('Enter', true);
    expect(input.read()).toMatchObject({ ability: 2, vent: true, scoreboard: true, deploy: true });
    key('Tab', false);
    expect(input.read().scoreboard).toBe(false);
  });

  it('lets nothing through while swallowed (the deploy screen) but the deploy itself', () => {
    const { input, key } = harness();
    input.swallow(true);
    key('KeyW', true);
    key('Enter', true);
    expect(input.read()).toMatchObject({ move: [0, 0], deploy: true });
  });

  it('lets go of every listener on detach', () => {
    const { input, on } = harness();
    input.detach();
    expect(Object.values(on).every((l) => l.length === 0)).toBe(true);
  });
});

describe('the review’s findings on the hands', () => {
  it('leaves Tab to the page while the deploy screen or the HUD has the keys (no keyboard trap)', () => {
    const on = {};
    const win = { addEventListener: (t, f) => ((on[t] ??= []).push(f)), removeEventListener() {} };
    const input = createInput({ win, now: () => 0 });
    input.attach();
    let prevented = 0;
    const tab = (target) => on.keydown.forEach((f) => f({ code: 'Tab', target, repeat: false, preventDefault: () => prevented++ }));
    input.swallow(true);
    tab({ tagName: 'BUTTON' });
    expect(prevented).toBe(0);
    input.swallow(false);
    tab({ tagName: 'BUTTON' });
    expect(prevented).toBe(0);
    tab({ tagName: 'CANVAS' });
    expect(prevented).toBe(1);
  });

  it('holds the look’s pitch to the camera’s own limit, so nothing turns that the camera does not', () => {
    const input = createInput({ win: null, maxPitch: (55 * Math.PI) / 180 });
    input.turn(0, -10);
    expect(input.look().pitch).toBeCloseTo((55 * Math.PI) / 180, 9);
  });
});
