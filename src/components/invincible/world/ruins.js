// What a broken tower leaves (./demolish.js says how broken): rubble at the
// foot of one whose top is gone, one instanced draw for every chunk in the
// city; scaffolding round one Cecil's crews are mending, a wire cage a
// little bigger than the tower, one instanced draw; and, off low tier, a
// little smoke off the stubs. The towers' own cracks and bites are the
// facade's (./facade.js reads `aHurt`; ./city.js's setDamage writes it).
//
// createRuins(parent, { level }) → { mark(key, d, box, mending), update(dt, vfx, calm), dispose() }
//   box: { x, z, w, d, h } from ./city.js's boxOf; a mark with d 0 clears the key

import * as THREE from 'three';
import { RUINS, heightOf, stageOf } from './demolish';
import { groundAt } from './map';

const CAP = 400; // chunks, and cages, at most (the spec's budget)
const CHUNKS = 6; // a stub's rubble
const SMOKE_EVERY = 0.45;
const SMOKE_STUBS = 12; // (the nearest first would be nicer; the first dozen marked is cheap)

const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
};

export function createRuins(parent, { level = 'high' } = {}) {
  const group = new THREE.Group();
  group.name = 'ruins';
  parent.add(group);
  const chunkGeo = new THREE.BoxGeometry(1, 1, 1);
  const chunkMat = new THREE.MeshStandardMaterial({ color: 0x8e8a82, roughness: 0.95 });
  const rubble = new THREE.InstancedMesh(chunkGeo, chunkMat, CAP);
  rubble.count = 0;
  rubble.castShadow = level !== 'low';
  rubble.receiveShadow = true;
  rubble.frustumCulled = false;
  group.add(rubble);
  const cageGeo = new THREE.BoxGeometry(1, 1, 1, 3, 8, 3);
  const cageMat = new THREE.MeshBasicMaterial({ color: 0xc9a34a, wireframe: true, transparent: true, opacity: 0.75, toneMapped: false });
  const cages = new THREE.InstancedMesh(cageGeo, cageMat, CAP);
  cages.count = 0;
  cages.frustumCulled = false;
  group.add(cages);
  const M = new THREE.Matrix4();
  const P = new THREE.Vector3();
  const Q = new THREE.Quaternion();
  const S = new THREE.Vector3();
  const marks = new Map(); // key → { d, box, mending }
  let dirty = false;
  let smokeT = 0;
  const stubs = [];

  function rebuild() {
    dirty = false;
    let nChunks = 0;
    let nCages = 0;
    stubs.length = 0;
    for (const [key, m] of marks) {
      const stage = stageOf(m.d);
      if (stage === 3 && nChunks + CHUNKS <= CAP) {
        const r = hash(key);
        const top = m.box.h * heightOf(m.d);
        stubs.push([m.box.x, groundAt(m.box.x, m.box.z) + top, m.box.z]);
        for (let i = 0; i < CHUNKS; i++) {
          // round the foot, a few metres out, leaning as they fell
          const a = r() * Math.PI * 2;
          const out = Math.max(m.box.w, m.box.d) / 2 + 1 + r() * 4;
          const size = 1.2 + r() * 2.4;
          const x = m.box.x + Math.cos(a) * out;
          const z = m.box.z + Math.sin(a) * out;
          rubble.setMatrixAt(nChunks++, M.compose(P.set(x, groundAt(x, z) + size * 0.3, z), Q.setFromEuler(new THREE.Euler(r() * 0.6, r() * Math.PI, r() * 0.6)), S.set(size, size * (0.5 + r() * 0.5), size * (0.6 + r() * 0.6))));
        }
      }
      if (m.mending && m.d > 0 && nCages < CAP) {
        const hh = m.box.h * heightOf(m.d) + 1;
        cages.setMatrixAt(nCages++, M.compose(P.set(m.box.x, groundAt(m.box.x, m.box.z) + hh / 2, m.box.z), Q.identity(), S.set(m.box.w + 1.2, hh, m.box.d + 1.2)));
      }
    }
    rubble.count = nChunks;
    cages.count = nCages;
    rubble.instanceMatrix.needsUpdate = true;
    cages.instanceMatrix.needsUpdate = true;
  }

  return {
    group,
    mark(key, d, box, mending = false) {
      if (!box) return;
      if (d > 0) marks.set(key, { d, box, mending });
      else marks.delete(key);
      dirty = true;
    },
    update(dt, vfx, calm = false) {
      if (dirty) rebuild();
      if (calm || level === 'low' || !stubs.length || !vfx) return;
      smokeT += dt;
      if (smokeT < SMOKE_EVERY) return;
      smokeT = 0;
      for (const [x, y, z] of stubs.slice(0, SMOKE_STUBS)) vfx.smoke(new THREE.Vector3(x, y + 1, z), { size: 3.5, count: 1, life: 2.4, color: 0x3a3634, to: 0x7a7470, rise: 2.2, opacity: 0.45 });
    },
    get keep() {
      return RUINS.keep;
    },
    dispose() {
      group.removeFromParent();
      chunkGeo.dispose();
      chunkMat.dispose();
      cageGeo.dispose();
      cageMat.dispose();
    },
  };
}
