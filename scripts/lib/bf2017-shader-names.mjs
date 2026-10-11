// The shader depots' hashed parameter names, named (lane colour:
// docs/superpowers/specs/2026-10-10-bf2017-accuracy-design.md, §1.1). The
// depots (`maps_work/shaderdepots.jsonl`, the desktop's `bf2export
// sbdprobe`) keep each compiled material's parameter blocks with hashed
// names: the hash is djb2-xor (`h = ((h << 5) + h) ^ c` from 5381, 32-bit)
// of the lower-cased name, so a dictionary of the names the export does
// spell out (the material dump's keys, the object variations' parameter
// names, the shader presets' parameters) names them. The mesh variation
// databases' `VariationAssetNameHash` is the same hash of the variation's
// lower-cased asset path. Pure.
//
//   djb2(text) → 'xxxxxxxx' (as written: the depots' type names are hashed so)
//   hashName(name) → 'xxxxxxxx' (lower-cased first: the dictionary's hash)
//   namesFrom({ materials, variations, presets }) → Set of names
//   resolveDepot(rows, names) → { params: [{ name | hash, type, value }], resolved, unresolved: { hash: count } }
//   resolveHashes(names) → Map(numeric hash → name)

// the depots' type hashes, as the sbdprobe rows show them (Vec is djb2 of
// 'Vec'; Boolean's is the probe's as observed, the spelling unknown)
export const TYPES = { '0b87fa95': 'Vec', '0d1cfa1b': 'Boolean' };

const utf8 = new TextEncoder();

export function djb2(text) {
  let h = 5381;
  for (const c of utf8.encode(text)) h = (((h << 5) + h) ^ c) >>> 0;
  return h.toString(16).padStart(8, '0');
}

export const hashName = (name) => djb2(String(name).toLowerCase());

// every parameter name a record spells out, wherever it sits: an object's
// `ParameterName`, a preset's `Name` in a `Parameters` list
function walkNames(node, out) {
  if (Array.isArray(node)) {
    for (const v of node) walkNames(v, out);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (typeof node.ParameterName === 'string' && node.ParameterName) out.add(node.ParameterName);
  for (const [k, v] of Object.entries(node)) {
    if (k === 'Parameters' && Array.isArray(v)) for (const p of v) if (typeof p?.Name === 'string' && p.Name) out.add(p.Name);
    if (v && typeof v === 'object') walkNames(v, out);
  }
}

export function namesFrom({ materials = [], variations = [], presets = [] } = {}) {
  const out = new Set();
  for (const row of materials) {
    for (const m of row.materials ?? []) {
      for (const group of ['textures', 'vectors', 'bools']) for (const k of Object.keys(m[group] ?? {})) out.add(k);
      // (the conditionals are keyed by path: Shaders/ExternalConditionals/<name>)
      for (const k of Object.keys(m.conditionals ?? {})) out.add(k.split('/').pop());
    }
  }
  for (const r of [...variations, ...presets]) walkNames(r, out);
  return out;
}

// a Vec's 16 bytes as four little-endian floats
function vecOf(hex) {
  if (typeof hex !== 'string' || hex.length !== 32) return hex;
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i++) b[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  const v = new DataView(b.buffer);
  return [0, 4, 8, 12].map((o) => Math.round(v.getFloat32(o, true) * 1e6) / 1e6);
}

export function resolveDepot(rows, names) {
  const byHash = new Map();
  for (const n of names) byHash.set(hashName(n), n);
  const params = [];
  const unresolved = {};
  let resolved = 0;
  for (const row of rows) {
    for (const block of row.blocks ?? []) {
      for (const p of block.params ?? []) {
        const hash = String(p.hash ?? p.nameHash ?? '').toLowerCase();
        const type = TYPES[String(p.type ?? '').toLowerCase()] ?? p.type ?? null;
        const value = type === 'Vec' ? vecOf(p.value) : p.value;
        const name = byHash.get(hash);
        if (name) {
          resolved++;
          params.push({ name, type, value });
        } else {
          unresolved[hash] = (unresolved[hash] ?? 0) + 1;
          params.push({ hash, type, value });
        }
      }
    }
  }
  return { params, resolved, unresolved };
}

export function resolveHashes(names) {
  const out = new Map();
  for (const n of names) out.set(parseInt(hashName(n), 16), n);
  return out;
}
