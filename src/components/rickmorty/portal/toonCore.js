// The show's toon paint without its ink line: the stepped light, a Kenney
// model's materials turned toon, and the leaf greens recoloured. No
// shaders of its own, so a world on three's node renderer can have it:
// ./toon.js (the GLSL ink pass besides) and ./toonNodes.js are both made
// from it, each with its own `toon`.
//
//   gradient() → the light steps (one texture, shared)
//   toonWith(Kind) → toon(color, extra): a toon material of that class
//   toon(color, extra) → a MeshToonMaterial on the steps
//   toonifyWith(toon) → toonify(root, { tint, mix, glow, gradientMap, aniso, dispose })
//   releaf(color, leaf), releafMap(map, leaf)

import * as THREE from 'three';

let steps = null;
export function gradient() {
  if (steps) return steps;
  const d = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]);
  steps = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  steps.minFilter = steps.magFilter = THREE.NearestFilter;
  steps.generateMipmaps = false;
  steps.needsUpdate = true;
  return steps;
}

export const toonWith = (Kind) => (color, extra = {}) => new Kind({ color, gradientMap: gradient(), ...extra });
// (the classic one, which the node renderer takes as it is too: ./toon.js's)
export const toon = toonWith(THREE.MeshToonMaterial);

// A Kenney model's materials, in toon: same colours and palette texture,
// optionally tinted (Cronenberg World's flesh, Gazorpazorp's rock).
// `gradientMap` swaps the light steps (a textured model whose paint carries
// its own shading wants gentler ones), `aniso` sharpens its textures, and
// `dispose` frees the materials it replaces.
export function toonifyWith(toon) {
  return function toonify(root, { tint = null, mix = 0.6, glow = null, gradientMap = null, aniso = 0, dispose = false } = {}) {
    const made = new Map();
    root.traverse((o) => {
      if (!o.isMesh) return;
      const conv = (m) => {
        if (made.has(m)) return made.get(m);
        const c = (m.color ?? new THREE.Color(1, 1, 1)).clone();
        if (tint) c.lerp(new THREE.Color(tint), mix);
        const t = toon(c, { map: m.map ?? null, ...(gradientMap ? { gradientMap } : {}) });
        if (aniso && m.map) m.map.anisotropy = aniso;
        if (dispose) m.dispose();
        if (glow && /light|glass|screen|window/i.test(m.name ?? '')) {
          t.emissive = new THREE.Color(glow);
          t.emissiveIntensity = 1.6;
        }
        made.set(m, t);
        return t;
      };
      o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
      o.castShadow = true;
      o.receiveShadow = true;
    });
    return root;
  };
}

// Kenney's greens run from mint to teal. releaf gives one of them (a
// material's colour) another leaf colour at its own brightness, and
// releafMap the green swatches of a palette texture, so a dimension can
// green, or sicken, its plants.
const LEAF_LUM = 0.75; // a Kenney leaf green's brightness
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// (r, g, b), sRGB in 0…1: one of those greens, by hue?
function leafy(r, g, b) {
  const max = Math.max(r, g, b);
  const chroma = max - Math.min(r, g, b);
  if (chroma < 0.12 || g < r) return false;
  const hue = max === g ? 120 + (60 * (b - r)) / chroma : 240 + (60 * (r - g)) / chroma;
  return hue > 75 && hue < 195;
}
const brightness = (r, g, b) => Math.min(1.25, Math.max(0.45, lum(r, g, b) / LEAF_LUM));

const rgb = { r: 0, g: 0, b: 0 };
const to = { r: 0, g: 0, b: 0 };
export function releaf(color, leaf) {
  color.getRGB(rgb, THREE.SRGBColorSpace);
  if (!leafy(rgb.r, rgb.g, rgb.b)) return color;
  new THREE.Color(leaf).getRGB(to, THREE.SRGBColorSpace);
  const k = brightness(rgb.r, rgb.g, rgb.b);
  return color.setRGB(Math.min(1, to.r * k), Math.min(1, to.g * k), Math.min(1, to.b * k), THREE.SRGBColorSpace);
}

// a new texture (the caller disposes it); the original if it can't be read
export function releafMap(map, leaf) {
  const img = map?.image;
  if (!img?.width) return map;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  const px = x.getImageData(0, 0, c.width, c.height);
  const d = px.data;
  new THREE.Color(leaf).getRGB(to, THREE.SRGBColorSpace);
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255;
    const g = d[i + 1] / 255;
    const b = d[i + 2] / 255;
    if (!leafy(r, g, b)) continue;
    const k = brightness(r, g, b) * 255;
    d[i] = Math.min(255, to.r * k);
    d[i + 1] = Math.min(255, to.g * k);
    d[i + 2] = Math.min(255, to.b * k);
  }
  x.putImageData(px, 0, 0);
  const t = map.clone(); // keeps its flip, colour space, filters and wrap
  t.source = new THREE.Source(c);
  t.needsUpdate = true;
  return t;
}

