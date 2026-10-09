// What every figure on the site stands on: each skinned model file under
// public/models and public/games/meshy, read for its skeleton (by bone
// names: Meshy's 24, Meshy's with fingers, Mixamo, Unreal, Rigify, High
// Moon's Transformers, the Transformers: Prime game's, or none of those),
// how many bones bend a finger and how many twist a forearm, its own clips,
// triangles and textures, and the body's measures at rest. Clip files (no
// mesh, only animations) are counted, not read. It is the measure the
// rigging lane's phases are held to (docs/superpowers/specs/
// 2026-10-08-npc-player-rigging-design.md).
//
//   familyOf(names) → 'meshy24' | 'meshy54' | 'mixamo' | 'unreal' | 'rigify'
//     | 'highmoon' | 'prime' | 'none'                                 (pure)
//   fingerJoints(names) / twistJoints(names) → the names that bend a finger
//     (never a metacarpal or an end bone) / twist a limb             (pure)
//   profileOf({ joints, box, hand }) → { height, hips, leg, arm, hand,
//     headR, shoulders }: metres, null where the rig has no bone for it;
//     joints by Meshy's names (world positions at rest), box the skinned
//     mesh's { min, max } (else the joints' extent), hand and head a
//     measured length and radius (else the farthest finger joint, and half
//     the head bone to its end)                                     (pure)
//   readRig(doc, { file }) → { file, family, joints, fingers, twists, clips,
//     tris, textures, profile, stored } over a gltf-transform Document;
//     the box is every vertex where its skin puts it at rest (through the
//     inverse bind matrices, which on a quantized Meshy file carry the
//     positions' scale); the hand and the head measured from the vertices
//     each mostly moves (Meshy's head_end is placed anywhere from the brow to
//     a hand's width over the crown); stored: the file already keeps a profile
//   withExtras(glb, extras) → glb: the default scene's extras merged with
//     these, the binary chunk byte for byte as it was (so a profile costs
//     the file a few hundred bytes and changes no vertex); glbJson(glb)
//   audit(rows) → by family, then file; table(rows, { clipFiles }) → Markdown
//   EXPECTED: { file: family } a phase has moved; slipped(rows, expected)
//
//   node scripts/rig-audit.mjs [--json out.json] [--write-profile]
//
// --write-profile writes extras.profile into each figure file that lacks
// one (GLTFLoader hands it on as gltf.scene.userData.profile). The script
// exits 1 when a figure has slipped from EXPECTED.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const EXPECTED = {};

export const FAMILIES = ['meshy24', 'meshy54', 'mixamo', 'unreal', 'rigify', 'highmoon', 'prime', 'none'];

// the Meshy skeleton's bones a figure on it always has (rig.js's MESHY)
const MESHY_TWELVE = ['Hips', 'Spine02', 'Spine01', 'Spine', 'neck', 'Head', 'LeftArm', 'RightArm', 'LeftUpLeg', 'RightUpLeg', 'LeftToeBase', 'RightToeBase'];

// a bone's name without its rig's prefix or the number a download appended
const plain = (n) =>
  n
    .replace(/^mixamorig\d*:?/i, '')
    .replace(/^DEF-/, '')
    .replace(/_\d+$/, '');
// its words: LeftHandIndex1 → left hand index; L_Finger02_Index01_XL2 → l finger index xl
const words = (n) =>
  plain(n)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());

export function familyOf(names) {
  const p = new Set(names.map(plain));
  const low = new Set([...p].map((n) => n.toLowerCase()));
  if (MESHY_TWELVE.every((n) => p.has(n))) return p.has('LeftHandIndex1') || p.has('LeftHandFingers1') ? 'meshy54' : 'meshy24';
  if (names.some((n) => /^mixamorig/i.test(n)) || p.has('HeadTop_End') || (p.has('Hips') && p.has('Spine1') && p.has('LeftForeArm'))) return 'mixamo';
  if (low.has('pelvis') && low.has('upperarm_l')) return 'unreal';
  if (names.some((n) => /^DEF-/.test(n)) || [...p].some((n) => /^f_index01[LR]$/.test(n))) return 'rigify';
  if ([...p].some((n) => /_X[BLTF]\d*$/.test(n))) return 'highmoon';
  if (low.has('humerus.l') || [...low].some((n) => /^[a-z]+\d_finger\.[lr]$/.test(n))) return 'prime';
  return 'none';
}

const FINGER_WORDS = new Set(['thumb', 'index', 'middle', 'ring', 'pinky', 'little', 'finger', 'fingers']);
const NOT_A_JOINT = new Set(['metacarpal', 'end', 'nub']);
export function fingerJoints(names) {
  return names.filter((n) => {
    const w = words(n);
    // (Mixamo's fourth joint of a finger is its tip, weighted to nothing)
    return w.some((x) => FINGER_WORDS.has(x)) && !w.some((x) => NOT_A_JOINT.has(x)) && !/^(Left|Right)Hand(Thumb|Index|Middle|Ring|Pinky)4$/.test(plain(n));
  });
}
export const twistJoints = (names) => names.filter((n) => words(n).includes('twist'));

// each measure's joint, rig by rig, by Meshy's name for it (lowercase, plain)
const ROLES = {
  Hips: ['hips', 'pelvis', 'c_spine00_hips_xb', 'hipcon', 'hip', 'bip001 pelvis'],
  Head: ['head', 'c_spine04_head_xb', 'head_x'],
  head_end: ['head_end', 'headtop_end', 'c_spine04_head_xb_end'],
  LeftArm: ['leftarm', 'upperarm_l', 'upper_arml', 'l_arm02_shoulder_xb', 'humerus.l', 'bicep.l'],
  LeftForeArm: ['leftforearm', 'lowerarm_l', 'forearml', 'l_arm03_elbow_xb', 'hand.l', 'arm.l'],
  LeftHand: ['lefthand', 'hand_l', 'handl', 'l_arm04_hand_xb', 'palm.l'],
  RightArm: ['rightarm', 'upperarm_r', 'upper_armr', 'r_arm02_shoulder_xb', 'humerus.r', 'bicep.r'],
  RightForeArm: ['rightforearm', 'lowerarm_r', 'forearmr', 'r_arm03_elbow_xb', 'hand.r', 'arm.r'],
  RightHand: ['righthand', 'hand_r', 'handr', 'r_arm04_hand_xb', 'palm.r'],
  LeftUpLeg: ['leftupleg', 'thigh_l', 'thighl', 'l_leg01_thigh_xb', 'thigh.l'],
  LeftLeg: ['leftleg', 'calf_l', 'shinl', 'l_leg02_knee_xb', 'leg.l'],
  LeftFoot: ['leftfoot', 'foot_l', 'footl', 'l_leg03_ankle_xb', 'foot.l'],
  RightUpLeg: ['rightupleg', 'thigh_r', 'thighr', 'r_leg01_thigh_xb', 'thigh.r'],
  RightLeg: ['rightleg', 'calf_r', 'shinr', 'r_leg02_knee_xb', 'leg.r'],
  RightFoot: ['rightfoot', 'foot_r', 'footr', 'r_leg03_ankle_xb', 'foot.r'],
};

const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);

export function profileOf({ joints, box = null, hand = null, head = null }) {
  const at = (n) => (joints[n] ? new THREE.Vector3(...joints[n]) : null);
  const d = (a, b) => (joints[a] && joints[b] ? at(a).distanceTo(at(b)) : null);
  const chain = (...ns) => {
    let s = 0;
    for (let i = 1; i < ns.length; i++) {
      const x = d(ns[i - 1], ns[i]);
      if (x == null) return null;
      s += x;
    }
    return s;
  };
  const mean = (a, b) => (a == null ? b : b == null ? a : (a + b) / 2);
  const ys = Object.values(joints).map((p) => p[1]);
  const floor = box ? box.min[1] : Math.min(...ys);
  const height = box ? box.max[1] - box.min[1] : Math.max(...ys) - floor;
  let headR = head;
  if (headR == null && joints.Head && joints.head_end) headR = d('Head', 'head_end') / 2;
  else if (headR == null && joints.Head && box) headR = (box.max[1] - joints.Head[1]) / 2;
  if (!(headR > 0)) headR = null;
  if (hand == null) {
    // (no mesh measured: the farthest finger joint, short of the tip)
    const reach = ['Left', 'Right'].map((s) => Math.max(...Object.keys(joints).filter((n) => n.startsWith(`${s}Hand`) && n !== `${s}Hand`).map((n) => d(`${s}Hand`, n) ?? 0), 0));
    hand = Math.max(...reach) || null;
  }
  return {
    height: r3(height),
    hips: r3(joints.Hips ? joints.Hips[1] - floor : null),
    leg: r3(mean(chain('LeftUpLeg', 'LeftLeg', 'LeftFoot'), chain('RightUpLeg', 'RightLeg', 'RightFoot'))),
    arm: r3(mean(chain('LeftArm', 'LeftForeArm', 'LeftHand'), chain('RightArm', 'RightForeArm', 'RightHand'))),
    hand: r3(hand),
    headR: r3(headR),
    shoulders: r3(d('LeftArm', 'RightArm')),
  };
}

const worldOf = (node, cache) => {
  if (!cache.has(node)) cache.set(node, new THREE.Matrix4().fromArray(node.getWorldMatrix()));
  return cache.get(node);
};

export function readRig(doc, { file = '' } = {}) {
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const jointNodes = [...new Set(root.listSkins().flatMap((s) => s.listJoints()))];
  const names = jointNodes.map((n) => n.getName());
  const cache = new Map();
  // the joints the profile measures, found by role
  const byPlain = new Map();
  for (const n of jointNodes) {
    const k = plain(n.getName()).toLowerCase();
    if (!byPlain.has(k)) byPlain.set(k, n);
  }
  const role = {};
  for (const [name, options] of Object.entries(ROLES)) {
    const n = options.map((o) => byPlain.get(o)).find(Boolean);
    if (n) role[name] = n;
  }
  const joints = {};
  for (const [name, node] of Object.entries(role)) joints[name] = new THREE.Vector3().setFromMatrixPosition(worldOf(node, cache)).toArray();
  // each hand and the head, and everything under them, for their measures over the mesh
  const partOf = new Map();
  for (const part of ['Left', 'Right', 'Head']) {
    const top = role[part === 'Head' ? 'Head' : `${part}Hand`];
    const mark = (n) => {
      partOf.set(n, part);
      n.listChildren().forEach(mark);
    };
    if (top) mark(top);
  }
  const reach = { Left: [], Right: [] };
  const headBox = new THREE.Box3();
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const w = new THREE.Vector3();
  let tris = 0;
  const visit = (node) => {
    const mesh = node.getMesh();
    if (mesh) {
      const skin = node.getSkin();
      let mats = null;
      const sj = skin ? skin.listJoints() : null;
      if (skin) {
        const ibm = skin.getInverseBindMatrices();
        const el = [];
        mats = sj.map((j, i) => worldOf(j, cache).clone().multiply(new THREE.Matrix4().fromArray(ibm ? ibm.getElement(i, el) : new THREE.Matrix4().elements)));
      }
      const own = worldOf(node, cache);
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        if (!pos) continue;
        const idx = prim.getIndices();
        if (prim.getMode() === 4) tris += (idx ? idx.getCount() : pos.getCount()) / 3;
        const J = skin && prim.getAttribute('JOINTS_0');
        const W = skin && prim.getAttribute('WEIGHTS_0');
        const p = [];
        const ja = [];
        const wa = [];
        for (let i = 0, n = pos.getCount(); i < n; i++) {
          v.fromArray(pos.getElement(i, p));
          if (J && W) {
            J.getElement(i, ja);
            W.getElement(i, wa);
            const sum = wa[0] + wa[1] + wa[2] + wa[3] || 1;
            s.set(0, 0, 0);
            let top = 0;
            for (let k = 0; k < 4; k++) {
              if (!wa[k]) continue;
              s.addScaledVector(w.copy(v).applyMatrix4(mats[ja[k]]), wa[k] / sum);
              if (wa[k] > wa[top]) top = k;
            }
            box.expandByPoint(s);
            const part = partOf.get(sj[ja[top]]);
            if (part === 'Head') headBox.expandByPoint(s);
            else if (part) reach[part].push(s.distanceTo(w.fromArray(joints[`${part}Hand`])));
          } else box.expandByPoint(s.copy(v).applyMatrix4(own));
        }
      }
    }
    node.listChildren().forEach(visit);
  };
  scene?.listChildren().forEach(visit);
  // a hand's length: the far end of what it carries (the 98th centile, so a
  // stray vertex doesn't make a hand of a sleeve)
  const far = (a) => (a.length ? a.sort((x, y) => x - y)[Math.floor(0.98 * (a.length - 1))] : null);
  const hands = [far(reach.Left), far(reach.Right)].filter((x) => x != null);
  return {
    file,
    family: familyOf(names),
    joints: jointNodes.length,
    fingers: fingerJoints(names).length,
    twists: twistJoints(names).length,
    clips: root.listAnimations().length,
    tris: Math.round(tris),
    textures: root.listTextures().length,
    profile: profileOf({ joints, box: box.isEmpty() ? null : { min: box.min.toArray(), max: box.max.toArray() }, hand: hands.length ? hands.reduce((a, b) => a + b) / hands.length : null, head: headBox.isEmpty() ? null : (headBox.max.y - headBox.min.y) / 2 }),
    stored: !!scene?.getExtras()?.profile,
  };
}

const JSON_CHUNK = 0x4e4f534a;
export function glbJson(glb) {
  const dv = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67 || dv.getUint32(16, true) !== JSON_CHUNK) throw new Error('not a GLB');
  return JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + dv.getUint32(12, true))));
}

export function withExtras(glb, extras) {
  const json = glbJson(glb);
  const scene = json.scenes?.[json.scene ?? 0];
  if (!scene) throw new Error('no scene to keep extras on');
  scene.extras = { ...scene.extras, ...extras };
  const len = new DataView(glb.buffer, glb.byteOffset).getUint32(12, true);
  const rest = glb.subarray(20 + len); // the binary chunk, header and all
  let text = new TextEncoder().encode(JSON.stringify(json));
  const pad = (4 - (text.length % 4)) % 4;
  if (pad) text = Uint8Array.from([...text, ...new Array(pad).fill(0x20)]);
  const out = new Uint8Array(20 + text.length + rest.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, out.length, true);
  dv.setUint32(12, text.length, true);
  dv.setUint32(16, JSON_CHUNK, true);
  out.set(text, 20);
  out.set(rest, 20 + text.length);
  return out;
}

export const audit = (rows) => [...rows].sort((a, b) => FAMILIES.indexOf(a.family) - FAMILIES.indexOf(b.family) || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));

const SHORT = { height: 'h', hips: 'hips', leg: 'leg', arm: 'arm', hand: 'hand', headR: 'head', shoulders: 'sh' };
const said = (p) =>
  Object.entries(SHORT)
    .filter(([k]) => p?.[k] != null)
    .map(([k, s]) => `${s} ${p[k].toFixed(2)}`)
    .join(' · ');

export function table(rows, { clipFiles = 0 } = {}) {
  const lines = ['| family | figures |', '|---|---|'];
  for (const f of FAMILIES) {
    const n = rows.filter((r) => r.family === f).length;
    if (n) lines.push(`| ${f} | ${n} |`);
  }
  lines.push('', `${rows.length} figures, ${clipFiles} clip files; ${rows.filter((r) => r.stored).length} keep a profile.`, '');
  lines.push('| file | family | joints | fingers | twists | clips | tris | textures | profile (m) | kept |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) lines.push(`| ${r.file} | ${r.family} | ${r.joints} | ${r.fingers} | ${r.twists} | ${r.clips} | ${r.tris} | ${r.textures} | ${said(r.profile)} | ${r.stored ? 'yes' : 'no'} |`);
  return lines.join('\n');
}

export function slipped(rows, expected = EXPECTED) {
  const by = Object.fromEntries(rows.map((r) => [r.file, r.family]));
  return Object.entries(expected)
    .filter(([file, want]) => by[file] !== want)
    .map(([file, want]) => ({ file, want, family: by[file] ?? 'absent' }));
}

async function glbs(dir, deep) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory() && deep) out.push(...(await glbs(p, deep)));
    else if (e.isFile() && e.name.endsWith('.glb')) out.push(p);
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
  const write = args.includes('--write-profile');
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const files = [...(await glbs(join(ROOT, 'public', 'models'), true)), ...(await glbs(join(ROOT, 'public', 'games', 'meshy'), false))].sort();
  const rows = [];
  let clipFiles = 0;
  let written = 0;
  for (const f of files) {
    const bytes = new Uint8Array(await readFile(f));
    const j = glbJson(bytes);
    if (!j.meshes?.length) {
      if (j.animations?.length) clipFiles++;
      continue;
    }
    if (!j.skins?.length) continue;
    const row = readRig(await io.readBinary(bytes), { file: relative(ROOT, f).split('\\').join('/') });
    if (write && !row.stored) {
      await writeFile(f, withExtras(bytes, { profile: row.profile }));
      row.stored = true;
      written++;
    }
    rows.push(row);
  }
  const sorted = audit(rows);
  if (jsonOut) await writeFile(jsonOut, `${JSON.stringify(sorted, null, 1)}\n`);
  console.log(table(sorted, { clipFiles }));
  if (write) console.error(`${written} profiles written`);
  const bad = slipped(sorted);
  for (const b of bad) console.error(`${b.file}: ${b.family}, should be ${b.want}`);
  process.exitCode = bad.length ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
