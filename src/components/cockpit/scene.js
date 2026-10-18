// The cockpit in WebGL: you in the pilot's seat of one of the vehicles
// (./vehicles), looking about, then the launch. Two passes a frame with one
// eye: the world outside (space, the street, the desert) and then, over it
// with its own depth, the cockpit and its crew, so the frame of the glass is
// always in front of whatever is out there. How it draws follows the quality
// level (./levels.js): from mid up on a computer's graphics chip a post
// chain, multisampled, with bloom and the lens (./lens.js: at the top, the
// speed blur at the jump, a sun's glare, the glass's dirt); low, phones and
// software WebGL one pass straight to the screen. The nebula is baked to a
// cube once a vehicle is built (./bake.js).
//
// A vehicle can turn your head itself during the launch (the RV looks out at
// its wings): its aim(t, plan) is a [yaw, pitch] added to wherever you're
// looking. Not with reduced motion.
//
// run(canvas, opts) → { pick(id), go(), skip(), look…, stop() }
//   opts: { vehicle, veil, reduced, onBoarded(id), onReveal, onPeak, onDone,
//           onFail, onLine(line), onPhase(name) }
//   (onReveal: as the flash starts to rise, for the page underneath to come
//   on under the white)
// Throws if WebGL can't start; onFail if it's lost or a vehicle won't build.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createRenderer, disposeTree, maxRatio, precompile, precompilePasses, revealAll, texturesUnder, uploadTextures } from '../../lib/three/renderer';
import { createLoop } from '../../lib/three/loop';
import { fence, uploadSlices } from '../../lib/three/gpuWork';
import { gpuTimer } from '../../lib/three/calibrate';
import { gpu } from '../../lib/gpu';
import { device } from '../../lib/device';
import { inFront } from '../../lib/foreground';
import { flashAt, phaseAt, plan as planOf, skipTo, smooth, throttleAt } from './timeline';
import { freeKit } from './kit';
import { cockpitSound } from './sounds';
import { levelOf, ratioFor } from './levels';
import { lensAt, lensPass } from './lens';
import { bakeSkies } from './bake';

const BUILD = {
  falcon: () => import('./vehicles/falcon'),
  xwing: () => import('./vehicles/xwing'),
  cruiser: () => import('./vehicles/cruiser'),
  rv: () => import('./vehicles/rv'),
};
export const preloadVehicle = (id) => BUILD[id]?.().then((m) => m.prefetch?.()).catch(() => {});

const coarse = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;
const DEG = Math.PI / 180;
// how much of the lens's speed blur each launch takes (the jump's whole):
// the cruiser floors it down the street into its portal; the RV's drive
// into the night and its climb, watched from outside, take none. (Here, not
// in those vehicles: both are GLSL originals with a twin, and aren't edited.)
const STREAK = { cruiser: 0.7, rv: 0 };
// How often a vehicle's shadows are drawn again, in frames, sat and going (0:
// once, as nothing that throws one moves). The X-wing's frame is all that
// throws one; Chewie and the levers move a little; the RV's crew sat, and
// the road once it's off. Each light's own (three's light.shadow.autoUpdate),
// as the RV's sun and its cab's light are in the two passes.
const SHADOWS = { xwing: [0, 0], falcon: [3, 2], rv: [2, 1] };
// The chip's time for a frame sat in the cockpit (ms, timed on the chip where
// the browser can: lib/three/calibrate's gpuTimer) over which the launch,
// half as much again with the tunnel and the trails, would miss a 60 Hz
// screen's beat: the lens's light trails are left off for it.
const TRAILS_MS = 9;
// On a screen faster than 60 Hz the cockpit draws on every second (or third)
// beat, a steady 60, unless the chip's time for a frame sat is under this
// share of a beat: a frame that fits one beat some times and two others
// judders, and the cockpit at 120 is twice the heat for a scene that's still.
const HEADROOM = 0.45;
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

export function run(canvas, opts) {
  const { veil, reduced = false } = opts;
  const cb = opts;
  let failed = false;
  let stopped = false;
  const fail = (why) => {
    if (failed || stopped) return;
    failed = true;
    if (import.meta.env.DEV) console.error('[cockpit]', why);
    teardown();
    cb.onFail?.(why);
  };

  // the quality level's row (./levels.js): the post chain from mid up on a
  // computer's graphics chip, one pass on a phone or in software WebGL
  const info = gpu();
  // (in development, window.__tpRich draws a graphics chip's way in software
  // WebGL, for screenshots: ?quality= picks the level)
  const row = levelOf({ detail: device().detail, ok: info.ok || (import.meta.env.DEV && !!window.__tpRich), coarse: coarse() });
  const rich = row.post;
  const gl = createRenderer(canvas, {
    alpha: false,
    antialias: !rich,
    ratio: ratioFor(row, window.innerWidth, window.innerHeight),
    toneMapping: THREE.ACESFilmicToneMapping,
    exposure: 1,
    onLost: () => fail('context lost'),
    onSlow: () => lower(),
  });
  const { renderer } = gl;
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 1);
  // (up and drawing in front of the page: the map under it makes itself a
  // slice at a time and keeps no timing taken now; lib/foreground)
  const front = inFront('drawing');
  let launchHold = null;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const roomEnv = pmrem.fromScene(room, 0.04).texture;
  room.dispose?.();

  const inside = new THREE.Scene();
  const outside = new THREE.Scene();
  inside.environment = roomEnv;
  inside.environmentIntensity = 0.35;

  // one eye for both passes: the rig sits at the seat, the head turns
  const rig = new THREE.Object3D();
  const head = new THREE.Object3D();
  head.rotation.order = 'YXZ';
  rig.add(head);
  inside.add(rig);
  const camIn = new THREE.PerspectiveCamera(60, 1, 0.02, 40);
  head.add(camIn);
  const camOut = new THREE.PerspectiveCamera(60, 1, 0.3, 6000);

  let composer = null;
  let bloom = null;
  let lens = null;
  let drawnRatio = 0; // (the ratio the post chain's targets were made at)
  const passOut = new RenderPass(outside, camOut);
  const passIn = new RenderPass(inside, camIn);
  passIn.clear = false;
  passIn.clearDepth = true;
  if (rich) {
    // (the depth is the cockpit's own, the world outside's cleared before it:
    // where it's empty the lens knows a pixel is out of the glass)
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: row.samples, depthTexture: new THREE.DepthTexture(1, 1) });
    composer = new EffectComposer(renderer, target);
    composer.addPass(passOut);
    composer.addPass(passIn);
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.42, 0.82);
    composer.addPass(bloom);
    lens = lensPass(row.lens);
    // (drawn to the screen, it leaves the buffers where they are: every pass
    // before it draws into the read buffer, so that's the one target ever
    // made, and the depth the lens reads is always the frame's own)
    lens.pass.needsSwap = false;
    lens.set({ depth: composer.readBuffer.depthTexture });
    composer.addPass(lens.pass);
  }
  // Still slow at the lowest sharpness (the watchdog's word): what costs most
  // is shed, as nothing whose program would be made again (each material's
  // is the target's it draws into, so dropping the post chain, as this once
  // did, made them all again at once: a freeze where frames were already
  // late), and not in a launch, whose frames are the ones seen.
  let trailsOff = false;
  function lower() {
    if (L.on) return;
    trailsOff = true;
    if (bloom) bloom.enabled = false;
  }

  // ── the vehicle ──
  let v = null; // the built vehicle
  let sky = null; // its nebula, baked (./bake.js)
  let vid = null;
  let building = null;
  const size = { w: 1, h: 1 };
  const view = new THREE.Vector2();

  const fit = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    size.w = w;
    size.h = h;
    gl.setSize(w, h);
    sizePost();
    v?.resize?.(view.x, view.y, gl.ratio);
    frameLens();
  };
  // the post chain's targets at the ratio the canvas is drawn at: on a
  // resize, and when the watchdog has softened it (else the chain went on
  // drawing every pass at the old size and the canvas alone got smaller)
  function sizePost() {
    // (a window grown past the level's pixels draws softer, not more of
    // them; and so does a watchdog that would step back over them)
    const cap = ratioFor(row, size.w, size.h, maxRatio(row.ratio));
    if (gl.ratio > cap + 1e-3) gl.setRatio(cap);
    renderer.getDrawingBufferSize(view);
    drawnRatio = gl.ratio;
    if (!composer) return;
    composer.setPixelRatio(drawnRatio);
    composer.setSize(size.w, size.h);
    lens?.resize(view.x, view.y);
  }
  // A horizontal field of view the cockpit is framed for, kept within sane
  // vertical limits: a wide window's view gets taller, a phone's narrower
  // (look about to see the rest).
  let fovKick = 0;
  const frameLens = () => {
    const a = size.w / size.h;
    const hf = (v?.hfov ?? 86) * DEG;
    let vf = 2 * Math.atan(Math.tan(hf / 2) / a) / DEG;
    vf = Math.min(v?.vmax ?? 94, Math.max(v?.vmin ?? 52, vf));
    vf *= 1 + fovKick;
    for (const c of [camIn, camOut]) {
      c.fov = vf;
      c.aspect = a;
      c.updateProjectionMatrix();
    }
  };
  // (a resize waits for the next frame, so a drag's many are one, and for the
  // launch to be over: each one makes the canvas and the post chain again)
  let resized = false;
  const onResize = () => {
    resized = true;
    kick();
  };
  window.addEventListener('resize', onResize);

  // ── looking about ──
  // (`glance`: a vehicle's look over at its crew a moment after you sit
  // down, which shows the view moves; any look of your own ends it)
  const look = { yaw: 0, pitch: 0, ty: 0, tp: 0, rest: [0, 0], range: [1, 0.4], glance: 0, sat: 0, own: false };
  const clampLook = () => {
    look.ty = Math.max(look.rest[0] - look.range[0], Math.min(look.rest[0] + look.range[0], look.ty));
    look.tp = Math.max(look.rest[1] - look.range[1], Math.min(look.rest[1] + look.range[1], look.tp));
  };

  // ── the lens's state, each frame ──
  // Where you're flying (straight down −z, out in the world: the jump's
  // vanishing point) and the sun the vehicle names, on the screen; how
  // strong the speed blur, the parted colours and the glass's light are at
  // this moment of the launch (lens.js's lensAt).
  const AHEAD = new THREE.Vector3(0, 0, -1);
  const toward = new THREE.Vector3();
  const onScreen = (worldPoint) => {
    toward.copy(worldPoint).project(camOut);
    return toward.z < 1 && toward.z > -1 ? [toward.x * 0.5 + 0.5, toward.y * 0.5 + 0.5] : null;
  };
  const glassGlow = [0, 0, 0];
  const tint = new THREE.Color();
  const aimLens = (throttle, flash, now) => {
    const at = lensAt({ lens: row.lens, launching: L.on, throttle, flash, streak: trailsOff ? 0 : (STREAK[vid] ?? 1) });
    let focus = null;
    if (at.streak > 0) {
      camOut.getWorldDirection(toward);
      // (only while it's ahead of you: looking back, there's nowhere to smear to)
      if (toward.dot(AHEAD) > 0.2) focus = onScreen(toward.copy(camOut.position).addScaledVector(AHEAD, 1000));
    }
    tint.set(v.flash ?? '#eaf3ff');
    glassGlow[0] = tint.r * at.glow;
    glassGlow[1] = tint.g * at.glow;
    glassGlow[2] = tint.b * at.glow;
    const g = v.glare;
    const sunAt = g && g.k > 0.001 ? onScreen(g.at) : null;
    lens.set({
      time: now / 1000,
      focus,
      streak: at.streak,
      aberration: at.aberration,
      glow: glassGlow,
      sun: sunAt ? { at: sunAt, k: g.k, size: g.size ?? 0.012 } : null,
      ...(g?.color ? { sunColor: g.color } : {}),
    });
  };

  // ── the launch ──
  const L = { at: 0, t: 0, on: false, peaked: false, done: false, plan: planOf('falcon') };
  let sound = null;

  // The way out, at the flash: the flash and the cockpit fade on the
  // compositor (not a style a frame, which a main thread busy with the map
  // coming on underneath holds back), and the cockpit's black lets go, so
  // they clear onto the map rather than onto black and then a cut. The
  // flash's ease and the cockpit's, as flashAt and the out phase had them.
  const onCompositor = typeof canvas.animate === 'function' && !!veil?.animate;
  const clearOut = () => {
    if (canvas.parentElement) canvas.parentElement.style.background = 'transparent';
    if (!onCompositor) return;
    const left = Math.max(1, L.plan.end - L.t);
    flashColor.set(v?.flash ?? '#eaf3ff');
    setVeil(`#${flashColor.getHexString()}`, '1');
    veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: left, easing: 'ease-in-out', fill: 'forwards' });
    canvas.animate([{ opacity: 1 }, { opacity: 0 }], { duration: left * 0.8, easing: 'ease-in-out', fill: 'forwards' });
  };

  // ── the frame ──
  let last = 0;
  let clock = 0;
  let fade = 1; // the black between vehicles: 1 covers, 0 clear
  let fadeTo = 1;
  let firstDrawn = false;
  let warming = null; // a vehicle whose shaders are still linking (pick): not drawn yet
  const flashColor = new THREE.Color();
  const shake = new THREE.Vector2();
  let drawn = 0; // frames drawn, for the shadows' pace
  const base = { bloom: 0.55 }; // the vehicle's own, for the white-out
  let whiteOut = true; // (its flash a light one: the RV's is the night)
  let casters = []; // the vehicle's lights that throw shadows: { light, want }
  let boarded = false; // sat down: drawn, warmed, faded in
  const veilWas = { background: '', opacity: '' };
  const setVeil = (background, opacity) => {
    if (veilWas.background !== background) veil.style.background = veilWas.background = background;
    if (veilWas.opacity !== opacity) veil.style.opacity = veilWas.opacity = opacity;
  };
  // (the chip's time for a frame, sat: a few, timed now and then)
  const timer = rich ? gpuTimer(renderer.getContext()) : null;
  const gpuMs = [];
  let timing = false;

  // (development: window.__tpStats counts a whole frame's draws, both passes
  // and the bloom's, for info() below)
  const stats = import.meta.env.DEV && typeof window !== 'undefined' && !!window.__tpStats ? { calls: 0, triangles: 0, ms: 0 } : null;
  if (stats) renderer.info.autoReset = false;
  const draw = () => {
    if (composer) composer.render();
    else {
      renderer.clear();
      renderer.render(outside, camOut);
      renderer.clearDepth();
      renderer.render(inside, camIn);
    }
  };

  // Everything a vehicle has, drawn once: what's hidden too (the RV's wings,
  // what its launch cuts to) and what's behind you, so their textures and
  // meshes are on the graphics chip before the moment they're first seen
  // (lib/three/renderer's revealAll).
  const warm = () => {
    const undo = revealAll(inside, outside);
    for (const c of casters) c.light.shadow.needsUpdate = true;
    try {
      draw();
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[cockpit] warm-up failed', err);
    } finally {
      undo();
    }
  };
  let late = false; // something arrived after the vehicle was drawn (`added`, below)

  const step = (now) => {
    if (failed || stopped || gl.lost) return false;
    if (document.hidden) return false;
    // (in a launch only for a new shape, a phone turned or the screen
    // filled: a stretched picture through the RV's long one is worse)
    if (resized && (!L.on || Math.abs(window.innerWidth / window.innerHeight / (size.w / size.h) - 1) > 0.15)) {
      resized = false;
      fit();
    }
    // the launch keeps real time (its sounds are scheduled in it), however
    // slowly the frames come; everything else steps at most 50 ms a frame
    const real = last ? Math.min(250, now - last) : 16;
    const dt = Math.min(0.05, real / 1000);
    last = now;
    clock += dt;
    // (the watchdog judges the frames sat, never a launch's: a step resizes the
    // canvas and the post chain, a held frame where it would show most)
    if (!L.on) gl.watch(now);

    let throttle = 0;
    let ph = null;
    if (L.on) {
      if (!L.hold) L.t += real;
      ph = phaseAt(L.plan, L.t);
      throttle = throttleAt(L.plan, L.t);
      // the page underneath uncovered as the flash starts to rise, so the
      // map's first frame is drawn and its loading veil gone under the white
      // rather than as it clears; the chip is its again
      if (!L.revealed && (flashAt(L.plan, L.t) > 0 || L.t >= L.plan.peak)) {
        L.revealed = true;
        launchHold?.();
        launchHold = null;
        cb.onReveal?.();
      }
      if (!L.peaked && L.t >= L.plan.peak) {
        L.peaked = true;
        clearOut();
        cb.onPeak?.();
      }
    }

    if (v && v !== warming) {
      // the head: where you're looking, eased; drawn back ahead as you go
      const ahead = L.on ? smooth(Math.min(1, L.t / (L.plan.spool * 0.9 + 1))) : 0;
      const since = clock - look.sat;
      const glance = look.own || L.on ? 0 : look.glance * (smooth((since - 1.4) / 1.1) - smooth((since - 3.6) / 1.2));
      const aim = L.on && !reduced ? v.aim?.(L.t, L.plan) : null;
      const ty = look.ty + glance + (look.rest[0] - look.ty) * ahead + (aim?.[0] ?? 0);
      const tp = look.tp + (look.rest[1] - look.tp) * ahead + (aim?.[1] ?? 0);
      const k = 1 - Math.exp(-dt * (L.on ? 7 : 4.5));
      look.yaw += (ty - look.yaw) * k;
      look.pitch += (tp - look.pitch) * k;
      // a little life when sitting still, a shudder when going
      const idle = reduced ? 0 : 1;
      const rumble = reduced ? 0 : (v.rumble ?? 1) * (ph?.name === 'spool' ? 0.0025 * ph.k : 0) + (L.on ? 0.009 * throttle * throttle : 0);
      shake.set(Math.sin(clock * 37.1) * 0.6 + Math.sin(clock * 23.7) * 0.4, Math.sin(clock * 41.3) * 0.5 + Math.sin(clock * 29.9) * 0.5).multiplyScalar(rumble);
      head.rotation.set(look.pitch + Math.sin(clock * 0.7) * 0.004 * idle + shake.y, look.yaw + Math.sin(clock * 0.43) * 0.006 * idle + shake.x, shake.x * 0.4);
      head.position.y = Math.sin(clock * 1.1) * 0.003 * idle;
      fovKick = reduced ? 0 : 0.16 * Math.pow(throttle, 2) - (ph?.name === 'spool' ? 0.02 * ph.k : 0);
      frameLens();

      v.update(dt, clock, { launching: L.on, t: L.t, phase: ph, throttle, plan: L.plan, look });
      sky?.update();
      sound?.set({ throttle, t: L.t, launching: L.on });

      // both eyes the same
      rig.updateMatrixWorld(true);
      camIn.getWorldPosition(camOut.position);
      camIn.getWorldQuaternion(camOut.quaternion);
      camOut.updateMatrixWorld(true);
      // (the watchdog softened the canvas: the post chain and the streaks follow it)
      if (gl.ratio !== drawnRatio) {
        sizePost();
        v.resize?.(view.x, view.y, gl.ratio);
      }
      if (lens) aimLens(throttle, L.on ? flashAt(L.plan, L.t) : 0, now);
      // the white-out: as a light flash rises the picture's light runs over
      // (pushed up in the lens, its bloom too), so the jump burns into the
      // white rather than a veil fading over it; the RV's goes to night
      if (lens && L.on && whiteOut) {
        const f = flashAt(L.plan, L.t);
        lens.set({ lift: 1 + 2.5 * f * f });
        if (bloom) bloom.strength = base.bloom * (1 + 2.5 * f);
      }
      // The shadows at the vehicle's pace (SHADOWS), where the vehicle wants
      // them at all: one that turns a light's shadow off itself (the RV's,
      // once its sun is down) is left off, its wish put back after the draw.
      const every = (SHADOWS[vid] ?? [1, 1])[L.on ? 1 : 0];
      const due = every > 0 && drawn % every === 0;
      for (const c of casters) {
        c.want = c.light.shadow.autoUpdate;
        c.light.shadow.autoUpdate = false;
        if (c.want && due) c.light.shadow.needsUpdate = true;
      }
      drawn += 1;
      // (not during a launch: better a model that pops in than a held frame)
      if (late && !L.on) {
        late = false;
        warm();
      }
      // Past a light flash nothing more is drawn: the last frame is burnt
      // into the white and fading (clearOut), and the map underneath has the
      // chip. Where nothing burnt it (one pass, or the RV's night) it goes
      // on moving as it fades.
      // Sat, now and then a frame is timed on the chip (TRAILS_MS).
      if (L.peaked && lens && whiteOut) {
        /* the last frame stands */
      } else if (timer && !L.on && !timing && fade < 0.01 && drawn % 20 === 0) {
        timing = true;
        timer.measure(draw).then((ms) => {
          timing = false;
          if (ms == null) return;
          gpuMs.push(ms);
          if (gpuMs.length > 9) gpuMs.shift();
        });
      } else if (stats) {
        renderer.info.reset();
        const t0 = performance.now();
        draw();
        stats.ms = performance.now() - t0;
        stats.calls = renderer.info.render.calls;
        stats.triangles = renderer.info.render.triangles;
      } else draw();
      for (const c of casters) c.light.shadow.autoUpdate = c.want;
      if (!firstDrawn) {
        firstDrawn = true;
        cb.onFirstFrame?.();
      }
      // the 60 Hz rung on a faster screen (HEADROOM): decided sat, kept
      // through the launch
      if (!L.on) {
        const beat = loop.beat;
        // (the most beats a frame that still makes 60 or more: 2 at 120 Hz and
        // 144, 1 at 90 and 100; a hair over, for a beat read a little short)
        const rung = beat ? Math.max(1, Math.floor(1000 / 60 / beat + 0.1)) : 1;
        const want = gpuMs.length >= 3 && median(gpuMs) < HEADROOM * (beat ?? 1000 / 60) ? 1 : rung;
        if (loop.cadence !== want) loop.setCadence(want);
      }
    } else {
      renderer.clear();
    }

    // the black between vehicles, the flash, and the way out
    fade += (fadeTo - fade) * (1 - Math.exp(-dt * 9));
    let flash = 0;
    if (L.on) {
      flash = flashAt(L.plan, L.t);
      // (where the compositor can't fade them: clearOut)
      if (!onCompositor && (ph?.name === 'out' || ph?.name === 'done')) canvas.style.opacity = String(1 - smooth(ph.k * 1.25));
    }
    if (veil && !(L.peaked && onCompositor)) {
      if (flash > fade && v) {
        flashColor.set(v.flash ?? '#eaf3ff');
        setVeil(`#${flashColor.getHexString()}`, String(L.peaked ? flash : flash * 0.96));
      } else setVeil('#000', String(fade < 0.002 ? 0 : fade));
    }

    if (L.on && L.t >= L.plan.end) {
      if (!L.done) {
        L.done = true;
        cb.onDone?.();
      }
      return false;
    }
    return true;
  };
  // (one chain, however often it's kicked: lib/three/loop)
  const loop = createLoop(step, { can: () => !stopped && !failed });
  const kick = () => {
    if (stopped || failed) return;
    if (!loop.running) last = 0;
    loop.kick();
  };
  const onVis = () => (document.hidden ? sound?.pause?.() : (sound?.resume?.(), kick()));
  document.addEventListener('visibilitychange', onVis);

  // ── building a vehicle ──
  const dropVehicle = ({ kit = true } = {}) => {
    if (!v) return;
    sound?.stop();
    sound = null;
    inside.remove(v.inside);
    outside.remove(v.outside);
    sky?.dispose();
    sky = null;
    casters = [];
    v.dispose?.();
    disposeTree(v.inside);
    disposeTree(v.outside);
    if (inside.environment !== roomEnv) {
      inside.environment?.dispose?.();
      inside.environment = roomEnv;
    }
    if (kit) freeKit();
    v = null;
  };

  // A part of a vehicle that arrives after the vehicle is on screen (a model
  // still downloading when the rest was ready). Sat in the cockpit, it's
  // drawn once on the next frame with everything else (`warm`). During a
  // launch a frame can't be held for it: its pictures go to the graphics
  // chip now and its shaders link in the background, which is most of what
  // its first frame would have waited for.
  function added(root, where) {
    if (stopped || failed) return;
    if (!L.on) {
      late = true;
      kick();
      return;
    }
    const scene = where === 'inside' ? inside : outside;
    let o = root;
    while (o && o !== scene) o = o.parent;
    if (!o) return;
    uploadTextures(renderer, root);
    precompile(renderer, root, where === 'inside' ? camIn : camOut, scene, composer ? composer.readBuffer : null);
  }

  async function pick(id) {
    if (L.on || !BUILD[id]) return;
    if (id === vid && (v || building)) return;
    vid = id;
    const mine = (building = {});
    boarded = false;
    fadeTo = 1;
    kick();
    // let the black come down before the old one goes
    if (v) await new Promise((r) => setTimeout(r, reduced ? 0 : 220));
    if (building !== mine || stopped) return;
    dropVehicle();
    try {
      const mod = await BUILD[id]();
      if (building !== mine || stopped) return;
      const built = await mod.build({ renderer, pmrem, rich, level: row, reduced, coarse: coarse(), say: (line) => cb.onLine?.(line), added });
      if (building !== mine || stopped) {
        built.dispose?.();
        disposeTree(built.inside);
        disposeTree(built.outside);
        return;
      }
      v = built;
      building = null;
      inside.add(v.inside);
      outside.add(v.outside);
      if (v.environment) {
        inside.environment = v.environment;
        inside.environmentIntensity = v.envIntensity ?? 0.35;
      } else inside.environmentIntensity = v.envIntensity ?? 0.35;
      renderer.toneMapping = v.toneMapping ?? THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = v.exposure ?? 1;
      flashColor.set(v.flash ?? '#eaf3ff');
      whiteOut = flashColor.r + flashColor.g + flashColor.b > 1.5;
      lens?.set({ lift: 1 });
      if (bloom) {
        bloom.strength = base.bloom = v.bloom?.[0] ?? 0.55;
        bloom.radius = v.bloom?.[1] ?? 0.42;
        bloom.threshold = v.bloom?.[2] ?? 0.82;
      }
      rig.position.set(...v.eye);
      look.rest = [...(v.rest ?? [0, 0])];
      look.range = [...(v.range ?? [1, 0.4])];
      look.yaw = look.ty = look.rest[0];
      look.pitch = look.tp = look.rest[1];
      look.glance = v.glance ?? 0;
      look.sat = clock;
      L.plan = planOf(id);
      fit();
      // (not drawn till it's ready: `warming` holds the frames off it)
      warming = built;
      const current = () => building === null && !stopped && v === built;
      // the nebula worked out once, into a cube, behind the black (./bake.js)
      sky = await bakeSkies(renderer, outside, { size: row.sky, compile: (dome, eye, target) => precompile(renderer, dome, eye, outside, target) });
      if (!current()) {
        sky?.dispose();
        sky = null;
        return;
      }
      // the lights that throw shadows, drawn again at the vehicle's pace (SHADOWS)
      casters = [];
      for (const root of [inside, outside])
        root.traverse((o) => {
          if (o.isLight && o.castShadow && o.shadow) casters.push({ light: o, want: true });
        });
      // its pictures to the chip a slice at a time, behind the black, rather
      // than every one in the warm draw's single frame
      await uploadSlices(renderer, [...texturesUnder(inside), ...texturesUnder(outside)], { alive: current });
      if (!current()) return;
      // compile everything now, behind the black, so the first look doesn't
      // stall: the GPU links in the background while the frames hold off
      // drawing it (lib/three/renderer's precompile)
      const into = composer ? composer.readBuffer : null;
      await Promise.all([precompile(renderer, outside, camOut, outside, into), precompile(renderer, inside, camIn, inside, into), composer ? precompilePasses(renderer, composer, camIn) : null]);
      if (warming === built) warming = null;
      if (!current()) return;
      // still behind the black: draw it all once, then black again, and wait
      // for the chip to have finished it, so the first frames of the fade
      // in don't queue behind it
      late = false;
      warm();
      renderer.setRenderTarget(null);
      renderer.clear();
      await fence(renderer);
      if (!current()) return;
      sound = cockpitSound(id);
      fadeTo = 0;
      boarded = true;
      cb.onBoarded?.(id);
      kick();
    } catch (err) {
      if (building === mine) fail(err);
    }
  }

  fit();
  pick(opts.vehicle);

  // ── inputs from the overlay ──
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hit = (nx, ny) => {
    if (!v?.triggers?.length) return false;
    ndc.set(nx, -ny);
    ray.setFromCamera(ndc, camIn);
    return ray.intersectObjects(v.triggers, true).length > 0;
  };

  // (not before it's sat down: a launch of a vehicle still being readied would
  // go undrawn and unheard)
  function go() {
    if (L.on || !v || !boarded) return false;
    L.on = true;
    // (until the flash, what the page underneath makes waits: lib/foreground)
    launchHold = inFront('launch');
    // (a chip already busy sat here goes without the light trails: TRAILS_MS)
    if (gpuMs.length >= 3 && median(gpuMs) > TRAILS_MS) trailsOff = true;
    L.t = reduced ? skipTo(L.plan, 0) : 0;
    v.launch?.();
    sound?.launch?.(L.plan, L.t);
    cb.onPhase?.('launch');
    kick();
    return true;
  }

  function teardown() {
    loop.stop();
    launchHold?.();
    launchHold = null;
    front();
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVis);
    sound?.stop();
    sound = null;
    // (the kit's painted pictures now: they're the module's, and a cockpit
    // opened again before the quiet moment below has its own among them)
    freeKit();
    // the rest in a quiet moment: freeing every mesh, material and picture
    // one by one takes frames' worth of time, and the launch's end is the
    // first moment the visitor flies the map
    const free = () => {
      dropVehicle({ kit: false });
      roomEnv.dispose();
      pmrem.dispose();
      composer?.dispose();
      lens?.dispose();
      gl.dispose();
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(free, { timeout: 1500 });
    else setTimeout(free, 200);
  }

  return {
    pick,
    go,
    // on to just before the flash; false where there's nothing to skip on
    // to yet (not sat down)
    skip() {
      if (!L.on) {
        if (!go()) return false;
      }
      const to = skipTo(L.plan, L.t);
      if (to > L.t) {
        sound?.skip?.(L.plan, to);
        L.t = to;
      }
      return true;
    },
    get launching() {
      return L.on;
    },
    // (development: what the renderer holds and what the last frame drew;
    // a count that grows during a launch is something made or linked late)
    info() {
      if (!import.meta.env.DEV) return null;
      return { t: L.t, programs: renderer.info.programs?.length ?? 0, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, ...stats };
    },
    // (development: jump to a moment of the launch, for screenshots)
    seek(ms) {
      if (!import.meta.env.DEV) return;
      if (!L.on) go();
      L.t = ms;
      L.hold = true;
    },
    // a mouse over the cockpit: where it points, -1…1 each way
    point(nx, ny) {
      look.own = true;
      look.ty = look.rest[0] - nx * look.range[0] * 0.9;
      look.tp = look.rest[1] - ny * look.range[1] * 0.9;
      clampLook();
      return hit(nx, ny);
    },
    // a finger dragging: by how much (pixels)
    drag(dx, dy) {
      look.own = true;
      const k = 2.4 / Math.max(size.w, size.h);
      look.ty += dx * k;
      look.tp += dy * k;
      clampLook();
    },
    // the arrow keys
    nudge(dx, dy) {
      look.own = true;
      look.ty -= dx * 0.18;
      look.tp -= dy * 0.12;
      clampLook();
    },
    centre() {
      look.ty = look.rest[0];
      look.tp = look.rest[1];
    },
    // a click or tap: launches if it was on the vehicle's lever (or wheel)
    press(nx, ny) {
      return hit(nx, ny) ? go() : false;
    },
    stop() {
      if (stopped) return L.done;
      stopped = true;
      teardown();
      return L.done;
    },
  };
}
