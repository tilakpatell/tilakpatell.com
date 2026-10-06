// How the universe map is drawn, after the scene itself: into an HDR target
// (multisampled short of a sharp screen: the canvas's own antialiasing
// doesn't reach an offscreen one, so the canvas goes without), then bloom for what's brighter than lit paint (the sun,
// lit windows, engines, shots), then one last pass: the tone map, the sRGB
// encoding and a light grade (a touch of contrast and saturation, a
// vignette), and, while the ship boosts, a rush: the picture smeared out
// from the ship toward the edges (the ship itself stays sharp) and the
// vignette drawn in. A laser hit flashes the edges red. Near the black hole
// out in deep space the picture bends round it: what's behind it is drawn
// pulled out round its shadow, as a real one's gravity bends the light
// (lens: where it is on the canvas and how big its shadow looks there), and
// twisted a little round with its spin. Only what's behind it: the scene's
// depth says what's nearer than the hole (the ship, in front of it), and
// that's drawn as it is. The shadow itself is drawn black over all but
// that (no glow gets into it, and falling in, the camera can be in past the
// sphere that draws it). The tone map is the shoulder of Khronos' neutral one without
// its toe: everything under 0.8 stays exactly as drawn (the faint Milky Way,
// the planets' night sides, the signs' colours) and only what's brighter is
// rounded off toward white. While frames run long (lib/three/pace) the scene
// and its passes are drawn less sharp, a step at a time, and the last pass
// spreads them over the whole canvas (which keeps its size, so the names and
// the HUD over it stay crisp); still too slow at the softest, the scene
// turns the post off and draws straight to the canvas, as before there was
// any. Short of that, lite() drops the bloom (the costliest pass) and keeps
// the last one, so the tone map and the grade stay.
//
// Bloom and the last pass both read the scene through finite(): a pixel
// that isn't a number (some GPUs make one of a pow() just below zero, or a
// normal of length zero) reads as black, and nothing reads hotter than 64.
// Unchecked, the blur smears one bad pixel into blocks of black across the
// screen, bigger at each of its levels.
//
// spaceEnvironment(renderer, sky) is what shiny things reflect: the Milky
// Way, brought up, with the key light's glow where the key light is and a
// cool fill opposite, so metal catches the same light the scene is lit by.
//
// overlay(scene, camera) draws a second scene over the first with its own
// depth, before the bloom (the cockpit, from the pilot's seat, so its frame
// is always in front of whatever is out there and its lights glow too); null
// takes it off again.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export const LIGHT = new THREE.Vector3(-0.6, 0.62, 0.48).normalize(); // the key light, upper left
export const FILL = new THREE.Vector3(0.7, -0.4, -0.3).normalize();

// bloom: only what's well past lit paint glows (lit surfaces top out near
// 2 under the key light; the sun, windows and engines are drawn hotter)
const BLOOM = { strength: 0.8, radius: 0.55, threshold: 1.7 };
const SOFTEST = 0.6; // device pixels to a CSS one, at the least, however busy

// NaN and infinity both have every exponent bit set; tested on the bits,
// since a compiler allowed fast maths may drop isnan(). The boolean mix()
// picks a side without arithmetic (a NaN times nought is still NaN).
const FINITE = `
vec3 finite(vec3 c) {
  bvec3 bad = equal(floatBitsToUint(c) & 0x7f800000u, uvec3(0x7f800000u));
  return clamp(mix(c, vec3(0.0), bad), 0.0, 64.0);
}`;

const FINAL = {
  uniforms: {
    tDiffuse: { value: null },
    uContrast: { value: 0.07 },
    uSat: { value: 1.06 },
    uVignette: { value: 0.3 },
    uAspect: { value: 16 / 9 },
    uRush: { value: 0 },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uHit: { value: 0 },
    uLens: { value: new THREE.Vector3(0.5, 0.5, 0) },
    // nearer than x (along the view) isn't bent; y the twist; z the shadow's
    // radius on the canvas, where it's to be drawn black itself (0: not)
    uLensMore: { value: new THREE.Vector3(1e9, 0, 0) },
    tDepth: { value: null },
    uNear: { value: 0.1 },
    uFar: { value: 1000 },
  },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uContrast, uSat, uVignette, uAspect, uRush, uHit;
    uniform vec2 uCenter;
    uniform vec3 uLens;
    uniform vec3 uLensMore;
    uniform sampler2D tDepth;
    uniform float uNear, uFar;
    varying vec2 vUv;
    ${FINITE}
    vec3 shoulder(vec3 c) {
      float peak = max(c.r, max(c.g, c.b));
      if (peak < 0.8) return c;
      float top = 1.0 - 0.04 / (peak - 0.6);
      c *= top / peak;
      return mix(c, vec3(top), 1.0 - 1.0 / (0.15 * (peak - top) + 1.0));
    }
    vec3 srgb(vec3 c) {
      return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    }
    vec3 scene(vec2 uv) { return finite(texture2D(tDiffuse, uv).rgb); }
    // how far off what's drawn at uv is, along the view
    float depthAt(vec2 uv) {
      float d = texture2D(tDepth, uv).x;
      return uNear * uFar / max(uFar - d * (uFar - uNear), 1e-6);
    }
    void main() {
      vec2 uv = vUv;
      float shadow = 1.0;
      if (uLens.z > 0.0005 && depthAt(vUv) > uLensMore.x) {
        // bent light round the black hole: each pixel shows what's a little
        // further out from it, by the shadow's size squared over the distance,
        // and turned a little round it, more the closer in
        vec2 d = (uv - uLens.xy) * vec2(uAspect, 1.0);
        float r = max(length(d), 1e-4);
        float z = uLens.z;
        float bend = z * z / r * (1.0 - smoothstep(z * 2.0, z * 9.0, r));
        float a = uLensMore.y * min(z * z / (r * r), 3.0);
        vec2 dir = d / r;
        dir = vec2(dir.x * cos(a) - dir.y * sin(a), dir.x * sin(a) + dir.y * cos(a));
        vec2 bent = uLens.xy + dir * (r - min(bend, r * 0.95)) / vec2(uAspect, 1.0);
        // (what lands on something in front of the hole isn't what's behind it)
        if (depthAt(bent) > uLensMore.x) uv = bent;
        if (uLensMore.z > 0.0) shadow = smoothstep(uLensMore.z * 0.96, uLensMore.z, r);
      }
      vec3 lin = scene(uv) * shadow;
      if (uRush > 0.001) {
        // a few taps back toward the ship, more smeared the further out
        vec2 d = uv - uCenter;
        float k = uRush * smoothstep(0.1, 0.75, length(d * vec2(uAspect, 1.0)));
        vec3 acc = lin;
        for (int i = 1; i <= 5; i++) acc += scene(uv - d * (k * 0.011 * float(i)));
        lin = acc / 6.0;
      }
      vec3 c = srgb(clamp(shoulder(lin), 0.0, 1.0));
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = max(mix(vec3(l), c, uSat), 0.0);
      c = mix(c, c * c * (3.0 - 2.0 * c), uContrast);
      vec2 q = vUv - 0.5;
      q.x *= uAspect;
      c *= 1.0 - (uVignette + uRush * 0.22) * smoothstep(0.35 - uRush * 0.1, 1.1, length(q) * 1.25);
      // a hit: the edges flash red
      c = mix(c, vec3(1.0, 0.12, 0.08), uHit * 0.4 * smoothstep(0.45, 1.15, length(q) * 1.3));
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export function createPost(renderer, scene, camera, { small = false } = {}) {
  // multisampled below a pixel ratio of about 2; at 2 the pixels are too
  // small for jagged edges to show, and on a half-float target four samples
  // a pixel cost more than the rest of the frame put together. (With its
  // depth, for the black hole's lens to tell what's in front of it.)
  const samples = renderer.getPixelRatio() >= 1.75 ? 0 : small ? 2 : 4;
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples, depthTexture: new THREE.DepthTexture(1, 1) });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  // whatever's drawn over the scene (the cockpit), with a fresh depth
  const over = new RenderPass(scene, camera);
  over.clear = false;
  over.clearDepth = true;
  over.enabled = false;
  composer.addPass(over);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), BLOOM.strength, BLOOM.radius, BLOOM.threshold);
  // its first step (picking out what's bright enough to glow) reads through finite()
  const bright = bloom.materialHighPassFilter;
  const read = 'vec4 texel = texture2D( tDiffuse, vUv );';
  if (bright.fragmentShader.includes(read)) {
    bright.fragmentShader = bright.fragmentShader.replace('void main() {', `${FINITE}\nvoid main() {`).replace(read, 'vec4 texel = vec4( finite( texture2D( tDiffuse, vUv ).rgb ), 1.0 );');
    bright.needsUpdate = true;
  }
  composer.addPass(bloom);
  const grade = new ShaderPass(FINAL);
  composer.addPass(grade);

  let on = true;
  let glow = true; // bloom, until lite() takes it off
  let sharp = 1; // a share of the renderer's pixel ratio the passes are drawn at
  const at = { w: 0, h: 0, ratio: 0 };
  return {
    get on() {
      return on;
    },
    // where the scene is drawn: the post's own target, or the canvas once it's off
    get target() {
      return on ? composer.readBuffer : null;
    },
    // (for making its passes' shaders before the first frame)
    composer,
    // how sharp to draw, 0…1 of the renderer's pixel ratio (lib/three/pace)
    get sharpness() {
      return sharp;
    },
    set sharpness(k) {
      sharp = k;
    },
    // draw a frame (the renderer's pixel ratio can change under us, when the
    // watchdog trades sharpness for speed)
    render(w, h) {
      if (!on) {
        renderer.render(scene, camera);
        if (over.enabled) {
          const was = renderer.autoClear;
          renderer.autoClear = false;
          renderer.clearDepth();
          renderer.render(over.scene, over.camera);
          renderer.autoClear = was;
        }
        return;
      }
      const full = renderer.getPixelRatio();
      const ratio = Math.min(full, Math.max(SOFTEST, full * sharp));
      if (w !== at.w || h !== at.h || ratio !== at.ratio) {
        Object.assign(at, { w, h, ratio });
        composer.setPixelRatio(ratio);
        composer.setSize(w, h);
        // the glow is a blur: worked out at the page's own pixels, not the
        // screen's, it looks the same on every screen and costs a quarter
        // as much on a sharp one
        const k = Math.min(1, ratio);
        bloom.setSize(Math.round(w * k), Math.round(h * k));
        grade.uniforms.uAspect.value = w / h;
      }
      // the scene draws into the composer's read buffer, and the last pass reads it there
      grade.uniforms.tDepth.value = composer.readBuffer.depthTexture;
      grade.uniforms.uNear.value = camera.near;
      grade.uniforms.uFar.value = camera.far;
      composer.render();
    },
    // a scene drawn over the first, from `cam` (null: nothing)
    overlay(s, cam) {
      over.enabled = Boolean(s);
      over.scene = s ?? scene;
      over.camera = cam ?? camera;
    },
    // bloom's strength, for a moment's flare (a boost, an arrival)
    flare(k) {
      if (glow) bloom.strength = BLOOM.strength * k;
    },
    // the boost's rush, 0…1, out from (x, y) on the canvas (0…1, y up)
    rush(k, x = 0.5, y = 0.5) {
      grade.uniforms.uRush.value = k;
      grade.uniforms.uCenter.value.set(x, y);
    },
    // a laser hit's red flash, 0…1
    hit(k) {
      grade.uniforms.uHit.value = k;
    },
    // the black hole's bending: at (x, y) on the canvas (0…1, y up), its
    // shadow r high (as a share of the canvas's height); r 0 for none.
    // front: nearer than this (along the view) is in front of it, and not
    // bent; twist: radians, at its edge, turned round with its spin; black:
    // the shadow's radius on the canvas, drawn black (0: left to the scene)
    lens(x, y, r, { front = 1e9, twist = 0, black = 0 } = {}) {
      grade.uniforms.uLens.value.set(x, y, r);
      grade.uniforms.uLensMore.value.set(front, twist, black);
    },
    off() {
      if (!on) return;
      on = false;
      composer.dispose();
    },
    // a lighter post, short of none: the bloom goes (its blur is most of the
    // post's cost) and the grade stays, so the picture keeps its tone map and
    // colour; flare() then does nothing. Harmless to call again.
    lite() {
      glow = false;
      bloom.enabled = false;
    },
    dispose() {
      composer.dispose();
      bloom.dispose();
      grade.material.dispose();
    },
  };
}

export function spaceEnvironment(renderer, sky) {
  const env = new THREE.Scene();
  const made = [];
  const add = (geo, mat, pos) => {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.copy(pos);
    env.add(m);
    made.push(geo, mat);
  };
  add(
    new THREE.SphereGeometry(10, 48, 24),
    sky ? new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, color: new THREE.Color(3, 3, 3.4) }) : new THREE.MeshBasicMaterial({ color: '#0b0f1c', side: THREE.BackSide }),
  );
  add(new THREE.SphereGeometry(1.5, 24, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 8.2, 7.2) }), LIGHT.clone().multiplyScalar(7));
  add(new THREE.SphereGeometry(2.2, 24, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.45, 1.1) }), FILL.clone().multiplyScalar(7));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.02);
  pmrem.dispose();
  for (const thing of made) thing.dispose();
  return rt;
}
