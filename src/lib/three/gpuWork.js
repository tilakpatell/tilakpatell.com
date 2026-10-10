// The graphics chip's work, spread over frames: what a world sends it before
// it's shown (its pictures, its shaders, one draw of everything), a slice at
// a time, never asking the chip anything that would make the page wait.
//
// Why: a world's whole warm-up done in one frame froze it for seconds
// (docs/research/2026-10-07-frame-hitches.md). Pictures sent in one go,
// shaders compiled in one go and then asked about (a synchronous question
// waits for the chip's process to get through everything queued before it),
// and the first draw of a hundred new shaders, each landed in a single
// frame. Here each goes in slices, and between slices the page waits on a
// fence: a marker put in the chip's queue that's asked about without
// blocking, signalled once the chip has got through everything before it.
// Only then is a shader asked whether it's linked, which by then costs
// nothing.
//
// fence(renderer, { frame, cap }) → once the chip has caught up
// uploaded(renderer, texture) → whether it's been sent (or never waits on it)
// textureBytes(texture) → about how big it is on the chip
// uploadSlices(renderer, textures, { sliceMB, sliceMs, onStep, frame, alive }) → how many were sent
// picturesIn(material) → the pictures it draws with, a patch's included
// drawables(roots) → one object per material and kind of mesh, hidden ones too
// compileSlices(renderer, roots, camera, scene, { sliceMs, batch, onStep, frame, alive, cap, target }) → the materials
// warmDraw(renderer, render, roots, { frame }) → everything drawn once, out of sight
// warming() → whether a warm draw is being drawn (the frame guard draws it whole)
// prepareScene({ renderer, roots, scene, camera, render, onProgress, frame, alive, target })
//
// `frame` is how to wait for the next frame (requestAnimationFrame by
// default); `alive()` says whether the world is still wanted (one left
// while it prepares stops at the next slice). Nothing here throws, and
// every promise resolves, a lost context included.

// (or a tenth of a second, whichever comes first: a tab in the background
// gets no frames at all, and a landing prepared there held at its pictures,
// 33%, until it was looked at: the flow design's bug 2)
export const FRAME_WAIT = 100;
export const nextFrame = () =>
  new Promise((resolve) => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      resolve();
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(go);
    setTimeout(go, typeof requestAnimationFrame === 'function' ? FRAME_WAIT : 16);
  });
const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const yes = () => true;

const contextOf = (renderer) => {
  try {
    return renderer.getContext();
  } catch {
    return null;
  }
};
const lostContext = (gl) => {
  try {
    return !gl || gl.isContextLost();
  } catch {
    return true;
  }
};

// ── shaders known to have linked ──
// (the frame guard draws a material at once only if its shader is one of
// these: one still linking, drawn, makes the frame wait for the link)
const linkedPrograms = new WeakSet();
export const markLinked = (program) => {
  if (program && typeof program === 'object') linkedPrograms.add(program);
};
export const knownLinked = (program) => Boolean(program) && linkedPrograms.has(program);

// ── a fence ──

export function fence(renderer, { frame = nextFrame, cap = 5000 } = {}) {
  const gl = contextOf(renderer);
  const twoFrames = () => frame().then(frame);
  if (!gl || typeof gl.fenceSync !== 'function') return twoFrames();
  let sync = null;
  try {
    sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
  } catch {
    sync = null;
  }
  if (!sync) return twoFrames();
  const t0 = clock();
  return new Promise((resolve) => {
    const done = () => {
      try {
        gl.deleteSync(sync);
      } catch {
        // gone with its context
      }
      resolve();
    };
    const check = () => {
      let over = true;
      try {
        // (asked without blocking: the answer is the browser's, kept up to date between tasks)
        over = lostContext(gl) || gl.getSyncParameter(sync, gl.SYNC_STATUS) === gl.SIGNALED || clock() - t0 > cap;
      } catch {
        over = true;
      }
      if (over) done();
      else frame().then(check);
    };
    frame().then(check);
  });
}

// ── pictures ──

const propsOf = (renderer, thing) => {
  try {
    return renderer.properties.get(thing);
  } catch {
    return {};
  }
};

// Whether a picture is on the chip already, or is one nothing waits to
// send: no data yet (three sends it once there is), a render target's (made
// on the chip), a video (sent every frame anyway), or one sent once and
// changed since (a canvas redrawn every frame: only a first send is big).
export function uploaded(renderer, t) {
  if (!t?.isTexture) return true;
  if (t.isRenderTargetTexture || t.isVideoTexture || t.version === 0) return true;
  const img = t.image;
  if (!img || (Array.isArray(img) ? img.length === 0 : img.complete === false)) return true;
  return propsOf(renderer, t).__webglInit === true;
}

export function textureBytes(t) {
  if (!t) return 0;
  if (t.isCompressedTexture || t.isCompressedArrayTexture) {
    let n = 0;
    for (const m of t.mipmaps ?? []) n += m?.data?.byteLength ?? 0;
    return n;
  }
  const img = Array.isArray(t.image) ? t.image[0] : t.image;
  const faces = Array.isArray(t.image) ? t.image.length : 1;
  const w = img?.width ?? img?.naturalWidth ?? img?.videoWidth ?? 0;
  const h = img?.height ?? img?.naturalHeight ?? img?.videoHeight ?? 0;
  return w * h * (img?.depth ?? 1) * 4 * faces;
}

const send = (renderer, t) => {
  try {
    renderer.initTexture(t);
  } catch {
    /* it goes up on its first frame instead */
  }
};

// The pictures a material draws with: its own, its uniforms', and those a
// patch hands three as the shader's made, kept on it out of sight (a scan,
// lib/three/core's wear; the look's ground, lib/three/house; the wind's
// noise, universe/landings/canopy), which three would otherwise send in the
// middle of the first draw.
const PATCHES = ['core', 'house', 'canopy'];
export function picturesIn(m, into = []) {
  if (!m) return into;
  for (const v of Object.values(m)) if (v?.isTexture) into.push(v);
  if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) into.push(u.value);
  for (const k of PATCHES) {
    const uniforms = m.userData?.[k];
    if (uniforms && typeof uniforms === 'object') for (const u of Object.values(uniforms)) if (u?.value?.isTexture) into.push(u.value);
  }
  return into;
}

// (a slice ends at `sliceMB` of pictures or `sliceMs` of the page's time,
// whichever comes first: many small pictures cost more than their size says)
export async function uploadSlices(renderer, textures, { sliceMB = 24, sliceMs = 8, onStep = null, frame = nextFrame, alive = yes } = {}) {
  const todo = [...new Set(textures)].filter((t) => !uploaded(renderer, t)).sort((a, b) => textureBytes(a) - textureBytes(b));
  const budget = sliceMB * 1048576;
  let inSlice = 0;
  let sent = 0;
  let t0 = clock();
  for (const t of todo) {
    if (!alive() || lostContext(contextOf(renderer))) break;
    send(renderer, t);
    sent += 1;
    inSlice += textureBytes(t);
    onStep?.(sent / todo.length);
    if (inSlice >= budget || clock() - t0 >= sliceMs) {
      inSlice = 0;
      await fence(renderer, { frame });
      t0 = clock();
    }
  }
  if (inSlice > 0) await fence(renderer, { frame });
  onStep?.(1);
  return sent;
}

// ── shaders ──

const DRAWN = (o) => (o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.material;
const materialsOf = (o) => (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []);
// what decides a material's shader besides itself: three.js makes a program
// per material and kind of mesh (skinned, instanced, batched, morphed, with
// vertex colours)
const kindOf = (o) => {
  const g = o.geometry;
  return `${materialsOf(o)
    .map((m) => m.uuid)
    .join(',')}|${o.isSkinnedMesh ? 's' : ''}${o.isInstancedMesh ? 'i' : ''}${o.isBatchedMesh ? 'b' : ''}${g?.morphAttributes && Object.keys(g.morphAttributes).length ? 'm' : ''}${g?.attributes?.color ? 'c' : ''}${o.isPoints ? 'p' : ''}${o.isLine ? 'l' : ''}${o.isSprite ? 'x' : ''}`;
};

export function drawables(roots) {
  const seen = new Set();
  const out = [];
  for (const root of roots) {
    root?.traverse?.((o) => {
      if (!DRAWN(o)) return;
      const k = kindOf(o);
      if (seen.has(k)) return;
      seen.add(k);
      out.push(o);
    });
  }
  return out;
}

// a stand-in root for renderer.compile: just these objects, compiled
// against the scene's lights and `lights` (those of roots not in the scene
// yet: a model readied before it's added brings its own)
const batchRoot = (list, lights = []) => ({
  traverse(fn) {
    for (const o of list) fn(o);
  },
  traverseVisible(fn) {
    for (const l of lights) fn(l);
  },
});
const rootOf = (o) => {
  while (o.parent) o = o.parent;
  return o;
};
function lightsOutside(roots, scene) {
  const out = [];
  for (const root of roots) {
    if (!root?.traverseVisible || rootOf(root) === scene) continue;
    root.traverseVisible((o) => o.isLight && out.push(o));
  }
  return out;
}

const ready = (renderer, m) => {
  const program = propsOf(renderer, m).currentProgram;
  if (!program) return true; // (gone with its renderer, or nothing to wait for)
  let ok = true;
  try {
    ok = program.isReady();
  } catch {
    ok = true;
  }
  if (ok) markLinked(program);
  return ok;
};

// (`target`: where the scene will be drawn when that isn't the canvas, a
// composer's buffer, whose shaders differ: no tone mapping, linear colour)
export async function compileSlices(renderer, roots, camera, scene, { sliceMs = 8, batch = null, onStep = null, frame = nextFrame, alive = yes, cap = 20000, target } = {}) {
  const objects = drawables(roots);
  const lights = lightsOutside(roots, scene);
  const materials = new Set();
  let size = batch ?? 4;
  let i = 0;
  while (i < objects.length) {
    if (!alive() || lostContext(contextOf(renderer))) return materials;
    const list = objects.slice(i, i + size);
    i += list.length;
    const t0 = clock();
    const keep = target !== undefined ? (renderer.getRenderTarget?.() ?? null) : null;
    try {
      if (target !== undefined) renderer.setRenderTarget(target);
      for (const m of renderer.compile(batchRoot(list, lights), camera, scene)) materials.add(m);
    } catch (err) {
      if (import.meta.env?.DEV) console.warn('[gpuWork] compile failed', err);
    } finally {
      try {
        if (target !== undefined) renderer.setRenderTarget(keep);
      } catch {
        // gone with its renderer
      }
    }
    // the next batch about a slice's worth, judged by this one
    if (!batch) {
      const each = (clock() - t0) / list.length;
      size = Math.max(1, Math.min(64, Math.floor(sliceMs / Math.max(0.05, each))));
    }
    onStep?.(0.8 * (i / objects.length));
    await fence(renderer, { frame });
  }
  // linked yet? (asked only now the chip has caught up, so asking is free)
  const pending = [...materials];
  const t0 = clock();
  while (pending.length && alive() && !lostContext(contextOf(renderer)) && clock() - t0 < cap) {
    for (let k = pending.length - 1; k >= 0; k--) if (ready(renderer, pending[k])) pending.splice(k, 1);
    onStep?.(0.8 + 0.2 * (1 - pending.length / Math.max(1, materials.size)));
    if (pending.length) await frame();
  }
  onStep?.(1);
  return materials;
}

// ── one draw of everything ──

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


// (lib/three/frameGuard draws a warm draw whole: what it held back there
// would be left out of the first frames seen, which is what it's for)
let warm = 0;
export const warming = () => warm > 0;

// Everything under `roots` drawn once by the world's own `render` (passes
// and all), hidden things too and nothing culled, into one pixel: what's
// sent the first time a thing is drawn (its buffers, the chip's own state
// for each shader) goes now, not on the first frame that's seen.
export async function warmDraw(renderer, render, roots, { frame = nextFrame } = {}) {
  const undo = revealAll(...roots);
  warm += 1;
  try {
    renderer.setScissor?.(0, 0, 1, 1);
    renderer.setScissorTest?.(true);
    render();
  } catch (err) {
    if (import.meta.env?.DEV) console.warn('[gpuWork] warm draw failed', err);
  } finally {
    warm -= 1;
    undo();
    try {
      renderer.setScissorTest?.(false);
      renderer.setRenderTarget?.(null);
    } catch {
      // gone with its renderer
    }
  }
  await fence(renderer, { frame });
}

// ── a world's whole warm-up ──

const share = { pictures: [0, 0.35], shaders: [0.35, 0.8], 'first draw': [0.8, 1] };

export async function prepareScene({ renderer, roots, scene, camera, render = null, onProgress = null, frame = nextFrame, alive = yes, sliceMB, sliceMs, target } = {}) {
  const tell = (step) => (f) => {
    const [a, b] = share[step];
    onProgress?.(a + (b - a) * Math.min(1, Math.max(0, f)), step);
  };
  if (!alive()) return;
  const textures = new Set();
  for (const root of roots) {
    root?.traverse?.((o) => {
      for (const m of materialsOf(o)) for (const t of picturesIn(m)) textures.add(t);
    });
  }
  tell('pictures')(0);
  await uploadSlices(renderer, [...textures], { sliceMB, onStep: tell('pictures'), frame, alive });
  if (!alive()) return;
  tell('shaders')(0);
  await compileSlices(renderer, roots, camera, scene, { sliceMs, onStep: tell('shaders'), frame, alive, target });
  if (!alive()) return;
  tell('first draw')(0);
  if (render) await warmDraw(renderer, render, roots, { frame });
  tell('first draw')(1);
}
