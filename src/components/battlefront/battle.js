// The battle the page plays: the sim (src/lib/battlefront/sim.js, its
// soldiers, guns, bolts and bots) run in its own mode (lane 2's Galactic
// Assault, or any of modes/index.js's), on a navgrid built from the ground
// the world draws. The sim keeps the stages, the objectives, the tickets,
// the walkers, the waves, the Battle Points and the deploy (classes,
// reinforcements and heroes at the record's prices, within the team's
// limits); this file is the page's side of it: the player's deploy screen
// (deploying until they pick, again after each death), the kill log, the
// scoreboard, the end of the round when the check forces it, and the view
// the page reads.
//
//   createBattle({ rulebook, level, mode, heightAt, bots, seed, cell, nav, mask, teams, era, difficulty, instantAction }) → battle   (mode: any of modes/index.js's)
//   (mask: the pack's nav.bin, navMask.js's; one built for another grid is
//   left out, with a warning, and the navgrid is the ground's alone)
//   addPlayer(battle, { team }) → id ; deploy(battle, id, { kind, id, classId, spawn: 'point' | 'squad', mate }) → { ok, why? }
//   (kind 'class' | 'reinforcement' | 'hero', the offer's id; `classId` alone is a class; nothing is the side's first class)
//   (the player keeps one soldier id, PLAYER_ID, life to life, in one squad from the start)
//   step(battle, inputs) → events ; view(battle) → the page's view (each fallen
//   entity's `fall`: { t, part, dir, at, weapon } from its kill, null on the
//   living, and `hitDir`, the shot's way, for the death clip's side)
//   (inputs: the page's { id, move: [right, ahead], yaw, pitch, fire, aim: bool, sprint, crouch, roll, ability, abilityHeld, vent })

import { classOf, mapOf, squadsOf, stagesOf, stringOf, teamsFor } from '../../lib/battlefront/rulebook.js';
import { balance, earnedBy, offers as offersOf } from '../../lib/battlefront/battlePoints.js';
import { buildNav, heightAt } from '../../lib/battlefront/nav.js';
import { STEP, createSim, deploy as deploySim, outOf, squadBlocks, step as stepSim, view as viewSim } from '../../lib/battlefront/sim.js';
import { joinSquad, squadRows } from '../../lib/battlefront/ai/squad.js';
import { aiOf } from '../../lib/battlefront/rulebook.js';
import { hurt } from '../../lib/battlefront/soldier.js';
import { slotsOf } from '../../lib/battlefront/kit.js';
import { charges } from '../../lib/battlefront/abilities.js';
import { modeFor } from '../../lib/battlefront/modes/index.js';
import { KINDS } from '../../lib/battlefront/modes/objectives.js';

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
// team nearest it (the camera's park before the first deploy; the sim's
// spawn.js picks inside the polygons for the deploy itself)
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

// the stick (x to the right, y ahead) to the world, facing yaw (+Y up, +Z
// ahead at yaw 0: the right is −X)
export function worldMove([x, y], yaw) {
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  return [y * s - x * c, y * c + x * s];
}

// where a live objective stands: a walker where it walks, a point or a prop on the ground
function placeOf(nav, o) {
  if (o.walker) return o.walker.at;
  const xz = o.at ?? null;
  if (!xz) return null;
  return [xz[0], nav ? heightAt(nav, xz[0], xz[1]) : 0, xz[1]];
}

// the sim's live objectives as the HUD's markers and bar: lettered in
// order, the walkers left to the world (they are drawn and fought there)
function objectivesOf(b) {
  const ga = b.sim.ga;
  if (!ga) return [];
  const out = [];
  let letter = 0;
  ga.objectives.forEach((o, i) => {
    if (o.type === 'escort') return;
    const at = placeOf(b.sim.nav, o);
    if (!at) return;
    const row = KINDS[o.type]?.view(o) ?? {};
    out.push({ id: o.volume?.id ?? `${ga.stage ?? 0}.${i}`, type: o.type, name: String.fromCharCode(65 + letter++), meter: Math.min(1, Math.abs(row.meter ?? 0)), owner: row.owner ?? null, at });
  });
  return out;
}

export function createBattle({ rulebook, level = 'hoth', mode = 'galacticAssault', heightAt: groundAt = () => 0, bots = { 1: BOTS, 2: BOTS }, seed = 1, cell = NAV_CELL, nav = null, mask = null, teams = null, era = 'Orig', difficulty = null, instantAction = null } = {}) {
  const map = mapOf(rulebook, level);
  if (!modeFor(mode)) throw new Error(`mode ${mode}: not one the game world runs`);
  const file = mode === 'galacticAssault' ? stagesOf(rulebook, level, mode) : null;
  const grid = nav ?? buildNav({ heightAt: groundAt, bounds: { min: map.bounds.min, max: map.bounds.max }, cell, cover: aiOf(rulebook).cover.constants, mask });
  if (mask && !grid.mask) console.warn(`battlefront: the nav mask (${mask.cols} × ${mask.rows} of ${mask.cell} m) is not this map's grid; walking the ground alone`);
  // (teams: { 1, 2 } where the level has no row of its own in teams.json, which holds Hoth's alone)
  // (era, difficulty, instantAction: an Instant Action round's, lib/battlefront/instantAction.js; the game's own where none is asked)
  const sim = createSim({ rulebook, level, era, nav: grid, seed, bots, teams, mode, difficulty, instantAction });
  const b = {
    rulebook,
    map,
    ga: file, // (the stage file: the camera's park reads its first stage's spawns)
    stage: file?.stages?.[0] ?? null,
    sim,
    nav: grid,
    objectives: [],
    sides: teams ? { light: teams[1], dark: teams[2] } : teamsFor(rulebook, level, era),
    level,
    mode,
    player: null, // { team, id, state: 'deploying' | 'alive' | 'down', downAt, earned, hits }
    killLog: [],
    names: new Map(),
    spent: [], // { bolt, until }: the bolts the sim let go of lately, for the drawing (SPENT)
    falls: new Map(), // the fallen's id → how it fell (the kill's part, the shot's way, where it struck, the weapon), for the figures' ragdolls
    force(what, team) {
      if (what === 'win' || what === 'lose') {
        const ga = this.sim.ga;
        ga.result = { winner: what === 'win' ? team : 3 - team, why: 'forced' };
        ga.phase = 'over';
      }
      // (the player down, for the kill screen's check: the next step sees it)
      const me = what === 'die' && this.player?.id ? this.sim.entities.get(this.player.id) : null;
      if (me) hurt(me, { damage: me.hp + 1, now: this.sim.time });
    },
    out: null,
  };
  b.objectives = objectivesOf(b);
  return b;
}

// the player waits on the sim's deploy list (its offers, its points), unless the mode has no respawn left for them
function waitToDeploy(b) {
  const p = b.player;
  const sim = b.sim;
  if (!p || !sim.deploying || sim.deploying.has(p.id)) return;
  const me = sim.entities.get(p.id);
  if (me?.alive || me?.respawn === false) return;
  sim.deploying.set(p.id, { id: p.id, team: p.team, bot: false, since: sim.time });
}

export function addPlayer(b, { team = 2 } = {}) {
  b.player = { team, id: PLAYER_ID, state: 'deploying', downAt: 0, earned: 0, earnedAt: 0, hits: [] };
  b.names.set(PLAYER_ID, 'You');
  const { created } = joinSquad(b.sim.brains.squads, b.sim, PLAYER_ID, team);
  if (created) b.sim.commanders?.[team]?.squads.push(created);
  waitToDeploy(b);
  return 'player';
}

export function deploy(b, _id, { kind = null, id = null, classId = null, spawn = 'point', mate = null, appearance = null } = {}) {
  const p = b.player;
  if (!p || p.state !== 'deploying') return { ok: false, why: 'not deploying' };
  waitToDeploy(b);
  const side = b.sides[SIDES[p.team]];
  const as = kind ? { kind, id } : { kind: 'class', id: classId ?? side.classes[0] };
  // (appearance: a crew kind the Collection keeps, carried to the soldier and its view row)
  const r = deploySim(b.sim, p.id, { ...as, spawn: spawn === 'squad' ? 'squad' : 'point', mate, appearance });
  if (!r.ok) return r;
  Object.assign(p, { state: 'alive', cls: as.id, unit: as.kind, earned: 0, earnedAt: b.sim.bp ? earnedBy(b.sim.bp, p.id) : 0, hits: [] });
  return { ok: true };
}

// Battle Points for the player from outside the battle (a check's door, to
// buy a hero without playing for it): the balance after
export function grant(b, n) {
  const bp = b.sim.bp;
  if (!bp || !b.player) return 0;
  bp.balances.set(b.player.id, balance(bp, b.player.id) + Math.max(0, Number(n) || 0));
  return balance(bp, b.player.id);
}

// (a bot's name is its own from the game's lists, ai/names.js; yours is You)
const nameOf = (b, id) => b.names.get(id) ?? b.sim.entities.get(id)?.name ?? `Trooper ${String(id).replace(/\D/g, '')}`;

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
      aiming: Boolean(inp.aim),
      crouch: Boolean(inp.crouch),
      sprint: Boolean(inp.sprint),
      roll: Boolean(inp.roll),
      ability: inp.ability || 0,
      abilityHeld: inp.abilityHeld || 0,
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
      b.killLog.push({ id: `${t}:${e.target}`, t, killer: nameOf(b, e.by), killerTeam: killer?.team, victim: nameOf(b, e.target), victimTeam: victim?.team });
      if (b.killLog.length > KILL_LOG) b.killLog.shift();
      if (p && e.by === p.id) p.killAt = t;
    }
    // (a hit the player lands: the HUD's hit marker)
    if (e.type === 'hit' && p && e.by === p.id && e.target !== p.id) p.hitAt = t;
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
    // (what this life has earned: the sim's Battle Points, for the kill screen)
    if (b.sim.bp) p.earned = earnedBy(b.sim.bp, p.id) - (p.earnedAt ?? 0);
    const now = b.sim.entities.get(p.id);
    if (p.state === 'alive' && (!now || !now.alive)) {
      p.state = 'down';
      p.downAt = t;
    }
    if (p.state === 'down' && t - p.downAt >= BACK_TO_DEPLOY) {
      p.state = 'deploying';
      waitToDeploy(b);
    }
  }
  return events;
}

// the deploy screen's offers: the sim's (its prices, the team's limits, a
// hero already out), with each class's kind and each reinforcement's
function offers(b, team) {
  const sim = b.sim;
  const reinf = b.rulebook.reinforcements;
  const all = sim.bp ? offersOf(sim.bp, PLAYER_ID, team, { out: outOf(sim, team) }) : b.sides[SIDES[team]].classes.map((id) => ({ kind: 'class', id, cost: 0, available: true }));
  // (what the sim prices but cannot deploy yet, the vehicles until their lane, is left off the screen)
  const list = all.filter((o) => o.why !== 'vehicles');
  return list.map((o) => {
    const row = { ...o };
    if (o.kind === 'class') row.cls = classOf(b.rulebook, o.id).cls;
    if (o.kind === 'reinforcement') row.reinforcementKind = reinf[o.id]?.kind;
    // (a mode without heroes or reinforcements deploys its classes only: Strike, Extraction, Ewok Hunt)
    if (sim.ga?.heroes === false && o.kind !== 'class') Object.assign(row, { available: false, why: 'mode' });
    return row;
  });
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

// the mode's bar: the stage's words for the player's side, the live objectives, the tickets, the result
function modeOf(b, v, p) {
  const m = v.mode;
  if (!m) return null;
  const attacking = p && b.sim.ga && b.sim.M?.sideOf ? b.sim.M.sideOf(b.sim.ga, p.team) === 'attack' : true;
  const stage = m.stage ?? null;
  const words = stage ? stringOf(b.rulebook, attacking ? stage.name : (stage.nameDefend ?? stage.name)) : null;
  return { stage: stage?.index ?? 0, stageName: words, objectives: b.objectives, tickets: m.tickets ?? null, phase: m.phase ?? null, timer: m.timer ?? null, result: m.result ?? null };
}

export function view(b) {
  const v = viewSim(b.sim);
  const t = b.sim.time;
  b.objectives = objectivesOf(b);
  for (const e of v.entities) {
    const s = b.sim.entities.get(e.id);
    e.alive = Boolean(s?.alive);
    e.vel = [s?.vel?.[0] ?? 0, s?.vel?.[2] ?? 0];
    // (an ability's weapon has no mesh of its own yet: the figure keeps its rifle in hand)
    e.weapon = (s?.gunBase ?? s?.gun)?.row?.id ?? null;
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
  out.grenades = v.grenades ?? [];
  out.teams = v.teams;
  out.points = p && b.sim.bp ? balance(b.sim.bp, p.id) : 0;
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
    unit: p.unit ?? null,
    weapon: gun?.row?.id ?? null,
    earned: p.earned,
    hits: p.hits.map((h) => ({ id: h.id, angle: h.angle, age: t - h.t })),
    hitAt: p.hitAt ?? null,
    killAt: p.killAt ?? null,
    // (the three class abilities: the game's state each, the recharge sweep, the charges; kit.js)
    abilities: me ? slotsOf(me) : [],
    shield: me?.shield ? me.shield.hp / me.shield.max : null,
    over: me?.over?.hp ?? 0,
    flashed: me ? (me.flashedUntil ?? -Infinity) > t : false,
    // (seconds of the flash left, for the HUD's white)
    flash: me ? Math.max(0, (me.flashedUntil ?? 0) - t) : 0,
    // (the roll's charges: two a bar, one back every 2 s)
    evade: me ? charges(me.abilities, 0) : 0,
    ability: me?.kitActive?.id ?? null,
  };
  out.mode = modeOf(b, v, p);
  out.killLog = b.killLog;
  const stats = b.sim.stats;
  out.scoreboard = Object.fromEntries(
    [1, 2].map((team) => [
      team,
      {
        name: SIDES[team] === 'dark' ? 'EMPIRE' : 'REBELS',
        rows: [...stats.values()]
          .filter((r) => r.team === team)
          .map((r) => ({ id: r.id, name: nameOf(b, r.id), kills: r.kills, deaths: r.deaths, points: b.sim.bp ? balance(b.sim.bp, r.id) : 0 })),
      },
    ]),
  );
  return out;
}
