// A marching column on a stage: an instanced mesh of one marcher (the
// Easterlings to the Morannon, the Haradrim on their road, the Morgul host
// out of its vale, the orcs on Gorgoroth’s road) set in ranks along a
// straight road and moved along it, those that reach its end coming round
// again at its start, so a column is endless however long its beat holds.
//
//   rankAt(i, t, { from, to, files, gap, spacing, speed }) → { x, z, row }
//   marchColumn(mesh, road, heightAt, t, { scale }) moves every instance to its place at t

import * as THREE from 'three';

export function rankAt(i, t, { from, to, files = 4, gap = 1.6, spacing = 1.3, speed = 1.4 }) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const span = Math.hypot(dx, dz) || 1;
  const row = Math.floor(i / files);
  const along = (((row * gap + t * speed) % span) + span) % span;
  const across = ((i % files) - (files - 1) / 2) * spacing;
  return { x: from[0] + (dx / span) * along - (dz / span) * across, z: from[1] + (dz / span) * along + (dx / span) * across, row };
}

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const p = new THREE.Vector3();
const s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export function marchColumn(mesh, road, heightAt, t, { scale = 0.8 } = {}) {
  q.setFromAxisAngle(UP, Math.atan2(road.to[0] - road.from[0], road.to[1] - road.from[1]));
  s.setScalar(scale);
  for (let i = 0; i < mesh.count; i++) {
    const r = rankAt(i, t, road);
    // (a little bob, out of step rank to rank)
    p.set(r.x, heightAt(r.x, r.z) + Math.abs(Math.sin(t * 4 + r.row)) * 0.05, r.z);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
}
