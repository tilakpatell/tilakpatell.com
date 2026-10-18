// The Shire's own shaders: shire/{sky,ground,fx,propsShaders}.js against
// their twins under nodes/shire/. The sky by day (sun, clouds), by night
// (stars, the moon) and with the Eye and the Ring's grey; the water over
// the pond in fog; the ground painted by its map; a town's tufts swaying;
// the flowers, tinted and nodding in the one wind; the smoke rings; the
// fireflies; a firework and the dragon (Math.random seeded for each side).
import * as THREE from "three";
import * as SO from "../../../src/components/middleearth/shire/sky.js";
import * as SN from "../../../src/components/middleearth/nodes/shire/sky.js";
import * as GO from "../../../src/components/middleearth/shire/ground.js";
import * as GN from "../../../src/components/middleearth/nodes/shire/ground.js";
import * as FO from "../../../src/components/middleearth/shire/fx.js";
import * as FN from "../../../src/components/middleearth/nodes/shire/fx.js";
import * as PO from "../../../src/components/middleearth/shire/propsShaders.js";
import * as PN from "../../../src/components/middleearth/nodes/shire/propsShaders.js";
import * as WO from "../../../src/lib/three/wind.js";
import * as WN from "../../../src/lib/three/windNodes.js";
import {
  BAG_END,
  POND,
  WATER_Y,
  height,
} from "../../../src/components/middleearth/shire/rules.js";

const O = { S: SO, G: GO, F: FO, P: PO, W: WO };
const N = { S: SN, G: GN, F: FN, P: PN, W: WN };

const seeded = (fn) => {
  const real = Math.random;
  let s = 0x51e7;
  Math.random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  try {
    return fn();
  } finally {
    Math.random = real;
  }
};

const mood = (u, m, { sun = m.sun } = {}) => {
  u.uTop.value.set(m.top);
  u.uHorizon.value.set(m.horizon);
  u.uSunColour.value.set(m.sunColour);
  u.uCloudColour.value.set(m.cloudColour);
  u.uCloud.value = m.cloud;
  u.uStars.value = m.stars;
  u.uSunDir.value.set(...sun).normalize();
};

const sky =
  (K, kind) =>
  ({ scene, camera }) => {
    const { dome, uniforms: u } = K.S.makeSky(80);
    scene.add(dome);
    u.uTime.value = 40;
    if (kind === "day") {
      mood(u, K.S.MOODS.day);
      camera.position.set(0, 1, 0);
      camera.lookAt(5.5, 2.2, 4.2);
    } else if (kind === "night") {
      mood(u, K.S.MOODS.night);
      u.uMoon.value = 1;
      camera.position.set(0, 1, 0);
      camera.lookAt(-4, 3.8, -5);
    } else {
      mood(u, K.S.MOODS.dawn);
      u.uEye.value = 1;
      u.uGrey.value = 0.45;
      camera.position.set(0, 1, 0);
      camera.lookAt(10, 1.1, 2.5);
    }
  };

const water =
  (K) =>
  ({ scene, camera }) => {
    scene.fog = new THREE.Fog(0xe8dcb8, 6, 40);
    const w = K.G.makeWater();
    w.material.uniforms.uTime.value = 7.5;
    w.material.uniforms.uSun.value.set(0.2, 0.5, -1).normalize();
    scene.add(w.group);
    camera.position.set(POND.x, WATER_Y + 4, POND.z + 12);
    camera.lookAt(POND.x, WATER_Y, POND.z - 4);
  };

const terrain =
  (K) =>
  ({ scene, camera, renderer, sun }) => {
    sun.position.set(0.55, 0.42, 0.42).multiplyScalar(10);
    const map = K.G.shireGroundMap({ size: 128 });
    scene.add(K.G.makeTerrain(renderer, { seg: 80, map }));
    camera.position.set(-18, 12, 6);
    camera.lookAt(-18, 2, -16);
  };

const swaying =
  (K) =>
  ({ scene, camera }) => {
    const geo = new THREE.BoxGeometry(0.12, 1.4, 0.12).translate(0, 0.7, 0);
    const mat = new THREE.MeshLambertMaterial({ color: 0x6a9a3a });
    const out = K.G.swaying(mat, { uWind: { value: 2.3 } }, 0.4) ?? mat;
    const list = [];
    for (let i = 0; i < 7; i++)
      for (let j = 0; j < 5; j++)
        list.push({ x: (i - 3) * 0.7, z: (j - 2) * 0.7, y: 0, s: 1 });
    scene.add(K.G.instances(geo, out, list));
    camera.position.set(0, 1.6, 4.5);
    camera.lookAt(0, 0.8, 0);
  };

// a flower: a green stem (tint 0) and a pale head (tint 1)
const flowerGeo = () => {
  const stem = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 5).translate(
    0,
    0.15,
    0,
  );
  const head = new THREE.SphereGeometry(0.09, 8, 6).translate(0, 0.34, 0);
  const parts = [
    [stem, 0, [0.25, 0.55, 0.2]],
    [head, 1, [1, 1, 0.95]],
  ];
  const pos = [];
  const nor = [];
  const col = [];
  const tint = [];
  for (const [g0, t, c] of parts) {
    const g = g0.toNonIndexed();
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
    for (let i = 0; i < g.attributes.position.count; i++) {
      col.push(...c);
      tint.push(t);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute("tint", new THREE.Float32BufferAttribute(tint, 1));
  return geo;
};

const flowers =
  (K) =>
  ({ scene, camera }) => {
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
      side: THREE.DoubleSide,
    });
    const tinted = K.P.flowerTint(mat) ?? mat;
    const wind = K.W.createWind({ strength: 0.6 });
    wind.update(4);
    scene.add(K.G.makeFlowers(flowerGeo(), tinted, 900, wind));
    const x = BAG_END.x;
    const z = BAG_END.z + BAG_END.r * 1.2;
    const y = height(x, z);
    camera.position.set(x, y + 2.4, z + 5);
    camera.lookAt(x, y, z - 1);
  };

const tint =
  (K) =>
  ({ scene, camera }) => {
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
    });
    const tinted = K.P.flowerTint(mat) ?? mat;
    const geo = flowerGeo().scale(4, 4, 4);
    const colours = [0xf2d24a, 0xe8655a, 0xb07ad8, 0x7ab0f0, 0xf08a3a];
    const list = colours.map((colour, i) => ({
      x: (i - 2) * 0.9,
      z: 0,
      y: 0,
      colour,
    }));
    scene.add(K.G.instances(geo, tinted, list));
    camera.position.set(0, 1.4, 4);
    camera.lookAt(0, 0.9, 0);
  };

const rings =
  (K) =>
  ({ scene, camera }) => {
    const fx = K.F.createFx(scene, { scale: 0.3 });
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    fx.showRings(
      [
        { at: v(-1.2, 1, 0), r: 0.9, opacity: 0.85, face: v(0.3, 0.2, 1) },
        { at: v(1.1, 1.3, -0.5), r: 1.2, opacity: 0.6, face: v(-0.5, 0.4, 1) },
        { at: v(0, 0.2, 0.6), r: 0.6, opacity: 0.9, face: v(0, 1, 0.3) },
      ],
      5.2,
    );
    camera.position.set(0, 1.5, 5);
    camera.lookAt(0, 0.8, 0);
  };

const flies =
  (K) =>
  ({ scene, camera }) => {
    scene.background = new THREE.Color(0x0a1020);
    const fx = K.F.createFx(scene, { scale: 0.5 });
    seeded(() => fx.placeFlies([{ x: 0, y: 0, z: 0, r: 2.5 }]));
    fx.step(0.016, 3.7, { night: 1, day: 0 });
    camera.position.set(0, 1.6, 6);
    camera.lookAt(0, 1.2, 0);
  };

const fireworks =
  (K) =>
  ({ scene, camera }) => {
    scene.background = new THREE.Color(0x0a1020);
    const fx = K.F.createFx(scene, { scale: 0.5 });
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    seeded(() => {
      fx.burst(v(-3, 6, 0), "gold");
      fx.burst(v(3, 7, -2), "blue");
      fx.burst(v(0, 9, -4), "green");
      fx.startDragon([v(-8, 3, 0), v(-3, 5, 2), v(2, 4, 0), v(8, 6, -2)], 4);
      for (let i = 0; i < 20; i++) fx.step(0.03, i * 0.03, { day: 0 });
    });
    camera.position.set(0, 4, 16);
    camera.lookAt(0, 5, 0);
  };

const pair = (make, ...a) => ({ node: make(N, ...a), classic: make(O, ...a) });

export default {
  "middleearth:shire:sky:day": pair(sky, "day"),
  "middleearth:shire:sky:night": pair(sky, "night"),
  "middleearth:shire:sky:eye": pair(sky, "eye"),
  "middleearth:shire:water": pair(water),
  "middleearth:shire:terrain": pair(terrain),
  "middleearth:shire:swaying": pair(swaying),
  "middleearth:shire:flowers": pair(flowers),
  "middleearth:shire:tint": pair(tint),
  "middleearth:shire:rings": pair(rings),
  "middleearth:shire:flies": pair(flies),
  "middleearth:shire:fireworks": pair(fireworks),
};
