// The flight's director: now and then, while you fly over a planet, something
// happens (its kinds: ./eventTables.js), as the universe's director rolls its
// events (components/universe/director.js). One at a time; nothing in the
// first EVENT_FIRST seconds of a visit; EVENT_MIN_GAP seconds between one
// ending and the next; each over by its `ttl`.
//
// What happens where is seeded, so pilots together roll the same thing
// without a word: time is cut into SLOT-second slots on the wall clock, and
// each slot, in each 2,048 m cell (the room's, lib/net/cells.js), either
// has an event or not, of a kind and at a start the planet's seed, the cell
// and the slot pick. An event's id is its start second, its kind and its
// cell, so two pilots who rolled the same one hold the same id. It is also
// announced on the room (the caller's: `wire(ev)` out, `receive(ev)` in), so
// a pilot in the next cell, or one who came late, sees it too: one at a
// time, the earlier start (the lower id) wins and the other is dropped by
// both. One heard is believed only with a kind this planet has, within
// NET_CELL × 3 of you, and still running; a later one of the same kind
// within its cooldown is dropped.
//
// The planet has a clock of its own (DAY seconds of wall clock, its hour
// seeded), for what keeps to the night and for the Purge, which comes at
// sundown once a visit whether anyone rolled it or not.
//
// Pure: no three.js. Times are seconds; `now()` is the wall clock in ms.
//
//   createFlightDirector({ spec, list, now, seed }) → {
//     update(dt, ctx: { at: [x, z], cell, biomes }) → { begun: [ev], ended: [ev] },
//     receive(ev) → believed, active() → ev | null, wire(ev) → the room's,
//     clock() → { phase, night, dusk }, force(kind) → ev | null, clear() }
//   ev: { id, kind, at: [x, z], t0, ttl, seed, line, play, mine, …its row }

import { NET_CELL } from '../../net/cells.js';
import { eventsFor } from './eventTables.js';
import { rngOf } from './routes.js';

export const EVENT_FIRST = 60; // s after arrival before your own roll
export const EVENT_MIN_GAP = 45; // s between one ending and the next starting
export const SLOT = 90; // s of wall clock, each with one roll a cell
const CHANCE = 0.55; // a slot's chance of an event
export const DAY = 1200; // s of wall clock in the planet's day
export const SUNDOWN = 0.7; // the day's share at sundown; night until NIGHT_END
const NIGHT_END = 0.05;
export const BELIEVE = NET_CELL * 3; // m: an event further off is someone else's

const hashOf = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
// (start seconds are ten digits for centuries yet, so ids sort by start, then kind, then cell)
const idOf = (t0, kind, cell) => `${String(Math.floor(t0)).padStart(10, '0')}:${kind}:${cell}`;
const cellAt = (cell) => cell.split(',').map((v) => (Number(v) + 0.5) * NET_CELL);

export function createFlightDirector({ spec, list = eventsFor(spec), now = () => Date.now(), seed = spec?.seed ?? 1 } = {}) {
  const byKind = new Map(list.map((row) => [row.kind, row]));
  const offset = (hashOf(`${seed}:day`) / 4294967296) * DAY; // (the planet's own hour)
  let arrived = null;
  let current = null;
  let lastEnd = -Infinity;
  let ctx = { at: [0, 0], cell: '0,0', biomes: new Set() };
  const cool = new Map(); // kind → when it last ended
  const seen = new Set(); // ids over, or dropped, this visit
  const done = new Set(); // the clock's events had this visit
  let replaced = []; // dropped for a lower id since the last update

  const secs = () => now() / 1000;
  const clock = (t = secs()) => {
    const phase = (((t + offset) / DAY) % 1 + 1) % 1;
    return { phase, night: phase >= SUNDOWN || phase < NIGHT_END, dusk: phase >= SUNDOWN && phase < SUNDOWN + 0.08 };
  };
  const fits = (row, c, t) => {
    if (row.night && !c.night) return false;
    if (row.biome && !row.biome.some((b) => ctx.biomes.has(b))) return false;
    const last = cool.get(row.kind);
    return !(last !== undefined && t - last < row.cooldown);
  };
  const make = (row, t0, cell, mine, at = null, s = null) => {
    const id = idOf(t0, row.kind, cell);
    const r = rngOf(seed, cell, id);
    const [cx, cz] = cellAt(cell);
    return { ...row, id, t0, cell, at: at ?? [cx + (r() - 0.5) * NET_CELL * 0.6, cz + (r() - 0.5) * NET_CELL * 0.6], seed: s ?? hashOf(id), mine };
  };
  const end = (t) => {
    const ev = current;
    current = null;
    seen.add(ev.id);
    cool.set(ev.kind, t);
    lastEnd = t;
    return ev;
  };

  // the slot's roll for a cell: { row, t0 } or null
  const rollFor = (slot, cell, c) => {
    const r = rngOf(seed, cell, `slot${slot}`);
    if (r() >= CHANCE) return null;
    const t0 = slot * SLOT + r() * SLOT * 0.5;
    const rows = list.filter((row) => !row.at && fits(row, c, t0));
    const sum = rows.reduce((s, row) => s + row.weight, 0);
    let pick = r() * sum;
    for (const row of rows) if ((pick -= row.weight) < 0) return { row, t0 };
    return null;
  };

  return {
    update(dt, next = ctx) {
      ctx = { ...ctx, ...next, biomes: next.biomes instanceof Set ? next.biomes : new Set(next.biomes ?? []) };
      const t = secs();
      arrived ??= t;
      const ended = replaced;
      replaced = [];
      const begun = [];
      if (current && t >= current.t0 + current.ttl) ended.push(end(t));
      const c = clock(t);

      // the planet's clock: what comes at sundown (once a visit; it ends what else is on)
      for (const row of list) {
        if (row.at !== 'sundown' || done.has(row.kind)) continue;
        const day = Math.floor((t + offset) / DAY);
        const t0 = day * DAY - offset + SUNDOWN * DAY;
        if (t < t0 || t >= t0 + row.ttl) continue;
        const ev = make(row, t0, `day${day}`, true, ctx.at);
        if (current?.id === ev.id) continue;
        if (current) ended.push(end(t));
        done.add(row.kind);
        current = ev;
        begun.push(ev);
      }

      // your own roll
      if (!current && t - arrived >= EVENT_FIRST && t - lastEnd >= EVENT_MIN_GAP) {
        const slot = Math.floor(t / SLOT);
        // (this slot's, or the last one's still running)
        for (const s of [slot - 1, slot]) {
          const got = rollFor(s, ctx.cell, c);
          if (!got || t < got.t0 || t >= got.t0 + got.row.ttl) continue;
          const ev = make(got.row, got.t0, ctx.cell, true);
          if (seen.has(ev.id)) continue;
          current = ev;
          begun.push(ev);
          break;
        }
      }
      return { begun, ended };
    },

    // an event a peer announced ({ id, kind, at, t, seed }, read by flightProtocol's readEvent)
    receive(ev) {
      const row = byKind.get(ev?.kind);
      if (!row || seen.has(ev.id)) return false;
      if (Math.hypot(ev.at[0] - ctx.at[0], ev.at[1] - ctx.at[1]) > BELIEVE) return false;
      const t = secs();
      if (!(ev.t >= 0 && ev.t < row.ttl)) return false;
      if (current?.id === ev.id) return false;
      if (current && ev.id > current.id) return false;
      const last = cool.get(row.kind);
      if (last !== undefined && t - last < row.cooldown) return false;
      if (current) {
        // (the earlier wins: yours is dropped, and not taken up again)
        seen.add(current.id);
        replaced.push(current);
      }
      current = { ...row, id: ev.id, t0: t - ev.t, cell: ev.id.split(':')[2] ?? '', at: [ev.at[0], ev.at[1]], seed: ev.seed, mine: false };
      if (row.at) done.add(row.kind);
      return true;
    },

    active: () => current,
    // what the room is told: the event as it runs now (`t`: how long it has run)
    wire: (ev) => ({ id: ev.id, kind: ev.kind, at: [Math.round(ev.at[0]), Math.round(ev.at[1])], t: Math.max(0, Math.round((secs() - ev.t0) * 10) / 10), seed: ev.seed }),
    clock: () => clock(),
    // (the checks: start one of this planet's kinds now, as if rolled here)
    force(kind) {
      const row = byKind.get(kind);
      if (!row) return null;
      if (current) replaced.push(end(secs()));
      cool.delete(kind);
      current = make(row, secs(), ctx.cell, true, row.at ? ctx.at : null);
      return current;
    },
    clear() {
      current = null;
      replaced = [];
      seen.clear();
      done.clear();
      cool.clear();
      arrived = null;
      lastEnd = -Infinity;
    },
  };
}
