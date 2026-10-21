// The night outside Bag End’s round window, in 3D and at its own size
// (./valar.js has who is in its sky): the garden falling away from the
// window to the hedge and the gate, Gandalf at the gate with his pipe (the
// cast’s own model, ../road/cast.js, fetched the first time the window is
// looked through), the lane going down the Hill past the Party Tree and
// its lanterns to the Water, the smials’ lit windows across it, trees
// everywhere, fireflies in the garden, the hills beyond; and over it all the
// sky: the Milky Way, Eru Ilúvatar’s light at the top, the Valar under it
// as constellations. The land is lit by the moon in its own colours (baked
// in as it is made, with the night’s haze by distance), so the outside
// costs the room no light of its own; and, as the Ring’s dread rises, the
// Eye comes up over the eastern hills.
//
//   createOutside({ mats, size, tier, rt }) → { group, sky, gandalf (to pick), eru (to pick),
//     wake() (fetch Gandalf), pick(hit) → { kind, id, item } | null, light(id, on), act(id),
//     tick(dt, { dread, camera }), dispose() }
//   heightAt(x, z) → the land’s height there (pure, for the checks)

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { fbm, makeCanvas, makeNoise } from '../../../lib/paint';
import { brush, circle, rand } from './brush';
import { stars as starDots } from './props';
import { canvasMap } from './mats';
import { eyeMaterial } from './eye';
import { walker } from '../road/cast';
import { ERU, GANDALF, VALAR, nearestStar } from './valar';

export const WINDOW = { x: 0.32, y: 0.43, z: -0.75, r: 0.25 };
export const GROUND = -1.15; // the garden, under the window: Bag End looks down over it
const SKY = { z: -230, h: 142, top: 112 }; // the sky’s painting: its middle half holds the Valar (box 0…1)
const SKY_W = SKY.h * 2;
const skyPoint = ([u, v]) => [WINDOW.x + (0.25 + u * 0.5 - 0.5) * SKY_W, SKY.top - v * SKY.h, SKY.z + 1];
export const GATE = [WINDOW.x + 2.1, -8.5]; // where Gandalf stands: in the right-hand pane
const LANE = [[WINDOW.x + 2.1, -8.5], [WINDOW.x - 2, -20], [WINDOW.x - 9, -40], [WINDOW.x - 6, -62], [WINDOW.x + 4, -85], [WINDOW.x + 12, -108]];
const WATER = -21.5;

const noise = makeNoise(91);
const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// the land: the garden nearly level, then the Hill falling to the Water,
// and the far side rising in rolling hills
export function heightAt(x, z) {
  const d = Math.max(0, -z - 1);
  const fall = -24 * smooth(3, 95, d);
  const rise = 34 * smooth(125, 215, d);
  const roll = (fbm(noise, x / 38, z / 38, { octaves: 4 }) - 0.5) * 9 * smooth(8, 60, d);
  const bank = (fbm(noise, x / 90 + 7, z / 90, { octaves: 2 }) - 0.5) * 14 * smooth(140, 220, d);
  return GROUND + fall + rise + roll + bank + (fbm(noise, x / 4, z / 4, { octaves: 2 }) - 0.5) * 0.25;
}
const MOON = new THREE.Vector3(-0.45, 0.65, 0.6).normalize(); // from where the moon lights the land
const HAZE = new THREE.Color('#16223e');

// a colour for the land at a point: by moonlight, hazed by distance
function shadeAt(base, normal, dist, out) {
  const lit = 0.35 + 0.65 * Math.max(0, normal.dot(MOON));
  out.copy(base).multiplyScalar(lit);
  return out.lerp(HAZE, Math.min(0.85, Math.max(0, (dist - 15) / 190)));
}
const toLane = (x, z) => {
  let best = Infinity;
  for (let i = 0; i < LANE.length - 1; i++) {
    const [ax, az] = LANE[i];
    const [bx, bz] = LANE[i + 1];
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
    best = Math.min(best, Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t)));
  }
  return best;
};

// the sky, painted: twice as wide as it is tall, the Valar in its middle half
function skyArt(px) {
  const w = px * 2;
  const h = px;
  const c = makeCanvas(w, h);
  const b = brush(c.getContext('2d'), w, h, { seed: 71, ppm: w / SKY_W });
  b.fill([[0, 0], [1, 0], [1, 1], [0, 1]], { v: ['#03051a', '#1a2a52'], mid: '#0b1434', at: 0.6 });
  const { ctx } = b;
  ctx.save();
  ctx.translate(w * 0.5, h * 0.42);
  ctx.rotate(-0.32);
  const g = ctx.createLinearGradient(0, -h * 0.14, 0, h * 0.14);
  g.addColorStop(0, 'rgba(160, 170, 220, 0)');
  g.addColorStop(0.5, 'rgba(170, 180, 230, 0.2)');
  g.addColorStop(1, 'rgba(160, 170, 220, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(-w, -h * 0.14, w * 2, h * 0.28);
  ctx.restore();
  starDots(b, { n: 1600, box: [0, 0, 1, 0.85], colour: '#e8ecff' });
  b.stipple(null, { n: 900, size: 0.12, colour: '#f2f4ff', alpha: 0.6, box: [0, 0.05, 1, 0.8], where: (x, y) => Math.max(0, 1 - Math.abs(y - (0.42 + (x - 0.5) * 0.33)) * 7) });
  const X = (u) => 0.25 + u * 0.5;
  // Eru’s light: the Flame Imperishable, rays going out from it
  const [ex, ey] = [X(ERU.at[0]), ERU.at[1]];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const len = i % 2 ? 0.05 : 0.11;
    b.line([[ex, ey], [ex + Math.cos(a) * len, ey + Math.sin(a) * len * 2]], { width: 0.25, colour: '#fff4d0', alpha: 0.2, twice: false });
  }
  b.glow(ex, ey, 22, '#fff2c8', 0.9);
  b.fill(circle(ex, ey, 0.004), '#ffffff');
  // the Valar, each a figure of stars joined by faint lines
  for (const v of VALAR) {
    b.glow(X(v.at[0]), v.at[1], 9, '#7a8ad8', 0.35);
    for (const [i, j] of v.lines)
      b.line(
        [
          [X(v.stars[i][0]), v.stars[i][1]],
          [X(v.stars[j][0]), v.stars[j][1]],
        ],
        { width: 0.22, colour: '#c8d4ff', alpha: 0.4, twice: false },
      );
    for (const [x, y, s = 1] of v.stars) {
      b.glow(X(x), y, 1.6 * s, '#dfe6ff', 0.95);
      b.fill(circle(X(x), y, 0.0012 * s), '#ffffff');
    }
  }
  // Eärendil, the evening star, low in the west
  b.glow(X(0.04), 0.66, 3, '#e8f4ff', 1).fill(circle(X(0.04), 0.66, 0.0018), '#ffffff');
  return c;
}

// a soft round light, white, for the instanced lights to tint
function softArt() {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return c;
}

export function createOutside({ mats, size = 1, tier = 'high', rt = null }) {
  const group = new THREE.Group();
  const made = [];
  const keep = (x) => (made.push(x), x);
  const low = tier === 'low';
  const basic = (opts = {}) => keep(new MeshBasicNodeMaterial({ fog: false, ...opts }));
  const r = rand(4);
  const n3 = new THREE.Vector3();
  const col = new THREE.Color();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  // ---------------------------------------------------------------- the land
  const seg = low ? 64 : 110;
  const land = keep(new THREE.PlaneGeometry(260, 240, seg, seg));
  land.rotateX(-Math.PI / 2);
  land.translate(WINDOW.x, 0, -121);
  const pos = land.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  land.computeVertexNormals();
  const nrm = land.attributes.normal;
  const colours = new Float32Array(pos.count * 3);
  const grass = new THREE.Color('#2c4a36');
  const dirt = new THREE.Color('#7a6a52');
  const base = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const lane = Math.max(0, 1 - toLane(x, z) / 1.6);
    base.copy(grass).lerp(dirt, lane * 0.85).multiplyScalar(0.7 + fbm(noise, x / 3, z / 3, { octaves: 3 }) * 0.6);
    n3.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
    shadeAt(base, n3, Math.hypot(x - WINDOW.x, z + 1), col);
    colours.set([col.r, col.g, col.b], i * 3);
  }
  land.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  group.add(new THREE.Mesh(land, basic({ vertexColors: true })));
  // the Water, the night sky in it
  const water = new THREE.Mesh(keep(new THREE.PlaneGeometry(200, 26)), basic({ color: 0x24345a }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(WINDOW.x + 10, WATER, -118);
  group.add(water);

  // ---------------------------------------------------------------- the lights: one instanced draw for all of them
  const soft = keep(canvasMap(softArt()));
  const lightMat = basic({ map: soft, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const lights = new THREE.InstancedMesh(keep(new THREE.PlaneGeometry(1, 1)), lightMat, 160);
  lights.frustumCulled = false;
  const L = []; // { at, size, colour, level, kind, phase }
  const addLight = (at, s, colour, extra = {}) => L.push({ at: at.clone(), size: s, colour: new THREE.Color(colour), level: 1, phase: r() * 6, ...extra });
  // the smials’ windows across the Water, and a few down the Hill
  for (let i = 0; i < (low ? 20 : 34); i++) {
    const x = WINDOW.x - 90 + r() * 180;
    const z = -140 - r() * 40;
    addLight(new THREE.Vector3(x, heightAt(x, z) + 0.6, z), 1.6 + r(), r() < 0.8 ? '#ffc870' : '#ffe2a0', { kind: 'window' });
  }
  for (const [x, z] of [[WINDOW.x - 14, -28], [WINDOW.x + 16, -34], [WINDOW.x - 22, -48], [WINDOW.x + 9, -70]]) addLight(new THREE.Vector3(x, heightAt(x, z) + 0.5, z), 1.1, '#ffc870', { kind: 'window' });
  // the Party Tree’s lanterns
  const PARTY = [WINDOW.x - 15, -55];
  const partyY = heightAt(...PARTY);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    addLight(new THREE.Vector3(PARTY[0] + Math.cos(a) * 4.5, partyY + 5 + Math.sin(i * 1.3) * 1.2, PARTY[1] + Math.sin(a) * 4.5), 0.9, ['#ff7a5a', '#ffd25a', '#8aff7a', '#7ac8ff'][i % 4], { kind: 'lantern' });
  }
  // fireflies in the garden, drifting
  for (let i = 0; i < (low ? 8 : 18); i++) addLight(new THREE.Vector3(WINDOW.x - 6 + r() * 12, GROUND + 0.4 + r() * 1.2, -3 - r() * 8), 0.12, '#d8ff8a', { kind: 'fly' });
  const gy = heightAt(...GATE);
  // Gandalf’s pipe, and the moon
  const pipeLight = L.length;
  addLight(new THREE.Vector3(GATE[0] + 0.12, gy + 1.55, GATE[1] + 0.55), 0.18, '#ffa04a', { kind: 'pipe' });
  addLight(new THREE.Vector3(WINDOW.x - 60, 70, SKY.z + 5), 18, '#f2ecd8', { kind: 'moon' });
  // Eru’s light and the Valar: glows on the sky, woken when pointed at
  addLight(new THREE.Vector3(...skyPoint(ERU.at)), 26, '#fff4d8', { kind: 'eru', level: 0.55 });
  const valaLight = new Map();
  for (const v of VALAR) {
    valaLight.set(v.id, L.length);
    addLight(new THREE.Vector3(...skyPoint(v.at)), 24, '#b8c8ff', { kind: 'vala', level: 0, want: 0, pulse: 0 });
  }
  lights.count = L.length;
  group.add(lights);

  // ---------------------------------------------------------------- trees, everywhere but the lane and the Water
  const trunkGeo = keep(new THREE.CylinderGeometry(0.18, 0.28, 2.6, 6));
  trunkGeo.translate(0, 1.3, 0);
  const crownGeo = keep(new THREE.IcosahedronGeometry(2.2, 1));
  // (lumpy, as leaves are)
  const cp = crownGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    n3.set(cp.getX(i), cp.getY(i), cp.getZ(i));
    n3.multiplyScalar(1 + (fbm(noise, n3.x * 0.9 + 3, n3.y * 0.9 + n3.z * 0.5, { octaves: 2 }) - 0.5) * 0.45);
    cp.setXYZ(i, n3.x, n3.y * 0.85, n3.z);
  }
  crownGeo.computeVertexNormals();
  crownGeo.translate(0, 3.6, 0);
  // (the moon on them, from the upper left, made once into their colours)
  const cn = crownGeo.attributes.normal;
  const shadeV = new Float32Array(cn.count * 3);
  for (let i = 0; i < cn.count; i++) {
    n3.set(cn.getX(i), cn.getY(i), cn.getZ(i));
    const k = 0.45 + 0.85 * Math.max(0, n3.dot(MOON));
    shadeV.set([k, k, k * 1.1], i * 3);
  }
  crownGeo.setAttribute('color', new THREE.BufferAttribute(shadeV, 3));
  const crownMat = basic({ vertexColors: true });
  const trunks = new THREE.InstancedMesh(trunkGeo, basic({ color: 0x2a1e16 }), 90);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, 90);
  let nTrees = 0;
  const plant = (x, z, s, leaf) => {
    if (nTrees >= 90) return;
    const y = heightAt(x, z);
    if (y < WATER + 0.8) return;
    m4.compose(n3.set(x, y - 0.2, z), q.setFromAxisAngle(up, r() * 6), new THREE.Vector3(s, s * (0.9 + r() * 0.3), s));
    trunks.setMatrixAt(nTrees, m4);
    crowns.setMatrixAt(nTrees, m4);
    const dist = Math.hypot(x - WINDOW.x, z);
    crowns.setColorAt(nTrees, col.set(leaf).multiplyScalar(0.8 + r() * 0.4).lerp(HAZE, Math.min(0.8, Math.max(0, (dist - 20) / 170))));
    nTrees += 1;
  };
  for (let i = 0; nTrees < (low ? 40 : 76) && i < 400; i++) {
    const x = WINDOW.x - 110 + r() * 220;
    const z = -14 - r() * 200;
    if (toLane(x, z) < 4 || Math.hypot(x - PARTY[0], z - PARTY[1]) < 9) continue;
    plant(x, z, 0.7 + r() * 0.7, r() < 0.5 ? '#3a5a34' : '#2f4a2e');
  }
  // the Party Tree, the biggest in the Shire
  plant(PARTY[0], PARTY[1], 2.1, '#3f6a36');
  trunks.count = nTrees;
  crowns.count = nTrees;
  group.add(trunks, crowns);

  // ---------------------------------------------------------------- the garden: the hedge, the gate
  const hedgeMat = mats.lit({ color: 0x2a4a2a, roughness: 1 });
  hedgeMat.fog = false;
  const hedge = new THREE.InstancedMesh(keep(new THREE.IcosahedronGeometry(0.55, 1)), hedgeMat, 40);
  let nh = 0;
  for (let x = WINDOW.x - 9; x < WINDOW.x + 10 && nh < 40; x += 0.7) {
    if (Math.abs(x - GATE[0]) < 1.1) continue;
    const z = GATE[1] + Math.sin(x * 0.7) * 0.3;
    m4.compose(n3.set(x, heightAt(x, z) + 0.15, z), q.identity(), new THREE.Vector3(1.1 + r() * 0.3, 0.55 + r() * 0.25, 0.9));
    hedge.setMatrixAt(nh++, m4);
  }
  hedge.count = nh;
  const wood = mats.lit({ color: 0x5a4632, roughness: 0.9 });
  wood.fog = false;
  const gateBars = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(1, 1, 1)), wood, 12);
  let ng = 0;
  const bar = (x, y, z, w, h, d) => {
    m4.compose(n3.set(x, y, z), q.identity(), new THREE.Vector3(w, h, d));
    gateBars.setMatrixAt(ng++, m4);
  };
  for (const s of [-1, 1]) bar(GATE[0] + s * 0.95, gy + 0.6, GATE[1], 0.12, 1.2, 0.12);
  for (let i = 0; i < 6; i++) bar(GATE[0] - 0.75 + i * 0.3, gy + 0.5, GATE[1] - 0.6, 0.06, 0.9, 0.04);
  bar(GATE[0], gy + 0.85, GATE[1] - 0.6, 1.8, 0.08, 0.05);
  bar(GATE[0], gy + 0.3, GATE[1] - 0.6, 1.8, 0.08, 0.05);
  gateBars.count = ng;
  group.add(hedge, gateBars);

  // ---------------------------------------------------------------- the sky
  const skyMap = keep(canvasMap(skyArt(Math.round(1024 * size)), { aniso: 4 }));
  const sky = new THREE.Mesh(keep(new THREE.PlaneGeometry(SKY_W, SKY.h)), basic({ map: skyMap }));
  sky.position.set(WINDOW.x, SKY.top - SKY.h / 2, SKY.z);
  sky.userData.sky = true;
  group.add(sky);
  // (Eru, to point at: a disc where his light is, not drawn)
  const eru = new THREE.Mesh(keep(new THREE.CircleGeometry(9, 12)), basic({ visible: false }));
  eru.position.set(...skyPoint(ERU.at));
  eru.userData.outside = 'eru';
  group.add(eru);

  // ---------------------------------------------------------------- Gandalf at the gate
  const gandalf = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.45, 0.45, 2, 8)), basic({ visible: false }));
  gandalf.position.set(GATE[0], gy + 1, GATE[1] + 0.3);
  gandalf.userData.outside = 'gandalf';
  group.add(gandalf);
  let wizard = null;
  const wake = () => {
    if (wizard || !rt?.assets?.gltf) return;
    wizard = walker('gandalf', { rt });
    wizard.group.position.set(GATE[0], gy, GATE[1] + 0.3);
    wizard.set({ base: null, speed: 0 });
    group.add(wizard.group);
    wizard.ready.then((ok) => {
      if (!ok || !wizard) return;
      // (lit a little by his own colours, as by the light from the window
      // behind you, so his grey reads against the dark)
      wizard.group.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        o.material.fog = false;
        if (o.material.emissive) {
          o.material.emissive.set(0x8a8478);
          if (o.material.map) o.material.emissiveMap = o.material.map;
          o.material.emissiveIntensity = 0.55;
        }
      });
    });
  };
  // his smoke rings, rising and widening, reused
  const ringGeo = keep(new THREE.TorusGeometry(0.1, 0.022, 6, 24));
  const rings = Array.from({ length: 3 }, () => {
    const m = new THREE.Mesh(ringGeo, basic({ color: 0xd8d4cc, transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false;
    group.add(m);
    return { m, t: -1 };
  });

  // the Eye, over the eastern hills, as the Ring’s dread rises
  const eye = eyeMaterial({ fog: false, additive: true });
  keep(eye.material);
  const eyeMesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(40, 20)), eye.material);
  eyeMesh.position.set(WINDOW.x + 45, 30, -200);
  eyeMesh.visible = false;
  group.add(eyeMesh);

  let t = 0;
  let eruPulse = 0;
  const camPos = new THREE.Vector3();
  const camQ = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  return {
    group,
    sky,
    gandalf,
    eru,
    wake,
    // what a ray’s hit is, out there: Gandalf, Eru, or one of the Valar by where the sky was hit
    pick(hit) {
      const o = hit?.object;
      if (!o) return null;
      if (o.userData.outside === 'gandalf') return { kind: 'gandalf', id: 'gandalf', item: GANDALF };
      if (o.userData.outside === 'eru') return { kind: 'eru', id: 'eru', item: ERU };
      if (o.userData.sky && hit.uv) {
        const at = [(hit.uv.x - 0.25) / 0.5, 1 - hit.uv.y];
        if (Math.hypot(at[0] - ERU.at[0], at[1] - ERU.at[1]) < 0.07) return { kind: 'eru', id: 'eru', item: ERU };
        const v = nearestStar(VALAR, at, 0.09);
        return v ? { kind: 'vala', id: v.id, item: v } : null;
      }
      return null;
    },
    light(id, on) {
      for (const [k, i] of valaLight) L[i].want = on && k === id ? 0.6 : 0;
    },
    act(id) {
      if (id === 'eru') eruPulse = 1;
      else if (id === 'gandalf') {
        const ring = rings.find((x) => x.t < 0) ?? rings[0];
        ring.t = 0;
      } else if (valaLight.has(id)) L[valaLight.get(id)].pulse = 1;
    },
    tick(dt, { dread = 0, camera = null } = {}) {
      t += dt;
      if (camera) {
        camera.getWorldPosition(camPos);
        camera.getWorldQuaternion(camQ);
      }
      eruPulse = Math.max(0, eruPulse - dt * 0.4);
      // every light a quad facing the eye, its colour its brightness
      for (let i = 0; i < L.length; i++) {
        const l = L[i];
        let k = l.level;
        if (l.kind === 'window') k = 0.8 + 0.2 * Math.sin(t * 0.7 + l.phase);
        else if (l.kind === 'lantern') k = 0.75 + 0.25 * Math.sin(t * 2 + l.phase);
        else if (l.kind === 'fly') {
          k = Math.max(0, Math.sin(t * 1.3 + l.phase)) ** 2;
          l.at.x += Math.sin(t * 0.7 + l.phase) * dt * 0.3;
          l.at.y += Math.cos(t * 0.9 + l.phase * 2) * dt * 0.15;
        } else if (l.kind === 'pipe') k = 0.6 + 0.4 * Math.sin(t * 1.3) ** 2;
        else if (l.kind === 'eru') k = 0.55 + 0.12 * Math.sin(t * 0.8) + eruPulse * 0.45;
        else if (l.kind === 'vala') {
          l.pulse = Math.max(0, l.pulse - dt * 0.5);
          l.level += (Math.max(l.want, l.pulse) - l.level) * Math.min(1, dt * 5);
          k = l.level;
        }
        const s = l.size * (l.kind === 'eru' ? 1 + eruPulse * 0.5 : 1);
        m4.compose(l.at, camQ, sc.set(s, s, s));
        lights.setMatrixAt(i, m4);
        lights.setColorAt(i, col.copy(l.colour).multiplyScalar(Math.max(0, k)));
      }
      lights.instanceMatrix.needsUpdate = true;
      if (lights.instanceColor) lights.instanceColor.needsUpdate = true;
      wizard?.tick(dt);
      for (const ring of rings) {
        if (ring.t < 0) continue;
        ring.t += dt;
        const k = ring.t / 4;
        ring.m.visible = k < 1;
        if (k >= 1) {
          ring.t = -1;
          continue;
        }
        const at = L[pipeLight].at;
        ring.m.position.set(at.x + k * 0.6, at.y + 0.2 + k * 2.4, at.z);
        ring.m.scale.setScalar(1 + k * 3);
        ring.m.material.opacity = 0.7 * (1 - k);
        if (camera) ring.m.lookAt(camPos);
      }
      const e = Math.max(0, (dread - 0.15) / 0.85);
      eye.open.value = Math.min(1, e * 1.4);
      eye.power.value = 0.6 + e;
      eyeMesh.visible = e > 0.01;
      eyeMesh.scale.setScalar(0.6 + e * 1.1);
    },
    dispose() {
      for (const x of made) x.dispose();
      wizard?.dispose();
      wizard = null;
      lights.dispose();
      trunks.dispose();
      crowns.dispose();
      hedge.dispose();
      gateBars.dispose();
      hedgeMat.dispose();
      wood.dispose();
    },
  };
}
