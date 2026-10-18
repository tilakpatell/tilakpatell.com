// Amon Hen’s shaders: ../../../src/components/middleearth/towns/amonhen/
// propsShaders.js and sceneShaders.js against their twins under
// nodes/towns/amonhen/. An Uruk’s material (vertex colours, black iron by
// an attribute, war paint off a sheet, the woods’ light to catch); the
// falls of Rauros, their foam and mist on the kit’s one clock, in fog; the
// Eye, calm and fierce; and the lake under a night sky.
import * as THREE from "three";
import * as PO from "../../../src/components/middleearth/towns/amonhen/propsShaders.js";
import * as PN from "../../../src/components/middleearth/nodes/towns/amonhen/propsShaders.js";
import * as SO from "../../../src/components/middleearth/towns/amonhen/sceneShaders.js";
import * as SN from "../../../src/components/middleearth/nodes/towns/amonhen/sceneShaders.js";

const canvas = (size, draw) => {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
// a white hand smeared on the sheet’s first square; nothing elsewhere
const paintSheet = () =>
  canvas(128, (x) => {
    x.clearRect(0, 0, 128, 128);
    x.fillStyle = "rgba(240,236,228,0.9)";
    x.beginPath();
    x.ellipse(32, 40, 16, 12, 0, 0, Math.PI * 2);
    x.fill();
    for (let i = 0; i < 4; i++) x.fillRect(18 + i * 8, 4, 5, 28);
  });
const woods = () => {
  const t = canvas(64, (x) => {
    const g = x.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, "#c8d8b0");
    g.addColorStop(0.5, "#5a6a40");
    g.addColorStop(1, "#201a10");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
  });
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
};
const puffTex = () =>
  canvas(64, (x) => {
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.6, "rgba(255,255,255,0.3)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
  });
const clock = (t) => ({
  ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
  uTime: { value: t },
});

const uruk =
  (P) =>
  ({ scene, camera }) => {
    const geo = new THREE.SphereGeometry(1, 48, 32);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const col = new Float32Array(pos.count * 3);
    const metal = new Float32Array(pos.count);
    const puv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      col.set([0.32 + 0.1 * y, 0.26, 0.2], i * 3);
      metal[i] = y < -0.2 ? 1 : 0;
      // the face’s square on the front half, bare paper behind
      const front = pos.getZ(i) > 0;
      puv.set(
        front
          ? [0.5 * uv.getX(i) * 2 - 0.25, 0.5 + 0.5 * uv.getY(i)]
          : [0.75, 0.25],
        i * 2,
      );
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("metal", new THREE.BufferAttribute(metal, 1));
    geo.setAttribute("puv", new THREE.BufferAttribute(puv, 2));
    scene.add(new THREE.Mesh(geo, P.urukMaterial(paintSheet(), woods())));
    camera.position.set(0.6, 0.3, 3);
    camera.lookAt(0, 0, 0);
  };
const falls =
  (P) =>
  ({ scene, camera }) => {
    scene.fog = new THREE.Fog(0x203040, 6, 30);
    const fall = clock(0);
    const sheet = new THREE.PlaneGeometry(8, 12, 8, 24);
    const uv = sheet.attributes.uv;
    // uv.y from -1 upstream (the top) to 1 at the foot; uv.x in tens of metres
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, uv.getX(i) * 0.8, 1 - 2 * uv.getY(i));
    const m = P.fallsMaterial(fall);
    scene.add(new THREE.Mesh(sheet, m));
    const foam = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 5).rotateX(-Math.PI / 2).translate(0, -6, 2.5),
      P.foamMaterial(fall),
    );
    foam.geometry.attributes.uv.array.forEach((v, i, a) => {
      if (i % 2) a[i] = 1 - v;
    });
    scene.add(foam);
    m.uniforms.uTime.value = 5.3;
    camera.position.set(0, -2, 12);
    camera.lookAt(0, -1, 0);
  };
const foam =
  (P) =>
  ({ scene, camera }) => {
    scene.fog = new THREE.Fog(0x203040, 6, 30);
    const fall = clock(0);
    const falls = P.fallsMaterial(fall);
    const m = P.foamMaterial(fall);
    scene.add(
      new THREE.Mesh(new THREE.PlaneGeometry(10, 8).rotateX(-Math.PI / 2), m),
    );
    // (one clock: the falls’ write moves the foam)
    falls.uniforms.uTime.value = 4.7;
    camera.position.set(0, 5, 6);
    camera.lookAt(0, 0, 0);
  };
const mist =
  (P) =>
  ({ scene, camera }) => {
    scene.fog = new THREE.Fog(0x203040, 10, 60);
    const fall = clock(0);
    const N = 60;
    const pos = [];
    const corner = [];
    const puff = [];
    const idx = [];
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < N; i++) {
      const at = [(r() - 0.5) * 14, 0, (r() - 0.5) * 4];
      const pf = [r(), 2 + r() * 3, 0.05 + r() * 0.08, r()];
      for (const [cx, cy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        pos.push(...at);
        corner.push(cx, cy);
        puff.push(...pf);
      }
      const b = i * 4;
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    mg.setAttribute("corner", new THREE.Float32BufferAttribute(corner, 2));
    mg.setAttribute("puff", new THREE.Float32BufferAttribute(puff, 4));
    mg.setIndex(idx);
    const m = P.mistMaterial({ ...fall, uPuff: { value: puffTex() } });
    const mesh = new THREE.Mesh(mg, m);
    mesh.frustumCulled = false;
    mesh.scale.setScalar(0.5);
    scene.add(mesh);
    m.uniforms.uTime.value = 6.1;
    camera.position.set(0, 6, 22);
    camera.lookAt(0, 6, 0);
  };
const eye =
  (P, k) =>
  ({ scene, camera }) => {
    scene.background.set(0x05040a);
    const m = P.eyeMaterial({ uTime: { value: 0 }, uK: { value: 0.5 } });
    const fire = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), m);
    fire.scale.setScalar(0.2);
    fire.frustumCulled = false;
    scene.add(fire);
    m.uniforms.uTime.value = 7.3;
    m.uniforms.uK.value = k;
    camera.position.set(1, 0.5, 6);
    camera.lookAt(0, 0, 0);
  };
const lake =
  (S) =>
  ({ scene, camera }) => {
    scene.fog = new THREE.Fog(0x0c1224, 20, 120);
    const water = {
      uniforms: {
        uSky: { value: new THREE.Color(0x5a6a8a) },
        uDeep: { value: new THREE.Color(0x14182a) },
        uSun: { value: new THREE.Vector3(-0.85, 0.08, 0.35) },
        uSunColor: { value: new THREE.Color(0xffa070) },
        uGlints: { value: 1 },
      },
    };
    const m = S.lakeMaterial(water);
    m.uniforms.uTime.value = 3.4;
    scene.add(
      new THREE.Mesh(
        new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2),
        m,
      ),
    );
    camera.position.set(0, 3, 0);
    camera.lookAt(-30, 0, 10);
  };

export default {
  "middleearth:amonhen:uruk": { node: uruk(PN), classic: uruk(PO) },
  "middleearth:amonhen:falls": { node: falls(PN), classic: falls(PO) },
  "middleearth:amonhen:foam": { node: foam(PN), classic: foam(PO) },
  "middleearth:amonhen:mist": { node: mist(PN), classic: mist(PO) },
  "middleearth:amonhen:eye": { node: eye(PN, 0.3), classic: eye(PO, 0.3) },
  "middleearth:amonhen:eye:fierce": {
    node: eye(PN, 1),
    classic: eye(PO, 1),
  },
  "middleearth:amonhen:lake": { node: lake(SN), classic: lake(SO) },
};
