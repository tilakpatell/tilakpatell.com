// The skill tree's guns in the hand that do more than a bolt, on the
// universe map's planets, as the galaxy's worlds play them (its
// surface/handArms.js draws them here too, lent through galaxy/shared/fx.js,
// at the map's metre): footScene.js hands each shot of yours here first,
// and it's a bolt only if this says it isn't one of these.
//
// - The particle beam: each shot (ten a second, at the gun's own pace and
//   heat: footArms.js) hits at once whatever the aim's line meets first, in
//   reach, and is drawn as a beam from the muzzle there while they keep
//   coming. Whoever it drops is ash (lib/three/gadgetFx.js's light).
// - The repulsor gauntlet: F held charges it (footArms.js), the palm's light
//   swelling; let go, a short, fat burst of light, and whoever's in front
//   in its reach is hurt by the charge and thrown (footAbilities.js's shove,
//   as the Force's is). Whoever it drops is thrown, turning over.
// - The Amban: a bolt as any gun's; whoever it drops goes in a flash of
//   light (footScene.js's drawTroops plays the kills: SHOW_KILLS).
//
// createFootHand({ root, metre, palm }) → { shot(w, from, dir, ctx) → true
//   if it was one of these (no bolt), frame(dt, w, chargeAt, now), clear(),
//   dispose() }
// `palm()`: your hand now, in `root`'s space (the charge's light), or null.
// ctx: { aimed (footAim.js's: the line's end and the trooper it met), charge
//   (0…1, the gauntlet let go), damage, me, R, troops, strike(t, damage,
//   dir, how), shove(t, shove, lift) }

import * as THREE from 'three';
import { blastOf } from '../../lib/arms/behaviours';
import { createHandArms } from '../galaxy/shared/fx';
import { shoveOf } from './footAbilities';

const V = THREE.Vector3;

export function createFootHand({ root, metre, palm = () => null }) {
  let charging = false;
  const hand = createHandArms({ parent: root, muzzle: () => (charging ? palm() : null), size: metre });
  const end = (from, dir, aimed, reach) => (aimed?.at ? new V(...aimed.at) : from.clone().addScaledVector(dir, reach));
  const met = (aimed, troops) => (aimed?.target ? (troops.find((t) => t.id === aimed.target.id && t.alive) ?? null) : null);

  return {
    shot(w, from, dir, ctx) {
      if (w?.beam) {
        const t = met(ctx.aimed, ctx.troops);
        if (t) ctx.strike(t, ctx.damage, [dir.x, dir.y, dir.z], 'particle');
        hand.beam(from, end(from, dir, ctx.aimed, w.range * metre));
        return true;
      }
      if (w?.charge && ctx.charge != null) {
        const b = blastOf(w, ctx.charge);
        const t = met(ctx.aimed, ctx.troops);
        if (t) {
          const shove = shoveOf(ctx.me, t, b.push * metre);
          ctx.shove(t, shove, b.lift * metre);
          ctx.strike(t, ctx.damage, shove.dir, 'gauntlet');
        }
        // (a short burst: a third of its reach, or to whoever it met)
        hand.blast(from, t ? end(from, dir, ctx.aimed, 0) : from.clone().addScaledVector(dir, w.range * metre * 0.33), b.scale);
        return true;
      }
      return false;
    },
    // a frame: the palm's light while the gauntlet's charging (footArms.js's
    // trigger has when it began), the beam held, the blast going
    frame(dt, w, chargeAt, now) {
      charging = Boolean(w?.charge) && chargeAt != null;
      if (charging) {
        hand.charge(chargeAt);
        hand.step(now, w, true);
      } else if (hand.charging) hand.step(now, w, false);
      hand.frame(dt);
    },
    clear() {
      charging = false;
      hand.clear();
    },
    dispose: () => hand.dispose(),
  };
}
