// The Rick and Morty worlds' stage on the runtime's renderer: lib/stage3d's
// picture (the house's Neutral tone at the house's exposure, sRGB, the
// scene drawn into a multisampled half-float buffer, bloom for what is over
// white, the output pass, then the grade: contrast, saturation, split
// toning, a vignette and fine grain), with lib/stage3d's face, so a scene
// written for it changes only the line that makes it. What lib/stage3d did
// for itself and the runtime now does is gone from here: the renderer and
// its canvas (rt.gfx.renderer, sized by the runtime at the module's
// `ratio`), the frame loop (the module's draw), the lost context (the
// runtime remounts the world) and the watchdog (the runtime's governor
// calls lowerQuality(level), which climbs the same ladder in the same
// order: sharpness, shadows, bloom, sharpness again).
//
// The renderer is shared: whatever the stage sets on it (the tone mapping,
// the exposure, shadows, `info.autoReset`, the clear colour) is set as each
// of its calls starts and given back as it ends (`hold`, `giveBack`), so a
// world handed over to, or the runtime's own cover, finds it as it left
// it. The stage is held from its making through the scene's build (its
// builders draw: an environment, a bake) until the module gives it back;
// what a scene sets on the renderer meanwhile (houseOn's tone mapping) is
// kept as the stage's. `track` (an array) is told of the stage as it's
// made, so a build that fails can dispose it, and the renderer go back.
//
// createStage(rt, { soft, bloom, exposure, shadows, fov, near, far, autoReset, title, track }) →
//   { renderer, scene, camera, composer, prepare, bloomPass, grade, resize,
//     scale, render(ms), dispose, precompile, setLevel, lowerQuality(level),
//     tune, ratio, size, lost, disposed, quality, shadows }

import * as THREE from 'three';
import { budget, pixelRatio } from '../../lib/device';
import { debugOn, debugPanel } from '../../lib/debugPanel';
import { prepareScene, warmDraw } from '../../lib/three/gpuWork';
import { precompile as compileFor, precompilePasses } from '../../lib/three/renderer';
import { sharpen } from '../../lib/three/textures';
import { BLOOM } from '../../lib/three/bloom';
import { LOOK } from '../../lib/three/house';

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

// Bright colours for things that glow: above 1, so bloom picks them up.
export const hot = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);

// A canvas as a texture, repeating, sharp at a glancing angle.
export function canvasTexture(canvas, renderer, { repeat = [1, 1], srgb = true, wrap = true } = {}) {
  return sharpen(new THREE.CanvasTexture(canvas), { renderer, color: srgb ? true : undefined, wrap: Boolean(wrap), repeat });
}

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

// The sharpest the stage draws at (lib/stage3d's): lib/device's ratio for
// this device under 1.75, the screen's own pixels at most for software
// rendering. A module's `ratio`, so the runtime sizes the canvas to it.
export const stageRatio = ({ soft = false, tier } = {}) => pixelRatio(soft ? 1 : 1.75, tier);

// Behind ?debug, the one panel with the stage's bloom first and the game's
// groups after, titled by the page it's on (lib/stage3d's stageTune).
function stageTune({ bloomPass, title }) {
  let panel = null;
  return {
    tune(groups = []) {
      if (!debugOn()) return;
      const name = title() || 'stage';
      panel ??= debugPanel({ title: name });
      const bloom = {
        name: 'bloom',
        items: [
          { key: 'threshold', type: 'range', min: 0, max: 2, get: () => bloomPass.threshold, set: (v) => (bloomPass.threshold = v) },
          { key: 'strength', type: 'range', min: 0, max: 2, get: () => bloomPass.strength, set: (v) => (bloomPass.strength = v) },
          { key: 'radius', type: 'range', min: 0, max: 1, get: () => bloomPass.radius, set: (v) => (bloomPass.radius = v) },
        ],
      };
      panel.open([bloom, ...groups], { title: name, id: name });
    },
    close() {
      panel?.dispose();
      panel = null;
    },
  };
}

// What the stage sets on the shared renderer, read and put back.
const KEPT = ['toneMapping', 'toneMappingExposure', 'outputColorSpace', 'autoClear'];
export function rendererState(renderer) {
  const color = new THREE.Color();
  return {
    read() {
      const s = Object.fromEntries(KEPT.map((k) => [k, renderer[k]]));
      s.shadows = renderer.shadowMap.enabled;
      s.shadowType = renderer.shadowMap.type;
      s.autoReset = renderer.info.autoReset;
      s.clear = renderer.getClearColor(color).getHex();
      s.alpha = renderer.getClearAlpha();
      return s;
    },
    write(s) {
      for (const k of KEPT) renderer[k] = s[k];
      renderer.shadowMap.enabled = s.shadows;
      renderer.shadowMap.type = s.shadowType;
      renderer.info.autoReset = s.autoReset;
      renderer.setClearColor(color.setHex(s.clear), s.alpha);
    },
  };
}

// Steps down when frames run long: sharpness first, then shadows, then
// bloom, then sharpness again (lib/stage3d's ladder, the governor's levels).
export const LADDER = ['full', 'ratio', 'shadows', 'bloom', 'low'];

export function createStage(rt, { soft = false, bloom = BLOOM, exposure = LOOK.exposure, shadows = false, fov = 60, near = 0.1, far = 600, autoReset = true, title = null, track = null } = {}) {
  const fit = budget();
  const { renderer } = rt.gfx;
  const state = rendererState(renderer);
  // what the stage wants of the renderer while it draws (a scene may change
  // it as it's built: houseOn, info.autoReset; `mine` is updated from what
  // the renderer holds as each draw ends, and the runtime's put back)
  const theirs = state.read();
  renderer.info.autoReset = autoReset;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.shadowMap.enabled = shadows && !soft && fit.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.autoClear = true;
  renderer.setClearColor(0x000000, 1); // (lib/stage3d's renderer, made without alpha, cleared to opaque black)
  let mine = state.read();
  let held = null;
  // (the runtime's renderer as the stage found it, back after each of its
  // calls into the stage; the stage's, back before them)
  const hold = () => {
    if (held) return false;
    held = state.read();
    state.write(mine);
    return true;
  };
  const giveBack = () => {
    if (!held) return;
    mine = state.read();
    state.write(held);
    held = null;
  };
  // (held through the build, till the module gives it back: a scene's
  // builders draw as they go, an environment, a bake, and drew with
  // lib/stage3d's renderer as the stage had set it; with the runtime's
  // tone mapping instead, the picture came out a level off all over)
  held = theirs;

  const full = stageRatio({ soft });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 16 / 9, near, far);

  // the scene renders into a multisampled half-float target (the canvas's own
  // antialiasing doesn't reach an offscreen one), then bloom, then the tone
  // map, then the grade: the runtime's chain (rt.gfx.post), its buffers
  // multisampled as lib/stage3d's were
  const post = rt.gfx.post([{ kind: 'render', scene, camera }, { kind: 'bloom', strength: bloom.strength, radius: bloom.radius, threshold: bloom.threshold }, { kind: 'output' }, { kind: 'shader', material: GRADE }]);
  const { composer } = post;
  const [, bloomPass, , gradePass] = post.passes;
  const samples = soft ? 0 : fit.samples;
  for (const t of [composer.renderTarget1, composer.renderTarget2]) {
    t.samples = samples;
    t.dispose();
  }
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

  // The composer's buffers at the stage's ratio times the world's own
  // sharpness (`scale`), made at the next frame drawn, not when asked: a
  // buffer made is cleared, and a frame that then drew nothing showed the
  // page through it (lib/stage3d's stageSizing, the canvas left out: it's
  // the runtime's).
  let size = { w: 1, h: 1 };
  let ratio = full;
  let k = 1;
  let made = null;
  const want = () => ({ w: size.w, h: size.h, r: ratio * k });
  const fitBuffers = () => {
    const n = want();
    if (made && n.w === made.w && n.h === made.h && n.r === made.r) return false;
    made = n;
    composer.setPixelRatio(n.r);
    composer.setSize(n.w, n.h);
    bloomPass.resolution.set(n.w / 2, n.h / 2);
    return true;
  };
  const resize = (w, h) => {
    const next = { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
    if (next.w !== size.w || next.h !== size.h) size = next;
    gradePass.uniforms.uAspect.value = size.w / size.h;
    camera.aspect = size.w / size.h;
    camera.updateProjectionMatrix();
  };

  const setLevel = (name) => {
    const was = hold();
    level = Math.max(level, LADDER.indexOf(name));
    if (level >= LADDER.indexOf('ratio') && ratio > 1) ratio = 1;
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
      for (const t of [composer.renderTarget1, composer.renderTarget2]) {
        t.samples = 0;
        t.dispose();
      }
    }
    if (level >= LADDER.indexOf('low') && ratio > 0.75) ratio = 0.75;
    if (was) giveBack();
  };
  if (soft || !fit.bloom) setLevel('bloom');
  // the governor's level (the runtime's pace steps, 0 its sharpest): a rung each
  const lowerQuality = (n = 0) => setLevel(LADDER[Math.max(0, Math.min(LADDER.length - 1, n))]);

  let warming = 0; // precompiles in flight (below)
  let passesDone = false;
  let drawn = false;
  let disposed = false;
  const lost = () => Boolean(rt.gfx?.lost);
  const draw = () => {
    fitBuffers();
    if (soft) renderer.render(scene, camera);
    else composer.render();
    drawn = true;
  };
  const render = (ms = 16) => {
    if (lost() || disposed || warming) return;
    const was = hold();
    gradePass.uniforms.uTime.value += ms / 1000;
    if (!drawn) warmDraw(renderer, draw, [scene]);
    draw();
    if (was) giveBack();
  };

  // (titled, as lib/stage3d's was, by the page the canvas is on)
  const tuning = stageTune({ bloomPass, title: () => title?.() || rt.gfx?.canvas?.closest?.('[data-route]')?.dataset.route || (typeof document !== 'undefined' ? document.title : null) });

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    tuning.close();
    disposeTree(scene);
    if (scene.environment?.isTexture) scene.environment.dispose();
    if (scene.background?.isTexture) scene.background.dispose();
    post.dispose();
    bloomPass.dispose?.();
    gradePass.dispose?.();
    if (held) giveBack();
  };

  const precompile = (root = scene) => {
    if (lost() || disposed) return Promise.resolve();
    const was = hold();
    if (!drawn) fitBuffers();
    const jobs = root ? [compileFor(renderer, root, camera, scene, soft ? null : composer.readBuffer)] : [];
    if (!soft && !passesDone) {
      passesDone = true;
      jobs.push(precompilePasses(renderer, composer, camera));
    }
    if (was) giveBack();
    warming += 1;
    return Promise.all(jobs).then(() => {
      warming -= 1;
    });
  };

  // Everything sent to the graphics chip before the world is first seen
  // (lib/three/gpuWork), a slice at a time, with progress for the loading
  // screen. (Held across its awaits: nothing else draws on the renderer
  // while a world prepares behind its loading screen but the cover.)
  const prepare = async (onProgress, { alive = () => true } = {}) => {
    const on = () => alive() && !lost() && !disposed;
    const was = hold();
    try {
      if (!drawn) fitBuffers();
      if (!soft && !passesDone) {
        passesDone = true;
        await precompilePasses(renderer, composer, camera);
      }
      if (!on()) return;
      await prepareScene({ renderer, roots: [scene], scene, camera, target: soft ? null : composer.readBuffer, render: draw, onProgress, alive: on });
    } finally {
      if (was) giveBack();
    }
  };

  const stage = {
    renderer,
    scene,
    camera,
    composer,
    prepare,
    bloomPass,
    grade,
    resize,
    // drawn softer than the stage's ratio by k (1, its sharpest): the
    // composer's buffers made again at the next frame drawn
    scale: (v) => (k = v),
    render,
    dispose,
    precompile,
    setLevel,
    lowerQuality,
    tune: tuning.tune,
    // the renderer the stage's way for a call outside render (a scene's own
    // drawing between frames), and back
    hold,
    giveBack,
    ratio: full,
    get size() {
      return size;
    },
    get lost() {
      return lost();
    },
    get disposed() {
      return disposed;
    },
    get quality() {
      return LADDER[level];
    },
    get shadows() {
      return mine.shadows;
    },
  };
  track?.push(stage);
  return stage;
}

// The page's frame run as the world's draw (the Citadel's and C-137's
// modules): `ref.current` is the page's frame while its world is live, null
// when not. Run with the renderer held the stage's way, and timed as the
// page's own loop timed it (lib/hooks' useFrameLoop): a frame begun anew (the
// page's, set again) starts on 16 ms, not on the runtime's interval, whose
// loop may have run on meanwhile (the cover's fade, the world's first draw),
// so the world's clock reads as it did before the runtime drew it.
// pageFrame(stage, ref) → { draw({ dt, now }), wants(), setRef(ref) }
export function pageFrame(stage, ref = null) {
  let at = ref;
  let last = null;
  return {
    draw({ dt, now }) {
      const fn = at?.current ?? null;
      const fresh = fn !== last;
      last = fn;
      if (!fn) return;
      const was = stage.hold();
      try {
        fn(fresh ? 16 : dt * 1000, now);
      } finally {
        if (was) stage.giveBack();
      }
    },
    wants: () => Boolean(at?.current),
    setRef(next) {
      if (next) at = next;
    },
  };
}
