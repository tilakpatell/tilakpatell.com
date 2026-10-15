// A team's commander (spec catalogue 7): it gives each squad of bots an
// objective of the live stage and spends each bot's Battle Points when it
// deploys. Attackers split their squads across what is left to take, by
// weight (a capture, an arm, an escort, the uplinks to deny); defenders hold
// what is threatened, a squad a point, call the uplinks' bombing runs on the
// walkers, and send the rest at the nearest crowd of attackers. A squad's
// objective becomes each member's brain `task`. Pure.
//
//   createCommander({ team, side, ga, squads, bp, rand, nav, rulebook }) → c
//   assign(c, world) → Map<squadId, { objective, role, task }>     world: { entities: [...], now }
//   spend(c, id, { squadClasses, out: { heroes, reinforcements } }) → { kind, id }
//   wave(c, now) → true when the team's wave is due (and the next one set)

import { aiOf, pointsOf } from '../rulebook.js';
import { nearestWalkable } from '../nav.js';
import { balance, offers } from '../battlePoints.js';
import { INTERACT_REACH, UPLINK_RANGE, insidePolygon } from '../modes/objectives.js';
import { WAVE } from '../spawn.js';
import { reachOf } from '../gates.js';
import { gateStand, meshPath } from '../meshNav.js';
import { keypadStand } from '../charges.js';

// Seconds between the commander's orders, by hand.
export const ASSIGN = 5;
// The attackers' weights by objective (the plan's, by hand): a capture to
// take, an arm to set, a set arm or a taken point to guard, a walker to
// escort (one squad each), an uplink to deny the defenders, an unlocked
// gate's panel to hold (one squad: the way into the base, lib/battlefront/gates.js).
export const WEIGHTS = { capture: 1, arm: 1.2, guard: 0.3, escort: 1, uplink: 0.3, gate: 2 };
// How wide a squad spreads round its objective: a point's middle, a walker, a crowd. By hand.
export const HOLD_RADIUS = 5;
export const ESCORT_RADIUS = 20;
export const COUNTER_RADIUS = 15;
// How near an objective an attacker counts as threatening it, and the
// crowds' grid; how many squads the defenders send to the uplinks. By hand.
export const THREAT = 25;
export const CLUSTER = 40;
export const UPLINK_SQUADS = 2;
// m: how near its place a bot comes before it holds a gate's panel (the AutoPlayers' own:
// Automation/Autoplayers/Prefabs/PlanetaryBattles/AutoPlayer_HackObjective's
// AutoPlayerInteractObjectiveEntityData.InteractionStartRadius)
export const GATE_START = 1;
// The officer and the specialist are one a squad, as the game's squads deploy.
const ONE_A_SQUAD = new Set(['officer', 'specialist']);

const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const xz = (e) => [e.at[0], e.at[2]];

export function createCommander({ team, side, ga, squads, bp, rand = Math.random, nav = null, rulebook = null, ways = false }) {
  const ia = rulebook ? aiOf(rulebook).instantAction : null;
  const cap = (key, limit) => {
    const v = ia?.[key]?.default ?? -1;
    return v >= 0 ? Math.min(v, limit) : limit;
  };
  const limits = bp ? pointsOf(bp.rb).limits : { heroesPerTeam: 1, reinforcementsPerTeam: 4 };
  return {
    team,
    side,
    ga,
    squads,
    bp,
    rand,
    nav,
    // (its orders say which places stay, so the brain keeps one way to each for every bot sent, navField.js:
    // an Instant Action round's. A battle that is no round's plans as it did, its balance being measured so)
    ways,
    caps: { heroes: cap('InstantActionEnemyHeroCount', limits.heroesPerTeam), reinforcements: cap('InstantActionEnemyReinforcementCount', limits.reinforcementsPerTeam) },
    next: 0,
    nextWave: 0,
    nextAssign: 0,
    tasks: new Map(),
    spots: new Map(),
  };
}

// where on an objective a bot stands: its middle, or the walkable spot nearest an interact prop
function pointOf(o) {
  if (o.type === 'escort') return xz(o.walker);
  // (a carried objective: to it while it lies, to its drop-off once someone has it)
  if (o.type === 'carry') return o.carrier ? o.to : o.at;
  return o.at;
}

function spotOf(c, o) {
  if (!c.nav) return o.at;
  if (!c.spots.has(o)) {
    // (a fuel charge: the navmesh's floor nearest its keypad that reaches it, charges.js; else the grid's nearest)
    const stand = o.charge ? keypadStand(c.nav, o.charge) : null;
    c.spots.set(o, stand ? [stand[0], stand[2]] : (nearestWalkable(c.nav, o.at[0], o.at[1], 6) ?? o.at));
  }
  return c.spots.get(o);
}

function threatOn(o, attackers) {
  if (o.volume) return attackers.filter((a) => insidePolygon(o.volume.points, a[0], a[1]) || d2(a, o.at) <= THREAT).length;
  return attackers.filter((a) => d2(a, pointOf(o)) <= THREAT).length;
}

// the attackers in crowds on a grid: each crowd's middle and size
function clusters(points) {
  const cells = new Map();
  for (const p of points) {
    const k = `${Math.floor(p[0] / CLUSTER)},${Math.floor(p[1] / CLUSTER)}`;
    const c = cells.get(k) ?? { n: 0, x: 0, z: 0 };
    c.n++;
    c.x += p[0];
    c.z += p[1];
    cells.set(k, c);
  }
  return [...cells.values()].map((c) => ({ at: [c.x / c.n, c.z / c.n], n: c.n }));
}

function task(c, key, fields) {
  const was = c.tasks.get(key);
  if (was && was.at[0] === fields.at[0] && was.at[1] === fields.at[1] && was.role === fields.role) return was;
  const t = { key, reach: INTERACT_REACH, radius: 0, interact: false, ...fields };
  c.tasks.set(key, t);
  return t;
}

// an unlocked gate's panel as an objective the attackers can be sent to (one object a gate, for the tasks' cache):
// its place the floor on the gate's outer side nearest the panel it reaches (meshNav.js's gateStand), else
// half its reach out in front of it
function gateObjective(c, g) {
  c.gateObjectives ??= new Map();
  if (!c.gateObjectives.has(g.id)) {
    const stand = gateStand(c.nav, g);
    const out = reachOf(g) / 2;
    const yaw = g.panel.yaw ?? 0;
    const at = stand ? [stand[0], stand[2]] : [g.panel.at[0] + Math.sin(yaw) * out, g.panel.at[2] + Math.cos(yaw) * out];
    c.gateObjectives.set(g.id, { type: 'gate', id: g.id, at });
  }
  return c.gateObjectives.get(g.id);
}

function orders(c, o, role) {
  const at = pointOf(o);
  if (o.type === 'gate') return task(c, `gate:${o.id}`, { at, spot: at, role, interact: true, radius: 0, reach: GATE_START });
  const i = c.ga.objectives.indexOf(o);
  if (role === 'escort') return task(c, `o${i}`, { at, role, radius: ESCORT_RADIUS });
  if (o.type === 'carry') return task(c, `o${i}:${role}:${o.carrier ? 'to' : 'at'}`, { at, spot: at, role, radius: role === 'take' && !o.carrier ? 0 : HOLD_RADIUS });
  if (o.type === 'arm' && o.charge && role === 'take') {
    // (a fuel charge's keypad: to its stand, then hold within the AutoPlayers' start radius of it, as at a gate's panel)
    const spot = spotOf(c, o);
    return task(c, `o${i}:${role}`, { at: spot, spot, role, interact: true, radius: 0, reach: GATE_START, ...(c.ways ? { stays: true } : {}) });
  }
  if (o.type === 'arm' || o.type === 'uplink') {
    const interact = role === 'take';
    return task(c, `o${i}:${role}`, { at, spot: spotOf(c, o), role, interact, radius: interact ? 0 : HOLD_RADIUS + INTERACT_REACH, ...(c.ways ? { stays: true } : {}) });
  }
  // (`stays`: the place does not move; a walker's place, a carried thing's and a counter's crowd move, and
  // say nothing)
  return task(c, `o${i}`, { at, spot: at, role, radius: HOLD_RADIUS, ...(c.ways && o.type !== 'escort' ? { stays: true } : {}) });
}

// a gate the attackers wait at: unlocked, or opening and its leaves not yet a soldier apart (gates.js)
const waiting = (g) => g.panel && (g.state === 'unlocked' || (g.state === 'opening' && !g.passable));

// whether an objective stands behind a gate still shut: no way to it on the navmesh from the gate's
// outer side (Hoth's hangar posts behind its blast doors). Kept until the mesh's links change (a
// doorway opened).
function shutBehind(c, o) {
  const gate = c.nav?.mesh ? (c.ga.gates?.list ?? []).find(waiting) : null;
  const stand = gate ? gateStand(c.nav, gate) : null;
  if (!stand) return false;
  c.behind ??= new Map();
  const key = `${c.ga.objectives.indexOf(o)}:${gate.id}:${c.nav.mesh.links.length}`;
  if (!c.behind.has(key)) c.behind.set(key, meshPath(c.nav, [stand[0], stand[2]], pointOf(o), { fromY: stand[1] }) === null);
  return c.behind.get(key);
}

// the attackers' plan: each squad to the objective with the most weight left for it; an objective behind
// a shut gate is no squad's while its gate is to open, and every squad it would have had goes to the gate
function attackPlan(c, live, alive) {
  const options = [];
  let behind = 0;
  for (const o of live) {
    if (o.type !== 'escort' && o.type !== 'uplink' && !o.done && shutBehind(c, o)) {
      behind++;
      continue;
    }
    if (o.type === 'escort') {
      if (o.walker.alive && !o.done) options.push({ o, w: WEIGHTS.escort, role: 'escort', max: 1 });
    } else if (o.type === 'capture') options.push({ o, w: o.done ? WEIGHTS.guard : WEIGHTS.capture, role: o.done ? 'hold' : 'take' });
    else if (o.type === 'arm' && !o.done) options.push({ o, w: o.armed ? WEIGHTS.guard : WEIGHTS.arm, role: o.armed ? 'hold' : 'take' });
    else if (o.type === 'hold' && !o.done) options.push({ o, w: WEIGHTS.capture, role: 'take' });
    else if (o.type === 'carry' && !o.done) options.push({ o, w: WEIGHTS.arm, role: 'take' });
    else if (o.type === 'uplink') options.push({ o, w: WEIGHTS.uplink, role: 'hold' });
  }
  for (const g of c.ga.gates?.list ?? []) if (waiting(g)) options.push({ o: gateObjective(c, g), w: WEIGHTS.gate, role: 'take', ...(behind ? {} : { max: 1 }) });
  const plan = new Map();
  if (!options.length) return plan;
  const count = new Map();
  const ours = (o) => alive.filter((a) => d2(a, pointOf(o)) <= THREAT).length;
  for (const sq of c.squads) {
    let best = null;
    for (const op of options) {
      const n = count.get(op) ?? 0;
      if (op.max && n >= op.max) continue;
      const score = op.w / (1 + n);
      const tie = ours(op.o) + n * 4;
      const far = sq.centre ? d2(sq.centre, pointOf(op.o)) : 0;
      if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) <= 1e-9 && (tie < best.tie || (tie === best.tie && far < best.far)))) best = { op, score, tie, far };
    }
    if (!best) continue;
    count.set(best.op, (count.get(best.op) ?? 0) + 1);
    plan.set(sq.id, { objective: c.ga.objectives.indexOf(best.op.o), role: best.op.role, task: orders(c, best.op.o, best.op.role) });
  }
  return plan;
}

// the defenders' plan: hold what is threatened, call the uplinks, counter the rest
function defendPlan(c, live, enemies) {
  const plan = new Map();
  const free = [...c.squads];
  const give = (o, role) => {
    if (!free.length) return;
    const at = pointOf(o);
    free.sort((a, b) => (a.centre ? d2(a.centre, at) : 1e9) - (b.centre ? d2(b.centre, at) : 1e9));
    const sq = free.shift();
    plan.set(sq.id, { objective: c.ga.objectives.indexOf(o), role, task: orders(c, o, role) });
  };
  const points = live.filter((o) => o.type === 'capture' || o.type === 'hold' || o.type === 'carry' || (o.type === 'arm' && !o.done));
  const threatened = points.map((o) => ({ o, t: threatOn(o, enemies) + (o.armed ? 100 : 0) })).filter((x) => x.t > 0);
  threatened.sort((a, b) => b.t - a.t);
  for (const { o } of threatened) give(o, o.armed ? 'take' : 'hold');
  // the walkers' stage: the uplinks nearest the walkers, while they rest not
  const walkers = live.filter((o) => o.type === 'escort' && o.walker.alive).map((o) => xz(o.walker));
  if (walkers.length) {
    const by = (o) => Math.min(...walkers.map((w) => d2(w, o.at)));
    const ups = live.filter((o) => o.type === 'uplink' && o.rest <= 0 && by(o) <= UPLINK_RANGE);
    ups.sort((a, b) => by(a) - by(b));
    for (const o of ups.slice(0, UPLINK_SQUADS)) give(o, 'take');
  }
  if (!threatened.length && !walkers.length) for (const o of points) give(o, 'hold');
  const crowds = clusters(enemies);
  for (const sq of free) {
    if (!crowds.length) {
      if (points[0]) plan.set(sq.id, { objective: c.ga.objectives.indexOf(points[0]), role: 'hold', task: orders(c, points[0], 'hold') });
      continue;
    }
    const from = sq.centre ?? crowds[0].at;
    let best = crowds[0];
    for (const k of crowds) if (k.n / (1 + d2(from, k.at) / 100) > best.n / (1 + d2(from, best.at) / 100)) best = k;
    const at = [Math.round(best.at[0]), Math.round(best.at[1])];
    plan.set(sq.id, { objective: null, role: 'counter', task: task(c, `counter:${sq.id}`, { at, role: 'counter', radius: COUNTER_RADIUS }) });
  }
  return plan;
}

export function assign(c, world) {
  const live = c.ga.phase === 'over' ? [] : c.ga.objectives;
  const mine = [];
  const enemies = [];
  for (const e of world.entities) {
    if (!e.alive || e.kind !== 'soldier') continue;
    (e.team === c.team ? mine : enemies).push(xz(e));
  }
  const plan = c.side === 'attack' ? attackPlan(c, live, mine) : defendPlan(c, live, enemies);
  const byId = new Map(world.entities.map((e) => [e.id, e]));
  for (const sq of c.squads) {
    const p = plan.get(sq.id);
    for (const id of sq.members) {
      const b = byId.get(id)?.brain;
      if (b) b.task = p?.task ?? null;
    }
  }
  c.nextAssign = (world.now ?? 0) + ASSIGN;
  return plan;
}

// what a bot deploys as: a hero, else a reinforcement, as its points and the team's caps allow; else a class in turn
export function spend(c, id, { squadClasses = [], out = { heroes: 0, reinforcements: 0 } } = {}) {
  if (c.bp) {
    const list = offers(c.bp, id, c.team, { out });
    const have = balance(c.bp, id);
    const pickOf = (kind, n, capN) => {
      if (n >= capN) return null;
      const ok = list.filter((o) => o.kind === kind && o.available && have >= o.cost);
      return ok.length ? ok[Math.floor(c.rand() * ok.length)] : null;
    };
    const buy = pickOf('hero', out.heroes, c.caps.heroes) ?? pickOf('reinforcement', out.reinforcements, c.caps.reinforcements);
    if (buy) return { kind: buy.kind, id: buy.id };
  }
  const classes = c.bp ? c.bp.teams[c.team].classes : [];
  const kinds = c.classKinds ?? ((id) => id.split('-').at(-1));
  for (let k = 0; k < classes.length; k++) {
    const cls = classes[(c.next + k) % classes.length];
    const kind = kinds(cls);
    if (ONE_A_SQUAD.has(kind) && squadClasses.includes(kind)) continue;
    c.next = (c.next + k + 1) % classes.length;
    return { kind: 'class', id: cls };
  }
  return { kind: 'class', id: classes[0] };
}

export function wave(c, now) {
  if (now + 1e-9 < c.nextWave) return false;
  c.nextWave = Math.floor(now / WAVE + 1e-9) * WAVE + WAVE;
  return true;
}
