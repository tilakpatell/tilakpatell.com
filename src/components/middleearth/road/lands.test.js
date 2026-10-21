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

  it('never draws a stage the Road cuts to beside the one before it, and gives its trees back meanwhile', () => {
    const scene = new THREE.Scene();
    const sets = new Map();
    const scatter = { set: (id, items) => sets.set(id, items), free: (id) => sets.delete(id) };
    const lands = createLands({ scene, tier: 'low', budget: 1e6, wide: 256, scatter });
    const gor = STAGES.findIndex((s) => s.id === 'gorgoroth');
    expect(STAGES[gor + 1]).toMatchObject({ id: 'minas-tirith', cut: true });
    lands.at(gor);
    lands.step();
    expect(lands.ready(gor + 1)).toBe(true);
    expect(scene.getObjectByName('road:minas-tirith').visible).toBe(false);
    expect(scene.getObjectByName('road:cirith-ungol').visible).toBe(true);
    expect(sets.has('minas-tirith')).toBe(false);
    // (over the cut: the White City's drawn, Mordor's not)
    lands.at(gor + 1);
    lands.step();
    expect(scene.getObjectByName('road:minas-tirith').visible).toBe(true);
    expect(scene.getObjectByName('road:gorgoroth').visible).toBe(false);
    expect(sets.has('minas-tirith')).toBe(true);
    expect(sets.has('gorgoroth')).toBe(false);
    lands.dispose();
  });
});
