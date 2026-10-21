// The Shire's sky and light on the node renderer: ../../shire/sky.js's dome
// in TSL, line for line with its GLSL, and its moods, makeAtmosphere and
// lookFrom copied (importing them would bring the dome's GLSL, and the GLSL
// house look's, into a node world's closure; the test holds them to the
// original's). The dome's uniforms keep their names, as uniform nodes on
// `material.uniforms` and on what makeSky returns, so the moods write
// `.value` as before.
//
// What differs: the GLSL's `if`s (the stars, the clouds, the Eye) are a
// select each, so every branch is reckoned and one kept; a falling
// smoothstep is a rising one turned over, as WGSL wants. The tone map and
// the colour space, the GLSL's two chunks, are the renderer's own.

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, Loop, cameraProjectionMatrix, dot, float, floor, fract, length, max, mix, modelViewMatrix, normalize, positionLocal, pow, select, sin, smoothstep, uniform, varying, vec2, vec3, vec4 } from 'three/tsl';
import { shadowFor } from '../../../../lib/three/houseNodes';

export const MOODS = {
  day: {
    top: 0x3f7ccc,
    horizon: 0xf6dfb0,
    sun: [0.55, 0.42, 0.42],
    sunColour: 0xffe2b0,
    sunPower: 2.6,
    hemiSky: 0xcfe2ff,
    hemiGround: 0x6a7a3a,
    hemi: 1.05,
    fog: 0xe8dcb8,
    fogNear: 46,
    fogFar: 210,
    cloud: 0.55,
    cloudColour: 0xfff4e4,
    stars: 0,
    exposure: 1.02,
    water: 0x8fb8d8,
    deep: 0x24524a,
    shadow: 0x9d93c4,
  },
  night: {
    top: 0x060b1e,
    horizon: 0x1b2a4a,
    sun: [-0.4, 0.62, -0.5],
    sunColour: 0x8aa6e6,
    sunPower: 0.8,
    hemiSky: 0x40568a,
    hemiGround: 0x1e2426,
    hemi: 0.55,
    fog: 0x141c30,
    fogNear: 30,
    fogFar: 150,
    cloud: 0.2,
    cloudColour: 0x2a3550,
    stars: 1,
    exposure: 1.24,
    water: 0x223a60,
    deep: 0x081420,
    shadow: 0x2c3866,
  },
  dawn: {
    top: 0x5a7ab8,
    horizon: 0xffc49a,
    sun: [0.8, 0.16, 0.2],
    sunColour: 0xffb784,
    sunPower: 2.1,
    hemiSky: 0xffd8c0,
    hemiGround: 0x5a5a3a,
    hemi: 0.85,
    fog: 0xf0c4a8,
    fogNear: 36,
    fogFar: 190,
    cloud: 0.6,
    cloudColour: 0xffc8a8,
    stars: 0.08,
    exposure: 1.05,
    water: 0xe8b8a0,
    deep: 0x3a3a50,
    shadow: 0xb08aa8,
  },
};
const SHIRE_MOODS = MOODS;

export { shadowFor };
const KEYS = ['top', 'horizon', 'sunColour', 'hemiSky', 'hemiGround', 'fog', 'cloudColour', 'water', 'deep'];

// the GLSL's noise: a value noise and five octaves of it
const hash = Fn(([p]) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453)), 'float');
const noise = Fn(([p]) => {
  const i = floor(p);
  const f0 = fract(p);
  const f = f0.mul(f0).mul(f0.mul(-2).add(3));
  return mix(mix(hash(i), hash(i.add(vec2(1, 0))), f.x), mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), f.x), f.y);
}, 'float');
const fbm = Fn(([p0]) => {
  const p = vec2(p0).toVar();
  const a = float(0.5).toVar();
  const s = float(0).toVar();
  Loop(5, () => {
    s.addAssign(a.mul(noise(p)));
    p.assign(p.mul(2.03).add(7.1));
    a.mulAssign(0.5);
  });
  return s;
}, 'float');

// (GLSL's smoothstep with its edges reversed, defined in WGSL)
const fall = (a, b, x) => smoothstep(b, a, x).oneMinus();

export function makeSky(radius) {
  const uniforms = {
    uTop: uniform(new THREE.Color()),
    uHorizon: uniform(new THREE.Color()),
    uSunDir: uniform(new THREE.Vector3(0, 1, 0)),
    uSunColour: uniform(new THREE.Color()),
    uCloud: uniform(0.5),
    uCloudColour: uniform(new THREE.Color()),
    uStars: uniform(0),
    uMoon: uniform(0),
    uTime: uniform(0),
    uGrey: uniform(0),
    uEye: uniform(0),
  };
  const u = uniforms;
  const material = new MeshBasicNodeMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  // (on the far plane: gl_Position = p.xyww)
  const clip = cameraProjectionMatrix.mul(modelViewMatrix).mul(vec4(positionLocal, 1));
  material.vertexNode = vec4(clip.xy, clip.w, clip.w);
  const vDir = varying(normalize(positionLocal), 'vDir');
  material.colorNode = Fn(() => {
    const d = normalize(vDir).toVar();
    const up = max(d.y, 0);
    const col = mix(u.uHorizon, u.uTop, pow(up, 0.5)).toVar();
    // below the horizon: the haze the hills fade into
    col.assign(select(d.y.lessThan(0), u.uHorizon.mul(0.92), col));
    const sd = max(dot(d, normalize(u.uSunDir)), 0).toVar();
    col.addAssign(u.uSunColour.mul(pow(sd, 6).mul(0.35).add(pow(sd, 64).mul(0.6))).mul(u.uMoon.oneMinus()));
    // the sun's disc, or the moon's
    col.addAssign(u.uSunColour.mul(smoothstep(0.9993, 0.9997, sd)).mul(mix(6, 1.6, u.uMoon)));
    // stars, twinkling, thinning towards the horizon
    const sp = d.xz.div(d.y.add(0.35)).mul(160);
    const s = hash(floor(sp));
    const tw = sin(u.uTime.mul(2).add(s.mul(40)))
      .mul(0.4)
      .add(0.6);
    const star = smoothstep(0.9965, 1, s)
      .mul(fall(0.35, 0.05, length(fract(sp).sub(0.5))))
      .mul(tw);
    col.assign(
      select(
        u.uStars.greaterThan(0),
        col.add(
          vec3(1.4, 1.35, 1.2)
            .mul(star)
            .mul(u.uStars)
            .mul(smoothstep(0.02, 0.3, d.y)),
        ),
        col,
      ),
    );
    // clouds, drifting
    const p = d.xz.div(d.y.add(0.18));
    const c = smoothstep(0.48, 0.78, fbm(p.mul(1.3).add(vec2(u.uTime.mul(0.008), u.uTime.mul(0.003)))));
    const lit = u.uCloudColour.mul(pow(sd, 3).mul(0.5).add(0.8));
    col.assign(select(u.uCloud.greaterThan(0).and(d.y.greaterThan(0)), mix(col, lit, c.mul(u.uCloud).mul(smoothstep(0, 0.18, d.y))), col));
    // the Eye, far off to the east, while the Ring is on
    const e = normalize(vec3(1, 0.06, 0.25));
    const ed = dot(d, e);
    const slit = smoothstep(0.9985, 0.99985, ed).mul(sin(u.uTime.mul(7)).mul(0.4).add(0.6));
    col.assign(
      select(
        u.uEye.greaterThan(0),
        col.add(
          vec3(3, 0.8, 0.12)
            .mul(pow(max(ed, 0), 300).mul(1.4).add(slit))
            .mul(u.uEye),
        ),
        col,
      ),
    );
    const l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    return mix(col, vec3(l).mul(vec3(0.8, 0.85, 0.95)), u.uGrey);
  })();
  material.uniforms = uniforms;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 40, 20), material);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  return { dome, uniforms };
}

// ../../shire/sky.js's, copied: the moods blended into the sky, the
// lights, the fog and the water (a twin's water: its uniforms are nodes
// on `material.uniforms`, written the same way).
export function makeAtmosphere({ sky, sun, hemi, fog, water, stage, house = null, moods: MOODS = SHIRE_MOODS }) {
  const mix = {};
  for (const k of KEYS) mix[k] = new THREE.Color();
  mix.shadow = new THREE.Color();
  const halo = new THREE.Color();
  const tmp = new THREE.Color();
  const sunDir = new THREE.Vector3();
  const dawnSun = new THREE.Vector3(...MOODS.dawn.sun);
  const colour = (k, night, dawn) => {
    mix[k].set(MOODS.day[k]).lerp(tmp.set(MOODS.night[k]), night);
    if (dawn > 0) mix[k].lerp(tmp.set(MOODS.dawn[k]), dawn);
    return mix[k];
  };
  const num = (k, night, dawn) => {
    let v = MOODS.day[k] + (MOODS.night[k] - MOODS.day[k]) * night;
    if (dawn > 0) v += (MOODS.dawn[k] - v) * dawn;
    return v;
  };
  return (night, dawn) => {
    const u = sky.uniforms;
    u.uTop.value.copy(colour('top', night, dawn));
    u.uHorizon.value.copy(colour('horizon', night, dawn));
    u.uSunColour.value.copy(colour('sunColour', night, dawn));
    u.uCloudColour.value.copy(colour('cloudColour', night, dawn));
    u.uCloud.value = num('cloud', night, dawn);
    u.uStars.value = num('stars', night, dawn);
    u.uMoon.value = night * (1 - dawn);
    const a = MOODS.day.sun;
    const b = MOODS.night.sun;
    sunDir.set(a[0] + (b[0] - a[0]) * night, a[1] + (b[1] - a[1]) * night, a[2] + (b[2] - a[2]) * night);
    if (dawn > 0) sunDir.lerp(dawnSun, dawn);
    sunDir.normalize();
    u.uSunDir.value.copy(sunDir);
    sun.color.copy(colour('sunColour', night, dawn));
    sun.intensity = num('sunPower', night, dawn);
    hemi.color.copy(colour('hemiSky', night, dawn));
    hemi.groundColor.copy(colour('hemiGround', night, dawn));
    hemi.intensity = num('hemi', night, dawn);
    fog.color.copy(colour('fog', night, dawn));
    fog.near = num('fogNear', night, dawn);
    fog.far = num('fogFar', night, dawn);
    water.uniforms.uSky.value.copy(colour('water', night, dawn));
    water.uniforms.uDeep.value.copy(colour('deep', night, dawn));
    water.uniforms.uSun.value.copy(sunDir);
    water.uniforms.uSunColor.value.copy(sun.color);
    water.uniforms.uGlints.value = 1 - night * 0.6;
    stage.renderer.toneMappingExposure = num('exposure', night, dawn) * (house?.exposure ?? 1);
    if (house) {
      // (each mood's own shadow, or one from its sky light)
      house.set({
        shadow: mix.shadow
          .set(shadowFor(MOODS.day))
          .lerp(tmp.set(shadowFor(MOODS.night)), night)
          .lerp(tmp.set(shadowFor(MOODS.dawn)), dawn),
      });
      house.light({ sun, hemi });
      // (the sky dome's own halo round the sun, which the moon hasn't)
      halo.copy(u.uSunColour.value).multiplyScalar(0.35 * (1 - u.uMoon.value));
      house.sky({
        low: u.uHorizon.value,
        high: u.uTop.value,
        below: 0.92,
        sunDir,
        halo,
      });
      fog.color.copy(u.uHorizon.value).multiplyScalar(0.92);
    }
    return sunDir;
  };
}

// ../../shire/sky.js's, copied: the house look following a town that
// blends its own moods.
const haloOf = new THREE.Color();
export function lookFrom(house, { sky, sun, hemi, fog, renderer, exposure = 1 }) {
  const u = sky.uniforms;
  const out = sky.dome.visible !== false;
  house.set({
    shadow: shadowFor({ hemiSky: hemi.color.getHex(), hemi: hemi.intensity }),
    fogMix: out ? 1 : 0,
  });
  house.light({ sun, hemi });
  haloOf.copy(u.uSunColour.value).multiplyScalar(0.35 * (1 - (u.uMoon?.value ?? 0)));
  house.sky({
    low: u.uHorizon.value,
    high: u.uTop.value,
    below: 0.92,
    sunDir: u.uSunDir.value,
    halo: haloOf,
  });
  if (out) fog.color.copy(u.uHorizon.value).multiplyScalar(0.92);
  renderer.toneMappingExposure = exposure * house.exposure;
}
