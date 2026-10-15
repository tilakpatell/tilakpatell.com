// The front end's room behind the main menu and Play (the 2026-10-13
// backdrop design): the Frontend level's Backdrop_01 (the dome and the pill
// lights, the kit the Collection's hero stage draws, placed as the level
// places them) out of focus, and HOME's character standing on the right in
// the game's main-menu idle. No DOM: it runs in backdrop.worker.js on the
// canvas the page handed over, or on the page where a worker can't draw.
//
// The room is drawn once to a small target, blurred, and kept as the
// scene's background, drawn again only when the size changes; each frame
// draws that texture and the figure. The loop draws at most 60 frames a
// second and asks `pace` (governor.js) how much to draw.
//
// HOME: where the camera and the figure stand
// createBackdrop(canvas, { width, height, ratio, level, step, reduced, raf, caf, onStep, onReady }) → { resize(w, h, ratio), visible(on), dispose() } | null

import * as THREE from 'three';
import { KITS } from '../../galaxy/surface/catalog/bf2017-frontend';
import FRONTEND from '../../../data/bf2017/light/frontend.json';
import STAGE_DATA from '../../../data/bf2017/stage.json';
import { frameOf } from '../../../lib/bf2017/ui/layout';
import { cutFor, loadWalrusBody, packUrls } from '../../../lib/three/walrus';
import { loadGltf } from '../../../lib/three/gltf';
import { cloneScene, loadGLTF } from '../../../lib/three/gltfCache';
import { loadLut } from '../../../lib/three/gameLut';
import { WEAPON_FRAME } from '../../../lib/three/walrusRig';
import { withFallback } from '../../../lib/assetBase';
import { disposeTree, quiet, releaseContext } from '../../../lib/three/renderer';
import { STEPS, createGovernor } from './governor';
import { BLOOM, BLUR, FINISH, HAZE, LIGHT, MIRROR, bloomWeights, candelaOf, exposureOf, fullScreen } from './light';

// Where the camera and the figure stand: the front end's own camera
// (Levels/Frontend/Default's CameraEntityData: a 36 × 20.25 mm body behind a
// 173.9 mm lens, 6.67° high, focused at 12.53 m, pitched 2° up), 12.53 m
// back from him, its frame's middle at his chest, looking down +z past him at
// the pill lights (the screen's right is the world's -x). Where he stands is
// fitted to the game's HOME capture: the pill panel's five columns about
// 150 px apart behind him (18.5 m behind him: LIGHT.calibrated.panel). `turn` is past square to the camera
// (toward the screen's left); `loopFrom` where his idle's pose is its last's.
const CAM = LIGHT.camera;
const FOV = (2 * Math.atan(CAM.sensor[1] / 2 / CAM.focal) * 180) / Math.PI;
const AT = [0.42, 0, STAGE_DATA.pieces.nowherepilllights_01.at[2] - LIGHT.calibrated.panel];
// (the camera across from the panel where its columns fall at x 1250, 1400,
// 1550, 1700 and 1850 of the capture's 1920; he 0.84 of the way across, his
// head at x 1610 as there)
const MID = 1.68; // (the frame's middle on him: his head 15 px under its top, as the capture's)
const EYE = [1.27, MID - CAM.focus * Math.tan((CAM.pitch * Math.PI) / 180), AT[2] - CAM.focus];
export const HOME = {
  fov: FOV,
  camera: EYE,
  look: [EYE[0], MID, AT[2]],
  figure: { url: '/models/galaxy/bf2017/crew/chewie.glb', packs: packUrls('chewie'), weapon: '/models/galaxy/surface/bowcaster.glb', at: AT, turn: -0.12, loopFrom: 3.04 },
};
const POSES = ['frontend.idle', 'idle'];
// (the game's main-menu idle turns him in over its first seconds and is not
// a loop: it plays once, then from `loopFrom`, where its pose is its last
// one's, to its end, again and again; a still is that pose)
const FPS = 24;
// The room drawn at 1/div of the view and blurred once: the game's depth of
// field (a physical camera at f/2 focused on him at 5 m: LIGHT.dof), its
// spread on the pill lights' edges measured on the capture (about 14 px at
// 1080: an eighth of the view and one pass).
const ROOM = { div: 8, passes: 1 };
const STAGE = STAGE_DATA.pieces;
// (his fur and skin, matte: the import's metalness of a half and its
// roughness map are not the game's hair and skin shaders)
const MATTE = { hair: 0.85 };
const spot = ({ at, aim, lumens, color, cone, reach }) => {
  // (Frostbite's InnerAngle 0: the falloff from the middle of the cone)
  const s = new THREE.SpotLight(new THREE.Color(...color), candelaOf(lumens), reach, (cone * Math.PI) / 360, 1, 2);
  s.position.fromArray(at);
  s.target.position.fromArray(aim);
  return s;
};
const tiled = (t, n) => {
  if (!t) return;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(n, n);
  t.needsUpdate = true;
};

// the vertical field of view that keeps the game's 16:9 frame where the
// screens put it: the same in a wider window, wider in a taller one
const fovFor = (fov, w, h) => {
  const f = frameOf({ width: w, height: h });
  return (2 * Math.atan(Math.tan((fov * Math.PI) / 360) * (h / f.h)) * 180) / Math.PI;
};

export function createBackdrop(canvas, { width = 1920, height = 1080, ratio = 1, level = 'high', step = 0, reduced = false, view = HOME, raf, caf, now = () => performance.now(), onStep = null, onReady = null } = {}) {
  let renderer;
  try {
    // (no multisampling on the canvas: the scene's target has it, the canvas only the last pass)
    renderer = quiet(new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' }));
  } catch {
    return null;
  }
  // (his fur shadowing itself, as the game's hair does, from the key light alone; not on low)
  renderer.shadowMap.enabled = level !== 'low';
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // (the exposure, the tone map and the grade are the last pass's: FINISH)
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const ve = FRONTEND.weathers[FRONTEND.main];

  const camera = new THREE.PerspectiveCamera(view.fov, width / height, 0.5, 120);
  camera.position.fromArray(view.camera);
  camera.lookAt(new THREE.Vector3().fromArray(view.look));
  const mirrorCam = new THREE.PerspectiveCamera();

  // The room, its own scene drawn once into the small targets: the pill
  // lights its one light, the floor a mirror, the walls glossy, the dome's
  // inside black (its Enlighten bounce is in the atlases the export has not
  // given yet: the walls' faint grey beside the pills is their gloss and the haze).
  const room = new THREE.Scene();
  room.background = new THREE.Color(0, 0, 0);
  let floor = null;
  let floorY = 0;
  // his: the blurred room behind, the level's key light on him, the room around him
  const scene = new THREE.Scene();
  const key = spot(LIGHT.key);
  key.castShadow = renderer.shadowMap.enabled;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.3;
  key.shadow.camera.far = 6;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  // (the key stands where the level has it from the hero, wherever he is
  // placed; aimed at his chest, where the level's aims at his hips and leaves
  // the face the capture shows lit outside its cone: hand)
  const light = () => {
    const at = new THREE.Vector3().fromArray(view.figure.at);
    key.position.fromArray(LIGHT.key.at).add(at);
    key.target.position.set(LIGHT.key.aim[0], 1.75, LIGHT.key.aim[2]).add(at);
    key.target.updateMatrixWorld();
    key.intensity = candelaOf(LIGHT.key.lumens) * (view.key ?? 1);
    scene.environmentIntensity = view.env ?? 1;
  };
  light();

  // the room's targets: drawn (with its depth, for the haze) at 1/div of the
  // view, the haze added, blurred (the focus), the bloom's five levels from
  // that, the sum the scene's background; the floor's mirror beside them
  const target = (opts = {}) => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false, ...opts });
  const drawn = target({ depthBuffer: true, depthTexture: new THREE.DepthTexture(1, 1) });
  const pair = [target(), target()];
  const levels = LIGHT.bloom.gaussians.map(() => [target(), target()]);
  const out = target();
  const mirror = target({ depthBuffer: true });
  // (the scene's light, multisampled below low)
  const hdr = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: level === 'low' ? 0 : 4 });
  const shader = (def) => new THREE.ShaderMaterial({ ...def, uniforms: THREE.UniformsUtils.clone(def.uniforms), depthTest: false, depthWrite: false });
  const finish = shader(FINISH);
  finish.uniforms.uExposure.value = exposureOf(LIGHT.exposure) * (view.exposure ?? 1);
  finish.uniforms.tScene.value = hdr.texture;
  finish.uniforms.uVignette.value.set(...LIGHT.vignette.scale, LIGHT.vignette.exponent, LIGHT.vignette.opacity);
  finish.uniforms.uGrain.value.set(LIGHT.grain.shadow, LIGHT.grain.highlight, LIGHT.grain.shadowFrom, LIGHT.grain.highlightFrom);
  finish.uniforms.uGrainScale.value = LIGHT.grain.scale * 0.05;
  const lut = ve.grading?.lut;
  if (lut)
    withFallback((u) => loadLut(u, ve.grading.lutSize))(`/${lut}`)
      .then((tex) => {
        if (!alive) return tex.dispose();
        finish.uniforms.tLut.value = tex;
        finish.uniforms.uLutSize.value = ve.grading.lutSize;
        finish.uniforms.uLutMix.value = 1;
        draw();
      })
      .catch(() => {});
  const blur = shader(BLUR);
  const bloom = shader(BLOOM);
  bloom.uniforms.k.value = bloomWeights();
  const haze = shader(HAZE);
  haze.uniforms.uCenter.value.fromArray(LIGHT.haze.at);
  haze.uniforms.uRadius.value = LIGHT.haze.radius;
  haze.uniforms.uExponent.value = LIGHT.haze.exponent;
  haze.uniforms.uEmission.value.fromArray(LIGHT.haze.emission).multiplyScalar(LIGHT.haze.scale);
  haze.uniforms.tColor.value = drawn.texture;
  haze.uniforms.tDepth.value = drawn.depthTexture;
  const mirrorMat = new THREE.ShaderMaterial({ ...MIRROR, uniforms: THREE.UniformsUtils.clone(MIRROR.uniforms) });
  mirrorMat.uniforms.tMirror.value = mirror.texture;
  const quad = new THREE.Mesh(fullScreen(), blur);
  quad.frustumCulled = false;
  const pass = new THREE.Scene();
  pass.add(quad);
  const flat = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.background = out.texture;

  let alive = true;
  let size = { w: width, h: height, r: ratio };
  let at = Math.min(Math.max(0, step), STEPS.length - 1);
  const pace = createGovernor({ start: at, now });

  const run = (material, into) => {
    quad.material = material;
    renderer.setRenderTarget(into);
    renderer.render(pass, flat);
  };
  const copy = (from, into) => {
    blur.uniforms.map.value = from.texture;
    blur.uniforms.dir.value.set(0, 0);
    run(blur, into);
  };
  // `passes` blurs of a pair of targets, each wider than the last; the result in pair[0]
  const blurPair = (two, w, h, passes) => {
    for (let i = 0; i < passes; i++) {
      blur.uniforms.map.value = two[0].texture;
      blur.uniforms.dir.value.set((i + 1) / w, 0);
      run(blur, two[1]);
      blur.uniforms.map.value = two[1].texture;
      blur.uniforms.dir.value.set(0, (i + 1) / h);
      run(blur, two[0]);
    }
  };
  // the floor's mirror: the room from under the floor (the camera reflected
  // in it), the floor itself left out
  function drawMirror() {
    if (!floor) return;
    mirrorCam.copy(camera);
    mirrorCam.position.y = 2 * floorY - camera.position.y;
    const look = new THREE.Vector3().fromArray(view.look);
    look.y = 2 * floorY - look.y;
    mirrorCam.up.set(0, -1, 0);
    mirrorCam.lookAt(look);
    mirrorCam.updateMatrixWorld();
    mirrorMat.uniforms.uMirrorVP.value.multiplyMatrices(mirrorCam.projectionMatrix, mirrorCam.matrixWorldInverse);
    mirrorMat.uniforms.uCam.value.copy(camera.position);
    floor.visible = false;
    renderer.setRenderTarget(mirror);
    renderer.render(room, mirrorCam);
    floor.visible = true;
  }
  function drawRoom() {
    const r = { ...ROOM, ...view.room };
    const w = Math.max(16, Math.round(size.w / r.div));
    const h = Math.max(9, Math.round(size.h / r.div));
    for (const t of [drawn, ...pair, out, mirror]) t.setSize(w, h);
    levels.forEach((two, i) => two.forEach((t) => t.setSize(Math.max(2, w >> i), Math.max(2, h >> i))));
    camera.updateMatrixWorld();
    drawMirror();
    renderer.setRenderTarget(drawn);
    renderer.render(room, camera);
    haze.uniforms.uProjInv.value.copy(camera.projectionMatrixInverse);
    haze.uniforms.uCamWorld.value.copy(camera.matrixWorld);
    haze.uniforms.uCam.value.copy(camera.position);
    haze.uniforms.uEmission.value.fromArray(LIGHT.haze.emission).multiplyScalar(LIGHT.haze.scale * LIGHT.calibrated.haze * (view.haze ?? 1));
    run(haze, pair[0]);
    blurPair(pair, w, h, r.passes);
    // (the bloom: five levels, each half the last's size, each blurred once)
    let from = pair[0];
    levels.forEach((two, i) => {
      copy(from, two[0]);
      blurPair(two, Math.max(2, w >> i), Math.max(2, h >> i), 1);
      from = two[0];
    });
    bloom.uniforms.k.value = bloomWeights().map((k) => k.multiplyScalar(view.bloom ?? 1));
    bloom.uniforms.base.value = pair[0].texture;
    bloom.uniforms.g.value = levels.map((two) => two[0].texture);
    run(bloom, out);
    renderer.setRenderTarget(null);
  }
  function fit() {
    const s = STEPS[at];
    renderer.setPixelRatio(size.r * s.scale);
    renderer.setSize(size.w, size.h, false);
    const px = renderer.getDrawingBufferSize(new THREE.Vector2());
    hdr.setSize(px.x, px.y);
    camera.aspect = size.w / size.h;
    camera.fov = fovFor(view.fov, size.w, size.h);
    camera.updateProjectionMatrix();
    drawRoom();
  }
  const draw = () => {
    if (!alive) return;
    renderer.setRenderTarget(hdr);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    finish.uniforms.uTime.value = (finish.uniforms.uTime.value + 1) % 1000;
    run(finish, null);
  };

  // (ready once the room, the figure and his weapon have each landed or failed)
  let landing = 3;
  const landed = () => {
    if (--landing === 0 && alive) onReady?.();
  };
  // the dome's materials as the game's are (web/materials.jsonl): the pill
  // lights emissive at their 1,500 nits, the floor and walls' maps tiled 44
  // times, the walls glossy (smoothness 1 to 1.25), the floor the mirror
  const pills = [];
  const dress = (piece) =>
    piece.traverse((o) => {
      const m = o.material;
      if (!o.isMesh || !m) return;
      if (/^Nowhere$/i.test(m.name)) {
        pills.push(m);
        // (the kit's map upside down: the game's columns run long pill on
        // top, short pill on top, alternately from the left, and the kit's
        // the other way round; turned in v, they are the capture's)
        for (const t of new Set([m.map, m.emissiveMap].filter(Boolean))) {
          t.repeat.y = -1;
          t.offset.y = 1;
          t.needsUpdate = true;
        }
        m.emissiveIntensity = (LIGHT.pills.emissive / Math.PI) * LIGHT.calibrated.pills * (view.pills ?? 1);
        m.color.setScalar(0);
      } else if (/DomeWalls/i.test(m.name)) {
        for (const t of [m.map, m.roughnessMap, m.metalnessMap, m.aoMap]) tiled(t, LIGHT.dome.walls.tiling);
        m.roughness = 0.04;
        m.roughnessMap = null;
        m.metalness = 0;
        m.metalnessMap = null;
      } else if (/NowhereDome/i.test(m.name)) {
        floor = o;
        o.geometry.computeBoundingBox();
        floorY = new THREE.Vector3(0, o.geometry.boundingBox.max.y, 0).applyMatrix4(o.matrixWorld).y;
        o.material = mirrorMat;
      }
    });
  loadGltf(KITS.frontendstage.url, { renderer, fresh: true })
    .then((got) => {
      if (!alive || !got) return;
      for (const [name, p] of Object.entries(STAGE)) {
        const piece = got.scene.getObjectByName(name);
        if (!piece) continue;
        piece.position.fromArray(p.at);
        piece.quaternion.fromArray(p.quat);
        piece.scale.fromArray(p.scale);
        room.add(piece);
        piece.updateMatrixWorld(true);
        dress(piece);
      }
      // (the room's own reflections, and his light from it: the dome baked
      // once from where he stands, the game's local reflection of the room)
      const pm = new THREE.PMREMGenerator(renderer);
      const env = pm.fromScene(room, 0.02, 0.1, 80, { position: new THREE.Vector3(view.figure.at[0], 1.5, view.figure.at[2]) }).texture;
      pm.dispose();
      room.environment = env;
      scene.environment = env;
      drawRoom();
      draw();
    })
    .catch(() => {})
    .finally(landed);

  // Where he stands and faces, from his settled pose: the hips moved over
  // the placing (the game's clip carries them off its origin), the turn the
  // one that squares his shoulders to the camera, and `view.figure.turn` more.
  const bone = (body, name) => body.getObjectByName(name);
  let facing = null;
  // (the turn that squares him to the camera, and `view.figure.turn` more)
  const aim = () => {
    const to = new THREE.Vector3().fromArray(view.camera).sub(turn.position);
    turn.rotation.y = (facing == null ? 0 : Math.atan2(to.x, to.z) - facing) + (view.figure.turn ?? 0);
    turn.updateMatrixWorld(true);
  };
  function stand(body) {
    turn.updateMatrixWorld(true);
    const local = (name) => {
      const b = bone(body, name);
      return b ? turn.worldToLocal(b.getWorldPosition(new THREE.Vector3())) : null;
    };
    const hips = local('Hips');
    const l = local('LeftArm');
    const r = local('RightArm');
    if (hips) {
      body.position.x -= hips.x;
      body.position.z -= hips.z;
    }
    if (l && r) {
      const side = r.sub(l);
      // (forward = up × (right − left) = (side.z, 0, −side.x): its yaw in the group's frame)
      facing = Math.atan2(side.z, -side.x);
    }
    aim();
  }

  // (copies: the cache's own are the Collection's too)
  const matte = (m) => {
    if (!m?.isMeshStandardMaterial || !/hair|head|body/i.test(m.name)) return m;
    const c = m.clone();
    c.metalness = 0;
    c.metalnessMap = null;
    if (/hair/i.test(m.name)) {
      c.roughness = MATTE.hair;
      c.roughnessMap = null;
    }
    return c;
  };

  // his weapon in his hands, as the game's front end shows him: its
  // third-person mesh at his Wep_Root in the weapon frame (the game models
  // its weapons in that socket's frame: figures/held.js), the socket's scale undone
  function arm(body) {
    const socket = body.sockets?.weapon;
    if (!spec.weapon || !socket) return landed();
    loadGLTF(spec.weapon)
      .then((g) => {
        if (!alive || !g?.scene) return;
        const gun = cloneScene(g);
        gun.name = 'held';
        socket.updateWorldMatrix(true, false);
        const k = 1 / (socket.getWorldScale(new THREE.Vector3()).x || 1);
        gun.scale.setScalar(k);
        gun.quaternion.fromArray(WEAPON_FRAME.quaternion);
        gun.position.fromArray(WEAPON_FRAME.position).multiplyScalar(k);
        socket.add(gun);
        draw();
      })
      .catch(() => {})
      .finally(landed);
  }

  // the figure: HOME's character in the game's main-menu idle, in the cut
  // the level draws (ultra: LOD0 with its 2048 maps; high: LOD0; below: the
  // light cut, the game's LOD3, for a phone's download)
  let figure = null;
  let mixer = null;
  const turn = new THREE.Group();
  turn.position.fromArray(view.figure.at);
  scene.add(turn);
  const spec = view.figure;
  loadWalrusBody(cutFor(spec.url, level), { packs: spec.packs })
    .catch(() => loadWalrusBody(spec.url, { packs: spec.packs }))
    .then((body) => {
      if (!alive) return;
      figure = body.model;
      figure.traverse((o) => {
        if (o.isSkinnedMesh) o.frustumCulled = false;
        if (o.isMesh) {
          o.material = Array.isArray(o.material) ? o.material.map(matte) : matte(o.material);
          o.castShadow = o.receiveShadow = true;
        }
      });
      turn.add(figure);
      arm(body);
      mixer = new THREE.AnimationMixer(figure);
      const clip = POSES.map((n) => body.clips[n]).find(Boolean);
      const from = spec.loopFrom ?? 0;
      const loops = clip && from > 0 && from < clip.duration;
      const once = clip ? mixer.clipAction(clip) : null;
      const again = loops ? mixer.clipAction(THREE.AnimationUtils.subclip(clip, `${clip.name}.loop`, Math.round(from * FPS), Math.round(clip.duration * FPS), FPS)) : once;
      if (loops) {
        once.setLoop(THREE.LoopOnce, 1);
        once.clampWhenFinished = true;
        mixer.addEventListener('finished', (e) => {
          if (e.action !== once) return;
          again.play();
          once.stop();
        });
      }
      // (placed and turned by the settled pose: its hips over the placing, its shoulders square to the camera)
      again?.play();
      mixer.update(0);
      stand(figure);
      if (loops && !still()) {
        again.stop();
        once.play();
      }
      mixer.update(0.01);
      draw();
    })
    // (no figure: no weapon to wait for either)
    .catch(() => landed())
    .finally(landed);

  // the loop: at most 60 frames a second, while seen and not still
  const FRAME = 1000 / 60;
  let raw = [];
  let display = FRAME;
  let last = 0;
  let id = 0;
  let seen = true;
  const still = () => reduced || STEPS[at].still;
  const tick = (t) => {
    id = 0;
    if (!alive || !seen || still()) return;
    id = raf(tick);
    // (the display's own frame, from the first callbacks: a 30 or 50 Hz one is not late at its own rate)
    if (raw.length < 30) {
      if (last) raw.push(t - last);
      if (raw.length === 30) display = Math.max(FRAME, [...raw].sort((a, b) => a - b)[15]);
    }
    const dt = last ? t - last : FRAME;
    // (a display faster than 60 Hz: every other callback, or every third)
    if (last && dt < FRAME - 2) return;
    last = t;
    mixer?.update(Math.min(0.1, dt / 1000));
    draw();
    const next = pace.frame(dt, Math.max(FRAME, display));
    if (next != null && next !== at) {
      at = next;
      fit();
      draw();
      onStep?.(at);
      if (still()) return;
    }
  };
  const start = () => {
    if (!id && seen && !still() && alive) {
      last = 0;
      id = raf(tick);
    }
  };

  fit();
  draw();
  start();

  return {
    resize(w, h, r = size.r) {
      if (!w || !h) return;
      size = { w, h, r };
      fit();
      draw();
    },
    visible(on) {
      seen = Boolean(on);
      if (!seen && id) {
        caf(id);
        id = 0;
      }
      if (seen) {
        draw();
        start();
      }
    },
    // (another camera and placing: development's tuning against the capture)
    view(v) {
      view = { ...view, ...v, figure: { ...view.figure, ...v.figure } };
      camera.position.fromArray(view.camera);
      camera.lookAt(new THREE.Vector3().fromArray(view.look));
      turn.position.fromArray(view.figure.at);
      aim();
      light();
      finish.uniforms.uExposure.value = exposureOf(LIGHT.exposure) * (view.exposure ?? 1);
      for (const m of pills) m.emissiveIntensity = (LIGHT.pills.emissive / Math.PI) * LIGHT.calibrated.pills * (view.pills ?? 1);
      fit();
      draw();
    },
    get step() {
      return at;
    },
    dispose() {
      alive = false;
      if (id) caf(id);
      mixer?.stopAllAction();
      disposeTree(room);
      if (figure) disposeTree(figure);
      for (const t of [drawn, ...pair, ...levels.flat(), out, mirror, hdr]) t.dispose();
      finish.uniforms.tLut.value?.dispose();
      for (const m of [finish, blur, bloom, haze, mirrorMat]) m.dispose();
      scene.environment?.dispose();
      quad.geometry.dispose();
      renderer.dispose();
      releaseContext(renderer);
    },
  };
}
