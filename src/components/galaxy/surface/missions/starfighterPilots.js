// Starfighter Assault's pilots (the sixth design's lane fighters, task 4):
// who flies each of the battle's fighters, by name, and what the stick of
// each does, in the one command shape the game's flight model takes
// (src/lib/flight/starfighter.js: { throttle, pitch, yaw, roll, boost, fire,
// missile }).
//
// - The names: the bots lane's `src/data/bf2017/ai.names.json` when it is on
//   main (its Starfighter Assault list for the side's faction), else the
//   air rulebook's own (`air.names`: the game's AINames_*_SpaceBattles,
//   `TK-772`, `TK-350` … for the Empire). namer(lists, faction) →
//   (fighterId) → a name, the same one for a fighter every time.
// - The minds: the bots lane's squadron behaviour trees
//   (`src/lib/battlefront/ai/squadron.js`, its `squadronCommand(fighter,
//   world, dt)`) when they are on main; until then the adapter over the
//   galaxy's own pilots (universe/battleAi.js, which flies them in the
//   battle): commandOf reads what a fighter did in a step (its nose's turn,
//   its speed, its shots) back as the stick and throttle that would have
//   done it on the fighter's game handling. Both answer the same shape, so
//   the mission has one path (the plan's review focus 5).

import { turnRatesAt, topSpeed } from '../../../../lib/flight/starfighter';
import { NAMES } from '../../../universe/wars';

// the bots lane's files, taken only when they're there (a guarded import: Vite's glob is empty without them)
const SQUADRON = import.meta.glob('../../../../lib/battlefront/ai/squadron.js');
const NAME_BOOK = import.meta.glob('../../../../data/bf2017/ai.names.json', { import: 'default' });

export const hasSquadron = () => Object.keys(SQUADRON).length > 0;

export async function loadMinds() {
  const load = Object.values(SQUADRON)[0];
  const mod = load ? await load().catch(() => null) : null;
  return mod?.squadronCommand ? { from: 'squadron', command: mod.squadronCommand } : { from: 'battleAi', command: null };
}

// the bots lane's names for a faction in the mode, in whichever shape it keeps them, else null
export function namesIn(book, faction) {
  if (!book) return null;
  const pick = (v) => (Array.isArray(v) && v.length ? v : null);
  return pick(book.spaceBattles?.[faction]) ?? pick(book.SpaceBattles?.[faction]) ?? pick(book[faction]?.spaceBattles) ?? pick(book[faction]?.SpaceBattles) ?? pick(book.starfighter?.[faction]) ?? null;
}

export async function loadNames(air) {
  const load = Object.values(NAME_BOOK)[0];
  const book = load ? await load().catch(() => null) : null;
  return { from: book ? 'ai.names.json' : 'air.json', book, air: air?.names ?? {} };
}

// (a faction's list: the bots lane's, else the rulebook's; the Rebels' list is the game's Rebel_Resistance one)
export function listFor(names, faction) {
  return namesIn(names.book, faction) ?? names.air?.[faction] ?? [];
}

function hash(s) {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function namer(list, faction = '') {
  const taken = new Map();
  const used = new Set();
  return (id) => {
    if (taken.has(id)) return taken.get(id);
    if (!list.length) return null;
    // (each its own while the list lasts, then again with a number)
    let i = hash(`${faction}:${id}`) % list.length;
    for (let k = 0; k < list.length && used.has(list[i]); k++) i = (i + 1) % list.length;
    const name = used.has(list[i]) ? `${list[i]}-${(used.size / list.length) | 0}` : list[i];
    used.add(name);
    taken.set(id, name);
    return name;
  };
}

// ── the adapter: a battle fighter's step read back as the game's command ──

const clamp = (v) => Math.max(-1, Math.min(1, v));
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

// `before` and `after`: { fwd: {x,y,z}, up?: {x,y,z}, speed, shots } a step apart; `row` the kind's air row, `scale` the battle's speed for its top speed
export function commandOf(before, after, dt, row, scale = 1) {
  const fwd = after.fwd;
  const up = after.up ?? { x: 0, y: 1, z: 0 };
  // (right wing: the nose crossed with the top)
  const right = { x: fwd.y * up.z - fwd.z * up.y, y: fwd.z * up.x - fwd.x * up.z, z: fwd.x * up.y - fwd.y * up.x };
  const d = { x: fwd.x - before.fwd.x, y: fwd.y - before.fwd.y, z: fwd.z - before.fwd.z };
  // degrees a second the nose went up and right
  const pitchRate = (Math.asin(Math.max(-1, Math.min(1, dot(d, up)))) / dt) * (180 / Math.PI);
  const yawRate = (Math.asin(Math.max(-1, Math.min(1, dot(d, right)))) / dt) * (180 / Math.PI);
  const speed = after.speed / scale;
  const [rp, ry] = turnRatesAt(row, speed);
  const top = topSpeed(row);
  return {
    throttle: Math.max(0, Math.min(1, (speed - row.handling.minSpeed) / (top - row.handling.minSpeed))),
    boost: speed > top + 0.5,
    pitch: clamp(pitchRate / (pitchRate < 0 ? rp * row.handling.pitchDownScale : rp)),
    yaw: clamp(yawRate / ry),
    roll: 0,
    fire: (after.shots ?? 0) > (before.shots ?? 0),
    missile: false,
  };
}

// ── the battle's fighters named, live (galaxy/warfront.js calls it each step
// of a Starfighter Assault): each fighter its side's next name, on its
// target bracket as "TK-772 · TIE fighter" (battleAi.js's `tgt.name`) ──

export function createRoster(lists = [[], []], kindName = (k) => NAMES[k] ?? k) {
  const namers = lists.map((list, team) => namer(list ?? [], String(team)));
  let last = null;
  return {
    // name every fighter not yet named (cheap: a flag a fighter)
    name(fighters) {
      for (const f of fighters) {
        if (f.pilot !== undefined) continue;
        f.pilot = namers[f.team]?.(f.id) ?? null;
        if (f.pilot && f.tgt) f.tgt.name = `${f.pilot} · ${kindName(f.kind)}`;
      }
    },
    // a hit the war front's guns made: the fighter it downed, remembered by name (the panel's last kill)
    downed(hit, fighters) {
      if (!hit?.down || hit.capital || hit.sub || hit.turret || hit.shield) return hit;
      const f = fighters.find((x) => x.id === hit.id);
      if (f?.pilot) last = { name: f.pilot, kind: f.kind };
      return hit;
    },
    get last() {
      return last;
    },
  };
}
