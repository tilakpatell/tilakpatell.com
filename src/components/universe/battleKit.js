// What a battle at the front (battle.js) and its parts share: its numbers
// (BATTLE), how wide each capital ship is for laying a line out (WIDTH),
// how many fighters a side the device can draw (perSide), the bolts each
// ship fires (fighterShot, capitalGuns: the game's, from its records), and
// the vector bits the fighters, the capital ships and the bolts are flown
// with, on plain { x, y, z }. Pure (no three.js), so it's tested in Node
// through battle.js, which hands all of it on.

import { kindDamage } from '../../lib/combat/damage';

// metres to a map unit (galaxy/surface/missions/starfighter.js's METRES:
// the Star Destroyer's 1,600 m is 30), for the game's bolts' speeds and
// their falloff
export const METRES = 53.3;

export const BATTLE = {
  radius: 125, // how far from the middle the fight goes before the fighters turn back in
  lines: 70, // how far each side's capital ships sit from the middle
  tickets: 220, // fighters a side can lose
  clock: 720, // seconds the attacker has
  respawn: [3, 6], // seconds before a fighter shot down comes back
  dying: 6, // seconds a flagship takes to break up
  youShare: 4, // how much more your damage counts on the objectives and hulls
  aiShare: 0.22, // and the AI's
  hullShare: { laser: 0.02, flak: 0, turbo: 0.03, torpedo: 0.06 }, // of a bolt's damage a capital's hull takes
  youHull: 0.25, // and of yours (times youShare)
  youHurt: { laser: 5, flak: 3, turbo: 18, torpedo: 22 }, // shields a hit takes off you
  turretHp: 6, // a battery's, in your shots (a run down a hull takes them out one by one)
  turretsNear: 45, // how near a battery must be to be on the lock's list
  ionHull: 3, // how much more a disabled ship's hull takes
  ionSubs: 2, // and its objectives
  onYou: 4, // fighters at most after you at once
  flak: 25, // how near a fighter must come to a battery for its point-defence
  step: 1 / 30, // seconds the battle moves on at a time, whatever the frame rate
  steps: 8, // and at most this many steps a frame (a longer frame's rest is dropped)
  // the war's own bolts, for a ship the game has no record of (its own
  // fighters' and capitals' fire the game's: fighterShot, capitalGuns) and
  // for a torpedo, which damage.json doesn't carry; `damage` is what one
  // does to a ship of the war's own numbers
  bolts: {
    laser: { speed: 60, life: 0.6, damage: 1 },
    flak: { speed: 70, life: 0.35, damage: 0.5 },
    turbo: { speed: 45, life: 4.5, damage: 6 },
    torpedo: { speed: 18, life: 4, damage: 9 },
  },
};

// how wide each capital ship is, as a share of its length (for laying a line out)
export const WIDTH = { venator: 0.45, acclamator: 0.55, munificent: 0.3, providence: 0.32, lucrehulk: 0.95, destroyer: 0.58, executor: 0.26, interdictor: 0.58, moncal: 0.32, nebulon: 0.28, corvette: 0.3, hammerhead: 0.3, lightcruiser: 0.36, gozanti: 0.62, transport: 0.32, councildread: 0.36, fedbattleship: 0.8, gearship: 0.5, saucer: 1, federation: 0.4, hauler: 0.5, superlab: 0.28, madrigal: 0.5, pestvan: 0.5, hacienda: 1, pollostruck: 0.5, pickup: 0.5 };
export const widthOf = (c) => (WIDTH[c.kind] ?? 0.4) * c.size;

// A shot as b.fire takes it: { speed (map units a second), life (seconds),
// damage (the war's own, on a ship the game has no record of), row (the
// game's bolt: src/data/bf2017/damage.json's, for lib/combat/damage.js) }.
const shotOf = (row, war) => ({ speed: row.speed / METRES, life: row.life, damage: war.damage, row });

// a fighter's guns: its game record's bolt (the X-wing's Projectile_Xwing,
// 2,000 m/s for 0.45 s), or null for a kind the game never had
const SHOTS = new Map();
export function fighterShot(kind) {
  if (!SHOTS.has(kind)) {
    const bolt = kindDamage(kind)?.bolt;
    SHOTS.set(kind, bolt ? shotOf(bolt, BATTLE.bolts.laser) : null);
  }
  return SHOTS.get(kind);
}

// A capital's batteries, from the turrets the game mounts on it (or on the
// ship it stands in for): `turbo`, at ships, the heavy turbolaser's bolt
// (the first of its turrets' bolts on property 61, the heavy turbolasers'
// in the grid; the first bolt where it has none), `flak`, at fighters, the
// anti-fighter bolt (the first on 72, the lighter guns'), and `battery`,
// the turret record a battery is hit as (the one firing its turbolaser: its
// hit points and property). The site's choice, the war's batteries each
// firing both; null where the game mounts no turret on the kind.
const GUNS = new Map();
export function capitalGuns(kind) {
  if (!GUNS.has(kind)) {
    const turrets = Object.values(kindDamage(kind)?.turrets ?? {});
    const all = turrets.flatMap((t) => t.bolts.map((bolt) => ({ t, bolt })));
    const heavy = all.find((o) => o.bolt.property === 61) ?? all[0];
    const light = all.find((o) => o.bolt.property === 72) ?? all[0];
    GUNS.set(kind, heavy ? { turbo: shotOf(heavy.bolt, BATTLE.bolts.turbo), flak: shotOf(light.bolt, BATTLE.bolts.flak), battery: heavy.t } : null);
  }
  return GUNS.get(kind);
}

const TIERS = { high: 32, mid: 20, low: 10 };
export const perSide = (tier) => TIERS[tier] ?? 20;

// ── vector bits, on plain { x, y, z } ──
export const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const set = (o, x, y, z) => ((o.x = x), (o.y = y), (o.z = z), o);
export const copy = (o, p) => set(o, p.x, p.y, p.z);
export const len = (o) => Math.sqrt(o.x * o.x + o.y * o.y + o.z * o.z);
export const norm = (o) => {
  const l = len(o) || 1;
  return set(o, o.x / l, o.y / l, o.z / l);
};
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
export const cross = (a, b, o = v3()) => set(o, a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const UP = v3(0, 1, 0);
export const ZERO = v3();

// The nose turned toward `want` by at most `max` radians (a new unit vector).
export function turnToward(fwd, want, max) {
  const w = norm(copy(v3(), want));
  const c = Math.max(-1, Math.min(1, dot(fwd, w)));
  const ang = Math.acos(c);
  if (ang <= max) return w;
  // about the axis between them (any at all when it's straight behind)
  const ax = cross(fwd, w);
  if (len(ax) < 1e-6) cross(fwd, Math.abs(fwd.y) < 0.9 ? UP : v3(1, 0, 0), ax);
  norm(ax);
  const s = Math.sin(max);
  const k = Math.cos(max);
  const t = cross(ax, fwd);
  return norm(v3(fwd.x * k + t.x * s, fwd.y * k + t.y * s, fwd.z * k + t.z * s));
}

// whether something `to` away (from the nose's root) is in range and inside
// the fighter's cone of fire
export function inSights(fwd, to, type) {
  const d = len(to);
  return d > 1e-6 && d <= type.range && dot(fwd, to) / d >= Math.cos(type.cone);
}

// a weighted pick from [{ weight }…]
export const pick = (list, rand) => {
  let r = rand() * list.reduce((s, o) => s + o.weight, 0);
  for (const o of list) if ((r -= o.weight) <= 0) return o;
  return list[list.length - 1];
};

// the same numbers from the same words, for every pilot (galaxy/gcw.js's
// seeded, kept here too so the battle's own modules don't reach into the
// galaxy for it)
export function seededRand(text) {
  let a = 2166136261;
  for (let i = 0; i < text.length; i++) a = Math.imul(a ^ text.charCodeAt(i), 16777619);
  a >>>= 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
