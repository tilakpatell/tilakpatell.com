// The gun in each crew member's hand on the universe map's planets, shot on
// the galaxy's rules (lib/arms: one table and one set of rules for every
// world a crew walks with a gun): which gun they carry (the Hangar's pick,
// tp-crew's, the skill tree's unique four among them once their nodes are
// taken), its numbers with the skill tree's ground branch on them, and the
// trigger. Held, it fires at the gun's own pace, never under SHOT_FLOOR but
// for one that streams (the M60's run, the particle beam, the gauntlet's
// charge); each shot heats the gun and a full one locks till it's vented
// (R) or has cooled; a burst's rest follows the first shot of it, and a
// scattergun's pellets go with it, each half a hit. The M60's run walks the
// aim up, and the gauntlet charges while it's held and goes off as it's let
// go. Pure, so it's tested in Node; footScene.js shoots by it.
//
//   handGun(spec, style, arms) → the kind in their hand: the pick when they may carry it (their own, or one anyone may, or a unique one opened), else their own; null for none (Artoo)
//   footWeapon(kind, skills) → the gun's numbers (handRules.js's withMods), the ground skills on its heat, cooling and scatter
//   newTrigger() → the trigger's record, kept by the scene
//   press(t, w, now, { down, hot }) → what the trigger does this frame: null, or { shots (1, or a scattergun's pellets), damage (each), climb (radians the aim goes up), charge? (0…1, a gauntlet let go), locked? (too hot: a click) }
//   cool(t, w, dt, now)   a frame on: the gun cooling, a lock run out cleared
//   ventNow(t, now) → whether it vented (and so the heat's down: all of it in the sweet spot)
//   heatView(t, now) → { value (0…1), locked, vent (the marker, 0…1, while locked) } for the HUD
// `t` is changed in place (the scene's record, a frame makes nothing new);
// `hot`: overcharged (no heat, a hit harder).

import { WEAPONS, pickableWith } from '../../lib/arms/hand';
import { SHOT_FLOOR, heatShot, heatStep, vent, ventSpot, withMods } from '../../lib/arms/handRules';
import { HAND_FX, blastOf, chargeOf, climbOf } from '../../lib/arms/behaviours';

export const BURST_GAP = 0.075; // seconds between the shots of a burst (the galaxy's)
const LOCK_SAID = 0.3; // seconds between the clicks of a locked trigger

export function handGun(spec, style, arms = []) {
  const own = spec?.gun ?? null;
  if (!own) return null;
  const pick = style?.gun;
  return pick && WEAPONS[pick] && (pick === own || pickableWith(arms).includes(pick)) ? pick : own;
}

const factor = (v) => (Number.isFinite(v) && v > 0 ? v : 1);
export function footWeapon(kind, skills = {}) {
  const w = withMods(kind, []);
  w.heat *= factor(skills.heat);
  w.cool *= factor(skills.cool);
  w.spread *= factor(skills.spread);
  return w;
}

const COLD = Object.freeze({ value: 0, locked: false, lockedAt: null, shotAt: null });
export const newTrigger = () => ({ firedAt: -Infinity, heat: COLD, burst: null, run: 0, lastShot: -Infinity, chargeAt: null, saidAt: -Infinity });

const unfloored = (w) => Boolean(w.beam || w.stream || w.charge);
const climbFor = (t, w, now) => {
  if (!w.climb) return 0;
  t.run = now - t.lastShot <= HAND_FX.m60.gap ? t.run + 1 : 0;
  t.lastShot = now;
  return climbOf(w, t.run, false);
};
const shotOf = (t, w, now, hot, extra = {}) => {
  const n = w.pellets ?? 1;
  const damage = Math.max(1, Math.round((w.damage + (hot ? 1 : 0)) / (n > 1 ? 2 : 1)));
  return { shots: n, damage, climb: climbFor(t, w, now), ...extra };
};

export function press(t, w, now, { down = false, hot = false } = {}) {
  // a burst's rest, a shot at a time
  if (t.burst && now >= t.burst.next) {
    t.burst.left -= 1;
    t.burst.next = now + BURST_GAP;
    if (t.burst.left <= 0) t.burst = null;
    return shotOf(t, w, now, hot);
  }
  // the gauntlet: charging while it's held, and off as it's let go
  if (t.chargeAt != null) {
    if (!w.charge) t.chargeAt = null;
    else if (!down) {
      const k = chargeOf(now - t.chargeAt, w);
      t.chargeAt = null;
      const b = blastOf(w, k);
      return { shots: 1, damage: b.damage + (hot ? 1 : 0), climb: 0, charge: k };
    }
    return null;
  }
  if (!down) return null;
  if (now - t.firedAt < Math.max(unfloored(w) ? 0 : SHOT_FLOOR, w.every)) return null;
  if (t.heat.locked) {
    if (now - t.saidAt < LOCK_SAID) return null;
    t.saidAt = now;
    return { shots: 0, damage: 0, climb: 0, locked: true };
  }
  t.firedAt = now;
  if (!hot) t.heat = heatShot(t.heat, w, now);
  if (w.charge) {
    t.chargeAt = now;
    return null;
  }
  if (w.burst > 1) t.burst = { left: w.burst - 1, next: now + BURST_GAP };
  return shotOf(t, w, now, hot);
}

// a frame on: the gun cooling (dt seconds of it)
export const cool = (t, w, dt, now) => (t.heat = heatStep(t.heat, dt, w, now));

export function ventNow(t, now) {
  if (!t.heat.locked && t.heat.value <= 0) return false;
  const was = t.heat;
  const v = vent(t.heat, now);
  t.heat = { value: v.value, locked: v.locked, lockedAt: v.lockedAt, shotAt: was.shotAt };
  return t.heat.value < was.value || was.locked !== t.heat.locked;
}

export const heatView = (t, now) => ({ value: t.heat.value, locked: t.heat.locked, vent: ventSpot(t.heat, now) });
