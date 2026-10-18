// Minas Tirith’s shaders: ../../../src/components/middleearth/towns/
// minastirith/propsShaders.js against its twin under nodes/towns/
// minastirith/. Each patch on a standard material on a small scene, built
// the same on both sides: a banner part way through its sway, a street of
// instanced houses painted from a front atlas (a door, a window, wall and a
// shuttered window across, two storeys up) with their windows lit, and
// their pitched roofs laid with slates.
import * as THREE from 'three';
import * as PO from '../../../src/components/middleearth/towns/minastirith/propsShaders.js';
import * as PN from '../../../src/components/middleearth/nodes/towns/minastirith/propsShaders.js';
import { makeCanvas } from '../../../src/lib/paint.js';

const PITCH = { EAVE: 0.4, RIDGE: 1.5 };
const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
const canvasTexture = (c, srgb = true) => {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

// ── the banner ──

const banner =
  (P) =>
  ({ scene, camera }) => {
    const c = makeCanvas(64);
    const g = c.getContext('2d');
    g.fillStyle = '#1a1c22';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#e8e4dc';
    g.fillRect(28, 8, 8, 48);
    g.fillRect(16, 18, 32, 6);
    const U = { uTime: { value: 2.3 } };
    const m = P.swayBanner(M({ map: canvasTexture(c), side: THREE.DoubleSide, roughness: 0.88 }), U);
    const geo = new THREE.PlaneGeometry(2, 4, 8, 24).translate(0, -2, 0);
    const p = geo.getAttribute('position');
    const wave = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) wave.set([-p.getY(i) / 4, p.getX(i) * 0.7, 0.6], i * 3);
    geo.setAttribute('aWave', new THREE.BufferAttribute(wave, 3));
    const flag = new THREE.Mesh(geo, m);
    flag.position.y = 2;
    flag.rotation.y = 0.5;
    scene.add(flag);
    camera.position.set(0, 0, 5.5);
    camera.lookAt(0, 0, 0);
  };

// ── the houses ──

// the front atlas, 4 × 2: door, window, wall, shuttered; and its glass
const atlas = () => {
  const S = 128;
  const c = makeCanvas(S * 4, S * 2);
  const e = makeCanvas(S * 4, S * 2);
  const g = c.getContext('2d');
  const k = e.getContext('2d');
  g.fillStyle = '#d8d4ca';
  g.fillRect(0, 0, S * 4, S * 2);
  k.fillStyle = '#000';
  k.fillRect(0, 0, S * 4, S * 2);
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 4; col++) {
      const x = col * S;
      const y = row * S;
      g.strokeStyle = '#a8a49a';
      g.strokeRect(x + 4, y + 4, S - 8, S - 8);
      if (col === 2) continue;
      const tall = col === 0 && row === 1;
      g.fillStyle = col === 3 ? '#5a4030' : '#2a3038';
      const w = S * 0.4;
      const h = tall ? S * 0.75 : S * 0.5;
      g.fillRect(x + (S - w) / 2, y + S - h - 12, w, h);
      if (col === 1 || col === 0) {
        k.fillStyle = '#fff';
        k.fillRect(x + (S - w) / 2 + 4, y + S - h - 8, w - 8, h - 8);
      }
    }
  // (the GLSL samples with v up, as the canvas texture flips it)
  return { map: canvasTexture(c), glow: canvasTexture(e, false) };
};
// a unit house, its foot at y = 0, and a cornice of fixed size round the
// top (aOff in metres, part 1); walls part 0
const unitHouse = () => {
  const walls = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const cornice = new THREE.BoxGeometry(1, 0.02, 1).translate(0, 1, 0);
  const geo = new THREE.BufferGeometry();
  const pos = [];
  const nor = [];
  const off = [];
  const part = [];
  const idx = [];
  const push = (g, p, o) => {
    const b = pos.length / 3;
    const P = g.getAttribute('position');
    const N = g.getAttribute('normal');
    for (let i = 0; i < P.count; i++) {
      pos.push(P.getX(i), P.getY(i), P.getZ(i));
      nor.push(N.getX(i), N.getY(i), N.getZ(i));
      const ox = Math.sign(P.getX(i)) * 0.15;
      const oz = Math.sign(P.getZ(i)) * 0.15;
      off.push(...(o ? [ox, P.getY(i) > 1 ? 0.3 : 0, oz] : [0, 0, 0]));
      part.push(p);
    }
    for (const i of g.index.array) idx.push(b + i);
  };
  push(walls, 0, false);
  push(cornice, 1, true);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('aOff', new THREE.Float32BufferAttribute(off, 3));
  geo.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  geo.setIndex(idx);
  return geo;
};
const SIZES = [
  [6, 7.5, 5, -6, -4, 0.2],
  [8, 10, 6, 1.5, -6, -0.15],
  [5, 6.8, 5, 8, -3, 0.4],
  [7, 9.4, 6, -2, 4, -0.5],
];
const houses =
  (P) =>
  ({ scene, camera }) => {
    const { map, glow } = atlas();
    const m = P.houseShader(
      M({
        map,
        emissiveMap: glow,
        emissive: new THREE.Color(1.6, 1.1, 0.6),
        emissiveIntensity: 1,
        roughness: 0.9,
      }),
    );
    const geo = unitHouse();
    const seeds = new Float32Array(SIZES.map((_, i) => 0.13 + i * 0.217));
    const kinds = new Float32Array(SIZES.map((_, i) => i % 2));
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    geo.setAttribute('aKind', new THREE.InstancedBufferAttribute(kinds, 1));
    const im = new THREE.InstancedMesh(geo, m, SIZES.length);
    const o = new THREE.Object3D();
    SIZES.forEach(([w, h, d, x, z, turn], i) => {
      o.position.set(x, 0, z);
      o.rotation.y = turn;
      o.scale.set(w, h, d);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    });
    scene.add(im);
    camera.position.set(3, 6, 22);
    camera.lookAt(1, 4, -2);
  };

// ── the roofs ──

// a unit gabled roof: its eaves at y = 0, x from -0.5 to 0.5, z the ridge’s
// length; the slopes’ normals as built, put right by the shader
const unitRoof = () => {
  const P = [];
  const O = [];
  const tri = (a, b, c) => {
    for (const v of [a, b, c]) {
      P.push(v[0], v[1], v[2]);
      O.push(...(v[3] ?? [0, 0, 0]));
    }
  };
  for (const s of [-1, 1]) {
    const e0 = [s * 0.5, 0, -0.5, [s * PITCH.EAVE, 0, -0.2]];
    const e1 = [s * 0.5, 0, 0.5, [s * PITCH.EAVE, 0, 0.2]];
    const r0 = [0, 1, -0.5, [0, PITCH.RIDGE, -0.2]];
    const r1 = [0, 1, 0.5, [0, PITCH.RIDGE, 0.2]];
    if (s > 0) {
      tri(e0, r0, e1);
      tri(e1, r0, r1);
    } else {
      tri(e0, e1, r0);
      tri(e1, r1, r0);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('aOff', new THREE.Float32BufferAttribute(O, 3));
  geo.computeVertexNormals();
  return geo;
};
const slates = () => {
  const S = 128;
  const c = makeCanvas(S);
  const n = makeCanvas(S);
  const g = c.getContext('2d');
  const k = n.getContext('2d');
  g.fillStyle = '#5a6068';
  g.fillRect(0, 0, S, S);
  k.fillStyle = 'rgb(128,128,255)';
  k.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 16)
    for (let x = (y / 16) % 2 ? 8 : 0; x < S; x += 16) {
      g.fillStyle = `rgb(${80 + ((x * 7 + y * 3) % 40)},${88 + ((x * 5) % 30)},${100})`;
      g.fillRect(x + 1, y + 1, 14, 14);
      k.fillStyle = 'rgb(128,90,230)';
      k.fillRect(x, y + 12, 16, 4);
    }
  return { map: canvasTexture(c), nrm: canvasTexture(n, false) };
};
const roofs =
  (P) =>
  ({ scene, camera }) => {
    const { map, nrm } = slates();
    const m = P.roofShader(M({ map, normalMap: nrm, roughness: 0.72 }), PITCH);
    const im = new THREE.InstancedMesh(unitRoof(), m, SIZES.length);
    const o = new THREE.Object3D();
    SIZES.forEach(([w, , d, x, z, turn], i) => {
      o.position.set(x, 0, z);
      o.rotation.y = turn;
      o.scale.set(w, 1, d);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    });
    scene.add(im);
    camera.position.set(2, 9, 16);
    camera.lookAt(1, 0, -1);
  };

const both = (f, ...a) => ({ node: f(PN, ...a), classic: f(PO, ...a) });

export default {
  'middleearth:minastirith:banner': both(banner),
  'middleearth:minastirith:houses': both(houses),
  'middleearth:minastirith:roofs': both(roofs),
};
