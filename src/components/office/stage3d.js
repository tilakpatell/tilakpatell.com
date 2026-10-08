// The office's WebGL stage: one renderer, scene and camera, set up the way
// both 3D views need them (filmic tone mapping, soft shadows, the office HDRI
// for light and reflections), plus the quality steps the site's 3D shares:
// 3D first, so if frames can't keep up it lowers its own resolution, then
// turns shadows off, and stays 3D. Only a lost context goes back to 2D.

import * as THREE from 'three';
import { pixelRatio } from '../../lib/device';
import { guard } from '../../lib/three/frameGuard';
import { prepareScene } from '../../lib/three/gpuWork';
import { precompile as compileFor, quiet } from '../../lib/three/renderer';

// `antialias`: off for a scene that draws through passes of its own (its
// own target smooths the edges; the canvas only ever gets a quad); `maxRatio`
// the most device pixels a CSS pixel gets; `slowMs` the average frame that
// starts the steps down.
export function createStage(canvas, { onLost, onSlow, fov = 50, antialias = true, maxRatio = 2, slowMs = 40, invalidate = null } = {}) {
  const renderer = quiet(new THREE.WebGLRenderer({ canvas, antialias, powerPreference: 'high-performance', alpha: false }));
  // (what arrives late is held back until it's ready, not waited for:
  // lib/three/frameGuard; `invalidate` asks a still scene for the frame that
  // shows what it held back)
  guard(renderer, { invalidate });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const coarse = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false);
  let ratio = pixelRatio(maxRatio); // lib/device: 1.5 on a phone, 1 on a weak device
  renderer.setPixelRatio(ratio);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9e6df);
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.05, 120);
  const size = { w: 1, h: 1 };
  let api = null;

  const resize = (w, h) => {
    size.w = Math.max(1, Math.round(w));
    size.h = Math.max(1, Math.round(h));
    renderer.setPixelRatio(ratio);
    renderer.setSize(size.w, size.h, false);
    camera.aspect = size.w / size.h;
    camera.updateProjectionMatrix();
    api.onResize?.(size.w, size.h, ratio);
  };

  let lost = false;
  const onContextLost = (e) => {
    e.preventDefault();
    lost = true;
    onLost?.();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  // quality steps: every few seconds of drawing, the average frame; below
  // about 25 fps (or the scene's own `slowMs`) it steps down (resolution,
  // then shadows, then resolution again)
  const perf = { acc: 0, n: 0, step: 0 };
  const watch = (ms) => {
    perf.acc += ms;
    perf.n += 1;
    if (perf.acc < 3000 || perf.n < 8) return;
    const avg = perf.acc / perf.n;
    perf.acc = 0;
    perf.n = 0;
    if (avg < slowMs) return;
    perf.step += 1;
    if (perf.step === 1 && ratio > 1) {
      ratio = 1;
      resize(size.w, size.h);
    } else if (perf.step <= 2 && renderer.shadowMap.enabled) {
      renderer.shadowMap.enabled = false;
      scene.traverse((o) => o.material && (o.material.needsUpdate = true));
    } else if (ratio > 0.6) {
      ratio = Math.max(0.6, ratio - 0.2);
      resize(size.w, size.h);
    }
    onSlow?.(perf.step);
  };

  const tmp = new THREE.Vector3();
  // where a world point is on the canvas, in CSS pixels (and whether it's in front)
  const project = (x, y, z) => {
    tmp.set(x, y, z).project(camera);
    return { x: ((tmp.x + 1) / 2) * size.w, y: ((1 - tmp.y) / 2) * size.h, front: tmp.z < 1 };
  };

  // a scene with its own passes (bloom, a grade) sets api.draw to draw them,
  // and api.onResize to size them; without either, the scene draws straight
  const render = (ms = 16) => {
    if (lost) return;
    if (api.draw) api.draw(ms);
    else renderer.render(scene, camera);
    watch(ms);
  };

  const dispose = () => {
    canvas.removeEventListener('webglcontextlost', onContextLost);
    scene.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) m.dispose?.();
    });
    renderer.dispose();
  };

  // Every shader under `root` (the whole scene by default) linked in the
  // background (lib/three/renderer's precompile): a view awaits this before
  // its first frame, and before showing anything it adds later, so drawing
  // it doesn't stop the page while the GPU links.
  const precompile = (root = scene) => (lost ? Promise.resolve() : compileFor(renderer, root, camera, scene));

  // renderer counts, for checking the scene against its budget
  const info = () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, dpr: ratio, shadows: renderer.shadowMap.enabled });

  // Everything sent to the graphics chip before it's first seen (lib/three/
  // gpuWork), with progress for the page's loading screen; a scene with its
  // own passes says where it draws (api.target) and draws them (api.draw)
  const prepare = (onProgress, { alive = () => true } = {}) =>
    prepareScene({ renderer, roots: [scene], scene, camera, target: api.target ?? undefined, render: () => (api.draw ? api.draw(16) : renderer.render(scene, camera)), onProgress, alive: () => alive() && !lost });

  api = { renderer, scene, camera, size, resize, project, render, dispose, precompile, prepare, info, coarse, draw: null, onResize: null, target: undefined, get lost() { return lost; } };
  return api;
}

// The office's light: the HDRI for ambient and reflections, a cool overhead
// key standing in for the fluorescent troffers (it casts the shadows), and a
// soft fill from the windows.
export function lightOffice(stage, kit, { target = new THREE.Vector3(), span = 16, shadowSize = 2048 } = {}) {
  const { scene, renderer } = stage;
  if (kit.env) {
    scene.environment = kit.env;
    scene.environmentIntensity = 0.55;
  }
  const hemi = new THREE.HemisphereLight(0xf4f6ff, 0x5d6170, 0.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xf5f7ff, 1.9);
  key.position.set(target.x + span * 0.35, span * 0.9, target.z + span * 0.5);
  key.target.position.copy(target);
  key.castShadow = true;
  const mobile = stage.coarse;
  key.shadow.mapSize.set(mobile ? Math.min(1024, shadowSize) : shadowSize, mobile ? Math.min(1024, shadowSize) : shadowSize);
  const c = key.shadow.camera;
  c.left = -span;
  c.right = span;
  c.top = span;
  c.bottom = -span;
  c.near = 1;
  c.far = span * 3;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 3;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xfff1dc, 0.45);
  fill.position.set(target.x - span, span * 0.4, target.z - span * 0.6);
  scene.add(fill);
  renderer.toneMappingExposure = 1.0;
  return { hemi, key, fill };
}
