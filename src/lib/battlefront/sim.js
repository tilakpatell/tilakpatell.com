// The battle (spec decisions 3 and 9): a fixed 50 ms step from a seed, in
// Node or the page alike. Entities (soldiers now; heroes and vehicles in
// later lanes), their guns' bolts, hits, deaths, events. Inputs go in as
// plain objects a step, events come out; every random draw is the sim's own
// `rand`, so one seed gives one battle. The bots' brains (ai/) are stepped
// here on a stagger. With a mode (`'galacticAssault'`) the battle also
// runs the stage file (`modes/galacticAssault.js`): the fallen are removed
// after `TimeForCorpse` and wait to deploy, bots on their team's wave as
// their commander (`ai/commander.js`) spends their Battle Points, a player
// by `deploy`; the walkers are bodies the bolts hit, open to damage while a
// bombing run lasts. Out of bounds, where a team has bounds, kills in
// OOB_SECONDS. Pure: no three.js, no DOM.
//
//   createSim({ rulebook, level, era, nav, seed, teams, bots, mode, spawns, oob }) → sim
//   deploy(sim, id, { kind, id, spawn: 'point' | 'squad' }) → { ok, why }
//   step(sim, inputs = []) → events     inputs: [{ id, move: [x, z], look, fire, aim: [x, y, z], crouch, sprint, roll, ability, vent, cool }]
//   addPlayer(sim, { team, classId, at, yaw }) → id      removeEntity(sim, id)
//   view(sim, { player }) → { time, teams, entities, bolts, mode, deploying, deploy }  (one object, refreshed in place)
//   drain(sim) → the event log so far, cleared

import { seeded } from '../seeded.js';
import { classOf, heroOf, mapOf, reinforcementOf, spawnsFor, teamsFor, weaponOf } from './rulebook.js';
import { press } from './abilities.js';
import { createBolts, fire as fireBolt, step as stepBolts } from './bolts.js';
import { heightAt, nearestMainland, nearestWalkable } from './nav.js';
import { STEP, clock, muzzleOf, profile, shoot } from './core.js';
import { capsulesOf, chestOf, hurt, move, newSoldier, roll, tick as tickSoldier } from './soldier.js';
import { coolPress, damageAt, vent } from './weapons.js';
import { addBrain, createBrains, onEvents, stepBrains } from './ai/bots.js';
import { assign, createCommander, spend, wave } from './ai/commander.js';
import { squadOf } from './ai/squad.js';
import { balance, buy, createPoints, earn, hit as bpHit, kill as bpKill, offers } from './battlePoints.js';
import { AIM_SCALE, createAssault, onEvent as modeEvent, sideOf, spawnSets, tick as tickMode, view as modeView, walkersOf } from './modes/galacticAssault.js';
import { insidePolygon } from './modes/objectives.js';
import { isProtected, pickSpawn, protect, squadSpawn } from './spawn.js';

export { STEP, THINK, SENSE, SQUAD, muzzleOf, shoot } from './core.js';

// The team a side plays: 1 the light side (Hoth's defending Rebels), 2 the dark (the attacking Empire).
const SIDES = { 1: 'light', 2: 'dark' };

// How far back from the front's middle each side opens: Hoth's front spawns
// overlap (the stages enable them by turns), so the opening keeps the sides
// apart, by hand, until lane 2's stages choose the spawns.
export const OPENING_GAP = 40;
// A soldier outside its team's bounds this long dies (the HUD counts it down), by hand.
export const OOB_SECONDS = 10;
// A walker's body for the bolts, by hand until lane 4's: a column from the
// ground to its back, as wide as its legs stand.
export const WALKER_BODY = { height: 20, radius: 3 };

// Each team's spawns for the opening: by priority, then nearest the middle of
// the front (between the two teams' enabled spawns nearest each other), only
// those on the team's own side and at least OPENING_GAP from the middle.
function openingSpawns(map) {
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const xz = (s) => [s.at[0], s.at[2]];
  const points = (team) => spawnsFor(map, { mode: 'galacticAssault', team }).filter((s) => s.at);
  const all = { 1: points(1), 2: points(2) };
  const live = (t) => (all[t].some((s) => s.enabled) ? all[t].filter((s) => s.enabled) : all[t]);
  let best = null;
  for (const a of live(1)) for (const b of live(2)) if (!best || d(xz(a), xz(b)) < best.d) best = { a, b, d: d(xz(a), xz(b)) };
  if (!best) return { 1: all[1], 2: all[2] };
  const mid = [(best.a.at[0] + best.b.at[0]) / 2, (best.a.at[2] + best.b.at[2]) / 2];
  const out = {};
  for (const [t, anchor] of [
    [1, best.a],
    [2, best.b],
  ]) {
    const side = [anchor.at[0] - mid[0], anchor.at[2] - mid[1]];
    const mine = all[t].filter((s) => (s.at[0] - mid[0]) * side[0] + (s.at[2] - mid[1]) * side[1] > 0 && d(xz(s), mid) >= OPENING_GAP);
    out[t] = (mine.length ? mine : all[t]).sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0) || d(xz(a), mid) - d(xz(b), mid) || (a.id < b.id ? -1 : 1));
  }
  return out;
}

export function createSim({ rulebook, level = 'hoth', era = 'Orig', nav, seed = 1, teams = null, bots = { 1: 0, 2: 0 }, mode = null, spawns = null, oob = null }) {
  const rb = rulebook;
  const sides = teams ?? (() => {
    const t = teamsFor(rb, level, era);
    return { 1: t[SIDES[1]], 2: t[SIDES[2]] };
  })();
  const sim = {
    rb,
    level,
    era,
    mode,
    nav,
    seed,
    rand: seeded(seed),
    time: 0,
    steps: 0,
    teams: sides,
    entities: new Map(),
    bolts: createBolts(),
    pending: [],
    events: [],
    score: { 1: { kills: 0, deaths: 0 }, 2: { kills: 0, deaths: 0 } },
    nextId: 1,
    out: null,
    brains: null,
    oob,
    stats: new Map(),
  };
  if (mode === 'galacticAssault') {
    sim.ga = createAssault({ rulebook: rb, level });
    sim.bp = createPoints({ rulebook: rb, teams: sides });
    sim.deploying = new Map();
    sim.aimScale = AIM_SCALE;
  } else if (mode) throw new Error(`mode ${mode}: not built`);
  const opening = spawns ?? (sim.ga ? {} : bots[1] || bots[2] ? openingSpawns(mapOf(rb, level)) : {});
  for (const team of [1, 2]) {
    const n = bots[team] ?? 0;
    if (!n) continue;
    const list = opening[team] ?? [];
    const classes = sides[team].classes;
    for (let k = 0; k < n; k++) {
      const sp = sim.ga ? pickSpawn({ map: mapOf(rb, level), ids: spawnSets(sim.ga)[sideOf(sim.ga, team)], team, rand: sim.rand }) : list[k % list.length];
      const at = sp ? [...sp.at] : [0, 0, 0];
      // a second lap of the spawns stands a metre or two off the first
      if (sim.ga || k >= list.length) {
        at[0] += (sim.rand() - 0.5) * 4;
        at[2] += (sim.rand() - 0.5) * 4;
      }
      addSoldier(sim, { team, classId: classes[k % classes.length], at, yaw: sp?.yaw ?? 0, bot: true });
    }
  }
  sim.brains = createBrains(sim);
  if (sim.ga) {
    sim.commanders = {};
    for (const team of [1, 2]) {
      const squads = sim.brains.squads.list.filter((q) => q.team === team);
      sim.commanders[team] = createCommander({ team, side: sideOf(sim.ga, team), ga: sim.ga, squads, bp: sim.bp, rand: sim.rand, nav, rulebook: rb });
    }
    addWalkers(sim);
  }
  return sim;
}

function addSoldier(sim, { team, classId, cls: row = null, at, yaw = 0, bot, id: given = null }) {
  const cls = row ?? classOf(sim.rb, classId);
  const id = given ?? `${bot ? 'b' : 'p'}${sim.nextId++}`;
  // a deploy in a mode lands on the map's main walkable region, never in a pocket the made-up cover walls off
  const spot = sim.nav ? (sim.ga ? nearestMainland(sim.nav, at[0], at[2], 12) : nearestWalkable(sim.nav, at[0], at[2], 12)) : null;
  const where = spot ? [spot[0], 0, spot[1]] : [...at];
  if (sim.nav) where[1] = heightOf(sim, where);
  const s = newSoldier(cls, { id, team, at: where, yaw, rand: sim.rand, bot, weapon: weaponOf(sim.rb, cls.weapon) });
  s.capsules = capsulesOf(s);
  sim.entities.set(id, s);
  if (!sim.stats.has(id)) sim.stats.set(id, { id, team, bot, kills: 0, deaths: 0, captures: 0, arms: 0, cls: cls.id });
  sim.stats.get(id).cls = cls.unitId ?? cls.id;
  return s;
}

// the live stage's walkers as bodies in the battle (the escort objective moves them)
function walkerCapsules(w) {
  const c = { part: 'body', a: [w.at[0], w.at[1] + 1.2, w.at[2]], b: [w.at[0], w.at[1] + WALKER_BODY.height, w.at[2]], r: WALKER_BODY.radius };
  w.capsules = [c, c];
}

function addWalkers(sim) {
  for (const [id, e] of sim.entities) if (e.kind === 'walker') sim.entities.delete(id);
  walkersOf(sim.ga).forEach((w, i) => {
    Object.assign(w, { id: `w${sim.ga.stage + 1}.${i + 1}`, team: sim.ga.attack, state: 'walk', stance: 'stand', vel: [0, 0, 0] });
    if (sim.nav) w.at[1] = heightOf(sim, w.at);
    walkerCapsules(w);
    sim.entities.set(w.id, w);
  });
}

const heightOf = (sim, at) => heightAt(sim.nav, at[0], at[2]);

export function addPlayer(sim, { team, classId, at, yaw = 0 }) {
  const s = addSoldier(sim, { team, classId, at, yaw, bot: false });
  sim.brains?.add?.(s);
  return s.id;
}

// what a team has out: heroes and reinforcements standing, with those chosen this wave
function outOf(sim, team, extra = { heroes: 0, reinforcements: 0 }) {
  const out = { ...extra };
  for (const e of sim.entities.values()) {
    if (e.team !== team || !e.alive) continue;
    if (e.unit === 'hero') out.heroes++;
    if (e.unit === 'reinforcement') out.reinforcements++;
  }
  return out;
}

const enemiesOf = (sim, team) => [...sim.entities.values()].filter((e) => e.alive && e.kind === 'soldier' && e.team !== team).map((e) => [e.at[0], e.at[2]]);

export function deploy(sim, id, choice) {
  const entry = sim.deploying?.get(id);
  if (!entry) return { ok: false, why: 'not deploying' };
  if (sim.ga.phase === 'over') return { ok: false, why: 'over' };
  const team = entry.team;
  const list = offers(sim.bp, id, team, { out: outOf(sim, team) });
  const offer = list.find((o) => o.kind === (choice.kind ?? 'class') && o.id === choice.id);
  if (!offer) return { ok: false, why: 'none' };
  if (offer.available === false) return { ok: false, why: offer.why };
  if (balance(sim.bp, id) < offer.cost) return { ok: false, why: 'points' };
  const enemies = enemiesOf(sim, team);
  let spot = null;
  if (choice.spawn === 'squad') {
    const sq = squadOf(sim.brains.squads, id);
    spot = sq ? squadSpawn({ squad: sq.members.map((m) => sim.entities.get(m)).filter(Boolean), me: id, enemies }) : null;
    if (!spot) return { ok: false, why: 'squad' };
  } else spot = pickSpawn({ map: mapOf(sim.rb, sim.level), ids: spawnSets(sim.ga)[sideOf(sim.ga, team)], team, enemies, rand: sim.rand });
  if (!spot) return { ok: false, why: 'nowhere' };
  buy(sim.bp, id, offer);
  const base = classOf(sim.rb, sim.teams[team].classes[0]);
  let cls = null;
  if (offer.kind === 'class') cls = classOf(sim.rb, offer.id);
  else {
    // a hero or a reinforcement deploys on its own health, as its side's first class until lanes 3 and 4 give it its own kit
    const unit = offer.kind === 'hero' ? heroOf(sim.rb, offer.id) : reinforcementOf(sim.rb, offer.id);
    cls = { ...base, health: unit.health, regen: unit.regen ?? base.regen, unit: offer.kind, unitId: offer.id };
  }
  const at = [...spot.at];
  if (choice.spawn !== 'squad') {
    at[0] += (sim.rand() - 0.5) * 4;
    at[2] += (sim.rand() - 0.5) * 4;
  }
  const s = addSoldier(sim, { team, cls, at, yaw: spot.yaw, bot: entry.bot, id });
  if (cls.unit) {
    s.unit = cls.unit;
    s.unitId = cls.unitId;
  }
  protect(s, sim.time);
  if (entry.bot) {
    // a fresh bot takes its squad's orders at once
    const b = addBrain(sim, s);
    const sq = squadOf(sim.brains.squads, id);
    b.task = (sq?.members ?? []).map((m) => sim.entities.get(m)?.brain?.task).find(Boolean) ?? null;
  }
  if (spot.mate) earn(sim.bp, spot.mate, 'squadSpawn');
  sim.deploying.delete(id);
  emit(sim, { type: 'deploy', id, kind: offer.kind, as: offer.id, spawn: choice.spawn ?? 'point' });
  return { ok: true };
}

export function removeEntity(sim, id) {
  sim.entities.delete(id);
  sim.brains?.remove?.(id);
}

function emit(sim, e) {
  const ev = { t: Math.round(sim.time * 1000) / 1000, ...e };
  sim.events.push(ev);
  sim.out.push(ev);
}

// a direction turned by small yaw and pitch offsets (radians)
function jitter(dir, [dy, dp]) {
  const yaw = Math.atan2(dir[0], dir[2]) + dy;
  const pitch = Math.asin(Math.max(-1, Math.min(1, dir[1]))) + dp;
  const c = Math.cos(pitch);
  return [Math.sin(yaw) * c, Math.sin(pitch), Math.cos(yaw) * c];
}

function release(sim) {
  const later = [];
  for (const p of sim.pending) {
    if (p.at > sim.time + 1e-9) {
      later.push(p);
      continue;
    }
    const s = sim.entities.get(p.owner);
    if (!s?.alive) continue;
    const from = muzzleOf(s);
    const d = [p.aim[0] - from[0], p.aim[1] - from[1], p.aim[2] - from[2]];
    const L = Math.hypot(d[0], d[1], d[2]) || 1;
    const dir = jitter([d[0] / L, d[1] / L, d[2] / L], p.dir);
    const row = s.gun.row;
    fireBolt(sim.bolts, { from, dir, speed: row.firing?.speed ?? 700, range: row.range ?? 200, ttl: row.damage?.timeToLive ?? 3, team: s.team, owner: s.id, weapon: row, colour: row.colour, now: sim.time });
    emit(sim, { type: 'shot', by: s.id });
  }
  sim.pending = later;
}

function applyInput(sim, inp) {
  const s = sim.entities.get(inp.id);
  if (!s?.alive) return;
  if (inp.look != null) s.yaw = inp.look;
  if (inp.crouch != null) s.stance = inp.crouch ? 'crouch' : 'stand';
  s.sprint = !!inp.sprint;
  if (inp.roll && press(s.abilities, 0, sim.time).fired) roll(s, inp.move ?? [Math.sin(s.yaw), Math.cos(s.yaw)], sim.time);
  if (inp.ability) press(s.abilities, inp.ability, sim.time);
  if (inp.vent) vent(s.gun, sim.time);
  if (inp.cool) coolPress(s.gun, sim.time);
  if (s.state !== 'roll') move(s, inp.move ?? [0, 0], STEP, sim.nav);
  if (inp.fire) shoot(sim, s, inp.aim ?? chestAhead(s));
  s.interact = !!inp.interact;
}

const chestAhead = (s) => {
  const c = chestOf(s);
  return [c[0] + Math.sin(s.yaw) * 100, c[1], c[2] + Math.cos(s.yaw) * 100];
};

// a soldier down: the score, the kill, the mode's ticket and the Battle Points
function downed(sim, target, by, part, why = null) {
  sim.score[target.team].deaths++;
  sim.stats.get(target.id).deaths++;
  const killer = by ? sim.entities.get(by) : null;
  if (killer && killer.team !== target.team) {
    sim.score[killer.team].kills++;
    sim.stats.get(killer.id).kills++;
  }
  emit(sim, { type: 'kill', by, target: target.id, part, ...(why ? { why } : {}) });
  if (sim.ga) {
    target.respawn = modeEvent(sim.ga, { type: 'down', side: sideOf(sim.ga, target.team) }).respawn;
    if (killer && killer.team !== target.team) bpKill(sim.bp, { by, target: target.id, now: sim.time, hero: target.unit === 'hero' });
  }
}

function hitWalker(sim, w, e) {
  const damage = w.vulnerable && w.alive ? damageAt(e.bolt.weapon, e.dist) : 0;
  emit(sim, { type: 'hit', by: e.bolt.owner, target: w.id, part: 'body', damage: Math.round(damage * 100) / 100 });
  if (!damage) return;
  w.hp = Math.max(0, w.hp - damage);
  earn(sim.bp, e.bolt.owner, 'objectiveDamage', damage);
  if (w.hp > 0) return;
  w.alive = false;
  earn(sim.bp, e.bolt.owner, 'vehicleKill');
  emit(sim, { type: 'walkerDown', by: e.bolt.owner, target: w.id });
}

function resolveBolts(sim) {
  const bodies = [];
  for (const s of sim.entities.values()) {
    if (!s.alive) continue;
    if (s.kind === 'soldier') capsulesOf(s, s.capsules);
    bodies.push({ id: s.id, team: s.team, alive: true, safe: isProtected(s, sim.time), at: s.at, capsules: s.capsules });
  }
  const t0 = clock();
  const evs = stepBolts(sim.bolts, STEP, { bodies, nav: sim.nav, now: sim.time });
  if (profile.on) profile.bolts += clock() - t0;
  for (const e of evs) {
    if (e.type === 'hit') {
      const target = sim.entities.get(e.target);
      if (target.kind === 'walker') {
        hitWalker(sim, target, e);
        continue;
      }
      const damage = damageAt(e.bolt.weapon, e.dist);
      const r = hurt(target, { damage, part: e.part, by: e.bolt.owner, now: sim.time });
      emit(sim, { type: 'hit', by: e.bolt.owner, target: e.target, part: e.part, damage: Math.round(damage * 100) / 100 });
      if (sim.bp) bpHit(sim.bp, target.id, e.bolt.owner, sim.time);
      if (r === 'down') downed(sim, target, e.bolt.owner, e.part);
    }
  }
  return evs;
}

export function step(sim, inputs = []) {
  sim.out = [];
  sim.time = Math.round((sim.time + STEP) * 1e6) / 1e6;
  sim.steps++;
  for (const inp of inputs) applyInput(sim, inp);
  stepBrains(sim);
  for (const s of sim.entities.values()) {
    if (s.kind !== 'soldier') continue;
    if (s.state === 'roll' && s.alive) move(s, s.rollDir, STEP, sim.nav);
    for (const e of tickSoldier(s, STEP, sim.time)) emit(sim, { ...e, by: s.id });
  }
  release(sim);
  const raw = resolveBolts(sim);
  onEvents(sim, raw);
  if (sim.oob) outOfBounds(sim);
  if (sim.ga) stepMode(sim);
  return sim.out;
}

function outOfBounds(sim) {
  for (const s of sim.entities.values()) {
    const zone = sim.oob[s.team];
    if (!s.alive || s.kind !== 'soldier' || !zone?.length) continue;
    if (zone.some((v) => insidePolygon(v.points, s.at[0], s.at[2]))) {
      s.oobSince = null;
      continue;
    }
    s.oobSince ??= sim.time;
    if (sim.time - s.oobSince < OOB_SECONDS - 1e-9) continue;
    s.hp = 0;
    s.alive = false;
    s.state = 'dying';
    s.diedAt = sim.time;
    s.moving = false;
    downed(sim, s, null, null, 'oob');
  }
}

// the mode's step: corpses to the deploy screen, the waves, the stage file, the points, the orders
function stepMode(sim) {
  const ga = sim.ga;
  for (const [id, s] of sim.entities) {
    if (s.kind !== 'soldier' || s.alive || s.state !== 'down') continue;
    removeEntity(sim, id);
    if (s.respawn) sim.deploying.set(id, { id, team: s.team, bot: s.bot, since: sim.time });
  }
  if (ga.phase !== 'over')
    for (const team of [1, 2]) {
      const c = sim.commanders[team];
      if (!wave(c, sim.time)) continue;
      const chosen = { heroes: 0, reinforcements: 0 };
      const squadPicks = new Map();
      for (const entry of [...sim.deploying.values()]) {
        if (entry.team !== team || !entry.bot) continue;
        const sq = squadOf(sim.brains.squads, entry.id);
        const picks = squadPicks.get(sq) ?? [];
        const squadClasses = [...picks, ...(sq?.members ?? []).map((m) => sim.entities.get(m)).filter((m) => m?.alive).map((m) => m.cls.cls)];
        const choice = spend(c, entry.id, { squadClasses, out: outOf(sim, team, chosen) });
        const enemies = enemiesOf(sim, team);
        const mates = (sq?.members ?? []).map((m) => sim.entities.get(m)).filter(Boolean);
        const spawn = squadSpawn({ squad: mates, me: entry.id, enemies }) ? 'squad' : 'point';
        let r = deploy(sim, entry.id, { ...choice, spawn });
        if (!r.ok) r = deploy(sim, entry.id, { kind: 'class', id: sim.teams[team].classes[0], spawn: 'point' });
        if (!r.ok) continue;
        if (choice.kind === 'hero') chosen.heroes++;
        if (choice.kind === 'reinforcement') chosen.reinforcements++;
        picks.push(sim.entities.get(entry.id).cls.cls);
        squadPicks.set(sq, picks);
      }
    }
  const soldiers = [];
  const alive = { attack: 0, defend: 0 };
  for (const s of sim.entities.values()) {
    if (s.kind !== 'soldier' || !s.alive) continue;
    const side = sideOf(ga, s.team);
    alive[side]++;
    soldiers.push({ id: s.id, side, at: s.at, alive: true, interact: !!s.interact });
  }
  const stage = ga.stage;
  for (const e of tickMode(ga, STEP, { soldiers, alive })) {
    emit(sim, e);
    if (e.type === 'objective' && e.kind === 'capture') for (const o of ga.objectives) if (o.name === e.name) for (const id of o.inside.attack) sim.stats.get(id).captures++;
    if (e.type === 'armed') for (const o of ga.objectives) if (o.name === e.name) for (const i of o.interactions) sim.stats.get(i.id).arms++;
  }
  if (ga.stage !== stage) {
    addWalkers(sim);
    for (const c of Object.values(sim.commanders)) c.nextAssign = 0;
  }
  for (const w of walkersOf(ga)) {
    if (sim.nav) w.at[1] = heightOf(sim, w.at);
    walkerCapsules(w);
  }
  // a second on a moving meter, or at a prop being armed, defused or called, is worth its points
  if (ga.phase === 'live')
    for (const o of ga.objectives) {
      if (o.type === 'capture' && o.moving) for (const id of o.inside[o.moving]) earn(sim.bp, id, 'objectiveTick', STEP);
      for (const i of o.interactions ?? []) earn(sim.bp, i.id, 'objectiveTick', STEP);
    }
  for (const team of [1, 2]) {
    const c = sim.commanders[team];
    if (sim.time + 1e-9 >= c.nextAssign) assign(c, { entities: [...sim.entities.values()], now: sim.time });
  }
}

export function drain(sim) {
  const out = sim.events;
  sim.events = [];
  return out;
}

export function view(sim, { player = null } = {}) {
  const v = (sim.view ??= { time: 0, teams: { 1: { alive: 0, dead: 0, kills: 0 }, 2: { alive: 0, dead: 0, kills: 0 } }, entities: [], bolts: [] });
  v.time = sim.time;
  for (const t of [1, 2]) {
    v.teams[t].alive = 0;
    v.teams[t].dead = 0;
    v.teams[t].kills = sim.score[t].kills;
  }
  let i = 0;
  for (const s of sim.entities.values()) {
    const e = (v.entities[i++] ??= {});
    v.teams[s.team][s.alive ? 'alive' : 'dead']++;
    e.id = s.id;
    e.team = s.team;
    e.kind = s.kind;
    e.at = s.at;
    e.yaw = s.yaw;
    e.hp = s.hp;
    e.hpMax = s.hpMax;
    e.state = s.state;
    e.stance = s.stance;
    e.moving = s.moving;
    e.aim = s.aim ?? null;
    e.firing = s.gun ? sim.time - s.gun.lastShot < 0.2 : false;
    e.heat = s.gun?.heat ?? 0;
    e.mode = s.brain?.intent?.mode ?? null;
    e.unit = s.unit ?? null;
    e.points = sim.bp ? balance(sim.bp, s.id) : 0;
    e.oob = s.oobSince != null ? Math.max(0, OOB_SECONDS - (sim.time - s.oobSince)) : null;
  }
  v.entities.length = i;
  let k = 0;
  for (const b of sim.bolts.list) {
    const o = (v.bolts[k++] ??= {});
    o.at = b.at;
    o.dir = b.dir;
    o.colour = b.colour;
  }
  v.bolts.length = k;
  v.mode = sim.ga ? modeView(sim.ga) : null;
  v.deploying = sim.deploying ? [...sim.deploying.keys()] : [];
  // the player's deploy screen: open while they wait, with what their points buy
  const waiting = player && sim.deploying?.get(player);
  v.deploy = waiting ? { open: true, team: waiting.team, points: balance(sim.bp, player), offers: offers(sim.bp, player, waiting.team, { out: outOf(sim, waiting.team) }), timeLeft: 0 } : { open: false };
  return v;
}
