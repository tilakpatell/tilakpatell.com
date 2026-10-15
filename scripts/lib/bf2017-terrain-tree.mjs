// The game's TerrainStreamingTree resource: its layer masks and its colour
// tree, read from the bytes (bf2-re/findings/58; the heightfield half is the
// export tool's TerrainExport.cs). Pure: a Buffer in, plain data out.
//
// The bytes are what `bf2export terrainprobe --filter <terrain> --out <dir>`
// writes as probe/<name>.TerrainStreamingTree.bin; bf2-re's Frosty dump of
// the same resource has a 16-byte ResMeta in front, which treeOf strips.
//
// resource := header (0x1a bytes), section*, 0xff, the streaming table
// section  := u8 tag, u32 size, payload   (0 heights, 1 layer masks, 2 colour, 3 and 4 other rasters)
//
// The layer masks (tag 1), the format:
//   header (63 B): u32 tile 72, u32 border 4, u32 first level 2, u32 4096,
//     u32 2816, u32 1, f32 the world's minX minZ maxX maxZ, u32 133,
//     u32 records, u32 rasters, u32 4, u32 4096, 3 bytes
//   then blocks to the section's end, each:
//     record*  30 B: u8 tag, f32 minX minZ maxX maxZ, u8 a, u8 b, 11 B
//                    (an 85-bit occupancy of the node's next four levels);
//                    tag 0 and b 1 a quadtree node (a 1 for a leaf),
//                    tag 1…8 and b 0 a raster of that layer for that node
//     u8 1, u32 size, size bytes: one 72 × 72 u8 raster per raster record, in their order
//     a trailer (9 to 44 bytes; the next block starts at the next record)
//   A raster's rows run along z, its columns along x; its 64 inner texels
//   span its node, centred (texel i at min + (i − 4 + ½) · size / 64), 4
//   border texels a side; a parent's raster is the 2 × 2 mean of its
//   children's; a node with no raster for a layer takes its nearest
//   ancestor's (the shader's per-layer transform into the mask atlas). Each
//   of the three is counted on the bytes by agreement() below. Layer k is
//   the tile shader's mask k (layer 0 is what the masks above it leave).
//
// The colour tree (tag 2): header (52 B): u32 tile 260, u32 border 2, u32
//   2048, u32 1280, u32 0, f32 world bounds, u32 60, u32 4, u32 nodes, u32
//   rasters; then the root, depth first: u8 a, u8 b, u8 hasRaster, [260² B:
//   BC3, 65 × 65 blocks], u8 hasChildren, [four children x0z0 x1z0 x1z1 x0z1].
//
//   treeOf(buf) → the resource's bytes (a ResMeta in front stripped)
//   sectionsOf(buf) → Map(tag → { at, size })
//   maskRasters(buf) → { tile, rasters: [{ layer, minX, minZ, size, at }], records, blocks }
//   colourTree(buf) → { tile, nodes: [{ level, minX, minZ, size, at | null }] }
//   bc3Colours(buf, at, blocks) → { white, alphaMax, rgbMin } (the tile's colour endpoints and alpha)
//   bc3Decode(buf, at, side) → Uint8Array (RGBA, side × side)
//   sampleRaster(buf, raster, x, z) → the raster's bilinear value there
//   composeMasks(buf, rasters, layers, frame) → Uint8Array (RGBA, frame.w × frame.h, row = z)
//   framesOf(rasters, cell) → { minX, minZ, maxX, maxZ } of the rasters of one cell size
//   agreement(buf, rasters) → { borders, parents, ancestors } (the format's claims, counted)

export const MASK = { tile: 72, border: 4, cells: 64, record: 30 };
export const COLOUR = { tile: 260, border: 2, bytes: 260 * 260 };
const ORDER = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

// (the probe's file starts at the resource; a Frosty dump has 16 zero bytes of ResMeta first)
export function treeOf(buf) {
  const meta = buf.length > 16 && buf.subarray(0, 16).every((b) => b === 0);
  return meta ? buf.subarray(16) : buf;
}

export function sectionsOf(buf) {
  const out = new Map();
  let p = 0x1a;
  while (p < buf.length && buf[p] !== 0xff) {
    const size = buf.readUInt32LE(p + 1);
    if (p + 5 + size > buf.length) throw new Error(`section ${buf[p]} runs past the end`);
    out.set(buf[p], { at: p + 5, size });
    p += 5 + size;
  }
  return out;
}

// a record's bounds: square, a power of two in metres, on its own grid
function isBounds(buf, p, end = buf.length) {
  if (p + 17 > end) return false;
  const x0 = buf.readFloatLE(p + 1);
  const z0 = buf.readFloatLE(p + 5);
  const s = buf.readFloatLE(p + 9) - x0;
  if (!(s >= 16) || Math.abs(buf.readFloatLE(p + 13) - z0 - s) > 1e-3) return false;
  if (!Number.isInteger(x0) || !Number.isInteger(z0) || x0 < -65536 || z0 < -65536) return false;
  const si = Math.round(s);
  return (si & (si - 1)) === 0 && x0 % si === 0 && z0 % si === 0;
}

export function maskRasters(buf) {
  const sec = sectionsOf(buf).get(1);
  if (!sec) throw new Error('no layer-mask section');
  const { at: o, size: n } = sec;
  const tile = buf.readUInt32LE(o);
  if (tile !== MASK.tile || buf.readUInt32LE(o + 4) !== MASK.border) throw new Error(`unexpected mask header: tile ${tile}`);
  const want = { records: buf.readUInt32LE(o + 44), rasters: buf.readUInt32LE(o + 48) };
  const bytes = tile * tile;
  const rasters = [];
  let records = 0;
  let blocks = 0;
  // (a record starts with its tag byte: the first at 63)
  let p = o + 63;
  const end = o + n;
  while (p < end) {
    const mine = [];
    while (isBounds(buf, p, end)) {
      mine.push(p);
      p += MASK.record;
    }
    if (!mine.length) throw new Error(`no record at ${p - o} of ${n}`);
    if (buf[p] !== 1) throw new Error(`block ${blocks} does not end in its data flag`);
    const size = buf.readUInt32LE(p + 1);
    const data = p + 5;
    const ras = mine.filter((r) => buf[r + 18] === 0);
    if (size !== ras.length * bytes) throw new Error(`block ${blocks}: ${ras.length} rasters, ${size} bytes`);
    ras.forEach((r, k) => {
      const minX = buf.readFloatLE(r + 1);
      rasters.push({ layer: buf[r], minX, minZ: buf.readFloatLE(r + 5), size: buf.readFloatLE(r + 9) - minX, at: data + k * bytes });
    });
    records += mine.length;
    blocks++;
    p = data + size;
    // the trailer: up to the next record (or the section's end)
    while (p < end && !isBounds(buf, p, end)) p++;
  }
  if (records !== want.records || rasters.length !== want.rasters) throw new Error(`read ${records} records and ${rasters.length} rasters, the header says ${want.records} and ${want.rasters}`);
  return { tile, rasters, records, blocks };
}

export function colourTree(buf) {
  const sec = sectionsOf(buf).get(2);
  if (!sec) throw new Error('no colour section');
  const { at: o, size: n } = sec;
  const tile = buf.readUInt32LE(o);
  if (tile !== COLOUR.tile) throw new Error(`unexpected colour header: tile ${tile}`);
  const x0 = buf.readFloatLE(o + 20);
  const z0 = buf.readFloatLE(o + 24);
  const side = buf.readFloatLE(o + 28) - x0;
  const want = { nodes: buf.readUInt32LE(o + 44), rasters: buf.readUInt32LE(o + 48) };
  const nodes = [];
  let p = o + 52;
  const read = (level, minX, minZ, size) => {
    const has = buf[p + 2];
    p += 3;
    let at = null;
    if (has) {
      at = p;
      p += COLOUR.bytes;
    }
    const kids = buf[p++];
    nodes.push({ level, minX, minZ, size, at });
    if (kids) for (const [ix, iz] of ORDER) read(level + 1, minX + (ix * size) / 2, minZ + (iz * size) / 2, size / 2);
  };
  read(0, x0, z0, side);
  if (p !== o + n) throw new Error(`colour tree ends at ${p - o} of ${n}`);
  const rasters = nodes.filter((d) => d.at !== null).length;
  if (nodes.length !== want.nodes || rasters !== want.rasters) throw new Error(`read ${nodes.length} nodes and ${rasters} rasters, the header says ${want.nodes} and ${want.rasters}`);
  return { tile, nodes };
}

const c565 = (v) => [((v >> 11) & 31) * (255 / 31), ((v >> 5) & 63) * (255 / 63), (v & 31) * (255 / 31)];

// a BC3 tile's colour endpoints and alpha: white when every block's two
// RGB565 endpoints are 0xffff
export function bc3Colours(buf, at, blocks = (COLOUR.tile / 4) ** 2) {
  let white = true;
  let alphaMax = 0;
  let rgbMin = 255;
  for (let b = 0; b < blocks; b++) {
    const q = at + b * 16;
    alphaMax = Math.max(alphaMax, buf[q], buf[q + 1]);
    const e0 = buf.readUInt16LE(q + 8);
    const e1 = buf.readUInt16LE(q + 10);
    if (e0 !== 0xffff || e1 !== 0xffff) white = false;
    for (const e of [e0, e1]) rgbMin = Math.min(rgbMin, ...c565(e));
  }
  return { white, alphaMax, rgbMin: Math.round(rgbMin) };
}

// a BC3 tile decoded (the format's own rule: a 3-bit alpha ramp of 8, or of
// 6 with 0 and 255, and a 2-bit colour ramp of four)
export function bc3Decode(buf, at, side = COLOUR.tile) {
  const n = side / 4;
  const img = new Uint8Array(side * side * 4);
  for (let by = 0; by < n; by++) {
    for (let bx = 0; bx < n; bx++) {
      const q = at + (by * n + bx) * 16;
      const a0 = buf[q];
      const a1 = buf[q + 1];
      const alpha = [a0, a1];
      if (a0 > a1) for (let i = 1; i < 7; i++) alpha.push(((7 - i) * a0 + i * a1) / 7);
      else {
        for (let i = 1; i < 5; i++) alpha.push(((5 - i) * a0 + i * a1) / 5);
        alpha.push(0, 255);
      }
      const lo = buf[q + 2] | (buf[q + 3] << 8) | (buf[q + 4] << 16);
      const hi = buf[q + 5] | (buf[q + 6] << 8) | (buf[q + 7] << 16);
      const e0 = c565(buf.readUInt16LE(q + 8));
      const e1 = c565(buf.readUInt16LE(q + 10));
      const ramp = [e0, e1, e0.map((v, i) => (2 * v + e1[i]) / 3), e0.map((v, i) => (v + 2 * e1[i]) / 3)];
      const idx = buf.readUInt32LE(q + 12);
      for (let k = 0; k < 16; k++) {
        const o = ((by * 4 + (k >> 2)) * side + bx * 4 + (k & 3)) * 4;
        const c = ramp[(idx >>> (2 * k)) & 3];
        const a = k < 8 ? (lo >> (3 * k)) & 7 : (hi >> (3 * (k - 8))) & 7;
        img[o] = Math.round(c[0]);
        img[o + 1] = Math.round(c[1]);
        img[o + 2] = Math.round(c[2]);
        img[o + 3] = Math.round(alpha[a]);
      }
    }
  }
  return img;
}

// the bounds of the rasters of one cell size (metres a texel)
export function framesOf(rasters, cell) {
  const of = rasters.filter((r) => r.size / MASK.cells === cell);
  if (!of.length) return null;
  return {
    minX: Math.min(...of.map((r) => r.minX)),
    minZ: Math.min(...of.map((r) => r.minZ)),
    maxX: Math.max(...of.map((r) => r.minX + r.size)),
    maxZ: Math.max(...of.map((r) => r.minZ + r.size)),
  };
}

// a raster's value at world (x, z), bilinear on its centred texels
export function sampleRaster(buf, r, x, z) {
  const T = MASK.tile;
  const cell = r.size / MASK.cells;
  const tx = Math.min(T - 1.001, Math.max(0, (x - r.minX) / cell + MASK.border - 0.5));
  const tz = Math.min(T - 1.001, Math.max(0, (z - r.minZ) / cell + MASK.border - 0.5));
  const x0 = Math.floor(tx);
  const z0 = Math.floor(tz);
  const fx = tx - x0;
  const fz = tz - z0;
  const a = r.at + z0 * T + x0;
  return (buf[a] * (1 - fx) + buf[a + 1] * fx) * (1 - fz) + (buf[a + T] * (1 - fx) + buf[a + T + 1] * fx) * fz;
}

// Up to four layers into one RGBA image over frame { minX, minZ, mpp, w, h }
// (pixel centres at min + (i + ½) · mpp; row = z). Each layer is painted
// coarse to fine, a finer raster over its own node: a raster coarser than
// the frame sampled bilinearly (the atlas's filter), one finer box-averaged
// down to it. Layer 0 in `layers` (or a missing one) leaves its channel 0.
export function composeMasks(buf, rasters, layers, { minX, minZ, mpp, w, h }) {
  const T = MASK.tile;
  const B = MASK.border;
  const out = new Uint8Array(w * h * 4);
  layers.forEach((layer, ch) => {
    if (!layer) return;
    const mine = rasters.filter((r) => r.layer === layer).sort((a, b) => b.size - a.size);
    for (const r of mine) {
      const cell = r.size / MASK.cells;
      const ix0 = Math.max(0, Math.round((r.minX - minX) / mpp));
      const ix1 = Math.min(w, Math.round((r.minX + r.size - minX) / mpp));
      const iz0 = Math.max(0, Math.round((r.minZ - minZ) / mpp));
      const iz1 = Math.min(h, Math.round((r.minZ + r.size - minZ) / mpp));
      if (ix0 >= ix1 || iz0 >= iz1) continue;
      if (cell >= mpp) {
        for (let iz = iz0; iz < iz1; iz++) {
          const tz = (minZ + (iz + 0.5) * mpp - r.minZ) / cell + B - 0.5;
          const z0 = Math.floor(tz);
          const fz = tz - z0;
          for (let ix = ix0; ix < ix1; ix++) {
            const tx = (minX + (ix + 0.5) * mpp - r.minX) / cell + B - 0.5;
            const x0 = Math.floor(tx);
            const fx = tx - x0;
            const a = r.at + z0 * T + x0;
            const v = (buf[a] * (1 - fx) + buf[a + 1] * fx) * (1 - fz) + (buf[a + T] * (1 - fx) + buf[a + T + 1] * fx) * fz;
            out[(iz * w + ix) * 4 + ch] = Math.round(v);
          }
        }
      } else {
        const k = Math.round(mpp / cell);
        for (let iz = iz0; iz < iz1; iz++) {
          const tz = Math.round((minZ + iz * mpp - r.minZ) / cell) + B;
          for (let ix = ix0; ix < ix1; ix++) {
            const tx = Math.round((minX + ix * mpp - r.minX) / cell) + B;
            let s = 0;
            for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) s += buf[r.at + (tz + a) * T + tx + b];
            out[(iz * w + ix) * 4 + ch] = Math.round(s / (k * k));
          }
        }
      }
    }
  });
  return out;
}

// The format's three claims, counted on the bytes:
//   borders    a raster's border texels are its neighbour's inner ones
//              (rows = z, columns = x): [agree, of]
//   parents    a parent's inner texel against the mean of the 2 × 2 child
//              texels under it: { n, meanAbs, maxAbs }
//   ancestors  where a node has no raster for a layer and its neighbour
//              has, the neighbour's border texels into it against the
//              nearest ancestor's raster there, counted where that is
//              painted (> 10): { n, agree (within 3), zero (≤ 1) }
export function agreement(buf, rasters) {
  const T = MASK.tile;
  const B = MASK.border;
  const key = (layer, size, x, z) => `${layer}|${size}|${x}|${z}`;
  const at = new Map(rasters.map((r) => [key(r.layer, r.size, r.minX, r.minZ), r]));
  const px = (r, row, col) => buf[r.at + row * T + col];
  const borders = [0, 0];
  const parents = { n: 0, meanAbs: 0, maxAbs: 0 };
  const ancestors = { n: 0, agree: 0, zero: 0 };
  for (const r of rasters) {
    const east = at.get(key(r.layer, r.size, r.minX + r.size, r.minZ));
    const south = at.get(key(r.layer, r.size, r.minX, r.minZ + r.size));
    for (let i = 0; i < T; i++) {
      for (let k = 0; k < 2 * B; k++) {
        if (east) {
          borders[1]++;
          if (px(r, i, T - 2 * B + k) === px(east, i, k)) borders[0]++;
        }
        if (south) {
          borders[1]++;
          if (px(r, T - 2 * B + k, i) === px(south, k, i)) borders[0]++;
        }
      }
    }
    const h = r.size / 2;
    for (const [ix, iz] of ORDER) {
      const c = at.get(key(r.layer, h, r.minX + ix * h, r.minZ + iz * h));
      if (!c) continue;
      for (let j = 0; j < 32; j++) {
        for (let i = 0; i < 32; i++) {
          const p = px(r, B + iz * 32 + j, B + ix * 32 + i);
          const m = (px(c, B + 2 * j, B + 2 * i) + px(c, B + 2 * j, B + 1 + 2 * i) + px(c, B + 1 + 2 * j, B + 2 * i) + px(c, B + 1 + 2 * j, B + 1 + 2 * i)) / 4;
          const d = Math.abs(p - m);
          parents.n++;
          parents.meanAbs += d;
          parents.maxAbs = Math.max(parents.maxAbs, d);
        }
      }
    }
    const cell = r.size / MASK.cells;
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = r.minX + dx * r.size;
      const nz = r.minZ + dz * r.size;
      if (at.has(key(r.layer, r.size, nx, nz))) continue;
      let anc = null;
      for (let s = r.size * 2; s <= 4096 && !anc; s *= 2) anc = at.get(key(r.layer, s, Math.floor(nx / s) * s, Math.floor(nz / s) * s)) ?? null;
      if (!anc) continue;
      for (let k = 0; k < B; k++) {
        for (let i = B; i < T - B; i++) {
          const col = dx === 1 ? T - B + k : dx === -1 ? k : i;
          const row = dz === 1 ? T - B + k : dz === -1 ? k : i;
          const v = px(r, row, col);
          const a = sampleRaster(buf, anc, r.minX + (col - B + 0.5) * cell, r.minZ + (row - B + 0.5) * cell);
          if (a <= 10) continue;
          ancestors.n++;
          if (Math.abs(v - a) <= 3) ancestors.agree++;
          if (v <= 1) ancestors.zero++;
        }
      }
    }
  }
  if (parents.n) parents.meanAbs /= parents.n;
  return { borders, parents, ancestors };
}
