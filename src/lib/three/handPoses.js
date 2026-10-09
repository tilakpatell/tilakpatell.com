// How a hand is held, as numbers that fit any hand: each finger's bend at
// each joint (radians, closing toward the palm), the thumb's at two, and how
// far the fingers fan apart. Never quaternions on a rig's bone names: a
// three-joint finger, a two-joint one and a toy's mitten all take the same
// pose (hands.js spreads a finger's bends over the joints it has, and gives
// a mitten the four fingers' mean). A bend of 0 is straight on along the
// palm, whatever the figure was sculpted with.
// (docs/superpowers/specs/2026-10-08-npc-player-rigging-design.md, piece 3)
//
//   FINGERS: the four, index first
//   POSES: { open, relaxed, fist, grip, trigger, point, thumbs, flat,
//     spread }, each { thumb: [c1, c2], index: [c1, c2, c3], middle, ring,
//     pinky, spread }
//   gripFor(radius, finger) → a pose: the fingers round a cylinder of that
//     radius, a finger `finger` long (both in the same units)
//   mix(a, b, k) → a pose k of the way from a to b

export const FINGERS = ['index', 'middle', 'ring', 'pinky'];

const pose = (thumb, index, middle, ring, pinky, spread = 0) => ({ thumb, index, middle, ring, pinky, spread });

// the most a joint bends (a knuckle a little past square)
const MOST = 1.6;

// a finger round a grip: its length wrapped round the grip's girth, the
// circle out at the finger's middle (a finger is about a fifth as thick as
// it is long), shared over the joints as a hand closes, the knuckle most
export function gripFor(radius, finger) {
  const turn = finger / (radius + 0.1 * finger);
  const bends = (k) => [0.36, 0.34, 0.3].map((share) => Math.min(MOST, turn * share * k));
  // (the outer fingers are shorter and close a little further)
  return pose([Math.min(0.9, 0.18 * turn), Math.min(1.0, 0.22 * turn)], bends(1), bends(1), bends(1.04), bends(1.1));
}

export const POSES = {
  open: pose([0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], 0.08),
  // a hand hanging at rest: a slight curl, more toward the little finger
  relaxed: pose([0.12, 0.18], [0.16, 0.24, 0.14], [0.22, 0.3, 0.18], [0.27, 0.34, 0.2], [0.32, 0.38, 0.22], 0.04),
  fist: pose([0.7, 0.9], [1.45, 1.55, 0.95], [1.5, 1.6, 0.95], [1.5, 1.6, 0.95], [1.5, 1.6, 0.95]),
  // round a pistol's or a hilt's grip (gripFor at 1.6 cm, a 9 cm finger)
  grip: gripFor(0.016, 0.09),
  point: pose([0.5, 0.6], [0, 0, 0], [1.45, 1.55, 0.95], [1.5, 1.6, 0.95], [1.5, 1.6, 0.95]),
  thumbs: pose([-0.15, 0], [1.45, 1.55, 0.95], [1.5, 1.6, 0.95], [1.5, 1.6, 0.95], [1.5, 1.6, 0.95]),
  flat: pose([0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], 0),
  spread: pose([0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], 0.35),
};
// the grip with the index along the trigger guard, nearly straight
POSES.trigger = { ...POSES.grip, index: [0.25, 0.2, 0.1] };

export function mix(a, b, k) {
  const l = (x, y) => x + (y - x) * k;
  const out = { spread: l(a.spread, b.spread) };
  for (const f of ['thumb', ...FINGERS]) out[f] = a[f].map((x, i) => l(x, b[f][i]));
  return out;
}
