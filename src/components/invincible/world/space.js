// Space, drawn (./orbit.js says where everything is): the Earth under him
// with the Graysons' city on top of it (the Earth page's NASA maps: Blue
// Marble by day, Black Marble's city lights on the night side, the sun
// glinting off the sea, a shell of cloud, the air a blue rim), the Moon
// and Mars painted in their shaders (craters, maria, Mars's dark lands
// and polar caps), the stars, and the sun. The shading of the globe
// follows the Earth page's (components/earth/scene.js), scaled up to this
// world's Earth and turned so the city is at the top.

import * as THREE from 'three';
import { loadTexture, variant, sharpen } from '../../../lib/three/textures';
import { hot } from '../../avengers/hq/stage';
import { BODIES, SPACE } from './orbit';

const RE = SPACE.RE;
export const AIR = 1 + 9000 / RE; // the air's top, in Earth radii: the city's sky
const CITY = { lat: 41.88, lon: -87.63 }; // where on the Earth the city is

const NOISE = /* glsl */ `
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
vec3 hash3(vec3 p) { return fract(sin(vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)))) * 43758.5453); }
float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float s = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
// the distance to the nearest of a scatter of points: craters
float cells(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float d = 8.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 o = vec3(float(x), float(y), float(z));
    vec3 r = o + hash3(i + o) - f;
    d = min(d, dot(r, r));
  }
  return sqrt(d);
}
// a crater's profile from that distance: a dark floor, a bright rim
float crater(float d, float size) { return -0.6 * (1.0 - smoothstep(0.0, size, d)) + 0.5 * smoothstep(size * 0.75, size, d) * (1.0 - smoothstep(size, size * 1.35, d)); }
`;

const GLOBE_VERT = /* glsl */ `
varying vec3 vObj;
varying vec3 vN;
varying vec3 vW;
void main() {
  vObj = normalize(position);
  vN = normalize(mat3(modelMatrix) * position);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const EARTH_FRAG = /* glsl */ `
uniform sampler2D tDay;
uniform sampler2D tNight;
uniform sampler2D tWater;
uniform vec3 uSun;
uniform float uR;
varying vec3 vObj;
varying vec3 vN;
varying vec3 vW;
const float PI = 3.141592653589793;
vec2 uvOf(vec3 n) { return vec2(atan(n.x, n.z) / (2.0 * PI) + 0.5, asin(clamp(n.y, -1.0, 1.0)) / PI + 0.5); }
void main() {
  vec3 N = normalize(vN);
  vec2 uv = uvOf(normalize(vObj));
  float water = texture2D(tWater, uv).r;
  float sunUp = dot(N, uSun);
  vec3 day = texture2D(tDay, uv).rgb;
  vec3 col = day * (max(sunUp, 0.0) * 1.35 + 0.012);
  // the sun on the sea
  vec3 V = normalize(cameraPosition - vW);
  vec3 H = normalize(uSun + V);
  float nh = max(dot(N, H), 0.0);
  col += vec3(1.0, 0.9, 0.72) * (pow(nh, 160.0) * 2.4 + pow(nh, 18.0) * 0.12) * water * smoothstep(-0.02, 0.15, sunUp);
  // the lights at night
  float night = 1.0 - smoothstep(-0.2, 0.06, sunUp);
  vec3 lights = texture2D(tNight, uv).rgb;
  col += lights * lights * vec3(1.6, 1.2, 0.75) * 2.2 * night;
  col += day * vec3(0.035, 0.05, 0.085) * night;
  // the air between you and the ground
  vec3 o = cameraPosition / uR;
  vec3 w = vW / uR;
  vec3 ray = normalize(w - o);
  float b = dot(o, ray);
  float c = dot(o, o) - ${AIR.toFixed(4)} * ${AIR.toFixed(4)};
  float enter = max(0.0, -b - sqrt(max(b * b - c, 0.0)));
  float path = max(length(w - o) - enter, 0.0);
  float haze = 1.0 - exp(-path * 4.0);
  float dusk = smoothstep(-0.25, 0.1, sunUp) * (1.0 - smoothstep(0.1, 0.45, sunUp));
  vec3 air = mix(vec3(0.3, 0.55, 1.0), vec3(1.0, 0.55, 0.3), dusk * 0.6);
  col = mix(col, air * 0.8 * smoothstep(-0.22, 0.35, sunUp), haze * 0.55);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const CLOUD_FRAG = /* glsl */ `
uniform sampler2D tClouds;
uniform vec3 uSun;
uniform float uDrift;
varying vec3 vObj;
varying vec3 vN;
varying vec3 vW;
const float PI = 3.141592653589793;
vec2 uvOf(vec3 n) { return vec2(atan(n.x, n.z) / (2.0 * PI) + 0.5, asin(clamp(n.y, -1.0, 1.0)) / PI + 0.5); }
void main() {
  vec3 N = normalize(vN);
  float c = texture2D(tClouds, uvOf(normalize(vObj)) + vec2(uDrift, 0.0)).r;
  float a = smoothstep(0.08, 0.85, c);
  float sunUp = dot(N, uSun);
  vec3 V = normalize(cameraPosition - vW);
  float light = smoothstep(-0.12, 0.25, sunUp) * (0.55 + 0.6 * max(sunUp, 0.0)) + 0.008;
  float dusk = smoothstep(-0.15, 0.05, sunUp) * (1.0 - smoothstep(0.05, 0.35, sunUp));
  vec3 col = mix(vec3(1.0), vec3(1.0, 0.68, 0.45), dusk * 0.7) * light;
  a *= mix(1.0, 0.75, pow(1.0 - max(dot(N, V), 0.0), 3.0));
  gl_FragColor = vec4(col, a * 0.92);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// the air, as the inside of a sphere drawn behind everything: a blue rim
// from orbit where the sun lights it, orange where it's setting
const AIR_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform float uR;
varying vec3 vW;
vec2 hit(vec3 o, vec3 d, float r) {
  float b = dot(o, d);
  float c = dot(o, o) - r * r;
  float h = b * b - c;
  if (h < 0.0) return vec2(1e9, -1e9);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}
void main() {
  vec3 o = cameraPosition / uR;
  vec3 d = normalize(vW / uR - o);
  vec2 a = hit(o, d, ${AIR.toFixed(4)});
  float t0 = max(a.x, 0.0);
  float t1 = a.y;
  vec2 g = hit(o, d, 1.0);
  if (g.x > 0.0) t1 = min(t1, g.x);
  float path = max(t1 - t0, 0.0);
  if (path <= 0.0) discard;
  vec3 m = o + d * (t0 + t1) * 0.5;
  float up = dot(normalize(m), uSun);
  float h = clamp((length(m) - 1.0) / ${(AIR - 1).toFixed(4)}, 0.0, 1.0);
  float thick = (1.0 - exp(-path * 9.0)) * (1.0 - h * 0.5);
  float day = smoothstep(-0.28, 0.2, up);
  float dusk = smoothstep(-0.3, 0.0, up) * (1.0 - smoothstep(0.0, 0.3, up));
  vec3 col = mix(vec3(0.2, 0.45, 1.0), vec3(1.0, 0.5, 0.25), dusk * 0.75) * thick * (day * 0.95 + dusk * 0.4);
  col += vec3(1.0, 0.85, 0.6) * pow(max(dot(d, uSun), 0.0), 24.0) * thick * day * 0.9;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// the Moon: grey highlands, dark maria, craters of every size
const MOON_FRAG = /* glsl */ `
uniform vec3 uSun;
varying vec3 vObj;
varying vec3 vN;
varying vec3 vW;
${NOISE}
void main() {
  vec3 p = normalize(vObj);
  float maria = smoothstep(0.52, 0.62, fbm(p * 2.2 + 3.0));
  float h = crater(cells(p * 6.0), 0.42) * 0.8 + crater(cells(p * 22.0), 0.36) * 0.45 + (fbm(p * 40.0) - 0.5) * 0.4;
  // up close, the small craters and the grit (faded in with nearness, so far off it doesn't shimmer)
  float near = 1.0 - smoothstep(800.0, 6000.0, length(cameraPosition - vW));
  h += (crater(cells(p * 170.0), 0.34) * 0.35 + (fbm(p * 900.0) - 0.5) * 0.35) * near;
  vec3 albedo = mix(vec3(0.62, 0.61, 0.59), vec3(0.3, 0.3, 0.31), maria);
  albedo *= 0.85 + 0.25 * h;
  // the craters' slopes, a hint of relief in the light
  vec3 N = normalize(vN + (vec3(noise(p * 30.0), noise(p * 30.0 + 7.0), noise(p * 30.0 + 13.0)) - 0.5) * 0.25 * (0.5 + h));
  float lit = max(dot(N, uSun), 0.0);
  // and on the dark side, the Earth's light: enough to see it by
  vec3 col = albedo * (lit * 1.25 + 0.05);
  vec3 V = normalize(cameraPosition - vW);
  col += vec3(0.5, 0.55, 0.65) * pow(1.0 - max(dot(normalize(vN), V), 0.0), 3.0) * 0.12;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// Mars: rust and ochre, darker lands, white at the poles, craters, a thin pink rim of air
const MARS_FRAG = /* glsl */ `
uniform vec3 uSun;
varying vec3 vObj;
varying vec3 vN;
varying vec3 vW;
${NOISE}
void main() {
  vec3 p = normalize(vObj);
  float lands = smoothstep(0.45, 0.62, fbm(p * 2.6 + 11.0));
  float h = crater(cells(p * 9.0), 0.38) * 0.5 + (fbm(p * 18.0) - 0.5) * 0.5;
  float near = 1.0 - smoothstep(800.0, 6000.0, length(cameraPosition - vW));
  h += (crater(cells(p * 140.0), 0.34) * 0.3 + (fbm(p * 700.0) - 0.5) * 0.4) * near;
  vec3 albedo = mix(vec3(0.76, 0.38, 0.18), vec3(0.42, 0.2, 0.12), lands);
  albedo = mix(albedo, vec3(0.86, 0.6, 0.4), smoothstep(0.62, 0.8, fbm(p * 5.0 + 2.0)) * 0.5);
  albedo *= 0.88 + 0.22 * h;
  albedo = mix(albedo, vec3(0.95, 0.94, 0.92), smoothstep(0.86, 0.9, abs(p.y) + (fbm(p * 8.0) - 0.5) * 0.08));
  vec3 N = normalize(vN);
  float lit = max(dot(N, uSun), 0.0);
  vec3 col = albedo * (lit * 1.25 + 0.015);
  vec3 V = normalize(cameraPosition - vW);
  col += vec3(0.9, 0.5, 0.35) * pow(1.0 - max(dot(N, V), 0.0), 4.0) * 0.35 * smoothstep(-0.2, 0.4, dot(N, uSun));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// the object-space direction of a latitude and longitude, as the globe's texture has it
const dirOf = (lat, lon) => {
  const a = THREE.MathUtils.degToRad(lat);
  const b = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b));
};

// the turn that puts the city on top of the world, its north toward −z
function cityOnTop() {
  const a = THREE.MathUtils.degToRad(CITY.lat);
  const b = THREE.MathUtils.degToRad(CITY.lon);
  const up = dirOf(CITY.lat, CITY.lon);
  const east = new THREE.Vector3(Math.cos(b), 0, -Math.sin(b));
  const north = new THREE.Vector3(-Math.sin(a) * Math.sin(b), Math.cos(a), -Math.sin(a) * Math.cos(b));
  const from = new THREE.Matrix4().makeBasis(east, up, north);
  const to = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1));
  return new THREE.Quaternion().setFromRotationMatrix(to.multiply(from.transpose()));
}

function starField(n = 3500) {
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1;
    const a = r() * Math.PI * 2;
    const q = Math.sqrt(1 - u * u);
    pos.set([q * Math.cos(a), u, q * Math.sin(a)], i * 3);
    const k = 0.35 + r() ** 3 * 1.6;
    const warm = r();
    col.set([k * (0.85 + warm * 0.2), k * 0.9, k * (1.05 - warm * 0.25)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // (drawn first and under everything: not in the transparent pass, which comes after the planets)
  const m = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false, depthTest: false, toneMapped: false });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  p.renderOrder = -10;
  p.scale.setScalar(5000);
  return p;
}

function glow() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.15, 'rgba(255,248,230,0.9)');
  g.addColorStop(0.4, 'rgba(255,220,170,0.25)');
  g.addColorStop(1, 'rgba(255,200,150,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  sharpen(t);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function buildSpace(renderer, { small = false } = {}) {
  const group = new THREE.Group();
  group.name = 'space';
  group.visible = false;
  const sun = { value: new THREE.Vector3(-0.55, 0.65, 0.52).normalize() };
  const base = '/textures/earth/';
  const url = (f) => `${import.meta.env?.BASE_URL ?? '/'}${base.slice(1)}${f}`;
  const [day, night, clouds, water] = await Promise.all(
    [
      ['day.webp', true],
      ['night.webp', true],
      ['clouds.webp', false],
      ['water.webp', false],
    ].map(([f, color]) => loadTexture(variant(url(f), '-sm', small), { renderer, color }).catch(() => null)),
  );
  const seg = small ? [96, 48] : [160, 80];

  // the Earth, its clouds and its air, turned so the city's on top
  const turn = cityOnTop();
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(RE, seg[0], seg[1]),
    new THREE.ShaderMaterial({ uniforms: { tDay: { value: day }, tNight: { value: night }, tWater: { value: water }, uSun: sun, uR: { value: RE } }, vertexShader: GLOBE_VERT, fragmentShader: EARTH_FRAG }),
  );
  earth.quaternion.copy(turn);
  const cloudShell = new THREE.Mesh(
    new THREE.SphereGeometry(RE + 600, seg[0], seg[1]),
    new THREE.ShaderMaterial({ uniforms: { tClouds: { value: clouds }, uSun: sun, uDrift: { value: 0 } }, vertexShader: GLOBE_VERT, fragmentShader: CLOUD_FRAG, transparent: true, depthWrite: false }),
  );
  cloudShell.quaternion.copy(turn);
  cloudShell.renderOrder = 2;
  const air = new THREE.Mesh(new THREE.SphereGeometry(RE * AIR, 96, 48), new THREE.ShaderMaterial({ uniforms: { uSun: sun, uR: { value: RE } }, vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }', fragmentShader: AIR_FRAG, side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  air.renderOrder = 3;
  group.add(earth, cloudShell, air);

  // the Moon and Mars
  const bodies = {};
  for (const b of BODIES) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(b.r, 128, 64), new THREE.ShaderMaterial({ uniforms: { uSun: sun }, vertexShader: GLOBE_VERT, fragmentShader: b.id === 'moon' ? MOON_FRAG : MARS_FRAG }));
    mesh.position.set(...b.c);
    group.add(mesh);
    bodies[b.id] = mesh;
  }

  // the sun, far off along its light
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: hot(0xfff4e0, 3), toneMapped: false, depthWrite: false, transparent: true }));
  sunSprite.scale.setScalar(60000);
  group.add(sunSprite);

  // the stars, round the camera wherever it goes (in the city's sky too, up high)
  const stars = starField(small ? 2200 : 3500);

  return {
    group,
    stars,
    sun: sun.value,
    // where the sun is, by the city's time of day
    setTime(name) {
      // (at noon high over the city and behind it from the Moon and Mars, so their near sides are lit)
      const d = { noon: [-0.55, 0.65, 0.52], dusk: [1, 0.1, 0.25], night: [-0.35, -1, -0.25] }[name] ?? [-0.55, 0.65, 0.52];
      sun.value.set(...d).normalize();
    },
    update(t, camera) {
      cloudShell.material.uniforms.uDrift.value = t * 0.0004;
      sunSprite.position.copy(camera.position).addScaledVector(sun.value, 600000);
      stars.position.copy(camera.position);
    },
  };
}
