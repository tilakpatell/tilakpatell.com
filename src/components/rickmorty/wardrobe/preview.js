// The wardrobe's turntable: the look being put together, on a small canvas
// of its own, in the cast's toon look under a studio's light (a key, a fill
// and a green rim from behind, on a disc), turning slowly on its own and by
// a drag. A new colour is only new numbers in the figure's materials; new
// gear is put on again; a new body is a new figure, loaded once. Whatever
// changes, the figure gives you a wave in it (on its upper half, the
// library's clip; a figure that can't plays nothing). Walt and
// Jesse stand in a studio of their own: an RV-brown disc with a Blue Sky
// ring, a desert sun’s rim of light.
//
// createWardrobePreview(canvas, { reduced }) → { show(look), dispose() }

import * as THREE from 'three';
import { createMeshyCast } from '../portal/meshyCast';
import { pixelRatio } from '../../../lib/device';
import { quiet, releaseContext } from '../../../lib/three/renderer';
import { BODIES, castOf, gearWorn } from './looks';
import { dressColors } from './dress';
import { wearGear } from './gear';
import { whoOf } from './wear';

const ALL = Object.values(BODIES).flat();
const KINDS = Object.fromEntries(ALL.map((b) => [b.id, { a: b.asset, h: b.h }]));
const RIGGED = new Set(ALL.map((b) => b.asset));
const TALL = 1.7; // (every body shown the same height, so the gear's what changes)
// each cast’s studio: the disc, its ring, the light from behind
const STUDIO = { rickmorty: { base: 0x2a2234, ring: 0x97ce4c, rim: 0x9dff5a }, breakingbad: { base: 0x3b2c22, ring: 0x5fc8ef, rim: 0xffc27a } };

export function createWardrobePreview(canvas, { reduced = false } = {}) {
  let renderer;
  try {
    renderer = quiet(new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }));
  } catch {
    return null;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
  scene.add(new THREE.HemisphereLight(0xf4f8ff, 0x8a94a8, 1.9));
  const key = new THREE.DirectionalLight(0xfff6e8, 2.4);
  key.position.set(-2.5, 4, 3.5);
  const rim = new THREE.DirectionalLight(STUDIO.rickmorty.rim, 2.2);
  rim.position.set(1.5, 2.5, -3.5);
  scene.add(key, rim);
  // the disc it stands on: inked, with a portal-green ring
  const disc = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.06, 64), new THREE.MeshToonMaterial({ color: STUDIO.rickmorty.base }));
  base.position.y = -0.03;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.018, 10, 96), new THREE.MeshBasicMaterial({ color: STUDIO.rickmorty.ring, toneMapped: false }));
  ring.rotation.x = Math.PI / 2;
  disc.add(base, ring);
  scene.add(disc);
  const turn = new THREE.Group();
  scene.add(turn);

  const cast = createMeshyCast({ kinds: KINDS, rigged: RIGGED });
  const loaded = new Map(); // asset → promise
  const need = (asset) => {
    if (!loaded.has(asset)) loaded.set(asset, cast.load(null, [asset], { clips: ['idle'] }));
    return loaded.get(asset);
  };

  let figure = null;
  let mats = [];
  let undoGear = () => {};
  let shown = null; // { body, gear (as text) }
  let wanted = null;
  let wavedAt = -Infinity; // (one wave at a time: a run of clicks doesn't restart it)
  const wave = () => {
    const now = performance.now() / 1000;
    if (now - wavedAt < 2.5 || !figure?.play) return;
    wavedAt = now;
    figure.play('wave', { layer: 'upper' })?.catch?.(() => {});
  };
  const clear = () => {
    undoGear();
    undoGear = () => {};
    for (const m of mats) m.dispose();
    mats = [];
    figure?.anim?.dispose();
    figure?.group.removeFromParent();
    figure = null;
  };

  const fit = () => {
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || 400;
    renderer.setPixelRatio(pixelRatio(2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // the whole figure in, whatever the shape of the canvas
    const dist = Math.max(3.4, (TALL * 1.45) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(1, camera.aspect)));
    camera.position.set(0, 1.0, dist);
    camera.lookAt(0, 0.86, 0);
    camera.updateProjectionMatrix();
  };
  fit();
  const sizing = new ResizeObserver(fit);
  sizing.observe(canvas);

  // turning: on its own, slowly (unless motion's reduced), and by a drag
  let yaw = 0.35;
  let spin = reduced ? 0 : 0.35;
  let drag = null;
  const down = (e) => {
    drag = { x: e.clientX, yaw };
    spin = 0;
    canvas.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (drag) yaw = drag.yaw + (e.clientX - drag.x) * 0.012;
  };
  const up = () => {
    drag = null;
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  let raf = 0;
  let last = performance.now();
  const t0 = last;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    yaw += spin * dt;
    turn.rotation.y = yaw;
    figure?.update?.((now - t0) / 1000, 0, 0);
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);

  return {
    async show(look) {
      wanted = look;
      const body = KINDS[look.body] ? look.body : null;
      if (!body) return;
      const studio = STUDIO[castOf(whoOf(look))] ?? STUDIO.rickmorty;
      base.material.color.set(studio.base);
      ring.material.color.set(studio.ring);
      rim.color.set(studio.rim);
      await need(KINDS[body].a);
      if (wanted !== look) return; // (another came meanwhile)
      const gear = JSON.stringify(gearWorn(look));
      const colors = JSON.stringify(look.colors ?? {});
      const changed = Boolean(shown) && (shown.body !== body || shown.gear !== gear || shown.colors !== colors);
      if (!figure || shown?.body !== body) {
        clear();
        figure = cast.make(body);
        if (!figure) return;
        figure.group.scale.setScalar(TALL / figure.height);
        turn.add(figure.group);
        figure.group.updateMatrixWorld(true);
        mats = dressColors(figure, look);
        undoGear = wearGear(figure, look);
        wavedAt = -Infinity;
      } else {
        for (const m of mats) m.userData.regions?.set(look.colors);
        if (shown.gear !== gear) {
          undoGear();
          undoGear = wearGear(figure, look);
        }
      }
      shown = { body, gear, colors };
      if (changed && !reduced) wave();
    },
    dispose() {
      cancelAnimationFrame(raf);
      sizing.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      clear();
      cast.dispose();
      disc.traverse((o) => o.isMesh && (o.geometry.dispose(), o.material.dispose()));
      renderer.dispose();
      releaseContext(renderer);
    },
  };
}
