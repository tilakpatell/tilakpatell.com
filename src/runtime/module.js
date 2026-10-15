// The module contract, checked, and the wrap that makes a scene module
// written for lib/three/useScene (create(canvas, ctx) → { render(ms, now)
// → bool, ... }) into a world module without changing it.
//
// A world module: { id, shading: 'glsl' | 'nodes', classic?, mb, label?, ratio?, sharpness?, create(rt, props) }
// (`classic`: a 'nodes' module that brings a classic path, for low and mid
// without WebGPU: runtime/backend.js; its create reads rt.gfx.backend)
// (`label` says what the canvas shows, for a screen reader; `ratio` caps its
// pixel ratio; `sharpness: 'own'`: when frames run late its world draws
// softer through its own passes, told the level by lowerQuality, and the
// runtime keeps the canvas at its size rather than resize it for each
// level, which cost a cleared buffer and a jump in sharpness each time).
// A world: { ready?, resize(w, h), step?(dt, input, now), draw(frame),
//   wants?(), update?(props), setVisible?(on), setColors?(colors),
//   lowerQuality?(level), warmUp?(timeLeft), prepare?(onProgress, { alive }),
//   handoff?(), attached?(), anchor?(), tune?(), dispose() } (`attached`: the
//   page showing it is listening to its events; `anchor`: the player's world
//   position, for the floating origin; `tune() → groups` (lib/debugPanel's),
//   asked once the world is ready when the address has ?debug, and shown in
//   the one tuning panel under the module's id: runtime/debug.js).

import { STEPS } from '../lib/three/pace';

export const SHADINGS = ['glsl', 'nodes'];

export function validateModule(mod) {
  const missing = [];
  if (!mod || typeof mod.id !== 'string' || !mod.id) missing.push('id');
  if (!mod || typeof mod.create !== 'function') missing.push('create');
  if (missing.length) throw new Error(`world module needs ${missing.join(', ')}`);
  const shading = mod.shading ?? 'glsl';
  if (!SHADINGS.includes(shading)) throw new Error(`world module ${mod.id}: shading must be glsl or nodes`);
  // (a getter stays one: a module's ratio is read as each world starts, after
  // the renderer tier has set the level, not when the mount began)
  const live = Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(mod)).filter(([k, d]) => d.get && k !== 'shading' && k !== 'mb'));
  return Object.defineProperties({ ...mod, shading, mb: mod.mb ?? 0 }, live);
}

export function validateWorld(world) {
  if (!world || typeof world !== 'object') throw new Error('a world module must return a world');
  const missing = ['draw', 'resize', 'dispose'].filter((k) => typeof world[k] !== 'function');
  if (missing.length) throw new Error(`a world needs ${missing.join(', ')}`);
  return world;
}

// fromScene(id, create, { shading, classic, mb, label, ratio, sharpness }): the scene's
// render(ms, now) is the world's draw, its answer is wants(); ctx gets the
// runtime as `rt` (its renderer, saves, sounds, assets), the canvas's box
// as `el`, the runtime's invalidate and lost, and the quality floor as
// onSlow. `ratio` caps the module's pixel ratio, and `sharpness` is the
// module's (above). What the scene tells the
// page (its onEvent) goes out through rt.events, held until the page that
// shows it says it's listening (attached(), from useWorld): a world made at
// a handover, before its page is up, says nothing to the page it's
// replacing. The scene itself is `world.scene`, for the page's calls; a
// scene's `tune()` is the world's, for the ?debug panel.
const HELD = 200; // events kept at most before a page is listening
export function fromScene(id, create, { shading = 'glsl', classic = false, mb = 0, label, ratio, sharpness } = {}) {
  return {
    id,
    shading,
    ...(classic ? { classic } : {}),
    mb,
    ...(label ? { label } : {}),
    ...(ratio ? { ratio } : {}),
    ...(sharpness ? { sharpness } : {}),
    async create(rt, props = {}) {
      let scene = null;
      let held = [];
      const tell = (e) => {
        if (!e?.type) return;
        if (!held) rt.events?.emit(e.type, e);
        else if (held.length < HELD) held.push(e);
      };
      const ctx = {
        ...props,
        rt,
        onEvent: tell,
        el: rt.host,
        colors: props.colors,
        reduced: Boolean(props.reduced),
        invalidate: () => rt.invalidate(),
        onLost: () => rt.lost(),
        onSlow: () => scene?.lowerQuality?.(STEPS.length),
      };
      scene = await create(rt.gfx.canvas, ctx);
      let more = true;
      const world = {
        scene,
        resize: (w, h) => scene.resize(w, h),
        draw: (frame) => {
          more = scene.render(frame.dt * 1000, frame.now) !== false;
        },
        wants: () => more,
        update: (p) => scene.update?.({ ...p, onEvent: tell }),
        attached: () => {
          const was = held;
          held = null;
          for (const e of was ?? []) rt.events?.emit(e.type, e);
        },
        setVisible: (on) => scene.setVisible?.(on),
        setColors: (c) => scene.setColors?.(c),
        lowerQuality: (level) => scene.lowerQuality?.(level),
        warmUp: (timeLeft) => (scene.warmUp ? scene.warmUp(timeLeft) : true),
        handoff: () => (scene.handoff ? scene.handoff() : null),
        dispose: () => scene.dispose(),
      };
      if (scene.ready) world.ready = scene.ready;
      if (scene.prepare) world.prepare = (onProgress, opts) => scene.prepare(onProgress, opts);
      // (a scene's own groups for the ?debug panel, asked as a world's are)
      if (scene.tune) world.tune = () => scene.tune();
      return world;
    },
  };
}
