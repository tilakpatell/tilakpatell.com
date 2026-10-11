// The navgrid's blocked mask (the design's nav.bin, decision 15): built
// offline by asking the physics engine whether a soldier's capsule fits at
// each cell (scripts/bf2017-nav.mjs), since the game's own navmesh is opaque
// and the shapes' boxes close Hoth's trenches (the research's table:
// docs/superpowers/evidence/battlefront-lane5b/research-collision.md §3).
//
// Two grids over the map's bounds: the coarse one, the navgrid's own cells,
// where a cell is blocked when the capsule meets a shape at its middle (and
// keeps the shape's top above the ground, in decimetres, for the line of
// sight and the cover); and a fine one, sampled only round what blocks (a
// coarse cell whose middle a capsule grown to the cell's corners meets), for
// `walkable`'s exact test. Pure: the deflate is the caller's (node:zlib in
// the script; DecompressionStream on the page, as png16.js reads a PNG).
//
//   buildMask({ bounds, cell, fine, heightAt, blockedAt(x, y, z, r), topAt(x, z, ground), capsule, meta })
//     → { version, cell, cols, rows, origin, capsule, meta, blocked, top, fine: { cell, cols, rows, bits } }
//   encodeMask(mask) → Uint8Array ; decodeMask(bytes) → mask ; inflateMask(deflated) → Promise<mask>
//   fineBlocked(mask, x, z) → bool ; maskFits(mask, { cell, cols, rows, origin }) → bool

export const MASK_VERSION = 1;
const MAGIC = 'BFNV';
const HEAD = 68;
const TOP_MAX = 255; // dm: a byte's worth (25.5 m) of top above the ground

export function buildMask({ bounds, cell = 2, fine = 0.5, heightAt, blockedAt, topAt = () => 0, capsule = {}, meta = {} }) {
  const origin = [bounds.min[0], bounds.min[1]];
  const cols = Math.ceil((bounds.max[0] - bounds.min[0]) / cell);
  const rows = Math.ceil((bounds.max[1] - bounds.min[1]) / cell);
  const k = Math.round(cell / fine);
  const f = { cell: cell / k, cols: cols * k, rows: rows * k, bits: null };
  f.bits = new Uint8Array(Math.ceil((f.cols * f.rows) / 8));
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
          const j = (r * k + fr) * f.cols + c * k + fc;
          f.bits[j >> 3] |= 1 << (j & 7);
        }
    }
  return { version: MASK_VERSION, cell, cols, rows, origin, capsule: { ...capsule }, meta, blocked, top, fine: f };
}

export function fineBlocked(mask, x, z) {
  const f = mask?.fine;
  if (!f) return false;
  const c = Math.floor((x - mask.origin[0]) / f.cell);
  const r = Math.floor((z - mask.origin[1]) / f.cell);
  if (c < 0 || r < 0 || c >= f.cols || r >= f.rows) return false;
  const j = r * f.cols + c;
  return (f.bits[j >> 3] & (1 << (j & 7))) !== 0;
}

export const maskFits = (mask, { cell, cols, rows, origin }) =>
  Boolean(mask && mask.cell === cell && mask.cols === cols && mask.rows === rows && Math.abs(mask.origin[0] - origin[0]) < 1e-6 && Math.abs(mask.origin[1] - origin[1]) < 1e-6);

export function encodeMask(mask) {
  const meta = new TextEncoder().encode(JSON.stringify(mask.meta ?? {}));
  const n = mask.cols * mask.rows;
  const out = new Uint8Array(HEAD + meta.length + n + mask.fine.bits.length);
  const v = new DataView(out.buffer);
  for (let i = 0; i < 4; i++) out[i] = MAGIC.charCodeAt(i);
  out[4] = MASK_VERSION;
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
  out.set(meta, HEAD);
  out.set(mask.top, HEAD + meta.length);
  out.set(mask.fine.bits, HEAD + meta.length + n);
  return out;
}

export function decodeMask(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length < HEAD || String.fromCharCode(b[0], b[1], b[2], b[3]) !== MAGIC) throw new Error('not a nav mask');
  if (b[4] !== MASK_VERSION) throw new Error(`nav mask version ${b[4]}, not ${MASK_VERSION}`);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const cell = v.getFloat32(8, true);
  const fcell = v.getFloat32(12, true);
  const cols = v.getUint32(16, true);
  const rows = v.getUint32(20, true);
  const k = Math.round(cell / fcell);
  const metaLen = v.getUint32(64, true);
  const meta = JSON.parse(new TextDecoder().decode(b.subarray(HEAD, HEAD + metaLen)));
  const n = cols * rows;
  const top = b.slice(HEAD + metaLen, HEAD + metaLen + n);
  const fine = { cell: fcell, cols: cols * k, rows: rows * k, bits: null };
  fine.bits = b.slice(HEAD + metaLen + n, HEAD + metaLen + n + Math.ceil((fine.cols * fine.rows) / 8));
  if (top.length !== n || fine.bits.length !== Math.ceil((fine.cols * fine.rows) / 8)) throw new Error('nav mask cut short');
  return {
    version: b[4],
    cell,
    cols,
    rows,
    origin: [v.getFloat64(24, true), v.getFloat64(32, true)],
    capsule: { step: v.getFloat64(40, true), height: v.getFloat64(48, true), radius: v.getFloat64(56, true) },
    meta,
    blocked: top.map((t) => (t ? 1 : 0)),
    top,
    fine,
  };
}

export async function inflateMask(deflated) {
  const stream = new Blob([deflated]).stream().pipeThrough(new DecompressionStream('deflate'));
  return decodeMask(new Uint8Array(await new Response(stream).arrayBuffer()));
}
