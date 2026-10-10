// The one door the Battlefront world's files come through (the game design's
// section 7: docs/superpowers/specs/2026-10-10-battlefront-game-design.md).
// Two backends, chosen by VITE_BF2_BACKEND:
//
// - `dev`: the local export's web build (web_opt/), served by Vite at /bf2/
//   from BF2_ROOT (vite.config.js); nothing copied. The names are the
//   export's own: models.jsonl's model names, anims.jsonl's clip names,
//   level paths like `levels/mp/hoth_01/hoth_01`.
// - `bucket`: the streaming session's (the authenticated bf2017-assets
//   bucket, its cache and gate). Not here yet: one function below, so that
//   session fills one place.
//
// The level itself is lane L's pack (map/level.js), not these files; the
// adapter is for what the pack does not carry (the export's own maps,
// terrain, clips, models and physics).
//
//   createAssets({ backend, base, renderer, fetchBytes, loadGltf }) → {
//     loadModel(name, { lod = 0 }) → Promise<Object3D>
//     loadClip(name) → Promise<AnimationClip>
//     loadMap(level) → Promise<{ manifest, bin: ArrayBuffer }>
//     loadTerrain(level) → Promise<{ meta, height: Uint16Array, width, rows }>
//     loadPhysics(name) → Promise<{ scene }> (the GLB; src/lib/physics/havok.js reads its shapes)
//     loadStrings() → Promise<Record<string, string>>
//     dispose()
//   }
// (`rows` is the heightmap's height in pixels: the contract's `height` is
// the samples.)

import { decodePng16 } from '../../lib/level/png16.js';

export const BACKENDS = ['dev', 'bucket'];

// the export's paths, by kind (web_opt/README.md)
export const pathFor = {
  model: (name, lod = 0) => `models/${name}${lod > 0 ? `_lod${lod}` : ''}.glb`,
  map: (level) => `maps/${level}.json`,
  physics: (name) => `physics/${name}.glb`,
  strings: () => 'strings/English.json',
  anims: () => 'anims.jsonl',
};

const defaultFetch = (url) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.arrayBuffer();
  });

const text = (buf) => new TextDecoder().decode(buf);
const json = (buf) => JSON.parse(text(buf));

// The streaming session's backend: until it lands, every ask says so.
function bucketBackend() {
  const no = () => Promise.reject(new Error('the bucket backend is not here yet (the streaming session’s lane)'));
  return { bytes: no };
}

function devBackend({ base, fetchBytes }) {
  return { bytes: (path) => fetchBytes(`${base}${path}`) };
}

export function createAssets({ backend = import.meta.env?.VITE_BF2_BACKEND ?? 'dev', base = '/bf2/', renderer = null, fetchBytes = defaultFetch, loadGltf = null } = {}) {
  if (!BACKENDS.includes(backend)) throw new Error(`unknown assets backend ${backend}`);
  const io = backend === 'bucket' ? bucketBackend() : devBackend({ base, fetchBytes });
  const cache = new Map(); // key → Promise
  const owned = new Set(); // geometries and textures to free
  const once = (key, make) => {
    if (!cache.has(key)) {
      const p = make().catch((e) => {
        cache.delete(key);
        throw e;
      });
      cache.set(key, p);
    }
    return cache.get(key);
  };
  const gltfOf = async (path) => {
    const load = loadGltf ?? (await import('../../lib/three/gltf.js')).loadGltf;
    const got = await load(`${base}${path}`, { renderer });
    if (!got) throw new Error(`no model at ${path}`);
    return got;
  };
  const anims = () =>
    once('anims', async () => {
      const rows = new Map();
      for (const line of text(await io.bytes(pathFor.anims())).split('\n')) {
        if (!line.trim()) continue;
        const r = JSON.parse(line);
        rows.set(r.name, r);
      }
      return rows;
    });
  const mapOf = (level) => once(`map:${level}`, async () => json(await io.bytes(pathFor.map(level))));
  const keep = (root) => {
    root?.traverse?.((o) => {
      if (o.geometry) owned.add(o.geometry);
      for (const m of [].concat(o.material ?? [])) for (const v of Object.values(m)) if (v?.isTexture) owned.add(v);
    });
    return root;
  };

  return {
    backend,
    loadModel: (name, { lod = 0 } = {}) => once(`model:${name}:${lod}`, async () => keep((await gltfOf(pathFor.model(name, lod))).scene)),
    loadClip: (name) =>
      once(`clip:${name}`, async () => {
        const row = (await anims()).get(name);
        if (!row) throw new Error(`no clip named ${name} in anims.jsonl`);
        const clip = (await gltfOf(row.file)).animations?.[0];
        if (!clip) throw new Error(`clip ${name}: the file has no animation`);
        clip.name = name;
        return clip;
      }),
    loadMap: (level) =>
      once(`mapbin:${level}`, async () => {
        const manifest = await mapOf(level);
        const dir = level.split('/').slice(0, -1).join('/');
        const bin = await io.bytes(`maps/${dir ? `${dir}/` : ''}${manifest.bin.file}`);
        return { manifest, bin };
      }),
    loadTerrain: (level) =>
      once(`terrain:${level}`, async () => {
        const manifest = await mapOf(level);
        const meta = [].concat(manifest.terrain ?? [])[0];
        if (!meta?.world?.file) throw new Error(`${level}: the map names no heightmap`);
        const img = await decodePng16(new Uint8Array(await io.bytes(meta.world.file)));
        return { meta, height: img.data, width: img.w, rows: img.h };
      }),
    loadPhysics: (name) => once(`physics:${name}`, async () => ({ scene: keep((await gltfOf(pathFor.physics(name))).scene) })),
    loadStrings: () => once('strings', async () => json(await io.bytes(pathFor.strings()))),
    dispose() {
      for (const o of owned) o.dispose?.();
      owned.clear();
      cache.clear();
    },
  };
}
