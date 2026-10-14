// The rooms’ own shaders as GLSL, as the rooms drew them on the classic
// renderer: kept for the parity check (scripts/twin-parity/cases/deathstar.js)
// and the twins’ tests, never imported by the world (its 'nodes' closure
// reaches ../nodes/rooms.js instead, the same factories as nodes).
//
//   glowMaterial({ color, base, fall, strength, rim, axis, radius, top, soft })   the shafts’ light, added
//     (rooms/shaft/depths.js’s header says what each option does); uniforms.uTime runs bands up it
//   hazeMaterial({ color, strength, flat })   light in the air (or on a floor, flat), added (rooms/deep/parts.js);
//     uniforms uTime, uStrength
//   bayField() · ds2Field()   the magnetic field across a bay’s mouth, aboard the first station and the second
//     (rooms/hangar.js, rooms/ds2/space.js); uniforms.uTime
//   waterSurface(params) → { material, uniforms: { uTime, uRipple } }   the compactor’s murky water, a
//     MeshStandardMaterial(params) whose normal map is sampled twice drifting two ways, with the
//     dianoga’s rings (rooms/deep/compactor.js)
//   starPoints(pos, colour, map, { size }) → Points   the stars past a bay’s mouth, `size` pixels across

import * as THREE from 'three';

// ── the shafts’ glow ──

const GLOW_VERT = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

// Light thinning out exponentially up from its source, in slow bands
// climbing it; a haze fades towards where it is seen edge-on (its
// silhouette, where the eye passes through little of it), a disc fades
// out to its rim.
const GLOW_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uBase;
uniform float uFall;
uniform float uStrength;
uniform float uRim;
uniform float uTime;
uniform vec3 uAxis;
uniform float uRadius;
uniform float uTop;
uniform float uSoft;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  float h = max(0.0, vWorld.y - uBase);
  float density = exp(-h / uFall);
  vec3 v = normalize(cameraPosition - vWorld);
  float face = abs(dot(normalize(vNormal), v));
  float edge = mix(1.0, pow(face, 1.6), uRim);
  float fade = uRadius > 0.0 ? 1.0 - smoothstep(0.0, uRadius, length(vWorld.xz - uAxis.xz)) : 1.0;
  float bands = 0.82 + 0.18 * sin(vWorld.y * 0.9 - uTime * 2.2);
  float a = uStrength * density * edge * fade * fade * bands * (1.0 - smoothstep(uTop - uSoft, uTop, vWorld.y));
  // (alpha 1 under additive blending adds the colour times a, not times a squared)
  gl_FragColor = vec4(uColor * a, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function glowMaterial({ color = 0xbfdcff, base = 0, fall = 10, strength = 1, rim = true, axis = { x: 0, z: 0 }, radius = 0, top = Infinity, soft = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uBase: { value: base },
      uFall: { value: fall },
      uStrength: { value: strength },
      uRim: { value: rim ? 1 : 0 },
      uTime: { value: 0 },
      uAxis: { value: new THREE.Vector3(axis.x, 0, axis.z) },
      uRadius: { value: radius },
      uTop: { value: Number.isFinite(top) ? top : 1e9 },
      uSoft: { value: soft },
    },
    vertexShader: GLOW_VERT,
    fragmentShader: GLOW_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
}

// ── light in the air ──

const HAZE_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
varying vec3 vW;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = -mv.xyz;
  vN = normalMatrix * normal;
  vW = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * mv;
}`;

// motes drifting in it, and (unless it lies flat) brightest where it is
// seen through most of its depth, so a cone or a slab has no hard edge
const HAZE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
uniform float uTime;
uniform float uFlat;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
varying vec3 vW;
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), u.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), u.x), u.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), u.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}
void main() {
  float face = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
  float sides = smoothstep(0.0, 0.3, vUv.x) * smoothstep(0.0, 0.3, 1.0 - vUv.x);
  float shape = mix(face, sides, uFlat);
  float along = smoothstep(0.0, 0.85, vUv.y);
  float motes = 0.7 + 0.3 * noise(vW * 2.5 + vec3(0.0, -uTime * 0.12, uTime * 0.05));
  float a = uStrength * shape * along * along * motes;
  // added as it is (blending multiplies by alpha, so alpha stays 1 or the light would count twice)
  gl_FragColor = vec4(uColor * a, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function hazeMaterial({ color = 0xdfe8ff, strength = 0.2, flat = false } = {}) {
  return new THREE.ShaderMaterial({
    name: 'ds-haze',
    uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength }, uTime: { value: 0 }, uFlat: { value: flat ? 1 : 0 } },
    vertexShader: HAZE_VERT,
    fragmentShader: HAZE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

// ── the magnetic fields ──

const FIELD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Slow ripples climbing a faint blue sheet, brighter at its rim where the
// emitters hold it; added over what lies beyond, never hiding the stars.
const BAY_FIELD_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uStrength;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  vec2 p = vUv * vec2(28.0, 10.0);
  float n = noise(p + vec2(0.0, uTime * 0.35)) * 0.6 + noise(p * 2.3 - vec2(uTime * 0.5, 0.0)) * 0.4;
  float bands = 0.5 + 0.5 * sin(vUv.y * 60.0 - uTime * 1.6 + n * 3.0);
  float inner = smoothstep(0.0, 0.05, vUv.x) * smoothstep(0.0, 0.05, 1.0 - vUv.x) * smoothstep(0.0, 0.08, vUv.y) * smoothstep(0.0, 0.08, 1.0 - vUv.y);
  float a = uStrength * ((0.3 + 0.7 * bands * n) * (0.45 + 0.55 * inner) + (1.0 - inner) * 0.6);
  gl_FragColor = vec4(uColor * a, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ripples climbing the sheet, added over what lies beyond it so the stars
// still show through; strongest where the emitters at its rim hold it
const DS2_FIELD_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uStrength;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  vec2 p = vUv * vec2(32.0, 11.0);
  float n = noise(p + vec2(0.0, uTime * 0.3)) * 0.6 + noise(p * 2.1 - vec2(uTime * 0.45, 0.0)) * 0.4;
  float bands = 0.5 + 0.5 * sin(vUv.y * 70.0 - uTime * 1.4 + n * 3.0);
  float inner = smoothstep(0.0, 0.04, vUv.x) * smoothstep(0.0, 0.04, 1.0 - vUv.x) * smoothstep(0.0, 0.07, vUv.y) * smoothstep(0.0, 0.07, 1.0 - vUv.y);
  float a = uStrength * ((0.25 + 0.75 * bands * n) * (0.4 + 0.6 * inner) + (1.0 - inner) * 0.7);
  gl_FragColor = vec4(uColor * a, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const field = (fragmentShader, color, strength) =>
  new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(...color) }, uStrength: { value: strength } },
    vertexShader: FIELD_VERT,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
export const bayField = () => field(BAY_FIELD_FRAG, [0.22, 0.52, 1], 0.22);
export const ds2Field = () => field(DS2_FIELD_FRAG, [0.3, 0.55, 1], 0.16);

// ── the compactor’s water ──

export function waterSurface(params) {
  const uniforms = { uTime: { value: 0 }, uRipple: { value: new THREE.Vector3(0, 0, 0) } };
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `varying vec2 vWater;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWater = (modelMatrix * vec4(transformed, 1.0)).xz;');
    const chunk = THREE.ShaderChunk.normal_fragment_maps.replace(
      'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
      `vec3 mapN = normalize( ( texture2D( normalMap, vNormalMapUv + vec2( uTime * 0.013, uTime * 0.006 ) ).xyz * 2.0 - 1.0 )
        + ( texture2D( normalMap, vNormalMapUv * 1.7 + vec2( -uTime * 0.008, uTime * 0.011 ) ).xyz * 2.0 - 1.0 ) );
      vec2 toward = vWater - uRipple.xy;
      float far = length( toward );
      mapN.xy += ( toward / max( far, 0.001 ) ) * vec2( 1.0, -1.0 ) * cos( far * 9.0 - uTime * 3.0 ) * exp( -far * 0.9 ) * uRipple.z;`,
    );
    shader.fragmentShader = `uniform float uTime;\nuniform vec3 uRipple;\nvarying vec2 vWater;\n${shader.fragmentShader}`.replace('#include <normal_fragment_maps>', chunk);
  };
  m.customProgramCacheKey = () => 'ds-water';
  return { material: m, uniforms };
}

// ── the stars past a mouth ──

export function starPoints(pos, colour, map, { size = 2.2 } = {}) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colour, 3));
  const material = new THREE.PointsMaterial({ size, sizeAttenuation: false, map, vertexColors: true, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  return new THREE.Points(geo, material);
}
