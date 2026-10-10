// groundmap.js on the node renderer: the world's ground painted once into
// a picture, read back by the same rule in JS and in the shader, the
// shader's read now TSL functions over uniform nodes (groundFns: the
// groundColour, groundGrass and groundHeight GROUND_GLSL declared) and the
// floor's paint a node hook (./hookNodes.js). The painting and the JS reads
// are groundmap.js's, copied: importing them would bring its GLSL into a
// 'nodes' world's closure.
//
//   createGroundMap({ area, size, heightSize, paint, height }) → { texture, heightTexture,
//     uniforms (uGroundMap, uGroundHeight, uGroundRect: nodes), groundColour(xz),
//     groundGrass(xz), groundHeight(xz), groundUv(xz), colourAt, grassAt, heightAt,
//     paint(material) → the node material, dispose() }
//   paintGround({ area, size, paint }) → RGBA bytes (pure)
//   groundFns(uniforms) → { groundUv, groundColour, groundGrass, groundHeight }

import * as THREE from 'three';
import { budget } from '../device';
import { clamp, positionWorld, texture as tslTexture, uniform } from 'three/tsl';
import { asNode, onColor } from './hookNodes';

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

// GROUND_GLSL's functions over a map's uniform nodes: the colour (linear),
// the grass and the height at a world point (x, z), for any node material.
export function groundFns(u) {
  const at = (xz) => clamp(xz.sub(u.uGroundRect.xy).mul(u.uGroundRect.zw), 0, 1);
  return {
    groundUv: at,
    groundColour: (xz) => u.uGroundMap.sample(at(xz)).rgb,
    groundGrass: (xz) => u.uGroundMap.sample(at(xz)).a,
    groundHeight: (xz) => u.uGroundHeight.sample(at(xz)).r,
  };
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
    uGroundMap: tslTexture(texture),
    uGroundHeight: tslTexture(heightTexture),
    uGroundRect: uniform(new THREE.Vector4(area.x0, area.z0, 1 / area.w, 1 / area.d)),
  };
  const fns = groundFns(uniforms);

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
    ...fns,
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
    // a floor material painted by the map, once (diffuseColor times the
    // map's colour under each point, groundPaintShader's line): the node
    // material, which a classic one passed in becomes
    paint(material) {
      if (!material || material.userData.groundPaint) return material;
      const m = asNode(material);
      onColor(m, (d) => d.rgb.mul(fns.groundColour(positionWorld.xz)), 'groundPaint', uniforms);
      m.userData.groundPaint = uniforms;
      return m;
    },
    dispose() {
      texture.dispose();
      heightTexture.dispose();
    },
  };
}
