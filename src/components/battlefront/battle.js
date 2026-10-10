// The battle the page plays: lane 1's sim (src/lib/battlefront/sim.js, its
// soldiers, guns, bolts and bots) on a navgrid built from the ground the
// world draws, with what lane 2 will bring held here until it lands: the
// player's deploy screen (deploying until they pick, again after each
// death), the stage's line and objectives, the kill log, the end of the
// round when the check forces it. Lane 2's `mode`, `deploy` and `points`
// replace those pieces; the page reads only `view()`.
//
//   createBattle({ rulebook, level, mode, heightAt, bots, seed, cell }) → battle
//   addPlayer(battle, { team }) → id ; deploy(battle, id, { classId }) → { ok, why? }
//   step(battle, inputs) → events ; view(battle) → the page's view
//   (inputs: the page's { id, move: [right, ahead], yaw, pitch, fire, aim: bool, sprint, crouch, roll, ability, vent })

import { aiOf, classOf, mapOf, pointsOf, stagesOf, stringOf, teamsFor } from '../../lib/battlefront/rulebook.js';
import { buildNav } from '../../lib/battlefront/nav.js';
import { STEP, addPlayer as addSoldier, createSim, removeEntity, step as stepSim, view as viewSim } from '../../lib/battlefront/sim.js';

export { STEP };
export const BOTS = 8; // bots a side on the page (the arena runs 20; the page draws each as a figure)
export const NAV_CELL = 2; // m: the design's navgrid (decision 7)
export const BACK_TO_DEPLOY = 3; // s after the player goes down before the deploy screen comes back
export const KILL_LOG = 6; // lines kept
export const HIT_SHOWN = 1.2; // s a hit's arc is kept for the damage indicator
const AIM_AHEAD = 100; // m ahead the player's aim point is put
const SIDES = { 1: 'light', 2: 'dark' };

// the stage's spawn polygon for a side, its middle; the map's spawn of that
// team nearest it (lane 2's spawn.js picks inside the polygons)
export function spawnFor(map, stage, team, attackers) {
  const side = SIDES[team] === attackers ? 'attack' : 'defend';
  for (const id of stage?.spawns?.[side] ?? []) {
    const p = (map.polygons ?? []).find((q) => q.id === id);
    if (!p?.points?.length) continue;
    const n = p.points.length;
    const [x, z] = p.points.reduce((a, b) => [a[0] + b[0] / n, a[1] + b[1] / n], [0, 0]);
    const s = (map.spawns ?? []).filter((q) => q.team === team).sort((a, b) => Math.hypot(a.at[0] - x, a.at[2] - z) - Math.hypot(b.at[0] - x, b.at[2] - z))[0];
    return s ? { at: s.at.slice(), yaw: s.yaw } : { at: [x, 0, z], yaw: 0 };
  }
  const s = (map.spawns ?? []).filter((q) => q.team === team).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
  return s ? { at: s.at.slice(), yaw: s.yaw } : { at: [0, 0, 0], yaw: 0 };
}

const centreOf = (map, id) => {
  const v = (map.volumes ?? []).find((q) => q.id === id);
  if (!v?.points?.length) return null;
  const n = v.points.length;
  const [x, z] = v.points.reduce((a, b) => [a[0] + b[0] / n, a[1] + b[1] / n], [0, 0]);
  return [x, v.y, z];
};

// the stick (x to the right, y ahead) to the world, facing yaw (+Y up, +Z
// ahead at yaw 0: the right is −X)
export function worldMove([x, y], yaw) {
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  return [y * s - x * c, y * c + x * s];
}

export function createBattle({ rulebook, level = 'hoth', mode = 'galacticAssault', heightAt = () => 0, bots = { 1: BOTS, 2: BOTS }, seed = 1, cell = NAV_CELL, nav = null } = {}) {
  const map = mapOf(rulebook, level);
  const ga = stagesOf(rulebook, level, mode);
  const stage = ga?.stages?.[0] ?? null;
  const grid = nav ?? buildNav({ heightAt, bounds: { min: map.bounds.min, max: map.bounds.max }, cell, cover: aiOf(rulebook).cover.constants });
  const sim = createSim({ rulebook, level, nav: grid, seed, bots });
  let letter = 0;
  const objectives = (stage?.objectives ?? [])
    .filter((o) => o.volume)
    .map((o) => {
      const at = centreOf(map, o.volume);
      return at ? { id: o.volume, type: o.type, name: String.fromCharCode(65 + letter++), meter: 0, at } : null;
    })
    .filter(Boolean);
  return {
    rulebook,
    map,
    ga,
    stage,
    sim,
    nav: grid,
    objectives,
    sides: teamsFor(rulebook, level),
    points: pointsOf(rulebook),
    player: null, // { team, id, state: 'deploying' | 'alive' | 'down', downAt, earned, hits }
    result: null,
    killLog: [],
    names: new Map(),
    force(what, team) {
      if (what === 'win' || what === 'lose') this.result = { winner: what === 'win' ? team : 3 - team, why: 'forced' };
    },
    out: null,
  };
}

export function addPlayer(b, { team = 2 } = {}) {
  b.player = { team, id: null, state: 'deploying', downAt: 0, earned: 0, hits: [] };
  return 'player';
}

export function deploy(b, _id, { classId } = {}) {
  const p = b.player;
  if (!p || p.state !== 'deploying') return { ok: false, why: 'not deploying' };
  const side = b.sides[SIDES[p.team]];
  if (classId && !side.classes.includes(classId)) return { ok: false, why: 'not on offer here' };
  const cls = classId ?? side.classes[0];
  const { at, yaw } = spawnFor(b.map, b.stage, p.team, b.ga?.attackers);
  if (p.id) removeEntity(b.sim, p.id);
  p.id = addSoldier(b.sim, { team: p.team, classId: cls, at, yaw });
  Object.assign(p, { state: 'alive', cls, earned: 0, hits: [] });
  b.names.set(p.id, 'You');
  return { ok: true };
}

const nameOf = (b, id) => b.names.get(id) ?? `Trooper ${String(id).replace(/\D/g, '')}`;

export function step(b, inputs = []) {
  const p = b.player;
  const me = p?.id ? b.sim.entities.get(p.id) : null;
  const mapped = [];
  for (const inp of inputs) {
    if (inp.id !== 'player' || !me?.alive) continue;
    const yaw = inp.yaw ?? me.yaw;
    const pitch = inp.pitch ?? 0;
    const chest = [me.at[0], me.at[1] + 1.4, me.at[2]];
    mapped.push({
      id: me.id,
      move: worldMove(inp.move ?? [0, 0], yaw),
      look: yaw,
      fire: Boolean(inp.fire),
      aim: [chest[0] + Math.sin(yaw) * Math.cos(pitch) * AIM_AHEAD, chest[1] + Math.sin(pitch) * AIM_AHEAD, chest[2] + Math.cos(yaw) * Math.cos(pitch) * AIM_AHEAD],
      crouch: Boolean(inp.crouch),
      sprint: Boolean(inp.sprint),
      roll: Boolean(inp.roll),
      ability: inp.ability || 0,
      vent: Boolean(inp.vent),
    });
  }
  const events = stepSim(b.sim, mapped);
  const t = b.sim.time;
  for (const e of events) {
    if (e.type === 'kill') {
      const killer = b.sim.entities.get(e.by);
      const victim = b.sim.entities.get(e.target);
      b.killLog.push({ id: `${t}:${e.target}`, killer: nameOf(b, e.by), killerTeam: killer?.team, victim: nameOf(b, e.target), victimTeam: victim?.team });
      if (b.killLog.length > KILL_LOG) b.killLog.shift();
      if (p && e.by === p.id) p.earned += b.points.earn?.kill ?? 0;
    }
    if (e.type === 'hit' && p && e.target === p.id) {
      const by = b.sim.entities.get(e.by);
      const angle = by && me ? Math.atan2(-(by.at[0] - me.at[0]), by.at[2] - me.at[2]) - me.yaw : 0;
      p.hits.push({ id: `${t}:${e.by}`, angle: -angle, t });
    }
  }
  if (p) {
    p.hits = p.hits.filter((h) => t - h.t < HIT_SHOWN);
    if (p.state === 'alive' && me && !me.alive) {
      p.state = 'down';
      p.downAt = t;
    }
    if (p.state === 'down' && t - p.downAt >= BACK_TO_DEPLOY) p.state = 'deploying';
  }
  return events;
}

function offers(b, team) {
  const side = b.sides[SIDES[team]];
  const cost = b.points.cost;
  const reinf = b.rulebook.reinforcements;
  return [
    ...side.classes.map((id) => ({ kind: 'class', id, cls: classOf(b.rulebook, id).cls, cost: 0 })),
    ...(side.reinforcements ?? []).map((id) => ({ kind: 'reinforcement', id, reinforcementKind: reinf[id]?.kind, cost: cost[reinf[id]?.kind] ?? 0 })),
    ...(side.heroes ?? []).map((id) => ({ kind: 'hero', id, cost: cost.heroes?.[id] ?? cost.heroes?.default ?? 0 })),
  ];
}

export function view(b) {
  const v = viewSim(b.sim);
  const t = b.sim.time;
  for (const e of v.entities) {
    const s = b.sim.entities.get(e.id);
    e.vel = [s?.vel?.[0] ?? 0, s?.vel?.[2] ?? 0];
    e.t = t;
  }
  const p = b.player;
  const me = p?.id ? b.sim.entities.get(p.id) : null;
  const gun = me?.gun;
  const heat = gun?.row?.heat;
  const out = (b.out ??= {});
  out.time = t;
  out.entities = v.entities;
  out.bolts = v.bolts;
  out.teams = v.teams;
  out.points = 0;
  out.deploy = { open: p?.state === 'deploying', offers: p ? offers(b, p.team) : [], team: p?.team ?? 2 };
  out.player = p && {
    id: p.id ?? 'player',
    team: p.team,
    state: p.state,
    at: me ? me.at : [0, 0, 0],
    yaw: me?.yaw ?? 0,
    hp: me?.hp ?? 0,
    hpMax: me?.hpMax ?? 1,
    heat: gun?.heat ?? 0,
    overheated: gun?.state === 'overheated' || gun?.state === 'venting',
    warning: heat?.warning ?? 0.75,
    coolWindow: heat?.cooling?.window ? [...heat.cooling.window].sort((x, y) => x - y) : null,
    cls: p.cls ?? null,
    weapon: gun?.row?.id ?? null,
    earned: p.earned,
    hits: p.hits.map((h) => ({ id: h.id, angle: h.angle, age: t - h.t })),
  };
  const attacking = p ? SIDES[p.team] === b.ga?.attackers : true;
  out.mode = b.stage ? { stage: 0, stageName: stringOf(b.rulebook, attacking ? b.stage.name : b.stage.nameDefend), objectives: b.objectives, tickets: b.stage.tickets ?? null, result: b.result } : null;
  out.killLog = b.killLog;
  out.scoreboard = Object.fromEntries(
    [1, 2].map((team) => [team, { name: SIDES[team] === 'dark' ? 'EMPIRE' : 'REBELS', rows: [...b.sim.entities.values()].filter((s) => s.team === team).map((s) => ({ id: s.id, name: nameOf(b, s.id), kills: 0, deaths: s.alive ? 0 : 1, points: 0 })) }]),
  );
  return out;
}
