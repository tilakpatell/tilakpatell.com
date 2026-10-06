// The WebGL renderer every page scene draws with: sRGB output, a pixel ratio
// the device can afford, a watchdog that trades sharpness for frame rate before
// giving up on 3D, context loss reported (not thrown), and a dispose that frees
// everything a scene made. Only lazily loaded scene modules import this, so a
// page that never draws in 3D never downloads three.js.

import * as THREE from 'three';
import { budget, pixelRatio } from '../device';

// The sharpest a device starts at: lib/device's tier (phones and small
// screens start lower), under the scene's own cap.
export const maxRatio = (cap = 2) => pixelRatio(cap);

// The pixel ratio a canvas of w × h CSS pixels can really be drawn at: no
// more than `ratio`, no side past `side` (the graphics chip's limit: a
// drawing buffer past it is cut short and a render target past it is never
// made, so a screen as wide as three at a retina ratio got a frame of
// strips), and no more than `pixels` pixels all told.
export function fitRatio(w, h, ratio, { side = Infinity, pixels = Infinity } = {}) {
  if (!(w > 0 && h > 0)) return ratio;
  // (a hair under, so the renderer's own rounding can't step past the limit)
  return Math.min(ratio, (side - 0.5) / w, (side - 0.5) / h, Math.sqrt(pixels / (w * h)));
}

// The longest side the graphics chip will draw or render into: its smallest
// texture, renderbuffer and viewport limit.
export function maxSide(renderer) {
  const gl = renderer.getContext();
  const vp = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
  return Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), vp?.[0] ?? Infinity, vp?.[1] ?? Infinity) || 4096;
}

// A [r, g, b] (0-255, sRGB) from lib/three/theme as a THREE.Color.
export const color = (rgb, target = new THREE.Color()) => target.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);

export function createRenderer(canvas, { alpha = true, antialias = true, ratio = 2, toneMapping = THREE.NoToneMapping, exposure = 1, onLost, onSlow } = {}) {
  // (in development, window.__tpKeepFrames keeps the last frame readable for
  // automated screenshots of scenes that have stopped drawing)
  const preserveDrawingBuffer = import.meta.env.DEV && typeof window !== 'undefined' && !!window.__tpKeepFrames;
  // a weak device skips multisampling: at its pixel ratio it costs more than it shows
  const renderer = new THREE.WebGLRenderer({ canvas, alpha, antialias: antialias && budget().antialias, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer });
  // reading a shader's error log waits on the graphics chip, every new
  // shader: only worth it while developing
  renderer.debug.checkShaderErrors = Boolean(import.meta.env.DEV);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = toneMapping;
  renderer.toneMappingExposure = exposure;
  quiet(renderer);
  if (alpha) renderer.setClearColor(0x000000, 0);

  let pixelRatio = maxRatio(ratio);
  renderer.setPixelRatio(pixelRatio);
  const size = { w: 1, h: 1 };
  const side = maxSide(renderer);
  // the watchdog's ratio, inside what the graphics chip can hold at this size
  const fit = () => {
    renderer.setPixelRatio(fitRatio(size.w, size.h, pixelRatio, { side }));
    renderer.setSize(size.w, size.h, false);
  };

  let lost = false;
  const onContextLost = (e) => {
    e.preventDefault();
    lost = true;
    onLost?.();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  const dog = watchdog({
    ratio: pixelRatio,
    set(r) {
      pixelRatio = r;
      fit();
    },
    onSlow: () => onSlow?.(),
  });

  return {
    renderer,
    get lost() {
      return lost;
    },
    // (the ratio it draws at: the watchdog's, fitted to the chip)
    get ratio() {
      return renderer.getPixelRatio();
    },
    setSize(w, h) {
      size.w = Math.max(1, Math.round(w));
      size.h = Math.max(1, Math.round(h));
      fit();
    },
    size,
    // call once per drawn frame, with the frame's timestamp
    watch: dog.watch,
    dispose() {
      canvas.removeEventListener('webglcontextlost', onContextLost);
      renderer.dispose();
      if (!lost) releaseContext(renderer); // free the GPU soon, not at GC
    },
  };
}

// Slow frames, measured over a couple of seconds of real drawing (a pause
// longer than a second starts the count again). 3D first: nothing falls
// back to 2D for being slow. A stretch is slow when its typical frame (the
// slowest few left out, so a model arriving doesn't count) is under about
// 45fps, which on a 60Hz screen means it's missing the screen's beat.
// Sharpness steps down a quarter at a time, after two slow stretches in a
// row; if that and one more made frames no faster, they're taken back and
// that's the end of it (the screen or the browser is holding frames to 30,
// as a laptop on battery can, or the time is going somewhere sharpness
// doesn't reach). At the floor the scene is told once, so it can lower its own
// effects.
// `set(ratio)` applies a new sharpness; `watch(now)` is called once per
// drawn frame.
export function watchdog({ ratio, set, onSlow, floor = 0.75, slow = 22 }) {
  const gaps = [];
  let window0 = 0;
  let lastAt = 0;
  let slowRuns = 0;
  let tried = null; // the steps just taken: { from, before, steps }
  let settled = false;
  let told = false;
  let pixelRatio = ratio;
  const sharpness = (r) => {
    pixelRatio = r;
    set(r);
  };
  const watch = (now) => {
    if (!lastAt || now - lastAt > 1000) {
      lastAt = now;
      window0 = now;
      gaps.length = 0;
      return;
    }
    gaps.push(now - lastAt);
    lastAt = now;
    if (now - window0 < 2500 || gaps.length < 45) return;
    gaps.sort((a, b) => a - b);
    const keep = gaps.length - Math.ceil(gaps.length * 0.05);
    let spent = 0;
    for (let i = 0; i < keep; i++) spent += gaps[i];
    const typical = spent / keep;
    window0 = now;
    gaps.length = 0;
    const down = () => sharpness(Math.max(floor, Math.round((pixelRatio - 0.25) * 4) / 4));
    if (tried) {
      if (typical <= tried.before * 0.92) tried = null;
      else if (tried.steps < 2 && pixelRatio > floor) {
        // (with the screen's beat, one step may not be enough to show)
        tried.steps += 1;
        down();
      } else {
        sharpness(tried.from);
        settled = true;
        tried = null;
      }
      return;
    }
    slowRuns = typical < slow ? 0 : slowRuns + 1;
    if (slowRuns < 2 || settled) return;
    slowRuns = 0;
    if (pixelRatio > floor) {
      tried = { from: pixelRatio, before: typical, steps: 1 };
      down();
    } else if (!told) {
      told = true;
      onSlow?.();
    }
  };
  return { watch };
}

// Free every geometry, material and texture under `root`.
export function disposeTree(root) {
  const seen = new Set();
  const free = (thing) => {
    if (!thing || seen.has(thing)) return;
    seen.add(thing);
    thing.dispose?.();
  };
  root.traverse((o) => {
    free(o.geometry);
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const value of Object.values(m)) if (value?.isTexture) free(value);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) free(u.value);
      free(m);
    }
  });
}

// Everything under `roots` shown for one draw: what's hidden too, and
// nothing culled for being off screen, so a scene drawn once this way (behind
// something that covers it) has every texture and mesh on the graphics chip
// and every shader made before the moment it's first seen (three.js sends
// each the first time it's drawn, and that frame waits). Lights stay as they
// were: a hidden one shown would make shaders of its own. Returns the undo.
export function revealAll(...roots) {
  const undo = [];
  const set = (o, key, to) => {
    if (o[key] === to) return;
    undo.push([o, key, o[key]]);
    o[key] = to;
  };
  const show = (o, hidden) => {
    const was = hidden || !o.visible;
    if (o.isLight) {
      if (was) set(o, 'visible', false);
      return;
    }
    set(o, 'visible', true);
    if (o.isMesh || o.isPoints || o.isLine || o.isSprite) set(o, 'frustumCulled', false);
    for (const child of o.children) show(child, was);
  };
  for (const root of roots) show(root, false);
  return () => {
    for (let i = undo.length - 1; i >= 0; i--) undo[i][0][undo[i][1]] = undo[i][2];
  };
}

// Every picture the meshes under `root` use (each once, and only those whose
// image has arrived).
export function texturesUnder(root) {
  const found = new Set();
  const add = (t) => t?.isTexture && t.image && found.add(t);
  root.traverse((o) => {
    for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
      for (const v of Object.values(m)) add(v);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) add(u?.value);
    }
  });
  return [...found];
}

// One picture sent to the graphics chip now (nothing, if it's there already).
// Never throws: one that can't go up now goes up on its first frame, as before.
export function uploadTexture(renderer, texture) {
  try {
    renderer.initTexture(texture);
  } catch {
    /* it goes up on its first frame instead */
  }
}

// Every picture under `root` sent now (a model that arrived while its page
// was covered, or mid-launch), rather than on the frame it's first drawn,
// which would wait for them. Its shaders are precompile's.
export function uploadTextures(renderer, root) {
  for (const t of texturesUnder(root)) uploadTexture(renderer, t);
}

// three.js draws a transparent, double-sided material twice (its back faces,
// then its front), marking it changed before each, so its shader's settings
// are worked out afresh twice a frame (and the strings that takes are
// garbage). Where one pass draws the same picture, `root`'s get one: added
// light (the sum doesn't care about order) or anything flat (its faces never
// overlap each other). Glass round a cockpit keeps both.
const flatBox = new THREE.Box3();
const flatSize = new THREE.Vector3();
const flat = (geometry) => {
  if (!geometry?.attributes?.position) return false;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  flatBox.copy(geometry.boundingBox).getSize(flatSize);
  return Math.min(flatSize.x, flatSize.y, flatSize.z) <= 1e-6 * Math.max(flatSize.x, flatSize.y, flatSize.z, 1e-9);
};
export function singlePass(root) {
  root.traverse((o) => {
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (!m.transparent || m.side !== THREE.DoubleSide || m.forceSinglePass) continue;
      if (m.blending === THREE.AdditiveBlending || flat(o.geometry)) m.forceSinglePass = true;
    }
  });
  return root;
}

// Easing the site already uses in CSS: cubic-bezier(0.16, 1, 0.3, 1) is
// close to an exponential ease-out.
export const easeOut = (t) => (t >= 1 ? 1 : t <= 0 ? 0 : 1 - 2 ** (-10 * t));
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

// Reading a shader's error log waits for the GPU to finish linking it, and
// three.js reads it on every program's first draw: that wait is most of a
// page's freeze when a scene first comes into view. Development keeps the
// diagnostics; the built site doesn't ask.
export function quiet(renderer) {
  renderer.debug.checkShaderErrors = !!import.meta.env.DEV;
  return renderer;
}

// ── shaders compiled before they're needed ──
//
// The first frame that draws a material links its shader, and the page waits
// for the link (half a second or more for a big scene on a cold first visit).
// precompile() starts every link under `root` up front (hidden objects too)
// and resolves once they're all done: with KHR_parallel_shader_compile the GPU
// does that in the background while the page carries on, so a scene that
// waits for it before its first frame shows up without a stall. Without the
// extension it resolves at once and the first frame waits, as before. It
// never rejects, and never takes longer than CAP.
//
// `scene` is the scene `root` will be drawn in (its lights and fog are part of
// each shader); `target` is where it will be drawn when that isn't the canvas
// (a composer's buffer: no tone mapping or sRGB there, so different shaders).
//
// (three's own compileAsync does the same, but polls forever if the context
// goes in the meantime, and throws if the renderer is disposed first: a scene
// can be scrolled past before its shaders are done.)
const CAP = 4000;
let compiling = 0; // precompiles in flight, on any renderer (see releaseContext)

export function precompile(renderer, root, camera, scene = null, target) {
  let materials;
  const keep = target !== undefined ? renderer.getRenderTarget() : null;
  try {
    if (target !== undefined) renderer.setRenderTarget(target);
    materials = renderer.compile(root, camera, scene ?? root);
  } catch (err) {
    if (import.meta.env.DEV) console.warn('precompile failed', err);
    return Promise.resolve();
  } finally {
    // (a renderer disposed meanwhile can throw here too, and this never throws)
    try {
      if (target !== undefined) renderer.setRenderTarget(keep);
    } catch {
      // gone with its renderer
    }
  }
  return linked(renderer, materials);
}

// The materials of a composer's passes (bloom's blurs, the output pass, a
// grade), compiled the same way: each on a stand-in quad, against where its
// pass draws (the screen for the last one, a buffer for the rest).
export function precompilePasses(renderer, composer, camera) {
  const quad = new THREE.PlaneGeometry(2, 2);
  const jobs = composer.passes.map((pass, i) => {
    const mats = pass.enabled ? passMaterials(pass) : [];
    if (!mats.length) return null;
    primeOutputPass(pass, renderer);
    const stage = new THREE.Scene();
    for (const m of mats) stage.add(new THREE.Mesh(quad, m));
    const toScreen = composer.renderToScreen && composer.isLastEnabledPass(i);
    return precompile(renderer, stage, camera, stage, toScreen ? null : composer.readBuffer);
  });
  // the shaders are made by now (only their links are still going): the
  // stand-in quad can go, the materials stay with their passes
  quad.dispose();
  return Promise.all(jobs);
}

// Every material a pass holds: as a property of its own, in a list (bloom's
// blurs) or on a full-screen quad of its own.
function passMaterials(pass) {
  const found = new Set();
  const add = (m) => m?.isMaterial && found.add(m);
  for (const value of Object.values(pass)) {
    if (Array.isArray(value)) value.forEach(add);
    else if (value?.isMaterial) add(value);
    else if (value && !value.isObject3D) add(value.material); // a FullScreenQuad (not a scene's meshes)
  }
  return [...found];
}

// OutputPass picks its shader's defines (sRGB, which tone mapping) on its
// first frame, which would make the shader compiled here a spare: pick them
// now, as it would (three r180's OutputPass.render).
const TONE_DEFINES = {
  [THREE.LinearToneMapping]: 'LINEAR_TONE_MAPPING',
  [THREE.ReinhardToneMapping]: 'REINHARD_TONE_MAPPING',
  [THREE.CineonToneMapping]: 'CINEON_TONE_MAPPING',
  [THREE.ACESFilmicToneMapping]: 'ACES_FILMIC_TONE_MAPPING',
  [THREE.AgXToneMapping]: 'AGX_TONE_MAPPING',
  [THREE.NeutralToneMapping]: 'NEUTRAL_TONE_MAPPING',
  [THREE.CustomToneMapping]: 'CUSTOM_TONE_MAPPING',
};
function primeOutputPass(pass, renderer) {
  if (!('_outputColorSpace' in pass) || !('_toneMapping' in pass) || !pass.material?.isRawShaderMaterial) return;
  if (pass._outputColorSpace === renderer.outputColorSpace && pass._toneMapping === renderer.toneMapping) return;
  pass._outputColorSpace = renderer.outputColorSpace;
  pass._toneMapping = renderer.toneMapping;
  const defines = {};
  if (THREE.ColorManagement.getTransfer(renderer.outputColorSpace) === THREE.SRGBTransfer) defines.SRGB_TRANSFER = '';
  const tone = TONE_DEFINES[renderer.toneMapping];
  if (tone) defines[tone] = '';
  pass.material.defines = defines;
  pass.material.needsUpdate = true;
}

// Resolves once every material's program has linked (asking doesn't wait),
// the context has gone, or CAP has passed.
function linked(renderer, materials) {
  const pending = [...materials];
  const t0 = performance.now();
  compiling += 1;
  return new Promise((resolve) => {
    const done = () => {
      compiling -= 1;
      resolve();
      if (!compiling) flushLosses();
    };
    const check = () => {
      try {
        if (renderer.getContext().isContextLost()) return done();
        for (let i = pending.length - 1; i >= 0; i--) {
          // a material whose program has gone (the renderer was disposed) counts as done
          const program = renderer.properties.get(pending[i]).currentProgram;
          if (!program || program.isReady()) pending.splice(i, 1);
        }
      } catch {
        return done();
      }
      if (!pending.length || performance.now() - t0 > CAP) done();
      else setTimeout(check, 16);
    };
    check();
  });
}

// ── contexts given back ──
//
// Letting a context go (WEBGL_lose_context) waits for the GPU to finish
// everything queued before it, the shaders another scene is linking included:
// done the moment a scene is dropped, that wait lands on whatever frame is
// being scrolled. So a renderer that has been disposed (its buffers, textures
// and programs freed already) gives its context back a little later, once no
// scene is compiling and the page has a moment.
const losing = new Set();
let flushTimer = 0;
const whenIdle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 50));

function flushLosses() {
  if (flushTimer || !losing.size) return;
  flushTimer = setTimeout(() => {
    whenIdle(() => {
      flushTimer = 0;
      if (compiling) return; // the last precompile to finish calls again
      for (const r of losing) {
        try {
          if (!r.getContext().isContextLost()) r.forceContextLoss();
        } catch {
          // already gone
        }
      }
      losing.clear();
    });
  }, 1000);
}

export function releaseContext(renderer) {
  if (!renderer) return;
  losing.add(renderer);
  flushLosses();
}
