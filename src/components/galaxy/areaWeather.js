// The storm in a level's area of its own (levelArea.js: Kamino's, over
// Tipoca City), from the level's own extras (scripts/bf2017-area.mjs's
// area.json, beside its pack): its lamps as glows (the bloom takes them),
// its beacons blinking red, lightning where the level strikes (a jagged
// bolt from the clouds to the sea, and a flash the scene's light and the
// sky take: `flash`), the clouds the level backlights glowing with it, and
// rain round the camera blown on the level's wind. Every part one draw.
//
//   createAreaWeather(group, { data, frame, at, sea, wind, rand }) →
//     { flash, strikeAt, update(dt, t, camera), strike(i?), dispose() }
//   (`data`: area.json; `frame`: the level's metres → the battle's units;
//   `at`: the area's middle, the group's place; `sea`: the water's height;
//   `wind`: { dir (radians, the way it blows from), strength } the record's)

import * as THREE from 'three';
import { METRES } from './surface/missions/starfighter';

const GLOW_VERT = `
attribute vec3 aColor;
attribute float aSize;
attribute float aPhase;
uniform float uTime, uScale, uBlink, uFlash;
varying vec3 vColor;
varying float vOn;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // (a beacon on for a third of each 1.6 s, each at its own moment)
  float on = uBlink > 0.5 ? step(0.66, fract(uTime / 1.6 + aPhase)) : 1.0;
  vOn = on * (1.0 + uFlash);
  vColor = aColor;
  gl_PointSize = aSize * uScale / max(0.001, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const GLOW_FRAG = `
uniform float uGain;
varying vec3 vColor;
varying float vOn;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = dot(p, p) * 4.0;
  float a = exp(-d * 4.0);
  if (a < 0.01 || vOn <= 0.0) discard;
  gl_FragColor = vec4(vColor * a * uGain * vOn, 1.0);
}`;

const RAIN_VERT = `
attribute float aEnd;
uniform vec3 uCam, uFall;
uniform float uTime, uBox;
varying float vEnd;
void main() {
  // (each drop's place wraps round the camera in a box, so the rain is always where you are)
  vec3 p = position + uFall * uTime;
  p = mod(p - uCam + uBox * 0.5, uBox) + uCam - uBox * 0.5;
  p -= normalize(uFall) * aEnd * uBox * 0.035;
  vEnd = aEnd;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const RAIN_FRAG = `
uniform vec3 uColor;
uniform float uFlash;
varying float vEnd;
void main() {
  gl_FragColor = vec4(uColor * (1.0 + uFlash * 2.0), (1.0 - vEnd) * 0.35);
}`;

const BOLT_FRAG = `
uniform float uOn;
void main() {
  gl_FragColor = vec4(vec3(5.0, 6.0, 9.0) * uOn, 1.0);
}`;
const BOLT_VERT = `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// points in the group's frame from the level's metres
const local = (frame, at, p) => frame(p).map((x, k) => x - at[k]);

function points(group, list, { frame, at, color, size, gain, blink = false, rand }) {
  const n = list.length;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const sz = new Float32Array(n);
  const ph = new Float32Array(n);
  list.forEach((g, i) => {
    pos.set(local(frame, at, g.slice(0, 3)), i * 3);
    col.set(color ?? g.slice(3, 6), i * 3);
    sz[i] = (size ?? g[6]) / METRES;
    ph[i] = rand();
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const uniforms = { uTime: { value: 0 }, uScale: { value: 600 }, uBlink: { value: blink ? 1 : 0 }, uFlash: { value: 0 }, uGain: { value: gain } };
  const mesh = new THREE.Points(geo, new THREE.ShaderMaterial({ vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  mesh.frustumCulled = false;
  group.add(mesh);
  return { mesh, uniforms };
}

// a bolt from the clouds down to the sea through `p`: a jagged line, with a branch or two
function boltOf(top, bottom, rand) {
  const out = [];
  const seg = (a, b, n, jag) => {
    let prev = a;
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      const next = i === n ? b : [a[0] + (b[0] - a[0]) * k + (rand() - 0.5) * jag, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k + (rand() - 0.5) * jag];
      out.push(...prev, ...next);
      prev = next;
    }
  };
  const h = top[1] - bottom[1];
  seg(top, bottom, 22, h * 0.08);
  // (drawn three times a hair apart, so a line a pixel wide reads as a bolt)
  const main = out.slice();
  for (const d of [0.06, -0.06]) for (let i = 0; i < main.length; i += 3) out.push(main[i] + d, main[i + 1], main[i + 2] + d);
  for (let b = 0; b < 2; b++) {
    const k = 0.25 + rand() * 0.4;
    const from = [top[0] + (bottom[0] - top[0]) * k, top[1] - h * k, top[2] + (bottom[2] - top[2]) * k];
    seg(from, [from[0] + (rand() - 0.5) * h * 0.5, from[1] - h * 0.3, from[2] + (rand() - 0.5) * h * 0.5], 8, h * 0.05);
  }
  return new Float32Array(out);
}

// (`space`: a space level's area, its lamps and beacons only: no rain, no sea for lightning)
export function createAreaWeather(group, { data, frame, at, sea, wind = null, rand = Math.random, space = false }) {
  const parts = [];
  const glows = data.glows?.length ? points(group, data.glows, { frame, at, gain: 2.4, rand }) : null;
  const beacons = data.blinkers?.length ? points(group, data.blinkers, { frame, at, color: [1, 0.08, 0.04], size: 30, gain: 4, blink: true, rand }) : null;
  const clouds = data.clouds?.length ? points(group, data.clouds, { frame, at, color: [0.35, 0.45, 0.6], size: 900, gain: 0.18, rand }) : null;
  for (const p of [glows, beacons, clouds]) if (p) parts.push(p.mesh);

  // the rain: drops in a box round the camera, falling on the wind
  const N = 1800;
  const BOX = 9; // units (about 480 m)
  const rp = new Float32Array(N * 6);
  const re = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const p = [rand() * BOX, rand() * BOX, rand() * BOX];
    rp.set(p, i * 6);
    rp.set(p, i * 6 + 3);
    re[i * 2] = 0;
    re[i * 2 + 1] = 1;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  rainGeo.setAttribute('aEnd', new THREE.BufferAttribute(re, 1));
  const blow = wind ? Math.min(1, (wind.strength ?? 0) / 8) : 0.3;
  const fall = new THREE.Vector3(-Math.sin(wind?.dir ?? 0) * blow * 1.6, -3.2, -Math.cos(wind?.dir ?? 0) * blow * 1.6);
  const rainU = { uCam: { value: new THREE.Vector3() }, uFall: { value: fall }, uTime: { value: 0 }, uBox: { value: BOX }, uColor: { value: new THREE.Color(0.55, 0.62, 0.7) }, uFlash: { value: 0 } };
  const rain = new THREE.LineSegments(rainGeo, new THREE.ShaderMaterial({ vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG, uniforms: rainU, transparent: true, depthWrite: false, fog: false }));
  rain.frustumCulled = false;
  rain.visible = !space;
  parts.push(rain);
  // (the rain's in world space round the camera, not the group's frame)
  group.parent?.add(rain);

  // lightning: a strike every few seconds at one of the level's places
  const strikes = (data.strikes ?? []).map((p) => local(frame, at, p));
  const seaY = (sea ?? at[1]) - at[1];
  const boltU = { uOn: { value: 0 } };
  const bolt = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.ShaderMaterial({ vertexShader: BOLT_VERT, fragmentShader: BOLT_FRAG, uniforms: boltU, fog: false }));
  bolt.frustumCulled = false;
  bolt.visible = false;
  group.add(bolt);
  parts.push(bolt);
  let next = 2 + rand() * 4;
  let age = Infinity;

  const w = {
    flash: 0, // 0…1, how much the strike lights the storm now
    strikeAt: null, // where it struck, in the group's frame (the flash's light comes from there)
    strike(i = Math.floor(rand() * strikes.length)) {
      const p = strikes[i];
      if (!p) return;
      const top = [p[0] + (rand() - 0.5) * 4, p[1] + 900 / METRES, p[2] + (rand() - 0.5) * 4];
      bolt.geometry.setAttribute('position', new THREE.BufferAttribute(boltOf(top, [p[0], seaY, p[2]], rand), 3));
      bolt.geometry.computeBoundingSphere();
      w.strikeAt = p;
      age = 0;
    },
    update(dt, t, camera) {
      next -= dt;
      if (next <= 0 && strikes.length) {
        w.strike();
        next = 4 + rand() * 9;
      }
      age += dt;
      // (a strike's light: a bright flicker or two in its first half second, then gone)
      const on = age < 0.5 ? (age < 0.08 || (age > 0.16 && age < 0.26) ? 1 : 0.35) * (1 - age / 0.5) : 0;
      w.flash = on;
      bolt.visible = on > 0.05;
      boltU.uOn.value = on;
      for (const p of [glows, beacons, clouds]) {
        if (!p) continue;
        p.uniforms.uTime.value = t;
      }
      if (clouds) clouds.uniforms.uFlash.value = on * 5;
      rainU.uTime.value = t;
      rainU.uFlash.value = on;
      if (camera?.position) rainU.uCam.value.copy(camera.position);
    },
    dispose() {
      for (const m of parts) {
        m.parent?.remove(m);
        m.geometry.dispose();
        m.material.dispose();
      }
    },
  };
  return w;
}
