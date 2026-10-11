// A walker's gunner, from the game's vehicle AI rows (`ATAT_AI`, `ATST_AI`:
// ai.json's `vehicles`): the row's weapon class picks the firing patterns
// (`AIFiringPatterns`, one bit a sim step, as a soldier's), its range bounds
// who it shoots, and its target is the AI system's pick (`targeting.js`)
// among the enemies its turret sees. It fires the walker's anti-infantry
// cannon as the vehicle's record has it (vehicles.json: the AT-AT's chin
// cannon, 175 a bolt at 350 m/s, 450 a minute, never faster). By hand
// (NOTES.md): the turret's height and reach forward on the walker
// (`TURRET`), how far it sees (`GUNNER_SIGHT`: the row's 1,500 m is the
// gun's), and its spread (`SPREAD`: the row has no aim box). Pure.
//
//   createGunner(row, vehicle, { ai, rb, rand }) → { range, weapon, patterns, tick(now, { enemies, lineClear }) → shot | null }
//     shot: { from, aim, target, weapon }        enemies: the sim's entities of the other team
//   gunFor(rb, kind) → the vehicle weapon row a walker's gunner fires

import { pickTarget } from './targeting.js';

export const TURRET = { up: 15, ahead: 8 };
export const GUNNER_SIGHT = 250;
export const SPREAD = 0.02;
// A walker kind → its vehicle row and the weapon its gunner fires.
const GUNS = { walker: { vehicle: 'Vehicle_Ground_AT-AT_MP', weapon: /Chin Cannon/ } };
const CHEST = 1.2;

export function gunFor(rb, kind) {
  const g = GUNS[kind] ?? GUNS.walker;
  return rb.vehicles[g.vehicle]?.weapons?.find((w) => g.weapon.test(w.name ?? '')) ?? null;
}

export function createGunner(row, vehicle, { ai, rb, rand = Math.random }) {
  const gun = gunFor(rb, vehicle.kind) ?? {};
  const cls = String(row.class ?? '').replace(/^WeaponClass_/, '');
  const patterns = ai.patterns.filter((p) => p.weapon === cls);
  const range = Math.min(row.WeaponRange ?? GUNNER_SIGHT, GUNNER_SIGHT);
  // (a weapon row the bolts and damageAt read: the vehicle's cannon, at its damage the whole way)
  const weapon = { id: gun.name ?? 'walker', family: 'cannon', firing: { speed: gun.speed ?? 350, rof: gun.rof ?? 120 }, range, damage: { start: gun.damage ?? 50, end: gun.damageEnd ?? gun.damage ?? 50, startDistance: 0, endDistance: range, timeToLive: 3 }, colour: 'red' };
  const brain = { s: { id: vehicle.id, at: vehicle.at }, target: null, targetSince: 0 };
  const g = { pattern: null, frame: 0, last: -Infinity };
  const nextPattern = () => {
    g.pattern = patterns.length ? patterns[Math.floor(rand() * patterns.length)] : { bits: [true], delay: 0 };
    g.frame = 0;
  };
  return {
    range,
    weapon,
    patterns,
    tick(now, { enemies = [], lineClear = () => true } = {}) {
      if (!vehicle.alive) return null;
      const from = [vehicle.at[0] + Math.sin(vehicle.yaw ?? 0) * TURRET.ahead, vehicle.at[1] + TURRET.up, vehicle.at[2] + Math.cos(vehicle.yaw ?? 0) * TURRET.ahead];
      brain.s.at = vehicle.at;
      const seen = [];
      for (const e of enemies) {
        if (!e.alive || e.kind === 'walker') continue;
        const chest = [e.at[0], e.at[1] + CHEST, e.at[2]];
        if (Math.hypot(chest[0] - from[0], chest[2] - from[2]) > range || !lineClear(from, chest)) continue;
        seen.push({ id: e.id, at: { x: chest[0], y: chest[1], z: chest[2] }, visible: true, confidence: 1, hostile: true });
      }
      const byId = new Map(enemies.map((e) => [e.id, e]));
      const id = pickTarget(brain, seen, { system: ai.system, who: (x) => byId.get(x) ?? null, now });
      // the pattern's next frame: its bits, then its delay of frames with none
      if (!g.pattern) nextPattern();
      const f = g.frame;
      g.frame = (f + 1) % (g.pattern.bits.length + (g.pattern.delay ?? 0));
      if (g.frame === 0) nextPattern();
      const bit = f < g.pattern.bits.length && g.pattern.bits[f];
      if (!id || !bit || now - g.last < 60 / weapon.firing.rof - 1e-9) return null;
      g.last = now;
      const t = seen.find((x) => x.id === id).at;
      const d = Math.hypot(t.x - from[0], t.y - from[1], t.z - from[2]);
      const aim = [t.x + (rand() * 2 - 1) * SPREAD * d, t.y + (rand() * 2 - 1) * SPREAD * d * 0.5, t.z + (rand() * 2 - 1) * SPREAD * d];
      return { from, aim, target: id, weapon };
    },
  };
}
