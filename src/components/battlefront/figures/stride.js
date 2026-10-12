// A walking clip's stride, measured on the body: the clip posed across its
// length on a mixer of its own, the left foot less the right in the body's
// frame (+z ahead once facing.js has turned it) at each sample, and
// locomotion.js's strideFromSamples on those. Measured once a clip name
// (the pack's clips are the same on every body) and kept, so the first
// figure pays a few milliseconds and the rest none. The figures' phase-
// locked blend (figures.js) runs every clip at its own period from one
// phase, and starts each at its offset, so a walk and a run at the same
// phase have the same foot ahead.
//
//   measureStride(model, clip, { feet, perSecond }) → { strides, period, offset } | null
//   strideOf(model, name, clip) → the same, cached by the clip's name and length
//   forgetStrides() (tests)

import * as THREE from 'three';
import { strideFromSamples } from './locomotion.js';

export const FEET = ['LeftFoot', 'RightFoot'];
export const PER_SECOND = 24; // samples a second: the pack's own rate (scripts/bf2017-clips.mjs --fps)

const _l = new THREE.Vector3();
const _r = new THREE.Vector3();

export function measureStride(model, clip, { feet = FEET, perSecond = PER_SECOND } = {}) {
  const [L, R] = feet.map((n) => model?.getObjectByName?.(n));
  if (!L || !R || !(clip?.duration > 0)) return null;
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(clip).play();
  const n = Math.max(8, Math.round(clip.duration * perSecond));
  const samples = [];
  model.updateMatrixWorld(true);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * clip.duration;
    mixer.setTime(t);
    model.updateMatrixWorld(true);
    L.getWorldPosition(_l);
    R.getWorldPosition(_r);
    model.worldToLocal(_l);
    model.worldToLocal(_r);
    samples.push([t, _l.x - _r.x, _l.z - _r.z]);
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(model);
  return strideFromSamples(samples, clip.duration);
}

const known = new Map();
export function strideOf(model, name, clip) {
  const key = `${name}@${clip?.duration ?? 0}`;
  if (!known.has(key)) known.set(key, measureStride(model, clip));
  return known.get(key);
}
export const forgetStrides = () => known.clear();
