// The enchanted ceiling (the design’s §4.4): the vault over the Great Hall
// bewitched to look like the sky outside. The vault is drawn with the sky
// along each view ray, not along the stone, so it reads as open air above
// the candles: the colour by height (zenith to horizon), the sun or the moon
// and their glow, the stars by night, the clouds drifting by the weather,
// all by the world’s own sky (set() takes what the sky outside is showing;
// skyAt() below is the fallback the hall uses before the grounds’ clock is
// there). When it rains outside it rains in here too, from the vault, and
// the rain is gone before it reaches the candles: nobody at the tables gets wet.
//
//   vaultGeometry({ width, length, spring, rise, across }) → BufferGeometry (pure)
//   skyAt(hour, { cloud, rain }) → { zenith, horizon, sun: { dir, colour }, moon: { dir }, stars, cloud, rain } (pure)
//   createCeiling({ width, length, spring, rise, tier }) → { group, set(sky), step(dt), dispose() }

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { abs, attribute, cameraPosition, cameraProjectionMatrix, clamp, dot, float, floor, fract, hash, length, max, mix, modelViewMatrix, mx_fractal_noise_float, normalize, positionGeometry, positionWorld, pow, sin, smoothstep, time, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';

// The vault: a half-ellipse barrel `width` across springing at `spring`, `rise`
// high at its crown, the hall’s `length` long, its faces turned down into the hall.
export function vaultGeometry({ width = 20, length = 56, spring = 13, rise = 8, across = 28 } = {}) {
  const a = width / 2;
  const pos = [];
  const uvs = [];
  const idx = [];
  for (let i = 0; i <= across; i++) {
    const th = Math.PI * (1 - i / across);
    const x = a * Math.cos(th);
    const y = spring + rise * Math.sin(th);
    for (const [j, z] of [
      [0, -length / 2],
      [1, length / 2],
    ]) {
      pos.push(x, y, z);
      uvs.push(i / across, j);
    }
  }
  for (let i = 0; i < across; i++) {
    const k = i * 2;
    // (wound so the faces look down: the hall sees their fronts)
    idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const lerp = (a, b, k) => a + (b - a) * k;
const mixRgb = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const NIGHT = { zenith: [0.012, 0.016, 0.045], horizon: [0.05, 0.07, 0.14] };
const DAY = { zenith: [0.2, 0.36, 0.68], horizon: [0.62, 0.72, 0.84] };
const DUSK = { zenith: [0.1, 0.12, 0.3], horizon: [0.85, 0.48, 0.3] };

// The sky by the hour (0…24) as the ceiling shows it before the world’s own
// is wired in: the sun’s arc east to west over a Highland day, the moon
// opposite, the stars out once the sun is well down.
export function skyAt(hour, { cloud = 0.3, rain = 0 } = {}) {
  const day = ((hour - 6) / 12) * Math.PI; // 0 at six in the morning, π at six at night
  const el = Math.sin(day);
  const sunDir = [Math.cos(day) * 0.8, el, -0.35];
  const n = Math.hypot(...sunDir);
  const up = Math.max(0, Math.min(1, (el + 0.1) / 0.45));
  const low = Math.max(0, 1 - Math.abs(el) / 0.3) * (el > -0.25 ? 1 : 0);
  let zenith = mixRgb(NIGHT.zenith, DAY.zenith, up);
  let horizon = mixRgb(NIGHT.horizon, DAY.horizon, up);
  zenith = mixRgb(zenith, DUSK.zenith, low * 0.5);
  horizon = mixRgb(horizon, DUSK.horizon, low * 0.8);
  // (rain greys it all down)
  const grey = Math.min(1, rain * 0.8 + cloud * 0.25);
  const g = (c) => mixRgb(c, [0.3 * up + 0.04, 0.32 * up + 0.045, 0.36 * up + 0.06], grey);
  return {
    zenith: g(zenith),
    horizon: g(horizon),
    sun: { dir: sunDir.map((v) => v / n), colour: mixRgb([1, 0.55, 0.3], [1, 0.95, 0.85], up), up: el > -0.05 ? 1 : 0 },
    moon: { dir: [-sunDir[0] / n, Math.max(0.25, -sunDir[1] / n), 0.45] },
    stars: Math.max(0, Math.min(1, (-el - 0.05) / 0.25)) * (1 - Math.min(1, cloud + rain)),
    cloud: Math.min(1, cloud + rain * 0.6),
    rain,
  };
}

const RAIN = { low: 0, mid: 260, high: 520, ultra: 700 };

export function createCeiling({ width = 20, length: long = 56, spring = 13, rise = 8, tier = 'high' } = {}) {
  const group = new THREE.Group();
  group.name = 'hogwarts:ceiling';
  const u = {
    zenith: uniform(new THREE.Color(...NIGHT.zenith)),
    horizon: uniform(new THREE.Color(...NIGHT.horizon)),
    sunDir: uniform(new THREE.Vector3(0, -1, 0)),
    sunColour: uniform(new THREE.Color(1, 0.9, 0.8)),
    sunUp: uniform(0),
    moonDir: uniform(new THREE.Vector3(-0.3, 0.8, 0.4).normalize()),
    stars: uniform(1),
    cloud: uniform(0.3),
    rain: uniform(0),
  };

  // the sky along the ray from the eye: what the enchantment shows
  const sky = new MeshBasicNodeMaterial({ side: THREE.DoubleSide, fog: false });
  sky.userData.noHouse = true;
  const d = normalize(positionWorld.sub(cameraPosition));
  const e = clamp(d.y, 0, 1);
  let col = mix(u.horizon, u.zenith, smoothstep(0.02, 0.75, e));
  const sd = max(dot(d, u.sunDir), 0);
  col = col.add(u.sunColour.mul(pow(sd, 900).mul(8).add(pow(sd, 12).mul(0.35))).mul(u.sunUp));
  // the moon: a disc and its halo, a little mottled
  const md = max(dot(d, normalize(u.moonDir)), 0);
  const moonDisc = smoothstep(0.99955, 0.99975, md);
  const mottle = mx_fractal_noise_float(d.mul(400), 2).mul(0.12).add(0.9);
  col = col.add(vec3(0.95, 0.95, 0.88).mul(moonDisc.mul(mottle).mul(2.2)).add(vec3(0.5, 0.55, 0.7).mul(pow(md, 160).mul(0.25))).mul(u.sunUp.oneMinus()));
  // the stars: a cell of the sky a star, now and then, twinkling
  const p = d.mul(170);
  const cell = floor(p);
  const h = hash(cell.x.add(1000).add(cell.y.add(1000).mul(73)).add(cell.z.add(1000).mul(5501)));
  const f = fract(p).sub(0.5);
  const twinkle = sin(time.mul(h.mul(3).add(1)).add(h.mul(40))).mul(0.35).add(0.75);
  const star = smoothstep(0.988, 1, h).mul(smoothstep(0.22, 0.0, length(f))).mul(twinkle).mul(1.6);
  // the clouds: noise over the sky’s plane at a height, drifting
  const plane = d.xz.div(max(d.y, 0.08)).mul(0.55);
  const n = mx_fractal_noise_float(vec3(plane.add(vec2(time.mul(0.012), time.mul(0.004))), time.mul(0.01)), 4).mul(0.5).add(0.5);
  const cover = smoothstep(u.cloud.oneMinus().mul(0.8).add(0.2), u.cloud.oneMinus().mul(0.8).add(0.45), n);
  const lit = mix(vec3(0.05, 0.06, 0.09), vec3(0.75, 0.75, 0.78), u.sunUp).add(u.sunColour.mul(pow(sd, 4).mul(0.3)).mul(u.sunUp));
  col = col.add(vec3(star).mul(u.stars).mul(cover.oneMinus()));
  col = mix(col, lit.mul(mix(float(0.85), float(0.55), u.rain)), cover.mul(0.92));
  sky.colorNode = col;
  const vault = new THREE.Mesh(vaultGeometry({ width, length: long, spring, rise }), sky);
  vault.frustumCulled = false;
  group.add(vault);

  // the rain from the vault, gone well above the candles
  const drops = RAIN[tier] ?? RAIN.high;
  let rainMesh = null;
  if (drops) {
    const geo = new THREE.PlaneGeometry(0.012, 0.55);
    const seeds = new Float32Array(drops * 4);
    for (let i = 0; i < drops; i++) {
      const r = (k) => fractOf(Math.sin((i + 1) * (12.9898 + k * 7.233)) * 43758.5453);
      seeds.set([(r(1) - 0.5) * (width - 2), (r(2) - 0.5) * (long - 4), r(3), r(4)], i * 4);
    }
    geo.setAttribute('aDrop', new THREE.InstancedBufferAttribute(seeds, 4));
    const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    mat.userData.noHouse = true;
    const a = attribute('aDrop', 'vec4');
    const top = spring + rise * 0.7;
    const bottom = 12.0;
    const k = fract(time.mul(a.w.mul(0.3).add(0.7)).add(a.z));
    const y = mix(float(top), float(bottom - 0.6), k);
    const centre = modelViewMatrix.mul(vec4(a.x, y.add(positionGeometry.y), a.y, 1));
    mat.vertexNode = cameraProjectionMatrix.mul(centre.add(vec4(positionGeometry.x, 0, 0, 0)));
    // (fading in under the vault and out a little above the candles’ highest)
    const fade = smoothstep(float(bottom - 0.4), float(bottom + 1.2), y).mul(smoothstep(float(top), float(top - 1.5), y));
    mat.colorNode = vec3(0.55, 0.6, 0.7).mul(fade).mul(u.rain).mul(0.6).mul(abs(uv().x.sub(0.5)).mul(2).oneMinus());
    rainMesh = new THREE.InstancedMesh(geo, mat, drops);
    const ident = new THREE.Matrix4();
    for (let i = 0; i < drops; i++) rainMesh.setMatrixAt(i, ident);
    rainMesh.frustumCulled = false;
    rainMesh.visible = false;
    rainMesh.renderOrder = 4;
    group.add(rainMesh);
  }

  const v3 = (o, a) => o.value.set(a[0], a[1], a[2]);
  return {
    group,
    // the sky outside as the ceiling shows it (skyAt()’s shape, or the world’s own)
    set(s) {
      v3(u.zenith, s.zenith);
      v3(u.horizon, s.horizon);
      v3(u.sunDir, s.sun.dir);
      v3(u.sunColour, s.sun.colour);
      u.sunUp.value = s.sun.up ?? (s.sun.dir[1] > -0.05 ? 1 : 0);
      if (s.moon?.dir) v3(u.moonDir, s.moon.dir);
      u.stars.value = s.stars ?? 0;
      u.cloud.value = s.cloud ?? 0;
      u.rain.value = s.rain ?? 0;
      if (rainMesh) rainMesh.visible = (s.rain ?? 0) > 0.02;
    },
    step() {},
    dispose() {
      vault.geometry.dispose();
      sky.dispose();
      if (rainMesh) {
        rainMesh.geometry.dispose();
        rainMesh.material.dispose();
        rainMesh.dispose?.();
      }
      group.removeFromParent();
    },
  };
}

const fractOf = (v) => v - Math.floor(v);
