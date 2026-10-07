// The module contract, checked, and the wrap that makes a scene module
// written for lib/three/useScene (create(canvas, ctx) → { render(ms, now)
// → bool, ... }) into a world module without changing it.
//
// A world module: { id, shading: 'glsl' | 'nodes', mb, label?, ratio?, create(rt, props) }
// (`label` says what the canvas shows, for a screen reader; `ratio` caps its pixel ratio).
// A world: { ready?, resize(w, h), step?(dt, input, now), draw(frame),
//   wants?(), update?(props), setVisible?(on), setColors?(colors),
//   lowerQuality?(level), warmUp?(timeLeft), handoff?(), attached?(),
//   dispose() } (`attached`: the page showing it is listening to its events).
// A world draws only on the backend it was made on (frame.renderer is
// rt.gfx.renderer as create found it), so a module may keep the renderer it
// was given: a world whose context goes while it's made is disposed and made
// again on a fresh backend (a create that throws then is made again too).

import { STEPS } from '../lib/three/pace';

export const SHADINGS = ['glsl', 'nodes'];

export function validateModule(mod) {
  const missing = [];
  if (!mod || typeof mod.id !== 'string' || !mod.id) missing.push('id');
  if (!mod || typeof mod.create !== 'function') missing.push('create');
  if (missing.length) throw new Error(`world module needs ${missing.join(', ')}`);
  const shading = mod.shading ?? 'glsl';
  if (!SHADINGS.includes(shading)) throw new Error(`world module ${mod.id}: shading must be glsl or nodes`);
  return { ...mod, shading, mb: mod.mb ?? 0 };
}

export function validateWorld(world) {
  if (!world || typeof world !== 'object') throw new Error('a world module must return a world');
  const missing = ['draw', 'resize', 'dispose'].filter((k) => typeof world[k] !== 'function');
  if (missing.length) throw new Error(`a world needs ${missing.join(', ')}`);
  return world;
}

// fromScene(id, create, { shading, mb, label, ratio }): the scene's
// render(ms, now) is the world's draw, its answer is wants(); ctx gets the
// runtime as `rt` (its renderer, saves, sounds, assets), the canvas's box
// as `el`, the runtime's invalidate and lost, and the quality floor as
// onSlow. `ratio` caps the module's pixel ratio. What the scene tells the
// page (its onEvent) goes out through rt.events, held until the page that
// shows it says it's listening (attached(), from useWorld): a world made at
// a handover, before its page is up, says nothing to the page it's
// replacing. The scene itself is `world.scene`, for the page's calls.
const HELD = 200; // events kept at most before a page is listening
export function fromScene(id, create, { shading = 'glsl', mb = 0, label, ratio } = {}) {
  return {
    id,
    shading,
    mb,
    ...(label ? { label } : {}),
    ...(ratio ? { ratio } : {}),
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
      return world;
    },
  };
}
