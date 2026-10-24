// The Whomping Willow (the design’s §4.3), drawn: a squat, gnarled trunk
// flaring into its roots, the knot at its foot, and seven great limbs that
// rise from its crown and droop again, each a chain of four bones, their
// long fronds hanging from the drooping half and stirring in the wind. Its
// temper is rules/willow.js’s: it sways while nothing is near, and when you
// come within twelve metres it draws back the limb nearest you and strikes
// along it; a stone on the knot holds it still ten seconds. A book from the
// library lies under its roots (the Willow’s knot, quest 7).
//
// Draws: the trunk and its roots (one merged mesh), the limbs’ bones (one
// instanced draw, every segment an instance moved each frame), the fronds
// (one instanced draw), the crown’s clumps (one), the book (one): five in all.
//
//   createWillow({ house, at: [x, y, z], face, tier }) → {
//     group, state (rules/willow.js’s), knot: [x, y, z], KNOT_R,
//     step(dt, { you: [x, z] | null, knot }) → events (rules/willow.js’s, a hit’s
//       `throw` in the world’s frame), book: { at, taken, take() }, colliders, dispose() }
//   limbPose(limb, angles, root) → [{ from, to, r }] the bones of one limb (pure)

import * as THREE from 'three';
import { MeshLambertNodeMaterial } from 'three/webgpu';
import { abs, attribute, cos, floor, fract, mix, positionLocal, sin, smoothstep, step, uniform, uv, vec3 } from 'three/tsl';
import { loadCore, wear } from '../../../../lib/three/coreNodes';
import { createMesh } from '../castle/mesh';
import { WILLOW, limbAngles, newWillow, stepWillow } from '../../rules/willow';

export const KNOT_R = 0.9; // m round the knot a falling stone stills it from
const SEGMENTS = [0.3, 0.27, 0.23, 0.2]; // each bone’s share of its limb
const PITCH = [0.85, 0.3, -0.32, -0.9]; // each bone’s rest angle over the level (radians)
const LIFT = [1, 0.85, 0.6, 0.45]; // how much of a limb’s lift each bone takes
const CROWN = 5.2; // m up the trunk the limbs spring from

// a limb’s bones from its root: each from where the last ended, along its
// own angle, the limb’s yaw curling more toward its tip as it strikes
export function limbPose(limb, { yaw, lift }, root, scale = 1) {
  const out = [];
  let p = root;
  let r = 0.55 * (limb.length / 12) * scale;
  for (let k = 0; k < SEGMENTS.length; k++) {
    const y = limb.yaw + yaw * (1 + 0.35 * k);
    const pitch = PITCH[k] + lift * LIFT[k];
    const len = limb.length * SEGMENTS[k] * scale;
    const d = [Math.sin(y) * Math.cos(pitch), Math.sin(pitch), Math.cos(y) * Math.cos(pitch)];
    const to = [p[0] + d[0] * len, p[1] + d[1] * len, p[2] + d[2] * len];
    out.push({ from: p, to, r, dir: d, len, yaw: y });
    p = to;
    r *= 0.62;
  }
  return out;
}

// the bark: the scan worn over a dark grey-brown, the roots and the knot paler where they are worn
function barkMaterial(house, tier) {
  const m = house ? house.material({ color: 0x4a4038, vertexColors: true }) : new MeshLambertNodeMaterial({ color: 0x4a4038, vertexColors: true });
  if (tier === 'low') return m;
  const blank = (v) => {
    const t = new THREE.DataTexture(Uint8Array.from([v, v, v, 255]), 1, 1);
    t.needsUpdate = true;
    return t;
  };
  const worn = wear(m, { map: blank(146), normalMap: blank(128) }, { metres: 1.2, strength: 0.8, normal: 1, mean: 0.78 });
  loadCore('bark').then((got) => {
    const u = worn.userData.core;
    if (!got || !u) return;
    u.uCoreMap.value = got.map;
    if (got.normalMap) u.uCoreNormal.value = got.normalMap;
  });
  return worn;
}

// the fronds: long cards hanging from the limbs, cut in the shader into a
// dozen strands of narrow leaves each, every strand its own length (so the
// curtain’s hem is ragged), dark at the top and yellower at the tips,
// stirring at their ends in the wind (the crown’s clumps, where the limbs
// turn over, are the same strands, shorter and fuller)
function frondMaterial(house, uTime) {
  const m = house ? house.material({ side: THREE.DoubleSide, alphaTest: 0.5 }) : new MeshLambertNodeMaterial({ side: THREE.DoubleSide, alphaTest: 0.5 });
  const phase = attribute('aPhase', 'float');
  const u = uv();
  const along = u.y.oneMinus(); // 0 at the top, 1 at the tip
  m.positionNode = positionLocal.add(vec3(sin(uTime.mul(1.3).add(phase.mul(6.28)).add(positionLocal.x.mul(2))).mul(0.25), 0, cos(uTime.mul(0.9).add(phase.mul(4.1))).mul(0.18)).mul(along.mul(along)));
  const k = u.x.mul(12);
  const id = floor(k);
  const rand = fract(sin(id.mul(12.9898).add(phase.mul(78.233))).mul(43758.5453));
  const sway = sin(u.y.mul(6).add(id.mul(1.7))).mul(0.12);
  const strand = smoothstep(0.34, 0.14, abs(fract(k).sub(0.5).add(sway)));
  const hangs = step(along, rand.mul(0.55).add(0.45));
  const leafy = smoothstep(0.15, 0.45, fract(u.y.mul(26).add(rand.mul(3)))).mul(0.6).add(0.4);
  m.opacityNode = strand.mul(hangs).mul(leafy).mul(smoothstep(0, 0.04, u.y.oneMinus().oneMinus()));
  m.colorNode = mix(vec3(0.1, 0.15, 0.05), vec3(0.36, 0.4, 0.13), along.mul(0.7).add(rand.mul(0.3)));
  return m;
}
export function createWillow({ house = null, at, face = 0, tier = 'high' } = {}) {
  const group = new THREE.Group();
  group.name = 'grounds:willow';
  group.position.set(...at);
  const uTime = uniform(0);
  const bark = barkMaterial(house, tier);

  // the trunk: a turned shape flaring at the foot, gnarled by a noise on its
  // radius; the roots out from it into the ground; the knot at its foot
  const mesh = createMesh();
  const prof = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const y = -0.5 + t * (CROWN + 1.2);
    const r = 1.25 + 1.3 * Math.pow(1 - Math.min(1, t * 2.2), 2.4) + 0.16 * Math.sin(t * 9) + (t > 0.85 ? (t - 0.85) * 3 : 0);
    prof.push([r, y]);
  }
  mesh.tone([0.62, 0.58, 0.54]);
  mesh.lathe('bark', { at: [0, 0, 0], profile: prof, sides: tier === 'low' ? 9 : 16 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    const out = 2.6 + 0.8 * Math.sin(i * 2.3);
    mesh.tone([0.7, 0.65, 0.6]);
    mesh.beam('bark', [Math.sin(a) * 0.8, 0.9, Math.cos(a) * 0.8], [Math.sin(a) * out, -0.35, Math.cos(a) * out], 0.42, 0.36);
  }
  const knot = [Math.sin(face) * 1.25, 0.7, Math.cos(face) * 1.25];
  mesh.tone([0.82, 0.76, 0.68]);
  mesh.lathe('bark', { at: [knot[0], knot[1] - 0.35, knot[2]], profile: [[0.001, 0], [0.32, 0.12], [0.42, 0.35], [0.3, 0.6], [0.001, 0.7]], sides: 9 });
  const geometries = mesh.geometries();
  const trunk = new THREE.Mesh(geometries.bark, bark);
  trunk.castShadow = trunk.receiveShadow = tier !== 'low';
  group.add(trunk);

  // the limbs’ bones: an instance a bone, a tapered log each
  const limbs = WILLOW.limbs;
  const bone = new THREE.CylinderGeometry(0.62, 1, 1, tier === 'low' ? 5 : 7, 1, true).translate(0, 0.5, 0);
  // (the bark’s material takes a tone a vertex: the limbs a little darker than the trunk)
  bone.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(bone.attributes.position.count * 3).fill(0.56), 3));
  const bones = new THREE.InstancedMesh(bone, bark, limbs.length * SEGMENTS.length);
  bones.castShadow = tier !== 'low';
  bones.frustumCulled = false;
  bones.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(bones);
  const roots = limbs.map((l, i) => [Math.sin(l.yaw) * 0.7, CROWN + 0.55 * Math.sin(i * 1.7), Math.cos(l.yaw) * 0.7]);

  // the fronds: three hanging from each of the drooping bones, crossed pairs of cards
  const card = new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0);
  const cross = card.clone().rotateY(Math.PI / 2);
  const frondGeo = new THREE.BufferGeometry();
  const merged = [card, cross].map((g) => g.toNonIndexed());
  for (const name of ['position', 'normal', 'uv']) {
    const parts = merged.map((g) => g.attributes[name].array);
    const all = new Float32Array(parts.reduce((s, a) => s + a.length, 0));
    let o = 0;
    for (const a of parts) {
      all.set(a, o);
      o += a.length;
    }
    frondGeo.setAttribute(name, new THREE.BufferAttribute(all, name === 'uv' ? 2 : 3));
  }
  const FRONDS = [[0.6, 1], [0.3, 0.65, 1], [0.35, 0.7, 1]]; // where along bones 1, 2 and 3 they hang
  const per = FRONDS.reduce((n, f) => n + f.length, 0);
  const frondCount = limbs.length * per;
  const phases = new Float32Array(frondCount).map((_, i) => ((i * 0.618) % 1) + 0.01);
  frondGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
  const fronds = new THREE.InstancedMesh(frondGeo, frondMaterial(house, uTime), frondCount);
  fronds.frustumCulled = false;
  fronds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // (no shadow from the strands: a card’s shadow is its whole square, the cut-out isn’t in the shadow’s pass)
  fronds.castShadow = false;
  group.add(fronds);
  // the crown: three clumps of leaves a limb, round cards crossed, where it rises and turns over
  const CLUMPS = [[1, 0.9], [2, 0.4], [2, 1]];
  const clumpGeo = frondGeo.clone();
  clumpGeo.translate(0, 0.5, 0);
  const clumpPhase = new Float32Array(limbs.length * CLUMPS.length).map((_, i) => ((i * 0.382) % 1) + 0.01);
  clumpGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(clumpPhase, 1));
  const clumps = new THREE.InstancedMesh(clumpGeo, frondMaterial(house, uTime), clumpPhase.length);
  clumps.frustumCulled = false;
  clumps.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  clumps.castShadow = false;
  group.add(clumps);

  // the library’s book, fallen under the roots on the side away from the castle
  const bookAt = [Math.sin(face + Math.PI * 0.8) * 2.4, 0.08, Math.cos(face + Math.PI * 0.8) * 2.4];
  const bookMat = house ? house.material({ color: 0x6a1a14 }) : new MeshLambertNodeMaterial({ color: 0x6a1a14 });
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.24), bookMat);
  book.position.set(...bookAt);
  book.rotation.y = face + 0.5;
  group.add(book);

  let state = newWillow();
  let time = 0;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const pose = () => {
    const angles = limbAngles(state, time);
    let b = 0;
    let f = 0;
    let c = 0;
    limbs.forEach((limb, i) => {
      const chain = limbPose(limb, angles[i], roots[i]);
      for (const seg of chain) {
        dir.set(...seg.dir);
        q.setFromUnitVectors(up, dir);
        m4.compose(pos.set(...seg.from), q, sc.set(seg.r, seg.len, seg.r));
        bones.setMatrixAt(b++, m4);
      }
      // the fronds off the turning-over and the drooping bones, hanging straight down, turned to the limb
      const point = (seg, t) => [seg.from[0] + (seg.to[0] - seg.from[0]) * t, seg.from[1] + (seg.to[1] - seg.from[1]) * t, seg.from[2] + (seg.to[2] - seg.from[2]) * t];
      FRONDS.forEach((ts, k) => {
        const seg = chain[k + 1];
        for (const t of ts) {
          const p = point(seg, t);
          const long = Math.max(1.4, Math.min(4.8, p[1] - 0.3)) * (0.75 + 0.25 * phases[f]);
          q.setFromAxisAngle(up, seg.yaw + phases[f] * 1.4);
          m4.compose(pos.set(p[0], p[1] + 0.2, p[2]), q, sc.set(1.7, long, 1.7));
          fronds.setMatrixAt(f++, m4);
        }
      });
      for (const [k, t] of CLUMPS) {
        const p = point(chain[k], t);
        const size = 2.6 + clumpPhase[c] * 1.2;
        q.setFromAxisAngle(up, clumpPhase[c] * 6.28);
        m4.compose(pos.set(p[0], p[1] - size * 0.45, p[2]), q, sc.set(size, size, size));
        clumps.setMatrixAt(c++, m4);
      }
    });
    bones.instanceMatrix.needsUpdate = true;
    fronds.instanceMatrix.needsUpdate = true;
    clumps.instanceMatrix.needsUpdate = true;
  };
  pose();

  const knotWorld = [at[0] + knot[0], at[1] + knot[1], at[2] + knot[2]];
  return {
    group,
    get state() {
      return state;
    },
    knot: knotWorld,
    book: {
      at: [at[0] + bookAt[0], at[1] + bookAt[1], at[2] + bookAt[2]],
      get taken() {
        return !book.visible;
      },
      take() {
        book.visible = false;
      },
    },
    colliders: [{ id: 'willow', kind: 'circle', at: [at[0], at[2]], r: 1.7 }],
    step(dt, { you = null, knot: struck = false } = {}) {
      time += dt;
      uTime.value = time;
      state = stepWillow(state, dt, { you: you ? [you[0] - at[0], you[1] - at[2]] : null, knot: struck });
      pose();
      return state.ev;
    },
    dispose() {
      for (const g of Object.values(geometries)) g.dispose();
      bone.dispose();
      card.dispose();
      cross.dispose();
      frondGeo.dispose();
      bark.dispose();
      fronds.material.dispose();
      clumps.material.dispose();
      clumpGeo.dispose();
      book.geometry.dispose();
      bookMat.dispose();
      bones.dispose();
      fronds.dispose();
    },
  };
}
