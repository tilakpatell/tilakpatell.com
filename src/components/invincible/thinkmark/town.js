// The city of Think, Mark!, drawn: every tower one instance of a box (one
// draw for the whole skyline) whose walls are painted in the shader from
// where they are in the world: glass curtain walls, stone with punched
// windows, brick walk-ups, a shopfront at street level; the windows
// reflect the sky by day and light up, one by one, at night. Round it, the
// streets and the park painted on one texture, the river, water towers and
// air-conditioning on the roofs, spires with their lights, and a lower
// skyline running off into the haze beyond where anyone can fly.

import * as THREE from 'three';
import { hot } from '../../avengers/hq/stage';
import { KIND, boxField, facadeMaterial } from '../../../lib/three/facade';
import { CITY, HALF, RIVER, cellKind, rng } from './city';
import { sharpen } from '../../../lib/three/textures';

// ── the ground: streets, pavements and the park on one texture ──
const GROUND = 820; // metres the painted ground covers
function groundTexture(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const k = size / GROUND;
  const at = (v) => (v + GROUND / 2) * k;
  x.fillStyle = '#34373b';
  x.fillRect(0, 0, size, size);
  const lot = CITY.cell - CITY.street;
  for (let i = 0; i < CITY.cells; i++)
    for (let j = 0; j < CITY.cells; j++) {
      const kind = cellKind(i, j);
      if (kind === 'water') continue;
      const cx = -HALF + (i + 0.5) * CITY.cell;
      const cz = -HALF + (j + 0.5) * CITY.cell;
      // the pavement round the block, then the block
      x.fillStyle = '#8b8a86';
      x.fillRect(at(cx - lot / 2 - 3), at(cz - lot / 2 - 3), (lot + 6) * k, (lot + 6) * k);
      x.fillStyle = kind === 'park' ? '#4d7536' : '#5d5e5c';
      x.fillRect(at(cx - lot / 2), at(cz - lot / 2), lot * k, lot * k);
      if (kind === 'park') {
        x.strokeStyle = '#b8a888';
        x.lineWidth = 3 * k;
        x.beginPath();
        x.moveTo(at(cx - lot / 2), at(cz - lot / 2));
        x.lineTo(at(cx + lot / 2), at(cz + lot / 2));
        x.moveTo(at(cx + lot / 2), at(cz - lot / 2));
        x.lineTo(at(cx - lot / 2), at(cz + lot / 2));
        x.stroke();
        x.beginPath();
        x.arc(at(cx), at(cz), 9 * k, 0, Math.PI * 2);
        x.fillStyle = '#6aa0c0';
        x.fill();
      }
    }
  // the streets' paint: a dashed yellow middle, crossings at the corners
  x.setLineDash([3 * k, 3 * k]);
  x.strokeStyle = '#c9a43a';
  x.lineWidth = Math.max(1, 0.3 * k);
  for (let i = 0; i <= CITY.cells; i++) {
    const v = -HALF + i * CITY.cell;
    x.beginPath();
    x.moveTo(at(v), at(-HALF));
    x.lineTo(at(v), at(RIVER.z0));
    x.moveTo(at(-HALF), at(v));
    x.lineTo(at(HALF), at(v));
    x.stroke();
  }
  x.setLineDash([]);
  x.fillStyle = 'rgba(230,230,225,0.75)';
  for (let i = 0; i <= CITY.cells; i++)
    for (let j = 0; j <= CITY.cells; j++) {
      const vx = -HALF + i * CITY.cell;
      const vz = -HALF + j * CITY.cell;
      if (vz > RIVER.z0) continue;
      for (let s = -6; s <= 6; s += 1.5) {
        x.fillRect(at(vx + s - 0.4), at(vz - CITY.street / 2 - 3), 0.8 * k, 2.4 * k);
        x.fillRect(at(vx - CITY.street / 2 - 3), at(vz + s - 0.4), 2.4 * k, 0.8 * k);
      }
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  sharpen(t);
  return t;
}

// the street lamps' glow, for the night: a dot at each corner and along each street
function lampTexture(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  x.fillStyle = '#000';
  x.fillRect(0, 0, size, size);
  const k = size / GROUND;
  const at = (v) => (v + GROUND / 2) * k;
  for (let i = 0; i <= CITY.cells; i++)
    for (let j = 0; j < CITY.cells; j++) {
      const v = -HALF + i * CITY.cell;
      for (let s = 0; s < CITY.cell; s += 16) {
        const w = -HALF + j * CITY.cell + s;
        if (w > RIVER.z0) continue;
        for (const [px, pz] of [
          [v - CITY.street / 2, w],
          [w, v - CITY.street / 2],
        ]) {
          const g = x.createRadialGradient(at(px), at(pz), 0, at(px), at(pz), 6 * k);
          g.addColorStop(0, 'rgba(255,200,130,0.9)');
          g.addColorStop(1, 'rgba(255,200,130,0)');
          x.fillStyle = g;
          x.fillRect(at(px) - 6 * k, at(pz) - 6 * k, 12 * k, 12 * k);
        }
      }
    }
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildTown(city, { small = false } = {}) {
  const group = new THREE.Group();
  group.name = 'town';
  const uniforms = { uNight: { value: 0 } };
  const facade = facadeMaterial(uniforms);
  const r = rng(91);

  // the towers and their top tiers
  const list = [];
  for (const t of city.towers) {
    const style = { kind: KIND[t.kind], tone: t.tone, seed: (t.id * 0.6180339) % 1 };
    list.push({ x: t.x, z: t.z, w: t.w, d: t.d, h: t.h, ...style });
    if (t.top) list.push({ x: t.x, y: t.h, z: t.z, w: t.top.w, d: t.top.d, h: t.top.h, ...style });
  }
  // and the city beyond, low and far, where nobody flies
  const far = [];
  const n = small ? 260 : 520;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = HALF + 70 + r() ** 0.7 * 900;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (z > RIVER.z0 - 20 && z < RIVER.z0 + 235) continue; // the river, and its far bank
    const h = 12 + r() ** 2.2 * (d < 700 ? 120 : 60);
    far.push({ x, z, w: 18 + r() * 30, d: 18 + r() * 30, h, kind: h > 60 ? 0 : r() < 0.5 ? 1 : 2, tone: r(), seed: r() });
  }
  const towers = boxField([...list, ...far], facade);
  towers.castShadow = true;
  towers.receiveShadow = true;
  towers.name = 'towers';
  group.add(towers);

  // the ground
  const groundMat = new THREE.MeshStandardMaterial({ map: groundTexture(small ? 1024 : 2048), roughness: 0.92, metalness: 0, emissive: 0xffffff, emissiveMap: lampTexture(small ? 512 : 1024), emissiveIntensity: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND, GROUND).rotateX(-Math.PI / 2), groundMat);
  ground.receiveShadow = true;
  group.add(ground);
  const outer = new THREE.Mesh(new THREE.RingGeometry(GROUND * 0.5, 3200, 64, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3f4144, roughness: 0.95 }));
  outer.position.y = -0.05;
  group.add(outer);

  // the river, and its embankment
  const water = new THREE.Mesh(new THREE.PlaneGeometry(5200, 220).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x16303d, roughness: 0.28, metalness: 0, envMapIntensity: 0.6 }));
  water.position.set(0, 0.06, RIVER.z0 + 110);
  water.receiveShadow = true;
  group.add(water);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(5200, 2.4, 3), new THREE.MeshStandardMaterial({ color: 0x77736b, roughness: 0.9 }));
  wall.position.set(0, 0.4, RIVER.z0 - 1.5);
  group.add(wall);

  // on the roofs: water towers, air-conditioning, spires and their lights
  const tanks = [];
  const units = [];
  const spires = [];
  for (const t of city.towers) {
    const top = t.h + (t.top?.h ?? 0);
    const w = t.top?.w ?? t.w;
    const d = t.top?.d ?? t.d;
    if (t.roof === 'tank') tanks.push([t.x + (r() - 0.5) * w * 0.4, top, t.z + (r() - 0.5) * d * 0.4]);
    else if (t.roof === 'spire') spires.push([t.x, top, t.z, Math.min(w, d) * 0.22, 14 + t.h * 0.18]);
    if (t.roof !== 'spire') for (let i = 0, m = 1 + Math.floor(r() * 3); i < m; i++) units.push([t.x + (r() - 0.5) * w * 0.6, top, t.z + (r() - 0.5) * d * 0.6, 2 + r() * 3, 1.4 + r(), 2 + r() * 2]);
  }
  const mtx = new THREE.Matrix4();
  const inst = (geo, mat, rows, place) => {
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, rows.length));
    rows.forEach((row, i) => mesh.setMatrixAt(i, place(row, mtx)));
    mesh.count = rows.length;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
    return mesh;
  };
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a33, roughness: 0.85 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x2c2d30, roughness: 0.6, metalness: 0.6 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9a9da3, roughness: 0.45, metalness: 0.7 });
  inst(new THREE.CylinderGeometry(2.2, 2.2, 4, 14).translate(0, 4.4, 0), wood, tanks, ([x, y, z], m) => m.makeTranslation(x, y, z));
  inst(new THREE.ConeGeometry(2.5, 1.8, 14).translate(0, 7.3, 0), iron, tanks, ([x, y, z], m) => m.makeTranslation(x, y, z));
  inst(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 5).translate(1.4, 1.2, 0), iron, tanks, ([x, y, z], m) => m.makeTranslation(x, y, z));
  inst(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 5).translate(-1.4, 1.2, 0), iron, tanks, ([x, y, z], m) => m.makeTranslation(x, y, z));
  inst(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), metal, units, ([x, y, z, w, h, d], m) => m.makeScale(w, h, d).setPosition(x, y, z));
  inst(new THREE.ConeGeometry(1, 1, 4).translate(0, 0.5, 0), metal, spires, ([x, y, z, rr, h], m) => m.makeScale(rr, h, rr).setPosition(x, y, z));
  const beacons = inst(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial({ color: hot(0xff2a2a, 3), toneMapped: false }), spires, ([x, y, z, , h], m) => m.makeTranslation(x, y + h + 0.6, z));
  beacons.castShadow = false;

  // the park's trees: a crown and a trunk each
  const trees = [];
  for (let i = 0; i < CITY.cells; i++)
    for (let j = 0; j < CITY.cells; j++) {
      if (cellKind(i, j) !== 'park') continue;
      const cx = -HALF + (i + 0.5) * CITY.cell;
      const cz = -HALF + (j + 0.5) * CITY.cell;
      for (let k = 0; k < 42; k++) {
        const x = cx + (r() - 0.5) * 44;
        const z = cz + (r() - 0.5) * 44;
        if (Math.hypot(x - cx, z - cz) < 12) continue;
        trees.push([x, z, 3 + r() * 2.5]);
      }
    }
  inst(new THREE.CylinderGeometry(0.25, 0.35, 1, 6).translate(0, 0.5, 0), wood, trees, ([x, z, s], m) => m.makeScale(1, s * 0.9, 1).setPosition(x, 0, z));
  inst(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0x3f6e2e, roughness: 0.9 }), trees, ([x, z, s], m) => m.makeScale(s, s * 1.1, s).setPosition(x, s * 1.7, z));

  return {
    group,
    uniforms,
    // 0 by day, 1 at night: the windows, the shops and the street lamps
    setNight(k) {
      uniforms.uNight.value = k;
      groundMat.emissiveIntensity = k * 0.9;
    },
    beacons,
  };
}
