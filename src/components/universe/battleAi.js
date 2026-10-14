// A battle's fighters (battle.js fights the battle; this flies them): each
// side's put up in front of its own line, and each fighter flown a step at
// a time. Pure (no three.js), tested in Node through battle.js.
//
// - A fighter dogfights the nearest of the other side's (a pull toward one
//   going after a friend, and toward you); an interceptor goes after bombers
//   first; the other side's runners come before them all.
// - A bomber flies torpedo runs at the defender's objective ship (at the
//   objectives of the phase) or, for the defender, at the attacker's ships,
//   and at the other side's runners half the time there are any.
// - They lead their shots, break off a head-on pass, extend after an
//   overshoot, jink with someone on their tail, steer round the capital
//   ships' hulls and clear of what the battle keeps them out of (a planet,
//   a Death Star's shield), and turn back into the fight at its edge.
//
// Each takes the battle's inner context `k` (battle.js's createBattle makes
// it): { b, rand, C, A, S, lines, radius, avoid, attacker, newId(),
// flagOf(team), objOf(), youIn() }.
// muster(k, perSide, ace) puts both sides' fighters up (an ace flown as its
// own kind, named, with its own hull); spawn(k, f, first) puts one back up
// in front of its line; addWave(k, team, n, id) puts up a bomber wave, one
// life each; flyFighter(k, f, dt) flies one a step (one that's `frozen`, a
// droid whose control relay's gone, drifts on as it was, after nothing).

import { kindDamage } from '../../lib/combat/damage';
import { FIGHTERS, NAMES } from './wars';
import { BATTLE, UP, ZERO, copy, cross, dist2, dot, fighterShot, inSights, len, norm, pick, set, turnToward, v3 } from './battleKit';
import { TACTICS } from './battleTactics';

export function spawn(k, f, first) {
  const { A, S, C, lines, avoid, rand } = k;
  const dir = f.team === 0 ? 1 : -1;
  const home = k.flagOf(f.team);
  const lineX = C.x - A.x * lines * dir;
  const lineZ = C.z - A.z * lines * dir;
  // in front of its own line (launched, or out of hyperspace), further out to begin with
  const ahead = first ? 22 + rand() * 50 : 22 + rand() * 14;
  const across = (rand() - 0.5) * (first ? 90 : 60);
  set(f.pos, lineX + A.x * dir * ahead + S.x * across, (home?.pos.y ?? C.y) + (rand() - 0.5) * 24, lineZ + A.z * dir * ahead + S.z * across);
  // (never in among what it's to keep out of: out to its edge)
  for (const o of avoid) {
    set(f.away, f.pos.x - o.c.x, f.pos.y - o.c.y, f.pos.z - o.c.z);
    const d = len(f.away);
    if (d < o.r + 6) set(f.pos, o.c.x + (f.away.x / (d || 1)) * (o.r + 6), o.c.y + (f.away.y / (d || 1)) * (o.r + 6) + (d ? 0 : o.r + 6), o.c.z + (f.away.z / (d || 1)) * (o.r + 6));
  }
  copy(f.prev, f.pos);
  copy(f.seen, f.pos);
  norm(set(f.fwd, A.x * dir + (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.2, A.z * dir + (rand() - 0.5) * 0.4));
  f.speed = f.type.speed;
  set(f.vel, f.fwd.x * f.speed, f.fwd.y * f.speed, f.fwd.z * f.speed);
  f.hp = f.type.hp;
  f.alive = true;
  f.mode = f.role === 'bomber' ? 'run' : 'engage';
  f.modeT = 0;
  f.target = null;
  f.retarget = rand() * 0.4;
  f.cool = rand() * f.type.burst[1];
  f.shots = 0;
  f.bank = 0;
}

function makeFighter(k, team, chosen = null) {
  const kind = chosen ?? pick(k.b.teams[team].side.fighters, k.rand);
  const type = FIGHTERS[kind.kind];
  const f = { id: k.newId(), team, kind: kind.kind, role: kind.role, type, size: type.size, pos: v3(), prev: v3(), seen: v3(), vel: v3(), fwd: v3(0, 0, 1), speed: 0, hp: 0, alive: false, mode: 'engage', modeT: 0, target: null, retarget: 0, cool: 0, shots: 0, bank: 0, respawn: 0, chased: -1, away: v3(), aim: v3() };
  // (locked on to where it's drawn: `seen`, on from its last step by the time owed)
  f.tgt = { id: f.id, at: f.seen, vel: f.vel, size: f.size, kind: f.kind, name: NAMES[f.kind] ?? f.kind, hp: 0, hpMax: type.hp, threat: 0 };
  spawn(k, f, true);
  return f;
}

// a bomber wave of `n` (the plan's, battleStages.js): the side's bombers, put
// up in front of its line, each one life only, told apart by the wave's `id`
export function addWave(k, team, n, id) {
  const bombers = k.b.teams[team].side.fighters.filter((o) => o.role === 'bomber');
  const out = [];
  for (let i = 0; i < n; i++) {
    const f = makeFighter(k, team);
    const kind = bombers.length ? pick(bombers, k.rand) : null;
    if (kind) Object.assign(f, { kind: kind.kind, role: 'bomber', type: FIGHTERS[kind.kind], size: FIGHTERS[kind.kind].size });
    Object.assign(f.tgt, { kind: f.kind, name: NAMES[f.kind] ?? f.kind, size: f.size, hpMax: f.type.hp });
    spawn(k, f, false);
    f.wave = id;
    f.respawn = Infinity;
    k.b.fighters.push(f);
    out.push(f);
  }
  k.tactics?.adopt(out); // (in flights of their own)
  return out;
}

// a reserve squadron of `n` (the plan's escalation at the final push,
// battleStages.js): the side's dogfighters, put up in front of its line,
// back in again with its waves when they're shot down
export function addReserve(k, team, n) {
  const kinds = k.b.teams[team].side.fighters.filter((o) => o.role !== 'bomber');
  const out = [];
  for (let i = 0; i < n; i++) {
    const f = makeFighter(k, team, kinds.length ? pick(kinds, k.rand) : null);
    spawn(k, f, false);
    f.reserve = true;
    k.b.fighters.push(f);
    out.push(f);
  }
  k.tactics?.adopt(out);
  return out;
}

export function muster(k, n, ace) {
  const { b } = k;
  // (with tactics each side flies its share of each kind, in flights of a kind: battleTactics.js)
  for (const team of [0, 1]) {
    const kinds = k.tactics?.kinds(team, n) ?? null;
    for (let i = 0; i < n; i++) b.fighters.push(makeFighter(k, team, kinds?.[i]));
  }
  // an ace: one of its side's, flown as its own kind, named, with its own hull
  for (const team of [0, 1]) {
    const a = ace?.[team];
    if (!a || !FIGHTERS[a.kind]) continue;
    let f = b.fighters.find((o) => o.team === team);
    if (!f) b.fighters.push((f = makeFighter(k, team)));
    f.kind = a.kind;
    // (its hit points its kind's in the game where the game has the kind,
    // FIGHTERS'; the plan's own where it hasn't, and in the galaxy's shared
    // battle, where its hull is the director's)
    const hp = k.decides !== false && kindDamage(a.kind)?.hp ? FIGHTERS[a.kind].hp : a.hp;
    f.type = { ...FIGHTERS[a.kind], hp };
    f.size = f.type.size;
    f.hp = hp;
    f.ace = true;
    Object.assign(f.tgt, { kind: a.kind, name: a.name, size: f.size, hpMax: hp });
  }
}

// ── choosing what to go after ──
function bomberTarget(k, f) {
  const { b, rand } = k;
  const enemy = 1 - f.team;
  // a runner of the other side's, half the time there's one
  const runs = b.runners.filter((r) => r.alive && r.team === enemy);
  if (runs.length && rand() < 0.5) return runs[Math.floor(rand() * runs.length)];
  if (f.team === k.attacker) {
    // (the plan's objectives of the stage, wherever they are, or the objective ship's of the phase)
    const flag = k.objOf();
    const subs = b.objectives ? b.objectives.filter((o) => o.alive && !o.zone && !o.hidden && o.phase === b.phase) : flag?.alive ? flag.subs.filter((s) => s.alive && !s.hidden && s.phase === b.phase) : [];
    if (subs.length) return subs[Math.floor(rand() * subs.length)];
  }
  // a point on one of the other side's capital ships
  const caps = b.capitals.filter((c) => c.team === enemy && c.alive && c.dying <= 0 && c.tracked);
  if (!caps.length) return null;
  const cap = caps[Math.floor(rand() * caps.length)];
  const sp = cap.spheres[Math.floor(rand() * cap.spheres.length)];
  return { pos: sp.c, alive: true, cap, r: sp.r };
}
function fighterTarget(k, f) {
  const { b } = k;
  let best = null;
  let score = Infinity;
  for (const o of b.fighters) {
    if (!o.alive || o.team === f.team) continue;
    let d = dist2(o.pos, f.pos);
    if (f.role === 'interceptor' && o.role === 'bomber') d *= 0.12;
    else if (o.target && o.target !== b.you && o.target.team === f.team) d *= 0.5; // (going after a friend)
    if (d < score) {
      score = d;
      best = o;
    }
  }
  // runners for the jump: the other side's go after them first
  for (const r of b.runners) {
    if (!r.alive || r.team === f.team) continue;
    const d = dist2(r.pos, f.pos) * 0.3;
    if (d < score) {
      score = d;
      best = r;
    }
  }
  if (k.youIn() && b.you.team !== f.team && b.you.on < BATTLE.onYou) {
    const d = dist2(b.you.pos, f.pos);
    // always a couple on you while you're anywhere near (Battlefront's
    // fights come to the player), more if you're the nearest
    if ((b.you.on < 2 && d < 70 * 70) || d * 0.35 < score) best = b.you;
  }
  return best;
}
const targetAlive = (k, t) => t && (t === k.b.you ? k.youIn() : t.alive);

// ── one fighter, one step ──
const want = v3();
const tmp = v3();
const oldFwd = v3();
export function flyFighter(k, f, dt) {
  const { b, C, A, S, radius, avoid, rand } = k;
  // stopped dead (its control relay gone): drifting on, slowing, after nothing
  if (f.frozen > 0) {
    f.frozen = Math.max(0, f.frozen - dt);
    if (f.target === b.you) b.you.on = Math.max(0, b.you.on - 1);
    f.target = null;
    f.speed = Math.max(f.type.speed * 0.3, f.speed - f.type.accel * 0.5 * dt);
    set(f.vel, f.fwd.x * f.speed, f.fwd.y * f.speed, f.fwd.z * f.speed);
    copy(f.prev, f.pos);
    f.pos.x += f.vel.x * dt;
    f.pos.y += f.vel.y * dt;
    f.pos.z += f.vel.z * dt;
    return;
  }
  // a new target now and then, or when the last one's gone (or with
  // tactics, battleTactics.js: kept a while once chosen)
  if (k.tactics) k.tactics.think(f, dt);
  else f.retarget -= dt;
  if (!k.tactics && (!targetAlive(k, f.target) || f.retarget <= 0)) {
    const was = f.target;
    f.target = f.role === 'bomber' ? bomberTarget(k, f) : fighterTarget(k, f);
    if (was === b.you && f.target !== b.you) b.you.on = Math.max(0, b.you.on - 1);
    if (f.target === b.you && was !== b.you) b.you.on += 1;
    f.retarget = 0.35 + rand() * 0.25;
  }
  const t = f.target;
  const tp = t === b.you ? b.you.pos : t?.pos;
  const tv = t === b.you ? b.you.vel : (t?.vel ?? ZERO);
  let dist = Infinity;
  if (tp) {
    // where to point: where it'll be by the time a bolt gets there
    dist = Math.sqrt(dist2(tp, f.pos));
    const lead = dist / (f.role === 'bomber' ? BATTLE.bolts.torpedo.speed : (fighterShot(f.kind) ?? BATTLE.bolts.laser).speed);
    set(f.aim, tp.x + tv.x * lead, tp.y + tv.y * lead, tp.z + tv.z * lead);
    if (t !== b.you && t.team !== undefined && dist < 10) {
      t.chased = b.clock; // (someone on its tail)
      t.chaser = f;
    }
  }
  f.modeT -= dt;
  if (f.modeT <= 0 && f.mode !== 'engage' && f.mode !== 'run' && f.mode !== 'rtb') f.mode = f.role === 'bomber' ? 'run' : 'engage';
  // (with tactics, somewhere else to be: home, its slot off its leader's wing, by its bombers, circling its cover)
  const st = k.tactics ? k.tactics.steer(f, dist) : null;
  // what it wants: at its target, or away from it for a while
  if (f.mode === 'break' || f.mode === 'jink' || f.mode === 'extend') copy(want, f.away);
  else if (st?.at) set(want, st.at.x - f.pos.x, st.at.y - f.pos.y, st.at.z - f.pos.z);
  else if (tp) set(want, f.aim.x - f.pos.x, f.aim.y - f.pos.y, f.aim.z - f.pos.z);
  else set(want, C.x - f.pos.x, C.y - f.pos.y, C.z - f.pos.z);
  norm(want);
  if (tp && f.mode === 'engage') {
    set(tmp, tp.x - f.pos.x, tp.y - f.pos.y, tp.z - f.pos.z);
    const ahead = dot(f.fwd, tmp) / (dist || 1);
    // head-on and about to meet: break off, to one side
    if (dist < 3 && ahead > 0.5 && t !== b.you && t.fwd && dot(t.fwd, f.fwd) < -0.5) {
      f.mode = 'break';
      f.modeT = 1.2 + rand();
      norm(cross(f.fwd, rand() < 0.5 ? UP : f.away.y > 0 ? S : A, f.away));
    } else if (dist < 6 && ahead < -0.2) {
      // overshot: straight on a while, then round again
      f.mode = 'extend';
      f.modeT = 1.2 + rand() * 0.8;
      norm(set(f.away, f.fwd.x, f.fwd.y + (rand() - 0.5) * 0.6, f.fwd.z));
    } else if (b.clock - f.chased < 0.6 && rand() < dt * 0.8) {
      // someone on its tail: jink
      f.mode = 'jink';
      f.modeT = 0.8 + rand() * 0.6;
      norm(set(f.away, f.fwd.x + (rand() - 0.5) * 1.6, f.fwd.y + (rand() - 0.5) * 1.6, f.fwd.z + (rand() - 0.5) * 1.6));
    }
  }
  // round the capital ships' hulls, looking a second ahead
  for (const cap of b.capitals) {
    if (!cap.alive || dist2(cap.pos, f.pos) > (cap.reach + f.speed * 1.2 + 4) ** 2) continue;
    for (const sp of cap.spheres) {
      set(tmp, f.pos.x + f.vel.x * 1.0 - sp.c.x, f.pos.y + f.vel.y * 1.0 - sp.c.y, f.pos.z + f.vel.z * 1.0 - sp.c.z);
      const d = len(tmp);
      const room = sp.r + 2.5;
      if (d < room) {
        const push = ((room - d) / room) * 4;
        want.x += (tmp.x / (d || 1)) * push;
        want.y += (tmp.y / (d || 1)) * push + push * 0.3;
        want.z += (tmp.z / (d || 1)) * push;
      }
    }
  }
  // clear of the planet, a Death Star's shield…
  // (looking a second and a half ahead; nothing it's after counts for more)
  for (const o of avoid) {
    set(tmp, f.pos.x + f.vel.x * 1.5 - o.c.x, f.pos.y + f.vel.y * 1.5 - o.c.y, f.pos.z + f.vel.z * 1.5 - o.c.z);
    const d = len(tmp);
    const room = o.r + 12;
    if (d < room) {
      const push = 2 + ((room - d) / 12) * 10;
      want.x += (tmp.x / (d || 1)) * push;
      want.y += (tmp.y / (d || 1)) * push;
      want.z += (tmp.z / (d || 1)) * push;
    }
  }
  // back into the fight at its edge
  const out = Math.sqrt(dist2(f.pos, C)) - radius;
  if (out > 0) {
    set(tmp, C.x - f.pos.x, C.y - f.pos.y, C.z - f.pos.z);
    norm(tmp);
    const pull = Math.min(3, out / 20);
    want.x += tmp.x * pull;
    want.y += tmp.y * pull;
    want.z += tmp.z * pull;
  }
  copy(oldFwd, f.fwd);
  copy(f.fwd, turnToward(f.fwd, want, f.type.turn * dt));
  // leaning into the turn (for the drawing)
  const side = dot(cross(oldFwd, f.fwd, tmp), UP) / Math.max(dt, 1e-4);
  f.bank += (Math.max(-1.2, Math.min(1.2, side * 0.45)) - f.bank) * Math.min(1, dt * 4);
  const top = st?.speed ?? f.type.speed * (f.mode === 'break' ? 1.1 : 1);
  f.speed += Math.max(-f.type.accel * dt, Math.min(f.type.accel * dt, top - f.speed));
  set(f.vel, f.fwd.x * f.speed, f.fwd.y * f.speed, f.fwd.z * f.speed);
  copy(f.prev, f.pos);
  f.pos.x += f.vel.x * dt;
  f.pos.y += f.vel.y * dt;
  f.pos.z += f.vel.z * dt;
  // its guns, or its torpedoes
  f.cool -= dt;
  if (!tp || f.cool > 0 || b.over || f.mode === 'rtb') return;
  set(tmp, f.aim.x - f.pos.x, f.aim.y - f.pos.y, f.aim.z - f.pos.z);
  if (f.role === 'bomber') {
    // (with tactics a run at a ship is judged to its hull's side, not its
    // middle, which a big ship's hull kept the bomber further off than a
    // torpedo's range; and loosed from outside its batteries' point-defence,
    // where a bomber flying in to a dozen units off was shot down before it fired)
    const ship = k.tactics && t !== b.you && t.team === undefined;
    const gap = ship && t.cap && t.r ? dist - t.r : dist;
    if (f.mode === 'run' && gap < (ship ? TACTICS.release : 12) && dot(f.fwd, tmp) / (len(tmp) || 1) > 0.95) {
      b.fire(f.team, f.pos, tmp, 'torpedo', t);
      f.cool = f.type.reload ?? 1.2;
      f.rethink = true; // (its run done: the next one's target chosen afresh)
      // pull out and away, then round for another run
      f.mode = 'extend';
      f.modeT = 2.5 + rand();
      norm(set(f.away, f.fwd.x - tmp.x * 0.02, 0.8, f.fwd.z - tmp.z * 0.02));
    }
    return;
  }
  if (!inSights(f.fwd, tmp, f.type)) return;
  // (at you, as true as the difficulty says: battleDifficulty.js)
  const spread = t === b.you && k.pressure ? k.pressure.spread : 0.02;
  set(tmp, tmp.x / len(tmp) + (rand() - 0.5) * spread * 2, tmp.y / len(tmp) + (rand() - 0.5) * spread * 2, tmp.z / len(tmp) + (rand() - 0.5) * spread * 2);
  // (a battery strafed: the bolt knows what it's at, so it can take the battery's hp)
  // (its kind's bolt in the game: its speed, its life, its damage)
  b.fire(f.team, { x: f.pos.x + f.fwd.x * f.size * 0.6, y: f.pos.y + f.fwd.y * f.size * 0.6, z: f.pos.z + f.fwd.z * f.size * 0.6 }, tmp, 'laser', t?.battery ? t : null, fighterShot(f.kind));
  f.shots += 1;
  if (f.shots >= 3) {
    f.shots = 0;
    f.cool = f.type.burst[1] * (0.8 + rand() * 0.4);
  } else f.cool = f.type.burst[0];
}
