// The saber on screen, headless, on the game's rig (the committed skeleton,
// walrus.glb, with Luke's committed clip pack): what it does is the engine's
// (lib/combat/saber2017.js) on the game's rules, drawn here. A strike lands
// on a body the game's query finds, the game's damage after its delay, once,
// on the capsule its blade meets; the block's shield turns a bolt from the
// front and lets one from behind by; a figure off the game's rig gets no saber.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { createBolts } from '../../../lib/combat/bolt';
import { saberOf } from '../../../lib/combat/saber2017';
import { socketsOf } from '../../../lib/three/walrus';
import { meshyRig } from '../../../lib/three/meshyRig.fixture';
import { createGunplay } from '../../universe/gunplay';
import { createSaber } from './saber';

const UP = new THREE.Vector3(0, 1, 0);
const DT = 1 / 60;
const luke = saberOf('luke');
const parse = async (file) => {
  const buf = readFileSync(file);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return new Promise((r, j) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', r, j));
};

let clips;
beforeAll(async () => {
  await MeshoptDecoder.ready;
  clips = Object.fromEntries((await parse('public/models/galaxy/bf2017/clips-luke.glb')).animations.map((c) => [c.name, c]));
});

// Luke at the origin facing +z, his saber lit
async function hero() {
  const g = await parse('public/models/galaxy/bf2017/walrus.glb');
  const bones = {};
  g.scene.traverse((o) => o.name && !(o.name in bones) && (bones[o.name] = o));
  const world = new THREE.Scene();
  const holder = new THREE.Group();
  world.add(holder);
  holder.add(g.scene);
  world.updateMatrixWorld(true);
  const fig = { model: g.scene, bones, sockets: socketsOf(g.scene), rig: 'walrus', clips };
  const gp = createGunplay(fig, 'saber', { unit: 1 });
  const saber = createSaber(gp, { fig, parent: world, tier: 'low' });
  saber.light(true);
  const me = { x: 0, z: 0, yaw: 0 };
  let now = 0;
  const frame = (p = {}) => {
    now += DT;
    holder.position.set(me.x, 0, me.z);
    holder.rotation.y = me.yaw;
    world.updateMatrixWorld(true);
    const forward = new THREE.Vector3(Math.sin(me.yaw), 0, Math.cos(me.yaw));
    gp.set(DT, { aim: 0.75, look: 0, dir: null, forward, up: UP });
    saber.update(DT, now, { forward, up: UP, me, ...p });
    return now;
  };
  return { saber, me, frame, world, get now() {
    return now;
  } };
}
// a body `d` m ahead of the origin, facing back at it (or `yaw`)
const body = (z, x = 0, yaw = Math.PI) => {
  const holder = new THREE.Group();
  holder.position.set(x, 0, z);
  return { holder, fig: { tall: 1.8 }, spec: {}, b: { x, z, yaw }, hp: 9 };
};

describe('a strike on the game’s rules', () => {
  it('lands the game’s damage on a body its query finds, after the delay, once', async () => {
    const h = await hero();
    for (let i = 0; i < 10; i++) h.frame();
    const t = body(1.2);
    const hits = [];
    const sw = h.saber.swing(h.now);
    expect(sw.name).toBe('A_Luke_AttackLoop_Strike1');
    for (let i = 0; i < 70; i++) {
      h.frame({ targets: [t], hit: (x, damage, at, o) => hits.push({ x, damage, at: at.clone(), o, when: h.now }) });

    }
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ x: t, damage: luke.damage.hit.damage, o: { behind: false } });
    // (no sooner than the window's opening and the damage's delay)
    expect(hits[0].when).toBeGreaterThanOrEqual(sw.t0 + sw.contact[0] + luke.damage.hit.delay - 1e-6);
    expect(hits[0].o.region).toBe('chest');
  });

  it('adds the from-behind damage to one facing away', async () => {
    const h = await hero();
    const t = body(1.2, 0, 0);
    const hits = [];
    h.saber.swing(h.now);
    for (let i = 0; i < 70; i++) h.frame({ targets: [t], hit: (x, damage, at, o) => hits.push({ damage, o }) });
    expect(hits[0]).toMatchObject({ damage: luke.damage.hit.damage + luke.damage.behind.damage, o: { behind: true } });
  });

  it('misses one off to the side and one behind', async () => {
    const h = await hero();
    const hits = [];
    h.saber.swing(h.now);
    for (let i = 0; i < 70; i++) h.frame({ targets: [body(0.5, 3), body(-1.5)], hit: () => hits.push(1) });
    expect(hits).toEqual([]);
  });

  it('stops on a body holding its block from the front: nothing lands, its stamina pays, the blocked reaction plays', async () => {
    const h = await hero();
    const t = { ...body(1.2), blocking: true };
    const hits = [];
    const met = [];
    h.saber.swing(h.now);
    for (let i = 0; i < 70 && !met.length; i++) h.frame({ targets: [t], hit: () => hits.push(1), blocked: (x) => met.push(x) });
    expect(hits).toEqual([]);
    expect(met).toEqual([t]);
    expect(h.saber.swinging).toBe(null);
    // (recoiling: no strike till BlockedLightSaber's time is out)
    expect(h.saber.swing(h.now)).toBe(null);
  });

  it('costs its stamina, and hits nothing with the blade out', async () => {
    const h = await hero();
    h.saber.swing(h.now);
    for (let i = 0; i < 30; i++) h.frame();
    expect(h.saber.view().stamina).toBeCloseTo(1 - luke.stamina.strike / luke.stamina.max);
    h.saber.light(false);
    for (let i = 0; i < 30; i++) h.frame();
    const hits = [];
    h.saber.swing(h.now + 2);
    for (let i = 0; i < 70; i++) h.frame({ targets: [body(1.2)], hit: () => hits.push(1) });
    expect(hits.length).toBeLessThanOrEqual(1); // (a swing lights it again)
  });
});

describe('the block’s shield and the bolts', () => {
  it('turns a bolt from the front and lets one from behind by', async () => {
    const h = await hero();
    h.saber.block(true);
    for (let i = 0; i < 20; i++) h.frame();
    const guard = h.saber.guard('you', 'you');
    expect(guard).not.toBe(null);
    const fire = (from, dir) => {
      const bolts = createBolts();
      bolts.fire({ from, dir, speed: 90, side: 'them', deflect: true });
      const you = { id: 'you', a: [0, 0.4, 0], b: [0, 1.45, 0], r: 0.4, side: 'you' };
      const ev = [];
      for (let i = 0; i < 30; i++) ev.push(...bolts.step(DT, { bodies: [you], blades: [guard] }));
      return ev.find((e) => e.type !== 'gone')?.type;
    };
    expect(fire([0, 1.2, 12], [0, 0, -1])).toBe('deflect');
    expect(fire([0, 1.2, -12], [0, 0, 1])).toBe('hit');
    h.saber.block(false);
    for (let i = 0; i < 3; i++) h.frame();
    expect(h.saber.guard()).toBe(null);
  });

  it('pays for a bolt turned, by its damage', async () => {
    const h = await hero();
    h.saber.deflected(luke.stamina.standardBolt, h.now);
    expect(h.saber.view().stamina).toBeCloseTo(1 - luke.stamina.bolt / luke.stamina.max);
  });
});

describe('one path', () => {
  it('gives a figure off the game’s rig no saber', () => {
    const rig = meshyRig();
    const gp = createGunplay({ model: rig.model, bones: rig.bones }, 'saber', { unit: 1 });
    expect(createSaber(gp, { fig: { bones: rig.bones, hipsY: rig.hipsY } })).toBe(null);
    expect(createSaber(gp, { fig: null })).toBe(null);
  });
});
