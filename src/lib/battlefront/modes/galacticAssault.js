// Galactic Assault (spec catalogue 6): a state machine over the level's
// stage file. A stage lists its objectives (escorts, uplinks, captures,
// arms, holds) and each side's spawn sets (the areas and points the mode
// prefab's stage ports enable, bf2-re finding 27 §4c; inside the walkers'
// stage the sets walk forward with them, a step a waypoint trigger); the
// attackers' reinforcements are a kill counter against a quota, topped up
// at each new stage; a stage is won when its objectives are all done at
// once (an escort when any one walker arrives), the round when the last
// stage is. The defenders win when the attackers' quota is spent and their
// last soldier is down, when every walker is destroyed, or when a stage's
// timer runs out uncontested. Pure: the sim hands it who stands where a
// step and the deaths as they happen.
//
//   createAssault({ rulebook, level, stages, map, attackers, teams, setup }) → ga
//   tick(ga, dt, world)    world: { soldiers: [{ id, side, at, alive, interact }], alive: { attack, defend } }
//   onEvent(ga, { type: 'down', side }) → { respawn }      canRespawn(ga, side)
//   spawnSets(ga) → { attack: ids, defend: ids }    spawnPoints(ga) → { attack: ids, defend: ids } | null
//   spawnStep(ga) → the stage's spawn step (null: the stage has none)    progressOf(ga) → the game progress, 1…5
//   sideOf(ga, team)    teamOf(ga, side)
//   view(ga) → the HUD's objective bar        force(ga) (tests: every live objective done)

import { mapOf, stagesOf, vehicleOf, volumeOf } from '../rulebook.js';
import { BOMBING_RUN, ESCORT_REACH, UPLINK_RANGE, INTERACT_REACH, KINDS, VULNERABLE_SECONDS, insidePolygon } from './objectives.js';

// The staged conquest's clock: `PF_GameMode_Conquest_Staged`'s DelayEntityData
// on the world clock, each by what the prefab's connections make it do (the
// numbers are bf2-re findings 19 and 27's; the roles are the wiring's):
//   won 6         a stage's "done" input → 6 s → the state manager's next stage: the stage-won hold
//   pickups 9     the round's start (the controller hub's event) → 9 s → the level's first pickups on (Hoth: three ion disruptors)
//   progress 120  the round's start → 120 s → the game progress steps up, once a round (below)
//   banner 7.2, head 5.8   the client's stage banner and talking head
//   state 12 / 2  `ConditionalFloat`: the state manager's follow-on delay, 12 s under the level's flag, else 2
export const HOLDS = { won: 6, pickups: 9, progress: 120, banner: 7.2, head: 5.8, state: [12, 2] };
export const HOLDS_SOURCE = 'Gameplay/GameModes/FantasyBattles/PF_GameMode_Conquest_Staged#DelayEntityData 6, 9, 120, 7.2, 5.8; ConditionalFloatEntityData 12 / 2';
export const STAGE_PAUSE = HOLDS.won;
// Before the first stage: the pre-round is the round controller's
// (`PF_GameMode_Controller`, not read), 12 s by hand.
export const STAGE_SETUP = 12;
// The game progress (`GameProgressEntityData`, an int the prefab keeps
// inside 1…5): the "phase" the server's wave tables are written by
// (`AP_Waves_*_Phase1..5`). It starts at 1 and steps up through four
// run-once splitters: 120 s into the round (or as the first stage is done,
// when that comes sooner), and as each stage is done. So the walkers' stage
// plays at 1 then 2, the second stage at 3, the third at 4, the round's end
// is 5. (Its Math's function, hash 1543335391 over the int, 1 and 5, is read
// as a clamp, by hand.)
export const PROGRESS_MAX = 5;
// The walker reaches a waypoint inside this: `SimpleDriverComponentData.ReachWaypointRadius` (finding 27 §5).
export const WAYPOINT_REACH = 15;
// The attackers' reinforcements: a `KillCounterEntityData` a team in
// `PlanetaryBattleStateManager` (`MaxKillCount 65000`, `EnemyWeight 1`,
// `SuicideWeight 1`, `CountSuicide`, `IgnoreAI` and `IgnoreAIVictims` true:
// the game counts players only; here the bots stand in for them and count,
// by hand) against the stage's quota. The quota and the top-up are wired in
// from the level through maths not read: by hand, as the game plays them.
export const COUNTER = { maxKills: 65000, enemyWeight: 1, suicideWeight: 1, countSuicide: true, ignoreAI: true, ignoreAIVictims: true, _source: 'Gameplay/GameModes/FantasyBattles/PlanetaryBattleStateManager#KillCounterEntityData' };
export const TICKETS_START = 90;
export const TICKETS_TOP_UP = 40;
// A stage's rating: a second after a stage is done the state manager compares
// what its counter moved since the stage's start (`MathIntOp` Subtract of the
// count against its cache): 50 or more shows the defenders "GREAT DEFENSE",
// 30 or fewer shows the attackers "GREAT ATTACK". (Findings 19 and 27 read
// the two compares as warning lines; the wiring fires them at a stage's end.)
// The count is read as the attackers' deaths in the stage, by hand.
export const RATING = {
  defense: { atLeast: 50, string: 'ID_FANTASYBATTLES_OBJECTIVE_GREAT_DEFENSE' },
  attack: { atMost: 30, string: 'ID_FANTASYBATTLES_OBJECTIVE_GREAT_ATTACK' },
  _source: 'Gameplay/GameModes/FantasyBattles/PlanetaryBattleStateManager#CompareIntEntityData.B (A>=B 50, A<=B 30), fired by the stage-done input',
};
export const ratingFor = (spent) => (spent >= RATING.defense.atLeast ? 'defense' : spent <= RATING.attack.atMost ? 'attack' : null);

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
      const o = KINDS.escort.create({ path, health: vehicleOf(rb, def.vehicle).health, name });
      // (the path's id and how far along it each waypoint lies: the spawn steps' marks)
      o.id = def.waypoints;
      o.marks = [0];
      for (let i = 1; i < path.length; i++) o.marks.push(o.marks[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][2] - path[i - 1][2]));
      return o;
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
    spentAt: 0,
    progress: 1,
    progressAt: null,
    stageStart: 0,
    sets: new Map(),
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
export const canRespawn = (ga, side) => !ga.result && (side === 'defend' || ga.tickets > 0);
export const walkersOf = (ga) => ga.objectives.filter((o) => o.type === 'escort').map((o) => o.walker);
export const progressOf = (ga) => Math.max(1, Math.min(PROGRESS_MAX, ga.progress));

// The stage's spawn step: the escort tracker's int, the waypoint triggers the
// leading walker has reached (the tracker keeps a count a walker; which of the
// two it puts out is a select not read: the further one, by hand).
export function spawnStep(ga) {
  const steps = ga.stages[ga.stage].steps;
  if (!steps) return null;
  let k = 0;
  for (const o of ga.objectives) {
    const at = o.type === 'escort' ? steps.at[o.id] : null;
    if (at) k = Math.max(k, at.filter((i) => o.walker.dist >= o.marks[i] - WAYPOINT_REACH).length);
  }
  return Math.min(k, steps.areas.attack.length - 1);
}

// the stage's areas and points now: the step's, with the opening rooms while they are open
function setsNow(ga) {
  const st = ga.stages[ga.stage];
  const k = spawnStep(ga);
  if (k === null) return { areas: st.spawns, points: st.points ?? null };
  const open = !!st.opening && (ga.phase === 'setup' || ga.time - ga.stageStart < st.opening.seconds);
  const key = `${ga.stage}|${k}|${open}`;
  if (!ga.sets.has(key)) {
    const ids = (kind, side) => [...st.steps[kind][side][k].map((n) => `${st.steps.layers[kind]}:${n}`), ...(open ? st.opening[kind][side].map((n) => `${st.opening.layers[kind]}:${n}`) : [])];
    ga.sets.set(key, { areas: { attack: ids('areas', 'attack'), defend: ids('areas', 'defend') }, points: { attack: ids('points', 'attack'), defend: ids('points', 'defend') } });
  }
  return ga.sets.get(key);
}
export const spawnSets = (ga) => setsNow(ga).areas;
export const spawnPoints = (ga) => setsNow(ga).points;

// a death: an attacker's costs a ticket, and only a paid-for death respawns
export function onEvent(ga, e) {
  if (e.type !== 'down') return { respawn: false };
  ga.deaths[e.side] = Math.min(COUNTER.maxKills, ga.deaths[e.side] + (e.suicide ? COUNTER.suicideWeight : COUNTER.enemyWeight));
  if (e.side === 'defend') return { respawn: !ga.result };
  if (ga.result || ga.tickets <= 0) return { respawn: false };
  ga.tickets--;
  return { respawn: true };
}

// the game progress's timed step: once a round
function stepProgress(ga) {
  ga.progressAt = null;
  ga.progress++;
}

// a stage goes live: its clock starts (the rating's count; as the round starts, the opening rooms and the progress's 120 s step)
function startStage(ga) {
  ga.phase = 'live';
  ga.stageTimer = ga.stages[ga.stage].timer ?? 0;
  ga.stageStart = ga.time;
  if (ga.stage === 0) ga.progressAt = ga.time + HOLDS.progress;
  ga.spentAt = ga.deaths.attack;
  ga.out.push({ type: 'stage', index: ga.stage, id: ga.stages[ga.stage].id });
}

// a stage done: the progress steps up (the first stage's done also runs the timed step, when its 120 s have not passed) and the stage is rated
function stageDone(ga) {
  const spent = ga.deaths.attack - ga.spentAt;
  const rating = ratingFor(spent);
  if (ga.progressAt !== null) stepProgress(ga);
  ga.progress++;
  ga.out.push({ type: 'stageDone', index: ga.stage, id: ga.stages[ga.stage].id, spent, rating, string: rating ? RATING[rating].string : null });
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
  ga.vulnerableUntil = -Infinity;
  startStage(ga);
}

export function tick(ga, dt, world = { soldiers: [], alive: { attack: 0, defend: 0 } }) {
  ga.out = [];
  ga.time += dt;
  if (ga.phase === 'over') return ga.out;
  // the game progress's timed step, 120 s after the round's start
  if (ga.progressAt !== null && ga.time >= ga.progressAt - 1e-9) stepProgress(ga);
  if (ga.phase === 'setup' || ga.phase === 'pause') {
    ga.timer -= dt;
    if (ga.timer > 1e-9) return ga.out;
    if (ga.phase === 'pause') advance(ga);
    else startStage(ga);
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
    stageDone(ga);
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
    deaths: ga.deaths,
    progress: progressOf(ga),
    step: spawnStep(ga),
    phase: ga.phase,
    timer: ga.phase === 'live' ? ga.stageTimer : Math.max(0, ga.timer),
    holds: HOLDS,
    result: ga.result,
  };
}
