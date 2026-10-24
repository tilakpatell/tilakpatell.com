import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { WONDERS } from './deep';
import { buildDeepSpace } from './deepspace';

// (its textures are painted on canvases: one that takes every call and draws nothing)
const stub = () => {
  const gradient = { addColorStop() {} };
  const canvas = { width: 0, height: 0, getContext: () => new Proxy({}, { get: (_, k) => (k === 'canvas' ? canvas : () => gradient), set: () => true }) };
  vi.stubGlobal('document', { createElement: () => canvas });
};

// The universe draws round the camera (relative.js): for the draw alone the
// map is moved by minus the camera and the camera put at nought. A world's
// light, read against its shader's world position, has to be where its sun
// is as it's drawn, not where it was when update() ran
describe('deep space, drawn round the camera', () => {
  it('lights its worlds from where their suns are as they are drawn', () => {
    stub();
    const deep = buildDeepSpace({ small: true, tier: 'low' });
    const scene = new THREE.Scene();
    const map = new THREE.Group();
    scene.add(map);
    map.add(deep.group);
    const giant = WONDERS.find((w) => w.kind === 'gas-giant');
    const star = WONDERS.find((w) => w.kind === 'star');
    const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.08, 45000);
    camera.position.set(star.at[0] + 900, star.at[1] + 40, star.at[2] - 300);
    scene.add(camera);
    scene.updateMatrixWorld();
    const cam = camera.position.clone();
    deep.update(10, camera, cam);
    // drawn(): the map moved by minus the camera, the camera at nought
    map.position.copy(cam).negate();
    camera.position.set(0, 0, 0);
    scene.updateMatrixWorld();
    const renderer = { getDrawingBufferSize: (v) => v.set(1280, 720) };
    const litIn = (id) => {
      let m = null;
      deep.groupOf(id).traverse((o) => (m ??= o.material?.uniforms?.uLight ? o : null));
      m.onBeforeRender(renderer, scene, camera);
      return m.material.uniforms.uLight.value.toArray();
    };
    // a giant, lit by the home sun (the map's middle); a sun's planet, by its sun
    const home = cam.clone().negate().toArray();
    litIn(giant.id).forEach((v, i) => expect(v).toBeCloseTo(home[i], 6));
    const sun = [star.at[0] - cam.x, star.at[1] - cam.y, star.at[2] - cam.z];
    litIn(star.id).forEach((v, i) => expect(v).toBeCloseTo(sun[i], 6));
    deep.dispose?.();
    vi.unstubAllGlobals();
  });
});
