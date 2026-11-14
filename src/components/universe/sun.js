// The sun in the middle of the map. Its surface is Solar System Scope's map
// set boiling: the map is pushed about by a few layers of slow noise, so the
// granules churn (in a net of thin dark lanes close in), the bright and dark
// patches drift and the hottest go whiter, darker and redder toward the edge
// by the quadratic limb-darkening law, as a real star's disc is; drawn
// brighter than white so bloom (post.js) gives it its glare. Round it
// is the corona: a disc that always faces you, upright, glowing out from the
// edge with long streamers that slowly change, so the light round the sun
// moves.
//
// buildSun(T) → { group, update(t, camera) }

import * as THREE from 'three';
import { SUN } from './layout';
import { faceUpright } from '../../lib/three/upright';

// 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT)
export const NOISE_GLSL = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}`;

const SURFACE_VERT = `
varying vec3 vPos;
varying vec3 vN;
varying vec3 vView;
varying vec2 vUv;
void main() {
  vUv = uv;
  vPos = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const SURFACE_FRAG = `
uniform sampler2D uMap;
uniform float uHasMap;
uniform float uTime;
uniform float uHeat;
varying vec3 vPos;
varying vec3 vN;
varying vec3 vView;
varying vec2 vUv;
${NOISE_GLSL}
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
  vec3 p = normalize(vPos) * 2.6;
  float t = uTime * 0.04;
  // the surface pushed about: big slow cells, then the granules on them
  vec3 w = vec3(snoise(p + vec3(t, 0.0, 0.0)), snoise(p + vec3(5.2, -t, 1.3)), snoise(p + vec3(9.1, 2.8, t)));
  vec3 q = p + w * 0.45;
  float cells = snoise(q * 1.6 + t * 1.5);
  float gran = snoise(q * 7.0 - t * 4.0) * 0.6 + snoise(q * 16.0 + t * 6.0) * 0.4;
  vec2 uv = vUv + w.xy * 0.006;
  vec3 base = uHasMap > 0.5 ? texture2D(uMap, uv).rgb : vec3(1.0, 0.55, 0.15);
  vec3 col = base * (0.78 + 0.32 * cells + 0.22 * gran);
  // hot spots where the cells peak
  col += vec3(1.0, 0.72, 0.35) * smoothstep(0.55, 0.95, cells + gran * 0.3) * 0.5;
  // the granules' net: thin dark lanes where the noise crosses nought,
  // fine enough that it shows only close in
  float net = smoothstep(0.0, 0.3, abs(snoise(q * 12.0 - t * 5.0)));
  col *= 0.8 + 0.2 * net;
  // and the hotter a patch, the whiter (a 5,800 K photosphere's hottest)
  float l = lum(col);
  col = mix(col, vec3(l) * vec3(1.0, 0.93, 0.8), smoothstep(0.6, 1.3, l) * 0.35);
  // darker and redder toward the edge: the quadratic limb-darkening law with
  // the sun's own coefficients, the edge about a third as bright as the middle
  float mu = clamp(dot(normalize(vN), normalize(vView)), 0.0, 1.0);
  float m1 = 1.0 - mu;
  col *= 1.0 - 0.47 * m1 - 0.23 * m1 * m1;
  col *= mix(vec3(1.0, 0.6, 0.32), vec3(1.0), smoothstep(0.0, 0.7, mu));
  gl_FragColor = vec4(col * uHeat, 1.0);
}`;

const CORONA_FRAG = `
uniform float uTime;
uniform float uReach;
uniform vec3 uColor;
varying vec2 vUv;
${NOISE_GLSL}
void main() {
  vec2 c = (vUv * 2.0 - 1.0) * uReach; // in the sun's radii
  float r = length(c);
  if (r < 0.97) discard;
  float a = atan(c.y, c.x);
  vec2 ring = vec2(cos(a), sin(a));
  float t = uTime;
  // streamers: where the noise round the edge is high, the light reaches further
  float rays = snoise(vec3(ring * 1.8, t * 0.05)) * 0.6 + snoise(vec3(ring * 5.0, t * 0.09 + 3.0)) * 0.4;
  float fine = snoise(vec3(ring * 14.0, t * 0.2)) * 0.5 + 0.5;
  float d = r - 1.0;
  float inner = exp(-d * 9.0);
  float outer = exp(-d * (2.6 - 1.4 * clamp(rays, 0.0, 1.0)));
  float glow = inner * 1.2 + outer * (0.22 + 0.5 * smoothstep(-0.1, 0.8, rays)) * (0.75 + 0.25 * fine);
  glow *= 1.0 - smoothstep(uReach * 0.55, uReach, r);
  // hotter and whiter close in, redder out along the streamers
  vec3 col = mix(uColor * vec3(1.0, 0.55, 0.3), uColor, inner);
  gl_FragColor = vec4(col * glow, 1.0);
}`;

const REACH = 4; // the corona's reach, in the sun's radii

export function buildSun(T = {}) {
  const group = new THREE.Group();
  group.position.set(...SUN.at);
  const surfaceMat = new THREE.ShaderMaterial({
    vertexShader: SURFACE_VERT,
    fragmentShader: SURFACE_FRAG,
    uniforms: { uMap: { value: T.sun ?? null }, uHasMap: { value: T.sun ? 1 : 0 }, uTime: { value: 0 }, uHeat: { value: 2.6 } },
  });
  const surface = new THREE.Mesh(new THREE.SphereGeometry(SUN.r, T.small ? 64 : 96, T.small ? 40 : 64), surfaceMat);
  const coronaMat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: CORONA_FRAG,
    uniforms: { uTime: { value: 0 }, uReach: { value: REACH }, uColor: { value: new THREE.Color(2.4, 1.5, 0.75) } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const corona = new THREE.Mesh(new THREE.PlaneGeometry(SUN.r * REACH * 2, SUN.r * REACH * 2), coronaMat);
  corona.renderOrder = 1;
  group.add(surface, corona);
  const q = new THREE.Quaternion();
  const eye = new THREE.Vector3();
  return {
    group,
    update(t, camera) {
      surface.rotation.y = t * 0.03;
      surfaceMat.uniforms.uTime.value = t;
      coronaMat.uniforms.uTime.value = t;
      if (camera) {
        // the corona faces you, upright to the map: toward the camera's
        // place, never its roll, so the streamers hold still as the ship
        // banks (lib/three/upright.js)
        faceUpright(corona, camera.getWorldPosition(eye), q);
      }
    },
  };
}
