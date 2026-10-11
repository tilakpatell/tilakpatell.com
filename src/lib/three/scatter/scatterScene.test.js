import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DENSITY_CAP } from './grid.js';
import { createScatterScene } from './scatterScene.js';

const mask = (() => {
  const w = 64;
  const h = 64;
  const data = new Uint16Array(w * h).fill(5);
  return { data, w, h, minX: -64, minZ: -64, metresPerPixel: 2 };
})();
const type = (mesh, density, look = { look: 'colour', rgb: [0.2, 0.2, 0.2] }) => ({
  mesh,
  density: { low: density, mid: density, high: density, ultra: density },
  scale: { min: [1, 1], max: [1, 1] },
  randomness: 1,
  wind: { scale: 0.2, stiffness: 8, damping: 0.7, mass: 1, wiggle: 0.3 },
  dissolve: { range: 0.4, lod0Out: 0 },
  glb: { ...look, radius: 0.5, lods: look.look === 'waits' ? [] : [{ glb: `scatter/${mesh}.lod0.glb` }, { glb: `scatter/${mesh}.lod1.glb` }] },
});
// (an unplaced layer first: the type indices are the placed layers' own)
const json = {
  format: 1,
  layers: [
    { index: 7, placed: false, types: [type('tree', 1)] },
    { index: 4, placed: true, types: [type('stone', 0.5), type('fern', 2, { look: 'waits' })] },
  ],
};
const load = async () => {
  const s = new THREE.Group();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
  return { scene: s };
};

describe('createScatterScene', () => {
  it('draws the placed layers’ types round the visitor, on the ground, not the waiting ones', async () => {
    const scene = new THREE.Scene();
    const s = createScatterScene({ scene, json, mask, load, tier: 'high', groundAt: () => 3, wind: { time: { value: 0 }, dir: new THREE.Vector2(1, 0) } });
    await s.ready();
    s.update([0, 0]);
    const st = s.stats();
    expect(st.types).toBe(1);
    expect(st.instances).toBeGreaterThan(100);
    // (one mesh, its two cuts)
    expect(st.calls).toBeLessThanOrEqual(2);
    const meshes = scene.getObjectByName('scatter').children;
    const m = new THREE.Matrix4();
    meshes[0].getMatrixAt(0, m);
    const p = new THREE.Vector3().setFromMatrixPosition(m);
    expect(p.y).toBeLessThanOrEqual(3);
    expect(p.y).toBeGreaterThan(2.5);
    // (only the near cut casts)
    expect(meshes.filter((x) => x.castShadow).length).toBe(1);
    s.dispose();
    expect(scene.getObjectByName('scatter')).toBeUndefined();
  });
  it('refills only after the visitor has walked a few metres, and holds the tier’s cap', async () => {
    const scene = new THREE.Scene();
    const dense = { format: 1, layers: [{ index: 4, placed: true, types: [type('clover', 50)] }] };
    const s = createScatterScene({ scene, json: dense, mask, load, tier: 'low' });
    await s.ready();
    s.update([0, 0]);
    const first = s.stats();
    expect(first.instances).toBeLessThanOrEqual(DENSITY_CAP.low * 1.1);
    expect(first.keep).toBeLessThan(1);
    s.update([1, 0]);
    expect(s.stats()).toBe(first);
    s.update([10, 0]);
    expect(s.stats()).not.toBe(first);
    s.dispose();
  });
});
