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

// What the game places and never draws as itself, the render's helpers: the
// shadow casters (Endor_01's 144 m bunker shadow mesh, the caves'), the
// occlusion meshes (`…occluder…`; a cliff `…nooccluder` is the cliff itself)
// and the light and grenade blockers. Packs built before the factory's NEVER
// knew them still place them; they drop on every tier, from the draw, the
// walk world's solids and the engine alike (each reads `cull[tier].dropped`).
export const PROXY = /shadowmesh|_shadow_mesh|(?<!no)occluder|lightblocker|blockercsg/i;
const TIERS = ['low', 'mid', 'high', 'ultra'];

export function withoutProxies(pack) {
  const proxies = (pack.meshes ?? []).flatMap((m, i) => (PROXY.test(m.name ?? '') ? [i] : []));
  if (!proxies.length) return pack;
  const cull = Object.fromEntries(
    TIERS.map((t) => {
      const c = pack.cull?.[t] ?? pack.cull?.high ?? { K: Infinity, dropped: [] };
      return [t, { ...c, dropped: [...new Set([...(c.dropped ?? []), ...proxies])] }];
    }),
  );
  return { ...pack, cull };
}

// What a pack stands of the map's creatures and vehicles (actors.json,
// vehicles.json): all of them on a world's own map; none in an interior
// (`inside`: its parts are the whole map's, the battle out under the sky,
// and carry no height to tell the halls' own from it: Endor_01's bunker
// would have stood the AT-AT station's walker and its Ewoks in its halls)
export const placedOf = (pack, a, v) => (pack?.inside ? { life: [], rides: [], things: [] } : { life: a.life ?? [], rides: v.rides ?? [], things: v.things ?? [] });

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
