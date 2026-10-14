// The arena's shell: input, three.js drawing and the fixed-step loop around the
// pure rules in sim.js. Everything drawn is a placeholder shape in a flat
// colour; no extracted or game-derived asset is loaded (docs/prototype/ARCHITECTURE.md).
import * as THREE from 'three';
import { COVERS, RULES, createWorld, step } from './sim.js';

const DT = 1 / 30;
const TEAM_COLOURS = [0x3b82f6, 0xef4444];
const hud = document.getElementById('hud');
const canvas = document.getElementById('view');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f1722);
scene.fog = new THREE.Fog(0x0f1722, 25, 70);
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x223344, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(10, 20, 5);
scene.add(sun);

let world = createWorld({ seed: (Math.random() * 1e9) | 0 });
const half = world.half;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, half * 2), new THREE.MeshStandardMaterial({ color: 0x2b3a4a }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
for (const c of COVERS) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(c.hx * 2, 2, c.hz * 2), new THREE.MeshStandardMaterial({ color: 0x6b7a8c }));
  m.position.set(c.x, 1, c.z);
  scene.add(m);
}

const body = new THREE.CapsuleGeometry(RULES.radius * 0.8, 0.9, 4, 8);
const mats = TEAM_COLOURS.map((color) => new THREE.MeshStandardMaterial({ color }));
const actorMeshes = world.actors.map((a) => {
  const m = new THREE.Mesh(body, mats[a.team]);
  scene.add(m);
  return m;
});
const boltGeo = new THREE.BoxGeometry(0.08, 0.08, 0.9);
const boltMats = TEAM_COLOURS.map((color) => new THREE.MeshBasicMaterial({ color }));
const boltPool = [];

// input: WASD to move, the mouse to turn (click to lock it), click or space to fire
const keys = new Set();
let yaw = 0;
let pitch = 0;
let firing = false;
addEventListener('keydown', (e) => { keys.add(e.code); if (e.code === 'KeyR' && world.over) restart(); });
addEventListener('keyup', (e) => keys.delete(e.code));
canvas.addEventListener('click', () => Promise.resolve(canvas.requestPointerLock?.()).catch(() => {})); // (a denied lock just leaves the mouse free)
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  yaw -= e.movementX * 0.0025;
  pitch = Math.max(-0.5, Math.min(0.5, pitch - e.movementY * 0.0025));
});
addEventListener('mousedown', () => { firing = true; });
addEventListener('mouseup', () => { firing = false; });

function restart() {
  world = createWorld({ seed: (Math.random() * 1e9) | 0 });
  yaw = 0;
}

const forward = () => ({ x: Math.sin(yaw), z: Math.cos(yaw) });
function readInput() {
  const f = forward();
  const r = { x: f.z, z: -f.x }; // (to the player's right, with yaw 0 facing +z)
  const fwd = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  const side = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  return { mx: f.x * fwd - r.x * side, mz: f.z * fwd - r.z * side, yaw, fire: firing || keys.has('Space') };
}

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

let last = performance.now();
let owed = 0;
function frame(now) {
  owed += Math.min(0.25, (now - last) / 1000);
  last = now;
  const input = readInput();
  while (owed >= DT) { step(world, input, DT); owed -= DT; }

  world.actors.forEach((a, i) => {
    const m = actorMeshes[i];
    m.visible = a.dead <= 0;
    m.position.set(a.x, 0.9, a.z);
    m.rotation.y = a.yaw;
  });
  while (boltPool.length < world.bolts.length) {
    const b = new THREE.Mesh(boltGeo, boltMats[0]);
    scene.add(b);
    boltPool.push(b);
  }
  boltPool.forEach((m, i) => {
    const b = world.bolts[i];
    m.visible = Boolean(b);
    if (!b) return;
    m.material = boltMats[b.team];
    m.position.set(b.x, 1.1, b.z);
    m.rotation.y = Math.atan2(b.vx, b.vz);
  });

  const me = world.actors[0];
  camera.position.set(me.x, 1.6, me.z);
  camera.rotation.set(pitch, yaw + Math.PI, 0, 'YXZ');
  renderer.render(scene, camera);

  const status = world.over ? `${world.winner === 0 ? 'Blue wins' : 'Red wins'} · R to play again` : me.dead > 0 ? `Down · back in ${me.dead.toFixed(1)} s` : `Health ${Math.max(0, me.hp)}`;
  hud.textContent = `Blue ${world.score[0]} · Red ${world.score[1]} (first to ${RULES.target}) · ${status}`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
