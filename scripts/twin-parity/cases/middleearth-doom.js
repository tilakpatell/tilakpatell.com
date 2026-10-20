// Mount Doom’s shaders: ../../../src/components/middleearth/towns/doom/propsShaders.js
// against its twin, nodes/towns/doom/propsShaders.js. A case a shader: the
// Mountain’s ash glowing where its vertices are hot and its door, both in
// a fog they take only so far; the lava down a gully and in a swelling
// lake; the plume, the fountain of fire and the bombs over the crater; the
// Eye looking aside and its beam in the fog; the cavern’s rock lit from
// the fire beneath, its haze and its sparks; the Ring’s letters burning
// and an orc’s hide going to iron. The kit’s noise and puff are painted
// here the same for each side (props.js keeps its canvases to itself).
import * as THREE from 'three';
import * as DO from '../../../src/components/middleearth/towns/doom/propsShaders.js';
import * as DN from '../../../src/components/middleearth/nodes/towns/doom/propsShaders.js';

// a seeded random, the same on each side
const seq = (s0) => {
  let s = s0;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};

// value noise in four channels, tiling, 128 square
const noiseTexture = () => {
  const S = 128;
  const G = 16;
  const r = seq(0x2d1b);
  const grid = [0, 1, 2, 3].map(() => Array.from({ length: G * G }, () => r()));
  const data = new Uint8Array(S * S * 4);
  const sm = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const gx = (x / S) * G;
      const gy = (y / S) * G;
      const ix = Math.floor(gx);
      const iy = Math.floor(gy);
      const fx = sm(gx - ix);
      const fy = sm(gy - iy);
      for (let c = 0; c < 4; c++) {
        const g = grid[c];
        const at = (i, j) => g[((j + G) % G) * G + ((i + G) % G)];
        const v = (at(ix, iy) * (1 - fx) + at(ix + 1, iy) * fx) * (1 - fy) + (at(ix, iy + 1) * (1 - fx) + at(ix + 1, iy + 1) * fx) * fy;
        data[(y * S + x) * 4 + c] = Math.round(v * 255);
      }
    }
  const t = new THREE.DataTexture(data, S, S);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
};
// a soft round puff
const puffTexture = () => {
  const S = 64;
  const data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x / S - 0.5, y / S - 0.5) * 2;
      const a = Math.max(0, 1 - d) ** 1.5;
      data.set([Math.round(180 + 60 * a), 120, 100, Math.round(a * 255)], (y * S + x) * 4);
    }
  const t = new THREE.DataTexture(data, S, S);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
};
// letters: bars of fire along a band
const lettersTexture = () => {
  const W = 256;
  const H = 32;
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const on = y > 6 && y < 26 && x % 12 < 5 && (x * 7 + y) % 9 > 2;
      data.set([on ? 255 : 0, 0, 0, 255], (y * W + x) * 4);
    }
  const t = new THREE.DataTexture(data, W, H);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
};
// a sky for the gold and the iron to take
const envTexture = () => {
  const W = 64;
  const H = 32;
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = y / H;
      data.set([Math.round(40 + 200 * k), Math.round(20 + 90 * k), 20, 255], (y * W + x) * 4);
    }
  const t = new THREE.DataTexture(data, W, H);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
};

const kitU = (t = 12.3, erupt = 0.4) => ({
  uTime: { value: t },
  uErupt: { value: erupt },
  uNoise: { value: noiseTexture() },
  uPuff: { value: puffTexture() },
});

// props.js’s cardCloud, as it builds them
const cards = (material, pts, seed) => {
  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.getAttribute('position'));
  const em = new Float32Array(pts.length * 3);
  const sd = new Float32Array(pts.length * 4);
  const r = seq(seed);
  pts.forEach((p, i) => {
    em.set(p, i * 3);
    sd.set([r(), r(), r(), r()], i * 4);
  });
  geo.setAttribute('aEmit', new THREE.InstancedBufferAttribute(em, 3));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(sd, 4));
  geo.instanceCount = pts.length;
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  return mesh;
};

const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });

const ember =
  (D) =>
  ({ scene, camera }) => {
    scene.fog = new THREE.Fog(0x203040, 4, 16);
    const U = kitU();
    const m = D.emberish(M({ color: 0x5a524c }), U, {
      cap: 0.72,
      glow: { value: 1.6 },
      key: 'case-ember',
    });
    const geo = new THREE.SphereGeometry(2, 48, 24);
    const p = geo.getAttribute('position');
    const heat = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) heat[i] = Math.max(0, Math.sin(p.getX(i) * 2.1) * Math.cos(p.getY(i)));
    geo.setAttribute('heat', new THREE.BufferAttribute(heat, 1));
    scene.add(new THREE.Mesh(geo, m));
    const far = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), D.emberish(M({ color: 0x8a827a }), U, { cap: 0.72, key: 'case-rock' }));
    far.position.set(-3, 0, -9);
    scene.add(far);
    camera.position.set(0, 1, 6);
    camera.lookAt(-0.5, 0, 0);
  };
const door =
  (D) =>
  ({ scene, camera }) => {
    scene.fog = new THREE.FogExp2(0x203040, 0.09);
    const geo = new THREE.PlaneGeometry(6, 6, 4, 4);
    const col = new Float32Array(geo.getAttribute('position').count * 3);
    for (let i = 0; i < col.length; i++) col[i] = ((i * 37) % 11) / 11;
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = D.emberish(new THREE.MeshBasicMaterial({ vertexColors: true }), kitU(), { cap: 0.72, key: 'case-door' });
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.z = -3;
    scene.add(mesh);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, -3);
  };
const lava =
  (D, ribbon) =>
  ({ scene, camera }) => {
    scene.fog = new THREE.Fog(0x203040, 3, 18);
    const m = ribbon ? D.lavaMaterial(kitU(), { ribbon: true, cap: 0.45, flow: 1.6 }) : D.lavaMaterial(kitU(20, 0.8), { swell: 0.4, heat: 1.2, flow: 0.5 });
    const geo = new THREE.PlaneGeometry(12, 12, 40, 40).rotateX(-Math.PI / 2);
    const p = geo.getAttribute('position');
    const u2 = geo.getAttribute('uv');
    const edge = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) {
      u2.setXY(i, p.getX(i) * 4, p.getZ(i) * 4);
      edge[i] = Math.min(1, Math.abs(p.getX(i)) / 4);
    }
    geo.setAttribute('aEdge', new THREE.BufferAttribute(edge, 1));
    scene.add(new THREE.Mesh(geo, m));
    camera.position.set(0, 3, 6);
    camera.lookAt(0, 0, -1);
  };
const smoke =
  (D) =>
  ({ scene, camera }) => {
    scene.fog = new THREE.Fog(0x203040, 6, 30);
    scene.background.set(0x8a6a5a);
    const m = D.smokeMaterial(kitU(40, 0.6), {
      size: 2.2,
      rise: 6,
      spread: 2,
      wind: [0.5, 0, -0.2],
      cap: 0.6,
      alpha: 0.9,
      speed: 0.05,
    });
    const r = seq(77);
    const pts = Array.from({ length: 40 }, () => [(r() - 0.5) * 2, -1.5, (r() - 0.5) * 2]);
    scene.add(cards(m, pts, 1903));
    camera.position.set(0, 1.5, 9);
    camera.lookAt(0, 1.5, 0);
  };
const flame =
  (D) =>
  ({ scene, camera }) => {
    scene.background.set(0x101418);
    const m = D.flameMaterial(kitU(7.7), { size: 0.9, rise: 3, rate: 0.45 });
    m.uniforms.uK.value = 1.2;
    const r = seq(91);
    const pts = Array.from({ length: 40 }, () => [(r() - 0.5) * 3, -1.2, (r() - 0.5) * 2]);
    scene.add(cards(m, pts, 1907));
    camera.position.set(0, 0.5, 5);
    camera.lookAt(0, 0.3, 0);
  };
const bombs =
  (D) =>
  ({ scene, camera, renderer }) => {
    scene.background.set(0x101418);
    scene.fog = new THREE.Fog(0x203040, 10, 60);
    const m = D.bombMaterial(kitU(3.1), { speed: 6, cap: 0.4 });
    m.uniforms.uK.value = 1;
    m.userData.fit(renderer);
    m.uniforms.uSize.value = 0.6;
    scene.add(D.bombCloud(m, 70, new THREE.Vector3(0, -2, 0), 1.5, 1909));
    camera.position.set(0, -2, 34);
    camera.lookAt(0, -4, 0);
  };
const eye =
  (D) =>
  ({ scene, camera }) => {
    scene.background.set(0x101418);
    const m = D.eyeMaterial(kitU(5.5));
    m.uniforms.uK.value = 0.8;
    m.uniforms.uFix.value = 0.9;
    m.uniforms.uGazeAt.value.set(3, -1, 2);
    const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
    q.scale.set(4.5, 4.5, 1);
    scene.add(q);
    camera.position.set(1, 1, 5);
    camera.lookAt(0, 0, 0);
  };
const beam =
  (D) =>
  ({ scene, camera }) => {
    scene.background.set(0x101418);
    scene.fog = new THREE.Fog(0x203040, 2, 14);
    const m = D.beamMaterial(kitU(9));
    const geo = new THREE.ConeGeometry(1.6, 14, 32, 1, true).rotateZ(Math.PI / 2).translate(5, 0, 0);
    const mesh = new THREE.Mesh(geo, m);
    mesh.rotation.y = 0.5;
    scene.add(mesh);
    camera.position.set(0, 1.5, 6);
    camera.lookAt(1, 0, 0);
  };
const cavern =
  (D) =>
  ({ scene, camera }) => {
    scene.background.set(0x101418);
    const m = D.underglow(M({ color: 0x4a4440 }), kitU(4), 'case-cavern');
    m.userData.lavaY.value = -2.5;
    m.userData.fire.value = 1.6;
    m.userData.depth.value = 6;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(2, 3), m);
    scene.add(rock);
    camera.position.set(0, -1.5, 6);
    camera.lookAt(0, 0, 0);
  };
const haze =
  (D) =>
  ({ scene, camera }) => {
    scene.background.set(0x101418);
    const m = D.hazeMaterial(kitU(6));
    m.uniforms.uK.value = 2;
    for (let i = 0; i < 3; i++) {
      const card = new THREE.Mesh(new THREE.PlaneGeometry(4, 5), m);
      card.position.set(i - 1, 0, -i);
      card.rotation.y = i * 0.4 - 0.3;
      scene.add(card);
    }
    camera.position.set(0, 0, 6);
    camera.lookAt(0, 0, 0);
  };
const sparks =
  (D) =>
  ({ scene, camera, renderer }) => {
    scene.background.set(0x101418);
    const r = seq(4301);
    const NS = 220;
    const ss = new Float32Array(NS * 4);
    for (let i = 0; i < NS; i++) ss.set([r(), r(), r(), r()], i * 4);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 3), 3));
    sg.setAttribute('aSeed', new THREE.BufferAttribute(ss, 4));
    const m = D.sparkMaterial(kitU(15));
    m.uniforms.uSpan.value.set(6, 5, 3);
    m.uniforms.uK.value = 2;
    const v = new THREE.Vector2();
    renderer.getDrawingBufferSize(v);
    m.uniforms.uScale.value = v.y * 0.9;
    const s = D.sparkPoints(sg, m);
    s.position.set(0, -2.5, 0);
    s.frustumCulled = false;
    scene.add(s);
    camera.position.set(0, 0, 6);
    camera.lookAt(0, 0, 0);
  };
const ring =
  (D) =>
  ({ scene, camera }) => {
    const m = D.ringMaterial(envTexture(), lettersTexture(), kitU(2.2));
    m.userData.k.value = 0.9;
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.4, 32, 96), m);
    band.rotation.x = 1.1;
    scene.add(band);
    camera.position.set(0, 0, 4.5);
    camera.lookAt(0, 0, 0);
  };
const orc =
  (D) =>
  ({ scene, camera }) => {
    const m = D.orcMaterial(envTexture());
    const geo = new THREE.SphereGeometry(1.6, 48, 24);
    const p = geo.getAttribute('position');
    const col = new Float32Array(p.count * 3);
    const metal = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) {
      col.set([0.35, 0.3, 0.22], i * 3);
      metal[i] = p.getX(i) > 0 ? 1 : 0;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('metal', new THREE.BufferAttribute(metal, 1));
    scene.add(new THREE.Mesh(geo, m));
    camera.position.set(0, 0.5, 4.5);
    camera.lookAt(0, 0, 0);
  };

const both = (make, ...a) => ({
  node: make(DN, ...a),
  classic: make(DO, ...a),
});

export default {
  'middleearth:doom:ember': both(ember),
  'middleearth:doom:door': both(door),
  'middleearth:doom:lava:ribbon': both(lava, true),
  'middleearth:doom:lava:lake': both(lava, false),
  'middleearth:doom:smoke': both(smoke),
  'middleearth:doom:flame': both(flame),
  'middleearth:doom:bombs': both(bombs),
  'middleearth:doom:eye': both(eye),
  'middleearth:doom:beam': both(beam),
  'middleearth:doom:cavern': both(cavern),
  'middleearth:doom:haze': both(haze),
  'middleearth:doom:sparks': both(sparks),
  'middleearth:doom:ring': both(ring),
  'middleearth:doom:orc': both(orc),
};
