// Lava, drawn: Mustafar's rivers (one plane at the world's lava level, out
// to the horizon) and Nevarro's pools (a disc in each pit). Where it's
// hottest it's molten, a black body's colours from dull red through orange
// to yellow-white, pulsing, bright enough for the bloom; over the cooler
// stretches a crust of black glassy plates rides on it, lit by the sun, with
// fire in the cracks between them and a red heat under their edges. All of
// it flows: a warped drift, in two phases half a cycle apart, so it never
// stretches. At the banks (lavaRules.js's field: how deep it is) the crust
// thickens and a bright seam runs where the lava meets the rock. Fine detail
// fades with distance before it shimmers, and a small screen draws one
// phase of plates, not two.
//
// createLava({ site, lava (lavaRules.js's lavaOf), field (its bakeLavaField),
//   sunDir, sunColor, small }) → { mesh (a group), glow (a light, or a group
//   of them), texture (the field, for the ground), update(t), dispose() }

import * as THREE from 'three';
import { FAR } from './terrain';
import { noiseTexture } from './noiseTex';

const VERT = `
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = `
varying vec3 vWorld;
uniform vec3 uSun, uSunColor, uCrust;
uniform float uTime, uGlow;
uniform sampler2D uNoise, uField;
uniform vec3 uFieldK;
#include <fog_pars_fragment>

float fbm(vec2 p) {
  vec4 a = texture2D(uNoise, p);
  vec4 b = texture2D(uNoise, p * 2.03 + 0.37);
  return a.r * 0.4 + a.g * 0.3 + b.b * 0.18 + b.a * 0.12;
}
vec2 hash22(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}
// cells (the plates): the distance to the nearest point and to the next,
// and the nearest's own number; the points wander, so the plates turn
vec3 worley(vec2 p, float drift) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 9.0;
  float d2 = 9.0;
  float id = 0.0;
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 h = hash22(i + g);
      vec2 r = g + 0.5 + 0.38 * sin(drift + 6.2831 * h) - f;
      float d = dot(r, r);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = h.x;
      } else if (d < d2) d2 = d;
    }
  return vec3(sqrt(d1), sqrt(d2), id);
}
// a black body's glow: dull red, red, orange, yellow, white
vec3 blackbody(float t) {
  vec3 c = mix(vec3(0.18, 0.012, 0.0), vec3(0.95, 0.12, 0.01), smoothstep(0.0, 0.35, t));
  c = mix(c, vec3(1.0, 0.42, 0.04), smoothstep(0.3, 0.62, t));
  c = mix(c, vec3(1.0, 0.78, 0.3), smoothstep(0.6, 0.88, t));
  return mix(c, vec3(1.0, 0.95, 0.8), smoothstep(0.88, 1.0, t));
}

void main() {
  vec2 xz = vWorld.xz;
  vec3 toEye = cameraPosition - vWorld;
  float dist = length(toEye);
  vec3 V = toEye / dist;
  float far = smoothstep(120.0, 900.0, dist);

  // how deep it is (the field; deep past the walkable square)
  vec2 fuv = xz / (2.0 * uFieldK.x) + 0.5;
  float depth = uFieldK.y;
  if (uFieldK.z > 0.5 && fuv.x > 0.0 && fuv.x < 1.0 && fuv.y > 0.0 && fuv.y < 1.0) depth = max(texture2D(uField, fuv).r * uFieldK.y, 0.0);
  float bank = 1.0 - smoothstep(0.0, 1.6, depth);

  // the flow: a broad drift, two phases half a cycle apart, each faded out
  // as it jumps back
  vec2 dir = (vec2(fbm(xz * 0.0011), fbm(xz * 0.0011 + 0.5)) - 0.5) * 2.0 + vec2(0.35, 0.22);
  float ph = uTime * 0.035;
  float p0 = fract(ph);
  float p1 = fract(ph + 0.5);
  float wa = 1.0 - abs(2.0 * p0 - 1.0);
  vec2 a = xz - dir * p0 * 9.0;
  vec2 b = xz - dir * p1 * 9.0 + vec2(17.3, 9.1);

  // the heat: warped noise, slow and broad (the tile's sums sit near 0.4 to
  // 0.6: stretched to 0 to 1)
  float heat = mix(fbm(b * 0.018 + fbm(b * 0.006) * 0.9), fbm(a * 0.018 + fbm(a * 0.006) * 0.9), wa);
  heat = smoothstep(0.4, 0.6, heat);

  // the plates, about four metres across
  vec3 ca = worley(a * 0.26, uTime * 0.12);
#ifdef LITE
  vec3 cb = ca;
#else
  vec3 cb = worley(b * 0.26, uTime * 0.12 + 2.0);
#endif
  float edge = mix(cb.y - cb.x, ca.y - ca.x, wa);
  float cell = mix(cb.z, ca.z, wa);

  // each plate crusted over or molten, by its own number against how cool it
  // is there (more crust where it's cooler, all of it at the banks)
  float crusted = clamp(1.1 - heat * 1.05, 0.12, 0.95);
  float cover = smoothstep(-0.04, 0.04, crusted - cell);
  cover = max(cover, smoothstep(0.35, 0.9, bank));
  // fire in the cracks between the plates, wider where it's hotter
  float crackW = 0.05 + 0.12 * heat;
  float crack = (1.0 - smoothstep(crackW * 0.35, crackW, edge)) * (1.0 - far);
  float crust = mix(cover * (1.0 - crack), cover * 0.7, far);

  // molten, by its heat, breathing
  float pulse = 0.85 + 0.15 * sin(uTime * 1.3 + heat * 9.0 + cell * 6.2831);
  // streaks of the hottest drawn out along the flow
  vec2 along = normalize(dir);
  vec2 sa = vec2(dot(a, along) * 0.03, dot(a, vec2(-along.y, along.x)) * 0.16);
  vec2 sb = vec2(dot(b, along) * 0.03, dot(b, vec2(-along.y, along.x)) * 0.16);
  float streak = smoothstep(0.52, 0.6, mix(fbm(sb), fbm(sa), wa)) * (1.0 - far);
  float t = clamp(0.2 + heat * 0.34 + streak * 0.3 + crack * cover * 0.3 - bank * 0.08, 0.0, 1.0);
  vec3 molten = blackbody(t) * uGlow * 0.75 * pulse;

  // the crust: black glass, rough, lit by the sun, with a sheen
  float nb = fbm(xz * 0.35);
  vec3 n = normalize(vec3((nb - fbm((xz + vec2(0.4, 0.0)) * 0.35)) * 4.0, 1.0, (nb - fbm((xz + vec2(0.0, 0.4)) * 0.35)) * 4.0));
  n = normalize(mix(n, vec3(0.0, 1.0, 0.0), far));
  vec3 rock = uCrust * (0.55 + 0.45 * fbm(xz * 0.12));
  vec3 crustC = rock * (0.2 + 0.8 * max(dot(n, uSun), 0.0)) * uSunColor;
  crustC += uSunColor * pow(max(dot(n, normalize(uSun + V)), 0.0), 60.0) * 0.22;
  // red heat under each plate's edge
  crustC += blackbody(0.3) * uGlow * (1.0 - smoothstep(0.0, 0.22, edge)) * (1.0 - bank * 0.6) * 0.35;

  vec3 c = mix(molten, crustC, crust);
  // the seam where it meets the bank
  float seam = smoothstep(0.0, 0.25, depth) * (1.0 - smoothstep(0.25, 1.1, depth)) * uFieldK.z;
  c += blackbody(0.75) * uGlow * seam * 0.9 * (1.0 - far);
  gl_FragColor = vec4(c, 1.0);
  #include <fog_fragment>
}`;

export function createLava({ site, lava, field = null, sunDir, sunColor, small = false }) {
  const w = site.water?.kind === 'lava' ? site.water : {};
  let texture = null;
  if (field) {
    texture = new THREE.DataTexture(field.rg, field.n, field.n, THREE.RGFormat, THREE.UnsignedByteType);
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
  }
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uSun: { value: sunDir.clone() },
      uSunColor: { value: new THREE.Color(sunColor) },
      uCrust: { value: new THREE.Color(w.crust ?? '#1c1513') },
      uTime: { value: 0 },
      uGlow: { value: w.glow ?? 2.1 },
      uNoise: { value: null },
      uField: { value: null },
      uFieldK: { value: new THREE.Vector3(field?.half ?? 640, field?.max ?? 8, field ? 1 : 0) },
    },
  ]);
  // (textures in after the merge: it would copy them)
  uniforms.uNoise.value = noiseTexture();
  uniforms.uField.value = texture;
  const material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, fog: true, defines: small ? { LITE: 1 } : {} });
  const mesh = new THREE.Group();
  mesh.name = 'lava';
  const geometries = [];
  const add = (geometry, x, y, z) => {
    geometries.push(geometry);
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.receiveShadow = false;
    mesh.add(m);
  };
  if (lava.level != null) add(new THREE.PlaneGeometry(FAR * 2.2, FAR * 2.2, 1, 1).rotateX(-Math.PI / 2), 0, lava.level, 0);
  for (const p of lava.pools) add(new THREE.CircleGeometry(p.r, 48).rotateX(-Math.PI / 2), p.x, p.level, p.z);
  // it lights what's round it: a world of it from below, a pool by a light of its own
  let glow;
  if (lava.level != null) glow = new THREE.HemisphereLight('#000000', '#ff6a1a', 0.9);
  else {
    glow = new THREE.Group();
    for (const p of lava.pools.slice(0, 4)) {
      const l = new THREE.PointLight('#ff6a1a', p.r * 6, p.r * 2.6, 2);
      l.position.set(p.x, p.level + 2.5, p.z);
      glow.add(l);
    }
  }
  return {
    mesh,
    glow,
    texture,
    update(t) {
      uniforms.uTime.value = t;
    },
    dispose() {
      for (const g of geometries) g.dispose();
      material.dispose();
      texture?.dispose();
    },
  };
}
