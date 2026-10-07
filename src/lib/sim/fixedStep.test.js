import { describe, expect, it } from 'vitest';
import { createFixedStep } from './fixedStep';

describe('createFixedStep', () => {
  it('step runs the fixed step as many times as the time holds', () => {
    const clock = createFixedStep({ hz: 10 });
    const dts = [];
    expect(clock.step(0.25, (dt) => dts.push(dt))).toBe(2);
    expect(dts).toEqual([0.1, 0.1]);
    expect(clock.alpha()).toBeCloseTo(0.5, 9);
  });

  it('carries the remainder into the next frame', () => {
    const clock = createFixedStep({ hz: 10 });
    let n = 0;
    for (let i = 0; i < 3; i++) n += clock.step(0.1, () => {});
    expect(n).toBe(3);
    expect(clock.step(0.05, () => {})).toBe(0);
    expect(clock.step(0.05, () => {})).toBe(1);
  });

  it('a long frame runs at most max steps and drops the rest', () => {
    const clock = createFixedStep({ hz: 10 });
    let calls = 0;
    expect(clock.step(10, () => calls++)).toBe(4);
    expect(calls).toBe(4);
    expect(clock.step(0, () => calls++)).toBe(0);
    expect(calls).toBe(4);
    expect(clock.alpha()).toBeLessThan(1);
  });

  it('reset empties the accumulator', () => {
    const clock = createFixedStep({ hz: 10 });
    clock.step(0.08, () => {});
    expect(clock.alpha()).toBeGreaterThan(0);
    clock.reset();
    expect(clock.alpha()).toBe(0);
    expect(clock.step(0.05, () => {})).toBe(0);
  });

  it('ignores a negative or missing dt', () => {
    const clock = createFixedStep();
    expect(clock.step(-1, () => {})).toBe(0);
    expect(clock.step(undefined, () => {})).toBe(0);
    expect(clock.alpha()).toBe(0);
  });
});
