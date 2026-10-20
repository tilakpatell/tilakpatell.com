import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROPS } from './generic';

const kit = { own: (x) => x };

describe('a starfighter come down', () => {
  // (the ships' lights and panels are drawn on canvases; there isn't one here, so a canvas that takes any drawing)
  beforeEach(() => {
    const ctx = new Proxy(function draw() {}, { get: (_, k) => (k === 'canvas' ? null : ctx), set: () => true, apply: () => ctx });
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
  });
  afterEach(() => vi.unstubAllGlobals());
  for (const [ship, metres] of [
    ['xwing', 12.5],
    ['ywing', 23.4],
    ['tie', 6.3],
  ])
    it(`${ship}: the flight's own model at its length, dug in on a wing, solid over its body`, () => {
      const made = PROPS.downed(kit, { ship, metres, roll: 0.45 });
      const size = new THREE.Box3().setFromObject(made.object).getSize(new THREE.Vector3());
      expect(Math.max(size.x, size.z)).toBeGreaterThan(metres * 0.6);
      // (a TIE's panels stand taller than it's long: rolled, they reach out further)
      expect(Math.max(size.x, size.z)).toBeLessThan(metres * 1.6);
      // (its lowest point a twentieth of its length into the ground it stands on)
      made.object.updateMatrixWorld(true);
      expect(new THREE.Box3().setFromObject(made.object).min.y).toBeCloseTo(-metres * 0.05, 4);
      expect(made.solids[0].box[2]).toBeCloseTo(metres * 0.36, 6);
    });
});
