// What every kitchen shares, and the Prancing Pony's look where a theme
// doesn't say otherwise. A theme (./index.js) is an object:
//
//   sky       { background, fog: [colour, near, far], hemi: [sky, ground,
//             intensity], sun: [colour, intensity], sunAt?: [x, y, z] }
//   setup     (ctx) → the theme's own materials, handed back to the rest
//   room      (ctx, T) → the floor, the walls and what's round the kitchen
//   counter   (c, stone, ctx, T) → [body, top] materials, or null for none
//   stations  { [tile]: (ctx, T) → draws it } — over the shared ones below
//   shelf     (ctx, T) → [back, shelves] materials for the level's shelves
//   water     (ctx, T) → draws the '~' tiles: { tex, tick(dt) } or null
//   extras    (ctx, T) → lamps, lights and sky, after the room's built;
//             may hand back { tick(dt, t, s) }, run every frame
//   pot       (potMat) → the pot's contents' materials, by its state
//   flame     ['O', …]: the stations whose fire is a flame in the middle (a campfire)
//   pan       true: the pots are frying pans (their contents sit low)
//   spit      true: what's on the oven sits up on a spit over it
//   ovenAt    { y, out }: or where it sits on the oven (a forge's coals)
//
// ctx = { kit, mats, paint, items, bk, room, scene, W, D, X, Z, at, wet, R,
// lamps, wallH, m (the shared materials: darkWood, board, topWood,
// paleWood, brick, line) }. A station draws in its own frame: the
// counter's top at the origin, +z towards the floor in front of it.

import * as THREE from 'three';
import { hot } from '../../../../lib/three/stage3dNodes';
import { B, ball, barrelParts, cyl, lathe } from '../../shire/props';
import { dotTexture } from '../../towns/bake';
import { sharpen } from '../../../../lib/three/textures';

export const TOP = 0.92; // a counter's top
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// the Pony's: timber, brick by the fires, a scrubbed top and a dark serving hatch
export const innCounter = (c, stone, { mats, m }) => [stone ? m.brick : mats.timber, c === 'S' ? m.darkWood : stone ? mats.dressed : m.topWood];

// the stations' fittings, as the Pony has them
export const STATIONS = {
  F({ bk, mats, m }) {
    // a rock at the water's edge, and a rod out over the lake, to one side
    bk.add(mats.stone, new THREE.IcosahedronGeometry(0.52, 0), { p: [0, -0.45, -0.05], r: [0.3, 0.5, 0.1], s: [1, 0.9, 1], uv: 1 });
    bk.add(mats.timber, cyl(0.012, 0.022, 1.48, 5), { p: [0.325, 0.225, -0.15], r: [-0.519, 0, -0.612] });
    bk.add(m.line, cyl(0.004, 0.004, 1.74, 3), { p: [0.75, -0.12, -0.45] });
  },
  L({ bk, items }) {
    // the leaf table: a pile of mallorn leaves to wrap the lembas in
    for (let k = 0; k < 7; k++) bk.add(items.M.mallorn, new THREE.SphereGeometry(0.1, 8, 4), { p: [Math.cos(k * 1.9) * 0.24, 0.02 + k * 0.006, Math.sin(k * 1.9) * 0.2 - 0.1], s: [1.4, 0.15, 0.8], r: [0, k, 0] });
  },
  B({ bk, mats, m }) {
    bk.add(m.board, B(0.7, 0.05, 0.5), { p: [0, 0.025, -0.02], uv: 1 });
    bk.add(mats.steel, B(0.26, 0.012, 0.05), { p: [0.18, 0.06, 0.18], r: [0, 0.4, 0] });
    bk.add(mats.timber, B(0.12, 0.025, 0.035), { p: [0.02, 0.06, 0.25], r: [0, 0.4, 0] });
  },
  P({ bk, mats }) {
    // the hearth's fire under the pot, and the pot
    bk.add(mats.iron, lathe([[0.2, 0], [0.32, 0.06], [0.35, 0.2], [0.33, 0.36], [0.3, 0.36], [0.31, 0.2], [0.29, 0.07], [0.18, 0.03]], 16), { p: [0, 0.02, 0] });
    bk.add(mats.iron, new THREE.TorusGeometry(0.33, 0.02, 6, 18), { p: [0, 0.37, 0], r: [Math.PI / 2, 0, 0] });
    for (const s of [-1, 1]) bk.add(mats.iron, cyl(0.02, 0.02, 0.5, 5), { p: [s * 0.4, 0.2, 0] });
    bk.add(mats.iron, cyl(0.015, 0.015, 0.82, 5), { p: [0, 0.45, 0], r: [0, 0, Math.PI / 2] });
  },
  O({ bk, mats, m }, T) {
    bk.add(T.oven ?? m.brick, new THREE.SphereGeometry(0.44, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), { p: [0, 0, -0.04], uv: 1 });
    bk.add(mats.void, new THREE.CircleGeometry(0.2, 12, 0, Math.PI), { p: [0, 0.0, 0.405], r: [0, 0, 0] });
    bk.add(mats.iron, cyl(0.05, 0.06, 0.3, 8), { p: [0.12, 0.5, -0.12] });
  },
  T({ bk, mats, kit }) {
    // a barrel on its side, its tap over the front of the counter
    bk.at([0, 0.32, -0.44], [Math.PI / 2, 0, 0], () => barrelParts(bk, kit.K, { h: 0.6, r: 0.26 }));
    bk.add(mats.timber, B(0.6, 0.1, 0.12), { p: [0, 0.05, -0.32] });
    bk.add(mats.timber, B(0.6, 0.1, 0.12), { p: [0, 0.05, 0.06] });
    bk.add(mats.brass, cyl(0.025, 0.025, 0.16, 8), { p: [0, 0.34, 0.22], r: [Math.PI / 2, 0, 0] });
    bk.add(mats.brass, cyl(0.022, 0.016, 0.1, 8), { p: [0, 0.29, 0.3] });
    bk.add(mats.brass, B(0.02, 0.12, 0.03), { p: [0, 0.43, 0.24] });
  },
  W({ bk, mats }) {
    bk.add(mats.barnwood, lathe([[0.3, 0], [0.42, 0.28], [0.44, 0.3], [0.4, 0.3], [0.38, 0.27], [0.27, 0.03], [0, 0.03]], 16), { p: [0, 0, 0] });
    for (const y of [0.08, 0.22]) bk.add(mats.iron, cyl(0.335 + y * 0.42, 0.34 + y * 0.42, 0.03, 16, true), { p: [0, y, 0] });
  },
  X({ bk, mats, items }) {
    bk.add(mats.iron, lathe([[0.18, 0], [0.24, 0.34], [0.22, 0.34], [0.165, 0.02], [0, 0.02]], 12));
    bk.add(items.M.smear, new THREE.CircleGeometry(0.2, 12), { p: [0, 0.27, 0], r: [-Math.PI / 2, 0, 0] });
  },
  S({ bk, mats }) {
    bk.add(mats.brass, cyl(0.02, 0.02, 1.0, 6), { p: [0, 0.08, 0.44], r: [0, 0, Math.PI / 2] });
  },
  R({ bk, mats }) {
    bk.add(mats.barnwood, B(0.8, 0.04, 0.6), { p: [0, 0.02, 0] });
  },
};

// a level's shelves (its back, and two shelves), and its crates (a tub for the dough)
export function shelf({ bk }, [back, shelves]) {
  bk.add(back, B(0.9, 0.9, 0.06), { p: [0, 0.45, -0.42] });
  for (const y of [0.02, 0.45]) bk.add(shelves, B(0.9, 0.04, 0.42), { p: [0, y, -0.2] });
}
export function crate({ bk, mats }, kind) {
  if (kind === 'dough') bk.add(mats.barnwood, lathe([[0.32, 0], [0.38, 0.3], [0.34, 0.3], [0.3, 0.03], [0, 0.03]], 14));
  else {
    for (const [a, b, w, d] of [[0, -0.36, 0.8, 0.06], [0, 0.36, 0.8, 0.06], [-0.37, 0, 0.06, 0.78], [0.37, 0, 0.06, 0.78]]) bk.add(mats.barnwood, B(w, 0.3, d), { p: [a, 0.15, b], uv: 1 });
    bk.add(mats.barnwood, B(0.74, 0.03, 0.72), { p: [0, 0.03, 0] });
  }
}

// a fountain (or a spring): a stone bowl, and a spout of light (or water)
export function fountain({ bk, mats }, spout) {
  bk.add(mats.dressed, lathe([[0.1, 0], [0.32, 0.12], [0.34, 0.2], [0.3, 0.2], [0.28, 0.14], [0, 0.1]], 16), { p: [0, 0, -0.1] });
  bk.add(mats.dressed, cyl(0.04, 0.05, 0.5, 8), { p: [0, 0.25, -0.38] });
  bk.add(spout, cyl(0.012, 0.012, 0.3, 6), { p: [0, 0.38, -0.25], r: [0.9, 0, 0] });
}
// a stone basin, to wash up in
export function basin({ bk, mats }) {
  bk.add(mats.dressed, lathe([[0.3, 0], [0.44, 0.24], [0.46, 0.28], [0.41, 0.28], [0.39, 0.25], [0.27, 0.04], [0, 0.04]], 18));
}

// A stream (or a channel of molten rock): flowing down its tiles, kerbs
// along its banks, and a bridge wherever the floor crosses it.
export function stream({ bk, at, wet, W, D, X, Z, mats }, { lava = false, kerb = mats.ashlar } = {}) {
  let any = false;
  for (let j = 0; j < D && !any; j++) for (let i = 0; i < W; i++) if (at(i, j) === '~') any = true;
  if (!any) return null;
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = lava ? '#c83a08' : '#3e6a78';
  g.fillRect(0, 0, 64, 256);
  for (let n = 0; n < 40; n++) {
    g.strokeStyle = lava ? `rgba(${n % 3 ? '40, 16, 8' : '255, 220, 120'}, ${0.25 + Math.random() * 0.4})` : `rgba(200, 235, 245, ${0.08 + Math.random() * 0.18})`;
    g.lineWidth = 1 + Math.random() * 2;
    const x = Math.random() * 64;
    const y = Math.random() * 256;
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(x + 6, y + 10, x - 6, y + 24, x + 2, y + 34 + Math.random() * 20);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  sharpen(tex);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const water = lava ? new THREE.MeshBasicMaterial({ map: tex, color: hot(0xffffff, 1.6) }) : new THREE.MeshStandardMaterial({ map: tex, color: 0xbfe0ea, roughness: 0.12, metalness: 0.15, emissive: 0x0a2a36, emissiveIntensity: 0.6 });
  for (let j = 0; j < D; j++)
    for (let i = 0; i < W; i++) {
      const c = at(i, j);
      const x = X(i + 0.5);
      const z = Z(j + 0.5);
      if (c === '~') {
        bk.add(water, new THREE.PlaneGeometry(1, 1), { p: [x, 0.02, z], r: [-Math.PI / 2, 0, 0] });
        for (const sx of [-1, 1]) if (at(i + sx, j) === '.') bk.add(kerb, B(0.08, 0.14, 1), { p: [x + sx * 0.46, 0.07, z], uv: 1 });
        for (const sz of [-1, 1]) if (at(i, j + sz) === '.') bk.add(kerb, B(1, 0.14, 0.08), { p: [x, 0.07, z + sz * 0.46], uv: 1 });
      } else if (c === '.' && (wet(i, j - 1) || wet(i, j + 1) || wet(i - 1, j) || wet(i + 1, j))) {
        // a bridge over it: a slab, and low walls along the water's sides
        bk.add(kerb, B(1, 0.08, 1), { p: [x, 0.04, z], uv: 1 });
        for (const sx of [-1, 1]) if (wet(i + sx, j)) bk.add(kerb, B(0.1, 0.28, 1), { p: [x + sx * 0.46, 0.14, z], uv: 1 });
        for (const sz of [-1, 1]) if (wet(i, j + sz)) bk.add(kerb, B(1, 0.28, 0.1), { p: [x, 0.14, z + sz * 0.46], uv: 1 });
      }
    }
  return { tex, tick: (dt) => (tex.offset.y -= dt * 0.35) };
}

// glowing lamps at the room's lamp spots, and a pair of lights to go with them
export function lampsAt({ room, scene, lamps, W, Z }, { glow, size = 0.09, light, intensity = 2.2, range = 9, y = 2.2, z = 0.6 }) {
  const mat = new THREE.MeshBasicMaterial({ color: hot(glow, 2.6) });
  const geo = new THREE.SphereGeometry(size, 10, 8);
  for (const p of lamps) {
    const o = new THREE.Mesh(geo, mat);
    o.position.copy(p);
    room.add(o);
  }
  for (const sx of [-0.3, 0.3]) {
    const l = new THREE.PointLight(light, intensity, range, 1.5);
    l.position.set(sx * W, y, Z(0) + z);
    scene.add(l);
  }
}

// a sky behind the back of the room: a gradient, top to bottom
export function skyBehind({ room, W, Z }, stops, { z = -4, y = 4, h = 12 } = {}) {
  const cv = document.createElement('canvas');
  cv.width = 16;
  cv.height = 256;
  const g = cv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  for (const [k, c] of stops) grad.addColorStop(k, c);
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(cv);
  sharpen(tex);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(W + 30, h), new THREE.MeshBasicMaterial({ map: tex, fog: false }));
  sky.position.set(0, y, Z(0) + z);
  room.add(sky);
  return sky;
}

// the pot's contents, by its state
export const innPot = (potMat) => ({ empty: potMat(0x3a3a3a), part: potMat(0x8a7a5a), cooking: potMat(0x8a5a2a), done: potMat(0x7a4a22), burnt: potMat(0x141010) });

// a campfire: stones round it, logs, and a spit on two forked sticks
export function campfire({ bk, mats, m }) {
  for (let k = 0; k < 8; k++) bk.add(mats.stone, ball(0.07, 6, 4), { p: [Math.cos(k * 0.8) * 0.3, 0.03, Math.sin(k * 0.8) * 0.3] });
  for (let k = 0; k < 3; k++) bk.add(m.darkWood, cyl(0.035, 0.035, 0.42, 6), { p: [0, 0.05, 0], r: [Math.PI / 2, 0, k * 1.05] });
  for (const sx of [-1, 1]) bk.add(mats.timber, cyl(0.02, 0.02, 0.5, 5), { p: [sx * 0.34, 0.25, 0] });
  bk.add(mats.timber, cyl(0.012, 0.012, 0.78, 5), { p: [0, 0.46, 0], r: [0, 0, Math.PI / 2] });
}

// a cobweb, drawn: spokes and a spiral, pale on clear
export function webTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.strokeStyle = 'rgba(235, 235, 225, 0.85)';
  g.lineWidth = 1.2;
  const spokes = 11;
  const at = (k, r) => [64 + Math.cos((k / spokes) * Math.PI * 2 + Math.sin(k) * 0.12) * r, 64 + Math.sin((k / spokes) * Math.PI * 2 + Math.sin(k) * 0.12) * r];
  for (let k = 0; k < spokes; k++) {
    g.beginPath();
    g.moveTo(64, 64);
    g.lineTo(...at(k, 62));
    g.stroke();
  }
  for (let r = 8; r < 60; r += 6.5) {
    g.beginPath();
    for (let k = 0; k <= spokes; k++) g[k ? 'lineTo' : 'moveTo'](...at(k % spokes, r + (k % 2) * 1.5));
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  sharpen(tex);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Motes in the air: sparks rising off molten rock, leaves drifting down
// through lantern light, fireflies. `from()` says where each one starts
// (a Vector3); they rise (or fall), sway, glow and fade. → { tick(dt, t) }
export function motes({ scene }, { n = 60, from, colour, size = 0.1, rise = 0.6, sway = 0.3, life = [1.5, 3], glow = 1.5 }) {
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const map = dotTexture();
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.frustumCulled = false;
  scene.add(pts);
  const age = new Float32Array(n);
  const max = new Float32Array(n);
  const seed = Float32Array.from({ length: n }, () => Math.random() * 10);
  const base = new THREE.Color(colour).multiplyScalar(glow);
  const spawn = (i) => {
    const p = from(i);
    pos.set([p.x, p.y, p.z], i * 3);
    age[i] = 0;
    max[i] = life[0] + Math.random() * (life[1] - life[0]);
  };
  for (let i = 0; i < n; i++) {
    spawn(i);
    age[i] = Math.random() * max[i];
  }
  return {
    tick(dt, t) {
      for (let i = 0; i < n; i++) {
        age[i] += dt;
        if (age[i] >= max[i]) spawn(i);
        pos[i * 3] += Math.sin(t * 1.3 + seed[i]) * sway * dt;
        pos[i * 3 + 1] += rise * dt;
        pos[i * 3 + 2] += Math.cos(t * 1.1 + seed[i] * 2) * sway * 0.5 * dt;
        const k = Math.min(1, age[i] * 3) * (1 - age[i] / max[i]);
        col[i * 3] = base.r * k;
        col[i * 3 + 1] = base.g * k;
        col[i * 3 + 2] = base.b * k;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}

// a painted board on a post, with words on it
export function sign({ room }, lines, { at, turn = 0, w = 1.1, h = 0.55, board = '#d8c8a0', ink = '#3a2412', font = 'italic 600 30px Georgia, serif' } = {}) {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = Math.round((256 * h) / w);
  const g = cv.getContext('2d');
  g.fillStyle = board;
  g.fillRect(0, 0, cv.width, cv.height);
  g.strokeStyle = ink;
  g.lineWidth = 4;
  g.strokeRect(6, 6, cv.width - 12, cv.height - 12);
  g.fillStyle = ink;
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((l, k) => g.fillText(l, cv.width / 2, ((k + 1) * cv.height) / (lines.length + 1)));
  const tex = new THREE.CanvasTexture(cv);
  sharpen(tex);
  tex.colorSpace = THREE.SRGBColorSpace;
  const group = new THREE.Group();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  face.position.y = 1.1;
  const post = new THREE.Mesh(cyl(0.035, 0.04, 1.1, 6), new THREE.MeshStandardMaterial({ color: 0x5a3e24, roughness: 1 }));
  post.position.set(0, 0.55, -0.03);
  group.add(face, post);
  group.position.copy(at);
  group.rotation.y = turn;
  room.add(group);
  return group;
}
