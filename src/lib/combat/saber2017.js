// The lightsaber as the 2017 game has it, pure: the rules are its records
// (src/data/bf2017/saber.json, from scripts/lib/bf2017-rulebook-saber.mjs), and
// this runs them. One engine for you and every duellist: galaxy/surface/
// saber.js draws what it decides, duellists.js drives one per bot.
//
// The hit is the game's target query, not the blade: inside a strike's
// contact window (its stroke table's, standing for the state machine's
// physical-attack channel) a target is struck when it stands within the
// query's 3 m sphere round a point 1.5 m behind the striker, farther than
// 1.5 m from that point and within 35° of the facing from it, and inside the
// 45° gate looking back from 5 m ahead of it (strikeZone). Each once a strike.
// One facing within 70° of the striker's is struck from behind. A target
// holding its block (deflecting) is met on the block unless struck from
// behind: no damage, its stamina drains by the blocked strike's cost and it
// takes BlockedLightSaber; the striker's stroke stops and it recoils as long.
// Otherwise the damage (the hero's InitialDamage, the _FromBehind affector's on
// top from behind) lands DelayInitialDamageTime after (0.09 s). Two strikes
// that reach each other in the same step clash: neither lands, both recoil.
//
// The block is the deflect's shield: while held (and stamina lasts) a bolt
// whose flown segment enters its shell, in front, is turned back at its
// shooter and drains the bolt's cost (its damage over the standard bullet's).
// Stamina: 0…max, drained by your own strike as its window opens, a blocked
// strike, a turned bolt; refilled at `regen` a second once `delay` seconds
// have passed since the last drain; under `out` (1) the block drops, the
// lunge's reach falls to its tired radius, and the block breaks (a stagger,
// `hand`). The dodge is Ability_Evade's: a bar of `charges` at `cost` each,
// refilled over `recharge` s, `active` s long; damage while it's on is × the
// evading multiplier.
//
//   SABER_HEROES                the heroes the rulebook has (no sequel heroes)
//   saberOf(hero)               → the rules: { hero, query, stagger, evading, hand, ai, damage, react, shield, stamina, evade,
//                                 camera } (a hero the game has no saber for: Luke's, `hand`)
//   strikeZone(q, me, t)        → { in, behind }: me { x, z, yaw, y? }, t { x, z, yaw?, y? } (facing (sin yaw, cos yaw))
//   lungePick(q, me, targets, { tired, aim }) → the target the strike turns to, or null
//   shieldHit(rules, me, a, b)  → { t, at } | null: the bolt segment a→b into the shield's shell, coming from the front
//   createSaberSim(rules, { id, seed }) → sim:
//     strike(now, { contact, dur }) → bool (not while recoiling or staggered)
//     block(on, now) → whether the block is up
//     dash(now) → bool (a charge spent)
//     step(dt, now, { me, targets: [{ id, x, z, yaw, deflecting?, sim?, dead? }], aim? }) → events:
//       { type: 'hit', id, damage, behind, at } (at: the time the damage lands, now or later)
//       | { type: 'blocked', id } (your strike met their block) | { type: 'clash', id } | { type: 'broken' } (your block)
//       | { type: 'drained', by, amount }
//     blockedStrike(now) → whether it held (your stamina drained by a blocked strike)
//     takeBolt(damage, now) → whether it held
//     taken(damage, now) → the damage that lands on you (evading: ×)
//     recoil(now, secs?), stagger(now, secs)
//     state: { stamina, blocking, out, dashBar, evadingUntil, recoilUntil, staggerUntil, striking, lunge }
//     scale: { blocked, recharge } (1 each: the hero's perks bend a blocked strike's cost and the dash's recharge)
//     view(now) → { stamina (0…1), out, dashes (whole charges), dashBar (0…1), blocking, evading }

import BOOK from '../../data/bf2017/saber.json';

export const SABER_HEROES = Object.keys(BOOK.heroes);
const RAD = Math.PI / 180;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// the angle between direction (dx, dz) and facing yaw, radians
const off = (dx, dz, yaw) => Math.abs(wrap(Math.atan2(dx, dz) - yaw));

export function saberOf(hero) {
  const own = BOOK.heroes[hero];
  const row = own ?? BOOK.heroes.luke;
  return { hero: own ? hero : 'luke', standIn: !own, query: BOOK.query, stagger: BOOK.stagger, evading: BOOK.evading, hand: BOOK.hand, ai: BOOK.ai, ...row };
}

export function strikeZone(q, me, t) {
  const fx = Math.sin(me.yaw);
  const fz = Math.cos(me.yaw);
  const ax = me.x + fx * q.anchor;
  const az = me.z + fz * q.anchor;
  const dx = t.x - ax;
  const dz = t.z - az;
  const dy = t.y != null && me.y != null ? t.y - me.y : 0; // (height only where both are known)
  const d = Math.hypot(dx, dy, dz);
  const h = q.hit;
  let inside = d <= h.radius && d >= h.near && off(dx, dz, me.yaw) <= h.cone * RAD;
  if (inside) {
    // (the gate: from a point `apex` ahead of the anchor, looking back)
    const gx = t.x - (ax + fx * h.apex);
    const gz = t.z - (az + fz * h.apex);
    inside = Math.hypot(gx, gz) < 1e-6 || off(gx, gz, me.yaw + Math.PI) <= h.gate * RAD;
  }
  const behind = t.yaw != null && Math.abs(wrap(t.yaw - me.yaw)) <= h.behind * RAD;
  return { in: inside, behind };
}

export function lungePick(q, me, targets, { tired = false, aim = null } = {}) {
  const l = q.lunge;
  const yaw = aim ?? me.yaw;
  const r = tired ? l.tired : l.radius;
  let best = null;
  let score = Infinity;
  for (const t of targets) {
    if (t.dead) continue;
    const dx = t.x - me.x;
    const dz = t.z - me.z;
    const d = Math.hypot(dx, dz);
    const a = off(dx, dz, yaw);
    if (d > r || (d < l.near && a <= l.nearCone * RAD) || a > l.pick * RAD) continue;
    const gx = t.x - (me.x + Math.sin(yaw) * l.apex);
    const gz = t.z - (me.z + Math.cos(yaw) * l.apex);
    if (off(gx, gz, yaw + Math.PI) > l.gate * RAD) continue;
    const s = d * l.weights.distance + (a / RAD) * l.weights.angle;
    if (s < score) [best, score] = [t, s];
  }
  return best;
}

// the shield's shell (its part box, `offset` ahead) in the hero's frame: a
// segment through it, the slabs' way, coming at the hero's front
export function shieldHit(rules, me, a, b) {
  const sh = rules.shield;
  const box = sh.box ?? { min: [-sh.radius, 0, -sh.radius], max: [sh.radius, 2 * sh.radius, sh.radius] };
  const fx = Math.sin(me.yaw);
  const fz = Math.cos(me.yaw);
  // (into the hero's frame: x its left, y up, z ahead, the shield's origin `offset` ahead)
  const local = (p) => {
    const dx = p[0] - me.x;
    const dz = p[2] - me.z;
    return [dx * fz - dz * fx, p[1] - (me.y ?? 0), dx * fx + dz * fz - sh.offset];
  };
  const p = local(a);
  const q = local(b);
  const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
  if (d[2] >= 0) return null; // (going away from the front: from behind, or past)
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (p[i] < box.min[i] || p[i] > box.max[i]) return null;
      continue;
    }
    let u = (box.min[i] - p[i]) / d[i];
    let v = (box.max[i] - p[i]) / d[i];
    if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u);
    t1 = Math.min(t1, v);
    if (t0 > t1) return null;
  }
  return { t: t0, at: [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0, a[2] + (b[2] - a[2]) * t0] };
}

export function createSaberSim(rules, { id = null } = {}) {
  const S = rules.stamina;
  const E = rules.evade;
  const st = {
    stamina: S.max,
    drainedAt: -Infinity,
    out: false,
    blocking: false,
    dashBar: 1,
    evadingUntil: -Infinity,
    recoilUntil: -Infinity,
    staggerUntil: -Infinity,
    striking: null, // { t0, contact: [c0, c1], dur, hits: Set, drained }
    lunge: null,
  };
  const pending = []; // damage waiting its delay: { at, event }
  const busy = (now) => now < st.recoilUntil || now < st.staggerUntil;
  const drain = (amount, now, events = null, by = null) => {
    if (!(amount > 0)) return;
    st.stamina = Math.max(0, st.stamina - amount);
    st.drainedAt = now;
    events?.push({ type: 'drained', by, amount });
    if (st.stamina < S.out && !st.out) {
      st.out = true;
      if (st.blocking) {
        st.blocking = false;
        st.staggerUntil = Math.max(st.staggerUntil, now + rules.hand.broken);
        events?.push({ type: 'broken' });
        return false;
      }
    }
    return true;
  };
  const sim = {
    id,
    rules,
    state: st,
    strike(now, { contact = [0.2, 0.4], dur = 0.6 } = {}) {
      if (busy(now)) return false;
      st.striking = { t0: now, contact, dur, hits: new Set(), drained: false };
      return true;
    },
    block(on, now = 0) {
      st.blocking = Boolean(on) && !st.out && !busy(now) && !st.striking;
      return st.blocking;
    },
    dash(now) {
      if (st.dashBar + 1e-9 < E.cost || busy(now)) return false;
      st.dashBar -= E.cost;
      st.evadingUntil = now + E.active;
      st.striking = null;
      st.blocking = false;
      return true;
    },
    recoil(now, secs = rules.stagger.blocked) {
      st.striking = null;
      st.recoilUntil = Math.max(st.recoilUntil, now + secs);
    },
    stagger(now, secs) {
      st.striking = null;
      st.blocking = false;
      st.staggerUntil = Math.max(st.staggerUntil, now + secs);
    },
    // (the defender's side of a blocked strike: its stamina, the BlockedLightSaber state)
    scale: { blocked: 1, recharge: 1 },
    blockedStrike(now) {
      const held = drain(S.blocked * sim.scale.blocked, now);
      if (held !== false) st.recoilUntil = Math.max(st.recoilUntil, now + rules.stagger.blocked);
      return held !== false;
    },
    takeBolt(damage, now) {
      return drain((S.bolt * damage) / S.standardBolt, now) !== false;
    },
    taken(damage, now) {
      return now < st.evadingUntil ? damage * rules.evading.taken : damage;
    },
    // whether the block is up for a cut from the front or a bolt
    get deflecting() {
      return st.blocking && !st.out;
    },
    step(dt, now, { me, targets = [], aim = null } = {}) {
      const events = [];
      // the stamina: refilled once its delay's passed since the last drain; back from out over its threshold
      if (now - st.drainedAt >= S.delay && st.stamina < S.max) st.stamina = Math.min(S.max, st.stamina + S.regen * dt);
      if (st.out && st.stamina > S.out) st.out = false;
      if (st.out) st.blocking = false;
      // the dash bar: refilled over its recharge, not while it's on
      if (now >= st.evadingUntil) st.dashBar = Math.min(1, st.dashBar + dt / (E.recharge * sim.scale.recharge));
      // damage whose delay has run
      for (let i = pending.length - 1; i >= 0; i--)
        if (pending[i].at <= now) {
          events.push(pending[i].event);
          pending.splice(i, 1);
        }
      const s = st.striking;
      if (s && me) {
        const t = now - s.t0;
        if (t >= s.dur) st.striking = null;
        else if (t >= s.contact[0] && t <= s.contact[1]) {
          // (your own strike's cost, as its window opens: the state machine's Melee_ExecuteKill)
          if (!s.drained) {
            s.drained = true;
            drain(S.strike, now, events, 'strike');
          }
          for (const x of targets) {
            if (x.dead || s.hits.has(x.id) || !st.striking) continue;
            const z = strikeZone(rules.query, me, x);
            if (!z.in) continue;
            s.hits.add(x.id);
            // a clash: theirs reaching you in the same window
            const theirs = x.sim?.state.striking;
            const tt = theirs ? now - theirs.t0 : -1;
            if (theirs && tt >= theirs.contact[0] && tt <= theirs.contact[1] && strikeZone(x.sim.rules.query, x, me).in) {
              sim.recoil(now);
              x.sim.recoil(now);
              events.push({ type: 'clash', id: x.id });
              break;
            }
            const deflecting = x.sim ? x.sim.deflecting : Boolean(x.deflecting);
            if (deflecting && !z.behind) {
              x.sim?.blockedStrike(now);
              sim.recoil(now);
              events.push({ type: 'blocked', id: x.id });
              break;
            }
            const d = rules.damage;
            const damage = d.hit.damage + (z.behind && !deflecting && d.behind ? d.behind.damage : 0);
            const at = now + (d.hit.delay ?? 0);
            const event = { type: 'hit', id: x.id, damage, behind: z.behind, at };
            if (at <= now) events.push(event);
            else pending.push({ at, event });
          }
        }
      }
      st.lunge = s && st.striking ? (lungePick(rules.query, me ?? { x: 0, z: 0, yaw: 0 }, targets, { tired: st.out, aim }) ?? null) : null;
      return events;
    },
    view(now) {
      return {
        stamina: st.stamina / S.max,
        out: st.out,
        dashBar: st.dashBar,
        dashes: Math.floor((st.dashBar + 1e-9) / E.cost),
        blocking: st.blocking,
        evading: now < st.evadingUntil,
      };
    },
  };
  return sim;
}
