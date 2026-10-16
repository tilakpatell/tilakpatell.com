// An HQ game as a world module on the runtime (src/runtime/module.js): the
// compound, each of its games, Titan, and Invincible’s world, game and
// viewer, one module each. The runtime makes one world at a time, which is
// what hq/engine.js’s “one live view on the page” always was (useStage
// picks which; the runtime’s mount is the handover). The scene draws on
// the runtime’s renderer through ./stage.js; its page keeps the rules and
// the HUD, and its frame (the tick its page’s loop used to run) is handed
// to the world in `props.frame` and run from the world’s draw, inside the
// runtime’s loop.
//
// hqModule({ id, route, label, load, prepare, keep }) → module
//   load() → the scene’s factory, factory(rt, options) → view (with
//   `engine`, the stage); `prepare`: 'warm' (the shaders linked, four
//   seconds at most, as hq/useStage waited before), 'full' (every picture,
//   shader and a first draw, with progress: the compound’s world, behind
//   its loading screen), or the two in turn (Invincible’s world), after the
//   page’s own setting up (`props.setup.current(view)`, awaited); `keep`: the world is
//   kept, not let go, while its page wants it (module.keep(true)) and
//   another of the page’s worlds draws, so coming back to it is at once (the
//   compound, made once and kept while you’re inside a building); `first(view,
//   props)`: a frame drawn once it’s ready, before it’s shown (Titan’s).
// The world: { view, resize, draw, wants, lowerQuality, prepare, tune,
//   dispose }; the view’s engine says 'slow' through rt.events past the
//   governor’s floor (the page drops to its simple version, as onSlow did).
//
// The module starts at its tier’s sharpness (`ratio`), from the tier
// lib/device gives it, never calibrated (`calibrate: false`): as the game
// started on its own renderer.

import { settle } from '../../../lib/settle';
import { WORLD_MB } from '../../worlds/worlds';
import { startRatio, startTier } from './tiers';

const WARM = 4000; // ms at most a game's shaders hold back its first frame

export function hqModule({ id, route, label, load, prepare = 'warm', keep = false, first = null }) {
  let kept = null; // { renderer, view }: the world kept while another draws
  let keeping = false;
  let area = 0; // the box's, in CSS pixels, as its page or its world last measured it
  const letGo = () => {
    const was = kept;
    kept = null;
    was?.view.dispose();
  };
  return {
    id,
    shading: 'glsl',
    mb: WORLD_MB[route] ?? 0,
    ...(label ? { label } : {}),
    calibrate: false,
    // (its code, fetched ahead as its page's box comes near: hq/useStage's useLive)
    warm: () => load(),
    // (the tier's pixels over the box: the page measures it before it
    // mounts, hq/useStage; the window's until it has)
    get ratio() {
      if (typeof window === 'undefined') return startRatio(startTier(), 1);
      return startRatio(startTier(), window.devicePixelRatio, area || window.innerWidth * window.innerHeight);
    },
    measure(w, h) {
      if (w > 0 && h > 0) area = w * h;
    },
    // (the page holding a kept world says so while it's up, and lets go as it goes)
    keep(on) {
      keeping = keep && Boolean(on);
      if (!keeping) letGo();
    },
    async create(rt, props = {}) {
      let frame = props.frame ?? { current: null };
      let view = null;
      let again = false;
      if (kept && kept.renderer === rt.gfx.renderer && !rt.gfx.lost) {
        view = kept.view;
        kept = null;
        again = true;
      } else {
        letGo();
        const make = await load();
        view = await make(rt, { ...(props.options ?? {}), onSlow: () => rt.events.emit('slow', { module: id }) });
      }
      const engine = view.engine;
      let gone = false;
      let broken = false; // a frame threw: the runtime lets it go, and it's never kept
      let shown = !first; // a world with a first frame draws it again once placed
      const world = {
        view,
        resize: (w, h) => {
          area = w * h;
          view.resize(w, h);
        },
        // the page's frame, run from the runtime's loop; none while its
        // page isn't drawing it (the frame kept as it was); `once`, a frame
        // a page asks for when something changes (drawOnce)
        draw: (f) => {
          try {
            const once = frame.once;
            if (once) {
              frame.once = null;
              once(f.dt * 1000, f.now);
            } else if (frame.current) frame.current(f.dt * 1000, f.now);
            // (the first frame, drawn before the canvas had its size, drawn
            // again at it: the canvas was cleared when it was sized)
            else if (!shown) engine.renderOnce();
            shown = true;
          } catch (err) {
            broken = true;
            throw err;
          }
        },
        wants: () => Boolean(frame.current || frame.once || !shown),
        // (a page that adopted this world, React's second mount among them,
        // hands it its own frame)
        update: (p) => {
          if (p?.frame) frame = p.frame;
        },
        lowerQuality: (level) => engine.lowerQuality(level),
        tune: () => engine.tuneGroups(),
        dispose() {
          if (gone) return;
          gone = true;
          if (keep && keeping && !broken && !rt.gfx?.lost) {
            engine.rest();
            kept = { renderer: rt.gfx.renderer, view };
          } else view.dispose();
        },
      };
      if (!again) {
        world.prepare = async (onProgress, opts) => {
          const alive = () => opts?.alive?.() !== false;
          // At the box's size first, the canvas and the chain's buffers as
          // they'll be drawn: the runtime sizes the canvas as it places the
          // world, after this, to the same size (then a change of nothing),
          // and a canvas resized after the prepare's work waits for all of
          // it on the chip (8 s in software, the compound's first frame
          // that much later than the engine's, which sized it first)
          const r = rt.host?.getBoundingClientRect?.();
          if (r?.width && r?.height) {
            rt.gfx.setSize?.(r.width, r.height);
            view.resize(rt.gfx.size?.w ?? r.width, rt.gfx.size?.h ?? r.height);
          }
          // the page's own setting up, before the first shader is linked
          await props.setup?.current?.(view);
          for (const step of [].concat(prepare)) {
            if (!alive()) return;
            if (step === 'full') await engine.prepare(onProgress, opts);
            else await settle(engine.precompile(), WARM);
          }
          if (alive()) first?.(view, props);
        };
      }
      return world;
    },
  };
}
