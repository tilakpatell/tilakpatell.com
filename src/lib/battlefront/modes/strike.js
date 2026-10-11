// Strike (the game's `Domination` layer; UI/Data/GameModes/Domination
// "STRIKE", eight a side): one objective, two rounds with the sides swapped.
// The level wires its settings into the mode's prefab (the map rulebook's
// `inputs`): `DefendingTeam`, and for the bombs (PF_Strike_Bombs) the two
// sites `BombALocation` and `BombBLocation`; the carried objective
// (PF_Strike_CTF) is picked up where PF_Pickup_ObjectiveCTF stands and
// carried to Pf_FlagDropOff. A carrier's death drops it where they fell; left
// lying RETURN_SECONDS it goes home. A round is the attackers' when the
// objective is done, the defenders' when the clock runs out with nothing
// armed or carried; the match the side with more rounds, at one each the
// faster attack. Pure.
//
//   createMode({ rulebook, level, map }) → m      (the map rulebook's rows; throws on an unplaced objective)
//   tick(m, dt, world)   onEvent(m, e)   view(m)   force(m)   and round.js's sideOf, teamOf, spawnSets, walkersOf, canRespawn

import { mapOf } from '../rulebook.js';
import { KINDS } from './objectives.js';
import { STAGE_PAUSE, STAGE_SETUP } from './galacticAssault.js';
import { baseMode, finish, refuseUnplaced, sense, viewOf } from './round.js';

export { canRespawn, sideOf, spawnSets, teamOf, walkersOf } from './round.js';

// PF_Strike_CTF: its StopWatch triggers on FloatEntityData 171's 20 s after
// the objective is dropped, and resets the pickup (its OnPickedUp resets the
// delays): the dropped objective's time before it goes home.
export const RETURN_SECONDS = 20;
// A round's clock and the setup and pause around it: by hand (the mode's
// round timer is a logic graph's; NOTES.md).
export const ROUND_SECONDS = 600;
export const SETUP_SECONDS = STAGE_SETUP;
export const ROUND_PAUSE = STAGE_PAUSE;

const xz = (p) => [p[0], p[2]];
const named = (map, re) => map.prefabs.find((p) => p.mode === 'strike' && re.test(p.name));

function objectivesOf(map) {
  const bombs = named(map, /^PF_Strike_Bombs$/i);
  if (bombs) {
    const sites = ['BombALocation', 'BombBLocation'].map((k) => bombs.inputs?.[k]).filter(Boolean);
    if (sites.length < 2) throw new Error(`Strike can’t start on ${map.level}: PF_Strike_Bombs is not placed (its sites are not wired)`);
    return sites.map((at, i) => KINDS.arm.create({ at: xz(at), name: `bomb ${'AB'[i]}` }));
  }
  const pickup = named(map, /PF_Pickup_ObjectiveCTF/i);
  const drop = named(map, /FlagDropOff/i);
  if (!pickup?.at || !drop?.at) throw new Error(`Strike can’t start on ${map.level}: PF_Strike_CTF’s pickup or drop-off is not placed`);
  return [KINDS.carry.create({ at: xz(pickup.at), to: xz(drop.at), returns: RETURN_SECONDS, name: 'objective' })];
}

export function createMode({ rulebook = null, level = null, map = null }) {
  const m0 = map ?? mapOf(rulebook, level);
  refuseUnplaced(m0, 'strike', 'Strike');
  const prefab = named(m0, /^PF_Strike_(Bombs|CTF)$/i);
  // (no DefendingTeam wired: the light side defends, as Naboo's does)
  const defend = prefab?.inputs?.DefendingTeam ?? 1;
  const m = baseMode({ kind: 'strike', label: 'Strike', map: m0, level, attack: defend === 1 ? 2 : 1, objectives: objectivesOf(m0), setup: SETUP_SECONDS });
  m.stages = [{ id: 'round1' }, { id: 'round2' }];
  m.rounds = [];
  return m;
}

// every death respawns: Strike's sides have no tickets
export const onEvent = (m, e) => ({ respawn: e.type === 'down' && !m.result });

function endRound(m, winner, why) {
  m.rounds.push({ attack: m.attack, winner, why, seconds: ROUND_SECONDS - m.stageTimer });
  m.out.push({ type: 'round', index: m.stage, winner, why });
  if (m.rounds.length < 2) {
    m.phase = 'pause';
    m.timer = ROUND_PAUSE;
    return;
  }
  const wins = (t) => m.rounds.filter((r) => r.winner === t && r.attack === t).length;
  const [a, b] = [wins(1), wins(2)];
  if (a !== b) return finish(m, a > b ? 1 : 2, 'rounds');
  const won = m.rounds.filter((r) => r.winner === r.attack);
  if (won.length === 2 && won[0].seconds !== won[1].seconds) return finish(m, won[0].seconds < won[1].seconds ? won[0].attack : won[1].attack, 'faster');
  finish(m, null, 'draw');
}

// the second round: the sides swap, the objective starts over
function swap(m) {
  [m.attack, m.defend] = [m.defend, m.attack];
  m.stage = 1;
  m.objectives = objectivesOf(m.map);
  m.phase = 'setup';
  m.timer = SETUP_SECONDS;
  m.out.push({ type: 'stage', index: 1, id: 'round2' });
}

export function tick(m, dt, world = { soldiers: [], alive: { attack: 0, defend: 0 } }) {
  m.out = [];
  m.time += dt;
  m.dt = dt;
  if (m.phase === 'over') return m.out;
  if (m.phase === 'pause') {
    m.timer -= dt;
    if (m.timer <= 1e-9) swap(m);
    return m.out;
  }
  if (m.phase === 'setup') {
    m.timer -= dt;
    if (m.timer > 1e-9) return m.out;
    m.phase = 'live';
    m.stageTimer = ROUND_SECONDS;
    if (m.stage === 0) m.out.push({ type: 'stage', index: 0, id: 'round1' });
    return m.out;
  }
  sense(m, world.soldiers);
  if (m.objectives.every((o) => o.done)) {
    endRound(m, m.attack, 'objectives');
    return m.out;
  }
  m.stageTimer -= dt;
  if (m.stageTimer <= 0) {
    // (overtime while a bomb is armed or the objective carried)
    if (m.objectives.some((o) => o.armed || o.carrier)) m.stageTimer = 1e-6;
    else endRound(m, m.defend, 'timer');
  }
  return m.out;
}

// a test's shortcut: the objective done
export function force(m) {
  for (const o of m.objectives) o.done = true;
}

export const view = (m) => viewOf(m, { rounds: m.rounds });
