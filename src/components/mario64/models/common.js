// What the models are made of: physically based materials shared by key,
// smooth primitives, and canvas-painted textures (in the browser only).
// Every model is in metres, its feet at y 0, facing +z.

import * as THREE from 'three';
import { sharpen } from '../../../lib/three/textures';

const cache = new Map();

// a material by its look; the same look is the same material
export function pbr(color, { rough = 0.6, metal = 0, clearcoat = 0, sheen = 0, sheenColor, emissive, emissiveIntensity = 1, transparent = false, opacity = 1, map, side, envMapIntensity = 1 } = {}) {
  const key = JSON.stringify([color, rough, metal, clearcoat, sheen, sheenColor, emissive, emissiveIntensity, transparent, opacity, map?.uuid, side, envMapIntensity]);
  if (cache.has(key)) return cache.get(key);
  const m = new THREE.MeshPhysicalMaterial({
    color,
    roughness: rough,
    metalness: metal,
    clearcoat,
    clearcoatRoughness: 0.25,
    sheen,
    sheenColor: sheenColor ?? color,
    sheenRoughness: 0.6,
    emissive: emissive ?? 0x000000,
    emissiveIntensity,
    transparent,
    opacity,
    map: map ?? null,
    side: side ?? THREE.FrontSide,
    envMapIntensity,
  });
  cache.set(key, m);
  return m;
}

export const COLORS = {
  red: '#d4191c',
  blue: '#1d48d3',
  skin: '#ffc59a',
  white: '#f7f5f0',
  brown: '#5b3216',
  hair: '#2e1a0c',
  gold: '#f2c14e',
  black: '#141414',
};

// (parts too small to matter cast no shadow: a draw saved for each)
export function mesh(geo, mat, { x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0, shadow = Math.max(sx, sy, sz) >= 0.06 } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.rotation.set(rx, ry, rz);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

// shared smooth shapes
const geos = new Map();
const shape = (key, make) => {
  if (!geos.has(key)) geos.set(key, make());
  return geos.get(key);
};
export const sphere = () => shape('sphere', () => new THREE.SphereGeometry(1, 40, 28));
export const capsule = (len = 1) => shape(`capsule${len}`, () => new THREE.CapsuleGeometry(1, len, 10, 24));
export const cylinder = (top = 1, bottom = 1, seg = 32) => shape(`cyl${top},${bottom},${seg}`, () => new THREE.CylinderGeometry(top, bottom, 1, seg, 1));
export const torus = (tube = 0.25, arc = Math.PI * 2) => shape(`torus${tube},${arc}`, () => new THREE.TorusGeometry(1, tube, 16, 48, arc));
export const cone = (seg = 24) => shape(`cone${seg}`, () => new THREE.ConeGeometry(1, 1, seg));
export const box = () => shape('box', () => new THREE.BoxGeometry(1, 1, 1));

// a canvas painted by `paint(g, w, h)`, as a texture (null outside a browser)
const painted = new Map();
export function canvasTexture(key, w, h, paint, { srgb = true, repeat = false } = {}) {
  if (painted.has(key)) return painted.get(key);
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  paint(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  sharpen(t);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  painted.set(key, t);
  return t;
}

// a five-pointed star outline in the xy plane, points up
export function starShape(outer = 1, inner = 0.45) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

export function disposeTree(root) {
  root.traverse((o) => {
    if (o.isMesh && o.userData.own) {
      o.geometry.dispose();
      for (const m of [].concat(o.material)) m.dispose();
    }
  });
}
