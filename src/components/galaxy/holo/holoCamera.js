// The holotable's camera (docs/superpowers/specs/2026-10-19-galaxy-holotable-design.md): a pose is a point on the
// galaxy's plane it looks at ([x, z] in map units, systems.js's), how far it's turned round it (yaw: 0 has the
// north at the top, as the 2D map), how steeply it looks down (pitch, radians up from the plane) and how far off
// it is (dist, grid squares). The world the scene draws is the map's own units with the core at the origin, y up:
// [x - CORE.x, lift, z - CORE.z]. The map is flat: seen straight down at every distance, a sector opened too, and the
// hands turn it round and never tip it (the owner, 2026-10-20: tilted, at 64° and then 79°, it read worse). Pure,
// tested.
//
//   WHOLE(aspect, fov, { fx, fy }) → the pose that shows the whole disc: as close as it can be with every point of the
//     rings' bulged edge within the screen's middle fx of its width and fy of its height (the rest under the side panel,
//     which the scene's lens shift leaves out: link.js's inset), the bulge's middle at the screen's (in perspective the
//     near side looms, so it's found)
//   project(pose, [x, y, z], { aspect, fov }) → the screen's normalised point (−1 … 1, y up) of a world point, and its
//     depth along the view (negative: behind)
//   eye(pose) → { at: [x, y, z], look: [x, 0, z] } the camera's place and the point it looks at, in the world
//   pitchFor(dist) → the tilt a distance looks down at (straight down at every one)
//   lensOf({ w, h }, { top, right, bottom }) → the frame the camera draws in so the disc's middle is the free part's
//     (the stage less the header over its top, the side panel at its right or the sheet along its foot): { W, H } that
//     frame's size, { x, y } where the stage is in it, its aspect, and fx, fy the free part's share of it
//   zoomAt(pose, f, anchor?) → closer by f (f > 1 in), about a map point that stays where it is on the screen
//   turn(pose, dYaw, dPitch) → turned round its point and tipped (held between LOW and HIGH)
//   pan(pose, dx, dy, { fov, h }) → slid over the plane by screen pixels (h the screen's height)
//   focus(pose, point, { dist }) → looking at a map point, no further off than dist
//   fitTo(pose, points, { aspect, fov, fx, fy, pitch }) → looking at map points' middle, as close as it can be (no closer
//     than SHOW) with every one of them in the screen's middle fx, fy and room round them for their names: a course's
//     ends, or a sector opened (at its own tilt, `pitch`, where one's given)
//   planeAt(pose, nx, ny, { aspect, fov }) → the map point under the screen's normalised point (−1 … 1, y up), or null
//   ease(from, to, dt, rate) → a step from one pose toward another (the yaw the short way round)
//   settled(a, b) → whether two poses are as good as the same

import { CORE, RIM, edgeAt } from '../systems';

export const FOV = 38; // (degrees, the vertical field of view)
export const NEAR = 2.2; // (the nearest it comes, grid squares)
// (the furthest: as far as the whole disc needs to stand off to fit the least free part there is, a phone's strip about a
// hundred pixels tall between its header and an opened sheet, which wants about 290; at 90 it spilled past it)
export const FAR = 400;
// (straight down, as the flat map is: round, its names upright, the near side no bigger than the far; a hair short of
// it, so the camera's turn still says which way is up the screen)
const FLAT = Math.PI / 2 - 0.002;
export const LOW = FLAT; // (the shallowest look, and the steepest: the same, so a turn never tips it)
export const HIGH = FLAT;
const TOP = FLAT; // (the whole disc's)
const CLOSE = FLAT; // (and close in)
const REACH = RIM + 1.5; // (how far from the core its point may go)

const deg = (d) => (d * Math.PI) / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// the tilt for a distance: from the whole disc's steep look down to a shallow one close in
export function pitchFor(dist) {
  const k = clamp((Math.log(dist) - Math.log(NEAR)) / (Math.log(28) - Math.log(NEAR)), 0, 1);
  return CLOSE + (TOP - CLOSE) * k;
}

const EDGE = 10.6; // (the outermost ring's radius before its bulge: sectors.js's Wild Space)
const ROUND = Array.from({ length: 48 }, (_, i) => {
  const a = (i / 48) * Math.PI * 2;
  return [Math.cos(a) * edgeAt(EDGE, a), 0, Math.sin(a) * edgeAt(EDGE, a)];
});
export function WHOLE(aspect = 16 / 9, fov = FOV, { fx = 1, fy = 1 } = {}) {
  // (the bulge's middle: south of the core, so the pose looks there)
  const zs = ROUND.map((p) => p[2]);
  const mid = (Math.max(...zs) + Math.min(...zs)) / 2;
  const base = { x: CORE[0], z: CORE[1] + mid, yaw: 0, pitch: TOP };
  const fits = (dist) => ROUND.every((p) => {
    const [nx, ny, depth] = project({ ...base, dist }, p, { aspect, fov });
    return depth > 0 && Math.abs(nx) <= 0.96 * fx && Math.abs(ny) <= 0.93 * fy;
  });
  let dist = 8;
  while (!fits(dist) && dist < FAR) dist *= 1.02;
  return { ...base, dist: Math.min(dist, FAR) };
}

export function lensOf({ w, h }, { top = 0, right = 0, bottom = 0 } = {}) {
  // (the frame's middle under the free part's: wider by the side panel, taller by what's over the top or the foot,
  // whichever is more)
  const dy = top - bottom;
  const W = w + right;
  const H = h + Math.abs(dy);
  // (a share no less than 0.08: a phone's strip between its header and an opened sheet is 0.11 of its frame, which a floor
  // of 0.2 fitted the disc to nearly twice the height of, spilling it past the strip)
  return { W, H, x: right, y: dy < 0 ? -dy : 0, aspect: W / Math.max(1, H), fx: Math.max(0.08, (w - right) / W), fy: Math.max(0.08, (h - top - bottom) / H) };
}

export function project(pose, [px, py, pz], { aspect = 16 / 9, fov = FOV } = {}) {
  const { at, look } = eye(pose);
  const f = [look[0] - at[0], look[1] - at[1], look[2] - at[2]];
  const fl = Math.hypot(...f);
  const fw = f.map((v) => v / fl);
  const r0 = [-fw[2], 0, fw[0]];
  const rl = Math.hypot(...r0) || 1;
  const right = r0.map((v) => v / rl);
  const up = [right[1] * fw[2] - right[2] * fw[1], right[2] * fw[0] - right[0] * fw[2], right[0] * fw[1] - right[1] * fw[0]];
  const d = [px - at[0], py - at[1], pz - at[2]];
  const depth = d[0] * fw[0] + d[1] * fw[1] + d[2] * fw[2];
  const t = Math.tan(deg(fov) / 2);
  const x = (d[0] * right[0] + d[1] * right[1] + d[2] * right[2]) / (depth * t * aspect);
  const y = (d[0] * up[0] + d[1] * up[1] + d[2] * up[2]) / (depth * t);
  return [x, y, depth];
}

// the camera's way from its point: up by the pitch, round by the yaw (0: from the south, looking north)
const away = (p) => [Math.cos(p.pitch) * Math.sin(p.yaw), Math.sin(p.pitch), Math.cos(p.pitch) * Math.cos(p.yaw)];

export function eye(pose) {
  const d = away(pose);
  const look = [pose.x - CORE[0], 0, pose.z - CORE[1]];
  return { at: [look[0] + d[0] * pose.dist, d[1] * pose.dist, look[2] + d[2] * pose.dist], look };
}

const keep = (p) => {
  const dx = p.x - CORE[0];
  const dz = p.z - CORE[1];
  const r = Math.hypot(dx, dz);
  const k = r > REACH ? REACH / r : 1;
  return { ...p, x: CORE[0] + dx * k, z: CORE[1] + dz * k, pitch: clamp(p.pitch, LOW, HIGH), dist: clamp(p.dist, NEAR, FAR) };
};

export function zoomAt(pose, f, anchor = null) {
  const dist = clamp(pose.dist / f, NEAR, FAR);
  const k = dist / pose.dist;
  // (the tilt follows the distance, keeping whatever turn of it the hands have given it)
  const pitch = pose.pitch + (pitchFor(dist) - pitchFor(pose.dist));
  const at = anchor ?? [pose.x, pose.z];
  return keep({ ...pose, dist, pitch, x: at[0] + (pose.x - at[0]) * k, z: at[1] + (pose.z - at[1]) * k });
}

export const turn = (pose, dYaw, dPitch = 0) => keep({ ...pose, yaw: pose.yaw + dYaw, pitch: pose.pitch + dPitch });

export function pan(pose, dx, dy, { fov = FOV, h = 900 } = {}) {
  // (a pixel's worth of the plane at the point it looks at, along the screen's right and its up turned onto the plane)
  const per = (2 * Math.tan(deg(fov) / 2) * pose.dist) / h;
  const right = [Math.cos(pose.yaw), -Math.sin(pose.yaw)];
  const fwd = [-Math.sin(pose.yaw), -Math.cos(pose.yaw)];
  const up = per / Math.max(0.35, Math.sin(pose.pitch));
  return keep({ ...pose, x: pose.x - right[0] * dx * per + fwd[0] * dy * up, z: pose.z - right[1] * dx * per + fwd[1] * dy * up });
}

export const focus = (pose, [x, z], { dist = 7 } = {}) => {
  const d = Math.min(pose.dist, dist);
  return keep({ ...pose, x, z, dist: d, pitch: pose.pitch + (pitchFor(d) - pitchFor(pose.dist)) });
};

const SHOW = 7; // (the closest a course's ends are shown from)
export function fitTo(pose, points, { aspect = 16 / 9, fov = FOV, fx = 1, fy = 1, pitch = null } = {}) {
  const mid = [points.reduce((n, p) => n + p[0], 0) / points.length, points.reduce((n, p) => n + p[1], 0) / points.length];
  const at = (dist) => keep({ ...pose, x: mid[0], z: mid[1], dist, pitch: pitch ?? pose.pitch + (pitchFor(dist) - pitchFor(pose.dist)) });
  const fits = (dist) => {
    const p = at(dist);
    return points.every(([x, z]) => {
      const [nx, ny, depth] = project(p, [x - CORE[0], 0, z - CORE[1]], { aspect, fov });
      return depth > 0 && Math.abs(nx) <= 0.78 * fx && Math.abs(ny) <= 0.78 * fy;
    });
  };
  let dist = SHOW;
  while (!fits(dist) && dist < FAR) dist *= 1.04;
  return at(Math.min(dist, FAR));
}

export function planeAt(pose, nx, ny, { aspect = 16 / 9, fov = FOV } = {}) {
  const { at, look } = eye(pose);
  const f = [look[0] - at[0], look[1] - at[1], look[2] - at[2]];
  const fl = Math.hypot(...f);
  const fw = f.map((v) => v / fl);
  // right: forward × up; up: right × forward
  const r0 = [-fw[2], 0, fw[0]];
  const rl = Math.hypot(...r0) || 1;
  const right = r0.map((v) => v / rl);
  const up = [right[1] * fw[2] - right[2] * fw[1], right[2] * fw[0] - right[0] * fw[2], right[0] * fw[1] - right[1] * fw[0]];
  const t = Math.tan(deg(fov) / 2);
  const dir = [0, 1, 2].map((i) => fw[i] + right[i] * nx * t * aspect + up[i] * ny * t);
  if (dir[1] >= -1e-6) return null; // (at or above the horizon)
  const s = -at[1] / dir[1];
  return [at[0] + dir[0] * s + CORE[0], at[2] + dir[2] * s + CORE[1]];
}

const short = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export function ease(from, to, dt, rate = 7) {
  const k = 1 - Math.exp(-dt * rate);
  // (the distance in log space, so zooming feels even at every scale)
  const dist = Math.exp(Math.log(from.dist) + (Math.log(to.dist) - Math.log(from.dist)) * k);
  return { x: from.x + (to.x - from.x) * k, z: from.z + (to.z - from.z) * k, yaw: from.yaw + short(to.yaw - from.yaw) * k, pitch: from.pitch + (to.pitch - from.pitch) * k, dist };
}

export const settled = (a, b) => Math.abs(a.x - b.x) < 1e-3 && Math.abs(a.z - b.z) < 1e-3 && Math.abs(short(a.yaw - b.yaw)) < 1e-4 && Math.abs(a.pitch - b.pitch) < 1e-4 && Math.abs(Math.log(a.dist / b.dist)) < 1e-4;
