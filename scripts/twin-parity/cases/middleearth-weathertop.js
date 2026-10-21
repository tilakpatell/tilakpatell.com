// Weathertop’s shaders: ../../../src/components/middleearth/towns/weathertop/
// propsShaders.js and sceneShaders.js against their twins under
// nodes/towns/weathertop/. A flood horse’s water (a body and a wave, cut at
// the river, in fog), the churn at its foot, its spray (Math.random seeded
// the same each side), an ember’s glow dimmed by its vertex colours, hair
// seen from behind and lit as from the front, and the river at the ford,
// calm and in flood.
import * as THREE from 'three';
import * as PO from '../../../src/components/middleearth/towns/weathertop/propsShaders.js';
import * as PN from '../../../src/components/middleearth/nodes/towns/weathertop/propsShaders.js';
import * as SO from '../../../src/components/middleearth/towns/weathertop/sceneShaders.js';
import * as SN from '../../../src/components/middleearth/nodes/towns/weathertop/sceneShaders.js';

const seeded = (fn) => {
  const real = Math.random;
  let s = 0x51f3;
  Math.random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  try {
    return fn();
  } finally {
    Math.random = real;
  }
};

const flood =
  (P) =>
  ({ scene, camera }) => {
    scene.fog = new THREE.Fog(0x203040, 4, 16);
    const geo = new THREE.SphereGeometry(1.4, 64, 40).toNonIndexed();
    const pos = geo.attributes.position;
    const wave = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) wave[i] = pos.getX(i) > 0 ? 1 : 0;
    geo.setAttribute('aWave', new THREE.BufferAttribute(wave, 1));
    const m = P.floodWaterMaterial();
    m.uniforms.uTime.value = 2.3;
    m.uniforms.uWater.value = 0.4;
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(0, 1.2, 0);
    mesh.scale.set(1.2, 1.3, 1);
    scene.add(mesh);
    camera.position.set(0.5, 1.8, 4.6);
    camera.lookAt(0, 1.2, 0);
  };
const churn =
  (P) =>
  ({ scene, camera }) => {
    scene.fog = new THREE.Fog(0x203040, 4, 18);
    const m = P.churnMaterial();
    m.uniforms.uTime.value = 3.1;
    m.uniforms.uRise.value = 1;
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(9, 8, 1, 1).rotateX(-Math.PI / 2), m));
    camera.position.set(0, 4, 4.5);
    camera.lookAt(0, 0, 0);
  };
const spray =
  (P) =>
  ({ scene, camera, renderer }) => {
    const N = 900;
    const pg = new THREE.BufferGeometry();
    seeded(() => {
      const seeds = new Float32Array(N * 4).map(() => Math.random());
      const from = new Float32Array(N * 3).map((_, i) => (Math.random() - 0.5) * (i % 3 === 1 ? 1 : 2.4));
      const vel = new Float32Array(N * 3).map((_, i) => (i % 3 === 1 ? 1.4 : 0) + (Math.random() - 0.5) * 2.4);
      pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      pg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
      pg.setAttribute('aFrom', new THREE.BufferAttribute(from, 3));
      pg.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
    });
    const s = P.sprayPoints(pg);
    s.frustumCulled = false;
    s.position.set(0, 0.6, 0);
    const u = s.material.uniforms;
    u.uTime.value = 1.7;
    u.uRise.value = 1;
    u.uWater.value = 0.3;
    const v = new THREE.Vector2();
    renderer.getDrawingBufferSize(v);
    u.uScale.value = v.y * 0.9;
    scene.add(s);
    camera.position.set(0, 1.5, 4.5);
    camera.lookAt(0, 0.8, 0);
  };
const ember =
  (P) =>
  ({ scene, camera }) => {
    const geo = new THREE.IcosahedronGeometry(0.9, 3);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const k = 0.5 + 0.5 * Math.sin(pos.getX(i) * 4 + pos.getY(i) * 3);
      col.set([k, 0.4 + 0.6 * k, 1 - 0.7 * k], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = P.emberGlow(
      new THREE.MeshStandardMaterial({
        color: 0x140804,
        emissive: new THREE.Color(0xff5a1c),
        emissiveIntensity: 1.6,
        vertexColors: true,
        roughness: 0.9,
      }),
    );
    scene.add(new THREE.Mesh(geo, m));
    camera.position.set(0, 0.6, 3);
    camera.lookAt(0, 0, 0);
  };
const hair =
  (P) =>
  ({ scene, camera, sun }) => {
    const geo = new THREE.PlaneGeometry(2.4, 2.4, 12, 12);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      pos.setZ(i, 0.25 * Math.sin(pos.getX(i) * 2.2));
      const k = 0.6 + 0.4 * Math.cos(pos.getY(i) * 3);
      col.set([0.8 * k, 0.75 * k, 0.7 * k], i * 3);
    }
    geo.computeVertexNormals();
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = P.hairBothSides(
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.42,
        metalness: 0.2,
        side: THREE.DoubleSide,
      }),
    );
    scene.add(new THREE.Mesh(geo, m));
    // the light on the side the normals face; the camera on the back
    sun.position.set(1, 2, 4);
    camera.position.set(0.4, 0.3, -3.2);
    camera.lookAt(0, 0, 0);
  };
const river =
  (S, flood) =>
  ({ scene, camera }) => {
    scene.fog = new THREE.Fog(0x203040, 8, 40);
    const water = {
      uniforms: {
        uSky: { value: new THREE.Color(0x2a3e66) },
        uDeep: { value: new THREE.Color(0x060a14) },
        uSun: { value: new THREE.Vector3(0.55, 0.32, -0.6) },
        uSunColor: { value: new THREE.Color(0xa4b8ec) },
        uGlints: { value: 1 },
      },
    };
    const m = S.riverMaterial(water);
    m.uniforms.uTime.value = 4.2;
    m.uniforms.uFlood.value = flood;
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(20, 60, 1, 1).rotateX(-Math.PI / 2), m));
    camera.position.set(0, 2.5, 6);
    camera.lookAt(0, 0, -6);
  };

export default {
  'middleearth:weathertop:flood': { node: flood(PN), classic: flood(PO) },
  'middleearth:weathertop:churn': { node: churn(PN), classic: churn(PO) },
  'middleearth:weathertop:spray': { node: spray(PN), classic: spray(PO) },
  'middleearth:weathertop:ember': { node: ember(PN), classic: ember(PO) },
  'middleearth:weathertop:hair': { node: hair(PN), classic: hair(PO) },
  'middleearth:weathertop:river': {
    node: river(SN, 0),
    classic: river(SO, 0),
  },
  'middleearth:weathertop:river:flood': {
    node: river(SN, 0.7),
    classic: river(SO, 0.7),
  },
};
