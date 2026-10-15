// The trench run in WebGL, for devices with a graphics chip. It draws the
// same simulation (./trench.js) that the 2D canvas does; the 2D canvas stays
// on top for the HUD. Loaded only when 3D is on, so nobody else downloads it.
//
// The world: the simulation's x across and y up, and its z (distance along
// the run) running down -Z here. The camera rides just behind and above the
// X-wing. Textures are painted once on a canvas at start; the trench's detail
// is a few instanced meshes; lasers, bolts and engines glow through bloom.
// The X-wing is the site owner's Meshy model once it loads; until then (or
// if it never does) one built from simple shapes, the same size. The TIEs
// fly as ./ties.js says a pilot would (facing you as they close, banking,
// rolling off a near miss, their guns flashing as they fire), and Vader's
// TIE Advanced comes in over you with his wingmen, and spins away at the end.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { gen3dUrlChecked } from '../../lib/three/gen3d';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { TRENCH, portZ } from './trench';
import { CAMERA_BACK, createTieLife, vaderFlight } from './ties';
import { precompile, precompilePasses, quiet } from '../../lib/three/renderer';
import { paintGasGiant, paintPlating, starSprite } from './plating';
import { pixelRatio } from '../../lib/device';
import { houseOn } from '../../lib/three/house';
import { loadGltfFile } from '../../lib/three/gltf';
import { sharpen } from '../../lib/three/textures';
import { createFeel, feelGroups } from '../../lib/three/feel';
import { BLOOMS } from './look';

const LENGTH = 340; // how much station to build, in units
const SHIP_AHEAD = 0.55; // the X-wing sits this far ahead of the simulation's z
const CAM_BACK = CAMERA_BACK;

function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function texture(canvas, repeatX, repeatY, renderer, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Bright colours for things that glow: above 1, so bloom picks them up.
const hot = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

// The built X-wing, nose towards -Z: its hull (hidden when the model comes),
// and the engine glows and cannon tips (which stay, moved onto the model).
function buildXwing() {
  const g = new THREE.Group();
  const shell = new THREE.Group();
  g.add(shell);
  const hull = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 0.25, roughness: 0.55 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x8a9098, metalness: 0.4, roughness: 0.5 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x23272d, roughness: 0.4, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.065, 0.52), hull);
  shell.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.22, 4), hull);
  nose.rotation.x = -Math.PI / 2;
  nose.rotation.y = Math.PI / 4;
  nose.position.z = -0.37;
  shell.add(nose);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.1), dark);
  canopy.position.set(0, 0.045, -0.05);
  shell.add(canopy);
  const droid = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), new THREE.MeshStandardMaterial({ color: 0x3a6ad8, roughness: 0.4 }));
  droid.position.set(0, 0.045, 0.08);
  shell.add(droid);
  const glowMat = new THREE.MeshBasicMaterial({ color: hot(0xff8a5a, 1.8), toneMapped: false });
  const tipMat = new THREE.MeshBasicMaterial({ color: hot(0xff4030, 0.4), toneMapped: false });
  const tips = [];
  const glows = [];
  for (const a of [0.42, Math.PI - 0.42, Math.PI + 0.42, -0.42]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.012, 0.15), hull);
    wing.position.set(Math.cos(a) * 0.19, Math.sin(a) * 0.19, 0.08);
    wing.rotation.z = a;
    shell.add(wing);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.014, 0.14), red);
    stripe.position.set(Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0.08);
    stripe.rotation.z = a;
    shell.add(stripe);
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.2, 10), grey);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(Math.cos(a) * 0.065, Math.sin(a) * 0.065, 0.06);
    shell.add(engine);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.021, 12), glowMat);
    glow.position.set(Math.cos(a) * 0.065, Math.sin(a) * 0.065, 0.161);
    g.add(glow);
    glows.push(glow);
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.34, 6), grey);
    cannon.rotation.x = Math.PI / 2;
    cannon.position.set(Math.cos(a) * 0.35, Math.sin(a) * 0.35, -0.04);
    shell.add(cannon);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), tipMat);
    tip.position.set(Math.cos(a) * 0.35, Math.sin(a) * 0.35, -0.21);
    g.add(tip);
    tips.push(tip);
  }
  return { group: g, shell, tipMat, glowMat, glows, tips };
}

// The Meshy X-wing: 2 long, nose +Z, wings in a shallow X. Where its engines'
// nozzles (their back faces, about 0.09 across) and its wingtip cannons'
// muzzles are, as fractions of its half-width, half-height and half-length
// from its middle (it's the same on all four wings, mirrored).
const XW_MODEL = { engine: [0.224, 0.574, -1], cannon: [0.94, 0.84, 0.3] };
const XW_LENGTH = 0.75; // the built one's, nose tip to tail
const XW_MID = -0.11; // and where its middle is along z

// Put the model in place of the built hull: turned nose -Z, scaled to the
// built one's length and centred where it was, with the four engine glows on
// its nozzles and the four cannon tips on its muzzles.
function mountXwing(xw, model) {
  const box = new THREE.Box3().setFromObject(model);
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  model.position.sub(box.getCenter(new THREE.Vector3()));
  const holder = new THREE.Group();
  holder.add(model);
  holder.scale.setScalar(XW_LENGTH / Math.max(half.z * 2, 1e-6));
  holder.rotation.y = Math.PI;
  holder.position.z = XW_MID;
  holder.updateMatrix();
  // a point on the model's wing at (sx, sy) of its own, in the ship's units, nudged dz along z
  const at = ([x, y, z], sx, sy, dz) => new THREE.Vector3(sx * x * half.x, sy * y * half.y, z * half.z).applyMatrix4(holder.matrix).add(new THREE.Vector3(0, 0, dz));
  const quads = [[1, 1], [-1, 1], [-1, -1], [1, -1]]; // the order the built ones go round in
  quads.forEach(([sx, sy], i) => {
    xw.glows[i].position.copy(at(XW_MODEL.engine, -sx, sy, 0.004)); // (turned half round, so x mirrors)
    xw.glows[i].scale.setScalar(0.85);
    xw.tips[i].position.copy(at(XW_MODEL.cannon, -sx, sy, -0.01));
  });
  model.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if ('metalness' in m) m.metalness = 0.2;
      if ('roughness' in m) m.roughness = 0.6;
    }
  });
  xw.shell.visible = false;
  xw.group.add(holder);
}

// a model that came too late
function disposeModel(model) {
  model.traverse((o) => {
    o.geometry?.dispose();
    for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
      m.map?.dispose();
      m.dispose();
    }
  });
}

// A TIE fighter, front (the window) towards +Z: a ball cockpit with its
// spoked round window, two tapered pylons with collars, and the hexagonal
// wings, each a dark solar panel inside a frame of six edges, six spokes and
// a hub.
function hexShape(r) {
  const s = new THREE.Shape();
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 3;
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}
function tieParts() {
  const R = 0.3;
  const panel = new THREE.ShapeGeometry(hexShape(R));
  // the shape's UVs are in its own units; map them to 0..1 for the panel texture
  const uv = panel.attributes.uv;
  const pos = panel.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / (2 * R) + 0.5, pos.getY(i) / (2 * R) + 0.5);
  panel.rotateY(Math.PI / 2);
  const tex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(128, 128, 10, 128, 128, 150);
    gr.addColorStop(0, '#1f252d');
    gr.addColorStop(1, '#11151a');
    x.fillStyle = gr;
    x.fillRect(0, 0, 256, 256);
    x.strokeStyle = 'rgba(120,135,150,0.22)';
    x.lineWidth = 1;
    for (let i = 4; i < 256; i += 7) {
      x.beginPath();
      x.moveTo(0, i);
      x.lineTo(256, i);
      x.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    sharpen(t);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const bar = (len, w = 0.016) => new THREE.BoxGeometry(w, w, len);
  const verts = Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 2 + (i * Math.PI) / 3;
    return [Math.cos(a) * R, Math.sin(a) * R];
  });
  return {
    R,
    verts,
    panel,
    edge: bar(R),
    spoke: bar(R, 0.012),
    hub: new THREE.CylinderGeometry(0.055, 0.055, 0.035, 14).rotateZ(Math.PI / 2),
    ball: new THREE.SphereGeometry(0.1, 28, 18),
    bezel: new THREE.CylinderGeometry(0.064, 0.07, 0.03, 24).rotateX(Math.PI / 2),
    glass: new THREE.CircleGeometry(0.056, 24),
    winSpoke: new THREE.BoxGeometry(0.004, 0.056, 0.004),
    pylon: new THREE.CylinderGeometry(0.02, 0.034, 0.2, 12).rotateZ(Math.PI / 2),
    collar: new THREE.TorusGeometry(0.036, 0.009, 8, 18).rotateY(Math.PI / 2),
    hatch: new THREE.CylinderGeometry(0.035, 0.04, 0.03, 16).rotateX(Math.PI / 2),
    gun: new THREE.SphereGeometry(0.016, 10, 8),
    gunGlow: new THREE.MeshBasicMaterial({ color: hot(0x7dff5a, 3.4), toneMapped: false }),
    // Vader's TIE Advanced: its longer hull, and the wings bent in top and bottom
    rearHull: new THREE.CylinderGeometry(0.06, 0.085, 0.24, 16).rotateX(Math.PI / 2),
    bentPanel: new THREE.BoxGeometry(0.012, 0.2, 0.4),
    midPanel: new THREE.BoxGeometry(0.012, 0.16, 0.4),
    spar: new THREE.BoxGeometry(0.02, 0.16, 0.02),
    hull: new THREE.MeshStandardMaterial({ color: 0xaab1ba, metalness: 0.6, roughness: 0.32 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x8f97a1, metalness: 0.65, roughness: 0.35 }),
    solar: new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, metalness: 0.3, roughness: 0.45, side: THREE.DoubleSide }),
    darkGlass: new THREE.MeshStandardMaterial({ color: 0x06080b, metalness: 0.9, roughness: 0.12 }),
  };
}
function buildTie(P) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(P.ball, P.hull));
  const bezel = new THREE.Mesh(P.bezel, P.hull);
  bezel.position.z = 0.09;
  g.add(bezel);
  const glass = new THREE.Mesh(P.glass, P.darkGlass);
  glass.position.z = 0.106;
  g.add(glass);
  for (let i = 0; i < 8; i++) {
    const sp = new THREE.Mesh(P.winSpoke, P.frame);
    sp.rotation.z = (i * Math.PI) / 4;
    sp.position.set(Math.sin((i * Math.PI) / 4) * -0.028, Math.cos((i * Math.PI) / 4) * 0.028, 0.108);
    g.add(sp);
  }
  const hatch = new THREE.Mesh(P.hatch, P.frame);
  hatch.position.z = -0.095;
  g.add(hatch);
  // its two guns under the window, which flash as it fires (./ties.js)
  g.userData.guns = [-1, 1].map((side) => {
    const gun = new THREE.Mesh(P.gun, P.gunGlow);
    gun.position.set(side * 0.032, -0.066, 0.085);
    gun.visible = false;
    g.add(gun);
    return gun;
  });
  for (const side of [-1, 1]) {
    const pylon = new THREE.Mesh(P.pylon, P.hull);
    pylon.position.x = side * 0.18;
    if (side < 0) pylon.rotation.y = Math.PI;
    g.add(pylon);
    const collar = new THREE.Mesh(P.collar, P.frame);
    collar.position.x = side * 0.09;
    g.add(collar);
    const wing = new THREE.Group();
    wing.position.x = side * 0.29;
    wing.add(new THREE.Mesh(P.panel, P.solar));
    const hub = new THREE.Mesh(P.hub, P.frame);
    wing.add(hub);
    P.verts.forEach(([y, z], i) => {
      const [y2, z2] = P.verts[(i + 1) % 6];
      const edge = new THREE.Mesh(P.edge, P.frame);
      edge.position.set(0, (y + y2) / 2, (z + z2) / 2);
      edge.rotation.x = -Math.atan2(y2 - y, z2 - z);
      wing.add(edge);
      const spoke = new THREE.Mesh(P.spoke, P.frame);
      spoke.position.set(0, y / 2, z / 2);
      spoke.rotation.x = -Math.atan2(y, z);
      wing.add(spoke);
    });
    g.add(wing);
  }
  return g;
}

// Vader's TIE Advanced x1, front (the window) towards +Z: the ball cockpit,
// its longer hull behind, and the wings bent in toward it top and bottom,
// a solar panel each part, a spar down the middle of each.
function buildTieAdvanced(P) {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(P.ball, P.hull);
  ball.scale.setScalar(1.08);
  g.add(ball);
  const rear = new THREE.Mesh(P.rearHull, P.hull);
  rear.position.z = -0.13;
  g.add(rear);
  const bezel = new THREE.Mesh(P.bezel, P.hull);
  bezel.position.z = 0.095;
  g.add(bezel);
  const glass = new THREE.Mesh(P.glass, P.darkGlass);
  glass.position.z = 0.112;
  g.add(glass);
  const FOLD = 0.55; // how far the outer halves bend in
  for (const side of [-1, 1]) {
    const pylon = new THREE.Mesh(P.pylon, P.hull);
    pylon.position.x = side * 0.18;
    if (side < 0) pylon.rotation.y = Math.PI;
    g.add(pylon);
    const wing = new THREE.Group();
    wing.position.x = side * 0.29;
    wing.add(new THREE.Mesh(P.midPanel, P.solar));
    wing.add(new THREE.Mesh(P.spar, P.frame));
    for (const up of [-1, 1]) {
      const half = new THREE.Mesh(P.bentPanel, P.solar);
      half.rotation.z = side * up * FOLD;
      half.position.set(-side * Math.sin(FOLD) * 0.1, up * (0.08 + Math.cos(FOLD) * 0.1), 0);
      wing.add(half);
    }
    g.add(wing);
  }
  return g;
}

export function createTrench3D(canvas, { onLost, onSlow } = {}) {
  const renderer = quiet(new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false }));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // (the tone is the house’s: houseOn, below, maps it Neutral and lifts this
  // exposure by its 1.4, as bright as ACES had it; ./look.js)
  renderer.toneMappingExposure = 1.05;
  const maxRatio = pixelRatio(1.75); // lib/device: lower on a phone or a weak device
  let ratio = maxRatio;
  renderer.setPixelRatio(ratio);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04050a);
  // something for metal to reflect: a soft studio, dimmed for the dark of space
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = envMap;
  scene.environmentIntensity = 0.32;
  scene.fog = new THREE.FogExp2(0x05060c, 0.038);
  const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.05, 420);

  const trAmbient = new THREE.AmbientLight(0x6a7488, 0.55);
  const trHemi = new THREE.HemisphereLight(0x8a9ac0, 0x0a0a12, 0.45);
  scene.add(trAmbient, trHemi);
  const sun = new THREE.DirectionalLight(0xfff0dc, 1.7);
  sun.position.set(-4, 7, 3);
  scene.add(sun);
  scene.add(sun.target);
  const blast = new THREE.PointLight(0xffa860, 0, 6, 2);
  scene.add(blast);

  // ── the station ──
  // painted plating with real relief (normal and roughness maps), sized to the device
  const big = renderer.capabilities.maxTextureSize >= 4096 && !(window.matchMedia?.('(pointer: coarse)').matches ?? false);
  const tex = big ? 1024 : 512;
  const surf = paintPlating({ seed: 7, size: tex, kind: 'surface' });
  const side = paintPlating({ seed: 19, size: tex, kind: 'wall' });
  const plating = (p, rx, ry, extra = {}) =>
    new THREE.MeshStandardMaterial({
      map: texture(p.color, rx, ry, renderer),
      normalMap: texture(p.normal, rx, ry, renderer, false),
      roughnessMap: texture(p.rough, rx, ry, renderer, false),
      emissiveMap: texture(p.lit, rx, ry, renderer),
      emissive: new THREE.Color(1.5, 1.25, 0.95),
      metalness: 0.32,
      roughness: 1,
      normalScale: new THREE.Vector2(1.1, 1.1),
      ...extra,
    });
  const surfaceMat = plating(surf, 15, LENGTH / 2);
  const wallMat = plating(side, LENGTH / 2, 1);
  const floorMat = plating(surf, 1, LENGTH / 2, { color: 0x9aa0a8, emissive: new THREE.Color(0.4, 0.34, 0.26) });
  const add = (mesh) => {
    scene.add(mesh);
    return mesh;
  };
  for (const sd of [-1, 1]) {
    const s = add(new THREE.Mesh(new THREE.PlaneGeometry(30, LENGTH), surfaceMat));
    s.rotation.x = -Math.PI / 2;
    s.position.set(sd * 16, 1, -LENGTH / 2 + 12);
    const w = add(new THREE.Mesh(new THREE.PlaneGeometry(LENGTH, 2), wallMat));
    w.rotation.y = sd < 0 ? Math.PI / 2 : -Math.PI / 2;
    w.position.set(sd, 0, -LENGTH / 2 + 12);
  }
  const floor = add(new THREE.Mesh(new THREE.PlaneGeometry(2, LENGTH), floorMat));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -1, -LENGTH / 2 + 12);

  // pipe runs down both walls, with collars every few metres
  {
    const pipeGeo = new THREE.CylinderGeometry(0.035, 0.035, 6, 10, 1, true);
    const collarGeo = new THREE.CylinderGeometry(0.048, 0.048, 0.08, 10);
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x8c939c, metalness: 0.7, roughness: 0.35 });
    const runs = [];
    for (const sd of [-1, 1]) for (const y of [0.55, -0.35, -0.72]) runs.push([sd, y]);
    const per = Math.ceil(LENGTH / 6);
    const pipes = new THREE.InstancedMesh(pipeGeo, pipeMat, runs.length * per);
    const collars = new THREE.InstancedMesh(collarGeo, pipeMat, runs.length * per);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    let n = 0;
    for (const [sd, y] of runs) {
      for (let i = 0; i < per; i++) {
        const z = 12 - i * 6 - 3;
        m.compose(new THREE.Vector3(sd * 0.955, y, z), q, new THREE.Vector3(1, 1, 1));
        pipes.setMatrixAt(n, m);
        m.compose(new THREE.Vector3(sd * 0.955, y, z - 3), q, new THREE.Vector3(1, 1, 1));
        collars.setMatrixAt(n, m);
        n += 1;
      }
    }
    pipes.instanceMatrix.needsUpdate = true;
    collars.instanceMatrix.needsUpdate = true;
    add(pipes);
    add(collars);
  }

  // guide lights along the foot of each wall: they streak past at speed
  {
    const lampGeo = new THREE.BoxGeometry(0.05, 0.02, 0.22);
    const lampMat = new THREE.MeshBasicMaterial({ color: hot(0xffc27a, 2.2), toneMapped: false });
    const per = Math.ceil(LENGTH / 2.5);
    const lamps = new THREE.InstancedMesh(lampGeo, lampMat, per * 2);
    const m = new THREE.Matrix4();
    let n = 0;
    for (const sd of [-1, 1]) {
      for (let i = 0; i < per; i++) {
        m.makeTranslation(sd * 0.96, -0.97, 12 - i * 2.5);
        lamps.setMatrixAt(n++, m);
      }
    }
    lamps.instanceMatrix.needsUpdate = true;
    add(lamps);
  }

  // greebles: blocks on the trench walls and on the surface either side
  {
    const rand = rng(31);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.35, roughness: 0.62, normalMap: texture(surf.normal, 0.5, 0.5, renderer, false) });
    const wallCount = 900;
    const surfCount = 700;
    const inst = new THREE.InstancedMesh(box, mat, wallCount + surfCount);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    let i = 0;
    for (; i < wallCount; i++) {
      const side = rand() < 0.5 ? -1 : 1;
      const d = 0.04 + rand() * 0.14;
      const h = 0.06 + rand() * 0.4;
      const len = 0.2 + rand() * 1.1;
      m.compose(new THREE.Vector3(side * (1 - d / 2), -0.92 + rand() * 1.84, -rand() * LENGTH + 10), q, new THREE.Vector3(d, h, len));
      inst.setMatrixAt(i, m);
      const v = 0.3 + rand() * 0.28;
      inst.setColorAt(i, c.setRGB(v, v * 1.02, v * 1.08));
    }
    for (; i < wallCount + surfCount; i++) {
      const side = rand() < 0.5 ? -1 : 1;
      const h = 0.03 + rand() * rand() * 0.45;
      const w = 0.15 + rand() * rand() * 1.1;
      m.compose(new THREE.Vector3(side * (1.25 + rand() * 9), 1 + h / 2, -rand() * LENGTH + 10), q, new THREE.Vector3(w, h, 0.15 + rand() * rand() * 1.2));
      inst.setMatrixAt(i, m);
      const v = 0.22 + rand() * 0.22;
      inst.setColorAt(i, c.setRGB(v, v * 1.02, v * 1.07));
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    add(inst);
  }

  // the stars, far off, moving with the camera
  const stars = (() => {
    const rand = rng(5);
    const n = 1800;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = rand() * 2 - 1;
      const th = rand() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      pos.set([Math.cos(th) * r * 300, Math.abs(u) * 300, Math.sin(th) * r * 300], i * 3); // beyond Yavin
      const k = 0.6 + rand() * 0.8;
      const tint = rand();
      col.set(tint < 0.15 ? [k, k * 0.85, k * 0.7] : tint < 0.3 ? [k * 0.8, k * 0.9, k] : [k, k, k], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const sprite = new THREE.CanvasTexture(starSprite());
    sharpen(sprite);
    sprite.colorSpace = THREE.SRGBColorSpace;
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.4, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false, map: sprite, transparent: true, alphaTest: 0.02 }));
    scene.add(pts);
    return pts;
  })();

  // Yavin, the gas giant, and its fourth moon, low in the sky
  const sky = new THREE.Group();
  {
    const giantTex = new THREE.CanvasTexture(paintGasGiant({ w: big ? 1024 : 512, h: big ? 512 : 256 }));
    sharpen(giantTex);
    giantTex.colorSpace = THREE.SRGBColorSpace;
    const giant = new THREE.Mesh(new THREE.SphereGeometry(26, 48, 32), new THREE.MeshLambertMaterial({ map: giantTex, fog: false }));
    giant.rotation.z = 0.3;
    giant.position.set(46, 30, -120);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 16), new THREE.MeshLambertMaterial({ color: 0x6f8f62, fog: false }));
    moon.position.set(14, 22, -96);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(27.5, 48, 32), new THREE.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.08, side: THREE.BackSide, fog: false, depthWrite: false }));
    glow.position.copy(giant.position);
    sky.add(giant, moon, glow);
    scene.add(sky);
  }

  // the exhaust port, two metres across, at the end of the trench
  const port = new THREE.Group();
  {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), new THREE.MeshBasicMaterial({ color: 0x020203 }));
    const rim = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 32), new THREE.MeshStandardMaterial({ color: 0xb8c0c8, metalness: 0.7, roughness: 0.35 }));
    port.add(hole, rim);
    port.rotation.x = -Math.PI / 2;
    port.position.set(0, -0.985, -portZ());
    scene.add(port);
  }
  const portGlowMat = new THREE.MeshBasicMaterial({ color: hot(0xffb347, 2), toneMapped: false, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
  const portGlow = new THREE.Group();
  for (const [a, b] of [[0.42, 0.46], [0.6, 0.63]]) portGlow.add(new THREE.Mesh(new THREE.RingGeometry(a, b, 40), portGlowMat));
  portGlow.rotation.x = -Math.PI / 2;
  portGlow.position.set(0, -0.98, -portZ());
  scene.add(portGlow);

  // ── the ships ──
  const xw = buildXwing();
  scene.add(xw.group);
  // the generated model (scripts/gen3d: TRELLIS.2 from a render of the Meshy
  // one, five times the detail), when it comes: its shaders made first, so it
  // doesn't stall a frame
  let disposed = false;
  let house = null; // (the house look, set below once the scene is built)
  gen3dUrlChecked('x-wing') // the cut for this device's detail level (its .ultra one where it has one)
    .then((url) => loadGltfFile(url))
    .then(async ({ scene: model }) => {
      if (disposed || lost) return disposeModel(model);
      house?.adopt(model); // (in the house look, as the rest)
      await precompile(renderer, model, camera, scene, composer.readBuffer); // (drawn through the composer)
      if (disposed || lost) return disposeModel(model);
      mountXwing(xw, model);
    })
    .catch(() => {}); // the built one stays
  const tieParts_ = tieParts();
  const ties = Array.from({ length: 12 }, () => {
    const t = buildTie(tieParts_);
    t.scale.setScalar(1.25);
    t.rotation.order = 'YXZ'; // (turned to face, then pitched, then rolled)
    t.visible = false;
    scene.add(t);
    return t;
  });
  // Vader and his two wingmen, seen as he joins and as he goes (./ties.js)
  const vaderShip = buildTieAdvanced(tieParts_);
  const wingmen = [buildTie(tieParts_), buildTie(tieParts_)];
  for (const m of [vaderShip, ...wingmen]) {
    m.scale.setScalar(1.3);
    m.rotation.order = 'YXZ';
    m.visible = false;
    scene.add(m);
  }
  let tieLife = createTieLife();
  let run = null; // the run drawn last, and its time then
  let runT = 0;
  let joinedAt = null; // when Vader joined it

  // ── what flies: lasers, bolts, torpedoes, explosions ──
  const laserGeo = new THREE.BoxGeometry(0.014, 0.014, 1.1);
  const laserMat = new THREE.MeshBasicMaterial({ color: hot(0xff3a26, 4), toneMapped: false });
  const boltGeo = new THREE.BoxGeometry(0.02, 0.02, 1.3);
  const boltMat = new THREE.MeshBasicMaterial({ color: hot(0x7dff5a, 3.4), toneMapped: false });
  const pool = (n, geo, mat) =>
    Array.from({ length: n }, () => {
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      scene.add(m);
      return m;
    });
  const lasers = pool(32, laserGeo, laserMat);
  const bolts = pool(48, boltGeo, boltMat);
  const torpMat = new THREE.MeshBasicMaterial({ color: hot(0xb8dcff, 5), toneMapped: false });
  const torps = pool(4, new THREE.SphereGeometry(0.05, 12, 10), torpMat);
  // the station going up: a soft fireball, and a shockwave across the floor
  const fireTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,240,1)');
    gr.addColorStop(0.25, 'rgba(255,214,140,0.95)');
    gr.addColorStop(0.55, 'rgba(255,120,40,0.55)');
    gr.addColorStop(1, 'rgba(255,60,10,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    sharpen(t);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  // torpedoes in flight (a glow and a trail), the fireballs where they go
  // off, and the scorch marks they leave on the floor and walls
  const flightGlow = Array.from({ length: 2 }, () => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, color: hot(0x9fd0ff, 3.2), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
    sp.scale.setScalar(0.32);
    sp.visible = false;
    scene.add(sp);
    return sp;
  });
  const trailGeo = new THREE.CylinderGeometry(0.004, 0.022, 1.6, 8, 1, true);
  trailGeo.rotateX(Math.PI / 2); // along z, thin end trailing
  trailGeo.translate(0, 0, 0.8);
  const trailMat = new THREE.MeshBasicMaterial({ color: hot(0x88bbff, 2.4), transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const trails = pool(2, trailGeo, trailMat);
  const blastSprites = Array.from({ length: 6 }, () => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, color: hot(0xffc890, 2.6), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
    sp.visible = false;
    scene.add(sp);
    return sp;
  });
  const scorchTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(6,5,4,0.92)');
    gr.addColorStop(0.45, 'rgba(18,14,11,0.7)');
    gr.addColorStop(1, 'rgba(18,14,11,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 128, 128);
    // a few streaks thrown out from the middle
    x.strokeStyle = 'rgba(10,8,6,0.5)';
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + Math.sin(i * 7.3) * 0.3;
      x.lineWidth = 2 + (i % 3);
      x.beginPath();
      x.moveTo(64 + Math.cos(a) * 18, 64 + Math.sin(a) * 18);
      x.lineTo(64 + Math.cos(a) * (40 + (i % 4) * 6), 64 + Math.sin(a) * (40 + (i % 4) * 6));
      x.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    sharpen(t);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const scorchMat = new THREE.MeshBasicMaterial({ map: scorchTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const scorchGeo = new THREE.PlaneGeometry(1, 1);
  const scorches = pool(TRENCH.torpedo.scorches, scorchGeo, scorchMat);
  const boom = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, color: hot(0xffe0b0, 2.4), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
  boom.visible = false;
  scene.add(boom);
  const shock = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 96), new THREE.MeshBasicMaterial({ color: hot(0xbfe2ff, 2.2), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
  shock.rotation.x = -Math.PI / 2;
  shock.visible = false;
  scene.add(shock);
  const sparks = (() => {
    const n = 140;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.07, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    pts.frustumCulled = false;
    scene.add(pts);
    return pts;
  })();

  // ── the course: obstacles, towers and turrets for this run ──
  const course = new THREE.Group();
  scene.add(course);
  const shared = {
    catwalk: new THREE.MeshStandardMaterial({ color: 0xb8bec6, metalness: 0.45, roughness: 0.5 }),
    band: new THREE.MeshStandardMaterial({ color: 0x3a3f47, metalness: 0.4, roughness: 0.6 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x8e949c, metalness: 0.35, roughness: 0.6 }),
    tower: new THREE.MeshStandardMaterial({ color: 0x7c828a, metalness: 0.35, roughness: 0.6 }),
    gun: new THREE.MeshBasicMaterial({ color: hot(0xff6a4a, 2.4), toneMapped: false }),
    turret: new THREE.MeshStandardMaterial({ color: 0x5c626c, metalness: 0.5, roughness: 0.5 }),
  };
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const gunGeo = new THREE.SphereGeometry(0.035, 8, 6);
  let built = null;
  const itemMeshes = [];
  const towerMeshes = [];
  const clearCourse = () => {
    course.clear();
    itemMeshes.length = 0;
    towerMeshes.length = 0;
  };
  const buildCourse = (g) => {
    clearCourse();
    built = g;
    for (const it of g.items) {
      let m = null;
      if (it.kind === 'catwalk') {
        m = new THREE.Group();
        const deck = new THREE.Mesh(boxGeo, shared.catwalk);
        deck.scale.set(2, 0.2, 0.26);
        const band = new THREE.Mesh(boxGeo, shared.band);
        band.scale.set(2.01, 0.06, 0.27);
        band.position.y = -0.07;
        const rail = new THREE.Mesh(boxGeo, shared.band);
        rail.scale.set(2, 0.03, 0.03);
        rail.position.set(0, 0.16, -0.1);
        m.add(deck, band, rail);
        m.position.set(0, it.y, -it.z);
      } else if (it.kind === 'wall') {
        m = new THREE.Mesh(boxGeo, shared.wall);
        m.scale.set(1.05, 2, 0.3);
        m.position.set(it.side < 0 ? -0.475 : 0.475, 0, -it.z);
      } else if (it.kind === 'turret') {
        m = new THREE.Group();
        const body = new THREE.Mesh(boxGeo, shared.turret);
        body.scale.set(0.16, 0.22, 0.24);
        const barrel = new THREE.Mesh(boxGeo, shared.turret);
        barrel.scale.set(0.16, 0.03, 0.03);
        barrel.position.x = -it.side * 0.12;
        const gun = new THREE.Mesh(gunGeo, shared.gun);
        gun.position.x = -it.side * 0.2;
        m.add(body, barrel, gun);
        m.position.set(it.side * 0.92, it.y, -it.z);
      } else if (it.kind === 'bolt') {
        m = new THREE.Mesh(boltGeo, boltMat);
      }
      if (m) course.add(m);
      itemMeshes.push(m);
    }
    for (const tw of g.towers) {
      const m = new THREE.Group();
      const body = new THREE.Mesh(boxGeo, shared.tower);
      body.scale.set(0.32, tw.h, 0.32);
      body.position.y = tw.h / 2;
      const cap = new THREE.Mesh(boxGeo, shared.band);
      cap.scale.set(0.4, 0.06, 0.4);
      cap.position.y = tw.h;
      const gun = new THREE.Mesh(gunGeo, shared.gun);
      gun.position.y = tw.h + 0.07;
      m.add(body, cap, gun);
      m.position.set(tw.x, 1, -tw.z);
      course.add(m);
      towerMeshes.push(m);
    }
  };

  // ── post: bloom for everything that glows ──
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), BLOOMS.trench.strength, BLOOMS.trench.radius, BLOOMS.trench.threshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  let useBloom = true;

  let size = { w: 1, h: 1 };
  const resize = (w, h) => {
    size = { w: Math.max(1, w), h: Math.max(1, h) };
    renderer.setPixelRatio(ratio);
    renderer.setSize(size.w, size.h, false);
    composer.setPixelRatio(ratio);
    composer.setSize(size.w, size.h);
    bloom.resolution.set(size.w / 2, size.h / 2);
    camera.aspect = size.w / size.h;
    camera.updateProjectionMatrix();
  };

  // the GPU can go away (a driver reset, too many tabs): tell the page
  let lost = false;
  const onContextLost = (e) => {
    e.preventDefault();
    lost = true;
    onLost?.();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  // Frames that really can't keep up: drop the pixel ratio, then bloom, then
  // tell the page. Judged on real time every few seconds, and only below
  // about 25 fps: a laptop saving battery caps animation at 30 fps (33 ms a
  // frame), and that is not a machine struggling.
  const perf = { acc: 0, n: 0, last: performance.now(), told: false };
  const watch = () => {
    const t = performance.now();
    const gap = t - perf.last;
    perf.last = t;
    if (gap > 500) {
      perf.acc = perf.n = 0; // back from a pause, or off screen
      return;
    }
    perf.acc += gap;
    perf.n += 1;
    if (perf.acc < 3000) return;
    const avg = perf.acc / perf.n;
    perf.acc = perf.n = 0;
    // (36 ms: over a battery saver's even 30, under the site's floor of 30 fps)
    if (avg < 36) return;
    if (ratio > 1) {
      ratio = 1;
      resize(size.w, size.h);
    } else if (useBloom) useBloom = false;
    else if (avg > 60 && !perf.told) {
      perf.told = true;
      onSlow?.();
    }
  };

  const tmp = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const zAxis = new THREE.Vector3(0, 0, 1);
  // the shake: the run's (a hit 0.3, a torpedo's blast 0.22, the station
  // going up) as the feel's trauma, held at least that while the run holds
  // it; `calm` (reduced motion) is the caller's, a frame at a time
  const feel = createFeel({ calm: false, baseFov: camera.fov, offset: 0.2 });
  let feelT = 0;

  // (the frame time is measured here, not taken from the caller)
  // eslint-disable-next-line no-unused-vars
  function render(g, ms = 16, { calm = false } = {}) {
    if (lost) return;
    if (g.items && g !== built && g.towers) buildCourse(g);
    const t = g.t ?? 0;
    const z = g.z;
    // camera, just behind and above the X-wing, easing with it
    const bank = (g.tx - g.px) * 1.5;
    camera.position.set(g.px * 0.9, g.py * 0.92 + 0.42, -z + CAM_BACK);
    camera.lookAt(g.px * 0.7, g.py * 0.86 + 0.28, -z - 9);
    camera.rotateZ(-bank * 0.12);
    const want = (g.shake ?? 0) + (g.win?.boom ? Math.max(0, 0.9 - (g.win.t - 0.6)) * 0.67 : 0);
    const has = feel.state().trauma;
    if (want > has) feel.trauma(want - has);
    // (by the run's clock: still while it's paused, none across a new run)
    const fdt = Math.max(0, Math.min(0.1, t - feelT));
    feelT = t;
    if (!calm) feel.update(fdt, camera);
    stars.position.copy(camera.position);
    sky.position.set(camera.position.x * 0.2, 0, camera.position.z);
    sun.position.set(camera.position.x - 4, 7, camera.position.z + 3);
    sun.target.position.set(camera.position.x, 0, camera.position.z - 6);

    // the X-wing
    const ship = xw.group;
    ship.visible = g.status !== 'won';
    ship.position.set(g.px, g.py - 0.06, -(z + SHIP_AHEAD));
    ship.rotation.set((g.ty - g.py) * 0.5, -(g.tx - g.px) * 0.25, -bank);
    const firing = (g.laserCool ?? 0) > TRENCH.laser.cooldown - 0.05;
    xw.tipMat.color.copy(firing ? hot(0xff4030, 5) : hot(0xff4030, 0.4));
    xw.glowMat.color.setRGB(1.9 + Math.sin(t * 30) * 0.25, 0.85, 0.55);

    // the run's time since the last frame (none for a new run, or one paused)
    if (g !== run) {
      run = g;
      runT = t;
      joinedAt = null;
      tieLife = createTieLife();
    }
    const dt = Math.max(0, Math.min(0.1, t - runT));
    runT = t;

    // TIE fighters: their windows turned to you as they close, banking into
    // their weave, rolling off a near miss, their guns flashing as they fire
    let ti = 0;
    for (const tie of g.ties ?? []) {
      if (!tie.alive || ti >= ties.length) continue;
      const m = ties[ti++];
      m.visible = true;
      m.position.set(tie.x, tie.y, -tie.z);
      const life = tieLife.step(tie, g, g.lasers ?? [], dt);
      m.rotation.set(life.pitch, life.yaw, life.roll + life.jink);
      for (const gun of m.userData.guns) {
        gun.visible = life.flash > 0;
        gun.scale.setScalar(0.6 + life.flash * 0.8);
      }
    }
    for (; ti < ties.length; ti++) ties[ti].visible = false;

    // Vader: in over you as he joins, and away, spinning, when Han clears him
    if (g.vader?.on && joinedAt == null) joinedAt = t;
    const flight = vaderFlight(g.vader, joinedAt == null ? -1 : t - joinedAt, g);
    const hidden = g.status === 'won' || Boolean(g.win?.boom);
    [flight.vader, ...flight.wings].forEach((f, i) => {
      const m = i ? wingmen[i - 1] : vaderShip;
      m.visible = f.visible && !hidden;
      if (!m.visible) return;
      m.position.set(f.x, f.y, -f.z);
      m.rotation.set(f.spin * 0.35, Math.PI, f.roll + f.spin); // (flying on down the trench, the way you go)
    });

    // the course
    if (built === g) {
      g.items.forEach((it, i) => {
        const m = itemMeshes[i];
        if (!m) return;
        if (it.kind === 'bolt') m.position.set(it.x, it.y, -it.z);
        if (it.blasted) m.visible = false;
        else if (it.kind === 'turret') m.visible = it.alive;
      });
      g.towers.forEach((tw, i) => {
        towerMeshes[i].visible = tw.alive;
      });
    }

    // lasers and bolts
    let li = 0;
    for (const l of g.lasers ?? []) {
      if (li >= lasers.length) break;
      const m = lasers[li++];
      m.visible = true;
      m.position.set(l.x, l.y, -(l.z + 0.55));
    }
    for (; li < lasers.length; li++) lasers[li].visible = false;
    let bi = 0;
    for (const b of g.bolts ?? []) {
      if (bi >= bolts.length) break;
      const m = bolts[bi++];
      m.visible = true;
      m.position.set(b.x, b.y, -b.z);
      dir.set(b.vx, b.vy, -b.vz).normalize();
      m.quaternion.setFromUnitVectors(zAxis, dir);
    }
    for (const r of g.rear ?? []) {
      if (bi >= bolts.length) break;
      const m = bolts[bi++];
      m.visible = true;
      m.position.set(r.x, r.y, -(r.z + 0.8));
      m.quaternion.identity();
    }
    for (; bi < bolts.length; bi++) bolts[bi].visible = false;

    // explosions: the simulation's sparks, and a flash of light at the newest
    const pos = sparks.geometry.attributes.position;
    const col = sparks.geometry.attributes.color;
    let si = 0;
    let newest = null;
    for (const f of g.fx ?? []) {
      if (si >= pos.count) break;
      const k = f.t / f.life;
      pos.setXYZ(si, f.x, f.y, -f.z);
      col.setXYZ(si, 3 * (1 - k * 0.3), 1.6 * (1 - k), 0.5 * (1 - k));
      si += 1;
      if (!newest || f.t < newest.t) newest = f;
    }
    for (let i = si; i < pos.count; i++) pos.setXYZ(i, 0, -1000, 0);
    pos.needsUpdate = true;
    col.needsUpdate = true;
    if (newest) {
      blast.position.set(newest.x, newest.y, -newest.z);
      blast.intensity = 6 * Math.max(0, 1 - newest.t / 0.35);
    } else blast.intensity = 0;

    // torpedoes in flight, pitched down as they drop
    let pi = 0;
    for (const s of g.shots ?? []) {
      if (pi >= 2) break;
      const m = torps[pi];
      const glow = flightGlow[pi];
      const tr = trails[pi];
      pi += 1;
      m.visible = glow.visible = tr.visible = true;
      m.position.set(s.x, s.y, -s.z);
      glow.position.copy(m.position);
      glow.scale.setScalar(0.3 + Math.sin(t * 40 + pi) * 0.04);
      tr.position.copy(m.position);
      tr.rotation.x = Math.atan2(s.vy, (g.speed ?? 7) + TRENCH.torpedo.speed);
    }
    for (let i = pi; i < 2; i++) flightGlow[i].visible = trails[i].visible = false;
    // fireballs where they went off
    blastSprites.forEach((sp, i) => {
      const b = g.blasts?.[i];
      sp.visible = !!b;
      if (!b) return;
      const k = b.t / b.life;
      sp.position.set(b.x, b.y + k * 0.2, -b.z);
      sp.scale.setScalar(0.5 + k * 1.6);
      sp.material.opacity = (1 - k) ** 1.4;
    });
    // and the marks they left
    scorches.forEach((m, i) => {
      const sc = g.scorch?.[i];
      m.visible = !!sc;
      if (!sc) return;
      m.scale.setScalar(sc.r * 2.2);
      if (sc.on === 'floor') {
        m.position.set(sc.x, -0.995, -sc.z);
        m.rotation.set(-Math.PI / 2, 0, sc.spin);
      } else {
        const side = Math.sign(sc.x) || 1;
        m.position.set(side * 0.995, sc.y, -sc.z);
        m.rotation.set(0, -side * (Math.PI / 2), sc.spin);
      }
    });
    // the two that go in, curving down into the port
    const winning = g.status === 'winning' && g.win;
    for (let i = 2; i < 4; i++) torps[i].visible = false;
    if (winning && !g.win.boom) {
      const p = Math.min(1, g.win.t / 0.6);
      const e = p * p;
      [-1, 1].forEach((side, i) => {
        const m = torps[2 + i];
        m.visible = true;
        const sx = g.px + side * 0.12;
        m.position.set(sx + (0 - sx) * e, g.py + (-0.95 - g.py) * e + Math.sin(p * Math.PI) * 0.25, -(z + SHIP_AHEAD) + (-portZ() + z + SHIP_AHEAD) * e);
      });
    }
    for (let i = pi; i < 2; i++) torps[i].visible = false;
    // the port: amber as you close in, pulsing in range, green when lined up
    const toPort = portZ() - z;
    const [lo, hi] = TRENCH.window;
    const inWindow = toPort > lo && toPort < hi;
    const lined = Math.abs(g.px) < TRENCH.lined.x && g.py < TRENCH.lined.y;
    portGlow.visible = (g.status === 'running' || g.status === 'winning') && toPort < 30;
    portGlowMat.color.copy(inWindow && lined ? hot(0x78ffa0, 2.6) : hot(0xffb347, 2));
    portGlowMat.opacity = inWindow ? 0.55 + 0.45 * Math.sin(t * 10) : 0.5;
    // the station goes up
    if (g.win?.boom) {
      const e = Math.max(0, g.win.t - 0.6);
      boom.visible = true;
      boom.position.set(0, -0.6, -portZ());
      boom.scale.setScalar(0.6 + Math.min(1, e / 1.1) * 26);
      boom.material.opacity = Math.max(0, 1 - e / 1.9);
      shock.visible = true;
      shock.position.set(0, -0.95, -portZ());
      shock.scale.setScalar(0.5 + e * 22);
      shock.material.opacity = Math.max(0, 1 - e / 1.5);
      blast.position.copy(boom.position);
      blast.distance = 40;
      blast.intensity = 30 * Math.max(0, 1 - e / 1.4);
    } else {
      boom.visible = false;
      shock.visible = false;
      blast.distance = 6;
    }

    if (useBloom) composer.render();
    else renderer.render(scene, camera);
    watch();
  }

  // every shader (the scene's, into the composer's buffer, and the passes')
  // linked in the background: the run waits for this before its first 3D frame
  // the house look (lib/three/house): the shade one colour from the light
  // out here, under the house tone mapper (its exposure lifted from ACES;
  // the fog left as it is), on everything, before the shaders are linked
  house = houseOn({ renderer, scene, sun, hemi: trHemi, ambient: trAmbient, look: { fog: false } });
  const ready = Promise.all([precompile(renderer, scene, camera, scene, composer.readBuffer), precompilePasses(renderer, composer, camera)]);

  // where a point in the world is on screen, in CSS pixels
  const project = (x, y, z) => {
    tmp.set(x, y, -z).project(camera);
    return [((tmp.x + 1) / 2) * size.w, ((1 - tmp.y) / 2) * size.h];
  };

  const dispose = () => {
    disposed = true;
    canvas.removeEventListener('webglcontextlost', onContextLost);
    clearCourse();
    scene.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        for (const k of ['map', 'emissiveMap', 'normalMap', 'roughnessMap']) m[k]?.dispose?.();
        m.dispose?.();
      }
    });
    composer.dispose?.();
    envMap.dispose();
    renderer.dispose();
  };

  // tune(): the ?debug panel's groups (the feel's numbers)
  return { render, resize, project, dispose, ready, tune: () => feelGroups(feel), get lost() { return lost; } };
}
