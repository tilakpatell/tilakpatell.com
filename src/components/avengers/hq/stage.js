// What every HQ game draws with, on the runtime’s renderer (src/runtime):
// physically based lighting from a Poly Haven sky (an HDR for light, a photo
// for what you see), a sun that casts soft shadows, tone mapping, and bloom
// for the things that glow, through the runtime’s post chain (rt.gfx.post).
// It was hq/engine.js, which made a renderer, a loop and a watchdog of its
// own for each game; the renderer and the loop are the runtime’s now, and
// the watchdog its governor, whose levels step this stage down the tiers
// (./tiers.js) through lowerQuality. Loaded only with a game’s scene, so
// nobody without 3D downloads three.js.
//
// createStage(rt, { exposure, toneMapping, bloom, fov, near, far, tier })
//   → the face hq/engine’s createEngine had (renderer, scene, camera, sun,
//   hemi, bloom, setSky, setShadowBox, setCamera, resize, render,
//   renderOnce, project, info, dispose, precompile, prepare, tune, size,
//   lost, tier, small), and lowerQuality(level), tuneGroups()
//
// The renderer is shared, so the stage keeps what it sets on it (the tone
// mapping and exposure the house look leaves, the shadows, the clear, the
// frame’s info counting) in `state`: put on at its first compile or frame,
// not as it’s made (a world made at a handover is made while another draws),
// and given back as it was when it’s let go.

import * as THREE from 'three';
import { loadSky } from './assets';
import { houseOn } from '../../../lib/three/house';
import { prepareScene } from '../../../lib/three/gpuWork';
import { stageBloomGroups } from '../../../lib/stage3d';
import { LOOK } from './look';
import { houseGroups } from '../../../lib/three/houseTuning';
import { precompile as compileFor, precompilePasses } from '../../../lib/three/renderer';
import { TIERS, startTier, tierAt } from './tiers';

export { tierOfDetail, startTier } from './tiers';

// Colours above 1 for things that glow, so bloom picks them up.
export const hot = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

export function createStage(rt, opts = {}) {
  const { exposure = 1, toneMapping = THREE.NeutralToneMapping, bloom = LOOK.bloom, fov = 60, near = 0.05, far = 600, onSlow } = opts;
  const startName = opts.tier ?? startTier();
  let tierName = startName;
  let tier = TIERS[tierName];
  const { renderer } = rt.gfx;
  const canvas = rt.gfx.canvas;

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

  // What this stage sets on the shared renderer. The house look
  // (lib/three/house) sets its tone mapping and exposure on the renderer as
  // it's put on: read back here and the renderer's own put back, until the
  // stage first draws.
  const own = { toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure };
  renderer.toneMapping = toneMapping;
  renderer.toneMappingExposure = exposure;
  // the house look: the shade one colour, from the sky's own light (each
  // game's HDR sky, measured when it's set), on everything a game puts in
  // the scene (taken on now and then); a game's Neutral exposure is kept,
  // an ACES one lifted
  const envRef = { texture: null, intensity: () => scene.environmentIntensity };
  const house = houseOn({ renderer, scene, sun, env: envRef, keepExposure: toneMapping === THREE.NeutralToneMapping });
  const state = {
    toneMapping: renderer.toneMapping,
    exposure: renderer.toneMappingExposure,
    shadows: true,
    shadowType: THREE.PCFShadowMap,
    clear: 0x000000,
    clearAlpha: 1, // (opaque, as the stage's own renderer cleared)
    autoReset: false, // count a whole frame: shadows, scene and every pass
  };
  renderer.toneMapping = own.toneMapping;
  renderer.toneMappingExposure = own.exposure;
  let held = null; // the renderer's own, while the stage's is on
  const clearColor = new THREE.Color();
  const hold = () => {
    if (held) return;
    renderer.getClearColor(clearColor);
    held = {
      toneMapping: renderer.toneMapping,
      exposure: renderer.toneMappingExposure,
      shadows: renderer.shadowMap.enabled,
      shadowType: renderer.shadowMap.type,
      clear: clearColor.getHex(),
      clearAlpha: renderer.getClearAlpha(),
      autoReset: renderer.info.autoReset,
    };
    renderer.toneMapping = state.toneMapping;
    renderer.toneMappingExposure = state.exposure;
    renderer.shadowMap.enabled = state.shadows;
    renderer.shadowMap.type = state.shadowType;
    renderer.setClearColor(state.clear, state.clearAlpha);
    renderer.info.autoReset = state.autoReset;
  };
  const giveBack = () => {
    if (!held) return;
    // (the exposure a ?debug panel moved is the stage's, kept for its next turn)
    state.exposure = renderer.toneMappingExposure;
    renderer.toneMapping = held.toneMapping;
    renderer.toneMappingExposure = held.exposure;
    renderer.shadowMap.enabled = held.shadows;
    renderer.shadowMap.type = held.shadowType;
    renderer.setClearColor(held.clear, held.clearAlpha);
    renderer.info.autoReset = held.autoReset;
    held = null;
  };
  let houseFrames = 0;

  // The runtime's chain: the scene into a multisampled half-float target
  // (anti-aliased, with room for highlights above 1), then bloom, then tone
  // mapping. The chain's composer is the classic backend's EffectComposer;
  // its targets take the tier's samples before they're first made.
  const post = rt.gfx.post([{ kind: 'render', scene, camera }, ...(bloom ? [{ kind: 'bloom', strength: bloom.strength, radius: bloom.radius, threshold: bloom.threshold }] : []), { kind: 'output' }]);
  const { composer } = post;
  const renderPass = post.passes[0];
  const bloomPass = bloom ? post.passes[1] : null;
  const output = post.passes.at(-1);
  const sampled = (n) => {
    for (const t of [composer.renderTarget1, composer.renderTarget2]) {
      if (t.samples === n) continue;
      t.samples = n;
      t.dispose(); // (made again at the next draw, with the new count)
    }
  };
  sampled(tier.samples);
  // `knee`: how far past the threshold the glow takes to come in fully. The
  // pass's own 0.01 is a switch: a big surface lit to just about the
  // threshold (a white wall in the sun) glowed whole or not at all as the
  // view turned, a box of light popping on and off.
  if (bloomPass) bloomPass.highPassUniforms.smoothWidth.value = bloom.knee ?? 0.01;
  // The canvas opaque, whatever alpha the frame ends with. Where a pass
  // wrote less than 1 (the trees' alpha-to-coverage edges, and on some
  // Windows drivers whole trees) the page behind showed through: its
  // painted sky, and a flat green ground over the bottom of the screen.
  output.material.fragmentShader = output.material.fragmentShader.replace(/}\s*$/, '  gl_FragColor.a = 1.0;\n}');
  output.material.needsUpdate = true;

  let size = { w: 1, h: 1 };
  let fitted = '';
  let canvasRatio = 0; // the canvas's, as the chain was last fitted to it
  // The chain draws at the canvas's sharpness, which is the runtime's (from
  // the tier's at the start, the module's `ratio`, softened by the
  // governor), so the frame guard knows its buffers for the frame's
  // (lib/three/frameGuard: a buffer the canvas's size)
  const resize = (w, h) => {
    size = { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
    canvasRatio = renderer.getPixelRatio();
    const ratio = canvasRatio;
    const key = `${size.w}x${size.h}@${ratio}:${tierName}`;
    if (key === fitted) return;
    fitted = key;
    composer.setPixelRatio(ratio);
    post.setSize(size.w, size.h);
    if (bloomPass) bloomPass.enabled = tier.bloom > 0;
    for (const cam of new Set([camera, view])) {
      if (cam.isPerspectiveCamera) {
        cam.aspect = size.w / size.h;
        cam.updateProjectionMatrix();
      }
    }
  };

  const setTier = (name) => {
    if (name === tierName) return;
    tierName = name;
    tier = TIERS[name];
    sampled(tier.samples);
    sun.shadow.mapSize.set(tier.shadow, tier.shadow);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
    fitted = '';
    resize(size.w, size.h);
  };
  // The governor's level (the runtime's, src/runtime/quality.js): a tier
  // down a level, from the one it started on; past the pace's last step
  // the game is told, as the watchdog told it (onSlow). Taken at the start
  // of the next frame, not now: it resizes the chain's buffers, and the
  // runtime calls this just before a draw anyway.
  let told = false;
  const lowerQuality = (level) => {
    const at = tierAt(startName, level);
    setTier(at.tier);
    if (at.slow && !told) {
      told = true;
      onSlow?.();
    }
  };

  // Light the scene from a sky. `sun` scales the key light (the sky's own sun
  // direction and colour, if it has one); `fill` the hemisphere fill.
  let skyAssets = null;
  const pmrem = new THREE.PMREMGenerator(renderer);
  let gone = false;
  async function setSky(name, { background = true, envIntensity = 1, bgIntensity = 1, sunIntensity = 2.5, sunColor, sunDir, fill = 0.15, fog, blur = 0, rotate = 0 } = {}) {
    const sky = await loadSky(name, { background });
    if (gone || rt.gfx?.lost) return sky;
    skyAssets?.env?.dispose();
    const env = pmrem.fromEquirectangular(sky.hdr).texture;
    skyAssets = { env };
    scene.environment = env;
    envRef.texture = sky.hdr;
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
    fitted = ''; // (the new camera's aspect)
    resize(size.w, size.h);
  };

  const lost = () => Boolean(rt.gfx?.lost) || gone;
  // a frame: the game's page calls it from its frame (the runtime's loop)
  // (the canvas's sharpness moved by the runtime since, a visitor's
  // sharpness or quality picked while it's up: the chain fitted to it again)
  const refit = () => {
    if (renderer.getPixelRatio() !== canvasRatio) resize(size.w, size.h);
  };
  const render = () => {
    if (lost()) return;
    hold();
    refit();
    house.follow({ adopt: houseFrames++ % 30 === 0 });
    renderer.info.reset();
    post.render();
  };
  // a frame without the house's follow (screenshots, the first frame)
  const renderOnce = () => {
    if (lost()) return;
    hold();
    refit();
    renderer.info.reset();
    post.render();
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
      dpr: composer._pixelRatio ?? renderer.getPixelRatio(),
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

  // ?debug: the one panel (the runtime's, src/runtime/debug.js, under the
  // module's id), the bloom first, then the house look and its exposure,
  // then the game's numbers (tune(groups), from its scene)
  let gameGroups = [];
  const tune = (groups = []) => {
    gameGroups = groups;
  };
  const tuneGroups = () => {
    const exposureGroup = {
      get: () => (held ? renderer.toneMappingExposure : state.exposure),
      set: (v) => {
        state.exposure = v;
        if (held) renderer.toneMappingExposure = v;
      },
    };
    return [...(bloomPass ? stageBloomGroups(bloomPass) : []), ...houseGroups(house, { exposure: exposureGroup }), ...gameGroups];
  };

  const dispose = () => {
    if (gone) return;
    gone = true;
    giveBack();
    disposeObject(scene);
    skyAssets?.env?.dispose();
    pmrem.dispose();
    post.dispose();
    composer.renderTarget1.dispose();
    composer.renderTarget2.dispose();
    sun.shadow.map?.dispose();
  };

  // Every shader the game draws with (and the passes'), linked in the
  // background (lib/three/renderer's precompile): the page's hosts
  // (hq/useStage, through the module's prepare) wait for this before a
  // game's first frame. `root`, already in the scene, for something built
  // later.
  let passesDone = false;
  const precompile = (root = scene) => {
    if (lost()) return Promise.resolve();
    hold();
    const jobs = [compileFor(renderer, root, view, scene, composer.readBuffer)];
    if (!passesDone) {
      passesDone = true;
      jobs.push(precompilePasses(renderer, composer, view));
    }
    return Promise.all(jobs);
  };

  // Everything sent to the graphics chip before the world is first seen
  // (lib/three/gpuWork): the look on, the passes' shaders, then every
  // picture, shader and one draw, a slice at a time, with progress for the
  // page's loading screen (components/worlds/LoadingVeil)
  const prepare = async (onProgress, { alive = () => true } = {}) => {
    const on = () => alive() && !lost();
    hold();
    house.follow({ adopt: true });
    if (!passesDone) {
      passesDone = true;
      await precompilePasses(renderer, composer, view);
    }
    if (!on()) return;
    await prepareScene({ renderer, roots: [scene], scene, camera: view, target: composer.readBuffer, render: () => post.render(), onProgress, alive: on });
  };

  return {
    THREE,
    renderer,
    canvas,
    scene,
    prepare,
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
    tune,
    tuneGroups,
    lowerQuality,
    // (the stage's renderer state given back, for a world kept off screen
    // while another draws: hq/module.js's keep; put on again at its next frame)
    rest: giveBack,
    // the tone mapping's exposure (a game's chapter or weather sets it):
    // the stage's, on the renderer while it's drawing
    get exposure() {
      return held ? renderer.toneMappingExposure : state.exposure;
    },
    set exposure(v) {
      state.exposure = v;
      if (held) renderer.toneMappingExposure = v;
    },
    get size() {
      return size;
    },
    get lost() {
      return lost();
    },
    get tier() {
      return tierName;
    },
    get small() {
      return tier.small;
    },
  };
}
