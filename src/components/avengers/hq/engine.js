// The renderer every HQ game draws with: physically based lighting from a
// Poly Haven sky (an HDR for light, a photo for what you see), a sun that casts
// soft shadows, tone mapping, bloom for the things that glow, and a watchdog
// that trades quality for frame rate before giving up on 3D. Loaded only with
// a game's scene, so nobody without 3D downloads three.js.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { loadSky } from './assets';
import { device } from '../../../lib/device';
import { fitRatio, maxSide, precompile as compileFor, precompilePasses, quiet, releaseContext } from '../../../lib/three/renderer';

// What a device can afford. Phones and small GPUs start lower; the watchdog
// steps down from there when frames run long. `pixels` caps a frame all told,
// so a screen as wide as three doesn't draw three screens' worth.
const TIERS = {
  high: { dpr: 1.75, shadow: 2048, bloom: 1, samples: 4, small: false, pixels: 12e6 },
  medium: { dpr: 1.35, shadow: 1024, bloom: 0.5, samples: 4, small: true, pixels: 8e6 },
  low: { dpr: 1, shadow: 1024, bloom: 0, samples: 0, small: true, pixels: 6e6 },
};
const ORDER = ['high', 'medium', 'low'];

// (lib/device decides, the same way for every scene on the site)
export function startTier() {
  if (typeof window === 'undefined') return 'high';
  return { high: 'high', mid: 'medium', low: 'low' }[device().tier] ?? 'medium';
}

// Colours above 1 for things that glow, so bloom picks them up.
export const hot = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

export function createEngine(canvas, opts = {}) {
  const {
    exposure = 1,
    toneMapping = THREE.NeutralToneMapping,
    bloom = { strength: 0.55, radius: 0.5, threshold: 0.92 },
    fov = 60,
    near = 0.05,
    far = 600,
    onLost,
    onSlow,
  } = opts;
  let tierName = opts.tier ?? startTier();
  let tier = TIERS[tierName];

  const renderer = quiet(new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, failIfMajorPerformanceCaveat: false }));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = toneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.info.autoReset = false; // count a whole frame: shadows, scene and every pass
  renderer.setPixelRatio(Math.min(tier.dpr, window.devicePixelRatio || 1));
  const side = maxSide(renderer);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 16 / 9, near, far);
  let view = camera; // a game can swap in its own camera

  // light: the sky (image-based), a sun with shadows, and a soft fill
  const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x3a3226, 0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(tier.shadow, tier.shadow);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // the composer renders into a multisampled half-float target (anti-aliased,
  // with room for highlights above 1), then bloom, then tone mapping
  const target = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: tier.samples });
  const composer = new EffectComposer(renderer, target);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const bloomPass = bloom ? new UnrealBloomPass(new THREE.Vector2(256, 256), bloom.strength, bloom.radius, bloom.threshold) : null;
  if (bloomPass) composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  let size = { w: 1, h: 1 };
  const resize = (w, h) => {
    size = { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
    // the screen's ratio, under the tier's, and inside what the chip can hold
    const ratio = fitRatio(size.w, size.h, Math.min(tier.dpr, window.devicePixelRatio || 1), { side, pixels: tier.pixels });
    renderer.setPixelRatio(ratio);
    renderer.setSize(size.w, size.h, false);
    composer.setPixelRatio(ratio);
    composer.setSize(size.w, size.h);
    if (bloomPass) {
      bloomPass.enabled = tier.bloom > 0;
      bloomPass.resolution.set((size.w * ratio * tier.bloom) / 2 || 1, (size.h * ratio * tier.bloom) / 2 || 1);
    }
    for (const cam of new Set([camera, view])) {
      if (cam.isPerspectiveCamera) {
        cam.aspect = size.w / size.h;
        cam.updateProjectionMatrix();
      }
    }
  };

  const setTier = (name) => {
    tierName = name;
    tier = TIERS[name];
    target.samples = tier.samples;
    sun.shadow.mapSize.set(tier.shadow, tier.shadow);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
    resize(size.w, size.h);
  };

  // The GPU can go away (a driver reset, too many tabs): say so.
  let lost = false;
  const onContextLost = (e) => {
    e.preventDefault();
    lost = true;
    onLost?.();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  // Slow frames: step the tier down, then tell the game.
  const perf = { acc: 0, n: 0, grace: 90 };
  const watch = (ms) => {
    if (perf.grace > 0) {
      perf.grace--;
      return;
    }
    perf.acc += ms;
    perf.n++;
    if (perf.n < 120) return;
    const avg = perf.acc / perf.n;
    perf.acc = 0;
    perf.n = 0;
    if (avg < 22) return;
    const next = ORDER[ORDER.indexOf(tierName) + 1];
    if (next) {
      setTier(next);
      perf.grace = 60;
    } else if (avg > 34) onSlow?.();
  };

  // Light the scene from a sky. `sun` scales the key light (the sky's own sun
  // direction and colour, if it has one); `fill` the hemisphere fill.
  let skyAssets = null;
  const pmrem = new THREE.PMREMGenerator(renderer);
  async function setSky(name, { background = true, envIntensity = 1, bgIntensity = 1, sunIntensity = 2.5, sunColor, sunDir, fill = 0.15, fog, blur = 0, rotate = 0 } = {}) {
    const sky = await loadSky(name, { background });
    if (lost) return sky;
    skyAssets?.env?.dispose();
    const env = pmrem.fromEquirectangular(sky.hdr).texture;
    skyAssets = { env };
    scene.environment = env;
    scene.environmentIntensity = envIntensity;
    scene.environmentRotation.y = rotate;
    scene.backgroundRotation.y = rotate;
    if (background && sky.background) {
      scene.background = sky.background;
      scene.backgroundIntensity = bgIntensity;
      scene.backgroundBlurriness = blur;
    }
    const meta = sky.meta;
    const dir = sunDir ?? meta.sun?.dir ?? [0.4, 0.8, 0.3];
    const d = new THREE.Vector3(...dir).normalize();
    // the sky's rotation turns its sun with it
    d.applyAxisAngle(new THREE.Vector3(0, 1, 0), -rotate);
    sun.userData.dir = d;
    sun.color.setRGB(...(sunColor ?? meta.sun?.color ?? [1, 0.97, 0.92]));
    sun.intensity = sunIntensity;
    hemi.intensity = fill;
    if (fog) {
      const h = meta.horizon ?? [0.5, 0.5, 0.5];
      const c = fog.color ? new THREE.Color(fog.color) : new THREE.Color(h[0], h[1], h[2]).multiplyScalar(fog.tint ?? 0.85);
      scene.fog = fog.density ? new THREE.FogExp2(c, fog.density) : new THREE.Fog(c, fog.near ?? 30, fog.far ?? 220);
    }
    return sky;
  }

  // Fit the sun's shadow to a box around what matters (centre, half size).
  const setShadowBox = (center, half, depth = 60) => {
    const d = sun.userData.dir ?? new THREE.Vector3(0.4, 0.8, 0.3);
    sun.target.position.copy(center);
    sun.position.copy(center).addScaledVector(d, depth / 2);
    const cam = sun.shadow.camera;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.near = 0.5;
    cam.far = depth + half;
    cam.updateProjectionMatrix();
    sun.target.updateMatrixWorld();
  };

  const setCamera = (cam) => {
    view = cam;
    renderPass.camera = cam;
    resize(size.w, size.h);
  };

  let last = performance.now();
  let long = false; // the last gap was long
  const render = () => {
    if (lost) return;
    const now = performance.now();
    const ms = now - last;
    last = now;
    renderer.info.reset();
    composer.render();
    // One long gap is the loop coming back (the game was scrolled away, or the
    // tab hidden), not a slow frame; long gaps in a row are a device that
    // can't keep up.
    const resumed = ms > 250 && !long;
    long = ms > 250;
    if (!resumed) watch(ms);
  };
  // a frame without timing it (screenshots, the first frame)
  const renderOnce = () => {
    if (lost) return;
    renderer.info.reset();
    composer.render();
  };

  // where a world point is on screen, in CSS pixels (and whether it's in front)
  const tmp = new THREE.Vector3();
  const project = (v) => {
    tmp.copy(v).project(view);
    return { x: ((tmp.x + 1) / 2) * size.w, y: ((1 - tmp.y) / 2) * size.h, front: tmp.z < 1 };
  };

  const info = () => {
    const i = renderer.info;
    return {
      tier: tierName,
      calls: i.render.calls,
      triangles: i.render.triangles,
      geometries: i.memory.geometries,
      textures: i.memory.textures,
      dpr: renderer.getPixelRatio(),
      size,
    };
  };

  const disposeObject = (root) => {
    root.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) m.dispose?.();
    });
  };

  const dispose = () => {
    canvas.removeEventListener('webglcontextlost', onContextLost);
    disposeObject(scene);
    skyAssets?.env?.dispose();
    pmrem.dispose();
    composer.dispose?.();
    target.dispose();
    renderer.dispose();
    // the context goes back once nothing is compiling (lib/three/renderer):
    // let go at once, it would wait for the next game's shaders, mid-scroll
    releaseContext(renderer);
  };

  // Every shader the game draws with (and the passes'), linked in the
  // background (lib/three/renderer's precompile): the page's hosts
  // (hq/useStage) wait for this before a game's first frame. `root`, already
  // in the scene, for something built later.
  let passesDone = false;
  const precompile = (root = scene) => {
    if (lost) return Promise.resolve();
    const jobs = [compileFor(renderer, root, view, scene, composer.readBuffer)];
    if (!passesDone) {
      passesDone = true;
      jobs.push(precompilePasses(renderer, composer, view));
    }
    return Promise.all(jobs);
  };

  return {
    THREE,
    renderer,
    scene,
    camera,
    sun,
    hemi,
    bloom: bloomPass,
    setSky,
    setShadowBox,
    setCamera,
    resize,
    render,
    renderOnce,
    project,
    info,
    dispose,
    precompile,
    get size() {
      return size;
    },
    get lost() {
      return lost;
    },
    get tier() {
      return tierName;
    },
    get small() {
      return tier.small;
    },
  };
}
