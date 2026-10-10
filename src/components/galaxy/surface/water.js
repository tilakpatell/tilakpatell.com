// A world's water, out to the horizon. A sea or a swamp (Scarif's lagoons
// and surf, Kamino's storm, Naboo's lakes, Dagobah's black water) is a disc
// of Gerstner waves round the camera (ocean.js: each world's own swell),
// fine near it and coarse to the horizon; a depth map baked from the ground
// colours the shallows and the sand under them, stands the swell up on the
// beaches where it breaks, and washes foam up to the waterline. The sky in
// it by angle, light through the crests toward the sun, the sun's road,
// whitecaps where the waves pinch. Lava (Mustafar's rivers, glowing,
// crusting over) and a sea of cloud (Bespin, far below the city) stay one
// plane at the site's level; lava lights itself. Where the site's lava names
// the game's film (water.video: 'volcano', Mustafar) and a texture of it is
// handed in (lavaFilm.js: high and ultra only), the film's molten flow runs
// over the shader's own, which stays under it at the crust.
//
// Spray: where a wave runs up one of the water's legs (Kamino's stilts and
// its pad's column, site.water.legs) it throws spray (floats.js says how
// much), and splash(x, z, k) throws a burst (an aiwha going in).
//
// site.water: { level, color, deep, kind, foam?, glow?, legs?: [[x, z, r]…] }
// createWater(site, sunDir, sunColor, { heightAt, small, id, rings, depthN, foam, flow, flipped }) →
//   (rings, depthN: amounts.js's; foam: ultra's finer foam, shore, lava and chop;
//   flow: the lava film's texture, flipped as the game stores it)
//   { mesh, glow, spray, depth, update(t, camera, dt), height(x, z, t),
//     splash(x, z, k), dispose() }

import * as THREE from 'three';
import { FAR, HALF } from './terrain';
import { noiseTexture } from './noiseTex';
import { sprayAt } from './floats';
import { WAVES_GLSL, bakeDepth, discRings, heightAt as waveHeight, seaFor, snapCentre, wavesFor } from './ocean';

const PLANE_VERT = `
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const PLANE_FRAG = `
varying vec3 vWorld;
uniform vec3 uColor, uDeep, uSun, uSunColor, uSky;
uniform float uTime, uKind, uFoam, uGlow, uWaves, uWaves2;
#include <fog_pars_fragment>
uniform sampler2D uNoise;
#ifdef VIDEO
uniform sampler2D uFlow;
uniform float uFlowFlip;
#endif
float wFbm(vec2 p) { vec4 a = texture2D(uNoise, p * 0.08); vec4 b = texture2D(uNoise, p * 0.19 + 0.37); return a.r * 0.35 + a.g * 0.3 + b.b * 0.2 + b.a * 0.15; }
void main() {
  vec2 xz = vWorld.xz;
  float dist = length(vWorld - cameraPosition);
  vec3 view = normalize(cameraPosition - vWorld);
  vec3 c;
  if (uKind > 1.5) {
    // lava: hot channels under a crust that cracks and drifts
    float flow = wFbm(xz * 0.05 + vec2(uTime * 0.02, uTime * 0.013));
    float crust = smoothstep(0.42, 0.62, wFbm(xz * 0.11 - vec2(uTime * 0.03, 0.0)));
    vec3 hot = mix(uColor, vec3(1.0, 0.85, 0.4), smoothstep(0.55, 0.8, flow));
    c = mix(hot * uGlow * (0.8 + 0.4 * flow), uDeep, crust * 0.85);
#ifdef VIDEO
    // the game's lava film (MT_Volcano2), a tile every 48 m, drifting with
    // the flow; the crust keeps its dark plates over it
    vec2 fuv = fract(xz / 48.0 + vec2(uTime * 0.004, uTime * 0.0027));
    if (uFlowFlip > 0.5) fuv.y = 1.0 - fuv.y;
    vec3 molten = texture2D(uFlow, fuv).rgb;
    // (the film is bright already: lifted a little by the glow, not by all of it)
    c = mix(c, molten * (0.55 + 0.25 * uGlow), 0.65 * (1.0 - crust * 0.55));
#endif
#ifdef FINE
    // close up: the crust broken into plates, glowing at the cracks between
    // them, and a finer skin on the plates
    float near = 1.0 - smoothstep(30.0, 260.0, dist);
    float plates = wFbm(xz * 0.42 + vec2(uTime * 0.01, 0.0));
    float crack = 1.0 - smoothstep(0.0, 0.035, abs(plates - 0.5));
    c += mix(uColor, vec3(1.0, 0.75, 0.3), 0.4) * uGlow * crack * crust * near * 0.9;
    c *= 1.0 - (wFbm(xz * 1.6) - 0.5) * 0.35 * crust * near;
#endif
  } else {
    // water (or cloud): waves in the light, darker looking down into it
    float e = 0.6;
    vec2 p = xz * 0.09 * uWaves;
    float t = uTime * 0.6;
    float h0 = wFbm(p + vec2(t * 0.3, t * 0.2));
    float hx = wFbm(p + vec2(e * 0.09, 0.0) + vec2(t * 0.3, t * 0.2));
    float hz = wFbm(p + vec2(0.0, e * 0.09) + vec2(t * 0.3, t * 0.2));
    if (uKind > 0.5) {
      // a cloud sea: a second, broader layer drifting the other way under
      // the first, so the sea has depth
      vec2 p2 = xz * 0.09 * uWaves2;
      vec2 d2 = vec2(t * -0.18, t * -0.12);
      float g0 = wFbm(p2 + d2);
      h0 = h0 * 0.6 + g0 * 0.4;
      hx = hx * 0.6 + wFbm(p2 + vec2(e * 0.09, 0.0) + d2) * 0.4;
      hz = hz * 0.6 + wFbm(p2 + vec2(0.0, e * 0.09) + d2) * 0.4;
    }
    float fade = 1.0 - smoothstep(80.0, 900.0, dist);
    vec3 n = normalize(vec3((h0 - hx) * 3.0 * fade, 1.0, (h0 - hz) * 3.0 * fade));
#ifdef FINE
    // a second, finer chop over the waves, close up
    vec2 q = xz * 0.31 * uWaves + vec2(t * -0.4, t * 0.25);
    float c0 = wFbm(q);
    n = normalize(n + vec3(c0 - wFbm(q + vec2(0.06, 0.0)), 0.0, c0 - wFbm(q + vec2(0.0, 0.06))) * 2.0 * (1.0 - smoothstep(20.0, 200.0, dist)));
#endif
    float facing = clamp(dot(n, view), 0.0, 1.0);
    float fresnel = pow(1.0 - facing, 4.0);
    c = mix(uDeep, uColor, 0.35 + 0.65 * (1.0 - facing));
    c = mix(c, uSky, fresnel * 0.75);
    vec3 h = normalize(uSun + view);
    float spec = pow(max(dot(n, h), 0.0), uKind > 0.5 ? 40.0 : 220.0);
    c += uSunColor * spec * (uKind > 0.5 ? 0.25 : 1.6);
    // the cloud sea's glints: the sun's way, caught on the tops
    if (uKind > 0.5) {
      float glint = pow(max(dot(reflect(-view, n), uSun), 0.0), 48.0) * 0.8;
      c += uSunColor * glint * smoothstep(0.45, 0.7, h0);
    }
    // foam, in streaks
    c = mix(c, vec3(0.92), smoothstep(0.72, 0.8, wFbm(p * 2.3 + t * 0.4)) * uFoam * fade);
  }
  gl_FragColor = vec4(c, 1.0);
  #include <fog_fragment>
}`;

const KIND = { sea: 0, swamp: 0, clouds: 1, lava: 2, salt: 0 };

export function createWater(site, sunDir, sunColor, opts = {}) {
  const w = site.water;
  if (w.kind === 'sea' || w.kind === 'swamp' || w.kind === 'salt') return createSea(site, sunDir, sunColor, opts);
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uColor: { value: new THREE.Color(w.color) },
      uDeep: { value: new THREE.Color(w.deep ?? w.color) },
      uSun: { value: sunDir.clone() },
      uSunColor: { value: new THREE.Color(sunColor) },
      uSky: { value: new THREE.Color(site.sky.horizon) },
      uTime: { value: 0 },
      uKind: { value: KIND[w.kind] ?? 0 },
      uFoam: { value: w.foam ?? (w.kind === 'sea' ? 0.5 : 0) },
      uGlow: { value: w.glow ?? 3 },
      uWaves: { value: w.waves ?? (w.kind === 'swamp' ? 2.2 : w.kind === 'clouds' ? 0.12 : 1) },
      uWaves2: { value: (w.waves ?? (w.kind === 'swamp' ? 2.2 : w.kind === 'clouds' ? 0.12 : 1)) * 2.3 },
      uNoise: { value: noiseTexture() },
    },
  ]);
  const video = w.kind === 'lava' && opts.flow ? opts.flow : null;
  if (video) {
    // (merge clones a uniform's value; the film's texture is shared, not copied)
    uniforms.uFlow = { value: video };
    uniforms.uFlowFlip = { value: opts.flipped ? 1 : 0 };
  }
  const defines = { ...(opts.foam ? { FINE: '' } : {}), ...(video ? { VIDEO: '' } : {}) };
  const material = new THREE.ShaderMaterial({ vertexShader: PLANE_VERT, fragmentShader: PLANE_FRAG, uniforms, fog: true, defines });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(FAR * 2.2, FAR * 2.2, 1, 1).rotateX(-Math.PI / 2), material);
  mesh.position.y = w.level;
  mesh.receiveShadow = false;
  mesh.name = 'water';
  // lava lights what's round it
  const glow = w.kind === 'lava' ? new THREE.HemisphereLight('#000000', '#ff6a1a', 0.9) : null;
  return {
    mesh,
    glow,
    update(t) {
      uniforms.uTime.value = t;
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}

// ── The sea and the swamp ──

const SEA_VERT = (waves) => `
uniform vec2 uCentre;
uniform sampler2D uDepth;
uniform float uHalf, uMax, uReach, uBreakers, uLevel, uTime;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vPinch;
varying float vDepth;
varying float vCrest;
varying float vShore;
#include <fog_pars_vertex>
${WAVES_GLSL(waves)}
// the depth there, and how far from the waterline (open sea past the map)
vec2 depthAt(vec2 p) {
  vec2 uv = (p + uHalf) / (2.0 * uHalf);
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec2(uMax, uReach);
  return texture2D(uDepth, uv).rg * vec2(uMax, uReach);
}
// (ocean.js's damp: still on the sand, standing up in the shallows)
float shoal(float d) {
  if (d <= 0.0) return 0.0;
  return smoothstep(0.0, 1.2, d) * (1.0 + uBreakers * 0.45 * (1.0 - smoothstep(1.5, 9.0, d)));
}
void main() {
  vec2 p = position.xz + uCentre;
  vec2 dw = depthAt(p);
  float depth = dw.x;
  vec3 n;
  float pinch;
  vec3 d = gerstner(p, length(position.xz), shoal(depth), n, pinch);
  vWorld = vec3(p.x, uLevel, p.y) + d;
  vNormal = n;
  vPinch = pinch;
  vDepth = depth;
  vCrest = d.y;
  vShore = dw.y;
  vec4 mvPosition = viewMatrix * vec4(vWorld, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const SEA_FRAG = `
uniform vec3 uColor, uDeep, uShallow, uBed, uSun, uSunColor, uZenith, uHorizon, uFar;
uniform float uFarMix, uSkyMix;
uniform float uTime, uClarity, uCaps, uShore, uBreakers, uGlint, uRough, uScum;
uniform sampler2D uNoise;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vPinch;
varying float vDepth;
varying float vCrest;
varying float vShore;
#include <fog_pars_fragment>
void main() {
  vec3 toEye = cameraPosition - vWorld;
  float dist = length(toEye);
  vec3 V = toEye / dist;
  vec2 w = vWorld.xz;
  // fine ripples: two layers of the noise tile sliding past each other
  float near = 1.0 / (1.0 + dist * 0.01);
  vec4 r1 = texture2D(uNoise, w * 0.045 + uTime * vec2(0.012, 0.008));
  vec4 r2 = texture2D(uNoise, w * 0.11 - uTime * vec2(0.018, 0.011));
  vec2 rip = ((r1.rg - 0.5) * 0.9 + (r2.ba - 0.5) * 0.6) * uRough * (0.3 + 0.7 * near);
  vec3 N = normalize(vNormal + vec3(rip.x, 0.0, rip.y));
  // mirror or water, by the angle you look at it
  float facing = max(dot(N, V), 0.0);
  float fresnel = 0.02 + 0.98 * pow(1.0 - facing, 5.0);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.8, abs(R.y)), 0.6));
  // the body: dark in the troughs, lit where a crest stands between you and
  // the sun, then the shallows' colour, then the bed showing through
  float crest = smoothstep(-0.5, 1.5, vCrest);
  vec3 sunFlat = normalize(vec3(uSun.x, 0.0, uSun.z) + vec3(1e-4));
  float through = pow(max(dot(V, -sunFlat), 0.0), 3.0) * crest;
  vec3 body = mix(uDeep, uColor, 0.35 + crest * 0.4 + through * 0.8);
  float shallow = exp(-vDepth / max(uClarity, 0.1));
  body = mix(body, uShallow, smoothstep(0.02, 0.6, shallow) * 0.85);
  body = mix(body, uBed, pow(shallow, 4.0) * 0.7);
  // (a sea that keeps its colour out to the horizon, where the sky in it
  // would wash it pale: Scarif's)
  body = mix(body, uFar, smoothstep(40.0, 500.0, dist) * uFarMix * (1.0 - shallow));
  vec3 col = mix(body, sky, fresnel * (1.0 - shallow * 0.4) * uSkyMix);
  // the sun's road on the water
  vec3 H = normalize(uSun + V);
  col += uSunColor * pow(max(dot(N, H), 0.0), 260.0) * uGlint * (0.3 + 0.7 * near);
  // foam: whitecaps where the waves pinch, the crests breaking in the surf,
  // and the wash running up to the waterline in bands, with lace at its edge
  vec4 n1 = texture2D(uNoise, w * 0.06 + uTime * vec2(0.01, 0.006));
  vec4 n2 = texture2D(uNoise, w * 0.21 - uTime * vec2(0.008, 0.012));
  float lumpy = n1.b * 0.6 + n2.a * 0.4;
  float wet = step(0.001, vDepth);
  float caps = smoothstep(0.82, 0.55, vPinch) * smoothstep(0.42, 0.66, lumpy) * uCaps;
  // (by the distance from the waterline, so a gentle beach's surf is as
  // narrow as a steep one's: breakers 5–28 m out, the wash in the last 9 m,
  // its bands running in toward the sand, lace along the edge)
  float surf = smoothstep(3.0, 7.0, vShore) * (1.0 - smoothstep(18.0, 30.0, vShore)) * wet;
  float breaking = surf * smoothstep(0.05, 0.45, vCrest) * uBreakers * smoothstep(0.35, 0.62, lumpy);
  float wash = (1.0 - smoothstep(2.0, 9.0, vShore)) * (0.5 + 0.5 * sin(vShore * 1.15 + uTime * 1.5 + lumpy * 2.5));
  wash = smoothstep(0.62, 0.92, wash) * uShore * wet;
  float lace = (1.0 - smoothstep(0.4, 2.2, vShore)) * uShore * 0.85 * wet;
  float foam = clamp(max(max(caps, breaking), max(wash, lace) * smoothstep(0.25, 0.55, lumpy + 0.2)), 0.0, 1.0);
#ifdef FOAM_DETAIL
  // the foam close up: bubbles and holes in it at two finer sizes, and a
  // thin bright lace where the wash's last band thins out over the sand
  vec4 f1 = texture2D(uNoise, w * 0.9 + uTime * vec2(0.03, -0.02));
  vec4 f2 = texture2D(uNoise, w * 2.7 - uTime * vec2(0.02, 0.035));
  float cells = smoothstep(0.3, 0.7, f1.g * 0.6 + f2.r * 0.4);
  float nearF = 1.0 - smoothstep(25.0, 120.0, dist);
  foam *= mix(1.0, 0.45 + 0.75 * cells, nearF);
  float edge = (1.0 - smoothstep(0.0, 1.2, vShore)) * smoothstep(0.45, 0.6, f2.b) * wet * uShore;
  foam = max(foam, edge * nearF);
#endif
  vec3 foamCol = vec3(0.86, 0.9, 0.92) * (0.55 + 0.6 * max(dot(N, uSun), 0.0));
  col = mix(col, foamCol, foam * 0.92);
  // a swamp's skin: scum and duckweed in patches
  float scum = smoothstep(0.55, 0.75, n1.r * 0.7 + r2.g * 0.3) * uScum;
  col = mix(col, uBed * 1.4 + vec3(0.03, 0.05, 0.0), scum * 0.7);
#ifdef FOAM_DETAIL
  // the shore blended: the last few centimetres of water clear over the
  // bed, so the waterline is a soft wet edge, not a line where two meshes meet
  float clear = 1.0 - smoothstep(0.0, 0.35, vDepth);
  col = mix(col, uBed * 0.8, clear * 0.55 * (1.0 - foam));
#endif
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`;

function discGeometry({ radii, around }) {
  const pos = new Float32Array(radii.length * around * 3);
  radii.forEach((r, i) => {
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2 + (i % 2) * (Math.PI / around);
      const o = (i * around + j) * 3;
      pos[o] = Math.cos(a) * r;
      pos[o + 2] = Math.sin(a) * r;
    }
  });
  const index = [];
  for (let i = 0; i < radii.length - 1; i++)
    for (let j = 0; j < around; j++) {
      const a = i * around + j;
      const b = i * around + ((j + 1) % around);
      index.push(a, b, a + around, b, b + around, a + around);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(index);
  return g;
}

function createSea(site, sunDir, sunColor, { heightAt, small = false, id, rings: ringOpts = { small }, depthN = small ? 256 : 512, foam: fine = false } = {}) {
  const w = site.water;
  const sea = seaFor(id, w);
  const waves = wavesFor(sea);
  const rings = discRings(ringOpts);
  // (no ground to bake: all of it deep)
  const depth = bakeDepth(heightAt ?? (() => -Infinity), w.level, { half: HALF, n: depthN, max: 24 });
  const depthTex = new THREE.DataTexture(depth.rg, depth.n, depth.n, THREE.RGFormat, THREE.UnsignedByteType);
  depthTex.magFilter = depthTex.minFilter = THREE.LinearFilter;
  depthTex.wrapS = depthTex.wrapT = THREE.ClampToEdgeWrapping;
  depthTex.colorSpace = THREE.NoColorSpace;
  depthTex.needsUpdate = true;
  const sun = new THREE.Color(sunColor);
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uCentre: { value: new THREE.Vector2() },
      uHalf: { value: depth.half },
      uMax: { value: depth.max },
      uReach: { value: depth.reach },
      uLevel: { value: w.level },
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(w.color) },
      uDeep: { value: new THREE.Color(w.deep ?? w.color) },
      uShallow: { value: new THREE.Color(sea.shallow) },
      uBed: { value: new THREE.Color(sea.bed) },
      uSun: { value: sunDir.clone() },
      uSunColor: { value: sun.multiplyScalar(sea.glint > 0.5 ? 2.2 : 1) },
      uZenith: { value: new THREE.Color(site.sky.zenith ?? site.sky.horizon) },
      uHorizon: { value: new THREE.Color(site.sky.horizon) },
      uClarity: { value: sea.clarity },
      uCaps: { value: sea.caps * (w.foam != null ? 0.5 + w.foam : 1) },
      uShore: { value: sea.shore },
      uBreakers: { value: sea.breakers },
      uGlint: { value: sea.glint },
      uRough: { value: sea.rough },
      uScum: { value: sea.scum ?? 0 },
      uFar: { value: new THREE.Color(sea.far ?? w.deep ?? w.color) },
      uFarMix: { value: sea.far ? (sea.farMix ?? 0.5) : 0 },
      uSkyMix: { value: sea.sky ?? 1 },
    },
  ]);
  // (the textures after the merge, which would clone them)
  uniforms.uDepth = { value: depthTex };
  uniforms.uNoise = { value: noiseTexture() };
  // (ultra: the foam's lace and the wash finer, the shore blended into the sand: FOAM_DETAIL)
  const material = new THREE.ShaderMaterial({ vertexShader: SEA_VERT(waves), fragmentShader: SEA_FRAG, uniforms, fog: true, defines: fine ? { FOAM_DETAIL: '' } : {} });
  const mesh = new THREE.Mesh(discGeometry(rings), material);
  mesh.frustumCulled = false; // (it goes where the camera goes)
  mesh.receiveShadow = false;
  mesh.name = 'water';
  const height = (x, z, t = uniforms.uTime.value) => w.level + waveHeight(x, z, t, waves, depth.at(x, z), sea);
  const spray = createSpray(small ? 260 : 700);
  // (each leg read at a few points round it, the water there last frame)
  const legs = (w.legs ?? []).map(([x, z, r]) => ({ x, z, r, at: Array.from({ length: 6 }, (_, i) => ({ a: (i / 6) * Math.PI * 2, h: w.level, owed: 0 })) }));
  let lastT = null;
  return {
    mesh,
    glow: null,
    spray: spray.points,
    depth,
    update(t, camera) {
      const dt = lastT == null ? 0 : t - lastT;
      lastT = t;
      uniforms.uTime.value = t;
      if (camera) {
        const [x, z] = snapCentre(camera.position.x, camera.position.z, rings.step);
        uniforms.uCentre.value.set(x, z);
      }
      if (!(dt > 0) || dt > 0.5) return;
      for (const leg of legs) {
        // (spray far off isn't seen through the rain)
        if (camera && Math.hypot(camera.position.x - leg.x, camera.position.z - leg.z) > 420) continue;
        for (const p of leg.at) {
          const x = leg.x + Math.cos(p.a) * leg.r;
          const z = leg.z + Math.sin(p.a) * leg.r;
          const h = height(x, z, t);
          const k = sprayAt(h, p.h, dt, { level: w.level });
          p.h = h;
          p.owed += k * dt * 90;
          for (; p.owed >= 1; p.owed -= 1) spray.emit(x, h, z, Math.cos(p.a), Math.sin(p.a), 3 + k * 7);
        }
      }
      spray.step(dt);
    },
    // the water's surface there and then (what's drawn, to a few cm)
    height,
    // a burst of spray: something going into the water, or coming out
    splash(x, z, k = 1) {
      const h = height(x, z);
      for (let i = 0; i < 50 * k; i++) {
        const a = Math.random() * Math.PI * 2;
        spray.emit(x + Math.cos(a) * 2, h, z + Math.sin(a) * 2, Math.cos(a), Math.sin(a), 5 + Math.random() * 8 * k);
      }
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
      depthTex.dispose();
      spray.dispose();
    },
  };
}

// Spray: soft white drops thrown out and up, falling back, gone in two
// seconds; one draw for all of them
let puffTex = null;
function puff() {
  if (puffTex) return puffTex;
  // (a soft round dot, white, fading out from its middle; made in numbers,
  // not on a canvas, so it's made the same anywhere)
  const n = 32;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) / (n / 2);
      const i = (y * n + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(255 * Math.max(0, 1 - d) ** 1.6 * 0.95);
    }
  puffTex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  puffTex.magFilter = puffTex.minFilter = THREE.LinearFilter;
  puffTex.needsUpdate = true;
  return puffTex;
}

function createSpray(n) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3).fill(-1e6);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const vel = new Float32Array(n * 3);
  const age = new Float32Array(n).fill(99);
  const material = new THREE.PointsMaterial({ color: '#e8f0f4', map: puff(), size: 2.6, transparent: true, opacity: 0.6, depthWrite: false, sizeAttenuation: true, fog: true });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.name = 'spray';
  let next = 0;
  let live = 0;
  return {
    points,
    // a drop at (x, y, z), thrown out along (dx, dz) and up at `up` m/s
    emit(x, y, z, dx, dz, up) {
      const i = next++ % n;
      const out = 1.5 + Math.random() * 3;
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      vel[i * 3] = dx * out + (Math.random() - 0.5) * 2;
      vel[i * 3 + 1] = up * (0.6 + Math.random() * 0.6);
      vel[i * 3 + 2] = dz * out + (Math.random() - 0.5) * 2;
      age[i] = 0;
      live = 2;
    },
    step(dt) {
      if (!live) return;
      let any = false;
      for (let i = 0; i < n; i++) {
        if (age[i] > 2) continue;
        age[i] += dt;
        if (age[i] > 2) {
          pos[i * 3 + 1] = -1e6;
          continue;
        }
        any = true;
        vel[i * 3 + 1] -= 9.8 * dt;
        const drag = Math.exp(-dt * 0.8);
        vel[i * 3] *= drag;
        vel[i * 3 + 2] *= drag;
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      }
      geo.attributes.position.needsUpdate = true;
      // (one more frame to park the last of them, then nothing to do)
      if (!any) live -= 1;
    },
    dispose() {
      geo.dispose();
      material.dispose();
    },
  };
}
