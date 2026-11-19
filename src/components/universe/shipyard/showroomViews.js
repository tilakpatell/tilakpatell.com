// Where the showroom's camera goes for each slot of the shipyard, as a
// game's garage does: shopping for fins swings round to the tail, boosters to
// the flank, guns low under the nose, a shield from above. Pure (showroom.js
// draws; these are tested in Node), and nothing in it changes the ship.
//
//   VIEWS[slot] / viewFor(slot) → { yaw, lift, near }
//     yaw: the turntable's turn (radians; the nose is −z, the camera at +z, so 0 shows the tail, π the nose)
//     lift: how high the camera stands, as a share of its distance (0 level, 1 from well above)
//     near: how close (1 the whole ship in frame; less, nearer)
//   HOME_VIEW: the shipyard's front door, a hero's three-quarters from the front
//   facing(yaw) → 'nose' | 'side' | 'tail', which end the camera sees (for the tests)
//   easeTo(from, to, dt), easeAngle(from, to, dt): a step toward it, frame-rate free

const RATE = 3.2; // (how quickly the camera settles: most of the way in about half a second)
const TAU = 2 * Math.PI;

export const HOME_VIEW = { yaw: Math.PI - 0.72, lift: 0.36, near: 0.92 };
const FRONT = { yaw: Math.PI - 0.45, lift: 0.3, near: 0.86 };
const FLANK = { yaw: Math.PI / 2 + 0.3, lift: 0.22, near: 0.84 };
const UNDER = { yaw: Math.PI - 0.55, lift: 0.1, near: 0.84 };
const REAR = { yaw: 0.55, lift: 0.3, near: 0.84 };

export const VIEWS = {
  // the build's
  hull: HOME_VIEW,
  cockpit: { yaw: Math.PI - 0.5, lift: 0.5, near: 0.74 },
  wings: { yaw: Math.PI / 2 + 0.55, lift: 0.78, near: 0.95 },
  engines: { yaw: 0.35, lift: 0.26, near: 0.8 },
  tail: { yaw: 0.6, lift: 0.42, near: 0.84 },
  extras: FRONT,
  // the paint and the parts
  paint: HOME_VIEW,
  booster: FLANK,
  thrusters: { ...FLANK, yaw: Math.PI / 2 - 0.25 },
  guns: UNDER,
  secondary: UNDER,
  ordnance: { ...UNDER, yaw: Math.PI / 2 + 0.7 },
  shields: { yaw: Math.PI - 0.9, lift: 0.88, near: 0.92 },
  fins: REAR,
};

export const viewFor = (slot) => VIEWS[slot] ?? HOME_VIEW;

export function facing(yaw) {
  // (how far round from showing the tail: 0 tail, π the nose)
  const a = Math.abs(((((yaw % TAU) + TAU + Math.PI) % TAU) - Math.PI));
  return a < Math.PI / 3 ? 'tail' : a > (2 * Math.PI) / 3 ? 'nose' : 'side';
}

export const easeTo = (from, to, dt) => from + (to - from) * (1 - Math.exp(-RATE * dt));

export function easeAngle(from, to, dt) {
  const d = ((((to - from) % TAU) + TAU + Math.PI) % TAU) - Math.PI;
  return d === 0 ? from : from + d * (1 - Math.exp(-RATE * dt));
}
