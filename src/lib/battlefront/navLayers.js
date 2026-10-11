// The layered navgrid (nav.bin's second part, version 2): every floor a
// soldier can stand on, stacked, over a grid of `cell` metres, built offline
// from the game's own shapes and ground (scripts/bf2017-nav.mjs, with
// scripts/lib/bf2017-navmesh.mjs), since the game's navmesh is undecoded.
// A column (one cell) holds its floors (spans) from the lowest up; each span
// keeps its height and two bytes of links to its eight neighbours: `walk`
// (a step of at most the soldier's StepHeight, or a slope of at most his
// MaxAscendAngle, with room for his capsule on the way) and `hop` (an
// off-mesh link: a jump up to his JumpHeight or a drop). A link in
// direction d leads to the neighbour column's span nearest in height: the
// build tests that one only, so the page finds the same span by the same
// rule. Pure: typed arrays, no three.js; the deflate is the caller's.
//
//   encodeLayers(layers) → Uint8Array ; decodeLayers(bytes) → layers
//   columnAt(L, x, z) → column | -1 ; spanXYZ(L, s) → [x, y, z]
//   spanNear(L, [x, y, z], { reach, below, above }) → span | -1
//   linkTo(L, s, d) → span | -1 (the neighbour in direction d by the nearest-height rule)
//   components(L) → { id: Int32Array, sizes: number[], main } (walk links and two-way hops)
//   reachFrom(L, spans, { hops }) → Uint8Array (directed: walks, jumps and drops)
//   findPath3(L, from, to, { max }) → [[x, y, z], …] | null (A* over the spans)

export const LAYERS_VERSION = 1;
const MAGIC = 'BFNL';
export const LAYERS_HEAD = 80;

// directions: east, south-east, south, … (+x is east, +z south), a bit each
export const DIRS = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];
export const opposite = (d) => (d + 4) & 7;

// a span's height to 16 bits over the map's range (2 cm, or coarser on a map
// taller than 1.3 km)
export function quantum(yMin, yMax) {
  return Math.max(0.02, (yMax - yMin) / 65000);
}

export function encodeLayers(L) {
  const n = L.cols * L.rows;
  const spans = L.y.length;
  const out = new Uint8Array(LAYERS_HEAD + n + spans * 4);
  const v = new DataView(out.buffer);
  for (let i = 0; i < 4; i++) out[i] = MAGIC.charCodeAt(i);
  out[4] = LAYERS_VERSION;
  v.setFloat32(8, L.cell, true);
  v.setUint32(12, L.cols, true);
  v.setUint32(16, L.rows, true);
  v.setFloat64(20, L.origin[0], true);
  v.setFloat64(28, L.origin[1], true);
  let yMin = Infinity;
  let yMax = -Infinity;
  for (let i = 0; i < spans; i++) {
    yMin = Math.min(yMin, L.y[i]);
    yMax = Math.max(yMax, L.y[i]);
  }
  if (!spans) yMin = yMax = 0;
  const unit = quantum(yMin, yMax);
  v.setFloat64(36, yMin, true);
  v.setFloat32(44, unit, true);
  v.setUint32(48, spans, true);
  const c = L.capsule ?? {};
  v.setFloat32(52, c.radius ?? 0, true);
  v.setFloat32(56, c.step ?? 0, true);
  v.setFloat32(60, c.height ?? 0, true);
  v.setFloat32(64, L.slope ?? 0, true);
  v.setFloat32(68, L.jumpUp ?? 0, true);
  v.setFloat32(72, L.dropDown ?? 0, true);
  out.set(L.count, LAYERS_HEAD);
  // (each height as the step from the span before it: the ground's slow
  // changes are small numbers, which the deflate packs tight)
  let at = LAYERS_HEAD + n;
  let prev = 0;
  for (let i = 0; i < spans; i++) {
    const q = Math.round((L.y[i] - yMin) / unit);
    v.setUint16(at, (q - prev) & 0xffff, true);
    prev = q;
    at += 2;
  }
  out.set(L.walk, at);
  out.set(L.hop, at + spans);
  return out;
}

export function decodeLayers(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length < LAYERS_HEAD || String.fromCharCode(b[0], b[1], b[2], b[3]) !== MAGIC) throw new Error('not a layered navgrid');
  if (b[4] !== LAYERS_VERSION) throw new Error(`layered navgrid version ${b[4]}, not ${LAYERS_VERSION}`);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const cols = v.getUint32(12, true);
  const rows = v.getUint32(16, true);
  const spans = v.getUint32(48, true);
  const n = cols * rows;
  if (b.length < LAYERS_HEAD + n + spans * 4) throw new Error('layered navgrid cut short');
  const yBase = v.getFloat64(36, true);
  const unit = v.getFloat32(44, true);
  const count = b.slice(LAYERS_HEAD, LAYERS_HEAD + n);
  const first = new Uint32Array(n + 1);
  const col = new Int32Array(spans);
  for (let k = 0, s = 0; k < n; k++) {
    first[k] = s;
    for (let j = 0; j < count[k]; j++) col[s++] = k;
    first[k + 1] = s;
  }
  if (first[n] !== spans) throw new Error('layered navgrid: the columns do not add up to the spans');
  const y = new Float32Array(spans);
  let at = LAYERS_HEAD + n;
  let q = 0;
  for (let i = 0; i < spans; i++) {
    q = (q + v.getUint16(at, true)) & 0xffff;
    y[i] = yBase + q * unit;
    at += 2;
  }
  return {
    version: b[4],
    cell: v.getFloat32(8, true),
    cols,
    rows,
    origin: [v.getFloat64(20, true), v.getFloat64(28, true)],
    yUnit: unit,
    capsule: { radius: v.getFloat32(52, true), step: v.getFloat32(56, true), height: v.getFloat32(60, true) },
    slope: v.getFloat32(64, true),
    jumpUp: v.getFloat32(68, true),
    dropDown: v.getFloat32(72, true),
    count,
    first,
    col,
    y,
    walk: b.slice(at, at + spans),
    hop: b.slice(at + spans, at + 2 * spans),
    bytes: LAYERS_HEAD + n + spans * 4,
  };
}

// (a built set has no `first`/`col` yet: the build's own arrays, indexed once)
function indexed(L) {
  if (L.first) return L;
  const n = L.cols * L.rows;
  L.first = new Uint32Array(n + 1);
  L.col = new Int32Array(L.y.length);
  for (let k = 0, s = 0; k < n; k++) {
    L.first[k] = s;
    for (let j = 0; j < L.count[k]; j++) L.col[s++] = k;
    L.first[k + 1] = s;
  }
  return L;
}

export function columnAt(L, x, z) {
  const c = Math.floor((x - L.origin[0]) / L.cell);
  const r = Math.floor((z - L.origin[1]) / L.cell);
  if (c < 0 || r < 0 || c >= L.cols || r >= L.rows) return -1;
  return r * L.cols + c;
}

export function spanXYZ(L, s) {
  indexed(L);
  const k = L.col[s];
  const c = k % L.cols;
  return [L.origin[0] + (c + 0.5) * L.cell, L.y[s], L.origin[1] + ((k - c) / L.cols + 0.5) * L.cell];
}

// the span nearest a point: in its column first, then ring by ring out to
// `reach` metres, a floor from `below` under the point to `above` over it
export function spanNear(L, [x, y, z], { reach = 2, below = 2, above = 1 } = {}) {
  indexed(L);
  const c0 = Math.floor((x - L.origin[0]) / L.cell);
  const r0 = Math.floor((z - L.origin[1]) / L.cell);
  const rings = Math.ceil(reach / L.cell);
  let best = -1;
  let bestD = Infinity;
  for (let ring = 0; ring <= rings; ring++) {
    for (let dr = -ring; dr <= ring; dr++)
      for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
        const c = c0 + dc;
        const r = r0 + dr;
        if (c < 0 || r < 0 || c >= L.cols || r >= L.rows) continue;
        const k = r * L.cols + c;
        const h = Math.hypot(L.origin[0] + (c + 0.5) * L.cell - x, L.origin[1] + (r + 0.5) * L.cell - z);
        if (h > reach + L.cell * Math.SQRT1_2) continue;
        for (let s = L.first[k]; s < L.first[k + 1]; s++) {
          const dy = L.y[s] - y;
          if (dy < -below || dy > above) continue;
          const d = Math.hypot(h, dy);
          if (d < bestD) {
            bestD = d;
            best = s;
          }
        }
      }
    // (a ring further out is a cell further: past the best, nothing nearer)
    if (best >= 0 && bestD <= ring * L.cell) break;
  }
  return best;
}

// the neighbour column's span nearest in height (-1 off the grid or none)
export function linkTo(L, s, d) {
  indexed(L);
  const k = L.col[s];
  const c = (k % L.cols) + DIRS[d][0];
  const r = Math.floor(k / L.cols) + DIRS[d][1];
  if (c < 0 || r < 0 || c >= L.cols || r >= L.rows) return -1;
  const j = r * L.cols + c;
  let best = -1;
  let bestD = Infinity;
  for (let t = L.first[j]; t < L.first[j + 1]; t++) {
    const dy = Math.abs(L.y[t] - L.y[s]);
    if (dy < bestD) {
      bestD = dy;
      best = t;
    }
  }
  return best;
}

// the walk graph's components, a hop counted where it goes both ways
export function components(L) {
  indexed(L);
  const spans = L.y.length;
  const id = new Int32Array(spans).fill(-1);
  const sizes = [];
  const stack = new Int32Array(spans);
  for (let s0 = 0; s0 < spans; s0++) {
    if (id[s0] >= 0) continue;
    const k = sizes.length;
    let top = 0;
    let size = 0;
    id[s0] = k;
    stack[top++] = s0;
    while (top) {
      const s = stack[--top];
      size++;
      const w = L.walk[s];
      const h = L.hop[s];
      if (!(w | h)) continue;
      for (let d = 0; d < 8; d++) {
        const bit = 1 << d;
        if (!((w | h) & bit)) continue;
        const t = linkTo(L, s, d);
        if (t < 0 || id[t] >= 0) continue;
        if (!(w & bit) && !(L.hop[t] & (1 << opposite(d)) && linkTo(L, t, opposite(d)) === s)) continue;
        id[t] = k;
        stack[top++] = t;
      }
    }
    sizes.push(size);
  }
  let main = -1;
  for (let k = 0; k < sizes.length; k++) if (main < 0 || sizes[k] > sizes[main]) main = k;
  return { id, sizes, main };
}

// every span reachable from these, the hops one way as the soldier takes them
export function reachFrom(L, from, { hops = true } = {}) {
  indexed(L);
  const spans = L.y.length;
  const seen = new Uint8Array(spans);
  const stack = [];
  for (const s of from) {
    if (s < 0 || seen[s]) continue;
    seen[s] = 1;
    stack.push(s);
  }
  while (stack.length) {
    const s = stack.pop();
    const links = L.walk[s] | (hops ? L.hop[s] : 0);
    if (!links) continue;
    for (let d = 0; d < 8; d++) {
      if (!(links & (1 << d))) continue;
      const t = linkTo(L, s, d);
      if (t < 0 || seen[t]) continue;
      seen[t] = 1;
      stack.push(t);
    }
  }
  return seen;
}

// A* over the spans: the walks at their length, a hop at its length and
// the drop or climb again (the time a jump or a fall takes, roughly)
export function findPath3(L, from, to, { max = 200000, hops = true } = {}) {
  indexed(L);
  if (from < 0 || to < 0) return null;
  const spans = L.y.length;
  L.scratch ??= { g: new Float32Array(spans), from: new Int32Array(spans), seen: new Uint32Array(spans), shut: new Uint32Array(spans), gen: 0 };
  const S = L.scratch;
  S.gen++;
  const goal = spanXYZ(L, to);
  const h = (s) => {
    const p = spanXYZ(L, s);
    return Math.hypot(p[0] - goal[0], p[1] - goal[1], p[2] - goal[2]);
  };
  // (a heap of [f, span] entries: a span pushed again carries its new f)
  const open = [];
  const push = (s, fs) => {
    open.push([fs, s]);
    let k = open.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (open[p][0] <= open[k][0]) break;
      [open[p], open[k]] = [open[k], open[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = open[0][1];
    const last = open.pop();
    if (open.length) {
      open[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < open.length && open[l][0] < open[m][0]) m = l;
        if (r < open.length && open[r][0] < open[m][0]) m = r;
        if (m === k) break;
        [open[m], open[k]] = [open[k], open[m]];
        k = m;
      }
    }
    return top;
  };
  S.g[from] = 0;
  S.from[from] = -1;
  S.seen[from] = S.gen;
  push(from, h(from));
  let expanded = 0;
  while (open.length) {
    const s = pop();
    if (S.shut[s] === S.gen) continue;
    S.shut[s] = S.gen;
    if (s === to) {
      const out = [];
      for (let k = s; k >= 0; k = S.from[k]) out.push(spanXYZ(L, k));
      return out.reverse();
    }
    if (++expanded > max) return null;
    const links = L.walk[s] | (hops ? L.hop[s] : 0);
    for (let d = 0; d < 8; d++) {
      const bit = 1 << d;
      if (!(links & bit)) continue;
      const t = linkTo(L, s, d);
      if (t < 0 || S.shut[t] === S.gen) continue;
      const dy = Math.abs(L.y[t] - L.y[s]);
      const run = (d & 1 ? Math.SQRT2 : 1) * L.cell;
      const g = S.g[s] + Math.hypot(run, dy) + (L.walk[s] & bit ? 0 : dy);
      if (S.seen[t] === S.gen && g >= S.g[t]) continue;
      S.seen[t] = S.gen;
      S.g[t] = g;
      S.from[t] = s;
      push(t, g + h(t));
    }
  }
  return null;
}
