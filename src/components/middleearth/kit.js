// The Middle-earth scenes' common parts, all made in code so nothing is
// downloaded: painted stone and charred hide, fire and smoke as soft
// billboards, a sky to stand under, and the figures (a wizard, a Balrog,
// hobbits and orcs). What holds no shader is ./kitParts.js's; the shaders
// here are GLSL, for the classic renderer (./nodes/kit.js is the same in
// TSL).

import * as THREE from "three";
import { particlePool } from "./kitParts";

export * from "./kitParts";

// ── shaders ──

const GLSL_NOISE = `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + vec2(17.0, 9.0); a *= 0.5; }
    return s;
  }`;
const OUT = `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>`;

// Molten rock, flowing slowly: a dark crust, bright in the channels, and
// hottest round `hot` (x, z).
export function lavaMaterial({
  scale = 0.07,
  heat = 1,
  spot = [0, 0],
  reach = 0.004,
} = {}) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uScale: { value: scale },
        uHeat: { value: heat },
        uSpot: { value: new THREE.Vector2(spot[0], spot[1]) },
        uReach: { value: reach },
      },
    ]),
    fog: true,
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform float uTime, uScale, uHeat, uReach;
      uniform vec2 uSpot;
      varying vec3 vWorld;
      ${GLSL_NOISE}
      void main() {
        vec2 p = vWorld.xz * uScale;
        vec2 flow = vec2(uTime * 0.02, uTime * 0.012);
        float w = fbm(p * 1.5 + flow);
        float n = fbm(p * 3.0 + vec2(w * 1.6, -w * 1.2) - flow * 1.5);
        float crack = smoothstep(0.44, 0.6, n);
        float core = smoothstep(0.6, 0.78, n);
        vec3 col = mix(vec3(0.03, 0.01, 0.006), vec3(1.5, 0.3, 0.04), crack);
        col = mix(col, vec3(3.0, 1.35, 0.3), core);
        vec2 d = vWorld.xz - uSpot;
        col *= (0.5 + 0.95 * exp(-dot(d, d) * uReach)) * uHeat;
        gl_FragColor = vec4(col, 1.0);
        ${OUT}
        #include <fog_fragment>
      }`,
  });
}

// What is behind everything: three colours up the sky, and (for Mordor)
// slow cloud lit from underneath towards `glow`.
export function skyDome(
  radius,
  {
    top = 0x020101,
    horizon = 0x120704,
    bottom = 0x7a2408,
    cloud = 0,
    glow = [1, 0, 0],
    glowColor = 0xff5a14,
  } = {},
) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(top) },
      uHorizon: { value: new THREE.Color(horizon) },
      uBottom: { value: new THREE.Color(bottom) },
      uCloud: { value: cloud },
      uGlowDir: { value: new THREE.Vector3(...glow).normalize() },
      uGlow: { value: new THREE.Color(glowColor) },
      uFlash: { value: 0 },
      uTime: { value: 0 },
    },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader:
      "varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `
      uniform vec3 uTop, uHorizon, uBottom, uGlowDir, uGlow;
      uniform float uCloud, uTime, uFlash;
      varying vec3 vDir;
      ${GLSL_NOISE}
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = d.y > 0.0 ? mix(uHorizon, uTop, pow(d.y, 0.55)) : mix(uHorizon, uBottom, pow(-d.y, 0.7));
        if (uCloud > 0.0) {
          vec2 p = d.xz / (abs(d.y) + 0.22);
          float c = fbm(p * 1.4 + vec2(uTime * 0.012, 0.0));
          c = smoothstep(0.34, 0.74, fbm(p * 2.6 + c * 1.8 - vec2(uTime * 0.02, uTime * 0.006)));
          float near = pow(max(0.0, dot(d, uGlowDir)), 3.0);
          vec3 lit = mix(uHorizon * 1.6, uGlow, near) * (0.35 + 0.65 * c);
          col = mix(col, lit, uCloud * smoothstep(-0.02, 0.2, d.y) * (0.35 + 0.65 * c));
          col += uGlow * near * near * 0.35;
          col += vec3(0.8, 0.75, 1.0) * uFlash * c * smoothstep(0.0, 0.5, d.y);
        }
        gl_FragColor = vec4(col, 1.0);
        ${OUT}
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 20), mat);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  return dome;
}

// The particles' material: a soft round billboard, its colour and alpha per
// instance (./kitParts.js's pool writes them).
const particleMaterial = ({ stretch, additive }) =>
  new THREE.ShaderMaterial({
    uniforms: { uStretch: { value: stretch } },
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: `
      attribute vec4 aAt;
      attribute vec4 aColor;
      uniform float uStretch;
      varying vec2 vUv;
      varying vec4 vColor;
      void main() {
        vUv = position.xy;
        vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(aAt.xyz, 1.0);
        mv.xy += position.xy * aAt.w * vec2(1.0, uStretch);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec2 vUv;
      varying vec4 vColor;
      void main() {
        float a = smoothstep(1.0, 0.0, length(vUv) * 2.0);
        gl_FragColor = vec4(vColor.rgb, a * a * vColor.a);
        ${OUT}
      }`,
  });

export const createParticles = (max, opts) =>
  particlePool(particleMaterial, max, opts);
