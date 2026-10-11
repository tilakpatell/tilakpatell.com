// The galaxy surface's effects and its ships' paint: livery.js against
// liveryNodes.js (a painted hull, its rim and its fill), marks.js against
// marksNodes.js (each way a sheet is drawn), push.js's front (on a
// half-sphere of the dome's shape: the dome itself is a file from the
// bucket), bolts.js's streaks and flashes, and the hvv arena's wall
// (hvvScene.js's GLSL, copied here as it builds it, against nodes/hvv.js).
import * as THREE from 'three';
import * as LO from '../../../src/components/universe/livery.js';
import * as LN from '../../../src/components/universe/liveryNodes.js';
import * as MO from '../../../src/lib/three/fx/marks.js';
import * as MN from '../../../src/lib/three/fx/marksNodes.js';
import * as BO from '../../../src/lib/three/combat/bolts.js';
import * as BN from '../../../src/lib/three/combat/boltsNodes.js';
import * as PO from '../../../src/lib/three/fx/push.js';
import * as PN from '../../../src/lib/three/fx/pushNodes.js';
import { wallGeometry } from '../../../src/components/galaxy/surface/missions/hvvScene.js';
import { wallMaterial } from '../../../src/components/galaxy/surface/nodes/hvv.js';

// a hull's texture: plain grey panels, a red stripe, a dark vent
const hullMap = () => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#9a9ca0';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#7d8084';
  for (let i = 0; i < 64; i += 16) g.fillRect(i, 0, 2, 64);
  g.fillStyle = '#c0302a';
  g.fillRect(0, 26, 64, 10);
  g.fillStyle = '#101012';
  g.fillRect(44, 44, 14, 14);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
const livery = (L) => ({ scene, camera }) => {
  camera.position.set(2.5, 1.5, 3.5);
  camera.lookAt(0, 0, 0);
  // the fill, from the rim's way (lighting.js's: the livery finds it by its direction)
  const fill = new THREE.DirectionalLight(0x6688ff, 1.5);
  fill.position.set(-4, 1, -2);
  scene.add(fill);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.38, 100, 16), new THREE.MeshStandardMaterial({ map: hullMap(), roughness: 0.6, metalness: 0.1 })));
  scene.add(root);
  const l = L.createLivery();
  l.apply(root, { mid: 0.32, marks: [0.5, 0.7], dark: [0.03, 0.06, 0.5], keep: 0.02 });
  l.set({ hull: '#2f6fb0', trim: '#f0c020' });
  l.rim({ colour: [0.4, 0.5, 1], dir: fill.position.clone().normalize(), key: new THREE.Color(1, 0.9, 0.8) });
};

// a 2 × 2 sheet: a disc in red, rays in green, a ring in blue, each a frame
const sheet = () => {
  const n = 64;
  const d = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const fx = ((x % 32) - 16) / 16;
      const fy = ((y % 32) - 16) / 16;
      const r = Math.hypot(fx, fy);
      const i = (y * n + x) * 4;
      d[i] = r < 0.8 ? 255 * (1 - r / 0.8) : 0;
      d[i + 1] = Math.abs(Math.sin(Math.atan2(fy, fx) * 4)) > 0.8 && r < 1 ? 255 : 0;
      d[i + 2] = Math.abs(r - 0.7) < 0.12 ? 255 : 0;
      d[i + 3] = 255;
    }
  const t = new THREE.DataTexture(d, n, n);
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  t.userData.look = { grid: [2, 2], name: 'impact', channels: { burst: 'g' } };
  return t;
};
const ramp = () => {
  const d = new Uint8Array(32 * 4);
  for (let i = 0; i < 32; i++) d.set([Math.min(255, i * 16), Math.max(0, i * 8 - 40), Math.max(0, i * 8 - 160), 255], i * 4);
  const t = new THREE.DataTexture(d, 32, 1);
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  t.userData.look = { rampV: 0.5 };
  return t;
};
const ground = (scene) => scene.add(new THREE.Mesh(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8a7a66, roughness: 0.9 })));
const marks = (M, mode, { withRamp = true, fog = false } = {}) => ({ scene }) => {
  ground(scene);
  if (fog) scene.fog = new THREE.Fog(0x203040, 4, 12);
  const fx = M.createSheetFx(scene, { texture: sheet(), ramp: withRamp ? ramp() : null, mode, channel: mode === 'sprite' ? 'g' : 'r', count: 6, life: 1 });
  const up = new THREE.Vector3(0, 1, 0);
  const tint = mode.startsWith('decal') ? [0.15, 0.1, 0.08] : [1, 0.8, 0.6];
  [[0, 0.02, 0], [1.6, 0.02, -0.4], [-1.4, 0.02, 0.8]].forEach(([x, y, z], i) => {
    const at = new THREE.Vector3(x, mode === 'sprite' ? 0.8 : y, z);
    fx.add(at, mode === 'sprite' ? new THREE.Vector3(0, 0, 1) : up, { size: 1.4, frame: i, tint, bright: 1.2, spin: i * 0.7, grow: 0.5 });
  });
  fx.update(0.25);
};
const push = (pushMaterial) => ({ scene, camera }) => {
  camera.position.set(3, 1.5, 3);
  camera.lookAt(0, 0, 1);
  const group = new THREE.Group();
  scene.add(group);
  const geo = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2);
  for (const [i, colour] of ['#c8d8ff', '#ffb0a0'].entries()) {
    const mat = pushMaterial();
    mat.uniforms.uColour.value.set(colour);
    mat.uniforms.uAge.value = 0.2 + i * 0.3;
    const m = new THREE.Mesh(geo, mat);
    m.position.set(i * 1.5 - 0.75, 0.5, 0);
    m.scale.set(1.2, 1.2, 0.6);
    group.add(m);
  }
};
const bolts = (B, look) => ({ scene, camera }) => {
  camera.position.set(0, 1.5, 5);
  camera.lookAt(0, 1, 0);
  const d = B.createBoltMeshes(scene, { look: null });
  if (look) d.setLook({ burst: sheet(), ramp: ramp() });
  d.sync([
    { pos: [1, 1, 0], dir: [1, 0, 0], flown: 2, colour: '#4aa8ff' },
    { pos: [-0.5, 1.6, 0], dir: [0, 0.3, 1], flown: 1, colour: '#ff3b30' },
  ]);
  d.flash([0, 1, 0]);
  d.flash([-1.5, 0.6, 0.5]);
  d.update(0.05);
};
const wall = (node) => ({ scene, camera }) => {
  camera.position.set(0, 2, 7);
  camera.lookAt(0, 1, 0);
  ground(scene);
  const points = Array.from({ length: 24 }, (_, i) => [Math.cos((i / 24) * Math.PI * 2) * 4, Math.sin((i / 24) * Math.PI * 2) * 4]);
  const geo = wallGeometry(points, (x, z) => 0.1 * x + 0.05 * z);
  const mat = node ? wallMaterial() : classicWall();
  mat.uniforms.uTime.value = 2.3;
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 5;
  scene.add(m);
};
// hvvScene.js keeps its wall's GLSL to itself; this is it, verbatim
const classicWall = () =>
  new THREE.ShaderMaterial({
    vertexShader: `
attribute float v;
varying float vV;
void main() { vV = v; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
varying float vV;
uniform vec3 uColor;
uniform float uTime;
void main() {
  float a = (1.0 - vV) * (1.0 - vV) * (0.32 + 0.08 * sin(uTime * 1.6 + vV * 6.0));
  gl_FragColor = vec4(uColor * 1.6, a);
}`,
    uniforms: { uColor: { value: new THREE.Color('#bcd8ff') }, uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

export default {
  'fx:livery': { node: livery(LN), classic: livery(LO) },
  'fx:marks:decal': { node: marks(MN, 'decal', { withRamp: false }), classic: marks(MO, 'decal', { withRamp: false }) },
  'fx:marks:decal-colour': { node: marks(MN, 'decal-colour'), classic: marks(MO, 'decal-colour') },
  'fx:marks:glow': { node: marks(MN, 'glow'), classic: marks(MO, 'glow') },
  'fx:marks:glow-cooling': { node: marks(MN, 'glow', { withRamp: false, fog: true }), classic: marks(MO, 'glow', { withRamp: false, fog: true }) },
  'fx:marks:sprite': { node: marks(MN, 'sprite'), classic: marks(MO, 'sprite') },
  'fx:bolts': { node: bolts(BN, false), classic: bolts(BO, false) },
  'fx:bolts:look': { node: bolts(BN, true), classic: bolts(BO, true) },
  'fx:hvv:wall': { node: wall(true), classic: wall(false) },
  'fx:push': { node: push(PN.pushMaterial), classic: push(PO.pushMaterial) },
};
