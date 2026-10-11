// A snowtrooper with the E-11 in hand under the committed humanoid pack, as
// the Battlefront figures pose one (the body turned by faceAlongZ, the gun
// hung by createHeld): the grip in the right hand, the muzzle at a
// shoulder's height (the sim's logical muzzle is 1.40 m: eye 1.55 − 0.15),
// the barrel the way the soldier faces, +Z at yaw 0.
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { clipsFor, socketsOf } from '../../../lib/three/walrus.js';
import { faceAlongZ } from './facing.js';
import { parseGlb } from './fixtures/glb.js';
import { createHeld, weaponUrl } from './held.js';

const DIR = 'public/models/galaxy/bf2017';
let fig;
let clips;
let held;
beforeAll(async () => {
  const [body, pack] = await Promise.all(['crew/snowtrooper.lod1.glb', 'clips-humanoid.glb'].map((f) => parseGlb(`${DIR}/${f}`)));
  const model = body.scene;
  faceAlongZ(model);
  clips = clipsFor(model, new Map(pack.animations.map((c) => [c.name, c])));
  fig = { model, sockets: socketsOf(model) };
  held = createHeld({ load: (url) => parseGlb(`public${url}`) });
  expect(await held.arm(fig, 'e11')).toBeTruthy();
  expect(weaponUrl('e11')).toBe('/models/galaxy/surface/e11.lod1.glb');
}, 30000);

function posed(name, k = 0.5) {
  const mixer = new THREE.AnimationMixer(fig.model);
  mixer.clipAction(clips[name]).play();
  mixer.setTime(clips[name].duration * k);
  fig.model.updateMatrixWorld(true);
  const W = (n) => fig.model.getObjectByName(n).getWorldPosition(new THREE.Vector3());
  const root = fig.sockets.weapon;
  const barrel = new THREE.Vector3(0, 0, 1).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));
  const out = { grip: W('Wep_Root'), hand: W('RightHand'), muzzle: held.muzzleOf(fig, new THREE.Vector3()), barrel };
  mixer.stopAllAction();
  mixer.uncacheRoot(fig.model);
  return out;
}

describe('the E-11 in a snowtrooper’s hands', () => {
  for (const clip of ['aim.rifle', 'walk', 'run']) {
    it(`holds the grip in the right hand (${clip})`, () => {
      const { grip, hand } = posed(clip);
      expect(grip.distanceTo(hand)).toBeLessThan(0.15);
    });
    it(`holds the muzzle at a shoulder’s height (${clip})`, () => {
      const { muzzle } = posed(clip);
      expect(muzzle.y).toBeGreaterThan(1.2);
      expect(muzzle.y).toBeLessThan(1.6);
    });
    it(`points the barrel the way the soldier faces, +Z at yaw 0 (${clip})`, () => {
      expect(posed(clip).barrel.dot(new THREE.Vector3(0, 0, 1))).toBeGreaterThan(0.9);
    });
  }
  it('puts the muzzle ahead of the grip by the record’s reach', () => {
    const { grip, muzzle } = posed('aim.rifle');
    expect(muzzle.z - grip.z).toBeGreaterThan(0.25);
    expect(muzzle.distanceTo(grip)).toBeCloseTo(Math.hypot(0.049385, 0.298969), 3);
  });
});
