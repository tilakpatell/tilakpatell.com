// matcap.js on the node renderer: matcaps made from a world's own light,
// the sphere drawn by the node renderer into a RenderTarget, and the lit
// material turned into a MeshMatcapNodeMaterial with its node hooks (a
// wind's sway) carried over. The same names and arguments.
//
//   matcapKey(surface, lights), bakeMatcap(renderer, surface, lights),
//   matcapFor(material, renderer, lights), disposeMatcaps(renderer)

import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshMatcapNodeMaterial, MeshStandardNodeMaterial, QuadMesh } from 'three/webgpu';
import { texture, uv, vec2 } from 'three/tsl';

const DEG = Math.PI / 180;
const hex = (c) => (c?.isColor ? c.getHexString() : '-');
const n = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '-');

// the sun's height over the horizon, from where it is to where it points
function sunElevation(sun) {
  if (!sun) return 45 * DEG;
  const d = new THREE.Vector3().subVectors(sun.position, sun.target?.position ?? new THREE.Vector3());
  if (d.lengthSq() < 1e-9) return 45 * DEG;
  d.normalize();
  return Math.asin(Math.min(1, Math.max(-1, d.y)));
}

// What a matcap depends on: the light and the surface, never its colour
// (the material's colour multiplies the picture, as the light multiplies
// a surface's colour), so one picture serves every colour of a world.
export function matcapKey({ roughness = 1, metalness = 0, size = 128 } = {}, { sun, hemi, env } = {}) {
  return [n(roughness, 2), n(metalness, 2), size, hex(sun?.color), n(sun?.intensity), n(sunElevation(sun), 2), hex(hemi?.color), hex(hemi?.groundColor), n(hemi?.intensity), env ? env.uuid : '-'].join('|');
}

const caches = new WeakMap();
const cacheOf = (renderer) => {
  let c = caches.get(renderer);
  if (!c) caches.set(renderer, (c = new Map()));
  return c;
};

// The sphere, lit, as the folio's matcaps are: the sun from the upper left
// and in front, at its own height (no lower than 15°, no higher than 75°, or
// the sphere is all lit or all dark), the sky and the world's reflections
// round it.
export function bakeMatcap(renderer, { roughness = 1, metalness = 0, size = 128 } = {}, lights = {}) {
  const key = matcapKey({ roughness, metalness, size }, lights);
  const cache = cacheOf(renderer);
  const hit = cache.get(key);
  if (hit) return hit.texture;
  const target = new THREE.RenderTarget(size, size, { type: THREE.HalfFloatType, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, depthBuffer: true });
  const scene = new THREE.Scene();
  const geometry = new THREE.SphereGeometry(1, 64, 48);
  const material = new MeshStandardNodeMaterial({ color: 0xffffff, roughness, metalness });
  scene.add(new THREE.Mesh(geometry, material));
  if (lights.hemi) scene.add(new THREE.HemisphereLight(lights.hemi.color, lights.hemi.groundColor, lights.hemi.intensity));
  if (lights.sun) {
    const e = Math.min(75 * DEG, Math.max(15 * DEG, sunElevation(lights.sun)));
    const key = new THREE.DirectionalLight(lights.sun.color, lights.sun.intensity);
    key.position.set(-Math.cos(e) * Math.SQRT1_2, Math.sin(e), Math.cos(e) * Math.SQRT1_2);
    scene.add(key);
  }
  if (lights.env) scene.environment = lights.env;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.set(0, 0, 5);
  const kept = renderer.getRenderTarget?.() ?? null;
  // (drawn into a picture of its own, then copied into the one kept turned
  // over: the node renderer samples a render target with v = 0 at its top
  // row, on WebGPU and on WebGL 2 alike (TextureNode's flipY for a render
  // target there), where a matcap is read with v = 0 at the bottom, as the
  // classic renderer's targets and every image are)
  const raw = new THREE.RenderTarget(size, size, { type: THREE.HalfFloatType, depthBuffer: true });
  renderer.setRenderTarget(raw);
  renderer.render(scene, camera);
  const copy = new MeshBasicNodeMaterial({ fog: false });
  copy.colorNode = texture(raw.texture, vec2(uv().x, uv().y.oneMinus()));
  const quad = new QuadMesh(copy);
  renderer.setRenderTarget(target);
  quad.render(renderer);
  renderer.setRenderTarget(kept);
  copy.dispose();
  raw.dispose();
  geometry.dispose();
  material.dispose();
  cache.set(key, target);
  return target.texture;
}

const HOOKED = ['setupPosition', 'setupDiffuseColor', 'setupNormal', 'setupLightingModel', 'setupLighting', 'setupFog', 'setupVariants', 'setupPositionView', 'customProgramCacheKey'];

const LIT = (m) => m && (m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshToonMaterial);
const glows = (m) => m.emissive && m.emissive.getHex() !== 0 && (m.emissiveIntensity ?? 1) > 0;

// A lit material as a matcap one: its colour, picture, vertex colours, relief
// and sidedness kept, and any shader hook it had (a wind's sway) carried
// over. One that isn't lit, or that glows (a matcap has no light of its own),
// comes back as it was.
export function matcapFor(material, renderer, lights) {
  if (!LIT(material) || glows(material)) return material;
  const matcap = bakeMatcap(renderer, { roughness: material.roughness ?? 0.8, metalness: material.metalness ?? 0 }, lights);
  const out = new MeshMatcapNodeMaterial({
    matcap,
    color: material.color.clone(),
    map: material.map ?? null,
    normalMap: material.normalMap ?? null,
    vertexColors: material.vertexColors,
    side: material.side,
    alphaTest: material.alphaTest,
    transparent: material.transparent,
    opacity: material.opacity,
    flatShading: material.flatShading,
    fog: material.fog,
  });
  out.name = material.name;
  out.userData = { ...material.userData, matcapOf: material.uuid };
  // (its node hooks carried over: the methods a hook wrapped on the
  // material itself, and the key that names them; a node material's own
  // setup methods are on its class, so only a hook's are its own)
  for (const k of HOOKED) if (Object.hasOwn(material, k)) out[k] = material[k];
  return out;
}

export function disposeMatcaps(renderer) {
  const c = caches.get(renderer);
  if (!c) return;
  for (const t of c.values()) t.dispose();
  c.clear();
}
