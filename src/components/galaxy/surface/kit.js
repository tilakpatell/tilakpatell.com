// What the worlds' own props are built from (props.js and the worlds'
// builders): parts put together as the galaxy's code-built ships are
// (universe/trafficKit.js: a geometry, where it goes, its colour, the
// material it's drawn with), baked into one mesh per material, each part's
// colour in its vertices. A handful of shared materials: painted metal
// with panel lines, bare metal, dressed stone, rock, adobe, planks,
// concrete, cloth, bark, leaves, glass and glow (hot enough to bloom). All
// in metres.
//
// The solid ones wear photo-scanned surfaces (public/cc0/galaxy/, made by
// scripts/galaxy-textures.mjs from Poly Haven's CC0 scans): a detail map
// under the part's own colour (the grain of the plaster, the seams of the
// plates, the joints of the blocks), a normal map, and ambient occlusion,
// roughness and metalness, laid on at their real size (a block a block's
// size, whatever the wall). Till they're loaded (kit.ready) a part wears a
// painted-in-code stand-in.

import * as THREE from 'three';
import { bake, canvasTexture, panelTexture, part, place, rod, between, compose, mirror, ball, upright } from '../../universe/trafficKit';
import { rng } from './noise';
import SCANS from '../../../../public/cc0/galaxy/index.json';

export { part, place, rod, between, compose, mirror, ball, upright };

const { PI } = Math;

// a grey speckled texture: grime on metal, the grain of stone and adobe
function grimeTexture(seed = 7) {
  const r = rng(seed);
  return canvasTexture(256, (c, n) => {
    c.fillStyle = '#e4e4e4';
    c.fillRect(0, 0, n, n);
    for (let i = 0; i < 2600; i++) {
      const v = 150 + r() * 105;
      c.fillStyle = `rgba(${v},${v},${v},${0.18 + r() * 0.3})`;
      const s = 1 + r() * r() * 9;
      c.fillRect(r() * n, r() * n, s, s);
    }
    // streaks, down (rain and dust down a wall)
    for (let i = 0; i < 70; i++) {
      const v = 120 + r() * 70;
      c.fillStyle = `rgba(${v},${v},${v},0.12)`;
      c.fillRect(r() * n, r() * n, 1 + r() * 3, 10 + r() * 60);
    }
  });
}

// The scanned surfaces, each loaded once for the page (every world's kit
// shares them; a new renderer uploads them again by itself): role →
// { map, normalMap, arm } textures, or a promise of them
const scanned = new Map();
const SCAN_BASE = '/cc0/galaxy';
export function loadScan(role) {
  if (!scanned.has(role)) {
    const loader = new THREE.TextureLoader();
    const get = (file, srgb) =>
      loader.loadAsync(`${SCAN_BASE}/${role}/${file}.webp`).then((t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = 8;
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        return t;
      });
    scanned.set(
      role,
      Promise.all([get('color', true), get('normal', false), SCANS[role]?.arm ? get('arm', false) : null])
        .then(([map, normalMap, arm]) => ({ map, normalMap, arm }))
        .catch(() => null),
    );
  }
  return scanned.get(role);
}

// How each solid role wears its scan: how far it repeats (a metre of
// texture is a metre of wall: SCANS' sizes), how rough it is over the
// scan's own roughness, and whether its metalness comes from the scan
// (bare metal) or is the role's own (painted plates, which aren't).
const LOOKS = {
  paint: { roughness: 0.9, metalness: 0.15, normal: 0.9 },
  metal: { roughness: 1, metalness: 0.75, scanMetal: true, normal: 1 },
  stone: { roughness: 1, metalness: 0, normal: 1.1 },
  rock: { roughness: 1, metalness: 0, normal: 1.3 },
  adobe: { roughness: 1, metalness: 0, normal: 0.8 },
  bark: { roughness: 1, metalness: 0, normal: 1.4 },
  wood: { roughness: 1, metalness: 0, normal: 1 },
  concrete: { roughness: 1, metalness: 0, normal: 0.7 },
};
// a role's repeats a metre (the scan's real size; the stand-in's own where
// there's no scan)
export const densityOf = (role, fallback) => (SCANS[role]?.metres ? 1 / SCANS[role].metres : fallback);
// a role's scan's size in metres, and the brightness its detail map is centred on
export const scanOf = (role) => SCANS[role] ?? null;

export function createKit({ seed = 11, scans = true } = {}) {
  const owned = [];
  const own = (x) => {
    owned.push(x);
    return x;
  };
  const r = rng(seed);
  const grime = own(grimeTexture(seed));
  grime.wrapS = grime.wrapT = THREE.RepeatWrapping;
  grime.colorSpace = THREE.SRGBColorSpace;
  const plates = own(panelTexture(r, { min: 10, base: 222, spread: 16, seam: 0.55, detail: 0.35 }));
  plates.wrapS = plates.wrapT = THREE.RepeatWrapping;
  plates.colorSpace = THREE.SRGBColorSpace;
  const std = (o, density, role = null) => {
    const m = own(new THREE.MeshStandardMaterial({ vertexColors: true, ...o }));
    m.userData.density = role ? densityOf(role, density) : density;
    if (role) m.userData.role = role;
    return m;
  };
  const mats = {
    paint: std({ roughness: 0.72, metalness: 0.15, map: plates }, 0.35, 'paint'),
    metal: std({ roughness: 0.42, metalness: 0.55, map: grime }, 0.5, 'metal'),
    stone: std({ roughness: 0.96, map: grime }, 0.18, 'stone'),
    rock: std({ roughness: 0.96, map: grime }, 0.3, 'rock'),
    adobe: std({ roughness: 0.98, map: grime }, 0.12, 'adobe'),
    wood: std({ roughness: 0.9, map: grime }, 0.5, 'wood'),
    concrete: std({ roughness: 0.9, map: grime }, 0.3, 'concrete'),
    cloth: std({ roughness: 1, side: THREE.DoubleSide }, 0.5),
    bark: std({ roughness: 0.95, map: grime }, 0.6, 'bark'),
    leaf: std({ roughness: 0.82, side: THREE.DoubleSide }, 0.5),
    dark: std({ roughness: 0.55, metalness: 0.2 }, 1),
    glass: own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.55 })),
    glow: own(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })),
  };
  for (const m of [mats.glass, mats.glow]) m.userData.density = 1;

  // the scans on every material that wears one: the role's own, and the
  // copies the builders made of them (a clone keeps its role in userData)
  let dead = false;
  const dress = (m, scan) => {
    const look = LOOKS[m.userData.role];
    if (!look || !scan) return;
    m.map = scan.map;
    m.normalMap = scan.normalMap;
    m.normalScale.setScalar(look.normal);
    if (scan.arm) {
      m.aoMap = scan.arm; // (its red)
      m.aoMapIntensity = 0.85;
      m.roughnessMap = scan.arm; // (its green)
      if (look.scanMetal) m.metalnessMap = scan.arm; // (its blue)
    }
    m.roughness = look.roughness;
    m.metalness = look.metalness;
    m.needsUpdate = true;
  };
  const roles = Object.keys(LOOKS).filter((role) => SCANS[role]);
  const ready = scans
    ? Promise.all(roles.map((role) => loadScan(role).then((scan) => [role, scan]))).then((list) => {
        if (dead) return;
        const by = Object.fromEntries(list);
        for (const m of owned) if (m.isMeshStandardMaterial && m.userData.role) dress(m, by[m.userData.role]);
      })
    : Promise.resolve();

  // one geometry of the parts drawn with one material (for instancing)
  const geometry = (parts) => own(bake(parts, mats[parts[0]?.to ?? 'paint']?.userData.density ?? 0.5));

  return {
    mats,
    own,
    rand: r,
    geometry,
    // the scans on (or failed: the stand-ins stay): wait for it before the
    // shaders are made, or they're made twice
    ready,
    // parts → a group of meshes, one per material; shadows cast unless
    // they glow or see through
    build(parts, { shadows = true, name = 'prop' } = {}) {
      const group = new THREE.Group();
      group.name = name;
      const by = {};
      for (const p of parts) (by[p.to ?? 'paint'] ??= []).push(p);
      for (const [to, list] of Object.entries(by)) {
        const mat = mats[to] ?? mats.paint;
        const mesh = new THREE.Mesh(own(bake(list, mat.userData.density ?? 0.5)), mat);
        mesh.name = to;
        mesh.castShadow = shadows && to !== 'glow' && to !== 'glass';
        mesh.receiveShadow = to !== 'glow';
        group.add(mesh);
      }
      return group;
    },
    dispose() {
      dead = true;
      // (the scans are the page's, shared by every world: not freed here)
      for (const o of owned) o.dispose();
      owned.length = 0;
    },
  };
}

// ── Shapes ──

// a lumpy rock, about 1 across, its base flat-ish at y = 0
export function rockGeometry(seed = 1, { sharp = 0.35, detail = 1, flat = 0.55 } = {}) {
  const g = new THREE.IcosahedronGeometry(0.5, detail);
  const r = rng(seed);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const bumps = Array.from({ length: 5 }, () => [new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), (r() - 0.4) * sharp]);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    let k = 1;
    for (const [d, a] of bumps) k += a * Math.max(0, n.dot(d)) ** 3;
    v.multiplyScalar(k);
    v.y = v.y < 0 ? v.y * 0.25 : v.y * flat * 1.6; // sat in the ground, a little squat
    p.setXYZ(i, v.x, v.y + 0.12, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// a cone of cloth (a tent), a dome, a ring
export const dome = (r, h = r, seg = 20) => upright(Array.from({ length: 9 }, (_, i) => [r * Math.cos((i / 8) * (PI / 2)), h * Math.sin((i / 8) * (PI / 2))]), seg);
export const ring = (r, tube, seg = 24) => new THREE.TorusGeometry(r, tube, 8, seg).rotateX(PI / 2);
export const cyl = (r1, r2, h, seg = 16) => new THREE.CylinderGeometry(r2, r1, h, seg).translate(0, h / 2, 0); // (standing on y = 0)
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0); // (standing on y = 0)
