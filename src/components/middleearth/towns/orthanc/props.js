// Orthanc, made in code: the kit the hidden chapter is built from. The great
// hall at the foot of the tower, black and polished and cut in many facets,
// its pillars going up into the dark, the throne on its dais and the
// palantír on its pillar in a cradle of claws; the library of lore off it,
// its cases of books, the lectern, and a jar where no jar should be; the
// tower itself, four piers of many-sided stone welded into one and parting
// at the top into four horns; the shaft inside it, and the stair winding up
// round its middle; the pinnacle between the horns; the pits of Isengard,
// the felled trees, and the banners of the White Hand; and the moth.
//
// Built on Mordor's kit (../doom/props.js: Gwaihir, Barad-dûr and the Eye,
// the orcs), and so on the Shire's, to the same conventions: metres, +x
// east, +z south, y up; each builder's group stands on y = 0 at its origin,
// fronts face +z, creatures face +x; fixed parts are merged one mesh per
// material. What glows is brighter than 1, so the bloom takes it.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture, hot } from '../../../../lib/three/stage3dNodes';
import { fbm, makeCanvas, makeNoise, normalFromField, paintPixels, smooth } from '../../../../lib/paint';
import { lathe, parts, rng, tube } from '../../shire/props';
import { createDoomKit } from '../doom/props';
import { ease } from '../../creatures';
import { ARCH, BRAZIERS, CASES, CORNERS, DAIS, DOORS, HALL_H, HORNS, LEAF, LECTERN, LIB, PILLARS, PIN, STAIR, STAIR_BASE, STAIR_DOOR, STAIR_LEN, THRONE, TOWER_H, WINDOWS, stairAngle, stairAt } from './layout';
import { glassyStone, stoneMaterial } from '../../nodes/towns/orthanc/propsShaders';

const TAU = Math.PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ── small helpers ──

// Faceted: each triangle its own flat face, so polished stone catches the
// light facet by facet.
function flat(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  return g;
}
// A geometry from quads, each four [x, y, z] corners in turn round it.
function quads(list) {
  const pos = [];
  for (const [a, b, c, d] of list) pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
// A box standing from (x0, z0) to (x1, z1) on the ground, `d` thick, from
// y0 to y1: a wall, a shelf, a ledge, along any line.
function slab(x0, z0, x1, z1, d, y0, y1) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const g = new THREE.BoxGeometry(len, y1 - y0, d);
  g.rotateY(-Math.atan2(z1 - z0, x1 - x0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}
// A pointed (lancet) arch's outline, `w` wide, its sides `h` tall before
// they lean together: points from the foot of its left side, over the
// point, to the foot of its right. `point` is each arc's radius over `w`.
function lancetPts(w, h, point = 0.9) {
  const r = Math.max(w / 2, w * point);
  const lc = -w / 2 + r; // the left arc's centre; the right's is at -lc
  const pts = [new THREE.Vector2(-w / 2, 0), new THREE.Vector2(-w / 2, h)];
  const a1 = Math.acos(-lc / r);
  for (let i = 1; i <= 10; i++) {
    const a = Math.PI + (a1 - Math.PI) * (i / 10);
    pts.push(new THREE.Vector2(lc + Math.cos(a) * r, h + Math.sin(a) * r));
  }
  const b0 = Math.acos(lc / r);
  for (let i = 1; i <= 10; i++) {
    const b = b0 * (1 - i / 10);
    pts.push(new THREE.Vector2(-lc + Math.cos(b) * r, h + Math.sin(b) * r));
  }
  pts.push(new THREE.Vector2(w / 2, 0));
  return { pts, top: h + Math.sqrt(r * r - lc * lc) };
}
const lancet = (w, h, point) => {
  const { pts, top } = lancetPts(w, h, point);
  return { shape: new THREE.Shape(pts), top };
};
// A frame round a pointed way through: a block `wo` wide and `H` tall with
// the lancet cut up into it from below, its point at `apex`.
function archFrame(wo, H, wi, apex, point = 0.9) {
  // the height of the sides that brings the point to `apex`
  const r = Math.max(wi / 2, wi * point);
  const lc = -wi / 2 + r;
  const { pts } = lancetPts(wi, apex - Math.sqrt(r * r - lc * lc), point);
  const out = [new THREE.Vector2(-wo / 2, 0), new THREE.Vector2(-wo / 2, H), new THREE.Vector2(wo / 2, H), new THREE.Vector2(wo / 2, 0), ...pts.reverse()];
  return new THREE.Shape(out);
}

// ── textures ──

// Black stone, polished: near-black with a cold grey mottle and fine veins.
function obsidianCanvas(S, seed) {
  const n = makeNoise(seed);
  const field = new Float32Array(S * S);
  const c = paintPixels(makeCanvas(S), (u, v, out, x, y) => {
    const m = fbm(n, u * 6, v * 6, { period: 6, octaves: 4 });
    const vein = Math.pow(1 - Math.abs(fbm(n, u * 3 + 5, v * 3, { period: 3, octaves: 4 }) * 2 - 1), 28);
    field[y * S + x] = m * 0.6 + vein * 0.3;
    const k = 18 + m * 16 + vein * 24;
    out[0] = k * 0.92;
    out[1] = k * 0.95;
    out[2] = k * 1.06;
  });
  return { c, field };
}
// The hall's floor, all of it in one picture: polished black, with lines of
// paler stone and silver inlaid in it, an eight-pointed star in the middle
// and a ring of octagons round it. `R` is the hall's corner radius.
function floorCanvas(S, R) {
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  // the stone's mottle: a small tile, laid over the whole floor
  const n = makeNoise(77);
  const tile = paintPixels(makeCanvas(128), (u, v, out) => {
    const m = fbm(n, u * 4, v * 4, { period: 4, octaves: 3 });
    const k = 10 + m * 12;
    out[0] = k;
    out[1] = k * 1.02;
    out[2] = k * 1.12;
  });
  g.fillStyle = g.createPattern(tile, 'repeat');
  g.fillRect(0, 0, S, S);
  const px = S / (2 * R);
  g.translate(S / 2, S / 2);
  g.scale(px, px);
  const oct = (r, rot = Math.PI / 8) => {
    g.beginPath();
    for (let k = 0; k <= 8; k++) {
      const a = rot + (k / 8) * TAU;
      const rr = r / Math.cos(Math.PI / 8);
      g[k ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.stroke();
  };
  g.lineJoin = 'miter';
  g.strokeStyle = 'rgba(70, 72, 82, 0.9)';
  g.lineWidth = 0.22;
  oct(13.2);
  oct(12.5);
  g.lineWidth = 0.08;
  g.strokeStyle = 'rgba(150, 156, 172, 0.75)';
  oct(12.85);
  // the ring round the middle
  g.lineWidth = 0.18;
  g.strokeStyle = 'rgba(60, 62, 72, 0.9)';
  g.beginPath();
  g.arc(0, 0, 8.6, 0, TAU);
  g.stroke();
  g.lineWidth = 0.06;
  g.strokeStyle = 'rgba(160, 166, 182, 0.7)';
  g.beginPath();
  g.arc(0, 0, 8.25, 0, TAU);
  g.stroke();
  // the star: eight points, in two shades
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    g.fillStyle = k % 2 ? 'rgba(34, 34, 40, 0.95)' : 'rgba(46, 46, 54, 0.95)';
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(Math.cos(a - 0.2) * 2.6, Math.sin(a - 0.2) * 2.6);
    g.lineTo(Math.cos(a) * 7.6, Math.sin(a) * 7.6);
    g.lineTo(Math.cos(a + 0.2) * 2.6, Math.sin(a + 0.2) * 2.6);
    g.closePath();
    g.fill();
    g.lineWidth = 0.05;
    g.strokeStyle = 'rgba(150, 156, 172, 0.6)';
    g.stroke();
  }
  g.lineWidth = 0.1;
  g.strokeStyle = 'rgba(150, 156, 172, 0.7)';
  g.beginPath();
  g.arc(0, 0, 1.4, 0, TAU);
  g.stroke();
  // small octagons on the ring
  g.lineWidth = 0.05;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU;
    g.save();
    g.translate(Math.cos(a) * 10.6, Math.sin(a) * 10.6);
    oct(0.55);
    g.restore();
  }
  return c;
}
// A shaft of light: bright down its middle, fading along it and at its edges.
function shaftCanvas(S = 64) {
  return paintPixels(makeCanvas(S, S * 2), (u, v, out) => {
    const side = Math.pow(Math.sin(u * Math.PI), 2.2);
    const along = smooth(0, 0.08, v) * (1 - smooth(0.35, 1, v));
    const a = side * along;
    out[0] = out[1] = out[2] = 255;
    out[3] = a * 255;
  });
}
// The White Hand on black: Saruman's banner.
function handCanvas(S = 128) {
  const c = makeCanvas(S, S * 2);
  const g = c.getContext('2d');
  g.fillStyle = '#0c0b0c';
  g.fillRect(0, 0, S, S * 2);
  g.fillStyle = '#e8e4da';
  g.translate(S / 2, S * 0.62);
  g.scale(S / 100, S / 100);
  // the palm
  g.beginPath();
  g.ellipse(0, 10, 22, 26, 0, 0, TAU);
  g.fill();
  // four fingers and a thumb
  for (const [x, len, tilt] of [
    [-15, 30, -0.12],
    [-5, 38, -0.04],
    [5, 40, 0.03],
    [15, 33, 0.1],
  ]) {
    g.save();
    g.translate(x, -6);
    g.rotate(tilt);
    g.fillRect(-4.2, -len, 8.4, len);
    g.beginPath();
    g.arc(0, -len, 4.2, 0, TAU);
    g.fill();
    g.restore();
  }
  g.save();
  g.translate(-20, 16);
  g.rotate(-0.9);
  g.fillRect(-4.5, -26, 9, 26);
  g.beginPath();
  g.arc(0, -26, 4.5, 0, TAU);
  g.fill();
  g.restore();
  return c;
}

// What glossy things see: a dark room with lamps in it.
function envRoom(renderer, low, high, lamps) {
  const room = new THREE.Scene();
  const walls = new THREE.BoxGeometry(20, 20, 20);
  const shade = [];
  const p = walls.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = (p.getY(i) + 10) / 20;
    shade.push(low[0] + (high[0] - low[0]) * k, low[1] + (high[1] - low[1]) * k, low[2] + (high[2] - low[2]) * k);
  }
  walls.setAttribute('color', new THREE.Float32BufferAttribute(shade, 3));
  room.add(new THREE.Mesh(walls, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  for (const [hex, k, w, h, pos] of lamps) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    room.add(m);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(room, 0.04).texture;
  pmrem.dispose();
  room.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
  return env;
}

// ── the great hall ──
// Its eight faces, each cut in six facets that zig-zag in and out; a way
// through in four of them (the doors, the arch, the stair, and nothing in
// the north, behind the throne), tall windows in the four diagonal faces;
// piers in the corners, string courses, and an eight-sided vault. Returns
// { group, windows: [{ at, dir }] } for the light coming in.
const FACETS = 6;
const CUTS = {
  // face k: from corner k-1 to corner k (./layout.js)
  0: { y0: 0, y1: ARCH.h, kind: 'arch' },
  2: { y0: 0, y1: DOORS.h, kind: 'doors' },
  4: { y0: 0, y1: STAIR_DOOR.h, kind: 'door' },
  1: { y0: 11, y1: 20, kind: 'window' },
  3: { y0: 11, y1: 20, kind: 'window' },
  5: { y0: 11, y1: 20, kind: 'window' },
  7: { y0: 11, y1: 20, kind: 'window' },
};
function hall(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'hall';
  const bk = parts();
  const deep = 0.38;
  const windows = [];
  const R = CORNERS.length;
  for (let k = 0; k < R; k++) {
    const [x0, z0] = CORNERS[(k + R - 1) % R];
    const [x1, z1] = CORNERS[k];
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    const ml = Math.hypot(mx, mz);
    const nx = -mx / ml;
    const nz = -mz / ml;
    const cut = CUTS[k];
    const Q = [];
    for (let i = 0; i <= FACETS; i++) {
      const t = i / FACETS;
      const o = i % 2 ? deep : 0;
      Q.push([x0 + (x1 - x0) * t + nx * o, z0 + (z1 - z0) * t + nz * o]);
    }
    const list = [];
    const band = (a, b, y0, y1) => list.push([[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]]);
    for (let i = 0; i < FACETS; i++) {
      const middle = cut && (i === 2 || i === 3);
      if (middle) {
        if (cut.y0 > 0) band(Q[i], Q[i + 1], 0, cut.y0);
        band(Q[i], Q[i + 1], cut.y1, HALL_H);
      } else band(Q[i], Q[i + 1], 0, HALL_H);
    }
    if (cut) {
      // the reveal: the cut goes back through the wall's thickness
      const a = Q[2];
      const b = Q[4];
      const back = 1;
      const out = (p) => [p[0] - nx * back, p[1] - nz * back];
      const ao = out(a);
      const bo = out(b);
      list.push([[a[0], cut.y0, a[1]], [a[0], cut.y1, a[1]], [ao[0], cut.y1, ao[1]], [ao[0], cut.y0, ao[1]]]);
      list.push([[b[0], cut.y0, b[1]], [bo[0], cut.y0, bo[1]], [bo[0], cut.y1, bo[1]], [b[0], cut.y1, b[1]]]);
      list.push([[a[0], cut.y1, a[1]], [b[0], cut.y1, b[1]], [bo[0], cut.y1, bo[1]], [ao[0], cut.y1, ao[1]]]);
      if (cut.y0 > 0) list.push([[a[0], cut.y0, a[1]], [ao[0], cut.y0, ao[1]], [bo[0], cut.y0, bo[1]], [b[0], cut.y0, b[1]]]);
      const cx = (a[0] + b[0]) / 2;
      const cz = (a[1] + b[1]) / 2;
      const turn = Math.atan2(-nz, nx) - Math.PI / 2;
      if (cut.kind === 'window') {
        // the glass, set back in the wall: grey light from outside
        const w = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const pane = new THREE.PlaneGeometry(w, cut.y1 - cut.y0);
        pane.rotateY(turn + Math.PI);
        pane.translate(cx - nx * (back - 0.1), (cut.y0 + cut.y1) / 2, cz - nz * (back - 0.1));
        bk.add(mats.paneGlow, pane);
        // mullions
        for (const f of [0.33, 0.66]) bk.add(mats.iron, slab(a[0] + (b[0] - a[0]) * f - nx * (back - 0.3), a[1] + (b[1] - a[1]) * f - nz * (back - 0.3), a[0] + (b[0] - a[0]) * f - nx * (back - 0.15), a[1] + (b[1] - a[1]) * f - nz * (back - 0.15), 0.12, cut.y0, cut.y1));
        bk.add(mats.iron, slab(a[0] - nx * (back - 0.2), a[1] - nz * (back - 0.2), b[0] - nx * (back - 0.2), b[1] - nz * (back - 0.2), 0.12, (cut.y0 + cut.y1) / 2 - 0.06, (cut.y0 + cut.y1) / 2 + 0.06));
        windows.push({ at: V3(cx, (cut.y0 + cut.y1) / 2, cz), dir: V3(nx, 0, nz) });
      } else if (cut.kind === 'doors') {
        // the great doors, shut: two leaves, studded with iron
        const w = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (const s of [-1, 1]) {
          const leaf = new THREE.BoxGeometry(w / 2 - 0.03, cut.y1 - 0.05, 0.3);
          leaf.rotateY(turn);
          const fx = cx + (b[0] - a[0]) * 0.25 * s;
          const fz = cz + (b[1] - a[1]) * 0.25 * s;
          leaf.translate(fx - nx * 0.7, (cut.y1 - 0.05) / 2, fz - nz * 0.7);
          bk.add(mats.door, leaf, { uv: 0.5 });
          for (let r = 0; r < 7; r++) {
            for (let c2 = 0; c2 < 4; c2++) {
              const along = ((c2 + 0.5) / 4 - 0.5) * (w / 2 - 0.4);
              const sx = fx + ((b[0] - a[0]) / w) * along;
              const sz = fz + ((b[1] - a[1]) / w) * along;
              bk.add(mats.iron, new THREE.SphereGeometry(0.07, 6, 4), { p: [sx - nx * 0.53, 0.9 + r * 1.35, sz - nz * 0.53] });
            }
          }
          bk.add(mats.iron, new THREE.TorusGeometry(0.28, 0.05, 6, 16).rotateY(turn), { p: [cx + (b[0] - a[0]) * 0.07 * s - nx * 0.5, 3.4, cz + (b[1] - a[1]) * 0.07 * s - nz * 0.5] });
        }
      } else if (cut.kind === 'door') {
        // the door to the stair: narrower, pointed, iron-bound
        const { shape } = lancet(2.2, 3.4);
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false });
        geo.rotateY(turn);
        geo.translate(cx - nx * 0.75, 0, cz - nz * 0.75);
        bk.add(mats.door, geo, { uv: 0.6 });
        for (const y of [0.8, 2.2, 3.4]) bk.add(mats.iron, slab(cx + (b[0] - a[0]) * -0.14 - nx * 0.6, cz + (b[1] - a[1]) * -0.14 - nz * 0.6, cx + (b[0] - a[0]) * 0.14 - nx * 0.6, cz + (b[1] - a[1]) * 0.14 - nz * 0.6, 0.06, y, y + 0.12));
        // and the dark round it
        const fill = new THREE.PlaneGeometry(Math.hypot(b[0] - a[0], b[1] - a[1]), cut.y1);
        fill.rotateY(turn + Math.PI);
        fill.translate(cx - nx * 0.95, cut.y1 / 2, cz - nz * 0.95);
        bk.add(mats.void, fill);
      } else if (cut.kind === 'arch') {
        // a pointed frame in the way to the library
        const geo = new THREE.ExtrudeGeometry(archFrame(ARCH.w + 0.7, ARCH.h + 0.9, ARCH.w - 0.1, ARCH.h - 0.15), { depth: 0.3, bevelEnabled: false });
        geo.rotateY(turn + Math.PI);
        geo.translate(cx + nx * 0.28, 0, cz + nz * 0.28);
        bk.add(mats.trim, geo);
      }
    }
    bk.add(mats.obsidian, flat(quads(list)), { uv: 0.22 });
    // string courses, broken where the doors are
    for (const y of [7.6, 15.4]) {
      if (cut && y < cut.y1 && y > cut.y0) continue;
      const ins = 0.22;
      bk.add(mats.trim, slab(x0 + nx * ins, z0 + nz * ins, x1 + nx * ins, z1 + nz * ins, 0.5, y, y + 0.28), { uv: 0.4 });
    }
    // the pier in the corner, many-sided
    bk.add(mats.obsidian, flat(new THREE.CylinderGeometry(0.7, 0.95, HALL_H, 5, 1).rotateY(k)), { p: [x1 * 0.97, HALL_H / 2, z1 * 0.97], uv: 0.22 });
  }
  // the vault: eight-sided, dark, ribbed
  const vault = new THREE.ConeGeometry(CORNERS[0][0] / Math.cos(Math.PI / 8) / 1.0, 10, 8, 3, true, Math.PI / 8);
  vault.scale(1.0, 1, 1.0);
  bk.add(mats.vault, flat(vault), { p: [0, HALL_H + 5, 0] });
  for (const [x, z] of CORNERS) bk.add(mats.trim, tube([[x, HALL_H, z], [x * 0.5, HALL_H + 5.4, z * 0.5], [0, HALL_H + 9.6, 0]], 0.22, 0.12, { seg: 8, radial: 5 }));

  // the floor: one polished piece, its pattern in it
  const floor = new THREE.CircleGeometry(CORNERS[0][0] / Math.cos(Math.PI / 8), 8, Math.PI / 8).rotateX(-Math.PI / 2);
  const fm = new THREE.Mesh(floor, mats.floor);
  fm.receiveShadow = true;
  g.add(fm);

  // pillars: many-sided, a plinth and a flared capital, going up into the dark
  for (const [x, z] of PILLARS) {
    const turn = Math.atan2(z, x);
    bk.add(mats.obsidian, flat(new THREE.CylinderGeometry(1.25, 1.35, 0.7, 8).rotateY(turn)), { p: [x, 0.35, z], uv: 0.3 });
    bk.add(mats.obsidian, flat(new THREE.CylinderGeometry(0.82, 0.95, HALL_H - 0.7, 6, 1).rotateY(turn)), { p: [x, 0.7 + (HALL_H - 0.7) / 2, z], uv: 0.22 });
    bk.add(mats.trim, flat(new THREE.CylinderGeometry(1.15, 0.82, 1.2, 6).rotateY(turn)), { p: [x, HALL_H - 4, z], uv: 0.3 });
    // a blade of stone down each, catching the light
    for (let s = 0; s < 3; s++) {
      const a = turn + (s / 3) * TAU;
      bk.add(mats.trim, flat(new THREE.BoxGeometry(0.12, HALL_H - 6, 0.34).rotateY(-a)), { p: [x + Math.cos(a) * 0.92, 0.7 + (HALL_H - 6) / 2, z + Math.sin(a) * 0.92] });
    }
  }

  // the dais, three steps, and the throne on it
  for (let i = 0; i < DAIS.steps; i++) {
    const h = ((i + 1) / DAIS.steps) * DAIS.h;
    const d = DAIS.d - i * 0.6;
    const w = DAIS.w - i * 1.2;
    bk.add(mats.obsidian, new THREE.BoxGeometry(w, DAIS.h / DAIS.steps, d), { p: [DAIS.x, h - DAIS.h / DAIS.steps / 2, DAIS.z - DAIS.d / 2 + d / 2], uv: 0.3 });
    bk.add(mats.trim, new THREE.BoxGeometry(w + 0.02, 0.04, 0.06), { p: [DAIS.x, h, DAIS.z - DAIS.d / 2 + d + 0.01] });
  }
  {
    const y = DAIS.h;
    const { x, z } = THRONE;
    bk.add(mats.obsidian, flat(new THREE.BoxGeometry(1.5, 0.55, 1.1)), { p: [x, y + 0.28, z + 0.15], uv: 0.4 });
    const back = lancet(1.5, 2.9, 0.75);
    const geo = new THREE.ExtrudeGeometry(back.shape, { depth: 0.32, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1 });
    bk.add(mats.obsidian, flat(geo), { p: [x, y, z - 0.55], uv: 0.4 });
    // a spike of stone either side of the back, and the arms
    for (const s of [-1, 1]) {
      bk.add(mats.obsidian, flat(new THREE.ConeGeometry(0.16, 4.4, 4)), { p: [x + s * 0.86, y + 2.2, z - 0.42], uv: 0.4 });
      bk.add(mats.obsidian, flat(new THREE.BoxGeometry(0.18, 0.5, 1.0)), { p: [x + s * 0.72, y + 0.8, z + 0.15], uv: 0.4 });
      bk.add(mats.trim, new THREE.BoxGeometry(0.22, 0.05, 1.04), { p: [x + s * 0.72, y + 1.07, z + 0.15] });
    }
    // a pale cushion: Saruman's colour
    bk.add(K.mats.cushion, new THREE.BoxGeometry(1.2, 0.08, 0.86), { p: [x, y + 0.6, z + 0.18] });
  }

  // a pale lamp hanging on a long chain before the throne
  const lamp = V3(THRONE.x, 7, THRONE.z + 3);
  bk.add(mats.iron, new THREE.CylinderGeometry(0.02, 0.02, HALL_H + 4 - lamp.y, 4), { p: [lamp.x, (HALL_H + 4 + lamp.y) / 2, lamp.z] });
  bk.add(mats.iron, lathe([[0.04, -0.5], [0.3, -0.3], [0.36, 0.1], [0.2, 0.4], [0.03, 0.55]], 8), { p: [lamp.x, lamp.y, lamp.z] });
  bk.add(mats.lampGlow, new THREE.SphereGeometry(0.24, 14, 10), { p: [lamp.x, lamp.y, lamp.z] });

  // braziers: iron bowls on tripods, glowing
  const fires = [];
  for (const [x, z] of BRAZIERS) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + 0.3;
      bk.add(mats.iron, tube([[x + Math.cos(a) * 0.45, 0, z + Math.sin(a) * 0.45], [x + Math.cos(a) * 0.3, 0.7, z + Math.sin(a) * 0.3], [x + Math.cos(a) * 0.36, 1.1, z + Math.sin(a) * 0.36]], 0.04, 0.03, { seg: 6, radial: 5 }));
    }
    bk.add(mats.iron, lathe([[0.05, 0], [0.4, 0.12], [0.55, 0.32], [0.58, 0.36], [0.5, 0.36]], 14), { p: [x, 1.0, z] });
    bk.add(mats.coals, new THREE.CircleGeometry(0.5, 14).rotateX(-Math.PI / 2), { p: [x, 1.31, z] });
    fires.push(V3(x, 1.38, z));
  }
  bk.build(g, { shadow: false, receive: true });
  return { group: g, windows, fires, lamp };
}

// ── the palantír on its pillar ──
// A many-sided pillar, a cup, four claws curling up to hold the stone; and
// the black cloth over it, until it's drawn off. update(t, { wake, eye,
// covered }).
function palantir(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'palantir';
  const bk = parts();
  bk.add(mats.obsidian, flat(new THREE.CylinderGeometry(0.42, 0.52, 0.2, 8)), { p: [0, 0.1, 0], uv: 0.6 });
  bk.add(mats.obsidian, flat(new THREE.CylinderGeometry(0.17, 0.26, 1.05, 6)), { p: [0, 0.72, 0], uv: 0.6 });
  bk.add(mats.trim, flat(new THREE.CylinderGeometry(0.3, 0.16, 0.16, 6)), { p: [0, 1.3, 0] });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    const c = Math.cos(a);
    const s = Math.sin(a);
    bk.add(mats.iron, tube([[c * 0.22, 1.34, s * 0.22], [c * 0.34, 1.48, s * 0.34], [c * 0.3, 1.66, s * 0.3], [c * 0.18, 1.76, s * 0.18]], 0.035, 0.012, { seg: 10, radial: 5 }));
  }
  bk.build(g, { shadow: false });
  const stone = new THREE.Mesh(new THREE.SphereGeometry(0.27, 40, 28), mats.stone);
  stone.position.y = 1.62;
  g.add(stone);
  // the cloth: a hood of black velvet over it, its hem lying on the cup
  const cloth = new THREE.Group();
  {
    const geo = new THREE.SphereGeometry(0.42, 24, 14, 0, TAU, 0, Math.PI * 0.62);
    const p = geo.attributes.position;
    const n = makeNoise(5);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const k = 1 - smooth(-0.2, 0.42, y);
      const fold = 1 + (n(Math.atan2(z, x) * 3, 1) - 0.5) * 0.35 * k;
      p.setXYZ(i, x * fold, y - k * 0.25, z * fold);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mats.velvet);
    m.position.y = 1.56;
    cloth.add(m);
  }
  g.add(cloth);
  const U = mats.stone.uniforms;
  const update = (t, { wake = 0, eye = 0, covered = false } = {}) => {
    U.uTime.value = t;
    U.uWake.value = wake;
    U.uEye.value = eye;
    cloth.visible = covered;
  };
  return { group: g, stone, update };
}

// ── the library ──
// Its floor, its walls lined with cases of books, the two cases standing
// out from the long walls, the lectern with the book open on it and a
// candle; a ladder; and, behind the northern case, low down, a little stone
// jar. Returns { group, candle } (where the candle's flame is).
function library(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'library';
  const bk = parts();
  const { x0, x1, z0, z1, h } = LIB;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const W = x1 - x0;
  const D = z1 - z0;
  bk.add(mats.libFloor, new THREE.PlaneGeometry(W + 1.4, D + 0.6).rotateX(-Math.PI / 2), { p: [cx - 0.4, 0.005, cz], uv: 0.5 });
  // walls behind the cases, and the ceiling with its beams
  const wall = (ax, az, bx, bz) => bk.add(mats.obsidian, slab(ax, az, bx, bz, 0.3, 0, h), { uv: 0.25 });
  wall(x0, z0 - 0.75, x1 + 0.6, z0 - 0.75);
  wall(x0, z1 + 0.75, x1 + 0.6, z1 + 0.75);
  wall(x1 + 0.75, z0 - 0.75, x1 + 0.75, z1 + 0.75);
  // the library's side of the hall's east face, round the arch
  wall(x0 + 0.5, z0 - 0.75, x0 + 0.5, -ARCH.w / 2);
  wall(x0 + 0.5, ARCH.w / 2, x0 + 0.5, z1 + 0.75);
  bk.add(mats.obsidian, slab(x0 + 0.5, -ARCH.w / 2, x0 + 0.5, ARCH.w / 2, 0.3, ARCH.h, h), { uv: 0.25 });
  bk.add(mats.vault, new THREE.PlaneGeometry(W + 1.8, D + 1.6).rotateX(Math.PI / 2), { p: [cx, h, cz] });
  for (let i = 0; i < 6; i++) bk.add(mats.wood, new THREE.BoxGeometry(0.3, 0.4, D + 1.5), { p: [x0 + 1 + i * 1.95, h - 0.2, cz], uv: 0.6 });

  // books: one instanced box, each its own size, colour and lean
  const books = [];
  const palette = [0x5a1a14, 0x3a2416, 0x24341e, 0x1e2a3a, 0x6a4a1e, 0x2a1a1a, 0x4a3a2a, 0x7a6a4a, 0x3a1a2a, 0x14181a];
  const r = rng(91);
  const shelfOf = (ax, az, bx, bz, face, levels, top) => {
    // a run of case from a to b, its books facing `face` (an outward normal)
    const len = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / len;
    const uz = (bz - az) / len;
    const turn = Math.atan2(-uz, ux);
    const depth = 0.42;
    // the frame: back, sides, shelves
    const back = slab(ax, az, bx, bz, 0.05, 0, top);
    back.translate(-face[0] * (depth / 2 - 0.02), 0, -face[1] * (depth / 2 - 0.02));
    bk.add(mats.wood, back, { uv: 0.8 });
    for (const t of [0, len]) {
      const px = ax + ux * t;
      const pz = az + uz * t;
      bk.add(mats.wood, new THREE.BoxGeometry(0.08, top, depth).rotateY(turn), { p: [px, top / 2, pz], uv: 0.8 });
    }
    for (let l = 0; l <= levels; l++) {
      const y = 0.12 + (l / levels) * (top - 0.3);
      bk.add(mats.wood, slab(ax, az, bx, bz, depth, y - 0.04, y), { uv: 0.8 });
      if (l === levels) break;
      const room = (top - 0.3) / levels - 0.08;
      // fill it, mostly
      for (let t = 0.08; t < len - 0.1; ) {
        if (r() < 0.04) {
          t += 0.3 + r() * 0.4;
          continue;
        }
        const w = 0.045 + r() * 0.07;
        const hh = room * (0.62 + r() * 0.34);
        const d = depth * (0.6 + r() * 0.3);
        const lean = r() < 0.06 ? (r() - 0.5) * 0.5 : 0;
        books.push({ x: ax + ux * (t + w / 2), y: y + hh / 2, z: az + uz * (t + w / 2), w, h: hh, d, turn, lean, colour: palette[Math.floor(r() * palette.length)] });
        t += w + 0.004;
      }
    }
  };
  // round the walls
  shelfOf(x0 + 0.7, z0 - 0.3, x1 + 0.3, z0 - 0.3, [0, 1], 9, 5.6);
  shelfOf(x1 + 0.3, z1 + 0.3, x0 + 0.7, z1 + 0.3, [0, -1], 9, 5.6);
  shelfOf(x1 + 0.3, z0 - 0.3, x1 + 0.3, z1 + 0.3, [-1, 0], 9, 5.6);
  // the two cases standing out, books on both faces
  for (const c of CASES) {
    const za = c.z - c.d / 2;
    const zb = c.z + c.d / 2;
    shelfOf(c.x - 0.15, zb, c.x - 0.15, za, [-1, 0], 7, c.top);
    shelfOf(c.x + 0.15, za, c.x + 0.15, zb, [1, 0], 7, c.top);
  }
  const box = new THREE.BoxGeometry(1, 1, 1);
  const bookMesh = new THREE.InstancedMesh(box, mats.books, books.length);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = V3();
    const p = V3();
    const col = new THREE.Color();
    books.forEach((b, i) => {
      e.set(0, b.turn, b.lean, 'YXZ');
      q.setFromEuler(e);
      m.compose(p.set(b.x, b.y, b.z), q, s.set(b.w, b.h, b.d));
      bookMesh.setMatrixAt(i, m);
      bookMesh.setColorAt(i, col.set(b.colour).multiplyScalar(0.8 + r() * 0.4));
    });
  }
  bookMesh.name = 'books';
  g.add(bookMesh);

  // the lectern: a post, a sloping desk, the book open on it, a candle
  {
    const { x, z } = LECTERN;
    bk.add(mats.wood, flat(new THREE.CylinderGeometry(0.22, 0.32, 0.12, 6)), { p: [x, 0.06, z] });
    bk.add(mats.wood, flat(new THREE.CylinderGeometry(0.07, 0.09, 1.05, 6)), { p: [x, 0.6, z] });
    const desk = new THREE.BoxGeometry(0.62, 0.05, 0.78).rotateZ(-0.42);
    bk.add(mats.wood, desk, { p: [x, 1.18, z], uv: 1 });
    for (const s of [-1, 1]) {
      const page = new THREE.PlaneGeometry(0.42, 0.34, 4, 1);
      const pp = page.attributes.position;
      for (let i = 0; i < pp.count; i++) pp.setZ(i, Math.sin((pp.getX(i) / 0.42 + 0.5) * Math.PI) * 0.03);
      page.rotateX(-Math.PI / 2).rotateY(Math.PI / 2).rotateZ(-0.42);
      bk.add(mats.page, page, { p: [x - 0.01, 1.22, z + s * 0.19] });
    }
    // the candle, and its stick
    bk.add(mats.iron, lathe([[0.06, 0], [0.07, 0.02], [0.03, 0.04], [0.03, 0.1], [0.05, 0.12]], 10), { p: [x + 0.05, 1.3, z - 0.46] });
    bk.add(mats.wax, new THREE.CylinderGeometry(0.03, 0.03, 0.24, 8), { p: [x + 0.05, 1.54, z - 0.46] });
  }
  // a ladder against the northern shelves
  {
    const lx = x0 + 3.2;
    const lz = z0 - 0.0;
    for (const s of [-1, 1]) bk.add(mats.wood, tube([[lx + s * 0.25, 0, lz + 0.62], [lx + s * 0.25, 5.4, lz + 0.02]], 0.035, 0.03, { seg: 2, radial: 5 }));
    for (let i = 0; i < 12; i++) {
      const k = (i + 0.5) / 12;
      bk.add(mats.wood, new THREE.CylinderGeometry(0.022, 0.022, 0.5, 5).rotateZ(Math.PI / 2), { p: [lx, k * 5.4, lz + 0.62 - k * 0.6] });
    }
  }
  // a reading table near the arch, with a map on it, and scrolls
  {
    const tx = x0 + 2.4;
    bk.add(mats.wood, new THREE.BoxGeometry(1.2, 0.08, 2.2), { p: [tx, 0.86, 0], uv: 1 });
    for (const [dx, dz] of [
      [-0.5, -1],
      [0.5, -1],
      [-0.5, 1],
      [0.5, 1],
    ])
      bk.add(mats.wood, new THREE.BoxGeometry(0.08, 0.86, 0.08), { p: [tx + dx, 0.43, dz] });
    bk.add(mats.parchment, new THREE.PlaneGeometry(0.9, 1.3).rotateX(-Math.PI / 2).rotateY(0.1), { p: [tx, 0.905, -0.2] });
    for (let i = 0; i < 3; i++) bk.add(mats.parchment, new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8).rotateZ(Math.PI / 2).rotateY(0.3 * i), { p: [tx - 0.2 + i * 0.12, 0.94, 0.75] });
  }
  // the jar: plain brown earthenware, a lid tied down with string
  {
    const [jx, jz] = LEAF.jar;
    bk.add(mats.jar, lathe([[0.001, 0], [0.07, 0.005], [0.09, 0.06], [0.085, 0.15], [0.06, 0.18], [0.062, 0.2]], 14), { p: [jx, 0.13, jz] });
    bk.add(mats.jar, lathe([[0.001, 0.03], [0.07, 0.02], [0.072, 0]], 14), { p: [jx, 0.33, jz] });
    bk.add(mats.rope, new THREE.TorusGeometry(0.063, 0.006, 4, 16).rotateX(Math.PI / 2), { p: [jx, 0.31, jz] });
  }
  // two lanterns hanging on chains down the middle of the room
  const lamps = [];
  for (const lx of [x0 + 3.4, x0 + 7.6]) {
    const ly = 5.2;
    bk.add(mats.iron, new THREE.CylinderGeometry(0.015, 0.015, h - ly - 0.4, 4), { p: [lx, (h + ly + 0.4) / 2, cz] });
    bk.add(mats.iron, lathe([[0.05, -0.32], [0.2, -0.22], [0.22, 0.22], [0.12, 0.34], [0.02, 0.42]], 6), { p: [lx, ly, cz] });
    bk.add(mats.lanternGlow, new THREE.CylinderGeometry(0.17, 0.17, 0.4, 6), { p: [lx, ly, cz] });
    lamps.push(V3(lx, ly, cz));
  }
  bk.build(g, { shadow: false, receive: true });
  return { group: g, lamps, candle: V3(LECTERN.x + 0.05, 1.7, LECTERN.z - 0.46), jar: V3(LEAF.jar[0], 0.25, LEAF.jar[1]) };
}

// ── the tower ──
// Orthanc from outside, as the films built it: four great piers welded
// into one, each a many-sided blade of black stone, fluted, with a knife
// edge running up its outer face; deep clefts between them, where the
// windows are; their feet flaring out like roots onto a stepped plinth,
// the long stair climbing to the door in the south cleft, and high up
// Saruman's balcony. At the top the piers part and go on up as four horns,
// curving out like claws, with lesser spikes between; the pinnacle's floor
// in the middle of them, and the shut hatch the stair comes up through.
// Hidden from inside the shaft (`shell`), where only the top shows.

// a pier's cross-section: its knife edge out along +u, fluted down its
// sides, flatter where it's welded to the core (-u)
const PIER = (() => {
  const half = [
    [1, 0],
    [0.86, 0.13],
    [0.8, 0.24],
    [0.66, 0.33],
    [0.6, 0.45],
    [0.44, 0.55],
    [0.36, 0.67],
    [0.16, 0.76],
    [-0.08, 0.8],
    [-0.34, 0.7],
    [-0.52, 0.46],
    [-0.6, 0.2],
  ];
  return [...half, [-0.62, 0], ...half.slice(1).reverse().map(([u, v]) => [u, -v])];
})();
// A loft of the pier's section up through `rings` ({ y, rc, s }: its middle
// `rc` out from the axis along angle `a`, its size `s`), flat-faced, so the
// facets catch the light. The last ring of a horn closes to a point.
function loftPier(a, rings, section = PIER) {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const pts = rings.map(({ y, rc, s, dv = 0 }) => section.map(([u, v]) => [ca * (rc + u * s) - sa * (v * s + dv), y, sa * (rc + u * s) + ca * (v * s + dv)]));
  const pos = [];
  const n = section.length;
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < n; i++) {
      const a0 = pts[j][i];
      const a1 = pts[j][(i + 1) % n];
      const b0 = pts[j + 1][i];
      const b1 = pts[j + 1][(i + 1) % n];
      pos.push(...a0, ...b0, ...a1, ...a1, ...b0, ...b1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}
// the piers' size and how far out their middles stand, by height: leaning
// in as they rise, and flaring at the foot like roots
const PLINTH = 4.8;
const pierAt = (y) => {
  const k = Math.max(0, Math.min(1, (y - PLINTH) / (TOWER_H - PLINTH)));
  const root = Math.exp(-(y - PLINTH) / 6.5);
  return { y, rc: 9.4 + (6.4 - 9.4) * k + 5.2 * root, s: (7 + (3.9 - 7) * k) * (1 + 0.5 * root) };
};

// the horns, the blades beside them and the spikes between: their size
// and how far out, by height (shared with insideTop, for the camera)
const HORN = 21;
const BLADE = { off: 0.42, y0: TOWER_H - 12, h: 16 };
const SPIKE = { y0: TOWER_H - 3, h: 11 };
const hornAt = (y) => {
  const t = Math.max(0, Math.min(1, (y - TOWER_H) / HORN));
  // out like a claw, then up to a point, leaning back in at the tip
  return { rc: 6.4 + 7.2 * t - 4.4 * t * t, s: 4.1 * Math.pow(1 - t, 1.1) + 0.02 };
};
const bladeAt = (y) => {
  const k = Math.max(0, Math.min(1, (y - BLADE.y0) / BLADE.h));
  return { rc: 7.2 + k * 2.8 + k * k * 1.6, s: 1.5 * Math.pow(1 - k, 1.2) + 0.02 };
};
const spikeAt = (y) => {
  const k = Math.max(0, Math.min(1, (y - SPIKE.y0) / SPIKE.h));
  return { rc: 5.6 + k * 1.2, s: 1.7 * Math.pow(1 - k, 1.3) + 0.02 };
};
const HORN_A = HORNS.map(([hx, hz]) => Math.atan2(hz, hx));
// Is (x, y, z), in the tower's own frame, inside a horn, a blade or a
// spike (give or take `m`)? So the camera on the pinnacle can keep out.
export function insideTop(x, y, z, m = 0.4) {
  const within = (a, { rc, s }) => {
    const du = x * Math.cos(a) + z * Math.sin(a) - rc;
    const dv = -x * Math.sin(a) + z * Math.cos(a);
    return du > -0.62 * s - m && du < s + m && Math.abs(dv) < 0.8 * s + m;
  };
  for (const a of HORN_A) {
    if (y < TOWER_H + HORN && within(a, hornAt(y))) return true;
    if (y > BLADE.y0 && y < BLADE.y0 + BLADE.h && (within(a - BLADE.off, bladeAt(y)) || within(a + BLADE.off, bladeAt(y)))) return true;
  }
  if (y > SPIKE.y0 && y < SPIKE.y0 + SPIKE.h) for (let i = 0; i < 4; i++) if (within((i * Math.PI) / 2, spikeAt(y))) return true;
  return false;
}

function tower(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'orthanc';
  const shell = new THREE.Group();
  const top = new THREE.Group();
  g.add(shell, top);
  const bk = parts();
  const H = TOWER_H;
  const angles = HORNS.map(([hx, hz]) => Math.atan2(hz, hx));
  // the plinth, in three great steps, and the stair up it from the south
  for (let i = 0; i < 3; i++) bk.add(mats.towerStone, flat(new THREE.CylinderGeometry(29 - i * 2.6, 30 - i * 2.6, PLINTH / 3, 8).rotateY(Math.PI / 8)), { p: [0, PLINTH / 6 + (i * PLINTH) / 3, 0], uv: 0.08 });
  for (let i = 0; i < 14; i++) bk.add(mats.towerStone, new THREE.BoxGeometry(7.4 - i * 0.12, 0.42, 1.2), { p: [0, 0.21 + i * 0.36, 36.6 - i * 0.9], uv: 0.3 });
  // its cheeks, either side of the stair
  for (const sx of [-1, 1]) bk.add(mats.towerStone, flat(new THREE.CylinderGeometry(0.01, 0.9, 13, 3).rotateX(Math.PI / 2 - 0.36)), { p: [sx * 4.2, 2.4, 30.5], uv: 0.2 });

  // the four piers, root to top
  const shaftRings = [];
  for (let y = PLINTH; y < H; y += y < 22 ? 1.6 : 6) shaftRings.push(pierAt(y));
  shaftRings.push(pierAt(H));
  for (const a of angles) bk.add(mats.towerStone, flat(loftPier(a, shaftRings)), { uv: 0.08 });
  // the core between them, its faces in the clefts, flaring at the foot with them
  {
    const core = new THREE.CylinderGeometry(1, 1, 1, 8, 24, true);
    const p = core.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = PLINTH + (p.getY(i) + 0.5) * (H - 0.6 - PLINTH);
      const { rc, s } = pierAt(y);
      const apothem = rc * 0.86 + s * 0.06;
      const r = apothem / Math.cos(Math.PI / 8);
      p.setXYZ(i, p.getX(i) * r, y, p.getZ(i) * r);
    }
    bk.add(mats.towerStone, flat(core.rotateY(Math.PI / 8)), { uv: 0.08 });
  }
  // buttresses in the clefts at the foot, east, west and north: knife-edged
  // fins down onto the plinth (the south cleft has the door)
  for (const a of [0, Math.PI, -Math.PI / 2]) {
    const fin = [
      { y: PLINTH, rc: 15.5, s: 4.6 },
      { y: PLINTH + 5, rc: 12, s: 3.4 },
      { y: PLINTH + 12, rc: 9.6, s: 2.2 },
      { y: PLINTH + 22, rc: 8.4, s: 0.6 },
    ];
    bk.add(mats.towerStone, flat(loftPier(a, fin)), { uv: 0.08 });
  }
  // the door, in the south cleft at the head of the stair: a pointed arch,
  // deep in a frame of black stone
  {
    const { shape } = lancet(4.4, 7.4, 0.95);
    const apo = (y) => pierAt(y).rc * 0.86 + pierAt(y).s * 0.06;
    const z = apo(PLINTH + 5) + 0.25;
    bk.add(mats.void, new THREE.ShapeGeometry(shape, 8), { p: [0, PLINTH, z] });
    const frame = archFrame(7.4, 13.5, 4.4, 10.6, 0.95);
    bk.add(mats.towerStone, flat(new THREE.ExtrudeGeometry(frame, { depth: 1.6, bevelEnabled: false, curveSegments: 8 })), { p: [0, PLINTH, z - 0.6], uv: 0.15 });
  }
  // Saruman's balcony, high on the south face: a half-round ledge on
  // brackets like claws, and a pointed door behind it
  {
    const y = 76;
    const { rc, s } = pierAt(y);
    const z = rc * 0.86 + s * 0.06;
    const ledge = new THREE.CylinderGeometry(3.4, 3.4, 0.7, 12, 1, false, -Math.PI / 2, Math.PI);
    bk.add(mats.towerStone, flat(ledge), { p: [0, y, z], uv: 0.2 });
    for (const dx of [-2.2, 0, 2.2]) bk.add(mats.towerStone, flat(new THREE.ConeGeometry(0.5, 4.6, 4).rotateX(-Math.PI / 2 - 0.62)), { p: [dx, y - 2, z + 1.4], uv: 0.2 });
    const { shape } = lancet(2, 3.2, 0.95);
    bk.add(mats.slitGlow, new THREE.ShapeGeometry(shape, 8), { p: [0, y + 0.36, z + 0.05] });
    for (const dx of [-3.2, 3.2]) bk.add(mats.towerStone, new THREE.BoxGeometry(0.25, 1.1, 0.25), { p: [dx * 0.94, y + 0.9, z + 0.9], uv: 0.3 });
  }
  // windows: tall narrow lancets up the clefts, a few lit from within
  {
    const rows = [
      [0, 28],
      [Math.PI, 36],
      [-Math.PI / 2, 44],
      [0, 54],
      [Math.PI / 2, 60],
      [Math.PI, 66],
      [-Math.PI / 2, 72],
      [0, 84],
      [Math.PI, 92],
      [Math.PI / 2, 96],
      [-Math.PI / 2, 100],
    ];
    rows.forEach(([a, y], i) => {
      const { rc, s } = pierAt(y);
      const r = rc * 0.86 + s * 0.06 + 0.06;
      const { shape } = lancet(0.9, 3.6, 0.95);
      const geo = new THREE.ShapeGeometry(shape, 6).rotateY(Math.PI / 2 - a);
      bk.add(i % 4 === 1 ? mats.slitGlow : mats.void, geo, { p: [Math.cos(a) * r, y, Math.sin(a) * r] });
    });
    // and a ring of them round the upper chambers, under the top
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      for (const dy of [0, 6.5]) {
        const y = 104 + dy;
        const { rc, s } = pierAt(y);
        const r = rc * 0.86 + s * 0.06 + 0.06;
        const { shape } = lancet(0.8, 2.6, 0.95);
        bk.add((i + dy) % 3 === 0 ? mats.slitGlow : mats.void, new THREE.ShapeGeometry(shape, 6).rotateY(Math.PI / 2 - a), { p: [Math.cos(a) * r, y, Math.sin(a) * r] });
      }
    }
  }
  bk.build(shell, { shadow: false, receive: false });

  // the top: the horns, the lesser spikes, the floor between them, the hatch
  const tk = parts();
  for (const a of angles) {
    const rings = [];
    for (let i = 0; i <= 16; i++) {
      const y = H - 6 + (i / 16) * (HORN + 6);
      rings.push({ y, ...hornAt(y) });
    }
    tk.add(mats.towerStone, flat(loftPier(a, rings)), { uv: 0.2 });
    // a lesser blade on each side of the horn, curving out
    for (const side of [-1, 1]) {
      const b = a + side * BLADE.off;
      const r2 = [];
      for (let i = 0; i <= 8; i++) {
        const y = BLADE.y0 + (i / 8) * BLADE.h;
        r2.push({ y, ...bladeAt(y) });
      }
      tk.add(mats.towerStone, flat(loftPier(b, r2)), { uv: 0.2 });
    }
  }
  // the spikes between the horns, over the clefts
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const rings = [];
    for (let j = 0; j <= 8; j++) {
      const y = SPIKE.y0 + (j / 8) * SPIKE.h;
      rings.push({ y, ...spikeAt(y) });
    }
    tk.add(mats.towerStone, flat(loftPier(a, rings)), { uv: 0.2 });
  }
  tk.add(mats.towerStone, flat(new THREE.CylinderGeometry(PIN.r + 2.2, PIN.r + 3, 4, 8, 1).rotateY(Math.PI / 8)), { p: [0, H - 2, 0], uv: 0.2 });
  tk.add(mats.pinFloor, new THREE.CircleGeometry(PIN.r + 2.2, 8, Math.PI / 8).rotateX(-Math.PI / 2), { p: [0, H + 0.01, 0], uv: 0.35 });
  // the hatch the stair comes up through, shut and barred
  tk.add(mats.iron, new THREE.BoxGeometry(1.3, 0.06, 1.3), { p: [0, H + 0.03, STAIR.r] });
  for (const dz of [-0.35, 0.35]) tk.add(mats.iron, new THREE.BoxGeometry(1.4, 0.08, 0.1), { p: [0, H + 0.06, STAIR.r + dz] });
  tk.build(top, { shadow: false, receive: false });
  return { group: g, shell, top };
}

// ── the stair shaft ──
// Inside the top of the tower: a round shaft of black stone with slit
// windows where the stair passes them, a middle column, the steps winding
// up round it, and torches in brackets on the wall. Returns { group,
// torches } (where the flames are).
function shaft(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'shaft';
  const bk = parts();
  const R = STAIR.wall;
  const y0 = STAIR_BASE - 2;
  const y1 = TOWER_H;
  const SEG = 28;
  const BAND = 1;
  // the windows, as angle and height ranges cut from the wall
  const holes = WINDOWS.map((s) => {
    const a = stairAngle(s);
    const y = stairAt(s)[1];
    return { a, y0: y + 0.6, y1: y + 3.4 };
  });
  const cutAt = (a, y) =>
    holes.some((h) => {
      let d = a - h.a;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      return Math.abs(d) < TAU / SEG / 2 + 0.01 && y >= h.y0 && y < h.y1;
    });
  const list = [];
  for (let i = 0; i < SEG; i++) {
    const a0 = (i / SEG) * TAU;
    const a1 = ((i + 1) / SEG) * TAU;
    const am = (a0 + a1) / 2;
    for (let y = y0; y < y1; y += BAND) {
      if (cutAt(am, y + BAND / 2)) continue;
      // faceted: every other column of the wall stands in a little
      const r = R - (i % 2 ? 0.12 : 0);
      list.push([
        [Math.cos(a0) * r, y, Math.sin(a0) * r],
        [Math.cos(a0) * r, y + BAND, Math.sin(a0) * r],
        [Math.cos(a1) * r, y + BAND, Math.sin(a1) * r],
        [Math.cos(a1) * r, y, Math.sin(a1) * r],
      ]);
    }
  }
  bk.add(mats.obsidian, flat(quads(list)), { uv: 0.3 });
  // round each window, a deep reveal out through the tower's thickness
  for (const h of holes) {
    const da = TAU / SEG / 2;
    const out = 3.4;
    const pts = (a, r, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
    const rv = [];
    for (const s of [-1, 1]) rv.push([pts(h.a + s * da, R, h.y0), pts(h.a + s * da, R + out, h.y0), pts(h.a + s * da, R + out, h.y1), pts(h.a + s * da, R, h.y1)]);
    rv.push([pts(h.a - da, R, h.y0), pts(h.a + da, R, h.y0), pts(h.a + da, R + out, h.y0), pts(h.a - da, R + out, h.y0)]);
    rv.push([pts(h.a - da, R, h.y1), pts(h.a - da, R + out, h.y1), pts(h.a + da, R + out, h.y1), pts(h.a + da, R, h.y1)]);
    bk.add(mats.obsidian, flat(quads(rv)), { uv: 0.4 });
  }
  // the middle column
  bk.add(mats.obsidian, flat(new THREE.CylinderGeometry(1.25, 1.25, y1 - y0, 8, 1)), { p: [0, (y0 + y1) / 2, 0], uv: 0.3 });
  // the floor at the foot, and the roof (the pinnacle's floor, from under)
  bk.add(mats.obsidian, new THREE.CircleGeometry(R, 24).rotateX(-Math.PI / 2), { p: [0, y0 + 0.5, 0], uv: 0.3 });
  bk.add(mats.obsidian, new THREE.CircleGeometry(R, 24).rotateX(Math.PI / 2), { p: [0, y1 - 0.05, 0], uv: 0.3 });
  bk.build(g, { shadow: false, receive: false });

  // the steps, one instanced wedge, a little rise each
  const STEPS = Math.round(STAIR.turns * 26);
  const step = new THREE.BoxGeometry(R - 1.25, 0.22, 0.92);
  step.translate((R + 1.25) / 2, -0.11, 0);
  const steps = new THREE.InstancedMesh(flat(step), mats.stepStone, STEPS);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < STEPS; i++) {
      const s = ((i + 0.5) / STEPS) * STAIR_LEN;
      const a = stairAngle(s);
      const y = stairAt(s)[1];
      q.setFromAxisAngle(V3(0, 1, 0), -a);
      m.compose(V3(0, y, 0), q, V3(1, 1, 1));
      steps.setMatrixAt(i, m);
    }
  }
  steps.name = 'steps';
  g.add(steps);
  // torches in brackets, between the windows
  const torches = [];
  const tk = parts();
  for (const s of [8, 27, 47, 66]) {
    const a = stairAngle(s) + 0.5;
    const y = stairAt(s)[1] + 2.2;
    const at = (r, yy) => [Math.cos(a) * r, yy, Math.sin(a) * r];
    tk.add(mats.iron, tube([at(R - 0.05, y - 0.4), at(R - 0.3, y - 0.2), at(R - 0.4, y)], 0.03, 0.025, { seg: 4, radial: 5 }));
    tk.add(mats.iron, lathe([[0.03, 0], [0.09, 0.08], [0.1, 0.14]], 8), { p: at(R - 0.4, y) });
    torches.push(V3(...at(R - 0.4, y + 0.18)));
  }
  tk.build(g, { shadow: false });
  return { group: g, torches };
}

// ── the moth ──
// A small grey moth, a little bigger than life so it can be seen: furred
// body, forewings and hindwings that beat (flap 0..1), and a faint glow so
// it shows against the night. Faces +x.
function moth(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'moth';
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6).scale(2.4, 1, 1), mats.mothBody);
  g.add(body);
  const wingShape = (len, wid, sweep) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(len * 0.3, wid * 0.9, len, wid * 0.55 + sweep);
    s.quadraticCurveTo(len * 1.05, wid * 0.1 + sweep, len * 0.8, -wid * 0.1 + sweep * 0.5);
    s.quadraticCurveTo(len * 0.35, -wid * 0.25, 0, 0);
    return new THREE.ShapeGeometry(s, 6).rotateX(Math.PI / 2);
  };
  // the right wing (out to -z, swept back); the left is its mirror
  const foreR = wingShape(0.075, 0.05, 0.02).rotateY(Math.PI / 2 + 0.35);
  const hindR = wingShape(0.05, 0.04, -0.01).rotateY(Math.PI / 2 + 1.05);
  const wings = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.005, 0.006, 0);
    const fore = new THREE.Mesh(side > 0 ? foreR : foreR.clone().scale(1, 1, -1), mats.mothWing);
    const hind = new THREE.Mesh(side > 0 ? hindR : hindR.clone().scale(1, 1, -1), mats.mothWing);
    pivot.add(fore, hind);
    g.add(pivot);
    return { pivot, side };
  });
  const glow = new THREE.Sprite(mats.mothGlow);
  glow.scale.setScalar(0.5);
  g.add(glow);
  // its beat carried on from frame to frame and slowing as it settles, so
  // settling never jumps its wings
  const E = { t: null, flap: null, ph: 0 };
  const animate = (t, { flap = 1, open = 0 } = {}) => {
    const dt = E.t == null || t < E.t ? 0 : Math.min(0.1, t - E.t);
    E.t = t;
    E.flap = E.flap == null ? flap : ease(E.flap, flap, dt, 6);
    E.ph += dt * 38 * (0.55 + 0.45 * Math.min(1, E.flap));
    const beat = Math.sin(E.ph) * 0.9 * E.flap + open * 0.2;
    for (const w of wings) w.pivot.rotation.x = w.side * (0.25 + beat);
    body.rotation.z = Math.sin(E.ph * 0.24) * 0.1 * E.flap;
  };
  return { group: g, animate };
}

// ── Isengard ──
// The pits: a dark round mouth with a rim of rubble, a glowing floor far
// down, and the smoke. One geometry each for the rims and the glow, for
// instancing (unit size: scale by the pit's).
function pitGeos() {
  const rim = lathe([[1.25, -0.2], [1.2, 0.5], [1.0, 0.7], [0.92, 0.2], [0.9, -1.6]], 12);
  const glow = new THREE.CircleGeometry(0.92, 16).rotateX(-Math.PI / 2).translate(0, -1.4, 0);
  return { rim: flat(rim), glow };
}
// A felled tree, lying: a trunk and the stumps of its branches.
function logGeo() {
  const r = rng(17);
  const geos = [new THREE.CylinderGeometry(0.32, 0.42, 7, 7, 1).rotateZ(Math.PI / 2).translate(0, 0.38, 0)];
  for (let i = 0; i < 4; i++) {
    const x = -2.5 + i * 1.6;
    const a = r() * TAU;
    geos.push(new THREE.CylinderGeometry(0.06, 0.12, 1.2, 5).rotateX(Math.cos(a) * 0.9).rotateZ(Math.sin(a) * 0.6).translate(x, 0.6 + Math.sin(a) * 0.3, Math.cos(a) * 0.4));
  }
  const g = mergeGeometries(geos.map((x) => x.toNonIndexed()));
  geos.forEach((x) => x.dispose());
  return g;
}
// A banner of the White Hand on a pole, its cloth `h` tall.
function banner(K, h = 3.4) {
  const { mats } = K;
  const g = new THREE.Group();
  const bk = parts();
  bk.add(mats.iron, new THREE.CylinderGeometry(0.05, 0.06, h + 1.8, 6), { p: [0, (h + 1.8) / 2, 0] });
  bk.add(mats.iron, new THREE.CylinderGeometry(0.03, 0.03, h * 0.6, 5).rotateZ(Math.PI / 2), { p: [h * 0.3, h + 1.6, 0] });
  bk.build(g, { shadow: false });
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(h * 0.55, h, 6, 8), mats.banner);
  cloth.position.set(h * 0.3, h + 1.6 - h / 2, 0);
  g.add(cloth);
  const base = cloth.geometry.attributes.position.array.slice();
  const wave = (t, k = 1) => {
    const p = cloth.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3];
      const y = base[i * 3 + 1];
      p.setZ(i, Math.sin(x * 3 + y * 1.4 + t * 3.2) * 0.12 * k * (0.5 + (0.5 - y / h)));
    }
    p.needsUpdate = true;
  };
  return { group: g, wave };
}

// ── the kit ──

export function createOrthancKit(renderer) {
  const kit = createDoomKit(renderer);
  const S = 256;
  const T = (c, o) => canvasTexture(c, renderer, o);
  const stone = obsidianCanvas(S, 61);
  const R = CORNERS[0][0] / Math.cos(Math.PI / 8);
  const tex = {
    stone: T(stone.c),
    stoneN: T(normalFromField(stone.field, S, S, 1.6), { srgb: false }),
    floor: T(floorCanvas(1024, R), { wrap: false }),
    shaft: T(shaftCanvas(), { wrap: false }),
    hand: T(handCanvas(), { wrap: false }),
  };
  // the hall's sheen: tall cold windows high up, the braziers' warmth low
  const hallEnv = envRoom(renderer, [0.006, 0.006, 0.008], [0.03, 0.032, 0.04], [
    [0xb0c0d8, 2.4, 2, 7, [0, 6, -9]],
    [0xb0c0d8, 2, 2, 7, [8, 6, 4]],
    [0xb0c0d8, 2, 2, 7, [-8, 6, 4]],
    [0xb0c0d8, 1.4, 2, 7, [3, 6, 9]],
    [0xff9a48, 3, 2.4, 1.4, [6, -2, -6]],
    [0xff9a48, 3, 2.4, 1.4, [-6, -2, 6]],
  ]);
  // the storm's: a grey sky over, fire under
  const stormEnv = envRoom(renderer, [0.06, 0.02, 0.01], [0.05, 0.055, 0.07], [
    [0xb8c4d8, 0.8, 16, 4, [0, 9, 0]],
    [0xff6a20, 1.4, 14, 3, [0, -9, 4]],
  ]);
  tex.hallEnv = hallEnv;
  tex.stormEnv = stormEnv;
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  const mats = {
    ...kit.mats,
    obsidian: M({ map: tex.stone, normalMap: tex.stoneN, color: 0xc4c8d4, roughness: 0.26, metalness: 0.3, envMap: hallEnv, envMapIntensity: 2.4, side: THREE.DoubleSide }),
    trim: M({ map: tex.stone, color: 0xe0e4f0, roughness: 0.2, metalness: 0.5, envMap: hallEnv, envMapIntensity: 2.6 }),
    vault: M({ color: 0x050506, roughness: 0.6, side: THREE.DoubleSide }),
    floor: M({ map: tex.floor, color: 0xd8dce8, roughness: 0.1, metalness: 0.4, envMap: hallEnv, envMapIntensity: 2.4 }),
    libFloor: M({ map: tex.stone, color: 0x6a6460, roughness: 0.35, metalness: 0.2, envMap: hallEnv, envMapIntensity: 0.8 }),
    iron: M({ color: 0x1c1c20, roughness: 0.38, metalness: 0.85, envMap: hallEnv, envMapIntensity: 1.2 }),
    door: M({ color: 0x15100c, roughness: 0.7 }),
    coals: new THREE.MeshBasicMaterial({ color: hot(0xff6a1a, 2.2) }),
    paneGlow: new THREE.MeshBasicMaterial({ color: hot(0x8a9cb8, 1.15), side: THREE.DoubleSide }),
    slitGlow: new THREE.MeshBasicMaterial({ color: hot(0xff8a3a, 1.4), side: THREE.DoubleSide, fog: true }),
    shaftLight: new THREE.MeshBasicMaterial({ map: tex.shaft, color: hot(0x9fb2d0, 0.22), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }),
    stone: stoneMaterial(),
    velvet: M({ color: 0x120c10, roughness: 0.95, side: THREE.DoubleSide }),
    cushion: M({ color: 0xd8d4cc, roughness: 0.9 }),
    wood: M({ color: 0x24170f, roughness: 0.7 }),
    books: M({ roughness: 0.75 }),
    page: M({ color: 0xd8ccb0, roughness: 0.9, side: THREE.DoubleSide }),
    parchment: M({ color: 0x9a8662, roughness: 0.95, side: THREE.DoubleSide }),
    lanternGlow: new THREE.MeshBasicMaterial({ color: hot(0xffa850, 1.8) }),
    lampGlow: new THREE.MeshBasicMaterial({ color: hot(0xdfe8ff, 1.6) }),
    wax: M({ color: 0xf0e6cc, roughness: 0.6, emissive: hot(0xffc890, 0.15) }),
    jar: M({ color: 0x7a4a2a, roughness: 0.55 }),
    towerStone: M({ map: tex.stone, normalMap: tex.stoneN, color: 0x9a9ca8, roughness: 0.3, metalness: 0.35, envMap: stormEnv, envMapIntensity: 1.5 }),
    pinFloor: M({ map: tex.stone, color: 0x7a7c86, roughness: 0.25, metalness: 0.3, envMap: stormEnv, envMapIntensity: 1.4 }),
    stepStone: M({ map: tex.stone, color: 0x8a8c96, roughness: 0.4, metalness: 0.25, envMap: hallEnv, envMapIntensity: 1 }),
    pitRim: M({ color: 0x1a1412, roughness: 0.95, flatShading: true }),
    pitGlow: new THREE.MeshBasicMaterial({ color: hot(0xff5a14, 2.6), fog: true }),
    log: M({ color: 0x3a2a1c, roughness: 0.95 }),
    banner: M({ map: tex.hand, roughness: 0.9, side: THREE.DoubleSide }),
    mothBody: M({ color: 0x9a9080, roughness: 0.9, emissive: hot(0x403a30, 0.6) }),
    mothWing: M({ color: 0xc8c0b0, roughness: 0.8, side: THREE.DoubleSide, transparent: true, opacity: 0.92, emissive: hot(0x5a5448, 0.7) }),
    mothGlow: new THREE.SpriteMaterial({ map: kit.tex.glow, color: hot(0xdfe6ff, 0.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    flameCard: new THREE.SpriteMaterial({ map: kit.tex.flame, color: hot(0xffb070, 1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  };
  // Orthanc's black stone is glassy (./propsShaders.js)
  mats.towerStone = glassyStone(mats.towerStone);
  for (const [k, m] of Object.entries(mats)) if (!m.name) m.name = k;
  const K = { mats, tex, renderer };
  const memo = new Map();
  const once = (key, fn) => {
    if (!memo.has(key)) memo.set(key, fn());
    return memo.get(key);
  };
  return {
    ...kit,
    mats,
    tex: { ...kit.tex, ...tex },
    tick: (t) => {
      kit.tick(t);
      mats.stone.uniforms.uTime.value = t;
    },
    hall: () => hall(K),
    palantir: () => palantir(K),
    library: () => library(K),
    tower: () => tower(K),
    shaft: () => shaft(K),
    moth: () => moth(K),
    pits: () => once('pits', pitGeos),
    logs: () => once('logs', logGeo),
    banner: (h) => banner(K, h),
  };
}
