import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createPortalFx } from './portalFxCore';

// a disc's material with the uniforms the swallow writes (its look is portalFx.js's)
const portalMat = () => Object.assign(new THREE.MeshBasicMaterial(), { uniforms: { t: { value: 0 }, seed: { value: 0 }, open: { value: 0 }, flash: { value: 0 } } });

// a figure on a landing out in the map, a camera near it, the swallow begun
const landed = () => {
  const scene = new THREE.Scene();
  const map = new THREE.Group();
  scene.add(map);
  const landing = new THREE.Group(); // (footScene's root: the planet's middle, in the map)
  landing.position.set(15000, -40, 200);
  landing.rotation.set(0.2, 0.7, -0.1);
  map.add(landing);
  const root = new THREE.Group();
  root.position.set(3, 300, -2);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.8, 0.3), new THREE.MeshStandardMaterial());
  root.add(body);
  landing.add(root);
  const camera = new THREE.PerspectiveCamera();
  scene.add(camera);
  scene.updateMatrixWorld();
  camera.position.copy(landing.localToWorld(new THREE.Vector3(1, 301.5, 6)));
  const hooks = { render: body.onBeforeRender, shadow: body.onBeforeShadow };
  const fx = createPortalFx({ parent: landing, portalMat });
  const h = fx.swallow({ root, tall: 1.8, up: new THREE.Vector3(0, 1, 0), push: new THREE.Vector3(0, 0, 1), seed: 3 });
  const disc = landing.children.find((o) => o.isMesh && o.geometry.type === 'PlaneGeometry');
  return { scene, map, landing, root, body, camera, fx, h, disc, hooks };
};

// The universe draws round the camera (universe/relative.js): for the draw
// alone the map is moved by minus the camera and the camera put at nought,
// and the renderer reads a cut against the camera as it draws (the colour
// pass and the shadows'), so the cut has to be where the figure is then
describe('createPortalFx, drawn round the camera', () => {
  // the cut as each pass would set it: the colour pass's hooks (the mesh's,
  // then its material's) and the shadows' (the mesh's)
  const passes = ({ scene, camera, body }) => ({
    colour() {
      body.onBeforeRender(null, scene, camera, body.geometry, body.material, null);
      body.material.onBeforeRender(null, scene, camera, body.geometry, body, null);
    },
    shadow() {
      body.onBeforeShadow(null, body, camera, camera, body.geometry, null, null);
    },
  });
  const shifted = ({ map, camera }) => {
    map.position.sub(camera.position);
    camera.position.set(0, 0, 0);
  };
  // the plane through `at`, square to `n`, each a function of the matrices as drawn
  const expectCut = (s, at, n, frame) => {
    for (const [pass, set] of Object.entries(passes(s))) {
      s.scene.updateMatrixWorld(); // (as the renderer does, before any hook)
      set();
      const plane = s.body.material.clippingPlanes[0];
      expect(Math.abs(plane.distanceToPoint(at())), `${frame}, ${pass}`).toBeLessThan(1e-6);
      expect(plane.normal.dot(n()), `${frame}, ${pass}`).toBeCloseTo(1, 9);
    }
  };

  it('cuts at the portal’s plane while it’s open: through the disc, the way it faces', () => {
    const s = landed();
    for (let i = 0; i < 6; i++) s.fx.update(0.05);
    expect(s.h.cut).toBe(false);
    const at = () => s.disc.getWorldPosition(new THREE.Vector3());
    const n = () => new THREE.Vector3(0, 0, 1).transformDirection(s.disc.matrixWorld);
    expectCut(s, at, n, 'drawn as the map is');
    shifted(s);
    expectCut(s, at, n, 'drawn round the camera');
    s.fx.dispose();
  });

  it('cuts at the body’s own plane once it’s shut, wherever it falls', () => {
    const s = landed();
    // (the portal's plane in the body, as the body was when it shut)
    let local = null;
    for (let i = 0; i < 40 && !local; i++) {
      s.fx.update(0.05);
      if (s.h.cut) {
        s.scene.updateMatrixWorld();
        const inv = s.root.matrixWorld.clone().invert();
        local = { at: s.disc.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv), n: new THREE.Vector3(0, 0, 1).transformDirection(s.disc.matrixWorld).transformDirection(inv) };
      }
    }
    expect(local).toBeTruthy();
    for (let i = 0; i < 4; i++) s.fx.update(0.05);
    const at = () => s.root.localToWorld(local.at.clone());
    const n = () => local.n.clone().transformDirection(s.root.matrixWorld);
    expectCut(s, at, n, 'drawn as the map is');
    shifted(s);
    expectCut(s, at, n, 'drawn round the camera');
    s.fx.dispose();
  });

  it('gives the figure its own hooks back once it’s done', () => {
    const s = landed();
    s.fx.update(0.05);
    s.h.dispose();
    expect(s.body.onBeforeRender).toBe(s.hooks.render);
    expect(s.body.onBeforeShadow).toBe(s.hooks.shadow);
    s.fx.dispose();
  });
});
