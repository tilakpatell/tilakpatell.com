import { describe, expect, it } from 'vitest';
import { LIFT, stepOf } from './online';

describe('where Mario is, to the others online', () => {
  it('sends metres, not the game’s units, his yaw as his face, his speed, and the area he is in', () => {
    const [h, flags] = stepOf({ pos: { x: 1200, y: 300, z: -450 }, yaw: 1.1, fwd: 20 }, 'grounds');
    expect(h.x).toBeCloseTo(12, 6);
    expect(h.z).toBeCloseTo(-4.5, 6);
    expect(h.face).toBeCloseTo(1.1, 6);
    expect(h.speed).toBeCloseTo(6, 6);
    expect(flags).toEqual({ area: 'grounds' });
  });

  it('lifts his height so the moat, under the ground, is above the link’s naught', () => {
    const [h] = stepOf({ pos: { x: 0, y: -420, z: 0 }, yaw: 0, fwd: 0 }, 'grounds');
    expect(h.y).toBeCloseTo(-4.2 + LIFT, 6);
    expect(h.y).toBeGreaterThanOrEqual(0);
  });

  it('wraps a yaw turned round and round, and a backward slide is still a speed', () => {
    const [h] = stepOf({ pos: { x: 0, y: 0, z: 0 }, yaw: 7, fwd: -10 }, 'bobomb');
    expect(Math.abs(h.face)).toBeLessThanOrEqual(Math.PI);
    expect(h.speed).toBeCloseTo(3, 6);
  });
});
