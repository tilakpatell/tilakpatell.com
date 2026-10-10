// Starfighter Assault from the game's space levels (the flow design's
// decision 4: docs/superpowers/specs/2026-10-10-battlefront-flow-and-mods-
// design.md; the plan: docs/superpowers/plans/2026-10-10-bf-flow-laneA-
// starfighter.md). Pure: the level's map rulebook (src/data/bf2017/maps/
// <level>.json, its `spaceBattle`, `placed`, `prefabs` and `spawns`) and its
// hand stages (<level>.stages.json) made into what the galaxy's Fleet
// Assault sim fights (universe/battle.js, run by universe/battleDirector.js):
//
// - levelOf(map, stages) → the level in its own metres: its capital ships
//   ({ id, team, kind, role, name, at, fwd }: the battle's teams, 0 the
//   defender's Rebels, 1 the attacking Empire, from the game's Team1 and
//   Team2; `size` in units where the level's ship is no galaxy kind's
//   length), its stages and their objectives each where the level puts it
//   (the corvettes on their ships, the mines at their prefabs, the MC80's
//   nodules and engines at the parts the mode's sub-level places), its
//   launch points by team, its fighters and bomber flights, its camera, and
//   the galaxy's stations it stands in place of (`hides`).
// - frameOf(level, at) → (metres) → the battle's units: the level's origin
//   at `at`, 53.3 m to a unit (galaxy/battles.js's scale, the Star
//   Destroyer's 1,600 m 30 units), not turned (the level's +Z is the
//   galaxy's).
// - layoutOf(level, frame) → createBattle's `layout`: each side's ships, the
//   flagship first, at the level's spots and headings.
// - starfighterPlan(level, frame, { id, length }) → the director's plan:
//   five stages (the corvettes, the mines, the MC80's top, beneath and its
//   engines), each opening no sooner than its gate, the MC80 breaking up at
//   the last; the TIE bomber flights as the attacker's waves; the final push
//   and the defender's reserve as the galaxy's battles have them.
// - shipsClear(battle, avoid) → the capital ships that stand inside one
//   another or inside the planet's, the station's or the shield's solids
//   (the starfighter test holds it empty).
//
// galaxy/battles.js's layStarfighter lays it at the planet (where the war's
// battle would be, clear of what's built round it) and galaxy/warfront.js
// fights it in place of the war's own while it's on.

import { PLAN } from '../../../universe/battlePlan';

export const METRES = 53.3; // a battle unit in metres (galaxy/battles.js's M)

// how big each kind of the level's objectives is to shoot at, in units (at most)
const REACH = { corvette: 1.7, mine: 0.9, nodule: 1.4, engines: 1.8 };

// a vector turned by a quaternion [x, y, z, w]
function turn([x, y, z, w], [vx, vy, vz]) {
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
}

// the game's Team1 and Team2 as the battle's teams (the sides' order: the light side's 0, the dark side's 1, as gcw.js's teamsOf)
const teamOf = (gameTeam) => gameTeam - 1;

export function levelOf(map, stages) {
  const rows = map.rows ?? map;
  const placed = rows.placed?.starfighter ?? [];
  const prefabs = new Map(rows.prefabs.map((p) => [p.id, p]));
  // (`mesh#n`: the nth of that mesh the sub-level places, in its order, where it places more than one: Kamino's two Venators)
  const part = (name) => {
    const [mesh, n = 0] = name.split('#');
    return placed.filter((p) => p.mesh === mesh)[Number(n)] ?? null;
  };
  // where a ship or an objective is, and which way it faces (the game's
  // meshes have their bows to +Z; a prefab says only its yaw)
  const spotOf = (o) => {
    if (o.placed) {
      const p = part(o.placed);
      if (!p) throw new Error(`${o.id}: no ${o.placed} placed in the level`);
      return { at: p.centre ?? p.at, fwd: turn(p.quat, [0, 0, 1]), r: p.r ?? null };
    }
    const p = prefabs.get(o.prefab);
    if (!p?.at) throw new Error(`${o.id}: no prefab ${o.prefab} in the level`);
    return { at: p.at, fwd: [Math.sin(p.yaw), 0, Math.cos(p.yaw)], r: null };
  };
  // (`pack`: one the level's pack draws, a part the mode's sub-level places; a prefab's ship is the battle's to draw)
  const ships = stages.ships.map((s) => ({ id: s.id, team: teamOf(s.team), kind: s.kind, role: s.role, name: s.name, pack: Boolean(s.placed), ...(s.placed ? { mesh: s.placed.split('#')[0] } : {}), ...(s.length ? { size: +(s.length / METRES).toFixed(2) } : {}), ...spotOf(s) }));
  const shipOf = new Map(ships.map((s) => [s.id, s]));
  const attacker = teamOf(rows.spaceBattle?.attacker ?? 2);
  return {
    level: rows.level,
    origin: stages.origin,
    attacker,
    defender: 1 - attacker,
    // (the sides by team: the game's Team1 is the light side's, as the battle's team 0 is)
    sides: [stages.sides['1'], stages.sides['2']],
    // (the galaxy's stations the level stands in place of: Endor's is the second Death Star's wreckage)
    hides: stages.hides ?? [],
    // (an area of its own, for a level not fought in space: Kamino's, over Tipoca City's sea; levelArea.js)
    area: stages.area ?? null,
    ships,
    stages: stages.stages.map((st) => ({
      ...st,
      objectives: st.objectives.map((o) => {
        const ship = o.ship ? shipOf.get(o.ship) : null;
        if (o.ship && !ship) throw new Error(`${o.id}: no ship ${o.ship}`);
        const spot = ship ?? spotOf(o);
        return { ...o, at: spot.at, r: Math.min(REACH[o.kind] ?? 1, spot.r ? (spot.r / METRES) * 0.6 : Infinity) };
      }),
    })),
    spawns: [0, 1].map((team) => rows.spawns.filter((s) => s.mode === 'starfighter' && teamOf(s.team) === team && s.enabled).map((s) => ({ at: s.at, yaw: s.yaw }))),
    fighters: [0, 1].map((team) => stages.fighters[team + 1]),
    bombers: stages.bombers,
    camera: stages.camera,
  };
}

export const frameOf = (level, at) => (p) => p.map((x, k) => +(at[k] + (x - level.origin[k]) / METRES).toFixed(3));

// each side's ships, its flagship first (layCapitals takes a side's first as its flagship)
export const sideShips = (level, team) => level.ships.filter((s) => s.team === team).sort((a, b) => (a.role === 'flagship' ? 0 : 1) - (b.role === 'flagship' ? 0 : 1));

export function layoutOf(level, frame) {
  return Object.fromEntries([0, 1].map((team) => [team, sideShips(level, team).map((s) => ({ at: frame(s.at), fwd: s.fwd }))]));
}

export function starfighterPlan(level, frame, { id, length = PLAN.length } = {}) {
  const { attacker, defender } = level;
  const fleet = sideShips(level, defender).map((s) => s.id);
  const stages = level.stages.map((st) => ({
    id: st.id,
    type: 'group',
    opensAt: st.opensAt,
    need: st.objectives.length,
    name: st.title,
    nameDefend: st.titleDefend,
    ...(st.breaks ? { breaks: true, why: 'flagship' } : {}),
    objectives: st.objectives.map((o) => ({
      id: o.id,
      type: 'group',
      kind: o.kind,
      name: o.name,
      hp: Math.round(st.hp / st.objectives.length),
      r: +o.r.toFixed(2),
      // (a corvette's objective is the corvette, laid by it and sunk with it; the rest at the level's own points)
      on: o.ship ? { ship: fleet.indexOf(o.ship), at: [0, 0, 0] } : { point: frame(o.at) },
      ...(o.sinks ? { sinks: true } : {}),
    })),
  }));
  const side = level.bombers.map((b) => ({ id: b.id, type: 'wave', team: attacker, at: b.at, n: b.n, travel: 30, name: 'the TIE bomber flight' }));
  const escalations = [
    ...side.map((o) => ({ type: o.type, at: o.at, id: o.id, team: o.team, name: o.name })),
    { type: 'push', at: PLAN.push, name: 'the final push' },
    { type: 'reserve', at: PLAN.push, team: defender, n: PLAN.reserve, name: 'their reserve squadron' },
  ]
    .filter((e) => e.at <= length)
    .sort((p, q) => p.at - q.at);
  return { id, kind: 'starfighter', length, attacker, defender, ai: { tAi: PLAN.tAi }, stages, runners: null, side, losses: [], pinned: 'starfighter', escalations };
}

// the capital ships standing inside one another, or inside a solid round the planet
export function shipsClear(battle, avoid = []) {
  const bad = [];
  const caps = battle.capitals;
  const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
  caps.forEach((a, i) => {
    for (const o of avoid) if (a.spheres.some((sp) => d(sp.c, o.c) < sp.r + o.r)) bad.push(`${a.kind} ${i} in a solid`);
    for (const b of caps.slice(i + 1)) if (a.spheres.some((p) => b.spheres.some((q) => d(p.c, q.c) < p.r + q.r))) bad.push(`${a.kind} ${i} in ${b.kind}`);
  });
  return bad;
}
