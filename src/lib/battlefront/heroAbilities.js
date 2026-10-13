// What a saber hero's three abilities do once they go off (and the two a
// blaster hero shares with them, its dash and its slam: heroBlaster.js has
// the rest of the blaster heroes'), by
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
//   stepEffects(sim, s, now) → requests          (what goes on: a choke, a rush, a thrown saber, the rage's cuts, an aura)
//   dmgFor(damage, target) → the record's damage for that target (a hero's or a trooper's)
//   inReach(s, o, { range, cone, yaw }) → bool   enemiesOf(sim, s) → the living enemy soldiers

import KIT from '../../data/bf2017/heroKit.json';
import { apply } from './affectors.js';
import { heightAt, lineClear, walkable } from './nav.js';
import { chestOf, eyeOf } from './soldier.js';

const H = KIT.hand;
const DEG = Math.PI / 180;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export const KINDS = ['push', 'repulse', 'pull', 'slam', 'choke', 'rush', 'dash', 'saberThrow', 'rage', 'mindTrick', 'strike', 'electrocute', 'weaken', 'chainLightning', 'aura', 'barrier', 'absorb'];

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
export function aimPitch(s) {
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

// the damage taken while an ability winds up and lasts (its record's `taken`: Luke's rush, Obi-Wan's push, Anakin's
// slam; a star card that is a rank of that affector gives its own in its place: cards.js)
export const takenOf = (s, a) => s.cards?.taken?.[a.row.id] ?? a.row.hero?.taken ?? null;
// (the kinds that carry the hero on after the ability's own times: the damage taken lasts the carry too)
const CARRIED = ['rush', 'dash', 'slam'];
export function startAbility(sim, s, a, now) {
  const fx = a.row.hero ?? {};
  s.hero.act = { kind: fx.kind ?? null, slot: a.slot, id: a.row.id, since: now };
  const taken = takenOf(s, a);
  if (taken != null && fx.kind !== 'weaken' && fx.kind !== 'scan') apply(s.stack, { id: `${a.row.id}:taken`, property: 'ArmorMultiplier', op: 'mul', value: taken, until: now + (a.row.activation ?? 0) + Math.max(a.row.active ?? 0, CARRIED.includes(fx.kind) ? H.rush.seconds : 0) });
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
        H2.rush = { dir: [Math.sin(yaw), Math.cos(yaw)], speed: fx.hand.leap / H.rush.seconds, until: now + H.rush.seconds, reach: 0, damage: 0, hits: new Set(), then: { range: fx.radius, damage: fx.damage, knock: fx.knock ?? 3 } };
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
    case 'dash': {
      // (a blaster hero's dash, Han Solo's Shoulder Charge, stops at the first it meets and knocks it back)
      const secs = active > 0 ? active : H.rush.seconds;
      // (toward the nearest in a 40° cone within 10 m, the lunge's pick; else along the aim)
      const mark = them.filter((o) => inReach(sim, s, o, { range: 10, cone: 40, yaw })).sort((p, q) => Math.hypot(p.at[0] - s.at[0], p.at[2] - s.at[2]) - Math.hypot(q.at[0] - s.at[0], q.at[2] - s.at[2]))[0];
      const dir = mark ? dirTo(s, mark) : [Math.sin(yaw), 0, Math.cos(yaw)];
      s.yaw = Math.atan2(dir[0], dir[2]);
      H2.rush = { dir: [dir[0], dir[2]], speed: H.rush.speed, until: now + secs, reach: (fx.reach ?? 1.5) + 0.3, damage: fx.damage, knock: fx.kind === 'dash' ? (fx.knock ?? 3) : 0, hits: new Set(), mark: mark?.id ?? null, one: fx.kind === 'dash' };
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
    case 'barrier': {
      // (Yoda's Presence: overhealth for him and the friends in its reach)
      const secs = Math.max(active, 0) > 1 ? active : H.barrier.seconds;
      const shield = fx.shield ?? 150;
      const range = fx.range ?? 0;
      for (const o of sim.entities.values()) {
        if (o.kind !== 'soldier' || !o.alive || o.team !== s.team) continue;
        if (o !== s && Math.hypot(o.at[0] - s.at[0], o.at[2] - s.at[2]) > range) continue;
        o.over = { hp: shield, max: shield, since: now, drainAfter: secs, step: 0, every: 1e9, next: now + secs, drainStep: shield / 50, drainEvery: 0.01 };
      }
      break;
    }
    default:
      break;
  }
  if (hits.length) out.push(blast(s, hits, fx.kind));
  return out;
}

// what goes on between steps: a choke's grip, a rush's run, a thrown saber, the rage's
// cuts, an aura
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
  return out;
}
