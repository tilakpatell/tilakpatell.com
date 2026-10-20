// A world's ground as data, after Bruno Simon's terrain map (folio-2025's
// Terrain.js; docs/research/2026-10-06-why-theirs-look-expensive.md): the
// world paints its ground once, `paint(x, z, out) → grass`, into a picture
// over the floor (the colour in RGB, how much grass grows there in A) and,
// if asked, a picture of its height. One function reads it back, in the
// shader (`groundColour(xz)`, `groundGrass(xz)`, `groundHeight(xz)`) and in
// JS (`colourAt`, `grassAt`, `heightAt`), so the ground, the grass that
// grows on it and the light it bounces up (lib/three/house) are one colour,
// with no seam between them.
//
//   createGroundMap({ area, size, heightSize, paint, height }) → { texture, heightTexture,
//     uniforms, glsl, colourAt(x, z, out), grassAt(x, z), heightAt(x, z),
//     paint(material), moveTo(area) → { step(ms) → done }, dispose() }
//   paintGround({ area, size, paint }) → RGBA bytes (pure)
//   groundPaintShader(shader) → { vertexShader, fragmentShader, swapped } (pure)
//
// `moveTo` paints a new area of the same size a few rows at a time (`step`,
// till `ms` have gone), then puts it in all at once: its texels, its
// heights and where it lies (the free roam's ground, round you: roam.js).
//
// `area` { x0, z0, w, d } is the part of the world it covers (metres);
// `size` texels a side. `paint` fills `out` with a linear colour (three's
// working space: new THREE.Color(hex)'s r, g, b) and returns the grass, 0
// to 1. The colour is kept as sRGB bytes, so the darks keep their steps,
// and the GPU reads it back as linear.

import * as THREE from 'three';
import { budget } from '../device';

const clamp01 = (v) => (v > 0 ? (v < 1 ? v : 1) : 0); // (NaN goes to 0)
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
// a byte of sRGB back to linear, for the JS reads
const LINEAR = Float32Array.from({ length: 256 }, (_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
});

export function paintGround({ area, size, paint }) {
  const px = new Uint8Array(size * size * 4);
  const out = [0, 0, 0];
  for (let j = 0; j < size; j++) {
    const z = area.z0 + ((j + 0.5) / size) * area.d;
    for (let i = 0; i < size; i++) {
      const x = area.x0 + ((i + 0.5) / size) * area.w;
      out[0] = out[1] = out[2] = 0;
      const grass = paint(x, z, out);
      const k = (j * size + i) * 4;
      px[k] = Math.round(toSrgb(clamp01(out[0])) * 255);
      px[k + 1] = Math.round(toSrgb(clamp01(out[1])) * 255);
      px[k + 2] = Math.round(toSrgb(clamp01(out[2])) * 255);
      px[k + 3] = Math.round(clamp01(grass) * 255);
    }
  }
  return px;
}

export const GROUND_GLSL = /* glsl */ `
uniform sampler2D uGroundMap;
uniform sampler2D uGroundHeight;
uniform vec4 uGroundRect;
vec2 groundUv(vec2 xz) { return clamp((xz - uGroundRect.xy) * uGroundRect.zw, 0.0, 1.0); }
vec3 groundColour(vec2 xz) { return texture2D(uGroundMap, groundUv(xz)).rgb; }
float groundGrass(vec2 xz) { return texture2D(uGroundMap, groundUv(xz)).a; }
float groundHeight(vec2 xz) { return texture2D(uGroundHeight, groundUv(xz)).r; }
`;

// A floor's albedo times the map's colour under each point (a white
// material shows the map as painted; a tiling detail map on it still
// multiplies in), as pure strings.
export function groundPaintShader({ vertexShader, fragmentShader }) {
  if (!fragmentShader.includes('#include <color_fragment>') || !vertexShader.includes('#include <project_vertex>')) return { vertexShader, fragmentShader, swapped: false };
  const vs = vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGroundPaint;').replace('#include <project_vertex>', 'vGroundPaint = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#include <project_vertex>');
  // (declared once, should another hook have brought the map in already)
  const decl = fragmentShader.includes('uniform sampler2D uGroundMap;') ? '' : GROUND_GLSL;
  const fs = fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vGroundPaint;\n${decl}`).replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= groundColour(vGroundPaint.xz);');
  return { vertexShader: vs, fragmentShader: fs, swapped: true };
}

// a picture of floats, read back linearly, in half floats (filterable
// everywhere WebGL 2 is)
function heightPicture(values, size) {
  const half = new Uint16Array(values.length);
  for (let i = 0; i < values.length; i++) half[i] = THREE.DataUtils.toHalfFloat(values[i]);
  const t = new THREE.DataTexture(half, size, size, THREE.RedFormat, THREE.HalfFloatType);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

export function createGroundMap({ area, size = 512, heightSize = size, paint, height = null }) {
  const px = paintGround({ area, size, paint });
  const texture = new THREE.DataTexture(px, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = budget().aniso ?? 1;
  texture.needsUpdate = true;

  // the heights, `heightSize` texels a side over the same area (or one flat
  // texel, where none were asked)
  let heights = null;
  let heightTexture;
  const hs = heightSize;
  if (height) {
    heights = new Float32Array(hs * hs);
    for (let j = 0; j < hs; j++)
      for (let i = 0; i < hs; i++) heights[j * hs + i] = height(area.x0 + ((i + 0.5) / hs) * area.w, area.z0 + ((j + 0.5) / hs) * area.d);
    heightTexture = heightPicture(heights, hs);
  } else heightTexture = heightPicture(new Float32Array(1), 1);

  const uniforms = {
    uGroundMap: { value: texture },
    uGroundHeight: { value: heightTexture },
    uGroundRect: { value: new THREE.Vector4(area.x0, area.z0, 1 / area.w, 1 / area.d) },
  };

  // a point read among the texels of a picture `n` a side, as the GPU
  // reads it: the four about it, weighted by how far across (clamped to the
  // edge)
  const bilerp = (read, x, z, n = size) => {
    const u = Math.min(n - 1, Math.max(0, ((x - area.x0) / area.w) * n - 0.5));
    const v = Math.min(n - 1, Math.max(0, ((z - area.z0) / area.d) * n - 0.5));
    const i = Math.floor(u);
    const j = Math.floor(v);
    const i1 = Math.min(n - 1, i + 1);
    const j1 = Math.min(n - 1, j + 1);
    const fu = u - i;
    const fv = v - j;
    const a = read(j * n + i) * (1 - fu) + read(j * n + i1) * fu;
    const b = read(j1 * n + i) * (1 - fu) + read(j1 * n + i1) * fu;
    return a * (1 - fv) + b * fv;
  };

  return {
    texture,
    heightTexture,
    uniforms,
    glsl: GROUND_GLSL,
    area,
    size,
    // the ground's colour at a point, linear, into a THREE.Color
    colourAt(x, z, out = new THREE.Color()) {
      return out.setRGB(
        bilerp((k) => LINEAR[px[k * 4]], x, z),
        bilerp((k) => LINEAR[px[k * 4 + 1]], x, z),
        bilerp((k) => LINEAR[px[k * 4 + 2]], x, z),
      );
    },
    grassAt: (x, z) => bilerp((k) => px[k * 4 + 3] / 255, x, z),
    heightAt: (x, z) => (heights ? bilerp((k) => heights[k], x, z, hs) : 0),
    // a floor material painted by the map, once
    paint(material) {
      if (!material || material.userData.groundPaint) return material;
      const before = material.onBeforeCompile;
      material.onBeforeCompile = (sh, r) => {
        before?.call(material, sh, r);
        Object.assign(sh.uniforms, uniforms);
        const out = groundPaintShader(sh);
        sh.vertexShader = out.vertexShader;
        sh.fragmentShader = out.fragmentShader;
      };
      const key = material.customProgramCacheKey;
      material.customProgramCacheKey = () => `${key ? key.call(material) : ''}|groundPaint`;
      material.userData.groundPaint = uniforms;
      material.needsUpdate = true;
      return material;
    },
    moveTo(next) {
      const fresh = new Uint8Array(px.length);
      const lifted = heights ? new Float32Array(heights.length) : null;
      const out = [0, 0, 0];
      let row = 0;
      let hrow = 0;
      let done = false;
      return {
        step(ms = Infinity) {
          if (done) return true;
          const t0 = performance.now();
          while (row < size) {
            const z = next.z0 + ((row + 0.5) / size) * next.d;
            for (let i = 0; i < size; i++) {
              const x = next.x0 + ((i + 0.5) / size) * next.w;
              const g = paint(x, z, out);
              const k = (row * size + i) * 4;
              fresh[k] = Math.round(toSrgb(clamp01(out[0])) * 255);
              fresh[k + 1] = Math.round(toSrgb(clamp01(out[1])) * 255);
              fresh[k + 2] = Math.round(toSrgb(clamp01(out[2])) * 255);
              fresh[k + 3] = Math.round(clamp01(g) * 255);
            }
            row++;
            if (performance.now() - t0 >= ms) return false;
          }
          while (lifted && hrow < hs) {
            for (let i = 0; i < hs; i++) lifted[hrow * hs + i] = height(next.x0 + ((i + 0.5) / hs) * next.w, next.z0 + ((hrow + 0.5) / hs) * next.d);
            hrow++;
            if (performance.now() - t0 >= ms) return false;
          }
          // (all of it in at once: the texels, the heights, where it lies)
          px.set(fresh);
          texture.needsUpdate = true;
          if (lifted) {
            heights.set(lifted);
            const half = heightTexture.image.data;
            for (let i = 0; i < lifted.length; i++) half[i] = THREE.DataUtils.toHalfFloat(lifted[i]);
            heightTexture.needsUpdate = true;
          }
          Object.assign(area, next);
          uniforms.uGroundRect.value.set(area.x0, area.z0, 1 / area.w, 1 / area.d);
          done = true;
          return true;
        },
      };
    },
    dispose() {
      texture.dispose();
      heightTexture.dispose();
    },
  };
}
