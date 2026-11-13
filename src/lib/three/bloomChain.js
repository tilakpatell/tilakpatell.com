// A lens's bloom, as a film renderer draws it: a chain of mips, each half
// the last, the picture taken down it and brought back up, so what's bright
// spreads a tight core and a long soft tail the way light scatters in a
// real lens and eye, rather than three's five blurs of a cut-out.
//
// - Down: thirteen taps a texel (Jimenez's, from Call of Duty: Advanced
//   Warfare's post, SIGGRAPH 2014): five overlapping boxes, weighed so the
//   middle counts most. The first level weighs its boxes by one over one
//   plus their brightness (Karis's average), so a lone hot pixel (a star, a
//   bolt's tip) can't ring out as a square that flickers as it moves.
// - What glows: two parts in one chain. The veil is a share of all the light
//   (a lens scatters everything, so the sky round a lit planet's limb picks
//   up a faint haze and black never quite touches a sun); the glare is what's
//   over the threshold, eased in over the knee, at its own strength (the
//   sun, the engines, the shots).
// - Up: each level brought up by a nine-tap tent and added to the one above
//   it at that level's weight (bloomWeights), the finest last and straight
//   onto the scene, its light kept: the weights sum to one, so the chain
//   only moves light about. Seven levels are thirteen passes, as many as
//   three's pass draws.
// - How many levels: by the first level's height, down to a few texels
//   (bloomLevels), so the widest reaches the same share of the screen at
//   any size: a bloom's size is an angle, not pixels.
//
// The weights follow a Frostbite-style renderer's own Gaussian bloom
// (sharpness, 0…1, from all reach to all core): each level's share of the
// screen integrated under (2·(1 − sharpness))^(20x) · (1 − x)² and made to
// sum to one.
//
//   bloomLevels(height, { least, most }) → how many mips
//   bloomWeights(n, sharpness) → n weights, the finest first, summing to 1
//   new ChainBloomPass(size, { threshold, knee, strength, veil, sharpness })
//     a Pass for three's EffectComposer: reads the read buffer, adds its
//     bloom back into it (no swap). size: the first level's (Vector2).
//     threshold, knee, strength, veil and radius (1 − sharpness) are live.

import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';

export function bloomLevels(height, { least = 3, most = 8 } = {}) {
  const n = Math.floor(Math.log2(Math.max(1, height))) - 1;
  return Math.min(most, Math.max(least, n));
}

export function bloomWeights(n, sharpness = 0.5) {
  const base = Math.max(0.01, 1 - sharpness) * 2;
  const w = [];
  for (let i = 0; i < n; i++) {
    const a = 2 ** (i - n);
    const b = 2 ** (i + 1 - n);
    let s = 0;
    for (let k = 0; k < 10; k++) {
      const x = a + ((k + 0.5) / 10) * (b - a);
      s += base ** (20 * x) * (1 - x) ** 2;
    }
    w.push((s * (b - a)) / 10);
  }
  const sum = w.reduce((t, v) => t + v, 0) || 1;
  return w.map((v) => v / sum);
}

const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

// NaN and infinity both have every exponent bit set (post.js has why)
const FINITE = /* glsl */ `
vec3 finite(vec3 c) {
  bvec3 bad = equal(floatBitsToUint(c) & 0x7f800000u, uvec3(0x7f800000u));
  return clamp(mix(c, vec3(0.0), bad), 0.0, 64.0);
}`;

// the thirteen taps, as five boxes (a…e) and their weights
const THIRTEEN = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uStep;
varying vec2 vUv;
vec3 tap(vec2 o) { return finite(texture2D(tDiffuse, vUv + o * uStep).rgb); }
void boxes(out vec3 b0, out vec3 b1, out vec3 b2, out vec3 b3, out vec3 b4) {
  vec3 A = tap(vec2(-2.0, 2.0)), B = tap(vec2(0.0, 2.0)), C = tap(vec2(2.0, 2.0));
  vec3 D = tap(vec2(-1.0, 1.0)), E = tap(vec2(1.0, 1.0));
  vec3 F = tap(vec2(-2.0, 0.0)), G = tap(vec2(0.0)), H = tap(vec2(2.0, 0.0));
  vec3 I = tap(vec2(-1.0, -1.0)), J = tap(vec2(1.0, -1.0));
  vec3 K = tap(vec2(-2.0, -2.0)), L = tap(vec2(0.0, -2.0)), M = tap(vec2(2.0, -2.0));
  b0 = (D + E + I + J) * 0.25;
  b1 = (A + B + F + G) * 0.25;
  b2 = (B + C + G + H) * 0.25;
  b3 = (F + G + K + L) * 0.25;
  b4 = (G + H + L + M) * 0.25;
}`;

const DOWN_FRAG = /* glsl */ `
${FINITE}
${THIRTEEN}
void main() {
  vec3 b0, b1, b2, b3, b4;
  boxes(b0, b1, b2, b3, b4);
  gl_FragColor = vec4(b0 * 0.5 + (b1 + b2 + b3 + b4) * 0.125, 1.0);
}`;

const FIRST_FRAG = /* glsl */ `
uniform float uThreshold;
uniform float uKnee;
uniform float uStrength;
uniform float uVeil;
${FINITE}
${THIRTEEN}
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// the veil's share of all of it, and the glare's of what's over the line
vec3 glows(vec3 c) {
  float l = luma(c);
  float k = max(uKnee, 1e-4);
  float soft = clamp(l - uThreshold + k, 0.0, 2.0 * k);
  soft = soft * soft / (4.0 * k);
  float over = max(soft, l - uThreshold) / max(l, 1e-4);
  return c * (uVeil + uStrength * over);
}
vec3 karis(vec3 c, float w, inout float total) {
  float k = w / (1.0 + luma(c));
  total += k;
  return c * k;
}
void main() {
  vec3 b0, b1, b2, b3, b4;
  boxes(b0, b1, b2, b3, b4);
  float total = 0.0;
  vec3 c = karis(glows(b0), 0.5, total) + karis(glows(b1), 0.125, total) + karis(glows(b2), 0.125, total) + karis(glows(b3), 0.125, total) + karis(glows(b4), 0.125, total);
  gl_FragColor = vec4(c / max(total, 1e-5), 1.0);
}`;

// a level brought up by the tent, and the one it lands on added at its weight
const UP_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D tLevel;
uniform vec2 uStep;
uniform float uWeight;
uniform float uUpWeight;
varying vec2 vUv;
vec3 tent() {
  vec3 s = texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * uStep).rgb;
  s += texture2D(tDiffuse, vUv + vec2(0.0, -1.0) * uStep).rgb * 2.0;
  s += texture2D(tDiffuse, vUv + vec2(1.0, -1.0) * uStep).rgb;
  s += texture2D(tDiffuse, vUv + vec2(-1.0, 0.0) * uStep).rgb * 2.0;
  s += texture2D(tDiffuse, vUv).rgb * 4.0;
  s += texture2D(tDiffuse, vUv + vec2(1.0, 0.0) * uStep).rgb * 2.0;
  s += texture2D(tDiffuse, vUv + vec2(-1.0, 1.0) * uStep).rgb;
  s += texture2D(tDiffuse, vUv + vec2(0.0, 1.0) * uStep).rgb * 2.0;
  s += texture2D(tDiffuse, vUv + vec2(1.0, 1.0) * uStep).rgb;
  return s / 16.0;
}
void main() {
  gl_FragColor = vec4(tent() * uUpWeight + texture2D(tLevel, vUv).rgb * uWeight, 1.0);
}`;


const level = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
const material = (frag, uniforms, opts = {}) =>
  new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, ...opts });

export class ChainBloomPass extends Pass {
  constructor(size = new THREE.Vector2(256, 256), { threshold = 1.6, knee = 0.6, strength = 0.6, veil = 0.04, sharpness = 0.5 } = {}) {
    super();
    this.needsSwap = false;
    this.strength = strength;
    this.scale = 1; // (a moment's flare: the glare and the veil times this)
    this.sharpness = sharpness;
    this.first = material(FIRST_FRAG, {
      tDiffuse: { value: null },
      uStep: { value: new THREE.Vector2() },
      uThreshold: { value: threshold },
      uKnee: { value: knee },
      uStrength: { value: strength },
      uVeil: { value: veil },
    });
    this.down = material(DOWN_FRAG, { tDiffuse: { value: null }, uStep: { value: new THREE.Vector2() } });
    this.up = material(UP_FRAG, { tDiffuse: { value: null }, tLevel: { value: null }, uStep: { value: new THREE.Vector2() }, uWeight: { value: 1 }, uUpWeight: { value: 1 } });
    // (the finest level's step is the last: brought up and added over the
    // scene in one, at the scene's own pixels, so the chain is a pass short)
    this.add = material(UP_FRAG, { tDiffuse: { value: null }, tLevel: { value: null }, uStep: { value: new THREE.Vector2() }, uWeight: { value: 1 }, uUpWeight: { value: 1 } }, { blending: THREE.AdditiveBlending, transparent: true });
    this.quad = new FullScreenQuad(this.first);
    this.downs = [];
    this.ups = [];
    this.weights = [];
    this.setSize(size.x, size.y);
  }

  get threshold() {
    return this.first.uniforms.uThreshold.value;
  }
  set threshold(v) {
    this.first.uniforms.uThreshold.value = v;
  }
  get knee() {
    return this.first.uniforms.uKnee.value;
  }
  set knee(v) {
    this.first.uniforms.uKnee.value = v;
  }
  get veil() {
    return this.first.uniforms.uVeil.value;
  }
  set veil(v) {
    this.first.uniforms.uVeil.value = v;
  }
  // (as three's pass has it: how far it reaches, the sharpness's other side)
  get radius() {
    return 1 - this.sharpness;
  }
  set radius(v) {
    this.sharpness = 1 - v;
    this.weights = bloomWeights(this.downs.length, this.sharpness);
  }

  // the first level's size; the rest halve it. (ups[i] holds level i
  // brought up, for i from 1 to n − 2: the smallest needs none, and the
  // first is brought up straight onto the scene)
  setSize(width, height) {
    const n = bloomLevels(height);
    while (this.downs.length < n) this.downs.push(level());
    while (this.downs.length > n) this.downs.pop().dispose();
    while (this.ups.length < n - 1) this.ups.push(this.ups.length ? level() : null);
    while (this.ups.length > n - 1) this.ups.pop()?.dispose();
    let w = Math.max(1, Math.round(width));
    let h = Math.max(1, Math.round(height));
    for (let i = 0; i < n; i++) {
      this.downs[i].setSize(w, h);
      if (i > 0 && i < n - 1) this.ups[i].setSize(w, h);
      w = Math.max(1, Math.ceil(w / 2));
      h = Math.max(1, Math.ceil(h / 2));
    }
    this.weights = bloomWeights(n, this.sharpness);
  }

  draw(renderer, mat, target) {
    this.quad.material = mat;
    renderer.setRenderTarget(target);
    this.quad.render(renderer);
  }

  render(renderer, writeBuffer, readBuffer) {
    const n = this.downs.length;
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    const uf = this.first.uniforms;
    uf.uStrength.value = this.strength * this.scale;
    const veil = uf.uVeil.value;
    uf.uVeil.value = veil * this.scale;
    // down: the scene into the first level (what glows, Karis-weighed), then each into the next
    uf.tDiffuse.value = readBuffer.texture;
    uf.uStep.value.set(0.5 / this.downs[0].width, 0.5 / this.downs[0].height);
    this.draw(renderer, this.first, this.downs[0]);
    uf.uVeil.value = veil;
    const ud = this.down.uniforms;
    for (let i = 1; i < n; i++) {
      ud.tDiffuse.value = this.downs[i - 1].texture;
      ud.uStep.value.set(0.5 / this.downs[i].width, 0.5 / this.downs[i].height);
      this.draw(renderer, this.down, this.downs[i]);
    }
    // up: the smallest at its weight, brought up level by level, each level
    // added at its own; the first brought up onto the scene, added
    for (let i = n - 2; i >= 0; i--) {
      const mat = i === 0 ? this.add : this.up;
      const u = mat.uniforms;
      const from = i === n - 2 ? this.downs[n - 1] : this.ups[i + 1];
      u.tDiffuse.value = from.texture;
      u.tLevel.value = this.downs[i].texture;
      u.uStep.value.set(1 / from.width, 1 / from.height);
      u.uUpWeight.value = i === n - 2 ? this.weights[n - 1] : 1;
      u.uWeight.value = this.weights[i];
      this.draw(renderer, mat, i === 0 ? (this.renderToScreen ? null : readBuffer) : this.ups[i]);
    }
    renderer.autoClear = autoClear;
  }

  dispose() {
    for (const t of [...this.downs, ...this.ups]) t?.dispose();
    for (const m of [this.first, this.down, this.up, this.add]) m.dispose();
    this.quad.dispose();
  }
}
