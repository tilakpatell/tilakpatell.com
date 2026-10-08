// Dot Matrix, the world, in WebGL: the island from ./rules.js built in code
// (the tiles as columns of ground, the trees, rocks, houses, pipes, signs,
// the dock, Block Drop tower, the snake's pen, the cloud, and the giant Game
// Boy in the square, whose screen runs the real console's demo, and the N64
// beside it), the hero,
// the walkers, the plants and the snake. Everything is grey: it's drawn
// small, then ./dither.js turns brightness into the four shades.
//
// It draws what the component hands it every frame and decides nothing.
// The people in it move by ./life.js: their feet keep to the ground they
// cover, the villagers look round at the hero and wave hello, the walkers
// come round at the ends of their beats, the hero eases into and out of a
// jump and lands with a squash, and the islanders online strike emotes.
//
// createDotMatrix(canvas, { onLost }) returns { render(state, ms), fx(type,
// data), screenOf(x, y, z), setPalette(id), resize(w, h), dispose(), lost,
// info }.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRenderer, disposeTree } from '../../lib/three/renderer';
import { compileSlices, prepareScene } from '../../lib/three/gpuWork';
import { settle } from '../../lib/settle';
import { createGhosts } from '../middleearth/towns/ghosts';
import { device } from '../../lib/device';
import { H as SCREEN_H, W as SCREEN_W } from '../../stages/gb/font';
import { newConsole, renderConsole, stepConsole } from '../../stages/gb/console';
import { createDither, shadeValue } from './dither';
import { sharpen } from '../../lib/three/textures';
import {
  BLOCKS,
  BLOCK_LO,
  CARTRIDGES,
  CLOUD,
  COINS,
  GAMEBOY,
  H,
  MAP,
  CRAFT,
  HERO,
  N64,
  N64_CART,
  PIPES,
  SIGNS,
  TOWER,
  VILLAGERS,
  W,
  WALKERS,
  WALKER_BACK,
  WATER,
  floorAt,
  legend,
  pipeTop,
  plantOut,
  snakeAt,
  walkerAt,
} from './rules';
import { LEG, WALKER_STRIDE, boxEmote, createNotice, createStride, legAngle, stepAt, walkerStride } from './life';
import { sway } from '../../lib/three/gait';

// a grey as it should look (0 black, 1 white), in the linear working space
const grey = (v) => new THREE.Color().setRGB(v, v, v, THREE.SRGBColorSpace);
const lambert = (v, o = {}) => new THREE.MeshLambertMaterial({ color: grey(v), ...o });

// a seeded random, so the island's scatter is the same every visit
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── little pixel textures ──

function pixels(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}
const hex = (v) => {
  const n = Math.round(v * 255);
  return `rgb(${n},${n},${n})`;
};
// a block: a face with a dark rim, a lit top-left and a shaded bottom-right
const blockFace = (face, mark) =>
  pixels(16, (g, s) => {
    g.fillStyle = hex(face);
    g.fillRect(0, 0, s, s);
    g.fillStyle = hex(Math.min(1, face + 0.2));
    g.fillRect(1, 1, s - 2, 1);
    g.fillRect(1, 1, 1, s - 2);
    g.fillStyle = hex(face * 0.6);
    g.fillRect(1, s - 2, s - 2, 1);
    g.fillRect(s - 2, 1, 1, s - 2);
    g.fillStyle = hex(0.08);
    g.strokeStyle = hex(0.08);
    g.fillRect(0, 0, s, 1);
    g.fillRect(0, s - 1, s, 1);
    g.fillRect(0, 0, 1, s);
    g.fillRect(s - 1, 0, 1, s);
    mark?.(g, s);
  });
const QUESTION = ['0111100', '1100110', '0000110', '0001100', '0011000', '0000000', '0011000'];
const glyph = (rows, x0, y0, colour) => (g) => {
  g.fillStyle = colour;
  rows.forEach((r, y) => [...r].forEach((b, x) => b === '1' && g.fillRect(x0 + x, y0 + y, 1, 1)));
};
const bricks = () =>
  pixels(16, (g, s) => {
    g.fillStyle = hex(0.62);
    g.fillRect(0, 0, s, s);
    g.fillStyle = hex(0.22);
    for (let y = 0; y < s; y += 4) {
      g.fillRect(0, y, s, 1);
      const off = (y / 4) % 2 ? 4 : 0;
      for (let x = off; x < s; x += 8) g.fillRect(x, y, 1, 4);
    }
  });
const planks = () =>
  pixels(16, (g, s) => {
    g.fillStyle = hex(0.7);
    g.fillRect(0, 0, s, s);
    g.fillStyle = hex(0.3);
    for (let x = 0; x < s; x += 4) g.fillRect(x, 0, 1, s);
    g.fillRect(2, 3, 1, 1);
    g.fillRect(10, 11, 1, 1);
  });

// ── the ground ──

// what the ground is at a tile, for building (the tower's tiles are grass;
// the sea, the stepping stones and the dock have none of their own)
const groundOf = (ix, iz) => {
  if (ix < 0 || iz < 0 || ix >= W || iz >= H) return null;
  const t = legend(MAP[iz][ix]);
  if (t.ground <= WATER) return null;
  return { kind: t.kind, y: t.ground };
};

function buildTerrain() {
  const pos = [];
  const nor = [];
  const col = [];
  const c = new THREE.Color();
  const quad = (v, n, shade) => {
    c.copy(grey(shade));
    for (const i of [0, 1, 2, 0, 2, 3]) {
      pos.push(...v[i]);
      nor.push(...n);
      col.push(c.r, c.g, c.b);
    }
  };
  const TOP = { grass: 0.64, long: 0.56, path: 0.93, sand: 0.99, tree: 0.64, boulder: 0.64, wall: 0.64, house: 0.64, gameboy: 0.93, n64: 0.93, pipe: 0.64, sign: 0.64, lighthouse: 0.99, mill: 0.64 };
  const SIDE = { sand: 0.82, path: 0.6 };
  const BOTTOM = -1.4;
  for (let iz = 0; iz < H; iz++) {
    for (let ix = 0; ix < W; ix++) {
      const g = groundOf(ix, iz);
      if (!g) continue;
      const y = g.y;
      const check = (ix + iz) % 2 ? 0.05 : 0;
      quad(
        [
          [ix, y, iz],
          [ix, y, iz + 1],
          [ix + 1, y, iz + 1],
          [ix + 1, y, iz],
        ],
        [0, 1, 0],
        (TOP[g.kind] ?? 0.64) - check,
      );
      // the sides that show: wherever the neighbour's ground is lower
      const sides = [
        [1, 0, [1, 0, 0], (lo, hi) => [[ix + 1, lo, iz + 1], [ix + 1, lo, iz], [ix + 1, hi, iz], [ix + 1, hi, iz + 1]]],
        [-1, 0, [-1, 0, 0], (lo, hi) => [[ix, lo, iz], [ix, lo, iz + 1], [ix, hi, iz + 1], [ix, hi, iz]]],
        [0, 1, [0, 0, 1], (lo, hi) => [[ix, lo, iz + 1], [ix + 1, lo, iz + 1], [ix + 1, hi, iz + 1], [ix, hi, iz + 1]]],
        [0, -1, [0, 0, -1], (lo, hi) => [[ix + 1, lo, iz], [ix, lo, iz], [ix, hi, iz], [ix + 1, hi, iz]]],
      ];
      for (const [dx, dz, n, face] of sides) {
        const nb = groundOf(ix + dx, iz + dz);
        const lo = nb ? nb.y : BOTTOM;
        if (lo >= y) continue;
        // in bands a unit high, alternately darker, like the cliffs of a tile map
        for (let b = Math.floor(lo); b < y; b++) {
          const a = Math.max(lo, b);
          const top = Math.min(y, b + 1);
          if (top <= a) continue;
          const shade = (SIDE[g.kind] ?? 0.52) - (((b % 2) + 2) % 2) * 0.06;
          quad(face(a, top), n, shade);
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

// the sea: ripples that come and go, so the dither shimmers, and foam where
// it meets the land
function buildSea() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() } },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vPos = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uCam;
      varying vec3 vPos;
      void main() {
        vec2 p = vPos.xz;
        float a = sin(p.x * 1.1 + uTime * 1.3) * sin(p.y * 0.9 - uTime * 0.9);
        float b = sin((p.x + p.y) * 0.55 - uTime * 0.7);
        float v = 0.44 + 0.07 * a + 0.04 * b;
        // the odd bright crest
        v += 0.3 * smoothstep(0.86, 0.98, sin(p.x * 0.7 + p.y * 1.6 + uTime * 1.1) * sin(p.y * 0.5 - uTime * 0.4 + p.x * 0.2));
        float f = smoothstep(26.0, 72.0, distance(vPos, uCam));
        v = mix(v, 1.0, f);
        gl_FragColor = vec4(vec3(pow(v, 2.2)), 1.0);
      }`,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(320, 320).rotateX(-Math.PI / 2), mat);
  sea.position.set(W / 2, WATER, H / 2);
  // foam: a strip along every edge where land meets the sea
  const strips = [];
  const isLand = (ix, iz) => Boolean(groundOf(ix, iz)) || (MAP[iz]?.[ix] ?? '~') === 'B';
  for (let iz = 0; iz < H; iz++) {
    for (let ix = 0; ix < W; ix++) {
      if (!isLand(ix, iz)) continue;
      const w = 0.28;
      if (!isLand(ix + 1, iz)) strips.push(new THREE.PlaneGeometry(w, 1).rotateX(-Math.PI / 2).translate(ix + 1 + w / 2, 0, iz + 0.5));
      if (!isLand(ix - 1, iz)) strips.push(new THREE.PlaneGeometry(w, 1).rotateX(-Math.PI / 2).translate(ix - w / 2, 0, iz + 0.5));
      if (!isLand(ix, iz + 1)) strips.push(new THREE.PlaneGeometry(1, w).rotateX(-Math.PI / 2).translate(ix + 0.5, 0, iz + 1 + w / 2));
      if (!isLand(ix, iz - 1)) strips.push(new THREE.PlaneGeometry(1, w).rotateX(-Math.PI / 2).translate(ix + 0.5, 0, iz - w / 2));
    }
  }
  const foam = new THREE.Mesh(mergeGeometries(strips), new THREE.MeshBasicMaterial({ color: grey(0.97) }));
  for (const s of strips) s.dispose();
  foam.position.y = WATER + 0.015;
  return { sea, foam, mat };
}

function buildSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        float v = mix(1.0, 0.8, smoothstep(0.05, 0.75, vDir.y));
        gl_FragColor = vec4(vec3(pow(v, 2.2)), 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 24, 12), mat);
  sky.renderOrder = -1;
  return sky;
}

// ── things ──

function buildTrees(rand) {
  const spots = [];
  for (let iz = 0; iz < H; iz++) for (let ix = 0; ix < W; ix++) if (legend(MAP[iz][ix]).kind === 'tree') spots.push([ix + 0.5, legend(MAP[iz][ix]).ground, iz + 0.5]);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 0.9, 6).translate(0, 0.45, 0), lambert(0.22, { flatShading: true }), spots.length);
  const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.66, 0), lambert(0.42, { flatShading: true }), spots.length);
  const cap = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.46, 0), lambert(0.5, { flatShading: true }), spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  spots.forEach(([x, y, z], i) => {
    const k = 0.9 + rand() * 0.25;
    q.setFromEuler(new THREE.Euler(0, rand() * Math.PI, 0));
    m.compose(new THREE.Vector3(x, y, z), q, s.set(1, k, 1));
    trunk.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(x, y + 1.25 * k, z), q, s.set(k, k, k));
    crown.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(x + 0.08, y + 1.8 * k, z - 0.05), q, s.set(k, k, k));
    cap.setMatrixAt(i, m);
  });
  const group = new THREE.Group();
  for (const mesh of [trunk, crown, cap]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

// tufts in the long grass, and the odd flower on the short
function buildGrass(rand) {
  const tufts = [];
  const flowers = [];
  for (let iz = 0; iz < H; iz++) {
    for (let ix = 0; ix < W; ix++) {
      const t = legend(MAP[iz][ix]);
      if (t.kind === 'long') for (let k = 0; k < 4; k++) tufts.push([ix + 0.15 + rand() * 0.7, t.ground, iz + 0.15 + rand() * 0.7]);
      else if (t.kind === 'grass' && rand() < 0.1) flowers.push([ix + 0.2 + rand() * 0.6, t.ground, iz + 0.2 + rand() * 0.6]);
    }
  }
  const blade = new THREE.ConeGeometry(0.09, 0.38, 4).translate(0, 0.19, 0);
  const tuft = new THREE.InstancedMesh(blade, lambert(0.32, { flatShading: true }), tufts.length);
  const bloom = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 0.1).translate(0, 0.08, 0), lambert(1, { emissive: grey(0.4) }), flowers.length);
  const m = new THREE.Matrix4();
  tufts.forEach(([x, y, z], i) => tuft.setMatrixAt(i, m.makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeScale(1, 0.7 + rand() * 0.6, 1))));
  flowers.forEach(([x, y, z], i) => bloom.setMatrixAt(i, m.makeTranslation(x, y, z)));
  tuft.receiveShadow = true;
  const group = new THREE.Group();
  group.add(tuft, bloom);
  return group;
}

function buildRocks(rand) {
  const group = new THREE.Group();
  const rock = lambert(0.58, { flatShading: true });
  const wet = lambert(0.5, { flatShading: true });
  for (let iz = 0; iz < H; iz++) {
    for (let ix = 0; ix < W; ix++) {
      const k = legend(MAP[iz][ix]).kind;
      if (k === 'boulder') {
        const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62, 0), rock);
        b.scale.set(0.95, 0.82, 0.95);
        b.position.set(ix + 0.5, 0.48, iz + 0.5);
        b.rotation.y = rand() * 3;
        b.castShadow = b.receiveShadow = true;
        group.add(b);
      } else if (k === 'stone') {
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.52, 1.1, 7), wet);
        s.position.set(ix + 0.5, 0.3 - 0.55, iz + 0.5);
        s.rotation.y = rand() * 3;
        s.castShadow = s.receiveShadow = true;
        group.add(s);
      }
    }
  }
  return group;
}

function buildWalls(tex) {
  const spots = [];
  for (let iz = 0; iz < H; iz++) for (let ix = 0; ix < W; ix++) if (MAP[iz][ix] === '#') spots.push([ix + 0.5, iz + 0.5]);
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1.6, 1).translate(0, 0.8, 0), new THREE.MeshLambertMaterial({ map: tex }), spots.length);
  const m = new THREE.Matrix4();
  spots.forEach(([x, z], i) => mesh.setMatrixAt(i, m.makeTranslation(x, 0, z)));
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

// the houses: white walls, a flat dark roof you can stand on, a door and windows
function buildHouses() {
  const group = new THREE.Group();
  const seen = new Set();
  const wall = lambert(1, { emissive: grey(0.32) });
  const roof = lambert(0.24);
  const dark = lambert(0.1);
  for (let iz = 0; iz < H; iz++) {
    for (let ix = 0; ix < W; ix++) {
      if (MAP[iz][ix] !== 'H' || seen.has(`${ix},${iz}`)) continue;
      let x1 = ix;
      while (MAP[iz][x1 + 1] === 'H') x1++;
      let z1 = iz;
      while (MAP[z1 + 1]?.[ix] === 'H') z1++;
      for (let z = iz; z <= z1; z++) for (let x = ix; x <= x1; x++) seen.add(`${x},${z}`);
      const w = x1 - ix + 1;
      const d = z1 - iz + 1;
      const h = new THREE.Group();
      h.position.set(ix + w / 2, 0, iz + d / 2);
      const body = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, 1.8, d - 0.06).translate(0, 0.9, 0), wall);
      const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.22, d + 0.16).translate(0, 1.89, 0), roof);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.9, 0.06).translate(0, 0.45, d / 2), dark);
      const winA = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.06).translate(-w / 2 + 0.55, 1.15, d / 2), dark);
      const winB = winA.clone();
      winB.position.x = w - 1.1;
      for (const m of [body, top, door, winA, winB]) {
        m.castShadow = m.receiveShadow = true;
        h.add(m);
      }
      group.add(h);
    }
  }
  return group;
}

function buildDock(tex) {
  const group = new THREE.Group();
  const deck = new THREE.MeshLambertMaterial({ map: tex });
  const post = lambert(0.3);
  for (let iz = 0; iz < H; iz++) {
    for (let ix = 0; ix < W; ix++) {
      if (MAP[iz][ix] !== 'B') continue;
      const p = new THREE.Mesh(new THREE.BoxGeometry(1, 0.16, 1).translate(ix + 0.5, -0.08, iz + 0.5), deck);
      p.receiveShadow = true;
      group.add(p);
      if (MAP[iz][ix + 1] !== 'B' || MAP[iz][ix - 1] !== 'B') {
        const x = MAP[iz][ix + 1] !== 'B' ? ix + 0.88 : ix + 0.12;
        const q = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 6).translate(x, -0.35, iz + 0.5), post);
        q.castShadow = true;
        group.add(q);
      }
    }
  }
  return group;
}

// Block Drop tower: a column of blocks per tile, shaded four at a time so it
// reads as pieces that landed
function buildTower(tex) {
  const cubes = [];
  for (const [ix, iz, top] of TOWER) for (let y = 0; y < top; y++) cubes.push([ix + 0.5, y + 0.5, iz + 0.5]);
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ map: tex }), cubes.length);
  const shades = [0.95, 0.62, 0.8, 0.5];
  const m = new THREE.Matrix4();
  cubes.forEach(([x, y, z], i) => {
    mesh.setMatrixAt(i, m.makeTranslation(x, y, z));
    mesh.setColorAt(i, grey(shades[Math.floor(i / 4) % shades.length]));
  });
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

function buildPipe(p) {
  const g = new THREE.Group();
  g.position.set(p.ix + 0.5, p.base, p.iz + 0.5);
  const green = lambert(0.62);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.0, 16).translate(0, 0.5, 0), green);
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.26, 16).translate(0, 1.12, 0), lambert(0.72));
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.38, 16).rotateX(-Math.PI / 2).translate(0, 1.252, 0), new THREE.MeshBasicMaterial({ color: grey(0.05) }));
  for (const m of [body, lip]) {
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  g.add(hole);
  return g;
}

// a plant in a pipe: a stem, two leaves, and a head that's a pair of jaws
function buildPlant() {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.7, 6).translate(0, 0.35, 0), lambert(0.3));
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), lambert(0.36, { flatShading: true }));
  leaf.scale.set(1.2, 0.25, 0.6);
  leaf.position.set(0.18, 0.25, 0);
  const leaf2 = leaf.clone();
  leaf2.position.x = -0.18;
  const head = new THREE.Group();
  head.position.y = 0.86;
  const skin = lambert(0.86);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), skin);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), skin);
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: grey(0.05), side: THREE.DoubleSide }));
  // spots on the top half
  const spot = lambert(0.15);
  for (const [x, y, z] of [
    [0.15, 0.22, 0.12],
    [-0.16, 0.18, 0.16],
    [0.02, 0.29, -0.08],
    [-0.12, 0.2, -0.2],
  ]) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), spot);
    s.position.set(x, y, z);
    top.add(s);
  }
  const upper = new THREE.Group(); // hinged at the back
  upper.position.z = -0.28;
  top.position.z = 0.28;
  upper.add(top);
  const lower = new THREE.Group();
  lower.position.z = -0.28;
  jaw.position.z = 0.28;
  lower.add(jaw);
  head.add(upper, lower, mouth);
  g.add(stem, leaf, leaf2, head);
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return { group: g, head, upper, lower };
}

function buildSign(s) {
  const g = new THREE.Group();
  g.position.set(s.ix + 0.5, 0, s.iz + 0.5);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12).translate(0, 0.4, 0), lambert(0.3));
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.56, 0.1).translate(0, 0.85, 0), lambert(0.9));
  const line = lambert(0.2);
  const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.02).translate(0, 0.95, 0.06), line);
  const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.06, 0.02).translate(-0.08, 0.8, 0.06), line);
  for (const m of [post, board, l1, l2]) {
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

function buildCartridge() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.13), lambert(0.74));
  const label = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.38, 0.02).translate(0, 0.07, 0.075), lambert(0.28));
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.02).translate(0, 0.16, 0.088), lambert(0.92));
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.02).translate(0, -0.22, 0.075), lambert(0.4));
  const grip2 = grip.clone();
  grip2.position.y = -0.06;
  const back = label.clone();
  back.position.z = -0.15;
  for (const m of [shell, label, stripe, grip, grip2, back]) {
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

function buildWalker() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.3, 10).translate(0, 0.2, 0), lambert(0.9));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), lambert(0.2));
  cap.scale.y = 0.78;
  cap.position.y = 0.3;
  const eye = lambert(0.98);
  const pupil = lambert(0.04);
  const eyes = [-0.11, 0.11].map((x) => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.04), eye);
    e.position.set(x, 0.42, 0.3);
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.02), pupil);
    p.position.set(0, -0.02, 0.025);
    e.add(p);
    return e;
  });
  const feet = [-0.12, 0.12].map((x) => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.24).translate(0, 0.04, 0.03), lambert(0.12));
    f.position.x = x;
    return f;
  });
  g.add(body, cap, ...eyes, ...feet);
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return { group: g, feet };
}

// An islander, all boxes, who swings his arms and legs: the hero in his cap,
// or a villager in their own clothes. `look`: cap (a peaked cap, forwards or
// backwards), hat (a brimmed one), bun (hair up), and the shades of body,
// legs and skin; `scale` for a kid.
function buildFigure(look = {}) {
  const { cap = true, back = false, hat = false, bun = false, body: bodyShade = 0.55, legs = 0.16, skin = 0.93, scale = 1 } = look;
  const g = new THREE.Group();
  const part = (w, h, d, v, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambert(v));
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  };
  const limb = (w, h, d, v, x, y) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const m = part(w, h, d, v, 0, -h / 2, 0);
    pivot.add(m);
    return pivot;
  };
  const legL = limb(0.14, 0.32, 0.16, legs, -0.1, 0.32);
  const legR = limb(0.14, 0.32, 0.16, legs, 0.1, 0.32);
  const body = part(0.4, 0.32, 0.28, bodyShade, 0, 0.47, 0);
  const armL = limb(0.1, 0.28, 0.12, bodyShade, -0.26, 0.6);
  const armR = limb(0.1, 0.28, 0.12, bodyShade, 0.26, 0.6);
  const head = new THREE.Group();
  head.position.y = 0.78;
  head.add(part(0.36, 0.3, 0.32, skin, 0, 0, 0));
  if (cap) {
    head.add(part(0.4, 0.11, 0.36, 0.1, 0, 0.17, -0.01)); // the cap
    head.add(part(0.3, 0.04, 0.16, 0.1, 0, 0.13, back ? -0.22 : 0.22)); // its peak
  } else if (hat) {
    head.add(part(0.56, 0.04, 0.52, 0.3, 0, 0.14, 0)); // the brim
    head.add(part(0.3, 0.14, 0.28, 0.3, 0, 0.22, 0)); // the crown
  } else if (bun) {
    head.add(part(0.38, 0.1, 0.34, 0.82, 0, 0.17, -0.01)); // the hair
    head.add(part(0.16, 0.12, 0.16, 0.82, 0, 0.26, -0.08)); // the bun
  } else {
    head.add(part(0.38, 0.08, 0.34, 0.2, 0, 0.17, -0.01)); // hair
  }
  head.add(part(0.05, 0.08, 0.02, 0.04, -0.08, 0.0, 0.165));
  head.add(part(0.05, 0.08, 0.02, 0.04, 0.08, 0.0, 0.165));
  g.add(legL, legR, body, armL, armR, head);
  g.scale.setScalar(scale);
  return { group: g, legL, legR, armL, armR, head, body, scale };
}

// walking: each leg turned so its foot stays where it landed while it's
// down (`st`, a stride from ./life.js), the arms swinging against them, the
// body highest over each foot; standing: everything hanging, breathing
function poseStride(f, st, now = 0) {
  const a = st.swing * st.amount;
  f.legL.rotation.x = legAngle(st.phase, a);
  f.legR.rotation.x = legAngle(st.phase + Math.PI, a);
  const arm = Math.sin(st.phase) * a * 0.9;
  f.armL.rotation.x = arm;
  f.armR.rotation.x = -arm;
  f.armL.rotation.z = 0;
  f.armR.rotation.z = 0;
  f.body.position.y = 0.47 + sway(st.phase, st.amount).bob * 0.03 + (1 - st.amount) * Math.sin(now * 2.2) * 0.008;
}
// an emote (./life.js's boxEmote) over whatever the limbs were doing
function poseEmote(f, e) {
  f.armL.rotation.x = e.armL[0];
  f.armL.rotation.z = e.armL[1];
  f.armR.rotation.x = e.armR[0];
  f.armR.rotation.z = e.armR[1];
  f.legL.rotation.x = e.legL;
  f.legR.rotation.x = e.legR;
  f.head.rotation.y = e.head;
  f.group.position.y += e.lift;
}

// the hero: the lad in the cap, seen through whatever's in front of him
// (the same shapes, drawn dark, only where they're hidden)
function buildHero() {
  const f = buildFigure();
  const xray = new THREE.MeshBasicMaterial({ color: 0x000000, depthFunc: THREE.GreaterDepth, depthWrite: false });
  const solid = [];
  f.group.traverse((o) => o.isMesh && solid.push(o));
  for (const o of solid) {
    const ghost = new THREE.Mesh(o.geometry, xray);
    ghost.renderOrder = 10;
    o.add(ghost);
  }
  return f;
}

// what each villager looks like
const LOOKS = {
  nana: { cap: false, bun: true, body: 0.74, legs: 0.74, skin: 0.9 },
  fisher: { cap: false, hat: true, body: 0.3, legs: 0.36, skin: 0.88 },
  gardener: { cap: true, body: 0.46, legs: 0.3, skin: 0.9 },
  kid: { cap: true, back: true, body: 0.86, legs: 0.22, skin: 0.94, scale: 0.78 },
};

// the lighthouse on the islet: a banded tower, its lamp, and a beam that
// sweeps round over the sea
function buildLighthouse(ix, iz) {
  const g = new THREE.Group();
  g.position.set(ix + 0.5, 0, iz + 0.5);
  const bands = pixels(16, (c, n) => {
    c.fillStyle = hex(0.96);
    c.fillRect(0, 0, n, n);
    c.fillStyle = hex(0.3);
    c.fillRect(0, 4, n, 4);
    c.fillRect(0, 12, n, 4);
  });
  bands.wrapS = bands.wrapT = THREE.RepeatWrapping;
  bands.repeat.set(1, 2);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.44, 3.4, 12).translate(0, 1.7, 0), new THREE.MeshLambertMaterial({ map: bands }));
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.5, 0.14, 12).translate(0, 3.45, 0), lambert(0.25));
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 10).translate(0, 3.77, 0), lambert(1, { emissive: grey(0.6) }));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.45, 10).translate(0, 4.24, 0), lambert(0.2));
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.06).translate(0, 0.25, 0.43), lambert(0.1));
  for (const m of [tower, gallery, lamp, cap, door]) {
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  // the beam: a long cone from the lamp, turning, tilted down a little to
  // play over the water
  const beam = new THREE.Group();
  beam.position.y = 3.8;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.1, 18, 10, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 9), new THREE.MeshBasicMaterial({ color: grey(0.98), transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  cone.rotation.x = 0.1;
  cone.renderOrder = 5;
  beam.add(cone);
  g.add(beam);
  return {
    group: g,
    tick(now) {
      beam.rotation.y = now * 0.7;
    },
  };
}

// the windmill on the plateau: a tapered body, a cap, and four sails
// turning on its south face
function buildWindmill(ix, iz, y) {
  const g = new THREE.Group();
  g.position.set(ix + 0.5, y, iz + 0.5);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.5, 2.4, 8).translate(0, 1.2, 0), lambert(0.78, { flatShading: true }));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.6, 8).translate(0, 2.7, 0), lambert(0.22, { flatShading: true }));
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.06).translate(0, 0.25, 0.49), lambert(0.1));
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6).rotateX(Math.PI / 2).translate(0, 2.2, 0.5), lambert(0.3));
  for (const m of [body, cap, door, axle]) {
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  const sails = new THREE.Group();
  sails.position.set(0, 2.2, 0.72);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8).rotateX(Math.PI / 2), lambert(0.2));
  sails.add(hub);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    const spar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.15, 0.05).translate(0, 0.57, 0), lambert(0.3));
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.85, 0.02).translate(0.17, 0.68, 0), lambert(0.95));
    spar.castShadow = cloth.castShadow = true;
    arm.add(spar, cloth);
    sails.add(arm);
  }
  g.add(sails);
  return {
    group: g,
    tick(now) {
      sails.rotation.z = -now * 0.9;
    },
  };
}

// gulls over the dock: three of them wheeling round, wings beating
function buildGulls(rand) {
  const group = new THREE.Group();
  const white = lambert(0.97);
  const dark = lambert(0.25);
  const wingGeo = new THREE.BoxGeometry(0.5, 0.03, 0.16).translate(-0.25, 0, 0);
  const list = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, 0.4), white);
    const beak = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.1), dark);
    beak.position.set(0, 0, 0.24);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.1), dark);
    tail.position.set(0, 0.02, -0.22);
    const wL = new THREE.Group();
    wL.position.x = -0.06;
    wL.add(new THREE.Mesh(wingGeo, white));
    const wR = new THREE.Group();
    wR.position.x = 0.06;
    wR.rotation.y = Math.PI;
    wR.add(new THREE.Mesh(wingGeo, white));
    g.add(body, beak, tail, wL, wR);
    g.traverse((o) => o.isMesh && (o.castShadow = true));
    g.userData = { cx: 27 + rand() * 4, cz: 35 + rand() * 3, r: 3 + rand() * 3.5, y: 3.2 + rand() * 2.2, speed: 0.45 + rand() * 0.3, phase: rand() * 6.3, wL, wR };
    list.push(g);
    group.add(g);
  }
  return {
    group,
    tick(now) {
      for (const g of list) {
        const { cx, cz, r, y, speed, phase, wL, wR } = g.userData;
        const ang = phase + now * speed;
        g.position.set(cx + Math.cos(ang) * r, y + Math.sin(now * 1.3 + phase) * 0.35, cz + Math.sin(ang) * r);
        g.rotation.y = Math.atan2(-Math.sin(ang), Math.cos(ang));
        g.rotation.z = -0.25; // banked into the turn
        const flap = Math.sin(now * 6 + phase) * 0.55;
        wL.rotation.z = flap;
        wR.rotation.z = flap;
      }
    },
  };
}

// butterflies over the long grass, wandering and fluttering
function buildButterflies(rand) {
  const spots = [];
  for (let iz = 0; iz < H; iz++) for (let ix = 0; ix < W; ix++) if (legend(MAP[iz][ix]).kind === 'long') spots.push([ix + 0.5, iz + 0.5]);
  const group = new THREE.Group();
  const wingGeo = new THREE.PlaneGeometry(0.16, 0.13).rotateX(-Math.PI / 2).translate(-0.08, 0, 0);
  const mat = new THREE.MeshBasicMaterial({ color: grey(0.98), side: THREE.DoubleSide });
  const list = [];
  for (let i = 0; i < 7; i++) {
    const [ox, oz] = spots[Math.floor(rand() * spots.length)];
    const g = new THREE.Group();
    const wL = new THREE.Group();
    wL.add(new THREE.Mesh(wingGeo, mat));
    const wR = new THREE.Group();
    wR.rotation.y = Math.PI;
    wR.add(new THREE.Mesh(wingGeo, mat));
    g.add(wL, wR);
    g.userData = { ox, oz, ax: 1 + rand() * 1.5, az: 1 + rand() * 1.5, fx: 0.25 + rand() * 0.3, fz: 0.2 + rand() * 0.3, phase: rand() * 6.3, wL, wR };
    list.push(g);
    group.add(g);
  }
  return {
    group,
    tick(now) {
      for (const g of list) {
        const { ox, oz, ax, az, fx, fz, phase, wL, wR } = g.userData;
        const x = ox + Math.sin(now * fx + phase) * ax;
        const z = oz + Math.cos(now * fz + phase * 1.7) * az;
        const y = 0.55 + Math.sin(now * 2.6 + phase) * 0.18 + Math.abs(Math.sin(now * 14 + phase)) * 0.05;
        g.rotation.y = Math.atan2(x - g.position.x, z - g.position.z);
        g.position.set(x, y, z);
        const flap = 0.2 + Math.abs(Math.sin(now * 14 + phase)) * 1.1;
        wL.rotation.z = flap;
        wR.rotation.z = -flap;
      }
    },
  };
}

// the giant Game Boy in the square, its screen the console's own demo
function buildGameBoy() {
  const g = new THREE.Group();
  const w = GAMEBOY.x1 - GAMEBOY.x0 - 0.2;
  const h = 6.6;
  const d = 1.3;
  // its shape, face on: a tall slab with the bottom right corner rounded
  const s = new THREE.Shape();
  const r = 1.1;
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2 - r, 0);
  s.quadraticCurveTo(w / 2, 0, w / 2, r);
  s.lineTo(w / 2, h);
  s.lineTo(-w / 2, h);
  s.closePath();
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: d - 0.16, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1, curveSegments: 8 }).translate(0, 0, -d / 2 + 0.08), lambert(0.84));
  g.add(body);
  const front = d / 2 + 0.01;
  const dark = lambert(0.22);
  const darker = lambert(0.1);
  // the bezel round the screen, and the screen
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(w - 0.5, 2.7, 0.06).translate(0, 4.75, front), dark);
  g.add(bezel);
  const canvas = document.createElement('canvas');
  canvas.width = SCREEN_W;
  canvas.height = SCREEN_H;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  sharpen(tex);
  tex.colorSpace = THREE.NoColorSpace;
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  // the console draws in the DMG's own four greens: each pixel goes out as
  // exactly the shade it is, so the dither leaves it alone
  const screenMat = new THREE.ShaderMaterial({
    uniforms: { tScreen: { value: tex }, uShade: { value: [0, 1, 2, 3].map(shadeValue) } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D tScreen;
      uniform float uShade[4];
      varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tScreen, vUv).rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        float v = l > 0.63 ? uShade[3] : l > 0.47 ? uShade[2] : l > 0.25 ? uShade[1] : uShade[0];
        gl_FragColor = vec4(vec3(v), 1.0);
      }`,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.8).translate(-0.05, 4.7, front + 0.04), screenMat);
  g.add(screen);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.04).translate(-w / 2 + 0.45, 5.0, front + 0.04), darker);
  g.add(led);
  // the D-pad, A and B, Start and Select, the speaker's slots
  const pad = new THREE.Group();
  pad.position.set(-0.95, 2.0, front);
  pad.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.2), darker), new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.2), darker));
  g.add(pad);
  const button = new THREE.CylinderGeometry(0.26, 0.26, 0.2, 14).rotateX(Math.PI / 2);
  const b = new THREE.Mesh(button, dark);
  b.position.set(0.55, 1.85, front);
  const a = new THREE.Mesh(button, dark);
  a.position.set(1.2, 2.2, front);
  g.add(a, b);
  for (const x of [-0.42, 0.18]) {
    const pill = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.08), dark);
    pill.position.set(x, 1.0, front);
    pill.rotation.z = 0.45;
    g.add(pill);
  }
  for (let i = 0; i < 6; i++) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.62, 0.05), darker);
    slot.position.set(0.85 + i * 0.17, 0.62, front);
    slot.rotation.z = 0.5;
    g.add(slot);
  }
  g.traverse((o) => o.isMesh && o !== screen && ((o.castShadow = true), (o.receiveShadow = true)));
  g.position.set((GAMEBOY.x0 + GAMEBOY.x1) / 2, 0, (GAMEBOY.z0 + GAMEBOY.z1) / 2);
  const sys = newConsole({ start: 'attract', palette: 'dmg' });
  const idle = { pressed: new Set(), up: false, down: false, left: false, right: false, a: false, b: false, start: false, select: false };
  let acc = 0;
  return {
    group: g,
    tick(dt) {
      stepConsole(sys, Math.min(dt, 0.05), idle, {});
      acc += dt;
      if (acc < 1 / 30) return;
      acc = 0;
      renderConsole(ctx, sys);
      tex.needsUpdate = true;
    },
  };
}

// the giant N64 beside it, lying flat, its cartridge standing up out of the
// top (the tribute's: a castle and a star on the label), and its controller
// on the ground in front, plugged into the first port
function buildN64() {
  const g = new THREE.Group();
  const w = N64.x1 - N64.x0 - 0.1;
  const d = N64.z1 - N64.z0 - 0.1;
  const body = lambert(0.3);
  const deck = lambert(0.36);
  const dark = lambert(0.1);
  const light = lambert(0.58);
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  add(new RoundedBoxGeometry(w, 0.95, d, 3, 0.18), body, 0, 0.475, 0);
  add(new RoundedBoxGeometry(w - 0.2, 0.2, d - 0.2, 2, 0.08), deck, 0, N64.top - 0.1, 0);
  // the seam round the front, the power light, and the four ports
  const front = d / 2;
  add(new THREE.BoxGeometry(w - 0.5, 0.05, 0.04), light, 0, 0.8, front);
  const led = add(new THREE.BoxGeometry(0.16, 0.08, 0.04), new THREE.MeshLambertMaterial({ color: grey(0.2), emissive: grey(0.85) }), 0, 0.62, front + 0.01);
  const port = new RoundedBoxGeometry(0.5, 0.28, 0.06, 2, 0.05);
  for (const x of [-1.35, -0.45, 0.45, 1.35]) add(port, dark, x, 0.36, front);
  // the power and reset sliders either side of the slot
  for (const x of [-1.45, 1.45]) {
    add(new THREE.BoxGeometry(0.56, 0.03, 0.34), dark, x, N64.top, 0.25);
    add(new RoundedBoxGeometry(0.3, 0.1, 0.24, 2, 0.03), light, x - 0.08, N64.top + 0.04, 0.25);
  }
  // the slot, and the cartridge in it
  const cx = (N64_CART.x0 + N64_CART.x1) / 2 - (N64.x0 + N64.x1) / 2;
  const cz = (N64_CART.z0 + N64_CART.z1) / 2 - (N64.z0 + N64.z1) / 2;
  const cw = N64_CART.x1 - N64_CART.x0 - 0.1;
  const ch = N64_CART.top - N64.top;
  add(new THREE.BoxGeometry(cw + 0.2, 0.04, 1.1), dark, cx, N64.top + 0.005, cz);
  add(new RoundedBoxGeometry(cw, ch, 0.85, 2, 0.1), lambert(0.52), cx, N64.top + ch / 2, cz);
  const ridge = new THREE.BoxGeometry(0.08, 0.06, 0.8);
  for (let i = 0; i < 7; i++) add(ridge, lambert(0.42), cx - 0.6 + i * 0.2, N64_CART.top, cz);
  const label = pixels(32, (c, s) => {
    c.fillStyle = hex(0.9);
    c.fillRect(0, 0, s, s);
    c.fillStyle = hex(0.5); // the sky
    c.fillRect(2, 2, s - 4, 20);
    c.fillStyle = hex(0.95); // a star over the castle
    for (const [x, y, ww, hh] of [[15, 3, 2, 6], [12, 5, 8, 2], [13, 7, 6, 1], [13, 8, 2, 2], [17, 8, 2, 2]]) c.fillRect(x, y, ww, hh);
    c.fillStyle = hex(0.12); // the castle: a keep, two towers, a roof
    for (const [x, y, ww, hh] of [[9, 14, 14, 8], [6, 11, 4, 11], [22, 11, 4, 11], [12, 11, 8, 3], [14, 9, 4, 2], [6, 10, 1, 1], [9, 10, 1, 1], [22, 10, 1, 1], [25, 10, 1, 1]]) c.fillRect(x, y, ww, hh);
    c.fillStyle = hex(0.9); // the door
    c.fillRect(15, 18, 2, 4);
    c.fillStyle = hex(0.12); // and a line of type under it
    for (let x = 4; x < 28; x += 3) c.fillRect(x, 25, 2, 2);
    c.fillRect(8, 28, 16, 1);
  });
  add(new THREE.PlaneGeometry(1.2, 0.72), new THREE.MeshLambertMaterial({ map: label }), cx, N64.top + ch / 2 + 0.06, cz + 0.43);
  // the controller, three-pronged, face up on the ground in front
  const pad = new THREE.Group();
  const grip = new THREE.CapsuleGeometry(0.17, 0.42, 4, 10).rotateX(Math.PI / 2).scale(1, 0.55, 1);
  const shell = lambert(0.4);
  const pm = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    pad.add(m);
    return m;
  };
  pm(new RoundedBoxGeometry(1.6, 0.2, 0.6, 2, 0.09), shell, 0, 0.12, 0);
  for (const x of [-0.62, 0, 0.62]) pm(grip, shell, x, 0.1, 0.42);
  pm(new THREE.CylinderGeometry(0.05, 0.06, 0.14, 8), dark, 0, 0.26, 0.12);
  pm(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 12), lambert(0.55), 0, 0.33, 0.12);
  pm(new THREE.BoxGeometry(0.32, 0.05, 0.1), dark, -0.56, 0.23, 0);
  pm(new THREE.BoxGeometry(0.1, 0.05, 0.32), dark, -0.56, 0.23, 0);
  const btn = new THREE.CylinderGeometry(0.075, 0.075, 0.05, 10);
  for (const [x, z] of [[0.5, 0.08], [0.38, -0.06]]) pm(btn, lambert(0.72), x, 0.24, z);
  const cbtn = new THREE.CylinderGeometry(0.045, 0.045, 0.05, 8);
  for (const [x, z] of [[0.62, -0.18], [0.72, -0.08], [0.62, 0.02], [0.52, -0.08]]) pm(cbtn, lambert(0.65), x, 0.24, z - 0.02);
  pm(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 8), dark, 0, 0.24, -0.14);
  const padAt = new THREE.Vector3(-0.55, 0, front + 1.35);
  pad.position.copy(padAt);
  pad.rotation.y = 0.22;
  g.add(pad);
  // its cable, from the top of the pad round to port one
  const out = new THREE.Vector3(0, 0.12, -0.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), pad.rotation.y).add(padAt);
  const cable = new THREE.CatmullRomCurve3([out, new THREE.Vector3(out.x - 0.25, 0.04, out.z - 0.35), new THREE.Vector3(-1.2, 0.04, front + 0.45), new THREE.Vector3(-1.35, 0.18, front + 0.15), new THREE.Vector3(-1.35, 0.36, front + 0.02)]);
  add(new THREE.TubeGeometry(cable, 24, 0.035, 6, false), dark, 0, 0, 0);
  g.traverse((o) => o.isMesh && ((o.castShadow = true), (o.receiveShadow = true)));
  g.position.set((N64.x0 + N64.x1) / 2, 0, (N64.z0 + N64.z1) / 2);
  return {
    group: g,
    tick(now) {
      led.material.emissive.copy(grey(0.6 + 0.25 * Math.sin(now * 2.2)));
    },
  };
}

// the giant crafting table east of it (Minecraft, ../minecraft/): a block
// two across, its faces the pack's own tiles cut from the world's strip,
// the front (the saw and the hammer) to the south and west, where it's
// played from; grey until they come (`userData.ready`: once they have, or not)
function buildCraft() {
  const size = CRAFT.x1 - CRAFT.x0;
  const blank = lambert(0.45);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, CRAFT.top, size), [blank, blank, blank, blank, blank, blank]);
  mesh.position.set((CRAFT.x0 + CRAFT.x1) / 2, CRAFT.top / 2, (CRAFT.z0 + CRAFT.z1) / 2);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const base = `${import.meta.env?.BASE_URL ?? '/'}mc/`;
  mesh.userData.ready = (async () => {
    const manifest = await (await fetch(`${base}manifest.json`)).json();
    const img = new Image();
    img.src = `${base}blocks.webp`;
    await img.decode();
    const tile = (name) => pixels(16, (g) => g.drawImage(img, 0, manifest.blocks.indexOf(name) * 16, 16, 16, 0, 0, 16, 16));
    // a box's faces go +x, −x, +y, −y, +z, −z
    const faces = ['crafting_table_side', 'crafting_table_front', 'crafting_table_top', 'oak_planks', 'crafting_table_front', 'crafting_table_side'];
    mesh.material = faces.map((f) => new THREE.MeshLambertMaterial({ map: tile(f) }));
  })().catch(() => {});
  return mesh;
}

// the cloud over the sea: flat on top, puffed out round the sides
function buildCloud(rand) {
  const g = new THREE.Group();
  const white = lambert(1, { emissive: grey(0.35) });
  const w = CLOUD.x1 - CLOUD.x0 + 1;
  const d = CLOUD.z1 - CLOUD.z0 + 1;
  const cx = CLOUD.x0 + w / 2;
  const cz = CLOUD.z0 + d / 2;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 1, d).translate(cx, CLOUD.lo + 0.5, cz), white);
  slab.receiveShadow = true;
  g.add(slab);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7 + rand() * 0.35, 1), white);
    p.position.set(cx + Math.cos(a) * (w / 2 + 0.1), CLOUD.lo + 0.35 + rand() * 0.2, cz + Math.sin(a) * (d / 2 + 0.1));
    p.scale.y = 0.7;
    g.add(p);
  }
  return g;
}

// clouds far off in the sky, three puffs each, drifting
function buildSkyClouds(rand) {
  const g = new THREE.Group();
  const white = new THREE.MeshBasicMaterial({ color: grey(0.995) });
  const list = [];
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2 + rand() * 1.4, 1), white);
      p.position.set((k - 1) * 2.6, k === 1 ? 0.9 : 0, rand() * 0.5);
      p.scale.y = 0.62;
      c.add(p);
    }
    const a = (i / 7) * Math.PI * 2 + rand() * 0.5;
    const r = 52 + rand() * 18;
    c.userData = { a, r, y: 15 + rand() * 9, speed: 0.004 + rand() * 0.004 };
    list.push(c);
    g.add(c);
  }
  return {
    group: g,
    tick(t) {
      for (const c of list) {
        const { a, r, y, speed } = c.userData;
        const ang = a + t * speed;
        c.position.set(W / 2 + Math.cos(ang) * r, y, H / 2 + Math.sin(ang) * r);
        c.lookAt(W / 2, y, H / 2);
      }
    },
  };
}

// ── the scene ──

export function createDotMatrix(canvas, { onLost } = {}) {
  const tier = device().tier;
  const gl = createRenderer(canvas, { alpha: false, antialias: false, ratio: 1, onLost, guard: true });
  const { renderer } = gl;
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = tier !== 'low';
  renderer.shadowMap.type = THREE.BasicShadowMap;
  renderer.setClearColor(0xffffff, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffffff, 30, 74);
  const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.5, 200);
  const rand = rng(1989);

  // the light: a high sun over the south-west, and a sky's worth of fill
  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  const SUN = new THREE.Vector3(-0.42, 1, 0.5).normalize();
  sun.castShadow = renderer.shadowMap.enabled;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 70 });
  sun.shadow.bias = -0.0015;
  scene.add(sun, sun.target, new THREE.HemisphereLight(0xffffff, 0x9a9a9a, 0.9));

  const target = new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthTexture: new THREE.DepthTexture(2, 2) });
  const dither = createDither(camera);

  // ── the island ──
  const block = blockFace(0.92);
  const brickTex = bricks();
  const plankTex = planks();
  scene.add(buildSky());
  const sea = buildSea();
  scene.add(sea.sea, sea.foam);
  scene.add(buildTerrain());
  scene.add(buildTrees(rand));
  scene.add(buildGrass(rand));
  scene.add(buildRocks(rand));
  scene.add(buildWalls(brickTex));
  scene.add(buildHouses());
  scene.add(buildDock(plankTex));
  scene.add(buildTower(block));
  scene.add(buildCloud(rand));
  const skyClouds = buildSkyClouds(rand);
  scene.add(skyClouds.group);
  for (const p of PIPES) scene.add(buildPipe(p));
  for (const s of SIGNS) scene.add(buildSign(s));
  const gameboy = buildGameBoy();
  scene.add(gameboy.group);
  const n64 = buildN64();
  scene.add(n64.group);
  const craft = buildCraft();
  scene.add(craft);

  // "?" blocks: a fresh face, and a spent one
  const qTex = blockFace(0.96, glyph(QUESTION, 5, 4, hex(0.1)));
  const spentTex = blockFace(0.48, (g) => {
    g.fillStyle = hex(0.15);
    for (const [x, y] of [
      [3, 3],
      [12, 3],
      [3, 12],
      [12, 12],
    ])
      g.fillRect(x, y, 1, 1);
  });
  const qMat = new THREE.MeshLambertMaterial({ map: qTex, emissive: grey(0.25) });
  const spentMat = new THREE.MeshLambertMaterial({ map: spentTex });
  const blocks = new Map();
  for (const b of BLOCKS) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), qMat);
    m.position.set(b.ix + 0.5, BLOCK_LO + 0.5, b.iz + 0.5);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    blocks.set(b.id, { mesh: m, bump: -1 });
  }

  // coins, all in one draw
  const coinGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.08, 14).rotateX(Math.PI / 2);
  const coinMat = lambert(0.5, { emissive: grey(0.12) });
  const coins = new THREE.InstancedMesh(coinGeo, coinMat, COINS.length);
  coins.castShadow = true;
  scene.add(coins);
  // a coin popping out of a block
  const pops = Array.from({ length: 3 }, () => {
    const m = new THREE.Mesh(coinGeo, coinMat);
    m.visible = false;
    scene.add(m);
    return { mesh: m, t: -1 };
  });

  const carts = new Map();
  for (const c of CARTRIDGES) {
    const m = buildCartridge();
    m.position.set(c.at[0], c.at[1] + 0.75, c.at[2]);
    scene.add(m);
    carts.set(c.id, m);
  }

  const walkers = new Map();
  for (const w of WALKERS) {
    const m = buildWalker();
    scene.add(m.group);
    walkers.set(w.id, m);
  }

  const plants = new Map();
  for (const p of PIPES.filter((x) => x.plant)) {
    const m = buildPlant();
    m.group.position.set(p.ix + 0.5, pipeTop(p) - 1.05, p.iz + 0.5);
    scene.add(m.group);
    plants.set(p.id, { ...m, pipe: p });
  }

  const snake = Array.from({ length: snakeAt(0).length }, (_, i) => {
    const head = i === 0;
    const m = new THREE.Mesh(new THREE.BoxGeometry(head ? 0.74 : 0.62, head ? 0.56 : 0.5, head ? 0.74 : 0.62).translate(0, head ? 0.28 : 0.25, 0), lambert(head ? 0.18 : 0.42 + (i % 2) * 0.1));
    m.castShadow = true;
    if (head) {
      for (const x of [-0.18, 0.18]) {
        const e = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.04), lambert(0.98));
        e.position.set(x, 0.38, 0.37);
        m.add(e);
      }
    }
    scene.add(m);
    return m;
  });

  const hero = buildHero();
  hero.group.rotation.order = 'YXZ'; // (a lean is about where he faces)
  scene.add(hero.group);
  const heroStride = createStride({ leg: LEG * 1.15 });
  let ghostSeed = 100;
  const folk = new Map();
  VILLAGERS.forEach((v, i) => {
    const f = buildFigure(LOOKS[v.id]);
    scene.add(f.group);
    // each on a foot of its own, noticing the hero for itself
    folk.set(v.id, { ...f, stride: createStride({ leg: LEG * (f.scale ?? 1), seed: i + 1 }), notice: createNotice() });
  });
  // the other islanders online, as pale ghosts (the towns' ghosts, in this
  // island's figure; their names are the component's, over the canvas)
  const ghosts = createGhosts({
    height: () => 0,
    make: () => {
      const f = buildFigure({ cap: true, body: 0.7, legs: 0.3 });
      return { group: f.group, top: 1.0, fig: f, stride: createStride({ seed: (ghostSeed += 1) }) };
    },
    // their feet by their pace (what they send, else how far they've come
    // since the last frame; an older traveller, by whether they're moving),
    // and an emote they strike, in boxes
    animate: (f, t, p, dt = 0) => {
      const at = f.group.parent?.position;
      let speed = Number.isFinite(p.motion?.speed) ? p.motion.speed : null;
      if (speed == null && at && f.last && dt > 0) speed = Math.min(8, Math.hypot(at.x - f.last.x, at.z - f.last.z) / dt); // (not a jump to a new place)
      if (at) f.last = { x: at.x, z: at.z };
      poseStride(f.fig, f.stride.step(dt, speed ?? (p.moving ? 1.4 : 0)), t);
      const e = p.emote ? boxEmote(p.emote.id, p.emote.t) : null;
      if (e) poseEmote(f.fig, e);
    },
    tag: 0.0001,
    halo: 0.6,
    snap: 6,
  });
  scene.add(ghosts.group);
  const gulls = buildGulls(rand);
  scene.add(gulls.group);
  const landmarks = [];
  for (let iz = 0; iz < H; iz++) {
    for (let ix = 0; ix < W; ix++) {
      const t = legend(MAP[iz][ix]);
      if (t.kind === 'lighthouse') landmarks.push(buildLighthouse(ix, iz));
      else if (t.kind === 'mill') landmarks.push(buildWindmill(ix, iz, t.ground));
    }
  }
  for (const l of landmarks) scene.add(l.group);
  const flutter = buildButterflies(rand);
  scene.add(flutter.group);
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.34, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
  scene.add(blob);

  // bits that fly: dust, sparkles, spray
  const BITS = 96;
  const bitMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), new THREE.MeshBasicMaterial({ color: 0xffffff }), BITS);
  bitMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bitMesh.frustumCulled = false;
  scene.add(bitMesh);
  const bits = Array.from({ length: BITS }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, s: 1, shade: 1 }));
  let nextBit = 0;
  const spray = (x, y, z, n, { speed = 2, up = 3, g = 9, life = 0.6, shade = 1, size = 1 } = {}) => {
    for (let i = 0; i < n; i++) {
      const b = bits[nextBit];
      bitMesh.setColorAt(nextBit, grey(shade));
      nextBit = (nextBit + 1) % BITS;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      Object.assign(b, { life, max: life, x, y, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: up * (0.5 + Math.random() * 0.7), g, s: size * (0.7 + Math.random() * 0.6), shade });
    }
    if (bitMesh.instanceColor) bitMesh.instanceColor.needsUpdate = true;
  };
  // (every bit needs a colour before the first spray, so the buffer exists)
  for (let i = 0; i < BITS; i++) bitMesh.setColorAt(i, grey(1));

  // ── sizes ──
  const size = { w: 1, h: 1, cssW: 1, cssH: 1, px: 3 };
  let coarser = 0; // pixels made bigger after slow frames
  const resize = (cssW, cssH) => {
    size.cssW = Math.max(1, cssW);
    size.cssH = Math.max(1, cssH);
    size.px = Math.max(2, Math.min(7, Math.round(size.cssH / 215) + coarser));
    size.w = Math.max(32, Math.ceil(size.cssW / size.px));
    size.h = Math.max(32, Math.ceil(size.cssH / size.px));
    gl.setSize(size.w, size.h);
    target.setSize(size.w, size.h);
    camera.aspect = size.w / size.h;
    camera.updateProjectionMatrix();
  };

  // slow frames: bigger pixels, a step at a time
  const perf = { acc: 0, n: 0, warm: 40 };
  const watch = (ms) => {
    if (perf.warm-- > 0) return;
    perf.acc += Math.min(ms, 200);
    perf.n += 1;
    if (perf.n < 150) return;
    const avg = perf.acc / perf.n;
    perf.acc = perf.n = 0;
    if (avg > 34 && coarser < 3) {
      coarser += 1;
      if (coarser >= 2 && renderer.shadowMap.enabled) {
        renderer.shadowMap.enabled = false;
        scene.traverse((o) => o.material && [].concat(o.material).forEach((m) => (m.needsUpdate = true)));
      }
      resize(size.cssW, size.cssH);
    }
  };

  // ── per frame ──
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v3 = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const look = new THREE.Vector3();
  const cam = { x: 0, y: 0, z: 0, ready: false };
  let idleT = 0;
  let air = 0; // 0 on the ground, 1 in a jump, eased
  let landT = 9; // seconds since he last came down
  let wasGround = true;
  let knock = 0; // thrown back by a hurt, eased
  let disposed = false;
  let lost = false;
  let warmed = false;
  const fx = { warp: 0, warpDir: 0 };

  // the frame as drawn: the island small into the target, then dithered onto the canvas
  const draw = () => {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    dither.render(renderer, target);
  };
  // `place`: everything put where this frame has it, and nothing drawn (the
  // prepare's layout, behind the veil)
  const render = (state, ms = 16, { place = false } = {}) => {
    if (disposed || gl.lost) return;
    const dt = Math.min(0.05, ms / 1000);
    const { game, yaw = 0, dist = 12.5, pitch = 0.68, travellers = null } = state;
    const t = game.t;
    const h = game.hero;
    const now = performance.now() / 1000;

    // the hero: his feet on the ground he covers, into a jump and out of it
    // eased, a squash as he lands, thrown back when he's hurt
    hero.group.position.set(h.x, h.y, h.z);
    hero.group.rotation.y = h.face;
    const sp = Math.min(1, h.moving / HERO.speed);
    poseStride(hero, heroStride.step(dt, h.moving), now); // (on in the air, under the jump's pose, so he lands mid-stride)
    air += ((h.ground ? 0 : 1) - air) * (1 - Math.exp(-16 * dt));
    if (h.ground && !wasGround) landT = 0;
    wasGround = h.ground;
    landT += dt;
    const mix = (o, key, to) => (o.rotation[key] += (to - o.rotation[key]) * air);
    mix(hero.legL, 'x', 0.6);
    mix(hero.legR, 'x', -0.35);
    mix(hero.armL, 'x', 0.3);
    mix(hero.armR, 'x', -2.6); // a fist in the air
    mix(hero.armR, 'z', -0.15);
    knock += ((game.hurt > HERO.hurt - 0.35 ? 1 : 0) - knock) * (1 - Math.exp(-18 * dt));
    hero.armL.rotation.z += (-1.1 - hero.armL.rotation.z) * knock;
    hero.armR.rotation.z += (1.1 - hero.armR.rotation.z) * knock;
    hero.group.rotation.x = -0.35 * knock;
    // stood still a while, he has a look round; with a villager stopped to
    // talk to him, he looks at them, and waves back at one who waves
    idleT = h.ground && sp < 0.05 ? idleT + dt : 0;
    let lookAt = idleT > 2.5 ? Math.sin((idleT - 2.5) * 1.1) * 0.55 : 0;
    let waved = 0;
    for (const v of VILLAGERS) {
      const near = game.folk[v.id];
      if (near?.stopped) {
        const rel = Math.atan2(near.x - h.x, near.z - h.z) - h.face;
        lookAt = Math.max(-0.9, Math.min(0.9, Math.atan2(Math.sin(rel), Math.cos(rel))));
      }
      waved = Math.max(waved, folk.get(v.id)?.waving ?? 0);
    }
    hero.head.rotation.y += (lookAt - hero.head.rotation.y) * (1 - Math.exp(-5 * dt));
    if (h.ground && sp < 0.05 && waved > 0) {
      hero.armL.rotation.x += (-2.7 - hero.armL.rotation.x) * waved;
      hero.armL.rotation.z = (0.25 + Math.sin(now * 11) * 0.35) * waved;
    }
    // squeezing into a pipe, or out of one; and the squash of a landing
    const squeeze = fx.warp > 0 ? (fx.warpDir < 0 ? fx.warp : 1 - fx.warp) : 1;
    const land = landT < 0.16 ? Math.sin((landT / 0.16) * Math.PI) : 0;
    hero.group.scale.set(1.15 * (1 + land * 0.08), 1.15 * Math.max(0.02, squeeze) * (1 - land * 0.16), 1.15 * (1 + land * 0.08));
    if (fx.warp > 0) fx.warp = Math.max(0, fx.warp - dt / 0.45);
    hero.group.visible = (game.hurt <= 0 || Math.floor(now * 14) % 2 === 0) && game.over <= 0 && squeeze > 0.03;
    const floor = floorAt(h.x, h.z, h.y + 0.05);
    blob.visible = hero.group.visible && floor > WATER;
    blob.position.set(h.x, floor + 0.03, h.z);
    const lift = Math.max(0, h.y - floor);
    blob.scale.setScalar(Math.max(0.35, 1 - lift * 0.18));

    // the camera: round the hero, high up, following smoothly
    const ty = h.y * 0.7 + 0.7;
    if (!cam.ready) Object.assign(cam, { x: h.x, y: ty, z: h.z, ready: true });
    const k = 1 - Math.exp(-6 * dt);
    cam.x += (h.x - cam.x) * k;
    cam.z += (h.z - cam.z) * k;
    cam.y += (ty - cam.y) * (1 - Math.exp(-3 * dt));
    // (a tall, narrow screen stands further back, to see as much across)
    const far = dist * (camera.aspect < 1 ? 1 + (1 - camera.aspect) * 0.65 : 1);
    camera.position.set(cam.x + Math.sin(yaw) * Math.cos(pitch) * far, cam.y + Math.sin(pitch) * far, cam.z + Math.cos(yaw) * Math.cos(pitch) * far);
    look.set(cam.x, cam.y, cam.z);
    camera.lookAt(look);
    sun.position.set(cam.x + SUN.x * 30, cam.y + SUN.y * 30, cam.z + SUN.z * 30);
    sun.target.position.set(cam.x, cam.y, cam.z);
    sea.mat.uniforms.uTime.value = now;
    sea.mat.uniforms.uCam.value.copy(camera.position);
    skyClouds.tick(now);
    gulls.tick(now);
    flutter.tick(now);
    for (const l of landmarks) l.tick(now);
    gameboy.tick(dt);
    n64.tick(now);
    ghosts.update(travellers ?? [], now, dt);
    // (the towns' ghosts are pale blue, lit and see-through; dithered, that
    // vanishes against the sand, so here they're a dark grey and nearly
    // solid, with the rim of light still on their edges and the shimmer)
    ghosts.group.traverse((o) => {
      if (!o.isMesh || !o.material.emissive) return; // (the figure's materials; not the ring of light's)
      if (!o.material.userData.dmg) {
        o.material.userData.dmg = true;
        o.material.color.setRGB(0.22, 0.22, 0.22);
        o.material.emissive.setRGB(0.1, 0.1, 0.1);
        o.material.emissiveIntensity = 1;
      }
      o.material.opacity = Math.min(1, o.material.opacity * 2.3);
    });

    // the villagers, on their beats, or stood facing the hero: their heads
    // turned to him as he comes by, a wave hello the first time he comes
    // up, and a word with their hands while he stands with them
    VILLAGERS.forEach((v, i) => {
      const f = folk.get(v.id);
      const st = game.folk[v.id];
      const moving = !st.stopped && st.wait <= 0;
      f.group.position.set(st.x, 0, st.z);
      f.group.rotation.y = st.face;
      poseStride(f, f.stride.step(dt, moving ? v.speed : 0), now + v.speed * 10);
      const dx = h.x - st.x;
      const dz = h.z - st.z;
      const rel = Math.atan2(dx, dz) - st.face;
      const n = f.notice.step(dt, Math.hypot(dx, dz), Math.atan2(Math.sin(rel), Math.cos(rel)));
      f.head.rotation.y = n.look;
      f.head.rotation.x = st.stopped ? Math.sin(now * 4 + i) * 0.06 : 0;
      f.waving = n.wave;
      if (st.stopped) {
        f.armL.rotation.x = -0.55 - Math.sin(now * 3 + i * 1.7) * 0.25;
        f.armL.rotation.z = -0.15;
      }
      if (n.wave > 0) {
        f.armR.rotation.x += (-2.7 - f.armR.rotation.x) * n.wave;
        f.armR.rotation.z = (-0.25 + n.waving * 0.35) * n.wave;
      }
    });

    // coins spin; the ones taken are gone
    COINS.forEach((c, i) => {
      if (game.coins.has(c.id)) m4.makeScale(0, 0, 0);
      else m4.compose(v3.set(c.x, c.y + Math.sin(now * 2 + i) * 0.06, c.z), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, now * 3 + i * 0.4), one);
      coins.setMatrixAt(i, m4);
    });
    coins.instanceMatrix.needsUpdate = true;
    for (const p of pops) {
      if (p.t < 0) continue;
      p.t += dt;
      const k2 = p.t / 0.6;
      p.mesh.visible = k2 < 1;
      p.mesh.position.y = p.y + Math.sin(Math.min(1, k2) * Math.PI) * 1.4 + 0.2;
      p.mesh.rotation.y = p.t * 16;
      if (k2 >= 1) p.t = -1;
    }

    // cartridges turn and bob
    for (const c of CARTRIDGES) {
      const m = carts.get(c.id);
      m.visible = !game.found.has(c.id);
      if (!m.visible) continue;
      m.rotation.y = now * 1.6;
      m.position.y = c.at[1] + 0.72 + Math.sin(now * 2.2) * 0.1;
    }

    // "?" blocks: spent, and the little jump a bump gives them
    for (const b of BLOCKS) {
      const s = blocks.get(b.id);
      s.mesh.material = game.used.has(b.id) ? spentMat : qMat;
      if (s.bump >= 0) {
        s.bump += dt;
        s.mesh.position.y = BLOCK_LO + 0.5 + Math.sin(Math.min(1, s.bump / 0.22) * Math.PI) * 0.28;
        if (s.bump > 0.22) s.bump = -1;
      }
    }

    // walkers
    for (const w of WALKERS) {
      const m = walkers.get(w.id);
      const flat = game.flat[w.id];
      const p = walkerAt(w, t);
      if (flat != null && t - flat < WALKER_BACK) {
        const since = t - flat;
        m.group.visible = since < 0.9;
        m.group.scale.set(1.25, 0.25, 1.25);
        continue;
      }
      m.group.visible = true;
      const pop = flat != null ? Math.min(1, (t - flat - WALKER_BACK) / 0.3) : 1;
      m.group.scale.set(1, pop, 1);
      // its feet stepped by the ground it covers, coming round at each end
      const ws = walkerStride(w, t);
      m.group.position.set(p.x, p.y + sway(ws.phase, 1).bob * 0.03, p.z);
      m.group.rotation.y = ws.face;
      m.feet.forEach((f, i) => {
        const ph = ws.phase + i * Math.PI;
        f.position.z = stepAt(ph) * (WALKER_STRIDE / 4);
        f.position.y = Math.max(0, Math.cos(ph)) * 0.05;
      });
    }

    // plants: up and down their pipes, jaws snapping, leaning at the hero
    for (const [id, m] of plants) {
      const out = plantOut(game.plants[id]);
      const p = m.pipe;
      m.group.visible = out > 0.02;
      m.group.position.y = pipeTop(p) - 1.05 + out * 1.0;
      const bite = Math.max(0, Math.sin(now * 9 + p.ix)) * 0.5;
      m.upper.rotation.x = -bite;
      m.lower.rotation.x = bite * 0.6;
      const dx = h.x - (p.ix + 0.5);
      const dz = h.z - (p.iz + 0.5);
      const d = Math.hypot(dx, dz);
      m.group.rotation.y = Math.atan2(dx, dz);
      m.head.rotation.x = d < 3 ? 0.35 * out : 0;
    }

    // the snake
    snakeAt(t).forEach((s, i) => {
      snake[i].position.set(s.x, 0, s.z);
      snake[i].rotation.y = s.face;
      snake[i].scale.y = 1 + Math.sin(t * 8 - i * 0.7) * 0.06;
    });

    // flying bits
    for (let i = 0; i < BITS; i++) {
      const b = bits[i];
      if (b.life <= 0) {
        bitMesh.setMatrixAt(i, m4.makeScale(0, 0, 0));
        continue;
      }
      b.life -= dt;
      b.vy -= b.g * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      const s = b.s * Math.max(0, b.life / b.max);
      bitMesh.setMatrixAt(i, m4.compose(v3.set(b.x, b.y, b.z), q.identity(), new THREE.Vector3(s, s, s)));
    }
    bitMesh.instanceMatrix.needsUpdate = true;

    if (place) return;
    draw();
    watch(ms);
  };

  // ── events from the game ──
  const api = {
    get lost() {
      return lost || gl.lost;
    },
    info: size,
    renderer,
    ghosts, // (for the QA scripts)
    render,
    resize,
    setPalette: (id) => dither.setPalette(id),
    set fade(v) {
      dither.fade = v;
    },
    fx(type, data = {}) {
      const at = data.at ?? null;
      if (type === 'bump' && data.block) {
        const s = blocks.get(data.block);
        if (s) s.bump = 0;
      } else if (type === 'block' && data.gives === 'coin') {
        const b = BLOCKS.find((x) => x.id === data.id);
        const p = pops.find((x) => x.t < 0) ?? pops[0];
        Object.assign(p, { t: 0, y: BLOCK_LO + 1 });
        p.mesh.position.set(b.ix + 0.5, BLOCK_LO + 1.2, b.iz + 0.5);
        p.mesh.visible = true;
      } else if (type === 'block' && data.gives === 'heart') {
        const b = BLOCKS.find((x) => x.id === data.id);
        spray(b.ix + 0.5, BLOCK_LO + 1.2, b.iz + 0.5, 14, { speed: 2.2, up: 4, life: 0.8, shade: 0.98 });
      } else if (type === 'coin' && at) spray(at.x, at.y, at.z, 6, { speed: 1.4, up: 2.5, g: 6, life: 0.4, shade: 1, size: 0.7 });
      else if (type === 'cart' && at) spray(at.x, at.y + 0.6, at.z, 26, { speed: 3, up: 5, g: 7, life: 1.1, shade: 1 });
      else if (type === 'stomp' && at) spray(at.x, 0.15, at.z, 10, { speed: 2.6, up: 1.5, g: 8, life: 0.45, shade: 0.55 });
      else if (type === 'land' && at) spray(at.x, at.y + 0.05, at.z, 6, { speed: 1.6, up: 0.8, g: 6, life: 0.3, shade: 0.6, size: 0.8 });
      else if (type === 'splash' && at) spray(at.x, WATER + 0.1, at.z, 18, { speed: 1.8, up: 5, g: 14, life: 0.7, shade: 1 });
      else if (type === 'hurt' && at) spray(at.x, at.y + 0.6, at.z, 8, { speed: 2.4, up: 3, life: 0.5, shade: 0.1 });
      else if (type === 'coinheart' && at) spray(at.x, at.y + 0.9, at.z, 14, { speed: 1.6, up: 3.5, g: 5, life: 0.9, shade: 0.98 });
      else if (type === 'allcoins' && at) spray(at.x, at.y + 0.7, at.z, 40, { speed: 3.4, up: 6, g: 7, life: 1.3, shade: 1 });
      else if (type === 'warp') {
        fx.warp = 1;
        fx.warpDir = data.dir ?? -1;
      }
    },
    // where a point in the world is on the canvas, in CSS pixels
    screenOf(x, y, z) {
      v3.set(x, y, z).project(camera);
      return { x: ((v3.x + 1) / 2) * size.cssW, y: ((1 - v3.y) / 2) * size.cssH, on: v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1 };
    },
    // Everything onto the graphics chip before the first frame, behind the
    // page's loading veil (lib/three/gpuWork's prepareScene): laid out as
    // `state` has it, the crafting table's faces in (a few seconds at most),
    // the dither's shader made for the canvas, then the island's pictures
    // and shaders made for the small target it's drawn into, and drawn once.
    // Stops when alive() turns false; never throws.
    async prepare(state, onProgress, alive = () => true) {
      if (warmed) return;
      warmed = true;
      const going = () => alive() && !disposed && !gl.lost;
      try {
        render(state, 0, { place: true });
        await settle(craft.userData.ready, 4000);
        if (!going()) return;
        renderer.setRenderTarget(null);
        await compileSlices(renderer, [dither.scene], dither.camera, dither.scene, { alive: going });
        if (!going()) return;
        renderer.setRenderTarget(target);
        await prepareScene({ renderer, roots: [scene], scene, camera, alive: going, onProgress, render: draw });
      } catch (err) {
        if (import.meta.env.DEV) console.warn('Dot Matrix: prepare failed', err);
      } finally {
        try {
          renderer.setRenderTarget(null);
        } catch {
          // (gone with its renderer)
        }
      }
    },
    dispose() {
      disposed = true;
      ghosts.dispose();
      disposeTree(scene);
      dither.dispose();
      target.depthTexture?.dispose();
      target.dispose();
      for (const t of [block, brickTex, plankTex, qTex, spentTex]) t.dispose();
      for (const l of landmarks) l.group.traverse((o) => o.material?.map?.dispose?.());
      gl.dispose();
    },
  };
  canvas.addEventListener('webglcontextlost', () => (lost = true));
  return api;
}
