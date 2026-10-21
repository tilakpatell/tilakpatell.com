// The fight: a soldier of any side senses everyone round it, knows its
// enemies by the war's sides (and you by your oath, or by a grudge), and
// fights with the game's brain (src/lib/battlefront/ai/soldierBrain.js,
// through brain.js: the target the game's scores pick, its template's
// tactics, cover, firing patterns and aim box). Round the brain the ground
// war keeps what the brain has no part of: who is an enemy (the war's
// relation, the grudge); shot tokens per target; the squad's nerve, its
// confidence read into the brain's posture (a broken squad flees) and its
// flankers sent round while it presses; the leash (a soldier keeps within
// reach of its post or its beat, and lets be a target past it); a target
// seen beyond its engage distance closed on; no shot till its body faces
// the target within 25° (the brain turns at once, a body here turns at its
// pace); and, lost, one burst where it last had it. With nobody to fight it
// walks its beat or holds its post. Pure, tested. The design:
// docs/superpowers/specs/2026-10-08-ground-factions-design.md, section 6,
// and 2026-10-21-battlefront-by-default-design.md, decision 6.
//
// world: { t (seconds), war, bodies: [{ id, x, y?, z, vel, side, kind,
//   squad?, firingAt?, you? }], seesThrough(a, b), tokens (lib/ai/squad's),
//   squads?, minds (brain.js's createMinds: without it, or before its
//   navgrid is in, nobody fights and each keeps to its beat or its post) }
// senseAll(s, world, dt); threatOf(s, world) → { id, x, z, vel, side,
//   visible, seenAt, you, shooting } | null; aimError(s, target, dist,
//   { first, now }) (the far fights': bolts.js's farExchange);
// grudge(s, squads, now, at?) (at: where you shot from: they know it);
// fightStep(s, world, dt, rand) → { x, z, yaw, mode, moving, aim, fire (a
//   bolt this frame), suppressive, guessed, target, stuck };
//   squadsOf(soldiers, { reach, war }) → { update(dt), died(id), of(id),
//   membersOf(id), postureOf(id), confidenceOf(id), isFlanker(id) };
//   suppress(s, now, value?) (value: the shooter's suppression, which fills
//   the brain's to 1, where it hides).

import { belief, createSenses, sense } from '../../../../lib/ai/perception';
import { confidence, createSquads, frontline, flankers as flankersOf, morale, posture } from '../../../../lib/ai/squad';
import { turnToward, walkTo } from '../hostiles';
import { weaponOf } from '../weaponRules';
import { relation, standingOf } from './standing';
import { TROOPS } from './troops';

export const GRUDGE = 90; // seconds a squad you shot at counts you its enemy
export const FACING = Math.PI / 7.2; // 25°: no shot till it faces its target this near
const SUPPRESS = { near: 2, for: 1.5 };
export const LOST = 2; // seconds after losing sight it may send one burst at the last place
export const SENSE = 0.1; // seconds between a soldier's looks round
const OUT_OF_REACH = 10; // seconds a soldier lets be a target its leash won't reach
const ENGAGED = 20; // seconds a fight stretches the leash after the last sight
const WALK = 0.42; // of its run, on a beat or going home
const TURN = 3; // radians a second a body turns to where its brain looks (the ground's look's own pace)
const FLANK = 12; // metres out to the side of its target a flanker makes for, by hand
// the brain's tactic as the ground's bodies are posed for it (lib/ai/body's modes)
const MODE = { attack: 'strafe', cover: 'cover', hide: 'cover', flee: 'back', close: 'close', advance: 'advance', objective: 'advance', follow: 'advance', interact: 'hold' };

const P = (x, z) => ({ x, y: 0, z });
const velOf = (v) => (Array.isArray(v) ? { x: v[0], y: 0, z: v[1] } : v ? { x: v.x ?? 0, y: 0, z: v.z ?? 0 } : null);
const troopOf = (s) => TROOPS[s.kind] ?? TROOPS.stormtrooper;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// is this body one the soldier fights? (you and your mate by your oath, or a grudge)
const enemyTo = (s, b, world) => {
  if (b.id === s.id || (!b.side && !b.you)) return false;
  if (b.you) return standingOf(s.side, { side: b.side, war: world.war }) === 'enemy' || (s.grudge ?? 0) > world.t;
  return relation(s.side, b.side, world.war) === 'enemy';
};

// (a soldier with a brain senses with the brain's senses, the game's sight:
// brain.js puts them on it; one without, with its troop's)
export function senseAll(s, world, dt) {
  const t = troopOf(s);
  s.senses ??= createSenses({ sight: { range: t.range * 1.3, cone: t.cone, far: 1.6 }, hearing: { range: t.range }, memory: 7, intuition: 2.5 });
  s.me ??= { pos: P(s.b.x, s.b.z), dir: null, beliefs: {}, now: 0 };
  s.me.pos.x = s.b.x;
  s.me.pos.z = s.b.z;
  // (its eyes at its own chest’s height, as the bodies it looks at are
  // sensed at theirs: the scene’s `y`; on level ground, none)
  s.me.pos.y = s.y ?? 0;
  s.me.dir = { x: Math.sin(s.b.yaw), y: 0, z: Math.cos(s.b.yaw) };
  const reach = s.senses.sight.range;
  const targets = [];
  for (const b of world.bodies) {
    if (b.id === s.id || Math.abs(b.x - s.b.x) > reach || Math.abs(b.z - s.b.z) > reach) continue;
    targets.push({ id: b.id, at: { x: b.x, y: b.y ?? 0, z: b.z }, vel: velOf(b.vel), hostile: enemyTo(s, b, world), faction: b.side ?? null });
  }
  sense(s.senses, s.me, { targets }, dt, { seesThrough: world.seesThrough ?? null });
}

// the world's bodies by side and by squad, made once a frame (and kept on the
// world while its bodies are the same list)
export function indexBodies(bodies) {
  const bySide = new Map();
  const bySquad = new Map();
  for (const b of bodies) {
    const k = b.side ?? null;
    if (!bySide.has(k)) bySide.set(k, []);
    bySide.get(k).push(b);
    if (b.squad == null) continue;
    if (!bySquad.has(b.squad)) bySquad.set(b.squad, []);
    bySquad.get(b.squad).push(b);
  }
  return { bySide, bySquad };
}
const indexOf = (world) => {
  if (world.index && world.indexOf === world.bodies) return world.index;
  world.indexOf = world.bodies;
  return (world.index = indexBodies(world.bodies));
};

export function threatOf(s, world) {
  if (!s.me) return null;
  const index = indexOf(world);
  // (whether one shot at is this one or its squad: worked out only when someone's shooting)
  let mates = null;
  const mate = (id) => {
    if (!mates) {
      mates = new Set([s.id]);
      if (world.squads?.membersOf) for (const m of world.squads.membersOf(s.id)) mates.add(m);
      for (const b of index.bySquad.get(s.squad) ?? []) if (b.side === s.side) mates.add(b.id);
    }
    return mates.has(id);
  };
  let best = null;
  let bestScore = -Infinity;
  for (const [side, list] of index.bySide)
    for (const b of list) {
      if (side === s.side && !b.you) continue;
      if (!enemyTo(s, b, world)) continue;
      const bel = belief(s.me, b.id);
      // (detected: the meter full, or seen and lost only a moment ago)
      if (!bel || bel.confidence < 1) continue;
      const d = Math.hypot(bel.at.x - s.b.x, bel.at.z - s.b.z);
      let score = -d;
      const shooting = b.firingAt && mate(b.firingAt);
      // (one out of its reach that isn't shooting at it: let be a while)
      if (!shooting && s.ignore?.id === b.id && s.ignore.until > world.t) continue;
      if (shooting) score += 1000;
      if (bel.visible) score += 5;
      if (b.id === s.target) score += 8;
      if (score > bestScore) {
        bestScore = score;
        best = { id: b.id, x: bel.visible ? b.x : bel.at.x, z: bel.visible ? b.z : bel.at.z, vel: bel.visible ? velOf(b.vel) : bel.vel, side: b.side, visible: bel.visible, seenAt: bel.seenAt, you: Boolean(b.you), shooting: Boolean(shooting) };
      }
    }
  return best;
}

export function aimError(s, target, dist, { first = false, now = s.now ?? 0 } = {}) {
  const w = weaponOf(s.weapon);
  const range = troopOf(s).range;
  const byRange = 1 + 1.2 * Math.min(1, Math.max(0, (dist - 1) / Math.max(1, range - 1)));
  const v = velOf(target?.vel) ?? { x: 0, z: 0 };
  let across = Math.hypot(v.x, v.z);
  if (Number.isFinite(target?.x) && Number.isFinite(target?.z)) {
    const dx = target.x - s.b.x;
    const dz = target.z - s.b.z;
    const l = Math.hypot(dx, dz);
    if (l > 1e-6) across = Math.abs((v.x * dz - v.z * dx) / l);
  }
  const suppressed = (s.suppressed ?? 0) > now ? 2 : 1;
  return w.spread * byRange * (1 + across / 6) * suppressed * (first ? 1.5 : 1);
}

// a near miss: its head down a moment (the far fights' aim), and the
// brain's suppression filled by the shooter's (its tactics' value, bots.js's
// rule), fading over the soldier's own tactics' time (fightStep)
export const suppress = (s, now, value = 0) => {
  s.suppressed = now + SUPPRESS.for;
  if (value > 0) s.suppression = Math.min(1, (s.suppression ?? 0) + value);
};

// at: where you were when you shot (they know it, as if they'd heard it)
export function grudge(s, squads, now, at = null) {
  const ids = squads?.membersOf ? squads.membersOf(s.id) : [s.id];
  const all = new Set([s, ...(squads?.soldiersOf ? squads.soldiersOf(ids) : [])]);
  for (const m of all) {
    m.grudge = now + GRUDGE;
    if (!at) continue;
    m.me ??= { pos: P(m.b.x, m.b.z), dir: null, beliefs: {}, now: 0 };
    const b = m.me.beliefs.you;
    if (b?.visible) continue;
    m.me.beliefs.you = { id: 'you', at: P(at.x, at.z), vel: { x: 0, y: 0, z: 0 }, seenAt: m.me.now ?? 0, heardAt: m.me.now ?? 0, confidence: 1, visible: false, timer: b?.timer ?? 0, kind: 'you', faction: null, hostile: true };
  }
}

// with nobody to fight: the beat, or the post
function about(s, dt) {
  const t = troopOf(s);
  const pace = t.speed * WALK;
  if (s.beat?.length) {
    s.beatAt ??= 0;
    const p = s.beat[s.beatAt % s.beat.length];
    const w = walkTo(s.b, { x: p[0], z: p[1] }, pace, dt);
    if (w.there) s.beatAt = (s.beatAt + 1) % s.beat.length;
    return { x: w.x, z: w.z, yaw: w.yaw, mode: 'patrol', moving: w.moving };
  }
  s.postYaw ??= s.b.yaw;
  const w = walkTo(s.b, { x: s.home[0], z: s.home[1] }, pace, dt);
  if (!w.there) return { x: w.x, z: w.z, yaw: w.yaw, mode: 'post', moving: w.moving };
  return { x: s.b.x, z: s.b.z, yaw: turnToward(s.b.yaw, s.postYaw, 2 * dt), mode: 'post', moving: 0 };
}

// the point a flanker makes for: out to the side of its target, the side it stands on
function flankOf(s, threat) {
  const ax = s.b.x - threat.x;
  const az = s.b.z - threat.z;
  const l = Math.hypot(ax, az) || 1;
  const side = (s.id.length + Math.floor(s.home[0])) % 2 ? 1 : -1;
  return [threat.x + (az / l) * FLANK * side + (ax / l) * FLANK * 0.5, threat.z - (ax / l) * FLANK * side + (az / l) * FLANK * 0.5];
}

// lost: one burst where it last had it, if it had a line there (the cover between takes it)
function lostBurst(s, now, t, facing = true) {
  if (!(s.lost && s.lost.line && !s.lost.shot && now - s.lost.at <= LOST && t.weapon && facing)) return null;
  if (Math.hypot(s.lost.x - s.b.x, s.lost.z - s.b.z) > t.range) return null;
  s.lost.shot = true;
  return { aim: { x: s.lost.x, z: s.lost.z }, fire: true, suppressive: true, target: s.lost.id };
}

export function fightStep(s, world, dt, rand = Math.random) {
  const now = world.t;
  s.now = now;
  const t = troopOf(s);
  const quiet = { aim: null, fire: false, suppressive: false, guessed: false, target: null, stuck: 0 };
  const minds = world.minds ?? null;
  // (no minds, or their navgrid not in yet: the beat and the post meanwhile)
  if (!minds?.ready()) {
    s.target = null;
    return { ...about(s, dt), ...quiet };
  }
  // (what every soldier's world reads, gathered once a step: the scene's soldiers, or those with minds)
  if (minds.at !== now) minds.frame({ bodies: world.bodies, soldiers: world.soldiers ?? null, war: world.war, t: now });
  const m = minds.mindOf(s, rand);
  // (its nerves settle over its own tactics' time, as the sim's bots' do: bots.js)
  if (s.suppression) s.suppression = Math.max(0, s.suppression - dt / (m.brain.tactics.suppression?.time ?? 10));
  s.senseAcc = (s.senseAcc ?? s.mind?.sense ?? 0) + dt;
  if (s.senseAcc >= SENSE || !s.me) {
    senseAll(s, world, s.senseAcc);
    s.senseAcc = 0;
  }
  const threat = threatOf(s, world);
  if (!threat) {
    s.target = null;
    m.engaged = false;
    s.stuckFor = 0;
    // (a fight just over: home first, then the beat or the post)
    const burst = s.engagedUntil > now ? lostBurst(s, now, t) : null;
    if (burst) return { x: s.b.x, z: s.b.z, yaw: s.b.yaw, mode: 'look', moving: 0, ...quiet, ...burst };
    return { ...about(s, dt), ...quiet };
  }
  // (where it last had a clear line to it: a sight the senses haven't caught up with, the line gone, keeps the last)
  const line = !world.seesThrough || world.seesThrough(P(s.b.x, s.b.z), P(threat.x, threat.z));
  if (threat.visible) s.engagedUntil = now + ENGAGED;
  if (threat.visible && line) s.lost = { id: threat.id, x: threat.x, z: threat.z, at: now, shot: false, line: true };
  const posture = world.squads?.postureOf?.(s.id) ?? 'hold';
  const reach = s.leash + t.range;
  const fromHome = (x, z) => Math.hypot(x - s.home[0], z - s.home[1]);
  const d = Math.hypot(threat.x - s.b.x, threat.z - s.b.z);
  const engage = Math.min(t.range, m.brain.tactics.engage?.distance ?? t.range);
  if (d > engage) {
    // seen beyond it, it walks in: never past its reach, never with its squad's nerve gone
    const ux = (threat.x - s.b.x) / d;
    const uz = (threat.z - s.b.z) / d;
    if (posture === 'retreat' || fromHome(s.b.x + ux, s.b.z + uz) > Math.max(reach, fromHome(s.b.x, s.b.z))) {
      // out of its reach: it lets that one be a while, and goes back about its business
      s.ignore = { id: threat.id, until: now + OUT_OF_REACH };
      s.target = null;
      world.tokens?.release('shot', s.id, threat.id);
      m.engaged = false;
      return { ...about(s, dt), ...quiet };
    }
  }
  // the brain: its world, a think on its own clock (and at once, on a fight just begun), a step
  minds.sync(s);
  const bw = minds.worldFor(s, { posture, squads: world.squads ?? null });
  m.brain.assigned = threat.shooting ? threat.id : null;
  if (!m.engaged || now >= m.thinkAt) minds.think(s, bw, now);
  m.engaged = true;
  const b = m.brain.intent;
  const intent = { ...b };
  let mode = MODE[b.mode] ?? b.mode;
  let target = b.target;
  if (d > engage) {
    intent.mode = 'advance';
    intent.goal = [threat.x, threat.z];
    intent.fire = false;
    intent.sprint = false;
    intent.stance = 'stand';
    mode = 'advance';
    target = threat.id;
  } else if (posture === 'press' && world.squads?.isFlanker?.(s.id) && (b.mode === 'attack' || b.mode === 'cover')) {
    // (pressing, the squad sends its flankers round: they go, firing as they can)
    intent.goal = flankOf(s, threat);
    intent.stance = 'stand';
    mode = 'flank';
  }
  // the trigger's gates: its body facing the target, a token for that target
  const facing = Math.abs(wrap(Math.atan2(threat.x - s.b.x, threat.z - s.b.z) - s.b.yaw)) <= FACING;
  let may = Boolean(intent.fire) && facing && target != null && Boolean(t.weapon);
  if (may && world.tokens) may = world.tokens.claim('shot', s.id, { target });
  else if (world.tokens && !threat.visible) world.tokens.release('shot', s.id, threat.id);
  intent.fire = may;
  const was = [s.b.x, s.b.z];
  const shot = minds.act(s, intent, bw, dt, now);
  const body = m.body;
  let x = body.at[0];
  let z = body.at[2];
  // the leash: never further from home than it reaches, but for coming back
  if (fromHome(x, z) > reach && fromHome(x, z) > fromHome(was[0], was[1])) {
    x = was[0];
    z = was[1];
    body.at[0] = x;
    body.at[2] = z;
  }
  const moved = Math.hypot(x - was[0], z - was[1]);
  const yaw = turnToward(s.b.yaw, body.yaw, TURN * dt);
  // (where it wanted to walk and couldn't: for the checks, scripts/assault-check.mjs)
  s.stuckFor = intent.goal && Math.hypot(intent.goal[0] - x, intent.goal[1] - z) > 1 && moved < 0.1 * dt ? (s.stuckFor ?? 0) + dt : 0;
  s.target = target;
  const out = { x, z, yaw, mode, moving: body.moving ? 1 : 0, aim: null, fire: false, suppressive: false, guessed: !threat.visible, target, stuck: s.stuckFor };
  if (shot) return { ...out, aim: { x: shot[0], y: shot[1], z: shot[2] }, fire: true };
  // lost behind something: the one burst where it last had it
  const burst = !threat.visible ? lostBurst(s, now, t, facing) : null;
  if (burst) return { ...out, ...burst };
  const aim = intent.aim ?? b.aim;
  return { ...out, aim: target && aim ? { x: aim[0], y: aim[1], z: aim[2] } : null };
}

// ── squads: lib/ai/squad's, per side, on the soldiers ──
export function squadsOf(soldiers, { reach = 18, war = 'gcw', near = 80 } = {}) {
  const list = () => (soldiers instanceof Map ? [...soldiers.values()] : soldiers);
  const sq = createSquads({ reach });
  const state = new Map(); // squad id → { level, losses, flank: Set, leader, known: Set }
  const fallen = new Set(); // (down, and gone from the list: died(id))
  let known = new Map(); // id → soldier, as at the last update
  const byId = () => (known = new Map(list().map((s) => [s.id, s])));
  const at = (s) => ({ x: s.b.x, y: 0, z: s.b.z });
  const api = {
    update(dt) {
      const all = list();
      const members = all.map((s) => ({ id: s.id, at: at(s), side: s.side, alive: s.alive }));
      const squads = sq.update(members);
      const ids = byId();
      // (a squad gone, all down or let go of: forgotten)
      const now = new Set(squads.map((q) => q.id));
      for (const id of state.keys()) if (!now.has(id)) state.delete(id);
      for (const squad of squads) {
        const st = state.get(squad.id) ?? { level: 'neutral', losses: 0, flank: new Set(), leader: squad.members[0], known: new Set() };
        state.set(squad.id, st);
        // the members lost since (they were in it, and are down now)
        for (const id of st.known) {
          const gone = fallen.has(id) || ids.get(id)?.alive === false;
          if (gone) {
            st.losses += 1;
            if (id === st.leader) st.leaderDown = true;
          }
          if (gone || !ids.get(id)) st.known.delete(id);
        }
        for (const id of squad.members) st.known.add(id);
        st.losses *= Math.pow(0.5, dt / 60); // (losses fade over a minute or two)
        const mine = squad.members.map((id) => ids.get(id));
        const foes = all.filter((e) => e.alive && relation(squad.side, e.side, war) === 'enemy' && Math.hypot(e.b.x - squad.centre.x, e.b.z - squad.centre.z) < near);
        const value = (s) => (s.b ? s.hp / s.hpMax : 1);
        const c = confidence(
          squad,
          members,
          foes.map((e) => ({ id: e.id, at: at(e), alive: true, hp: e.hp, hpMax: e.hpMax, b: e.b })),
          { value, losses: st.losses },
        );
        let level = c.level;
        if (st.leaderDown) level = morale(level, { type: 'leaderDown' });
        // (a droid never breaks)
        if (mine.every((s) => (TROOPS[s.kind]?.nerve ?? 1) === 0) && (level === 'panicked' || level === 'worried')) level = 'neutral';
        st.level = level;
        st.flank = new Set();
        if (posture(level) === 'press' && foes.length) {
          const front = frontline(
            squad,
            members,
            foes.map((e) => ({ id: e.id, at: at(e), alive: true })),
          );
          for (const f of flankersOf(
            squad,
            members,
            front,
            foes.map((e) => ({ id: e.id, at: at(e), alive: true })),
          ))
            st.flank.add(f.id);
        }
      }
      fallen.clear(); // (each counted, by the squad it was in, this once)
    },
    sizes: () => ({ squads: state.size, fallen: fallen.size }),
    died: (id) => fallen.add(id),
    of: (id) => sq.of(id),
    membersOf: (id) => sq.of(id)?.members ?? [id],
    soldiersOf: (ids) => ids.map((id) => known.get(id)).filter(Boolean),
    confidenceOf: (id) => state.get(sq.of(id)?.id)?.level ?? 'neutral',
    postureOf: (id) => posture(api.confidenceOf(id)),
    isFlanker: (id) => Boolean(state.get(sq.of(id)?.id)?.flank.has(id)),
  };
  return api;
}
