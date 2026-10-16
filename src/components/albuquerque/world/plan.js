// Albuquerque, the city: what stands on every block, worked out once from a
// seed. Pure data, no drawing: rules.js turns the buildings, the yard walls
// and the parked cars into walls the car stops at, and city.js draws it all.
//
// Metres; +x is east, +z is south. A block is the land inside its four
// sidewalks. Each is zoned (downtown's towers, the mid-rise blocks round
// them, Route 66's strip along Central, the houses, the warehouses by the
// tracks, the civic plaza and a park) and cut into lots, and each lot gets
// its building, its yard or car park, its trees and the cars left in it.
// Anything the shows put somewhere (rules.js's places, landmarks and the
// rest of town) is passed in as `reserved`, and points that must stay clear
// (doors, the car wash, the crystals, the drops) as `keep`: no lot is laid
// over either.

import { seeded } from '../../../lib/seeded';

// What a building's walls are made of (city.js's facade shader reads it).
export const KIND = { adobe: 0, stucco: 1, brick: 2, glass: 3, concrete: 4, metal: 5, house: 6, garage: 7 };

// The colours walls come in, by kind, and the trim round windows, doors and
// signs: the earth, the plaster and the turquoise of the place.
export const WALLS = {
  adobe: [0xb98a5e, 0xc49a6c, 0xa87650, 0xd0a77a, 0xb37d55, 0xc8a07a, 0xbf8f63],
  stucco: [0xe8dcc4, 0xd9c3a0, 0xefe6d2, 0xcfe0d8, 0xf0d9b5, 0xe4c7a5, 0xd6b48c, 0xe9d0c4, 0xc9d7de, 0xf2e2c9],
  brick: [0x8f4a36, 0x7b4636, 0x9a5a40, 0x6e3b2e, 0x8a5240],
  glass: [0x3d5a6c, 0x4a6e7a, 0x2f4a5a, 0x5a4c3c, 0x41524e, 0x35525e],
  concrete: [0xb9b4a8, 0xa9a49a, 0xc7c1b3, 0x9a978f, 0xbdb3a2],
  metal: [0x8c9aa3, 0xa3a39b, 0x7d8a86, 0xb0a58f, 0x8a7f73, 0x9fb0a8],
  house: [0xd8b892, 0xc9a37a, 0xe3cba8, 0xbf9670, 0xd6c0a0, 0xcfae8a, 0xe6d5bc, 0xc79a76, 0xb7c2b4, 0xdcc2a2, 0xe2b98f],
  garage: [0xb5afa3, 0xa8a297],
};
const TRIMS = [0x2a8c8c, 0x1f6f73, 0x9a3b26, 0x2a5f8a, 0x5a3a26, 0xa8231c, 0xc98a1f, 0x2f6f3a, 0x6b3fa0, 0x3a3028];

// The names over the shops on the strip: made up, the way the town's own are.
export const SIGNS = [
  'GREEN CHILE GRILL',
  'DUKE CITY DONUTS',
  'SANDIA AUTO PARTS',
  'MESA VISTA MOTEL',
  'TURQUOISE TRADING POST',
  'RIO GRANDE TIRES',
  'LA MESA PAWN',
  'HIGH DESERT HARDWARE',
  'CASA DE TACOS',
  'ROADRUNNER LAUNDROMAT',
  'SUNSET MOTOR INN',
  'NOB HILL BOOKS',
  'RISTRA CAFE',
  'ZIA DRUGS',
  'OLD TOWN GALLERY',
  'COYOTE BAR',
  'PIÑON COFFEE',
  'BOSQUE BIKES',
  'ALAMEDA FURNITURE',
  'EL RANCHO MARKET',
  'TUMBLEWEED CINEMA',
  'BLUE CORN DINER',
  'ROUTE 66 GIFTS',
  'ACEQUIA FLOWERS',
  'LOBO RECORDS',
  'MOUNTAIN VIEW DENTAL',
  'ADOBE HOUSE BBQ',
  'SKYLINE CLEANERS',
  'SOPAIPILLA HUT',
  'VALLEY SHOE REPAIR',
  'DESERT ROSE SALON',
  'THUNDERBIRD LANES',
];

// The cars left in drives and car parks, by type (vehicles.js's models).
export const CAR_TYPES = ['sedan', 'pickup', 'suv', 'van', 'lowrider', 'hatch'];
const PARKED_MIX = [0, 0, 0, 1, 1, 2, 2, 3, 4, 5, 5];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const overlaps = (a, b, pad = 0) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + pad && Math.abs(a.z - b.z) < (a.d + b.d) / 2 + pad;
const touches = (k, x, z, w, d) => Math.hypot(Math.max(Math.abs(k.x - x) - w / 2, 0), Math.max(Math.abs(k.z - z) - d / 2, 0)) < k.r;

// Widths that add up to `len`, each between lo and hi (the last takes up the slack).
function cut(len, lo, hi, r) {
  const out = [];
  let left = len;
  while (left > 0) {
    if (left <= hi) {
      if (left >= lo || !out.length) out.push(left);
      else out[out.length - 1] += left; // too thin to stand on its own: the neighbour takes it
      break;
    }
    const w = lo + r() * (hi - lo);
    if (left - w < lo) {
      // split what's left evenly rather than leave a sliver
      out.push(left / 2, left / 2);
      break;
    }
    out.push(w);
    left -= w;
  }
  return out;
}

// The side of a block a front faces, as the facade shader reads it.
export const FRONT = { s: 1, n: 2, e: 4, w: 8 };

/**
 * planCity({ xs, zs, roads, zoneAt, reserved, keep, sidewalk, seed })
 * xs, zs: the grid's street lines; roads: rules.js's ROADS (for each block
 * side's street width); zoneAt(i, j): what block (i, j) is; reserved: rects
 * { x, z, w, d, pad? } already taken; keep: circles { x, z, r } to leave clear.
 * → { blocks, buildings, lots, parked, trees, walls, features }
 */
export function planCity({ xs, zs, roads, zoneAt, reserved = [], keep = [], sidewalk = 3, seed = 505, core = { x: 10, z: -50 } }) {
  const r = seeded(seed);
  const range = (a, b) => a + r() * (b - a);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const out = { blocks: [], buildings: [], lots: [], parked: [], trees: [], walls: [], features: [] };
  let n = 0;

  // the half-width of the street along a block's side (0 if none)
  const halfAt = (axis, line, mid) => {
    for (const rd of roads) {
      if (rd.dirt) continue;
      if (axis === 'z' && rd.a.z === line && rd.b.z === line && Math.min(rd.a.x, rd.b.x) <= mid && Math.max(rd.a.x, rd.b.x) >= mid) return rd.w / 2;
      if (axis === 'x' && rd.a.x === line && rd.b.x === line && Math.min(rd.a.z, rd.b.z) <= mid && Math.max(rd.a.z, rd.b.z) >= mid) return rd.w / 2;
    }
    return 0;
  };
  const free = (x, z, w, d, pad = 2.5) => !reserved.some((q) => overlaps({ x, z, w, d }, q, pad + (q.pad ?? 0))) && !keep.some((k) => touches(k, x, z, w, d));
  const freeSpot = (x, z, rad) => free(x, z, rad * 2, rad * 2, 0.5);
  // The biggest part of a rect that's clear of everything reserved and
  // kept: each thing in the way cuts it back to whichever side of it leaves
  // the most. Null if what's left is smaller than min.
  const fit = (x, z, w, d, min = 6, pad = 2.5) => {
    let R = { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 };
    const blockers = [...reserved.map((q) => ({ x0: q.x - q.w / 2 - pad - (q.pad ?? 0), x1: q.x + q.w / 2 + pad + (q.pad ?? 0), z0: q.z - q.d / 2 - pad - (q.pad ?? 0), z1: q.z + q.d / 2 + pad + (q.pad ?? 0) })), ...keep.map((k) => ({ x0: k.x - k.r, x1: k.x + k.r, z0: k.z - k.r, z1: k.z + k.r }))];
    for (let pass = 0; pass < 4; pass++) {
      const hit = blockers.find((q) => q.x0 < R.x1 && q.x1 > R.x0 && q.z0 < R.z1 && q.z1 > R.z0);
      if (!hit) break;
      const options = [
        { ...R, x1: Math.min(R.x1, hit.x0) },
        { ...R, x0: Math.max(R.x0, hit.x1) },
        { ...R, z1: Math.min(R.z1, hit.z0) },
        { ...R, z0: Math.max(R.z0, hit.z1) },
      ].filter((o) => o.x1 - o.x0 >= min && o.z1 - o.z0 >= min);
      if (!options.length) return null;
      R = options.reduce((a, b) => ((b.x1 - b.x0) * (b.z1 - b.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? b : a));
    }
    if (blockers.some((q) => q.x0 < R.x1 && q.x1 > R.x0 && q.z0 < R.z1 && q.z1 > R.z0)) return null;
    return { x: (R.x0 + R.x1) / 2, z: (R.z0 + R.z1) / 2, w: R.x1 - R.x0, d: R.z1 - R.z0 };
  };
  // a building cut back to fit round whatever's in the way
  const fitted = (b, min = 7) => {
    const f = fit(b.x, b.z, b.w, b.d, min);
    return f ? building({ ...b, ...f }) : false;
  };

  const tree = (x, z, s = range(0.85, 1.3), kind = r() < 0.78 ? 0 : 1) => {
    if (freeSpot(x, z, 1.4)) out.trees.push({ x: +x.toFixed(2), z: +z.toFixed(2), s: +s.toFixed(2), kind });
  };
  const lot = (x, z, w, d, surface, o = {}) => {
    if (w > 0.5 && d > 0.5) out.lots.push({ x, z, w, d, surface, ...o });
  };
  // a car left somewhere: yaw 0 faces +z
  const park = (x, z, yaw, type = PARKED_MIX[Math.floor(r() * PARKED_MIX.length)]) => {
    const across = Math.abs(Math.sin(yaw)) > 0.5;
    if (!free(x, z, across ? 4.6 : 2.1, across ? 2.1 : 4.6, 0.4)) return;
    out.parked.push({ x: +x.toFixed(2), z: +z.toFixed(2), yaw, type });
  };
  const building = (b) => {
    if (b.w < 4 || b.d < 4) return false;
    if (!free(b.x, b.z, b.w, b.d)) return false;
    out.buildings.push({ id: `c${n++}`, ...b, x: +b.x.toFixed(2), z: +b.z.toFixed(2), w: +b.w.toFixed(2), d: +b.d.toFixed(2), h: +b.h.toFixed(2) });
    return true;
  };
  // a car park: rows of bays across `w` (cars facing ±z), filled here and there
  const carPark = (x, z, w, d, fill = 0.55) => {
    lot(x, z, w, d, 'asphalt', { bays: 'z' });
    const rows = Math.max(1, Math.floor(d / 6.2));
    const cols = Math.floor((w - 1) / 2.8);
    for (let a = 0; a < rows; a++)
      for (let c = 0; c < cols; c++) {
        if (r() > fill) continue;
        const cx = x - w / 2 + 1.9 + c * 2.8;
        const cz = z - d / 2 + 3.1 + a * 6.2;
        park(cx, cz, r() < 0.5 ? 0 : Math.PI);
      }
  };

  // ── the kinds of block ──

  // A row of houses along one side of a block: `face` 'n' (fronts on the
  // street to the north) or 's'. z0..z1 is the row's depth.
  const houseRow = (x0, x1, z0, z1, face) => {
    const deep = z1 - z0;
    let x = x0;
    for (const lw of cut(x1 - x0, 13, 17.5, r)) {
      const cx = x + lw / 2;
      x += lw;
      const two = r() < 0.18;
      const w = clamp(lw - range(3.4, 5.4), 8.5, 13.5);
      const d = clamp(range(8, 10.5), 7, deep - 9);
      const setback = range(5.4, 7.2);
      const drive = lw - w >= 4.4 ? (r() < 0.5 ? -1 : 1) : 0; // which side the drive's on
      const hx = cx - drive * ((lw - w) / 2 - 0.8);
      const hz = face === 'n' ? z0 + setback + d / 2 : z1 - setback - d / 2;
      const flat = r() < 0.72;
      const ok = building({
        x: hx,
        z: hz,
        w,
        d,
        h: two ? range(6.1, 6.7) : range(3.2, 3.9),
        kind: KIND.house,
        wall: pick(WALLS.house),
        trim: pick(TRIMS),
        front: FRONT[face],
        floors: two ? 2 : 1,
        parapet: flat ? range(0.45, 0.8) : 0,
        roof: flat ? 'flat' : 'hip',
        tone: r(),
      });
      if (!ok) continue;
      // the drive, and maybe a car on it
      if (drive) {
        const dx = cx + drive * (lw / 2 - 2.1);
        const front = face === 'n' ? z0 : z1;
        const len = setback + d * 0.6;
        lot(dx, face === 'n' ? front + len / 2 : front - len / 2, 3.4, len, 'concrete');
        if (r() < 0.5) park(dx, face === 'n' ? front + 2.9 : front - 2.9, face === 'n' ? Math.PI : 0);
      }
      // a tree in the front yard, and one out back
      if (r() < 0.55) tree(cx - drive * (lw / 2 - 2.4), face === 'n' ? z0 + setback * 0.5 : z1 - setback * 0.5);
      if (r() < 0.5) tree(hx + range(-3, 3), face === 'n' ? Math.min(z1 - 2.2, hz + d / 2 + 3) : Math.max(z0 + 2.2, hz - d / 2 - 3), range(0.9, 1.4));
    }
  };
  // a block wall down the middle, between the back yards (broken where something's reserved)
  const backWall = (x0, x1, z) => {
    let start = x0;
    const stop = (end) => {
      const w = end - start;
      if (w > 3) out.walls.push({ x: +(start + w / 2).toFixed(2), z: +z.toFixed(2), w: +w.toFixed(2), d: 0.3, h: 1.7 });
    };
    for (let x = x0; x <= x1; x += 0.5) {
      if (!free(x, z, 0.5, 0.3, 1)) {
        stop(x - 0.5);
        start = x + 1;
      }
    }
    stop(x1);
  };

  const residential = (b) => {
    const mid = (b.z0 + b.z1) / 2;
    houseRow(b.x0, b.x1, b.z0, mid - 0.4, 'n');
    houseRow(b.x0, b.x1, mid + 0.4, b.z1, 's');
    backWall(b.x0 + 0.5, b.x1 - 0.5, mid);
  };

  // Shops facing a street: `face` is the side of the block the street is on
  // ('n' or 's'), z0..z1 the row's depth. Some stand at the sidewalk, some
  // behind a car park; the corner ones front the side street too.
  const shopRow = (b, z0, z1, face, { near = 0 } = {}) => {
    const deep = z1 - z0;
    let x = b.x0;
    const widths = cut(b.x1 - b.x0, 10, 19, r);
    widths.forEach((lw, k) => {
      const cx = x + lw / 2;
      x += lw;
      const roll = r();
      if (roll < 0.08) {
        lot(cx, (z0 + z1) / 2, lw - 0.4, deep, 'dirt');
        if (r() < 0.5) tree(cx + range(-3, 3), (z0 + z1) / 2 + range(-4, 4), range(0.7, 1), 1);
        return;
      }
      if (roll < 0.15) {
        carPark(cx, (z0 + z1) / 2, lw - 0.6, deep - 0.6, 0.6);
        return;
      }
      const back = roll < 0.45; // set back behind its own car park
      const d = back ? range(10, Math.min(15, deep - 9)) : range(12, deep - 1.5);
      const w = lw - range(0.4, 1.6);
      const gap = back ? deep - d - range(0, 1) : range(0, 0.6);
      const zc = face === 's' ? z1 - gap - d / 2 : z0 + gap + d / 2;
      const tall = r() < (near ? 0.45 : 0.22);
      const kind = near && r() < 0.4 ? KIND.brick : r() < 0.38 ? KIND.adobe : KIND.stucco;
      const ends = (k === 0 ? FRONT.w : 0) | (k === widths.length - 1 ? FRONT.e : 0);
      const ok = fitted({
        x: cx,
        z: zc,
        w,
        d,
        h: tall ? range(7.8, 8.8) : range(4.6, 5.6),
        kind,
        wall: pick(kind === KIND.brick ? WALLS.brick : kind === KIND.adobe ? WALLS.adobe : WALLS.stucco),
        trim: pick(TRIMS),
        front: FRONT[face] | ends,
        floors: tall ? 2 : 1,
        parapet: range(0.7, 1.3),
        roof: 'flat',
        tone: r(),
        sign: Math.floor(r() * SIGNS.length),
      });
      if (!ok) {
        carPark(cx, (z0 + z1) / 2, lw - 0.6, deep - 0.6, 0.35);
        return;
      }
      if (back) {
        // the car park's between it and the street
        const pd = gap - 0.4;
        const pz = face === 's' ? z1 - pd / 2 - 0.2 : z0 + pd / 2 + 0.2;
        if (pd > 5.5) carPark(cx, pz, lw - 0.8, pd, 0.5);
      }
    });
  };

  // Downtown: the block in one to four parcels, each a tower, a parking
  // structure or a little plaza; taller toward the middle of downtown.
  const downtown = (b, { mid = false } = {}) => {
    const W = b.x1 - b.x0;
    const D = b.z1 - b.z0;
    const split = mid ? 4 : r() < 0.2 ? 1 : r() < 0.5 ? 2 : 4;
    const parts =
      split === 1
        ? [[0, 0, 1, 1]]
        : split === 2
          ? r() < 0.5
            ? [[-0.25, 0, 0.5, 1], [0.25, 0, 0.5, 1]]
            : [[0, -0.25, 1, 0.5], [0, 0.25, 1, 0.5]]
          : [[-0.25, -0.25, 0.5, 0.5], [0.25, -0.25, 0.5, 0.5], [-0.25, 0.25, 0.5, 0.5], [0.25, 0.25, 0.5, 0.5]];
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    for (const [ox, oz, sx, sz] of parts) {
      const px = cx + ox * W;
      const pz = cz + oz * D;
      const pw = W * sx - 1.2;
      const pd = D * sz - 1.2;
      const k = Math.exp(-((Math.hypot(px - core.x, pz - core.z) / 120) ** 2));
      const roll = r();
      if (!mid && roll < 0.1) {
        lot(px, pz, pw, pd, 'pavers');
        for (let i = 0; i < 4; i++) tree(px + (i % 2 ? 1 : -1) * pw * 0.3, pz + (i < 2 ? 1 : -1) * pd * 0.3, range(0.9, 1.2));
        continue;
      }
      if (roll < 0.22) {
        if (!fitted({ x: px, z: pz, w: pw, d: pd, h: range(10, 14.5), kind: KIND.garage, wall: pick(WALLS.garage), trim: 0x3a3028, front: 15, floors: 4, parapet: 1.1, roof: 'flat', tone: r() })) carPark(px, pz, pw, pd, 0.45);
        continue;
      }
      const inset = range(0, 2.2);
      const w = pw - inset * 2;
      const d = pd - inset * 2;
      if (mid) {
        const kind = r() < 0.5 ? KIND.brick : r() < 0.6 ? KIND.stucco : KIND.concrete;
        const floors = 3 + Math.floor(r() * 4);
        const ok = fitted({ x: px, z: pz, w, d, h: floors * 3.7 + 0.8, kind, wall: pick(kind === KIND.brick ? WALLS.brick : kind === KIND.stucco ? WALLS.stucco : WALLS.concrete), trim: pick(TRIMS), front: 15, floors, parapet: range(0.8, 1.4), roof: 'flat', tone: r(), sign: r() < 0.5 ? Math.floor(r() * SIGNS.length) : undefined });
        if (!ok) carPark(px, pz, pw, pd, 0.45);
        continue;
      }
      const h = 16 + k * range(26, 78);
      const kind = h > 34 ? (r() < 0.62 ? KIND.glass : KIND.concrete) : pick([KIND.brick, KIND.concrete, KIND.glass]);
      const floors = Math.max(3, Math.round((h - 1) / (kind === KIND.glass ? 3.9 : 3.7)));
      if (!fitted({ x: px, z: pz, w, d, h, kind, wall: pick(kind === KIND.glass ? WALLS.glass : kind === KIND.brick ? WALLS.brick : WALLS.concrete), trim: pick(TRIMS), front: 15, floors, parapet: range(1, 1.8), roof: 'flat', tone: r() })) {
        carPark(px, pz, pw, pd, 0.45);
        continue;
      }
      if (inset > 1.2) for (const s of [-1, 1]) tree(px + s * (w / 2 + inset * 0.5), pz + (pd / 2) * (r() < 0.5 ? 1 : -1) * 0.8, 0.9);
    }
  };

  const warehouses = (b) => {
    const W = b.x1 - b.x0;
    const two = W > 34 && r() < 0.7;
    const halves = two ? [[b.x0, b.x0 + W / 2 - 1], [b.x0 + W / 2 + 1, b.x1]] : [[b.x0, b.x1]];
    for (const [a, c] of halves) {
      const w = c - a - range(1, 4);
      const d = range(16, Math.min(26, b.z1 - b.z0 - 14));
      const x = (a + c) / 2;
      const south = r() < 0.5;
      const z = south ? b.z1 - d / 2 - range(1, 3) : b.z0 + d / 2 + range(1, 3);
      const kind = r() < 0.65 ? KIND.metal : KIND.concrete;
      fitted({ x, z, w, d, h: range(7, 10.5), kind, wall: pick(kind === KIND.metal ? WALLS.metal : WALLS.concrete), trim: pick(TRIMS), front: south ? FRONT.n : FRONT.s, floors: 1, parapet: range(0.4, 0.9), roof: 'flat', tone: r() }, 10);
      // its yard, between it and the street it faces
      const yd = b.z1 - b.z0 - d - 3;
      const yz = south ? b.z0 + yd / 2 + 0.5 : b.z1 - yd / 2 - 0.5;
      lot(x, yz, c - a - 0.6, yd, r() < 0.5 ? 'asphalt' : 'gravel');
      for (let i = 0; i < 3; i++) if (r() < 0.6) park(x - (c - a) / 2 + 4 + i * 4.2 + r(), yz + range(-2, 2), south ? 0 : Math.PI, r() < 0.5 ? 1 : 3);
    }
  };

  const park2 = (b) => {
    lot((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, b.x1 - b.x0, b.z1 - b.z0, 'grass');
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    // paths from each side to the middle
    lot(cx, cz, b.x1 - b.x0, 2.4, 'pavers');
    lot(cx, cz, 2.4, b.z1 - b.z0, 'pavers');
    building({ x: cx + 9, z: cz - 9, w: 7.5, d: 5.5, h: 3.6, kind: KIND.adobe, wall: pick(WALLS.adobe), trim: TRIMS[0], front: FRONT.s | FRONT.w, floors: 1, parapet: 0.6, roof: 'flat', tone: r() });
    for (let i = 0; i < 34; i++) {
      const x = b.x0 + 2 + r() * (b.x1 - b.x0 - 4);
      const z = b.z0 + 2 + r() * (b.z1 - b.z0 - 4);
      if (Math.abs(x - cx) < 2.6 || Math.abs(z - cz) < 2.6) continue;
      tree(x, z, range(0.9, 1.6), r() < 0.85 ? 0 : 1);
    }
    out.features.push({ kind: 'fountain', x: cx, z: cz });
  };

  const civic = (b) => {
    const mid = (b.z0 + b.z1) / 2;
    building({ x: (b.x0 + b.x1) / 2, z: (b.z0 + mid) / 2, w: b.x1 - b.x0 - 6, d: mid - b.z0 - 3, h: 58, kind: KIND.glass, wall: 0x5a4c3c, trim: 0x3a3028, front: 15, floors: 15, parapet: 1.8, roof: 'flat', tone: 0.4 });
    const pz = (mid + b.z1) / 2;
    const pw = b.x1 - b.x0;
    lot((b.x0 + b.x1) / 2, pz, pw, b.z1 - mid, 'pavers');
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) tree((b.x0 + b.x1) / 2 + s * (pw / 2 - 3), mid + 3 + i * ((b.z1 - mid - 6) / 5), 1.05, 0);
    out.features.push({ kind: 'fountain', x: (b.x0 + b.x1) / 2, z: pz });
  };

  // ── every block ──
  for (let i = 0; i + 1 < xs.length; i++)
    for (let j = 0; j + 1 < zs.length; j++) {
      const mx = (xs[i] + xs[i + 1]) / 2;
      const mz = (zs[j] + zs[j + 1]) / 2;
      const kerb = { x0: xs[i] + halfAt('x', xs[i], mz), x1: xs[i + 1] - halfAt('x', xs[i + 1], mz), z0: zs[j] + halfAt('z', zs[j], mx), z1: zs[j + 1] - halfAt('z', zs[j + 1], mx) };
      const b = { i, j, zone: zoneAt(i, j), kerb, x0: kerb.x0 + sidewalk, x1: kerb.x1 - sidewalk, z0: kerb.z0 + sidewalk, z1: kerb.z1 - sidewalk };
      out.blocks.push(b);
      const D = b.z1 - b.z0;
      if (b.zone === 'res') residential(b);
      else if (b.zone === 'strip-s' || b.zone === 'strip-n') {
        // Central is on the block's south side ('strip-s') or its north
        const depth = range(19, 23);
        const near = Math.abs(mx) < 140;
        if (b.zone === 'strip-s') {
          shopRow(b, b.z1 - depth, b.z1, 's', { near });
          if (D - depth > 17) houseRow(b.x0, b.x1, b.z0, b.z1 - depth - 1.5, 'n');
        } else {
          shopRow(b, b.z0, b.z0 + depth, 'n', { near });
          if (D - depth > 17) houseRow(b.x0, b.x1, b.z0 + depth + 1.5, b.z1, 's');
        }
      } else if (b.zone === 'core') downtown(b);
      else if (b.zone === 'mid') downtown(b, { mid: true });
      else if (b.zone === 'ind') warehouses(b);
      else if (b.zone === 'park') park2(b);
      else if (b.zone === 'civic') civic(b);
      // street trees along the sidewalks of the houses and downtown
      if (b.zone === 'res' || b.zone === 'core' || b.zone === 'civic' || b.zone === 'mid') {
        const step = b.zone === 'res' ? 13 : 11;
        for (const z of [b.kerb.z0 + 1.3, b.kerb.z1 - 1.3]) for (let x = b.x0 + 4; x < b.x1 - 3; x += step) if (r() < 0.75) tree(x + range(-1, 1), z, range(0.75, 1.05), 0);
      }
    }
  return out;
}
