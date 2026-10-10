// A 2017 hero's saber, headless: the committed skeleton (walrus.glb) as the
// figure with Luke's committed clip pack, gunplay putting the hilt in
// Wep_Root, and the saber swinging the game's strikes by the game's names,
// timed by the stroke table's windows, its blade out of the hilt's emitter
// and lighting the scene round it on high.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import luke from '../../../data/bf2017/strokes/luke.json';

// (the hilt's file held back until the test lets it come)
const glb = vi.hoisted(() => ({ release: null }));
vi.mock('./placer', async (orig) => ({
  ...(await orig()),
  loadGlb: () => new Promise((r) => (glb.release = r)),
}));
const { socketsOf } = await import('../../../lib/three/walrus');
const { createGunplay } = await import('../../universe/gunplay');
const { createSaber } = await import('./saber');
const { BLADE_OF } = await import('./saberRules');
const { HILTS } = await import('../heroes');

const parse = async (file) => {
  const buf = readFileSync(file);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return new Promise((r, j) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', r, j));
};
const strike = (name) => luke.strikes.find((s) => s.name === name);

let figure;
beforeAll(async () => {
  await MeshoptDecoder.ready;
  const pack = await parse('public/models/galaxy/bf2017/clips-luke.glb');
  const clips = Object.fromEntries(pack.animations.map((c) => [c.name, c]));
  figure = async () => {
    const g = await parse('public/models/galaxy/bf2017/walrus.glb');
    const bones = {};
    g.scene.traverse((o) => o.name && !(o.name in bones) && (bones[o.name] = o));
    const world = new THREE.Scene();
    world.add(g.scene);
    g.scene.updateMatrixWorld(true);
    return { fig: { model: g.scene, bones, sockets: socketsOf(g.scene), rig: 'walrus', clips }, world };
  };
});

describe('a 2017 hero’s saber', () => {
  it('swings the game’s strikes by the game’s names, each its own clip', async () => {
    const { fig, world } = await figure();
    const gp = createGunplay(fig, 'saber', { unit: 1 });
    const saber = createSaber(gp, { fig, parent: world, tier: 'low' });
    const a = saber.swing(0);
    expect(a.name).toBe('A_Luke_AttackLoop_Strike1');
    expect(a.clip?.userData.source).toBe('A_Luke_AttackLoop_Strike1');
    const heavy = createSaber(createGunplay(fig, 'saber', { unit: 1 }), { fig, parent: world, tier: 'low' }).swing(0, { heavy: true });
    expect(heavy.name).toBe('A_Luke_Jump_SaberAttack_Light_FH_01');
    expect(heavy.clip).not.toBe(null);
    saber.dispose();
  });

  it('times a stroke by the table’s window, as the pack now does too', async () => {
    const { fig, world } = await figure();
    const saber = createSaber(createGunplay(fig, 'saber', { unit: 1 }), { fig, parent: world, tier: 'low' });
    const a = saber.swing(0);
    expect(a.contact).toEqual(strike('A_Luke_AttackLoop_Strike1').contact);
    // (the pack re-timed with the tables' measure: scripts/bf2017-clips.mjs)
    expect(a.clip.userData.contact).toEqual(a.contact);
    const up = createSaber(createGunplay(fig, 'saber', { unit: 1 }), { fig, parent: world, tier: 'low' }).swing(0, { dir: 'left' });
    expect(up.contact).toEqual(luke.strikes.find((s) => s.name === up.name).contact);
  });

  it('takes the table’s window over a pack’s that disagrees', async () => {
    const { fig, world } = await figure();
    // (a pack timed some other way: its first strike's window a tenth of a second on)
    const other = fig.clips['sword.light.a'].clone();
    other.userData.contact = other.userData.contact.map((t) => t + 0.1);
    fig.clips = { ...fig.clips, 'sword.light.a': other };
    const a = createSaber(createGunplay(fig, 'saber', { unit: 1 }), { fig, parent: world, tier: 'low' }).swing(0);
    expect(a.clip).toBe(other);
    expect(a.contact).toEqual(strike('A_Luke_AttackLoop_Strike1').contact);
  });

  it('times a stroke named outright (a duellist’s, a peer’s) by that stroke’s own window', async () => {
    const { fig, world } = await figure();
    const saber = createSaber(createGunplay(fig, 'saber', { unit: 1 }), { fig, parent: world, tier: 'low' });
    const third = saber.swing(0, { clip: 'A_Luke_AttackLoop_Strike3' });
    expect(third.name).toBe('A_Luke_AttackLoop_Strike3');
    expect(third.contact).toEqual(strike('A_Luke_AttackLoop_Strike3').contact);
  });

  it('brings its blade out of the hilt’s emitter, where the game’s rod starts', async () => {
    const { fig, world } = await figure();
    const gp = createGunplay(fig, 'saber', { unit: 1 });
    const hilt = HILTS.find((h) => h.id === 'luke');
    const saber = createSaber(gp, { hilt, fig, parent: world, tier: 'low' });
    // (a stand-in for the game's hilt: its own extent, 0.286 m about the grip, as the game's)
    const model = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.286, 0.05));
    box.position.y = 0.07 - 0.143;
    model.add(box);
    glb.release({ scene: model });
    await new Promise((r) => setTimeout(r, 0));
    const scale = gp.gun.getObjectByName('hilt-model').scale.x;
    const want = BLADE_OF[hilt.model].base.map((v) => v * scale);
    expect(
      gp.gun
        .getObjectByName('blade')
        .position.toArray()
        .map((v) => +v.toFixed(4)),
    ).toEqual(want.map((v) => +v.toFixed(4)));
    saber.dispose();
  });

  it('lights the scene round it on high, and takes the light away when it goes', async () => {
    const { fig, world } = await figure();
    const lights = () => world.children.filter((o) => o.isPointLight).length;
    const saber = createSaber(createGunplay(fig, 'saber', { unit: 1 }), { fig, parent: world, tier: 'high' });
    expect(lights()).toBe(1);
    saber.dispose();
    expect(lights()).toBe(0);
    createSaber(createGunplay(fig, 'saber', { unit: 1 }), { fig, parent: world, tier: 'mid' });
    expect(lights()).toBe(0);
  });

  it('takes its light with it when thrown, and lets it go when no update reaches it', async () => {
    const { fig, world } = await figure();
    const saber = createSaber(createGunplay(fig, 'saber', { unit: 1 }), { fig, parent: world, tier: 'high' });
    const light = world.children.find((o) => o.isPointLight);
    const p = { forward: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0), me: null, targets: [], eye: new THREE.Vector3(0, 1.6, -3) };
    let now = 0;
    const frames = (n) => {
      for (let i = 0; i < n; i++) saber.update(1 / 30, (now += 1 / 30), p);
    };
    saber.light(true);
    frames(30);
    expect(light.intensity).toBeGreaterThan(0);
    const held = light.position.clone();
    expect(saber.throw(now, new THREE.Vector3(0, 0, 1))).toBe(true);
    frames(10);
    expect(light.position.distanceTo(held)).toBeGreaterThan(1);
    saber.dark();
    expect(light.intensity).toBe(0);
    saber.dispose();
  });
});
