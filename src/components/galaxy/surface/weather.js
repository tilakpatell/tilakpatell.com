// What's in the air round you: sand blowing across Tatooine, snow on Hoth,
// rain lashing Kamino, ash and embers over Mustafar, motes drifting in
// Dagobah's swamp and in the light under Endor's trees. Particles in a box
// that goes where the camera goes, each wrapping round inside it as it
// moves, so there's always the same amount about you and none of it ever
// has to be made again. Drawn as points (flakes, ash, motes) or as streaks
// (rain, sand), all of it by the GPU from one clock.
//
// site.weather: [{ kind, count?, color?, speed? }] (kind: sand, snow, rain,
// ash, embers, motes, spray, pollen)

import * as THREE from 'three';

const KINDS = {
  // streaks along the wind, low over the ground
  sand: { lines: false, count: 2200, box: [60, 5, 60], drop: [11, -0.3, 2.5], size: 0.045, color: '#f0dcb0', alpha: 0.55, wobble: 0.3, low: true },
  // flakes falling, drifting
  snow: { lines: false, count: 5000, box: [60, 34, 60], drop: [1.4, -1.8, 0.6], size: 0.09, color: '#ffffff', alpha: 0.85, wobble: 0.6 },
  // rain, slanting
  rain: { lines: true, count: 3500, box: [50, 30, 50], drop: [2.4, -24, 1.2], len: 0.035, color: '#b8cde6', alpha: 0.28 },
  // ash, slow
  ash: { lines: false, count: 2600, box: [60, 30, 60], drop: [0.8, -0.7, 0.4], size: 0.07, color: '#5a5450', alpha: 0.7, wobble: 0.5 },
  // embers rising off the lava
  embers: { lines: false, count: 900, box: [70, 30, 70], drop: [0.6, 1.6, 0.2], size: 0.07, color: '#ff8a3a', alpha: 1, glow: 3.2, wobble: 0.8 },
  // motes, drifting and glinting (swamp, forest light)
  motes: { lines: false, count: 900, box: [40, 14, 40], drop: [0.15, 0.05, 0.1], size: 0.05, color: '#e8f5b0', alpha: 0.9, glow: 2.2, wobble: 1.2 },
  // sea spray, blown
  spray: { lines: false, count: 1400, box: [60, 12, 60], drop: [7, -0.4, 2], size: 0.06, color: '#e6f2ff', alpha: 0.5, wobble: 0.4, low: true },
  // pollen and seed fluff over a meadow, slow and sunlit (flora.js's air)
  pollen: { lines: false, count: 650, box: [44, 10, 44], drop: [0.3, 0.06, 0.15], size: 0.04, color: '#fff1c4', alpha: 0.7, glow: 1.4, wobble: 1.5 },
};

const VERT = `
attribute vec3 aSeed;
attribute float aEnd;
uniform float uTime, uSize, uLen, uWobble, uScale;
uniform vec3 uBox, uDrop, uCam;
varying float vAlpha;
void main() {
  // where it is in its box, which rides along with the camera
  vec3 p = aSeed * uBox + uDrop * uTime * (0.75 + aSeed.y * 0.5);
  p.x += sin(uTime * 0.9 + aSeed.z * 40.0) * uWobble;
  p.z += cos(uTime * 0.7 + aSeed.x * 40.0) * uWobble;
  p = mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5 + uCam;
  p -= uDrop * aEnd * uLen; // a streak's tail, behind its head
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uScale / max(0.5, -mv.z);
  // fading out toward the box's edges, so nothing pops
  vec3 e = abs(p - uCam) / (uBox * 0.5);
  vAlpha = 1.0 - smoothstep(0.7, 1.0, max(max(e.x, e.y), e.z));
}`;

const FRAG_POINTS = `
uniform vec3 uColor;
uniform float uAlpha, uGlow;
varying float vAlpha;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = dot(q, q);
  if (d > 0.25) discard;
  float a = (1.0 - d * 4.0) * uAlpha * vAlpha;
  gl_FragColor = vec4(uColor * uGlow, a);
}`;

const FRAG_LINES = `
uniform vec3 uColor;
uniform float uAlpha, uGlow;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(uColor * uGlow, uAlpha * vAlpha);
}`;

function layer(spec, { small, seed }) {
  const k = { ...KINDS[spec.kind], ...spec };
  const n = Math.round((spec.count ?? k.count) * (small ? 0.45 : 1));
  const verts = k.lines ? 2 : 1;
  const seeds = new Float32Array(n * verts * 3);
  const ends = new Float32Array(n * verts);
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < n; i++) {
    const a = [rand(), rand(), rand()];
    for (let v = 0; v < verts; v++) {
      seeds.set(a, (i * verts + v) * 3);
      ends[i * verts + v] = v;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * verts * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
  const drop = new THREE.Vector3(...k.drop).multiplyScalar(spec.speed ?? 1);
  const uniforms = {
    uTime: { value: 0 },
    uSize: { value: k.size ?? 0.1 },
    uLen: { value: k.len ?? 0 },
    uWobble: { value: k.wobble ?? 0 },
    uScale: { value: 600 },
    uBox: { value: new THREE.Vector3(...k.box) },
    uDrop: { value: drop },
    uCam: { value: new THREE.Vector3() },
    uColor: { value: new THREE.Color(k.color) },
    uAlpha: { value: k.alpha ?? 1 },
    uGlow: { value: k.glow ?? 1 },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: k.lines ? FRAG_LINES : FRAG_POINTS,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: k.glow ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const obj = k.lines ? new THREE.LineSegments(geo, material) : new THREE.Points(geo, material);
  obj.frustumCulled = false;
  obj.renderOrder = 5;
  return { obj, uniforms, low: k.low, box: k.box, alpha: k.alpha ?? 1 };
}

export function createWeather(site, { small = false } = {}) {
  const group = new THREE.Group();
  group.name = 'weather';
  const layers = (site.weather ?? []).filter((w) => KINDS[w.kind]).map((w, i) => layer(w, { small, seed: 977 + i * 131 }));
  for (const l of layers) group.add(l.obj);
  let strength = 1;
  return {
    group,
    // how hard it's blowing (0…1+): gusts of sand, a squall
    set gust(k) {
      strength = k;
    },
    update(t, camera, heightAt, viewportH) {
      for (const l of layers) {
        l.uniforms.uTime.value = t;
        l.uniforms.uCam.value.copy(camera.position);
        // sand keeps low: its box sits on the ground under the camera
        if (l.low && heightAt) l.uniforms.uCam.value.y = heightAt(camera.position.x, camera.position.z) + l.box[1] * 0.45;
        l.uniforms.uScale.value = viewportH * 0.9;
        l.uniforms.uAlpha.value = l.alpha * strength;
      }
    },
    dispose() {
      for (const l of layers) {
        l.obj.geometry.dispose();
        l.obj.material.dispose();
      }
    },
  };
}
