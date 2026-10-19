// The night outside Bag End’s round window (./valar.js has who is in it):
// the sky, the Milky Way, Eru Ilúvatar’s light at the top of it and the
// Valar under it as constellations; the Water and the hills of Hobbiton
// with their lights; the garden and its gate; and Gandalf at the gate with
// his pipe. Painted flats at their distances behind the wall, unlit and out
// of the room’s fog, so they move against each other as the head moves; and,
// as the Ring’s dread rises, the Eye over the eastern hills.
//
//   createOutside({ mats, size }) → { group, sky, gandalf, eru, pick(hit) → { kind, id, item } | null,
//     light(id, on), act(id), tick(dt, { dread, camera, looking }), dispose() }

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { makeCanvas } from '../../../lib/paint';
import { brush, circle, cutout, smooth, top } from './brush';
import { wizard } from './figures';
import { hedge, oak, stars as starDots } from './props';
import { canvasMap } from './mats';
import { eyeMaterial } from './eye';
import { ERU, GANDALF, VALAR, nearestStar } from './valar';

export const WINDOW = { x: 0.32, y: 0.43, z: -0.75, r: 0.25 };
const SKY = { w: 2.2, h: 2.2, x: WINDOW.x, y: 0.6, z: -2.4 }; // the box’s middle is at x, y
const toSky = ([u, v]) => [SKY.x + (u - 0.5) * SKY.w, SKY.y + (0.5 - v) * SKY.h];

function skyArt(px) {
  const c = makeCanvas(px, px);
  const b = brush(c.getContext('2d'), px, px, { seed: 71, ppm: px / SKY.w });
  b.fill([[0, 0], [1, 0], [1, 1], [0, 1]], { v: ['#04061a', '#1a2a52'], mid: '#0c1434', at: 0.55 });
  // the Milky Way: a soft river of light across, thick with stars
  const { ctx, w, h } = b;
  ctx.save();
  ctx.translate(w * 0.5, h * 0.45);
  ctx.rotate(-0.5);
  const g = ctx.createLinearGradient(0, -h * 0.12, 0, h * 0.12);
  g.addColorStop(0, 'rgba(160, 170, 220, 0)');
  g.addColorStop(0.5, 'rgba(170, 180, 230, 0.22)');
  g.addColorStop(1, 'rgba(160, 170, 220, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(-w, -h * 0.12, w * 2, h * 0.24);
  ctx.restore();
  starDots(b, { n: 900, box: [0, 0, 1, 0.8], colour: '#e8ecff' });
  b.stipple(null, { n: 600, size: 0.0012, colour: '#f2f4ff', alpha: 0.7, box: [0, 0.1, 1, 0.75], where: (x, y) => Math.max(0, 1 - Math.abs(y - (0.45 + (x - 0.5) * 0.55)) * 7) });
  // Eru’s light: the Flame Imperishable, rays going out from it
  const [ex, ey] = ERU.at;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const len = i % 2 ? 0.1 : 0.2;
    b.line([[ex, ey], [ex + Math.cos(a) * len, ey + Math.sin(a) * len]], { width: 0.004, colour: '#fff4d0', alpha: 0.18, twice: false });
  }
  b.glow(ex, ey, 0.5, '#fff2c8', 0.85);
  b.fill(circle(ex, ey, 0.012), '#ffffff');
  // the Valar, each a figure of stars joined by faint lines
  for (const v of VALAR) {
    b.glow(v.at[0], v.at[1], 0.22, '#7a8ad8', 0.35);
    for (const [i, j] of v.lines) b.line([v.stars[i], v.stars[j]], { width: 0.0035, colour: '#c8d4ff', alpha: 0.4, twice: false });
    for (const [x, y, s = 1] of v.stars) {
      b.glow(x, y, 0.035 * s, '#dfe6ff', 0.9);
      b.fill(circle(x, y, 0.0028 * s), '#ffffff');
    }
  }
  // Eärendil, the evening star, low in the west
  b.glow(0.08, 0.7, 0.06, '#e8f4ff', 1).fill(circle(0.08, 0.7, 0.004), '#ffffff');
  return c;
}

// the Water and the hills over it, the lights of Hobbiton across it
const FAR = [[0, 0.42], [0.12, 0.3], [0.28, 0.36], [0.42, 0.26], [0.58, 0.34], [0.72, 0.22], [0.86, 0.32], [1, 0.28]];
function hillsArt(px, ph) {
  const c = makeCanvas(px, ph);
  const b = brush(c.getContext('2d'), px, ph, { seed: 72, ppm: px / 3 });
  b.wash(top(FAR), { v: ['#1a2a30', '#0a1214'], y0: 0.2 }, { edge: 0.2 });
  b.ink(smooth(FAR, { closed: false }), { width: 0.002, colour: '#5a6a88', alpha: 0.5, twice: false });
  for (let i = 0; i < 14; i++) b.clump(0.04 + i * 0.07, 0.36 + Math.sin(i * 1.7) * 0.04, 0.012, '#14201c', { seed: 80 + i, ink: false, lit: 0.1 });
  // the Water, the sky in it
  b.fill([[0, 0.62], [1, 0.58], [1, 0.72], [0, 0.76]], { v: ['#2a3a62', '#101a2a'], y0: 0.58, y1: 0.76 });
  for (let i = 0; i < 30; i++) {
    const x = b.r();
    b.line([[x, 0.63 + b.r() * 0.1], [x + 0.03, 0.63 + b.r() * 0.1]], { width: 0.0015, colour: '#8a9ac8', alpha: 0.4, twice: false });
  }
  b.stipple(top(FAR), { n: 26, size: 0.003, colour: '#ffcf6a', alpha: 1, box: [0.05, 0.42, 0.95, 0.58] });
  b.fill([[0, 0.72], [1, 0.7], [1, 1], [0, 1]], '#0e1610');
  return c;
}

// the garden at the foot of the window: the hedge, the lane, the gate
const NEAR = [[0, 0.3], [0.2, 0.2], [0.38, 0.32], [0.5, 0.36], [0.62, 0.32], [0.8, 0.18], [1, 0.26]];
function gardenArt(px, ph) {
  const c = makeCanvas(px, ph);
  const b = brush(c.getContext('2d'), px, ph, { seed: 73, ppm: px / 2.2 });
  b.wash(top(NEAR), { v: ['#2a3a24', '#0e140c'], y0: 0.2 }, { edge: 0.3 });
  hedge(b, 0.02, 0.36, 0.5, 0.25, { leaf: '#1e2e1a', seed: 3 });
  hedge(b, 0.64, 0.98, 0.5, 0.25, { leaf: '#1e2e1a', seed: 7 });
  oak(b, 0.86, 0.36, 0.34, { seed: 9, leaf: '#1a2a18', light: 0.1 });
  // the gate in the hedge, and the lane going down from it
  for (let i = 0; i < 7; i++) b.line([[0.42 + i * 0.026, 0.58], [0.42 + i * 0.026, 0.42]], { width: 0.004, colour: '#5a4632', twice: false });
  b.line([[0.41, 0.45], [0.59, 0.45]], { width: 0.004, colour: '#5a4632', twice: false });
  b.line([[0.41, 0.53], [0.59, 0.53]], { width: 0.004, colour: '#5a4632', twice: false });
  b.fill(smooth([[0.44, 1], [0.46, 0.62], [0.5, 0.58], [0.54, 0.62], [0.58, 1]]), '#5a5040', 0.9);
  b.stipple(top(NEAR), { n: 120, size: 0.002, colour: '#c8c0a8', alpha: 0.5, box: [0, 0.4, 1, 1] });
  return c;
}

export function createOutside({ mats, size = 1 }) {
  const group = new THREE.Group();
  const made = [];
  const keep = (x) => (made.push(x), x);
  const flat = (map, { alpha = false } = {}) => keep(new MeshBasicNodeMaterial({ map, fog: false, transparent: alpha, alphaTest: alpha ? 0.4 : 0, depthWrite: !alpha }));
  const plane = (w, h, mat, [x, y, z]) => {
    const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, h)), mat);
    m.position.set(x, y, z);
    group.add(m);
    return m;
  };

  const skyMap = keep(canvasMap(skyArt(Math.round(1536 * size))));
  const sky = plane(SKY.w, SKY.h, flat(skyMap), [SKY.x, SKY.y, SKY.z]);
  sky.userData.sky = true;
  const hillsMap = keep(canvasMap(hillsArt(Math.round(1536 * size), Math.round(512 * size))));
  plane(3, 1, flat(hillsMap, { alpha: true }), [WINDOW.x, -0.12, -2.1]);
  const gardenMap = keep(canvasMap(gardenArt(Math.round(1024 * size), Math.round(512 * size))));
  plane(2.2, 1.1, flat(gardenMap, { alpha: true }), [WINDOW.x, -0.18, -1.45]);

  // Gandalf at the gate, his pipe glowing
  const g = wizard({ robe: '#7a7e8a' });
  const gh = 0.36;
  const gMap = keep(canvasMap(cutout(Math.round(220 * size), Math.round(500 * size), g, { ppm: Math.round(500 * size) / gh })));
  const gandalf = plane(gh * g.aspect, gh, flat(gMap, { alpha: true }), [WINDOW.x - 0.03, 0.02, -1.3]);
  gandalf.userData.outside = 'gandalf';
  const pipe = new THREE.Sprite(mats.glow('#ffb04a', 0.9));
  pipe.scale.setScalar(0.03);
  pipe.position.set(WINDOW.x - 0.0, 0.11, -1.29);
  pipe.material.fog = false;
  group.add(pipe);
  // his smoke rings, rising and widening, reused
  const ringGeo = keep(new THREE.TorusGeometry(0.02, 0.004, 6, 24));
  const rings = Array.from({ length: 3 }, () => {
    const m = new THREE.Mesh(ringGeo, keep(new MeshBasicNodeMaterial({ color: 0xd8d4cc, transparent: true, opacity: 0, fog: false, depthWrite: false })));
    m.visible = false;
    group.add(m);
    return { m, t: -1 };
  });

  // Eru’s light, which breathes, and each of the Valar a glow that wakes when touched
  const eru = new THREE.Sprite(mats.glow('#fff4d8', 0.6));
  eru.material.fog = false;
  const [ex, ey] = toSky(ERU.at);
  eru.position.set(ex, ey, SKY.z + 0.02);
  eru.scale.setScalar(0.5);
  eru.userData.outside = 'eru';
  group.add(eru);
  const lights = new Map();
  for (const v of VALAR) {
    const s = new THREE.Sprite(mats.glow('#b8c8ff', 0));
    s.material.fog = false;
    const [x, y] = toSky(v.at);
    s.position.set(x, y, SKY.z + 0.02);
    s.scale.setScalar(0.42);
    group.add(s);
    lights.set(v.id, { s, level: 0, want: 0, pulse: 0 });
  }

  // the Eye, over the eastern hills, as the Ring’s dread rises
  const eye = eyeMaterial({ fog: false, additive: true });
  keep(eye.material);
  const eyeMesh = plane(0.5, 0.25, eye.material, [WINDOW.x + 0.45, 0.32, -2.2]);
  eyeMesh.visible = false;

  let t = 0;
  let eruPulse = 0;
  const camPos = new THREE.Vector3();
  return {
    group,
    sky,
    gandalf,
    eru,
    // what a ray’s hit is, out there: Gandalf, Eru, or one of the Valar by where the sky was hit
    pick(hit) {
      const o = hit?.object;
      if (!o) return null;
      if (o.userData.outside === 'gandalf') return { kind: 'gandalf', id: 'gandalf', item: GANDALF };
      if (o.userData.outside === 'eru') return { kind: 'eru', id: 'eru', item: ERU };
      if (o.userData.sky && hit.uv) {
        const at = [hit.uv.x, 1 - hit.uv.y];
        if (Math.hypot(at[0] - ERU.at[0], at[1] - ERU.at[1]) < 0.07) return { kind: 'eru', id: 'eru', item: ERU };
        const v = nearestStar(VALAR, at, 0.09);
        return v ? { kind: 'vala', id: v.id, item: v } : null;
      }
      return null;
    },
    light(id, on) {
      for (const [k, l] of lights) l.want = on && k === id ? 0.55 : 0;
    },
    act(id) {
      if (id === 'eru') eruPulse = 1;
      else if (id === 'gandalf') {
        const r = rings.find((x) => x.t < 0) ?? rings[0];
        r.t = 0;
      } else if (lights.has(id)) lights.get(id).pulse = 1;
    },
    tick(dt, { dread = 0, camera = null } = {}) {
      t += dt;
      eruPulse = Math.max(0, eruPulse - dt * 0.4);
      eru.material.opacity = 0.55 + 0.12 * Math.sin(t * 0.8) + eruPulse * 0.45;
      eru.scale.setScalar(0.5 + 0.04 * Math.sin(t * 0.8) + eruPulse * 0.35);
      for (const l of lights.values()) {
        l.pulse = Math.max(0, l.pulse - dt * 0.5);
        l.level += (Math.max(l.want, l.pulse) - l.level) * Math.min(1, dt * 5);
        l.s.material.opacity = l.level;
        l.s.visible = l.level > 0.01;
      }
      pipe.material.opacity = 0.7 + 0.3 * Math.sin(t * 1.3) ** 2;
      if (camera) camera.getWorldPosition(camPos);
      for (const r of rings) {
        if (r.t < 0) continue;
        r.t += dt;
        const k = r.t / 4;
        r.m.visible = k < 1;
        if (k >= 1) {
          r.t = -1;
          continue;
        }
        r.m.position.set(WINDOW.x + 0.03 + k * 0.08, 0.13 + k * 0.32, -1.28);
        r.m.scale.setScalar(1 + k * 3);
        r.m.material.opacity = 0.7 * (1 - k);
        if (camera) r.m.lookAt(camPos);
      }
      const e = Math.max(0, (dread - 0.15) / 0.85);
      eye.open.value = Math.min(1, e * 1.4);
      eye.power.value = 0.6 + e;
      eyeMesh.visible = e > 0.01;
      eyeMesh.scale.setScalar(0.6 + e * 1.1);
    },
    dispose() {
      for (const x of made) x.dispose();
      pipe.material.dispose();
      eru.material.dispose();
      for (const l of lights.values()) l.s.material.dispose();
    },
  };
}

