// What colour space a KTX2 says it is in, and what it should say. A KTX2's
// data format descriptor carries a transfer function (KHR_DF_TRANSFER_SRGB
// or _LINEAR), and three's KTX2Loader reads it: a map tagged linear is
// sampled as linear light. The game stores its colour maps as sRGB (BC7_SRGB
// in textures.jsonl), but the desktop's UASTC encode left many of them
// tagged linear, and read that way they came out washed pale (the level
// loader forces its colour slots to sRGB for that reason, levelGltf.js).
// The right place to say it is the file: these helpers read the tag, stamp
// the right one (a byte, no re-encode), and know which of the game's maps
// are colour by DICE's suffixes, so every writer in the pipeline stamps as
// it writes and the audit (scripts/bf2017-colour-check.mjs) can hold a pack
// to it.
//
//   transferOf(buf) → 'srgb' | 'linear' | 'unknown'
//   withTransfer(buf, 'srgb' | 'linear') → Buffer (the same buffer when it already says so)
//   mapKind(name) → 'colour' | 'data' | 'unknown'     (a bucket path, a slug or a sized file name)
//   gameWord(jsonl) → Map(stem → true | false)         (web/textures.jsonl's own `srgb` flag per map: the truth)
//   loadGameWord(root) → Map | null                     (the same from lab/assets/bf2017/, when it is there)
//   wantedTransfer(name, { word }) → 'srgb' | 'linear' | null   (the game's word first, the suffix rule after; null: unknown)
//   slotTransfer(slot) → 'srgb' | 'linear'            (a glTF slot: baseColor and emissive are sRGB)
//   auditKtx2(name, buf) → { name, kind, transfer, wanted, ok }
//   summarise(rows) → { files, colour: { srgb, linear, unknown }, data: { … }, unknown, wrong: [names] }

import { existsSync, readFileSync } from 'node:fs';

const ID = [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a];
export const TRANSFER = { linear: 1, srgb: 2 };
const NAMES = { 1: 'linear', 2: 'srgb' };

// the transfer byte: after the DFD's total size (4) and the basic
// descriptor block's vendor and type (4), version and size (4), colour
// model (1) and primaries (1)
const transferAt = (buf) => {
  if (buf.length < 80 || ID.some((b, i) => buf[i] !== b)) throw new Error('not a KTX2');
  const off = buf.readUInt32LE(48);
  const len = buf.readUInt32LE(52);
  if (len < 4 + 12 || off + len > buf.length) throw new Error('a KTX2 with no data format descriptor');
  return off + 4 + 8 + 2;
};

export const transferOf = (buf) => NAMES[buf[transferAt(buf)]] ?? 'unknown';

export function withTransfer(buf, transfer) {
  const want = TRANSFER[transfer];
  if (!want) throw new Error(`not a transfer function: ${transfer}`);
  const at = transferAt(buf);
  if (buf[at] === want) return buf;
  const out = Buffer.from(buf);
  out[at] = want;
  return out;
}

// DICE's suffixes (docs/assets/battlefront-2017.md, "What a texture is"):
// the colour maps carry the colour (with smoothness or alpha in A); the
// uploader's derived maps (__normal, __orm_<hash>) and the normal, mask,
// height, ID and slice maps are data. An emissive map is colour: the game
// multiplies it into the emissive colour as a picture, not a weight.
const COLOUR = /_(cs|c|co|ca|cw|cm|d|e|em|ecs|colorsmoothness|basecolor|basecolour|color|colour|diffuse|albedo)$/;
const DATA = /_(n|nm|ns|nam|nom|nos|naos|nma|nw|na|noh|nss|nts|ncs|ncm|nmo|ao|aosl|h|m|msr|mask|id|rgb|rgba|rgbm|b|w|r|s|g|sl|rsssao|hm|dm|detail)$/;

// a file's game name: the folder, the tier's size (.128) or cut (.ultra),
// the slug's disambiguating _<n>, and the extension taken off
export function stemOf(name) {
  return String(name)
    .split('/')
    .pop()
    .toLowerCase()
    .replace(/\.(png|ktx2|webp|avif)$/, '')
    .replace(/\.(ultra|xl|sm|\d+)$/, '')
    .replace(/_\d+$/, '');
}

export function mapKind(name) {
  const stem = stemOf(name);
  if (/__normal$|__orm_[0-9a-f]+$/.test(stem)) return 'data';
  if (COLOUR.test(stem)) return 'colour';
  if (DATA.test(stem)) return 'data';
  return 'unknown';
}

// The game's own word: textures.jsonl names each of its 17,511 maps'
// format (BC7_SRGB and the like against BC7_UNORM; its `srgb` field is
// false on every row and says nothing). It overrules the suffix
// rule, which is a heuristic: 103 of the game's 3,780 `_cs` maps and 225 of
// its 1,257 `_c` maps are linear, and 169 `_w` and 164 `_m` masks are sRGB
// (measured 2026-10-10). A derived map (`__normal`, `__orm_`) is data
// whatever its source says.
export function gameWord(jsonl) {
  const out = new Map();
  for (const line of String(jsonl).split('\n')) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    const stem = String(row.file ?? row.name ?? '')
      .split('/')
      .pop()
      .toLowerCase()
      .replace(/\.(png|ktx2)$/, '');
    if (!stem) continue;
    // (the format is the word: BC7_SRGB against BC7_UNORM. The export's
    // `srgb` field is false on every row, so it decides only without a format)
    const fmt = String(row.format ?? '');
    const srgb = fmt ? /SRGB/i.test(fmt) : typeof row.srgb === 'boolean' ? row.srgb : null;
    if (srgb != null) out.set(stem, srgb);
  }
  return out;
}

export function loadGameWord(root) {
  for (const f of [`${root}/web/textures.jsonl`, `${root}/textures.jsonl`]) if (existsSync(f)) return gameWord(readFileSync(f, 'utf8'));
  return null;
}

// the game's name under a pack slug: the slug's own stem, its derived
// marker and the uploader's disambiguating number taken off
const sourceStem = (name) => stemOf(name).replace(/__(normal|orm_[0-9a-f]+)$/, '');

export function wantedTransfer(name, { word = null } = {}) {
  const stem = stemOf(name);
  if (/__normal$|__orm_[0-9a-f]+$/.test(stem)) return 'linear';
  const said = word?.get(sourceStem(name));
  if (typeof said === 'boolean') return said ? 'srgb' : 'linear';
  const kind = mapKind(name);
  return kind === 'colour' ? 'srgb' : kind === 'data' ? 'linear' : null;
}

export const slotTransfer = (slot) => (/baseColor|emissive|diffuse|sheenColor|specularColor/i.test(String(slot)) ? 'srgb' : 'linear');

export function auditKtx2(name, buf, { word = null } = {}) {
  const transfer = transferOf(buf);
  const wanted = wantedTransfer(name, { word });
  const said = word?.get(sourceStem(name));
  const kind = typeof said === 'boolean' && !/__(normal|orm_)/.test(stemOf(name)) ? (said ? 'colour' : 'data') : mapKind(name);
  return { name, kind, transfer, wanted, ok: wanted == null || transfer === wanted, ...(typeof said === 'boolean' ? { game: said ? 'srgb' : 'linear' } : {}) };
}

export function summarise(rows) {
  const out = { files: rows.length, colour: { srgb: 0, linear: 0, unknown: 0 }, data: { srgb: 0, linear: 0, unknown: 0 }, unknown: 0, wrong: [] };
  for (const r of rows) {
    if (r.kind === 'unknown') out.unknown++;
    else out[r.kind][r.transfer]++;
    if (!r.ok) out.wrong.push(r.name);
  }
  return out;
}
