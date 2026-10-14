// Galactic Assault (spec catalogue 6): a state machine over the level's
// stage file. A stage lists its objectives (escorts, uplinks, captures,
// arms, holds) and each side's spawn sets; the attackers' tickets fall with
// their deaths and are topped up at each new stage; a stage is won when its
// objectives are all done at once (an escort when any one walker arrives),
// the round when the last stage is. The defenders win when the attackers'
// tickets are gone and their last soldier is down, when every walker is
// destroyed, or when a stage's timer runs out uncontested. Where the map
// rulebook keeps the level's spawn logic (`spawnLogic.galacticAssault`, the
// sub-world's own graph: bf2-re findings/55), the spawn sets are the graph's,
// run as the game runs it: the stage's ports, the escort's lead walker, the
// capture points' owners, the charges spent and the geometry triggers feed
// it each step. The map's interact gates (Hoth's hangar blast doors,
// lib/battlefront/gates.js) unlock as their walker finishes its route and
// open at their panel; an opened gate is the spawn logic's 'opened' and an
// event out (`gate`: the sim joins the navmesh through its doorway). Pure:
// the sim hands it who stands where a step and the deaths as they happen.
//
//   createAssault({ rulebook, level, stages, map, attackers, teams }) → ga
//   tick(ga, dt, world)    world: { soldiers: [{ id, side, at, alive, interact }], alive: { attack, defend } }
//   onEvent(ga, { type: 'down', side }) → { respawn }      canRespawn(ga, side)
//   spawnSets(ga) → { attack: ids, defend: ids }    sideOf(ga, team)    teamOf(ga, side)
//   view(ga) → the HUD's objective bar        force(ga) (tests: every live objective done)

import { mapOf, stagesOf, vehicleOf, volumeOf } from '../rulebook.js';
import { createLogic, enabled, escortLead, fireEvent, portsOf, setInput, setStage, tick as tickLogic } from '../spawnLogic.js';
import { arrive, createGates, openness, tick as tickGates } from '../gates.js';
import { canUse as reachesKeypad } from '../charges.js';
import { BOMBING_RUN, ESCORT_REACH, UPLINK_RANGE, INTERACT_REACH, KINDS, VULNERABLE_SECONDS, insidePolygon } from './objectives.js';

// `PF_GameMode_Conquest_Staged`'s delays: 12 s before the first stage, 6 s between stages.
export const STAGE_SETUP = 12;
export const STAGE_PAUSE = 6;
// The attackers' tickets at the start and the top-up at each later stage:
// the stage file holds none (the graph's counters are not read), so by hand,
// as the game plays them.
export const TICKETS_START = 90;
export const TICKETS_TOP_UP = 40;

// Both sides' bots aim this much wider in Galactic Assault than in a
// skirmish: the battle's lethality, and so how fast the attackers' tickets
// go against how fast a point is taken. The balance's first lever
// (docs/superpowers/evidence/battlefront-lane2/balance.md), by hand.
export const AIM_SCALE = 3;
// The walkers' gunners: the vehicle AI row each walker's gunner fires by
// (ai.json's `vehicles`; lib/battlefront/ai/vehicleBrain.js). Hoth's AT-ATs
// shoot at the uplinks' defenders.
export const GUNNERS = { walker: 'ATAT_AI' };

const SIDE_TEAM = { dark: 2, light: 1 };
// How far a capture point's prefab may stand from the middle of the capture
// volume the stage file names for it, by hand: Hoth's stand 24 m apart (the
// prefab at the gate, the volume in the hangar behind it).
const PREFAB_REACH = 40;

function build(rb, map, stage) {
  return stage.objectives.map((def) => Object.assign(make(rb, map, def), { def }));
}

function make(rb, map, def) {
  const name = def.name ?? null;
  if (def.type === 'escort') {
    const path = map.waypoints.find((w) => w.id === def.waypoints).points;
    return KINDS.escort.create({ path, health: vehicleOf(rb, def.vehicle).health, name });
  }
  if (def.type === 'capture') return KINDS.capture.create({ volume: volumeOf(map, def.volume), name });
  if (def.type === 'hold') return KINDS.hold.create({ volume: volumeOf(map, def.volume), seconds: def.seconds, name });
  if (def.type === 'uplink') {
    const v = volumeOf(map, def.volume);
    return KINDS.uplink.create({ at: KINDS.capture.create({ volume: v }).at, name });
  }
  if (def.type === 'arm') {
    // (a fuel charge the map rulebook reads: its keypad's place, its label, its holds and fuse; else the prefab's place)
    const charge = (map.charges ?? []).find((c) => c.id === def.prefab) ?? null;
    const p = map.prefabs.find((x) => x.id === def.prefab);
    const at = charge?.keypad?.at ?? p.at;
    return KINDS.arm.create({ at: [at[0], at[2]], name: charge?.label ?? name, charge });
  }
  throw new Error(`objective ${def.type}: not a Galactic Assault kind`);
}

// the waypoint a walker has passed on its path (the last one at or behind it)
function passedOf(path, dist) {
  let left = dist;
  for (let i = 1; i < path.length; i++) {
    left -= Math.hypot(path[i][0] - path[i - 1][0], path[i][2] - path[i - 1][2]);
    if (left < -1e-6) return i - 1;
  }
  return path.length - 1;
}

// a point in an oriented box (OBBData: the middle, half sizes, the yaw of its forward)
function insideBox(b, p) {
  const dx = p[0] - b.at[0];
  const dz = p[2] - b.at[2];
  const c = Math.cos(b.yaw);
  const s = Math.sin(b.yaw);
  return Math.abs(dx * c - dz * s) <= b.half[0] && Math.abs(dx * s + dz * c) <= b.half[2] && Math.abs((p[1] ?? b.at[1]) - b.at[1]) <= b.half[1];
}

// the level's spawn logic, fed from the round: the escort's lead, the owners, the charges, the triggers
function feed(ga, soldiers) {
  const L = ga.logic;
  const { vm, spec } = L;
  for (const [id, tracker] of Object.entries(spec.trackers ?? {})) {
    const walkers = tracker.walkers.map((w) => {
      const o = ga.objectives.find((x) => x.type === 'escort' && x.def?.waypoints === w.path);
      return o ? { passed: passedOf(o.path, o.walker.dist), alive: o.walker.alive } : null;
    });
    if (!walkers.some(Boolean)) continue;
    L.lead[id] = escortLead(tracker, walkers, L.lead[id]);
    for (const p of portsOf(vm, 'lead')) if (p.id === id) setInput(vm, p.ref, L.lead[id].lead);
  }
  for (const p of portsOf(vm, 'ownedByTeam2')) {
    const at = ga.map.prefabs.find((x) => x.id === p.id)?.at;
    const o = at && ga.objectives.filter((x) => x.type === 'capture').find((x) => Math.hypot(x.at[0] - at[0], x.at[1] - at[2]) <= PREFAB_REACH);
    if (o) setInput(vm, p.ref, teamOf(ga, o.owner) === 2 && o.done);
  }
  for (const p of portsOf(vm, 'destroyed')) {
    const o = ga.objectives.find((x) => x.type === 'arm' && x.def?.prefab === p.id);
    if (o) setInput(vm, p.ref, o.done);
  }
  for (const [id, n] of Object.entries(spec.nodes)) {
    if (n.type !== 'trigger' || !n.enabled || (n.once && vm.once.has(id))) continue;
    const shapes = n.shapes.map((sid) => ga.map.boxes.find((b) => b.id === sid) ?? ga.map.polygons.find((q) => q.id === sid) ?? ga.map.volumes.find((q) => q.id === sid)).filter(Boolean);
    const hit = soldiers.some((s) => s.alive && (!n.allies || teamOf(ga, s.side) !== n.allies) && shapes.some((sh) => (sh.half ? insideBox(sh, s.at) : insidePolygon(sh.points, s.at[0], s.at[2]))));
    if (hit) fireEvent(vm, `${id}.OnEnter`);
  }
}

// the spawn sets the graph has on: each side's own records and the neutral ones
function logicSets(ga) {
  const { vm, spec } = ga.logic;
  const teamOfRecord = (id) => (ga.map.spawns.find((s) => s.id === id) ?? ga.map.polygons.find((s) => s.id === id))?.team;
  const sets = { attack: [], defend: [] };
  // (the mode prefab's far list is the starfighters', 900 m out: never a soldier's)
  const far = new Set(spec.far ?? []);
  for (const id of Object.keys(spec.enables)) {
    if (far.has(id) || !enabled(vm, id)) continue;
    const team = teamOfRecord(id);
    if (team === undefined) continue;
    if (team === ga.attack || !team) sets.attack.push(id);
    if (team === ga.defend || !team) sets.defend.push(id);
  }
  return sets;
}

export function createAssault({ rulebook, level = 'hoth', stages = null, map = null, attackers = null }) {
  const file = stages ?? stagesOf(rulebook, level, 'galacticAssault');
  const m = map ?? mapOf(rulebook, level);
  const attack = SIDE_TEAM[attackers ?? file.attackers ?? 'dark'];
  const ga = {
    rb: rulebook,
    map: m,
    stages: file.stages,
    ticketsStart: file.ticketsStart ?? TICKETS_START,
    attack,
    defend: attack === 1 ? 2 : 1,
    stage: 0,
    phase: 'setup',
    timer: STAGE_SETUP,
    stageTimer: 0,
    tickets: file.ticketsStart ?? TICKETS_START,
    objectives: [],
    vulnerableUntil: -Infinity,
    time: 0,
    result: null,
    out: [],
    // (the map's interact gates, their state kept through the stages)
    gates: createGates(stages ? [] : (m.gates ?? [])),
  };
  ga.objectives = build(rulebook, m, ga.stages[0]);
  // (the level's own graph, when the stages are the level's own: a test's cut-down list keeps the files' sets)
  const spec = !stages && m.spawnLogic?.galacticAssault;
  if (spec) {
    ga.logic = { spec, vm: createLogic(spec, { stage: 1 }), lead: {} };
    ga.sets = logicSets(ga);
  }
  return ga;
}

export const sideOf = (ga, team) => (team === ga.attack ? 'attack' : 'defend');
export const teamOf = (ga, side) => (side === 'attack' ? ga.attack : ga.defend);
export const spawnSets = (ga) => ga.sets ?? ga.stages[ga.stage].spawns;
export const canRespawn = (ga, side) => !ga.result && (side === 'defend' || ga.tickets > 0);
export const walkersOf = (ga) => ga.objectives.filter((o) => o.type === 'escort').map((o) => o.walker);

// a death: an attacker's costs a ticket, and only a paid-for death respawns
export function onEvent(ga, e) {
  if (e.type !== 'down') return { respawn: false };
  if (e.side === 'defend') return { respawn: !ga.result };
  if (ga.result || ga.tickets <= 0) return { respawn: false };
  ga.tickets--;
  return { respawn: true };
}

const near = (a, b, r) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= r;

// who is in, near or using each live objective
function senseObjectives(ga, soldiers) {
  for (const o of ga.objectives) {
    o.inside = { attack: [], defend: [] };
    o.interactions = [];
    o.near = 0;
  }
  for (const s of soldiers) {
    if (!s.alive) continue;
    const xz = [s.at[0], s.at[2]];
    for (const o of ga.objectives) {
      if (o.volume) {
        if (insidePolygon(o.volume.points, xz[0], xz[1])) o.inside[s.side].push(s.id);
      } else if (o.type === 'escort') {
        if (s.side === 'attack' && near(xz, [o.walker.at[0], o.walker.at[2]], ESCORT_REACH)) o.near++;
      } else if (o.charge ? reachesKeypad(o.charge, s.at) : near(xz, o.at, INTERACT_REACH)) {
        o.inside[s.side].push(s.id);
        if (s.interact) o.interactions.push({ side: s.side, id: s.id, held: true });
      }
    }
  }
}

// the stage's own objectives (uplinks are the defenders' tools): every one done, escorts when any walker is home
function stageState(ga) {
  const escorts = ga.objectives.filter((o) => o.type === 'escort');
  const rest = ga.objectives.filter((o) => o.type !== 'escort' && o.type !== 'uplink');
  const failed = escorts.length > 0 && escorts.every((o) => o.failed);
  const done = !failed && (!escorts.length || escorts.some((o) => o.done)) && rest.every((o) => o.done);
  return { done, failed };
}

function finish(ga, winner, why) {
  ga.result = { winner, why, stage: ga.stage };
  ga.phase = 'over';
  ga.out.push({ type: 'result', ...ga.result });
}

function advance(ga) {
  ga.stage++;
  ga.objectives = build(ga.rb, ga.map, ga.stages[ga.stage]);
  ga.tickets += ga.stages[ga.stage].ticketsTopUp ?? TICKETS_TOP_UP;
  ga.phase = 'live';
  ga.stageTimer = ga.stages[ga.stage].timer ?? 0;
  ga.vulnerableUntil = -Infinity;
  if (ga.logic) setStage(ga.logic.vm, ga.stage + 1);
  ga.out.push({ type: 'stage', index: ga.stage, id: ga.stages[ga.stage].id });
}

export function tick(ga, dt, world = { soldiers: [], alive: { attack: 0, defend: 0 } }) {
  ga.out = [];
  ga.time += dt;
  if (ga.phase === 'over') return ga.out;
  if (ga.phase === 'setup' || ga.phase === 'pause') {
    ga.timer -= dt;
    if (ga.timer > 1e-9) return ga.out;
    if (ga.phase === 'pause') advance(ga);
    else {
      ga.phase = 'live';
      ga.stageTimer = ga.stages[0].timer ?? 0;
      if (ga.logic) setStage(ga.logic.vm, 1);
      ga.out.push({ type: 'stage', index: 0, id: ga.stages[0].id });
    }
    if (ga.logic) ga.sets = logicSets(ga);
    return ga.out;
  }
  senseObjectives(ga, world.soldiers);
  const flying = ga.time < ga.vulnerableUntil;
  const walkers = walkersOf(ga).filter((w) => w.alive);
  for (const o of ga.objectives) {
    const was = { done: o.done, armed: o.armed };
    const open = o.type === 'uplink' && !flying && walkers.some((w) => near([w.at[0], w.at[2]], o.at, UPLINK_RANGE));
    KINDS[o.type].tick(o, dt, { inside: { attack: o.inside.attack.length, defend: o.inside.defend.length }, interactions: o.interactions, near: o.near, open });
    if (o.type === 'uplink' && o.fired) {
      ga.vulnerableUntil = ga.time + VULNERABLE_SECONDS;
      for (const w of walkersOf(ga)) if (w.alive) w.hp = Math.max(0, w.hp - BOMBING_RUN * w.hpMax);
      ga.out.push({ type: 'uplink', name: o.name, by: o.interactions.filter((i) => i.side === 'defend').map((i) => i.id) });
    }
    // (a charge's step: armed, defused, its fuse's sound, detonated; by whoever finished the hold that armed or defused it)
    if (o.type === 'arm') for (const f of o.fired ?? []) ga.out.push({ type: f, name: o.name, id: o.def?.prefab ?? null, by: [...(o.by ?? [])] });
    if (o.done && !was.done) ga.out.push({ type: 'objective', kind: o.type, name: o.name });
    // (a walker home: its route's gate unlocks, the other's is barred)
    if (o.type === 'escort' && o.done && !was.done && o.def?.waypoints) ga.out.push(...arrive(ga.gates, o.def.waypoints));
  }
  for (const e of tickGates(ga.gates, dt, world.soldiers)) {
    ga.out.push(e);
    if (e.state !== 'opened' || !ga.logic) continue;
    for (const p of portsOf(ga.logic.vm, 'opened')) if (p.id === e.id) fireEvent(ga.logic.vm, p.ref);
  }
  for (const w of walkersOf(ga)) w.vulnerable = w.alive && ga.time < ga.vulnerableUntil;
  if (ga.logic) {
    tickLogic(ga.logic.vm, dt);
    feed(ga, world.soldiers);
    ga.sets = logicSets(ga);
  }
  const state = stageState(ga);
  if (state.failed) {
    finish(ga, ga.defend, 'objectives');
    return ga.out;
  }
  if (state.done) {
    if (ga.stage === ga.stages.length - 1) finish(ga, ga.attack, 'objectives');
    else {
      ga.phase = 'pause';
      ga.timer = STAGE_PAUSE;
    }
    return ga.out;
  }
  if (ga.tickets <= 0 && (world.alive?.attack ?? 0) === 0) {
    finish(ga, ga.defend, 'wiped');
    return ga.out;
  }
  if (ga.stageTimer > 0) {
    ga.stageTimer -= dt;
    const contested = ga.objectives.some((o) => o.contested || o.armed);
    if (ga.stageTimer <= 0 && !contested) finish(ga, ga.defend, 'timer');
    else if (ga.stageTimer <= 0) ga.stageTimer = 1e-6;
  }
  return ga.out;
}

// a test's shortcut: every live objective of the stage done
export function force(ga) {
  for (const o of ga.objectives) {
    if (o.type === 'capture') o.meter = 1;
    if (o.type === 'escort') o.walker.dist = o.walker.length;
    if (o.type === 'arm') {
      o.armed = true;
      o.wait = 0;
      o.elapsed = o.rules.fuse;
    }
    if (o.type === 'hold') o.held = o.seconds;
  }
}

export function view(ga) {
  const st = ga.stages[ga.stage];
  return {
    stage: { id: st.id, name: st.name, nameDefend: st.nameDefend, index: ga.stage, count: ga.stages.length },
    objectives: ga.objectives.map((o) => KINDS[o.type].view(o)),
    gates: ga.gates.list.map((g) => ({ id: g.id, state: g.state, open: openness(g) })),
    tickets: ga.tickets,
    phase: ga.phase,
    timer: ga.phase === 'live' ? ga.stageTimer : Math.max(0, ga.timer),
    result: ga.result,
  };
}
