import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPhysics } from '../../../lib/physics/world.js';
import { createDoors, stepDoors } from './doors.js';
import { createDoorsScene } from './doorsScene.js';

// lane P0's fixture pack: its snow pile's shapes stand for a leaf's and a wreck's
const PACK = new URL('../../../../scripts/fixtures/bf2017/physics/pack/', import.meta.url);
const fixture = JSON.parse(readFileSync(new URL('level.json', PACK), 'utf8'));
const loadBin = async (file) => {
  const b = readFileSync(new URL(file, PACK));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
const pack = { ...fixture, origin: [0, 0, 0], yaw: 0, meshes: fixture.meshes.map((m, i) => (i === 0 ? { ...m, glb: ['meshes/pile.lod0.glb', 'meshes/pile.lod1.glb'] } : m)) };
const leaf = { side: 'left', mesh: fixture.meshes[0].name, at: [10, 0, 10], slide: [2, 0, 0] };
const wreck = { id: 'spawner', prefab: 'PF_VehicleSpawner-DF9', kind: 'wreck', parts: [{ switch: { field: 'Enabled', from: 'BoolEntityData', start: false }, instances: [{ mesh: fixture.meshes[0].name, at: [30, 0, 10] }] }] };
const mode = {
  controller: { curve: 'Sine', mode: 'EaseOut', duration: 1.5 },
  doors: [{ id: 'door', team: 0, duration: 1, leaves: [leaf], trigger: { at: [10, 1, 10], half: [2, 1.5, 2], rotation: [0, 0, 0, 1] }, opens: [], closes: [] }],
  gates: [],
  props: [wreck],
};
const row = (is, position) => ({ mesh: 0, mirrored: false, position, quaternion: [0, 0, 0, 1], scale: [1, 1, 1], is });
const rows = [row({ kind: 'leaf', id: 'door', leaf }, [10, 0, 10]), row({ kind: 'prop', id: 'spawner', prop: wreck, part: wreck.parts[0] }, [30, 0, 10])];

let physics;
beforeEach(async () => {
  physics = await createPhysics({ gravity: 0 });
});

function made() {
  const group = new THREE.Group();
  const loads = [];
  const part = { pack, loadBin, group, mode, rows: Promise.resolve(rows), loadGltf: async (path) => (loads.push(path), { scene: new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()) }) };
  return { group, loads, scene: createDoorsScene({ part, physics }) };
}
const settle = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
};

describe('the mode part’s doors and props, drawn and solid', () => {
  it('a leaf is a kinematic body of its mesh’s shapes that moves with its door', async () => {
    const { group, scene } = made();
    await scene.ready;
    await settle();
    const state = createDoors(mode);
    scene.update(state);
    const item = group.children.find((o) => o.name === 'mode:door');
    expect(item.visible).toBe(true);
    expect(scene.stats().bodies).toBe(1);
    // (a soldier in the box: the door full open a second on, the leaf and its body 2 m along)
    for (let i = 0; i < 40; i++) stepDoors(state, 1 / 30, { soldiers: [{ at: [10, 0, 10], team: 1, alive: true }] });
    scene.update(state);
    physics.world.step();
    expect(item.position.x).toBeCloseTo(12, 5);
    const body = physics.world.bodies.getAll().find((b) => b.isKinematic());
    expect(body.translation().x).toBeCloseTo(12, 5);
    scene.dispose();
  });

  it('a wreck is not fetched, drawn nor solid until its vehicle is destroyed', async () => {
    const { group, loads, scene } = made();
    await scene.ready;
    await settle();
    const state = createDoors(mode);
    scene.update(state);
    await settle();
    // (only the leaf's mesh asked for: coarsest LOD first, then the finest)
    expect(loads).toEqual(['meshes/pile.lod1.glb', 'meshes/pile.lod0.glb']);
    expect(group.children.some((o) => o.name === 'mode:spawner')).toBe(false);
    expect(scene.stats().bodies).toBe(1);
    state.destroyed.add('spawner');
    scene.update(state);
    await settle();
    scene.update(state);
    expect(group.children.find((o) => o.name === 'mode:spawner')?.visible).toBe(true);
    expect(scene.stats().bodies).toBe(2);
    state.destroyed.delete('spawner');
    scene.update(state);
    expect(scene.stats().bodies).toBe(1);
    scene.dispose();
    expect(physics.world.bodies.len()).toBe(0);
  });
});
