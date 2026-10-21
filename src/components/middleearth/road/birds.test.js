import { describe, expect, it } from 'vitest';
import { createBirds, flight } from './birds';
import { LIFE, lifeOf } from './stages/life';
import { STAGES } from './stages/index';

const bird = { phase: 1, radius: 40, squash: 0.8, height: 30, speed: 9, rate: 11, size: 0.5 };

describe('birds over a stage', () => {
  it('a bird flies a loop round the middle, near its height, and comes round again', () => {
    for (let t = 0; t < 60; t += 0.7) {
      const f = flight(bird, t);
      expect(Math.hypot(f.x, f.z)).toBeLessThan(40 * 1.2);
      expect(Math.abs(f.y - 30)).toBeLessThanOrEqual(30 * 0.12 + 1e-9);
      expect(Math.abs(f.flap)).toBeLessThanOrEqual(0.75);
    }
    const lap = (2 * Math.PI * 40) / 9;
    const a = flight(bird, 3);
    const b = flight(bird, 3 + lap);
    expect(Math.atan2(b.z, b.x)).toBeCloseTo(Math.atan2(a.z, a.x), 5);
  });

  it('a flock is two draws of wings, a pair a bird, moving as time goes', () => {
    const flock = createBirds({ count: 6, seed: 2 });
    const [left, right] = flock.mesh.children;
    expect(left.count).toBe(6);
    expect(right.count).toBe(6);
    const before = left.instanceMatrix.array.slice(0, 16);
    flock.update(0.5);
    expect(Array.from(left.instanceMatrix.array.slice(0, 16))).not.toEqual(Array.from(before));
    flock.dispose();
  });

  it('the stages’ flocks: known stages, sensible numbers', () => {
    for (const id of Object.keys(LIFE)) expect(STAGES.map((s) => s.id)).toContain(id);
    expect(lifeOf('nowhere').birds).toEqual([]);
    for (const [id, life] of Object.entries(LIFE))
      for (const f of life.birds ?? []) {
        expect(f.count, id).toBeGreaterThan(0);
        expect(f.count, id).toBeLessThanOrEqual(80);
        expect(f.at[1], id).toBeGreaterThan(5);
      }
  });
});
