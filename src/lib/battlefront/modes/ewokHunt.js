// Ewok Hunt (Mode3 on Endor's village and its night: UI/Data/GameModes/
// EwokHunt "Survive a night on Endor", twenty players): the stormtroopers
// survive the night against the Ewoks, every trooper killed rising again on
// the Ewoks' side. With EXTRACTION_AT of the night left the extraction
// opens at one of the level's two PF_UI_ExtractionPoint_Marker_Mode3 (by
// the seed); a trooper in it when the night ends is the troopers' win. No
// trooper left, or none extracted, is the Ewoks'. Each side on its kit's
// health. Pure.
//
//   createMode({ rulebook, level, map, seed }) → m
//   tick(m, dt, world)   onEvent(m, e) → { respawn, joins? }   view(m)   force(m)   and round.js's sideOf, teamOf, spawnSets, walkersOf, canRespawn

import { seeded } from '../../seeded.js';
import { mapOf } from '../rulebook.js';
import { KINDS } from './objectives.js';
import { STAGE_SETUP } from './galacticAssault.js';
import { baseMode, circle, finish, refuseUnplaced, sense, viewOf } from './round.js';

export { canRespawn, sideOf, spawnSets, teamOf, walkersOf } from './round.js';

// PF_GameMode_Mode3's interface: the night, Float32 480 s
export const ROUND_SECONDS = 480;
// PF_GameMode_Mode3's CompareFloatEntityData 83 (B 121): the extraction's gate opens with this much of the night left
export const EXTRACTION_AT = 121;
// Affector_Mode3Health's MaxHealth 200 (the night's stormtroopers, Assault_Mode3) and Affector_Special_Health_Ewok's 80
export const TROOPER_HEALTH = 200;
export const EWOK_HEALTH = 80;
export const SETUP_SECONDS = STAGE_SETUP;
// The extraction point's size, by hand (its marker has no shape in the export).
export const EXTRACT_RADIUS = 8;

const xz = (p) => [p[0], p[2]];

export function createMode({ rulebook = null, level = null, map = null, seed = 1 }) {
  const m0 = map ?? mapOf(rulebook, level);
  refuseUnplaced(m0, 'ewokHunt', 'Ewok Hunt');
  const points = m0.prefabs.filter((p) => p.mode === 'ewokHunt' && /^PF_UI_ExtractionPoint_Marker_Mode3$/i.test(p.name) && p.at).map((p) => xz(p.at));
  if (!points.length) throw new Error(`Ewok Hunt can’t start on ${m0.level}: no extraction point placed`);
  // (the troopers, the dark side, are the ones with somewhere to get to: the attackers)
  const m = baseMode({ kind: 'ewokHunt', label: 'Ewok Hunt', map: m0, level, attack: 2, setup: SETUP_SECONDS });
  m.extractions = points;
  m.extraction = points[Math.floor(seeded(seed)() * points.length)];
  m.health = { [m.attack]: TROOPER_HEALTH, [m.defend]: EWOK_HEALTH };
  return m;
}

// a trooper killed rises an Ewok; an Ewok killed rises again
export function onEvent(m, e) {
  if (e.type !== 'down') return { respawn: false };
  if (m.result) return { respawn: false };
  return e.side === 'attack' ? { respawn: true, joins: m.defend } : { respawn: true };
}

export function tick(m, dt, world = { soldiers: [], alive: { attack: 0, defend: 0 } }) {
  m.out = [];
  m.time += dt;
  m.dt = dt;
  if (m.phase === 'over') return m.out;
  if (m.phase === 'setup') {
    m.timer -= dt;
    if (m.timer > 1e-9) return m.out;
    m.phase = 'live';
    m.stageTimer = ROUND_SECONDS;
    m.out.push({ type: 'stage', index: 0, id: 'night' });
    return m.out;
  }
  if ((world.alive?.attack ?? 0) === 0) {
    finish(m, m.defend, 'wiped');
    return m.out;
  }
  m.stageTimer -= dt;
  if (!m.objectives.length && m.stageTimer <= EXTRACTION_AT + 1e-9) {
    m.objectives = [KINDS.hold.create({ volume: circle(m.extraction, EXTRACT_RADIUS), seconds: EXTRACTION_AT, name: 'extraction' })];
    m.out.push({ type: 'extraction', at: m.extraction });
  }
  sense(m, world.soldiers);
  if (m.stageTimer <= 1e-9) {
    const out = m.objectives[0]?.inside.attack.length ?? 0;
    finish(m, out ? m.attack : m.defend, out ? 'extracted' : 'timer', { extracted: out });
  }
  return m.out;
}

export function force(m) {
  m.stageTimer = Math.min(m.stageTimer, EXTRACTION_AT);
}

export const view = (m) => viewOf(m, { extraction: m.objectives.length ? m.extraction : null });
