// Rivendell’s shaders: ../../../src/components/middleearth/towns/rivendell/
// propsShaders.js and sceneShaders.js against their twins under nodes/towns/
// rivendell/. Each case is one of them on a small scene, built the same on
// both sides from the same arguments: the falls’ shared uniforms a clock
// part way on, in the late sun’s warm light; fog where the shader takes it,
// so its fading is drawn too.
import * as THREE from "three";
import * as PO from "../../../src/components/middleearth/towns/rivendell/propsShaders.js";
import * as PN from "../../../src/components/middleearth/nodes/towns/rivendell/propsShaders.js";
import * as SO from "../../../src/components/middleearth/towns/rivendell/sceneShaders.js";
import * as SN from "../../../src/components/middleearth/nodes/towns/rivendell/sceneShaders.js";
import { makeCanvas } from "../../../src/lib/paint.js";

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rng = (seed) => {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};
const fogged = (scene, near = 6, far = 40) => {
  scene.fog = new THREE.Fog(0x8a9aa8, near, far);
  scene.background = new THREE.Color(0x2a3440);
};
const falls = (P, t = 3.4) => {
  const u = P.waterfallUniforms();
  u.uTime.value = t;
  return u;
};

// a sheet as props.js lays it: uv.x across, uv.y metres fallen, aLayer
const sheet = (h, w, layer) => {
  const g = new THREE.PlaneGeometry(w, h, 12, 40).translate(0, h / 2, 0);
  const p = g.getAttribute("position");
  const uv = g.getAttribute("uv");
  const lay = new Float32Array(p.count).fill(layer);
  for (let i = 0; i < uv.count; i++) uv.setY(i, h - p.getY(i));
  g.setAttribute("aLayer", new THREE.BufferAttribute(lay, 1));
  return g;
};
const sheets =
  (P) =>
  ({ scene, camera }) => {
    fogged(scene, 10, 50);
    const u = falls(P);
    const h = 12;
    u.uFall.value = h;
    const m = P.fallMaterial(u);
    const back = new THREE.Mesh(sheet(h, 4, 0), m);
    const front = new THREE.Mesh(sheet(h, 2.9, 1), m);
    front.position.z = 0.35;
    back.renderOrder = 1;
    front.renderOrder = 2;
    scene.add(back, front);
    camera.position.set(0, 6, 9);
    camera.lookAt(0, 6, 0);
  };

// the puff texture, a soft round alpha
const puff = () => {
  const c = makeCanvas(64);
  const g = c.getContext("2d");
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
};
const mist =
  (P) =>
  ({ scene, camera }) => {
    fogged(scene, 8, 40);
    const u = falls(P, 5.2);
    u.uMist.value = 2.5;
    const r = rng(17);
    const pos = [];
    const corner = [];
    const seed = [];
    const idx = [];
    for (let k = 0; k < 40; k++) {
      const a = r() * Math.PI * 2;
      const rad = 0.5 + r() * 3;
      const at = [Math.cos(a) * rad, 0.4 + r() * 1.2, Math.sin(a) * rad * 0.8];
      const own = [r(), 0.05 + r() * 0.08, 1.5 + r() * 2.5, r()];
      for (const [cx, cy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        pos.push(...at);
        corner.push(cx, cy);
        seed.push(...own);
      }
      const b = k * 4;
      idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("corner", new THREE.Float32BufferAttribute(corner, 2));
    g.setAttribute("seed", new THREE.Float32BufferAttribute(seed, 4));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, P.mistMaterial(u, puff()));
    m.frustumCulled = false;
    scene.add(m);
    camera.position.set(0, 3, 10);
    camera.lookAt(0, 1.5, 0);
  };

const foam =
  (P) =>
  ({ scene, camera }) => {
    fogged(scene, 8, 40);
    const w = 3;
    const u = falls(P, 2.6);
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(w * 1.6, 32),
      P.foamMaterial(u, w),
    );
    m.rotation.x = -Math.PI / 2;
    scene.add(m);
    camera.position.set(0, 5, 6);
    camera.lookAt(0, 0, 0);
  };

// the river: a strip down the gorge, as scene.js lays it
const river =
  (S) =>
  ({ scene, camera }) => {
    fogged(scene, 12, 70);
    const water = {
      uniforms: {
        uSky: { value: new THREE.Color(0.55, 0.62, 0.7) },
        uDeep: { value: new THREE.Color(0.08, 0.16, 0.18) },
        uSun: { value: V3(-0.3, 0.4, -1).normalize() },
        uSunColor: { value: new THREE.Color(1, 0.85, 0.6) },
        uGlints: { value: 1 },
      },
    };
    const m = S.riverMaterial(water);
    m.uniforms.uTime.value = 3;
    const pos = [];
    const idx = [];
    const N = 40;
    for (let i = 0; i <= N; i++) {
      const z = -40 + (i / N) * 50;
      const x = Math.sin(z * 0.08) * 3;
      pos.push(x - 4, 0, z, x + 4, 0, z);
      if (i < N)
        idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, m));
    camera.position.set(0, 4, 8);
    camera.lookAt(0, 0, -8);
  };

const both = (f, ...a) => ({ node: f(PN, ...a), classic: f(PO, ...a) });

export default {
  "middleearth:rivendell:falls": both(sheets),
  "middleearth:rivendell:mist": both(mist),
  "middleearth:rivendell:foam": both(foam),
  "middleearth:rivendell:river": { node: river(SN), classic: river(SO) },
};
