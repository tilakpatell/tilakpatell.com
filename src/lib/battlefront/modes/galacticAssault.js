// Galactic Assault (spec catalogue 6): a state machine over the level's
// stage file. A stage lists its objectives (escorts, uplinks, captures,
// arms, holds) and each side's spawn sets; the attackers' tickets fall with
// their deaths and are topped up at each new stage; a stage is won when its
// objectives are all done at once (an escort when any one walker arrives),
// the round when the last stage is. The defenders win when the attackers'
// tickets are gone and their last soldier is down, when every walker is
// destroyed, or when a stage's timer runs out uncontested. Pure: the sim
// hands it who stands where a step and the deaths as they happen.
//
//   createAssault({ rulebook, level, stages, map, attackers, teams }) → ga
//   tick(ga, dt, world)    world: { soldiers: [{ id, side, at, alive, interact }], alive: { attack, defend } }
//   onEvent(ga, { type: 'down', side }) → { respawn }      canRespawn(ga, side)
//   spawnSets(ga) → { attack: ids, defend: ids }    sideOf(ga, team)    teamOf(ga, side)
//   view(ga) → the HUD's objective bar        force(ga) (tests: every live objective done)

import { mapOf, stagesOf, vehicleOf, volumeOf } from '../rulebook.js';
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

const SIDE_TEAM = { dark: 2, light: 1 };

function build(rb, map, stage) {
  return stage.objectives.map((def) => {
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
      const p = map.prefabs.find((x) => x.id === def.prefab);
      return KINDS.arm.create({ at: [p.at[0], p.at[2]], name });
    }
    throw new Error(`objective ${def.type}: not a Galactic Assault kind`);
  });
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
  };
  ga.objectives = build(rulebook, m, ga.stages[0]);
  return ga;
}

export const sideOf = (ga, team) => (team === ga.attack ? 'attack' : 'defend');
export const teamOf = (ga, side) => (side === 'attack' ? ga.attack : ga.defend);
export const spawnSets = (ga) => ga.stages[ga.stage].spawns;
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
      } else if (near(xz, o.at, INTERACT_REACH)) {
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
      ga.out.push({ type: 'stage', index: 0, id: ga.stages[0].id });
    }
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
    if (o.type === 'arm' && o.armed !== was.armed) ga.out.push({ type: o.armed ? 'armed' : 'defused', name: o.name });
    if (o.done && !was.done) ga.out.push({ type: 'objective', kind: o.type, name: o.name });
  }
  for (const w of walkersOf(ga)) w.vulnerable = w.alive && ga.time < ga.vulnerableUntil;
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
      o.fuse = 0;
    }
    if (o.type === 'hold') o.held = o.seconds;
  }
}

export function view(ga) {
  const st = ga.stages[ga.stage];
  return {
    stage: { id: st.id, name: st.name, nameDefend: st.nameDefend, index: ga.stage, count: ga.stages.length },
    objectives: ga.objectives.map((o) => KINDS[o.type].view(o)),
    tickets: ga.tickets,
    phase: ga.phase,
    timer: ga.phase === 'live' ? ga.stageTimer : Math.max(0, ga.timer),
    result: ga.result,
  };
}
