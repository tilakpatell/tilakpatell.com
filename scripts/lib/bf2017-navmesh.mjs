// The layered navgrid from a map's own shapes and ground (navLayers.js's
// format; the gap design's lane navmesh). The game's navmesh is undecoded, so
// the build asks the physics engine, column by column, where the soldier of
// CharacterPhysicsData can stand: every floor a ray down meets (and the
// terrain's, a surface of its own, holes left open) is a span when it is no
// steeper than MaxAscendAngle, has his Height of room above it before the
// next surface, and his capsule (PhysicalRadius, from StepHeight up to his
// Height) meets no shape there and the terrain does not cross it. Spans of
// neighbouring columns link: a walk when the rise is at most StepHeight, or a
// slope no steeper than MaxAscendAngle that is a slope all the way (the
// floor halfway is halfway up), with the capsule clear halfway; a hop (an
// off-mesh link) when the rise is a jump of at most JumpHeight, or a drop of
// at most DROP_DOWN, with room overhead for it. Only the neighbour's span
// nearest in height is tried, the rule the page finds it by.
//
//   soldierNav(soldierJson) → { radius, step, height, slope, jumpUp, dropDown, sources }
//   navSubs(subworldNames) → the sub-level indices the soldier walks in
//   navInstances(map, { subs, bounds, radiusOf, margin }) → [{ mesh, position, quaternion, scale }]
//   groundOf(record, { world, detail }) → { heightAt(x, z) (NaN in a hole or off the maps), min, max } | null
//   buildLayers({ RAPIER, world, bounds, cell, nav, heightAt, yTop, yBottom, onRow }) → layers
//   targetsOf(rows, stages) → [{ id, kind, mode, at, points?, y?, height?, team? }]
//   reachTable(layers, targets) → { main, spans, reached: [...], missed: [...] }

import { DIRS, components, opposite, reachFrom, spanNear } from '../../src/lib/battlefront/navLayers.js';

// m a soldier is let drop from a ledge (hand: the soldier's record's
// FallDamageThreshold is 0, so the game's height is not in the data)
export const DROP_DOWN = 4;
const EPS = 0.002;
const MAX_HITS = 64;

export function soldierNav(soldier) {
  const row = soldier.rows[soldier.default];
  const stand = row.poses.stand;
  const jump = row.states?.jump;
  return {
    radius: row.radius,
    step: stand.step,
    height: stand.height,
    slope: row.ascend,
    jumpUp: jump?.jumpHeight ?? 0,
    dropDown: DROP_DOWN,
    sources: {
      radius: row.radius_source,
      step: stand.step_source,
      height: stand.height_source,
      slope: row.ascend_source,
      jumpUp: jump?.jumpHeight_source ?? 'none',
      dropDown: 'hand (DROP_DOWN)',
    },
  };
}

// The sub-levels the game puts the soldier among: every one but what is
// only shown (the lobby, the end of round, the films, the weather and light
// sets, the occluders and the far dressing, the high-end set a low machine
// never loads, the capital ships' damaged states)
const SHOWN_ONLY = /(^|_)(lobby|lobbysplitscreen|splitscreen|eor|media|lookdev|sunny|sunset|cloudy|stormy|night|foggy|overcast|mistydawn|vfx|highend)$|cinematic|outro|intro|_nis|nis_|automation|occluder|enlighten|lighting|lightsettings|reflections|_cine$|^lgt_|vista|backdrop|_bg$|damage_phase/i;
const last = (p) => String(p).split('/').pop();
export const navSubs = (subworlds) => subworlds.map((s, i) => (SHOWN_ONLY.test(last(s?.name ?? s)) ? -1 : i)).filter((i) => i >= 0);

// What is placed and never stands in the way (bf2017-level.mjs's NEVER:
// lighting proxies, light cones, destruction stages waiting their turn, the
// planes that fake shadow and mist)
const NEVER = /enlighten|fx\/meshes\/lighting|despawn|leftover|_destruction_|shadowplane|invalidatelightplane|mistplane|lightcone/i;

export function navInstances(map, { subs, bounds, radiusOf, margin = 8 }) {
  const want = new Set(subs);
  const { position: P, quaternion: Q, scale: S } = map.instances;
  const qs = Q instanceof Int16Array ? 1 / 32767 : 1;
  const out = [];
  for (const g of map.groups) {
    if (g.kind === 'actor' || !want.has(g.sub) || NEVER.test(map.meshes[g.mesh]?.file ?? '')) continue;
    const radius = radiusOf(g.mesh);
    if (radius === null) continue;
    for (let i = g.first; i < g.first + g.count; i++) {
      const x = P[i * 3];
      const z = P[i * 3 + 2];
      const s = Math.max(Math.abs(S[i * 3]), Math.abs(S[i * 3 + 1]), Math.abs(S[i * 3 + 2]));
      const reach = radius * s + margin;
      if (x + reach < bounds.min[0] || x - reach > bounds.max[0] || z + reach < bounds.min[1] || z - reach > bounds.max[1]) continue;
      const q = [Q[i * 4] * qs, Q[i * 4 + 1] * qs, Q[i * 4 + 2] * qs, Q[i * 4 + 3] * qs];
      const l = Math.hypot(...q) || 1;
      out.push({ mesh: g.mesh, position: [x, P[i * 3 + 1], z], quaternion: q.map((v) => v / l), scale: [S[i * 3], S[i * 3 + 1], S[i * 3 + 2]] });
    }
  }
  return out;
}

// The terrain record's two heightmaps (`detail` over the arena, `world`
// beyond), each { data: Uint16Array, w, h }: metres at (x, z), NaN in a hole
// (the game cut the ground away there: a tunnel, a pit, a bunker's door) or
// off both maps. A hole in the detail map is a hole: the world map under it
// is not read.
export function groundOf(record, { world = null, detail = null }) {
  if (!record || (!world && !detail)) return null;
  const k = record.heightScale / 65536;
  const off = record.heightOffset ?? 0;
  const frame = (which, img) => {
    const m = record[which];
    if (!m || !img) return null;
    return { data: img.data, w: img.w, h: img.h, minX: m.minX, minZ: m.minZ, step: m.metresPerPixel, hole: m.holePixels > 0 ? 0 : -1 };
  };
  const maps = [frame('detail', detail), frame('world', world)].filter(Boolean);
  const sample = (m, x, z) => {
    const gx = (x - m.minX) / m.step;
    const gz = (z - m.minZ) / m.step;
    if (!(gx >= 0 && gz >= 0 && gx <= m.w - 1 && gz <= m.h - 1)) return undefined;
    const i = Math.min(Math.floor(gx), m.w - 2);
    const j = Math.min(Math.floor(gz), m.h - 2);
    const fx = gx - i;
    const fz = gz - j;
    const o = j * m.w + i;
    const a = m.data[o];
    const b = m.data[o + 1];
    const c = m.data[o + m.w];
    const d = m.data[o + m.w + 1];
    // (any hole under the sample's four texels makes it one: the cut's edge
    // is where the ground stops)
    if (a === m.hole || b === m.hole || c === m.hole || d === m.hole) return NaN;
    return off + ((a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz) * k;
  };
  const heightAt = (x, z) => {
    for (const m of maps) {
      const h = sample(m, x, z);
      if (h !== undefined) return h;
    }
    return NaN;
  };
  const r = record.detail ?? record.world;
  return { heightAt, min: Math.min(record.world?.heightMin ?? Infinity, r.heightMin ?? Infinity), max: Math.max(record.world?.heightMax ?? -Infinity, r.heightMax ?? -Infinity) };
}

// growable typed arrays for the spans
function grow(arr, n) {
  if (n <= arr.length) return arr;
  const next = new arr.constructor(Math.max(n, arr.length * 2));
  next.set(arr);
  return next;
}

export function buildLayers({ RAPIER, world, bounds, cell = 1, nav, heightAt = null, yTop, yBottom, onRow = null }) {
  const { radius: r, step, height } = nav;
  const cosS = Math.cos((nav.slope * Math.PI) / 180);
  const tanS = Math.tan((nav.slope * Math.PI) / 180);
  const len = height - step;
  const origin = [bounds.min[0], bounds.min[1]];
  const cols = Math.ceil((bounds.max[0] - bounds.min[0]) / cell);
  const rows = Math.ceil((bounds.max[1] - bounds.min[1]) / cell);
  const n = cols * rows;
  const ground = heightAt ?? (() => NaN);
  const ROT = { x: 0, y: 0, z: 0, w: 1 };
  const capsule = new RAPIER.Capsule(len / 2 - r, r);
  // (the capsule grown to a diagonal neighbour's middle: clear, and every
  // link from here is clear halfway)
  const reachR = r + cell * Math.SQRT1_2;
  const wide = len > 2 * reachR ? new RAPIER.Capsule(len / 2 - reachR, reachR) : new RAPIER.Cylinder(len / 2, reachR);
  const at = { x: 0, y: 0, z: 0 };
  const meets = (x, floor, z, shape) => {
    at.x = x;
    at.y = floor + step + len / 2;
    at.z = z;
    return world.intersectionWithShape(at, ROT, shape) !== null;
  };
  const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  const hitY = new Float64Array(MAX_HITS);
  const hitN = new Float64Array(MAX_HITS);
  // every surface a ray down meets from `from` to `to`: its height and how
  // level it is (|normal.y|: the engine turns a normal to face the ray)
  const hits = (x, z, from, to) => {
    let y = from;
    let k = 0;
    while (k < MAX_HITS && y > to) {
      ray.origin = { x, y, z };
      const hit = world.castRayAndGetNormal(ray, y - to, false);
      if (!hit) break;
      const hy = y - hit.timeOfImpact;
      hitY[k] = hy;
      hitN[k] = Math.abs(hit.normal.y);
      k++;
      y = hy - EPS;
    }
    return k;
  };
  // the terrain's slope test (its gradient over half a metre each way)
  const groundLevel = (x, z, g) => {
    const e = 0.5;
    const gx = (ground(x + e, z) - ground(x - e, z)) / (2 * e);
    const gz = (ground(x, z + e) - ground(x, z - e)) / (2 * e);
    if (!Number.isFinite(gx) || !Number.isFinite(gz)) return Number.isFinite(g);
    return 1 / Math.sqrt(1 + gx * gx + gz * gz) >= cosS - 1e-4;
  };
  // the terrain crossing the capsule round (x, z): a surface between the step and the head
  const groundCrosses = (x, z, floor) => {
    for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
      const h = ground(x + dx, z + dz);
      if (h > floor + step && h < floor + height) return true;
    }
    return false;
  };

  const count = new Uint8Array(n);
  let Y = new Float32Array(n);
  let clear = new Float32Array(n);
  let flags = new Uint8Array(n); // 1 the terrain's, 2 the wide capsule clear
  let spans = 0;
  const stats = { columns: n, rays: 0, tests: 0, dropped: { steep: 0, low: 0, shape: 0, terrain: 0, many: 0 } };
  const surfY = new Float64Array(MAX_HITS + 1);
  const surfN = new Float64Array(MAX_HITS + 1);
  const surfT = new Uint8Array(MAX_HITS + 1);
  const keepY = new Float64Array(MAX_HITS + 1);
  const keepC = new Float64Array(MAX_HITS + 1);
  const keepF = new Uint8Array(MAX_HITS + 1);
  for (let row = 0; row < rows; row++) {
    const z = origin[1] + (row + 0.5) * cell;
    for (let c = 0; c < cols; c++) {
      const x = origin[0] + (c + 0.5) * cell;
      const k = hits(x, z, yTop, yBottom);
      stats.rays += k + 1;
      const g = ground(x, z);
      // (the surfaces from the top down, the terrain among them)
      let m = 0;
      let placed = !Number.isFinite(g);
      for (let i = 0; i < k; i++) {
        if (!placed && g > hitY[i]) {
          surfY[m] = g;
          surfT[m++] = 1;
          placed = true;
        }
        surfY[m] = hitY[i];
        surfN[m] = hitN[i];
        surfT[m++] = 0;
      }
      if (!placed) {
        surfY[m] = g;
        surfT[m++] = 1;
      }
      let kept = 0;
      for (let i = 0; i < m; i++) {
        const y = surfY[i];
        const room = i > 0 ? surfY[i - 1] - y : Infinity;
        if (surfT[i] ? !groundLevel(x, z, y) : surfN[i] < cosS - 1e-4) {
          stats.dropped.steep++;
          continue;
        }
        if (room < height) {
          stats.dropped.low++;
          continue;
        }
        if (!surfT[i] && groundCrosses(x, z, y)) {
          stats.dropped.terrain++;
          continue;
        }
        stats.tests++;
        let f = surfT[i];
        if (!meets(x, y, z, wide)) f |= 2;
        else {
          stats.tests++;
          if (meets(x, y, z, capsule)) {
            stats.dropped.shape++;
            continue;
          }
        }
        keepY[kept] = y;
        keepC[kept] = Math.min(room, 1e4);
        keepF[kept++] = f;
      }
      if (kept > 255) {
        stats.dropped.many += kept - 255;
        kept = 255;
      }
      const j = row * cols + c;
      count[j] = kept;
      Y = grow(Y, spans + kept);
      clear = grow(clear, spans + kept);
      flags = grow(flags, spans + kept);
      // (lowest first)
      for (let i = kept - 1; i >= 0; i--) {
        Y[spans] = keepY[i];
        clear[spans] = keepC[i];
        flags[spans++] = keepF[i];
      }
    }
    onRow?.(row, rows, 'spans');
  }
  Y = Y.slice(0, spans);
  clear = clear.slice(0, spans);
  flags = flags.slice(0, spans);
  const first = new Uint32Array(n + 1);
  for (let j = 0, s = 0; j < n; j++) {
    first[j] = s;
    s += count[j];
    first[j + 1] = s;
  }

  // ── the links ──
  const walk = new Uint8Array(spans);
  const hop = new Uint8Array(spans);
  const nearestIn = (j, y) => {
    let best = -1;
    let bestD = Infinity;
    for (let t = first[j]; t < first[j + 1]; t++) {
      const d = Math.abs(Y[t] - y);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  };
  // the floor halfway on a slope: the terrain's, or the shape surface nearest the middle height
  const floorHalfway = (x, z, a, b, terrain) => {
    const want = (a + b) / 2;
    if (terrain) return ground(x, z);
    const hi = Math.max(a, b) + step + 0.05;
    const lo = Math.min(a, b) - step;
    const k = hits(x, z, hi, lo);
    stats.rays += k + 1;
    let best = NaN;
    for (let i = 0; i < k; i++) if (!(Math.abs(hitY[i] - want) >= Math.abs(best - want))) best = hitY[i];
    const g = ground(x, z);
    if (Number.isFinite(g) && !(Math.abs(g - want) >= Math.abs(best - want))) best = g;
    return best;
  };
  const clearHalfway = (x, z, floor, s, t) => {
    if (flags[s] & flags[t] & 2) return true;
    stats.tests++;
    if (meets(x, floor, z, capsule)) return false;
    return !groundCrosses(x, z, floor);
  };
  let walks = 0;
  let hops = 0;
  for (let row = 0; row < rows; row++) {
    for (let c = 0; c < cols; c++) {
      const j = row * cols + c;
      for (let s = first[j]; s < first[j + 1]; s++) {
        const ys = Y[s];
        for (let d = 0; d < 8; d++) {
          const cc = c + DIRS[d][0];
          const rr = row + DIRS[d][1];
          if (cc < 0 || cc >= cols || rr < 0 || rr >= rows) continue;
          const t = nearestIn(rr * cols + cc, ys);
          if (t < 0) continue;
          // (a link both ways is the nearest span's from either end: tried
          // once, from the end that comes first; one that is not can only be
          // a hop, from this end)
          const both = nearestIn(j, Y[t]) === s;
          if (both && d >= 4) continue;
          const yt = Y[t];
          const dy = yt - ys;
          const run = (d & 1 ? Math.SQRT2 : 1) * cell;
          const climb = Math.max(step, run * tanS) + 0.02;
          const mx = origin[0] + (c + 0.5 + DIRS[d][0] / 2) * cell;
          const mz = origin[1] + (row + 0.5 + DIRS[d][1] / 2) * cell;
          if (both && Math.abs(dy) <= climb) {
            let mid = (ys + yt) / 2;
            let ok = true;
            if (Math.abs(dy) > step) {
              // (a slope, or a ledge the neighbours straddle: the floor halfway says)
              const h = floorHalfway(mx, mz, ys, yt, flags[s] & flags[t] & 1);
              ok = Number.isFinite(h) && Math.abs(h - mid) <= Math.abs(dy) / 4 + 0.05;
              if (ok) mid = h;
            }
            if (ok && clearHalfway(mx, mz, mid, s, t)) {
              walk[s] |= 1 << d;
              walk[t] |= 1 << opposite(d);
              walks++;
              continue;
            }
          }
          if (Math.abs(dy) <= step) continue;
          // a hop: up to the jump's height, down to the drop's, with room
          // overhead in the lower column for the whole of it
          const low = dy > 0 ? s : t;
          const rise = Math.abs(dy);
          if (rise > Math.max(nav.jumpUp, nav.dropDown) || clear[low] < rise + height) continue;
          if (!clearHalfway(mx, mz, Math.max(ys, yt), s, t)) continue;
          // (from the lower end a jump, from the upper a drop)
          const fits = (from) => rise <= (from === low ? nav.jumpUp : nav.dropDown);
          if (fits(s)) {
            hop[s] |= 1 << d;
            hops++;
          }
          if (both && fits(t)) {
            hop[t] |= 1 << opposite(d);
            hops++;
          }
        }
      }
    }
    onRow?.(row, rows, 'links');
  }
  return {
    cell,
    cols,
    rows,
    origin,
    count,
    y: Y,
    clear,
    flags,
    walk,
    hop,
    first,
    capsule: { radius: r, step, height },
    slope: nav.slope,
    jumpUp: nav.jumpUp,
    dropDown: nav.dropDown,
    stats: { ...stats, spans, walks, hops },
  };
}

// ── what must be reached ──

const centre = (points) => {
  const n = points.length;
  return points.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n], [0, 0]);
};

function inside(points, x, z) {
  let yes = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, zi] = points[i];
    const [xj, zj] = points[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) yes = !yes;
  }
  return yes;
}

// every spawn point, and every volume a side captures, defends or holds
// (kind `capture` or `defend`) or a stage names as an objective
export function targetsOf(rows, stages = []) {
  const named = new Set();
  for (const file of stages) for (const st of file.stages ?? []) for (const o of st.objectives ?? []) if (o.volume) named.add(o.volume);
  const out = [];
  for (const s of rows.spawns ?? []) if (s.at?.every(Number.isFinite)) out.push({ id: s.id, kind: 'spawn', mode: s.mode, team: s.team, at: s.at });
  for (const v of rows.volumes ?? []) {
    if (!v.points?.length || !(v.kind === 'capture' || v.kind === 'defend' || named.has(v.id))) continue;
    const [x, z] = centre(v.points);
    out.push({ id: v.id, kind: v.kind === 'shape' ? 'objective' : v.kind, mode: v.mode, at: [x, v.y ?? 0, z], points: v.points, y: v.y ?? null, height: v.height ?? null });
  }
  return out;
}

// the spans that stand for a target: a spawn's nearest floor within 2 m
// (from 3 m under the point to 1 m over it); a volume's every floor inside
// its outline and its height (the soldier, standing, overlapping it)
function spansOf(L, target, height) {
  if (target.kind === 'spawn') {
    const s = spanNear(L, target.at, { reach: 2, below: 3, above: 1 });
    return s < 0 ? [] : [s];
  }
  const xs = target.points.map((p) => p[0]);
  const zs = target.points.map((p) => p[1]);
  const c0 = Math.max(0, Math.floor((Math.min(...xs) - L.origin[0]) / L.cell));
  const c1 = Math.min(L.cols - 1, Math.floor((Math.max(...xs) - L.origin[0]) / L.cell));
  const r0 = Math.max(0, Math.floor((Math.min(...zs) - L.origin[1]) / L.cell));
  const r1 = Math.min(L.rows - 1, Math.floor((Math.max(...zs) - L.origin[1]) / L.cell));
  const lo = target.y === null ? -Infinity : target.y - height - 1;
  const hi = target.y === null ? Infinity : target.y + Math.max(target.height ?? 0, 2) + 1;
  const out = [];
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) {
      if (!inside(target.points, L.origin[0] + (c + 0.5) * L.cell, L.origin[1] + (r + 0.5) * L.cell)) continue;
      const k = r * L.cols + c;
      for (let s = L.first[k]; s < L.first[k + 1]; s++) if (L.y[s] >= lo && L.y[s] <= hi) out.push(s);
    }
  // (a volume smaller than a cell: the floor nearest its middle)
  if (!out.length) {
    const s = spanNear(L, target.at, { reach: 2, below: 3, above: Math.max(target.height ?? 0, 2) });
    if (s >= 0) out.push(s);
  }
  return out;
}

// The connectivity check: the largest component (walks and two-way hops)
// must hold every objective, and every spawn must stand in it or drop into
// it (a spawn up on a ledge leaves by a hop one way).
export function reachTable(L, targets) {
  const comp = components(L);
  const inMain = (s) => comp.id[s] === comp.main;
  const reached = [];
  const missed = [];
  for (const t of targets) {
    const spans = spansOf(L, t, L.capsule.height);
    let how = null;
    if (!spans.length) how = null;
    else if (spans.some(inMain)) how = 'main';
    else if (t.kind === 'spawn') {
      const seen = reachFrom(L, spans);
      for (let s = 0; s < seen.length && !how; s++) if (seen[s] && inMain(s)) how = 'drops in';
    }
    (how ? reached : missed).push({ ...t, how, why: how ? null : spans.length ? `in a component of ${Math.max(...spans.map((s) => comp.sizes[comp.id[s]]))} spans` : 'no floor there' });
  }
  return { main: comp.main, mainSpans: comp.main >= 0 ? comp.sizes[comp.main] : 0, components: comp.sizes.length, spans: L.y.length, reached, missed };
}
