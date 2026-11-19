// You, in the pilot's seat: the 2017 game's own figure (Han, in the Falcon)
// on its whole skeleton, sat by the game's driver's clip
// (as Chewie is: ./crew.js's loadGameCrew, its light cut only), seen out of
// its own eyes. Its head is folded away to nothing (the bone scaled down:
// the game's people come with the head joined into the body, so it can't be
// hidden by its parts, lib/three/firstPerson's way), it's moved so its eyes
// are where the vehicle's eye is, and from then on the camera rides its eyes
// (scene.js's `eyeAt`), so its back bending in towards the console takes the
// view in with it. Its hands go where the vehicle says each frame, by
// two-bone IK (lib/three/ik's reach) from where the clip left them: on the
// yoke, the levers.
//
//   loadPilot(kind, { eye, hips, face, clip }) → pilot, or null where the
//     game's figure won't load (the cockpit is as it was without one)
//   pilot.set({ lean, left, right }): this frame's lean (0…1 in, under 0
//     back; the vehicle's ./hands.js) and where each hand's grip goes
//     ({ at: Vector3, w: 0…1 }, or null to leave it to the clip)
//   pilot.update(dt); pilot.eyeAt(out) → out, the eyes now; pilot.dispose()

import * as THREE from 'three';
import { loadGameCrew, nudgeWorld } from './crew';
import { reach } from '../../lib/three/ik';

// the eyes, from the head bone: ahead of it and a little up (the bone is at
// the skull's base), so the folded head is behind the camera's near plane
const AHEAD = 0.11;
const UP = 0.06;
// the lean, all the way in, shared down the back from the small of it
const LEAN = 0.3;
const BACK = [
  ['Spine', 0.4],
  ['Spine1', 0.35],
  ['Spine2', 0.25],
];
// the wrist sits this far short of where the grip is, back along the forearm
const PALM = 0.075;

const ACROSS = new THREE.Vector3(1, 0, 0);
const FWD = new THREE.Vector3(0, 0, -1);
const UPV = new THREE.Vector3(0, 1, 0);
const SIDES = {
  left: ['LeftArm', 'LeftForeArm', 'LeftHand', new THREE.Vector3(-0.7, -1, 0.35)],
  right: ['RightArm', 'RightForeArm', 'RightHand', new THREE.Vector3(0.7, -1, 0.35)],
};

export async function loadPilot(kind, { eye, hips, face = Math.PI / 2, clip = 'ride.landspeeder' }) {
  const want = { lean: 0, left: null, right: null };
  const head = new THREE.Vector3();
  const wrist = new THREE.Vector3();
  const shoulder = new THREE.Vector3();
  const pose = (b) => {
    // the back first (the arms reach from where it puts the shoulders)
    for (const [name, share] of BACK) nudgeWorld(b[name], ACROSS, -LEAN * share * want.lean);
    b.Head?.scale.setScalar(1e-3);
    for (const side of ['left', 'right']) {
      const hold = want[side];
      if (!hold || hold.w <= 0) continue;
      const [u, f, h, pole] = SIDES[side];
      if (!b[u] || !b[f] || !b[h]) continue;
      wrist.copy(b[u].getWorldPosition(shoulder)).sub(hold.at).setLength(PALM).add(hold.at);
      reach(b[u], b[f], b[h], wrist, pole, hold.w);
    }
  };
  const crew = await loadGameCrew(kind, { clip, hips, face, pose, full: false });
  if (!crew) return null;
  const { group, bones } = crew;
  if (!bones.Head) {
    crew.dispose();
    return null;
  }
  const eyesNow = (out) => {
    group.updateMatrixWorld(true);
    bones.Head.getWorldPosition(head);
    return out.copy(head).addScaledVector(FWD, AHEAD).addScaledVector(UPV, UP);
  };
  // its eyes where the vehicle's eye is, sat at rest
  crew.update(0);
  const at = eyesNow(new THREE.Vector3());
  group.position.add(new THREE.Vector3(...eye).sub(at));
  return {
    group,
    bones,
    set({ lean = 0, left = null, right = null } = {}) {
      want.lean = lean;
      want.left = left;
      want.right = right;
    },
    update(dt) {
      crew.update(dt);
    },
    eyeAt: eyesNow,
    dispose() {
      crew.dispose();
    },
  };
}
