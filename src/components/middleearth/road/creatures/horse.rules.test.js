import { describe, expect, it } from 'vitest';
import { GAITS, gaitFor } from './horse.rules';

describe('the horse’s gait', () => {
  it('stands, walks slowly, walks and runs at 0.1, 1.2 and 3 m/s', () => {
    expect(gaitFor(0)).toBe('Idle');
    expect(gaitFor(0.09)).toBe('Idle');
    expect(gaitFor(0.1)).toBe('WalkSlow');
    expect(gaitFor(1.19)).toBe('WalkSlow');
    expect(gaitFor(1.2)).toBe('Walk');
    expect(gaitFor(2.99)).toBe('Walk');
    expect(gaitFor(3)).toBe('Run');
    expect(gaitFor(-2)).toBe('Walk');
  });

  it('each gait’s own pace sits within its band', () => {
    expect(gaitFor(GAITS.WalkSlow)).toBe('WalkSlow');
    expect(gaitFor(GAITS.Walk)).toBe('Walk');
    expect(gaitFor(GAITS.Run)).toBe('Run');
  });
});
