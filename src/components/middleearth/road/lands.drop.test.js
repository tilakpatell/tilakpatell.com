import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

// (each ground counted as it is made and as it is let go)
const count = { made: 0, gone: 0 };
vi.mock('./ground', async (load) => {
  const real = await load();
  return {
    ...real,
    *groundJob(...args) {
      const g = yield* real.groundJob(...args);
      count.made += 1;
      const own = g.dispose;
      g.dispose = () => {
        count.gone += 1;
        own();
      };
      return g;
    },
  };
});
const { createLands } = await import('./lands');

describe('a stage let go part built', () => {
  it('lets go of the ground it had made, with the rest', () => {
    // (a clock that ticks a millisecond each time it is read: with a budget of
    // 2.5, each step takes one slice of a job, so the test stops where it means to)
    let t = 0;
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => t++);
    const scene = new THREE.Scene();
    const lands = createLands({ scene, tier: 'low', budget: 2.5, wide: 256 });
    lands.at(0);
    // (a slice at a time until the stage ahead has its ground but is not done)
    for (let i = 0; i < 100000 && count.made < 2; i++) lands.step();
    expect(count.made).toBe(2);
    expect(lands.ready(1)).toBe(false);
    lands.dispose();
    expect(count.gone).toBe(count.made);
    clock.mockRestore();
  });
});
