// The universe map's camera, as plain numbers: where it sits for the overview
// and for each universe, how it gets from one to the other, and where a point
// lands on screen. Pure (no three.js objects), so it's tested in Node and the
// scene only copies the numbers onto its camera.
//
// A pose is { target: [x, y, z], dist, pitch }: the camera looks at `target`
// from `dist` away, raised `pitch` radians above the map's plane. The map's
// own turn (yaw) is the scene's, applied to the planets, not to the camera.
//
// The panel covers part of the canvas (the right side on a desktop, the
// bottom sheet on a phone, the nav along the top), so the view is centred in
// the part that's left: a lens shift, which the scene applies with
// camera.setViewOffset(w, h, -sx, -sy, w, h).

import { easeOut } from '../../lib/three/renderer';
import { HOME_RADIUS, POSITIONS, REACH } from './layout';
import { byId } from './universes';

export const FOV = 34; // vertical, degrees
export const FLIGHT_MS = 1400;
export const DIVE_MS = 600;
const OVERVIEW_PITCH = 0.62;
const FOCUS_PITCH = 0.3;
const FOCUS_FILL = 0.5; // a selected universe's share of the open area
const PAD = 18; // px kept clear around the overview
const LABEL = 30; // px under each planet for its label
const TAN = Math.tan((FOV * Math.PI) / 360);

// The chase camera, flying: it looks at a point `ahead` of the ship and
// `up` above it, from `dist` back, and `speed` further back at the boost
// (the speed's share capped at one and a half boosts' worth) and `streak`
// further in the lightspeed streak. Near enough that the ship is a fifth to
// a quarter of the frame's width at cruise and not under a seventh at the
// boost (the hero, the biggest thing on screen); `tilt` is the radians the
// camera looks down at it (scene.js's TILT).
export const CHASE = { ahead: 0.15, up: 0.1, dist: 1.1, speed: 0.6, streak: 0.5, tilt: 0.21 };

export const chaseDist = ({ speed = 0, boost = 1, streak = 0 } = {}) => CHASE.dist + Math.min(Math.abs(speed) / boost, 1.5) * CHASE.speed + streak * CHASE.streak;

// How far in front of the camera, along its view, the ship sits at a chase
// distance: the target is ahead of the ship and above it, and the camera
// looks down at it by the tilt, so the ship is nearer than `dist`
export const chaseDepth = (dist) => dist - CHASE.ahead * Math.cos(CHASE.tilt) + CHASE.up * Math.sin(CHASE.tilt);

// The share of the frame's width a ship `length` across takes at `dist` in
// front of a camera with a vertical `fov` (degrees) on a frame `aspect` wide
export const shipWidthOf = ({ length, fov = FOV, dist, aspect }) => length / (2 * dist * Math.tan((fov * Math.PI) / 360) * aspect);

// The part of a w×h canvas the panel, sheet and nav leave open, and the
// shift that centres the view in it.
export function cover({ w, h, panel = 0, sheet = 0, top = 0 }) {
  const cw = Math.max(1, w - panel);
  const ch = Math.max(1, h - sheet - top);
  return { x: 0, y: top, w: cw, h: ch, sx: -panel / 2, sy: (top - sheet) / 2 };
}

export function cameraFrom({ target, dist, pitch }) {
  return {
    position: [target[0], target[1] + dist * Math.sin(pitch), target[2] + dist * Math.cos(pitch)],
    target,
  };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

// Where a point lands on a w×h canvas, in CSS px, the same way three.js
// projects it (vertical fov, lookAt with +y up), plus the lens shift.
// The third number is its depth in front of the camera.
export function project(point, pose, { w, h }, { sx = 0, sy = 0 } = {}) {
  const { position, target } = cameraFrom(pose);
  const f = norm(sub(target, position));
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const d = sub(point, position);
  const z = dot(d, f);
  const nx = dot(d, r) / (z * TAN * (w / h));
  const ny = dot(d, u) / (z * TAN);
  return [((nx + 1) / 2) * w + sx, ((1 - ny) / 2) * h + sy, z];
}

// A universe's centre with the map turned by `yaw` (three.js rotation.y),
// written into `out` where there is one (a dive asks every frame of it).
export function worldPos(id, yaw = 0, out = null) {
  const [x, y, z] = POSITIONS[id];
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  if (!out) return [x * c + z * s, y, -x * s + z * c];
  out[0] = x * c + z * s;
  out[1] = y;
  out[2] = -x * s + z * c;
  return out;
}

// The home system in the open area, whichever way it's turned: the nearest
// distance at which a ring round its outer edge (the stations, the belt and
// their labels) fits inside it. The far worlds are lights beyond it.
export function overviewPose(size, rect) {
  const ring = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    ring.push([HOME_RADIUS * 1.25 * Math.cos(a), 0, HOME_RADIUS * 1.25 * Math.sin(a)]);
  }
  const shift = { sx: rect.sx, sy: rect.sy };
  const fits = (pose) =>
    ring.every((p) => {
      const [x, y] = project(p, pose, size, shift);
      return x >= rect.x + PAD && x <= rect.x + rect.w - PAD && y >= rect.y + PAD && y <= rect.y + rect.h - PAD - LABEL;
    });
  const pose = { target: [0, 0, 0], dist: 6, pitch: OVERVIEW_PITCH };
  for (let n = 0; n < 400 && !fits(pose); n++) pose.dist *= 1.02;
  return pose;
}

// One place, centred in the open area at about half its size (a station a
// little closer and from a little higher, so it fills the view and the sun
// behind it drops away).
export function focusPose(id, yaw, size, rect) {
  const station = byId(id)?.kind === 'core';
  const fill = station ? 0.72 : FOCUS_FILL;
  const dist = (REACH[id] * size.h) / (TAN * fill * Math.min(rect.w, rect.h));
  return { target: worldPos(id, yaw), dist, pitch: station ? 0.46 : FOCUS_PITCH };
}

const mix = (a, b, t) => a + (b - a) * t;
const mixPose = (a, b, t) => ({
  target: [0, 1, 2].map((i) => mix(a.target[i], b.target[i], t)),
  dist: Math.exp(mix(Math.log(a.dist), Math.log(b.dist), t)),
  pitch: mix(a.pitch, b.pitch, t),
});

// A flight starts from wherever the camera is now (even mid-flight); where
// it's going is asked for each frame, so a turn of the map or a resize on
// the way just moves the destination.
export const startFlight = (from, now, dur = FLIGHT_MS) => ({ from, start: now, dur });

export function poseAt(flight, to, now) {
  if (!flight) return { pose: to, done: true };
  const t = Math.min(1, Math.max(0, (now - flight.start) / flight.dur));
  if (t <= 0) return { pose: flight.from, done: false };
  return { pose: t >= 1 ? to : mixPose(flight.from, to, easeOut(t)), done: t >= 1 };
}

// How Enter leaves the map: Star Wars jumps to lightspeed (unless you came
// in Rick's cruiser), the cruiser goes everywhere through a portal, the rest
// dive into their planet; with reduced motion or no 3D it just goes.
export function enterPlan(universe, { reduced, three, ship = null }) {
  if (!universe) return null;
  if (reduced || !three) return { mode: 'now', delay: 0 };
  if (universe.portal) return { mode: 'jump', delay: 1250 }; // (a gate: to lightspeed, whatever you fly)
  if (ship === 'cruiser') return { mode: 'portal', delay: DIVE_MS };
  return { mode: 'dive', delay: DIVE_MS };
}

// Flying into a planet or a station too fast: the crash plays, and then you
// go on into its page, the screen washing out in its colour on the way
// (straight there with reduced motion). The sun has no page: it just
// swallows you and you come back beside it (null).
export function crashPlan(universe, { reduced }) {
  if (!universe) return null;
  return { mode: 'crash', delay: reduced ? 0 : 700 };
}

// Falling into the black hole: the fall plays, the screen goes black with
// where you're going written on it while the crew have their say, and then
// you're through, out of the site and into what's on the hole's far side (a
// friend's universe, deep.js's `beyond`). Straight there with reduced motion.
export function beyondPlan({ reduced }) {
  return { mode: 'beyond', delay: reduced ? 0 : 4000 };
}
