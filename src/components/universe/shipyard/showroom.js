// The Shipyard's showroom: the draft's ship on a turntable on a canvas of
// its own, under a dock's light (a warm key, a blue fill, a rim from
// behind) on a gridded disc, turning slowly on its own and by a drag. It's
// built by the same buildShip the map flies, with the iconic ships' own
// models put over the stand-in as the map and the galaxy do (the X-wing,
// the Falcon, the RV, the cruiser), so what you see is what you fly. A new
// paint or part is a new outfit on the same ship; a new hull or module is a
// new ship. Pointing at a slot pulses what's bolted there. It draws at
// most FPS frames a second, only while the tab is visible, and stops on
// dispose. After rickmorty/wardrobe/preview.js.
//
// createShowroom(canvas, { reduced }) → { show({ kind, build, loadout }),
//   focus(slot | null), dispose() } | null (no WebGL)

import * as THREE from 'three';
import { pixelRatio } from '../../../lib/device';
import { disposeTree, quiet, releaseContext } from '../../../lib/three/renderer';
import { cloneScene, loadGLTF } from '../../../lib/three/gltfCache';
import { dropTransmission } from '../../../lib/three/glass';
import { CREW_INK, LENGTH, SHIP_MODELS, buildShip } from '../shipModels';
import { paintById } from '../paint';
import { writeBuild } from './build';
import { BUILD_SLOTS } from './parts';
import { FPS, createFling, fitDistance, glowCopy, heroOf, pulseAt, yawFromDrag } from './showroomRules';

const FOV = 30;
const PULSE_COLOR = new THREE.Color('#7cc8ff');

export function createShowroom(canvas, { reduced = false } = {}) {
  let renderer;
  try {
    renderer = quiet(new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }));
  } catch {
    return null;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 20);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a2030, 0.9));
  const key = new THREE.DirectionalLight(0xfff6e8, 2.2);
  key.position.set(-1.5, 2.2, 1.6);
  const fill = new THREE.DirectionalLight(0x7cc8ff, 0.8);
  fill.position.set(1.8, 0.4, 1.2);
  const rim = new THREE.DirectionalLight(0xbfd8ff, 1.6);
  rim.position.set(0.6, 1.2, -2.2);
  scene.add(key, fill, rim);
  // the dock's floor: a dark disc with a faint grid, under the ship
  const R = LENGTH * 1.25;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.04, LENGTH * 0.04, 64), new THREE.MeshStandardMaterial({ color: 0x141a26, roughness: 0.8, metalness: 0.2 }));
  disc.position.y = -LENGTH * 0.24;
  const grid = new THREE.GridHelper(R * 2, 16, 0x7cc8ff, 0x3a4a66);
  grid.material.transparent = true;
  grid.material.opacity = 0.25;
  grid.position.y = disc.position.y + LENGTH * 0.021;
  scene.add(disc, grid);
  const turn = new THREE.Group();
  scene.add(turn);

  let model = null;
  let shownKey = null; // the kind and build the model is
  let focused = null; // { slot, swaps: [[mesh, material]] }

  const fit = () => {
    const w = canvas.clientWidth || 320;
    const h = canvas.clientHeight || 240;
    renderer.setPixelRatio(pixelRatio(2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const d = fitDistance(camera.aspect, LENGTH, FOV) * zoom;
    camera.position.set(0, d * 0.42, d);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    dirty = true;
  };
  let zoom = 1;
  let dirty = true;
  const sizing = new ResizeObserver(fit);
  sizing.observe(canvas);

  // what's pointed at glows: each of its meshes on a copy of its material,
  // with an emissive the pulse sets (the originals are shared by the rest)
  const unfocus = () => {
    if (!focused) return;
    for (const [mesh, mat] of focused.swaps) {
      mesh.material.dispose();
      mesh.material = mat;
    }
    focused = null;
  };
  const holderOf = (slot) => {
    if (!model || !slot) return null;
    if (BUILD_SLOTS.includes(slot)) return model.build ? model.pivot : null; // (a build's modules are merged by material: the whole hull glows)
    return model.modules?.group.getObjectByName(slot) ?? null;
  };
  const applyFocus = (slot) => {
    unfocus();
    const holder = holderOf(slot);
    if (!holder) return;
    const swaps = [];
    holder.traverse((o) => {
      if (!o.isMesh || Array.isArray(o.material) || !o.material.emissive) return;
      swaps.push([o, o.material]);
      o.material = glowCopy(o.material);
    });
    focused = { slot, swaps };
  };
  let wantFocus = null;

  // the real ship over the stand-in, once it's loaded (only if this is
  // still the ship shown); the stand-in until then, or if it never comes
  const mountHero = (shown, kind, build) => {
    const hero = heroOf(kind, build, SHIP_MODELS);
    if (!hero) return;
    const still = () => !gone && model === shown;
    if (hero.glb)
      loadGLTF(hero.glb)
        .then((g) => {
          const m = g && cloneScene(g);
          if (!m) return;
          dropTransmission(m); // (the Falcon's glass, without its extra pass)
          if (!still() || !shown.mount(shown.dress ? shown.dress(m) : m)) return disposeTree(m);
          dirty = true;
          return undefined;
        })
        .catch(() => {});
    else
      import('../../rickmorty/cruiser3d')
        .then((mod) => mod.buildCruiser({ ink: LENGTH / 2.7, crewInk: CREW_INK }))
        .then((c) => {
          if (!c) return;
          if (!still() || !shown.mount(c.group, { update: c.update, dispose: c.dispose, ownGlow: true, tint: c.tint, setLooks: c.setLooks })) {
            c.dispose();
            disposeTree(c.group);
            return;
          }
          dirty = true;
        })
        .catch(() => {});
  };
  let gone = false;

  // turning: slowly on its own (unless motion's reduced), by a drag, by
  // the arrow keys; a wheel or a pinch brings it a little nearer
  let yaw = 0.6;
  const spin = reduced ? 0 : 0.3;
  let drag = null;
  // a drag let go at speed keeps it turning, slowing (showroomRules' fling); not with reduced motion
  const fling = createFling();
  let movedAt = 0;
  const pointers = new Map();
  const down = (e) => {
    pointers.set(e.pointerId, e.clientX);
    fling.grab();
    movedAt = performance.now();
    if (pointers.size === 1) drag = { x: e.clientX, yaw };
    canvas.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (!pointers.has(e.pointerId)) return;
    if (pointers.size === 2) {
      const xs = [...pointers.values()];
      const was = Math.abs(xs[0] - xs[1]);
      pointers.set(e.pointerId, e.clientX);
      const now = [...pointers.values()];
      setZoom(zoom * (1 - (Math.abs(now[0] - now[1]) - was) * 0.004));
      return;
    }
    pointers.set(e.pointerId, e.clientX);
    if (drag) {
      const was = yaw;
      yaw = drag.yaw + yawFromDrag(e.clientX - drag.x);
      const t = performance.now();
      fling.track(yaw - was, (t - movedAt) / 1000);
      movedAt = t;
    }
    dirty = true;
  };
  const up = (e) => {
    pointers.delete(e.pointerId);
    if (drag && !pointers.size) {
      const v = fling.release((performance.now() - movedAt) / 1000);
      if (reduced && v) fling.grab();
    }
    drag = null;
  };
  const setZoom = (z) => {
    zoom = Math.min(1.2, Math.max(0.7, z));
    fit();
  };
  const wheel = (e) => {
    e.preventDefault();
    setZoom(zoom * (1 + Math.sign(e.deltaY) * 0.06));
  };
  const keydown = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      yaw += e.key === 'ArrowLeft' ? -0.2 : 0.2;
      dirty = true;
    }
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', wheel, { passive: false });
  canvas.addEventListener('keydown', keydown);

  // the frame loop: at most FPS, and none while the tab's hidden
  let raf = 0;
  let last = performance.now();
  let drawn = 0;
  const t0 = last;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (document.visibilityState !== 'visible') return;
    if (now - drawn < 1000 / FPS - 1) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    drawn = now;
    if (fling.moving) {
      yaw += fling.coast(dt);
      dirty = true;
    }
    if (spin || dirty || focused) {
      yaw += spin * dt;
      turn.rotation.y = yaw;
      if (focused) {
        const k = pulseAt((now - t0) / 1000);
        for (const [mesh] of focused.swaps) mesh.material.emissive.copy(PULSE_COLOR).multiplyScalar(0.15 + 0.85 * k);
      }
      model?.update((now - t0) / 1000);
      model?.drive(dt, { throttle: 0.2 });
      renderer.render(scene, camera);
      dirty = false;
    }
  };
  raf = requestAnimationFrame(frame);

  return {
    show({ kind, build = null, loadout }) {
      if (!kind || !loadout) return;
      const k = `${kind}|${build ? writeBuild(build).join(',') : 'stock'}`;
      if (k !== shownKey) {
        unfocus();
        if (model) {
          model.group.removeFromParent();
          model.dispose();
        }
        model = buildShip(kind, {}, { build });
        model.setThrottle?.(0.2);
        turn.add(model.group);
        shownKey = k;
        mountHero(model, kind, build);
      }
      model.paint(paintById(loadout.paint));
      unfocus();
      model.outfit(loadout);
      if (wantFocus) applyFocus(wantFocus);
      dirty = true;
    },
    focus(slot) {
      wantFocus = slot ?? null;
      applyFocus(wantFocus);
      dirty = true;
    },
    dispose() {
      gone = true;
      cancelAnimationFrame(raf);
      sizing.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('keydown', keydown);
      unfocus();
      model?.dispose();
      disc.geometry.dispose();
      disc.material.dispose();
      grid.geometry.dispose();
      grid.material.dispose();
      renderer.dispose();
      releaseContext(renderer);
    },
  };
}
