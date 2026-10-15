// The cast, up close: one HD figure at a time on a GDA holo-plinth, lit by
// a photographed sky (Poly Haven, CC0) it never shows, turning slowly or
// by hand, in whichever pose is asked for (lib/three/rig poses any of
// their skeletons the same way).

import * as THREE from 'three';
import { createStage, hot } from '../../avengers/hq/stage';
import { POSES, figure, loadFigure } from '../../../lib/three/rig';
import { prefersReducedMotion } from '../../../lib/hooks';
import { CAST, asset } from '../cast';
import { LOOK } from './look';

const damp = (v, to, rate, dt) => v + (to - v) * (1 - Math.exp(-rate * dt));

export async function create(rt, { onSlow } = {}) {
  const calm = prefersReducedMotion();
  const engine = createStage(rt, { exposure: 1.05, fov: 28, near: 0.05, far: 80, bloom: LOOK.bloom, onSlow });
  const { scene, camera } = engine;
  await engine.setSky('noon', { background: false, envIntensity: 0.9, sunIntensity: 2.6, sunDir: [0.5, 0.8, 0.7], fill: 0.25 });
  scene.background = new THREE.Color(0x070a12);
  scene.fog = new THREE.Fog(0x070a12, 9, 22);
  engine.setShadowBox(new THREE.Vector3(0, 1, 0), 3, 14);

  // the plinth, its rings of light, and a floor that fades into the dark
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.22, 64), new THREE.MeshStandardMaterial({ color: 0x1a1f2a, metalness: 0.85, roughness: 0.32 }));
  plinth.position.y = 0.11;
  plinth.receiveShadow = true;
  scene.add(plinth);
  const ringMat = new THREE.MeshBasicMaterial({ color: hot(0x5fc8ff, 2.4), toneMapped: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.012, 8, 96).rotateX(Math.PI / 2), ringMat);
  ring.position.y = 0.225;
  scene.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.006, 6, 96).rotateX(Math.PI / 2), ringMat);
  ring2.position.y = 0.02;
  scene.add(ring2);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0b0f18, metalness: 0.6, roughness: 0.4 }));
  floor.receiveShadow = true;
  scene.add(floor);
  // a soft rim light from behind, so the silhouette reads against the dark
  const rim = new THREE.DirectionalLight(0x8fd0ff, 1.6);
  rim.position.set(-2, 3, -4);
  scene.add(rim);

  const figures = {};
  const get = async (id) => {
    if (!figures[id]) {
      const f = figure(await loadFigure(asset(CAST[id].file)), CAST[id]);
      f.holder.visible = false;
      scene.add(f.holder);
      figures[id] = f;
    }
    return figures[id];
  };
  let current = null;
  let pose = 'stand';
  let yaw = 0.5;
  let spin = calm ? 0 : 0.35;
  let held = 0;
  let time = 0;
  const lift = { stand: 0, proud: 0, hover: 0.35, fly: 0.75, punch: 0.3, windup: 0.3 };

  async function show(id) {
    const f = await get(id);
    for (const g of Object.values(figures)) g.holder.visible = g === f;
    current = f;
    place(0);
  }
  function place(dt) {
    const f = current;
    if (!f) return;
    // standing on the plinth (or floating over it)
    const up = lift[pose] ?? 0;
    f.lift = dt === 0 ? up : damp(f.lift ?? up, up, 4, dt);
    f.holder.position.set(0, 0.22 + f.hipHeight + f.lift, 0);
    f.holder.rotation.y = yaw;
    const lean = pose === 'fly' ? 1.25 : 0;
    f.body.rotation.set(dt === 0 ? lean : damp(f.body.rotation.x, lean, 5, dt), 0, 0);
    // footage: one of his own clips, round and round (standing, his idle's breathing)
    const clip = pose.startsWith('clip:') ? pose.slice(5) : pose === 'stand' ? 'idle' : null;
    if (clip && f.act(clip, { fade: 0.35 })) {
      f.tick(dt);
      return;
    }
    // a pose, laid over his hover (or his idle) where he has it
    const P = POSES[pose] ?? POSES.stand;
    const targets = typeof P === 'function' ? P(time) : P;
    f.act((lift[pose] ?? 0) > 0 ? 'hover' : 'idle', { fade: 0.35 });
    if (dt === 0) f.snap(targets);
    else f.pose(targets, dt, 6);
    f.tick(dt);
  }

  function render(dt) {
    time += dt;
    held = Math.max(0, held - dt);
    if (!held) yaw += spin * dt;
    place(dt);
    ring.material.color.copy(hot(0x5fc8ff, 2 + Math.sin(time * 2.2) * 0.5));
    const f = current;
    const h = f ? f.height : 1.8;
    camera.position.set(0, 0.95 + h * 0.32, 6.1 + h * 0.4);
    camera.lookAt(0, 0.22 + h * 0.55, 0);
    engine.render();
  }

  return {
    engine,
    show,
    setPose(p) {
      pose = p;
    },
    turn(dx) {
      yaw += dx;
      held = 2;
    },
    setSpin(on) {
      spin = on && !calm ? 0.35 : 0;
    },
    render,
    snap: () => render(0),
    resize: (w, h) => engine.resize(w, h),
    dispose() {
      for (const f of Object.values(figures)) f.dispose();
      engine.dispose();
    },
  };
}
