import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from './groundwork';
import { groundWorld, shouldRebake } from './groundworkNodes';

// a node renderer that can't read pictures back (the bake gives up at once)
const stubRenderer = () => ({
  shadowMap: { enabled: true, type: THREE.PCFShadowMap, autoUpdate: true },
  autoClear: true,
  getRenderTarget: () => null,
  setRenderTarget() {},
  getClearColor: (c) => c.set(0, 0, 0),
  getClearAlpha: () => 1,
  setClearColor() {},
  clear() {},
  render() {},
});

function world() {
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(10, 20, 5);
  scene.add(sun, new THREE.HemisphereLight(0xbbccff, 0x806040, 1));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial());
  const house = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshStandardMaterial({ color: 0x806040 }));
  house.position.set(0, 2, 0);
  const walker = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.5), new THREE.MeshStandardMaterial());
  walker.position.set(5, 0.9, 5);
  scene.add(floor, house, walker);
  return { scene, sun, floor, house, walker };
}

describe('groundworkNodes, the twin of groundwork', () => {
  it('the same rule for baking again', () => {
    const a = new THREE.Vector3(0, 1, 0);
    const b = new THREE.Vector3(0.3, 1, 0).normalize();
    expect(shouldRebake(a, b)).toBe(glsl.shouldRebake(a, b));
  });

  it('puts a world on node materials, then the floor, the statics and the movers on their hooks', () => {
    const w = world();
    const g = groundWorld({ renderer: stubRenderer(), scene: w.scene, floor: [w.floor], area: { x0: -20, z0: -20, w: 40, d: 40 }, sun: w.sun, movers: [{ object: w.walker, size: [0.8, 0.8] }] });
    for (const o of [w.floor, w.house, w.walker]) expect(o.material.isNodeMaterial).toBe(true);
    expect(w.floor.material.userData.floorShadow).toBeTruthy();
    expect(w.house.material.userData.bounce).toBeTruthy();
    expect(w.walker.material.userData.standIn).toBeTruthy();
    expect(g.blobs.mesh.material.isNodeMaterial).toBe(true);
    g.dispose();
  });
});
