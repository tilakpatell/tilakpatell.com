// The rooms' common kit (for ../interiors.js): a room's parts gathered and
// merged by role, so a room is a dozen draw calls however much is in it.
// Solid colours go in one vertex-coloured toon mesh (the furniture, which
// casts shadows) and another (the walls and fixtures, which don't); glows in
// one vertex-coloured unlit mesh; every painted picture (posters, windows,
// the calendar, the map) is packed into one canvas and drawn as decals. Plus
// walls with openings, doors and windows, the floors from rules.js's PLAN,
// ceilings, the cutaway that sinks a wall standing between the camera and
// Morty, and a few painting helpers. People are ./people.js.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hot } from '../../stage';
import { toon } from '../../portal/toon';
import { at, batch, coloured, mergeParts, paint, rng } from '../kit';
import { PLAN } from '../rules';

export const WALL_H = 2.6;
export const DOOR_H = 2.1;
export const BOX = new THREE.BoxGeometry(1, 1, 1);
export const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
export const CYL8 = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
export const BALL = new THREE.SphereGeometry(0.5, 16, 12);
export const BALL8 = new THREE.SphereGeometry(0.5, 8, 6);
export const PLANE = new THREE.PlaneGeometry(1, 1);
export const TAU = Math.PI * 2;

// A lathe from a profile of [radius, y] pairs (bottom to top), for flasks,
// lampshades and the like
export const lathe = (pts, seg = 16) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
// a tube along points [[x, y, z], …], `r` thick
export const tube = (pts, r, seg = 24) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), seg, r, 6, false);

// ── a room ──

// makeRoom(kit, id) gathers a room's parts; build() merges them into its
// group and returns the area's { group, update, noInk, light, dispose }.
export function makeRoom(kit, id) {
  const group = new THREE.Group();
  group.name = `c137-${id}`;
  const lists = { solid: [], fixed: [], glow: [] };
  const cells = new Map(); // atlas: name → { w, h, draw }
  const decals = { lit: [], bright: [] };
  const tiled = batch(); // floors and boards with world-space uvs
  const owned = []; // geometries, materials and textures this room made
  const noInk = [];
  const ticks = [];
  const cuts = [];
  let shownAt = null; // the last frame's time, to tell a first frame back

  // A frame to draw in: (u across, y up, v out of its front) about (x, z),
  // turned by `turn` (rules.js's furniture turn: 0 faces south). `list` is
  // where its solids go: 'solid' casts shadows, 'fixed' doesn't.
  const frame = (x, z, turn = 0, { y = 0, list = 'solid', glows = lists.glow } = {}) => {
    const base = at(x, y, z, turn);
    const put = (m) => base.clone().multiply(m);
    const into = Array.isArray(list) ? list : lists[list];
    const f = {
      base,
      // a box standing on y0, centred on (u, v)
      box(color, u, y0, v, w, h, d, ry = 0, rx = 0, rz = 0) {
        into.push({ geo: BOX, color, matrix: put(at(u, y0 + h / 2, v, ry, w, h, d, rx, rz)) });
        return f;
      },
      // a box centred on (u, y, v)
      cbox(color, u, y, v, w, h, d, ry = 0, rx = 0, rz = 0) {
        into.push({ geo: BOX, color, matrix: put(at(u, y, v, ry, w, h, d, rx, rz)) });
        return f;
      },
      // an upright cylinder standing on y0
      cyl(color, u, y0, v, r, h, rx = 0, rz = 0, geo = CYL) {
        into.push({ geo, color, matrix: put(at(u, y0 + (rx || rz ? 0 : h / 2), v, 0, r * 2, h, r * 2, rx, rz)) });
        return f;
      },
      ball(color, u, y, v, r, sy = 1, geo = BALL) {
        into.push({ geo, color, matrix: put(at(u, y, v, 0, r * 2, r * 2 * sy, r * 2)) });
        return f;
      },
      // any geometry, centred on (u, y, v)
      part(geo, color, u, y, v, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) {
        into.push({ geo, color, matrix: put(at(u, y, v, ry, sx, sy, sz, rx, rz)) });
        return f;
      },
      // a glow (unlit, bright enough to bloom at k > ~1.2)
      glow(geo, color, k, u, y, v, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) {
        glows.push({ geo, color: hot(color, k), matrix: put(at(u, y, v, ry, sx, sy, sz, rx, rz)) });
        return f;
      },
      // a painted picture from the atlas, facing out of the frame's front,
      // w × h, centred on (u, y, v); `bright` ones are unlit (windows, screens)
      decal(name, u, y, v, w, h, { ry = 0, rx = 0, rz = 0, bright = false, geo = PLANE, sz = 1 } = {}) {
        decals[bright ? 'bright' : 'lit'].push({ name, geo, matrix: put(at(u, y, v, ry, w, h, sz, rx, rz)) });
        return f;
      },
      // a frame inside this one
      sub(u, v, turn2 = 0, y2 = 0) {
        const s = frame(0, 0, 0, { list: into, glows });
        s.base.copy(base).multiply(at(u, y2, v, turn2));
        return s;
      },
      mat: (u, y, v, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => put(at(u, y, v, ry, sx, sy, sz, rx, rz)),
    };
    return f;
  };

  const R = {
    kit,
    id,
    group,
    noInk,
    owned,
    tiled,
    frame,
    // a picture for the atlas: w × h px, draw(ctx, w, h)
    cell(name, w, h, draw) {
      if (!cells.has(name)) cells.set(name, { w, h, draw });
      return name;
    },
    tick(fn) {
      ticks.push(fn);
    },
    add(obj, { ink = true } = {}) {
      group.add(obj);
      if (!ink) noInk.push(obj);
      return obj;
    },
    own(...things) {
      owned.push(...things);
      return things[0];
    },
    // frames for the walls and fixtures (no shadows): fixed(x, z, turn)
    fixed: (x, z, turn = 0) => frame(x, z, turn, { list: 'fixed' }),
    // A wall that sinks to a stub while it stands between the camera and
    // Morty: (x0, z0)–(x1, z1) is its line. Returns a frame maker like
    // fixed's, for what goes on it.
    cutaway(x0, z0, x1, z1) {
      const parts = [];
      cuts.push({ line: [x0, z0, x1, z1], parts, k: 1, mesh: null });
      return (x, z, turn = 0) => frame(x, z, turn, { list: parts });
    },
    // What's over a doorway: hidden while the camera is under it (it can
    // go through a doorway, as high as 2.35 m), within `near` of the line
    // (or the point); its glows go with it
    overhead(x0, z0, x1, z1, near = 0.55) {
      const parts = [];
      const glow = [];
      cuts.push({ line: [x0, z0, x1, z1], parts, glow, k: 1, mesh: null, near });
      return (x, z, turn = 0) => frame(x, z, turn, { list: parts, glows: glow });
    },
    // `grain`: { map, tile } laid over the walls and the furniture in world
    // space (tile metres to a repeat), the show's mottled paint
    build({ light, update, grain = null } = {}) {
      const vc = kit.mats.toon(0xffffff, { vertexColors: true });
      const gm = grain && own(toon(0xffffff, { vertexColors: true, map: grain.map }));
      if (gm) gm.userData.tile = grain.tile;
      // a list of parts as one mesh into the group: merged, or batched with the grain's uvs
      const merge = (parts, cast) => {
        let mesh;
        if (gm) {
          const b = batch();
          for (const p of parts) {
            const g = coloured(p.geo, p.color);
            b.add(g, gm, p.matrix);
            g.dispose();
          }
          [mesh] = b.build(group, { cast, receive: true });
        } else {
          mesh = new THREE.Mesh(mergeParts(parts), vc);
          mesh.castShadow = cast;
          mesh.receiveShadow = true;
          group.add(mesh);
        }
        own(mesh.geometry);
        parts.length = 0;
        return mesh;
      };
      for (const [name, cast] of [
        ['solid', true],
        ['fixed', false],
      ])
        if (lists[name].length) merge(lists[name], cast);
      for (const cut of cuts) {
        if (cut.parts.length) cut.mesh = merge(cut.parts, false);
        if (cut.glow?.length) {
          cut.lit = new THREE.Mesh(own(mergeParts(cut.glow)), own(new THREE.MeshBasicMaterial({ vertexColors: true })));
          R.add(cut.lit, { ink: false });
        }
      }
      if (lists.glow.length) {
        const mesh = new THREE.Mesh(own(mergeParts(lists.glow)), own(new THREE.MeshBasicMaterial({ vertexColors: true })));
        R.add(mesh, { ink: false });
      }
      buildAtlas();
      for (const mesh of tiled.build(group, { cast: false, receive: true })) owned.push(mesh.geometry);
      return {
        group,
        noInk,
        light,
        update(t, dt, state, camera) {
          // (the first frame back in the area: the walls go straight to where they belong)
          const snap = shownAt == null || t - shownAt > 0.25;
          shownAt = t;
          if (cuts.length) sink(dt, state, camera, snap);
          for (const fn of ticks) fn(t, dt, state, camera);
          update?.(t, dt, state, camera);
        },
        dispose() {
          for (const o of owned) o.dispose?.();
          owned.length = 0;
        },
      };
    },
  };
  const own = (x) => {
    owned.push(x);
    return x;
  };

  // pack every cell into one canvas (shelves, 1024 wide), then the decals
  // with their uvs moved into their cells
  function buildAtlas() {
    if (!cells.size) return;
    const W = 1024;
    const pad = 3;
    const list = [...cells.entries()].sort((a, b) => b[1].h - a[1].h);
    let x = 0;
    let y = 0;
    let row = 0;
    const rect = new Map();
    for (const [name, c] of list) {
      if (x + c.w + pad * 2 > W) {
        x = 0;
        y += row;
        row = 0;
      }
      rect.set(name, { x: x + pad, y: y + pad, w: c.w, h: c.h });
      x += c.w + pad * 2;
      row = Math.max(row, c.h + pad * 2);
    }
    const H = Math.ceil((y + row) / 64) * 64;
    const tex = own(
      paint(
        kit.renderer,
        W,
        H,
        (g) => {
          for (const [name, c] of cells) {
            const r = rect.get(name);
            g.save();
            g.translate(r.x, r.y);
            g.beginPath();
            g.rect(-pad, -pad, r.w + pad * 2, r.h + pad * 2);
            g.clip();
            c.draw(g, r.w, r.h);
            g.restore();
          }
        },
        { wrap: false },
      ),
    );
    const make = (list2, mat, ink) => {
      if (!list2.length) return;
      const geos = list2.map(({ name, geo, matrix }) => {
        const r = rect.get(name);
        if (!r) throw new Error(`no cell ${name}`);
        const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(matrix);
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        const uv = g.attributes.uv;
        const u0 = (r.x + 0.5) / W;
        const u1 = (r.x + r.w - 0.5) / W;
        const v1 = 1 - (r.y + 0.5) / H;
        const v0 = 1 - (r.y + r.h - 0.5) / H;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
        return g;
      });
      const merged = own(mergeGeometries(geos, false));
      for (const g of geos) g.dispose();
      const mesh = new THREE.Mesh(merged, own(mat));
      mesh.receiveShadow = true;
      R.add(mesh, { ink });
    };
    // (cut out where a picture leaves its canvas clear: a round rug, a lampshade's edge)
    make(decals.lit, toon(0xffffff, { map: tex, alphaTest: 0.5 }), true);
    make(decals.bright, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5 }), true);
  }

  // the cutaway walls: down to a stub while the line from the camera to
  // Morty crosses theirs, back up once it doesn't
  const crosses = (ax, az, bx, bz, [x0, z0, x1, z1]) => {
    // the wall's line, a little longer at each end
    const L = Math.hypot(x1 - x0, z1 - z0) || 1;
    const ex = ((x1 - x0) / L) * 0.35;
    const ez = ((z1 - z0) / L) * 0.35;
    const cx0 = x0 - ex;
    const cz0 = z0 - ez;
    const cx1 = x1 + ex;
    const cz1 = z1 + ez;
    const d1 = (bx - ax) * (cz0 - az) - (bz - az) * (cx0 - ax);
    const d2 = (bx - ax) * (cz1 - az) - (bz - az) * (cx1 - ax);
    const d3 = (cx1 - cx0) * (az - cz0) - (cz1 - cz0) * (ax - cx0);
    const d4 = (cx1 - cx0) * (bz - cz0) - (cz1 - cz0) * (bx - cx0);
    return d1 * d2 < 0 && d3 * d4 < 0;
  };
  const segDist = (px, pz, [x0, z0, x1, z1]) => {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const t = Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(px - (x0 + t * dx), pz - (z0 + t * dz));
  };
  function sink(dt, state, camera, snap) {
    const m = state.morty;
    if (!m) return;
    const c = camera.position;
    for (const cut of cuts) {
      if (!cut.mesh) continue;
      if (cut.near) {
        cut.mesh.visible = segDist(c.x, c.z, cut.line) > cut.near;
        if (cut.lit) cut.lit.visible = cut.mesh.visible;
        continue;
      }
      const want = crosses(c.x, c.z, m.x, m.z, cut.line) ? 0.06 : 1;
      cut.k = snap ? want : cut.k + (want - cut.k) * Math.min(1, dt * 9);
      if (Math.abs(cut.k - want) < 0.002) cut.k = want;
      cut.mesh.scale.y = cut.k;
      cut.mesh.visible = cut.k > 0.01;
    }
  }

  return R;
}

// ── walls and floors ──

// A run of wall from a to b ([x, z]); `into` is the side the room is on
// ([nx, nz]); it is `thick` thick, out from the line on the far side
// (`centred` for a wall between two rooms), WALL_H high (or `h`), in `color`
// (or a tiled material, `mat`), with
// `holes`: { at: metres along from a to its middle, w, y0, y1 }. `skirt`
// colours the skirting on the room side (both sides if centred). Returns a
// frame on the wall's room face (v out into the room; u along it, from a or
// from b: u(s) says where s metres from a is).
export function wallRun(R, f0, a, b, { into, thick = 0.2, centred = false, h = WALL_H, color = 0xf1e6c8, mat = null, dado = null, skirt = 0xf6f2e8, skirtH = 0.11, crown = null, holes = [], back = null, side = 0 }) {
  let [x0, z0] = a;
  let [x1, z1] = b;
  let len = Math.hypot(x1 - x0, z1 - z0);
  let dx = (x1 - x0) / len;
  let dz = (z1 - z0) / len;
  let list = holes.map((o) => ({ ...o }));
  // `back`: a centred wall's far side in another room's look ({ color, skirt, skirtH, crown }), the wall split down its middle
  let F = { color, skirt, skirtH, crown };
  let B = back ? { ...F, ...back } : null;
  // run it so that the frame's front (v) faces into the room
  const flip = !!into && into[0] * -dz + into[1] * dx < 0;
  if (flip) {
    [x0, z0, x1, z1] = [x1, z1, x0, z0];
    dx = -dx;
    dz = -dz;
    list = list.map((o) => ({ ...o, at: len - o.at }));
    if (B) [F, B] = [B, F];
  }
  const turn = Math.atan2(-dz, dx);
  const f = f0(x0, z0, turn);
  const v0 = centred ? -thick / 2 : -thick;
  const v1 = centred ? thick / 2 : 0;
  const mid = (v0 + v1) / 2;
  const t = v1 - v0;
  list.sort((p, q) => p.at - q.at);
  // pieces between the holes, full height; under and over each hole
  const spans = [];
  let u = 0;
  for (const o of list) {
    const s = o.at - o.w / 2;
    if (s > u) spans.push([u, s]);
    u = o.at + o.w / 2;
  }
  if (u < len) spans.push([u, len]);
  // a box of wall from v a to v b, in a look's colour (or the tiled material, or the dado)
  const slab = (L, ua, ub, ya, yb, va, vb) => {
    const vm = (va + vb) / 2;
    const tt = vb - va;
    if (mat) R.tiled.add(BOX, mat, f.mat((ua + ub) / 2, (ya + yb) / 2, vm, 0, ub - ua, yb - ya, tt));
    else if (dado) {
      const [dh, dc] = dado;
      if (ya < dh) f.box(dc, (ua + ub) / 2, ya, vm, ub - ua, Math.min(yb, dh) - ya, tt);
      if (yb > dh) f.box(L.color, (ua + ub) / 2, Math.max(ya, dh), vm, ub - ua, yb - Math.max(ya, dh), tt);
    } else f.box(L.color, (ua + ub) / 2, ya, vm, ub - ua, yb - ya, tt);
  };
  const piece = (ua0, ub0, ya0, yb0) => {
    if (ub0 - ua0 < 1e-3 || yb0 - ya0 < 1e-3) return;
    // each a hair into the next, so no crack opens between them for the ink to find
    const ua = ua0 - 0.003;
    const ub = ub0 + 0.003;
    const ya = ya0 > 0 ? ya0 - 0.003 : ya0;
    const yb = yb0 < h ? yb0 + 0.003 : yb0;
    // (`side` 1 or -1: a centred wall's front half or back half alone, in the look given)
    if (side === 1) slab(F, ua, ub, ya, yb, mid, v1);
    else if (side === -1) slab(F, ua, ub, ya, yb, v0, mid);
    else if (B) {
      slab(F, ua, ub, ya, yb, mid, v1);
      slab(B, ua, ub, ya, yb, v0, mid);
    } else slab(F, ua, ub, ya, yb, v0, v1);
  };
  const S = side === -1 ? F : (B ?? F);
  const front = side !== -1;
  const rear = centred && side !== 1;
  for (const [ua, ub] of spans) {
    piece(ua, ub, 0, h);
    // (trim stands well proud of the wall: a thin step leaves the ink a dotted line)
    if (front && F.skirt != null) f.box(F.skirt, (ua + ub) / 2, 0, v1 + 0.016, ub - ua, F.skirtH, 0.032);
    if (rear && S.skirt != null) f.box(S.skirt, (ua + ub) / 2, 0, v0 - 0.016, ub - ua, S.skirtH, 0.032);
  }
  for (const o of list) {
    piece(o.at - o.w / 2, o.at + o.w / 2, 0, o.y0 ?? 0);
    piece(o.at - o.w / 2, o.at + o.w / 2, o.y1 ?? DOOR_H, h);
  }
  // a moulding where the wall meets the ceiling
  if (front && F.crown != null) f.box(F.crown, len / 2, h - 0.08, v1 + 0.03, len, 0.08, 0.06);
  if (rear && S.crown != null) f.box(S.crown, len / 2, h - 0.08, v0 - 0.03, len, 0.08, 0.06);
  // u(s): where s metres from a is along the frame
  return { f, len, thick: t, v0, v1, turn, u: (s) => (flip ? len - s : s) };
}

// A straight wall on a line of x or z from a to b, with openings placed by
// where they are in the world along it: { c, w, y0, y1, draw(f, u, wall) }
// (see win() and doorAt()). `frames` makes its frames (R.fixed or a
// cutaway's).
export function wallLine(R, frames, a, b, opts = {}, openings = []) {
  const alongX = Math.abs(b[1] - a[1]) < 1e-6;
  const s = (c) => Math.abs(alongX ? c - a[0] : c - a[1]);
  const w = wallRun(R, frames, a, b, { ...opts, holes: openings.map((o) => ({ at: s(o.c), w: o.w, y0: o.y0, y1: o.y1 })) });
  for (const o of openings) o.draw?.(w.f, w.u(s(o.c)), w);
  return w;
}
export const win = (c, w, y0, h, view, opts = {}) => ({ c, w, y0, y1: y0 + h, draw: (f, u, wl) => windowIn(f, u, y0, w, h, { view, v1: wl.v1, thick: wl.thick, ...opts }) });
export const doorAt = (c, opts = {}) => ({ c, w: opts.w ?? 0.92, y0: 0, y1: opts.h ?? DOOR_H, draw: (f, u, wl) => door(f, u, { v1: wl.v1, thick: wl.thick, ...opts }) });

// An open doorway in a wall between rooms, from a to b on the wall's line:
// the wall over it and a casing round it. `back` is the far side's look
// ({ color, trim, crown }), when the rooms either side differ; `arch` (its
// rise, in metres) rounds its head, `h` being the arch's top then.
export function doorway(R, a, b, { thick = 0.24, color = 0xf1e6c8, trim = 0xf6f2e8, h = DOOR_H, top = WALL_H, crown = null, back = null, arch = 0, width = 0.09, proud = 0.04 } = {}) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const B = back ? { color, trim, crown, ...back } : null;
  // the jambs stay; the wall over the door and the casing's head go with the camera under them
  const over = R.overhead(a[0], a[1], b[0], b[1]);
  const w = wallRun(R, over, a, b, { centred: true, thick, color, skirt: null, crown, h: top, back: B && { color: B.color, crown: B.crown }, holes: [{ at: len / 2, w: len, y0: 0, y1: arch ? top : h }] });
  const jf = R.fixed(a[0], a[1], w.turn);
  const t = w.v1 - w.v0;
  const d = t + proud * 2;
  const spring = h - arch;
  // the casing, each face in its own room's trim
  const faces = B && B.trim !== trim ? [[trim, d / 4, d / 2], [B.trim, -d / 4, d / 2]] : [[trim, 0, d]];
  for (const [c, vc, dd] of faces) {
    for (const s of [-1, 1]) jf.box(c, len / 2 + s * (len / 2 + width / 2 - 0.01), 0, vc, width, arch ? spring : h + width - 0.01, dd);
    if (arch) w.f.part(archGeo(len / 2 - 0.01, arch, { ring: width }), c, len / 2, spring, vc - dd / 2, 0, 1, 1, dd);
    else w.f.box(c, len / 2, h, vc, len + width * 2 - 0.02, width, dd);
  }
  // the wall round the arch, up to the top
  if (arch) {
    const fill = archGeo(len / 2 + 0.003, arch, { fill: top - spring });
    if (B) w.f.part(fill, color, len / 2, spring, 0, 0, 1, 1, t / 2).part(fill, B.color, len / 2, spring, -t / 2, 0, 1, 1, t / 2);
    else w.f.part(fill, color, len / 2, spring, -t / 2, 0, 1, 1, t);
  }
}

// An arch's shapes, a metre deep (scale z to the depth), standing on its
// spring line, centred: the wall from it up to `fill` metres, or a band
// `ring` wide round it. `rx` is its half-width and `ry` its rise.
const arches = new Map();
function archGeo(rx, ry, { ring = 0, fill = 0 } = {}) {
  const key = `${rx.toFixed(3)},${ry.toFixed(3)},${ring.toFixed(3)},${fill.toFixed(3)}`;
  if (arches.has(key)) return arches.get(key);
  const s = new THREE.Shape();
  if (ring) {
    s.moveTo(rx + ring, 0);
    s.absellipse(0, 0, rx + ring, ry + ring, 0, Math.PI, false);
    s.lineTo(-rx, 0);
    s.absellipse(0, 0, rx, ry, Math.PI, 0, true);
  } else {
    s.moveTo(rx, 0);
    s.lineTo(rx, fill);
    s.lineTo(-rx, fill);
    s.lineTo(-rx, 0);
    s.absellipse(0, 0, rx, ry, Math.PI, 0, true);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 18 });
  arches.set(key, g);
  return g;
}

// The plan's room at (x, z) in `area`, or null
// (where two of the plan's rects overlap, the one it's furthest inside)
export function roomAt(area, x, z) {
  let best = null;
  let depth = -Infinity;
  for (const p of PLAN) {
    if (p.area !== area) continue;
    const d = Math.min(x - p.x0, p.x1 - x, z - p.z0, p.z1 - z);
    if (d >= 0 && d > depth) [best, depth] = [p, d];
  }
  return best;
}

// The walls between rooms (rules.js's INNER_WALLS for `area`, each [x0, z0,
// x1, z1, half-thickness] along x or z), each side in the look of the room
// it faces: look(room) → { color, skirt, skirtH, crown } (room null outside
// the plan). A wall is split where the rooms either side change, and runs on
// into the walls at its ends.
export function innerWalls(R, frames, area, walls, look) {
  for (const [x0, z0, x1, z1, th] of walls) {
    const L = Math.hypot(x1 - x0, z1 - z0);
    const dx = (x1 - x0) / L;
    const dz = (z1 - z0) / L;
    const alongX = Math.abs(dz) < 1e-6;
    const cuts = [0, L];
    for (const p of PLAN)
      if (p.area === area)
        for (const e of alongX ? [p.x0, p.x1] : [p.z0, p.z1]) {
          const s = alongX ? (e - x0) / dx : (e - z0) / dz;
          if (s > 0.02 && s < L - 0.02 && !cuts.some((c) => Math.abs(c - s) < 0.02)) cuts.push(s);
        }
    cuts.sort((p, q) => p - q);
    // the look on each side of each piece between the cuts (the front faces (-dz, dx))
    const off = th + 0.05;
    const pieces = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const m = (cuts[i] + cuts[i + 1]) / 2;
      const [mx, mz] = [x0 + dx * m, z0 + dz * m];
      pieces.push({ sa: cuts[i], sb: cuts[i + 1], 1: look(roomAt(area, mx - dz * off, mz + dx * off)), [-1]: look(roomAt(area, mx + dz * off, mz - dx * off)) });
    }
    // each side drawn in runs of one look, so a face is one piece wherever its colour doesn't change
    const same = (p, q) => p.color === q.color && p.skirt === q.skirt && p.crown === q.crown && (p.skirtH ?? 0.11) === (q.skirtH ?? 0.11);
    for (const side of [1, -1]) {
      let i = 0;
      while (i < pieces.length) {
        let j = i;
        while (j + 1 < pieces.length && same(pieces[j + 1][side], pieces[i][side])) j++;
        const ea = i === 0 ? th - 0.006 : 0;
        const eb = j === pieces.length - 1 ? th - 0.006 : 0;
        const [sa, sb] = [pieces[i].sa - ea, pieces[j].sb + eb];
        wallRun(R, frames, [x0 + dx * sa, z0 + dz * sa], [x0 + dx * sb, z0 + dz * sb], { centred: true, thick: th * 2, ...pieces[i][side], side });
        i = j + 1;
      }
    }
  }
}

// A door's casing round a hole (in a wall run's frame): jambs and a head,
// proud of both faces (or just the room's), `w` wide, `h` high, at `u`.
export function casing(f, u, w, h, v0, v1, color = 0xf6f2e8, { both = true, width = 0.09 } = {}) {
  const t = v1 - v0;
  const d = t + (both ? 0.08 : 0.04);
  const mid = (v0 + v1) / 2 + (both ? 0 : 0.02);
  for (const s of [-1, 1]) f.box(color, u + s * (w / 2 + width / 2 - 0.01), 0, mid, width, h + width - 0.01, d);
  f.box(color, u, h, mid, w + width * 2 - 0.02, width, d);
}

// A closed door in a hole: the slab a little in from the room face, panels,
// a knob, casing on the room side.
export function door(f, u, { w = 0.92, h = DOOR_H, v1 = 0, thick = 0.2, color = 0x7a4a2a, trim = 0xf6f2e8, panels = true, knob = 0xd8b25a, glass = null, casingW = 0.09 } = {}) {
  f.box(color, u, 0, v1 - thick / 2, w, h, 0.05);
  if (panels) {
    const shade = new THREE.Color(color).multiplyScalar(0.82);
    for (const [py, ph] of [
      [0.18, 0.75],
      [1.1, 0.8],
    ])
      for (const s of [-1, 1]) f.box(shade, u + s * w * 0.22, py, v1 - thick / 2 + 0.03, w * 0.32, ph, 0.012);
  }
  if (glass) f.decal(glass, u, h * 0.72, v1 - thick / 2 + 0.04, w * 0.36, h * 0.32, { bright: true });
  f.ball(knob, u - w * 0.38, 0.98, v1 - thick / 2 + 0.06, 0.035);
  f.ball(knob, u - w * 0.38, 0.98, v1 - thick / 2 - 0.06, 0.035);
  casing(f, u, w, h, v1 - thick, v1, trim, { both: false, width: casingW });
}

// A window in a hole: frame, glazing bars, sill and a painted view
// (`view`, a bright atlas cell) set into the wall.
export function windowIn(f, u, y0, w, h, { view, v1 = 0, thick = 0.2, frame = 0xf6f2e8, bars = [1, 1], sill = true } = {}) {
  const y1 = y0 + h;
  const vm = v1 - thick / 2;
  f.decal(view, u, (y0 + y1) / 2, vm, w, h, { bright: true });
  const fw = 0.08;
  // the frame, standing proud of the wall on the room side
  f.box(frame, u, y1 - 0.01, v1 - thick / 2 + 0.02, w + fw * 2, fw, thick + 0.04);
  f.box(frame, u, y0 - fw + 0.01, v1 - thick / 2 + 0.02, w + fw * 2, fw, thick + 0.04);
  for (const s of [-1, 1]) f.box(frame, u + s * (w / 2 + fw / 2), y0, v1 - thick / 2 + 0.02, fw, h, thick + 0.04);
  // bars: columns and rows
  const [cx, cy] = bars;
  for (let i = 1; i < cx; i++) f.box(frame, u - w / 2 + (w * i) / cx, y0, vm + 0.02, 0.035, h, 0.035);
  for (let i = 1; i < cy; i++) f.box(frame, u, y0 + (h * i) / cy - 0.0175, vm + 0.02, w, 0.035, 0.035);
  if (sill) f.box(frame, u, y0 - 0.05, v1 + 0.04, w + 0.24, 0.05, 0.1);
}

// A room's floors from PLAN: each a slab under y = 0, by material
// (floorMat(room) → a material); `lift` raises one (by id) a hair.
export function floors(R, area, floorMat, lift = {}) {
  for (const r of PLAN.filter((p) => p.area === area)) {
    const w = r.x1 - r.x0;
    const d = r.z1 - r.z0;
    R.tiled.add(BOX, floorMat(r), at((r.x0 + r.x1) / 2, -0.05 + (lift[r.id] ?? 0), (r.z0 + r.z1) / 2, 0, w, 0.1, d));
  }
}

// Ceilings over rects ([x0, x1, z0, z1]) at y: flat and unlit (lit from
// below they'd be the colour of the floor), casting no shadow.
export function ceilings(R, rects, y = WALL_H, color = 0xe9e0cc, map = null, tile = 1) {
  const mat = R.own(new THREE.MeshBasicMaterial({ color, map }));
  if (map) mat.userData.tile = tile;
  for (const [x0, x1, z0, z1] of rects) R.tiled.add(BOX, mat, at((x0 + x1) / 2, y + 0.04, (z0 + z1) / 2, 0, x1 - x0 + 0.02, 0.08, z1 - z0 + 0.02));
  return mat;
}

// a round light in the middle of each rect's ceiling
export function ceilingLights(R, rects, y = WALL_H, color = 0xfff2d0) {
  const f = R.frame(0, 0, 0, { list: 'fixed' });
  for (const [x0, x1, z0, z1] of rects) {
    const x = (x0 + x1) / 2;
    const z = (z0 + z1) / 2;
    f.cyl(0xf6f2e8, x, y - 0.03, z, 0.26, 0.03);
    f.glow(new THREE.SphereGeometry(0.2, 16, 6, 0, TAU, Math.PI / 2, Math.PI / 2), color, 1.7, x, y - 0.03, z, 0, 1, 0.45, 1);
  }
}

// Ceilings in each room's own colour, one mesh: rects [x0, x1, z0, z1,
// color] at y, flat and unlit, with the grain if given. add(color, matrix)
// puts in another piece (a slope).
export function tintedCeilings(R, rects, { y = WALL_H, grain = null } = {}) {
  const mat = R.own(new THREE.MeshBasicMaterial({ vertexColors: true, map: grain?.map ?? null }));
  if (grain) mat.userData.tile = grain.tile;
  const add = (color, matrix) => {
    const g = coloured(BOX, color);
    R.tiled.add(g, mat, matrix);
    g.dispose();
  };
  for (const [x0, x1, z0, z1, color] of rects) add(color, at((x0 + x1) / 2, y + 0.04, (z0 + z1) / 2, 0, x1 - x0 + 0.02, 0.08, z1 - z0 + 0.02));
  return { mat, add };
}

// The show's paint: soft blotches and specks, near white, to multiply a
// colour by (one texture, kept with the shared materials). { map, tile }.
export function grainOf(kit, tile = 1.7, { soft = false } = {}) {
  // (`soft`: half as strong, for the ceilings, which are lit by nothing)
  const k = soft ? 0.45 : 1;
  const m = kit.mats.painted(soft ? 'c137-in-grain-soft' : 'c137-in-grain', 256, 256, (g, w, h) => {
    const r = rng(17);
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    // drawn at each wrap, so it tiles
    const wrap = (fn) => {
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) fn(ox, oy);
    };
    for (let i = 0; i < 60; i++) {
      const [x, y, rad, a] = [r() * w, r() * h, 12 + r() * 36, (0.018 + r() * 0.03) * k];
      wrap((ox, oy) => {
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        gr.addColorStop(0, `rgba(60,58,50,${a})`);
        gr.addColorStop(1, 'rgba(60,58,50,0)');
        g.fillStyle = gr;
        g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      });
    }
    for (let i = 0; i < 700; i++) {
      g.fillStyle = r() < 0.5 ? `rgba(60,50,30,${0.06 * k})` : 'rgba(255,255,255,0.4)';
      g.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5);
    }
  });
  return { map: m.map, tile };
}

// a material with world-space uvs, `tile` metres to a repeat, painted once
export const tiledPaint = (mats, name, px, tile, draw, opts) => mats.painted(name, px, px, draw, { ...opts, tile });

// ── painting ──

// text in a box, fitted to its width
export function fitText(g, text, x, y, w, size, { font = 'Arial Black, Arial, sans-serif', weight = '900', color = '#111', align = 'center', base = 'middle' } = {}) {
  let s = size;
  g.font = `${weight} ${s}px ${font}`;
  while (g.measureText(text).width > w && s > 6) {
    s -= 1;
    g.font = `${weight} ${s}px ${font}`;
  }
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = base;
  g.fillText(text, x, y);
}

// A bright outdoor view for a window: sky over a lawn, a fence, trees.
export function windowView(seed = 1, { lawn = '#7cc35a', sky = ['#9edcf5', '#d9f3fb'], trees = true, house = true } = {}) {
  return (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, sky[0]);
    gr.addColorStop(0.62, sky[1]);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    // a cloud
    g.fillStyle = 'rgba(255,255,255,0.95)';
    const cx = w * (0.25 + ((seed * 37) % 50) / 100);
    for (const [dx, dy, r] of [
      [0, 0, 0.09],
      [0.08, -0.03, 0.11],
      [0.17, 0, 0.08],
    ]) {
      g.beginPath();
      g.arc(cx + dx * w, h * 0.22 + dy * h, r * w, 0, TAU);
      g.fill();
    }
    if (house) {
      g.fillStyle = seed % 2 ? '#f0c9a8' : '#c9dbe6';
      g.fillRect(w * 0.55, h * 0.48, w * 0.35, h * 0.2);
      g.fillStyle = '#7a4a38';
      g.beginPath();
      g.moveTo(w * 0.52, h * 0.49);
      g.lineTo(w * 0.725, h * 0.38);
      g.lineTo(w * 0.93, h * 0.49);
      g.fill();
    }
    if (trees)
      for (const [tx, r] of [
        [0.12, 0.13],
        [0.38, 0.1],
      ]) {
        g.fillStyle = '#6b4a2a';
        g.fillRect(w * tx - 3, h * 0.5, 6, h * 0.16);
        g.fillStyle = '#3f8f3a';
        g.beginPath();
        g.arc(w * tx, h * 0.47, r * w, 0, TAU);
        g.fill();
        g.fillStyle = '#56a84a';
        g.beginPath();
        g.arc(w * tx - r * w * 0.3, h * 0.44, r * w * 0.55, 0, TAU);
        g.fill();
      }
    g.fillStyle = lawn;
    g.fillRect(0, h * 0.64, w, h * 0.36);
    // a picket fence
    g.fillStyle = '#f7f4ec';
    g.fillRect(0, h * 0.69, w, 3);
    for (let px = 2; px < w; px += 9) g.fillRect(px, h * 0.64, 5, h * 0.11);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.moveTo(w * 0.1, h);
    g.lineTo(w * 0.32, h);
    g.lineTo(w * 0.62, 0);
    g.lineTo(w * 0.4, 0);
    g.fill();
  };
}

// A framed picture: an inked border round draw()
export function framed(draw, { border = '#5c3a22', inner = 5 } = {}) {
  return (g, w, h) => {
    g.fillStyle = border;
    g.fillRect(0, 0, w, h);
    g.save();
    g.translate(inner, inner);
    draw(g, w - inner * 2, h - inner * 2);
    g.restore();
    g.strokeStyle = '#1a1210';
    g.lineWidth = 2;
    g.strokeRect(1, 1, w - 2, h - 2);
  };
}

// handwriting-ish scribbles for notes
export function scribble(g, x, y, w, lines, { color = '#334', gap = 7, seed = 1 } = {}) {
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  g.strokeStyle = color;
  g.lineWidth = 1.2;
  for (let i = 0; i < lines; i++) {
    g.beginPath();
    let px = x;
    const end = x + w * (0.55 + r() * 0.45);
    g.moveTo(px, y + i * gap);
    while (px < end) {
      px += 3 + r() * 4;
      g.lineTo(px, y + i * gap + (r() - 0.5) * 2.5);
    }
    g.stroke();
  }
}
