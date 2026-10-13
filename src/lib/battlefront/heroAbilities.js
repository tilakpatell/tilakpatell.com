// What each hero's and villain's three abilities do once they go off, by
// the kind the game's records give them (src/data/bf2017Abilities.json,
// scripts/bf2017-abilities.mjs: the reach, the cone, the damage to a hero
// and to a trooper, the knockback, the active time, the projectile's speed,
// the damage taken while it lasts) on the sim's soldiers; the times
// (activation, active, recharge, cost) are abilities.json's, run by
// abilities.js. What the records hold no number for is heroKit.json's
// `hand` row, each with its note. Pure: the sim's entities and navgrid go
// in, damage requests (the kit's `blast` shape, part 'force') come out.
//
//   KINDS                       every kind a hero's ability plays
//   fireAbility(sim, s, a, now) → requests      (a: the ability's slot entry; at the end of its activation)
//   startAbility(sim, s, a, now)                (its press: the damage taken while it winds up and lasts)
//   stepEffects(sim, s, now) → requests          (what goes on: a choke, a rush, a thrown saber, an aura, a barrage, a mine)
//   dmgFor(damage, target) → the record's damage for that target (a hero's or a trooper's)
//   inReach(s, o, { range, cone, yaw }) → bool   enemiesOf(sim, s) → the living enemy soldiers

import KIT from '../../data/bf2017/heroKit.json';
import { createGrenade, GRENADES, throwFrom } from './grenades.js';
import { apply } from './affectors.js';
import { fire as fireBolt } from './bolts.js';
import { heightAt, lineClear, walkable } from './nav.js';
import { chestOf, eyeOf } from './soldier.js';
import { createGun } from './weapons.js';

const H = KIT.hand;
const DEG = Math.PI / 180;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export const KINDS = ['push', 'repulse', 'pull', 'slam', 'choke', 'rush', 'saberThrow', 'rage', 'mindTrick', 'strike', 'electrocute', 'weaken', 'chainLightning', 'aura', 'charge', 'detonator', 'overcharge', 'barrier', 'rifle', 'sharpShot', 'smoke', 'pulse', 'scan', 'rocket', 'barrage', 'mine', 'absorb'];

export function dmgFor(d, o) {
  if (d == null) return 0;
  if (typeof d === 'number') return d;
  const hero = o?.unit === 'hero';
  const n = (v) => (typeof v === 'number' ? v : null);
  return (hero ? (n(d.hero) ?? n(d.any) ?? n(d.trooper)) : (n(d.trooper) ?? n(d.any) ?? n(d.hero))) ?? 0;
}

export const enemiesOf = (sim, s) => [...sim.entities.values()].filter((o) => o.kind === 'soldier' && o.alive && o.team !== s.team);

// where a soldier looks: its aim point's way, else its facing
export function aimYaw(s) {
  if (!s.aim) return s.yaw;
  return Math.atan2(s.aim[0] - s.at[0], s.aim[2] - s.at[2]);
}
function aimPitch(s) {
  const eye = eyeOf(s);
  if (!s.aim) return 0;
  const d = [s.aim[0] - eye[0], s.aim[1] - eye[1], s.aim[2] - eye[2]];
  return Math.asin(Math.max(-1, Math.min(1, d[1] / (Math.hypot(...d) || 1))));
}

export function inReach(sim, s, o, { range = 10, cone = 180, yaw = aimYaw(s) } = {}) {
  const dx = o.at[0] - s.at[0];
  const dz = o.at[2] - s.at[2];
  const d = Math.hypot(dx, dz);
  if (d > range) return false;
  if (cone < 180 && d > 0.3 && Math.abs(wrap(Math.atan2(dx, dz) - yaw)) > cone * DEG) return false;
  return !sim.nav || lineClear(sim.nav, chestOf(s), chestOf(o));
}

const blast = (s, hits, kind) => ({ type: 'blast', part: 'force', kind, by: s.id, team: s.team, at: chestOf(s), hits });
const dirTo = (s, o) => {
  const d = [o.at[0] - s.at[0], 0, o.at[2] - s.at[2]];
  const L = Math.hypot(d[0], d[2]) || 1;
  return [d[0] / L, 0, d[2] / L];
};

// a body held where it stands (no walking of its own, no firing) until `until`
export function hold(o, until, id = 'held') {
  apply(o.stack, { id, property: 'speed', op: 'set', value: 0, until });
  o.stunnedUntil = Math.max(o.stunnedUntil ?? -Infinity, until);
}

// a shove: carried `metres` along `dir` over the hand's knock seconds, held meanwhile
export function shove(o, dir, metres, now) {
  if (!(Math.abs(metres) > 0)) return;
  const t = H.knock.seconds;
  o.knock = { v: [(dir[0] * metres) / t, (dir[2] * metres) / t], until: now + t };
  hold(o, now + t, 'knocked');
}

// a step across the navgrid, sliding along what blocks it (soldier.js's move, at a given distance)
export function slide(nav, s, dx, dz) {
  for (const [mx, mz] of [
    [dx, dz],
    [dx, 0],
    [0, dz],
  ]) {
    if (Math.abs(mx) + Math.abs(mz) < 1e-9) continue;
    const x = s.at[0] + mx;
    const z = s.at[2] + mz;
    if (nav && !walkable(nav, x, z)) continue;
    s.at[0] = x;
    s.at[2] = z;
    if (nav && !s.hero?.air) s.at[1] = heightAt(nav, x, z);
    return true;
  }
  return false;
}

// the gun swapped for a while (Sharpshooter, Leia's E-11) and back
function swapGun(sim, s, row, until) {
  s.gunBase ??= s.gun;
  s.gun = createGun(row, { rand: sim.rand });
  s.weapon = row;
  s.hero.gunUntil = until;
}
export function restoreGun(s) {
  if (!s.gunBase) return;
  s.gun = s.gunBase;
  s.gunBase = null;
  s.weapon = s.gun?.row ?? s.weapon;
  s.hero.gunUntil = null;
}

// a grenade from the hero's hand along its aim (the kit's thrown rounds fly and burst as the trooper's: grenades.js, kit.js)
function lob(sim, s, row, now, { speed = null } = {}) {
  const K = sim.kit;
  const eye = eyeOf(s);
  let at;
  let vel;
  if (speed) {
    const yaw = aimYaw(s);
    const pitch = aimPitch(s);
    at = [eye[0] + Math.sin(yaw) * 0.5, eye[1] - 0.2, eye[2] + Math.cos(yaw) * 0.5];
    vel = [Math.sin(yaw) * Math.cos(pitch) * speed, Math.sin(pitch) * speed, Math.cos(yaw) * Math.cos(pitch) * speed];
  } else ({ at, vel } = throwFrom(eye, aimYaw(s), aimPitch(s)));
  const g = Object.assign(createGrenade(row, { at, vel, owner: s.id, team: s.team, now, bot: s.bot }), { id: K.next++ });
  K.grenades.push(g);
  sim.out?.push({ t: now, type: 'throw', by: s.id, kind: row.id, at: [...at] });
  return g;
}

// the rounds the records leave to the kit's rows (heroKit.json's hand for what differs)
const ROUNDS = {
  thermal: GRENADES.thermal,
  shock: GRENADES.shock,
  smoke: { ...GRENADES.flashSub, id: 'smoke', fuse: { on: 'sleep', delay: 0.5 }, ttl: 7 },
  rocket: { ...GRENADES.impact, id: 'rocket', gravity: 0, inner: 1, damage: H.rocket.damage, radius: H.rocket.radius, ttl: 3 },
  barrage: { ...GRENADES.impact, id: 'barrage', gravity: 0, inner: 0.5, damage: H.barrage.damage, radius: H.barrage.radius, ttl: 3 },
};
// which round each thrower's detonator is
const DETONATOR = { Ability_HanSolo_DemolitionGrenade: 'thermal', Ability_Leia_ThermalDetonator_Fake: 'thermal', Ability_Chewbacca_GrenadeStun: 'shock', Ability_Bossk_GrenadeDioxis: 'shock' };

// the damage taken while an ability winds up and lasts (its record's `taken`: Luke's rush, Obi-Wan's push, Anakin's slam)
export function startAbility(sim, s, a, now) {
  const fx = a.row.hero ?? {};
  s.hero.act = { kind: fx.kind ?? null, slot: a.slot, id: a.row.id, since: now };
  if (fx.taken != null && fx.kind !== 'weaken' && fx.kind !== 'scan') apply(s.stack, { id: `${a.row.id}:taken`, property: 'ArmorMultiplier', op: 'mul', value: fx.taken, until: now + (a.row.activation ?? 0) + Math.max(a.row.active ?? 0, fx.kind === 'rush' || fx.kind === 'charge' ? H.rush.seconds : 0) });
  // (Yoda's absorb: nothing lands while he draws it in)
  if (fx.kind === 'absorb') apply(s.stack, { id: `${a.row.id}:absorb`, property: 'ArmorMultiplier', op: 'set', value: 0, until: now + (a.row.activation ?? 0) });
}

export function fireAbility(sim, s, a, now) {
  const fx = a.row.hero ?? {};
  const out = [];
  const hits = [];
  const them = enemiesOf(sim, s);
  const active = a.row.active ?? 0;
  const yaw = aimYaw(s);
  const H2 = s.hero;
  switch (fx.kind) {
    case 'push':
    case 'repulse':
    case 'absorb': {
      const range = fx.range ?? 12;
      const cone = fx.kind === 'repulse' ? 360 : (fx.cone ?? 45);
      for (const o of them) {
        if (!inReach(sim, s, o, { range, cone, yaw })) continue;
        const dir = dirTo(s, o);
        hits.push({ id: o.id, damage: dmgFor(fx.damage, o), dir });
        shove(o, dir, fx.knock ?? 3, now);
        o.forceImmuneUntil = now + KIT.immunity.seconds;
      }
      break;
    }
    case 'pull': {
      for (const o of them) {
        if (!inReach(sim, s, o, { range: fx.range ?? 18, cone: fx.cone ?? 35, yaw })) continue;
        const dir = dirTo(s, o);
        const d = Math.hypot(o.at[0] - s.at[0], o.at[2] - s.at[2]);
        hits.push({ id: o.id, damage: dmgFor(fx.damage, o), dir });
        shove(o, dir, -(d - 1.5), now);
      }
      break;
    }
    case 'slam': {
      // (Chewbacca's leap lands ahead first; Anakin's Heroic Impact comes down where he stands)
      if (a.row.id === 'Ability_Chewbacca_Leap') {
        H2.rush = { dir: [Math.sin(yaw), Math.cos(yaw)], speed: H.slam.leap / H.rush.seconds, until: now + H.rush.seconds, reach: 0, damage: 0, hits: new Set(), then: { range: 3, damage: fx.damage, knock: fx.knock ?? 3 } };
        break;
      }
      for (const o of them) {
        if (!inReach(sim, s, o, { range: fx.range ?? 10, cone: 360, yaw })) continue;
        const dir = dirTo(s, o);
        hits.push({ id: o.id, damage: dmgFor(fx.damage, o), dir });
        shove(o, dir, fx.knock ?? 2, now);
      }
      break;
    }
    case 'choke': {
      const pick = them.filter((o) => inReach(sim, s, o, { range: fx.range ?? 12, cone: fx.cone ?? 35, yaw })).sort((p, q) => Math.abs(wrap(Math.atan2(p.at[0] - s.at[0], p.at[2] - s.at[2]) - yaw)) - Math.abs(wrap(Math.atan2(q.at[0] - s.at[0], q.at[2] - s.at[2]) - yaw)))[0];
      if (!pick) break;
      const per = fx.damage?.perSecond ?? fx.damage?.trooper?.perSecond ?? 0;
      const secs = fx.damage?.for ?? Math.max(active, 1);
      H2.choke = { target: pick.id, until: now + secs, perSecond: per, slot: a.slot };
      hold(pick, now + secs, 'choked');
      pick.lift = 1;
      break;
    }
    case 'rush':
    case 'charge': {
      const secs = active > 0 ? active : H.rush.seconds;
      // (toward the nearest in a 40° cone within 10 m, the lunge's pick; else along the aim)
      const mark = them.filter((o) => inReach(sim, s, o, { range: 10, cone: 40, yaw })).sort((p, q) => Math.hypot(p.at[0] - s.at[0], p.at[2] - s.at[2]) - Math.hypot(q.at[0] - s.at[0], q.at[2] - s.at[2]))[0];
      const dir = mark ? dirTo(s, mark) : [Math.sin(yaw), 0, Math.cos(yaw)];
      s.yaw = Math.atan2(dir[0], dir[2]);
      H2.rush = { dir: [dir[0], dir[2]], speed: H.rush.speed, until: now + secs, reach: (fx.reach ?? 1.5) + 0.3, damage: fx.damage, knock: fx.kind === 'charge' ? (fx.knock ?? 3) : 0, hits: new Set(), mark: mark?.id ?? null, one: fx.kind === 'charge' };
      break;
    }
    case 'saberThrow': {
      const secs = Math.max(active, 1);
      const from = chestOf(s);
      H2.thrown = { from, dir: [Math.sin(yaw), Math.cos(yaw)], t0: now, until: now + secs, range: Math.min(H.throw.range, ((fx.speed ?? 35) * secs) / 2), reach: (fx.reach ?? 0.5) + 0.4, damage: fx.damage ?? 0, hits: new Set(), at: from.slice() };
      break;
    }
    case 'rage': {
      const until = now + Math.max(active, 1);
      if (fx.taken != null) apply(s.stack, { id: `${a.row.id}:rage`, property: 'ArmorMultiplier', op: 'mul', value: fx.taken, until });
      if (fx.shield) s.over = { hp: fx.shield, max: fx.shield, since: now, drainAfter: active, step: 0, every: 1e9, next: now + active, drainStep: fx.shield / 100, drainEvery: 0.01 };
      H2.rage = { until, damage: fx.damage ?? null, reach: fx.reach ?? null, next: now };
      break;
    }
    case 'mindTrick': {
      for (const o of them) if (inReach(sim, s, o, { range: fx.range ?? 18, cone: fx.cone ?? 40, yaw })) o.noFireUntil = now + H.mindTrick.seconds;
      break;
    }
    case 'strike': {
      for (const o of them) {
        if (!inReach(sim, s, o, { range: (fx.reach ?? 2.5) + 0.5, cone: 60, yaw })) continue;
        hits.push({ id: o.id, damage: dmgFor(fx.damage, o), dir: dirTo(s, o) });
      }
      break;
    }
    case 'electrocute': {
      const reach = them.filter((o) => inReach(sim, s, o, { range: fx.range ?? 8, cone: fx.cone ?? 40, yaw }));
      // (the Emperor's holds the nearest, Dooku's stuns all in its cone)
      const list = fx.damage == null ? reach.slice(0, 1) : reach;
      for (const o of list) {
        hits.push({ id: o.id, damage: dmgFor(fx.damage, o), dir: dirTo(s, o) });
        hold(o, now + H.stun.seconds, 'stunned');
      }
      break;
    }
    case 'weaken': {
      for (const o of them) if (inReach(sim, s, o, { range: fx.reach ?? 10, cone: 60, yaw })) apply(o.stack, { id: `${a.row.id}:weak`, property: 'ArmorMultiplier', op: 'mul', value: fx.taken ?? 1.2, until: now + Math.max(active, 1) });
      break;
    }
    case 'chainLightning': {
      let last = them.filter((o) => inReach(sim, s, o, { range: fx.range ?? 18, cone: fx.cone ?? 22, yaw }))[0] ?? null;
      const struck = new Set();
      for (let hop = 0; last && hop <= H.chain.hops; hop++) {
        struck.add(last.id);
        hits.push({ id: last.id, damage: dmgFor(fx.damage, last), dir: dirTo(s, last) });
        hold(last, now + 0.5, 'shocked');
        const from = last;
        last = them.filter((o) => !struck.has(o.id) && Math.hypot(o.at[0] - from.at[0], o.at[2] - from.at[2]) <= H.chain.hop).sort((p, q) => Math.hypot(p.at[0] - from.at[0], p.at[2] - from.at[2]) - Math.hypot(q.at[0] - from.at[0], q.at[2] - from.at[2]))[0] ?? null;
      }
      break;
    }
    case 'aura':
      H2.aura = { until: now + Math.max(active, 1), range: fx.range ?? 10, damage: fx.damage ?? 0, next: now };
      break;
    case 'detonator':
      lob(sim, s, ROUNDS[DETONATOR[a.row.id] ?? 'thermal'], now);
      break;
    case 'smoke':
      lob(sim, s, ROUNDS.smoke, now);
      break;
    case 'overcharge': {
      const row = s.gunBase?.row ?? s.gun?.row;
      if (!row) break;
      const k = H.overcharge.damage;
      swapGun(sim, s, { ...row, id: row.id, heat: null, damage: row.damage ? { ...row.damage, start: row.damage.start * k, end: row.damage.end * k } : row.damage }, now + H.overcharge.seconds);
      break;
    }
    case 'rifle': {
      if (a.row.id === 'Ability_Iden_Pulse_Cannon') {
        // (one charged round from her TL-50)
        const row = s.gun?.row;
        if (row) fireBolt(sim.bolts, { from: chestOf(s), dir: [Math.sin(yaw) * Math.cos(aimPitch(s)), Math.sin(aimPitch(s)), Math.cos(yaw) * Math.cos(aimPitch(s))], speed: row.firing?.speed ?? 700, range: row.range ?? 200, ttl: 3, team: s.team, owner: s.id, weapon: { ...row, damage: row.damage ? { ...row.damage, start: 150, end: 150 } : row.damage }, colour: row.colour, now });
        break;
      }
      const e11 = sim.rb.weapons?.e11;
      if (e11) swapGun(sim, s, e11, now + H.rifle.seconds);
      break;
    }
    case 'sharpShot': {
      const row = s.gun?.row;
      if (!row) break;
      const marks = them.filter((o) => inReach(sim, s, o, { range: fx.reach ?? 40, cone: 60, yaw })).slice(0, 3);
      for (const o of marks) {
        const from = chestOf(s);
        const to = chestOf(o);
        const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
        const L = Math.hypot(...d) || 1;
        fireBolt(sim.bolts, { from, dir: d.map((v) => v / L), speed: row.firing?.speed ?? 700, range: row.range ?? 200, ttl: 3, team: s.team, owner: s.id, weapon: row, colour: row.colour, now });
      }
      break;
    }
    case 'barrier': {
      const secs = Math.max(active, 0) > 1 ? active : H.barrier.seconds;
      if (a.row.id === 'Ability_Leia_BubbleShield') {
        H2.dome = { at: s.at.slice(), radius: H.barrier.radius, until: now + secs };
        break;
      }
      const shield = fx.shield ?? 150;
      const range = fx.range ?? 0;
      for (const o of sim.entities.values()) {
        if (o.kind !== 'soldier' || !o.alive || o.team !== s.team) continue;
        if (o !== s && Math.hypot(o.at[0] - s.at[0], o.at[2] - s.at[2]) > range) continue;
        o.over = { hp: shield, max: shield, since: now, drainAfter: secs, step: 0, every: 1e9, next: now + secs, drainStep: shield / 50, drainEvery: 0.01 };
      }
      break;
    }
    case 'pulse': {
      // (Iden's droid flies to the aim and stuns round it; Lando's disruptor empties the abilities near him)
      const iden = a.row.id === 'Ability_Iden_Droid_Stun';
      const at = iden ? [s.at[0] + Math.sin(yaw) * 10, s.at[1], s.at[2] + Math.cos(yaw) * 10] : s.at;
      const range = iden ? (fx.reach ?? 5) : (fx.range ?? 18);
      for (const o of them) {
        if (Math.hypot(o.at[0] - at[0], o.at[2] - at[2]) > range) continue;
        if (iden) {
          hits.push({ id: o.id, damage: dmgFor(fx.damage, o), dir: dirTo(s, o) });
          hold(o, now + Math.max(active, 1), 'stunned');
        } else for (const x of o.abilities?.list ?? []) if (x.slot >= 1 && x.phase === 'idle') x.bar = 0;
      }
      break;
    }
    case 'scan': {
      const secs = active > 0 ? active : H.scan.seconds;
      const range = fx.range ?? fx.reach ?? 30;
      for (const o of them) if (Math.hypot(o.at[0] - s.at[0], o.at[2] - s.at[2]) <= range) o.markedUntil = Math.max(o.markedUntil ?? 0, now + secs);
      if (fx.taken != null) apply(s.stack, { id: `${a.row.id}:taken`, property: 'ArmorMultiplier', op: 'mul', value: fx.taken, until: now + secs });
      break;
    }
    case 'rocket':
      lob(sim, s, ROUNDS.rocket, now, { speed: H.rocket.speed });
      break;
    case 'barrage':
      H2.barrage = { left: H.barrage.count, every: Math.max(active, 0.4) / H.barrage.count, next: now, aim: s.aim ? s.aim.slice() : null };
      break;
    case 'mine':
      H2.mines = (H2.mines ?? []).filter((m) => m.until > now).concat([{ at: s.at.slice(), until: now + H.mine.life }]);
      break;
    default:
      break;
  }
  if (hits.length) out.push(blast(s, hits, fx.kind));
  return out;
}

// what goes on between steps: a choke's grip, a rush's run, a thrown saber, the rage's
// cuts, an aura, a barrage, the traps; the victims' shoves
export function stepEffects(sim, s, now, dt) {
  const H2 = s.hero;
  const out = [];
  const them = enemiesOf(sim, s);
  if (H2.choke) {
    const c = H2.choke;
    const o = sim.entities.get(c.target);
    if (!o?.alive || now >= c.until) {
      if (o) o.lift = 0;
      H2.choke = null;
    } else if (c.perSecond > 0) out.push(blast(s, [{ id: o.id, damage: c.perSecond * dt, dir: dirTo(s, o) }], 'choke'));
  }
  if (H2.rush) {
    const r = H2.rush;
    if (now >= r.until) {
      if (r.then) {
        const hits = [];
        for (const o of them) {
          if (Math.hypot(o.at[0] - s.at[0], o.at[2] - s.at[2]) > r.then.range) continue;
          const dir = dirTo(s, o);
          hits.push({ id: o.id, damage: dmgFor(r.then.damage, o), dir });
          shove(o, dir, r.then.knock, now);
        }
        if (hits.length) out.push(blast(s, hits, 'slam'));
      }
      H2.rush = null;
    } else {
      // (stopped at what it meets: a dash stops at a wall, finding 46)
      const mark = r.mark ? sim.entities.get(r.mark) : null;
      const near = mark?.alive && Math.hypot(mark.at[0] - s.at[0], mark.at[2] - s.at[2]) < 1.2;
      if (!near && !slide(sim.nav, s, r.dir[0] * r.speed * dt, r.dir[1] * r.speed * dt)) r.until = now;
      s.moving = true;
      s.vel[0] = r.dir[0] * r.speed;
      s.vel[2] = r.dir[1] * r.speed;
      if (r.damage) {
        const hits = [];
        for (const o of them) {
          if (r.hits.has(o.id) || Math.hypot(o.at[0] - s.at[0], o.at[2] - s.at[2]) > r.reach) continue;
          r.hits.add(o.id);
          const dir = dirTo(s, o);
          hits.push({ id: o.id, damage: dmgFor(r.damage, o), dir });
          if (r.knock) shove(o, dir, r.knock, now);
          if (r.one) r.until = now;
        }
        if (hits.length) out.push(blast(s, hits, 'rush'));
      }
    }
  }
  if (H2.thrown) {
    const t = H2.thrown;
    const k = Math.min(1, (now - t.t0) / (t.until - t.t0));
    // (out and back: a raised cosine of the throw's range)
    const d = (t.range * (1 - Math.cos(k * Math.PI * 2))) / 2;
    const from = k > 0.5 ? chestOf(s) : t.from;
    t.at = [from[0] + t.dir[0] * d, from[1], from[2] + t.dir[1] * d];
    if (sim.nav && k <= 0.5 && !lineClear(sim.nav, t.from, t.at)) t.t0 = now - (t.until - t.t0) * (1 - k);
    const hits = [];
    for (const o of them) {
      if (t.hits.has(o.id) || Math.hypot(o.at[0] - t.at[0], o.at[2] - t.at[2]) > t.reach) continue;
      t.hits.add(o.id);
      hits.push({ id: o.id, damage: dmgFor(t.damage, o), dir: dirTo(s, o) });
    }
    if (hits.length) out.push({ ...blast(s, hits, 'saberThrow'), part: 'saber' });
    if (k >= 1) H2.thrown = null;
  }
  if (H2.rage) {
    const r = H2.rage;
    if (now >= r.until) H2.rage = null;
    else if (r.damage && r.reach && now >= r.next) {
      r.next = now + 0.5;
      const hits = them.filter((o) => Math.hypot(o.at[0] - s.at[0], o.at[2] - s.at[2]) <= r.reach + 0.3).map((o) => ({ id: o.id, damage: dmgFor(r.damage, o), dir: dirTo(s, o) }));
      if (hits.length) out.push({ ...blast(s, hits, 'rage'), part: 'saber' });
    }
  }
  if (H2.aura) {
    const a = H2.aura;
    if (now >= a.until) H2.aura = null;
    else if (now >= a.next) {
      a.next = now + H.aura.tick;
      const hits = them.filter((o) => Math.hypot(o.at[0] - s.at[0], o.at[2] - s.at[2]) <= a.range).map((o) => ({ id: o.id, damage: a.damage, dir: dirTo(s, o) }));
      if (hits.length) out.push(blast(s, hits, 'aura'));
    }
  }
  if (H2.barrage) {
    const b = H2.barrage;
    while (b.left > 0 && now >= b.next) {
      b.left--;
      b.next += b.every;
      const aim = b.aim ?? [s.at[0] + Math.sin(s.yaw) * 20, s.at[1], s.at[2] + Math.cos(s.yaw) * 20];
      const spread = H.barrage.spread;
      const keep = s.aim;
      s.aim = [aim[0] + (sim.rand() - 0.5) * 2 * spread, aim[1], aim[2] + (sim.rand() - 0.5) * 2 * spread];
      lob(sim, s, ROUNDS.barrage, now, { speed: H.rocket.speed });
      s.aim = keep;
    }
    if (b.left <= 0) H2.barrage = null;
  }
  if (H2.mines?.length) {
    const keep = [];
    for (const m of H2.mines) {
      if (m.until <= now) continue;
      const trip = them.some((o) => Math.hypot(o.at[0] - m.at[0], o.at[2] - m.at[2]) <= H.mine.trigger);
      if (!trip) {
        keep.push(m);
        continue;
      }
      sim.kit.blasts.push({ by: s.id, team: s.team, at: [m.at[0], m.at[1] + 0.2, m.at[2]], row: { id: 'mine', inner: 1, damage: H.mine.damage, radius: H.mine.radius, multiplier: 1 }, multiplier: 1 });
      sim.out?.push({ t: now, type: 'explosion', by: s.id, kind: 'mine', at: m.at.slice(), radius: H.mine.radius });
    }
    H2.mines = keep;
  }
  if (H2.dome && now >= H2.dome.until) H2.dome = null;
  if (H2.gunUntil != null && now >= H2.gunUntil) restoreGun(s);
  return out;
}
