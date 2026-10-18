// The galaxy's wars' operations on the holotable (HoloMap.jsx, WarLayers.jsx),
// as plain rules: each front and attack an arrow from the system its fleets
// come from to the one they're after, and a fleet on it that closes in as its
// side gains; and which battle a pilot's nearest to joining. Pure, tested.
//
// A front's fleets are the liberator's, from its best-held neighbour of the
// front (the nearest of those, on a tie); an attack's come from where it was
// launched (gcw.js's `origin`) while that's still the attacker's, or else
// from its best-held neighbour.
// The arrow bends to whichever side of its way has more room from the other
// systems' dots and the names beside them (roomOf), the left on a tie; two
// along one lane, one each way, bend each to its own left, so they part. It
// stops clear of both systems' dots; a raid's drawn dotted, the decisive
// battle doubled (the drawing's warmap.css's). Its fleet's crest goes about
// as far along it as its side's got, slid to where it's off the other
// systems and the crests before it.
//
// opsOf(table) → [{ id, kind ('front', 'decisive', 'attack', 'counter',
// 'raid'), by, from, to, progress (0..1, how much of the holder's hold is
// gone), colour, width, major, d (an SVG path), line (the path as drawn:
// d, on under the arrowhead), head (its arrowhead's points), start, tip, along (how far along it the fleet is, 0..1), token
// ([x, z]: the fleet) }] for gcw.js's warTable;
// nearestBattle(table, current, side) → { id, seconds } | null;
// roomOf([x, z], except) → grid squares from the nearest system's dot or
// name (but the dots of the systems in `except`; below 0 inside a dot);
// NAME_LEFT, the systems whose names these rules take to be on the left of
// their dots (the map's own names are placed by labelPlace.js, wherever
// there's room, so this is the rules' estimate: roomOf's, and badgeOf's side);
// badgeOf(id, ops) → where a fought-over system's + or − goes on its ring:
// 'below' it where there's room for it (from the systems, and the ends of
// the arrows in ops), or else wherever has the most of 'above' and the
// 'side' away from its name.

import { NEIGHBOURS } from './gcwRules';
import { SIDES, WARS } from './sides';
import { SYSTEMS, jumpSeconds, systemById } from './systems';

const CLEAR = 0.42; // grid squares off each end of an arrow: clear of the system's dot and ring
const WIDTH = [0.05, 0.13]; // an arrow's, by how fast its side's pushing (grid squares)

// the names these rules take to be on the left of their dot, for a neighbour's
// on the right or the map's edge (the map's own names are placed by
// labelPlace.js, wherever there's room: this is only these rules' estimate)
export const NAME_LEFT = new Set(['mustafar', 'hoth', 'geonosis', 'nevarro', 'mandalore', 'lothal', 'kamino']);
// what a system takes up on the map, roughly, in grid squares (a desktop's;
// on a phone a name's a little longer for the squares, so this errs short):
// its dot and ring, and its name, from just off the dot, so wide a letter
// (a charted world's dot is smaller, and its name, which gives way to
// everything else's, labelPlace.js's `optional`, isn't counted)
const DOT = 0.45;
const SMALL_DOT = 0.2; // (its 4 px is 0.12 of a square on a desktop's map, 0.23 on a phone's)
const NAME = { off: 0.4, per: 0.24, half: 0.25 };
const MARKS = SYSTEMS.map((s) => {
  const [x, z] = s.pos;
  const len = NAME.off + NAME.per * s.name.length;
  if (s.charted) return { id: s.id, dot: s.pos, r: SMALL_DOT, name: null };
  return { id: s.id, dot: s.pos, r: DOT, name: NAME_LEFT.has(s.id) ? [x - len, x - NAME.off, z] : [x + NAME.off, x + len, z] };
});

export function roomOf([x, z], except = []) {
  let room = Infinity;
  for (const m of MARKS) {
    if (m.name) {
      const [x0, x1, nz] = m.name;
      room = Math.min(room, Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(Math.abs(z - nz) - NAME.half, 0)));
    }
    if (!except.includes(m.id)) room = Math.min(room, Math.hypot(x - m.dot[0], z - m.dot[1]) - m.r);
  }
  return room;
}

// (a badge's centre, off a system's: just over the edge of its ring; the
// room it wants, about its own width; and how near an arrow's end may come,
// the end's own width)
const BADGE_OFF = 0.5;
const BADGE_ROOM = 0.3;
const END = 0.1;
// with the operations on the map (opsOf's), clear of their arrows' ends too:
// an arrowhead came in on the + under Coruscant
export function badgeOf(id, ops = []) {
  const [x, z] = systemById(id).pos;
  const ends = ops.flatMap((o) => [o.start, o.tip, ...o.head.split(' ').map((p) => p.split(',').map(Number))]);
  const room = (p) => Math.min(roomOf(p, [id]), ...ends.map((e) => Math.hypot(e[0] - p[0], e[1] - p[1]) - END));
  if (room([x, z + BADGE_OFF]) >= BADGE_ROOM) return 'below';
  const at = { below: [x, z + BADGE_OFF], above: [x, z - BADGE_OFF], side: [NAME_LEFT.has(id) ? x + BADGE_OFF : x - BADGE_OFF, z] };
  return Object.keys(at).reduce((best, k) => (room(at[k]) > room(at[best]) ? k : best));
}

const round = (v) => +v.toFixed(3);
const pt = ([x, z]) => `${round(x)} ${round(z)}`;
const toward = (p, q, r) => {
  const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
  return [p[0] + ((q[0] - p[0]) / l) * r, p[1] + ((q[1] - p[1]) / l) * r];
};

// where a side's fleets come at a system from: its neighbour of it it holds
// best (on a tie the nearest, then the first by name)
function bestHeld(rows, to, by) {
  const far = (o) => Math.hypot(systemById(o).pos[0] - systemById(to).pos[0], systemById(o).pos[1] - systemById(to).pos[1]);
  let from = null;
  for (const o of NEIGHBOURS[to]) {
    if (rows[o]?.owner !== by) continue;
    if (from === null || rows[o].control > rows[from].control || (rows[o].control === rows[from].control && far(o) < far(from))) from = o;
  }
  return from;
}

// an arrow from a to b, bent to the left of its way (side 1) or the right
// (-1), as the map shows it, z running down (a short one bends wide, so it
// clears the dots at either end), and the point t of the way along it
function arrowOf(a, b, width, side = 1) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = [((b[1] - a[1]) / len) * side, (-(b[0] - a[0]) / len) * side];
  const bend = len < 1.6 ? 0.9 : Math.min(1.2, Math.max(0.3, len * 0.16));
  const c = [(a[0] + b[0]) / 2 + n[0] * bend, (a[1] + b[1]) / 2 + n[1] * bend];
  const start = toward(a, c, CLEAR);
  const tip = toward(b, c, CLEAR);
  // (the line stops at the arrowhead's base, which points along the way it comes in)
  const long = 0.3 + width * 1.5;
  const half = 0.16 + width;
  const u = toward([0, 0], [tip[0] - c[0], tip[1] - c[1]], 1);
  const base = [tip[0] - u[0] * long, tip[1] - u[1] * long];
  const head = [tip, [base[0] - u[1] * half, base[1] + u[0] * half], [base[0] + u[1] * half, base[1] - u[0] * half]];
  const at = (t) => [0, 1].map((i) => (1 - t) ** 2 * start[i] + 2 * (1 - t) * t * c[i] + t * t * base[i]);
  // (and square to it there, a unit long)
  const across = (t) => {
    const v = [0, 1].map((i) => 2 * (1 - t) * (c[i] - start[i]) + 2 * t * (base[i] - c[i]));
    const l = Math.hypot(v[0], v[1]) || 1;
    return [-v[1] / l, v[0] / l];
  };
  // (and a line on to the head's last fifth, under it: the head is drawn the same size on screen at any zoom, about its tip,
  // so zoomed in it's shorter than the line that stops at its base, and this fills the gap)
  const under = [base[0] + (tip[0] - base[0]) * 0.8, base[1] + (tip[1] - base[1]) * 0.8];
  const d = `M${pt(start)} Q${pt(c)} ${pt(base)}`;
  return { d, line: `${d} L${pt(under)}`, head: head.map(([x, z]) => `${round(x)},${round(z)}`).join(' '), start, tip, at, across };
}

// the side of its way an arrow from one system to another has more room on
// (the least room anywhere along it, from the systems but its own two)
const ALONG = [0.2, 0.35, 0.5, 0.65, 0.8];
function sideFor(from, to, width) {
  const roomAlong = (side) => {
    const arrow = arrowOf(systemById(from).pos, systemById(to).pos, width, side);
    return Math.min(...ALONG.map((t) => roomOf(arrow.at(t), [from, to])));
  };
  return roomAlong(-1) > roomAlong(1) ? -1 : 1;
}

// a fleet's crest, its half-width ring and all (grid squares: 18 px on a desktop's map); the room past
// that it wants (more's no better); what sliding it a whole arrow's length off where its progress puts
// it costs, in room, and nudging it a grid square off its arrow's line
export const CREST = 0.3;
const ENOUGH = 0.2;
const SLIDE = 0.5;
const NUDGE = 0.6;
const SPAN = [0.2, 0.9]; // how far along its arrow a crest goes, at the least and the most
const STEPS = 28;
const OFF = [0, 0.15, -0.15, 0.3, -0.3]; // (off the line: still on it, at a crest's width)
// where along an arrow its crest goes: near where its progress puts it (`want`), slid to where there's
// room from the systems (but its own two) and the crests already placed, and nudged off the line if it
// must be (Kamino's two arrows, to Tatooine and Geonosis, are side by side). The further it slides the
// more it costs, so as its progress grows it only ever goes on, never back
function crestOn(arrow, want, except, placed) {
  let best = { t: want, at: arrow.at(want) };
  let bestU = -Infinity;
  for (let i = 0; i <= STEPS; i++) {
    const t = SPAN[0] + (i * (SPAN[1] - SPAN[0])) / STEPS;
    const p = arrow.at(t);
    const n = arrow.across(t);
    for (const off of OFF) {
      const q = [p[0] + n[0] * off, p[1] + n[1] * off];
      // (on another crest's worse than on a name: a name's still read round a crest's edge)
      let clear = 0;
      for (const o of placed) clear = Math.min(clear, Math.hypot(q[0] - o[0], q[1] - o[1]) - 2 * CREST);
      const u = Math.min(roomOf(q, except) - CREST, ENOUGH) + 2 * clear - SLIDE * Math.abs(t - want) - NUDGE * Math.abs(off);
      if (u > bestU) (best = { t, at: q }), (bestU = u);
    }
  }
  return best;
}

export function opsOf(table) {
  const { liberator } = WARS[table.war];
  const rows = Object.fromEntries(table.systems.map((r) => [r.id, r]));
  const plans = [];
  for (const r of table.systems) {
    const attack = r.attack;
    if (!attack && !(r.front && r.owner !== liberator)) continue;
    const by = attack ? attack.by : liberator;
    const launched = attack?.origin && rows[attack.origin]?.owner === by && NEIGHBOURS[r.id].includes(attack.origin) ? attack.origin : null;
    const from = launched ?? bestHeld(rows, r.id, by);
    if (!from) continue;
    const kind = attack ? (by === 'hutt' ? 'raid' : attack.counter ? 'counter' : 'attack') : r.decisive ? 'decisive' : 'front';
    const progress = Math.min(1, Math.max(0, 1 - r.control));
    const width = round(Math.min(WIDTH[1], Math.max(WIDTH[0], 0.05 + 0.004 * Math.abs(r.effRate ?? 0))));
    plans.push({ id: `${kind}-${r.id}`, kind, by, from, to: r.id, progress, colour: SIDES[by].colour, width, major: Boolean(r.major) });
  }
  // (a lane with an arrow each way: each to its own left)
  const twoWay = (p) => plans.some((q) => q.from === p.to && q.to === p.from);
  const placed = [];
  return plans.map((p) => {
    const arrow = arrowOf(systemById(p.from).pos, systemById(p.to).pos, p.width, twoWay(p) ? 1 : sideFor(p.from, p.to, p.width));
    const crest = crestOn(arrow, 0.35 + 0.5 * p.progress, [p.from, p.to], placed);
    placed.push(crest.at);
    return { ...p, d: arrow.d, line: arrow.line, head: arrow.head, start: arrow.start, tip: arrow.tip, along: round(crest.t), token: crest.at };
  });
}

// the battle a side's in that's the shortest jump from where you are (where
// you are first of all), and how long the jump is
export function nearestBattle(table, current, side) {
  if (!side) return null;
  const here = systemById(current);
  let best = null;
  for (const r of table.systems) {
    const b = r.battle;
    if (!b || (b.attacker !== side && b.defender !== side)) continue;
    const seconds = r.id === current ? 0 : +jumpSeconds(here, systemById(r.id)).toFixed(1);
    if (!best || seconds < best.seconds || (seconds === best.seconds && r.id < best.id)) best = { id: r.id, seconds };
  }
  return best;
}
