// Lothlórien’s shaders: ../../../src/components/middleearth/towns/lorien/
// propsShaders.js and sceneShaders.js against their twins under nodes/towns/
// lorien/. Each case is one of them on a small scene, built the same on both
// sides from the same arguments: the kit’s water uniforms (a clock part way
// on, dusk or night), the Mirror’s with each vision part way up, a painting
// for the Shire’s, the town’s water as the sky writes it; the wood’s fog
// over the waters, as they take it.
import * as THREE from "three";
import * as PO from "../../../src/components/middleearth/towns/lorien/propsShaders.js";
import * as PN from "../../../src/components/middleearth/nodes/towns/lorien/propsShaders.js";
import * as SO from "../../../src/components/middleearth/towns/lorien/sceneShaders.js";
import * as SN from "../../../src/components/middleearth/nodes/towns/lorien/sceneShaders.js";
import {
  fbm,
  makeCanvas,
  makeNoise,
  paintPixels,
} from "../../../src/lib/paint.js";

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

const fogged = (scene, colour = 0xd8c890, near = 6, far = 40) => {
  scene.fog = new THREE.Fog(colour, near, far);
  scene.background = new THREE.Color(colour);
};
// the kit’s K.water: the fog’s uniforms, the clock, the night
const kitWater = (night) => ({
  ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
  uTime: { value: 3.7 },
  uNight: { value: night },
});
// a burning Shire, roughly: green hills, a dark sky, fires along them
const shirePainting = () => {
  const n = makeNoise(7);
  const c = paintPixels(makeCanvas(128), (u, v, out) => {
    const hill = v > 0.45 + 0.08 * Math.sin(u * 9);
    const f = fbm(n, u * 6, v * 6, { octaves: 3 });
    const fire = hill && f > 0.55;
    out[0] = fire ? 240 : hill ? 60 : 30 + 40 * f;
    out[1] = fire ? 120 : hill ? 90 : 20;
    out[2] = fire ? 20 : hill ? 40 : 40 + 30 * f;
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

// ── the fountains ──

const basin =
  (P, night) =>
  ({ scene, camera }) => {
    fogged(scene, night ? 0x101c34 : 0xd8c890);
    const m = P.basinWaterMaterial(kitWater(night));
    const a = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 40).rotateX(-Math.PI / 2),
      m,
    );
    const b = new THREE.Mesh(
      new THREE.CircleGeometry(0.9, 24).rotateX(-Math.PI / 2),
      m,
    );
    b.position.set(0.6, 0.9, -1.4);
    scene.add(a, b);
    camera.position.set(0, 2.2, 3.6);
    camera.lookAt(0, 0.2, -0.4);
  };

const sheet =
  (P, night) =>
  ({ scene, camera }) => {
    fogged(scene, night ? 0x101c34 : 0xd8c890);
    const m = P.fallSheetMaterial(kitWater(night));
    scene.add(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 1.2, 1.6, 32, 1, true),
        m,
      ),
    );
    camera.position.set(0, 0.6, 3.2);
    camera.lookAt(0, 0, 0);
  };

// ── the Mirror ──

const mirror =
  (P, kind, k, night = 0) =>
  ({ scene, camera }) => {
    fogged(scene, 0x0a1a14, 6, 40);
    const uniforms = {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: { value: 2.3 },
      uK: { value: k },
      uKind: { value: kind },
      uNight: { value: night },
      uShire: { value: shirePainting() },
    };
    scene.add(
      new THREE.Mesh(
        new THREE.CircleGeometry(1.25, 64).rotateX(-Math.PI / 2),
        P.mirrorWaterMaterial(uniforms),
      ),
    );
    camera.position.set(0, 2.4, 1.2);
    camera.lookAt(0, 0, 0);
  };

// ── the leaves’ glow ──

const glow =
  (P) =>
  ({ scene, camera }) => {
    // a crown of gold leaves, its vertex colours what gives it its glow
    const geo = new THREE.IcosahedronGeometry(1.4, 3);
    const p = geo.attributes.position;
    const col = [];
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 1.4;
      col.push(0.6 + 0.4 * y, 0.5 + 0.3 * Math.sin(p.getX(i) * 4), 0.2);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    const m = P.glowByColour(
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.8,
        color: new THREE.Color(1.5, 1.46, 1.36),
        emissive: new THREE.Color(0xffd884),
        emissiveIntensity: 0.4,
      }),
    );
    scene.add(new THREE.Mesh(geo, m));
    camera.position.set(0, 0.5, 4.5);
    camera.lookAt(0, 0, 0);
  };

// ── the streams and the river ──

const stream =
  (S, flow) =>
  ({ scene, camera }) => {
    fogged(scene, 0xd8c890, 10, 60);
    const water = {
      uniforms: {
        uSky: { value: new THREE.Color(0x8aa8a0) },
        uDeep: { value: new THREE.Color(0x2a3a30) },
        uSun: { value: V3(-0.5, 0.55, 0.3).normalize() },
        uSunColor: { value: new THREE.Color(0xffe2a0) },
      },
    };
    const m = S.waterMaterial(water, flow);
    m.uniforms.uTime.value = 4;
    scene.add(
      new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), m),
    );
    camera.position.set(0, 2, 8);
    camera.lookAt(0, 0, -6);
  };

const both = (f, ...a) => ({ node: f(PN, ...a), classic: f(PO, ...a) });

export default {
  "middleearth:lorien:basin": both(basin, 0),
  "middleearth:lorien:basin:night": both(basin, 1),
  "middleearth:lorien:fall": both(sheet, 0),
  "middleearth:lorien:fall:night": both(sheet, 1),
  "middleearth:lorien:mirror:still": both(mirror, 0, 0),
  "middleearth:lorien:mirror:stars": both(mirror, 0, 0.8, 1),
  "middleearth:lorien:mirror:eye": both(mirror, 1, 0.9),
  "middleearth:lorien:mirror:shire": both(mirror, 2, 0.75),
  "middleearth:lorien:glow": both(glow),
  "middleearth:lorien:stream": {
    node: stream(SN, 0.4),
    classic: stream(SO, 0.4),
  },
  "middleearth:lorien:river": {
    node: stream(SN, 0.9),
    classic: stream(SO, 0.9),
  },
};
