// A level pack, read (lane L, "How a level draws"): which cells a visitor
// wants round them (their collision), where the pack's files are, and a
// GLB's textures at the tier's size.
// Pure: no three.js. The bands and the records are src/lib/level's, shared
// with the pack builder (scripts/bf2017-level.mjs).

import { bandsFor, cutFor, wanted } from '../../../../lib/level/bands.js';
import { readInstances } from '../../../../lib/level/instances.js';

export { bandsFor, cutFor, readInstances, wanted };

// a map's size on a tier when the pack does not say (the design's)
export const TEX = { low: 512, mid: 1024, high: 1024, ultra: 2048 };

// A pack file's site path. The pack's bytes are published to site-assets,
// not committed (lane E0; level.json and README.md stay in git): the build
// merges src/data/galaxyAssets.json into the asset manifest, so assetUrl and
// withFallback (src/lib/assetBase.js) turn this path into the published URL,
// as they do a model's. A district's pack is `<world>/<district>`.
export const packUrl = (world, path) => `/models/galaxy/bf2017/levels/${world}/${path}`;

// A key's band in a `wanted` answer: 'near', 'mid', or null (not wanted)
export const bandOf = (w, key) => (w.near.includes(key) ? 'near' : w.mid.includes(key) ? 'mid' : null);

// a map's file on a tier: its size from the pack's `tex` (sized by the
// biggest thing that wears it; a pack without --ultra draws ultra as high)
export function tierTexture(uri, tier, sizes = {}) {
  const slug = uri.split('/').pop().replace(/\.ktx2$/, '');
  const s = sizes[slug];
  const size = s?.[tier] ?? s?.high ?? TEX[tier] ?? TEX.high;
  return uri.replace(/\.ktx2$/, `.${size}.ktx2`);
}

// The pack's meshes share their textures (one material a game material, one
// KTX2 a map), but a glTF loader keeps its textures per file, which would
// upload the same map once for every mesh that names it. So a GLB is parsed
// without them: this takes its textures out (images, textures, samplers and
// each material's references) and says which material wanted which map in
// which slot, for the scene to bind from one shared cache.
//
//   splitTextures(buffer) → { buffer, slots: [{ material, slot, uri }] }
const SLOTS = [
  ['map', (m) => m.pbrMetallicRoughness?.baseColorTexture, (m) => delete m.pbrMetallicRoughness.baseColorTexture],
  ['metalRough', (m) => m.pbrMetallicRoughness?.metallicRoughnessTexture, (m) => delete m.pbrMetallicRoughness.metallicRoughnessTexture],
  ['normalMap', (m) => m.normalTexture, (m) => delete m.normalTexture],
  ['aoMap', (m) => m.occlusionTexture, (m) => delete m.occlusionTexture],
  ['emissiveMap', (m) => m.emissiveTexture, (m) => delete m.emissiveTexture],
];

function imageUri(json, ref) {
  const t = json.textures?.[ref.index];
  const src = t?.extensions?.KHR_texture_basisu?.source ?? t?.source;
  return src === undefined ? null : (json.images?.[src]?.uri ?? null);
}

export function splitTextures(buffer) {
  const bytes = new Uint8Array(buffer);
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const len = v.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + len)));
  const slots = [];
  (json.materials ?? []).forEach((m, material) => {
    for (const [slot, get, drop] of SLOTS) {
      const ref = get(m);
      if (!ref) continue;
      const uri = imageUri(json, ref);
      if (uri && !uri.startsWith('data:')) slots.push({ material, slot, uri });
      drop(m);
    }
  });
  delete json.images;
  delete json.textures;
  delete json.samplers;
  const strip = (list) => list?.filter((e) => e !== 'KHR_texture_basisu' && e !== 'EXT_texture_webp' && e !== 'KHR_texture_transform');
  if (json.extensionsUsed) json.extensionsUsed = strip(json.extensionsUsed);
  if (json.extensionsRequired) json.extensionsRequired = strip(json.extensionsRequired);
  let text = new TextEncoder().encode(JSON.stringify(json));
  const pad = (4 - (text.length % 4)) % 4;
  if (pad) {
    const t = new Uint8Array(text.length + pad).fill(0x20);
    t.set(text);
    text = t;
  }
  const rest = bytes.subarray(20 + len);
  const out = new Uint8Array(20 + text.length + rest.length);
  out.set(bytes.subarray(0, 20));
  const o = new DataView(out.buffer);
  o.setUint32(8, out.length, true);
  o.setUint32(12, text.length, true);
  out.set(text, 20);
  out.set(rest, 20 + text.length);
  return { buffer: out.buffer, slots };
}
