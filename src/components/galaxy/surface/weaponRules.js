// The guns' numbers, pure (tested in Node; scene.js shoots by them, the
// hero panel offers them): what each kind does per shot and how fast, the
// heat it builds (Battlefront's bar: fire too long and it locks, vent it
// early or hit the sweet spot once it has), the mods that bend those
// numbers, and the sights. The kinds are universe/gunplay.js's GUNS (the
// gun in the hand); a kind here without one there falls back to the
// blaster's numbers.
//
//   WEAPONS, MODS, WEAPON_IDS, MOD_IDS, PICKABLE, SHOW_KILLS, UNIQUE_HAND,
//   pickableWith         the table, lib/arms/hand.js's (re-exported here)
//   weaponOf(kind)       the numbers, the blaster's when unknown
//   withMods(kind, mods) the numbers with up to MAX_MODS applied
//   heatShot(h, w, now)  the heat after a shot: { value, locked (overheated: no shots until it's vented or cools), lockedAt, shotAt }
//   heatStep(h, dt, w, now)   a frame on: cooling at the gun's `cool` a second, but not within COOL_WAIT of a shot (so holding the trigger only heats); locked, dead for VENT.lock then clear
//   vent(h, now)         the active cool: in the sweet spot (VENT.sweet of the way through the lock) it's all gone at once; early it's half; late nothing
//   ventSpot(h, now)     where the vent's marker is (0…1) while locked, or null
//   spreadAt(w, aiming)  the scatter when aiming down the sights (tighter)

import { MAX_MODS, MODS, WEAPONS } from '../../../lib/arms/hand';

export { MAX_MODS, MODS, MOD_IDS, PICKABLE, SHOW_KILLS, UNIQUE_HAND, WEAPONS, WEAPON_IDS, pickableWith } from '../../../lib/arms/hand';

export const VENT = { sweet: [0.35, 0.55], lock: 1.6 }; // (the marker runs 0…1 over `lock` seconds; in `sweet` it's a perfect vent)
export const COOL_WAIT = 0.45; // seconds after a shot before the gun starts to cool

export const weaponOf = (kind) => WEAPONS[kind] ?? WEAPONS.blaster;

export function withMods(kind, mods = []) {
  const w = { ...weaponOf(kind), kind: WEAPONS[kind] ? kind : 'blaster', mods: [] };
  for (const id of [...new Set(mods)].filter((m) => MODS[m]).slice(0, MAX_MODS)) {
    const m = MODS[id];
    w.mods.push(id);
    for (const k of ['damage', 'every', 'spread', 'heat', 'cool', 'range', 'zoom', 'kick']) if (m[k] != null) w[k] *= m[k];
  }
  w.damage = Math.max(1, Math.round(w.damage));
  return w;
}

export function heatShot(h, w, now = 0) {
  const value = Math.min(1, h.value + w.heat);
  const locked = value >= 1;
  return { value, locked, lockedAt: locked ? now : null, shotAt: now };
}

export function heatStep(h, dt, w, now = 0) {
  if (h.locked) {
    // (dead through the lock, then clear)
    const k = (now - h.lockedAt) / VENT.lock;
    if (k < 1) return h;
    return { value: 0, locked: false, lockedAt: null, shotAt: h.shotAt };
  }
  if (h.value <= 0 || now - (h.shotAt ?? -99) < COOL_WAIT) return h;
  return { ...h, value: Math.max(0, h.value - w.cool * dt) };
}

export function ventSpot(h, now) {
  if (!h.locked) return null;
  const k = (now - h.lockedAt) / VENT.lock;
  return k >= 1 ? null : k;
}

export function vent(h, now) {
  if (!h.locked) return { value: 0, locked: false, lockedAt: null, perfect: !h.locked && h.value > 0.5 }; // (venting early just empties it)
  const k = ventSpot(h, now) ?? 1;
  if (k >= VENT.sweet[0] && k <= VENT.sweet[1]) return { value: 0, locked: false, lockedAt: null, perfect: true };
  if (k < VENT.sweet[0]) return { value: 0.5, locked: false, lockedAt: null, perfect: false }; // (jumped the gun: half of it stays)
  return { ...h, perfect: false }; // (too late: ride out the lock)
}

export const spreadAt = (w, aiming) => w.spread * (aiming ? 0.45 : 1);
