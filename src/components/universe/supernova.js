// Supernovas: now and then, far out in deep space, a star blows. From
// anywhere on the map you see it: a point that brightens, then a flash that
// blooms across the sky with spikes and a streak of lens glare, then a
// shell of hot gas running out from it over the better part of a minute,
// blue-white at first and cooling through gold to red, its rim ragged and
// its inside filling with filaments like the Crab Nebula's, and left in the
// middle a pulsar, a tiny star blinking with two faint beams sweeping round.
// The remnant stays, fading, until the next one needs its place (two can be
// going at once).
//
// Everything faces the camera: the flash and the shell are discs, drawn by
// shaders in the same style as deepspace.js (additive, hotter than white so
// the bloom takes them), three draws for a going supernova.
//
// createSupernovae({ small }) → { group, explode(at, { size, color }), update(t, dt, camera, cam) → busy,
//   nova() → { at, k } | null (the brightest flash going, for the scene's own flare), dispose() }
// SUPERNOVA_SITES: where they go off (map space), clear of everything.

import * as THREE from 'three';
import { NOISE_GLSL } from './sun';
import { SPREAD } from './scale';

// seven dying stars, out between the places (supernova.test.js keeps them
// clear), spread with them across the disc (scale.js's SPREAD: the numbers
// are where they were before)
export const SUPERNOVA_SITES = [
  [-3855, -650, -2950],
  [5425, -360, 450],
  [580, -45, 5860],
  [2850, 550, 3955],
  [-5120, 255, -750],
  [6680, 300, 2110], // (these two came in at the spread to eight, to where the rim starts, as they were at six: 7,600, 2,400 and −2,600, −7,000 put them past the edge)
  [-2440, -800, -6560],
].map(([x, y, z]) => [x * SPREAD, y, z * SPREAD]);

// the stages, in seconds from the start
const BRIGHTEN = 1.6; // the star swelling
const FLASH = 4.0; // the flash at its height
const GROW = 16; // the shell's time to most of its size
const FADE = 55; // the remnant beginning to fade
const LIFE = 150; // and gone

const BILLBOARD_VERT = `
uniform float uSize;
varying vec2 vC;
void main() {
  vC = position.xy;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
}`;

// the flash: a hot core, four diffraction spikes and a wide anamorphic
// streak, all falling off with distance from the middle
const FLASH_FRAG = `
uniform vec3 uColor;
uniform float uK;
varying vec2 vC;
void main() {
  float r = length(vC);
  float core = exp(-r * r * 60.0);
  float glow = exp(-r * 7.0) * 0.55;
  float spikes = (exp(-abs(vC.x) * 40.0) + exp(-abs(vC.y) * 40.0)) * exp(-r * 4.5) * 0.7;
  float streak = exp(-abs(vC.y) * 90.0) * exp(-abs(vC.x) * 2.2) * 0.9;
  vec3 col = uColor * (glow + spikes + streak) + vec3(1.0) * core * 1.5;
  gl_FragColor = vec4(col * uK * (1.0 - smoothstep(0.85, 1.0, r)), 1.0);
  #include <colorspace_fragment>
}`;

// the shell: a thin bright rim at the front, torn by noise, with the gas
// inside it in filaments, all in the colour it has cooled to
const SHELL_FRAG = `
uniform vec3 uRim;
uniform vec3 uGas;
uniform float uAge;
uniform float uFront;
uniform float uK;
uniform float uSeed;
varying vec2 vC;
${NOISE_GLSL}
void main() {
  float r = length(vC);
  float a = atan(vC.y, vC.x + 1e-6);
  // the rim's raggedness: noise round the edge, drawn out as it grows
  float torn = snoise(vec3(cos(a) * 3.0, sin(a) * 3.0, uSeed + uAge * 0.02)) * 0.07 + snoise(vec3(cos(a) * 9.0, sin(a) * 9.0, uSeed * 2.0 - uAge * 0.03)) * 0.03;
  float front = uFront + torn;
  float d = (r - front) / 0.035;
  float rim = exp(-d * d) * 1.6;
  // the gas inside: filaments, brighter toward the rim, thinning in the middle
  vec2 q = vC / max(uFront, 0.05);
  float f1 = snoise(vec3(q * 4.0, uSeed + uAge * 0.01));
  float f2 = snoise(vec3(q * 11.0, uSeed * 1.7 - uAge * 0.015));
  float fil = max(0.0, 0.55 + 0.45 * f1 - 0.25 * abs(f2));
  fil = fil * fil * fil;
  float inside = step(r, front) * (0.12 + 0.6 * smoothstep(0.0, 1.0, r / max(front, 0.01))) * fil;
  vec3 col = uRim * rim + uGas * inside;
  gl_FragColor = vec4(col * uK * (1.0 - smoothstep(0.9, 1.0, r)), 1.0);
  #include <colorspace_fragment>
}`;

// the pulsar: a point that blinks, two faint beams sweeping round it (the
// Lantern out in deep space is drawn with it too, deepspace.js)
export const PULSAR_FRAG = `
uniform float uT;
uniform float uK;
varying vec2 vC;
void main() {
  float r = length(vC);
  float blink = 0.55 + 0.45 * smoothstep(0.3, 1.0, sin(uT * 9.0) * 0.5 + 0.5);
  float star = exp(-r * r * 400.0) * 3.0 * blink;
  float a = atan(vC.y, vC.x + 1e-6) - uT * 0.9;
  float beam = exp(-abs(sin(a)) * 30.0) * exp(-r * 3.0) * 0.6;
  vec3 col = vec3(0.7, 0.85, 1.0) * (star + beam) + vec3(1.0) * star * 0.5;
  gl_FragColor = vec4(col * uK * (1.0 - smoothstep(0.8, 1.0, r)), 1.0);
  #include <colorspace_fragment>
}`;

export function createSupernovae({ small = false } = {}) {
  const group = new THREE.Group();
  group.name = 'supernovae';
  const quad = new THREE.PlaneGeometry(2, 2);
  const made = [quad];
  const additive = { transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide };
  const shader = (frag, uniforms) => {
    const m = new THREE.ShaderMaterial({ vertexShader: BILLBOARD_VERT, fragmentShader: frag, uniforms: { uSize: { value: 1 }, ...uniforms }, ...additive });
    made.push(m);
    return m;
  };
  const q = new THREE.Quaternion();
  const face = (obj, camera) => {
    group.getWorldQuaternion(q);
    obj.quaternion.copy(q.invert()).multiply(camera.quaternion);
  };
  // two can be going at once: the older gives way
  const novae = Array.from({ length: 2 }, (_, i) => {
    const colour = new THREE.Color();
    const flash = new THREE.Mesh(quad, shader(FLASH_FRAG, { uColor: { value: new THREE.Color() }, uK: { value: 0 } }));
    const shell = new THREE.Mesh(quad, shader(SHELL_FRAG, { uRim: { value: new THREE.Color() }, uGas: { value: new THREE.Color() }, uAge: { value: 0 }, uFront: { value: 0 }, uK: { value: 0 }, uSeed: { value: i * 3.7 + 1 } }));
    const pulsar = new THREE.Mesh(quad, shader(PULSAR_FRAG, { uT: { value: 0 }, uK: { value: 0 } }));
    for (const m of [flash, shell, pulsar]) {
      m.visible = false;
      m.frustumCulled = false;
      m.renderOrder = 7;
      group.add(m);
    }
    return { flash, shell, pulsar, colour, age: -1, size: 300, at: new THREE.Vector3() };
  });
  const rim = new THREE.Color();
  const gas = new THREE.Color();
  const hot = new THREE.Color(1.0, 0.95, 0.85);
  const gold = new THREE.Color(1.0, 0.72, 0.3);
  const red = new THREE.Color(0.9, 0.25, 0.12);

  return {
    group,
    // at: [x, y, z] or a Vector3 (map space); size: the shell's full radius
    explode(at, { size = 300 + Math.random() * 250, color = '#9fc6ff' } = {}) {
      const n = novae.reduce((a, b) => (a.age < 0 ? a : b.age < 0 ? b : a.age > b.age ? a : b)); // a free one, or the oldest
      n.age = 0;
      n.size = small ? size * 0.8 : size;
      n.colour.set(color);
      n.at.copy(Array.isArray(at) ? new THREE.Vector3(...at) : at);
      for (const m of [n.flash, n.shell, n.pulsar]) m.position.copy(n.at);
      n.flash.material.uniforms.uColor.value.copy(n.colour).multiplyScalar(2.2);
      n.flash.visible = true;
      n.shell.visible = false;
      n.pulsar.visible = false;
    },
    update(t, dt, camera) {
      let busy = false;
      for (const n of novae) {
        if (n.age < 0) continue;
        n.age += dt;
        const age = n.age;
        if (age > LIFE) {
          n.age = -1;
          n.flash.visible = n.shell.visible = n.pulsar.visible = false;
          continue;
        }
        busy = true;
        // the flash: the star swells, blazes, and is gone behind the shell
        const rise = age < BRIGHTEN ? (age / BRIGHTEN) ** 3 * 0.35 : age < FLASH ? 0.35 + 0.65 * Math.sin(((age - BRIGHTEN) / (FLASH - BRIGHTEN)) * Math.PI) : Math.exp(-(age - FLASH) * 0.35) * 0.35;
        n.flash.visible = rise > 0.004;
        n.flash.material.uniforms.uK.value = rise * 3.0;
        n.flash.material.uniforms.uSize.value = n.size * (0.3 + rise * 0.7);
        face(n.flash, camera);
        // the shell: out from the flash, slowing, cooling
        if (age > BRIGHTEN + 0.4) {
          const grow = 1 - Math.exp(-(age - BRIGHTEN) / GROW);
          const cool = Math.min(1, (age - BRIGHTEN) / 40);
          rim.copy(n.colour).lerp(hot, 0.7).lerp(gold, Math.min(1, cool * 1.4)).lerp(red, Math.max(0, cool - 0.5) * 2);
          gas.copy(n.colour).lerp(gold, cool * 0.6).lerp(red, Math.max(0, cool - 0.4) * 1.2);
          const fade = age < FADE ? 1 : Math.max(0, 1 - (age - FADE) / (LIFE - FADE));
          const u = n.shell.material.uniforms;
          u.uRim.value.copy(rim).multiplyScalar(2.6);
          u.uGas.value.copy(gas).multiplyScalar(0.9);
          u.uAge.value = age;
          u.uFront.value = 0.08 + 0.82 * grow;
          u.uK.value = fade * Math.min(1, (age - BRIGHTEN) / 1.5);
          u.uSize.value = n.size;
          n.shell.visible = true;
          face(n.shell, camera);
        }
        // the pulsar, once the flash has died down
        if (age > FLASH + 2) {
          const u = n.pulsar.material.uniforms;
          u.uT.value = t;
          u.uK.value = Math.min(1, (age - FLASH - 2) / 3) * (age < FADE ? 1 : Math.max(0.3, 1 - (age - FADE) / (LIFE - FADE)));
          u.uSize.value = n.size * 0.12;
          n.pulsar.visible = true;
          face(n.pulsar, camera);
        }
      }
      return busy;
    },
    // the brightest flash going, 0…1, and where
    nova() {
      let best = null;
      for (const n of novae) {
        if (n.age < 0 || n.age > FLASH + 3) continue;
        const k = n.flash.material.uniforms.uK.value / 3;
        if (!best || k > best.k) best = { at: n.at, k };
      }
      return best;
    },
    dispose() {
      for (const x of made) x.dispose();
    },
  };
}
