// The navgrid's walk mask (the design's nav.bin, decision 15): built
// offline by walking the physics engine's shapes the way the game's capsule
// controller walks them (scripts/bf2017-nav.mjs), since the game's own
// navmesh is opaque and the shapes' boxes close Hoth's trenches (the
// research's table: docs/superpowers/evidence/battlefront-lane5b/
// research-collision.md §3).
//
// Two grids over the map's bounds. The fine one (0.5 m) is the walk: from
// the map's spawns outward, a soldier steps to a neighbouring cell when a
// surface there (a shape's top, or the ground) lies within the ground rays'
// reach of where it stands, rises no more than the climb (the game's step
// by height projection) and leaves the capsule free; the cell keeps the
// height it stands at over the ground (`stand`, decimetres, signed: a pile
// above, a trench floor below), and a cell no walk reaches is blocked. So a
// snow pile is walked up and over as the game's ground probe finds it, and a
// wall or a cliff blocks where the rise is more than a step. The coarse one
// (the navgrid's own cells) says whether the cell's middle is blocked, and
// keeps the shape's top above the ground there, in decimetres, for the line
// of sight and the cover. `buildMask` is the plain builder (blocked where a
// capsule meets a shape at the ground, no stand), for a mask of walls alone.
// Pure: the deflate is the caller's (node:zlib in the script;
// DecompressionStream on the page, as png16.js reads a PNG).
//
//   buildWalkMask({ bounds, cell, fine, heightAt, holeAt(x, z) (the ground cut away: no surface),
//     surfacesAt(x, z, top, bottom) → [y…] (descending), freeAt(x, y, z), topAt(x, z, ground),
//     bareAt(x, z) (no shape near the column: the ground alone, nothing asked of the engine),
//     seeds: [[x, y, z]], capsule, rays: { start, end }, climb, meta })
//     → { version, cell, cols, rows, origin, capsule, climb, meta, blocked, top,
//         fine: { cell, cols, rows, bits }, stand: { k, offsets, dm }, walk: { open, stood, layered } }
//   buildMask({ bounds, cell, fine, heightAt, blockedAt(x, y, z, r), topAt(x, z, ground), capsule, meta }) → the same, no stand
//   encodeMask(mask) → Uint8Array ; decodeMask(bytes) → mask (versions 1 and 2) ; inflateMask(deflated) → Promise<mask>
//   fineBlocked(mask, x, z) → bool ; fineStand(mask, x, z) → m over the ground (0 where none)
//   maskFits(mask, { cell, cols, rows, origin }) → bool
//
// The bytes (little-endian): 'BFNV', the version, a flags byte (1: walked,
// the mask has stands), the cells and the grid, the capsule, the meta's
// length (and in version 2 the climb), the meta, a top a coarse cell, a bit
// a fine cell, then in version 2 the stands: a count of blocks, and a block
// a coarse cell that has any, its index and k × k Int16 decimetres.

export const MASK_VERSION = 2;
const MAGIC = 'BFNV';
const HEAD = { 1: 68, 2: 76 };
const TOP_MAX = 255; // dm: a byte's worth (25.5 m) of top above the ground
const WALKED = 1; // the flags byte's bit: built by the walk, so the mask is the whole answer to where a soldier may stand
const STAND_MAX = 32767; // dm: an Int16's worth either way
const FLUSH = 0.15; // m: a stand nearer the ground than this is the ground (a hull's skirt, a decimetre's rounding)
// m: the game's step by height projection (CharacterStateCheckSupportControllerData.StepHeightValue
// and MovingStepHeightValue, 0.55; the study's finding 25): a rise more than this is a wall
export const CLIMB = 0.55;

function grid(bounds, cell, fine) {
  const origin = [bounds.min[0], bounds.min[1]];
  const cols = Math.ceil((bounds.max[0] - bounds.min[0]) / cell);
  const rows = Math.ceil((bounds.max[1] - bounds.min[1]) / cell);
  const k = Math.round(cell / fine);
  const f = { cell: cell / k, cols: cols * k, rows: rows * k, bits: new Uint8Array(Math.ceil((cols * k * rows * k) / 8)) };
  return { origin, cols, rows, k, f };
}

const setBit = (bits, j) => {
  bits[j >> 3] |= 1 << (j & 7);
};

export function buildMask({ bounds, cell = 2, fine = 0.5, heightAt, blockedAt, topAt = () => 0, capsule = {}, meta = {} }) {
  const { origin, cols, rows, k, f } = grid(bounds, cell, fine);
  const n = cols * rows;
  const blocked = new Uint8Array(n);
  const top = new Uint8Array(n);
  const radius = capsule.radius ?? 0.3;
  // (a capsule this wide at a cell's middle reaches its corners)
  const reach = cell * Math.SQRT1_2 + radius;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = origin[0] + (c + 0.5) * cell;
      const z = origin[1] + (r + 0.5) * cell;
      const g = heightAt(x, z);
      if (!blockedAt(x, g, z, reach)) continue;
      const i = r * cols + c;
      if (blockedAt(x, g, z, radius)) {
        blocked[i] = 1;
        top[i] = Math.min(TOP_MAX, Math.max(1, Math.round(topAt(x, z, g) * 10)));
      }
      for (let fr = 0; fr < k; fr++)
        for (let fc = 0; fc < k; fc++) {
          const fx = x - cell / 2 + (fc + 0.5) * f.cell;
          const fz = z - cell / 2 + (fr + 0.5) * f.cell;
          if (!blockedAt(fx, heightAt(fx, fz), fz, radius)) continue;
          setBit(f.bits, (r * k + fr) * f.cols + c * k + fc);
        }
    }
  return { version: MASK_VERSION, cell, cols, rows, origin, capsule: { ...capsule }, climb: CLIMB, meta, blocked, top, fine: f, stand: null };
}

// The walk: a flood over the fine cells from the seeds. A cell's stand is a
// surface the rays reach from a neighbour's stand that rises no more than
// the climb and leaves the capsule free; a drop is any depth the rays reach.
// Of two such surfaces less than a body apart the higher is kept (a pile is
// climbed from its foot, a kerb stepped onto); of two a body or more apart
// the lower (the way under a ledge, a roof or a wreck's belly stays open and
// the top goes unwalked: one stand a cell is all a mask keeps, and `layered`
// counts the cells that had both). A stand within 0.15 m of the ground is
// the ground, and where the ground is whole (no hole cut in it) a surface
// under it is in the earth, no floor at all. Where `bareAt` says no shape is
// near, the ground is the only surface and nothing is asked of the engine
// (most of a map).
export function buildWalkMask({ bounds, cell = 2, fine = 0.5, heightAt, holeAt = () => false, surfacesAt, freeAt, topAt = () => 0, bareAt = () => false, seeds = [], capsule = {}, rays = { start: 1.2, end: -1 }, climb = CLIMB, meta = {} }) {
  const { origin, cols, rows, k, f } = grid(bounds, cell, fine);
  const n = cols * rows;
  const fn = f.cols * f.rows;
  const stand = new Float32Array(fn).fill(NaN);
  // (a cell's ground, asked once: NaN not yet, −∞ a hole)
  const ground = new Float32Array(fn).fill(NaN);
  const bare = new Int8Array(fn).fill(-1);
  const cx = (j) => origin[0] + ((j % f.cols) + 0.5) * f.cell;
  const cz = (j) => origin[1] + (Math.floor(j / f.cols) + 0.5) * f.cell;
  const groundOf = (j) => {
    if (Number.isNaN(ground[j])) {
      const x = cx(j);
      const z = cz(j);
      const g = holeAt(x, z) ? -Infinity : heightAt(x, z);
      ground[j] = Number.isNaN(g) ? -Infinity : g;
    }
    return ground[j];
  };
  const bareOf = (j) => {
    if (bare[j] < 0) bare[j] = bareAt(cx(j), cz(j)) ? 1 : 0;
    return bare[j] === 1;
  };
  // the surface a soldier standing at `from` finds at cell j: the highest it can step to
  const standAt = (j, from) => {
    const g = groundOf(j);
    const reach = g <= from + rays.start && g >= from + rays.end;
    if (bareOf(j)) return reach && g - from <= climb + 1e-6 ? g : NaN;
    const x = cx(j);
    const z = cz(j);
    // (where the ground is whole, what lies under it is in the earth: a hull's buried half is no floor)
    const found = surfacesAt(x, z, from + rays.start, from + rays.end);
    const list = Number.isFinite(g) ? found.filter((h) => h > g - FLUSH) : found;
    const all = reach ? [...list, g].sort((a, b) => b - a) : list;
    // (a surface a hand's breadth off the ground is the ground: a hull's skirt, not a step)
    for (const h of all) if (h - from <= climb + 1e-6 && freeAt(x, h, z)) return reach && Math.abs(h - g) < FLUSH ? g : h;
    return NaN;
  };
  // whether cell j takes the stand h over the one it has
  const height = capsule.height ?? 1.7;
  const layers = new Uint8Array(fn);
  const takes = (j, h) => {
    if (!Number.isFinite(h)) return false;
    const had = stand[j];
    if (!Number.isFinite(had)) return true;
    if (Math.abs(h - had) >= height) {
      layers[j] = 1;
      return h < had;
    }
    return h > had + 1e-3;
  };
  // (a ring: a cell waits in it once at a time)
  const queue = new Int32Array(fn + 1);
  const waiting = new Uint8Array(fn);
  let head = 0;
  let tail = 0;
  const push = (j) => {
    if (waiting[j]) return;
    waiting[j] = 1;
    queue[tail] = j;
    tail = tail === fn ? 0 : tail + 1;
  };
  for (const [sx, sy, sz] of seeds) {
    const c = Math.floor((sx - origin[0]) / f.cell);
    const r = Math.floor((sz - origin[1]) / f.cell);
    if (c < 0 || r < 0 || c >= f.cols || r >= f.rows) continue;
    const j = r * f.cols + c;
    const h = standAt(j, sy);
    if (!takes(j, h)) continue;
    stand[j] = h;
    push(j);
  }
  while (head !== tail) {
    const j = queue[head];
    head = head === fn ? 0 : head + 1;
    waiting[j] = 0;
    const from = stand[j];
    const c = j % f.cols;
    const r = (j - c) / f.cols;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const cc = c + dc;
        const rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= f.cols || rr >= f.rows) continue;
        const jj = rr * f.cols + cc;
        const h = standAt(jj, from);
        if (!takes(jj, h)) continue;
        stand[jj] = h;
        push(jj);
      }
  }
  const blocked = new Uint8Array(n);
  const top = new Uint8Array(n);
  const offsets = new Int32Array(n).fill(-1);
  const blocks = [];
  let open = 0;
  let stood = 0;
  let layered = 0;
  for (let j = 0; j < fn; j++) layered += layers[j];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const x = origin[0] + (c + 0.5) * cell;
      const z = origin[1] + (r + 0.5) * cell;
      const mid = (r * k + (k >> 1)) * f.cols + c * k + (k >> 1);
      if (!Number.isFinite(stand[mid])) {
        blocked[i] = 1;
        top[i] = Math.min(TOP_MAX, Math.max(1, Math.round(topAt(x, z, heightAt(x, z)) * 10)));
      }
      const block = new Int16Array(k * k);
      let any = false;
      for (let fr = 0; fr < k; fr++)
        for (let fc = 0; fc < k; fc++) {
          const j = (r * k + fr) * f.cols + c * k + fc;
          if (!Number.isFinite(stand[j])) {
            setBit(f.bits, j);
            continue;
          }
          open++;
          // (over the ground the page stands on: the height function's own answer, a hole's too)
          const dm = Math.round((stand[j] - heightAt(cx(j), cz(j))) * 10);
          if (Math.abs(dm) < FLUSH * 10) continue;
          block[fr * k + fc] = Math.max(-STAND_MAX, Math.min(STAND_MAX, dm));
          stood++;
          any = true;
        }
      if (!any) continue;
      offsets[i] = blocks.length * k * k;
      blocks.push(block);
    }
  const dm = new Int16Array(blocks.length * k * k);
  blocks.forEach((b, i) => dm.set(b, i * k * k));
  return { version: MASK_VERSION, cell, cols, rows, origin, capsule: { ...capsule }, climb, meta, blocked, top, fine: f, stand: { k, offsets, dm }, walk: { open, stood, layered } };
}

const fineIndex = (mask, x, z) => {
  const f = mask?.fine;
  if (!f) return -1;
  const c = Math.floor((x - mask.origin[0]) / f.cell);
  const r = Math.floor((z - mask.origin[1]) / f.cell);
  if (c < 0 || r < 0 || c >= f.cols || r >= f.rows) return -1;
  return r * f.cols + c;
};

export function fineBlocked(mask, x, z) {
  const j = fineIndex(mask, x, z);
  if (j < 0) return false;
  return (mask.fine.bits[j >> 3] & (1 << (j & 7))) !== 0;
}

// how far over the ground a soldier stands at (x, z): a pile's top, a trench's floor (negative), 0 on open ground
export function fineStand(mask, x, z) {
  const s = mask?.stand;
  if (!s) return 0;
  const c = Math.floor((x - mask.origin[0]) / mask.cell);
  const r = Math.floor((z - mask.origin[1]) / mask.cell);
  if (c < 0 || r < 0 || c >= mask.cols || r >= mask.rows) return 0;
  const o = s.offsets[r * mask.cols + c];
  if (o < 0) return 0;
  const k = s.k;
  const fc = Math.min(k - 1, Math.max(0, Math.floor(((x - mask.origin[0] - c * mask.cell) / mask.cell) * k)));
  const fr = Math.min(k - 1, Math.max(0, Math.floor(((z - mask.origin[1] - r * mask.cell) / mask.cell) * k)));
  return s.dm[o + fr * k + fc] / 10;
}

export const maskFits = (mask, { cell, cols, rows, origin }) =>
  Boolean(mask && mask.cell === cell && mask.cols === cols && mask.rows === rows && Math.abs(mask.origin[0] - origin[0]) < 1e-6 && Math.abs(mask.origin[1] - origin[1]) < 1e-6);

export function encodeMask(mask) {
  const meta = new TextEncoder().encode(JSON.stringify(mask.meta ?? {}));
  const n = mask.cols * mask.rows;
  const k = mask.stand?.k ?? Math.round(mask.cell / mask.fine.cell);
  const blocks = mask.stand ? mask.stand.dm.length / (k * k) : 0;
  const head = HEAD[MASK_VERSION];
  const out = new Uint8Array(head + meta.length + n + mask.fine.bits.length + 4 + blocks * (4 + 2 * k * k));
  const v = new DataView(out.buffer);
  for (let i = 0; i < 4; i++) out[i] = MAGIC.charCodeAt(i);
  out[4] = MASK_VERSION;
  out[5] = mask.stand ? WALKED : 0;
  v.setFloat32(8, mask.cell, true);
  v.setFloat32(12, mask.fine.cell, true);
  v.setUint32(16, mask.cols, true);
  v.setUint32(20, mask.rows, true);
  v.setFloat64(24, mask.origin[0], true);
  v.setFloat64(32, mask.origin[1], true);
  v.setFloat64(40, mask.capsule.step ?? 0, true);
  v.setFloat64(48, mask.capsule.height ?? 0, true);
  v.setFloat64(56, mask.capsule.radius ?? 0, true);
  v.setUint32(64, meta.length, true);
  v.setFloat64(68, mask.climb ?? CLIMB, true);
  out.set(meta, head);
  out.set(mask.top, head + meta.length);
  out.set(mask.fine.bits, head + meta.length + n);
  let o = head + meta.length + n + mask.fine.bits.length;
  v.setUint32(o, blocks, true);
  o += 4;
  if (mask.stand)
    for (let i = 0; i < n; i++) {
      const off = mask.stand.offsets[i];
      if (off < 0) continue;
      v.setUint32(o, i, true);
      o += 4;
      for (let q = 0; q < k * k; q++, o += 2) v.setInt16(o, mask.stand.dm[off + q], true);
    }
  return out;
}

export function decodeMask(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length < HEAD[1] || String.fromCharCode(b[0], b[1], b[2], b[3]) !== MAGIC) throw new Error('not a nav mask');
  const version = b[4];
  if (!HEAD[version]) throw new Error(`nav mask version ${version}, not ${MASK_VERSION}`);
  const head = HEAD[version];
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const cell = v.getFloat32(8, true);
  const fcell = v.getFloat32(12, true);
  const cols = v.getUint32(16, true);
  const rows = v.getUint32(20, true);
  const k = Math.round(cell / fcell);
  const metaLen = v.getUint32(64, true);
  const climb = version >= 2 ? v.getFloat64(68, true) : CLIMB;
  const meta = JSON.parse(new TextDecoder().decode(b.subarray(head, head + metaLen)));
  const n = cols * rows;
  const top = b.slice(head + metaLen, head + metaLen + n);
  const fine = { cell: fcell, cols: cols * k, rows: rows * k, bits: null };
  const bitsLen = Math.ceil((fine.cols * fine.rows) / 8);
  fine.bits = b.slice(head + metaLen + n, head + metaLen + n + bitsLen);
  if (top.length !== n || fine.bits.length !== bitsLen) throw new Error('nav mask cut short');
  let stand = null;
  if (version >= 2) {
    let o = head + metaLen + n + bitsLen;
    const blocks = v.getUint32(o, true);
    o += 4;
    if (o + blocks * (4 + 2 * k * k) > b.length) throw new Error('nav mask cut short');
    // (a walked mask has stands, though every one may be flush with the ground)
    if (b[5] & WALKED) {
      stand = { k, offsets: new Int32Array(n).fill(-1), dm: new Int16Array(blocks * k * k) };
      for (let i = 0; i < blocks; i++) {
        stand.offsets[v.getUint32(o, true)] = i * k * k;
        o += 4;
        for (let q = 0; q < k * k; q++, o += 2) stand.dm[i * k * k + q] = v.getInt16(o, true);
      }
    }
  }
  return {
    version,
    cell,
    cols,
    rows,
    origin: [v.getFloat64(24, true), v.getFloat64(32, true)],
    capsule: { step: v.getFloat64(40, true), height: v.getFloat64(48, true), radius: v.getFloat64(56, true) },
    climb,
    meta,
    blocked: top.map((t) => (t ? 1 : 0)),
    top,
    fine,
    stand,
  };
}

export async function inflateMask(deflated) {
  const stream = new Blob([deflated]).stream().pipeThrough(new DecompressionStream('deflate'));
  return decodeMask(new Uint8Array(await new Response(stream).arrayBuffer()));
}
