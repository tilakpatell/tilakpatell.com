// The generated bodies within the far plane, as discs of their true size
// (expanse/scene/levels.js): every star, every planet on its orbit round
// it, and the middle layer's wonders, of the systems not built whole
// (near.js builds those). Fed to the far layer's disc writer
// (universe/farStars.js) every frame: nothing is made a frame.
//
// pickDiscs(xyzr: Float64Array, n, cam: [x, y, z], { far, max }) → Int32Array:
//   the indices of the n bodies (x, y, z, r each) within far + r of the camera,
//   the nearest `max` kept, ordered far to near (ties by index)
// createDiscs(writer, { budget, far = FAR, keyed = false }) → { feed(sectors, cam, t, built, sectorAt, shownOf), count }
//   shownOf(sector) → 0 … 1: how much of a sector shows (its far-layer slot's), each of its discs times that
//   sectors: [Sector] (fullSector's, absolute places), cam: the camera in the map's
//   space, t: the shared clock (orbits.js), built: a Set of system ids drawn whole,
//   sectorAt(sx, sy, sz): a loaded sector, for the lattice's things (nearThings.js): a disc
//   each past where it's a mesh and within THING_DISC, fading over the last fifth.
//   A star shines by itself; a planet is lit from its star; a wonder from the way home.
//   `keyed`: each disc is pushed with a hash of its id, so the far layer can count pops (dev).

import { THING_KINDS } from '../gen/things';
import { orbitAt } from '../gen/orbits';
import { FAR, levelWeights } from './levels';
import { MESH_NEAR, THING_DISC, thingsAround } from './nearThings';

// how a middle-layer wonder looks as a disc (sectors.js's WONDER: a pulsar a
// small bright ball, a derelict or a rogue world a dark one); a nebula is
// lane 1's, never a disc
const WONDER = {
  pulsar: { color: '#b8f4ff', r: 0.15, glow: true },
  derelict: { color: '#2a2d33', r: 0.12 },
  rogue: { color: '#1e1a18', r: 0.5 },
};
const STAR_LIFT = 2.2; // (a star's disc as bright as its speck's core)

export function pickDiscs(xyzr, n, cam, { far, max }) {
  const keep = [];
  const d2 = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const dx = xyzr[i * 4] - cam[0];
    const dy = xyzr[i * 4 + 1] - cam[1];
    const dz = xyzr[i * 4 + 2] - cam[2];
    const r = far + xyzr[i * 4 + 3];
    d2[i] = dx * dx + dy * dy + dz * dz;
    if (d2[i] <= r * r) keep.push(i);
  }
  keep.sort((a, b) => d2[a] - d2[b] || a - b);
  const kept = keep.slice(0, max);
  kept.sort((a, b) => d2[b] - d2[a] || a - b);
  return Int32Array.from(kept);
}

// (a colour as three numbers, kept: there are few)
const rgbs = new Map();
const rgb = (hex) => {
  let c = rgbs.get(hex);
  if (!c) {
    const v = parseInt(hex.slice(1), 16);
    c = [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
    rgbs.set(hex, c);
  }
  return c;
};
// (FNV-1a over an id: a stable number for it, nothing made)
const keyOf = (id) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  return h >>> 0;
};

export function createDiscs(writer, { budget, far = FAR, keyed = false } = {}) {
  const max = budget?.discs ?? 1200;
  // the candidates this frame: x y z r, then which body
  let room = 256;
  let xyzr = new Float64Array(room * 4);
  let what = new Array(room); // { kind, row, star? }
  let n = 0;
  let count = 0;
  let shownNow = 1; // (the sector being looked through: how much of it shows)
  const add = (x, y, z, r, kind, row, star) => {
    if (n === room) {
      room *= 2;
      const was = xyzr;
      xyzr = new Float64Array(room * 4);
      xyzr.set(was);
      what.length = room;
    }
    xyzr[n * 4] = x;
    xyzr[n * 4 + 1] = y;
    xyzr[n * 4 + 2] = z;
    xyzr[n * 4 + 3] = r;
    let w = what[n];
    if (!w) w = what[n] = { kind: '', row: null, star: null, shown: 1 };
    w.kind = kind;
    w.row = row;
    w.star = star;
    w.shown = shownNow;
    n++;
  };
  const near = (p, cam, reach) => {
    const dx = p[0] - cam[0];
    const dy = p[1] - cam[1];
    const dz = p[2] - cam[2];
    return dx * dx + dy * dy + dz * dz <= reach * reach;
  };

  return {
    feed(sectors, cam, t, built = null, sectorAt = null, shownOf = null) {
      n = 0;
      if (sectorAt)
        thingsAround(sectorAt, cam, THING_DISC, (sector, i, d) => {
          const th = sector.things;
          if (d <= th.size[i] * MESH_NEAR) return;
          shownNow = shownOf ? shownOf(sector) : 1;
          if (!(shownNow > 0)) return;
          const o = sector.origin;
          add(o[0] + th.at[i * 3], o[1] + th.at[i * 3 + 1], o[2] + th.at[i * 3 + 2], th.size[i], 'thing', sector, i);
        });
      for (const sector of sectors) {
        shownNow = shownOf ? shownOf(sector) : 1;
        if (!(shownNow > 0)) continue;
        for (const s of sector.systems) {
          if (built?.has(s.id)) continue;
          if (!near(s.at, cam, far + (s.reach ?? s.star.size))) continue;
          add(s.at[0], s.at[1], s.at[2], s.star.size, 'star', s, null);
          for (const p of s.planets) {
            const o = p.centre ? orbitAt(p, t) : p.at;
            add(o[0], o[1], o[2], p.radius, 'planet', p, s);
          }
        }
        for (const w of sector.wonders) {
          const look = WONDER[w.kind];
          if (!look) continue;
          if (near(w.at, cam, w.size * look.r * MESH_NEAR)) continue; // (a mesh there: nearThings.js)
          add(w.at[0], w.at[1], w.at[2], w.size * look.r, 'wonder', w, null);
        }
      }
      // (the writer sorts and keeps what it has room for; only a frame with more
      // than the budget's worth is picked first, the nearest kept)
      const order = n > max ? pickDiscs(xyzr, n, cam, { far, max }) : null;
      const m = order ? order.length : n;
      writer.begin();
      for (let k = 0; k < m; k++) {
        const i = order ? order[k] : k;
        const x = xyzr[i * 4];
        const y = xyzr[i * 4 + 1];
        const z = xyzr[i * 4 + 2];
        const r = xyzr[i * 4 + 3];
        const dist = Math.hypot(x - cam[0], y - cam[1], z - cam[2]);
        if (dist > far + r) continue;
        // (whole within the far plane, a speck's past it: levels.js, with no reach of its own, since
        // what's built whole is skipped above)
        const w = what[i];
        // (and as much as its sector's specks show: a sector coming in fades its discs in with them)
        const alpha = levelWeights(dist, { reach: 0, far: w.kind === 'thing' ? THING_DISC : far }).disc * w.shown;
        let c;
        let lx = 0;
        let ly = 0;
        let lz = 0;
        let lift = 1;
        if (w.kind === 'thing') {
          const k = THING_KINDS[w.row.things.kind[w.star]];
          c = rgb(k.look.color);
          lx = -x;
          ly = -y;
          lz = -z;
        } else if (w.kind === 'star') {
          c = rgb(w.row.star.color);
          lift = STAR_LIFT;
        } else if (w.kind === 'planet') {
          c = rgb(w.row.color ?? '#8a8178');
          lx = w.star.at[0] - x;
          ly = w.star.at[1] - y;
          lz = w.star.at[2] - z;
        } else {
          const look = WONDER[w.row.kind];
          c = rgb(look.color);
          if (look.glow) lift = STAR_LIFT;
          else {
            lx = -x; // (lit from the way home, where the light of the middle is)
            ly = -y;
            lz = -z;
          }
        }
        writer.push(x, y, z, r, c[0] * lift, c[1] * lift, c[2] * lift, lx, ly, lz, alpha, keyed ? (w.kind === 'thing' ? (keyOf(w.row.id) ^ Math.imul(w.row.things.slot[w.star] + 1, 0x9e3779b1)) >>> 0 : keyOf(w.row.id)) : -1);
      }
      writer.end();
      count = writer.count?.() ?? m;
    },
    count: () => count,
  };
}
