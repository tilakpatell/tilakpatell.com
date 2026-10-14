// The heroes' and reinforcements' abilities as the game's records have them
// (src/data/bf2017/unitKit.json, scripts/bf2017-abilities-units.mjs; bf2-re
// findings 33, 41, 46): each ability's prefab applies affectors to its user
// or to the characters its sphere query finds (in its range and cone, from
// the ability's own outputs: 1697178449 the cone, 3791637896 the range, the
// hashes Luke's prefab feeds to PF_AOE_PieSlice's Angle and the
// SphereQuery's Radius), and this file turns each affector into what the sim
// can play: a DamageAffector's InitialDamage and DamageToDealPerSecond (to a
// hero or to a trooper by the prefab's hero filter), a DamageMultiplier on
// the damage taken, a DamageShield (overhealth that charges and drains), a
// heal, a regeneration, a character-state request (HitByForcePush: the
// shove; GetHit: the flinch), and the tags by their descriptors (980125368
// the disabled set: no fire, no abilities; 1544269865 held in place;
// 2368543753 slowed to the `Trooper.Slowed` drive's 2.5 m/s). How it is
// played is its kind (UNIT_KIND, the script's one judgement); the moves
// (the rush, the choke, the chain, the throw, the jump pack) are
// abilitiesMoves.js. Pure: the sim's entities go in, damage requests come out.
//
//   unitRow(row) → the ability row with `unit` (its spec) where unitKit.json has it
//   specOf(id) → { id, kind, range, cone, reach, max, self: [effect], targets: [effect], projectile, fired, weapon, spot }
//   unitWeapon(id) → a weapon row unitKit.json keeps (the weapons a weapon ability swaps to)
//   kitOfUnit(unitId) → { unit, primary, abilities } (the kit a hero or reinforcement deploys with)
//   onUnit(sim, s, a, e)        an ability event of a unit's: start / active / end
//   stepUnits(sim) → requests [{ type: 'blast', by, team, at, kind, hits }]
//   affect(sim, giver, target, effect, now, out)   one effect on one body (the moves use it)
//   inReach(sim, s, { range, cone, team, allies }) → bodies in a query's sphere and cone, nearest first

import UNIT from '../../data/bf2017/unitKit.json';
import ABILITIES from '../../data/bf2017/abilities.json';
import { apply, remove } from './affectors.js';
import { STEP } from './core.js';
import { lineClear } from './nav.js';
import { chestOf, eyeOf } from './soldier.js';

export const KIT = UNIT;
// The outputs whose role a prefab names (unitKit.json's outputs: Luke's push feeds them to the pie slice and the sphere).
export const OUT_CONE = 1697178449;
export const OUT_RANGE = 3791637896;
// The descriptors the state machine's tags carry (the shock's Affector_Stunned, Affector_Shock, the chokes and holds share them).
export const DISABLED = 980125368;
export const IMMOBILE = 1544269865;
export const SLOWED = 2368543753;
// `DriveWithInput.Trooper.Slowed` / `Vader.Slow`'s Velocity (bf2-re data/physics/soldier-physics-states.txt).
export const SLOWED_SPEED = 2.5;
// A shove's travel for an ImpulseMultiplier of 1, metres, over the request's MaxDuration: the impulse's unit is not in
// the records (finding 46), the fling is the WarpPush clip's root motion, which the export lacks: by hand (NOTES.md).
export const SHOVE = 5;
const DEG = Math.PI / 180;

// (a star card's, a conditional or a bookkeeping affector: not the ability as it comes)
const UPGRADE = /StarCard|_Card\d|_Extra\d|Extra\d$|_SP$|Choked|AlreadyHit|LastStrike|Strike1|_Double|Addition\d/i;
const IGNORE = /RemoveAffector|_Remove|Remove_|SendEvent|_VFX|VFX$|StaticObject|ScoringPossible|TargetSelection|YodaBlockedForce|AttackedAndFallOff|Disrupted|Immunity|Blocked$|ChainLightningBlocked|FirstHit|_Return$|SaberThrowHit|ForceRushed|_Active$|Deflected/i;

const short = (n) => String(n).split('/').pop();
const rows = ABILITIES.rows;

// the level-one value of an ability's output (the ability as it comes)
export function outputOf(id, hash) {
  const own = UNIT.abilities[id]?.values?.[hash >>> 0];
  if (typeof own === 'number') return own;
  const hex = (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
  for (const m of rows[id]?.ranks?.[0]?.modifiers ?? []) if (m.property === hex) return m.value;
  return null;
}

// an applied affector as an effect the sim plays, or null
function effectOf(ap) {
  const name = short(ap.affector);
  if (UPGRADE.test(name) || IGNORE.test(name)) return null;
  const a = UNIT.affectors[ap.affector];
  if (!a) return null;
  const r = a.ranks?.[Math.min(ap.rank, a.ranks.length - 1)] ?? {};
  const base = { name, duration: ap.duration, vs: ap.vs, to: ap.to };
  switch (a.type) {
    case 'DamageAffectorAsset':
      return r.damage > 0 || r.perSecond > 0 ? { ...base, type: 'damage', damage: r.damage ?? 0, perSecond: r.perSecond ?? 0, interval: r.interval ?? 0.5, delay: r.delay ?? 0 } : null;
    case 'DamageMultiplierAffectorAsset':
      return { ...base, type: 'taken', multiplier: r.multiplier ?? 1 };
    case 'DamageShieldAffectorAsset':
      return { ...base, type: 'shield', start: r.start ?? 0, full: r.full ?? r.start ?? 0, chargeStep: r.chargeStep ?? 0, chargeEvery: r.chargeEvery ?? 0, drainStep: r.drainStep ?? 0, drainEvery: r.drainEvery ?? 0, drainAfter: r.drainAfter ?? 0 };
    case 'HealingAffectorAsset':
      return { ...base, type: 'heal', heal: r.heal ?? 0, perSecond: r.perSecond ?? 0 };
    case 'SoldierHealthRegenerationAffectorAsset':
      return { ...base, type: 'regen', rate: r.rate ?? 0, delay: r.delay ?? 0 };
    case 'CharacterStateAffectorAsset': {
      const q = a.request;
      if (q?.trigger === 'HitByForcePush') return { ...base, type: 'shove', impulse: q.floats?.ImpulseMultiplier ?? 1, pull: q.ints?.AffectedBy === 3, seconds: q.maxDuration ?? 1 };
      if (q?.trigger === 'GetHit') return { ...base, type: 'flinch' };
      return null;
    }
    case 'BasicAffectorAsset': {
      const d = a.descriptors ?? [];
      const tag = { ...base, type: 'tag', disabled: d.includes(DISABLED), immobile: d.includes(IMMOBILE), slowed: d.includes(SLOWED), marked: /Ping|Sniff|Marked|Sharpshot/i.test(name) };
      return tag.disabled || tag.immobile || tag.slowed || tag.marked ? tag : null;
    }
    case 'FlashAffectorAsset':
      return { ...base, type: 'flash' };
    default:
      return null;
  }
}

// (a heal, a shield, a regeneration or a lighter damage taken lands on the user's side; the rest on the enemy's)
const friendly = (e) => e.type === 'shield' || e.type === 'heal' || e.type === 'regen' || (e.type === 'taken' && e.multiplier < 1);

const specs = new Map();
export function specOf(id) {
  if (specs.has(id)) return specs.get(id);
  const fx = UNIT.abilities[id];
  if (!fx) return null;
  const effects = fx.applies.map(effectOf).filter(Boolean);
  // (a self multiplier the prefab also removes from its user lasts while the ability runs, not its own Duration)
  const removes = fx.applies.some((ap) => ap.to === 'self' && /Remove/i.test(short(ap.affector)));
  for (const e of effects) if (e.to === 'self' && e.type === 'taken' && removes) e.whileActive = true;
  const radii = fx.spheres.filter((s) => s.types !== 'StaticObjects').map((s) => s.radius);
  const angles = fx.filters.map((f) => f.angle).filter((a) => a > 0 && a < 180);
  const spec = {
    id,
    kind: fx.kind,
    range: outputOf(id, OUT_RANGE) ?? (radii.length ? Math.max(...radii) : null),
    cone: outputOf(id, OUT_CONE) ?? (angles.length ? Math.max(...angles) : null),
    reach: radii.length ? Math.min(...radii) : null,
    max: fx.filters.find((f) => f.max)?.max ?? null,
    self: effects.filter((e) => e.to === 'self'),
    targets: effects.filter((e) => e.to !== 'self'),
    projectile: fx.projectiles.find((p) => p.explosion || p.entity === 'WSMissileEntityData' || /Grenade/.test(p.entity ?? '')) ?? fx.projectiles[0] ?? null,
    fired: fx.fired.find((f) => f.projectile) ?? fx.fired[0] ?? null,
    weapon: fx.weapon ?? null,
    spot: fx.spotting[0]?.seconds ?? null,
  };
  specs.set(id, spec);
  return spec;
}

export const unitWeapon = (id) => UNIT.weapons[id] ?? null;
export const kitOfUnit = (unitId) => UNIT.kits[unitId] ?? null;

export function unitRow(row) {
  const spec = specOf(row.id);
  if (!spec) return row;
  const out = { ...row, unit: spec };
  if (row.infinite) out.active = Infinity;
  return out;
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// the bodies a query finds: alive soldiers (and turrets for the enemy's side) within range of the user, inside the
// cone (half-angle, degrees, about its facing), on the side asked, with a clear line; nearest first
export function inReach(sim, s, { range, cone = null, allies = false, from = null, self = false } = {}) {
  const at = from ?? s.at;
  const out = [];
  if (!(range > 0)) return out;
  const eye = eyeOf(s);
  for (const o of sim.entities.values()) {
    if (!o.alive || (o.kind !== 'soldier' && (allies || o.kind !== 'turret'))) continue;
    if (o === s ? !self : allies ? o.team !== s.team : o.team === s.team) continue;
    const c = o.kind === 'soldier' ? chestOf(o) : [o.at[0], o.at[1] + 0.6, o.at[2]];
    const d = dist(c, at);
    if (d > range) continue;
    if (cone != null && cone < 180 && o !== s) {
      const dx = c[0] - at[0];
      const dz = c[2] - at[2];
      const L = Math.hypot(dx, dz);
      if (L > 0.5 && (dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw)) / L < Math.cos(cone * DEG)) continue;
    }
    if (o !== s && sim.nav && !lineClear(sim.nav, eye, c)) continue;
    out.push({ o, d, c });
  }
  return out.sort((a, b) => a.d - b.d).map((x) => x.o);
}

const isHero = (o) => o.unit === 'hero';

// one effect on one body: damage as a request (the sim applies it through the shield and the overhealth), the rest on it
export function affect(sim, giver, o, e, now, out, ability = null) {
  if (e.vs === 'hero' && !isHero(o)) return;
  if (e.vs === 'trooper' && isHero(o)) return;
  sim.units ??= {};
  const until = (d) => now + (d > 0 ? d : (e.seconds ?? 0));
  switch (e.type) {
    case 'damage': {
      if (e.damage > 0) out.push({ type: 'blast', by: giver.id, team: giver.team, at: chestOf(o), kind: ability ?? e.name, hits: [{ id: o.id, damage: e.damage, dir: dirTo(giver, o) }] });
      if (e.perSecond > 0 && e.duration > 0) (sim.units.dots ??= []).push({ by: giver.id, team: giver.team, id: o.id, perSecond: e.perSecond, every: e.interval || 0.5, next: now + (e.interval || 0.5), until: now + e.duration, kind: ability ?? e.name });
      return;
    }
    case 'taken':
      apply(o.stack, { id: `${ability}:${e.name}`, property: 'ArmorMultiplier', op: 'mul', value: e.multiplier, until: e.whileActive || !(e.duration > 0) ? undefined : until(e.duration) });
      if (e.whileActive || !(e.duration > 0)) (sim.units.held ??= []).push({ id: o.id, key: `${ability}:${e.name}`, ability, owner: giver.id });
      return;
    case 'shield':
      o.over = { hp: e.start, max: e.full, since: now, step: e.chargeStep, every: e.chargeEvery || STEP, drainAfter: e.drainAfter, drainStep: e.drainStep, drainEvery: e.drainEvery || STEP, next: now };
      return;
    case 'heal':
      if (e.heal > 0) o.hp = Math.min(o.hpMax, o.hp + e.heal);
      if (e.perSecond > 0) (sim.units.heals ??= []).push({ id: o.id, perSecond: e.perSecond, until: until(e.duration) });
      return;
    case 'regen':
      (sim.units.heals ??= []).push({ id: o.id, perSecond: e.rate, until: until(e.duration) });
      return;
    case 'shove':
      shove(sim, giver, o, e, now);
      return;
    case 'flinch':
      o.stunnedUntil = Math.max(o.stunnedUntil ?? -Infinity, until(Math.min(e.duration, 0.7)));
      return;
    case 'flash':
      o.flashedUntil = Math.max(o.flashedUntil ?? -Infinity, until(e.duration));
      return;
    case 'tag': {
      const t = until(e.duration);
      if (e.disabled) {
        o.disabledUntil = Math.max(o.disabledUntil ?? -Infinity, t);
        o.stunnedUntil = Math.max(o.stunnedUntil ?? -Infinity, t);
      }
      if (e.immobile) apply(o.stack, { id: `${ability}:held`, property: 'speed', op: 'set', value: 0, until: t });
      else if (e.slowed) apply(o.stack, { id: `${ability}:slowed`, property: 'speed', op: 'set', value: SLOWED_SPEED, until: t });
      if (e.marked) o.markedUntil = Math.max(o.markedUntil ?? -Infinity, t);
      return;
    }
    default:
  }
}

const dirTo = (a, b) => {
  const d = [b.at[0] - a.at[0], 0.2, b.at[2] - a.at[2]];
  const L = Math.hypot(...d) || 1;
  return d.map((v) => v / L);
};

// a shove (HitByForcePush): away from the giver, or toward it for a pull (AffectedBy 3), over the request's MaxDuration;
// the victim is down for it (the push's reaction state holds the controls)
function shove(sim, giver, o, e, now) {
  if (o.kind !== 'soldier') return;
  const dx = o.at[0] - giver.at[0];
  const dz = o.at[2] - giver.at[2];
  const L = Math.hypot(dx, dz) || 1;
  const way = e.pull ? -1 : 1;
  const metres = e.pull ? Math.max(0, L - 2) : SHOVE * e.impulse;
  const seconds = e.seconds || 1;
  o.shove = { dir: [(way * dx) / L, (way * dz) / L], speed: metres / seconds, until: now + seconds };
  o.disabledUntil = Math.max(o.disabledUntil ?? -Infinity, now + seconds);
  o.stunnedUntil = Math.max(o.stunnedUntil ?? -Infinity, now + seconds);
}

// the effects of an area ability, once: on the user, then on what its query finds (allies for the friendly effects)
export function burst(sim, s, spec, now, out, { range = spec.range, cone = spec.cone, from = null } = {}) {
  for (const e of spec.self) affect(sim, s, s, e, now, out, spec.id);
  const foes = spec.targets.filter((e) => !friendly(e));
  const friends = spec.targets.filter(friendly);
  const hit = foes.length ? inReach(sim, s, { range, cone, from }).slice(0, spec.max ?? Infinity) : [];
  for (const o of hit) for (const e of foes) affect(sim, s, o, e, now, out, spec.id);
  if (friends.length) for (const o of inReach(sim, s, { range, allies: true, from })) for (const e of friends) affect(sim, s, o, e, now, out, spec.id);
  return hit;
}

// an ability's ongoing effects end with it (the multipliers held while it runs)
export function release(sim, s, abilityId) {
  const held = sim.units?.held ?? [];
  for (const h of held) {
    if (h.owner !== s.id || h.ability !== abilityId) continue;
    const o = sim.entities.get(h.id);
    if (o?.stack) remove(o.stack, h.key);
  }
  if (sim.units) sim.units.held = held.filter((h) => !(h.owner === s.id && h.ability === abilityId));
}
