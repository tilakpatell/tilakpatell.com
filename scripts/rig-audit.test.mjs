import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FINGER_NAMES, meshyRig } from '../src/lib/three/meshyRig.fixture.js';
import { EXPECTED, audit, familyOf, fingerJoints, glbJson, profileOf, readRig, slipped, table, twistJoints, withExtras } from './rig-audit.mjs';

const reader = async () => {
  await MeshoptDecoder.ready;
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
};

// every bone's place in the world at rest, by name, as profileOf takes it
const worldJoints = (rig) => Object.fromEntries(Object.entries(rig.bones).map(([n, b]) => [n, b.getWorldPosition(new THREE.Vector3()).toArray()]));

// the fixture as a file: its bones as nodes, and a skinned mesh of two
// triangles, one on the head (its top at `top` in the world) and one on the
// left toe at the floor, bound as a quantized Meshy file is: each inverse
// bind matrix carries a scale the positions are divided by
function fixtureDoc({ top = 1.75, scale = 50, profile = null } = {}) {
  const rig = meshyRig();
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();
  doc.getRoot().setDefaultScene(scene);
  if (profile) scene.setExtras({ profile });
  const nodes = new Map();
  const add = (o, parent) => {
    const n = doc.createNode(o.name).setTranslation(o.position.toArray()).setRotation(o.quaternion.toArray()).setScale(o.scale.toArray());
    nodes.set(o, n);
    (parent ?? scene).addChild(n);
    for (const c of o.children) add(c, n);
  };
  add(rig.armature, null);
  const bones = Object.values(rig.bones);
  const joints = bones.map((b) => nodes.get(b));
  const acc = (a, type) => doc.createAccessor().setArray(a).setType(type).setBuffer(buffer);
  const S = new THREE.Matrix4().makeScale(scale, scale, scale);
  const ibm = new Float32Array(16 * bones.length);
  bones.forEach((b, j) => ibm.set(b.matrixWorld.clone().invert().multiply(S).elements, j * 16));
  // a point in the world, bound to joint j: S⁻¹ · it
  const at = (x, y, z) => [x / scale, y / scale, z / scale];
  const head = bones.findIndex((b) => b.name === 'Head');
  const toe = bones.findIndex((b) => b.name === 'LeftToeBase');
  const pos = new Float32Array([...at(0, top, 0), ...at(0.05, top - 0.1, 0), ...at(-0.05, top - 0.1, 0), ...at(0.2, 0, 0.1), ...at(0.25, 0, 0.1), ...at(0.2, 0.05, 0)]);
  const ji = new Uint16Array([head, 0, 0, 0, head, 0, 0, 0, head, 0, 0, 0, toe, 0, 0, 0, toe, 0, 0, 0, toe, 0, 0, 0]);
  const w = new Float32Array(24);
  for (let v = 0; v < 6; v++) w[v * 4] = 1;
  const prim = doc.createPrimitive().setAttribute('POSITION', acc(pos, 'VEC3')).setAttribute('JOINTS_0', acc(ji, 'VEC4')).setAttribute('WEIGHTS_0', acc(w, 'VEC4'));
  const skin = doc.createSkin().setInverseBindMatrices(acc(ibm, 'MAT4'));
  for (const j of joints) skin.addJoint(j);
  scene.addChild(doc.createNode('body').setMesh(doc.createMesh().addPrimitive(prim)).setSkin(skin));
  return doc;
}

describe('familyOf', () => {
  const meshy = Object.keys(meshyRig().bones);
  it('reads Meshy’s skeleton, without and with fingers', () => {
    expect(familyOf(meshy)).toBe('meshy24');
    expect(familyOf(Object.keys(meshyRig({ fingers: true }).bones))).toBe('meshy54');
    expect(familyOf([...meshy, 'LeftHandFingers1', 'LeftHandFingers2'])).toBe('meshy54');
  });
  it('reads the other rigs by their names', () => {
    expect(familyOf(['mixamorig:Hips_52', 'mixamorig:Spine_51', 'mixamorig:LeftArm_16', 'mixamorig:LeftHandIndex1_7'])).toBe('mixamo');
    expect(familyOf(['Hips', 'Spine', 'Spine1', 'Head', 'HeadTop_End', 'LeftArm', 'LeftForeArm', 'LeftHandIndex1'])).toBe('mixamo');
    expect(familyOf(['pelvis', 'spine_01', 'upperarm_l', 'thigh_l', 'index_01_l'])).toBe('unreal');
    expect(familyOf(['upper_armL', 'forearmL', 'handL', 'f_index01L', 'thumb01L'])).toBe('rigify');
    expect(familyOf(['C_Spine00_Hips_XB_03', 'L_Arm02_Shoulder_XB_23', 'L_Finger02_Index01_XL2_11'])).toBe('highmoon');
    expect(familyOf(['Hipcon_57', 'Humerus.l_22', 'Hand.l_21', 'Index1_Finger.l_9'])).toBe('prime');
    expect(familyOf(['Bone', 'Bone.001', 'HipFront.L_04'])).toBe('none');
  });
});

describe('fingerJoints and twistJoints', () => {
  it('count the bones that bend a finger, never an end bone', () => {
    expect(fingerJoints(Object.keys(meshyRig({ fingers: true }).bones)).length).toBe(28);
    expect(fingerJoints(['mixamorig:LeftHandIndex1_7', 'mixamorig:LeftHandIndex4_9', 'mixamorig:LeftHand_14'])).toEqual(['mixamorig:LeftHandIndex1_7']);
    expect(fingerJoints(['L_Finger01_Thumb02_XL2_016', 'L_Finger01_Thumb02_XL2_end_0228', 'index_metacarpal_l', 'thumb_01_l'])).toEqual(['L_Finger01_Thumb02_XL2_016', 'thumb_01_l']);
    expect(fingerJoints(['Middle1_Finger.l_6', 'f_index01L', 'Right_Index_001_016', 'Bip001 R Finger01_023'])).toHaveLength(4);
  });
  it('count the twist bones', () => {
    expect(twistJoints(['lowerarm_twist_01_l', 'upperarm_twist_01_r', 'LeftForeArmTwist', 'LeftForeArm'])).toHaveLength(3);
  });
});

describe('the fixture’s fingers', () => {
  it('stand in the canonical frame: +y to the next joint, +z out of the back of the hand', () => {
    const rig = meshyRig({ fingers: true });
    expect(FINGER_NAMES).toHaveLength(28);
    expect(Object.keys(rig.bones)).toEqual([...Object.keys(meshyRig().bones), ...FINGER_NAMES]);
    for (const side of ['Left', 'Right']) {
      const back = new THREE.Vector3(side === 'Left' ? -1 : 1, 0, 0).applyQuaternion(rig.bones[`${side}Hand`].getWorldQuaternion(new THREE.Quaternion()));
      for (const f of ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb']) {
        const b = rig.bones[`${side}Hand${f}1`];
        const q = b.getWorldQuaternion(new THREE.Quaternion());
        const y = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
        const z = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
        const next = rig.bones[`${side}Hand${f}2`].getWorldPosition(new THREE.Vector3()).sub(b.getWorldPosition(new THREE.Vector3())).normalize();
        expect(y.dot(next)).toBeGreaterThan(0.9999);
        expect(z.dot(back)).toBeGreaterThan(0.99);
      }
    }
  });
  it('leaves the 24 bones as they were, and a hand left out takes its fingers with it', () => {
    const a = meshyRig();
    const b = meshyRig({ fingers: true });
    for (const n of Object.keys(a.bones)) expect(b.bones[n].getWorldPosition(new THREE.Vector3()).distanceTo(a.bones[n].getWorldPosition(new THREE.Vector3()))).toBeLessThan(1e-9);
    expect(Object.keys(meshyRig({ fingers: true, without: ['LeftHand'] }).bones).filter((n) => n.startsWith('LeftHand'))).toEqual([]);
  });
});

describe('profileOf', () => {
  const rest = worldJoints(meshyRig({ fingers: true }));
  it('measures the body at rest from its joints, in metres', () => {
    const p = profileOf({ joints: rest });
    // (no mesh: the head's end to the toes; Luke's mesh, with his hair, is 1.72)
    expect(p.height).toBeCloseTo(1.67, 1);
    expect(Math.abs(p.height - 1.67)).toBeLessThan(0.02);
    expect(p.leg).toBeCloseTo(0.742, 2);
    expect(p.arm).toBeCloseTo(0.47, 2);
    expect(p.headR).toBeCloseTo(0.1118, 3);
    expect(p.hips).toBeCloseTo(rest.Hips[1], 2);
    expect(p.shoulders).toBeGreaterThan(0.25);
    expect(p.shoulders).toBeLessThan(0.45);
    expect(p.hand).toBeGreaterThan(0.12);
    expect(p.hand).toBeLessThan(0.22);
  });
  it('takes the height and the floor from the skinned box when there is one', () => {
    const p = profileOf({ joints: rest, box: { min: [-0.3, -0.02, -0.2], max: [0.3, 1.7, 0.2] } });
    expect(p.height).toBeCloseTo(1.72, 3);
    expect(p.hips).toBeCloseTo(rest.Hips[1] + 0.02, 2);
  });
  it('leaves out what the rig has no bones for', () => {
    const p = profileOf({ joints: { Hips: [0, 1, 0], Head: [0, 1.5, 0] }, box: { min: [0, 0, 0], max: [1, 1.7, 1] } });
    expect(p.height).toBeCloseTo(1.7, 3);
    expect(p.leg).toBeNull();
    expect(p.arm).toBeNull();
    expect(p.hand).toBeNull();
    expect(p.headR).toBeCloseTo(0.1, 3);
  });
  it('takes a measured hand and head over the joints’ guesses, and never a head below nothing', () => {
    const p = profileOf({ joints: rest, hand: 0.2, head: 0.13 });
    expect(p.hand).toBe(0.2);
    expect(p.headR).toBe(0.13);
    expect(profileOf({ joints: { Head: [0, 2, 0] }, box: { min: [0, 0, 0], max: [1, 1.7, 1] } }).headR).toBeNull();
  });
});

describe('readRig', () => {
  it('reads a skinned file through its inverse bind matrices', () => {
    const r = readRig(fixtureDoc({ top: 1.75 }), { file: 'fixture.glb' });
    expect(r).toMatchObject({ file: 'fixture.glb', family: 'meshy24', joints: 24, fingers: 0, twists: 0, clips: 0, tris: 2, textures: 0, stored: false });
    expect(r.profile.height).toBeCloseTo(1.75, 2);
    expect(r.profile.leg).toBeCloseTo(0.742, 2);
    // (the head's own vertices: 0.1 m from chin to crown)
    expect(r.profile.headR).toBeCloseTo(0.05, 3);
  });
  it('says when the file already keeps a profile', () => {
    expect(readRig(fixtureDoc({ profile: { height: 1 } })).stored).toBe(true);
  });
  it('reads Luke at 1.72 m on 24 bones', async () => {
    const doc = await (await reader()).read('public/models/galaxy/crew/luke.glb');
    const r = readRig(doc);
    expect(r.family).toBe('meshy24');
    expect(r.joints).toBe(24);
    expect(Math.abs(r.profile.height - 1.72)).toBeLessThan(0.02);
    expect(r.profile.headR / r.profile.height).toBeLessThan(0.11);
  });
});

describe('withExtras', () => {
  it('writes the default scene’s extras and leaves the binary chunk as it was', async () => {
    const io = await reader();
    const bytes = await io.writeBinary(fixtureDoc());
    const out = withExtras(bytes, { profile: { height: 1.75 } });
    expect(glbJson(out).scenes[0].extras).toEqual({ profile: { height: 1.75 } });
    const bin = (b) => {
      const len = new DataView(b.buffer, b.byteOffset).getUint32(12, true);
      return Buffer.from(b.subarray(20 + len));
    };
    expect(bin(out).equals(bin(bytes))).toBe(true);
    expect(out.byteLength % 4).toBe(0);
    const back = await io.readBinary(out);
    expect(back.getRoot().getDefaultScene().getExtras()).toEqual({ profile: { height: 1.75 } });
    expect(readRig(back).stored).toBe(true);
  });
  it('keeps the extras the scene already has', async () => {
    const bytes = await (await reader()).writeBinary(fixtureDoc());
    const once = withExtras(bytes, { hands: { L: 'x' } });
    expect(glbJson(withExtras(once, { profile: { height: 2 } })).scenes[0].extras).toEqual({ hands: { L: 'x' }, profile: { height: 2 } });
  });
  it('works on a real figure file', async () => {
    const bytes = new Uint8Array(await readFile('public/models/galaxy/crew/luke.glb'));
    const back = await (await reader()).readBinary(withExtras(bytes, { profile: { height: 1.72 } }));
    expect(back.getRoot().listSkins()[0].listJoints()).toHaveLength(24);
    expect(back.getRoot().getDefaultScene().getExtras().profile.height).toBe(1.72);
  });
});

describe('audit, table and slipped', () => {
  const rows = [
    { file: 'b.glb', family: 'meshy24', joints: 24, fingers: 0, twists: 0, clips: 0, tris: 10, textures: 1, stored: true, profile: { height: 1.7, hips: 0.95, leg: 0.74, arm: 0.47, hand: 0.19, headR: 0.11, shoulders: 0.34 } },
    { file: 'a.glb', family: 'mixamo', joints: 47, fingers: 30, twists: 0, clips: 7, tris: 20, textures: 2, stored: false, profile: { height: 2.4, hips: 1.3, leg: null, arm: null, hand: null, headR: 0.2, shoulders: null } },
  ];
  it('sorts by family, then file', () => {
    expect(audit([...rows, { ...rows[0], file: 'a.glb' }]).map((r) => `${r.family} ${r.file}`)).toEqual(['meshy24 a.glb', 'meshy24 b.glb', 'mixamo a.glb']);
  });
  it('prints the counts by family, then a row a figure', () => {
    const t = table(audit(rows), { clipFiles: 5 });
    expect(t).toMatch(/\| meshy24 \| 1 \|/);
    expect(t).toMatch(/5 clip files/);
    expect(t).toMatch(/\| b\.glb \| meshy24 \| 24 \| 0 \| 0 \| 0 \| 10 \| 1 \| h 1\.70 · hips 0\.95 · leg 0\.74 · arm 0\.47 · hand 0\.19 · head 0\.11 · sh 0\.34 \| yes \|/);
    expect(t).toMatch(/\| a\.glb \| mixamo .*h 2\.40 · hips 1\.30 · head 0\.20 \| no \|/);
  });
  it('names a figure whose family has slipped from what a phase set', () => {
    expect(EXPECTED).toEqual({});
    expect(slipped(rows, { 'b.glb': 'meshy54', 'a.glb': 'mixamo', 'gone.glb': 'meshy54' })).toEqual([
      { file: 'b.glb', want: 'meshy54', family: 'meshy24' },
      { file: 'gone.glb', want: 'meshy54', family: 'absent' },
    ]);
  });
});
