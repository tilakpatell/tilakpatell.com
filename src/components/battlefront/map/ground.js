// Hoth's ground from the pack's heightmaps (the `image` layer, in the pack's
// frame): a fine grid over the near map and a coarse one under the whole
// world map, a little lower so the two never fight where they overlap. On
// the node renderer the grids wear the game's snow (lib/three/ground/snow.js:
// the record's TerrainColor under the shader's three normal octaves, its
// brightness, soot, streak and sparkle maps, fetched at the tier's size from
// the pack's tex rows); the classic renderer keeps the flat colour. On ultra
// a 1 m patch follows the player within PATCH_M (the heightmap is 1 m a
// pixel: the 4 m grid flattens it), its vertices displaced by the snow's
// height, and the 4 m grid sits PATCH_UNDER below it there.
//
//   buildGround(layer, terrain, { world, pack, tier, renderer } = {}) → Group
//     { update([x, z] in the pack's frame), ready: Promise, dispose() }
//   patchOrigin([x, z], step) → the patch's corner, snapped to the step (pure)
//   needsPatch(at, have) → whether the player has walked far enough to rebuild (pure)

import * as THREE from 'three';
import { LAYERS } from '../../../lib/land/layers.js';
import { withFallback } from '../../../lib/assetBase.js';
import { BUDGETS } from '../../../lib/device.js';
import { anisotropyFor } from '../../../lib/three/textures.js';
import { backendOf, loadThree } from '../../../lib/three/light/three.js';
import { createSnowGround, mapsFor } from '../../../lib/three/ground/snow.js';
import { SNOW, SNOW_MAPS } from '../../../lib/three/ground/snowMaps.js';
import { packUrl, tierTexture } from '../../galaxy/shared/level.js';

export const NEAR_STEP = 4; // m between the near grid's vertices (the map is 1 m a pixel)
export const FAR_STEP = 32; // m: the world map's grid (4 m a pixel)
export const FAR_DROP = 1.5; // m the far grid sits under the near one
export const PATCH_M = 300; // m a side: the 1 m patch round the player on ultra (150 m each way)
export const PATCH_STEP = 1; // m: the patch's spacing, the heightmap's own
export const PATCH_MOVE = 60; // m the player walks before the patch is built again round them
export const PATCH_UNDER = 0.3; // m the 4 m grid drops under the patch (the patch follows the field's true heights between the grid's)
const SNOW_COLOUR = new THREE.Color(...SNOW.colour);

function grid(layer, min, size, step, drop) {
  const n = Math.max(2, Math.round(size / step) + 1);
  const g = new THREE.PlaneGeometry(size, size, n - 1, n - 1);
  g.rotateX(-Math.PI / 2);
  g.translate(min[0] + size / 2, 0, min[1] + size / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, LAYERS.image(p.getX(i), p.getZ(i), layer) - drop);
  g.computeVertexNormals();
  return g;
}

export const patchOrigin = ([x, z], step = PATCH_MOVE) => [Math.round(x / step) * step - PATCH_M / 2, Math.round(z / step) * step - PATCH_M / 2];
export const needsPatch = (at, have) => !have || Math.hypot(at[0] - have[0], at[1] - have[1]) >= PATCH_MOVE;

export function buildGround(layer, terrain = {}, { world = 'hoth', pack = null, tier = 'high', renderer = null } = {}) {
  const flat = new THREE.MeshStandardMaterial({ color: SNOW_COLOUR, roughness: 1 - SNOW.smoothness, metalness: 0 });
  const out = new THREE.Group();
  out.name = 'ground';
  const snow = Boolean(renderer) && backendOf(renderer) !== 'webgl' && mapsFor(tier).length > 0;
  const patched = snow && tier === 'ultra';
  let nearMesh = null;
  let farMesh = null;
  let patch = null;
  let patchAt = null;
  let built = null;
  let gone = false;
  const owned = [];
  const near = terrain.near;
  if (near?.min && near?.size) {
    const size = (near.size[0] - 1) * near.metresPerPixel;
    nearMesh = new THREE.Mesh(grid(layer, near.min, size, NEAR_STEP, patched ? PATCH_UNDER : 0), flat);
    nearMesh.name = 'ground:near';
    nearMesh.receiveShadow = true;
    out.add(nearMesh);
  }
  const far = terrain.far;
  if (far?.min && far?.size) {
    const size = (far.size[0] - 1) * far.metresPerPixel;
    farMesh = new THREE.Mesh(grid(layer, far.min, size, FAR_STEP, FAR_DROP + (patched ? PATCH_UNDER : 0)), flat.clone());
    farMesh.name = 'ground:far';
    farMesh.receiveShadow = true;
    out.add(farMesh);
  }

  // the snow's maps at the tier's size, through the asset base (the bucket by
  // hash, the site's copy when it has not got one: a 404 is this map's miss,
  // never the bucket down), each told its colour space and the tier's
  // anisotropy; one that fails leaves its term out
  const ready = (async () => {
    if (!snow || !nearMesh) return null;
    const three = await loadThree();
    const ktx = await import('../../../lib/three/gltf.js').then((m) => m.ktx2Loader({ renderer }));
    const max = renderer?.getMaxAnisotropy?.() ?? 16;
    const aniso = anisotropyFor(max, (BUDGETS[tier] ?? BUDGETS.high).aniso);
    const bytes = (u) =>
      fetch(u).then((r) => {
        if (!r.ok) throw Object.assign(new Error(`${r.status} ${u}`), { status: r.status, missing: r.status === 404 });
        return r.arrayBuffer();
      });
    const load = (slug) =>
      withFallback(bytes)(packUrl(world, tierTexture(`tex/${slug}.ktx2`, tier, pack?.tex ?? {})))
        .then((buf) => new Promise((res, rej) => ktx.parse(buf, res, rej)))
        .then((t) => {
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.colorSpace = SNOW_MAPS[slug].srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          t.anisotropy = aniso;
          t.needsUpdate = true;
          owned.push(t);
          return t;
        })
        .catch(() => null);
    const maps = {};
    await Promise.all(mapsFor(tier).map(async (slug) => (maps[slug] = await load(slug))));
    if (gone) return null;
    built = {
      near: createSnowGround({ maps, tier, three }),
      far: createSnowGround({ maps, tier, three, far: true }),
      patch: patched ? createSnowGround({ maps, tier, three, displace: true }) : null,
    };
    nearMesh.material = built.near.material;
    if (farMesh) farMesh.material = built.far.material;
    if (patch && built.patch) patch.material = built.patch.material;
    return built;
  })().catch((e) => {
    if (import.meta.env?.DEV) console.warn('the snow did not land', e);
    return null;
  });

  // the 1 m patch round the player, built again once they have walked PATCH_MOVE
  function update(at) {
    if (!patched || !needsPatch(at, patchAt)) return;
    patchAt = [at[0], at[1]];
    const min = patchOrigin(at);
    const g = grid(layer, min, PATCH_M, PATCH_STEP, 0);
    if (!patch) {
      patch = new THREE.Mesh(g, built?.patch?.material ?? flat);
      patch.name = 'ground:patch';
      patch.receiveShadow = true;
      out.add(patch);
    } else {
      patch.geometry.dispose();
      patch.geometry = g;
    }
  }

  out.update = update;
  out.ready = ready;
  out.dispose = () => {
    gone = true;
    out.traverse((o) => o.geometry?.dispose());
    flat.dispose();
    farMesh?.material?.dispose?.();
    if (built) for (const b of Object.values(built)) b?.dispose();
    for (const t of owned) t.dispose();
  };
  return out;
}
