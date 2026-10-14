// What a battle's bolts and your shots meet, and what that does (battle.js
// fights the battle; these are its hits). A ship is met on its hull where it
// has one (lib/combat/hulls.js's segmentHit, at the pose it is drawn at:
// lib/combat/pose.js, a capital's ride at anchor in it), the sphere round
// that hull kept in front of it, and as today's sphere where it hasn't (its
// hull not loaded yet, or a kind with none). What a hit does is the game's
// where the game has the ship's record (lib/combat/damage.js on
// src/data/bf2017/damage.json), the war's own numbers where it hasn't. Pure
// (no three.js), tested in Node through battle.js.
//
// The game's rules, as damage.js runs them:
// - a fighter (and a turret, a vehicle too) loses vehicleDamage: the
//   shooter's bolt at its range, on the fighter's own property;
// - a capital's hull part goes where capitalPart says: a war subsystem's
//   record (`site`), opened when the war makes it the objective (openSite)
//   and spent by partHit on the record's property, the hit falling to the
//   part's own turret or row where the record's state names another part; a
//   turret the part stands for; the part's own row; or, named by none, the
//   ship's hull: its own record (`site.hull`), whose last state at 0 sinks
//   it (a ship the war tracks by its hull: not the one with the defender's
//   objectives, which falls by them). A part named for a war subsystem the
//   game has no record of (a stand-in's hull, made of the war's parts) is
//   that subsystem, on the war's numbers.
// - Once a subsystem or a ship is down, hits on it go nowhere (nothing
//   falls to a part's own row then).
// The Star Destroyer's two shield domes are one module: the generator a
// dome is is the one whose marker it stands nearest. A part's state is kept
// for each place its module is put (the hull's parts name a module's parts
// again for each), a turret's for its part. A subsystem a hull part stands
// for is locked on to, and flown at, where its parts are (the war's marker
// where none does).
//
// A shot as these take it: { bolt (the game's bolt, damage.json's, or null:
// a ship or a torpedo the game has no record of), metres (how far it has
// flown, for the falloff), punch (how many of the shooter's bolts it is
// worth: your guns' 1, a power's more), war (its damage in the war's own
// numbers, for a ship of the war's), kind (the war's bolt kind), name (the
// hull part met, for partHit) }.
//
//   armCapital(cap) / armRunner(r): a ship's records laid on it
//   openPhase(cap, phase): the objectives of a phase the war has begun, opened
//   createHits(k, { hulls, reduced }) → { sync(), fighter(f, p0, p1, at0, at1, r) → t | null,
//     runner(...) → t | null, capital(p0, p1, team) → hit | null, met: { part, property },
//     fighterLoss(f, shot), batteryLoss(tu, shot) → what it takes, runnerHit(r, shot) → what it took,
//     spent(record, name, shot) → what it took, strike(h, shot, mine, out) → what it did }

import { capitalPart, capitalSite, kindDamage, openSite, partHit, partsHealth, spend, takes, vehicleDamage } from '../../lib/combat/damage';
import { segmentHit } from '../../lib/combat/hulls';
import { capitalPose, fighterPose, newPose, runnerPose } from '../../lib/combat/pose';
import { sweptHit } from './targeting';
import { SUBSYSTEMS } from './wars';
import { BATTLE, capitalGuns, copy, dist2, set, v3 } from './battleKit';

// a record's last state, spent to 0: down
export const isDown = (state) => state.stage >= state.floors.length && state.hp <= 0;
const record = (row) => ({ row, state: partsHealth(row.health) });

// ── the records on a ship ──
// A capital: its hull's record (the kind's `site.hull`, through its
// stand-in), each objective's (`site[id]`), and its batteries', each hit as
// the turret firing its turbolaser (battleKit.js's capitalGuns); where the
// game has none, the war's own hit points stay
export function armCapital(cap) {
  const row = kindDamage(cap.kind);
  cap.row = row?.site ? row : null;
  cap.chains = new Map(); // (the records hit on it that are none of these: a part's own, a turret on its hull, an escort's objectives)
  const hull = cap.row?.site.hull;
  cap.hullRec = hull?.health ? record(hull) : null;
  if (cap.hullRec) cap.hull = cap.hullMax = cap.hullRec.state.hp;
  cap.guns = capitalGuns(cap.kind);
  for (const tu of cap.turrets) {
    tu.row = cap.guns?.battery ?? null;
    if (tu.row) tu.hp = tu.hpMax = tu.row.hp;
  }
  for (const s of cap.subs) {
    const site = capitalSite(cap.kind, s.id);
    s.row = site?.health ? site : null;
    if (!s.row) continue;
    s.state = partsHealth(s.row.health);
    s.hp = s.state.hp;
    s.hpMax = s.row.health[0];
  }
}
// The war makes the objectives of a phase its objectives: each one's record opened (damage.js's openSite)
export function openPhase(cap, phase) {
  for (const s of cap?.subs ?? []) {
    if (s.phase !== phase || !s.row || !s.alive) continue;
    s.state = openSite(s.row, s.state);
    s.hp = s.state.hp;
  }
}
// A runner: its kind's hull record (a GR-75 the CR90's, through its
// stand-in), where the game has one; the hit points it was given, where not
export function armRunner(r) {
  const hull = kindDamage(r.kind)?.site?.hull;
  if (!hull?.health) return;
  r.rec = record(hull);
  r.hp = r.hpMax = r.rec.state.hp;
  if (r.tgt) Object.assign(r.tgt, { hp: r.hp, hpMax: r.hpMax });
}

// ── a hull's parts, for the war ──
// each part: its name, where capitalPart sends a hit on it, the war's
// subsystem it is (`key`: a site entry's, the generator nearest the dome,
// or one a stand-in's part is named for) and its module's place (`inst`);
// and each part's middle, in the hull's frame
const IDS = new Set(Object.values(SUBSYSTEMS).flatMap((list) => list.map((s) => s.id)));
const TABLES = new WeakMap();
function tableOf(hull, kind) {
  const known = TABLES.get(hull);
  if (known?.kind === kind) return known;
  const n = hull.parts.length;
  const sum = new Float64Array(n * 4);
  const { tris, part, count } = hull.rays;
  for (let i = 0; i < count; i++) {
    const p = part[i];
    for (let c = 0; c < 9; c++) sum[p * 4 + (c % 3)] += tris[i * 9 + c];
    sum[p * 4 + 3] += 3;
  }
  const middle = (list) => {
    const m = [0, 0, 0];
    let w = 0;
    for (const p of list) {
      for (let c = 0; c < 3; c++) m[c] += sum[p * 4 + c];
      w += sum[p * 4 + 3];
    }
    return w ? m.map((v) => v / w) : null;
  };
  // (a module's parts come in order, #0 up: a part numbered no higher than the last, or another module's, is the next place it's put)
  const inst = new Int32Array(n);
  let at = -1;
  hull.parts.forEach((p, i) => {
    const [slug, num = '0'] = p.name.split('#');
    const [last, lastNum = '0'] = i ? hull.parts[i - 1].name.split('#') : [];
    if (!i || slug !== last || Number(num) <= Number(lastNum)) at = i;
    inst[i] = at;
  });
  const markers = Object.fromEntries((SUBSYSTEMS[kind] ?? []).map((s) => [s.id, s.at]));
  const parts = hull.parts.map((p, i) => {
    const where = capitalPart(kind, p.name);
    let key = null;
    if (where?.kind === 'site') {
      key = where.key;
      // (one module standing for more than one: the one whose marker its place is nearest)
      if (where.keys.length > 1) {
        const mid = middle(hull.parts.flatMap((_, j) => (inst[j] === inst[i] ? [j] : [])));
        let best = Infinity;
        for (const id of where.keys) {
          const m = markers[id];
          const d = m && mid ? (m[0] - mid[0]) ** 2 + (m[1] - mid[1]) ** 2 + (m[2] - mid[2]) ** 2 : Infinity;
          if (d < best) [best, key] = [d, id];
        }
      }
    } else if (!where && IDS.has(p.name)) key = p.name;
    return { index: i, name: p.name, property: p.property, where, key, inst: inst[i] };
  });
  // each war subsystem's parts on it, and their middle
  const subs = new Map();
  parts.forEach((p, i) => p.key && p.key !== 'hull' && subs.set(p.key, [...(subs.get(p.key) ?? []), i]));
  const table = { kind, parts, middles: new Map([...subs].map(([id, list]) => [id, middle(list)])) };
  TABLES.set(hull, table);
  return table;
}

// a point of a ship's own frame (shares of its length) in the battle, as battleCapitals.js's place
const placeAt = (cap, l, o) => set(o, cap.pos.x + (cap.right.x * l[0] + cap.up.x * l[1] + cap.fwd.x * l[2]) * cap.size, cap.pos.y + (cap.right.y * l[0] + cap.up.y * l[1] + cap.fwd.y * l[2]) * cap.size, cap.pos.z + (cap.right.z * l[0] + cap.up.z * l[1] + cap.fwd.z * l[2]) * cap.size);

// a bolt the game has, worth `punch` of it (a copy, for anything but 1)
const SCALED = new WeakMap();
function worth(bolt, punch) {
  if (!bolt || punch === 1) return bolt;
  let by = SCALED.get(bolt);
  if (!by) SCALED.set(bolt, (by = new Map()));
  if (!by.has(punch)) by.set(punch, { ...bolt, damage: bolt.damage * punch, damageFar: bolt.damageFar * punch, blast: undefined });
  return by.get(punch);
}

export function createHits(k, { hulls = null, reduced = false } = {}) {
  const { b } = k;
  const hullOf = (kind) => hulls?.get?.(kind) ?? null;
  const pose = newPose();
  const A = [0, 0, 0];
  const B = [0, 0, 0];
  const mid = v3();
  const met = { part: null, property: null, index: -1, point: null }; // (the hull part the last hull query met)
  const tmp = v3();

  // a ship of the war's that a hull part stands for: its subsystems where
  // its parts are (once, when its hull is first here)
  const wear = (cap, hull) => {
    cap.worn = hull;
    const table = tableOf(hull, cap.kind);
    for (const s of cap.subs) {
      const m = table.middles.get(s.id);
      s.onHull = Boolean(m);
      if (m) placeAt(cap, m, s.pos);
    }
  };
  const sync = () => {
    for (const cap of b.capitals) {
      const hull = hullOf(cap.kind);
      if (hull && cap.worn !== hull) wear(cap, hull);
    }
  };

  // the segment p0–p1 against a ship posed in `pose`, its hull in front of
  // it the sphere round it: the share along the segment, or null
  const meet = (hull, p0, p1) => {
    set(mid, pose.at1[0], pose.at1[1], pose.at1[2]);
    // (a moving ship's sphere swept with it, as it was over the step)
    set(tmp, pose.at0[0], pose.at0[1], pose.at0[2]);
    if (sweptHit(p0, p1, tmp, mid, hull.radius * pose.scale) === null) return null;
    set3(A, p0);
    set3(B, p1);
    const h = segmentHit(hull, pose, A, B);
    if (!h) return null;
    met.index = h.part;
    met.part = hull.parts[h.part]?.name ?? null;
    met.property = h.property;
    met.point = h.point;
    return h.t;
  };
  const sphere = (t) => {
    met.index = -1;
    met.part = null;
    met.property = null;
    met.point = null;
    return t;
  };

  // a fighter, or a runner, from at0 to at1 over the step (`r`: its sphere, where it has no hull)
  const fighter = (f, p0, p1, at0, at1, r) => {
    const hull = hullOf(f.kind);
    if (!hull) return sphere(sweptHit(p0, p1, at0, at1, r));
    fighterPose(f, 0, pose);
    set3(pose.at0, at0);
    set3(pose.at1, at1);
    return meet(hull, p0, p1);
  };
  const runner = (o, p0, p1, at0, at1, r) => {
    const hull = hullOf(o.kind);
    if (!hull) return sphere(sweptHit(p0, p1, at0, at1, r));
    runnerPose(o, pose);
    set3(pose.at0, at0);
    set3(pose.at1, at1);
    return meet(hull, p0, p1);
  };

  // the first of the other side's capital ships (its objectives, then its
  // hull) a segment from p0 to p1 meets: { cap, sub, k, at, part, property,
  // route } or null (`route`: the hull part's, null for a sphere)
  // (the nearest so far, kept in `near`: a hit allocates only what it returns)
  const near = { cap: null, sub: null, k: Infinity, part: null, property: null, route: null, point: null };
  const take = (cap, sub, t, route) => {
    if (t >= near.k) return;
    near.cap = cap;
    near.sub = sub;
    near.k = t;
    near.part = met.part;
    near.property = met.property;
    near.route = route;
    near.point = met.point;
  };
  const capital = (p0, p1, team) => {
    near.cap = null;
    near.k = Infinity;
    for (const cap of b.capitals) {
      if (cap.team === team || !cap.alive) continue;
      if (dist2(cap.pos, p1) > (cap.reach + 30) ** 2 && dist2(cap.pos, p0) > (cap.reach + 30) ** 2) continue;
      const hull = hullOf(cap.kind);
      if (hull) {
        if (cap.worn !== hull) wear(cap, hull);
        capitalPose(cap, b.clock, reduced, pose);
        const t = meet(hull, p0, p1);
        if (t !== null) {
          const route = tableOf(hull, cap.kind).parts[met.index];
          let sub = null;
          if (route.key) for (const s of cap.subs) if (s.id === route.key && !s.hidden) sub = s;
          take(cap, sub, t, route);
        }
      }
      // (the subsystems no hull part stands for, and every one with no hull: their spheres)
      for (const s of cap.subs) {
        if (!s.alive || s.hidden || (hull && s.onHull)) continue;
        const t = sweptHit(p0, p1, s.pos, s.pos, s.r);
        if (t !== null) take(cap, s, sphere(t), null);
      }
      if (hull) continue;
      for (const sp of cap.spheres) {
        const t = sweptHit(p0, p1, sp.c, sp.c, sp.r);
        if (t !== null) take(cap, null, sphere(t), null);
      }
    }
    if (!near.cap) return null;
    const { k: t, point } = near;
    const at = point ? v3(point[0], point[1], point[2]) : v3(p0.x + (p1.x - p0.x) * t, p0.y + (p1.y - p0.y) * t, p0.z + (p1.z - p0.z) * t);
    return { cap: near.cap, sub: near.sub, k: t, at, part: near.part, property: near.property, route: near.route };
  };

  // ── what a hit does ──
  // a vehicle (a fighter, a battery, a turret on a hull): the game's on its record, the war's on its own
  const vehicle = (row, shot) => (row ? (shot.bolt ? vehicleDamage(row, worth(shot.bolt, shot.punch), shot.metres) : 0) : shot.war * shot.punch);
  const fighterRow = (kind) => {
    const row = kindDamage(kind);
    return row?.hp ? row : null;
  };
  const fighterLoss = (f, shot) => vehicle(fighterRow(f.kind), shot);
  const batteryLoss = (tu, shot) => vehicle(tu.row, shot);
  // a record spent by a hit on the part `name`: what it took
  const spent = (rec, name, shot) => {
    const before = rec.state;
    if (isDown(before) || !shot.bolt) return 0;
    rec.state = partHit(rec.row, before, name, worth(shot.bolt, shot.punch), shot.metres);
    return before.hp - rec.state.hp;
  };
  // a runner the game has a record of: that record's spent (its hull), its hp
  // what's left of it, 0 once it's down; one it hasn't, the war's numbers
  const runnerHit = (r, shot) => {
    if (!r.rec) {
      const d = shot.war * shot.punch;
      r.hp -= d;
      return d;
    }
    const d = spent(r.rec, null, shot);
    r.hp = isDown(r.rec.state) ? 0 : r.rec.state.hp;
    return d;
  };

  // A capital's hull hit: what it did, in `R` ({ what: 'sub' | 'shield' |
  // 'hull' | 'turret' | 'part', damage, down, sub, turret }). `k.subHit(s,
  // shot, mine, out)` is the battle's (its phases, the director's punch);
  // `k.shielded(cap)` whether its shield holds; `k.hullHit(cap, dmg, out,
  // spare)` the war's own numbers on a hull.
  const R = { what: null, damage: 0, down: false, sub: null, turret: null };
  const result = (what, damage = 0, down = false) => {
    R.what = what;
    R.damage = damage;
    R.down = down;
    R.sub = null;
    R.turret = null;
    return R;
  };
  const strike = (h, shot, mine, out) => {
    const { cap, sub, route } = h;
    const where = route?.where ?? null;
    shot.name = where?.name ?? null;
    if (sub && sub.alive && k.subHit(sub, shot, mine, out)) {
      result('sub', shot.dealt ?? 0, !sub.alive);
      R.sub = sub;
      return R;
    }
    if (k.shielded(cap)) return result('shield');
    if (sub || cap.dying > 0) return result('hull'); // (a subsystem out of its phase, or down: nothing; a ship going: nothing more)
    // the hull: a part no record names, a sphere, or the hull's own record
    let at = where;
    let rec = null;
    if (where?.kind === 'site' && route.key !== 'hull') {
      // (a war subsystem's record on a ship the war hasn't made its objective: kept, and spent)
      const key = `site:${route.key}`;
      if (!cap.chains.has(key)) cap.chains.set(key, record(where.row));
      rec = cap.chains.get(key);
    } else if (!where || route.key === 'hull') rec = cap.hullRec;
    if (rec) {
      if (isDown(rec.state)) return result('hull');
      if (!takes(rec.row, rec.state, shot.name)) at = where?.fallback ?? null;
      else if (rec === cap.hullRec) return hullStrike(cap, shot, out, mine);
      else return result('part', spent(rec, shot.name, shot));
    }
    if (!at) {
      // (no record of the ship's at all: the war's own hull)
      if (!cap.hullRec && !where) {
        const d = shot.war * shot.punch * (mine ? BATTLE.youShare * BATTLE.youHull : (BATTLE.hullShare[shot.kind] ?? 0));
        k.hullHit(cap, d, out, !mine && !k.decides);
        return result('hull', d, cap.dying > 0);
      }
      return result('hull');
    }
    if (at.kind === 'turret') {
      const key = `turret:${route?.index ?? 0}`;
      let tu = cap.chains.get(key);
      if (!tu) cap.chains.set(key, (tu = { num: k.newId(), row: at.row, hp: at.row.hp, alive: true }));
      if (!tu.alive) return result('turret');
      const d = vehicle(tu.row, shot);
      tu.hp -= d;
      result('turret', d, tu.hp <= 0);
      R.turret = tu;
      if (tu.hp <= 0) {
        tu.alive = false;
        out.push({ type: 'turret', id: tu.num, cap: cap.id, at: copy(v3(), h.at), mine });
      }
      return R;
    }
    // a part's own row, kept for each place its module is put
    const key = `part:${at.key}@${route?.inst ?? 0}`;
    if (!cap.chains.has(key)) cap.chains.set(key, record(at.row));
    const own = cap.chains.get(key);
    const before = own.state;
    const d = spent(own, at.name, shot);
    // (a state moved off this part breaks the parts nested under it: FLT_MAX each, damage.js's spend)
    if (own.state.stage !== before.stage && at.row.children && at.row.states[own.state.stage] !== at.name)
      for (const c of at.row.children) {
        const ck = `part:${c}@${route?.inst ?? 0}`;
        const child = kindDamage(cap.kind).parts[c];
        if (!child) continue;
        if (!cap.chains.has(ck)) cap.chains.set(ck, record(child));
        const cr = cap.chains.get(ck);
        cr.state = spend(cr.state, Infinity);
      }
    return result('part', d);
  };
  // the ship's own record (its hull): its last state at 0 sinks it; with
  // the galaxy's director deciding, the AI's fire wears it down but never sinks it
  const hullStrike = (cap, shot, out, mine) => {
    if (!cap.tracked) return result('hull');
    const rec = cap.hullRec;
    const before = rec.state;
    const d = spent(rec, shot.name, shot);
    if (!mine && !k.decides && isDown(rec.state)) {
      rec.state = before;
      return result('hull');
    }
    if (rec.state !== before) cap.hull = rec.state.hp;
    if (isDown(rec.state)) {
      cap.hull = 0;
      cap.dying = cap.role === 'flagship' ? BATTLE.dying : 2.5;
      out.push({ type: 'impact', at: copy(v3(), cap.pos), size: cap.size * 0.3, shield: false });
    }
    return result('hull', d, cap.dying > 0);
  };

  return { sync, fighter, runner, capital, met, fighterLoss, batteryLoss, runnerHit, strike, spent };
}

const set3 = (o, p) => {
  if (Array.isArray(p)) {
    o[0] = p[0];
    o[1] = p[1];
    o[2] = p[2];
  } else {
    o[0] = p.x;
    o[1] = p.y;
    o[2] = p.z;
  }
  return o;
};
