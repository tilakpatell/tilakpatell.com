// The strides of the humanoid pack's walking clips, measured on the
// committed body (snowtrooper.lod1.glb) in Node, as the figures measure
// them in the page: the walk holds two strides, the run and the sprint
// four, the backward walk and the crouch run one; and at the same phase a
// walk and a run have the same foot ahead, which is what lets the blend
// mix them without the feet fighting.
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { clipsFor } from '../../../lib/three/walrus.js';
import { faceAlongZ } from './facing.js';
import { parseGlb } from './fixtures/glb.js';
import { timeAt } from './locomotion.js';
import { forgetStrides, measureStride, strideOf } from './stride.js';

const DIR = 'public/models/galaxy/bf2017';
const NAMES = ['walk', 'walk.right', 'walk.back', 'walk.left', 'run', 'sprint', 'crouch.run'];

let model;
let clips;
beforeAll(async () => {
  const [body, pack] = await Promise.all(['crew/snowtrooper.lod1.glb', 'clips-humanoid.glb'].map((f) => parseGlb(`${DIR}/${f}`)));
  model = body.scene.clone(true);
  faceAlongZ(model);
  clips = clipsFor(model, new Map(pack.animations.map((c) => [c.name, c])));
}, 30000);

// the left foot's lead over the right, ahead (+z in the body's frame), at a clip's time
function lead(name, t) {
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(clips[name]).play();
  mixer.setTime(t);
  model.updateMatrixWorld(true);
  const W = (n) => model.worldToLocal(model.getObjectByName(n).getWorldPosition(new THREE.Vector3()));
  const d = W('LeftFoot').z - W('RightFoot').z;
  mixer.stopAllAction();
  mixer.uncacheRoot(model);
  return d;
}

describe('the pack’s strides on the body', () => {
  it('counts the strides each clip holds, and their period', () => {
    const got = Object.fromEntries(NAMES.map((n) => [n, measureStride(model, clips[n])]));
    const strides = Object.fromEntries(Object.entries(got).map(([n, s]) => [n, s?.strides]));
    expect(strides).toEqual({ walk: 2, 'walk.right': 2, 'walk.back': 1, 'walk.left': 2, run: 4, sprint: 4, 'crouch.run': 1 });
    for (const [n, s] of Object.entries(got)) {
      expect(s.period, n).toBeCloseTo(clips[n].duration / s.strides, 9);
      expect(s.offset, n).toBeGreaterThanOrEqual(0);
      expect(s.offset, n).toBeLessThan(s.period);
    }
    // (the walk's stride near a second, the run's and the sprint's quicker)
    expect(got.walk.period).toBeCloseTo(0.967, 2);
    expect(got.run.period).toBeCloseTo(0.717, 2);
    expect(got.sprint.period).toBeCloseTo(0.583, 2);
  });

  it('puts the same foot ahead at the same phase in every forward gait', () => {
    for (const name of ['walk', 'run', 'sprint', 'crouch.run', 'walk.back']) {
      const s = measureStride(model, clips[name]);
      // (a quarter stride past the feet passing with the left going ahead: the left leads; three quarters: the right)
      expect(lead(name, timeAt(s, 0.25, clips[name].duration)), `${name} at 0.25`).toBeGreaterThan(0.1);
      expect(lead(name, timeAt(s, 0.75, clips[name].duration)), `${name} at 0.75`).toBeLessThan(-0.1);
    }
  });

  it('measures a clip once by name and length, and nothing on a body without feet', () => {
    forgetStrides();
    const a = strideOf(model, 'walk', clips.walk);
    expect(strideOf(model, 'walk', clips.walk)).toBe(a);
    expect(measureStride(new THREE.Group(), clips.walk)).toBe(null);
    // (a clip whose feet stay put: the idle)
    expect(measureStride(model, clips.idle)).toBe(null);
  });
});
