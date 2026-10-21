// skin.mjs: the bone table against the fixture's (Luke's), the joints read
// off a toy figure's shape against the joints it was made with, the bones
// fitted to them, Blender's job and command, and the skeleton Blender's GLB
// is given. Where Blender is here, a round trip on the toy figure too (the
// one test over a second: Blender takes a few to start); without it, that
// one is skipped and the pure parts still run.
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { afterAll, describe, expect, it } from 'vitest';
import { meshyRig, MESHY_BONES } from '../../src/lib/three/meshyRig.fixture.js';
import { docOf, figure } from './fixtures/figure.mjs';
import { assemble, BONES, CM, command, estimate, facing, fit, job, MARKERS, NAMES, places, pointsOf, rest, skin } from './skin.mjs';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// a figure's surface as skin.mjs reads it: its vertices and points strewn over its triangles
const surface = async (opts) => pointsOf(await docOf(figure(opts)), { samples: 20000 });

// the fixture's skeleton as joints, so fitting Luke to his own joints should give Luke back
function lukeJoints() {
  const r = meshyRig();
  r.model.updateMatrixWorld(true);
  const w = (n) => r.bones[n].getWorldPosition(new THREE.Vector3()).toArray();
  const side = (s) => {
    const tipOf = (hand) => {
      // (Luke's hand points down its +y; the tip a hand's length on)
      const b = r.bones[hand];
      return b.localToWorld(new THREE.Vector3(0, 8, 0)).toArray();
    };
    const toeOf = (toe) => r.bones[toe].localToWorld(new THREE.Vector3(0, 5, 0)).toArray();
    return { clavicle: w(`${s}Shoulder`), shoulder: w(`${s}Arm`), elbow: w(`${s}ForeArm`), wrist: w(`${s}Hand`), tip: tipOf(`${s}Hand`), hip: w(`${s}UpLeg`), knee: w(`${s}Leg`), ankle: w(`${s}Foot`), ball: w(`${s}ToeBase`), toe: toeOf(`${s}ToeBase`) };
  };
  return { H: w('head_end')[1], hips: w('Hips'), spine: [w('Spine02'), w('Spine01'), w('Spine')], neckBase: w('neck'), head: w('Head'), top: w('head_end'), face: w('headfront'), L: side('Left'), R: side('Right') };
}

describe('the bone table', () => {
  it('is the fixture’s 24 bones, by name and parent, in its order', () => {
    expect(NAMES).toHaveLength(24);
    expect(BONES.map((b) => [b.name, b.parent])).toEqual(MESHY_BONES.map(([n, p]) => [n, p]));
    expect([...MARKERS].sort()).toEqual(['head_end', 'headfront']);
  });

  it('puts each bone at rest where the fixture’s armature has it', () => {
    const r = meshyRig();
    r.armature.position.set(0, 0, 0); // (the fixture stands its toes on the ground; the table is the file's)
    r.model.updateMatrixWorld(true);
    const at = rest();
    for (const name of NAMES) {
      const want = r.bones[name].getWorldPosition(new THREE.Vector3()).multiplyScalar(CM);
      expect(at[name].p.distanceTo(want), name).toBeLessThan(1e-3);
      expect(Math.abs(at[name].q.dot(r.bones[name].getWorldQuaternion(new THREE.Quaternion()))), name).toBeGreaterThan(0.9999);
    }
  });
});

describe('reading the joints off a figure', () => {
  const H = 1.4;
  const near = (got, want, tol, what) => expect(dist(got, want), `${what}: ${got.map((v) => v.toFixed(3))} for ${want.map((v) => v.toFixed(3))}`).toBeLessThan(tol);

  it.each([
    ['arms 35° down', { arm: 35 }],
    ['arms 20° down', { arm: 20 }],
    ['arms 50° down', { arm: 50 }],
  ])('finds the joints of a big-headed figure in an A-pose, %s', async (_, opts) => {
    const fig = figure({ H, ...opts });
    const J = estimate(await surface({ H, ...opts }));
    const T = fig.joints;
    expect(J.H).toBeCloseTo(H, 3);
    expect(J.found).toEqual({ crotch: true, neck: true, arms: true });
    near(J.hips, T.hips, 0.03 * H, 'hips');
    expect(Math.abs(J.neck[1] - T.neck[1]), 'neck').toBeLessThan(0.03 * H);
    for (const s of ['L', 'R']) {
      for (const j of ['shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle']) near(J[s][j], T[s][j], 0.03 * H, `${s} ${j}`);
      expect(Math.sign(J[s].wrist[0]), `${s} wrist side`).toBe(s === 'L' ? 1 : -1);
    }
  });

  it('stands a robed figure’s hips at the share when its legs can’t be seen apart', async () => {
    const J = estimate(await surface({ H, robe: true }));
    expect(J.found.crotch).toBe(false);
    expect(J.hips[1] / H).toBeCloseTo(0.33, 2);
    near(J.L.ankle, figure({ H }).joints.L.ankle, 0.03 * H, 'ankle under the robe');
  });

  it('takes a share it’s given over what the shape says', async () => {
    const J = estimate(await surface({ H }), { shares: { neck: 0.7, hips: 0.4 } });
    expect(J.neck[1] / H).toBeCloseTo(0.7, 5);
    expect(J.hips[1] / H).toBeCloseTo(0.4, 5);
    expect(J.found.neck).toBe(false);
  });

  it('says which way a figure faces by its arms and its toes', async () => {
    for (const turn of [0, 90, 180, -90]) expect(facing(await surface({ turn })), `stood at ${turn}°`).toBe({ 0: 0, 90: -90, 180: 180, '-90': 90 }[turn]);
  });

  it('refuses too few points', () => {
    expect(() => estimate(new Float32Array(30))).toThrow(/too few/);
  });
});

describe('fitting the bones', () => {
  it('gives Luke back when fitted to his own joints', () => {
    const bones = fit(lukeJoints());
    expect(bones.map((b) => b.name)).toEqual(NAMES);
    BONES.forEach((b, i) => {
      const q = new THREE.Quaternion(...bones[i].local.q);
      expect(Math.abs(q.dot(new THREE.Quaternion(...b.turn).normalize())), b.name).toBeGreaterThan(0.999);
      // (the fixture's armature is stood on its toes: the hips alone carry that)
      if (b.parent) expect(dist(bones[i].local.t, b.at), b.name).toBeLessThan(0.05);
    });
  });

  it('puts each bone at its joint, its chain children straight down its +y', async () => {
    const J = estimate(await surface({ H: 1.4 }));
    const bones = fit(J);
    const at = places(J);
    for (const b of bones) {
      expect(dist(b.head, at[b.name]), b.name).toBeLessThan(1e-9);
      expect(Math.hypot(...b.local.q), b.name).toBeCloseTo(1, 6);
    }
    const by = Object.fromEntries(bones.map((b) => [b.name, b]));
    for (const name of ['Spine02', 'Spine01', 'Spine', 'neck', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightLeg', 'RightFoot', 'LeftToeBase']) {
      const [x, y, z] = by[name].local.t;
      expect(Math.hypot(x, z), `${name} off its parent's line`).toBeLessThan(1e-3);
      expect(y, name).toBeGreaterThan(0);
    }
  });

  it('turns each limb no further from Luke’s than it takes to point down the figure’s own', async () => {
    const luke = rest();
    const bones = fit(estimate(await surface({ H: 1.4, arm: 20 })));
    const arm = bones.find((b) => b.name === 'LeftArm');
    const q = new THREE.Quaternion(...arm.world.q);
    const along = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    // it points out at 20° below the horizontal
    expect((Math.asin(-along.y) * 180) / Math.PI).toBeGreaterThan(10);
    expect((Math.asin(-along.y) * 180) / Math.PI).toBeLessThan(30);
    // and its twist about that is Luke's: the swing that takes Luke's arm there, and no more
    const swing = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0).applyQuaternion(luke.LeftArm.q), along);
    expect(Math.abs(swing.multiply(luke.LeftArm.q).dot(q))).toBeGreaterThan(0.9999);
  });
});

describe('what Blender is told', async () => {
  const bones = fit(estimate(await surface({ H: 1.4 })));

  it('names every bone with a head and a tail apart, the markers kept from the weights', () => {
    const j = job(bones);
    expect(j.bones.map((b) => b.name)).toEqual(NAMES);
    for (const b of j.bones) expect(dist(b.head, b.tail), b.name).toBeGreaterThan(1e-4);
    expect(j.bones.filter((b) => !b.deform).map((b) => b.name)).toEqual(['head_end', 'headfront']);
    // the head's bone runs to the crown, so the whole head is its
    expect(j.bones.find((b) => b.name === 'Head').tail[1]).toBeCloseTo(1.4, 3);
    expect(j.voxel).toBeCloseTo(1.4 / 150, 3);
    expect(job(bones, { proxy: 'always' }).proxy).toBe('always');
  });

  it('runs skin.py in a Windows Blender, or a Linux one in WSL with its paths turned', async () => {
    const win = await command('C:/m/in.glb', 'C:/m/job.json', 'C:/m/out.glb', { where: { kind: 'windows', exe: 'C:/b/blender.exe' } });
    expect(win[0]).toBe('C:/b/blender.exe');
    expect(win.slice(1, 3)).toEqual(['--background', '--python']);
    expect(win[3]).toMatch(/skin\.py$/);
    expect(win.slice(4)).toEqual(['--', 'C:/m/in.glb', 'C:/m/job.json', 'C:/m/out.glb']);
    const wsl = await command('C:/m/in.glb', 'C:/m/job.json', 'C:/m/out.glb', { where: { kind: 'wsl', exe: '/home/me/blender/blender' } });
    expect(wsl[0]).toBe('wsl.exe');
    expect(wsl.at(-1)).toContain("'/mnt/c/m/in.glb' '/mnt/c/m/job.json' '/mnt/c/m/out.glb'");
  });
});

describe('the skeleton Blender’s GLB is given', () => {
  // what Blender writes: a mesh weighted to its own bones, numbered its own way
  function blenders() {
    const doc = new Document();
    const buf = doc.createBuffer();
    const theirs = [...NAMES].filter((n) => !MARKERS.has(n)).reverse();
    const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 0.1, 1, 0, 0.3, 1.1, 0])).setBuffer(buf);
    const joints = doc.createAccessor().setType('VEC4').setArray(new Uint8Array([theirs.indexOf('Hips'), 0, 0, 0, theirs.indexOf('Head'), 0, 0, 0, theirs.indexOf('LeftHand'), theirs.indexOf('LeftForeArm'), 0, 0])).setBuffer(buf);
    const weights = doc.createAccessor().setType('VEC4').setArray(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 0.7, 0.3, 0, 0])).setBuffer(buf);
    const prim = doc.createPrimitive().setAttribute('POSITION', pos).setAttribute('JOINTS_0', joints).setAttribute('WEIGHTS_0', weights);
    const mesh = doc.createMesh('m').addPrimitive(prim);
    const skin = doc.createSkin();
    const arm = doc.createNode('Armature.001');
    for (const n of theirs) {
      const j = doc.createNode(n);
      arm.addChild(j);
      skin.addJoint(j);
    }
    const node = doc.createNode('figure').setMesh(mesh).setSkin(skin).setTranslation([1, 2, 3]);
    doc.createScene().addChild(arm).addChild(node);
    return doc;
  }

  it('is the table’s bones under an armature scaled to metres, the weights renumbered to them', async () => {
    const bones = fit(estimate(await surface({ H: 1.4 })));
    const doc = assemble(blenders(), bones);
    const root = doc.getRoot();
    const [scene] = root.listScenes();
    const [arm] = scene.listChildren();
    expect(scene.listChildren()).toHaveLength(1);
    expect(arm.getName()).toBe('Armature');
    expect(arm.getScale()).toEqual([1 / CM, 1 / CM, 1 / CM]);
    const [skinned] = root.listNodes().filter((n) => n.getMesh());
    expect(skinned.getTranslation()).toEqual([0, 0, 0]);
    expect(arm.listChildren().map((n) => n.getName())).toEqual(['char1', 'Hips']);
    const skin = skinned.getSkin();
    expect(skin.listJoints().map((j) => j.getName())).toEqual(NAMES);
    const j = skinned.getMesh().listPrimitives()[0].getAttribute('JOINTS_0').getArray();
    expect([j[0], j[4], j[8], j[9]]).toEqual(['Hips', 'Head', 'LeftHand', 'LeftForeArm'].map((n) => NAMES.indexOf(n)));
    // each bone's inverse bind matrix undoes where it stands at rest, the armature's scale and all
    const ibm = skin.getInverseBindMatrices().getArray();
    NAMES.forEach((name, i) => {
      const node = skin.listJoints()[i];
      const world = new THREE.Matrix4().fromArray(node.getWorldMatrix());
      const id = world.multiply(new THREE.Matrix4().fromArray(ibm.slice(i * 16, i * 16 + 16)));
      id.elements.forEach((v, k) => expect(v, `${name}[${k}]`).toBeCloseTo(k % 5 === 0 ? 1 : 0, 4));
    });
    // and the bones stand where the joints were, in metres
    const hand = skin.listJoints()[NAMES.indexOf('LeftHand')].getWorldTranslation();
    const want = bones.find((b) => b.name === 'LeftHand').head;
    expect(dist(hand, want)).toBeLessThan(1e-5);
  });

  it('refuses a skeleton with a bone the table doesn’t know', async () => {
    const bones = fit(estimate(await surface({ H: 1.4 })));
    const doc = blenders();
    doc.getRoot().listSkins()[0].listJoints()[0].setName('Tail');
    expect(() => assemble(doc, bones)).toThrow(/Tail/);
  });
});

// ── where Blender is: the round trip ──
const where = await (async () => {
  try {
    const { blender } = await import('../gen3d/bake.mjs');
    return blender();
  } catch {
    return null;
  }
})();

describe.runIf(where)('the round trip through Blender', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skin-test-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('weights every vertex of a toy figure to the bones it’s nearest', { timeout: 120000 }, async () => {
    const doc = await docOf(figure({ H: 1.4 }));
    const input = join(dir, 'toy.glb');
    const out = join(dir, 'toy-skinned.glb');
    await new NodeIO().write(input, doc);
    const r = await skin(input, out, { log: null });
    expect(existsSync(out)).toBe(true);
    const got = await new NodeIO().read(out);
    const [node] = got.getRoot().listNodes().filter((n) => n.getMesh());
    expect(node.getSkin().listJoints().map((j) => j.getName())).toEqual(NAMES);
    const p = node.getMesh().listPrimitives()[0];
    const [pos, jn, wt] = ['POSITION', 'JOINTS_0', 'WEIGHTS_0'].map((s) => p.getAttribute(s));
    const e = [];
    let bare = 0;
    let handOk = 0;
    let hands = 0;
    for (let i = 0; i < pos.getCount(); i++) {
      const w = wt.getElement(i, []);
      const sum = w.reduce((a, b) => a + b, 0);
      if (sum < 0.99) bare++;
      pos.getElement(i, e);
      // a vertex out at the left hand's tip goes with the left hand or forearm
      if (dist(e, r.joints.L.tip) < 0.03) {
        hands++;
        const j = jn.getElement(i, []);
        const top = j[w.indexOf(Math.max(...w))];
        if (['LeftHand', 'LeftForeArm'].includes(NAMES[top])) handOk++;
      }
    }
    expect(bare).toBe(0);
    expect(hands).toBeGreaterThan(0);
    expect(handOk / hands).toBeGreaterThan(0.9);
  });
});
