// ../stage.js on the node renderer: a Middle-earth stage with the same face
// (renderer, scene, camera, composer, prepare, bloomPass, grade, resize,
// scale, render, dispose, precompile, setLevel, tune, size, lost, disposed,
// quality, shadows), a view of the runtime's canvas as before
// (runtime/views.js), so a scene file changes only the file it imports it
// from. What differs, the node renderer's way:
//
// - The chain is the runtime's node chain (rt.gfx.post: lib/three/light/
//   passes.js): the scene pass (multisampled as the renderer is), bloom,
//   then the `grade` pass, GRADE in TSL after the tone map and the sRGB
//   encoding the classic chain's OutputPass did (lib/three/stage3dNodes's
//   gradeNode). `composer` is that chain; `bloomPass` its bloom's numbers.
// - The chain sizes itself from the view's buffer when it draws (the scene
//   pass reads the renderer's drawing-buffer size, which the view says), so
//   the stage's sharpness (`scale`) is the view's ratio, the canvas's and
//   the buffers' at once.
// - The bloom's rung builds the chain again without it (the node chain is
//   built once, its passes fixed).
// - The shaders are compiled and the pictures uploaded by the runtime's
//   own (gfx.compile, gfx.upload): lib/three/gpuWork's slices are the
//   classic renderer's.
// - No frame guard: the node renderer compiles asynchronously and draws
//   what's ready.

import * as THREE from 'three';
import { budget } from '../../../lib/device';
import { BLOOM } from '../../../lib/three/bloom';
import { LOOK } from '../../../lib/three/houseNodes';
import { disposeTree, gradeNode, gradeUniforms, stageRatio, stageSizing, stageTune } from '../../../lib/three/stage3dNodes';
import { engineNow } from '../module';

export { canvasTexture, disposeTree, hot } from '../../../lib/three/stage3dNodes';

// the ladder lib/stage3d's watchdog climbed, a rung a quality level
export const LADDER = ['full', 'ratio', 'shadows', 'bloom', 'low'];

export function createStage(canvas, { soft = false, bloom = BLOOM, exposure = LOOK.exposure, shadows = false, fov = 60, near = 0.1, far = 600, onLost } = {}) {
  const world = engineNow();
  if (!world) throw new Error('a Middle-earth stage needs its world up (../module.js)');
  const fit = budget();
  const renderer = world.renderer;
  const gfx = world.rt.gfx;
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
      shadows: {
        enabled: shadows && !soft && fit.shadows,
        type: THREE.PCFShadowMap,
      },
      clear: { color: new THREE.Color(0x000000), alpha: 1 },
      infoReset: true,
    },
  });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 16 / 9, near, far);

  // the scene, then bloom, then the tone map and the grade: the node chain
  const u = gradeUniforms();
  const bloomPass = {
    strength: bloom.strength,
    radius: bloom.radius,
    threshold: bloom.threshold,
  };
  let useBloom = !soft;
  let level = soft ? LADDER.indexOf('bloom') : 0;
  let post = null;
  const build = () => {
    post?.dispose();
    post = soft
      ? null
      : gfx.post([
          { kind: 'render', scene, camera },
          {
            kind: 'bloom',
            strength: bloomPass.strength,
            radius: bloomPass.radius,
            threshold: bloomPass.threshold,
            enabled: useBloom,
          },
          { kind: 'grade', node: gradeNode(u) },
          { kind: 'output' },
        ]);
  };
  build();
  const grade = (o = {}) => {
    if (o.contrast != null) u.uContrast.value = o.contrast;
    if (o.saturation != null) u.uSat.value = o.saturation;
    if (o.vignette != null) u.uVignette.value = o.vignette;
    if (o.grain != null) u.uGrain.value = o.grain;
    if (o.shadow) u.uShadow.value.setRGB(...o.shadow);
    if (o.high) u.uHigh.value.setRGB(...o.high);
  };

  // (the view's buffer is the chain's: its sharpness is the view's ratio)
  const sizing = stageSizing({
    ratio: full,
    soft: true,
    canvas: (w, h, pr) => {
      view.resize(w, h);
      view.setRatio(pr);
    },
    buffers: () => {},
  });
  const resize = (w, h) => {
    sizing.resize(w, h);
    const { w: sw, h: sh } = sizing.size;
    u.uAspect.value = sw / sh;
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
      build();
    }
    if (level >= LADDER.indexOf('low') && sizing.ratio > 0.75) sizing.setRatio(0.75);
  };
  if (soft || !fit.bloom) setLevel('bloom');

  let warming = 0;
  let drawn = false;
  let disposed = false;
  // (what the view draws: the canvas's corner, its renderer state on)
  const frame = () => {
    if (post) post.render();
    else renderer.render(scene, camera);
  };
  const draw = () => {
    sizing.fit();
    view.draw(frame);
    drawn = true;
  };
  const render = (ms = 16) => {
    if (lost || disposed || warming) return;
    u.uTime.value += ms / 1000;
    draw();
  };

  const tuning = stageTune({
    bloomPass,
    title: () => canvas.closest?.('[data-route]')?.dataset.route || (typeof document !== 'undefined' ? document.title : null),
  });

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
    tuning.close();
    view.dispose();
    disposeTree(scene);
    if (scene.environment?.isTexture) scene.environment.dispose();
    if (scene.background?.isTexture) scene.background.dispose();
    post?.dispose();
  };

  // the shaders and the chain, compiled by the runtime's renderer
  const compile = async (root = scene) => {
    world.views.enter(canvas);
    gfx.upload?.(root);
    await Promise.all([gfx.compile?.(root, camera, scene), post?.ready, post?.compile?.()]);
  };
  const precompile = (root = scene) => {
    if (lost || disposed) return Promise.resolve();
    if (!drawn) sizing.fit();
    warming += 1;
    return compile(root).then(() => {
      warming -= 1;
    });
  };
  const prepare = async (onProgress, { alive = () => true } = {}) => {
    const on = () => alive() && !lost && !disposed;
    if (!drawn) sizing.fit();
    onProgress?.(0, 'pictures');
    await compile(scene);
    if (!on()) return;
    onProgress?.(0.9, 'first draw');
    // its first frame: onto the stage's own canvas, as ../stage.js drew it
    sizing.fit();
    view.drawNow(frame);
    drawn = true;
    onProgress?.(1, 'first draw');
  };

  return {
    renderer,
    scene,
    camera,
    get composer() {
      return post;
    },
    view,
    prepare,
    bloomPass,
    grade,
    resize,
    scale: (k) => sizing.scale(k),
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
