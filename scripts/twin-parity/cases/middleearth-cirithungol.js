// Cirith Ungol’s shaders: ../../../src/components/middleearth/towns/
// cirithungol/propsShaders.js against its twin under nodes/towns/
// cirithungol/. Each case is one of them on a small scene, built the same
// on both sides from the same arguments: the kit’s shared uniforms (a clock
// part way on, the noise picture as the kit paints it), Minas Morgul’s
// (the glow up, the beam climbing or full), and pictures for the hides.
import * as THREE from "three";
import * as PO from "../../../src/components/middleearth/towns/cirithungol/propsShaders.js";
import * as PN from "../../../src/components/middleearth/nodes/towns/cirithungol/propsShaders.js";
import {
  fbm,
  makeCanvas,
  makeNoise,
  paintPixels,
} from "../../../src/lib/paint.js";

// a picture of three noises, one a channel, tiling
const picture = (seeds, scales, S = 128) => {
  const ns = seeds.map((s) => makeNoise(s));
  const c = paintPixels(makeCanvas(S), (u, v, out) => {
    for (let k = 0; k < 3; k++)
      out[k] =
        fbm(ns[k], u * scales[k], v * scales[k], {
          period: scales[k],
          octaves: 4,
        }) * 255;
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};
// the kit’s U and Minas Morgul’s, as morgul() makes them
const morgulU = (beam = 1) => ({
  uTime: { value: 4.2 },
  uGlow: { value: 1 },
  uBeam: { value: beam },
  uNoise: { value: picture([3, 17, 29], [4, 8, 2]) },
  uGhost: { value: new THREE.Color(0.3, 1.0, 0.46) },
});
const M = (o) =>
  new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });

// ── the hides ──

const hide =
  (P, shelob) =>
  ({ scene, camera }) => {
    const tex = picture([11, 13, 15], [6, 6, 3]);
    const nrm = picture([21, 23, 25], [8, 8, 2]);
    const mat = shelob
      ? P.hide(
          M({
            color: 0x3c2a1a,
            roughness: 0.36,
            metalness: 0.05,
          }),
          {
            tex,
            nrm,
            scale: 1.7,
            bump: 1.2,
            shade: 0.5,
            key: "cirith-shelob",
            ...P.shelobRim(),
          },
        )
      : P.hide(M({ color: 0x6a5d4c, roughness: 0.6 }), {
          tex,
          nrm,
          scale: 3.2,
          bump: 0.8,
          shade: 0.4,
          key: "cirith-orc",
        });
    const knot = new THREE.Mesh(
      new THREE.TorusKnotGeometry(1.4, 0.55, 160, 24),
      mat,
    );
    knot.rotation.set(0.3, 0.5, 0);
    knot.scale.setScalar(1.1);
    scene.add(knot);
    if (shelob) scene.background = new THREE.Color(0x050608);
    camera.position.set(0, 1, 5.5);
    camera.lookAt(0, 0, 0);
  };

// ── Minas Morgul ──

const ghost =
  (P) =>
  ({ scene, camera }) => {
    scene.background = new THREE.Color(0x06080a);
    const mat = P.ghostMaterial(morgulU());
    // a few of the city’s towers, pale stone, the vertex colours shading it
    const parts = [
      [0, 30, 0, 14, 60, 14],
      [-16, 12, 6, 10, 24, 10],
      [15, 18, 4, 9, 36, 9],
      [0, -2, 0, 50, 6, 30],
    ].map(([x, y, z, w, h, d]) => {
      const g = new THREE.BoxGeometry(w, h, d, 4, 8, 4).translate(x, y, z);
      const p = g.attributes.position;
      const c = [];
      for (let i = 0; i < p.count; i++) {
        const k = 0.6 + 0.4 * Math.sin(p.getX(i) * 0.3 + p.getY(i) * 0.2);
        c.push(k, k * 1.05, k);
      }
      g.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      return new THREE.Mesh(g, mat);
    });
    scene.add(...parts);
    camera.position.set(30, 25, 70);
    camera.lookAt(0, 22, 0);
  };

const beam =
  (P, level) =>
  ({ scene, camera }) => {
    const U = morgulU(level);
    // the three layers, as morgul() lays them: the thread, the beam, the haze
    const H = 60;
    for (const [r0, r1, o] of [
      [0.4, 0.6, { k: 1, core: 5, edge: 1.2 }],
      [1.0, 1.6, { k: 0.8, core: 1.7, edge: 2.6 }],
      [2.6, 4.2, { k: 0.14, core: 0.8, edge: 1.6 }],
    ]) {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(r1, r0, H, 20, 1, true).translate(
          0,
          H / 2,
          0,
        ),
        P.beamMaterial(U, o),
      );
      m.renderOrder = 7;
      scene.add(m);
    }
    scene.background = new THREE.Color(0x0a0c0e);
    camera.position.set(0, 18, 34);
    camera.lookAt(0, 26, 0);
  };

const splash =
  (P) =>
  ({ scene, camera }) => {
    const U = morgulU(0.9);
    const s = new THREE.Mesh(
      new THREE.CircleGeometry(20, 32).rotateX(Math.PI / 2),
      P.splashMaterial(U),
    );
    s.position.y = 12;
    scene.add(s);
    scene.background = new THREE.Color(0x0a0c0e);
    camera.position.set(0, 0, 14);
    camera.lookAt(0, 12, 0);
  };

const both = (f, ...a) => ({ node: f(PN, ...a), classic: f(PO, ...a) });

export default {
  "middleearth:cirithungol:hide:orc": both(hide, false),
  "middleearth:cirithungol:hide:shelob": both(hide, true),
  "middleearth:cirithungol:ghost": both(ghost),
  "middleearth:cirithungol:beam:rising": both(beam, 0.4),
  "middleearth:cirithungol:beam:full": both(beam, 1),
  "middleearth:cirithungol:splash": both(splash),
};
