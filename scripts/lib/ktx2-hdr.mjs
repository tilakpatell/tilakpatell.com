// A half-float DDS as a KTX2 the site's loader reads (three's KTX2Loader
// takes VK_FORMAT_R16G16B16A16_SFLOAT, plain or Zstandard-supercompressed):
// lane W's HDR panoramas (scripts/desktop/bf2017-panoramas.mjs). The
// desktop's texconv decodes the export's BC6H, resizes it and writes the
// mips as R16G16B16A16_FLOAT; this only re-wraps those bytes, every level as
// texconv wrote it, so no value is touched and nothing above 1 is clamped.
//
//   ddsInfo(buf) → { width, height, levels, format, offset }
//   ddsToKtx2(buf, { zstd }) → Buffer
//   zstdReady → whether this Node can supercompress (22.15 and later)

import * as zlib from 'node:zlib';

const DDS = 0x20534444; // 'DDS '
const DX10 = 0x30315844; // 'DX10'
const DXGI_RGBA16F = 10; // DXGI_FORMAT_R16G16B16A16_FLOAT
const D3D_RGBA16F = 113; // D3DFMT_A16B16G16R16F, the legacy header's way of saying the same
const VK_RGBA16F = 97; // VK_FORMAT_R16G16B16A16_SFLOAT
const TEXEL = 8; // bytes a texel: four halves
const ZSTD = 2; // KTX2's supercompression scheme for Zstandard
const ID = [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a];

export function ddsInfo(buf) {
  if (buf.length < 128 || buf.readUInt32LE(0) !== DDS) throw new Error('not a DDS');
  const height = buf.readUInt32LE(12);
  const width = buf.readUInt32LE(16);
  const levels = Math.max(1, buf.readUInt32LE(28));
  const fourCC = buf.readUInt32LE(84);
  const dx10 = fourCC === DX10;
  const format = dx10 ? buf.readUInt32LE(128) : fourCC;
  if (dx10 ? format !== DXGI_RGBA16F : format !== D3D_RGBA16F) throw new Error(`not R16G16B16A16_FLOAT (${dx10 ? `DXGI format ${format}` : `four-CC ${format}`}): run texconv with -f R16G16B16A16_FLOAT`);
  if (dx10 && buf.readUInt32LE(140) > 1) throw new Error('an array texture: one panorama a file');
  return { width, height, levels, format, offset: dx10 ? 148 : 128 };
}

export const zstdReady = Boolean(zlib.zstdCompressSync);

const mip = (n, level) => Math.max(1, n >> level);

// The data format descriptor: one basic block, RGBA as four signed floats, linear.
function dfd({ zstd }) {
  const samples = [0, 1, 2, 15];
  const block = 24 + 16 * samples.length;
  const b = Buffer.alloc(4 + block);
  b.writeUInt32LE(4 + block, 0);
  b.writeUInt32LE(0, 4); // vendor Khronos, descriptor type basic
  b.writeUInt16LE(2, 8); // version
  b.writeUInt16LE(block, 10);
  b.writeUInt8(1, 12); // colour model RGBSDA
  b.writeUInt8(1, 13); // primaries BT.709
  b.writeUInt8(1, 14); // transfer linear
  b.writeUInt8(0, 15); // straight alpha
  // texel block 1×1×1 (stored less one): 0, 0, 0, 0; bytes in plane 0 (0 when supercompressed, as libktx writes it)
  b.writeUInt8(zstd ? 0 : TEXEL, 20);
  samples.forEach((channel, i) => {
    const s = 28 + 16 * i;
    b.writeUInt16LE(16 * i, s); // bit offset
    b.writeUInt8(15, s + 2); // bit length less one
    b.writeUInt8(channel | 0x80 | 0x40, s + 3); // float, signed
    b.writeUInt32LE(0xbf800000, s + 8); // lower: -1.0
    b.writeUInt32LE(0x3f800000, s + 12); // upper: 1.0
  });
  return b;
}

export function ddsToKtx2(buf, { zstd = false, level: zLevel = 19 } = {}) {
  const info = ddsInfo(buf);
  const raw = [];
  let at = info.offset;
  for (let l = 0; l < info.levels; l++) {
    const bytes = mip(info.width, l) * mip(info.height, l) * TEXEL;
    if (at + bytes > buf.length) throw new Error(`the DDS is short: level ${l} wants ${bytes} bytes at ${at}, the file has ${buf.length}`);
    raw.push(buf.subarray(at, at + bytes));
    at += bytes;
  }
  if (zstd && !zlib.zstdCompressSync) throw new Error('this Node has no Zstandard (22.15 or later does): run without zstd');
  const data = raw.map((r) => (zstd ? zlib.zstdCompressSync(r, { params: { [zlib.constants.ZSTD_c_compressionLevel]: zLevel } }) : r));
  const d = dfd({ zstd });
  const head = 80 + 24 * info.levels;
  const dfdOffset = head;
  const align = zstd ? 1 : TEXEL;
  // the levels written smallest first, each aligned (a loader may stream the small ones first)
  let end = dfdOffset + d.length;
  const offsets = [];
  for (let l = info.levels - 1; l >= 0; l--) {
    end = Math.ceil(end / align) * align;
    offsets[l] = end;
    end += data[l].length;
  }
  const out = Buffer.alloc(end);
  Buffer.from(ID).copy(out, 0);
  out.writeUInt32LE(VK_RGBA16F, 12);
  out.writeUInt32LE(2, 16); // type size: a half
  out.writeUInt32LE(info.width, 20);
  out.writeUInt32LE(info.height, 24);
  out.writeUInt32LE(0, 28); // depth
  out.writeUInt32LE(0, 32); // layers
  out.writeUInt32LE(1, 36); // faces
  out.writeUInt32LE(info.levels, 40);
  out.writeUInt32LE(zstd ? ZSTD : 0, 44);
  out.writeUInt32LE(dfdOffset, 48);
  out.writeUInt32LE(d.length, 52);
  out.writeUInt32LE(0, 56); // no key/value data
  out.writeUInt32LE(0, 60);
  out.writeBigUInt64LE(0n, 64); // no supercompression global data
  out.writeBigUInt64LE(0n, 72);
  for (let l = 0; l < info.levels; l++) {
    out.writeBigUInt64LE(BigInt(offsets[l]), 80 + 24 * l);
    out.writeBigUInt64LE(BigInt(data[l].length), 88 + 24 * l);
    out.writeBigUInt64LE(BigInt(raw[l].length), 96 + 24 * l);
    data[l].copy(out, offsets[l]);
  }
  d.copy(out, dfdOffset);
  return out;
}

// A DDS of half floats, as texconv writes one (for the tests, and for a dry
// run's proof of the chain): `texel(x, y, level)` → [r, g, b, a] in floats.
export function makeDds(width, height, levels, texel, { dx10 = true } = {}) {
  const head = dx10 ? 148 : 128;
  let bytes = 0;
  for (let l = 0; l < levels; l++) bytes += mip(width, l) * mip(height, l) * TEXEL;
  const b = Buffer.alloc(head + bytes);
  b.writeUInt32LE(DDS, 0);
  b.writeUInt32LE(124, 4);
  b.writeUInt32LE(0x1 | 0x2 | 0x4 | 0x1000 | 0x20000, 8);
  b.writeUInt32LE(height, 12);
  b.writeUInt32LE(width, 16);
  b.writeUInt32LE(levels, 28);
  b.writeUInt32LE(32, 76);
  b.writeUInt32LE(0x4, 80); // DDPF_FOURCC
  b.writeUInt32LE(dx10 ? DX10 : D3D_RGBA16F, 84);
  if (dx10) {
    b.writeUInt32LE(DXGI_RGBA16F, 128);
    b.writeUInt32LE(3, 132); // a 2D texture
    b.writeUInt32LE(1, 140); // one in the array
  }
  let at = head;
  for (let l = 0; l < levels; l++) {
    for (let y = 0; y < mip(height, l); y++) {
      for (let x = 0; x < mip(width, l); x++) {
        for (const v of texel(x, y, l)) {
          b.writeUInt16LE(toHalf(v), at);
          at += 2;
        }
      }
    }
  }
  return b;
}

// A float as a half's bits (round to nearest; enough for the tests' values).
export function toHalf(v) {
  const f = new Float32Array([v]);
  const i = new Uint32Array(f.buffer)[0];
  const sign = (i >>> 16) & 0x8000;
  let exp = ((i >>> 23) & 0xff) - 127 + 15;
  let man = i & 0x7fffff;
  if (exp <= 0) return sign;
  if (exp >= 31) return sign | 0x7c00;
  man = Math.round(man / 0x2000);
  if (man === 0x400) {
    man = 0;
    exp += 1;
  }
  return sign | (exp << 10) | man;
}

export function fromHalf(h) {
  const sign = h & 0x8000 ? -1 : 1;
  const exp = (h >>> 10) & 0x1f;
  const man = h & 0x3ff;
  if (exp === 0) return sign * 2 ** -14 * (man / 1024);
  if (exp === 31) return man ? NaN : sign * Infinity;
  return sign * 2 ** (exp - 15) * (1 + man / 1024);
}
