// The battle the page plays: lane 1's sim (src/lib/battlefront/sim.js, its
// soldiers, guns, bolts and bots) on a navgrid built from the ground the
// world draws, with what lane 2 will bring held here until it lands: the
// player's deploy screen (deploying until they pick, again after each
// death), the stage's line and objectives, the kill log, the end of the
// round when the check forces it. Lane 2's `mode`, `deploy` and `points`
// replace those pieces; the page reads only `view()`.
//
//   createBattle({ rulebook, level, mode, heightAt, bots, seed, cell, mask }) → battle
//   (mask: the pack's nav.bin, navMask.js's; one built for another grid is
//   left out, with a warning, and the navgrid is the ground's alone)
//   addPlayer(battle, { team }) → id ; deploy(battle, id, { classId, spawn: 'point' | 'squad', mate }) → { ok, why? }
//   (the player keeps one soldier id, PLAYER_ID, life to life, in one squad from the start)
//   step(battle, inputs) → events ; view(battle) → the page's view (each fallen
//   entity's `fall`: { t, part, dir, at, weapon } from its kill, null on the
//   living, and `hitDir`, the shot's way, for the death clip's side)
//   (inputs: the page's { id, move: [right, ahead], yaw, pitch, fire, aim: bool, sprint, crouch, roll, ability, vent })

import { aiOf, classOf, mapOf, pointsOf, squadsOf, stagesOf, stringOf, teamsFor } from '../../lib/battlefront/rulebook.js';
import { buildNav } from '../../lib/battlefront/nav.js';
import { STEP, addPlayer as addSoldier, createSim, removeEntity, squadBlocks, squadSpot, step as stepSim, view as viewSim } from '../../lib/battlefront/sim.js';
import { joinSquad, squadRows } from '../../lib/battlefront/ai/squad.js';
import { earn } from '../../lib/battlefront/battlePoints.js';

export { STEP };
export const BOTS = 8; // bots a side on the page (the arena runs 20; the page draws each as a figure)
export const NAV_CELL = 2; // m: the design's navgrid (decision 7)
export const BACK_TO_DEPLOY = 3; // s after the player goes down before the deploy screen comes back
export const KILL_LOG = 6; // lines kept
export const HIT_SHOWN = 1.2; // s a hit's arc is kept for the damage indicator
// s a bolt the sim has let go of (a wall, a body, its range) stays in the
// view, `ended` where it stopped, so the page draws it from the gun to there:
// most stop in the step they're fired (700 m/s is 35 m a step). Hand: three
// steps, past fx/bolts.js's CATCH_UP (src/data/bf2017/NOTES.md)
export const SPENT = 0.15;
const AIM_AHEAD = 100; // m ahead the player's aim point is put
export const PLAYER_ID = 'p0'; // the player's soldier in the sim, every life (the sim numbers its own from 1)
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

export function createBattle({ rulebook, level = 'hoth', mode = 'galacticAssault', heightAt = () => 0, bots = { 1: BOTS, 2: BOTS }, seed = 1, cell = NAV_CELL, nav = null, mask = null } = {}) {
  const map = mapOf(rulebook, level);
  const ga = stagesOf(rulebook, level, mode);
  const stage = ga?.stages?.[0] ?? null;
  const grid = nav ?? buildNav({ heightAt, bounds: { min: map.bounds.min, max: map.bounds.max }, cell, cover: aiOf(rulebook).cover.constants, mask });
  if (mask && !grid.mask) console.warn(`battlefront: the nav mask (${mask.cols} × ${mask.rows} of ${mask.cell} m) is not this map's grid; walking the ground alone`);
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
    spent: [], // { bolt, until }: the bolts the sim let go of lately, for the drawing (SPENT)
    falls: new Map(), // the fallen's id → how it fell (the kill's part, the shot's way, where it struck, the weapon), for the figures' ragdolls
    awards: new Map(), // Battle Points the bots earn here, until the page runs lane 2's mode (squad spawns on them)
    force(what, team) {
      if (what === 'win' || what === 'lose') this.result = { winner: what === 'win' ? team : 3 - team, why: 'forced' };
    },
    out: null,
  };
}

export function addPlayer(b, { team = 2 } = {}) {
  b.player = { team, id: PLAYER_ID, state: 'deploying', downAt: 0, earned: 0, hits: [] };
  b.names.set(PLAYER_ID, 'You');
  const { created } = joinSquad(b.sim.brains.squads, b.sim, PLAYER_ID, team);
  if (created) b.sim.commanders?.[team]?.squads.push(created);
  return 'player';
}

export function deploy(b, _id, { classId, spawn = 'point', mate = null } = {}) {
  const p = b.player;
  if (!p || p.state !== 'deploying') return { ok: false, why: 'not deploying' };
  const side = b.sides[SIDES[p.team]];
  if (classId && !side.classes.includes(classId)) return { ok: false, why: 'not on offer here' };
  const cls = classId ?? side.classes[0];
  let { at, yaw } = spawnFor(b.map, b.stage, p.team, b.ga?.attackers);
  let on = null;
  if (spawn === 'squad') {
    const r = squadSpot(b.sim, p.id, p.team, mate);
    if (r.why) return { ok: false, why: r.why };
    ({ at, yaw } = r.spot);
    on = r.spot.mate;
  }
  removeEntity(b.sim, p.id);
  addSoldier(b.sim, { team: p.team, classId: cls, at, yaw, id: p.id });
  Object.assign(p, { state: 'alive', cls, earned: 0, hits: [] });
  // the mate spawned on earns for it: lane 2's points where the sim keeps them, else the page's tally
  if (on && b.sim.bp) earn(b.sim.bp, on, 'squadSpawn');
  else if (on) b.awards.set(on, (b.awards.get(on) ?? 0) + (b.points.earn?.squadSpawn ?? 0));
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
  // (the bolts this step let go of, and the ones shown long enough forgotten)
  b.spent = b.spent.filter((x) => x.until > t + 1e-9);
  for (const bolt of b.sim.bolts.left ?? []) b.spent.push({ bolt, until: t + SPENT });
  for (const e of events) {
    if (e.type === 'kill') {
      b.falls.set(e.target, { t, part: e.part ?? null, dir: e.dir ?? null, at: e.at ?? null, weapon: e.weapon ?? null });
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
  // (a fall is forgotten once the sim has taken the body away, or it stands again)
  for (const id of b.falls.keys()) if (!b.sim.entities.get(id) || b.sim.entities.get(id).alive) b.falls.delete(id);
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

// the deploy screen's squad strip: the side's HQ, then each squadmate and why it cannot be spawned on
function spawns(b, p) {
  const sq = squadsOf(b.rulebook);
  const hq = { kind: 'hq', id: 'hq', name: stringOf(b.rulebook, sq.hq[SIDES[p.team]]) };
  const mates = squadBlocks(b.sim, p.id, p.team).map(({ id, blocked }) => ({
    kind: 'mate',
    id,
    name: nameOf(b, id),
    cls: b.sim.entities.get(id)?.cls?.cls ?? null,
    blocked,
    reason: blocked ? stringOf(b.rulebook, sq.blocked[blocked] ?? sq.blocked.other) : null,
  }));
  return [hq, ...mates];
}

export function view(b) {
  const v = viewSim(b.sim);
  const t = b.sim.time;
  for (const e of v.entities) {
    const s = b.sim.entities.get(e.id);
    e.vel = [s?.vel?.[0] ?? 0, s?.vel?.[2] ?? 0];
    e.weapon = s?.gun?.row?.id ?? null;
    e.t = t;
    // (the view's entities are reused by place: a living one's fall is cleared)
    e.fall = s && !s.alive ? (b.falls.get(e.id) ?? null) : null;
    e.hitDir = e.fall?.dir ?? null;
  }
  // (each bolt's owner and start, for the drawing to leave from its gun:
  // the sim's view lists them in the sim's order)
  const list = b.sim.bolts.list;
  for (let i = 0; i < v.bolts.length; i++) {
    const o = v.bolts[i];
    const sb = list[i];
    o.id = sb?.id ?? null;
    o.owner = sb?.owner ?? null;
    o.from = sb?.from ?? o.at;
    o.travelled = sb?.travelled ?? 0;
    o.speed = sb?.speed ?? null;
    o.ended = false;
  }
  // (then the ones the sim let go of lately, where they stopped: SPENT)
  for (const { bolt, until } of b.spent) {
    if (until <= t + 1e-9) continue;
    const o = (v.bolts[v.bolts.length] ??= {});
    Object.assign(o, { at: bolt.at, dir: bolt.dir, colour: bolt.colour, id: bolt.id, owner: bolt.owner, from: bolt.from, travelled: bolt.travelled, speed: bolt.speed, ended: true });
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
  out.deploy = { open: p?.state === 'deploying', offers: p ? offers(b, p.team) : [], team: p?.team ?? 2, spawns: p ? spawns(b, p) : [] };
  out.squad = p ? squadRows(b.sim.brains.squads, b.sim, p.id, { names: squadsOf(b.rulebook).names.map((n) => stringOf(b.rulebook, n)), nameOf: (id) => nameOf(b, id) }) : null;
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
    [1, 2].map((team) => [team, { name: SIDES[team] === 'dark' ? 'EMPIRE' : 'REBELS', rows: [...b.sim.entities.values()].filter((s) => s.team === team).map((s) => ({ id: s.id, name: nameOf(b, s.id), kills: 0, deaths: s.alive ? 0 : 1, points: b.awards.get(s.id) ?? 0 })) }]),
  );
  return out;
}
