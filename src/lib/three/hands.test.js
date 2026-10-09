import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { POSES } from './handPoses';
import { NO_HANDS, createHands, fingerOf } from './hands';
import { meshyRig } from './meshyRig.fixture';

const V = THREE.Vector3;
const yOf = (b) => new V(0, 1, 0).applyQuaternion(b.getWorldQuaternion(new THREE.Quaternion()));
const at = (b) => b.getWorldPosition(new V());
// the bend at a joint: its bone's line against the one before it
const bend = (a, b) => yOf(a).angleTo(yOf(b));
const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'];

function rigged(opts = { fingers: true }) {
  const rig = meshyRig(opts);
  const hands = createHands(rig.model);
  return { rig, hands, b: rig.bones };
}

describe('fingerOf', () => {
  it('reads a finger bone’s side, finger and joint from any rig’s name', () => {
    expect(fingerOf('LeftHandIndex2')).toEqual({ side: 'L', finger: 'index', joint: 2 });
    expect(fingerOf('mixamorig:RightHandThumb1_12')).toEqual({ side: 'R', finger: 'thumb', joint: 1 });
    expect(fingerOf('LeftHandFingers1')).toEqual({ side: 'L', finger: 'fingers', joint: 1 });
    expect(fingerOf('index_03_l')).toEqual({ side: 'L', finger: 'index', joint: 3 });
    expect(fingerOf('thumb_01_r_0129')).toEqual({ side: 'R', finger: 'thumb', joint: 1 });
    expect(fingerOf('f_middle02L')).toEqual({ side: 'L', finger: 'middle', joint: 2 });
    expect(fingerOf('DEF-thumb01R')).toEqual({ side: 'R', finger: 'thumb', joint: 1 });
    expect(fingerOf('L_Finger02_Index01_XL2_11')).toEqual({ side: 'L', finger: 'index', joint: 1 });
    expect(fingerOf('Little2_Finger.l_14')).toEqual({ side: 'L', finger: 'pinky', joint: 2 });
    expect(fingerOf('LeftHandIndex4')).toBeNull(); // (Mixamo's tip, weighted to nothing)
    expect(fingerOf('L_Finger01_Thumb02_XL2_end_0228')).toBeNull();
    expect(fingerOf('index_metacarpal_l')).toBeNull();
    expect(fingerOf('LeftHand')).toBeNull();
  });
});

describe('createHands', () => {
  it('finds both hands’ fingers on a figure that has them, and nothing on one that doesn’t', () => {
    const { hands } = rigged();
    expect(hands.has).toBe(true);
    expect(hands.sides).toEqual({ L: true, R: true });
    const bare = createHands(meshyRig().model);
    expect(bare).toBe(NO_HANDS);
    expect(() => {
      bare.set('L', POSES.fist);
      bare.hold('R', 0.02);
      bare.after(0.1);
      bare.release('L');
      bare.dispose();
    }).not.toThrow();
    expect(bare.curl('L')).toBeNull();
  });

  it('closes every joint of a fist by the table, toward the palm', () => {
    const { hands, b } = rigged();
    const tip0 = at(b.LeftHandIndex3);
    hands.set('L', POSES.fist);
    hands.set('R', POSES.fist);
    hands.after(10);
    for (const side of ['Left', 'Right']) {
      for (const f of FINGERS) {
        const want = POSES.fist[f.toLowerCase()];
        expect(bend(b[`${side}Hand${f}1`], b[`${side}Hand${f}2`])).toBeCloseTo(want[1], 3);
        expect(bend(b[`${side}Hand${f}2`], b[`${side}Hand${f}3`])).toBeCloseTo(want[2], 3);
        // (the first joint against the hand’s own line: the fixture’s fingers rest straight down it)
        expect(bend(b[`${side}Hand`], b[`${side}Hand${f}1`])).toBeCloseTo(want[0], 2);
      }
      expect(bend(b[`${side}HandThumb1`], b[`${side}HandThumb2`])).toBeCloseTo(POSES.fist.thumb[1], 3);
    }
    // the back of the left hand is its bone's −x: a closed finger's tip goes the other way
    const palmward = new V(1, 0, 0).applyQuaternion(b.LeftHand.getWorldQuaternion(new THREE.Quaternion()));
    expect(at(b.LeftHandIndex3).sub(tip0).dot(palmward)).toBeGreaterThan(0.01);
    expect(hands.curl('L').index).toEqual(POSES.fist.index);
  });

  it('straightens them again to open', () => {
    const { hands, b } = rigged();
    hands.set('L', POSES.fist);
    hands.after(10);
    hands.set('L', POSES.open);
    hands.after(10);
    for (const f of FINGERS) expect(bend(b[`LeftHand${f}1`], b[`LeftHand${f}3`])).toBeLessThan(1e-3);
  });

  it('eases toward a pose at its rate: half way after ln 2 / rate seconds', () => {
    const { hands } = rigged();
    hands.set('L', POSES.open);
    hands.after(10);
    hands.set('L', POSES.fist, { rate: 14 });
    hands.after(Math.LN2 / 14);
    expect(hands.curl('L').index[1]).toBeCloseTo(POSES.fist.index[1] / 2, 6);
    expect(hands.curl('R').index).toEqual(POSES.relaxed.index); // (the other hand rests)
  });

  it('rests at relaxed before it is asked for anything', () => {
    const { hands, b } = rigged();
    hands.after(1 / 60);
    expect(bend(b.LeftHandMiddle1, b.LeftHandMiddle2)).toBeCloseTo(POSES.relaxed.middle[1], 3);
  });

  it('takes a blend of two poses', () => {
    const { hands } = rigged();
    hands.set('L', { from: POSES.open, to: POSES.fist, k: 0.25 });
    hands.after(10);
    expect(hands.curl('L').ring[0]).toBeCloseTo(POSES.fist.ring[0] / 4, 9);
  });

  it('holds a thin grip closer than a thick one, and lets go to rest', () => {
    const { hands } = rigged();
    hands.hold('L', 0.012);
    hands.hold('R', 0.03);
    hands.after(10);
    const sum = (c) => c.middle.reduce((a, x) => a + x, 0);
    expect(sum(hands.curl('L'))).toBeGreaterThan(sum(hands.curl('R')) + 0.3);
    hands.release('L');
    hands.after(10);
    expect(hands.curl('L').middle).toEqual(POSES.relaxed.middle);
  });

  it('closes a mitten as far as the four fingers would, on the mean', () => {
    const { hands, b } = rigged({ fingers: 'mitten' });
    expect(hands.has).toBe(true);
    hands.set('L', POSES.fist);
    hands.after(10);
    const mean = FINGERS.reduce((s, f) => s + POSES.fist[f.toLowerCase()].reduce((a, x) => a + x, 0), 0) / 4;
    const c = hands.curl('L').fingers;
    expect(c[0] + c[1]).toBeCloseTo(mean, 9);
    expect(bend(b.LeftHandFingers1, b.LeftHandFingers2)).toBeCloseTo(c[1], 3);
  });

  it('fans the fingers apart for a spread, the index toward the thumb', () => {
    const { hands, b } = rigged();
    hands.set('L', POSES.open);
    hands.after(10);
    const before = bend(b.LeftHandIndex1, b.LeftHandPinky1);
    const index0 = at(b.LeftHandIndex3);
    hands.set('L', POSES.spread);
    hands.after(10);
    expect(bend(b.LeftHandIndex1, b.LeftHandPinky1)).toBeGreaterThan(before + 0.4);
    const thumbward = at(b.LeftHandIndex1).sub(at(b.LeftHandPinky1)).normalize(); // (across the knuckles, the thumb's way)
    expect(at(b.LeftHandIndex3).sub(index0).dot(thumbward)).toBeGreaterThan(0.005);
  });

  it('finds a Mixamo figure’s fingers by their names', () => {
    const rig = meshyRig({ fingers: true });
    Object.values(rig.bones).forEach((bone, i) => (bone.name = `mixamorig:${bone.name}_${i}`));
    const hands = createHands(rig.model);
    expect(hands.sides).toEqual({ L: true, R: true });
    hands.set('R', POSES.fist);
    hands.after(10);
    expect(bend(rig.bones.RightHandIndex1, rig.bones.RightHandIndex2)).toBeCloseTo(POSES.fist.index[1], 3);
  });

  it('bends a rig whose finger bones rest in frames of their own by the same table', () => {
    const rig = meshyRig({ fingers: true });
    // each finger bone turned in place (its children put back where they were): a rig whose +y isn't down the finger
    const turn = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.7, -1.1, 0.4));
    for (const bone of Object.values(rig.bones).filter((x) => /Hand(Thumb|Index|Middle|Ring|Pinky)\d/.test(x.name))) {
      bone.quaternion.multiply(turn);
      const back = turn.clone().invert();
      for (const c of bone.children) {
        c.position.applyQuaternion(back);
        c.quaternion.premultiply(back);
      }
    }
    rig.model.updateMatrixWorld(true);
    const hands = createHands(rig.model, { canonical: false });
    hands.set('L', POSES.fist);
    hands.after(10);
    const seg = (a, b) => at(rig.bones[b]).sub(at(rig.bones[a]));
    expect(seg('LeftHandIndex1', 'LeftHandIndex2').angleTo(seg('LeftHandIndex2', 'LeftHandIndex3'))).toBeCloseTo(POSES.fist.index[1], 3);
    expect(seg('LeftHandMiddle1', 'LeftHandMiddle2').angleTo(seg('LeftHandMiddle2', 'LeftHandMiddle3'))).toBeCloseTo(POSES.fist.middle[1], 3);
  });

  it('puts every finger back as it rested when disposed', () => {
    const { hands, b } = rigged();
    const rest = b.LeftHandIndex2.quaternion.clone();
    hands.set('L', POSES.fist);
    hands.after(10);
    hands.dispose();
    expect(b.LeftHandIndex2.quaternion.angleTo(rest)).toBeLessThan(1e-9);
  });
});
