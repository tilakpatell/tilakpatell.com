// No frame waits for a shader or a picture: whatever isn't ready on the
// graphics chip yet is left out of the frame and readied behind it, and
// drawn a few frames later. The same rule Minecraft keeps for its chunks
// (a bounded amount sent each frame, nothing drawn before it's ready),
// kept for every draw.
//
// three.js compiles a material's shader and sends its pictures the first
// time it's drawn, and that frame waits for both: a hunter pack arriving, a
// planet's close-up maps or a model streaming in mid-walk each stopped a
// world for a fraction of a second to over a second
// (docs/research/2026-10-07-frame-hitches.md). The guard wraps the
// renderer's own renderBufferDirect (three draws through the instance, so
// every draw passes here): a material that has never been compiled, or that
// uses a picture never sent, isn't drawn this frame. After the frame, the
// waiting ones are readied under a budget (`compileMs` of main-thread time
// and `uploadMB` of pictures a frame): the world's own `adopt` hooks first
// (its house look, so the shader compiled is the one it will draw with),
// the pictures sent, the shader compiled; then a fence, and once the chip
// says the shader has linked, it draws from then on and isn't looked at
// again.
//
// Only the frame itself is held back: a Scene drawn to the canvas, or to a
// buffer the canvas's size (a composer's) or one its owner says is the
// frame's (`frames`: a composer drawn softer than the canvas, its last pass
// drawing it up), with no override material. The size in whole pixels: a
// composer sizes its buffers at the canvas's size times the pixel ratio,
// unrounded (1470 wide at 1.75 is 2572.5), and WebGL truncates them to the
// canvas's 2572, so compared as given most windows' frames went ungated,
// and a world's frame was gated or not by the width of the window. Left
// alone: the shadow pass (no scene: its depth shaders are small and
// shared), anything drawn outside a Scene (a post pass's quad: leaving it
// out would leave its picture undrawn), the drawings a world makes for
// itself (a floor bake, an environment map, a reflection: into buffers of
// their own size, or with one material over everything, and what's left out
// of those is wrong for good, not for a frame), and a material once it's
// ready, whatever three does to it after (a transparent, double-sided one
// is marked changed twice a frame), unless it's been changed into another
// shader: a look or a scan put on it late (a new onBeforeCompile, a new
// program key), or a map put on or taken off. Then it's readied again
// behind the frame, as if new, rather than made again in the middle of one;
// as is one that's been freed (dispose(): its shader with it) and is drawn
// again.
//
// The pictures it waits for are a patch's too (gpuWork's picturesIn: a
// scan's, the look's), not only the material's own.
//
// A warm draw (gpuWork's warmDraw: a prepare's draw of everything behind
// the loading screen, or lib/stage3d's before the first frame of a world
// that isn't prepared) is always drawn whole: it's there to send
// everything, and what it held back would be left out of the first frames
// seen, a world up as its sky alone and filling in a few materials a frame.
// A renderer's first frame can be drawn whole too (`firstWhole`: the
// Cybertron backdrop's, whose shaders are made ahead but not its pictures).
// What three drew ungated is known to have linked (that draw linked it), so
// the frames after it, gated, draw it at once.
//
// guard(renderer, { uploadMB, compileMs, frame, invalidate, frames(target), firstWhole }) → { enabled,
//   invalidate, adopt(scene, fn) → undo, pending(), dispose() }, one per renderer (asked again, the same).
// In development, a frame in which three still compiled a shader mid-draw
// says so in the console, so what's still slipping through can be found.
// heldBack() → what every live guard is still readying, the sum of their
// pending(); in development it's window.__tpGuardPending too, for the
// scripts that shoot a world (scripts/gpu-parity.mjs) to know it's all on
// screen. holdNone() (window.__tpGuardOff): no guard holds anything back
// from then on, for the scripts that count a world's draws.

import { fence, knownLinked, markLinked, nextFrame, picturesIn, textureBytes, uploaded, warming } from './gpuWork';

const guards = new WeakMap();
// (heldBack's, as weak references: a WeakMap can't be counted, and a guard
// is seldom disposed, so a renderer let go mustn't be kept for this)
const live = new Set();
const READY = 1;
const QUEUED = 2;
const MB = 1048576;
const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const later = typeof queueMicrotask === 'function' ? queueMicrotask : (fn) => Promise.resolve().then(fn);

// (renderer.compile walks this, against the scene's own lights)
const batchRoot = (list) => ({
  traverse(fn) {
    for (const o of list) fn(o);
  },
  traverseVisible() {},
});

// what of a material decides which shader it's drawn with, as far as a
// world changes it after it's first drawn: its patches and which maps it has
const MAPS = ['map', 'normalMap', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap', 'lightMap', 'bumpMap', 'displacementMap', 'envMap', 'specularMap', 'gradientMap', 'matcap', 'clearcoatMap', 'clearcoatNormalMap', 'transmissionMap', 'sheenColorMap', 'iridescenceMap', 'anisotropyMap'];
const mapsOf = (m) => {
  let bits = 0;
  for (let i = 0; i < MAPS.length; i++) if (m[MAPS[i]]) bits |= 1 << i;
  return bits;
};
const shapeOf = (m) => ({ v: m.version, before: m.onBeforeCompile, key: m.customProgramCacheKey, maps: mapsOf(m) });
const sameShape = (a, m) => a.before === m.onBeforeCompile && a.key === m.customProgramCacheKey && a.maps === mapsOf(m);

const inScene = (object, scene) => {
  let o = object;
  while (o.parent) o = o.parent;
  return o === scene;
};

export function guard(renderer, { uploadMB = 8, compileMs = 4, frame = nextFrame, invalidate = null, frames = null, firstWhole = false } = {}) {
  if (guards.has(renderer)) return guards.get(renderer);
  const state = new WeakMap(); // material → READY | QUEUED
  const shapes = new WeakMap(); // a ready material → what its shader was made for (shapeOf)
  const pictures = new WeakMap(); // material → { v: its version, list: the pictures it holds }
  const queue = new Map(); // material → an object it was to be drawn on
  const linking = new Set(); // compiled, waiting to link
  const adopters = new WeakMap(); // scene → its look, put on what's late into it
  let scene = null;
  let camera = null;
  let target = null; // where the scene was drawn (a composer's buffer: other shaders than the canvas's)
  let scheduled = false;
  let gating = false; // the draw in progress is the frame's
  let whole = firstWhole; // the next frame is drawn as it is (the first, if asked)
  let wholeNow = false; // a frame drawn whole is being drawn (for development's wording)
  const drawn = { x: 0, y: 0 }; // the canvas's buffer, for telling a frame's buffer from a world's own
  let waiting = false; // a fence in flight
  const dev = Boolean(import.meta.env?.DEV);
  let told = 0;

  const props = (thing) => {
    try {
      return renderer.properties.get(thing);
    } catch {
      return {};
    }
  };
  // (looked at again once it's been marked changed: a scan worn brings its own)
  const picturesOf = (m) => {
    let got = pictures.get(m);
    if (!got || got.v !== m.version) {
      got = { v: m.version, list: picturesIn(m) };
      pictures.set(m, got);
    }
    return got.list;
  };
  const picturesUp = (m) => picturesOf(m).every((t) => uploaded(renderer, t));
  const linked = (m) => {
    const program = props(m).currentProgram;
    if (!program) return false;
    let ok = true;
    try {
      ok = program.isReady();
    } catch {
      ok = true;
    }
    if (ok) markLinked(program);
    return ok;
  };
  // (one freed, its shader with it, is ready no longer: drawn again, it's
  // readied again behind the frame, as one never drawn is)
  const watched = new WeakSet();
  const forget = (e) => {
    const m = e.target;
    state.delete(m);
    shapes.delete(m);
    pictures.delete(m);
    // (and one freed mid-way leaves the work too: its program gone, it'd
    // never be seen to link, and a fence would be set every frame for it)
    queue.delete(m);
    linking.delete(m);
  };
  const watch = (m) => {
    if (!watched.has(m) && m.addEventListener) {
      watched.add(m);
      m.addEventListener('dispose', forget);
    }
  };
  const ready = (m) => {
    watch(m);
    state.set(m, READY);
    shapes.set(m, shapeOf(m));
    queue.delete(m);
    linking.delete(m);
  };
  const hold = (m, object) => {
    watch(m);
    state.set(m, QUEUED);
    queue.set(m, object);
  };

  const g = {
    enabled: true,
    // asked for a frame once something held back is ready (settable)
    invalidate,
    // fn(object) runs on a thing late into `scene` before its shader is
    // compiled (one per scene, kept no longer than the scene is)
    adopt(scn, fn) {
      adopters.set(scn, fn);
      return () => adopters.get(scn) === fn && adopters.delete(scn);
    },
    pending: () => queue.size + linking.size,
    dispose() {
      renderer.renderBufferDirect = realDraw;
      renderer.render = realRender;
      queue.clear();
      linking.clear();
      guards.delete(renderer);
      live.delete(ref);
    },
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    later(pump);
  };

  // linked ones become ready (asked only after a fence: free by then)
  const settleLinks = () => {
    let any = false;
    for (const m of linking) {
      if (!linked(m) || !picturesUp(m)) continue;
      ready(m);
      any = true;
    }
    // (a scene that rests between changes is asked for the frame that shows them)
    if (any) g.invalidate?.();
  };

  function pump() {
    scheduled = false;
    if (waiting || !scene) return;
    settleLinks();
    const t0 = clock();
    const budget = uploadMB * MB;
    let bytes = 0;
    let worked = false;
    for (const [m, object] of queue) {
      if (worked && clock() - t0 > compileMs) break;
      if (!inScene(object, scene)) {
        // (gone from the world meanwhile: looked at afresh if it comes back)
        queue.delete(m);
        state.delete(m);
        continue;
      }
      let full = false;
      for (const t of picturesOf(m)) {
        if (uploaded(renderer, t)) continue;
        const b = textureBytes(t);
        if (bytes > 0 && bytes + b > budget) {
          full = true;
          break;
        }
        try {
          renderer.initTexture(t);
        } catch {
          /* it goes up when it's drawn instead */
        }
        bytes += b;
        worked = true;
      }
      if (full) break;
      try {
        adopters.get(scene)?.(object);
      } catch (err) {
        if (dev) console.warn('[frameGuard] adopt failed', err);
      }
      try {
        compileInto(object);
      } catch (err) {
        // three reports a broken shader on its own, when it's drawn
        if (dev) console.warn('[frameGuard] compile failed', err);
        ready(m);
        continue;
      }
      worked = true;
      queue.delete(m);
      linking.add(m);
    }
    if (!worked && !linking.size) return;
    waiting = true;
    fence(renderer, { frame }).then(() => {
      waiting = false;
      settleLinks();
      if (queue.size) schedule();
    });
  }

  // compiled for where the scene is drawn: three picks a shader's tone
  // mapping and colour space by its target
  const compileInto = (object) => {
    const keep = renderer.getRenderTarget?.() ?? null;
    const swap = keep !== target && renderer.setRenderTarget;
    if (swap) renderer.setRenderTarget(target);
    try {
      renderer.compile(batchRoot([object]), camera, scene);
    } finally {
      if (swap) renderer.setRenderTarget(keep);
    }
  };

  // the canvas, a buffer its size in whole pixels (where a composer draws the
  // frame: WebGL truncates a buffer's size, and the composer doesn't round
  // it), or one the owner names
  const frameTarget = (t) => {
    if (!t || frames?.(t)) return true;
    const c = renderer.domElement;
    if (c) {
      drawn.x = c.width;
      drawn.y = c.height;
    } else renderer.getDrawingBufferSize?.(drawn);
    return Math.floor(t.width) === drawn.x && Math.floor(t.height) === drawn.y;
  };

  const realDraw = renderer.renderBufferDirect;
  renderer.renderBufferDirect = function (cam, scn, geometry, material, object, group) {
    // (one drawn ungated, in a first frame drawn whole or with the guard
    // off, has had its shader linked by that draw: known from then on, so
    // the frames gated after it don't hold back the whole world on screen
    // for two black frames)
    if (!gating && material) {
      const out = dev ? devDraw(this, cam, scn, geometry, material, object, group) : realDraw.call(this, cam, scn, geometry, material, object, group);
      markLinked(props(material).currentProgram);
      return out;
    }
    if (gating && scn?.isScene && material) {
      const s = state.get(material);
      if (s === READY) {
        // (marked changed since it was readied: into another shader, it's
        // readied again behind the frame; anything else, drawn as it is)
        const was = shapes.get(material);
        if (was && was.v !== material.version) {
          if (sameShape(was, material)) was.v = material.version;
          else {
            hold(material, object);
            return undefined;
          }
        }
      } else if (s === undefined && knownLinked(props(material).currentProgram) && picturesUp(material)) ready(material);
      else if (s === undefined && (!object || !inScene(object, scn))) {
        // three's own drawing for the scene, from outside it (its background
        // box or plane): drawn as it is, as anything outside a scene is. Held,
        // it was dropped behind the frame as gone from the world, and held
        // again the next, so a world's sky never showed.
      } else {
        if (s === undefined) hold(material, object);
        return undefined;
      }
    }
    return dev ? devDraw(this, cam, scn, geometry, material, object, group) : realDraw.call(this, cam, scn, geometry, material, object, group);
  };
  // (development: a shader three made in the middle of this draw, named,
  // so what still slips past the guard can be found where it comes from)
  function devDraw(self, cam, scn, geometry, material, object, group) {
    const had = renderer.info?.programs?.length ?? 0;
    const out = realDraw.call(self, cam, scn, geometry, material, object, group);
    if ((renderer.info?.programs?.length ?? 0) > had && told < 40) {
      told += 1;
      const pass = wholeNow ? 'drawn whole' : !gating ? 'off-frame' : scn === null ? 'shadow' : 'frame';
      console.warn(`[frameGuard] shader compiled mid-frame (${pass}): ${material.type}${material.name ? ` "${material.name}"` : ''} on ${object?.type ?? '?'}${object?.name ? ` "${object.name}"` : ''}${object?.parent?.name ? ` in "${object.parent.name}"` : ''}`);
    }
    return out;
  }

  const realRender = renderer.render;
  renderer.render = function (scn, cam) {
    const before = dev ? (renderer.info?.programs?.length ?? 0) : 0;
    const t0 = dev ? clock() : 0;
    const into = scn?.isScene ? (renderer.getRenderTarget?.() ?? null) : null;
    const isFrame = Boolean(scn?.isScene) && !scn.overrideMaterial && frameTarget(into);
    const first = isFrame && (whole || warming());
    const was = gating;
    const wasWhole = wholeNow;
    gating = g.enabled && isFrame && !first;
    wholeNow = first;
    let out;
    try {
      out = realRender.call(this, scn, cam);
    } finally {
      gating = was;
      wholeNow = wasWhole;
    }
    if (isFrame) {
      whole = false;
      scene = scn;
      camera = cam;
      target = into;
      if (queue.size || linking.size) schedule();
      // (a frame drawn whole compiles in it by design: not a slip)
      if (dev && g.enabled && !first) {
        const made = (renderer.info?.programs?.length ?? 0) - before;
        // (every one counted, for scripts/perf-probe.mjs, however few are said)
        if (made > 0 && typeof window !== 'undefined') window.__tpGuardSlips = (window.__tpGuardSlips ?? 0) + made;
        if (made > 0 && told < 40) {
          told += 1;
          console.warn(`[frameGuard] ${made} shader(s) compiled in a ${Math.round(clock() - t0)} ms frame`);
        }
      }
    }
    return out;
  };

  guards.set(renderer, g);
  const ref = new WeakRef(g);
  live.add(ref);
  return g;
}

export const heldBack = () => {
  let n = 0;
  for (const ref of live) {
    const g = ref.deref();
    if (g) n += g.pending();
    else live.delete(ref);
  }
  return n;
};
// holdNone() → every live guard stops holding things back: each frame drawn
// whole, compiling what it must as it goes, as three alone would. For the
// scripts that measure a world (scripts/galaxy-check.mjs): in software GL
// the guard readies about one shader a frame at seconds a frame, so a level
// pack's hundreds of materials were still held when the frame was counted,
// and its draws were left out of the count. In development it's
// window.__tpGuardOff.
export const holdNone = () => {
  for (const ref of live) {
    const g = ref.deref();
    if (g) g.enabled = false;
    else live.delete(ref);
  }
};
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  window.__tpGuardPending = heldBack;
  window.__tpGuardOff = holdNone;
}

// The guard on `renderer`, if it has one.
export const guardOf = (renderer) => guards.get(renderer) ?? null;
