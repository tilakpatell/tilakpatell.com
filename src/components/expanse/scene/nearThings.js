// Things in space near the camera, built: the lattice's small things
// (gen/things.js), a sector's extras (its whole-sector lists) and the
// middle layer's wonders but the nebulae (whose clouds are sectors.js's).
// Far off, each is a disc of its true size in the far layer (discs.js);
// within THING_NEAR of its size (a wonder within where its ball is real, as
// its speck has it, as it always was) it's built here:
//   - a kind with a drawer (the `drawers` it's given: lane 4a's, from
//     universe/things/) by its drawer, handed that kind's rows each frame
//     once it has had any, none too, so it can hide what it drew
//   - every other as a ball (BALL) in its look, every ball of one look one
//     instanced mesh, hidden while it holds none, so a look with nothing
//     near costs no draw call. A lit look is lit by the scene's lights (the
//     key, from the star that lights where you are); an unlit one is its
//     colour, as the wonders' balls always were. Each mesh sits at the
//     first of its things and the rest go from there, so what goes to the
//     chip is small however far out it is.
// Each is solid while it's near (solids()), and its disc gives way to it
// only once it's drawn (shown()): a ball's mesh once it's readied (prepare,
// the scene's warm(): made for every look it knows the first frame, so
// they're ready long before they're needed), a drawer's rows unless the
// drawer says it isn't ready. Anything not drawn keeps its disc whole.
//
// This is the hook for more kinds: a lane adds rows to THING_KINDS or
// SECTOR_EXTRAS (gen/things.js) and, for a kind that isn't a ball, a drawer.
//
// SOLID_REACH: a near thing's solid reaches this many of its sizes
// WONDER_LOOK: { [wonder kind]: its ball's look }, the nebula's none
// lookOf(kind, own) → a thing's look: its kind's in THING_KINDS, or its own
//   for a kind the table hasn't (an extra's), or the first kind's
// thingIdOf(sector, i) → the id of the sector's lattice thing i (made once)
// biggestThing(sector) → the size of its biggest lattice thing (0 with none)
// eachThingWithin(sector, cam, radius, visit) → calls visit(i) for every
//   lattice thing i of the sector that may be within `radius` of cam (and
//   some that aren't: the caller measures), by a grid of where they are,
//   kept for the sector's ThingSet; a thing a kind's `place` put outside
//   the sector's cube is always visited
// pickNear(sectors, cam, { max = Infinity, out = [] }) → [{ id, kind, at,
//   size, look, near, sector }]: of the sectors' lattice things, extras and
//   wonders (not nebulae), those within `near` of cam (THING_NEAR × size; a
//   wonder's realAt of its speck), nearest first, a tie to the id first in
//   order, the most `max` (the budget's thingsNear). A row is the same object
//   for the same thing each time; `at` is where it is (the map's space),
//   `size` its radius (a wonder's ball's), `sector` the one it's of
// createNearThings(group, { drawers = {}, prepare = null, tier = 'mid', most = MOST })
//   → { update(rows, camera, t), shown() → Set of ids, solids() →
//   [{ id, at, r, reach }], dispose() }
//   group: where it builds, in the map's space (the rows')
//   drawers: { [kind]: (group, { kind, prepare, tier }) → { update(rows,
//   camera, t), ready?() → boolean, dispose() } }
//   prepare(object, alive) → a promise, or nothing: alive() says whether
//   it's still wanted
//   most: the most of one look drawn at once
//   shown(), solids(): one set and one array, kept, filled each update

import * as THREE from 'three';
import { SECTOR, spaceId } from '../../../lib/space/address';
import { THING_BASE, THING_CELLS, THING_KINDS, THING_NEAR } from '../gen/things';
import { realAt } from './levels';
import { WONDER, WONDER_SPECK } from './specks';

export const SOLID_REACH = 1.2;
const MOST = 96; // (the budget's thingsNear at its most: ultra's)
const CELL = SECTOR / THING_CELLS;
const HALF = SECTOR / 2;
const N = THING_CELLS;
const CELLS = N * N * N;

// (shared by every ball, never disposed)
const BALL = new THREE.SphereGeometry(1, 16, 12);

const KIND_LOOK = Object.fromEntries(THING_KINDS.map((k) => [k.kind, k.look]));
export const WONDER_LOOK = Object.fromEntries(
  Object.entries(WONDER)
    .filter(([kind]) => kind !== 'nebula')
    .map(([kind, w]) => [kind, { color: w.dark ?? w.color, lit: false }]),
);
export const lookOf = (kind, own) => KIND_LOOK[kind] ?? own ?? THING_KINDS[0].look;

// A sector's lattice things by where they are: a grid of CELL, a list a
// cell (counted, then filled: `items` from `start[c]` to `start[c + 1]`),
// and those outside the cube; with their ids and rows, made when first asked
const indexes = new WeakMap(); // ThingSet → its index
function indexOf(sector) {
  const t = sector.things;
  let ix = indexes.get(t);
  if (ix) return ix;
  const n = t.count;
  const cellOf = new Int32Array(n);
  const start = new Int32Array(CELLS + 1);
  const outside = [];
  let most = 0;
  for (let i = 0; i < n; i++) {
    most = Math.max(most, t.size[i]);
    const bx = Math.floor((t.at[i * 3] + HALF) / CELL);
    const by = Math.floor((t.at[i * 3 + 1] + HALF) / CELL);
    const bz = Math.floor((t.at[i * 3 + 2] + HALF) / CELL);
    if (!(bx >= 0 && bx < N && by >= 0 && by < N && bz >= 0 && bz < N)) {
      cellOf[i] = -1;
      outside.push(i);
      continue;
    }
    cellOf[i] = bx + N * (by + N * bz);
    start[cellOf[i] + 1]++;
  }
  for (let c = 0; c < CELLS; c++) start[c + 1] += start[c];
  const items = new Int32Array(n - outside.length);
  const next = start.slice(0, CELLS);
  for (let i = 0; i < n; i++) if (cellOf[i] >= 0) items[next[cellOf[i]]++] = i;
  ix = { start, items, outside: Int32Array.from(outside), most, ids: new Array(n), rows: new Array(n) };
  indexes.set(t, ix);
  return ix;
}

export const biggestThing = (sector) => (sector.things?.count > 0 ? indexOf(sector).most : 0);

export function thingIdOf(sector, i) {
  const ix = indexOf(sector);
  return (ix.ids[i] ??= spaceId([sector.sx, sector.sy ?? 0, sector.sz], { wonder: THING_BASE + sector.things.slot[i] }));
}

// how far a camera coordinate is from a cell's span along one axis
const gap = (c, b) => Math.max(0, b * CELL - c, c - (b + 1) * CELL);

export function eachThingWithin(sector, cam, radius, visit) {
  const t = sector.things;
  if (!t || !(t.count > 0)) return;
  const ix = indexOf(sector);
  const o = sector.origin;
  const cx = cam[0] - o[0] + HALF;
  const cy = cam[1] - o[1] + HALF;
  const cz = cam[2] - o[2] + HALF;
  const r2 = radius * radius;
  const y0 = Math.max(0, Math.floor((cy - radius) / CELL));
  const y1 = Math.min(N - 1, Math.floor((cy + radius) / CELL));
  const z0 = Math.max(0, Math.floor((cz - radius) / CELL));
  const z1 = Math.min(N - 1, Math.floor((cz + radius) / CELL));
  for (let bz = z0; bz <= z1; bz++) {
    const dz = gap(cz, bz);
    for (let by = y0; by <= y1; by++) {
      const dy = gap(cy, by);
      const rest = r2 - dy * dy - dz * dz;
      if (rest < 0) continue;
      const hx = Math.sqrt(rest);
      const x0 = Math.max(0, Math.floor((cx - hx) / CELL));
      const x1 = Math.min(N - 1, Math.floor((cx + hx) / CELL));
      if (x0 > x1) continue;
      const row = N * (by + N * bz);
      const end = ix.start[row + x1 + 1];
      for (let k = ix.start[row + x0]; k < end; k++) visit(ix.items[k]);
    }
  }
  for (let k = 0; k < ix.outside.length; k++) visit(ix.outside[k]);
}

// a row of each thing, made once
function latticeRow(sector, i) {
  const ix = indexOf(sector);
  let row = ix.rows[i];
  if (row) return row;
  const t = sector.things;
  const k = THING_KINDS[t.kind[i]] ?? THING_KINDS[0];
  const o = sector.origin;
  const size = t.size[i];
  row = { id: thingIdOf(sector, i), kind: k.kind, at: [o[0] + t.at[i * 3], o[1] + t.at[i * 3 + 1], o[2] + t.at[i * 3 + 2]], size, look: k.look, near: THING_NEAR * size, sector };
  ix.rows[i] = row;
  return row;
}
const others = new WeakMap(); // an extra's or a wonder's own row → its near row
function extraRow(sector, e) {
  let row = others.get(e);
  if (!row) others.set(e, (row = { id: e.id, kind: e.kind, at: [...e.at], size: e.size, look: lookOf(e.kind, e.look), near: THING_NEAR * e.size, sector }));
  return row;
}
function wonderRow(sector, w) {
  let row = others.get(w);
  if (!row) {
    const look = WONDER[w.kind] ? w.kind : 'rogue';
    row = { id: w.id, kind: w.kind, at: [...w.at], size: w.size * WONDER[look].r, look: WONDER_LOOK[look], near: realAt({ r: w.size * WONDER_SPECK }), sector };
    others.set(w, row);
  }
  return row;
}

// pickNear's frame: what's in reach so far, nearest first, the most kept
const picked = [];
const pickedD = [];
let most = Infinity;
let from = null; // (the camera, the sector and its things a visit is of)
let of = null;
const before = (d, row, k) => d < pickedD[k] || (d === pickedD[k] && row.id < picked[k].id);
function consider(row, d) {
  let k = picked.length;
  if (k >= most && !(k > 0 && before(d, row, k - 1))) return;
  while (k > 0 && before(d, row, k - 1)) k--;
  picked.splice(k, 0, row);
  pickedD.splice(k, 0, d);
  if (picked.length > most) {
    picked.pop();
    pickedD.pop();
  }
}
const distTo = (at, cam) => Math.sqrt((at[0] - cam[0]) ** 2 + (at[1] - cam[1]) ** 2 + (at[2] - cam[2]) ** 2);
function visitNear(i) {
  const t = of.things;
  const o = of.origin;
  const dx = o[0] + t.at[i * 3] - from[0];
  const dy = o[1] + t.at[i * 3 + 1] - from[1];
  const dz = o[2] + t.at[i * 3 + 2] - from[2];
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d < THING_NEAR * t.size[i]) consider(latticeRow(of, i), d);
}

export function pickNear(sectors, cam, { max = Infinity, out = [] } = {}) {
  picked.length = 0;
  pickedD.length = 0;
  most = max >= 0 ? Math.floor(max) : 0;
  from = cam;
  for (const sector of sectors) {
    if (!sector) continue;
    if (sector.things?.count > 0) {
      of = sector;
      eachThingWithin(sector, cam, THING_NEAR * indexOf(sector).most, visitNear);
    }
    const extras = sector.extras;
    if (extras)
      for (const list in extras)
        for (const e of extras[list]) {
          const row = extraRow(sector, e);
          const d = distTo(row.at, cam);
          if (d < row.near) consider(row, d);
        }
    for (const w of sector.wonders ?? []) {
      if (w.kind === 'nebula') continue;
      const row = wonderRow(sector, w);
      const d = distTo(row.at, cam);
      if (d < row.near) consider(row, d);
    }
  }
  from = of = null;
  out.length = 0;
  for (let k = 0; k < picked.length; k++) out.push(picked[k]);
  return out;
}

const keys = new WeakMap(); // a look → the name of its mesh
const keyOf = (look) => {
  let k = keys.get(look);
  if (!k) keys.set(look, (k = `${look.color}${look.lit ? ' lit' : ''}`));
  return k;
};

export function createNearThings(group, { drawers = {}, prepare = null, tier = 'mid', most: room = MOST } = {}) {
  const drawn = new Set(Object.keys(drawers)); // the kinds a drawer draws
  const made = new Map(); // kind → { drawer, rows }
  const balls = new Map(); // a look's key → { mesh, rows, last, ready }
  const shown = new Set();
  const solids = [];
  const solidOf = new WeakMap(); // a row → its solid
  const M = new THREE.Matrix4();
  let started = false;
  let gone = false;
  const alive = () => !gone;

  const drawerOf = (kind) => {
    let m = made.get(kind);
    if (!m) made.set(kind, (m = { drawer: drawers[kind](group, { kind, prepare, tier }), rows: [] }));
    return m;
  };
  const ballOf = (look) => {
    const k = keyOf(look);
    let b = balls.get(k);
    if (b) return b;
    const material = look.lit ? new THREE.MeshStandardMaterial({ color: look.color, roughness: 1, metalness: 0 }) : new THREE.MeshBasicMaterial({ color: look.color, toneMapped: false });
    const mesh = new THREE.InstancedMesh(BALL, material, room);
    mesh.name = `things:${k}`;
    mesh.count = 0;
    mesh.visible = false;
    group.add(mesh);
    b = { mesh, rows: [], last: [], ready: false };
    balls.set(k, b);
    const p = prepare?.(mesh, alive);
    const ready = () => (b.ready = true);
    if (p && typeof p.then === 'function') p.then(ready, ready);
    else ready();
    return b;
  };
  // the first frame: a drawer for each kind it's given one for, and a ball
  // for every look it knows, so each is made and readied before it's needed
  const start = () => {
    started = true;
    for (const kind of drawn) drawerOf(kind);
    for (const k of THING_KINDS) if (!drawn.has(k.kind)) ballOf(k.look);
    for (const kind in WONDER_LOOK) if (!drawn.has(kind)) ballOf(WONDER_LOOK[kind]);
  };
  const solid = (row) => {
    let s = solidOf.get(row);
    if (!s) solidOf.set(row, (s = { id: row.id, at: [...row.at], r: row.size, reach: row.size * SOLID_REACH }));
    return s;
  };
  // a look's balls, each where it is from the first of them (written again
  // only when they change), shown once readied
  const draw = (b) => {
    const { mesh, rows, last } = b;
    const n = Math.min(rows.length, room);
    let same = n === last.length;
    for (let k = 0; same && k < n; k++) same = rows[k] === last[k];
    if (!same) {
      mesh.count = n;
      if (n > 0) {
        const a = rows[0].at;
        mesh.position.set(a[0], a[1], a[2]);
        for (let k = 0; k < n; k++) {
          const r = rows[k];
          M.makeScale(r.size, r.size, r.size).setPosition(r.at[0] - a[0], r.at[1] - a[1], r.at[2] - a[2]);
          mesh.setMatrixAt(k, M);
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
      last.length = 0;
      for (let k = 0; k < n; k++) last.push(rows[k]);
    }
    mesh.visible = b.ready && n > 0;
    if (b.ready) for (let k = 0; k < n; k++) shown.add(rows[k].id);
  };

  return {
    update(rows, camera = null, t = 0) {
      if (gone) return;
      if (!started) start();
      for (const m of made.values()) m.rows.length = 0;
      for (const b of balls.values()) b.rows.length = 0;
      solids.length = 0;
      for (const row of rows) {
        if (drawn.has(row.kind)) drawerOf(row.kind).rows.push(row);
        else ballOf(row.look).rows.push(row);
        solids.push(solid(row));
      }
      shown.clear();
      for (const m of made.values()) {
        m.drawer.update(m.rows, camera, t);
        if (m.drawer.ready?.() !== false) for (const r of m.rows) shown.add(r.id);
      }
      for (const b of balls.values()) draw(b);
    },
    shown: () => shown,
    solids: () => solids,
    dispose() {
      gone = true;
      for (const m of made.values()) m.drawer.dispose();
      for (const b of balls.values()) {
        b.mesh.material.dispose();
        b.mesh.dispose();
        b.mesh.removeFromParent();
      }
      made.clear();
      balls.clear();
      shown.clear();
      solids.length = 0;
    },
  };
}
