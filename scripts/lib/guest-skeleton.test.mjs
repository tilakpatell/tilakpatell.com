import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BODY, checkWalrus, isWalrus } from '../../src/lib/three/walrusRig.js';
import { glbJson } from './bf2017-paths.mjs';
import { meshyRig as made } from './fixtures/meshy-rig.mjs';
import { JOINT_MAP, fitSkeleton, legRatio, measure, rowsOf, turnsOf, worldsOf } from './guest-skeleton.mjs';

const rows = (file) => rowsOf(glbJson(readFileSync(file)));
const WALRUS = rows('public/models/galaxy/bf2017/walrus.glb');
const RICK = rows('public/games/meshy/rick.glb');
const MORTY = rows('public/games/meshy/morty.glb');

const at = (worlds, name) => new THREE.Vector3().setFromMatrixPosition(worlds.get(name));
const dir = (worlds, a, b) => at(worlds, b).sub(at(worlds, a)).normalize();
const degrees = (a, b) => (Math.acos(Math.min(1, a.dot(b))) * 180) / Math.PI;

describe('the joint map, read from the hierarchy', () => {
  it('climbs Meshy’s back in the file’s own order, whatever the joints are called', () => {
    const map = JOINT_MAP(RICK);
    // (Meshy numbers them downward: Spine02 is the lowest, Spine the chest)
    expect([map.get('Spine02'), map.get('Spine01'), map.get('Spine')]).toEqual(['Spine', 'Spine1', 'Spine2']);
    expect(map.get('neck')).toBe('Neck');
    expect(map.get('Head')).toBe('Head');
    const shuffled = JOINT_MAP(made(['B', 'A', 'C']));
    expect([shuffled.get('B'), shuffled.get('A'), shuffled.get('C')]).toEqual(['Spine', 'Spine1', 'Spine2']);
  });

  it('maps the limbs one for one, and leaves the head’s two helpers without a counterpart', () => {
    const map = JOINT_MAP(MORTY);
    for (const side of ['Left', 'Right']) for (const n of ['Shoulder', 'Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg', 'Foot', 'ToeBase']) expect(map.get(side + n)).toBe(side + n);
    expect(map.has('head_end')).toBe(false);
    expect(map.has('headfront')).toBe(false);
    expect(map.size).toBe(22);
    // (every counterpart is one of the game's body bones)
    for (const to of map.values()) expect(BODY).toContain(to);
  });

  it('refuses a back that is not three joints long', () => {
    const short = made().filter((r) => r.name !== 'A').map((r) => (r.parent === 'A' ? { ...r, parent: 'B' } : r));
    expect(() => JOINT_MAP(short)).toThrow(/three/);
  });
});

describe('a guest, measured', () => {
  it('reads Rick’s and Morty’s limbs off their files', () => {
    const rick = measure(RICK);
    expect(rick.segments.thigh).toBeCloseTo(0.369, 2);
    expect(Math.abs(rick.segments.thigh - 0.369)).toBeLessThan(0.005);
    expect(Math.abs(rick.segments.shin - 0.363)).toBeLessThan(0.005);
    expect(Math.abs(rick.hipsHeight - 0.93)).toBeLessThan(0.005);
    const morty = measure(MORTY);
    expect(Math.abs(morty.segments.thigh - 0.301)).toBeLessThan(0.005);
    expect(Math.abs(morty.segments.shin - 0.276)).toBeLessThan(0.005);
    expect(Math.abs(morty.hipsHeight - 0.75)).toBeLessThan(0.005);
    // (the survey's arms, too)
    expect(Math.abs(rick.segments.upperArm - 0.253)).toBeLessThan(0.005);
    expect(Math.abs(rick.segments.forearm - 0.266)).toBeLessThan(0.005);
    expect(Math.abs(morty.segments.upperArm - 0.219)).toBeLessThan(0.005);
    expect(Math.abs(morty.segments.forearm - 0.181)).toBeLessThan(0.005);
  });

  it('stands as tall as its crown joint without the mesh, and as its mesh with it', () => {
    // (the file's own numbers: Rick's crown joint 1.702 m, Morty's 1.487)
    expect(measure(RICK).height).toBeCloseTo(1.702, 2);
    expect(measure(MORTY).height).toBeCloseTo(1.487, 2);
    // a surface from the floor to 1.8 m, one vertex wholly the left hand's, 0.2 m off its wrist
    const hand = worldsOf(RICK).get('LeftHand').elements;
    const names = ['Hips', 'LeftHand'];
    const surface = { positions: [0, 0, 0, 0, 1.8, 0, hand[12] + 0.2, hand[13], hand[14]], skinIndex: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], skinWeight: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], joints: names };
    const m = measure(RICK, surface);
    expect(m.height).toBeCloseTo(1.8, 6);
    expect(m.segments.hand).toBeCloseTo(0.2, 6);
  });

  it('measures both sides and gives their mean', () => {
    const lop = made().map((r) => (r.name === 'LeftLeg' ? { ...r, translation: [0, -40, 0] } : r));
    expect(measure(lop).segments.thigh).toBeCloseTo(0.38, 6);
  });

  it('keeps each joint where the file has it, over the sole, by the game’s name', () => {
    const m = measure(RICK);
    expect(m.joints.Spine2[1]).toBeCloseTo(1.2509, 3);
    expect(m.joints.Spine[1]).toBeCloseTo(1.0382, 3);
    expect(m.joints.head_end[1]).toBeCloseTo(1.7018, 3);
  });
});

describe('the game’s skeleton, fitted to a guest', () => {
  for (const [who, file] of [['Rick', RICK], ['Morty', MORTY]]) {
    const m = measure(file);
    const fitted = fitSkeleton(WALRUS, m);
    const worlds = worldsOf(fitted);
    const game = worldsOf(WALRUS);

    it(`${who}: has every one of the game’s 254 names once, and the head’s two helpers`, () => {
      expect(fitted.length).toBe(256);
      const names = fitted.map((n) => n.name);
      expect(new Set(names).size).toBe(256);
      for (const n of WALRUS) expect(names).toContain(n.name);
      expect(fitted.find((n) => n.name === 'head_end').parent).toBe('Head');
      expect(fitted.find((n) => n.name === 'headfront').parent).toBe('Head');
      const check = checkWalrus(names);
      expect(check.ok).toBe(true);
      expect(check.missing).toEqual([]);
      expect(isWalrus(names)).toBe(true);
    });

    it(`${who}: keeps the game’s tree and its rest rotations to the bit, with no scale anywhere`, () => {
      for (const g of WALRUS) {
        const f = fitted.find((n) => n.name === g.name);
        expect(f.parent).toBe(g.parent);
        expect(f.rotation).toEqual(g.rotation);
        expect(f.scale).toEqual([1, 1, 1]);
      }
    });

    it(`${who}: stands with its hips at its own height and its soles on the ground`, () => {
      expect(Math.abs(at(worlds, 'Hips').y - m.hipsHeight)).toBeLessThan(0.01);
      // (a foot is not turned, so its ankle is as high over the sole as the file has it)
      const soles = ['Left', 'Right'].map((s) => at(worlds, `${s}Foot`).y - m.joints[`${s}Foot`][1]);
      expect(Math.abs(soles[0] + soles[1]) / 2).toBeLessThan(1e-6);
      for (const y of soles) expect(Math.abs(y)).toBeLessThan(0.005);
      for (const s of ['Left', 'Right']) expect(at(worlds, `${s}ToeBase`).y).toBeLessThan(0.04);
      // (and on the figure's middle: the hip joints either side of x = 0)
      expect(Math.abs(at(worlds, 'LeftUpLeg').x + at(worlds, 'RightUpLeg').x)).toBeLessThan(1e-6);
    });

    it(`${who}: has limbs as long as its own, pointing as the game’s do at rest`, () => {
      const own = (a, b) => new THREE.Vector3(...m.joints[b]).distanceTo(new THREE.Vector3(...m.joints[a]));
      for (const s of ['Left', 'Right'])
        for (const [a, b] of [['UpLeg', 'Leg'], ['Leg', 'Foot'], ['Foot', 'ToeBase'], ['Shoulder', 'Arm'], ['Arm', 'ForeArm'], ['ForeArm', 'Hand']]) {
          expect(at(worlds, s + b).distanceTo(at(worlds, s + a)), `${s}${a}`).toBeCloseTo(own(s + a, s + b), 5);
        }
      // (the two sides of Meshy's rig differ by a few degrees; the mean of them is turned onto the game's)
      for (const s of ['Left', 'Right'])
        for (const [a, b] of [['UpLeg', 'Leg'], ['Leg', 'Foot'], ['Arm', 'ForeArm'], ['ForeArm', 'Hand']]) {
          expect(degrees(dir(worlds, s + a, s + b), dir(game, s + a, s + b)), `${s}${a}`).toBeLessThan(6);
        }
      const mean = (a, b) => dir(worlds, `Left${a}`, `Left${b}`).add(dir(worlds, `Right${a}`, `Right${b}`).multiply(new THREE.Vector3(-1, 1, 1))).normalize();
      for (const [a, b] of [['UpLeg', 'Leg'], ['Leg', 'Foot'], ['Arm', 'ForeArm'], ['ForeArm', 'Hand']]) expect(degrees(mean(a, b), dir(game, `Left${a}`, `Left${b}`)), a).toBeLessThan(0.5);
    });

    it(`${who}: keeps its own trunk, shoulders and head as the file has them`, () => {
      const own = (a, b) => new THREE.Vector3(...m.joints[b]).sub(new THREE.Vector3(...m.joints[a]));
      for (const [a, b] of [['Hips', 'Spine'], ['Spine', 'Spine1'], ['Spine1', 'Spine2'], ['Spine2', 'Neck'], ['Neck', 'Head'], ['Spine2', 'LeftShoulder'], ['LeftShoulder', 'LeftArm'], ['Spine2', 'RightArm'], ['Hips', 'LeftUpLeg'], ['Head', 'head_end'], ['Head', 'headfront'], ['LeftFoot', 'LeftToeBase']]) {
        expect(at(worlds, b).sub(at(worlds, a)).distanceTo(own(a, b)), `${a} to ${b}`).toBeLessThan(1e-6);
      }
      // (the game's second neck joint, which Meshy has none for, on the way from the neck to the head)
      const n = at(worlds, 'Neck1');
      expect(n.distanceTo(at(worlds, 'Neck')) + n.distanceTo(at(worlds, 'Head'))).toBeCloseTo(at(worlds, 'Head').distanceTo(at(worlds, 'Neck')), 6);
    });

    it(`${who}: leaves the sockets at the game’s rest, and sizes fingers, face and weapon bones by the hand and the head`, () => {
      for (const n of ['Wep_Root', 'Wep2_Root']) expect(at(worlds, n).distanceTo(at(game, n))).toBeLessThan(1e-6);
      for (const n of ['IK_Joint_LeftHand', 'IK_Joint_RightHand']) expect(at(worlds, n).distanceTo(at(worlds, 'Wep_Root'))).toBeLessThan(1e-6);
      const t = (rowsIn, name) => new THREE.Vector3(...rowsIn.find((r) => r.name === name).translation).length();
      const hand = m.segments.hand / at(game, 'LeftHandMiddle4').distanceTo(at(game, 'LeftHand'));
      const skull = m.segments.skull / t(WALRUS, 'HeadEnd');
      expect(t(fitted, 'RightHandIndex2') / t(WALRUS, 'RightHandIndex2')).toBeCloseTo(hand, 6);
      expect(t(fitted, 'Wep_Muzzle') / t(WALRUS, 'Wep_Muzzle')).toBeCloseTo(hand, 6);
      expect(t(fitted, 'FACIAL_LOD1_C_Jaw') / t(WALRUS, 'FACIAL_LOD1_C_Jaw')).toBeCloseTo(skull, 6);
      expect(t(fitted, 'HeadEnd') / t(WALRUS, 'HeadEnd')).toBeCloseTo(skull, 6);
    });

    it(`${who}: says the legs' ratio the clips are refit by`, () => {
      const k = legRatio(WALRUS, fitted);
      const hip = (w) => (at(w, 'LeftUpLeg').y + at(w, 'RightUpLeg').y) / 2;
      expect(k).toBeCloseTo(hip(worlds) / hip(game), 9);
      expect(k).toBeGreaterThan(0.6);
      expect(k).toBeLessThan(1);
    });
  }

  it('turns only the long bones of the limbs, the hand with its forearm', () => {
    const turns = turnsOf(measure(RICK).joints, WALRUS);
    expect(Object.keys(turns).sort()).toEqual(['Left', 'Right'].flatMap((s) => ['Arm', 'ForeArm', 'Hand', 'Leg', 'UpLeg'].map((n) => s + n)).sort());
    expect(turns.LeftHand.toArray()).toEqual(turns.LeftForeArm.toArray());
    // (a mirror image either side, as near as the game's own two sides are: the mesh stays as even as it was made)
    expect(turns.LeftArm.x).toBeCloseTo(turns.RightArm.x, 4);
    expect(turns.LeftArm.y).toBeCloseTo(-turns.RightArm.y, 4);
    expect(turns.LeftArm.z).toBeCloseTo(-turns.RightArm.z, 4);
  });

  it('reads the same turns off a fitted skeleton as off the game’s, though a guest’s two sides differ', () => {
    // (Morty's two shins are 9° apart in his file: a fitted skeleton's joints are not where the game's bones point)
    const m = measure(MORTY);
    const a = turnsOf(m.joints, WALRUS);
    const b = turnsOf(m.joints, fitSkeleton(WALRUS, m));
    for (const n of Object.keys(a)) expect(a[n].angleTo(b[n]), n).toBeLessThan(1e-6);
  });

  it('gives the same skeleton for the same file, every time', () => {
    expect(fitSkeleton(WALRUS, measure(RICK))).toEqual(fitSkeleton(WALRUS, measure(RICK)));
  });

  it('is a third shorter in the leg for Morty than the game’s man', () => {
    const k = legRatio(WALRUS, fitSkeleton(WALRUS, measure(MORTY)));
    expect(k).toBeGreaterThan(0.68);
    expect(k).toBeLessThan(0.76);
  });
});
