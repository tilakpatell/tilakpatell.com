// Galactic Assault (spec catalogue 6): a state machine over the level's
// stage file. A stage lists its objectives (escorts, uplinks, captures,
// arms, holds) and each side's spawn sets (the areas and points the mode
// prefab's stage ports enable, bf2-re finding 27 §4c); the attackers'
// reinforcements are a kill counter against a quota, topped up at each new
// stage; a stage is won when its objectives are all done at once (an escort
// when any one walker arrives), the round when the last stage is. The
// defenders win when the attackers' quota is spent and their last soldier is
// down, when every walker is destroyed, or when a stage's timer runs out
// uncontested. Pure: the sim hands it who stands where a step and the deaths
// as they happen.
//
//   createAssault({ rulebook, level, stages, map, attackers, teams, setup }) → ga
//   tick(ga, dt, world)    world: { soldiers: [{ id, side, at, alive, interact }], alive: { attack, defend } }
//   onEvent(ga, { type: 'down', side }) → { respawn }      canRespawn(ga, side)
//   spawnSets(ga) → { attack: ids, defend: ids }    spawnPoints(ga) → { attack: ids, defend: ids } | null
//   sideOf(ga, team)    teamOf(ga, side)    protectFor(ga) → seconds of the new stage's spawn-protection window left
//   view(ga) → the HUD's objective bar        force(ga) (tests: every live objective done, the setup over)

import { mapOf, stagesOf, vehicleOf, volumeOf } from '../rulebook.js';
import { BOMBING_RUN, ESCORT_REACH, UPLINK_RANGE, INTERACT_REACH, KINDS, VULNERABLE_SECONDS, insidePolygon } from './objectives.js';

// The staged conquest's clock (`PF_GameMode_Conquest_Staged`'s DelayEntityData
// chain on the world clock, bf2-re finding 19): the round's opening hold, the
// stage-won hold, the next stage's spawn-protection window, and the client's
// stage banner and talking head; `ConditionalFloat 12 / 2`, the respawn hold
// when a stage flips against the ordinary one.
export const HOLDS = { opening: 120, won: 9, window: 6, banner: 7.2, head: 5.8, respawnFlip: 12, respawnNormal: 2 };
export const HOLDS_SOURCE = 'Gameplay/GameModes/FantasyBattles/PF_GameMode_Conquest_Staged#DelayEntityData 120, 9, 6, 7.2, 5.8; ConditionalFloat 12 / 2';
export const STAGE_SETUP = HOLDS.opening;
export const STAGE_PAUSE = HOLDS.won;
// The attackers' reinforcements: a `KillCounterEntityData` a team in
// `PlanetaryBattleStateManager` (`MaxKillCount 65000`, `EnemyWeight 1`,
// `SuicideWeight 1`, `IgnoreAI true`: the game counts players only; here the
// bots stand in for them and count, by hand) against the stage's quota, wired
// in from the level; the graph's `CompareInt 50` and `30` are the
// "reinforcements low" lines the HUD and the commander voice react to. The
// quota and the top-up are not read from the level's graph: by hand, as the
// game plays them.
export const COUNTER = { maxKills: 65000, enemyWeight: 1, suicideWeight: 1, ignoreAI: true, _source: 'Gameplay/GameModes/FantasyBattles/PlanetaryBattleStateManager#KillCounterEntityData' };
export const LOW = [50, 30];
export const LOW_SOURCE = 'Gameplay/GameModes/FantasyBattles/PlanetaryBattleStateManager#CompareIntEntityData.B (50, 30)';
export const TICKETS_START = 90;
export const TICKETS_TOP_UP = 40;

// The BattleAI model's lethality lever in Galactic Assault, by hand (the
// balance's first lever, docs/superpowers/evidence/battlefront-lane2/balance.md):
// both sides' bots aim this much wider than in a skirmish. The AutoPlayer
// model (ai/autoPlayer.js, the sim's default here) reads the server's
// `AP_AimNoiseScale` instead and ignores it.
export const AIM_SCALE = 3;
// The walkers' gunners: the vehicle AI row each walker's gunner fires by
// (ai.json's `vehicles`; lib/battlefront/ai/vehicleBrain.js). Hoth's AT-ATs
// shoot at the uplinks' defenders.
export const GUNNERS = { walker: 'ATAT_AI' };

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

export function createAssault({ rulebook, level = 'hoth', stages = null, map = null, attackers = null, setup = STAGE_SETUP }) {
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
    timer: setup,
    stageTimer: 0,
    tickets: file.ticketsStart ?? TICKETS_START,
    deaths: { attack: 0, defend: 0 },
    low: [],
    protectUntil: -Infinity,
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
export const spawnPoints = (ga) => ga.stages[ga.stage].points ?? null;
// seconds left of the new stage's spawn-protection window (`HOLDS.window` after a stage opens)
export const protectFor = (ga) => Math.max(0, ga.protectUntil - ga.time);
export const canRespawn = (ga, side) => !ga.result && (side === 'defend' || ga.tickets > 0);
export const walkersOf = (ga) => ga.objectives.filter((o) => o.type === 'escort').map((o) => o.walker);

// a death: an attacker's costs a ticket, and only a paid-for death respawns
export function onEvent(ga, e) {
  if (e.type !== 'down') return { respawn: false };
  ga.deaths[e.side] = Math.min(COUNTER.maxKills, ga.deaths[e.side] + (e.suicide ? COUNTER.suicideWeight : COUNTER.enemyWeight));
  if (e.side === 'defend') return { respawn: !ga.result };
  if (ga.result || ga.tickets <= 0) return { respawn: false };
  ga.tickets--;
  // the counter crossing a "reinforcements low" line
  for (const line of LOW)
    if (ga.tickets === line && !ga.low.includes(line)) {
      ga.low.push(line);
      ga.out.push({ type: 'low', tickets: line });
    }
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
  ga.protectUntil = ga.time + HOLDS.window;
  ga.low = ga.low.filter((line) => ga.tickets < line);
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

// a test's shortcut: the opening hold over, every live objective of the stage done
export function force(ga) {
  if (ga.phase === 'setup') ga.timer = 0;
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
    deaths: ga.deaths,
    low: ga.low.length ? ga.low[ga.low.length - 1] : null,
    phase: ga.phase,
    timer: ga.phase === 'live' ? ga.stageTimer : Math.max(0, ga.timer),
    holds: HOLDS,
    result: ga.result,
  };
}
