// The battle (spec decisions 3 and 9): a fixed 50 ms step from a seed, in
// Node or the page alike. Entities (soldiers now; heroes and vehicles in
// later lanes), their guns' bolts, hits, deaths, events. Inputs go in as
// plain objects a step, events come out; every random draw is the sim's own
// `rand`, so one seed gives one battle. The bots' brains (ai/) are stepped
// here on a stagger. With a mode (`'galacticAssault'`, or any of
// modes/index.js's: Strike, Extraction, Ewok Hunt, Supremacy's ground) the
// battle also runs it (`modes/galacticAssault.js`'s shape): the fallen are removed
// after `TimeForCorpse` and wait to deploy, bots on their team's wave as
// their commander (`ai/commander.js`) spends their Battle Points, a player
// by `deploy`; the walkers are bodies the bolts hit, open to damage while a
// bombing run lasts, and their gunners fire on the defenders (the mode's
// `GUNNERS`, ai/vehicleBrain.js). Out of bounds, where a team has bounds, kills in
// OOB_SECONDS. A difficulty (`ai/difficulty.js`: 'rookie', 'normal', 'expert'…)
// sets the bots' reaction, aim and their damage to a player, and the
// player's health; `pve` makes the bots the Skirmish (Instant Action) bots,
// with their PvE templates and their abilities (`ai/skirmish.js`). Pure: no
// three.js, no DOM.
//
//   createSim({ rulebook, level, era, nav, seed, teams, bots, mode, spawns, oob, difficulty, pve, instantAction }) → sim
//   deploy(sim, id, { kind, id, spawn: 'point' | 'squad', mate }) → { ok, why }
//   step(sim, inputs = []) → events     inputs: [{ id, move: [x, z], look, fire, aim: [x, y, z], crouch, sprint, roll, ability, abilityHeld, vent, cool }]
//     (the class abilities, kit.js: 'ability' { id, slot, phase, why }, 'throw', 'explosion', 'split', 'turret', 'turretDown',
//     'turretGone'; a blast's hit has part 'blast'; a bot's bolt on a human waits its bucket, ai/buckets.js)
//   addPlayer(sim, { team, classId, at, yaw, id }) → id (in a squad)      removeEntity(sim, id)
//   squadSpot(sim, id, team, mate?) → { spot } | { why }    squadBlocks(sim, id, team) → [{ id, blocked }]
//   view(sim, { player }) → { time, teams, entities, bolts, grenades, mode, deploying, deploy, squad }  (one object, refreshed in place;
//     an entity row carries a bot's `name`, ai/names.js)
//   drain(sim) → the event log so far, cleared

import { seeded } from '../seeded.js';
import { aiOf, classOf, heroOf, mapOf, reinforcementOf, spawnsFor, squadsOf, stringOf, teamsFor, weaponOf } from './rulebook.js';
import { press } from './abilities.js';
import { createBolts, fire as fireBolt, step as stepBolts } from './bolts.js';
import { heightAt, lineClear, nearestMainland, nearestWalkable, walkable } from './nav.js';
import { STEP, clock, muzzleOf, profile, shoot } from './core.js';
import { capsulesOf, chestOf, hurt, move, newSoldier, roll, tick as tickSoldier } from './soldier.js';
import { coolPress, damageAt, vent } from './weapons.js';
import { addBrain, createBrains, onEvents, stepBrains } from './ai/bots.js';
import { assign, createCommander, spend, wave } from './ai/commander.js';
import { changeSides, joinSquad, squadOf, squadRows } from './ai/squad.js';
import { difficultyFor } from './ai/difficulty.js';
import { abilitiesFor } from './ai/skirmish.js';
import { createBuckets, mayHurt } from './ai/buckets.js';
import { createWaves, mayDeploy, stage as stageWaves, unitOpen } from './ai/waves.js';
import { captured, createBotLogic, pickSlot, stepBotLogic } from './ai/botLogic.js';
import { SPREAD, createDealer, dealFor, nextFor, ownerChanged, stepDealer } from './ai/botLogicOverhaul.js';
import { fieldTo } from './navField.js';
import { absorb, createKit, grenadesOf, hurtTurret, onAbility, onRoll, stepKit } from './kit.js';
import { createGunner } from './ai/vehicleBrain.js';
import { balance, buy, createPoints, earn, hit as bpHit, kill as bpKill, offers } from './battlePoints.js';
import { AIM_SCALE, GUNNERS } from './modes/galacticAssault.js';
import { modeFor } from './modes/index.js';
import { insidePolygon } from './modes/objectives.js';
import { blocked, isProtected, pickSpawn, protect, squadSpawn } from './spawn.js';

export { STEP, THINK, SENSE, SQUAD, muzzleOf, shoot } from './core.js';

// The team a side plays: 1 the light side (Hoth's defending Rebels), 2 the dark (the attacking Empire).
const SIDES = { 1: 'light', 2: 'dark' };

// How far back from the front's middle each side opens: Hoth's front spawns
// overlap (the stages enable them by turns), so the opening keeps the sides
// apart, by hand, until lane 2's stages choose the spawns.
export const OPENING_GAP = 40;
// A soldier outside its team's bounds this long dies (the HUD counts it down), by hand.
export const OOB_SECONDS = 10;
// A walker's body for the bolts, by hand until lane 4's: a column from the
// ground to its back, as wide as its legs stand.
export const WALKER_BODY = { height: 20, radius: 3 };

// Each team's spawns for the opening: by priority, then nearest the middle of
// the front (between the two teams' enabled spawns nearest each other), only
// those on the team's own side and at least OPENING_GAP from the middle.
function openingSpawns(map) {
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const xz = (s) => [s.at[0], s.at[2]];
  const points = (team) => spawnsFor(map, { mode: 'galacticAssault', team }).filter((s) => s.at);
  const all = { 1: points(1), 2: points(2) };
  const live = (t) => (all[t].some((s) => s.enabled) ? all[t].filter((s) => s.enabled) : all[t]);
  let best = null;
  for (const a of live(1)) for (const b of live(2)) if (!best || d(xz(a), xz(b)) < best.d) best = { a, b, d: d(xz(a), xz(b)) };
  if (!best) return { 1: all[1], 2: all[2] };
  const mid = [(best.a.at[0] + best.b.at[0]) / 2, (best.a.at[2] + best.b.at[2]) / 2];
  const out = {};
  for (const [t, anchor] of [
    [1, best.a],
    [2, best.b],
  ]) {
    const side = [anchor.at[0] - mid[0], anchor.at[2] - mid[1]];
    const mine = all[t].filter((s) => (s.at[0] - mid[0]) * side[0] + (s.at[2] - mid[1]) * side[1] > 0 && d(xz(s), mid) >= OPENING_GAP);
    out[t] = (mine.length ? mine : all[t]).sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0) || d(xz(a), mid) - d(xz(b), mid) || (a.id < b.id ? -1 : 1));
  }
  return out;
}

export function createSim({ rulebook, level = 'hoth', era = 'Orig', nav, seed = 1, teams = null, bots = { 1: 0, 2: 0 }, mode = null, spawns = null, oob = null, difficulty = null, pve = false, instantAction = null }) {
  const rb = rulebook;
  const sides = teams ?? (() => {
    const t = teamsFor(rb, level, era);
    return { 1: t[SIDES[1]], 2: t[SIDES[2]] };
  })();
  const sim = {
    rb,
    level,
    era,
    mode,
    nav,
    seed,
    rand: seeded(seed),
    time: 0,
    steps: 0,
    teams: sides,
    entities: new Map(),
    bolts: createBolts(),
    pending: [],
    events: [],
    score: { 1: { kills: 0, deaths: 0 }, 2: { kills: 0, deaths: 0 } },
    nextId: 1,
    out: null,
    brains: null,
    oob,
    stats: new Map(),
    difficulty: difficulty ? difficultyFor(difficulty, aiOf(rb)) : null,
    pve: !!pve,
    // (an Instant Action round, instantAction.js's: its AutoPlayers' numbers are the brains' from their making)
    instantAction,
    // (the kit: the class abilities' effects, the grenades in the air; the bots' damage buckets)
    kit: createKit(),
    buckets: createBuckets(),
  };
  if (mode) {
    sim.M = modeFor(mode);
    if (!sim.M) throw new Error(`mode ${mode}: not built`);
    sim.ga = sim.M.create({ rulebook: rb, level, seed });
    sim.bp = createPoints({ rulebook: rb, teams: sides, level, mode });
    sim.deploying = new Map();
    sim.aimScale = AIM_SCALE;
  }
  if (sim.difficulty) sim.aimScale = (sim.aimScale ?? 1) * sim.difficulty.aim.scale;
  const opening = spawns ?? (sim.ga ? {} : bots[1] || bots[2] ? openingSpawns(mapOf(rb, level)) : {});
  for (const team of [1, 2]) {
    const n = bots[team] ?? 0;
    if (!n) continue;
    const list = opening[team] ?? [];
    const classes = sides[team].classes;
    for (let k = 0; k < n; k++) {
      const sp = sim.ga ? pickSpawn({ map: mapOf(rb, level), ids: sim.M.spawnSets(sim.ga)[sim.M.sideOf(sim.ga, team)], team, rand: sim.rand, mode }) : list[k % list.length];
      const at = sp ? [...sp.at] : [0, 0, 0];
      // a second lap of the spawns stands a metre or two off the first
      if (sim.ga || k >= list.length) {
        at[0] += (sim.rand() - 0.5) * 4;
        at[2] += (sim.rand() - 0.5) * 4;
      }
      addSoldier(sim, { team, classId: classes[k % classes.length], at, yaw: sp?.yaw ?? 0, bot: true });
    }
  }
  sim.brains = createBrains(sim);
  if (sim.ga) {
    sim.commanders = {};
    for (const team of [1, 2]) {
      const squads = sim.brains.squads.list.filter((q) => q.team === team);
      sim.commanders[team] = createCommander({ team, side: sim.M.sideOf(sim.ga, team), ga: sim.ga, squads, bp: sim.bp, rand: sim.rand, nav, rulebook: rb });
    }
    if (sim.instantAction) roundIn(sim);
    addWalkers(sim);
  }
  return sim;
}

function addSoldier(sim, { team, classId, cls: row = null, at, yaw = 0, bot, id: given = null }) {
  const base = row ?? classOf(sim.rb, classId);
  // (a mode that sets each side's health: Ewok Hunt's troopers and Ewoks)
  const cls = sim.ga?.health?.[team] ? { ...base, health: sim.ga.health[team] } : base;
  const id = given ?? `${bot ? 'b' : 'p'}${sim.nextId++}`;
  // a deploy in a mode lands on the map's main walkable region, never in a pocket the made-up cover walls off
  const spot = sim.nav ? (sim.ga ? nearestMainland(sim.nav, at[0], at[2], 12) : nearestWalkable(sim.nav, at[0], at[2], 12)) : null;
  const where = spot ? [spot[0], 0, spot[1]] : [...at];
  if (sim.nav) where[1] = heightOf(sim, where);
  // (every soldier carries its class's abilities: a player presses them, a Skirmish bot's brain does, an AutoPlayer's the turret alone)
  const abilities = cls.abilities ? { abilities: abilitiesFor(sim.rb, cls) } : {};
  const s = newSoldier(cls, { id, team, at: where, yaw, rand: sim.rand, bot, weapon: weaponOf(sim.rb, cls.weapon), ...abilities });
  s.kit = sim.kit;
  // (the difficulty's health for a player)
  if (!bot && sim.difficulty && sim.difficulty.health !== 1) s.hp = s.hpMax = s.hpMax * sim.difficulty.health;
  s.capsules = capsulesOf(s);
  sim.entities.set(id, s);
  if (!sim.stats.has(id)) sim.stats.set(id, { id, team, bot, kills: 0, deaths: 0, captures: 0, arms: 0, cls: cls.id });
  sim.stats.get(id).cls = cls.unitId ?? cls.id;
  sim.stats.get(id).team = team;
  return s;
}

// A team's wave table in an Instant Action round: the command posts' one, or an objective mode's by the side it plays and the stage
const waveTable = (sim, team) => {
  const r = sim.instantAction;
  return r.wavesBy ? r.wavesBy[sim.M.sideOf(sim.ga, team)][Math.min(sim.ga.stage ?? 0, r.wavesBy.attack.length - 1)] : r.waves[team];
};

// A round's length and rate on a battle: the Battle Points' rate, and on a mode that counts
// reinforcements (Supremacy's ground) how many a side has and how fast the side behind bleeds
export function applyRound(sim, round) {
  if (sim.bp) sim.bp.rate = round.bpRate;
  const m = sim.ga;
  if (m?.tickets) for (const k of Object.keys(m.tickets)) m.tickets[k] = round.tickets;
  if (m?.bleedEvery) m.bleedEvery /= round.bleed;
}

// An Instant Action round's hold on the battle (instantAction.js): each side's caps are its commander's
// (the bots') and the offers' (the side's), and its AutoPlayers' waves bring its fallen back
function roundIn(sim) {
  const r = sim.instantAction;
  applyRound(sim, r);
  sim.bp.limits = {};
  sim.waves = {};
  for (const team of [1, 2]) {
    const k = r.caps[team];
    sim.commanders[team].caps = { heroes: k.heroes.bots, reinforcements: k.reinforcements.bots };
    sim.bp.limits[team] = { heroesPerTeam: k.heroes.max, reinforcementsPerTeam: k.reinforcements.max };
    sim.waves[team] = createWaves(waveTable(sim, team), sim.time);
  }
  if (!r.botLogic || !postsOf(sim).length) return;
  // (the way to each post, found once here and not in the step its first bots are sent: navField.js)
  if (sim.nav) for (const o of postsOf(sim)) fieldTo(sim.nav, o.at);
  if (r.botLogic.kind === 'overhaul') {
    // (the Overhaul's: one dealer for both sides, ai/botLogicOverhaul.js; no bot has a post before its first deal)
    if (postsOf(sim).length !== 5) throw new Error(`Instant Action: the Overhaul's table is of five posts, and ${sim.level} has ${postsOf(sim).length}`);
    sim.botLogic = { kind: 'overhaul', owners: ownersOf(sim), dealer: createDealer(sim.time) };
    // (its spread: each side's aim noise scale, first drawn a tenth of a second in)
    if (r.botLogic.spread) sim.aimSpread = { 1: 1, 2: 1, next: sim.time + 0.1 };
    for (const s of sim.entities.values()) if (s.bot && s.brain) s.brain.task = holdTask(sim, s);
    return;
  }
  // (on command posts the bots take their posts from the game's bot logic, a logic a side: ai/botLogic.js)
  sim.botLogic = { kind: 'game', owners: postsOf(sim).map((o) => o.owner), 1: null, 2: null };
  for (const team of [1, 2]) sim.botLogic[team] = createBotLogic({ team, rand: sim.rand, timers: r.botLogic.timers });
  for (const s of sim.entities.values()) if (s.bot && s.brain) s.brain.task = postTask(sim, s.team, 'spawn');
}

// The command posts as the bot logic's slots, A to E in their order: each enabled, its owner's team
// (0 no one's), whether it is being captured, and its progress toward team 1
const postsOf = (sim) => (sim.ga.objectives ?? []).filter((o) => o.type === 'capture');
function slotsOf(sim) {
  const attack = sim.ga.attack;
  const teamOf = (side) => (side === 'attack' ? attack : side === 'defend' ? 3 - attack : 0);
  return postsOf(sim).map((o) => ({ enabled: true, owner: teamOf(o.owner), beingCaptured: o.contested || (o.moving !== null && o.moving !== o.owner), progress: attack === 1 ? o.meter : -o.meter }));
}

// each post's team, A to E (0 no one's)
const ownersOf = (sim) => slotsOf(sim).map((p) => p.owner);

// a bot's order to a post, within the round's radius of it
function taskAt(sim, i) {
  const at = postsOf(sim)[i].at;
  // (a post's place stays: its way is found once for every bot sent there, navField.js)
  return { key: `post${i}`, at, spot: at, role: 'defend', radius: sim.instantAction.botLogic.radius, reach: 0, interact: false, stays: true };
}

// a bot the Overhaul has dealt no post yet: it keeps to where it stands (by hand: what the game's bot does
// with no objective is not read)
function holdTask(sim, s) {
  const at = [s.at[0], s.at[2]];
  return { key: 'hold', at, spot: at, role: 'defend', radius: sim.instantAction.botLogic.radius, reach: 0, interact: false };
}

// a bot's order from the bot logic: the game's pick for it, or the Overhaul's table's next entry (its
// place where it stands before the first deal)
function postTask(sim, team, why, s = null) {
  const L = sim.botLogic;
  if (L.kind === 'overhaul') return L.dealer.dealt ? taskAt(sim, nextFor(L.dealer, team, ownersOf(sim))) : holdTask(sim, s);
  return taskAt(sim, pickSlot(L[team], slotsOf(sim), sim.time, why) % postsOf(sim).length);
}

// a step of the Overhaul's dealer: a post that changed hands asks for a deal; a deal gives every living
// bot of both sides its post by the table, a side's bots in the order the sim holds them
function dealOrders(sim) {
  const L = sim.botLogic;
  const owners = ownersOf(sim);
  if (owners.some((o, i) => o !== L.owners[i])) ownerChanged(L.dealer, sim.time);
  L.owners = owners;
  if (!stepDealer(L.dealer, sim.time)) return;
  L.dealer.dealt = true;
  for (const team of [1, 2]) {
    const bots = [...sim.entities.values()].filter((s) => s.bot && s.alive && s.team === team && s.brain);
    const to = dealFor(L.dealer, team, owners, bots.length);
    bots.forEach((s, k) => (s.brain.task = taskAt(sim, to[k])));
  }
}

// a step of the bot logic: a post that changed hands tells both sides; a side whose orphans are called
// sends every bot it has out again, each by the orphan's split
function botOrders(sim) {
  const L = sim.botLogic;
  if (L.kind === 'overhaul') return dealOrders(sim);
  const slots = slotsOf(sim);
  const owners = postsOf(sim).map((o) => o.owner);
  if (owners.some((o, i) => o !== L.owners[i])) for (const team of [1, 2]) captured(L[team], sim.time);
  L.owners = owners;
  for (const team of [1, 2]) {
    if (!stepBotLogic(L[team], slots, sim.time)) continue;
    for (const s of sim.entities.values()) if (s.bot && s.alive && s.team === team && s.brain) s.brain.task = postTask(sim, team, 'orphan');
  }
}

// the live stage's walkers as bodies in the battle (the escort objective moves them)
function walkerCapsules(w) {
  const c = { part: 'body', a: [w.at[0], w.at[1] + 1.2, w.at[2]], b: [w.at[0], w.at[1] + WALKER_BODY.height, w.at[2]], r: WALKER_BODY.radius };
  w.capsules = [c, c];
}

function addWalkers(sim) {
  for (const [id, e] of sim.entities) if (e.kind === 'walker') sim.entities.delete(id);
  sim.M.walkersOf(sim.ga).forEach((w, i) => {
    Object.assign(w, { id: `w${sim.ga.stage + 1}.${i + 1}`, team: sim.ga.attack, state: 'walk', stance: 'stand', vel: [0, 0, 0] });
    if (sim.nav) w.at[1] = heightOf(sim, w.at);
    walkerCapsules(w);
    const row = GUNNERS[w.kind] && aiOf(sim.rb).vehicles?.[GUNNERS[w.kind]];
    if (row) w.gunner = createGunner(row, w, { ai: aiOf(sim.rb), rb: sim.rb, rand: sim.rand });
    sim.entities.set(w.id, w);
  });
}

const heightOf = (sim, at) => heightAt(sim.nav, at[0], at[2]);

export function addPlayer(sim, { team, classId, at, yaw = 0, id = null }) {
  const s = addSoldier(sim, { team, classId, at, yaw, bot: false, id });
  sim.brains?.add?.(s);
  // a player is in a squad: a squad made for one (a displaced bot's) the commander orders too
  const { created } = sim.brains ? joinSquad(sim.brains.squads, sim, s.id) : {};
  if (created) sim.commanders?.[team]?.squads.push(created);
  return s.id;
}

// where a squad spawn can stand: the navgrid's walkable cells, anywhere without one
export const standable = (sim) => (x, z) => !sim.nav || walkable(sim.nav, x, z);

// a squad spawn for one of a team: on the mate named (or why not), else on the first mate who can be
export function squadSpot(sim, id, team, mate = null) {
  const sq = sim.brains ? squadOf(sim.brains.squads, id) : null;
  const enemies = enemiesOf(sim, team);
  const one = mate != null ? sim.entities.get(mate) ?? null : null;
  const why = mate != null && (!sq?.members.includes(mate) ? 'none' : blocked(one, { enemies, now: sim.time }));
  if (why) return { why };
  const squad = one ? [one] : (sq?.members ?? []).map((m) => sim.entities.get(m)).filter(Boolean);
  const spot = squadSpawn({ squad, me: id, enemies, now: sim.time, walkable: standable(sim) });
  return spot ? { spot } : { why: 'squad' };
}

// why each of a soldier's squadmates can or cannot be spawned on now
export function squadBlocks(sim, id, team) {
  const sq = sim.brains ? squadOf(sim.brains.squads, id) : null;
  const enemies = enemiesOf(sim, team);
  return (sq?.members ?? []).filter((m) => m !== id).map((m) => ({ id: m, blocked: blocked(sim.entities.get(m) ?? null, { enemies, now: sim.time }) }));
}

// what a team has out: heroes and reinforcements standing, with those chosen
// this wave, and which ones (a hero is one of a kind: kits.json's MaxCount 1)
export function outOf(sim, team, extra = { heroes: 0, reinforcements: 0 }) {
  const out = { heroes: extra.heroes ?? 0, reinforcements: extra.reinforcements ?? 0, units: new Set(extra.units ?? []) };
  for (const e of sim.entities.values()) {
    if (e.team !== team || !e.alive) continue;
    if (e.unit === 'hero') out.heroes++;
    if (e.unit === 'reinforcement') out.reinforcements++;
    if (e.unit) out.units.add(e.unitId);
  }
  return out;
}

const enemiesOf = (sim, team) => [...sim.entities.values()].filter((e) => e.alive && e.kind === 'soldier' && e.team !== team).map((e) => [e.at[0], e.at[2]]);

export function deploy(sim, id, choice) {
  const entry = sim.deploying?.get(id);
  if (!entry) return { ok: false, why: 'not deploying' };
  if (sim.ga.phase === 'over') return { ok: false, why: 'over' };
  const team = entry.team;
  const list = offers(sim.bp, id, team, { out: outOf(sim, team) });
  const offer = list.find((o) => o.kind === (choice.kind ?? 'class') && o.id === choice.id);
  if (!offer) return { ok: false, why: 'none' };
  // (a mode without heroes or reinforcements deploys its classes only: Strike, Extraction, Ewok Hunt)
  if (sim.ga.heroes === false && offer.kind !== 'class') return { ok: false, why: 'mode' };
  if (offer.available === false) return { ok: false, why: offer.why };
  if (balance(sim.bp, id) < offer.cost) return { ok: false, why: 'points' };
  const enemies = enemiesOf(sim, team);
  let spot = null;
  if (choice.spawn === 'squad') {
    const r = squadSpot(sim, id, team, choice.mate);
    if (r.why) return { ok: false, why: r.why };
    spot = r.spot;
  } else spot = pickSpawn({ map: mapOf(sim.rb, sim.level), ids: sim.M.spawnSets(sim.ga)[sim.M.sideOf(sim.ga, team)], team, enemies, rand: sim.rand, mode: sim.mode });
  if (!spot) return { ok: false, why: 'nowhere' };
  buy(sim.bp, id, offer);
  const base = classOf(sim.rb, sim.teams[team].classes[0]);
  let cls = null;
  if (offer.kind === 'class') cls = classOf(sim.rb, offer.id);
  else {
    // a hero or a reinforcement deploys on its own health, as its side's first class until lanes 3 and 4 give it its own kit
    const unit = offer.kind === 'hero' ? heroOf(sim.rb, offer.id) : reinforcementOf(sim.rb, offer.id);
    cls = { ...base, health: unit.health, regen: unit.regen ?? base.regen, unit: offer.kind, unitId: offer.id };
  }
  const at = [...spot.at];
  if (choice.spawn !== 'squad') {
    at[0] += (sim.rand() - 0.5) * 4;
    at[2] += (sim.rand() - 0.5) * 4;
  }
  const s = addSoldier(sim, { team, cls, at, yaw: spot.yaw, bot: entry.bot, id });
  if (cls.unit) {
    s.unit = cls.unit;
    s.unitId = cls.unitId;
  }
  // (the Collection's pick, a crew kind the figure wears: the screens' appearance, carried and nothing else)
  s.appearance = choice.appearance ?? null;
  protect(s, sim.time);
  if (entry.bot) {
    // a fresh bot takes its squad's orders at once
    const b = addBrain(sim, s);
    const sq = squadOf(sim.brains.squads, id);
    // (on command posts in an Instant Action round, its own from the bot logic)
    b.task = sim.botLogic ? postTask(sim, s.team, 'spawn', s) : ((sq?.members ?? []).map((m) => sim.entities.get(m)?.brain?.task).find(Boolean) ?? null);
  }
  if (spot.mate) earn(sim.bp, spot.mate, 'squadSpawn');
  sim.deploying.delete(id);
  emit(sim, { type: 'deploy', id, kind: offer.kind, as: offer.id, spawn: choice.spawn ?? 'point' });
  return { ok: true };
}

export function removeEntity(sim, id) {
  sim.entities.delete(id);
  sim.brains?.remove?.(id);
}

function emit(sim, e) {
  const ev = { t: Math.round(sim.time * 1000) / 1000, ...e };
  sim.events.push(ev);
  // (a deploy before the first step: the page's first, from the waiting screen)
  (sim.out ??= []).push(ev);
}

// a direction turned by small yaw and pitch offsets (radians)
function jitter(dir, [dy, dp]) {
  const yaw = Math.atan2(dir[0], dir[2]) + dy;
  const pitch = Math.asin(Math.max(-1, Math.min(1, dir[1]))) + dp;
  const c = Math.cos(pitch);
  return [Math.sin(yaw) * c, Math.sin(pitch), Math.cos(yaw) * c];
}

function release(sim) {
  const later = [];
  for (const p of sim.pending) {
    if (p.at > sim.time + 1e-9) {
      later.push(p);
      continue;
    }
    const s = sim.entities.get(p.owner);
    if (!s?.alive) continue;
    // (a turret's bolt leaves its own gun)
    const from = p.from ?? muzzleOf(s);
    const d = [p.aim[0] - from[0], p.aim[1] - from[1], p.aim[2] - from[2]];
    const L = Math.hypot(d[0], d[1], d[2]) || 1;
    const dir = jitter([d[0] / L, d[1] / L, d[2] / L], p.dir);
    const row = s.gun.row;
    fireBolt(sim.bolts, { from, dir, speed: row.firing?.speed ?? 700, range: row.range ?? 200, ttl: row.damage?.timeToLive ?? 3, team: s.team, owner: s.id, weapon: row, colour: row.colour, now: sim.time });
    emit(sim, { type: 'shot', by: s.id });
  }
  sim.pending = later;
}

function applyInput(sim, inp) {
  const s = sim.entities.get(inp.id);
  if (!s?.alive) return;
  if (inp.look != null) s.yaw = inp.look;
  if (inp.crouch != null) s.stance = inp.crouch ? 'crouch' : 'stand';
  s.sprint = !!inp.sprint;
  if (inp.roll && press(s.abilities, 0, sim.time).fired) {
    roll(s, inp.move ?? [Math.sin(s.yaw), Math.cos(s.yaw)], sim.time);
    onRoll(s, sim.time);
  }
  if (inp.aim) s.aim = inp.aim;
  s.abilityHeld = inp.abilityHeld ?? 0;
  if (inp.ability) press(s.abilities, inp.ability, sim.time);
  if (inp.vent && s.gun) vent(s.gun, sim.time);
  if (inp.cool && s.gun) coolPress(s.gun, sim.time);
  if (s.state !== 'roll') move(s, inp.move ?? [0, 0], STEP, sim.nav);
  if (inp.fire) shoot(sim, s, inp.aim ?? chestAhead(s));
  s.interact = !!inp.interact;
}

const chestAhead = (s) => {
  const c = chestOf(s);
  return [c[0] + Math.sin(s.yaw) * 100, c[1], c[2] + Math.cos(s.yaw) * 100];
};

// a soldier down: the score, the kill, the mode's ticket and the Battle Points;
// a bolt's kill also says where the shot went (`dir`, unit), where it struck
// (`at`) and the weapon's id, for the world's ragdolls
function downed(sim, target, by, part, why = null, hit = null) {
  sim.score[target.team].deaths++;
  sim.stats.get(target.id).deaths++;
  const killer = by ? sim.entities.get(by) : null;
  if (killer && killer.team !== target.team) {
    sim.score[killer.team].kills++;
    // (a walker's gunner keeps no row of its own)
    const row = sim.stats.get(killer.id);
    if (row) row.kills++;
  }
  emit(sim, { type: 'kill', by, target: target.id, part, ...(why ? { why } : {}), ...(hit ? { dir: hit.dir.slice(), at: hit.at.slice(), weapon: hit.bolt.weapon?.id ?? null } : {}) });
  if (sim.ga) {
    const r = sim.M.onEvent(sim.ga, { type: 'down', side: sim.M.sideOf(sim.ga, target.team) });
    target.respawn = r.respawn;
    // (Ewok Hunt: a trooper killed comes back on the Ewoks' side)
    target.joins = r.joins ?? null;
    if (killer && killer.team !== target.team) bpKill(sim.bp, { by, target: target.id, now: sim.time, hero: target.unit === 'hero' });
  }
}

function hitWalker(sim, w, e) {
  const damage = w.vulnerable && w.alive ? damageAt(e.bolt.weapon, e.dist) : 0;
  emit(sim, { type: 'hit', by: e.bolt.owner, target: w.id, part: 'body', damage: Math.round(damage * 100) / 100 });
  if (!damage) return;
  w.hp = Math.max(0, w.hp - damage);
  earn(sim.bp, e.bolt.owner, 'objectiveDamage', damage);
  if (w.hp > 0) return;
  w.alive = false;
  earn(sim.bp, e.bolt.owner, 'vehicleKill');
  emit(sim, { type: 'walkerDown', by: e.bolt.owner, target: w.id });
}

function resolveBolts(sim) {
  const bodies = [];
  for (const s of sim.entities.values()) {
    if (!s.alive) continue;
    if (s.kind === 'soldier') capsulesOf(s, s.capsules);
    bodies.push({ id: s.id, team: s.team, alive: true, safe: isProtected(s, sim.time), at: s.at, capsules: s.capsules });
  }
  const t0 = clock();
  const evs = stepBolts(sim.bolts, STEP, { bodies, nav: sim.nav, now: sim.time });
  if (profile.on) profile.bolts += clock() - t0;
  for (const e of evs) {
    if (e.type === 'hit') {
      const target = sim.entities.get(e.target);
      // (a turret an earlier bolt of this step shot down)
      if (!target) continue;
      if (target.kind === 'walker') {
        hitWalker(sim, target, e);
        continue;
      }
      const shooter = sim.entities.get(e.bolt.owner);
      // (a bot's bolt on a player: the difficulty's damage; the AI's half-damage bolt; the buckets' grace)
      const scale = sim.difficulty && target.bot === false && shooter?.bot ? sim.difficulty.damage : 1;
      const grace = mayHurt(sim.buckets, { shooter, target, shotAt: e.bolt.born, now: sim.time });
      let damage = grace ? damageAt(e.bolt.weapon, e.dist, { bot: !!shooter?.bot }) * scale : 0;
      if (target.kind === 'turret') {
        const r = hurtTurret(sim, target, damage);
        emit(sim, { type: 'hit', by: e.bolt.owner, target: e.target, part: 'body', damage: Math.round(damage * 100) / 100 });
        if (r === 'down') emit(sim, { type: 'turretDown', by: e.bolt.owner, target: e.target });
        continue;
      }
      damage = absorb(target, damage, { dir: e.dir, now: sim.time });
      const r = hurt(target, { damage, part: e.part, by: e.bolt.owner, now: sim.time });
      // (both in combat: no squad spawns on either for a while)
      target.combatAt = sim.time;
      if (shooter) shooter.combatAt = sim.time;
      emit(sim, { type: 'hit', by: e.bolt.owner, target: e.target, part: e.part, damage: Math.round(damage * 100) / 100, dir: e.dir.slice(), at: e.at.slice() });
      if (sim.bp) bpHit(sim.bp, target.id, e.bolt.owner, sim.time);
      if (r === 'down') downed(sim, target, e.bolt.owner, e.part, null, e);
    }
  }
  return evs;
}

export function step(sim, inputs = []) {
  sim.out = [];
  sim.time = Math.round((sim.time + STEP) * 1e6) / 1e6;
  sim.steps++;
  for (const inp of inputs) applyInput(sim, inp);
  stepBrains(sim);
  stepGunners(sim);
  for (const s of sim.entities.values()) {
    if (s.kind !== 'soldier') continue;
    if (s.state === 'roll' && s.alive) move(s, s.rollDir, STEP, sim.nav);
    for (const e of tickSoldier(s, STEP, sim.time)) {
      emit(sim, { ...e, by: s.id });
      if (e.type === 'ability') onAbility(sim, s, e);
    }
  }
  // (the kit: the grenades fly, the turrets fire, the fields burn; its damage applied here)
  for (const r of stepKit(sim)) applyKit(sim, r);
  release(sim);
  const raw = resolveBolts(sim);
  onEvents(sim, raw);
  if (sim.oob) outOfBounds(sim);
  if (sim.ga) stepMode(sim);
  return sim.out;
}

// a blast's or a field's damage on each body it reached: the shield and the overhealth first, then the soldier
function applyKit(sim, r) {
  const hits = r.type === 'blast' ? r.hits : [{ id: r.id, damage: r.damage, dir: null }];
  for (const h of hits) {
    const target = sim.entities.get(h.id);
    if (!target?.alive) continue;
    if (target.kind === 'turret') {
      if (hurtTurret(sim, target, h.damage) === 'down') emit(sim, { type: 'turretDown', by: r.by, target: h.id });
      continue;
    }
    if (target.kind !== 'soldier') continue;
    const damage = absorb(target, h.damage, { dir: h.dir, now: sim.time });
    const was = hurt(target, { damage, part: 'chest', by: r.by, now: sim.time });
    target.combatAt = sim.time;
    if (r.type === 'blast') emit(sim, { type: 'hit', by: r.by, target: h.id, part: 'blast', damage: Math.round(damage * 100) / 100, dir: h.dir, at: [...r.at] });
    if (sim.bp && r.by !== h.id) bpHit(sim.bp, target.id, r.by, sim.time);
    if (was === 'down') downed(sim, target, r.by, 'blast', null, null);
  }
}

// the walkers' gunners: a bolt from the turret when the pattern and the cannon's rate allow
function stepGunners(sim) {
  for (const w of sim.entities.values()) {
    if (!w.gunner || !w.alive) continue;
    const enemies = sim.cache?.all?.filter((e) => e.team !== w.team && e.kind === 'soldier') ?? [];
    const shot = w.gunner.tick(sim.time, { enemies, lineClear: (a, b) => lineClear(sim.nav, a, b) });
    if (!shot) continue;
    const d = [shot.aim[0] - shot.from[0], shot.aim[1] - shot.from[1], shot.aim[2] - shot.from[2]];
    const L = Math.hypot(...d) || 1;
    const row = shot.weapon;
    fireBolt(sim.bolts, { from: shot.from, dir: d.map((v) => v / L), speed: row.firing.speed, range: row.range, ttl: row.damage.timeToLive, team: w.team, owner: w.id, weapon: row, colour: row.colour, now: sim.time });
    emit(sim, { type: 'shot', by: w.id });
  }
}

function outOfBounds(sim) {
  for (const s of sim.entities.values()) {
    const zone = sim.oob[s.team];
    if (!s.alive || s.kind !== 'soldier' || !zone?.length) continue;
    if (zone.some((v) => insidePolygon(v.points, s.at[0], s.at[2]))) {
      s.oobSince = null;
      continue;
    }
    s.oobSince ??= sim.time;
    if (sim.time - s.oobSince < OOB_SECONDS - 1e-9) continue;
    s.hp = 0;
    s.alive = false;
    s.state = 'dying';
    s.diedAt = sim.time;
    s.moving = false;
    downed(sim, s, null, null, 'oob');
  }
}

// the mode's step: corpses to the deploy screen, the waves, the stage file, the points, the orders
function stepMode(sim) {
  const ga = sim.ga;
  for (const [id, s] of sim.entities) {
    if (s.kind !== 'soldier' || s.alive || s.state !== 'down') continue;
    removeEntity(sim, id);
    if (s.respawn) sim.deploying.set(id, { id, team: s.joins ?? s.team, bot: s.bot, since: sim.time });
    if (s.respawn && s.joins && s.joins !== s.team && s.bot) changeSides(sim.brains.squads, id, s.joins);
  }
  if (ga.phase !== 'over')
    for (const team of [1, 2]) {
      const c = sim.commanders[team];
      // (an Instant Action round: the AutoPlayers' waves, ai/waves.js, each bot by its own wait; else the ten-second wave)
      const w = sim.waves?.[team] ?? null;
      if (!w && !wave(c, sim.time)) continue;
      const chosen = { heroes: 0, reinforcements: 0, units: [] };
      const squadPicks = new Map();
      for (const entry of [...sim.deploying.values()]) {
        if (entry.team !== team || !entry.bot) continue;
        if (w && !mayDeploy(w, { since: entry.since, now: sim.time })) continue;
        const sq = squadOf(sim.brains.squads, entry.id);
        const picks = squadPicks.get(sq) ?? [];
        const squadClasses = [...picks, ...(sq?.members ?? []).map((m) => sim.entities.get(m)).filter((m) => m?.alive).map((m) => m.cls.cls)];
        const out = outOf(sim, team, chosen);
        // (a hero or a reinforcement only while its own wave is open)
        if (w && !unitOpen(w, 'hero', sim.time)) out.heroes = Infinity;
        if (w && !unitOpen(w, 'special', sim.time)) out.reinforcements = Infinity;
        const choice = spend(c, entry.id, { squadClasses, out });
        const enemies = enemiesOf(sim, team);
        const mates = (sq?.members ?? []).map((m) => sim.entities.get(m)).filter(Boolean);
        const spawn = squadSpawn({ squad: mates, me: entry.id, enemies, now: sim.time, walkable: standable(sim) }) ? 'squad' : 'point';
        let r = deploy(sim, entry.id, { ...choice, spawn });
        if (!r.ok) r = deploy(sim, entry.id, { kind: 'class', id: sim.teams[team].classes[0], spawn: 'point' });
        if (!r.ok) continue;
        if (choice.kind === 'hero') chosen.heroes++;
        if (choice.kind === 'reinforcement') chosen.reinforcements++;
        if (choice.kind !== 'class') chosen.units.push(choice.id);
        picks.push(sim.entities.get(entry.id).cls.cls);
        squadPicks.set(sq, picks);
      }
    }
  const soldiers = [];
  const alive = { attack: 0, defend: 0 };
  for (const s of sim.entities.values()) {
    if (s.kind !== 'soldier' || !s.alive) continue;
    const side = sim.M.sideOf(ga, s.team);
    alive[side]++;
    soldiers.push({ id: s.id, side, at: s.at, alive: true, interact: !!s.interact });
  }
  const stage = ga.stage;
  for (const e of sim.M.tick(ga, STEP, { soldiers, alive })) {
    emit(sim, e);
    if (e.type === 'objective' && e.kind === 'capture') for (const o of ga.objectives) if (o.name === e.name) for (const id of o.inside.attack) sim.stats.get(id).captures++;
    if (e.type === 'armed') for (const o of ga.objectives) if (o.name === e.name) for (const i of o.interactions) sim.stats.get(i.id).arms++;
  }
  if (ga.stage !== stage) {
    addWalkers(sim);
    for (const c of Object.values(sim.commanders)) c.nextAssign = 0;
    // (a new stage: each side's waves on its rows)
    if (sim.waves) for (const team of [1, 2]) stageWaves(sim.waves[team], waveTable(sim, team), sim.time);
  }
  for (const w of sim.M.walkersOf(ga)) {
    if (sim.nav) w.at[1] = heightOf(sim, w.at);
    walkerCapsules(w);
  }
  // a second on a moving meter, or at a prop being armed, defused or called, is worth its points
  if (ga.phase === 'live')
    for (const o of ga.objectives) {
      if (o.type === 'capture' && o.moving) for (const id of o.inside[o.moving]) earn(sim.bp, id, 'objectiveTick', STEP);
      for (const i of o.interactions ?? []) earn(sim.bp, i.id, 'objectiveTick', STEP);
    }
  for (const team of [1, 2]) {
    const c = sim.commanders[team];
    // (Strike's second round swaps the sides)
    const side = sim.M.sideOf(ga, team);
    if (c.side !== side) [c.side, c.nextAssign] = [side, 0];
    // (the bot logic's orders are each bot's own: the commander's plan by squads is not laid over them)
    if (!sim.botLogic && sim.time + 1e-9 >= c.nextAssign) assign(c, { entities: [...sim.entities.values()], now: sim.time });
  }
  if (sim.botLogic) botOrders(sim);
  // (the Overhaul's spread: each side's aim noise scale drawn again, evenly, one of its ten)
  const sp = sim.aimSpread;
  if (sp && sim.time + 1e-9 >= sp.next) {
    for (const team of [1, 2]) sp[team] = SPREAD.scales[Math.floor(sim.rand() * SPREAD.scales.length)];
    sp.next += SPREAD.every;
  }
}

export function drain(sim) {
  const out = sim.events;
  sim.events = [];
  return out;
}

// a bot's order as its objective's letter: the commander's task key names the objective by its place
function letterOf(sim, task) {
  const i = Number(/^o(\d+)/.exec(task?.key ?? '')?.[1] ?? NaN);
  return Number.isInteger(i) && sim.ga?.objectives?.[i] ? String.fromCharCode(65 + i) : null;
}

export function view(sim, { player = null } = {}) {
  const v = (sim.view ??= { time: 0, teams: { 1: { alive: 0, dead: 0, kills: 0 }, 2: { alive: 0, dead: 0, kills: 0 } }, entities: [], bolts: [] });
  v.time = sim.time;
  for (const t of [1, 2]) {
    v.teams[t].alive = 0;
    v.teams[t].dead = 0;
    v.teams[t].kills = sim.score[t].kills;
  }
  let i = 0;
  for (const s of sim.entities.values()) {
    const e = (v.entities[i++] ??= {});
    if (s.kind !== 'turret') v.teams[s.team][s.alive ? 'alive' : 'dead']++;
    e.id = s.id;
    e.team = s.team;
    e.kind = s.kind;
    e.at = s.at;
    e.yaw = s.yaw;
    e.hp = s.hp;
    e.hpMax = s.hpMax;
    e.state = s.state;
    e.stance = s.stance;
    e.moving = s.moving;
    e.aim = s.aim ?? null;
    e.firing = s.gun ? sim.time - s.gun.lastShot < 0.2 : false;
    e.heat = s.gun?.heat ?? 0;
    e.mode = s.brain?.intent?.mode ?? null;
    e.unit = s.unit ?? null;
    e.unitId = s.unitId ?? null; // (the rulebook's hero or reinforcement: the body the figure wears)
    e.appearance = s.appearance ?? null; // (a skin picked in the Collection: its crew kind)
    e.name = s.name ?? null;
    e.cls = s.cls?.cls ?? null;
    e.points = sim.bp ? balance(sim.bp, s.id) : 0;
    // (the kit's marks on a body: the shield up, flashed, stunned, marked, hidden, an ability's weapon in hand)
    e.shield = s.shield ? s.shield.hp / s.shield.max : null;
    e.over = s.over?.hp ?? 0;
    e.flashed = (s.flashedUntil ?? -Infinity) > sim.time;
    e.stunned = (s.stunnedUntil ?? -Infinity) > sim.time;
    e.marked = (s.markedUntil ?? -Infinity) > sim.time;
    e.hidden = !!s.hidden;
    e.ability = s.kitActive?.id ?? null;
    e.weapon = s.gun?.row?.id ?? null;
    e.oob = s.oobSince != null ? Math.max(0, OOB_SECONDS - (sim.time - s.oobSince)) : null;
  }
  v.entities.length = i;
  let k = 0;
  for (const b of sim.bolts.list) {
    const o = (v.bolts[k++] ??= {});
    o.at = b.at;
    o.dir = b.dir;
    o.colour = b.colour;
  }
  v.bolts.length = k;
  v.grenades = grenadesOf(sim.kit);
  v.mode = sim.ga ? sim.M.view(sim.ga) : null;
  v.deploying = sim.deploying ? [...sim.deploying.keys()] : [];
  // the player's deploy screen: open while they wait, with what their points buy
  const waiting = player && sim.deploying?.get(player);
  v.squad = player && sim.brains ? squadRows(sim.brains.squads, sim, player, { names: squadsOf(sim.rb).names.map((n) => stringOf(sim.rb, n)), letterOf: (t) => letterOf(sim, t) }) : null;
  v.deploy = waiting ? { open: true, team: waiting.team, points: balance(sim.bp, player), offers: offers(sim.bp, player, waiting.team, { out: outOf(sim, waiting.team) }), timeLeft: 0 } : { open: false };
  return v;
}
