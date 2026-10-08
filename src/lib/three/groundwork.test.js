import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { groundWorld, shouldRebake } from './groundwork';

// a renderer that can't draw into float pictures (the bake gives up at once),
// or one that can but draws nothing (the bake runs its chunks)
const stubRenderer = (floats = false) => ({
  shadowMap: { enabled: true, type: THREE.PCFShadowMap, autoUpdate: true },
  autoClear: true,
  extensions: { has: () => floats },
  getRenderTarget: () => null,
  setRenderTarget() {},
  getClearColor: (c) => c.set(0, 0, 0),
  getClearAlpha: () => 1,
  setClearColor() {},
  clear() {},
  render() {},
  getContext: () => ({ finish() {} }),
});

function world() {
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(10, 20, 5);
  sun.castShadow = true;
  const hemi = new THREE.HemisphereLight(0xbbccff, 0x806040, 1);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial());
  floor.receiveShadow = true;
  const wood = new THREE.MeshStandardMaterial({ color: 0x806040 });
  const house = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), wood);
  house.castShadow = true;
  const walker = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.6), new THREE.MeshStandardMaterial());
  walker.position.set(3, 1, 4);
  walker.castShadow = true;
  const cart = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 2), wood);
  cart.position.set(-5, 0.5, 0);
  scene.add(sun, sun.target, hemi, floor, house, walker, cart);
  return { scene, sun, hemi, floor, house, walker, cart, wood };
}

const area = { x0: -20, z0: -20, w: 40, d: 40 };

describe('a world put on baked floor light', () => {
  it('ends the shadow pass and every cast and received shadow', () => {
    const w = world();
    const renderer = stubRenderer(true);
    groundWorld({ renderer, scene: w.scene, floor: [w.floor], area, sun: w.sun, movers: [{ object: w.walker, size: [0.8, 0.8] }] });
    expect(renderer.shadowMap.enabled).toBe(false);
    w.scene.traverse((o) => {
      if (o.isMesh) {
        expect(o.castShadow).toBe(false);
        expect(o.receiveShadow).toBe(false);
      }
      if (o.isLight) expect(o.castShadow ?? false).toBe(false);
    });
  });

  it('shades the floor, bounces the statics, and stands the movers in the shade', () => {
    const w = world();
    groundWorld({ renderer: stubRenderer(), scene: w.scene, floor: [w.floor], area, sun: w.sun, movers: [{ object: w.walker, size: [0.8, 0.8] }, { object: w.cart, size: [1.2, 2.2] }] });
    expect(w.floor.material.userData.floorShadow).toBeTruthy();
    expect(w.wood.userData.bounce).toBeTruthy();
    expect(w.walker.material.userData.standIn).toBeTruthy();
    expect(w.walker.material.userData.bounce).toBeTruthy();
    // (the cart's wood is the house's too: a wall would read its own footprint)
    expect(w.wood.userData.standIn).toBeUndefined();
  });

  it('takes the bounce colour from the sky light\'s ground colour unless given one', () => {
    const w = world();
    groundWorld({ renderer: stubRenderer(), scene: w.scene, floor: [w.floor], area, sun: w.sun });
    expect(w.wood.userData.bounce.uBounceColor.value.getHex()).toBe(w.hemi.groundColor.getHex());
  });

  it('puts a blob under each mover, where it stands', () => {
    const w = world();
    const g = groundWorld({ renderer: stubRenderer(), scene: w.scene, floor: [w.floor], area, sun: w.sun, movers: [{ object: w.walker, size: [0.8, 0.8] }] });
    w.scene.updateMatrixWorld(true);
    g.update();
    expect(g.blobs.mesh.count).toBe(1);
    expect(g.blobs.mesh.parent).toBe(w.scene);
    w.walker.visible = false;
    g.update();
    expect(g.blobs.mesh.count).toBe(0);
  });

  it('stands as it was where the bake can\'t be had', async () => {
    const w = world();
    const g = groundWorld({ renderer: stubRenderer(false), scene: w.scene, floor: [w.floor], area, sun: w.sun });
    const before = w.floor.material.userData.floorShadow.uMask.value[0];
    expect(await g.bake()).toBe(false);
    expect(w.floor.material.userData.floorShadow.uMask.value[0]).toBe(before);
  });

  it('stops a bake left mid-way, and frees what it put in the scene', async () => {
    const w = world();
    const g = groundWorld({ renderer: stubRenderer(true), scene: w.scene, floor: [w.floor], area, sun: w.sun, movers: [{ object: w.walker, size: [0.8, 0.8] }] });
    const before = w.floor.material.userData.floorShadow.uMask.value[0];
    const done = g.bake();
    g.dispose();
    expect(await done).toBe(false);
    expect(w.floor.material.userData.floorShadow.uMask.value[0]).toBe(before);
    expect(g.blobs.mesh.parent).toBeNull();
    expect(w.walker.visible).toBe(true);
  });
});

describe('a bake whose caller has left', () => {
  it("stops at its next chunk, and leaves the first frame to bake it afresh", async () => {
    const w = world();
    const g = groundWorld({ renderer: stubRenderer(true), scene: w.scene, floor: [w.floor], area, sun: w.sun, auto: true, movers: [{ object: w.walker, size: [0.8, 0.8] }] });
    const before = w.floor.material.userData.floorShadow.uMask.value[0];
    let going = true;
    const done = g.bake({ alive: () => going });
    going = false;
    expect(await done).toBe(false);
    expect(w.floor.material.userData.floorShadow.uMask.value[0]).toBe(before);
    expect(g.stats.started).toBe(false);
    expect(w.walker.visible).toBe(true);
  });
});

describe('a sun that moves', () => {
  it('is baked again once it has turned far enough from where it was baked', () => {
    const at = new THREE.Vector3(0.3, 0.8, 0.2).normalize();
    expect(shouldRebake(at, at.clone())).toBe(false);
    const near = at.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.1);
    expect(shouldRebake(at, near)).toBe(false);
    const far = at.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.5);
    expect(shouldRebake(at, far)).toBe(true);
    expect(shouldRebake(null, far)).toBe(false);
  });

  it('bakes on the first frame by itself, once the world has placed its sun', async () => {
    const w = world();
    const g = groundWorld({ renderer: stubRenderer(false), scene: w.scene, floor: [w.floor], area, sun: w.sun, auto: true });
    expect(g.stats.started).toBe(false);
    g.update();
    expect(g.stats.started).toBe(true);
    g.dispose();
  });
});

describe('a floor put away (a zone not yet visited, the world while you\'re indoors)', () => {
  it('waits to bake until its floor is shown', () => {
    const w = world();
    const zone = new THREE.Group();
    w.scene.add(zone);
    zone.add(w.floor);
    zone.visible = false;
    const g = groundWorld({ renderer: stubRenderer(false), scene: w.scene, floor: [w.floor], area, sun: w.sun, auto: true });
    g.update();
    expect(g.stats.started).toBe(false);
    zone.visible = true;
    g.update();
    expect(g.stats.started).toBe(true);
    g.dispose();
  });
});

describe('a mover somewhere else (an interior far below the floor)', () => {
  it('has no blob on the floor overhead', () => {
    const w = world();
    const g = groundWorld({ renderer: stubRenderer(), scene: w.scene, floor: [w.floor], area, sun: w.sun, movers: [{ object: w.walker, size: [0.8, 0.8] }] });
    w.walker.position.set(0, -900, 0);
    w.scene.updateMatrixWorld(true);
    g.update();
    expect(g.blobs.mesh.count).toBe(0);
  });

  it('is only shaded by the mask within reach of the floor\'s heights', () => {
    const w = world();
    groundWorld({ renderer: stubRenderer(), scene: w.scene, floor: [w.floor], area, sun: w.sun, movers: [{ object: w.walker, size: [0.8, 0.8] }] });
    const u = w.walker.material.userData.standIn;
    expect(u.uMoverRange.value.x).toBeLessThan(0);
    expect(u.uMoverRange.value.y).toBeGreaterThan(0);
  });
});

describe('a zone of a world (one of several, shown in turn)', () => {
  it('lays blobs only for who is inside its area, while its floor is shown', () => {
    const w = world();
    const g = groundWorld({ renderer: stubRenderer(), scene: w.scene, floor: [w.floor], area, sun: w.sun, movers: [{ object: w.walker, size: [0.8, 0.8] }], clip: true });
    w.walker.position.set(300, 1, 0);
    w.scene.updateMatrixWorld(true);
    g.update();
    expect(g.blobs.mesh.count).toBe(0);
    w.walker.position.set(3, 1, 4);
    w.scene.updateMatrixWorld(true);
    g.update();
    expect(g.blobs.mesh.count).toBe(1);
    w.floor.visible = false;
    g.update();
    expect(g.blobs.mesh.count).toBe(0);
  });
});

describe('a mover with a contact shadow of its own (an interior zone keeps it)', () => {
  it('hides it while the floor\'s blob is under the mover, and gives it back when the zone is put away', () => {
    const w = world();
    const contact = new THREE.Mesh(new THREE.CircleGeometry(0.4), new THREE.MeshBasicMaterial());
    w.walker.add(contact);
    const g = groundWorld({ renderer: stubRenderer(), scene: w.scene, floor: [w.floor], area, sun: w.sun, movers: [{ object: w.walker, size: [0.8, 0.8], contact }], clip: true });
    w.scene.updateMatrixWorld(true);
    g.update();
    expect(g.blobs.mesh.count).toBe(1);
    expect(contact.visible).toBe(false);
    w.floor.visible = false;
    g.update();
    expect(contact.visible).toBe(true);
  });
});

describe('a mover that comes later (a figure swapped for another)', () => {
  it('stands in the shade, bounces, and gets its blob once tracked', () => {
    const w = world();
    const g = groundWorld({ renderer: stubRenderer(), scene: w.scene, floor: [w.floor], area, sun: w.sun });
    const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.6), new THREE.MeshStandardMaterial());
    fresh.position.set(1, 0.9, 1);
    w.scene.add(fresh);
    g.track(fresh, [0.8, 0.8]);
    expect(fresh.material.userData.standIn).toBeTruthy();
    expect(fresh.material.userData.bounce).toBeTruthy();
    expect(fresh.castShadow).toBe(false);
    w.scene.updateMatrixWorld(true);
    g.update();
    expect(g.blobs.mesh.count).toBe(1);
    g.untrack(fresh);
    g.update();
    expect(g.blobs.mesh.count).toBe(0);
  });
});

describe('a world too big or too fast for one sun\'s mask (a city flown over)', () => {
  it('keeps its own shadow pass, and bakes only the sky\'s occlusion', () => {
    const w = world();
    const renderer = stubRenderer();
    const g = groundWorld({ renderer, scene: w.scene, floor: [w.floor], area, sun: w.sun, keepShadows: true });
    expect(renderer.shadowMap.enabled).toBe(true);
    expect(w.sun.castShadow).toBe(true);
    expect(w.house.castShadow).toBe(true);
    // (the sun isn't cut by the mask: its own shadow map does that)
    expect(g.mask.times).toEqual([{ tod: 0.5, channel: 3 }]);
    expect(w.floor.material.userData.floorShadow).toBeTruthy();
    expect(w.wood.userData.bounce).toBeTruthy();
  });
});

describe('a mover taken out of the world', () => {
  it('has no blob left behind where it was', () => {
    const w = world();
    const g = groundWorld({ renderer: stubRenderer(), scene: w.scene, floor: [w.floor], area, sun: w.sun, movers: [{ object: w.walker, size: [0.8, 0.8] }] });
    w.scene.updateMatrixWorld(true);
    g.update();
    expect(g.blobs.mesh.count).toBe(1);
    w.scene.remove(w.walker);
    g.update();
    expect(g.blobs.mesh.count).toBe(0);
  });
});

describe('a GPU that can\'t bake (no float pictures)', () => {
  it('keeps the world\'s own shadow pass, as it stood before', () => {
    const w = world();
    const renderer = stubRenderer(false);
    groundWorld({ renderer, scene: w.scene, floor: [w.floor], area, sun: w.sun });
    expect(renderer.shadowMap.enabled).toBe(true);
    expect(w.sun.castShadow).toBe(true);
    expect(w.house.castShadow).toBe(true);
  });
});

describe('far things painted with matcaps', () => {
  it('are, where the GPU can draw the matcap, and stay lit where it can\'t', () => {
    const w = world();
    const rim = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 2), new THREE.MeshLambertMaterial({ vertexColors: true }));
    w.scene.add(rim);
    groundWorld({ renderer: stubRenderer(true), scene: w.scene, floor: [w.floor], area, sun: w.sun, matcap: [rim] });
    expect(rim.material.isMeshMatcapMaterial).toBe(true);
    expect(rim.material.vertexColors).toBe(true);
    const w2 = world();
    const rim2 = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 2), new THREE.MeshLambertMaterial());
    w2.scene.add(rim2);
    groundWorld({ renderer: stubRenderer(false), scene: w2.scene, floor: [w2.floor], area, sun: w2.sun, matcap: [rim2] });
    expect(rim2.material.isMeshLambertMaterial).toBe(true);
  });
});

describe('the kit switched off and on again (an A/B of the same moment)', () => {
  it('puts the blank mask back, stops the bounce, hides the blobs, then restores them', () => {
    const w = world();
    const g = groundWorld({ renderer: stubRenderer(), scene: w.scene, floor: [w.floor], area, sun: w.sun, movers: [{ object: w.walker, size: [0.8, 0.8] }] });
    const u = w.floor.material.userData.floorShadow;
    const baked = new THREE.Texture();
    u.uMask.value[0] = baked; // (as a landed bake leaves it)
    const strength = w.wood.userData.bounce.uBounceStrength.value;
    g.enabled = false;
    expect(u.uMask.value[0]).not.toBe(baked);
    expect(w.wood.userData.bounce.uBounceStrength.value).toBe(0);
    expect(g.blobs.mesh.visible).toBe(false);
    g.enabled = true;
    expect(u.uMask.value[0]).toBe(baked);
    expect(w.wood.userData.bounce.uBounceStrength.value).toBe(strength);
    expect(g.blobs.mesh.visible).toBe(true);
  });
});
