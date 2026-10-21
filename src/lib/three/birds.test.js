import { describe, expect, it } from 'vitest';
import { createBirds, flight } from './birds';

const bird = { phase: 1, radius: 40, squash: 0.8, height: 30, speed: 9, rate: 11, size: 0.5 };

describe('birds', () => {
  it('a bird flies a loop round the middle, near its height, and comes round again', () => {
    for (let t = 0; t < 60; t += 0.7) {
      const f = flight(bird, t);
      expect(Math.hypot(f.x, f.z)).toBeLessThan(40 * 1.2);
      expect(Math.abs(f.y - 30)).toBeLessThanOrEqual(30 * 0.12 + 1e-9);
    }
    const lap = (2 * Math.PI * 40) / 9;
    expect(Math.atan2(flight(bird, 3 + lap).z, flight(bird, 3 + lap).x)).toBeCloseTo(Math.atan2(flight(bird, 3).z, flight(bird, 3).x), 5);
  });

  it('a flock is two draws of wings at its middle, named, the same for the same seed', () => {
    const a = createBirds({ at: [10, 40, -5], count: 5, seed: 4, name: 'galaxy:birds' });
    const b = createBirds({ at: [10, 40, -5], count: 5, seed: 4 });
    expect(a.mesh.name).toBe('galaxy:birds');
    expect(b.mesh.name).toBe('birds');
    expect(a.mesh.position.toArray()).toEqual([10, 40, -5]);
    expect(a.mesh.children.map((m) => m.count)).toEqual([5, 5]);
    expect(Array.from(a.mesh.children[0].instanceMatrix.array)).toEqual(Array.from(b.mesh.children[0].instanceMatrix.array));
    a.update(0.5);
    expect(Array.from(a.mesh.children[0].instanceMatrix.array)).not.toEqual(Array.from(b.mesh.children[0].instanceMatrix.array));
    a.dispose();
    b.dispose();
  });
});
