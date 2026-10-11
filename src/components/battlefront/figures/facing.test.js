// The way a soldier faces under the game's clips, measured in Node on the
// committed body (snowtrooper.lod1.glb) and the humanoid pack: the barrel
// (Wep_Root's +z, the weapon frame's) and the left foot's toe ahead of its
// heel. The sim's yaw 0 is +Z (locomotion.js's dir8Of); the packed clips
// face +X, because the packer drops AITrajectory and its −90° turn
// (scripts/bf2017-clips.mjs's DROP). faceAlongZ puts the turn back on the
// body, so a figure at yaw 0 faces +Z and at yaw θ faces (sin θ, 0, cos θ).
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { clipsFor } from '../../../lib/three/walrus.js';
import { faceAlongZ } from './facing.js';
import { parseGlb } from './fixtures/glb.js';

const DIR = 'public/models/galaxy/bf2017';

let body;
let pack;
beforeAll(async () => {
  [body, pack] = await Promise.all(['crew/snowtrooper.lod1.glb', 'clips-humanoid.glb'].map((f) => parseGlb(`${DIR}/${f}`)));
}, 30000);

// a fresh body (its own bones) posed halfway through a clip at a yaw: the
// barrel's way and the left foot's, flat on the ground
function facing(name, { yaw = 0, fix = true } = {}) {
  const model = body.scene.clone(true);
  if (fix) faceAlongZ(model);
  model.rotation.y = yaw;
  const all = new Map(pack.animations.map((c) => [c.name, c]));
  const clips = clipsFor(model, all);
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(clips[name]).play();
  mixer.setTime(clips[name].duration * 0.5);
  model.updateMatrixWorld(true);
  const q = model.getObjectByName('Wep_Root').getWorldQuaternion(new THREE.Quaternion());
  const barrel = new THREE.Vector3(0, 0, 1).applyQuaternion(q).setY(0).normalize();
  const W = (n) => model.getObjectByName(n).getWorldPosition(new THREE.Vector3());
  const foot = W('LeftToeBase').sub(W('LeftFoot')).setY(0).normalize();
  return { barrel, foot };
}

const ahead = (yaw) => new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));

describe('a soldier’s facing under the packed clips', () => {
  it('is +X without the turn: the packer drops AITrajectory’s −90°', () => {
    const { barrel } = facing('aim.rifle', { fix: false });
    expect(barrel.x).toBeGreaterThan(0.9);
  });
  for (const clip of ['aim.rifle', 'walk', 'run'])
    it(`is +Z at yaw 0 with the turn put back (${clip})`, () => {
      const { barrel, foot } = facing(clip);
      expect(barrel.dot(ahead(0))).toBeGreaterThan(0.9);
      expect(foot.dot(ahead(0))).toBeGreaterThan(0.5);
    });
  it('follows the sim’s yaw: at π/2 it faces +X, at −3π/4 back and left', () => {
    for (const yaw of [Math.PI / 2, (-3 * Math.PI) / 4]) expect(facing('aim.rifle', { yaw }).barrel.dot(ahead(yaw)), `yaw ${yaw}`).toBeGreaterThan(0.9);
  });
  it('is idempotent and leaves a tree without AITrajectory alone', () => {
    const m = body.scene.clone(true);
    faceAlongZ(m);
    faceAlongZ(m);
    const q = m.getObjectByName('AITrajectory').quaternion;
    expect(q.y).toBeCloseTo(-Math.SQRT1_2, 6);
    expect(q.w).toBeCloseTo(Math.SQRT1_2, 6);
    expect(faceAlongZ(new THREE.Group())).toBe(false);
  });
});
