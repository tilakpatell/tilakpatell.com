// What the other modes share with Galactic Assault's shape (galacticAssault.js):
// the state the sim and the commander read (attack, defend, phase, stage,
// objectives, result, out), each side's spawns from the map rulebook by
// team, the soldiers sensed on the objectives, the end, and the refusal of
// a map whose objectives the extractor could not place. Pure.
//
//   baseMode({ kind, label, map, attack, objectives, level }) → m
//   sideOf(m, team)   teamOf(m, side)   spawnSets(m)   walkersOf(m)   canRespawn(m, side)
//   sense(m, soldiers)   finish(m, winner, why)   viewOf(m, extra)   refuseUnplaced(map, kind, label)

import { INTERACT_REACH, KINDS, insidePolygon } from './objectives.js';

export function refuseUnplaced(map, kind, label) {
  const missing = (map.unplaced ?? []).filter((u) => u.mode === kind);
  if (missing.length) throw new Error(`${label} can’t start on ${map.level}: ${[...new Set(missing.map((u) => u.name))].join(', ')} is not placed (the map rulebook lists it under unplaced)`);
}

const idsOf = (map, kind, team) => [...map.spawns, ...map.polygons].filter((s) => s.mode === kind && s.team === team).map((s) => s.id);

export function baseMode({ kind, label, map, level = null, attack = 2, objectives = [], setup = 12 }) {
  return { kind, label, map, level, attack, defend: attack === 1 ? 2 : 1, phase: 'setup', timer: setup, stageTimer: 0, stage: 0, stages: [{ id: kind, name: null }], objectives, result: null, out: [], time: 0, heroes: false };
}

export const sideOf = (m, team) => (team === m.attack ? 'attack' : 'defend');
export const teamOf = (m, side) => (side === 'attack' ? m.attack : m.defend);
export const spawnSets = (m) => ({ attack: idsOf(m.map, m.kind, m.attack), defend: idsOf(m.map, m.kind, m.defend) });
export const walkersOf = () => [];
export const canRespawn = (m) => !m.result;

// who is in, near, interacting with or able to carry each live objective
export function sense(m, soldiers = []) {
  const carriers = soldiers.filter((s) => s.alive && s.side === 'attack').map((s) => ({ id: s.id, at: [s.at[0], s.at[2]] }));
  for (const o of m.objectives) {
    o.inside = { attack: [], defend: [] };
    o.interactions = [];
    for (const s of soldiers) {
      if (!s.alive) continue;
      const [x, z] = [s.at[0], s.at[2]];
      if (o.volume ? insidePolygon(o.volume.points, x, z) : Math.hypot(x - o.at[0], z - o.at[1]) <= (o.reach ?? INTERACT_REACH)) {
        o.inside[s.side].push(s.id);
        if (s.interact) o.interactions.push({ side: s.side, id: s.id, held: true });
      }
    }
    const was = o.done;
    (o.tick ?? KINDS[o.type]?.tick)?.(o, m.dt ?? 0, { inside: { attack: o.inside.attack.length, defend: o.inside.defend.length }, interactions: o.interactions, carriers });
    if (o.done && !was) m.out.push({ type: 'objective', kind: o.type, name: o.name });
  }
}

export function finish(m, winner, why, extra = {}) {
  m.result = { winner, why, stage: m.stage, ...extra };
  m.phase = 'over';
  m.out.push({ type: 'result', ...m.result });
}

export function viewOf(m, extra = {}) {
  return {
    stage: { id: m.kind, name: m.label, nameDefend: m.label, index: m.stage, count: m.stages.length },
    objectives: m.objectives.map((o) => (o.view ? o.view(o) : KINDS[o.type].view(o))),
    tickets: m.tickets ?? null,
    phase: m.phase,
    timer: m.phase === 'live' ? m.stageTimer : Math.max(0, m.timer),
    result: m.result,
    ...extra,
  };
}

// a circle on XZ as a volume (an extraction point's marker has no shape in the export)
export const circle = (at, r, n = 12) => ({ points: Array.from({ length: n }, (_, i) => [at[0] + r * Math.cos((2 * Math.PI * i) / n), at[1] + r * Math.sin((2 * Math.PI * i) / n)]) });
