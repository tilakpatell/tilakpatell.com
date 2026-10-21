import { describe, expect, it } from 'vitest';
import { createFlocks } from './flocks';

const flock = (at, more = {}) => ({ at, count: 4, size: 0.5, colour: '#2a2622', height: 30, radius: 40, speed: 9, seed: 3, ...more });

describe('createFlocks', () => {
  it('rings each flock over the ground where it is, two draws a flock', () => {
    const f = createFlocks([flock([10, 20]), flock([-50, 0], { height: 70 })], { heightAt: (x) => (x < 0 ? 12 : 2) });
    expect(f.group.children).toHaveLength(2);
    expect(f.group.children[0].position.toArray()).toEqual([10, 32, 20]);
    expect(f.group.children[1].position.toArray()).toEqual([-50, 82, 0]);
    expect(f.group.children.every((g) => g.children.length === 2 && g.children[0].count === 4)).toBe(true);
    f.dispose();
  });

  it('is nothing with no flocks, and holds still under reduced motion', () => {
    expect(createFlocks([], { heightAt: () => 0 })).toBeNull();
    const still = createFlocks([flock([0, 0])], { heightAt: () => 0, reduced: true });
    const before = Array.from(still.group.children[0].children[0].instanceMatrix.array);
    still.update(1);
    expect(Array.from(still.group.children[0].children[0].instanceMatrix.array)).toEqual(before);
    still.dispose();
  });
});
