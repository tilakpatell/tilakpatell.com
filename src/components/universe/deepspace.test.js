import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

// (deep space paints some of its maps on canvases: one that takes every call and draws nothing)
const stub = () => {
  const gradient = { addColorStop() {}, width: 10 };
  const canvas = { width: 0, height: 0, getContext: () => new Proxy({}, { get: (_, k) => (k === 'canvas' ? canvas : () => gradient), set: () => true }) };
  vi.stubGlobal('document', { createElement: () => canvas });
};

describe('deep space’s lights', () => {
  it('are where their stars are as each thing they light is drawn, the map moved round the camera (relative.js)', async () => {
    stub();
    const { buildDeepSpace } = await import('./deepspace');
    const { WONDERS } = await import('./deep');
    const scene = new THREE.Scene();
    const map = new THREE.Group();
    scene.add(map);
    const deep = buildDeepSpace({ small: true, tier: 'low' });
    map.add(deep.group);
    const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 45000);
    scene.updateMatrixWorld();
    deep.update(1, camera, new THREE.Vector3());
    // the map moved for the draw alone, as the universe draws (the camera at nought)
    const C = [21000, 300, -16000];
    map.position.set(-C[0], -C[1], -C[2]);
    scene.updateMatrixWorld();
    const wonderOf = (o) => {
      for (let p = o; p; p = p.parent) if (p.userData.wonder) return WONDERS.find((w) => w.id === p.userData.wonder);
      return null;
    };
    const at = (p) => new THREE.Vector3(p[0] - C[0], p[1] - C[1], p[2] - C[2]);
    const lit = { home: 0, star: 0 };
    deep.group.traverse((o) => {
      const light = o.material?.uniforms?.uLight;
      if (!light) return;
      light.value.set(1e9, 1e9, 1e9); // (so what's read is what the draw set)
      o.onBeforeRender(null, scene, camera);
      const w = wonderOf(o);
      if (light.value.distanceTo(at([0, 0, 0])) < 1e-6) lit.home++;
      else {
        expect(light.value.distanceTo(at(w.at)), `${o.name || w.id}`).toBeLessThan(1e-6);
        lit.star++;
      }
    });
    expect(lit.home).toBeGreaterThan(0);
    expect(lit.star).toBeGreaterThan(0);
    deep.dispose();
    vi.unstubAllGlobals();
  }, 30000); // (its maps are worked out on the processor: slow on a busy machine)
});
