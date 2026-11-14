// The greenhouses (the design’s §4.3): three glasshouses in a row below the
// castle’s south-east corner (castle/plan.js builds their glass and iron),
// the middle one open, its door to the castle (castle/doors.js swings it):
// inside, the benches down both sides crowded with clay pots and what grows
// in them, the path between, the smell of earth you can almost see, and at
// the far end, in a pot as big as a cauldron, a Venomous Tentacula, which
// snaps at whoever passes too close (rules/willow.js’s TENTACULA: the
// Willow’s temper, a short reach, a nudge, no point lost).
//
// Draws: the benches (one), the pots (one), the plants (one), the
// Tentacula’s pot and its vines (two).
//
//   HOUSE: the open glasshouse’s middle, its length (along +z), its width
//   createGreenhouses({ house, materials, ground, tier }) → { group, colliders,
//     step(dt, { you: [x, z] | null }) → events (rules/willow.js’s, a hit’s `throw` in the world’s frame), dispose() }

import * as THREE from 'three';
import { MeshLambertNodeMaterial } from 'three/webgpu';
import { abs, fract, mix, positionLocal, sin, smoothstep, uniform, uv, vec3 } from 'three/tsl';
import { createMesh } from '../castle/mesh';
import { TONES } from '../castle/materials';
import { partById } from '../castle/plan';
import { TENTACULA, limbAngles, newWillow, stepWillow } from '../../rules/willow';
import { seeded } from '../../../../lib/seeded';

const OPEN = partById('greenhouse-3');
export const HOUSE = { at: OPEN.at, len: OPEN.len, w: OPEN.w };
const BENCH = { h: 0.9, d: 1.3, off: 3.25, len: 19 };

// a clay pot, turned: a rim, a tapering body, a foot
const potGeometry = () =>
  new THREE.LatheGeometry(
    [
      [0.001, 0],
      [0.13, 0],
      [0.16, 0.04],
      [0.2, 0.26],
      [0.22, 0.28],
      [0.22, 0.32],
      [0.19, 0.32],
      [0.17, 0.08],
      [0.001, 0.08],
    ].map(([r, y]) => new THREE.Vector2(r, y)),
    12,
  );

// a plant: three crossed cards of leaves, cut in the shader, a little different each
function plantMaterial(house) {
  const m = house ? house.material({ side: THREE.DoubleSide, alphaTest: 0.5 }) : new MeshLambertNodeMaterial({ side: THREE.DoubleSide, alphaTest: 0.5 });
  const u = uv();
  const leaf = abs(fract(u.x.mul(3).add(u.y.mul(0.6))).sub(0.5)).mul(2);
  const shape = smoothstep(0.95, 0.6, leaf.add(u.y.mul(0.5))).mul(smoothstep(0, 0.08, u.y));
  m.opacityNode = shape;
  m.colorNode = mix(vec3(0.07, 0.16, 0.05), vec3(0.24, 0.38, 0.1), u.y.mul(0.8).add(sin(u.x.mul(17)).mul(0.1)));
  return m;
}

export function createGreenhouses({ house = null, materials, ground, tier = 'high' } = {}) {
  const group = new THREE.Group();
  group.name = 'grounds:greenhouses';
  const [hx, hz] = HOUSE.at;
  const base = ground(hx, hz);
  const rng = seeded(31);
  // (inside the house: x across, z along; its door at the north end, −z)
  const m = createMesh();
  m.tone(TONES.oak);
  for (const side of [-1, 1]) {
    const x = hx + side * BENCH.off;
    m.box('timber', { at: [x, base + BENCH.h - 0.08, hz + 0.5], size: [BENCH.d, 0.08, BENCH.len] });
    for (let k = 0; k <= 5; k++) for (const e of [-1, 1]) m.box('timber', { at: [x + e * (BENCH.d / 2 - 0.08), base, hz + 0.5 - BENCH.len / 2 + (k * BENCH.len) / 5], size: [0.08, BENCH.h - 0.08, 0.08] });
    // a lower shelf, sacks of compost under it
    m.box('timber', { at: [x, base + 0.3, hz + 0.5], size: [BENCH.d - 0.1, 0.05, BENCH.len - 0.3] });
  }
  m.tone([0.42, 0.36, 0.24]);
  for (let k = 0; k < 4; k++) m.box('timber', { at: [hx - BENCH.off + (rng() - 0.5) * 0.4, base + 0.35, hz - 6 + k * 4.2], size: [0.7, 0.45, 0.5] });
  // the Tentacula’s pot at the far end: a great glazed urn
  const tAt = [hx, base, hz + HOUSE.len / 2 - 2.4];
  m.tone([0.32, 0.22, 0.18]);
  m.lathe('rubble', { at: tAt, profile: [[0.6, 0], [0.85, 0.35], [0.95, 0.85], [1.05, 1.05], [0.98, 1.1], [0.001, 1.05]], sides: 16 });
  const geometries = m.geometries();
  for (const [name, g] of Object.entries(geometries)) {
    const mesh = new THREE.Mesh(g, materials[name]);
    mesh.castShadow = mesh.receiveShadow = tier !== 'low';
    mesh.name = `greenhouse:${name}`;
    group.add(mesh);
  }

  // the pots on the benches and the plants in them
  const spots = [];
  for (const side of [-1, 1])
    for (let k = 0; k < 22; k++) {
      if (rng() < 0.12) continue;
      spots.push([hx + side * BENCH.off + (rng() - 0.5) * 0.7, base + BENCH.h, hz + 0.5 - BENCH.len / 2 + 0.5 + k * 0.86 + (rng() - 0.5) * 0.2, 0.8 + rng() * 0.6]);
    }
  const potGeo = potGeometry();
  const potMat = house ? house.material({ color: 0xa4583a }) : new MeshLambertNodeMaterial({ color: 0xa4583a });
  const pots = new THREE.InstancedMesh(potGeo, potMat, spots.length);
  const plantGeo = new THREE.BufferGeometry();
  {
    const cards = [0, 1, 2].map((i) => new THREE.PlaneGeometry(0.5, 0.6).translate(0, 0.3, 0).rotateY((i * Math.PI) / 3).toNonIndexed());
    for (const name of ['position', 'normal', 'uv']) {
      const size = cards[0].attributes[name].itemSize;
      const all = new Float32Array(cards.reduce((s, g) => s + g.attributes[name].array.length, 0));
      let o = 0;
      for (const g of cards) {
        all.set(g.attributes[name].array, o);
        o += g.attributes[name].array.length;
      }
      plantGeo.setAttribute(name, new THREE.BufferAttribute(all, size));
    }
    cards.forEach((g) => g.dispose());
  }
  const plantMat = plantMaterial(house);
  const plants = new THREE.InstancedMesh(plantGeo, plantMat, spots.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  spots.forEach(([x, y, z, k], i) => {
    q.setFromAxisAngle(up, rng() * 6.28);
    pots.setMatrixAt(i, m4.compose(v.set(x, y, z), q, s.set(k, k, k)));
    plants.setMatrixAt(i, m4.compose(v.set(x, y + 0.3 * k, z), q, s.set(k, k * (0.8 + rng() * 0.7), k)));
  });
  pots.castShadow = tier === 'high' || tier === 'ultra';
  group.add(pots, plants);

  // the Tentacula: five vines from its pot, each a chain of bones, thick and
  // mottled purple-green, swaying slowly and striking at whoever passes
  const uTime = uniform(0);
  const vineGeo = new THREE.CylinderGeometry(0.55, 1, 1, 7, 1, true).translate(0, 0.5, 0);
  const vineMat = house ? house.material({ color: 0xffffff }) : new MeshLambertNodeMaterial({ color: 0xffffff });
  vineMat.colorNode = mix(vec3(0.16, 0.08, 0.14), vec3(0.22, 0.3, 0.1), sin(positionLocal.y.mul(9).add(uTime.mul(0.3))).mul(0.5).add(0.5));
  const limbs = TENTACULA.limbs;
  const SEG = [0.34, 0.28, 0.22, 0.16];
  const PITCH = [1.1, 0.5, -0.1, -0.6];
  const vines = new THREE.InstancedMesh(vineGeo, vineMat, limbs.length * SEG.length);
  vines.frustumCulled = false;
  vines.castShadow = tier !== 'low';
  group.add(vines);
  let state = newWillow();
  let t = 0;
  const dir = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const pose = () => {
    const angles = limbAngles(state, t, TENTACULA);
    let b = 0;
    limbs.forEach((limb, i) => {
      let p = [tAt[0] + Math.sin(limb.yaw) * 0.4, tAt[1] + 1.0, tAt[2] + Math.cos(limb.yaw) * 0.4];
      let r = 0.11;
      SEG.forEach((share, k) => {
        const y = limb.yaw + angles[i].yaw * (1 + 0.5 * k);
        const pitch = PITCH[k] + angles[i].lift * (1.2 - 0.2 * k);
        const len = limb.length * share;
        dir.set(Math.sin(y) * Math.cos(pitch), Math.sin(pitch), Math.cos(y) * Math.cos(pitch));
        q.setFromUnitVectors(up, dir);
        vines.setMatrixAt(b++, m4.compose(pos.set(...p), q, s.set(r, len, r)));
        p = [p[0] + dir.x * len, p[1] + dir.y * len, p[2] + dir.z * len];
        r *= 0.66;
      });
    });
    vines.instanceMatrix.needsUpdate = true;
  };
  pose();

  // what the walk goes round inside: the benches, the urn
  const colliders = [
    ...[-1, 1].map((side) => ({ id: 'bench', kind: 'box', at: [hx + side * BENCH.off, hz + 0.5], w: BENCH.d, d: BENCH.len, turn: 0 })),
    { id: 'tentacula', kind: 'circle', at: [tAt[0], tAt[2]], r: 1.1 },
  ];

  return {
    group,
    colliders,
    tentacula: [tAt[0], tAt[2]],
    step(dt, { you = null } = {}) {
      t += dt;
      uTime.value = t;
      state = stepWillow(state, dt, { you: you ? [you[0] - tAt[0], you[1] - tAt[2]] : null }, TENTACULA);
      pose();
      return state.ev;
    },
    dispose() {
      for (const g of Object.values(geometries)) g.dispose();
      potGeo.dispose();
      potMat.dispose();
      plantGeo.dispose();
      plantMat.dispose();
      vineGeo.dispose();
      vineMat.dispose();
    },
  };
}
