// Minecraft, the block tiles on the graphics chip: public/mc/blocks.webp (a
// 16-wide strip of every tile, built by scripts/mc-atlas.mjs in TEXTURES'
// order) as a texture array, one layer a tile with its own mip chain, so a
// tile magnifies to crisp texels and minifies without its neighbours
// bleeding in at the seams, as a packed atlas would.
//
// The bytes stay as the pack painted them (no colour-space conversion): the
// game multiplies its light into the sRGB texel, and so does the shader.

import * as THREE from 'three';
import { layerCount } from '../pack/atlas.js';

export const MC = `${import.meta.env?.BASE_URL ?? '/'}mc/`;

// an image's pixels, as painted (no premultiplying, no colour management)
export async function pixels(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const bitmap = await createImageBitmap(await res.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(bitmap.width, bitmap.height) : Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height });
  const ctx = canvas.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
  ctx.drawImage(bitmap, 0, 0);
  const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close?.();
  return { width: canvas.width, height: canvas.height, data };
}

// a strip as a texture array; its pixels kept too (the icons are cut from them)
async function loadArray(file, count) {
  const strip = await pixels(`${MC}${file}`);
  const { width, height, data } = strip;
  const layers = height / width;
  if (layers !== count) throw new Error(`${file} has ${layers} tiles, the manifest ${count}`);
  const tex = new THREE.DataArrayTexture(new Uint8Array(data.buffer, data.byteOffset, data.length), width, width, layers);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  tex.userData.strip = strip;
  return tex;
}
export const loadBlockArray = (manifest) => loadArray('blocks.webp', layerCount(manifest));
export const loadItemArray = (manifest) => loadArray('items.webp', manifest.items.length);

// A sprite (the sun, the clouds) as a plain texture, nearest-filtered.
export async function loadSprite(name) {
  const { width, height, data } = await pixels(`${MC}sprites/${name}.webp`);
  const tex = new THREE.DataTexture(new Uint8Array(data.buffer, data.byteOffset, data.length), width, height);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.flipY = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}
