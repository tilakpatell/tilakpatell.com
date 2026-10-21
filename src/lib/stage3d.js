// The 3D games' common ground: a renderer set up the same way for each (the
// house's Neutral tone mapping at the house's exposure, lib/three/house, so a
// world that calls houseOn after it passes keepExposure; sRGB, multisampled,
// bloom for what is over white only, lib/three/bloom's numbers; then a grade:
// contrast, saturation, split toning, a vignette and fine grain), sized to its canvas,
// that steps its own quality down when frames run long, tells the game when
// the GPU goes away, and frees everything it made when the game ends.
//
// Loaded only with a game, so nobody else downloads Three.js.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { budget, pixelRatio } from './device';
import { debugOn, debugPanel } from './debugPanel';
import { guard } from './three/frameGuard';
import { prepareScene, warmDraw } from './three/gpuWork';
import { precompile as compileFor, precompilePasses, quiet, releaseContext } from './three/renderer';
import { canvasTexture, hot } from './three/canvasTexture';

// (written in ./three/canvasTexture.js, free of this file's post chain, so a
// node world may paint a canvas too; here for the scenes that import them from here)
export { canvasTexture, hot };
import { BLOOM } from './three/bloom';
import { LOOK } from './three/house';

// The last step, on the display-ready picture: a film-like grade.
export const GRADE = {
  uniforms: {
    tDiffuse: { value: null },
    uContrast: { value: 0.12 },
    uSat: { value: 1.04 },
    uShadow: { value: new THREE.Color(0, 0.006, 0.02) },
    uHigh: { value: new THREE.Color(0.02, 0.01, 0) },
    uVignette: { value: 0.22 },
    uGrain: { value: 0.022 },
    uAspect: { value: 16 / 9 },
    uTime: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uContrast, uSat, uVignette, uGrain, uAspect, uTime;
    uniform vec3 uShadow, uHigh;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = max(mix(vec3(l), c, uSat), 0.0);
      c = mix(c, c * c * (3.0 - 2.0 * c), uContrast);
      c += uShadow * (1.0 - l) * (1.0 - l) + uHigh * l * l;
      vec2 q = vUv - 0.5;
      q.x *= uAspect;
      c *= 1.0 - uVignette * smoothstep(0.3, 1.05, length(q) * 1.3);
      float n = fract(sin(dot(floor(gl_FragCoord.xy) + fract(uTime) * 71.0, vec2(12.9898, 78.233))) * 43758.5453);
      c += (n - 0.5) * uGrain;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

// Free a whole tree: geometries, materials and every texture they hold.
export function disposeTree(root) {
  root.traverse((o) => {
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) u.value.dispose();
      m.dispose?.();
    }
    o.dispose?.(); // instanced meshes, skeletons
  });
}

// The sharpest the stage draws at: lib/device's ratio for this device under
// 1.75 (so a high-tier desktop on a plain monitor is supersampled, drawn at
// 1.25 pixels for each of the screen's), and the screen's own pixels at
// most for software rendering. The watchdog below steps it down from there.
export function stageRatio({ soft = false, tier } = {}) {
  return pixelRatio(soft ? 1 : 1.75, tier);
}

// The stage's own values for the tuning panel (lib/debugPanel): the bloom,
// which every stage has, read and written on its pass live.
export const stageBloomGroups = (pass) => [
  {
    name: 'bloom',
    items: [
      { key: 'threshold', type: 'range', min: 0, max: 2, get: () => pass.threshold, set: (v) => (pass.threshold = v) },
      { key: 'strength', type: 'range', min: 0, max: 2, get: () => pass.strength, set: (v) => (pass.strength = v) },
      { key: 'radius', type: 'range', min: 0, max: 1, get: () => pass.radius, set: (v) => (pass.radius = v) },
    ],
  },
];

// stage.tune(groups): behind ?debug, the one panel with the stage's bloom
// first and the game's groups after, titled (and its values kept for the
// tab) by the page it's on: the canvas's nearest [data-route], else the
// document's title. Without ?debug nothing is made. (`on`, `panel` and
// `title` are for the tests.)
export function stageTune({ bloomPass, on = debugOn, panel: makePanel = debugPanel, title = () => null } = {}) {
  let panel = null;
  return {
    tune(groups = []) {
      if (!on()) return;
      const name = title() || 'stage';
      panel ??= makePanel({ title: name });
      panel.open([...stageBloomGroups(bloomPass), ...groups], { title: name, id: name });
    },
    close() {
      panel?.dispose();
      panel = null;
    },
  };
}

// The drawing buffers' size, apart from when they're made. The canvas is
// its size in CSS pixels at the stage's ratio; the composer's buffers, where
// the scene is drawn, are at that ratio times the world's own sharpness
// (`scale`, lib/three/pace's step for one drawn softer while frames come
// late), the last pass drawing the picture up to the canvas, as the
// universe's post does. So a pace step never reallocates the canvas, which
// waits on the graphics chip (one to two seconds on Metal when it's busy);
// only a new size and the watchdog's rung do, and a step when the scene is
// drawn straight to the canvas (`soft`). resize, scale and ratio only note
// what's wanted; fit() makes it, once, at the start of a frame that is
// about to draw: a canvas reallocated is cleared, and a frame that then
// drew nothing (an area still building, its shaders still warming) showed
// the page through it, black.
//
// stageSizing({ ratio, soft, canvas(w, h, pixelRatio), buffers(w, h, pixelRatio) }) →
//   { resize(w, h) → changed, scale(k), setRatio(r), fit() → made, size, ratio, sharpness, stale }
export function stageSizing({ ratio: r0 = 1, soft = false, canvas, buffers }) {
  let size = { w: 1, h: 1 };
  let ratio = r0;
  let k = 1;
  let made = { w: 1, h: 1, canvas: r0, buffers: r0 }; // (as created)
  const want = () => ({ w: size.w, h: size.h, canvas: soft ? ratio * k : ratio, buffers: ratio * k });
  const stale = () => {
    const n = want();
    return n.w !== made.w || n.h !== made.h || n.canvas !== made.canvas || n.buffers !== made.buffers;
  };
  return {
    get size() {
      return size;
    },
    get ratio() {
      return ratio;
    },
    get sharpness() {
      return k;
    },
    get stale() {
      return stale();
    },
    resize(w, h) {
      const next = { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
      if (next.w === size.w && next.h === size.h) return false;
      size = next;
      return true;
    },
    scale(v) {
      k = v;
    },
    setRatio(v) {
      ratio = v;
    },
    fit() {
      const n = want();
      const moved = n.w !== made.w || n.h !== made.h;
      const c = moved || n.canvas !== made.canvas;
      const b = moved || n.buffers !== made.buffers;
      made = n;
      if (c) canvas(n.w, n.h, n.canvas);
      if (b) buffers(n.w, n.h, n.buffers);
      return c || b;
    },
  };
}

// Steps down when frames run long: sharpness first, then shadows, then
// bloom, then sharpness again. Nothing comes back during a game, so the
// picture doesn't flicker between settings.
const LADDER = ['full', 'ratio', 'shadows', 'bloom', 'low'];

export function createStage(canvas, { soft = false, bloom = BLOOM, exposure = LOOK.exposure, shadows = false, fov = 60, near = 0.1, far = 600, onLost, onSlow } = {}) {
  // what this device can afford (lib/device): a phone starts less sharp with
  // less multisampling, a weak device without shadows or bloom
  const fit = budget();
  const renderer = quiet(new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false, stencil: false }));
  // (what arrives late is held back until it's ready, not waited for:
  // lib/three/frameGuard; the composer's buffers are the frame's at any
  // sharpness, smaller than the canvas or not)
  guard(renderer, { frames: (t) => t === composer.renderTarget1 || t === composer.renderTarget2 });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.shadowMap.enabled = shadows && !soft && fit.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const full = stageRatio({ soft });
  renderer.setPixelRatio(full);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 16 / 9, near, far);

  // the scene renders into a multisampled target (the canvas's own
  // antialiasing doesn't reach an offscreen target), then bloom, then the
  // tone map, then the grade
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: soft ? 0 : fit.samples });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), bloom.strength, bloom.radius, bloom.threshold);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  const gradePass = new ShaderPass(GRADE);
  composer.addPass(gradePass);
  const grade = (o = {}) => {
    const u = gradePass.uniforms;
    if (o.contrast != null) u.uContrast.value = o.contrast;
    if (o.saturation != null) u.uSat.value = o.saturation;
    if (o.vignette != null) u.uVignette.value = o.vignette;
    if (o.grain != null) u.uGrain.value = o.grain;
    if (o.shadow) u.uShadow.value.setRGB(...o.shadow);
    if (o.high) u.uHigh.value.setRGB(...o.high);
  };
  let useBloom = !soft;
  let level = soft ? LADDER.indexOf('bloom') : 0;

  // (the buffers made at the next frame drawn: stageSizing above; the
  // camera's shape at once, so what's placed over the canvas lines up)
  const sizing = stageSizing({
    ratio: full,
    soft,
    // (its size and ratio together: setPixelRatio then setSize reallocated it twice)
    canvas: (w, h, pr) => renderer.setDrawingBufferSize(w, h, pr),
    buffers: (w, h, pr) => {
      composer.setPixelRatio(pr);
      composer.setSize(w, h);
      bloomPass.resolution.set(w / 2, h / 2);
    },
  });
  const resize = (w, h) => {
    sizing.resize(w, h);
    const { w: sw, h: sh } = sizing.size;
    gradePass.uniforms.uAspect.value = sw / sh;
    camera.aspect = sw / sh;
    camera.updateProjectionMatrix();
  };

  // The GPU can go away (a driver reset, too many tabs): stop and tell the game.
  let lost = false;
  const onContextLost = (e) => {
    e.preventDefault();
    lost = true;
    onLost?.();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  const setLevel = (name) => {
    level = Math.max(level, LADDER.indexOf(name));
    if (level >= LADDER.indexOf('ratio') && sizing.ratio > 1) sizing.setRatio(1);
    if (level >= LADDER.indexOf('shadows') && renderer.shadowMap.enabled) {
      renderer.shadowMap.enabled = false;
      scene.traverse((o) => {
        if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true));
      });
    }
    if (level >= LADDER.indexOf('bloom') && useBloom) {
      useBloom = false;
      bloomPass.enabled = false;
      // and stop multisampling
      for (const rt of [composer.renderTarget1, composer.renderTarget2]) {
        rt.samples = 0;
        rt.dispose();
      }
    }
    if (level >= LADDER.indexOf('low') && sizing.ratio > 0.75) sizing.setRatio(0.75);
  };
  if (soft || !fit.bloom) setLevel('bloom');

  // Average the last two seconds of frames; past 24 ms, step down one rung.
  const perf = { acc: 0, n: 0, warm: 30 };
  const watch = (ms) => {
    if (perf.warm > 0) {
      perf.warm -= 1; // the first frames compile shaders
      return;
    }
    perf.acc += Math.min(ms, 250);
    perf.n += 1;
    if (perf.n < 120) return;
    const avg = perf.acc / perf.n;
    perf.acc = 0;
    perf.n = 0;
    if (avg < 24) return;
    if (level < LADDER.length - 1) setLevel(LADDER[level + 1]);
    else onSlow?.(avg);
  };

  let warming = 0; // precompiles in flight (below)
  let passesDone = false;
  let drawn = false; // a picture on the canvas yet (prepare's or a frame's)
  // a new size or sharpness made first, in the same callback as the draw
  const draw = () => {
    sizing.fit();
    // software rendering draws straight to the canvas: every full-screen pass costs
    if (soft) renderer.render(scene, camera);
    else composer.render();
    drawn = true;
  };
  const render = (ms = 16) => {
    if (lost || disposed || warming) return;
    // (before the draw: a step it takes is made with this frame's)
    watch(ms);
    gradePass.uniforms.uTime.value += ms / 1000;
    // (a world that isn't prepared below: everything in it drawn once first,
    // out of sight, what's hidden or out of view too, as prepare does. The
    // frame guard draws that whole, so the world doesn't come up as its sky
    // alone, nor a thing out of view at first come in a few frames late:
    // this frame takes the compiling it always did, and more of it)
    if (!drawn) warmDraw(renderer, draw, [scene]);
    draw();
  };

  const tuning = stageTune({ bloomPass, title: () => canvas.closest?.('[data-route]')?.dataset.route || (typeof document !== 'undefined' ? document.title : null) });

  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    tuning.close();
    canvas.removeEventListener('webglcontextlost', onContextLost);
    disposeTree(scene);
    if (scene.environment?.isTexture) scene.environment.dispose();
    if (scene.background?.isTexture) scene.background.dispose();
    composer.dispose?.();
    bloomPass.dispose?.();
    gradePass.dispose?.();
    renderer.dispose();
    // the canvas is the game's own and goes with it: give the context back
    // (lib/three/renderer: once nothing is compiling, so the wait for it lands nowhere)
    releaseContext(renderer);
  };

  // Every shader the game will draw with, compiled in the background (lib/three/
  // renderer's precompile): a game awaits this before its first frame, and
  // calls it again when it builds something new (`root`, already in the
  // scene; null for the passes alone). The passes are compiled the first time
  // only. Until it's done render() holds the last frame, rather than drawing
  // one that would stop the page while the GPU links.
  const precompile = (root = scene) => {
    if (lost || disposed) return Promise.resolve();
    // (the buffers made now while nothing's been drawn, behind the loading
    // screen; after that at the next frame drawn, as render() holds the
    // last frame while this warms)
    if (!drawn) sizing.fit();
    // the scene draws into the composer's buffer, or (soft) straight to the canvas
    const jobs = root ? [compileFor(renderer, root, camera, scene, soft ? null : composer.readBuffer)] : [];
    if (!soft && !passesDone) {
      passesDone = true;
      jobs.push(precompilePasses(renderer, composer, camera));
    }
    warming += 1;
    return Promise.all(jobs).then(() => {
      warming -= 1;
    });
  };

  // Everything sent to the graphics chip before the world is first seen
  // (lib/three/gpuWork): the passes' shaders, then every picture, every
  // shader and one draw of it all, a slice at a time, with progress for
  // the page's loading screen (components/worlds/LoadingVeil)
  const prepare = async (onProgress, { alive = () => true } = {}) => {
    const on = () => alive() && !lost && !disposed;
    if (!drawn) sizing.fit();
    if (!soft && !passesDone) {
      passesDone = true;
      await precompilePasses(renderer, composer, camera);
    }
    if (!on()) return;
    await prepareScene({ renderer, roots: [scene], scene, camera, target: soft ? null : composer.readBuffer, render: draw, onProgress, alive: on });
  };

  return {
    renderer,
    scene,
    camera,
    composer,
    prepare,
    bloomPass,
    grade,
    resize,
    // drawn softer than the stage's ratio by k (1, its sharpest): the
    // composer's buffers made again at the next frame drawn, not the canvas
    scale: sizing.scale,
    render,
    dispose,
    precompile,
    setLevel,
    tune: tuning.tune,
    get size() {
      return sizing.size;
    },
    get lost() {
      return lost;
    },
    get disposed() {
      return disposed;
    },
    get quality() {
      return LADDER[level];
    },
    get shadows() {
      return renderer.shadowMap.enabled;
    },
  };
}
