// Hoth's ground from the pack's heightmaps (the `image` layer, in the pack's
// frame): a fine grid over the near map and a coarse one under the whole
// world map, a little lower so the two never fight where they overlap. On
// the node renderer the grids wear the game's terrain (lib/three/ground/
// snow.js: its nine layers blended by the masks the game paints in its
// TerrainStreamingTree, laid into the pack's two mask frames, each layer's
// maps at the listing's tilings from the pack's three map arrays, fetched at
// the tier's size from its tex rows); the classic renderer keeps the flat
// colour. On ultra a 1 m patch follows the player within PATCH_M (the
// heightmap is 1 m a pixel: the 4 m grid flattens it), its vertices
// displaced by the snow's height, and the 4 m grid sits PATCH_UNDER below
// it there.
//
// Where the game's terrain has a hole (the pack's `terrain.holes`: the
// hangar mouths and the trench tunnels, lib/land/holes.js) no ground is
// drawn: each material, the snow's and the flat one's, discards a fragment
// over a hole by a half-metre mask in the export's frame (the node
// material's maskNode), so whatever the grid's spacing the cut is the
// game's. The floor there is the level's own meshes.
//
// The flat colour is what is drawn until the snow has landed, and all that
// is drawn when it cannot: a file is asked for only where it can be (the
// pack lists it, and on the published site the bucket has it: canAsk), and
// without the normals array no other is asked for; a mask frame that did
// not land leaves its reach to the coarser frames (and past them, layer 0).
// When the files land the snow is laid over the flat ground, which waits
// LAND_UNDER below until the snow has been seen to draw (the pipeline
// guard leaves a mesh out of the frame while its shader is built: swapped
// in place, the ground would be gone for those frames).
//
//   holeMaskNode({ THREE, tsl }, holes, origin) → { node (false over a hole), texture }
//   buildGround(layer, terrain, { world, pack, tier, renderer } = {}) → Group
//     { update([x, z] in the pack's frame), ready: Promise<the snow | null>, dispose() }
//   patchOrigin([x, z], step) → the patch's corner, snapped to the step (pure)
//   needsPatch(at, have) → whether the player has walked far enough to rebuild (pure)
//   canAsk(url, listed, { dev, remote }) → whether a file may be asked for (pure)
//   maskFrames(masks, origin, tier) → [{ name, tex, corner, extent }] finest first, in the game's frame (pure)

import * as THREE from 'three';
import { LAYERS } from '../../../lib/land/layers.js';
import { holesOf } from '../../../lib/land/holes.js';
import { assetUrl, withFallback } from '../../../lib/assetBase.js';
import { BUDGETS } from '../../../lib/device.js';
import { anisotropyFor } from '../../../lib/three/textures.js';
import { backendOf, loadThree } from '../../../lib/three/light/three.js';
import { guardOf } from '../../../lib/three/pipelineGuard.js';
import { createSnowGround, mapsFor } from '../../../lib/three/ground/snow.js';
import { SNOW, SNOW_FILES, SNOW_KIND } from '../../../lib/three/ground/snowMaps.js';
import { packUrl, tierTexture } from '../../galaxy/shared/level.js';

export const NEAR_STEP = 4; // m between the near grid's vertices (the map is 1 m a pixel)
// (Low is the floor: 8 m, a quarter of the 4 m grid's 0.82 M triangles over
// Hoth's near map, which was most of Low's frame; the soldiers stand on the
// map's own heights, lib/land/layers, whatever the grid between them)
export const nearStep = (tier) => (tier === 'low' ? NEAR_STEP * 2 : NEAR_STEP);
export const FAR_STEP = 32; // m: the world map's grid (4 m a pixel)
export const FAR_DROP = 1.5; // m the far grid sits under the near one
export const PATCH_M = 300; // m a side: the 1 m patch round the player on ultra (150 m each way)
export const PATCH_STEP = 1; // m: the patch's spacing, the heightmap's own
export const PATCH_MOVE = 60; // m the player walks before the patch is built again round them
export const PATCH_UNDER = 0.3; // m the 4 m grid drops under the patch (the patch follows the field's true heights between the grid's)
export const LAND_UNDER = 0.05; // m the flat ground waits under the snow while the snow's shaders are built
export const LAND_QUIET = 12; // updates in a row with nothing building before the flat ground goes
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

// A map's file may be asked for when the pack lists it and it can be there:
// the pack's bytes are the bucket's (git has none), so the published site
// asks only for what the manifest names (assetUrl turns the path into the
// bucket's); a development checkout may hold its own copy (the import's)
// and is asked. A file that is not asked for is no 404 in the console.
export const canAsk = (url, listed, { dev = Boolean(import.meta.env?.DEV), remote = assetUrl } = {}) => Boolean(listed) && (dev || remote(url) !== url);

// the pack's mask frames a tier reads, finest first, in the game's frame
// (level.json's terrain.masks: one array, each frame two of its layers from
// a corner in the pack's frame at its own texel size; low reads none)
export const MASK_ORDER = ['near', 'far'];
export function maskFrames(masks, origin = [0, 0, 0], tier = 'high') {
  if (!masks?.frames || !masks.size || tier === 'low') return [];
  return MASK_ORDER.filter((n) => masks.frames[n]).map((name) => {
    const f = masks.frames[name];
    return { name, layers: f.layers, corner: [f.corner[0] + origin[0], f.corner[1] + origin[2]], extent: [masks.size[0] * f.metresPerPixel, masks.size[1] * f.metresPerPixel] };
  });
}

// (?ground=layers: the layers' weights in their colours, snow.js's LAYER_DEBUG)
const debugView = () => {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.hash.split('?')[1] ?? window.location.search);
  return q.get('ground') === 'layers' ? 'layers' : null;
};

// a fragment kept where the ground is (false over a hole): the holes' grid as an 8-bit mask, sampled by the world's x, z
export function holeMaskNode({ THREE, tsl }, holes, origin = [0, 0, 0]) {
  const { texture, positionWorld, vec2 } = tsl;
  const tex = new THREE.DataTexture(holes.bits, holes.w, holes.h, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  const m = holes.metresPerPixel;
  // (sample i covers i ± half a pixel: the mask's corner half a pixel before the first)
  const corner = vec2(origin[0] + holes.min[0] - m / 2, origin[2] + holes.min[1] - m / 2);
  const uv = positionWorld.xz.sub(corner).div(vec2(holes.w * m, holes.h * m));
  const inside = uv.x.greaterThanEqual(0).and(uv.x.lessThan(1)).and(uv.y.greaterThanEqual(0)).and(uv.y.lessThan(1));
  return { node: inside.not().or(texture(tex, uv).r.lessThan(0.5)), texture: tex };
}

export function buildGround(layer, terrain = {}, { world = 'hoth', pack = null, tier = 'high', renderer = null } = {}) {
  let flat = new THREE.MeshStandardMaterial({ color: SNOW_COLOUR, roughness: 1 - SNOW.smoothness, metalness: 0 });
  const holes = holesOf(terrain);
  let mask = null; // the hole mask's node, once the node build is in
  const out = new THREE.Group();
  out.name = 'ground';
  const snow = Boolean(renderer) && backendOf(renderer) !== 'webgl' && mapsFor(tier).length > 0;
  const patched = snow && tier === 'ultra';
  const pieces = {}; // near, far, patch → { flat: Mesh | null, snow: Mesh | null }
  let patchAt = null;
  let built = null;
  let landing = null; // { quiet }: the snow laid over the flat ground, counting the quiet updates
  let gone = false;
  const owned = [];

  const piece = (name, geometry) => {
    const mesh = new THREE.Mesh(geometry, flat);
    mesh.name = `ground:${name}`;
    mesh.receiveShadow = true;
    out.add(mesh);
    pieces[name] = { flat: mesh, snow: null };
  };
  const near = terrain.near;
  if (near?.min && near?.size) piece('near', grid(layer, near.min, (near.size[0] - 1) * near.metresPerPixel, nearStep(tier), patched ? PATCH_UNDER : 0));
  const far = terrain.far;
  if (far?.min && far?.size) piece('far', grid(layer, far.min, (far.size[0] - 1) * far.metresPerPixel, FAR_STEP, FAR_DROP + (patched ? PATCH_UNDER : 0)));

  // (the flat ground masked by the holes too: a node material on the node renderer, the classic one has no mask)
  const masked =
    holes && renderer && backendOf(renderer) !== 'webgl'
      ? loadThree()
          .then((three) => {
            if (gone) return null;
            const made = holeMaskNode(three, holes, pack?.origin);
            owned.push(made.texture);
            mask = made.node;
            const was = flat;
            flat = new three.THREE.MeshStandardNodeMaterial({ color: SNOW_COLOUR, roughness: 1 - SNOW.smoothness, metalness: 0 });
            flat.maskNode = mask;
            for (const p of Object.values(pieces)) if (p.flat) p.flat.material = flat;
            was.dispose();
            return mask;
          })
          .catch(() => null)
      : Promise.resolve(null);

  // a piece's snow over its flat mesh (the same geometry), the flat one a little under
  const lay = (name) => {
    const p = pieces[name];
    const material = built?.[name]?.material;
    if (!p || p.snow || !material) return;
    p.snow = new THREE.Mesh((p.flat ?? p.snow).geometry, material);
    p.snow.name = `ground:${name}`;
    p.snow.receiveShadow = true;
    out.add(p.snow);
    if (p.flat) {
      p.flat.name = `ground:${name}:flat`;
      p.flat.position.y = -LAND_UNDER;
    }
  };
  // the flat ground goes once nothing has been building for a moment (the snow is drawn by then)
  const settle = () => {
    const guard = guardOf(renderer);
    landing.quiet = !guard || (guard.pending() === 0 && guard.held() === 0) ? landing.quiet + 1 : 0;
    if (landing.quiet < LAND_QUIET) return;
    for (const p of Object.values(pieces)) {
      if (!p.flat || !p.snow) continue;
      out.remove(p.flat);
      p.flat = null;
    }
    landing = null;
  };

  // the snow's files at the tier's size, through the asset base (the bucket
  // by hash, the site's copy when it has not got one: a 404 is this file's
  // miss, never the bucket down), each told its colour space and the tier's
  // anisotropy; one that fails leaves its terms out, the normals the snow
  const ready = (async () => {
    if (!snow || !pieces.near) return null;
    const urlOf = (path) => packUrl(world, tierTexture(path, tier, pack?.tex ?? {}));
    const slugOf = (path) => path.split('/').pop().replace(/\.ktx2$/, '');
    const asked = mapsFor(tier).filter((slug) => canAsk(urlOf(`tex/${slug}.ktx2`), pack?.tex?.[slug]));
    if (!asked.includes(SNOW_KIND.normals)) return null;
    const maskTex = pack?.terrain?.masks?.tex;
    const frames = maskTex && canAsk(urlOf(maskTex), pack?.tex?.[slugOf(maskTex)]) ? maskFrames(pack.terrain.masks, pack?.origin, tier) : [];
    const three = await loadThree();
    const ktx = await import('../../../lib/three/gltf.js').then((m) => m.ktx2Loader({ renderer }));
    const max = renderer?.getMaxAnisotropy?.() ?? 16;
    const aniso = anisotropyFor(max, (BUDGETS[tier] ?? BUDGETS.high).aniso);
    // (a site may answer a missing file with its page, as the development server does: a miss too)
    const bytes = (u) =>
      fetch(u).then((r) => {
        const page = /text\/html/.test(r.headers?.get?.('content-type') ?? '');
        if (!r.ok || page) throw Object.assign(new Error(`${r.status} ${u}`), { status: r.status, missing: r.status === 404 || page });
        return r.arrayBuffer();
      });
    const load = (path, { srgb = false, wrap = THREE.RepeatWrapping } = {}) =>
      withFallback(bytes)(urlOf(path))
        .then((buf) => new Promise((res, rej) => ktx.parse(buf, res, rej)))
        .then((t) => {
          t.wrapS = t.wrapT = wrap;
          t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          t.anisotropy = aniso;
          t.needsUpdate = true;
          owned.push(t);
          return t;
        })
        .catch(() => null);
    const maps = {};
    let maskTexture = null;
    await Promise.all([
      ...asked.map(async (slug) => (maps[SNOW_FILES[slug].kind] = await load(`tex/${slug}.ktx2`, { srgb: SNOW_FILES[slug].srgb }))),
      frames.length ? load(maskTex, { wrap: THREE.ClampToEdgeWrapping }).then((t) => (maskTexture = t)) : null,
    ]);
    if (gone || !maps.normals) return null;
    const landed = maskTexture ? frames.map((f) => ({ ...f, texture: maskTexture })) : [];
    const debug = debugView();
    built = {
      near: createSnowGround({ maps, masks: landed, tier, three, debug }),
      far: createSnowGround({ maps, masks: landed, tier, three, far: true, debug }),
      patch: patched ? createSnowGround({ maps, masks: landed, tier, three, displace: true, debug }) : null,
    };
    // (the holes cut from the snow as from the flat ground)
    const cut = await masked;
    if (cut) for (const b of Object.values(built)) if (b?.material) b.material.maskNode = cut;
    for (const name of Object.keys(pieces)) lay(name);
    landing = { quiet: 0 };
    return built;
  })().catch((e) => {
    if (import.meta.env?.DEV) console.warn('the snow did not land', e);
    return null;
  });

  // the 1 m patch round the player, built again once they have walked
  // PATCH_MOVE; and the landing's count
  function update(at) {
    if (landing) settle();
    if (!patched || !needsPatch(at, patchAt)) return;
    patchAt = [at[0], at[1]];
    const g = grid(layer, patchOrigin(at), PATCH_M, PATCH_STEP, 0);
    const p = pieces.patch;
    if (!p) {
      piece('patch', g);
      // (the snow is down already: the patch comes in wearing it)
      if (built) {
        lay('patch');
        out.remove(pieces.patch.flat);
        pieces.patch.flat = null;
      }
      return;
    }
    (p.snow ?? p.flat).geometry.dispose();
    for (const m of [p.flat, p.snow]) if (m) m.geometry = g;
  }

  out.update = update;
  out.ready = ready;
  out.dispose = () => {
    gone = true;
    out.traverse((o) => o.geometry?.dispose());
    flat.dispose();
    if (built) for (const b of Object.values(built)) b?.dispose();
    for (const t of owned) t.dispose();
  };
  return out;
}
