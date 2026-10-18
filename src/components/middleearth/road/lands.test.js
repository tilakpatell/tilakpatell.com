import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createLands } from './lands';
import { STAGES } from './stages/index';

describe('the lands under the ride', () => {
  it('builds the stage you are in at once, its neighbours a slice a frame, and places them along +z', () => {
    const scene = new THREE.Scene();
    const lands = createLands({ scene, tier: 'low', budget: 1e6, wide: 256 });
    lands.at(1);
    expect(lands.ready(1)).toBe(true);
    expect(lands.ready(2)).toBe(false);
    lands.step();
    expect(lands.ready(0) && lands.ready(2)).toBe(true);
    const groups = Object.fromEntries(scene.children.map((g) => [g.name, g.position.z]));
    expect(groups['road:shire-edge']).toBe(0);
    expect(groups['road:bree']).toBeCloseTo(STAGES[1].length, 6);
    expect(groups['road:hobbiton']).toBeCloseTo(-STAGES[0].length, 6);
    // (the seam: the ground either side of it the same)
    const end = STAGES[1].length;
    expect(lands.heightAt(20, end + 1e-6)).toBeCloseTo(lands.heightAt(20, end - 1e-6), 3);
    lands.dispose();
    expect(scene.children.length).toBe(0);
  });

  it('drops a stage two behind, and re-places the rest round the new one', () => {
    const scene = new THREE.Scene();
    const lands = createLands({ scene, tier: 'low', budget: 1e6, wide: 256 });
    lands.at(0);
    lands.step();
    lands.at(1);
    lands.step();
    lands.at(2);
    expect(lands.ready(0)).toBe(false);
    expect(lands.ready(1) && lands.ready(2)).toBe(true);
    expect(scene.getObjectByName('road:bree').position.z).toBe(0);
    expect(scene.getObjectByName('road:shire-edge').position.z).toBeCloseTo(-STAGES[1].length, 6);
    lands.dispose();
  });
});
