// What the universe map's flight cluster shows (the HUD kit's: runtime/hud/
// cluster.js writes it), worked out each frame from the scene's state. In a
// ship: up while you fly (not over the nav map, the shipyard, a crash or a
// dive into a world), the shields and the line picked, from the start, as
// the galaxy's has them. On foot: your health and the
// gun in your hand, its heat with it (footArms.js's, the galaxy's worlds'
// rules), while there's trouble about, you're hurt or the gun's warm. Pure,
// and it fills the record it's handed, so a frame makes nothing.
//
// clusterView({ flying, onFoot, view, crash, dive, frozen, shield (0–100),
//   footInfo: { health (0–1), troops, hand: { name, value, locked, vent } | null } | null, armory }, out?) → out: { on, vitals: { value, max, low }, arms }

import { armsView } from './weapons';

const LOW = 35; // (shields or health under this, in a hundred: the bar goes red)

const fresh = () => ({ on: false, vitals: { value: 100, max: 100, low: false }, arms: null, armsOut: undefined, handOut: { name: '', line: 'hand', heat: 0, locked: false, vent: null } });

export function clusterView(s, out = fresh()) {
  const foot = s.onFoot ? s.footInfo : null;
  if (foot) {
    const hand = foot.hand ?? null;
    out.on = Boolean(foot.troops?.length || foot.health < 0.995 || (hand && (hand.value > 0.02 || hand.locked))) && !s.frozen;
    out.vitals.value = foot.health * 100;
    if (hand) {
      out.handOut.name = hand.name;
      out.handOut.heat = hand.value;
      out.handOut.locked = hand.locked;
      out.handOut.vent = hand.vent;
    }
    out.arms = hand ? out.handOut : null;
  } else {
    out.on = Boolean(s.flying && !s.onFoot && s.view !== 'map' && !s.crash && !s.dive && !s.frozen);
    out.vitals.value = s.shield;
    out.arms = s.armory ? (out.armsOut = armsView(s.armory, out.armsOut)) : null;
  }
  out.vitals.max = 100;
  out.vitals.low = out.vitals.value < LOW;
  return out;
}
