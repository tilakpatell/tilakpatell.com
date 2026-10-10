// A 2017 crew pack's figures in the game's own surface shader (lane Q1's
// follow-up: docs/superpowers/specs/2026-10-10-bf2017-surfaces-design.md,
// "Wiring"): on the node renderer, each material its kind's recipes.json
// names (scripts/bf2017-recipes.mjs --crew, by the colour map it wears) is
// replaced by the game material over it: a character's detail array with
// every slice drawn where its AOSlice map names it, the weathering mask,
// hair's melanin and lobes, a head's scattering. The classic renderer, the
// low tier and a kind without recipes keep the GLB's materials.
//
//   watchCrew(model, kind, { dress, tierOf }) → model: dressed the first
//     time the node renderer draws it (its meshes' onBeforeRender, so the
//     scene that places it need not say which renderer it is)
//   dressCrew(model, kind, { renderer, tier, cache, fetchJson, loadTexture, make }) → Promise<materials swapped>
//     (cache: GLB material → its game material, so the figures of a kind
//     that share one share the other)

import { withFallback } from '../../../lib/assetBase.js';
import { detailLevel } from '../../../lib/detail.js';
import { ktx2Loader } from '../../../lib/three/gltf.js';
import { recipeMaps } from './level/levelGltf.js';
import { tierTexture } from './level/levelPack.js';

const DIR = '/models/galaxy/bf2017/crew/';

// (each kind's recipes and each map once a visit; a kind without its file is null)
const jsons = new Map();
const fetchJson = (url) => {
  if (!jsons.has(url))
    jsons.set(
      url,
      withFallback((u) => fetch(u).then((r) => (r.ok ? r.json() : null)))(url).catch(() => null),
    );
  return jsons.get(url);
};
const textures = new Map();
const loadTextureFor = (renderer) => (url) => {
  if (!textures.has(url))
    textures.set(
      url,
      ktx2Loader({ renderer })
        .then((k) => withFallback((u) => k.loadAsync(u))(url))
        .catch(() => null),
    );
  return textures.get(url);
};
let maker = null;
const makeMaterial = async () => {
  maker ??= import('../../../lib/three/surface/hair.js').then((m) => m.loadSurfaceMaterial());
  return maker;
};
const shared = new Map(); // tier → WeakMap(GLB material → Promise<game material>)

export async function dressCrew(model, kind, { renderer = null, tier, cache = null, fetchJson: getJson = fetchJson, loadTexture = loadTextureFor(renderer), make = null }) {
  if (tier === 'low') return 0;
  const json = await getJson(`${DIR}${kind}.recipes.json`);
  if (!json?.materials) return 0;
  const [{ TIER_MAPS }, build] = await Promise.all([import('../../../lib/three/surface/gameMaterial.js'), make ? Promise.resolve(make) : makeMaterial()]);
  if (!cache) {
    if (!shared.has(tier)) shared.set(tier, new WeakMap());
    cache = shared.get(tier);
  }
  const meshes = [];
  model.traverse((o) => {
    // (a mesh already in its game material is left: it keeps the GLB's name)
    if (o.isMesh && !Array.isArray(o.material) && !o.material?.userData?.game && json.materials[o.material?.name]?.family && json.materials[o.material.name].family !== 'glb') meshes.push(o);
  });
  const texture = (p) => loadTexture(tierTexture(`${DIR}${p}`, tier, json.tex));
  let swapped = 0;
  await Promise.all(
    meshes.map(async (mesh) => {
      const glb = mesh.material;
      if (!cache.has(glb)) {
        const recipe = json.materials[glb.name];
        cache.set(
          glb,
          recipeMaps(recipe, { maps: json.maps, texture, keys: TIER_MAPS[tier] ?? null })
            .then((maps) => build(recipe, { glb, ...maps }, { tier }))
            .catch((e) => {
              if (import.meta.env?.DEV) console.warn('crew game material failed', kind, glb.name, e);
              return null;
            }),
        );
      }
      const game = await cache.get(glb);
      if (game && mesh.material === glb) {
        mesh.material = game;
        swapped++;
      }
    }),
  );
  return swapped;
}

export function watchCrew(model, kind, { dress = dressCrew, tierOf = detailLevel } = {}) {
  let asked = false;
  const meshes = [];
  model.traverse((o) => o.isMesh && meshes.push(o));
  const own = new Map(meshes.map((m) => [m, m.onBeforeRender]));
  const unhook = () => {
    for (const [m, f] of own) m.onBeforeRender = f;
  };
  // (a cut swapped in later, walrus.js's swapBody, brings new meshes: each
  // one added anywhere in the figure dresses it again, once a frame's worth)
  const follow = (renderer, tier) => {
    let queued = false;
    const again = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        dress(model, kind, { renderer, tier });
      });
    };
    const listen = (o) => {
      if (o.userData.crewSurface) return;
      o.userData.crewSurface = true;
      o.addEventListener('childadded', (e) => {
        e.child.traverse(listen);
        again();
      });
    };
    model.traverse(listen);
  };
  for (const m of meshes) {
    m.onBeforeRender = function (renderer, ...rest) {
      own.get(m)?.call(this, renderer, ...rest);
      if (asked || !renderer) return;
      asked = true;
      unhook();
      if (!renderer.isWebGPURenderer) return;
      const tier = tierOf();
      dress(model, kind, { renderer, tier });
      if (tier !== 'low') follow(renderer, tier);
    };
  }
  return model;
}
