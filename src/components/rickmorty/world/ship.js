// Rick's cruiser has a mind of its own, and the Galactic Federation has a ship
// over the street. What the cruiser says, and when (its lines, a cooldown on
// each kind, never two at once, never the same line twice running), and how
// the Federation's patrol ship flies (round its loop, then on the cruiser's
// tail while Morty's flying near it, slower than the cruiser flat out, and
// back to its loop once he's gone or landed). No drawing and no sound: ./scene.js
// draws the ship and the cruiser's eyes, ./RmWorld.jsx speaks the lines.

import { AREAS } from './rules';

// ── the cruiser's voice ──

// Polite, literal, quietly menacing, and over-protective of whoever's in it.
// "Keep Summer safe" is the one thing it says that the show said first.
export const SHIP_LINES = {
  board: ['Welcome aboard, Morty. Seatbelts are a formality. Survival is not.', 'Hello again, Morty. I kept your seat warm. Literally. It has a heater.', 'Morty. Rick isn’t with you. I’ve made a note of that.'],
  takeoff: ['Lifting off. Please keep your arms inside the dome.', 'Going up. The neighbours are watching. I could make them stop.', 'Airborne. I’ve disabled the part of me that worries.'],
  fast: ['This is faster than Rick lets you go. I’m choosing to allow it.', 'Speed noted. I’ve drafted a letter to your mother, just in case.', 'You fly like him. That isn’t a compliment.'],
  ceiling: ['That’s as high as I go over a suburb. Any higher and people start filing reports.', 'Ceiling reached. Above this, the air gets political.'],
  tail: ['A Federation patrol ship is following us. I have four ways to make it stop. Two are legal.', 'We have company, Morty. Shall I make it a psychological problem?', 'The Federation is on our tail. Keep calm. I am always calm.'],
  land: ['Landed. Nobody was hurt. I’d like that on the record.', 'We’re down. That was adequate, Morty.', 'Touchdown. I’ll tell Rick you were careful. I’ll lie.'],
  refuse: ['Not there, Morty. There’s something in the way, and I don’t want to hurt it. Today.', 'I can’t set down there. Find me open ground.'],
  leave: ['I’ll be here. Keep Summer safe.', 'Go on, then. I’ll watch the street. All of it.', 'Mind how you go. I’m keeping the engine warm.'],
  hello: ['Hello, Morty.', 'I see you, Morty.', 'Morty. Need a lift?'],
  idle: ['Diagnostic complete. Everything is fine. Everything is always fine.', 'Summer’s upstairs. She’s safe. I checked.', 'Still here, Morty. I’m always here.'],
};

// the voice they're made in, where they've been made (./voicelines.js, ./shipVoice.js)
export const SHIP_VOICE = 'ship';

// seconds before a kind of line may come again, and between any two lines
export const COOLDOWN = { board: 5, takeoff: 25, fast: 30, ceiling: 40, tail: 30, land: 8, refuse: 6, leave: 10, hello: 45, idle: 60 };
export const GAP = 3.5;

export const newShipVoice = () => ({ last: -Infinity, at: {}, said: {} });

// What it says to `event` at `t` seconds, if anything: { v (the voice's next
// state), line (null if it keeps quiet), held (true if it only kept quiet
// because it's just said something else: worth asking again in a moment) }.
// Each kind's lines come round in turn, so it never says the same thing twice running.
export function shipSays(v, event, t) {
  const lines = SHIP_LINES[event];
  if (!lines || t - (v.at[event] ?? -Infinity) < COOLDOWN[event]) return { v, line: null, held: false };
  if (t - v.last < GAP) return { v, line: null, held: true };
  const i = ((v.said[event] ?? -1) + 1) % lines.length;
  return { v: { last: t, at: { ...v.at, [event]: t }, said: { ...v.said, [event]: i } }, line: lines[i] };
}

// ── the Federation's patrol ship ──

// It circles an ellipse over the street at `y`, `speed` along it; it falls in
// off a flying cruiser's right flank (`behind` metres back, or ahead if it's
// less than nought, `side` out and `above` up: where the chase camera sees
// it, rather than in the camera's own place) once it comes within `near`,
// flying at up to `chase` (the cruiser's top is 22), and gives up when the
// cruiser lands or gets `lose` away. In a fight (patrolRules.js's: once
// you've shot it) it rings the cruiser `ring` out, at the angle the fight has
// it at, so you can come round to face it. It keeps over the street.
export const FED = { y: 19, loop: { x: 0, z: 0, rx: 44, rz: 26 }, speed: 9, chase: 15, near: 38, behind: -3, side: 9, above: 3, lose: 60, turn: 2.2, ring: 16 };
const EDGE = 4;

export const newFedShip = () => ({ x: FED.loop.x + FED.loop.rx, z: FED.loop.z, y: FED.y, yaw: Math.PI, a: 0, mode: 'loop' });

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// One step: `cruiser` is { x, z, y, yaw }; `flying`, whether Morty's flying
// it; `fight`, { angle } while the patrol's fighting (null when it isn't).
// One shot down (`down`, the fight's) goes back round its loop, unseen,
// where the next comes from.
export function stepFedShip(f, cruiser, flying, dt, fight = null) {
  const d = Math.hypot(cruiser.x - f.x, cruiser.z - f.z);
  const after = flying && !f.down;
  const mode = after && fight ? 'fight' : after && (f.mode === 'tail' ? d < FED.lose : d < FED.near) ? 'tail' : 'loop';
  let a = f.a;
  let tx;
  let tz;
  let ty;
  let top;
  if (mode === 'fight') {
    tx = cruiser.x + Math.cos(fight.angle) * FED.ring;
    tz = cruiser.z + Math.sin(fight.angle) * FED.ring;
    ty = Math.max(cruiser.y + FED.above, 8);
    top = FED.chase;
  } else if (mode === 'tail') {
    // (its right: the nose (sin yaw, cos yaw) turned a quarter clockwise, seen from above)
    tx = cruiser.x - Math.sin(cruiser.yaw) * FED.behind - Math.cos(cruiser.yaw) * FED.side;
    tz = cruiser.z - Math.cos(cruiser.yaw) * FED.behind + Math.sin(cruiser.yaw) * FED.side;
    ty = Math.max(cruiser.y + FED.above, 8);
    top = FED.chase;
  } else {
    // on round the loop, aiming a little ahead of where it's got to
    a = f.mode === 'loop' ? f.a + (FED.speed / Math.max(FED.loop.rx, FED.loop.rz)) * dt : Math.atan2((f.z - FED.loop.z) / FED.loop.rz, (f.x - FED.loop.x) / FED.loop.rx);
    tx = FED.loop.x + Math.cos(a + 0.25) * FED.loop.rx;
    tz = FED.loop.z + Math.sin(a + 0.25) * FED.loop.rz;
    ty = FED.y;
    top = mode === f.mode ? FED.speed : FED.chase;
  }
  const s = AREAS.street;
  tx = clamp(tx, s.x0 + EDGE, s.x1 - EDGE);
  tz = clamp(tz, s.z0 + EDGE, s.z1 - EDGE);
  const dx = tx - f.x;
  const dz = tz - f.z;
  const far = Math.hypot(dx, dz);
  const step = Math.min(far, top * dt);
  const x = f.x + (far > 1e-6 ? (dx / far) * step : 0);
  const z = f.z + (far > 1e-6 ? (dz / far) * step : 0);
  const y = f.y + clamp(ty - f.y, -6 * dt, 6 * dt);
  // it turns towards where it's going, at its own pace
  const want = far > 0.05 ? Math.atan2(dx, dz) : f.yaw;
  const yaw = f.yaw + clamp(wrap(want - f.yaw), -FED.turn * dt, FED.turn * dt);
  return { x, z, y, yaw, a, mode };
}

// close enough on the cruiser's tail to say so
export const onTail = (f, cruiser) => !f.down && f.mode === 'tail' && Math.hypot(cruiser.x - f.x, cruiser.z - f.z) < Math.hypot(FED.behind, FED.side) + 6;
