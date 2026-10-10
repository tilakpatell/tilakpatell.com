// A lit lightsaber's light on what's round it: a point light at the blade's
// middle in the blade's colour, so a duel lights its duellists and the
// ground under them. Only on the high and ultra tiers (a light costs every
// lit pixel), only within SABER_LIGHT.within of the eye (past that it
// lights nothing you'd see), and made with the saber, dark until lit, so
// the scene's count of lights never changes and nothing recompiles when a
// blade ignites (scene.js's muzzle flare is the pattern). It lights the
// world, not the blade: the blade's own glow is its emissive, drawn
// without tone mapping into the bloom (post.js), which this leaves alone.
// The lights are as many as the blades that may carry one, SABER_LIGHT.most
// at most, and each frame they go to the nearest lit blades within reach,
// not to the first made: a far duellist's never keeps yours dark (a blade
// keeps the one it holds till another is SABER_LIGHT.hold nearer, so two
// at the edge don't trade it frame by frame).
//
//   createSaberLight({ scene, color, tier }) → { update(base, tip, lit, eye), dark(), dispose() }
//     base, tip: the blade's ends (world); lit: 0…1, how far out it is; eye: the camera's position
//   SABER_LIGHT      { intensity: { high, ultra }, distance (metres it reaches), decay, within, most (lights at once: a light
//                    costs every lit pixel whatever its reach; past it a blade lights nothing), hold (metres) }

import * as THREE from 'three';

export const SABER_LIGHT = { intensity: { high: 1.2, ultra: 1.8 }, distance: 4, decay: 2, within: 12, most: 4, hold: 1 };

// (the blades that may light, and the lights: { light, by } with the blade holding it, or none)
const blades = [];
const slots = [];
let made = 0;

const NONE = { update() {}, dark() {}, dispose() {} };

// how near a blade is for a light: its distance from the eye (Infinity dark,
// or out past `within`), a holder's less `hold`; a tie to the first made
const near = (b) => b.d - (b.slot ? SABER_LIGHT.hold : 0);
const ahead = (a, b) => near(a) < near(b) || (near(a) === near(b) && a.n < b.n);
// (its place among the blades holding a light: one without never keeps
// another dark, so a blade no update reaches any more, its last distance
// kept, never leaves a light free; one nearer than a holder takes it in its
// own update)
const placeOf = (b) => {
  let k = 0;
  for (const o of blades) if (o !== b && o.slot && ahead(o, b)) k++;
  return k;
};
const release = (b) => {
  if (!b.slot) return;
  b.slot.light.intensity = 0;
  b.slot.by = null;
  b.slot = null;
};
// a free light, else the one held furthest behind (behind b: b is among
// the nearest SABER_LIGHT.most and the lights are as many, all held)
const take = (b) => {
  let s = null;
  for (const x of slots) if (!x.by) s = x;
  if (!s) for (const x of slots) if (!s || ahead(s.by, x.by)) s = x;
  if (s.by) s.by.slot = null;
  s.by = b;
  b.slot = s;
  // (moved to the blade's own parent: within the scene, so its count of lights is the same)
  if (s.light.parent !== b.scene) b.scene.add(s.light);
  s.light.color.copy(b.color);
};

export function createSaberLight({ scene, color = '#4aa8ff', tier = 'high' } = {}) {
  const peak = SABER_LIGHT.intensity[tier];
  if (!peak || !scene) return NONE;
  const b = { scene, color: new THREE.Color(color), at: new THREE.Vector3(), d: Infinity, slot: null, n: made++ };
  blades.push(b);
  if (slots.length < SABER_LIGHT.most) {
    const light = new THREE.PointLight(color, 0, SABER_LIGHT.distance, SABER_LIGHT.decay);
    light.name = 'saber-light';
    scene.add(light);
    slots.push({ light, by: null });
  }
  return {
    update(base, tip, lit, eye) {
      b.at.copy(base).add(tip).multiplyScalar(0.5);
      const far = eye ? b.at.distanceTo(eye) : 0;
      b.d = lit > 0 && far <= SABER_LIGHT.within ? far : Infinity;
      if (b.d === Infinity || placeOf(b) >= SABER_LIGHT.most) return release(b);
      if (!b.slot) take(b);
      b.slot.light.position.copy(b.at);
      b.slot.light.intensity = peak * Math.min(1, lit);
    },
    // (a blade no update reaches lets its light go, for the next nearest)
    dark() {
      b.d = Infinity;
      release(b);
    },
    dispose() {
      const i = blades.indexOf(b);
      if (i < 0) return;
      release(b);
      blades.splice(i, 1);
      // (one light fewer once they outnumber the blades: a free one)
      if (slots.length <= blades.length) return;
      const s = slots.splice(slots.findIndex((x) => !x.by), 1)[0];
      s.light.removeFromParent();
      s.light.dispose();
    },
  };
}
