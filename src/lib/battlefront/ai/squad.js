// A team's bots in squads (spec catalogue 7, on `lib/ai/squad`): four to a
// squad by spawn order, as the game deploys them; a player joins one
// (`joinSquad`); a leader (the first bot alive, else the first alive),
// a centre, a confidence from what the squad believes it faces and so a
// posture (press, hold, retreat); and alerts, which spread from the one who
// saw to the squadmates at the template's `AlertPropagationSpeed`, a belief
// planted when the wave reaches each. Pure.
//
//   createSquads(sim) → squads       update(squads, sim) (every SQUAD s)
//   alert(squads, from, { id, at }, now)      deliver(squads, sim, now) → alerts that arrived
//   squadOf(squads, id) → squad | null
//   joinSquad(squads, sim, id, team?) → { squad, created: squad | null }
//   squadRows(squads, sim, id, { names, nameOf, letterOf }) → { id, letter, members: [{ id, name, cls, alive, local, order }] } | null

import { confidence, posture } from '../../ai/squad.js';
import SQUADS from '../../../data/bf2017/squads.json';

// Soldiers a squad: the game's (squads.json: TacticalSpawnManagerEntityData.MaxPlayersPerSquad).
export const SQUAD_SIZE = SQUADS.rows.size;
// How far round a squad's centre its fight is weighed (friends and believed
// enemies): the tactics' engage distance and a half, by hand.
export const REACH = 60;

const toV = (a) => ({ x: a[0], y: a[1], z: a[2] });

export function createSquads(sim) {
  const squads = { list: [], by: new Map(), alerts: [] };
  for (const team of [1, 2]) {
    const bots = [...sim.entities.values()].filter((e) => e.team === team && e.bot);
    for (let i = 0; i < bots.length; i += SQUAD_SIZE) {
      const sq = { id: `${team}.${i / SQUAD_SIZE + 1}`, team, members: bots.slice(i, i + SQUAD_SIZE).map((b) => b.id), leader: null, centre: null, level: 'neutral', posture: 'hold' };
      squads.list.push(sq);
      for (const id of sq.members) squads.by.set(id, sq);
    }
  }
  update(squads, sim);
  return squads;
}

export const squadOf = (squads, id) => squads.by.get(id) ?? null;

const fresh = (id, team, members) => ({ id, team, members, leader: null, centre: null, level: 'neutral', posture: 'hold' });

function add(squads, sq) {
  squads.list.push(sq);
  for (const id of sq.members) squads.by.set(id, sq);
  return sq;
}

// A player into the team's first squad with room; with every squad full, into
// the first, whose last bot moves to a squad with room or a new one (`created`,
// for the commander to take on). The game's own parties are native code: this
// rule is by hand.
export function joinSquad(squads, sim, id, team = sim.entities.get(id)?.team) {
  const had = squadOf(squads, id);
  if (had) return { squad: had, created: null };
  const mine = squads.list.filter((q) => q.team === team);
  const room = mine.find((q) => q.members.length < SQUAD_SIZE);
  if (room) {
    room.members.push(id);
    squads.by.set(id, room);
    update(squads, sim);
    return { squad: room, created: null };
  }
  if (!mine.length) {
    const sq = add(squads, fresh(`${team}.1`, team, [id]));
    update(squads, sim);
    return { squad: sq, created: sq };
  }
  const first = mine[0];
  const out = [...first.members].reverse().find((m) => sim.entities.get(m)?.bot) ?? first.members.at(-1);
  first.members[first.members.indexOf(out)] = id;
  squads.by.set(id, first);
  const created = add(squads, fresh(`${team}.${mine.length + 1}`, team, [out]));
  update(squads, sim);
  return { squad: first, created };
}

// The squad list's rows for one soldier's squad: that soldier first, then
// the others in the squad's order; its letter is its place in the team.
export function squadRows(squads, sim, id, { names = [], nameOf = (m) => m, letterOf = () => null } = {}) {
  const sq = squadOf(squads, id);
  if (!sq) return null;
  const index = squads.list.filter((q) => q.team === sq.team).indexOf(sq);
  const row = (m) => {
    const e = sim.entities.get(m);
    return { id: m, name: nameOf(m), cls: e?.cls?.cls ?? null, alive: Boolean(e?.alive), local: m === id, order: e?.alive ? letterOf(e.brain?.task ?? null) : null };
  };
  return { id: sq.id, letter: names[index] ?? null, members: [id, ...sq.members.filter((m) => m !== id)].map(row) };
}

export function update(squads, sim) {
  for (const sq of squads.list) {
    const alive = sq.members.map((id) => sim.entities.get(id)).filter((m) => m?.alive);
    // (a bot leads while one lives, by hand: the bots keep to the commander's order, not the player's)
    sq.leader = (alive.find((m) => m.bot) ?? alive[0])?.id ?? null;
    if (!alive.length) {
      sq.centre = null;
      sq.posture = 'retreat';
      continue;
    }
    sq.centre = [alive.reduce((n, m) => n + m.at[0], 0) / alive.length, alive.reduce((n, m) => n + m.at[2], 0) / alive.length];
    // the enemies any member believes in within the fight's reach, against every friend in that reach
    const reach = REACH;
    const near = (p) => Math.hypot(p[0] - sq.centre[0], p[1] - sq.centre[1]) <= reach;
    const seen = new Map();
    for (const m of alive)
      for (const b of Object.values(m.brain?.me?.beliefs ?? {})) {
        const e = sim.entities.get(b.id);
        if (b.hostile && e?.alive && !seen.has(b.id) && near([b.at.x, b.at.z])) seen.set(b.id, { id: b.id, at: b.at, alive: true });
      }
    if (!seen.size) {
      sq.level = 'neutral';
      sq.posture = 'hold';
      continue;
    }
    const friends = [];
    for (const f of sim.entities.values()) if (f.alive && f.team === sq.team && near([f.at[0], f.at[2]])) friends.push({ id: f.id, at: toV(f.at), alive: true });
    const c = confidence({ members: friends.map((m) => m.id) }, friends, [...seen.values()], { value: (m) => sim.entities.get(m.id)?.hp ?? 1 });
    sq.level = c.level;
    sq.posture = posture(c.level);
  }
}

export function alert(squads, from, seen, now) {
  const sq = squadOf(squads, from.id);
  if (!sq) return;
  const speed = from.brain?.template?.alertPropagationSpeed ?? 2;
  for (const id of sq.members) {
    if (id === from.id) continue;
    squads.alerts.push({ from: from.id, to: id, target: seen.id, at: [...seen.at], arrive: now, origin: [...from.at], speed });
  }
}

// the alerts whose wave has reached their squadmate by now: each plants a belief
export function deliver(squads, sim, now) {
  const done = [];
  const keep = [];
  for (const a of squads.alerts) {
    const m = sim.entities.get(a.to);
    if (!m?.alive) continue;
    const d = Math.hypot(m.at[0] - a.origin[0], m.at[2] - a.origin[2]);
    if (now - a.arrive + 1e-9 < d / a.speed) {
      keep.push(a);
      continue;
    }
    done.push(a);
    const beliefs = m.brain?.me?.beliefs;
    if (beliefs && !beliefs[a.target]) beliefs[a.target] = { id: a.target, at: toV(a.at), vel: { x: 0, y: 0, z: 0 }, seenAt: -Infinity, heardAt: m.brain.me.now ?? 0, confidence: 0.5, visible: false, timer: 0, kind: null, faction: null, hostile: true };
  }
  squads.alerts = keep;
  return done;
}
