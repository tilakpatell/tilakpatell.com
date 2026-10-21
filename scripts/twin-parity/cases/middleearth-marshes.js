// The Dead Marshes’ shaders: ../../../src/components/middleearth/towns/
// marshes/propsShaders.js and sceneShaders.js against their twins under
// nodes/towns/marshes/. The black water in its fog; the drowned faces in
// the open, and under an opaque pool, whose depth they’re tested at as if
// higher, so they show through it.
import * as THREE from 'three';
import * as PO from '../../../src/components/middleearth/towns/marshes/propsShaders.js';
import * as PN from '../../../src/components/middleearth/nodes/towns/marshes/propsShaders.js';
import * as SO from '../../../src/components/middleearth/towns/marshes/sceneShaders.js';
import * as SN from '../../../src/components/middleearth/nodes/towns/marshes/sceneShaders.js';

const water =
  (S) =>
  ({ scene, camera }) => {
    scene.fog = new THREE.Fog(0x2a3028, 6, 40);
    scene.background = new THREE.Color(0x2a3028);
    const w = {
      uniforms: {
        uSky: { value: new THREE.Color(0.32, 0.36, 0.3) },
        uDeep: { value: new THREE.Color(0.02, 0.025, 0.02) },
      },
    };
    const m = S.marshMaterial(w);
    m.uniforms.uTime.value = 6;
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), m));
    camera.position.set(0, 1.6, 6);
    camera.lookAt(0, 0, -4);
  };

// a pale face: an oval, two dark eyes and a mouth, clear round it
const facePicture = () => {
  const S = 64;
  const data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const u = x / S - 0.5;
      const v = y / S - 0.5;
      const oval = Math.max(0, 1 - Math.hypot(u / 0.3, v / 0.38));
      const eye = Math.min(Math.hypot(u - 0.1, v - 0.06), Math.hypot(u + 0.1, v - 0.06));
      const mouth = Math.hypot(u / 2, v + 0.17);
      const dark = eye < 0.05 || mouth < 0.04 ? 0.25 : 1;
      const k = Math.round(220 * dark);
      data.set([k, k, Math.round(k * 0.95), Math.round(Math.min(1, oval * 3) * 255)], (y * S + x) * 4);
    }
  const t = new THREE.DataTexture(data, S, S);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
};
// props.js’s faceGeo
const faceGeo = () => {
  const g = new THREE.PlaneGeometry(0.46, 0.46, 14, 14);
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const u = uv.getX(i) - 0.5;
    const v = uv.getY(i) - 0.48;
    const oval = Math.max(0, 1 - Math.hypot(u / 0.26, v / 0.33));
    let h = Math.sqrt(oval) * 0.06;
    h += Math.exp(-((u / 0.035) ** 2) - (v / 0.08) ** 2) * 0.02;
    h -= Math.exp(-(((Math.abs(u) - 0.09) / 0.05) ** 2) - ((v - 0.03) / 0.035) ** 2) * 0.015;
    h -= Math.exp(-((u / 0.06) ** 2) - ((v + 0.19) / 0.03) ** 2) * 0.01;
    p.setZ(i, h);
  }
  g.computeVertexNormals();
  return g.rotateX(-Math.PI / 2);
};

const faces =
  (P, pool) =>
  ({ scene, camera }) => {
    scene.fog = new THREE.Fog(0x2a3028, 2, 12);
    scene.background = new THREE.Color(0x2a3028);
    const map = facePicture();
    const geo = faceGeo();
    [
      [-0.4, 0, 0.3, 0.9],
      [0.35, -0.2, 2.1, 0.6],
      [0, -0.6, 4.4, 1],
    ].forEach(([x, z, t, k], i) => {
      const m = P.faceMaterial(map);
      m.uniforms.uTime.value = t;
      m.uniforms.uK.value = k;
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, -0.5, z);
      mesh.rotation.y = i * 0.7;
      mesh.renderOrder = 3;
      scene.add(mesh);
    });
    if (pool) {
      const top = new THREE.Mesh(new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x1a2018 }));
      top.position.y = -0.2;
      scene.add(top);
    }
    camera.position.set(0, 0.9, 1.2);
    camera.lookAt(0, -0.5, -0.2);
  };

const both = (f, P, Q, ...a) => ({ node: f(Q, ...a), classic: f(P, ...a) });

export default {
  'middleearth:marshes:water': both(water, SO, SN),
  'middleearth:marshes:faces': both(faces, PO, PN, false),
  'middleearth:marshes:faces:pool': both(faces, PO, PN, true),
};
