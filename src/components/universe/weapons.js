// Each ship's guns, as plain rules (scene.js fires them, tested here).
//
// Every ship carries three lines: its primary (the blaster, the shots it
// always had; the hangar's Primary part changes its rate and punch, which
// is scene.js's business through statsOf), a secondary that throws a fan
// of shorter shots, and ordnance, slow homing rounds that hit hard and are
// the only thing that hurts the Citadel's core once its shield is down
// (siege.js). What fires on the secondary and ordnance lines is the part
// fitted in that slot (outfit.js); stock is the spread and the heavy rack.
// The ordnance rounds are few: a rack that fills back up one at a time.
//
// R (or Shift+R) cycles them, 1 2 3 picks one; the phone has a button.
//
// createArmory(kind, loadout, fx?) → { index, id, line, weapon, name, ammo,
//   ammoMax, filling, select(i), cycle(dir), ready(now, cadence) → bool,
//   fired(now), update(dt), reload(), refit(loadout, fx?) }
// `cadence` is the ship's own seconds between blaster shots (outfit.js and
// lib/combat/flight/guns.js's CADENCE); each weapon fires at a multiple of it.

import { STOCK, STOCK_LOADOUT, partById } from './outfit';
import { WEAPONS } from './weaponTable';

export { WEAPONS, burstOf, byCode, rackOf } from './weaponTable';
// (a fan of shots and a homing round's steering: lib/combat/flight/guns.js's, both maps')
export { fan, steer } from '../../lib/combat/flight/guns';

export const LINES = ['primary', 'secondary', 'ordnance'];
export const LINE_SLOT = { primary: 'guns', secondary: 'secondary', ordnance: 'ordnance' };
export const LINE_STOCK = { primary: 'blaster', secondary: 'spread', ordnance: 'heavy' };

// what each crew calls its stock three, and the heavy round's glow
export const ARSENAL = {
  xwing: { names: ['Laser cannons', 'Ion scatter', 'Proton torpedoes'], heavy: '#ff7a3a' },
  falcon: { names: ['Quad lasers', 'Flak burst', 'Concussion missiles'], heavy: '#ffb347' },
  cruiser: { names: ['Laser', 'Plasma scatter', 'Portal grenades'], heavy: '#5dff4a' },
  rv: { names: ['Pistol', 'Shotgun', 'Fulminated mercury'], heavy: '#dff4ff' },
};
const DEFAULT = { names: ['Blaster', 'Scatter', 'Missiles'], heavy: '#ffb347' };
export const arsenalOf = (kind) => ARSENAL[kind] ?? DEFAULT;

// The weapon and the name on each line, for this crew with this loadout.
// The primary is always the blaster; a secondary or ordnance part names
// its weapon (an unknown one is stock's), and a stock line keeps the
// crew's own name for it. A unique weapon fires only while the skill tree
// has it open (fx.arms): its node reset, the line is stock's again.
function linesOf(kind, loadout, fx) {
  const names = arsenalOf(kind).names;
  return LINES.map((line, i) => {
    if (line === 'primary') return { id: 'blaster', name: names[i] };
    const p = partById(LINE_SLOT[line], loadout?.[LINE_SLOT[line]]);
    const w = p && p.id !== STOCK ? WEAPONS[p.weapon] : null;
    const id = w?.line === line && (!w.unique || fx?.arms?.includes(p.weapon)) ? p.weapon : LINE_STOCK[line];
    return { id, name: id === LINE_STOCK[line] || !p ? names[i] : p.name };
  });
}

// A weapon as the skill tree's guns have it (hangar/skills's fx): a round
// more in the rack (ammo) and back sooner (reload), a shot more a burst
// (shots), harder homing and a longer flight (homing, life). The table's own
// when there are none (never changed: a copy).
const NO_FX = {};
const num = (v, d) => (Number.isFinite(v) ? v : d);
function tunedWeapon(w, fx) {
  const ammo = num(fx.ammo, 0);
  const reload = num(fx.reload, 1);
  const shots = num(fx.shots, 0);
  const homing = num(fx.homing, 1);
  const life = num(fx.life, 1);
  if (!ammo && reload === 1 && !shots && homing === 1 && life === 1) return w;
  const out = { ...w };
  if (w.line === 'secondary') out.count = w.count + shots;
  if (w.heavy) {
    out.ammo = w.ammo + ammo;
    out.reload = w.reload * reload;
    out.life = w.life * life;
    if (w.homing) out.homing = w.homing * homing;
  }
  return out;
}

export function createArmory(kind, loadout = STOCK_LOADOUT, fx = NO_FX) {
  let lines = linesOf(kind, loadout, fx);
  let tuned = lines.map((l) => tunedWeapon(WEAPONS[l.id], fx));
  let index = 0;
  let last = -Infinity;
  let rack = tuned[2]; // the ordnance line's weapon, whose rounds these are
  let ammo = rack.ammo;
  let refill = 0; // seconds toward the next round
  return {
    get index() {
      return index;
    },
    get id() {
      return lines[index].id;
    },
    get line() {
      return LINES[index];
    },
    get weapon() {
      return tuned[index];
    },
    get name() {
      return lines[index].name;
    },
    get ammo() {
      return ammo;
    },
    get ammoMax() {
      return rack.ammo;
    },
    // how far the next round is along, 0…1 (for the rack's last pip)
    get filling() {
      return ammo >= rack.ammo ? 0 : refill / rack.reload;
    },
    select(i) {
      if (i < 0 || i >= LINES.length || i === index) return false;
      index = i;
      return true;
    },
    cycle(dir = 1) {
      index = (index + LINES.length + (dir < 0 ? -1 : 1)) % LINES.length;
      return index;
    },
    // may it fire now? (the blaster's cadence times the weapon's; heavy ones need a round)
    ready(now, cadence) {
      const w = tuned[index];
      if (w.heavy && ammo < 1) return false;
      return now - last >= cadence * w.cadence * 1000;
    },
    fired(now) {
      last = now;
      if (tuned[index].heavy) ammo = Math.max(0, ammo - 1);
    },
    // the rack fills back up, a round at a time
    update(dt) {
      if (ammo >= rack.ammo) {
        refill = 0;
        return;
      }
      refill += dt;
      while (refill >= rack.reload && ammo < rack.ammo) {
        refill -= rack.reload;
        ammo += 1;
      }
    },
    // back from being shot down: a full rack
    reload() {
      ammo = rack.ammo;
      refill = 0;
    },
    // a new loadout fitted, or new skills taken (fx: the skills it has kept
    // when none are handed): the same line stays picked, and the rounds left
    // carry over (no more than the new rack holds; a refit is no reload)
    refit(next, nextFx = fx) {
      fx = nextFx ?? NO_FX;
      lines = linesOf(kind, next, fx);
      tuned = lines.map((l) => tunedWeapon(WEAPONS[l.id], fx));
      rack = tuned[2];
      ammo = Math.min(ammo, rack.ammo);
      if (ammo >= rack.ammo) refill = 0;
    },
  };
}

// What the HUD kit's arms block shows of an armoury (runtime/hud/cluster.js's
// ArmsView): the line picked, its name, and the ordnance rack, whichever
// line is picked (it's the one count of the rounds left). Fills `out`, so a
// frame loop makes nothing.
export function armsView(a, out = { name: '', line: 'primary', index: 0, ammo: 0, max: 0, filling: 0 }) {
  out.name = a.name;
  out.line = a.line;
  out.index = a.index;
  out.ammo = a.ammo;
  out.max = a.ammoMax;
  out.filling = a.filling;
  return out;
}
