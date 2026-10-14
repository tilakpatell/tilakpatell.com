// The rig ops on the game's skeleton as committed (walrus.glb), posed by the
// walk clip as the loader plays it: the helpers follow the limbs (the knee
// roll turns with the knee, the elbow roll is the forearm's turn, the hip
// roll the thigh's), a helper no clip moves is put back to bind before each
// run, and the body type's filters step on the game's tick.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { clipsFor } from './walrus';
import { RIG_LISTS, TICK, bonePose, createRigOps, kernelOf, rigListOf } from './rigKernels.js';

const DIR = 'public/models/galaxy/bf2017';
const parse = async (file) => {
  const buf = readFileSync(`${DIR}/${file}`);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return new Promise((r, j) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', r, j));
};

let body;
let clips;
let animated;
beforeAll(async () => {
  await MeshoptDecoder.ready;
  const [walrus, humanoid] = await Promise.all(['walrus.glb', 'clips-humanoid.glb'].map(parse));
  body = walrus.scene;
  clips = clipsFor(body, new Map(humanoid.animations.map((c) => [c.name, c])));
  animated = new Set(Object.values(clips).flatMap((c) => c.tracks.map((t) => t.name.slice(0, t.name.lastIndexOf('.')))));
});

const pose = (name, t) => {
  const mixer = new THREE.AnimationMixer(body);
  mixer.clipAction(clips[name]).play();
  mixer.setTime(t);
  return mixer;
};
const angle = (q) => (2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180) / Math.PI;

describe('the rig ops', () => {
  it('has a list for each Hoth body, the deformation first', () => {
    for (const list of Object.values(RIG_LISTS)) expect(list[0]).toBe('deformation');
    expect(rigListOf('snowtrooper')).toEqual(['deformation', 'snowtrooper']);
    expect(rigListOf('nobody')).toEqual(['deformation']);
    for (const id of new Set(Object.values(RIG_LISTS).flat())) expect(kernelOf(id)).toBeTruthy();
  });

  it('drives the helpers no clip carries from the limbs the clip moves', () => {
    expect(animated.has('LeftKneeRoll')).toBe(false);
    expect(animated.has('LeftLeg')).toBe(true);
    const ops = createRigOps(body, ['deformation'], { animated });
    const p = bonePose(body);
    // (mid-stride: the left knee bent)
    const mixer = pose('walk', 0.5);
    ops.update(1 / 60);
    const knee = angle(body.getObjectByName('LeftLeg').quaternion);
    const roll = angle(body.getObjectByName('LeftKneeRoll').quaternion);
    expect(knee).toBeGreaterThan(10);
    expect(roll).toBeGreaterThan(knee * 0.4);
    // (the elbow roll is the forearm's own turn: 3p.Body.Deformation copies LeftForeArm.q into it)
    expect(p.get('LeftElbowRoll.q').map((x) => +x.toFixed(4))).toEqual(p.get('LeftForeArm.q').map((x) => +x.toFixed(4)));
    mixer.stopAllAction();
  });

  it('puts a helper back to bind before each run, so two runs agree', () => {
    const ops = createRigOps(body, ['deformation'], { animated });
    pose('walk', 0.9);
    ops.update(1 / 60);
    const a = body.getObjectByName('RightKneeRoll').quaternion.clone();
    ops.update(1 / 60);
    const b = body.getObjectByName('RightKneeRoll').quaternion;
    expect(Math.abs(a.dot(b))).toBeGreaterThan(0.99999);
    expect(ops.stats().reset).toBeGreaterThan(30);
  });

  it('steps the body type’s filters once a game tick and holds them between', () => {
    const ops = createRigOps(body, ['deformation', 'rebeltrooper-backpack'], { animated });
    pose('run', 0.2);
    ops.update(TICK);
    const runs = ops.stats().runs;
    ops.update(TICK / 4);
    expect(ops.stats().runs).toBe(runs + 1); // (the deformation alone)
    ops.update(TICK);
    expect(ops.stats().runs).toBe(runs + 3);
  });

  it('runs in well under a millisecond a body', () => {
    const ops = createRigOps(body, ['deformation', 'snowtrooper'], { animated });
    pose('walk', 0.3);
    for (let i = 0; i < 20; i++) ops.update(1 / 60);
    const { ms, runs } = ops.stats();
    expect(runs).toBeGreaterThan(20);
    expect(ms / 20).toBeLessThan(2);
  });
});
