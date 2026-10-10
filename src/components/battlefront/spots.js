// The gallery's spots (the sixth design's picture lane): the places
// scripts/battlefront-shots.mjs shoots the game's world from, taken from the
// level's own records so they stand where the game's things are. Beside lane
// 5's three shots (the deploy screen over the overview camera, the field
// after deploying, the end card) they make twelve. Pure.
//
//   SPOTS: the names, in order
//   spotsOf(map, stages) → [{ name, at, lookAt, fov, weather?, source }]
//   (the world pins one with do('spot', name); export frame, metres)
//
// - walker: under the first AT-AT's path (the escort's waypoints), 2 m off
//   the ground beside its third point, looking up the path where the walker
//   towers (the design's "trench under the AT-AT")
// - uplink: the first uplink's console, from 14 m off and 5 m up
// - hangar: the hangars stage's first capture volume from 40 m out in the
//   level's low sun (Hoth has no dawn record: its sunset is the low sun)
// - hangarInside: the same volume from within, under the interior record
// - camera1 … camera5: the level's own CameraEntityData for the mode, as
//   the game placed them (the overview the deploy screen picks is one)

import { OVERVIEW_FOV } from './camera.js';

export const SPOTS = ['walker', 'uplink', 'hangar', 'hangarInside', 'camera1', 'camera2', 'camera3', 'camera4', 'camera5'];
const FOV = 70;
const AHEAD = 100; // m a camera's look is aimed ahead

const lookDir = (yaw, pitch) => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
const add = (a, b, k = 1) => a.map((v, i) => v + b[i] * k);
const centre = (v) => {
  const n = v.points.length;
  const [x, z] = v.points.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n], [0, 0]);
  return [x, v.y + (v.height ?? 0) / 2, z];
};
const flat = (from, to) => {
  const d = [to[0] - from[0], 0, to[2] - from[2]];
  const l = Math.hypot(d[0], d[2]) || 1;
  return [d[0] / l, 0, d[2] / l];
};

export function spotsOf(map, stages) {
  const volume = (id) => map.volumes.find((v) => v.id === id) ?? null;
  const objectives = (stages?.stages ?? []).flatMap((s) => s.objectives);
  const out = [];
  const escort = objectives.find((o) => o.type === 'escort');
  const path = escort && map.waypoints.find((w) => w.id === escort.waypoints);
  if (path?.points.length >= 5) {
    const [a, b] = [path.points[2], path.points[4]];
    const along = flat(a, b);
    const side = [-along[2], 0, along[0]];
    out.push({ name: 'walker', at: add(add(a, side, 6), [0, 2, 0]), lookAt: add(b, [0, 18, 0]), fov: FOV, source: path.id });
  }
  const uplink = objectives.filter((o) => o.type === 'uplink').map((o) => volume(o.volume)).find(Boolean);
  if (uplink) {
    const c = centre(uplink);
    out.push({ name: 'uplink', at: add(c, [10, 5, 10]), lookAt: c, fov: FOV, source: uplink.id });
  }
  const hangar = objectives.filter((o) => o.type === 'capture').map((o) => volume(o.volume)).find(Boolean);
  if (hangar) {
    const c = centre(hangar);
    // (out from the hangar toward the field: the first uplink's side)
    const out1 = uplink ? flat(c, centre(uplink)) : [0, 0, 1];
    out.push({ name: 'hangar', at: add(add(c, out1, 40), [0, 6, 0]), lookAt: c, fov: FOV, weather: 'sunset', source: hangar.id });
    out.push({ name: 'hangarInside', at: add(add(c, out1, -6), [0, 1, 0]), lookAt: add(add(c, out1, 30), [0, 2, 0]), fov: FOV, weather: 'interior', source: hangar.id });
  }
  const cams = (map.cameras ?? []).filter((c) => !c.mode || c.mode === (stages?.mode ?? 'galacticAssault')).slice(0, 5);
  cams.forEach((c, i) => out.push({ name: `camera${i + 1}`, at: c.at.slice(), lookAt: add(c.at, lookDir(c.yaw, c.pitch), AHEAD), fov: c.fov > 0 ? c.fov : OVERVIEW_FOV, source: c.id }));
  return out;
}
