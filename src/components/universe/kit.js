// The universe map's shared kit: what the planets (planets.js) and the
// stations (stations.js) are both made with. Small canvas paintings, a
// seeded random, geometries merged into one, things on orbits, models fitted
// to a size, holograms in a ring, and the stations' plated hull.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { sharpen } from '../../lib/three/textures';

// A tiling copy of a texture (the image is shared; the repeat is its own).
export function tiled(t, nx, ny) {
  if (!t) return null;
  const c = t.clone();
  c.wrapS = THREE.RepeatWrapping;
  c.wrapT = THREE.RepeatWrapping;
  c.repeat.set(nx, ny);
  c.needsUpdate = true;
  return c;
}

export function rng(id) {
  let s = [...id].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function paint(draw, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  sharpen(t);
  return t;
}

// Something going round: a tilted plane, turning, with a holder out at `radius`.
export function orbit(parent, { radius, tilt = 0, yaw = 0, speed = 0.2, phase = 0 }) {
  const plane = new THREE.Group();
  plane.rotation.set(tilt, yaw, 0);
  parent.add(plane);
  const pivot = new THREE.Group();
  plane.add(pivot);
  const holder = new THREE.Group();
  holder.position.x = radius;
  pivot.add(holder);
  return { plane, pivot, holder, set: (t) => (pivot.rotation.y = phase + t * speed) };
}

// A model centred on its own middle and scaled so its longest side is `size`.
export function fit(root, size) {
  const box = new THREE.Box3().setFromObject(root);
  const dims = box.getSize(new THREE.Vector3());
  root.position.sub(box.getCenter(new THREE.Vector3()));
  const holder = new THREE.Group();
  holder.add(root);
  holder.scale.setScalar(size / Math.max(dims.x, dims.y, dims.z, 1e-6));
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if ('metalness' in m) m.metalness = 0;
      if ('roughness' in m) m.roughness = Math.max(m.roughness ?? 1, 0.75);
    }
  });
  return holder;
}

// Geometries placed by [geometry, position, rotation, scale], merged into one.
export function parts(list) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const geos = list.map(([geo, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]]) => {
    m.compose(new THREE.Vector3(...pos), q.setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    geo.dispose();
    return g.applyMatrix4(m);
  });
  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  return merged;
}

export const glowMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: opacity < 1, opacity });

// Turn something to face the camera every frame (undo its parents' turns,
// then take the camera's).
export function facing(mesh) {
  const q = new THREE.Quaternion();
  return (t, camera) => {
    if (!camera || !mesh.parent) return;
    mesh.parent.getWorldQuaternion(q);
    mesh.quaternion.copy(q.invert()).multiply(camera.quaternion);
  };
}

export function rounded(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// A small hologram tile, for what a station holds (a project, a company)
function holoTile(title, sub, color, w) {
  const tex = paint(
    (g, w, h) => {
      rounded(g, 6, 6, w - 12, h - 12, 14);
      g.fillStyle = 'rgba(8, 18, 32, 0.78)';
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = color;
      g.stroke();
      g.fillStyle = color;
      g.font = '700 40px ui-sans-serif, system-ui, sans-serif';
      g.textBaseline = 'middle';
      g.fillText(title, 26, sub ? h * 0.38 : h / 2, w - 52);
      if (sub) {
        g.fillStyle = 'rgba(255,255,255,0.75)';
        g.font = '400 24px ui-sans-serif, system-ui, sans-serif';
        g.fillText(sub, 26, h * 0.72, w - 52);
      }
    },
    512,
    144,
  );
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.281), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }));
  mesh.renderOrder = 4;
  return mesh;
}

// Tiles in a slow ring round a station, each turned to face you. They show
// only while you're at the station (or it's picked), fading in and out, so
// the map stays clear from further off.
export function tileRing(p, items, color, { radius, tilt = 0.25, speed = 0.12, bob = 0.04 }) {
  const ring = new THREE.Group();
  ring.rotation.set(tilt, 0, 0);
  ring.visible = false;
  p.group.add(ring);
  let want = 0;
  let shown = 0;
  let last = 0;
  p.focus.push((on) => (want = on ? 1 : 0));
  const tiles = items.map(([title, sub], i) => {
    const tile = holoTile(title, sub, color, radius * 0.44);
    ring.add(tile);
    const face = facing(tile);
    const a0 = (i / items.length) * Math.PI * 2;
    p.tick.push((t, camera) => {
      const a = a0 + t * speed;
      tile.position.set(Math.cos(a) * radius, Math.sin(t * 0.8 + i) * bob, Math.sin(a) * radius);
      face(t, camera);
    });
    return tile;
  });
  p.tick.push((t) => {
    const dt = Math.min(0.1, Math.max(0, t - last));
    last = t;
    shown += (want - shown) * Math.min(1, dt * 5 || (want ? 1 : 0)); // (instantly when the clock is stopped)
    ring.visible = shown > 0.01;
    for (const tile of tiles) tile.material.opacity = shown;
  });
  return tiles;
}

// a station's hull: real metal plates, tinted
export function hull(T, color, { repeat = 2, metal = 0.35, which = 'plates' } = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    map: tiled(T[which], repeat, repeat),
    normalMap: tiled(T[`${which}-normal`], repeat, repeat),
    roughnessMap: tiled(T[`${which}-rough`], repeat, repeat),
    roughness: 1,
    metalness: metal,
  });
}
