// The small things of the endless space (gen/things.js's lattice: rocks,
// ice, derelicts, rogue worlds, a thing a 6,000-unit cell at most), and the
// middle layer's wonders but its nebulae: found round the camera by their
// cells, not by looking at every one, then drawn. Within MESH_NEAR of its
// size a thing is a mesh, one instanced draw a kind (none when there are
// none); further out, to THING_DISC, the far layer's disc (discs.js), a
// rocky one lumpy. (The generator's THING_NEAR, 8 sizes, would have a thing
// a disc 440 px across before its mesh came; at 30 the hand-over is at about
// 120 px, and no baseline pose has a thing that near, so none gains a draw
// call: at 100 they had 2 to 17 each.)
// A kind with a drawer of its own (lane 4a's, `drawers`) is handed its rows
// instead and draws them its own way.
// Lane 4a's: a sector's list rows (gen/extras) of a kind drawn near
// (catalogue KINDS[kind].near) are entries too, at where they are now
// (rowAt) within THING_NEAR of their sizes, nearest by the share of that
// reach; and the gargantuans in view (`giants`) within giants.js's mesh
// reach, outside the cap. Each entry carries its generator `row`, and what's
// solid is the catalogue's (rowSolids; a gargantuan's gargantuanKeeps). The
// legacy wonders keep lane 2's own looks, solids and reach: a lane doesn't
// change another's drawing on the way past.
//
// thingsAround(sectorAt, cam, reach, visit): every lattice thing whose cell is
//   within `reach` of the camera; sectorAt(sx, sy, sz) → a loaded sector or null;
//   visit(sector, i, dist) for each, i its index in the sector's ThingSet
// MESH_NEAR (sizes), THING_DISC (units)
// pickNear(sectorAt, sectors, cam, { max, t = 0, giants = [] }) → [{ id, kind, at, size, look, row, d }]:
//   things and wonders within MESH_NEAR × their size, list rows within THING_NEAR × theirs, the
//   nearest `max` by the share of their reach, and every gargantuan within its mesh reach
// createNearThings(group, { drawers = {}, prepare = null, tier }) → { update(rows, camera, t),
//   solids() → [{ id, at, r, reach }], dispose() }

import * as THREE from 'three';
import { SECTOR } from '../../../lib/space/address.js';
import { rock, rockMaterial } from '../../../lib/three/rock';
import { KINDS, lookOf, rowSolids } from '../gen/catalogue';
import { gargantuanKeeps } from '../gen/gargantuans';
import { rowAt } from '../gen/paths';
import { THING_BASE, THING_CELLS, THING_KINDS, THING_NEAR, thingRow } from '../gen/things';
import { GIANT } from './giants';

export const MESH_NEAR = 30;
export const THING_DISC = 20000;
const CELL = SECTOR / THING_CELLS;
const HALF = SECTOR / 2;
const SLOTS = THING_CELLS ** 3;
// (the middle layer's wonders, near: sectors.js's sizes for them)
const WONDER_NEAR = { pulsar: { r: 0.15, color: '#b8f4ff' }, derelict: { r: 0.12, color: '#6d727c' }, rogue: { r: 0.5, color: '#4a3f38' } };

// a sector's cell → index in its ThingSet (-1: none), made once a sector
const indexes = new WeakMap();
const indexOf = (sector) => {
  let ix = indexes.get(sector);
  if (!ix) {
    ix = new Int32Array(SLOTS).fill(-1);
    const t = sector.things;
    for (let i = 0; i < t.count; i++) ix[t.slot[i]] = i;
    indexes.set(sector, ix);
  }
  return ix;
};

export function thingsAround(sectorAt, cam, reach, visit) {
  const g = (v) => Math.floor((v + HALF) / CELL);
  const [gx, gy, gz] = [g(cam[0]), g(cam[1]), g(cam[2])];
  const n = Math.ceil(reach / CELL);
  for (let z = gz - n; z <= gz + n; z++) {
    const sz = Math.floor(z / THING_CELLS);
    const iz = z - sz * THING_CELLS;
    for (let y = gy - n; y <= gy + n; y++) {
      const sy = Math.floor(y / THING_CELLS);
      const iy = y - sy * THING_CELLS;
      for (let x = gx - n; x <= gx + n; x++) {
        const sx = Math.floor(x / THING_CELLS);
        const sector = sectorAt(sx, sy, sz);
        if (!sector?.things?.count) continue;
        const i = indexOf(sector)[x - sx * THING_CELLS + THING_CELLS * (iy + THING_CELLS * iz)];
        if (i < 0) continue;
        const t = sector.things;
        const o = sector.origin;
        const dx = o[0] + t.at[i * 3] - cam[0];
        const dy = o[1] + t.at[i * 3 + 1] - cam[1];
        const dz = o[2] + t.at[i * 3 + 2] - cam[2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d <= reach + t.size[i]) visit(sector, i, d);
      }
    }
  }
}

const reachFor = Math.max(...THING_KINDS.map((k) => k.size[1])) * MESH_NEAR;

// (a lattice thing's generator row, made once a slot and kept with its sector: its name's seed is ~20 µs)
const rowsOf = new WeakMap();
const latticeRow = (sector, i) => {
  let m = rowsOf.get(sector);
  if (!m) rowsOf.set(sector, (m = new Map()));
  let r = m.get(i);
  if (!r) m.set(i, (r = thingRow(sector, i)));
  return r;
};
const look = (kind) => {
  const l = lookOf(kind);
  return { color: l.color, lit: l.lit };
};

export function pickNear(sectorAt, sectors, cam, { max, t = 0, giants = [] }) {
  const out = [];
  thingsAround(sectorAt, cam, reachFor, (sector, i, d) => {
    const th = sector.things;
    if (d > th.size[i] * MESH_NEAR) return;
    const k = THING_KINDS[th.kind[i]];
    const o = sector.origin;
    out.push({ id: `${sector.id}:w${THING_BASE + th.slot[i]}`, kind: k.kind, at: [o[0] + th.at[i * 3], o[1] + th.at[i * 3 + 1], o[2] + th.at[i * 3 + 2]], size: th.size[i], look: k.look, d, share: d / (th.size[i] * MESH_NEAR), sector, slot: i });
  });
  for (const s of sectors) {
    for (const w of s.wonders) {
      const wl = WONDER_NEAR[w.kind];
      if (!wl) continue;
      const size = w.size * wl.r;
      const d = Math.hypot(w.at[0] - cam[0], w.at[1] - cam[1], w.at[2] - cam[2]);
      if (d <= size * MESH_NEAR) out.push({ id: w.id, kind: w.kind, at: w.at, size, look: { color: wl.color, lit: w.kind !== 'pulsar' }, d, share: d / (size * MESH_NEAR), legacy: true });
    }
    for (const rows of Object.values(s.extras ?? {}))
      for (const row of rows) {
        if (!KINDS[row.kind]?.near) continue;
        const at = rowAt(row, t);
        const d = Math.hypot(at[0] - cam[0], at[1] - cam[1], at[2] - cam[2]);
        const reach = THING_NEAR * row.size;
        if (d <= reach) out.push({ id: row.id, kind: row.kind, at, size: row.size, look: look(row.kind), d, share: d / reach, row });
      }
  }
  out.sort((a, b) => a.share - b.share);
  if (out.length > max) out.length = max;
  for (const e of out)
    if (e.sector) {
      e.row = latticeRow(e.sector, e.slot);
      e.sector = undefined;
    }
  for (const g of giants) {
    const d = Math.hypot(g.at[0] - cam[0], g.at[1] - cam[1], g.at[2] - cam[2]);
    if (d - g.size <= 1.2 * GIANT.near) out.push({ id: g.id, kind: g.kind, at: g.at, size: g.size, look: look(g.kind), d, row: g });
  }
  return out;
}

// a kind's shape: rocks and ice lumpy, a derelict a broken hull, a rogue world a ball, a pulsar a bright one
const shapeOf = (kind) => {
  if (kind === 'rock') return rock(7);
  if (kind === 'ice') return rock(19).scale(0.8, 1.35, 0.8);
  if (kind === 'derelict') {
    const hull = new THREE.CylinderGeometry(0.22, 0.32, 1.6, 7, 1).rotateZ(Math.PI / 2);
    return hull;
  }
  return new THREE.SphereGeometry(0.5, 24, 16);
};
const materialOf = (kind, look, tier) => {
  if (kind === 'rock') return rockMaterial({ tier });
  if (!look.lit) return new THREE.MeshBasicMaterial({ color: new THREE.Color(look.color).multiplyScalar(3), toneMapped: false });
  return new THREE.MeshStandardMaterial({ color: look.color, roughness: kind === 'ice' ? 0.35 : kind === 'derelict' ? 0.55 : 0.9, metalness: kind === 'derelict' ? 0.6 : 0, flatShading: kind !== 'rogue' });
};

export function createNearThings(group, { drawers = {}, prepare = null, tier = 'mid', max = 96 } = {}) {
  const meshes = new Map(); // kind → InstancedMesh
  const own = new Map(); // kind → a drawer's { update, dispose }
  const solidList = [];
  const byKind = new Map();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const colour = new THREE.Color();

  const meshFor = (kind, look) => {
    let m = meshes.get(kind);
    if (!m) {
      m = new THREE.InstancedMesh(shapeOf(kind), materialOf(kind, look, tier), max);
      m.name = `things:${kind}`;
      m.count = 0;
      m.visible = false;
      m.frustumCulled = false;
      group.add(m);
      meshes.set(kind, m);
      prepare?.(m);
    }
    return m;
  };

  return {
    update(rows, camera, t) {
      byKind.clear();
      for (const r of rows) {
        let l = byKind.get(r.kind);
        if (!l) byKind.set(r.kind, (l = []));
        l.push(r);
      }
      for (const [kind, d] of own) if (!byKind.has(kind)) d.update([], camera, t);
      for (const m of meshes.values()) {
        m.count = 0;
        m.visible = false;
      }
      solidList.length = 0;
      for (const [kind, list] of byKind) {
        if (drawers[kind]) {
          let d = own.get(kind);
          if (!d) own.set(kind, (d = drawers[kind](group, { prepare, tier })));
          d.update(list, camera, t);
        } else {
          const m = meshFor(kind, list[0].look);
          list.forEach((r, i) => {
            if (i >= max) return;
            // (each turned its own way, from its place, and turning slowly)
            const h = Math.sin(r.at[0] * 12.9898 + r.at[2] * 78.233) * 43758.5453;
            const f = h - Math.floor(h);
            e.set(f * 6.283, f * 17.3 + t * 0.02 * (f - 0.5), f * 3.1);
            q.setFromEuler(e);
            s.setScalar(r.size * (kind === 'derelict' ? 1 : 2));
            m.setMatrixAt(i, m4.compose(p.set(r.at[0], r.at[1], r.at[2]), q, s));
            if (kind === 'rock') m.setColorAt(i, colour.set(r.look.color).offsetHSL(0, 0, (f - 0.5) * 0.12));
          });
          m.count = Math.min(list.length, max);
          m.visible = m.count > 0;
          m.instanceMatrix.needsUpdate = true;
          if (m.instanceColor) m.instanceColor.needsUpdate = true;
        }
        for (const r of list) {
          if (!r.row) solidList.push({ id: r.id, at: r.at, r: r.size, reach: r.size * 1.2 }); // (a legacy wonder: lane 2's)
          else if (r.row.gargantuan) for (const k of gargantuanKeeps(r.row)) solidList.push({ id: r.id, at: k.at, r: k.r, reach: k.r * 1.2 });
          else for (const so of rowSolids(r.row, r.at)) solidList.push(so);
        }
      }
    },
    solids: () => solidList,
    dispose() {
      for (const m of meshes.values()) {
        m.removeFromParent();
        m.geometry.dispose();
        m.material.dispose();
        m.dispose();
      }
      meshes.clear();
      for (const d of own.values()) d.dispose();
      own.clear();
      solidList.length = 0;
    },
  };
}
