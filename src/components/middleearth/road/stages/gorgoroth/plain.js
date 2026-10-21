// Gorgoroth's plain, as the films have it: ash boulders and fangs of rock
// strewn either side of the road, thick near it and thinning out; two orc
// camps off it with their fires burning; and cracks in the plain glowing
// with the fire under it, breathing slowly. The places are place.js's
// (pure); this draws them with the Mount Doom chapter's kit.
//
//   buildPlain({ kit, heightAt, tier }) → { group, update(t), dispose }

import * as THREE from 'three';
import { CAMPS, fissures, strewn } from './place';

const MANY = { high: 1, mid: 0.7, low: 0.4 };
const WIDE = 0.34; // m: a crack's glow either side of its line
const LIFT = 0.08; // m over the land, over the drawn ground's own reading of it
const HOT = new THREE.Color(1.9, 0.62, 0.14); // (over 1: the house bloom takes it)

// one instanced draw of a geometry at [x, z, scale, turn] on the ground, sunk a little
function scatter(geo, material, list, heightAt, sink) {
  const mesh = new THREE.InstancedMesh(geo, material, list.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  list.forEach(([x, z, s, turn], i) => {
    q.setFromAxisAngle(up, turn);
    m.compose(new THREE.Vector3(x, heightAt(x, z) - sink * s, z), q, new THREE.Vector3(s, s * 0.8, s));
    mesh.setMatrixAt(i, m);
  });
  return mesh;
}

// the cracks as one mesh: each line a ribbon of three rows, dark at its
// edges and white-hot down its middle (added, so its edges are nothing)
function cracksGeo(lines, heightAt) {
  const pos = [];
  const col = [];
  const idx = [];
  for (const line of lines) {
    const base = pos.length / 3;
    line.forEach(([x, z], i) => {
      const [px, pz] = line[Math.max(0, i - 1)];
      const [nx, nz] = line[Math.min(line.length - 1, i + 1)];
      const dx = nx - px;
      const dz = nz - pz;
      const len = Math.hypot(dx, dz) || 1;
      // (narrowing to nothing at its two ends)
      const w = WIDE * Math.sin(((i + 0.5) / line.length) * Math.PI);
      const sx = (-dz / len) * w;
      const sz = (dx / len) * w;
      for (const [k, hot] of [[-1, 0], [0, 1], [1, 0]]) {
        const vx = x + sx * k;
        const vz = z + sz * k;
        pos.push(vx, heightAt(vx, vz) + LIFT, vz);
        col.push(hot, hot * 0.9, hot * 0.8);
      }
      if (i > 0) {
        const a = base + (i - 1) * 3;
        const b = base + i * 3;
        // (wound to face up: the camera is always above them)
        idx.push(a, a + 1, b, a + 1, b + 1, b, a + 1, a + 2, b + 1, a + 2, b + 2, b + 1);
      }
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}

export function buildPlain({ kit, heightAt, tier = 'high' }) {
  const group = new THREE.Group();
  group.name = 'gorgoroth:plain';
  const k = MANY[tier] ?? 1;

  // the boulders, in three shapes, and the fangs further out
  const rocks = strewn(24, Math.round(150 * k));
  [1, 2, 3].forEach((seed, i) => group.add(scatter(kit.ashRock(seed), kit.mats.rock, rocks.filter((_, j) => j % 3 === i), heightAt, 0.3)));
  group.add(scatter(kit.spike(1), kit.mats.rock, strewn(31, Math.round(36 * k), { near: 14, far: 90 }), heightAt, 0.4));

  // the camps, their fires burning (one on low)
  const camps = CAMPS.slice(0, tier === 'low' ? 1 : CAMPS.length).map(([x, z], i) => {
    const c = kit.camp();
    c.group.position.set(x, heightAt(x, z), z);
    c.group.rotation.y = 0.6 + i * 2.1;
    group.add(c.group);
    return c;
  });

  // the cracks, the fire under the plain showing through
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true, color: HOT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const cracks = new THREE.Mesh(cracksGeo(fissures(42, Math.round(28 * k)), heightAt), glow);
  cracks.name = 'gorgoroth:cracks';
  cracks.renderOrder = 1;
  group.add(cracks);

  return {
    group,
    update(t) {
      for (const c of camps) c.update(t);
      // (the cracks breathing, slowly, the fire under them never quite still)
      const b = 0.78 + 0.16 * Math.sin(t * 0.9) + 0.06 * Math.sin(t * 2.7);
      glow.color.copy(HOT).multiplyScalar(b);
    },
    dispose() {
      cracks.geometry.dispose();
      glow.dispose();
      group.removeFromParent();
    },
  };
}
