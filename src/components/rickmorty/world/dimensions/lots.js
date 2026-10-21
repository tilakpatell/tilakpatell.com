// The buildings a place's world (./worlds.js) stands round it where no
// model of their kind exists (the owner's rule), drawn in the room kit
// (../interiors/shell.js's frames) in the place's own colours: merged with
// everything else the place draws, so a street of them costs a draw or two.
// Their walls are a paint of windows that tiles in the world (a storey and a
// bay to a repeat, ../kit.js's batch), one paint a wall colour; at night
// (`look.night`) a few windows a face are lit instead, as glows. Only boxes,
// eight-sided drums, cones and balls (BALL8: the sixteen-sided ball merges
// at thirty times a box).
//
// STYLES: the styles lot() draws
// lot(R, { x, z, turn, w, d, h, y, style }, look, { windows, list })
//   a building `w` across and `d` deep (its front out of its frame's front,
//   facing in), `h` tall on a plinth `y` high; look { walls, roofs, lit,
//   trim, night }; windows: windowPaints(R, look); list: the frames' list
// windowPaints(R, look) → { [wall colour]: material }
// edgeRun(R, { kind, x0, z0, x1, z1, h }, look)   a kerb, rail, fence, barrier or wall along a line
// opening(f, u, wall, { w, y0, h, mullion, frame })   a hole's frame and mullions, no picture in it

import * as THREE from 'three';
import { BALL8, BOX, CYL8 } from '../interiors/shell';

export const STYLES = ['block', 'tower', 'dome', 'hut', 'tudor', 'house', 'stack', 'adobe', 'mushroom', 'spire', 'stand', 'hangar', 'mast', 'berm'];

const CONE8 = new THREE.ConeGeometry(0.5, 1, 8);
// a pyramid on a 1 × 1 base, 1 high, centred
const PYRAMID = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4);
// a gable roof: a prism 1 long (across), 1 deep, 1 high, centred
const GABLE = (() => {
  const g = new THREE.BufferGeometry();
  const a = [-0.5, -0.5, 0.5];
  const b = [-0.5, -0.5, -0.5];
  const c = [-0.5, 0.5, 0];
  const A = [0.5, -0.5, 0.5];
  const B = [0.5, -0.5, -0.5];
  const C = [0.5, 0.5, 0];
  const tris = [a, A, C, a, C, c, B, b, c, B, c, C, b, a, c, A, B, C, a, b, B, a, B, A];
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  return g;
})();
const ADOBE = new THREE.CylinderGeometry(0.38, 0.5, 1, 8);

const TILE = 6; // metres to the windows' repeat: two storeys, two bays
const LIT = 6; // a face's lit windows at night, at most
const hashOf = (x, z, k = 0) => (((Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453) % 1) + 1) % 1;
const pick = (list, x, z, k) => list[Math.floor(hashOf(x, z, k) * list.length) % list.length];
const hex = (c) => `#${new THREE.Color(c).getHexString()}`;

export function windowPaints(R, look) {
  const out = {};
  for (const wall of look.walls) {
    out[wall] = R.kit.mats.painted(
      `lot-${R.id}-${new THREE.Color(wall).getHexString()}${look.night ? '-n' : ''}`,
      128,
      128,
      (g, w, h) => {
        g.fillStyle = hex(wall);
        g.fillRect(0, 0, w, h);
        // four windows to the tile, in their frames; one dark, or all dark at night (the lit ones are glows)
        const lit = look.lit ?? [0xffe08a];
        for (let i = 0; i < 4; i++) {
          const x = (i % 2) * (w / 2) + w * 0.12;
          const y = Math.floor(i / 2) * (h / 2) + h * 0.12;
          g.fillStyle = hex(look.trim ?? 0x3a2a22);
          g.fillRect(x - 3, y - 3, w * 0.26 + 6, h * 0.28 + 6);
          g.fillStyle = look.night || i === 3 ? '#1e2230' : hex(lit[i % lit.length]);
          g.fillRect(x, y, w * 0.26, h * 0.28);
        }
      },
      { tile: TILE },
    );
  }
  return out;
}

// a wall of windows: a box w × h × d standing on y0, painted
const facade = (R, f, paint, u, y0, v, w, h, d) => R.tiled.add(BOX, paint, f.mat(u, y0 + h / 2, v, 0, w, h, d));
// at night, a few of a face's windows lit (the front and the back), as the paint's bays fall
function litWindows(f, look, u0, y0, w, h, d, seed) {
  if (!look.night) return;
  const cols = Math.max(1, Math.floor(w / (TILE / 2)));
  const rows = Math.max(1, Math.floor(h / (TILE / 2)));
  for (const side of [1, -1]) {
    let n = 0;
    for (let r = 0; r < rows && n < LIT; r++)
      for (let c = 0; c < cols && n < LIT; c++) {
        if (hashOf(seed + c, r, side) > 0.45) continue;
        n += 1;
        const u = u0 - w / 2 + (c + 0.5) * (w / cols);
        f.glow(BOX, pick(look.lit ?? [0xffe08a], c, r, side), 1.6, u, y0 + (r + 0.55) * (h / rows), (side * d) / 2 - side * 0.03, 0, (w / cols) * 0.5, (h / rows) * 0.45, 0.04);
      }
  }
}

const DRAW = {
  block(R, f, L, look, paint, wall, roof) {
    const { w, d, h } = L;
    facade(R, f, paint, 0, 0, 0, w, h * 0.92, d);
    f.box(roof, 0, h * 0.92, 0, w, h * 0.08, d);
    litWindows(f, look, 0, 0, w, h * 0.92, d, L.x + L.z);
  },
  tower(R, f, L, look, paint, wall, roof) {
    const { w, d, h } = L;
    let y = 0;
    for (const [k, share] of [
      [1, 0.5],
      [0.78, 0.3],
      [0.56, 0.2],
    ]) {
      const th = h * share;
      facade(R, f, paint, 0, y, 0, w * k, th * 0.94, d * k);
      f.box(roof, 0, y + th * 0.94, 0, w * k, th * 0.06, d * k);
      litWindows(f, look, 0, y, w * k, th * 0.94, d * k, L.x + L.z + y);
      y += th;
    }
  },
  dome(R, f, L, look, paint, wall, roof) {
    const r = Math.min(L.w, L.d) / 2;
    const drum = L.h * 0.45;
    R.tiled.add(CYL8, paint, f.mat(0, drum / 2, 0, 0, r * 2, drum, r * 2));
    f.ball(roof, 0, drum, 0, r, (L.h - drum) / r, BALL8);
  },
  hut(R, f, L, look, paint, wall, roof) {
    const { w, d, h } = L;
    facade(R, f, paint, 0, 0, 0, w, h * 0.55, d);
    f.part(PYRAMID, roof, 0, h * 0.55 + (h * 0.45) / 2, 0, 0, w, h * 0.45, d);
  },
  tudor(R, f, L, look, paint, wall, roof) {
    const { w, d, h } = L;
    const walls = h * 0.6;
    f.box(wall, 0, 0, 0, w, walls, d);
    const beam = look.trim ?? 0x3a2a22;
    // the timbers, front and back: posts, a rail at the floor, a cross
    for (const s of [1, -1]) {
      const v = s * (d / 2 - 0.03);
      for (let u = -w / 2 + 0.15; u <= w / 2 - 0.15 + 1e-9; u += Math.max(1.2, (w - 0.3) / 6)) f.box(beam, u, 0, v, 0.22, walls, 0.06);
      f.box(beam, 0, walls * 0.5, v, w - 0.1, 0.2, 0.06);
      f.box(beam, 0, walls - 0.2, v, w - 0.1, 0.2, 0.06);
    }
    f.part(GABLE, roof, 0, walls + (h - walls) / 2, 0, 0, w, h - walls, d);
  },
  house(R, f, L, look, paint, wall, roof) {
    const { w, d, h } = L;
    const walls = h * 0.58;
    facade(R, f, paint, 0, 0, 0, w, walls, d);
    f.part(GABLE, roof, 0, walls + (h - walls) * 0.4, 0, 0, w, (h - walls) * 0.8, d);
    f.box(look.trim ?? 0x5a3a2a, 0, 0, d / 2 - 0.05, Math.min(1.1, w * 0.2), Math.min(2.1, walls * 0.8), 0.1);
    f.box(roof, w * 0.28, walls, -d * 0.2, Math.min(0.9, w * 0.12), h - walls, Math.min(0.9, d * 0.12));
  },
  stack(R, f, L, look, paint, wall, roof) {
    const r0 = Math.min(L.w, L.d) / 2 - 0.3;
    const n = Math.max(3, Math.min(5, Math.round(L.h / 4)));
    const each = L.h / n;
    for (let i = 0; i < n; i++) {
      const r = r0 * (1 - (i / n) * 0.4);
      f.cyl(i % 2 ? roof : wall, 0, i * each, 0, r, each * 0.9, 0, 0, CYL8);
      // the teeth round its rim
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + i * 0.4;
        f.box(look.trim ?? 0x7a5a2a, Math.cos(a) * r, i * each + each * 0.15, Math.sin(a) * r, 0.5, each * 0.6, 0.5, -a);
      }
    }
  },
  adobe(R, f, L, look, paint, wall, roof) {
    const r = Math.min(L.w, L.d) / 2;
    const body = L.h * 0.86;
    f.part(ADOBE, wall, 0, body / 2, 0, 0, r * 2, body, r * 2);
    f.ball(roof, 0, body, 0, r * 0.38, (L.h - body) / (r * 0.38), BALL8);
    // vines down its sides
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      f.box(look.trim ?? 0x4a7a3a, Math.cos(a) * r * 0.82, body * 0.35, Math.sin(a) * r * 0.82, 0.25, body * 0.55, 0.25, -a);
    }
  },
  mushroom(R, f, L, look, paint, wall, roof) {
    const r = Math.min(L.w, L.d) / 2;
    const stalk = L.h * 0.6;
    f.cyl(wall, 0, 0, 0, r * 0.35, stalk, 0, 0, CYL8);
    f.ball(roof, 0, stalk, 0, r, (L.h - stalk) / r, BALL8);
  },
  spire(R, f, L, look, paint, wall, roof) {
    const r = (Math.min(L.w, L.d) / 2) * 0.7;
    R.tiled.add(CYL8, paint, f.mat(0, L.h * 0.25, 0, 0, r * 2, L.h * 0.5, r * 2));
    f.part(CONE8, roof, 0, L.h * 0.75, 0, 0, r * 2, L.h * 0.5, r * 2);
  },
  stand(R, f, L, look, paint, wall, roof) {
    const { w, d, h } = L;
    const k = L.steps ?? 5;
    // rising away from the front: the first row lowest, nearest
    for (let i = 0; i < k; i++) f.box(i % 2 ? roof : wall, 0, 0, d / 2 - (i + 0.5) * (d / k), w, ((i + 1) * h) / k, d / k);
  },
  hangar(R, f, L, look, paint, wall, roof) {
    const { w, d, h } = L;
    const walls = h * 0.6;
    const r = Math.min(w / 2, h * 0.4);
    facade(R, f, paint, 0, 0, 0, w, walls, d);
    f.cyl(roof, 0, walls, 0, r, d, Math.PI / 2, 0, CYL8);
    f.box(look.trim ?? 0x2a2a30, 0, 0, d / 2 - 0.05, w * 0.6, walls * 0.85, 0.1);
  },
  mast(R, f, L, look, paint, wall) {
    const { w, d, h } = L;
    const trim = look.trim ?? 0x6a6a72;
    f.cyl(trim, 0, 0, 0, 0.25, h * 0.8, 0, 0, CYL8);
    for (let y = h * 0.1; y < h * 0.75; y += h * 0.15) f.box(trim, 0, y, 0, Math.min(w, 3), 0.12, 0.12);
    const r = Math.min(Math.min(w, d) / 2 * 0.7, h * 0.08);
    f.cyl(wall, 0, h - r - 0.1, 0, r, 0.2, 0.5, 0, CYL8);
    f.glow(BOX, pick(look.lit ?? [0xff3a3a], L.x, L.z, 2), 2, 0, h * 0.8 + 0.2, 0, 0, 0.35, 0.35, 0.35);
  },
  berm(R, f, L, look, paint, wall, roof) {
    const { w, d, h } = L;
    // three terraces rising away from the front
    for (let i = 0; i < 3; i++) f.box(i % 2 ? roof : wall, 0, 0, d / 2 - ((i + 0.5) * d) / 3, w, ((i + 1) * h) / 3, d / 3);
  },
};

export function lot(R, L, look, { windows, list = 'fixed' } = {}) {
  const draw = DRAW[L.style];
  if (!draw) return;
  const wall = pick(look.walls, L.x, L.z, 1);
  const roof = pick(look.roofs ?? look.walls, L.x, L.z, 2);
  if (L.y > 0.01) R.frame(L.x, L.z, L.turn, { list }).box(look.trim ?? wall, 0, 0, 0, L.w, L.y, L.d);
  const f = R.frame(L.x, L.z, L.turn, { y: L.y, list });
  draw(R, f, L, look, windows[wall], wall, roof);
}

// the edge along a line: a kerb, a rail, a fence, striped barriers or a low wall
export function edgeRun(R, run, look) {
  const len = Math.hypot(run.x1 - run.x0, run.z1 - run.z0);
  const turn = -Math.atan2(run.z1 - run.z0, run.x1 - run.x0);
  const f = R.fixed((run.x0 + run.x1) / 2, (run.z0 + run.z1) / 2, turn);
  const { h } = run;
  const c = run.color ?? look.trim ?? 0x8a8a8a;
  const posts = (step) => {
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i <= n; i++) f.cyl(c, -len / 2 + (i * len) / n, 0, 0, 0.06, h, 0, 0, CYL8);
  };
  if (run.kind === 'kerb') f.box(c, 0, 0, 0, len, h, 0.3);
  else if (run.kind === 'wall') {
    f.box(c, 0, 0, 0, len, h - 0.08, 0.4);
    f.box(look.roofs?.[0] ?? c, 0, h - 0.08, 0, len, 0.08, 0.5);
  } else if (run.kind === 'rail') {
    posts(2.5);
    f.box(c, 0, h * 0.5, 0, len, 0.06, 0.06);
    f.box(c, 0, h - 0.06, 0, len, 0.06, 0.06);
  } else if (run.kind === 'fence') {
    posts(2);
    for (const k of [0.25, 0.55, 0.85]) f.box(c, 0, h * k - 0.07, 0, len, 0.14, 0.05);
  } else if (run.kind === 'barrier') {
    const n = Math.max(1, Math.round(len / 1.5));
    const seg = len / n;
    const stripes = [c, look.lit?.[0] ?? 0xf2f2f2];
    for (let i = 0; i < n; i++) f.box(stripes[i % 2], -len / 2 + (i + 0.5) * seg, h * 0.3, 0, seg - 0.04, h * 0.7, 0.12);
    posts(3);
  }
}

// a hole in a wall framed, with mullions and a sill, and nothing painted in
// it: the world outside shows through (shell.js's windowIn, its picture left out)
export function opening(f, u, wall, { w, y0, h, mullion = 0, frame = 0xf6f2e8 }) {
  const v1 = wall.v1 ?? 0;
  const thick = wall.thick ?? 0.2;
  const y1 = y0 + h;
  const vm = v1 - thick / 2;
  const fw = 0.08;
  f.box(frame, u, y1 - 0.01, vm + 0.02, w + fw * 2, fw, thick + 0.04);
  f.box(frame, u, y0 - fw + 0.01, vm + 0.02, w + fw * 2, fw, thick + 0.04);
  for (const s of [-1, 1]) f.box(frame, u + s * (w / 2 + fw / 2), y0, vm + 0.02, fw, h, thick + 0.04);
  if (mullion > 0) for (let k = mullion; k < w - 1e-6; k += mullion) f.box(frame, u - w / 2 + k, y0, vm, 0.06, h, 0.06);
  f.box(frame, u, y0 - 0.05, v1 + 0.04, w + 0.24, 0.05, 0.1);
}
