// Extraction (Mode5 on Kessel; the Strike/Extraction maps' `Extraction`
// layer on Jabba's palace and Cloud City): the attackers carry the cargo
// (PF_Mode5_Objective_*, where the level places it) through the
// checkpoints the level wires into PF_GameMode_Mode5 (`CheckpointPosition1`
// to `3`), each reached giving the clock its own time (`CP1Overtime` to
// `CP3Overtime`: the time to reach that checkpoint). The cargo's carrier
// down, it lies where they fell until an attacker takes it up again. The
// last checkpoint reached is the attackers' win; the clock out, the
// defenders'. Pure.
//
//   createMode({ rulebook, level, map }) → m
//   tick(m, dt, world)   onEvent(m, e)   view(m)   force(m)   and round.js's sideOf, teamOf, spawnSets, walkersOf, canRespawn

import { mapOf } from '../rulebook.js';
import { KINDS } from './objectives.js';
import { STAGE_SETUP } from './galacticAssault.js';
import { baseMode, finish, refuseUnplaced, sense, viewOf } from './round.js';

export { canRespawn, sideOf, spawnSets, teamOf, walkersOf } from './round.js';

export const SETUP_SECONDS = STAGE_SETUP;
// A checkpoint's time where the level wires none (Kessel's PF_GameMode_Mode5
// takes the prefab's own, which the export leaves empty): by hand, Jabba's
// palace's last (CP3Overtime 300).
export const CHECKPOINT_SECONDS = 300;
// How near a checkpoint the cargo must come, by hand (the export's
// checkpoints are points).
export const CHECKPOINT_RADIUS = 6;

const xz = (p) => [p[0], p[2]];

export function createMode({ rulebook = null, level = null, map = null }) {
  const m0 = map ?? mapOf(rulebook, level);
  refuseUnplaced(m0, 'extraction', 'Extraction');
  const game = m0.prefabs.find((p) => p.mode === 'extraction' && /^PF_GameMode_Mode5$/i.test(p.name));
  const cargo = m0.prefabs.find((p) => p.mode === 'extraction' && /^PF_Mode5_Objective_/i.test(p.name) && p.at);
  const points = [1, 2, 3].map((n) => ({ at: game?.inputs?.[`CheckpointPosition${n}`], seconds: game?.inputs?.[`CP${n}Overtime`] ?? CHECKPOINT_SECONDS })).filter((c) => c.at);
  if (!cargo || !points.length) throw new Error(`Extraction can’t start on ${m0.level}: ${!cargo ? 'the cargo' : 'its checkpoints'} not placed`);
  const checkpoints = points.map((c) => ({ at: xz(c.at), seconds: c.seconds }));
  // (PF_GameMode_Mode5's own interface holds TeamId Team1: the light side carries)
  const m = baseMode({ kind: 'extraction', label: 'Extraction', map: m0, level, attack: game?.inputs?.AttackingTeam ?? 1, setup: SETUP_SECONDS });
  m.checkpoints = checkpoints;
  m.checkpoint = 0;
  m.objectives = [KINDS.carry.create({ at: xz(cargo.at), to: checkpoints[0].at, radius: CHECKPOINT_RADIUS, name: 'cargo' })];
  return m;
}

export const onEvent = (m, e) => ({ respawn: e.type === 'down' && !m.result });

export function tick(m, dt, world = { soldiers: [], alive: { attack: 0, defend: 0 } }) {
  m.out = [];
  m.time += dt;
  m.dt = dt;
  if (m.phase === 'over') return m.out;
  if (m.phase === 'setup') {
    m.timer -= dt;
    if (m.timer > 1e-9) return m.out;
    m.phase = 'live';
    m.stageTimer = m.checkpoints[0].seconds;
    m.out.push({ type: 'stage', index: 0, id: 'extraction' });
    return m.out;
  }
  sense(m, world.soldiers);
  const [cargo] = m.objectives;
  if (cargo.done) {
    m.checkpoint++;
    m.out.push({ type: 'checkpoint', index: m.checkpoint });
    if (m.checkpoint >= m.checkpoints.length) {
      finish(m, m.attack, 'objectives');
      return m.out;
    }
    // (the next checkpoint's time, the cargo still in its carrier's hands)
    cargo.done = false;
    cargo.to = m.checkpoints[m.checkpoint].at;
    m.stageTimer = m.checkpoints[m.checkpoint].seconds;
    return m.out;
  }
  m.stageTimer -= dt;
  if (m.stageTimer <= 0) finish(m, m.defend, 'timer');
  return m.out;
}

export function force(m) {
  m.objectives[0].done = true;
}

export const view = (m) => viewOf(m, { checkpoint: m.checkpoint, checkpoints: m.checkpoints.length });
