// Where the crews' powers (powers.js) meet the universe map's scene, as
// plain rules: when a power may be played (in flight only: never on foot,
// at the phone, over the nav map, under the shipyard, or mid-crash, dive or
// jump), and the picture's look with one on (Force Focus pulls the edges
// apart and dims the light over the map's own look, which the scene writes
// every frame: the two are mixed, never the one written over the other).
// Pure, tested.
//
//   canPower({ flying, onFoot, crash, dive, jump, frozen, view, phoneNear }) → boolean
//   mixPost(own, power, out?) → { aberration, exposure }   own's and the power's together

export const canPower = (s) => Boolean(s.flying && !s.onFoot && !s.crash && !s.dive && !s.jump && !s.frozen && s.view !== 'map' && !s.phoneNear);

export function mixPost(own, power, out = { aberration: 0, exposure: 1 }) {
  out.aberration = own.aberration + (power.aberration ?? 0);
  out.exposure = own.exposure * (power.exposure ?? 1);
  return out;
}
