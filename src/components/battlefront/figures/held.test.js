import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import HELD from '../../../data/bf2017/held.json';
import { WEAPON_FRAME } from '../../../lib/three/walrusRig.js';
import { createHeld, heldOf, weaponUrl } from './held.js';

// a stand-in gun: a box along +z, as the game's are, the grip at the origin
const fakeGltf = (name) => {
  const scene = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.4), new THREE.MeshStandardMaterial());
  box.position.z = 0.15;
  box.name = name;
  scene.add(box);
  return { scene, animations: [] };
};
// a stand-in figure: Wep_Root under a turned and moved parent, as a body's
const fakeFigure = ({ scale = 1 } = {}) => {
  const model = new THREE.Group();
  model.position.set(3, 0, -2);
  model.rotation.y = 0.7;
  model.scale.setScalar(scale);
  const spine = new THREE.Bone();
  spine.position.set(0, 1.3, 0);
  spine.rotation.set(0.2, -0.4, 0.1);
  const socket = new THREE.Bone();
  socket.name = 'Wep_Root';
  socket.position.set(0.2, 0.05, 0.3);
  spine.add(socket);
  model.add(spine);
  model.updateMatrixWorld(true);
  return { model, sockets: { weapon: socket } };
};
const loader = () => {
  const asked = [];
  const waits = new Map();
  const load = (url) => {
    asked.push(url);
    return new Promise((resolve) => waits.set(url, () => resolve(fakeGltf(url))));
  };
  return { load, asked, land: (url) => waits.get(url)() };
};

describe('a class weapon’s row', () => {
  it('gives its light cut, muzzle, flash and stance', () => {
    const e11 = heldOf('e11');
    expect(e11.url).toBe('/models/galaxy/surface/e11.lod1.glb');
    expect(weaponUrl('dh17')).toBe('/models/galaxy/surface/dh17.lod1.glb');
    expect(e11.muzzle).toEqual(HELD.rows.e11.muzzle);
    expect(e11.flash).toEqual(HELD.rows.e11.flash);
    expect(e11.stance).toBe('t');
    expect(heldOf('dh17').stance).toBe('p');
    expect(heldOf('dlt19').stance).toBe('l');
    expect(heldOf('nope')).toBe(null);
    expect(heldOf(null)).toBe(null);
  });
  it('has a row for every Hoth class weapon', () => {
    for (const id of ['e11', 'a280', 'dh17', 'rk3', 'dlt19', 'rt97c', 'dlt19x', 'dlt20a']) expect(heldOf(id), id).not.toBe(null);
  });
});

describe('a weapon in the hand', () => {
  it('hangs the gun at Wep_Root in the weapon frame, the muzzle where the record puts it', async () => {
    const { load, land } = loader();
    const held = createHeld({ load });
    const fig = fakeFigure();
    const p = held.arm(fig, 'e11');
    land(weaponUrl('e11'));
    const gun = await p;
    expect(gun.parent).toBe(fig.sockets.weapon);
    expect(gun.quaternion.toArray()).toEqual(WEAPON_FRAME.quaternion);
    expect(gun.position.toArray()).toEqual(WEAPON_FRAME.position);
    fig.model.updateMatrixWorld(true);
    const want = fig.sockets.weapon.localToWorld(new THREE.Vector3().fromArray(HELD.rows.e11.muzzle));
    const got = held.muzzleOf(fig, new THREE.Vector3());
    expect(got.distanceTo(want)).toBeLessThan(1e-9);
    gun.traverse((o) => o.isMesh && expect(o.castShadow).toBe(true));
  });

  it('keeps the gun its own size on a scaled body', async () => {
    const { load, land } = loader();
    const held = createHeld({ load });
    const fig = fakeFigure({ scale: 2 });
    const p = held.arm(fig, 'dlt19');
    land(weaponUrl('dlt19'));
    await p;
    fig.model.updateMatrixWorld(true);
    const root = fig.sockets.weapon.getWorldPosition(new THREE.Vector3());
    const reach = new THREE.Vector3().fromArray(HELD.rows.dlt19.muzzle).length();
    expect(held.muzzleOf(fig, new THREE.Vector3()).distanceTo(root)).toBeCloseTo(reach, 6);
  });

  it('swaps the gun when the weapon changes, the last asked winning a race', async () => {
    const { load, land, asked } = loader();
    const held = createHeld({ load });
    const fig = fakeFigure();
    const a = held.arm(fig, 'e11');
    const b = held.arm(fig, 'dh17');
    land(weaponUrl('dh17'));
    land(weaponUrl('e11'));
    expect(await a).toBe(null);
    const gun = await b;
    expect(asked).toEqual([weaponUrl('e11'), weaponUrl('dh17')]);
    expect(fig.sockets.weapon.children).toEqual([gun]);
    expect(held.idOf(fig)).toBe('dh17');
    // (the same weapon again: nothing loaded, the gun kept)
    expect(await held.arm(fig, 'dh17')).toBe(gun);
    expect(asked.length).toBe(2);
  });

  it('leaves a figure without a socket or a known weapon unarmed', async () => {
    const held = createHeld({ load: () => Promise.resolve(fakeGltf('x')) });
    expect(await held.arm({ sockets: {} }, 'e11')).toBe(null);
    const fig = fakeFigure();
    expect(await held.arm(fig, 'nope')).toBe(null);
    expect(held.muzzleOf(fig, new THREE.Vector3())).toBe(null);
  });

  it('takes the gun off on disarm and dispose', async () => {
    const held = createHeld({ load: (url) => Promise.resolve(fakeGltf(url)) });
    const one = fakeFigure();
    const two = fakeFigure();
    await held.arm(one, 'e11');
    await held.arm(two, 'a280');
    held.disarm(one);
    expect(one.sockets.weapon.children).toEqual([]);
    expect(held.muzzleOf(one, new THREE.Vector3())).toBe(null);
    held.dispose();
    expect(two.sockets.weapon.children).toEqual([]);
  });
});
