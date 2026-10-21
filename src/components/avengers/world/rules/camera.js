// The camera: the walking keys turned by its yaw, where it sits behind him,
// inside the Quinjet, and photo mode.

import { inPoly } from '../../compound/plan';
import { LAWN_W, PARKED_JET, SOLIDS, nearestEdge } from './plan';
import { floorAt } from './bump';

// The walking keys and the stick, turned by the camera's yaw into the world.
export function cameraMove(yaw, forward, right) {
  return { x: -Math.sin(yaw) * forward + Math.cos(yaw) * right, z: -Math.cos(yaw) * forward - Math.sin(yaw) * right };
}
// the yaw that puts the camera behind a hero facing `face`
export const behindYaw = (face) => Math.atan2(-Math.cos(face), Math.sin(face));

// How far from the hero (lx, lz) out to the camera (cx, cy, cz) it can be
// before it's in a building, under the bridge's deck or out in the woods:
// 0 (at the hero) to 1 (all the way).
// Whether a point is in a Quinjet, for the camera (the parked one unless
// another's pose { x, y, z, yaw, scale } is given: the one that flies, down
// on its pad): its fuselage (to the top of the canopy) or its wings (a slab
// a metre either side of where they sit). The camera went straight into
// them, and the screen was a sheet of grey.
export function inJet(x, y, z, jet = PARKED_JET) {
  const s = jet.scale;
  const dx = x - jet.x;
  const dz = z - jet.z;
  const dy = y - (jet.y ?? 0);
  const along = (dx * Math.sin(jet.yaw) + dz * Math.cos(jet.yaw)) / s;
  const across = Math.abs(dx * Math.cos(jet.yaw) - dz * Math.sin(jet.yaw)) / s;
  if (along > 15 || along < -15 || across > 13.4 || dy < -1) return false;
  // the fuselage, nose to tail
  if (across < 3.4 && along < 14 && along > -14 && dy < 4.6 * s + 1.2) return true;
  // the wings: from 1.6 out to 12.6, 5 forward to 12.6 back, in the jet's metres
  return across < 13.2 && along < 5.6 && along > -13.2 && Math.abs(dy - 2.35 * s) < 1.1;
}

// `jets`: other Quinjets' poses to keep out of (inJet)
export function camRoom(lx, lz, cx, cy, cz, jets = null) {
  const len = Math.hypot(cx - lx, cz - lz);
  const n = Math.max(1, Math.ceil(len / 0.25));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const x = lx + (cx - lx) * t;
    const z = lz + (cz - lz) * t;
    const y = cy; // (the camera's height; it barely changes along the way)
    let hit = (!inPoly(x, z, LAWN_W) && y < 22) || inJet(x, y, z) || (jets ? jets.some((j) => inJet(x, y, z, j)) : false);
    for (const b of SOLIDS) {
      if (hit) break;
      if (y > b.h + 0.6 || y < b.y0 - 0.6) continue;
      const [x0, z0, x1, z1] = b.box;
      if (x < x0 - 0.4 || x > x1 + 0.4 || z < z0 - 0.4 || z > z1 + 0.4) continue;
      hit = inPoly(x, z, b.foot) || nearestEdge(x, z, b.foot).d < 0.4;
    }
    if (hit) return Math.max(0, (i - 1) / n - 0.04);
  }
  return 1;
}

// ── photo mode: time stopped, a camera to put anywhere round him ──
// { yaw, pitch, dist, fov }: round him, up over him (or a little under),
// how far, and the lens. photoView puts the camera there, looking at his
// chest, brought in rather than go into a building and never under the
// ground or a roof.
export const PHOTO = { dist: [1.6, 30], pitch: [-0.35, 1.45], fov: [18, 90] };
export const newPhoto = (yaw = 0, pitch = 0.25) => ({ yaw, pitch: Math.max(PHOTO.pitch[0], Math.min(PHOTO.pitch[1], pitch)), dist: 5.5, fov: 50 });
export function readPhoto(p) {
  const c = (v, [a, b], d) => (Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : d);
  return { yaw: Number.isFinite(p?.yaw) ? p.yaw : 0, pitch: c(p?.pitch, PHOTO.pitch, 0.25), dist: c(p?.dist, PHOTO.dist, 5.5), fov: c(p?.fov, PHOTO.fov, 50) };
}
export function photoView(h, photo) {
  const { yaw, pitch, dist } = readPhoto(photo);
  const look = [h.x, h.y + 1.1, h.z];
  let at = [h.x + Math.sin(yaw) * Math.cos(pitch) * dist, look[1] + Math.sin(pitch) * dist, h.z + Math.cos(yaw) * Math.cos(pitch) * dist];
  const k = camRoom(look[0], look[2], at[0], at[1], at[2]);
  if (k < 1) {
    const kk = Math.max(0.12, k);
    at = at.map((v, i) => look[i] + (v - look[i]) * kk);
  }
  const floor = floorAt(at[0], at[2], Math.max(at[1], h.y)) + 0.3;
  if (at[1] < floor) at[1] = floor;
  return { at, look };
}
