// The runtime: one renderer, one loop and the services, with a world
// module mounted on it. mount() makes a module's world and draws it in a
// host box; handover() lets the next module take over without a cut (the
// old world draws on, keys aside, until the new one is ready; then its last
// frame is kept over the new one and fades out); adopt() moves a world handed over already into
// the box of the page that shows it (its canvas and the cover with it);
// unmount() disposes the world and keeps the canvas. The browser bits (the backend, the loop's rAF, the DOM) are
// passed in, so this runs in Node: index.js wires the real ones.
//
// createRuntime({ makeBackend, loop, input, quality, saves, assets, audio,
//   workers, origin, events, now, gpu, override, visible, calibrate, debug,
//   gpuClock, fps, tier }) → rt
// rt: { gfx, tier, input, quality, saves, assets, audio, workers, origin, events, debug, host, status,
//   failure, current, loading, on(fn), invalidate(), resize(w, h), setVisible(on), lost(),
//   mount(module, props, host) → shown, handover(module, props, host, { fade, held, after }) → shown,
//   adopt(module, host), unmount(), dispose(), requality(level) → 'tuned' |
//   'reload' | 'idle', revideo(values) → the same, reload() → shown, sharpen(k) }
// (`failure`: why the last world failed, { world, name, message, module }:
// a WebAssembly module that couldn't come up is a WasmError naming it,
// lib/wasm/load.js, so a failed world says which; null once one comes up)
// (a quality level picked while a world is up: `requality` hands it to the
// world's `onQuality(level)`, or its module's `onQuality(level, world, rt)`,
// for a world that can retune without being built again (the pixel ratio,
// shadows, grass, LOD reach); 'reload' says it can't, and `reload()` builds
// it again with what it was mounted with)
// A world with an `anchor()` (the player's world position) has the floating
// origin moved after it before each step; a shift is the event 'origin'
// { shift }, for the world to re-anchor its objects and camera that frame.
// With ?debug in the address (`debug`, ./debug.js), a world placed and ready
// is asked for its tuning groups (`world.tune?.()`) and they open the one
// panel under its module's id; the world let go closes it.
// (`shown`: true once the module's world is the one drawing; false when it
// failed, or something newer was asked for meanwhile)
// The picture (GPU-first lane N2): a `'nodes'` world drawn on WebGPU takes
// its internal resolution from the chip's own time (`gpuClock(renderer)`,
// lane G1's createGpuTime, made once a renderer; none, or one without
// `timestamp-query`, keeps the pace) through quality.setSource; a world on
// the GPU clock never has its canvas resized by it (the output size
// never changes: TAA's history). The loop's cadence is cadence.js's: every
// second beat for a visitor who pins 30 (`fps`); otherwise every beat until
// the frames say 60 cannot hold with nothing left to lower, then an even 30
// (createCadence, fed each frame's interval, its main-thread time and the
// GPU clock's), and back.
// `tier` (gfx) → Promise<'T0' | 'T1' | 'T2' | null>: the device's renderer
// tier (lib/gpuProbe, the GPU-first design's G1), asked once a page, before
// the first 'nodes' world is made, so its one-second probe runs under the
// loading screen and never in a world's frames; `rt.tier` holds the answer
// (null until then, or when it could not say). A classic world never asks.

import { createLoop } from '../lib/three/loop';
import { createCadence } from './cadence';
import { settle } from '../lib/settle';
import { pickBackend } from './backend';
import { createHandover } from './handover';
import { calibrate, calibrationKey, recall, remember } from '../lib/three/calibrate';
import { createOrigin } from './origin';
import { validateModule, validateWorld } from './module';
import { createDebug } from './debug';

const READY_WAIT = 4000; // ms at most a world's `ready` holds back its first frame
const MAX_DT = 0.05; // s: a tab coming back doesn't leap
const HOLD_MAX = 3000; // ms at most a held cover waits for the next page to adopt its world
const SNAP_WAIT = 250; // ms at most a handover waits for the old world's last frame (none comes off screen)
const AFTER_MAX = 15000; // ms at most a handover waits on `after` once the new world is made
const WARM_UP = 3000; // ms of a new world's first frames the quality governor lets go by unjudged

export function createEvents() {
  const by = new Map();
  const any = new Set();
  return {
    emit(type, data) {
      for (const fn of by.get(type) ?? []) fn(data);
      for (const fn of any) fn(type, data);
    },
    on(type, fn) {
      if (!by.has(type)) by.set(type, new Set());
      by.get(type).add(fn);
      return () => by.get(type)?.delete(fn);
    },
    onAny(fn) {
      any.add(fn);
      return () => any.delete(fn);
    },
  };
}

export function createRuntime({ makeBackend, loop: makeLoop = createLoop, input, quality, saves = null, store = null, assets, audio, workers = null, video = null, origin = createOrigin(), events = createEvents(), gpu = false, override = null, visible = () => true, calibrate: calibrating = true, debug = createDebug(), gpuClock = null, fps = null, tier: decideTier = null, onLoss = null, lost: startLost = false }) {
  let gfx = null;
  const clocks = new WeakMap(); // a renderer's GPU clock, made once (it turns on its timestamps)
  let kind = null; // the backend asked for
  let coming = null; // { kind, promise }: a backend still being made, for every mount that asks meanwhile
  // (`lost` at creation: a chip whose WebGPU device was lost twice this
  // week starts on the node renderer over WebGL 2, lib/gpuProbe's lostTwice)
  let lostWebGPU = Boolean(startLost);
  let lastLoss = null; // the backend kind the last loss was on
  let status = 'idle';
  let failure = null; // { world, name, message, module }: why the last world failed
  const failed = (mod, err) => {
    failure = { world: mod?.id ?? null, name: err?.name ?? 'Error', message: String(err?.message ?? err), module: err?.module ?? null };
  };
  let current = null; // { module, world, host, props }
  let seq = 0; // the latest mount or handover: an older one arriving is dropped
  let making = null; // { module, token }: the one being made now
  let last = 0; // the previous frame's time
  let kicked = false;
  let shown = true; // the host on screen (setVisible)
  let snap = null; // the old world's last frame, fading out
  let takeSnap = false; // take it after the next draw
  let snapped = null; // a handover waiting for that frame
  let timeline = null;
  let fading = false; // the cover's fade has begun
  let holding = false; // the cover waits for adopt() (a handover across a route change)
  let holdSince = null;
  let fresh = null; // the box of a mount not yet drawn, marked data-fresh
  let resized = null; // { w, h }: the box's new size, for the next frame to take
  let tier = null; // the renderer tier, once asked (decideTier)
  let pacer = null; // the cadence's judge for the world that is up (createCadence)
  const clockNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  let tiering = null; // its one asking, shared by every mount meanwhile
  const listeners = new Set();
  const dev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

  const setStatus = (s) => {
    if (s === status) return;
    status = s;
    for (const fn of listeners) fn(s);
  };
  // A fresh mount's box is marked data-fresh until its world's first frame,
  // and runtime.css keeps the canvas clear meanwhile, then fades it in: the
  // world comes in over its loading line instead of popping in, and a
  // canvas moved in from another box never shows that box's last frame
  // first. A handover's world needs none (the old world's last frame is
  // over it), so it's never marked there, and the canvas doesn't dip under
  // the cover.
  const mark = (host) => {
    unmark();
    if (!host?.dataset) return;
    host.dataset.fresh = '';
    fresh = host;
  };
  const unmark = () => {
    if (fresh?.dataset) delete fresh.dataset.fresh;
    fresh = null;
  };

  const frame = (t) => {
    if (!current) return false;
    const dt = last ? Math.min(MAX_DT, (t - last) / 1000) : 0.016;
    const interval = last ? t - last : 0;
    last = t;
    const { world } = current;
    let cpuMs = 0;
    try {
      // the box's new size (rt.resize), before the draw, for the same reason
      // as the quality level below
      if (resized) {
        const { w, h } = resized;
        resized = null;
        if (w !== gfx.size.w || h !== gfx.size.h) {
          gfx.setSize(w, h);
          world.resize(gfx.size.w, gfx.size.h);
        }
      }
      // a new quality level before the draw: a new ratio resizes the drawing
      // buffer, which clears it, and drawn after that in this same task it's
      // never shown empty (resized after the draw, the browser showed the
      // cleared buffer for a frame: the picture blinked out). Not while the
      // next world is made behind this one: these frames carry its making,
      // and its warm-up starts at its own first frame.
      const level = rt.loading ? null : quality.frame(t);
      if (level !== null) {
        // (a module that draws through passes of its own sets its own
        // sharpness inside them, `sharpness: 'own'`: the canvas keeps its size,
        // whose every change waits on the graphics chip)
        if (current.module.sharpness !== 'own' && quality.source !== 'gpu') gfx.setRatio(ratioFor(current.module));
        world.lowerQuality?.(level);
      }
      const at = world.anchor?.();
      if (at) {
        const shift = origin.check(at);
        if (shift) events.emit('origin', { shift });
      }
      const snapshot = input.sample(t);
      const began = clockNow();
      world.step?.(dt, snapshot, t);
      world.draw({ dt, now: t, renderer: gfx.renderer, quality });
      cpuMs = clockNow() - began;
    } catch (err) {
      if (dev) console.error(`[${current.module.id}] frame failed`, err);
      failed(current.module, err);
      fail();
      return false;
    }
    // 60 or an even 30 (createCadence); not while the next world is made
    // behind this one, whose making these frames carry
    if (pacer && !rt.loading) {
      const clock = gfx.renderer ? clocks.get(gfx.renderer) : null;
      const next = pacer.frame(t, { interval, cpuMs, gpuMs: clock?.available ? (clock.last ?? null) : null, floored: Boolean(quality.floored) });
      if (next !== null) loop.setCadence?.(next);
    }
    // (the cover is read after the draw, in the frame's own task: see cover())
    if (takeSnap) {
      takeSnap = false;
      snap?.remove();
      snap = gfx.snapshot(current.host);
      timeline = null;
      snapped?.();
    }
    if (status === 'ready') {
      unmark(); // (drawn: the canvas fades in from here)
      failure = null;
      setStatus('on');
    }
    if (snap && timeline && holding) {
      if (holdSince === null) holdSince = t;
      else if (t - holdSince > HOLD_MAX) holding = false;
    }
    if (snap && timeline && !holding) {
      if (!fading) {
        fading = true;
        timeline.start(t);
      }
      const { opacity, done } = timeline.frame(t);
      snap.set(opacity);
      if (done) {
        snap.remove();
        snap = null;
        timeline = null;
        fading = false;
      }
    }
    const more = (world.wants ? world.wants() !== false : true) || Boolean(snap && timeline) || kicked;
    kicked = false;
    if (!more) last = 0;
    return more;
  };
  const loop = makeLoop(frame, { can: () => Boolean(current) && shown && visible() });

  const letGo = (entry) => {
    if (!entry) return;
    debug.hide();
    try {
      entry.world.dispose();
    } catch (err) {
      if (dev) console.warn(`[${entry.module.id}] dispose failed`, err);
    }
    audio.fadeOut?.();
    assets.drop?.(entry.module.id);
  };
  const clearHost = () => {
    input.unbind();
    input.detach();
    snap?.remove();
    snap = null;
    timeline = null;
    fading = false;
    takeSnap = false;
    snapped?.();
    holding = false;
    holdSince = null;
    resized = null;
    unmark();
  };
  // the next frame drawn, kept as the cover (taken in the frame's own task,
  // so no preserveDrawingBuffer is needed); over after SNAP_WAIT with no
  // cover when no frame comes (the host off screen, the tab hidden)
  const cover = () =>
    new Promise((resolve) => {
      const done = () => {
        if (snapped !== done) return;
        snapped = null;
        takeSnap = false;
        resolve();
      };
      snapped = done;
      takeSnap = true;
      loop.kick();
      setTimeout(done, SNAP_WAIT);
    });
  const fail = () => {
    const was = current;
    current = null;
    clearHost();
    letGo(was);
    loop.stop();
    setStatus('failed');
  };

  // the sharpness to draw a module at: the quality's, under the module's own
  // cap (and without the pace's scale for one that softens through its own
  // passes, module.js's `sharpness: 'own'`: its canvas keeps its size)
  const ratioFor = (mod) => (quality.ratioUnder ? quality.ratioUnder(mod?.ratio, { unscaled: mod?.sharpness === 'own' }) : quality.ratio);

  const backendFor = async (module) => {
    const want = pickBackend({ gpu, shading: module.shading, override, lost: lostWebGPU });
    if (gfx && kind === want && !gfx.lost) return gfx;
    // one of this kind on its way already: a mount meanwhile waits for that
    // one (React's second run of an effect mounts again at once, and a second
    // backend was a second WebGL context never let go, and the one kept
    // wasn't always the one the build had set the ratio on)
    if (coming?.kind === want) return coming.promise;
    // (a backend of the other kind can't share the canvas: the old one goes)
    if (gfx) {
      gfx.dispose();
      gfx = null;
    }
    kind = want;
    const asked = { kind: want, promise: null };
    coming = asked;
    asked.promise = new Promise((resolve) => resolve(makeBackend(want, { budget: quality.budget, onLost: (loss) => rt.lost(loss), hdr: rt.video?.hdr === 'on' }))).then(
      (made) => {
        // another kind asked for since (or the runtime let go): this one goes too
        if (coming !== asked) {
          made.dispose();
          return null;
        }
        coming = null;
        gfx = made;
        return made;
      },
      (err) => {
        if (coming === asked) coming = null; // (the next mount tries again)
        throw err;
      },
    );
    return asked.promise;
  };

  // the governor starts afresh with each world, at its sharpest and deaf
  // to its arrival's hitches for a moment, and before the ratio's set, so
  // that's the sharpest (not the last world's softened one)
  const start = (module) => {
    const nodes = module.shading === 'nodes' && gfx.backend !== 'webgl';
    const onGpu = nodes && gfx.backend === 'webgpu' && typeof gpuClock === 'function' && gfx.renderer;
    if (onGpu && !clocks.has(gfx.renderer)) clocks.set(gfx.renderer, gpuClock(gfx.renderer) ?? null);
    // (lane G1's renderer tier, T0…T2, where the runtime has one: rt.tier)
    const tier = rt.tier ?? null;
    // (the drawing buffer's pixels: the 4K start the world's headroomAt takes)
    const pixels = Math.round((gfx.size?.w ?? 0) * (gfx.size?.h ?? 0) * ratioFor(module) ** 2);
    quality.setSource?.(onGpu ? 'gpu' : nodes ? 'cpu' : 'classic', { gpuTime: onGpu ? clocks.get(gfx.renderer) : null, fps, tier, pixels });
    pacer = createCadence({ fps });
    loop.setCadence?.(pacer.every);
    quality.reset?.();
    quality.hold?.(WARM_UP);
    gfx.setRatio?.(ratioFor(module));
  };

  // make a module's world; null if something newer came meanwhile. A mount
  // starts its world afresh here, before it's made, since nothing is drawn
  // in the canvas meanwhile. A handover leaves that for the cover: the old
  // world still draws in the canvas, and a take-off begins inside its draw,
  // so this runs after that draw and before the browser paints, with the
  // next frame not due till after it; a new ratio set here cleared the
  // buffer, and that blank was shown for a frame.
  const build = async (module, props, host, token, { early }) => {
    const made = await backendFor(module);
    if (token !== seq || !made) return null;
    if (module.shading === 'nodes' && decideTier) {
      tiering ??= Promise.resolve()
        .then(() => decideTier(made))
        .then(
          (t) => (tier = t ?? null),
          (err) => {
            if (dev) console.warn('the renderer tier could not be decided', err);
          },
        );
      await tiering;
      if (token !== seq) return null;
    }
    if (early) start(module);
    rt.host = host;
    assets.owner?.(module.id);
    let world = validateWorld(await module.create(rt, props));
    if (token !== seq) {
      world.dispose();
      return null;
    }
    if (world.ready) {
      await settle(world.ready, READY_WAIT);
      if (token !== seq) {
        world.dispose();
        return null;
      }
      world.update?.(props);
    }
    // everything sent to the graphics chip before it's shown (lib/three/
    // gpuWork's prepareScene), a slice a frame, while the page shows its
    // loading screen or the old world goes on drawing (a handover's flight
    // is its loading screen); its progress goes out as 'prepare' events
    if (world.prepare) {
      const report = (value, step) => events.emit('prepare', { module: module.id, value, step });
      try {
        await world.prepare(report, { alive: () => token === seq });
      } catch (err) {
        if (dev) console.warn(`[${module.id}] prepare failed`, err);
      }
      if (token !== seq) {
        world.dispose();
        return null;
      }
      report(1, 'first draw');
    }
    return world;
  };
  // How sharp it can afford to be here (lib/three/calibrate), found while
  // its loading screen is still up: drawn at the pace's steps, sharpest
  // first, timed on the graphics chip, the sharpest that fits the frame's
  // budget kept for this chip, world and screen, and held as the pace's
  // ceiling so it never see-saws. Only on a mount: in a handover the old
  // world is on the canvas, and the new one starts at what was kept.
  const tune = async (mod, world, token, { measure = true } = {}) => {
    // (`calibrate: false`, the QA scripts' ?calibrate=off: no walk, the world
    // drawn at its sharpest step, so a measured run is the same on any chip)
    if (!gfx?.renderer || !calibrating || mod.calibrate === false || !quality.setLevel) return;
    const key = calibrationKey(gfx.renderer, mod.id, gfx.size.w, gfx.size.h);
    const kept = recall(key);
    const setLevel = (l) => {
      quality.setLevel(l);
      if (mod.sharpness !== 'own') gfx.setRatio(ratioFor(mod));
      world.lowerQuality?.(l);
    };
    if (!measure) {
      if (kept != null) setLevel(kept);
      return;
    }
    events.emit('prepare', { module: mod.id, value: 0.97, step: 'tune' });
    const draw = () => world.draw({ dt: 0, now: typeof performance !== 'undefined' ? performance.now() : 0, renderer: gfx.renderer, quality });
    let level = 0;
    try {
      level = await calibrate({ renderer: gfx.renderer, draw, setLevel, start: kept ?? 0, frames: kept != null ? 4 : 12, alive: () => token === seq });
    } catch (err) {
      if (dev) console.warn(`[${mod.id}] calibration failed`, err);
      return;
    }
    if (token !== seq) return;
    setLevel(level);
    remember(key, level);
  };

  const place = (world, host, mod) => {
    if (gfx.canvas.parentNode !== host) host.prepend(gfx.canvas);
    // (the canvas is the picture: a module may say what it shows)
    if (gfx.canvas.setAttribute) {
      if (mod.label) {
        gfx.canvas.setAttribute('role', 'img');
        gfx.canvas.setAttribute('aria-label', mod.label);
      } else {
        gfx.canvas.removeAttribute?.('role');
        gfx.canvas.removeAttribute?.('aria-label');
      }
    }
    const r = host.getBoundingClientRect?.();
    const w = Math.max(1, Math.round(r?.width ?? 1));
    const h = Math.max(1, Math.round(r?.height ?? 1));
    resized = null; // (measured just now)
    gfx.setSize(w, h);
    world.resize(w, h);
  };
  const begin = (module, world, host, props) => {
    input.attach({ win: typeof window !== 'undefined' ? window : host, host });
    current = { module, world, host, props };
    // on screen until its own box says not: whether the last world's box
    // was in sight says nothing of this one's, and a page's observer heard
    // while this world was still being made was dropped (useWorld), so
    // carried over, a box scrolled away kept the next world from ever drawing
    shown = true;
    origin.reset();
    // (the pace's step so far, for a world that draws at it itself)
    if (module.sharpness === 'own' && quality.level > 0) world.lowerQuality?.(quality.level);
    world.setVisible?.(shown);
    // its tuning panel, behind ?debug (a world's tune() that throws costs
    // the panel, never the world)
    if (debug.on) {
      let groups = null;
      try {
        groups = world.tune?.();
      } catch (err) {
        if (dev) console.warn(`[${module.id}] tune failed`, err);
      }
      debug.show(module.id, groups);
    }
    last = 0;
    setStatus('ready');
    loop.kick();
  };

  const rt = {
    // the visitor's video settings as resolved for this device (lib/video.js;
    // lane V1): a module reads them at mount; revideo() replaces them
    video,
    get gfx() {
      return gfx;
    },
    input,
    quality,
    saves,
    store,
    assets,
    audio,
    workers,
    origin,
    events,
    debug,
    host: null,
    get status() {
      return status;
    },
    get tier() {
      return tier;
    },
    // (a loss there is somewhere to come back from: one on WebGPU, whose
    // next backend is the node renderer over WebGL 2; useWorld mounts its
    // page's world again once)
    get recoverable() {
      return lastLoss === 'webgpu';
    },
    // (the chip's own clock on the renderer that is up, lib/three/gpuTime,
    // or null: a world's waiting screen reads its median for the pace's
    // recommendation)
    get gpuClock() {
      return gfx?.renderer ? (clocks.get(gfx.renderer) ?? null) : null;
    },
    get failure() {
      return failure;
    },
    // the module being made (a mount or a handover still on its way), or null
    get loading() {
      return making && making.token === seq ? making.module : null;
    },
    get current() {
      return current;
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    invalidate() {
      kicked = true;
      loop.kick();
    },
    // taken at the start of the next frame, before it's drawn: a
    // ResizeObserver calls this after the frame's draw, and adopt() from a
    // layout effect, and a buffer resized then was shown cleared until the
    // next draw (now the old picture shows stretched for that frame
    // instead), and no world is drawn from inside React's commit
    resize(w, h) {
      if (!gfx || !current) return;
      resized = { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
      loop.kick();
    },
    setVisible(on) {
      shown = Boolean(on);
      current?.world.setVisible?.(shown);
      if (shown) loop.kick();
    },
    // the context is gone: the world with it, and any world still being
    // made on it (its make ends at its next check, quietly: the status is
    // 'lost', not 'failed'); the next mount makes a backend afresh. `loss`
    // ({ reason, message, adapter }, webgpu.js's) goes to onLoss with the
    // kind it was on, for the chip's record (runtime/index.js)
    lost(loss = {}) {
      const on = kind;
      if (on === 'webgpu') lostWebGPU = true;
      lastLoss = on;
      seq += 1;
      making = null;
      coming = null;
      const was = current;
      current = null;
      clearHost();
      letGo(was);
      loop.stop();
      gfx?.dispose();
      gfx = null;
      setStatus('lost');
      try {
        onLoss?.({ ...(loss ?? {}), kind: on });
      } catch (err) {
        if (dev) console.warn('the loss could not be kept', err);
      }
    },
    async mount(module, props = {}, host) {
      const mod = validateModule(module);
      const token = ++seq;
      making = { module, token };
      const was = current;
      current = null;
      clearHost();
      letGo(was);
      mark(host);
      setStatus('loading');
      try {
        const world = await build(mod, props, host, token, { early: true });
        if (!world) return false;
        place(world, host, mod);
        await tune(mod, world, token);
        if (token !== seq) {
          world.dispose();
          return false;
        }
        making = null;
        begin(module, world, host, props); // (the object the page mounted, so it can tell its own)
        return true;
      } catch (err) {
        if (dev) console.error(`[${mod.id}] 3D failed`, err);
        if (token === seq) {
          failed(mod, err);
          making = null;
          current = null;
          unmark();
          setStatus('failed');
        }
        return false;
      }
    },
    // `held`: the cover stays up until the page that shows the new world
    // adopts it (rt.adopt, HOLD_MAX at most), for a handover the route
    // changes after. `after`: a promise the old world's last moment waits
    // on once the new one is made (a dive flown to its end while the next
    // world was built behind it), AFTER_MAX at most.
    // `onBuilt`: called once the new world is made and prepared, before
    // `after` is waited on (a landing waits for this to start its dive, so
    // the dive flies with nothing left to load)
    async handover(module, props = {}, host, { fade = 600, held = false, after = null, onBuilt = null } = {}) {
      if (!current) return this.mount(module, { ...props, from: null }, host);
      const mod = validateModule(module);
      const token = ++seq;
      making = { module, token };
      const old = current;
      let from = null;
      try {
        from = old.world.handoff?.() ?? null;
      } catch (err) {
        if (dev) console.warn(`[${old.module.id}] handoff failed`, err);
      }
      // (the keys are the new world's from here, bound as it's made: the old
      // one is on its way out, but draws on until the new one is ready)
      const kept = input.bindings?.() ?? null;
      input.unbind();
      try {
        const world = await build(mod, { ...props, from }, host, token, { early: false });
        if (!world) return false;
        try {
          onBuilt?.();
        } catch (err) {
          if (dev) console.warn(`[${mod.id}] onBuilt failed`, err);
        }
        if (after) {
          await settle(after, AFTER_MAX);
          if (token !== seq) {
            world.dispose();
            return false;
          }
        }
        // the old world's last frame, kept over the new one while it fades
        await cover();
        if (token !== seq) {
          world.dispose();
          return false;
        }
        making = null;
        if (current === old) letGo(old); // (unless a thrown frame took it already)
        current = null;
        input.detach();
        start(mod); // (under the cover: the canvas is the new world's from here)
        place(world, host, mod);
        tune(mod, world, token, { measure: false });
        begin(module, world, host, props);
        timeline = snap ? createHandover({ fade }) : null; // (nothing drawn to fade: straight in)
        fading = false;
        holding = Boolean(held && snap);
        holdSince = null;
        return true;
      } catch (err) {
        if (dev) console.error(`[${mod.id}] 3D failed`, err);
        if (token === seq) {
          failed(mod, err);
          making = null;
          // the old world stays up: better than black (and nothing over it)
          current = old;
          takeSnap = false;
          snap?.remove();
          snap = null;
          if (kept) input.bind(kept.actions, { axes: kept.axes });
          setStatus(old ? 'on' : 'failed');
        }
        return false;
      }
    },
    // the world handed over before this page was up, into its box: the
    // canvas, the cover and the pointer move there, and the cover's fade
    // can begin
    adopt(module, host) {
      if (!gfx || !host || current?.module !== module) return false;
      if (current.host !== host) {
        current.host = host;
        rt.host = host;
        if (gfx.canvas.parentNode !== host) host.prepend(gfx.canvas);
        if (snap?.el && snap.el.parentNode !== host) host.appendChild(snap.el);
        input.attach({ win: typeof window !== 'undefined' ? window : host, host });
      }
      holding = false;
      const r = host.getBoundingClientRect?.();
      if (r) this.resize(r.width, r.height);
      loop.kick();
      return true;
    },
    requality(level) {
      // (the budget first: a world mounted next is built at the new level)
      quality.retune?.(level);
      if (!current || rt.loading) return 'idle';
      if (gfx) gfx.setRatio?.(ratioFor(current.module));
      const { world, module } = current;
      const tune = world.onQuality ? () => world.onQuality(level) : module.onQuality ? () => module.onQuality(level, world, rt) : null;
      if (!tune) return 'reload';
      try {
        tune();
      } catch (err) {
        if (dev) console.warn(`[${module.id}] onQuality failed`, err);
        return 'reload';
      }
      loop.kick();
      return 'tuned';
    },
    // (the video settings changed while a world is up, lane V1: the shape of
    // requality; the world's `onVideo(values)`, or its module's
    // `onVideo(values, world, rt)`, for one that can turn its live controls
    // without being built again; 'reload' says it can't)
    revideo(values) {
      rt.video = values ?? null;
      if (!current || rt.loading) return 'idle';
      const { world, module } = current;
      const tune = world.onVideo ? () => world.onVideo(rt.video) : module.onVideo ? () => module.onVideo(rt.video, world, rt) : null;
      if (!tune) return 'reload';
      try {
        tune();
      } catch (err) {
        if (dev) console.warn(`[${module.id}] onVideo failed`, err);
        return 'reload';
      }
      loop.kick();
      return 'tuned';
    },
    reload() {
      if (!current) return Promise.resolve(false);
      const { module, props, host } = current;
      return this.mount(module, props, host);
    },
    sharpen(k) {
      quality.setSharpness?.(k);
      if (gfx && current) {
        gfx.setRatio?.(ratioFor(current.module));
        loop.kick();
      }
    },
    unmount() {
      seq += 1;
      const was = current;
      current = null;
      clearHost();
      letGo(was);
      loop.stop();
      last = 0;
      setStatus('idle');
    },
    dispose() {
      this.unmount();
      coming = null; // (one still being made is let go as it comes)
      gfx?.dispose();
      gfx = null;
      workers?.dispose?.();
    },
  };
  return rt;
}
