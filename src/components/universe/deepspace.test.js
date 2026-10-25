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

// The Veil and the Cradle are places, drawn by the one nebula renderer
// (nebula/) fixed in the world, not puffs facing the camera
describe('deep space’s nebulae', () => {
  const at = (id) => WONDERS.find((w) => w.id === id);
  const camAt = (p, look) => {
    const c = new THREE.PerspectiveCamera(34, 16 / 9, 0.08, 45000);
    c.position.set(...p);
    c.lookAt(...look);
    c.updateMatrixWorld(true);
    return c;
  };

  it('hands both to one renderer under its group, and keeps each one’s place', () => {
    stub();
    const deep = buildDeepSpace({ small: true, tier: 'low' });
    expect(deep.nebulae.group.parent).toBe(deep.group);
    for (const id of ['veil', 'cradle']) {
      const g = deep.groupOf(id);
      expect(g.position.toArray()).toEqual(at(id).at);
      expect(g.children).toHaveLength(0); // (its name and the far stars read it; nothing is drawn in it)
    }
    expect(deep.group.getObjectByName('deep-young-stars')).toBeUndefined();
    // the Cradle fills to its middle: the eye there is inside it
    expect(deep.nebulae.inside(at('cradle').at)?.id).toBe('cradle');
    deep.dispose();
    vi.unstubAllGlobals();
  });

  it('draws the Veil where it is from a camera looking at it, each frame’s update', () => {
    stub();
    const deep = buildDeepSpace({ small: true, tier: 'low' });
    const veil = at('veil');
    const eye = [veil.at[0], veil.at[1], veil.at[2] + veil.r * 6];
    const camera = camAt(eye, veil.at);
    deep.update(10, camera, new THREE.Vector3(...eye));
    const clouds = deep.group.getObjectByName('nebula-clouds');
    expect(clouds.visible).toBe(true);
    const a = clouds.geometry.attributes.aCentre;
    const n = clouds.geometry.instanceCount;
    // (drawn far to near: the Veil is the nearest cloud)
    const near = (j) => Math.hypot(a.array[j * 3], a.array[j * 3 + 1], a.array[j * 3 + 2]);
    const cloudsDrawn = Array.from({ length: n }, (_, j) => j).filter((j) => clouds.geometry.attributes.aKind.array[j] === 0);
    const i = cloudsDrawn.reduce((best, j) => (near(j) < near(best) ? j : best));
    expect(near(i)).toBeCloseTo(veil.r * 6, 0);
    [0, 1, 2].forEach((k) => expect(eye[k] + a.array[i * 3 + k]).toBeCloseTo(veil.at[k], 0));
    deep.dispose();
    expect(deep.nebulae.group.parent).toBeNull();
    vi.unstubAllGlobals();
  });
});
