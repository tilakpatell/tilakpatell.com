// How he moves, in numbers: walking, swinging, the suit, tricks and the
// settings a visitor can change.

import { ARMOUR } from './plan';

// ── walking ──

// metres a second, and how fast he gets there: a brisk walk, a run like a
// super-hero's, and a spider's jump (about a metre and three quarters)
export const HERO = { walk: 2.8, run: 9.5, accel: 15, turn: 11, jump: 8.4, gravity: 21, air: 0.35 };

// His walk clip covers 1.5 m a second and his run 5.08 (manifest.json's
// spiderman.speeds), and a clip played much faster or slower than its own
// pace looks it, its feet sliding: so the walk plays at most 2.4 times its
// pace and the run at least 0.55 of its own (`rates`), and the change from
// one to the other comes between those, up to a run past 3.45 m a second
// and back to a walk under 3.05 (his plain walk, 2.8, is always a walk).
export const GAIT = { walk: 1.5, run: 5.08, up: 3.45, down: 3.05, rates: { walk: [0.35, 2.4], run: [0.55, 2.4] } };

// Which of his clips for how fast he's going, given the one playing: each
// change a little past the line it's at, so speeding up or easing off across
// it doesn't flick from one clip to the other and back every frame
export function gaitFor(playing, speed) {
  if (speed < (playing === 'idle' ? 0.5 : 0.3)) return 'idle';
  if (playing === 'run') return speed < GAIT.down ? 'walk' : 'run';
  if (playing === 'walk') return speed > GAIT.up ? 'run' : 'walk';
  return speed < (GAIT.up + GAIT.down) / 2 ? 'walk' : 'run';
}

// ── swinging, and climbing ──
// Engineered from how Insomniac describe their web-swinging and how the
// open re-creations of it work (docs/research/2026-10-05-web-swinging.md):
// a web only ever sticks to something real (a roof's edge, a tree, a mast),
// picked as the best point ahead and above for where he's going; the swing is
// a rope, but not pure physics: it turns toward where you steer, pushes him
// off a wall he's swinging alongside, keeps a chain of swings at its height,
// turns a dive into speed, and hangs him a beat at the top of each flight.
// Let go on the upswing, past the anchor, for a perfect release (faster,
// higher, a flip); go into a wall and he sticks to it, running up it with the
// speed he had; come down on a roof and he's on it. A web zip (Shift in the
// air) is a burst along the way he's going.
export const SWING = {
  reach: 46, // the furthest a web catches (m)
  minUp: 4.5, // an anchor at least this far over his feet
  near: 7, // and no nearer than this: that's no swing at all
  elev: [0.45, 1.3], // the web's angle above the horizontal a swing wants (radians: 26° to 75°)
  arm: 0.22, // seconds of a jump held from the ground before it becomes a web
  rearm: 0.2, // a beat after letting go before a held button webs again (no pumping speed out of web spam)
  pump: 6.5, // a swing's own push along its arc (m/s²): he swings, he doesn't just hang
  pumpMax: 1.25, // and it never pushes an arc past this far from the vertical (radians)
  assist: 1.2, // how fast a swing (and a flight, at half that) turns toward where you steer (rad/s)
  steer: 5, // and a little push that way besides (m/s²)
  takeUp: 14, // how fast a web takes up its slack (m/s)
  clear: 1.4, // the lowest a swing comes to the ground, or a roof
  dip: 6, // nor further than this under where he caught the web: a chain of swings keeps its height
  push: 14, // out from a wall he's swinging alongside (m/s²), within `pushAt` of it
  pushAt: 3.2,
  maxSpeed: 40,
  ceiling: 75, // the sky, as far as he goes
  drag: 0.0035, // air resistance, per metre a second
  hang: 0.6, // gravity at the top of a flight (|vy| < 3): a beat of hang time
  dive: 0.6, // how much of a dive's fall a web turns into speed along the way he's going
  release: { boost: 1.03, pop: 2.5, popMax: 12 }, // letting go on the way up
  perfect: { from: 0.2, to: 0.95, boost: 1.1, lift: 4 }, // the release window: past the vertical, forward (radians)
  letGo: 1.25, // that far past the anchor, the web would only pull him back: he lets go
  zip: { speed: 11, up: 3, cool: 0.6, charges: 2, max: 30, reach: 20 }, // a web zip: +11 m/s forward, two per flight
  corner: { turn: 1, reach: 28, out: 2.5, whip: 3, time: 0.6, cool: 1 }, // a corner swing: steer this hard (rad) near a corner, and the web goes to it
  point: { reach: 45, speed: 32, accel: 70, launch: { out: 15, up: 11 }, window: 0.6 }, // a point launch: zip to a perch, jump off it
  glide: { sink: 3, speed: 15, push: 6, turn: 0.9, above: 3 }, // web wings: held web, nothing to catch, falling
  climb: 4.2, // up a wall (m/s), and with Shift
  climbRun: 7,
  wallRun: { carry: 0.75, min: 8, max: 16, fade: 9 }, // the speed he hits a wall with, carried up it
  kick: { out: 7.5, up: 8.6 }, // off a wall
  restick: 0.4, // seconds before the wall he kicked off will hold him again
  stick: 1.5, // how hard into a wall he has to be going to stick to it (m/s)
};
// Air tricks, as Insomniac's: in free flight (off a web, a wall or a perch,
// not on a web), a press turns a flip (forward, or back with the stick
// pulled back) or a twist (with the stick to a side). Each is worth style
// points, more for each in a row without touching down; a perfect release
// counts too; landing banks the lot, landing mid-trick loses it (a bail).
// The Iron Man armour by the workshop's door: suit up in it (E at the
// plinth) and it flies, on its repulsors: it hovers, Space takes it up and
// Shift brings it down, the stick drives it, and it leans into its speed.
// E again steps out of it, wherever you are, and the armour goes home.
export const SUIT = {
  r: 3.2, // how near the plinth you have to be to suit up
  accel: 26, // along the stick (m/s²)
  lift: 22, // up with Space, and down with Shift (m/s²)
  top: 38, // as fast as it goes (m/s)
  climb: 16, // and up or down
  drag: 1.4, // how quickly it stops when nothing's pressed (per second)
  hover: 1.3, // how high over the ground it holds, idle
  turn: 7, // how quickly it faces the way it's going (rad/s)
  ceiling: 120,
};
export const nearArmour = (x, z) => Math.hypot(x - ARMOUR.x, z - ARMOUR.z) < SUIT.r;

export const TRICK = {
  time: 0.75, // seconds a trick takes
  gap: 0.1, // between one and the next
  points: { flip: 100, back: 120, twist: 110, perfect: 150 },
  minAir: 0.15, // seconds off the ground before a trick counts (not a hop)
  bail: 0.45, // the crouch a bail lands in (s)
};

// ── the settings (O): how it feels, each live and kept between visits ──
// `look` scales the drag and the pad's right stick; `invert` turns the pitch
// over; `camera` scales how far back the camera sits; `assist` how much a
// swing (and a flight) comes round toward where you steer; `follow` how
// quickly the camera comes round behind him; `shake` the field-of-view
// bumps and the speed lines.
export const SETTINGS = {
  look: { label: 'Look sensitivity', min: 0.4, max: 2, step: 0.05, value: 1, hint: 'How far a drag of the mouse, or the pad’s right stick, turns the view.' },
  invert: { label: 'Invert the pitch', toggle: true, value: 0, hint: 'Drag up to look down, as a pilot would.' },
  camera: { label: 'Camera distance', min: 0.7, max: 1.6, step: 0.05, value: 1, hint: 'How far behind him the camera sits. It pulls back on its own with speed.' },
  assist: { label: 'Swing assist', min: 0, max: 2, step: 0.1, value: 1, hint: 'How much a swing comes round toward where you steer. Off, it’s a rope and nothing else.' },
  follow: { label: 'Camera follow', min: 0, max: 2, step: 0.1, value: 1, hint: 'How quickly the camera drifts round behind him once you let the view go.' },
  shake: { label: 'Camera kick', min: 0, max: 1, step: 0.05, value: 1, hint: 'The bump in the view with every web, and the lines at the edges when he’s fast.' },
};
export const SETTINGS_DEFAULTS = Object.fromEntries(Object.entries(SETTINGS).map(([k, r]) => [k, r.value]));
// Settings as kept (or anything): each within its range, the rest as they came.
export function readSettings(raw) {
  const out = { ...SETTINGS_DEFAULTS };
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, r] of Object.entries(SETTINGS)) {
    const v = raw[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    out[k] = r.toggle ? (v ? 1 : 0) : Math.max(r.min, Math.min(r.max, v));
  }
  return out;
}

// turned toward the way (dx, dz), at `rate`
export function turnTo(h, dx, dz, rate, dt) {
  const want = Math.atan2(-dz, dx);
  let d = want - h.face;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  h.face += d * Math.min(1, rate * dt);
}
