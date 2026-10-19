// What the universe map's flight cluster shows (the HUD kit's: runtime/hud/
// cluster.js writes it), worked out each frame from the scene's state. In a
// ship: up while you fly (not over the nav map, the shipyard, a crash or a
// dive into a world), the shields, and the arms once the guns are first
// used (the first minute has enough on it). On foot: your health, while
// there's trouble about or you're hurt, and no arms (the foot's gun is its
// own). Pure, and it fills the record it's handed, so a frame makes nothing.
//
// clusterView({ flying, onFoot, view, crash, dive, frozen, armed, shield (0–100),
//   footInfo: { health (0–1), troops } | null, armory }, out?) → out: { on, vitals: { value, max, low }, arms }

import { armsView } from './weapons';

const LOW = 35; // (shields or health under this, in a hundred: the bar goes red)

const fresh = () => ({ on: false, vitals: { value: 100, max: 100, low: false }, arms: null, armsOut: undefined });

export function clusterView(s, out = fresh()) {
  const foot = s.onFoot ? s.footInfo : null;
  if (foot) {
    out.on = Boolean(foot.troops?.length || foot.health < 0.995) && !s.frozen;
    out.vitals.value = foot.health * 100;
    out.arms = null;
  } else {
    out.on = Boolean(s.flying && !s.onFoot && s.view !== 'map' && !s.crash && !s.dive && !s.frozen);
    out.vitals.value = s.shield;
    out.arms = s.armed && s.armory ? (out.armsOut = armsView(s.armory, out.armsOut)) : null;
  }
  out.vitals.max = 100;
  out.vitals.low = out.vitals.value < LOW;
  return out;
}
