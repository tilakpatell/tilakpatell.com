// A Middle-earth stage on the runtime's renderer: lib/stage3d's createStage,
// its face kept whole (renderer, scene, camera, composer, prepare,
// bloomPass, grade, resize, scale, render, dispose, precompile, setLevel,
// tune, size, lost, disposed, quality, shadows), so a scene file changes
// only where it imports it from. What changed under that face:
//
// - The renderer is the runtime's (./module.js's world), shared with every
//   other picture on the page; the stage is a view of its canvas
//   (runtime/views.js) on the stage's own <canvas>, with the stage's own
//   renderer state (Neutral at its exposure, sRGB, its shadows, black and
//   opaque behind, as its own context was).
// - The drawing buffer is the view's corner of the runtime's canvas: a new
//   size or sharpness resizes the view and the composer's buffers, never a
//   canvas (stageSizing, as before, makes them at the next frame drawn).
// - No watchdog: the runtime's governor lowers it (lowerQuality, through the
//   world) by the same ladder, sharpness, shadows, bloom, sharpness again.
// - No lost-context listener: the runtime has the context; a loss disposes
//   the world, which calls the stage's onLost, as the context's event did.
// - The frame guard is the runtime renderer's; the composer's buffers are
//   named to it as frames (frameGuard's frames()).
// - prepare()'s first draw is the view's drawNow: onto the stage's own
//   canvas, and the lead drawn again at once, so the shared canvas never
//   shows it outside a frame.

import * as THREE from 'three';
import { budget } from '../../lib/device';
import { guardOf } from '../../lib/three/frameGuard';
import { prepareScene, warmDraw } from '../../lib/three/gpuWork';
import { precompile as compileFor, precompilePasses } from '../../lib/three/renderer';
import { BLOOM } from '../../lib/three/bloom';
import { LOOK } from '../../lib/three/house';
import { GRADE, disposeTree, stageRatio, stageSizing, stageTune } from '../../lib/stage3d';
import { engineNow } from './module';

export { canvasTexture, disposeTree, hot } from '../../lib/stage3d';

// the ladder lib/stage3d's watchdog climbed, a rung a quality level
export const LADDER = ['full', 'ratio', 'shadows', 'bloom', 'low'];

export function createStage(canvas, { soft = false, bloom = BLOOM, exposure = LOOK.exposure, shadows = false, fov = 60, near = 0.1, far = 600, onLost } = {}) {
  const world = engineNow();
  if (!world) throw new Error('a Middle-earth stage needs its world up (./module.js)');
  const fit = budget();
  const renderer = world.renderer;
  const full = stageRatio({ soft });
  const view = world.views.add(canvas, {
    ratio: full,
    // (its own canvas had no alpha)
    opaque: true,
    state: {
      toneMapping: THREE.NeutralToneMapping,
      toneMappingExposure: exposure,
      outputColorSpace: THREE.SRGBColorSpace,
      autoClear: true,
      autoClearColor: true,
      autoClearDepth: true,
      autoClearStencil: true,
      sortObjects: true,
      localClippingEnabled: false,
      shadows: { enabled: shadows && !soft && fit.shadows, type: THREE.PCFShadowMap },
      // (its own context had no alpha: what nothing covers is black)
      clear: { color: new THREE.Color(0x000000), alpha: 1 },
      infoReset: true,
    },
  });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 16 / 9, near, far);

  // the scene renders into a multisampled half-float target, then bloom,
  // then the tone map, then the grade: lib/stage3d's chain, built by the
  // runtime (rt.gfx.post), its buffers multisampled as lib/stage3d's were
  const post = world.rt.gfx.post([{ kind: 'render', scene, camera }, { kind: 'bloom', strength: bloom.strength, radius: bloom.radius, threshold: bloom.threshold }, { kind: 'output' }, { kind: 'shader', material: GRADE }]);
  const { composer } = post;
  const [, bloomPass, , gradePass] = post.passes;
  for (const t of [composer.renderTarget1, composer.renderTarget2]) {
    t.samples = soft ? 0 : fit.samples;
    t.dispose();
  }
  const unguard = guardOf(renderer)?.frames?.((t) => t === composer.renderTarget1 || t === composer.renderTarget2) ?? (() => {});
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

  const sizing = stageSizing({
    ratio: full,
    soft,
    // (the view's corner, at its ratio: the canvas is the runtime's)
    canvas: (w, h, pr) => {
      view.resize(w, h);
      view.setRatio(pr);
    },
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

  let lost = false;
  const setLevel = (name) => {
    const rung = typeof name === 'number' ? LADDER[Math.max(0, Math.min(LADDER.length - 1, name))] : name;
    level = Math.max(level, LADDER.indexOf(rung));
    if (level >= LADDER.indexOf('ratio') && sizing.ratio > 1) sizing.setRatio(1);
    if (level >= LADDER.indexOf('shadows')) {
      world.views.enter(canvas);
      if (renderer.shadowMap.enabled) {
        renderer.shadowMap.enabled = false;
        scene.traverse((o) => {
          if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true));
        });
      }
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

  let warming = 0;
  let passesDone = false;
  let drawn = false;
  let disposed = false;
  // (what the view draws: the canvas's corner, its renderer state on; kept
  // as the view's last frame, drawn again unchanged when it must be)
  const frame = () => {
    if (soft) renderer.render(scene, camera);
    else composer.render();
  };
  const draw = () => {
    sizing.fit();
    view.draw(frame);
    drawn = true;
  };
  const render = (ms = 16) => {
    if (lost || disposed || warming) return;
    gradePass.uniforms.uTime.value += ms / 1000;
    if (!drawn) warmDraw(renderer, draw, [scene]);
    draw();
  };

  const tuning = stageTune({ bloomPass, title: () => canvas.closest?.('[data-route]')?.dataset.route || (typeof document !== 'undefined' ? document.title : null) });

  const off = world.stage({
    setLevel: (l) => setLevel(l),
    lose: () => {
      lost = true;
      onLost?.();
    },
    dispose: () => dispose(),
  });
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    off();
    unguard();
    tuning.close();
    view.dispose();
    disposeTree(scene);
    if (scene.environment?.isTexture) scene.environment.dispose();
    if (scene.background?.isTexture) scene.background.dispose();
    composer.dispose?.();
    bloomPass.dispose?.();
    gradePass.dispose?.();
  };

  const precompile = (root = scene) => {
    if (lost || disposed) return Promise.resolve();
    if (!drawn) sizing.fit();
    world.views.enter(canvas);
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

  // prepareScene's first draw: the frame, onto the stage's own canvas, as
  // lib/stage3d's drew it there (a town loaded but not yet going showed it)
  const warm = () => {
    sizing.fit();
    view.drawNow(frame);
    drawn = true;
  };
  const prepare = async (onProgress, { alive = () => true } = {}) => {
    const on = () => alive() && !lost && !disposed;
    if (!drawn) sizing.fit();
    world.views.enter(canvas);
    if (!soft && !passesDone) {
      passesDone = true;
      await precompilePasses(renderer, composer, camera);
    }
    if (!on()) return;
    world.views.enter(canvas);
    await prepareScene({ renderer, roots: [scene], scene, camera, target: soft ? null : composer.readBuffer, render: warm, onProgress, alive: on });
  };

  return {
    renderer,
    scene,
    camera,
    composer,
    view,
    prepare,
    bloomPass,
    grade,
    resize,
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
    // (its own state's: the renderer is the runtime's)
    get shadows() {
      world.views.enter(canvas);
      return renderer.shadowMap.enabled;
    },
  };
}
