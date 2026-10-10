// The page scripts/light-fixture.mjs --camera opens: lane C's camera
// fixture (docs/superpowers/plans/2026-10-10-bf-fidelity-laneC-cameras.md).
// A figure with a wall 0.6 m behind it and a corner to its right, seen
// through the soldier camera (src/lib/three/camera/soldier.js) on the rig
// (rig.js), the arm cast at the wall with a raycaster; a scripted 3 s orbit
// that starts with the camera pressed against the wall, so the shots show
// the arm drawn in, blended round the corner and let back out. The node
// renderer, WebGPU or (?gpu=webgl) on WebGL 2.

import * as THREE from 'three/webgpu';
import cameras from '../../src/data/bf2017/cameras.json';
import { createCameraRig } from '../../src/lib/three/camera/rig.js';
import { createSoldierMemo, soldierPose } from '../../src/lib/three/camera/soldier.js';
import { createWebGPU } from '../../src/runtime/webgpu.js';

const q = new URLSearchParams(location.search);
const canvas = document.querySelector('canvas');
const state = { error: null, ready: false };
window.__cam = state;
window.addEventListener('error', (e) => (state.error ??= String(e.message)));
window.addEventListener('unhandledrejection', (e) => (state.error ??= String(e.reason?.stack ?? e.reason)));

const RAD = Math.PI / 180;
const ORBIT = 3; // s
const SWEEP = 180; // degrees over the orbit

try {
  const gfx = await createWebGPU(canvas, { forceWebGL: q.get('gpu') === 'webgl', alpha: false });
  gfx.setSize(innerWidth, innerHeight);
  gfx.setRatio(1);
  const renderer = gfx.renderer;
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fb4c8);
  scene.add(new THREE.HemisphereLight(0xdfe8f0, 0x6a6258, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(6, 10, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
  scene.add(sun);
  const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), mat(0xe6e9ee));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  const figure = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.1, 6, 16), mat(0x3d5a80));
  figure.position.y = 0.85;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.25), mat(0xee6c4d));
  nose.position.set(0, 0.55, 0.3);
  figure.add(nose);
  // the wall behind (its face at z = −0.6) and the corner's wall to the figure's right (x = −1.2)
  const back = new THREE.Mesh(new THREE.BoxGeometry(8, 3.2, 0.3), mat(0xb5838d));
  back.position.set(2.8, 1.6, -0.75);
  const side = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.2, 6), mat(0x6d6875));
  side.position.set(-1.35, 1.6, 2.4);
  for (const m of [figure, nose, back, side]) m.castShadow = m.receiveShadow = true;
  scene.add(ground, figure, back, side);
  // (the raycaster reads the world matrices: set before the first frame)
  scene.updateMatrixWorld(true);
  const walls = [back, side];

  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.12, 400);
  const rig = createCameraRig(camera, { listener: cameras.rows.soldier.listener, shake: { factor: cameras.rows.soldier.shake } });
  const memo = createSoldierMemo();
  const ray = new THREE.Raycaster();
  const o = new THREE.Vector3();
  const d = new THREE.Vector3();
  const castArm = (from, dir, len) => {
    ray.set(o.set(...from), d.set(...dir));
    ray.far = len;
    const hit = ray.intersectObjects(walls, false)[0];
    return hit ? hit.distance : null;
  };
  let t = 0;
  let last = null;
  const log = { maxStep: 0, minArm: Infinity, behindWall: 0, frames: 0 };
  // the orbit: from straight behind (the camera against the wall) round to the figure's front
  const yawAt = (s) => (Math.min(s, ORBIT) / ORBIT) * SWEEP * RAD;
  const step = (dt) => {
    t += dt;
    const pose = soldierPose({ at: [0, 0, 0] }, cameras.rows, { yaw: yawAt(t), pitch: 8 * RAD, dt, castArm, memo });
    rig.set(pose);
    rig.update(dt);
    if (last) log.maxStep = Math.max(log.maxStep, Math.hypot(pose.at[0] - last[0], pose.at[1] - last[1], pose.at[2] - last[2]));
    log.minArm = Math.min(log.minArm, pose.arm);
    // (the camera on the far side of a wall's face: a clip)
    if (pose.at[2] < -0.6 && Math.abs(pose.at[0] - 2.8) < 4) log.behindWall++;
    if (pose.at[0] < -1.2 && pose.at[2] > -0.6 && pose.at[2] < 5.4) log.behindWall++;
    log.frames++;
    last = pose.at;
    return pose;
  };
  // (the camera starts settled where it stands, facing the figure's way)
  step(0);
  const px = new Uint8Array(4);
  const sync = async () => {
    const b = renderer.backend;
    if (b?.device) await b.device.queue.onSubmittedWorkDone();
    else b?.gl?.readPixels(0, 0, 1, 1, b.gl.RGBA, b.gl.UNSIGNED_BYTE, px);
  };
  await gfx.compile?.(scene, camera);
  Object.assign(state, {
    ready: true,
    backend: gfx.backend,
    // on to second `s` of the orbit at 60 frames a second, then drawn
    async to(s) {
      while (t < s - 1e-9) step(Math.min(1 / 60, s - t));
      renderer.render(scene, camera);
      await sync();
      return { t, arm: memo.len, yaw: yawAt(t) / RAD, at: camera.position.toArray() };
    },
    log: () => ({ ...log }),
  });
} catch (e) {
  state.error = String(e?.stack ?? e);
}
