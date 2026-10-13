// The trooper classes' kit: what the twelve class abilities do once pressed
// (bf2-re finding 33; the numbers in `src/data/bf2017/trooperKit.json`,
// each with its record), on the sim's soldiers. A grenade is pulled for the
// ability's 0.32 s and leaves the hand on the key's release, no later than
// 3.2 s after the press (a tap throws at the pull's end), then flies as
// `grenades.js` says; the ability stays active for its 0.7 s throw, and for
// as long as the grenade is still in the hand. The sentry, the vanguard,
// infiltration and the scan dart swap the gun (which fires once its
// `DeployTime` has passed) and end on their own event (the sentry's heat,
// the vanguard's 12.5 s, infiltration's 16.7 s, the dart's one round); the
// shield is 250 health in front of the heavy, lowered by a second press
// after 2 s or at 0; the officer's presence gives 13 m of friendlies +100
// overhealth and faster cooling; the turret is a body with a gun that
// locks in 1 s and fires 5-bolt bursts; the binoculars mark what they see
// for 10 s; the flash blinds enemies within 10 m who face it for 5 s; the
// shock stuns and burns 2 m at 10 a second; the roll takes 0.8 of the
// damage for 2 s. A soldier killed with a grenade in the hand drops it at
// 0.34 of the throw. Pure: the sim's entities and navgrid go in, damage
// requests come out for the sim to apply.
//
//   kitRow(row) → the ability row with the kit's fields (`active: Infinity`, `retrigger`, `blocks`, `kit`)
//   kitWeapon(id) → a weapon row of the kit (sentry, hunter, ee4, pinglauncher, turret)
//   createKit() → kit     (the grenades in the air, the fields, the spots, the teams' grenade tokens)
//   onAbility(sim, s, event)        (an ability event from the soldier's tick: start / active / end)
//   onRoll(s, now)                  (the roll's evading affector)
//   stepKit(sim) → [{ type: 'blast', by, team, at, kind, hits: [{ id, damage, dir }] } | { type: 'field', by, id, damage, at }]
//   absorb(s, damage, { dir, now }) → the damage left after the shield and the overhealth
//   hurtTurret(sim, turret, damage) → 'hurt' | 'down'
//   slotsOf(s) → [{ slot, id, state, recharge, charges, ready, active }]   (the HUD's three)
//   grenadesOf(kit) → [{ id, at, kind, owner, team, spin, resting }]   (the grenades in the air, for the view)

import kit from '../../data/bf2017/trooperKit.json';
import { charges, end, hold, recharge, state } from './abilities.js';
import { apply, remove } from './affectors.js';
import { STEP } from './core.js';
import { GRENADES, SPLIT, THROW, createGrenade, explode, stepGrenade, throwFrom } from './grenades.js';
import { firstSolid, heightAt, lineClear } from './nav.js';
import { chestOf, eyeOf } from './soldier.js';
import { createGun, fire as fireGun, tick as tickGun } from './weapons.js';
import { createTokens, grenadeGone, grenadeOut } from './ai/throw.js';

export const KIT = kit;
// `Affector_CoolingPowerMultiplier_BattleCommand`'s multiplier is not in the finding: by hand.
export const PRESENCE_COOLING = 1.5;
// How long a bot keeps the binoculars up (a player holds them as long as it likes): by hand.
export const BOT_BINOCULARS = 3;
// Where a turret's gun sits over its foot, and its body for the bolts, metres: by hand (no mesh is measured).
export const TURRET_BODY = { eye: 1.0, low: 0.2, high: 1.1, radius: 0.45 };
const DEG = Math.PI / 180;

export function kitRow(row) {
  const extra = kit.abilities[row.id];
  if (!extra) return row;
  const { _source, ...k } = extra;
  void _source;
  const out = { ...row, kit: k };
  if (k.active === 'infinite') out.active = Infinity;
  else if (k.active != null) out.active = k.active;
  if (k.activation != null) out.activation = k.activation;
  if (k.retrigger) out.retrigger = k.retrigger;
  if (k.blocks) out.blocks = k.blocks;
  if (k.channels) out.channels = k.channels;
  return out;
}

export const kitWeapon = (id) => kit.weapons[id] ?? null;

export const createKit = () => ({ grenades: [], fields: [], spots: [], blasts: [], armed: new Map(), tokens: createTokens(), next: 1 });

// a grenade numbered as it leaves, for the view
const born = (K, g) => Object.assign(g, { id: K.next++ });
const slotOf = (s, id) => s.abilities.list.find((a) => a.row.id === id) ?? null;
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// the aim's yaw and pitch from a soldier's eye to its aim point (a player's), or its facing
function aimAngles(s) {
  const eye = eyeOf(s);
  if (!s.aim) return { eye, yaw: s.yaw, pitch: 0 };
  const d = [s.aim[0] - eye[0], s.aim[1] - eye[1], s.aim[2] - eye[2]];
  const L = Math.hypot(d[0], d[1], d[2]) || 1;
  return { eye, yaw: Math.atan2(d[0], d[2]), pitch: Math.asin(Math.max(-1, Math.min(1, d[1] / L))) };
}

// the gun in the hand: the latest pressed ability's that is still up, else the soldier's own
// (a hero's swapped weapon too: heroBlaster.js)
export function syncGun(s) {
  let top = null;
  for (const a of s.abilities.list) if (a.gun && a.phase !== 'idle' && (!top || a.startedAt >= top.startedAt)) top = a;
  if (top) {
    s.gunBase ??= s.gun;
    s.gun = top.gun;
  } else if (s.gunBase) {
    s.gun = s.gunBase;
    s.gunBase = null;
  }
  s.weapon = s.gun?.row ?? s.weapon;
}

function throwNow(sim, s, entry, now, power = THROW.power) {
  const K = sim.kit;
  // (a bot's grenade is the AI's whatever its class: `BattleAIProjectile.Projectile Thermal_Detonator_Projectile_AI`)
  const row = s.bot ? GRENADES.botThermal : GRENADES[entry.row.kit.grenade];
  let at, vel;
  if (s.throwPlan && power === THROW.power) ({ at, vel } = s.throwPlan);
  else {
    const { eye, yaw, pitch } = aimAngles(s);
    ({ at, vel } = throwFrom(eye, yaw, pitch, { power }));
  }
  s.throwPlan = null;
  const g = born(K, createGrenade(row, { at, vel, owner: s.id, team: s.team, now, bot: s.bot }));
  // (a bot's grenade holds its team's token while it is out)
  if (s.bot) {
    g.token = true;
    grenadeOut(K.tokens, s.team);
  }
  K.grenades.push(g);
  hold(s.abilities, entry.slot, false);
  sim.out.push({ t: now, type: 'throw', by: s.id, kind: row.id, at: [...at] });
}

function placeTurret(sim, s, base, now) {
  // (an AutoPlayer's turret fires the `_AP` bolt: `V_TurretBlasters_Deployed_AP`)
  const row = s.bot && base.damageAP ? { ...base, damage: base.damageAP } : base;
  const ahead = [s.at[0] + Math.sin(s.yaw) * row.place, 0, s.at[2] + Math.cos(s.yaw) * row.place];
  ahead[1] = sim.nav ? heightAt(sim.nav, ahead[0], ahead[2]) : s.at[1];
  const id = `t${sim.kit.next++}`;
  const t = {
    id,
    kind: 'turret',
    team: s.team,
    owner: s.id,
    bot: s.bot,
    at: ahead,
    yaw: s.yaw,
    vel: [0, 0, 0],
    hp: row.health.max,
    hpMax: row.health.max,
    state: 'stand',
    stance: 'stand',
    moving: false,
    alive: true,
    born: now,
    lastHurt: -Infinity,
    gun: createGun(row, { rand: sim.rand }),
    weapon: row,
    lock: null,
    capsules: [{ part: 'body', a: [ahead[0], ahead[1] + TURRET_BODY.low, ahead[2]], b: [ahead[0], ahead[1] + TURRET_BODY.high, ahead[2]], r: TURRET_BODY.radius }],
    eye: [ahead[0], ahead[1] + TURRET_BODY.eye, ahead[2]],
  };
  sim.entities.set(id, t);
  s.turret = id;
  sim.out.push({ t: now, type: 'turret', by: s.id, id, at: [...ahead] });
}

export function onRoll(s, now) {
  apply(s.stack, { id: 'Evading', property: 'ArmorMultiplier', op: 'mul', value: kit.roll.taken, until: now + kit.roll.seconds });
}

export function onAbility(sim, s, e) {
  const a = slotOf(s, e.id);
  const k = a?.row.kit;
  if (!k) return;
  const now = sim.time;
  if (e.phase === 'start') {
    if (k.weapon) {
      const row = kitWeapon(k.weapon);
      a.gun = createGun(row, { rand: sim.rand });
      // (the weapon's own DeployTime before its first shot: the sentry's 0.9 s is its activation)
      s.deployUntil = now + (row.firing?.deploy ?? 0);
      syncGun(s);
    }
    if (k.speed != null) apply(s.stack, { id: `${e.id}:speed`, property: 'speed', op: 'set', value: k.speed });
    if (k.sprint != null) apply(s.stack, { id: `${e.id}:sprint`, property: 'sprint', op: 'mul', value: k.sprint });
    if (k.hidden) s.hidden = true;
    if (k.presence) presence(sim, s, k.presence, now);
    s.kitActive = { id: e.id, slot: a.slot, since: now };
  } else if (e.phase === 'active') {
    if (k.grenade) {
      // (in the hand from the pull's end until the key's release: the ability is held active meanwhile)
      sim.kit.armed.set(s.id, { slot: a.slot, row: a.row, since: a.startedAt });
      hold(s.abilities, a.slot, true);
    }
    if (k.shield) s.shield = { hp: k.shield.health, max: k.shield.health, since: now };
    if (k.turret) placeTurret(sim, s, kitWeapon(k.turret), now);
    if (k.dart) fireDart(sim, s, a, now);
  } else if (e.phase === 'end') {
    if (k.weapon) {
      a.gun = null;
      syncGun(s);
    }
    if (k.speed != null) remove(s.stack, `${e.id}:speed`);
    if (k.sprint != null) remove(s.stack, `${e.id}:sprint`);
    if (k.hidden) s.hidden = false;
    if (k.shield) s.shield = null;
    if (k.turret && s.turret) removeTurret(sim, s.turret, 'removed');
    if (s.kitActive?.id === e.id) s.kitActive = null;
  }
}

function presence(sim, s, p, now) {
  for (const o of sim.entities.values()) {
    if (o.kind !== 'soldier' || !o.alive || o.team !== s.team || dist3(o.at, s.at) > p.radius) continue;
    apply(o.stack, { id: 'BattleCommand', property: 'BattleCommand', op: 'set', value: 1, until: now + p.seconds });
    o.over = { hp: o.over?.hp ?? 0, max: p.overhealth, since: now, step: p.chargeStep, every: p.chargeEvery, drainAfter: p.drainAfter, drainStep: p.drainStep, drainEvery: p.drainEvery, next: now };
    o.coolUntil = now + p.cooling;
    if (o.gun) o.gun.coolMul = PRESENCE_COOLING;
  }
}

function fireDart(sim, s, a, now) {
  const row = GRENADES.dart;
  const { eye, yaw, pitch } = aimAngles(s);
  const dir = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  sim.kit.grenades.push(born(sim.kit, createGrenade(row, { at: [...eye], vel: dir.map((v) => v * row.speed), owner: s.id, team: s.team, now, bot: s.bot })));
  sim.out.push({ t: now, type: 'throw', by: s.id, kind: row.id, at: [...eye] });
  // (one round, SwitchToPrimaryWhenOutOfAmmo: the ability is spent on the shot)
  end(s.abilities, a.slot, now, 'fired');
}

// a turret gone: its owner's second press ('removed'), or shot down ('destroyed'); its ability ends and its body blasts
function removeTurret(sim, id, why) {
  const t = sim.entities.get(id);
  if (!t) return null;
  t.alive = false;
  sim.entities.delete(id);
  const owner = sim.entities.get(t.owner);
  if (owner?.turret === id) {
    owner.turret = null;
    // (`EnterRechargeOnProjectileRemoval`: the cooldown starts when the turret is gone)
    const a = owner.abilities.list.find((x) => x.row.kit?.turret);
    if (a) end(owner.abilities, a.slot, sim.time, why);
  }
  const blast = why === 'destroyed' ? t.weapon.destroyed : t.weapon.removed;
  if (blast?.damage > 0) sim.kit.blasts.push({ by: t.owner, team: t.team, at: [t.at[0], t.at[1] + 0.5, t.at[2]], row: { inner: blast.inner, damage: blast.damage, radius: blast.radius, multiplier: 1, owner: false, id: 'turret' } });
  sim.out.push({ t: sim.time, type: 'turretGone', id, why, at: [...t.at] });
  return t;
}

export function hurtTurret(sim, t, damage) {
  t.hp = Math.max(0, t.hp - damage);
  t.lastHurt = sim.time;
  if (t.hp > 0) return 'hurt';
  removeTurret(sim, t.id, 'destroyed');
  return 'down';
}

// the shield in front, then the overhealth, take the damage first
export function absorb(s, damage, { dir = null, now = 0 } = {}) {
  let left = damage;
  if (s.shield && left > 0) {
    // (a shot from the front: the bolt flies against the heavy's facing)
    const front = !dir || dir[0] * Math.sin(s.yaw) + dir[2] * Math.cos(s.yaw) < 0;
    if (front) {
      const took = Math.min(s.shield.hp, left);
      s.shield.hp -= took;
      left -= took;
      if (s.shield.hp <= 0) {
        const a = s.abilities.list.find((x) => x.row.kit?.shield);
        if (a) end(s.abilities, a.slot, now, 'health');
        s.shield = null;
      }
    }
  }
  if (s.over && left > 0) {
    const took = Math.min(s.over.hp, left);
    s.over.hp -= took;
    left -= took;
  }
  return left;
}

export function slotsOf(s) {
  return s.abilities.list
    .filter((a) => a.slot >= 1 && a.slot <= 3)
    .map((a) => {
      const st = state(s.abilities, a.slot);
      return { slot: a.slot, id: a.row.id, state: st, recharge: recharge(s.abilities, a.slot), charges: charges(s.abilities, a.slot), ready: st === 'ready', active: st === 'active' || st === 'activating' };
    });
}

// the bodies a blast or a field reaches: the soldiers' chests and the turrets
function bodiesOf(sim) {
  const out = [];
  for (const e of sim.entities.values()) {
    if (!e.alive) continue;
    if (e.kind === 'soldier') out.push({ id: e.id, team: e.team, at: chestOf(e), alive: true });
    else if (e.kind === 'turret') out.push({ id: e.id, team: e.team, at: [e.at[0], e.at[1] + 0.6, e.at[2]], alive: true });
  }
  return out;
}

// `PF_Officer_Flash`: the characters within FlashDistance with a clear line, not friendly, not shielded, facing within FlashAngle
function flashAt(sim, at, row, team, now) {
  for (const o of sim.entities.values()) {
    if (o.kind !== 'soldier' || !o.alive || o.team === team || o.shield) continue;
    const eye = eyeOf(o);
    const d = [at[0] - eye[0], at[1] - eye[1], at[2] - eye[2]];
    const L = Math.hypot(d[0], d[1], d[2]);
    if (L > row.range || L < 1e-9) continue;
    const cos = (d[0] * Math.sin(o.yaw) + d[2] * Math.cos(o.yaw)) / (Math.hypot(d[0], d[2]) || 1);
    if (cos < Math.cos((row.angle / 2) * DEG)) continue;
    if (sim.nav && !lineClear(sim.nav, eye, at)) continue;
    o.flashedUntil = Math.max(o.flashedUntil ?? 0, now + row.seconds);
  }
}

function stepGrenades(sim, K, now, requests) {
  const world = { heightAt: (x, z) => (sim.nav ? heightAt(sim.nav, x, z) : 0), solid: sim.nav ? (a, b) => firstSolid(sim.nav, a, b) : null, now };
  const keep = [];
  for (const g of K.grenades) {
    for (const ev of stepGrenade(g, STEP, world)) {
      if (ev.type === 'split') {
        for (let i = 0; i < ev.count; i++) {
          const a = (i / ev.count) * Math.PI * 2;
          keep.push(born(K, createGrenade(GRENADES.flashSub, { at: [ev.at[0], ev.at[1] + 0.3, ev.at[2]], vel: [Math.cos(a) * SPLIT.speed * 0.5, SPLIT.speed, Math.sin(a) * SPLIT.speed * 0.5], owner: g.owner, team: g.team, now, bot: g.bot })));
        }
        sim.out.push({ t: now, type: 'split', by: g.owner, at: ev.at });
      } else if (ev.type === 'explode') {
        const row = g.row;
        if (row.flash) flashAt(sim, ev.at, row.flash, g.team, now);
        if (row.spot) K.spots.push({ at: ev.at, team: g.team, radius: row.spot.radius, seconds: row.spot.seconds, until: now + row.spot.life });
        if (row.damage > 0) K.blasts.push({ by: g.owner, team: g.team, at: ev.at, row, multiplier: g.multiplier });
        if (row.field) K.fields.push({ at: ev.at, by: g.owner, team: g.team, row: row.field, until: now + row.field.seconds, next: now });
        sim.out.push({ t: now, type: 'explosion', by: g.owner, kind: row.id, at: ev.at, radius: row.flash ? row.flash.range : row.radius * (g.multiplier ?? 1) });
      }
    }
    if (!g.dead) keep.push(g);
    else if (g.token) grenadeGone(K.tokens, g.team);
  }
  K.grenades = keep;
  const bodies = K.blasts.length ? bodiesOf(sim) : null;
  for (const b of K.blasts) {
    const hits = explode(b.row, b.at, bodies, { occluded: sim.nav ? (a, c) => !lineClear(sim.nav, a, c) : null, multiplier: b.multiplier ?? b.row.multiplier ?? 1, owner: b.by, team: b.team });
    requests.push({ type: 'blast', by: b.by, team: b.team, at: b.at, kind: b.row.id, hits });
  }
  K.blasts = [];
}

function stepFields(sim, K, now, requests) {
  K.fields = K.fields.filter((f) => f.until > now);
  for (const f of K.fields) {
    if (now + 1e-9 < f.next) continue;
    f.next += f.row.tick;
    for (const o of sim.entities.values()) {
      if (o.kind !== 'soldier' || !o.alive || o.team === f.team || dist3(chestOf(o), f.at) > f.row.radius) continue;
      // (the shock's field stuns; a hero's cloud does not, and one may only hold a blaster down: heroBlaster.js)
      if (f.row.apply > 0) {
        apply(o.stack, { id: 'Stunned', property: 'speed', op: 'set', value: 0, until: now + f.row.apply });
        o.stunnedUntil = now + f.row.apply;
      }
      if (f.row.noFire > 0) o.noFireUntil = Math.max(o.noFireUntil ?? 0, now + f.row.noFire);
      // (a cloud's first touch is its `InitialDamage`, each tick after it the rate's share)
      const first = f.row.first != null && !(f.seen ??= new Set()).has(o.id);
      if (first) f.seen.add(o.id);
      const damage = first ? f.row.first : f.row.perSecond * f.row.tick;
      if (damage > 0) requests.push({ type: 'field', by: f.by, id: o.id, damage, at: f.at });
    }
  }
  K.spots = K.spots.filter((p) => p.until > now);
  for (const p of K.spots) for (const o of sim.entities.values()) if (o.kind === 'soldier' && o.alive && o.team !== p.team && dist3(o.at, p.at) <= p.radius) o.markedUntil = Math.max(o.markedUntil ?? 0, now + p.seconds);
}

function stepTurret(sim, t, now) {
  // (a turret whose officer has deployed again, or is gone, goes with him)
  const owner = sim.entities.get(t.owner);
  if (!owner || owner.turret !== t.id) return void removeTurret(sim, t.id, 'removed');
  const row = t.weapon;
  tickGun(t.gun, STEP, now);
  let best = null;
  for (const e of sim.entities.values()) {
    if (!e.alive || e.team === t.team || e.kind !== 'soldier' || e.hidden) continue;
    const c = chestOf(e);
    const d = dist3(c, t.eye);
    if (d > row.lock.ray || (best && d >= best.d)) continue;
    if (sim.nav && !lineClear(sim.nav, t.eye, c)) continue;
    best = { e, c, d };
  }
  if (!best) {
    if (t.lock && now - t.lock.seen > row.lock.unlock) t.lock = null;
    return;
  }
  if (!t.lock || t.lock.id !== best.e.id) t.lock = { id: best.e.id, since: now, seen: now };
  t.lock.seen = now;
  t.yaw = Math.atan2(best.c[0] - t.eye[0], best.c[2] - t.eye[2]);
  if (now - t.lock.since < row.lock.time - 1e-9) return;
  const shots = fireGun(t.gun, now);
  if (!shots) return;
  for (const shot of shots) sim.pending.push({ owner: t.id, at: shot.at, dir: shot.dir, aim: [...best.c], from: [...t.eye] });
}

function stepSoldier(sim, s, now) {
  // the overhealth: charged in steps, then drained after its delay
  if (s.over) {
    const o = s.over;
    while (now + 1e-9 >= o.next) {
      if (now - o.since < o.drainAfter) {
        if (o.hp < o.max) o.hp = Math.min(o.max, o.hp + o.step);
        o.next += o.every;
      } else {
        o.hp = Math.max(0, o.hp - o.drainStep);
        o.next += o.drainEvery;
      }
    }
    if (o.hp <= 0 && now - o.since >= o.drainAfter) s.over = null;
  }
  if (s.coolUntil != null && now >= s.coolUntil) {
    if (s.gun) s.gun.coolMul = 1;
    if (s.gunBase) s.gunBase.coolMul = 1;
    s.coolUntil = null;
  }
  // a grenade in the hand leaves on the key's release, or at the hold's end (a bot's as soon as it is pulled)
  const armed = sim.kit.armed.get(s.id);
  if (armed) {
    const held = !s.bot && s.abilityHeld === armed.slot;
    if (!held || now - armed.since >= THROW.hold[1] - 1e-9) {
      sim.kit.armed.delete(s.id);
      throwNow(sim, s, armed, now);
    }
  }
  // each ability that is up, by its own event: the sentry's heat, the vanguard's and infiltration's time, the binoculars' mark
  for (const a of s.abilities.list) {
    const k = a.row.kit;
    if (!k || a.phase !== 'active') continue;
    if (k.weapon === 'sentry' && a.gun && (a.gun.state !== 'ready' || a.gun.heat >= (a.gun.row.heat?.threshold ?? 1) - 1e-9)) end(s.abilities, a.slot, now, 'heat');
    else if (k.life != null && now - a.startedAt >= k.life - 1e-9) end(s.abilities, a.slot, now, 'heat');
    else if (k.mark) {
      if (now + 1e-9 >= (a.markAt ?? -Infinity)) {
        a.markAt = now + k.mark.every;
        const eye = eyeOf(s);
        for (const o of sim.entities.values()) {
          if (o.kind !== 'soldier' || !o.alive || o.team === s.team || dist3(o.at, s.at) > k.mark.range) continue;
          if (sim.nav && !lineClear(sim.nav, eye, chestOf(o))) continue;
          o.markedUntil = Math.max(o.markedUntil ?? 0, now + k.mark.seconds);
        }
      }
      if (s.bot && now - a.activeAt >= BOT_BINOCULARS) end(s.abilities, a.slot, now, 'retrigger');
    }
  }
}

export function stepKit(sim) {
  const K = sim.kit;
  if (!K) return [];
  const now = sim.time;
  const requests = [];
  // (a soldier killed with a grenade in the hand drops it: KilledHoldingPowerModifier, ForceFireWhenKilledHolding)
  for (const [id, armed] of [...K.armed]) {
    const s = sim.entities.get(id);
    if (s?.alive) continue;
    K.armed.delete(id);
    if (s) throwNow(sim, s, armed, now, THROW.killedPower);
  }
  for (const e of [...sim.entities.values()]) {
    if (!e.alive) continue;
    if (e.kind === 'soldier') stepSoldier(sim, e, now);
    else if (e.kind === 'turret') stepTurret(sim, e, now);
  }
  stepGrenades(sim, K, now, requests);
  stepFields(sim, K, now, requests);
  return requests;
}

export const grenadesOf = (K) => (K ? K.grenades.map((g) => ({ id: g.id, at: g.at, kind: g.row.id, owner: g.owner, team: g.team, spin: g.spin, resting: g.resting })) : []);
