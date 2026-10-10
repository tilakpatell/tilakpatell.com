// recolour.js on the node renderer: a kit material in a colour its map
// wasn't painted in, its map read for brightness alone, as the material's
// colour node, with the same names and uniforms (nodes). meanLuma and
// measureMap are recolour.js's, copied: importing them would bring its
// GLSL into a 'nodes' world's closure.
//
//   meanLuma(image, { cut }), measureMap(texture), REF
//   recolour(material, colour, { ref }) → the node material (a classic one comes back as its twin)

import * as THREE from 'three';
import { clamp, dot, materialReference, uniform, vec3 } from 'three/tsl';
import { asNode, keyed } from './hookNodes';

export const REF = 0.25; // (a map's mean until it's measured: a mid leaf green's)
const LUMA = [0.2126, 0.7152, 0.0722];
const SIDE = 32; // (the canvas a map is measured on: its mean needs no more)

const linear = (byte) => {
  const c = byte / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export function meanLuma({ width, height, data }, { cut = 0.3 } = {}) {
  if (!(width > 0 && height > 0) || !data) return null;
  const edge = cut * 255;
  let sum = 0;
  let n = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] <= edge) continue;
    sum += LUMA[0] * linear(data[i]) + LUMA[1] * linear(data[i + 1]) + LUMA[2] * linear(data[i + 2]);
    n++;
  }
  return n ? sum / n : null;
}

export function recolour(material, colour, { ref = REF } = {}) {
  if (!material || material.userData.recolour) return material;
  const uniforms = { uRecolour: uniform(new THREE.Color(colour)), uRecolourRef: uniform(ref) };
  // (with no map to read, the material's own colour does the same)
  material.color?.set(colour);
  // (the map read for its brightness alone, over its mean, in the
  // colour: the material's colour node while it has a map, so three's
  // vertex and instance colours still multiply in after, as color_fragment
  // did after the GLSL's line)
  const m = asNode(material);
  const map = materialReference('map', 'texture');
  const node = uniforms.uRecolour.mul(clamp(dot(map.rgb, vec3(0.2126, 0.7152, 0.0722)).div(uniforms.uRecolourRef), 0, 2));
  const before = m.setupDiffuseColor;
  m.setupDiffuseColor = function (builder) {
    const own = this.colorNode;
    if (this.map) this.colorNode = node;
    const out = before.call(this, builder);
    this.colorNode = own;
    return out;
  };
  keyed(m, 'recolour', uniforms);
  m.userData.recolour = uniforms;
  return m;
}

export function measureMap(texture, { cut = 0.3 } = {}) {
  if (!texture?.isTexture || typeof document === 'undefined') return null;
  const img = texture.source?.data ?? texture.image;
  if (!(img?.width > 0 && img?.height > 0)) return null;
  try {
    const c = document.createElement('canvas');
    c.width = SIDE;
    c.height = SIDE;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, SIDE, SIDE);
    return meanLuma(ctx.getImageData(0, 0, SIDE, SIDE), { cut });
  } catch {
    // (a tainted canvas, a bitmap it couldn't draw: the default mean stands)
    return null;
  }
}
