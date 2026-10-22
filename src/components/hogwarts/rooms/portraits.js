// The portraits on the Grand Staircase’s walls (the design’s §4.4), drawn:
// every canvas painted here in code from noise and the subject’s palette (a
// varnished ground, a light from one side, the sitter as the kind of picture
// it is: a bust, a knight on his pony, the monks at supper, a spaniel, a
// sleeping boy; brush strokes, old varnish, cracks), all on one atlas; the
// gilt frames merged into the room’s kit; the canvases one instanced draw,
// each frame showing its cell of the atlas. The wanderer leaves his frame for
// another when nobody is looking (rules/portraits.js says when and where):
// his old frame shows an empty chair, his new one him.
//
//   CELLS: { subjectId | 'fatlady' | 'fatladyBack' | 'empty': [col, row] } on a 4 × 4 atlas
//   paintAtlas({ size }) → canvas (in a browser)
//   createPortraits({ frames: [{ id, at, ry, w, h, subject }], kit, renderer }) → { group, show(frameId, subjectId | null), dispose() }
//     (the frames’ gilt goes into `kit`, to be merged with the room’s statics)

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { attribute, texture, uv } from 'three/tsl';
import { canvasTexture } from '../../../lib/three/canvasTexture';
import { SUBJECTS } from '../rules/portraits';

const GRID = 4;
export const CELLS = Object.fromEntries([...SUBJECTS.map((s, i) => [s.id, [i % GRID, Math.floor(i / GRID)]]), ['fatlady', [0, 3]], ['fatladyBack', [1, 3]], ['empty', [2, 3]], ['frame', [3, 3]]]);

const FAT_LADY = { kind: 'fatlady', palette: ['#3a1e2a', '#efc0a8', '#e07a9a', '#ffe0c8'] };
const FAT_BACK = { kind: 'fatladyBack', palette: FAT_LADY.palette };
const EMPTY = { kind: 'empty', palette: ['#2e2a22', '#6a4a30', '#3a5a3a', '#d8c8a0'] };

// a seeded random for the brushwork (the same canvas every visit)
function rand(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const shade = (hex, k) => {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
};

function ellipse(g, x, y, rx, ry, fill, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
}

// a head: the face lit from the left, a hair cap, two dark eyes and a mouth
function head(g, x, y, r, skin, hair, { asleep = false, beard = false, hat = null } = {}) {
  ellipse(g, x, y, r * 0.82, r, skin);
  ellipse(g, x + r * 0.25, y + r * 0.1, r * 0.55, r * 0.85, shade(skin, 0.8));
  ellipse(g, x - r * 0.25, y - r * 0.1, r * 0.4, r * 0.6, shade(skin, 1.12));
  g.beginPath();
  g.ellipse(x, y - r * 0.35, r * 0.88, r * 0.7, 0, Math.PI, Math.PI * 2);
  g.fillStyle = hair;
  g.fill();
  if (beard) ellipse(g, x, y + r * 0.7, r * 0.55, r * 0.5, hair);
  g.fillStyle = '#1a1210';
  if (asleep) {
    g.fillRect(x - r * 0.42, y, r * 0.26, r * 0.05);
    g.fillRect(x + r * 0.16, y, r * 0.26, r * 0.05);
  } else {
    ellipse(g, x - r * 0.3, y, r * 0.09, r * 0.11, '#1a1210');
    ellipse(g, x + r * 0.3, y, r * 0.09, r * 0.11, '#1a1210');
  }
  g.fillStyle = shade(skin, 0.6);
  g.fillRect(x - r * 0.2, y + r * 0.45, r * 0.4, r * 0.06);
  if (hat) {
    g.fillStyle = hat;
    g.fillRect(x - r * 1.1, y - r * 0.85, r * 2.2, r * 0.18);
    g.fillRect(x - r * 0.6, y - r * 1.5, r * 1.2, r * 0.7);
  }
}

// shoulders and a body in the subject’s clothes, lit from the left
function body(g, x, y, w, h, cloth) {
  const grad = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  grad.addColorStop(0, shade(cloth, 1.15));
  grad.addColorStop(1, shade(cloth, 0.55));
  g.beginPath();
  g.moveTo(x - w * 0.18, y);
  g.quadraticCurveTo(x - w / 2, y + h * 0.1, x - w / 2, y + h);
  g.lineTo(x + w / 2, y + h);
  g.quadraticCurveTo(x + w / 2, y + h * 0.1, x + w * 0.18, y);
  g.closePath();
  g.fillStyle = grad;
  g.fill();
}

function sitter(g, s, S, rnd) {
  const [, skin, cloth, light] = s.palette;
  const hair = shade(cloth, 0.35);
  switch (s.kind) {
    case 'rider': {
      // a stout grey pony side on, a small knight on it with a lance too long for him
      const horse = '#8d8f92';
      ellipse(g, S * 0.5, S * 0.62, S * 0.26, S * 0.12, horse);
      ellipse(g, S * 0.75, S * 0.48, S * 0.07, S * 0.12, horse, -0.5);
      for (const x of [0.32, 0.42, 0.58, 0.68]) g.fillRect(S * x, S * 0.68, S * 0.035, S * 0.2);
      g.fillStyle = shade(horse, 0.6);
      g.fillRect(S * 0.24, S * 0.56, S * 0.04, S * 0.16);
      body(g, S * 0.48, S * 0.34, S * 0.18, S * 0.26, cloth);
      head(g, S * 0.48, S * 0.28, S * 0.06, '#9aa0a8', '#6a7078', { hat: '#7a8088' });
      g.strokeStyle = shade(light, 0.9);
      g.lineWidth = S * 0.012;
      g.beginPath();
      g.moveTo(S * 0.38, S * 0.5);
      g.lineTo(S * 0.95, S * 0.12);
      g.stroke();
      break;
    }
    case 'group': {
      // a long table and the faces along it, goblets raised
      g.fillStyle = shade(cloth, 0.6);
      g.fillRect(S * 0.04, S * 0.66, S * 0.92, S * 0.08);
      const n = s.id === 'monks' ? 7 : 3;
      for (let i = 0; i < n; i++) {
        const x = S * (0.1 + (0.8 * (i + 0.5)) / n);
        const y = S * (0.45 + (rnd() - 0.5) * 0.06);
        body(g, x, y + S * 0.06, S * (0.7 / n + 0.04), S * 0.2, i % 2 ? cloth : shade(cloth, 0.8));
        head(g, x, y, S * (0.22 / n + 0.025), skin, hair, { beard: s.id === 'tufts' });
        g.fillStyle = '#c9a24a';
        g.fillRect(x + S * 0.03, S * 0.6, S * 0.02, S * 0.06);
      }
      break;
    }
    case 'beast': {
      // a spaniel sat up on a cushion, ears long, very dignified
      ellipse(g, S * 0.5, S * 0.8, S * 0.3, S * 0.07, shade(light, 0.5));
      ellipse(g, S * 0.5, S * 0.62, S * 0.16, S * 0.18, skin);
      ellipse(g, S * 0.5, S * 0.38, S * 0.11, S * 0.1, skin);
      ellipse(g, S * 0.42, S * 0.44, S * 0.04, S * 0.11, shade(skin, 0.6));
      ellipse(g, S * 0.58, S * 0.44, S * 0.04, S * 0.11, shade(skin, 0.6));
      ellipse(g, S * 0.5, S * 0.42, S * 0.035, S * 0.025, '#1a1210');
      ellipse(g, S * 0.46, S * 0.36, S * 0.012, S * 0.014, '#1a1210');
      ellipse(g, S * 0.54, S * 0.36, S * 0.012, S * 0.014, '#1a1210');
      g.fillStyle = cloth;
      g.fillRect(S * 0.43, S * 0.5, S * 0.14, S * 0.03);
      break;
    }
    case 'sleeper': {
      // a boy asleep on his folded arms at a desk, a telescope by him, stars in the window
      g.fillStyle = shade(light, 0.4);
      g.fillRect(S * 0.6, S * 0.12, S * 0.3, S * 0.3);
      for (let i = 0; i < 9; i++) ellipse(g, S * (0.62 + rnd() * 0.26), S * (0.14 + rnd() * 0.26), S * 0.006, S * 0.006, '#f0f0ff');
      g.fillStyle = shade(cloth, 0.7);
      g.fillRect(S * 0.08, S * 0.66, S * 0.84, S * 0.06);
      body(g, S * 0.4, S * 0.5, S * 0.32, S * 0.2, cloth);
      head(g, S * 0.38, S * 0.56, S * 0.08, skin, hair, { asleep: true });
      g.strokeStyle = '#b08a3e';
      g.lineWidth = S * 0.02;
      g.beginPath();
      g.moveTo(S * 0.62, S * 0.64);
      g.lineTo(S * 0.82, S * 0.48);
      g.stroke();
      break;
    }
    case 'standing': {
      body(g, S * 0.5, S * 0.3, S * 0.34, S * 0.62, cloth);
      head(g, S * 0.5, S * 0.24, S * 0.07, skin, hair, { beard: s.id === 'fenwick' || s.id === 'thwaite', hat: s.id === 'fenwick' ? shade(cloth, 0.6) : null });
      if (s.id === 'thwaite') {
        g.strokeStyle = '#3a2a1a';
        g.lineWidth = S * 0.012;
        g.beginPath();
        g.moveTo(S * 0.62, S * 0.5);
        g.lineTo(S * 0.82, S * 0.34);
        g.stroke();
      }
      break;
    }
    case 'fatlady': {
      // a large lady in pink silk, a goblet in her hand, very pleased with herself
      g.beginPath();
      g.moveTo(S * 0.36, S * 0.42);
      g.quadraticCurveTo(S * 0.06, S * 0.7, S * 0.1, S * 1.0);
      g.lineTo(S * 0.9, S * 1.0);
      g.quadraticCurveTo(S * 0.94, S * 0.7, S * 0.64, S * 0.42);
      g.closePath();
      const silk = g.createLinearGradient(S * 0.1, 0, S * 0.9, 0);
      silk.addColorStop(0, shade(cloth, 1.2));
      silk.addColorStop(0.5, cloth);
      silk.addColorStop(1, shade(cloth, 0.6));
      g.fillStyle = silk;
      g.fill();
      ellipse(g, S * 0.5, S * 0.42, S * 0.17, S * 0.08, skin);
      head(g, S * 0.5, S * 0.3, S * 0.1, skin, '#6a3a22');
      g.fillStyle = '#c9a24a';
      g.fillRect(S * 0.7, S * 0.46, S * 0.03, S * 0.08);
      ellipse(g, S * 0.715, S * 0.45, S * 0.035, S * 0.02, '#c9a24a');
      break;
    }
    case 'fatladyBack': {
      g.beginPath();
      g.moveTo(S * 0.36, S * 0.42);
      g.quadraticCurveTo(S * 0.06, S * 0.7, S * 0.1, S * 1.0);
      g.lineTo(S * 0.9, S * 1.0);
      g.quadraticCurveTo(S * 0.94, S * 0.7, S * 0.64, S * 0.42);
      g.closePath();
      g.fillStyle = shade(cloth, 0.8);
      g.fill();
      ellipse(g, S * 0.5, S * 0.3, S * 0.1, S * 0.11, '#6a3a22');
      break;
    }
    case 'empty': {
      // the sitter gone: an empty chair against the painted curtain
      g.fillStyle = shade(skin, 0.9);
      g.fillRect(S * 0.36, S * 0.3, S * 0.28, S * 0.38);
      g.fillStyle = shade(skin, 0.6);
      g.fillRect(S * 0.32, S * 0.62, S * 0.36, S * 0.06);
      g.fillRect(S * 0.34, S * 0.68, S * 0.03, S * 0.22);
      g.fillRect(S * 0.63, S * 0.68, S * 0.03, S * 0.22);
      break;
    }
    default: {
      // a bust: head and shoulders, three-quarters, against a curtain
      body(g, S * 0.5, S * 0.52, S * 0.6, S * 0.5, cloth);
      head(g, S * 0.5, S * 0.4, S * 0.13, skin, hair, { hat: s.id === 'ash' ? shade(cloth, 0.5) : null });
      if (s.id === 'teague') {
        ellipse(g, S * 0.72, S * 0.82, S * 0.08, S * 0.06, '#e8e0d0');
        g.fillStyle = '#e8e0d0';
        g.fillRect(S * 0.78, S * 0.78, S * 0.06, S * 0.02);
      }
    }
  }
}

function paintCell(g, s, S, seed) {
  const rnd = rand(seed);
  const [ground, , , light] = s.palette;
  // the ground: dark, warmer toward a light from the upper left
  const bg = g.createRadialGradient(S * 0.3, S * 0.25, S * 0.05, S * 0.5, S * 0.5, S * 0.85);
  bg.addColorStop(0, shade(light, 0.55));
  bg.addColorStop(0.45, ground);
  bg.addColorStop(1, shade(ground, 0.45));
  g.fillStyle = bg;
  g.fillRect(0, 0, S, S);
  // a curtain behind the busts
  if (s.kind === 'bust' || s.kind === 'empty') {
    g.fillStyle = shade(s.palette[2], 0.45);
    for (let i = 0; i < 6; i++) g.fillRect(S * (0.62 + i * 0.06), 0, S * 0.035, S);
  }
  sitter(g, s, S, rnd);
  // brushwork: short strokes of the palette over everything, a little each
  for (let i = 0; i < 260; i++) {
    const c = s.palette[Math.floor(rnd() * 4)];
    g.strokeStyle = c;
    g.globalAlpha = 0.05 + rnd() * 0.07;
    g.lineWidth = 1 + rnd() * 3;
    const x = rnd() * S;
    const y = rnd() * S;
    const a = rnd() * Math.PI;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * S * 0.05, y + Math.sin(a) * S * 0.05);
    g.stroke();
  }
  // old varnish: a warm veil, darker at the edges; and fine cracks
  g.globalAlpha = 0.22;
  g.fillStyle = '#7a5a20';
  g.fillRect(0, 0, S, S);
  const vig = g.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.65)');
  g.globalAlpha = 1;
  g.fillStyle = vig;
  g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(20,12,6,0.35)';
  g.lineWidth = 0.6;
  for (let i = 0; i < 40; i++) {
    let x = rnd() * S;
    let y = rnd() * S;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (rnd() - 0.5) * S * 0.08;
      y += (rnd() - 0.5) * S * 0.08;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
}

export function paintAtlas({ size = 1024 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const S = size / GRID;
  const all = [...SUBJECTS, { id: 'fatlady', ...FAT_LADY }, { id: 'fatladyBack', ...FAT_BACK }, { id: 'empty', ...EMPTY }];
  all.forEach((s, i) => {
    const [col, row] = CELLS[s.id];
    g.save();
    g.translate(col * S, row * S);
    g.beginPath();
    g.rect(0, 0, S, S);
    g.clip();
    paintCell(g, s, S, 97 + i * 31);
    g.restore();
  });
  return c;
}

// the gilt frame round a canvas: four mitred bars and a thin inner slip, into the kit
function gilt(kit, { at, ry, w, h }) {
  const t = 0.12;
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  // (local x along the wall, z out of it)
  const put = (x, y, z, bw, bh, bd) => kit.box('gold', at[0] + x * c + z * s, at[1] + y, at[2] - x * s + z * c, bw, bh, bd, { ry });
  put(0, h / 2, 0.03, w + t * 2, t, 0.08);
  put(0, -h / 2 - t, 0.03, w + t * 2, t, 0.08);
  put(-w / 2 - t / 2, -h / 2, 0.03, t, h, 0.08);
  put(w / 2 + t / 2, -h / 2, 0.03, t, h, 0.08);
}

export function createPortraits({ frames, kit, renderer = null }) {
  const group = new THREE.Group();
  group.name = 'hogwarts:portraits';
  for (const f of frames) gilt(kit, f);
  const n = frames.length;
  const cells = new Float32Array(n * 2);
  const index = new Map(frames.map((f, i) => [f.id, i]));
  const cellAttr = new THREE.InstancedBufferAttribute(cells, 2);
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.setAttribute('aCell', cellAttr);
  let tex = null;
  if (typeof document !== 'undefined') {
    tex = canvasTexture(paintAtlas(), renderer, { wrap: false });
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  const mat = new MeshStandardNodeMaterial({ roughness: 0.55, metalness: 0 });
  if (tex) mat.colorNode = texture(tex, uv().div(GRID).add(attribute('aCell', 'vec2').div(GRID)));
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  frames.forEach((f, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), f.ry);
    m4.compose(new THREE.Vector3(...f.at), q, new THREE.Vector3(f.w, f.h, 1));
    mesh.setMatrixAt(i, m4);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  group.add(mesh);
  const show = (frameId, subjectId) => {
    const i = index.get(frameId);
    if (i == null) return;
    const [col, row] = CELLS[subjectId ?? 'empty'] ?? CELLS.empty;
    // (the atlas’s rows run down the canvas, uv’s up it)
    cells[i * 2] = col;
    cells[i * 2 + 1] = GRID - 1 - row;
    cellAttr.needsUpdate = true;
  };
  for (const f of frames) show(f.id, f.subject ?? null);
  return {
    group,
    show,
    dispose() {
      geo.dispose();
      mat.dispose();
      tex?.dispose();
      mesh.dispose?.();
      group.removeFromParent();
    },
  };
}

