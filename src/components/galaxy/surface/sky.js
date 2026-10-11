// A world's sky, from the ground: a dome round the camera drawn by one
// shader. The blue (or the dust, or the murk) from the horizon up, a band of
// haze along the horizon, the sun or suns (Tatooine's two) with their glow,
// the clouds drifting over (lit from the sun's side, thick or thin), the
// stars where it's dark enough, and whatever hangs in the sky: Yavin's gas
// giant over its fourth moon, Endor's over the forest, Tatooine's moons.
// The same dome, without its clouds, is what the scene's shiny things
// reflect (envScene).
//
// site.sky: { zenith, horizon, below?, haze, hazeColor?, suns: [{ az, el,
//   color, size, glow? }], clouds: { cover, color, shade, scale, speed,
//   sharp? } | null, stars: 0…1, bodies: [{ az, el, size, color, color2,
//   bands, lit? }] }
// createSky(site, { clouds }): clouds 1 (ultra, amounts.js) for finer clouds
// with their own shade toward the sun and a high veil over them
// (az: radians round from +z toward +x; el: radians up from the horizon;
// size: the angular radius, radians)

import * as THREE from 'three';
import { noiseTexture } from './noiseTex';
import { MAX_BODIES, MAX_SUNS, dirOf, skyDome } from './skyDome';

export { dirOf };

const VERT = `
varying vec3 vDir;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vDir = world.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * world;
  gl_Position.z = gl_Position.w; // on the far plane, behind everything
}`;

const FRAG = `
varying vec3 vDir;
uniform vec3 uZenith, uHorizon, uBelow, uHaze;
uniform float uHazeK, uStars, uTime, uFlash;
uniform vec3 uSunDir[${MAX_SUNS}];
uniform vec3 uSunColor[${MAX_SUNS}];
uniform vec3 uSunSize[${MAX_SUNS}]; // angular radius, glow, on (0/1)
uniform vec4 uBody[${MAX_BODIES}]; // dir.xyz, angular radius (0: none)
uniform vec3 uBodyC1[${MAX_BODIES}];
uniform vec3 uBodyC2[${MAX_BODIES}];
uniform vec3 uBodyBands[${MAX_BODIES}]; // bands, twist, lit (0/1)
uniform vec4 uCloud; // cover, scale, speed, sharp
uniform vec3 uCloudColor, uCloudShade;
uniform float uWithClouds;

uniform sampler2D uNoise;
float sHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float sNoise(vec2 p) { return texture2D(uNoise, p * 0.25).b; }
float sFbm(vec2 p) { vec4 a = texture2D(uNoise, p * 0.05); vec4 b = texture2D(uNoise, p * 0.11 + 0.3); return a.r * 0.45 + a.g * 0.3 + b.b * 0.15 + b.a * 0.1; }

void main() {
  vec3 dir = normalize(vDir);
  float el = dir.y;
  vec3 c = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.75, el), 0.6));
  c = mix(c, uBelow, smoothstep(0.0, -0.12, el));
  // the haze along the horizon
  c = mix(c, uHaze, exp(-abs(el) * 9.0) * uHazeK);

  // the stars, where the sky's dark enough to show them
  if (uStars > 0.0) {
    vec3 cell = floor(dir * 380.0);
    float s = sHash(cell.xy + cell.z * 7.13);
    float star = step(0.9965, s) * (0.6 + 0.4 * sin(uTime * 2.0 + s * 80.0));
    c += vec3(star) * uStars * smoothstep(0.0, 0.15, el) * 1.4;
  }

  // what hangs in the sky
  for (int i = 0; i < ${MAX_BODIES}; i++) {
    if (uBody[i].w <= 0.0) continue;
    vec3 bd = normalize(uBody[i].xyz);
    float r = uBody[i].w;
    float ang = acos(clamp(dot(dir, bd), -1.0, 1.0));
    if (ang > r * 1.15) continue;
    // where on its disc: x, y across it, z out of it
    vec3 side = normalize(cross(bd, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(side, bd);
    vec2 q = vec2(dot(dir, side), dot(dir, up)) / sin(r);
    float d2 = dot(q, q);
    if (d2 < 1.0) {
      vec3 n = vec3(q, sqrt(1.0 - d2));
      // (the bands wander with the twist, and are broken up by storms and
      // eddies at two sizes, so a giant close over a moon isn't a flat disc)
      float lat = q.y + sin(q.x * 3.0 + q.y * 5.0) * 0.05 * uBodyBands[i].y + (sNoise(q * 9.0) - 0.5) * 0.08 * uBodyBands[i].y + (sFbm(q * 6.0 + 3.0) - 0.5) * 0.14 * uBodyBands[i].y;
      float band = 0.5 + 0.5 * sin(lat * uBodyBands[i].x * 3.14159);
      band += (sFbm(q * 14.0 + 7.0) - 0.5) * 0.35 * step(0.5, uBodyBands[i].x);
      vec3 col = mix(uBodyC1[i], uBodyC2[i], clamp(band, 0.0, 1.0));
      // lit from the first sun's side (as it'd be seen from here)
      vec3 sunLocal = vec3(dot(uSunDir[0], side), dot(uSunDir[0], up), dot(uSunDir[0], bd) * -1.0 + 0.35);
      float lit = mix(1.0, clamp(dot(n, normalize(sunLocal)) * 0.85 + 0.25, 0.08, 1.0), uBodyBands[i].z);
      float limb = smoothstep(1.0, 0.92, d2);
      vec3 body = col * lit;
      // the sky's air in front of it (fainter near the horizon)
      body = mix(body, c, 0.25 + 0.4 * exp(-max(el, 0.0) * 6.0));
      c = mix(c, body, limb);
    }
    // its glow
    c += uBodyC1[i] * 0.08 * smoothstep(r * 1.15, r, ang) * step(1.0, d2);
  }

  // the suns
  for (int i = 0; i < ${MAX_SUNS}; i++) {
    if (uSunSize[i].z <= 0.0) continue;
    float d = dot(dir, uSunDir[i]);
    float r = uSunSize[i].x;
    float disc = smoothstep(cos(r), cos(r * 0.82), d);
    float glow = pow(max(d, 0.0), 12.0) * 0.32 + pow(max(d, 0.0), 220.0) * 0.9;
    c += uSunColor[i] * (glow * uSunSize[i].y + disc * 9.0);
  }

  // the clouds, on a ceiling overhead
  if (uWithClouds > 0.5 && uCloud.x > 0.0 && el > 0.0) {
    vec2 p = dir.xz / (el + 0.06) * uCloud.y + vec2(uTime * uCloud.z, uTime * uCloud.z * 0.4);
    float n = sFbm(p);
#ifdef CLOUDS_HQ
    // (ultra: two finer octaves on the edges, the cloud's billows)
    n += (texture2D(uNoise, p * 0.31 + 0.71).g - 0.5) * 0.16 + (texture2D(uNoise, p * 0.83 + 0.23).r - 0.5) * 0.07;
#endif
    float cover = smoothstep(1.0 - uCloud.x, 1.0 - uCloud.x + 0.35 / uCloud.w, n);
    float thick = smoothstep(0.4, 1.0, n);
    float toSun = pow(max(dot(dir, uSunDir[0]), 0.0), 6.0);
    vec3 cc = mix(uCloudColor, uCloudShade, thick * 0.8);
    cc += uSunColor[0] * toSun * 0.6 * (1.0 - thick);
    cc += vec3(uFlash) * thick;
    float fade = smoothstep(0.0, 0.18, el);
#ifdef CLOUDS_HQ
    // its own shade: darker where more cloud lies between it and the sun
    // (three steps toward it), the thin edges silvered near the sun
    vec2 sunStep = normalize(uSunDir[0].xz + vec2(1e-4)) * 0.22;
    float ahead = 0.0;
    for (int k = 1; k <= 3; k++) ahead += smoothstep(0.45, 0.95, sFbm(p + sunStep * float(k)));
    cc = mix(cc, uCloudShade * 0.85, ahead / 3.0 * 0.45 * (1.0 - toSun));
    cc += uSunColor[0] * pow(max(dot(dir, uSunDir[0]), 0.0), 24.0) * (1.0 - thick) * 0.9;
#endif
    c = mix(c, cc, cover * fade);
#ifdef CLOUDS_HQ
    // a high veil of thin cloud, streaked along the wind, over the rest
    vec2 p2 = dir.xz / (el + 0.14) * uCloud.y * 0.4 + vec2(uTime * uCloud.z * 1.7, 0.0);
    float veil = smoothstep(0.52, 0.85, texture2D(uNoise, p2 * vec2(0.03, 0.12)).b * 0.7 + texture2D(uNoise, p2 * 0.35).a * 0.3);
    c = mix(c, uCloudColor + uSunColor[0] * toSun * 0.3, veil * 0.22 * fade * min(1.0, uCloud.x * 2.0));
#endif
  }
  c += uHaze * uFlash * 0.4;
  gl_FragColor = vec4(c, 1.0);
}`;

export function createSky(site, { clouds = 0 } = {}) {
  const s = site.sky;
  const col = (c, f = '#000000') => new THREE.Color(c ?? f);
  const suns = (s.suns ?? []).slice(0, MAX_SUNS);
  const bodies = (s.bodies ?? []).slice(0, MAX_BODIES);
  const sunDirs = suns.map((x) => dirOf(x.az, x.el));
  const uniforms = {
    uZenith: { value: col(s.zenith) },
    uHorizon: { value: col(s.horizon) },
    uBelow: { value: col(s.below, s.horizon) },
    uHaze: { value: col(s.hazeColor, s.horizon) },
    uHazeK: { value: s.haze ?? 0.5 },
    uStars: { value: s.stars ?? 0 },
    uTime: { value: 0 },
    uFlash: { value: 0 },
    uSunDir: { value: Array.from({ length: MAX_SUNS }, (_, i) => sunDirs[i] ?? new THREE.Vector3(0, 1, 0)) },
    uSunColor: { value: Array.from({ length: MAX_SUNS }, (_, i) => col(suns[i]?.color, '#ffffff')) },
    uSunSize: { value: Array.from({ length: MAX_SUNS }, (_, i) => new THREE.Vector3(suns[i]?.size ?? 0.012, suns[i]?.glow ?? 1, suns[i] ? 1 : 0)) },
    uBody: { value: Array.from({ length: MAX_BODIES }, (_, i) => (bodies[i] ? new THREE.Vector4(...dirOf(bodies[i].az, bodies[i].el).toArray(), bodies[i].size) : new THREE.Vector4())) },
    uBodyC1: { value: Array.from({ length: MAX_BODIES }, (_, i) => col(bodies[i]?.color)) },
    uBodyC2: { value: Array.from({ length: MAX_BODIES }, (_, i) => col(bodies[i]?.color2 ?? bodies[i]?.color)) },
    uBodyBands: { value: Array.from({ length: MAX_BODIES }, (_, i) => new THREE.Vector3(bodies[i]?.bands ?? 0, bodies[i]?.twist ?? 1, bodies[i]?.lit === false ? 0 : 1)) },
    uCloud: { value: new THREE.Vector4(s.clouds?.cover ?? 0, s.clouds?.scale ?? 1.1, s.clouds?.speed ?? 0.01, s.clouds?.sharp ?? 1) },
    uCloudColor: { value: col(s.clouds?.color, '#ffffff') },
    uCloudShade: { value: col(s.clouds?.shade, '#9aa4b4') },
    uWithClouds: { value: 1 },
    uNoise: { value: noiseTexture() },
  };
  // (ultra: finer clouds, their own shade and a high veil: CLOUDS_HQ)
  const material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, side: THREE.BackSide, depthWrite: false, fog: false, defines: clouds ? { CLOUDS_HQ: '' } : {} });
  return skyDome(site, {
    material,
    uniforms,
    cloudless: () => {
      const m = material.clone();
      m.uniforms.uWithClouds = { value: 0 };
      return m;
    },
  });
}
