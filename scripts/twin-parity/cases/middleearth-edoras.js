// Edoras’s shaders: ../../../src/components/middleearth/towns/edoras/
// propsShaders.js against its twin, nodes/towns/edoras/propsShaders.js. The
// banners streaming from their poles, built as props.js builds them, and
// the grass bending, on an instanced field and on a lone tuft (no
// instance, so its root is the origin). The town’s wind, as props.js has it.
import * as THREE from 'three';
import * as PO from '../../../src/components/middleearth/towns/edoras/propsShaders.js';
import * as PN from '../../../src/components/middleearth/nodes/towns/edoras/propsShaders.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const WIND = V3(0.32, 0, -0.95).normalize();
const ACROSS = V3()
  .crossVectors(WIND, V3(0, 1, 0))
  .normalize();

// a banner’s cloth: green with a white horse’s bar, its foot cut ragged
const cloth = () => {
  const W = 64;
  const H = 32;
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const bar = Math.abs(y - 16) < 4 && x > 8;
      const torn = y < 3 && x % 7 < 3;
      data.set(bar ? [230, 225, 200, 255] : [30, 90, 40, torn ? 0 : 255], (y * W + x) * 4);
    }
  const t = new THREE.DataTexture(data, W, H);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
};

// props.js’s bannerMesh, for these banners
const bannerMesh = (mat, list) => {
  const pos = [];
  const nor = [];
  const uv = [];
  const wave = [];
  const idx = [];
  const NX = 14;
  const NY = 4;
  for (const b of list) {
    const base = pos.length / 3;
    for (let j = 0; j <= NY; j++)
      for (let i = 0; i <= NX; i++) {
        const k = i / NX;
        pos.push(b.x + WIND.x * k * b.len + ACROSS.x * 0.02, b.y - (j / NY) * b.tall, b.z + WIND.z * k * b.len + ACROSS.z * 0.02);
        nor.push(ACROSS.x, 0, ACROSS.z);
        uv.push(k, 1 - j / NY);
        wave.push(k, b.phase, b.amp, b.len);
      }
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        const a = base + j * (NX + 1) + i;
        const c = a + NX + 1;
        idx.push(a, c, a + 1, a + 1, c, c + 1);
      }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aWave', new THREE.Float32BufferAttribute(wave, 4));
  g.setIndex(idx);
  return new THREE.Mesh(g, mat);
};

const banners =
  (P) =>
  ({ scene, camera }) => {
    const U = { uTime: { value: 5.4 } };
    const mat = P.windBanner(
      new THREE.MeshStandardMaterial({
        map: cloth(),
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        roughness: 0.82,
      }),
      U,
      WIND,
      ACROSS,
    );
    const list = [
      [-2, 3, 0],
      [0.5, 3.4, -1.5],
      [2.5, 2.8, 0.5],
    ].map(([x, y, z], i) => ({
      x,
      y,
      z,
      len: 4.2,
      tall: 1.6,
      amp: 0.55,
      phase: i * 1.93,
    }));
    scene.add(bannerMesh(mat, list));
    camera.position.set(-1.5, 2.8, 4.5);
    camera.lookAt(1, 2.4, -2);
  };

// props.js’s tuftGeometry, near enough: seven blades of three faces each,
// coloured base to tip
const tuft = () => {
  const pos = [];
  const col = [];
  const base = [0.22, 0.32, 0.1];
  const mid = [0.4, 0.5, 0.18];
  const tip = [0.62, 0.64, 0.3];
  let s = 5;
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  for (let b = 0; b < 7; b++) {
    const a = r() * Math.PI * 2;
    const ox = (r() - 0.5) * 0.12;
    const oz = (r() - 0.5) * 0.12;
    const w = 0.018 + r() * 0.012;
    const ca = Math.cos(a) * w;
    const sa = Math.sin(a) * w;
    const h = 0.14 + r() * 0.2;
    const lean = 0.06 + r() * 0.1;
    const lx = Math.cos(a + 1.57) * lean;
    const lz = Math.sin(a + 1.57) * lean;
    const m = [ox + lx * 0.35, h * 0.55, oz + lz * 0.35];
    const t = [ox + lx, h, oz + lz];
    pos.push(ox - ca, 0, oz - sa, ox + ca, 0, oz + sa, m[0] + ca * 0.6, m[1], m[2] + sa * 0.6);
    pos.push(ox - ca, 0, oz - sa, m[0] + ca * 0.6, m[1], m[2] + sa * 0.6, m[0] - ca * 0.6, m[1], m[2] - sa * 0.6);
    pos.push(m[0] - ca * 0.6, m[1], m[2] - sa * 0.6, m[0] + ca * 0.6, m[1], m[2] + sa * 0.6, ...t);
    col.push(...base, ...base, ...mid, ...base, ...mid, ...mid, ...mid, ...mid, ...tip);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  // (scaled up, so the bend shows at this distance)
  return g.scale(4, 4, 4);
};

const grass =
  (P, instanced) =>
  ({ scene, camera }) => {
    scene.background = new THREE.Color(0x8aa0b8);
    const U = { uTime: { value: 7.1 } };
    const mat = P.windGrass(
      new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
      }),
      U,
      WIND,
      0.5,
    );
    const g = tuft();
    if (instanced) {
      const N = 36;
      const im = new THREE.InstancedMesh(g, mat, N);
      const o = new THREE.Object3D();
      for (let i = 0; i < N; i++) {
        o.position.set((i % 6) * 0.9 - 2.4, 0, Math.floor(i / 6) * 0.9 - 3);
        o.updateMatrix();
        im.setMatrixAt(i, o.matrix);
      }
      scene.add(im);
      camera.position.set(0, 1.6, 3.2);
      camera.lookAt(0, 0.4, -1);
    } else {
      scene.add(new THREE.Mesh(g, mat));
      camera.position.set(0, 0.8, 2.2);
      camera.lookAt(0, 0.6, 0);
    }
  };

const both = (f, ...a) => ({ node: f(PN, ...a), classic: f(PO, ...a) });

export default {
  'middleearth:edoras:banners': both(banners),
  'middleearth:edoras:grass:field': both(grass, true),
  'middleearth:edoras:grass:tuft': both(grass, false),
};
