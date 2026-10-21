// The Chamber of Mazarbul: Balin’s tomb in its shaft of daylight, the dead
// and their gear, Ori’s book. Moved out of props.js as it was; its beam,
// sunlit dust and motes come from the kit (K.shaders).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp01, fbm, makeCanvas, makeNoise, mix, paintPixels, smooth } from '../../../../lib/paint';
import { B, ball, cyl, lathe, parts, rng, roundBox, tf, tube } from '../../shire/build';
import { bandBox, octBand, octLoft } from './halls';
import { chunkGeo, cutRunes, dwarfDoor, ext, frameGeo, lump, noise3, rod, shapeOf, sweep3, TAU, tint, V3 } from './helpers';

// ── the Chamber of Mazarbul ──

// The top of Balin's tomb: white stone, veined grey, stained and dusty,
// within a cut border the runes in three lines, their cuts filled red-brown:
// Here lies Balin, son of Fundin, Lord of Moria. With its relief.
export function tombCanvas(W = 512, H = 256) {
  const draw = makeCanvas(W, H);
  const g = draw.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineCap = 'square';
  g.lineJoin = 'miter';
  g.lineWidth = 5;
  g.strokeRect(14, 14, W - 28, H - 28);
  g.lineWidth = 2.5;
  g.strokeRect(24, 24, W - 48, H - 48);
  for (const [x, y] of [[14, 14], [W - 14, 14], [14, H - 14], [W - 14, H - 14]]) {
    g.beginPath();
    g.moveTo(x, y - 11);
    g.lineTo(x + 11, y);
    g.lineTo(x, y + 11);
    g.lineTo(x - 11, y);
    g.closePath();
    g.fill();
  }
  g.lineWidth = 6;
  g.lineCap = 'round';
  const lines = ['HERE LIES BALIN', 'SON OF FUNDIN', 'LORD OF MORIA'];
  const h = 44;
  lines.forEach((text, i) => {
    const probe = makeCanvas(8).getContext('2d');
    const w = cutRunes(probe, text, 0, 0, h) - h * 0.5 * 0.42;
    cutRunes(g, text, (W - w) / 2, 46 + i * (h + 18), h);
  });
  const mask = new Float32Array(W * H);
  const d = g.getImageData(0, 0, W, H).data;
  for (let i = 0; i < W * H; i++) mask[i] = d[i * 4] / 255;
  const n = makeNoise(97);
  const field = new Float32Array(W * H);
  const c = makeCanvas(W, H);
  paintPixels(c, (u, v, out, px, py) => {
    const cut = mask[py * W + px];
    const cloud = fbm(n, u * 6, v * 3, { octaves: 4 });
    const vein = 1 - smooth(0, 0.02, Math.abs(fbm(n, u * 3 + 4, v * 1.5 + 2, { octaves: 4 }) - 0.5));
    const stain = smooth(0.55, 0.8, fbm(n, u * 4 + 9, v * 2, { octaves: 3 }));
    const t = 0.9 + (cloud - 0.5) * 0.12 - vein * 0.12 - stain * 0.1;
    let r = 236 * t;
    let gg = 230 * t;
    let b = 218 * t;
    r = mix(r, 112, cut);
    gg = mix(gg, 44, cut);
    b = mix(b, 28, cut);
    out[0] = r;
    out[1] = gg;
    out[2] = b;
    field[py * W + px] = clamp01(0.7 + cloud * 0.1 - cut * 0.55);
  });
  return { c, field, W, H };
}

// Mail: rows of riveted rings, each overlapping the next, for the dead
// dwarves' shirts. Grey, darker in the gaps. With its relief.
export function mailCanvas(S = 128) {
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  const R = 8;
  paintPixels(c, (u, v, out, px, py) => {
    let h = 0;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const row = Math.floor((py + j * R) / R);
        const cy = row * R + R / 2;
        const cx = Math.floor((px + i * R - (row % 2) * R * 0.5) / R) * R + R / 2 + (row % 2) * R * 0.5;
        const dd = Math.hypot(px - cx, (py - cy) * 1.3);
        h = Math.max(h, smooth(0.5, 0, Math.abs(dd - R * 0.48) / (R * 0.22)));
      }
    }
    field[py * S + px] = h;
    const t = 40 + h * 170;
    out[0] = t;
    out[1] = t;
    out[2] = t * 1.03;
  });
  return { c, field };
}

// A page of Ori's book: old paper, browned at its edges and scorched at a
// corner, lines of runes in brown ink, a splash of something dark.
export function pageCanvas(W = 256, H = 192) {
  const c = makeCanvas(W, H);
  const n = makeNoise(5);
  paintPixels(c, (u, v, out) => {
    const edge = Math.min(u, 1 - u, v, 1 - v);
    const burn = smooth(0.32, 0.12, Math.hypot(u - 1, v - 1) + (n(u * 9, v * 9) - 0.5) * 0.15);
    const t = 0.86 - (1 - smooth(0, 0.08, edge)) * 0.3 + (fbm(n, u * 5, v * 4, { octaves: 3 }) - 0.5) * 0.12;
    out[0] = 222 * t * (1 - burn * 0.8);
    out[1] = 196 * t * (1 - burn * 0.85);
    out[2] = 150 * t * (1 - burn * 0.9);
  });
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(70,40,20,0.85)';
  g.fillStyle = 'rgba(70,40,20,0.85)';
  g.lineWidth = 1.3;
  g.lineCap = 'round';
  const words = ['WE CANNOT GET OUT', 'THE SHADOW MOVES', 'IN THE DARK', 'DRUMS DRUMS IN', 'THE DEEP', 'THEY ARE COMING'];
  for (const half of [0, 1]) {
    words.forEach((w, i) => {
      if (half === 1 && i > 3) return;
      cutRunes(g, w.slice(0, 10 + ((i * 3) % 6)), 14 + half * (W / 2), 16 + i * 26, 12, { gap: 0.3 });
    });
  }
  g.fillStyle = 'rgba(40,16,10,0.6)';
  g.beginPath();
  g.ellipse(W * 0.3, H * 0.78, 18, 10, 0.4, 0, TAU);
  g.fill();
  return c;
}

// A dwarf long dead in his mail, slumped where he fell, added to `bk` in
// its frame: sitting with his back to -x (a wall) and his legs out along
// +x, or perched on a well's edge 0.84 up (`perch`), bowed over his knees.
// Thick old bones gone brown, a broad mail shirt hanging on them belted at
// the waist, a grey beard still on his jaw, a helmet on his skull or fallen
// by him, heavy boots.
export function deadDwarf(bk, K, { seed = 1, perch = false, lap = [false, true], helmet = true, knees = 0.3 } = {}) {
  const { mats } = K;
  const r = rng(seed);
  const n = makeNoise(seed + 3);
  const bone = (geo) => bk.add(mats.bone, tint(geo, (x, y, z, out) => out.setRGB(0.5, 0.43, 0.32).multiplyScalar(0.6 + noise3(n, x * 9, y * 9, z * 9) * 0.5)));
  const shaft = (a, b, r0) => {
    bone(rod(a, b, r0, r0 * 0.85, 7));
    bone(lump(r0 * 1.6, { p: a, s: [1, 0.85, 1] }, { detail: 1, amp: 0.1, seed: seed + a[1] }));
    bone(lump(r0 * 1.5, { p: b, s: [1, 0.85, 1] }, { detail: 1, amp: 0.1, seed: seed + b[1] }));
  };
  const tilt = (r() - 0.5) * 0.7;
  const hip = perch ? [0.2, 0.88, 0] : [0.22, 0.14, 0];
  const chest = perch ? [0.34, 1.16, tilt * 0.06] : [0.12, 0.44, tilt * 0.04];
  const neck = perch ? [0.46, 1.32, tilt * 0.12] : [0.08, 0.63, tilt * 0.08];
  const headAt = perch ? V3(0.56, 1.3, tilt * 0.16) : V3(0.17, 0.74 + r() * 0.03, tilt * 0.25 + (r() - 0.5) * 0.08);
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const p = t < 0.6 ? V3(...hip).lerp(V3(...chest), t / 0.6) : V3(...chest).lerp(V3(...neck), (t - 0.6) / 0.4);
    bone(cyl(0.036, 0.036, 0.055, 6).translate(p.x, p.y, p.z));
  }
  bone(lump(0.15, { p: [hip[0], hip[1] + 0.02, 0], s: [0.8, 0.6, 1.35] }, { detail: 1, amp: 0.2, seed }));
  // the mail: broad over a dwarf's chest, short-sleeved, its hem ragged
  const mailAt = [[hip[0] + 0.03, hip[1] - 0.05, 0], [(hip[0] + chest[0]) / 2 + 0.03, (hip[1] + chest[1]) / 2, chest[2] * 0.5], chest, [neck[0] - 0.01, neck[1] - 0.05, neck[2]]];
  bk.add(mats.mail, sweep3(mailAt, [[0.21, 0.27], [0.22, 0.29], [0.21, 0.29], [0.11, 0.15]], { seg: 9, radial: 12, sq: 2.4, caps: [false, true], bump: (p, o, u, v) => (v < 0.2 ? (n(u * 24, 1) - 0.5) * 0.08 : 0.008 * Math.sin(u * 50)) }));
  bk.add(mats.leatherOld, new THREE.TorusGeometry(1, 0.06, 4, 16).scale(0.22, 0.27, 1).rotateX(Math.PI / 2).rotateZ(perch ? -0.45 : 0.25), { p: [(hip[0] + chest[0]) / 2 + 0.03, (hip[1] + chest[1]) / 2 - 0.02, 0] });
  bk.add(mats.rustIron, B(0.03, 0.07, 0.08), { p: [(hip[0] + chest[0]) / 2 + 0.25, (hip[1] + chest[1]) / 2 - 0.02, 0] });
  // the skull: brow, cheekbones, the jaw dropped; sockets dark; the beard
  const fall = perch ? -0.8 : -0.2 - r() * 0.35;
  const face = (geo) => geo.rotateZ(fall).rotateX(tilt).translate(headAt.x, headAt.y, headAt.z);
  bone(face(new THREE.SphereGeometry(0.11, 12, 9).scale(1.08, 1.0, 0.88)));
  bone(face(lump(0.05, { p: [0.08, 0.035, 0], s: [0.7, 0.45, 1.9] }, { detail: 1, amp: 0.1 })));
  for (const s2 of [-1, 1]) bone(face(lump(0.03, { p: [0.07, -0.03, s2 * 0.065] }, { detail: 0, amp: 0.1 })));
  bone(face(lump(0.065, { p: [0.065, -0.1, 0], s: [1.05, 0.55, 1.2] }, { detail: 1, amp: 0.12 })));
  for (const s2 of [-1, 1]) bk.add(mats.void, face(ball(0.028, 6, 4).translate(0.085, 0.01, s2 * 0.038)));
  bk.add(mats.void, face(ball(0.016, 5, 3).translate(0.105, -0.04, 0)));
  for (let k = 0; k < 5; k++) {
    const z0 = (k - 2) * 0.03;
    const len = 0.16 + r() * 0.12;
    bk.add(mats.beard, face(tube([[0.06, -0.12, z0], [0.1, -0.12 - len * 0.5, z0 * 1.2], [0.08 + r() * 0.05, -0.12 - len, z0 * 1.4]], 0.028, 0.008, { seg: 3, radial: 5, gnarl: 0.3, seed: seed + k })));
  }
  if (helmet) {
    bk.add(mats.rustIron, face(new THREE.SphereGeometry(0.128, 12, 5, 0, TAU, 0, Math.PI / 2).scale(1.05, 1.0, 0.95).translate(-0.01, 0.025, 0)));
    bk.add(mats.rustIron, face(new THREE.TorusGeometry(0.122, 0.014, 4, 16).rotateX(Math.PI / 2).translate(-0.01, 0.025, 0)));
    bk.add(mats.rustIron, face(B(0.014, 0.1, 0.03).translate(0.125, -0.012, 0)));
  } else {
    bk.add(mats.rustIron, new THREE.SphereGeometry(0.128, 12, 5, 0, TAU, 0, Math.PI / 2).rotateX(1.9).translate(0.5, 0.09, 0.45));
  }
  // the arms: by his sides to the floor, or in his lap; over his knees if perched
  for (const s of [-1, 1]) {
    const sh = [chest[0] - 0.02, chest[1] + 0.13, s * 0.24];
    const inLap = lap[s < 0 ? 0 : 1];
    const el = perch ? [sh[0] + 0.14, sh[1] - 0.24, s * 0.22] : inLap ? [0.22, 0.3, s * 0.3] : [0.1, 0.28, s * 0.34];
    const wr = perch ? [sh[0] + 0.3, sh[1] - 0.42, s * 0.13] : inLap ? [0.44, 0.26, s * 0.13] : [0.26, 0.05, s * 0.4];
    shaft(sh, el, 0.026);
    shaft(el, wr, 0.022);
    bk.add(mats.mail, sweep3([sh, [(sh[0] * 2 + el[0]) / 3, (sh[1] * 2 + el[1]) / 3, (sh[2] * 2 + el[2]) / 3]], [[0.075, 0.075], [0.07, 0.07]], { seg: 2, radial: 7, caps: [false, false] }));
    for (let f = 0; f < 4; f++) bone(rod(V3(...wr), V3(wr[0] + 0.09, wr[1] - (inLap || perch ? 0.02 : 0.035), wr[2] + (f - 1.5) * 0.028), 0.01, 0.008, 4));
  }
  // the legs: out along the floor, knees up a little; or over the well's edge
  for (const s of [-1, 1]) {
    const h0 = [hip[0] + 0.04, hip[1] - 0.01, s * 0.12];
    const kn = perch ? [0.56, 0.84, s * 0.16] : [0.56, 0.17 + knees * 0.2 + (s > 0 ? r() * 0.06 : 0), s * (0.16 + r() * 0.05)];
    const an = perch ? [0.6, 0.47, s * 0.17] : [0.86, 0.09, s * (0.18 + r() * 0.08)];
    shaft(h0, kn, 0.036);
    shaft(kn, an, 0.03);
    // the boot, heavy and square-toed
    const toe = perch ? V3(0.74, 0.42, s * 0.18) : V3(an[0] + 0.12, 0.06, an[2]);
    bk.add(mats.leatherOld, lump(0.1, { p: [(an[0] * 0.6 + toe.x * 0.4), (an[1] * 0.5 + toe.y * 0.5), an[2]], s: [1.55, 0.95, 0.95] }, { detail: 1, amp: 0.1 }));
  }
}

// An axe: its haft from the origin along +x, the head at the end (or the
// haft snapped short).
export function axeParts(bk, K, len = 0.95, broken = false) {
  const { mats } = K;
  const L = broken ? len * 0.55 : len;
  bk.add(mats.oldWood, cyl(0.022, 0.026, L, 6), { r: [0, 0, -Math.PI / 2], p: [L / 2, 0, 0], uv: 3 });
  if (broken) return;
  const head = shapeOf([[-0.03, 0], [-0.04, 0.05], [-0.14, 0.16], [0, 0.2], [0.14, 0.16], [0.04, 0.05], [0.03, 0]]);
  bk.add(mats.oldSteel, ext(head, 0.018), { p: [len - 0.06, 0, -0.009] });
  bk.add(mats.rustIron, B(0.08, 0.05, 0.04), { p: [len - 0.06, 0, 0] });
}

// A sword: its grip at the origin, the blade along +x, or snapped short.
export function swordParts(bk, K, len = 0.75, broken = 0) {
  const { mats } = K;
  if (broken) bk.add(mats.oldSteel, B(len * broken, 0.05, 0.008), { p: [0.1 + (len * broken) / 2, 0, 0] });
  else bk.add(mats.oldSteel, ext(shapeOf([[0, -0.028], [len - 0.08, -0.024], [len, 0], [len - 0.08, 0.024], [0, 0.028]]), 0.008), { p: [0.1, 0, -0.004] });
  bk.add(mats.rustIron, B(0.03, 0.2, 0.035), { p: [0.1, 0, 0] });
  bk.add(mats.leatherOld, cyl(0.016, 0.016, 0.12, 6), { r: [0, 0, Math.PI / 2], p: [0.03, 0, 0] });
  bk.add(mats.rustIron, ball(0.025, 6, 4), { p: [-0.04, 0, 0] });
}

// A round shield lying flat, `cut` of it broken away.
export function shieldParts(bk, K, r = 0.38, cut = 0) {
  const { mats } = K;
  const a = cut * TAU;
  bk.add(mats.oldWood, new THREE.CylinderGeometry(r, r, 0.04, 16, 1, false, a, TAU - a), { p: [0, 0.02, 0], uv: 2 });
  bk.add(mats.rustIron, new THREE.TorusGeometry(r, 0.016, 4, 20, TAU - a).rotateX(-Math.PI / 2).rotateY(a - Math.PI / 2), { p: [0, 0.035, 0] });
  if (cut < 0.3) bk.add(mats.rustIron, new THREE.SphereGeometry(0.08, 8, 4, 0, TAU, 0, Math.PI / 2), { p: [0, 0.04, 0] });
}

// The Chamber of Mazarbul, the records' room, where Balin's company made
// their last stand: 16 m (along x) by 14, 10 m high, its doorway in the +z
// wall with two heavy doors that swing in and shut (doors.open(k)). In the
// middle Balin's tomb, a block of white stone lettered in red-brown runes,
// and on it a shaft of grey daylight from a high window in the -x wall,
// dust turning in it. A well with a low wall in the far corner; square
// columns along the side walls; the dwarves' dead slumped against the walls
// in their mail, one sitting on the well's edge; broken weapons and shields
// scattered over the floor; Ori's book on a ledge by the back wall.
// Anchors (local): tomb (the middle of its top), well (its middle, on the
// floor), door (the middle of the doorway), book, beam { from, to }.
export function chamber(K) {
  const { mats, U } = K;
  const g = new THREE.Group();
  g.name = 'mazarbul';
  const bk = parts();
  const r = rng(131);
  const n = makeNoise(131);
  const HX = 8;
  const HZ = 7;
  const H = 10;
  const T = 1;
  const wallTone = (x, y, z, out) => out.setRGB(1, 1, 1).multiplyScalar(0.72 + noise3(n, x * 0.3, y * 0.3, z * 0.3) * 0.5).multiplyScalar(mix(0.65, 1, smooth(0, 2, y)));
  const wall = (geo) => bk.add(mats.ashlar, tint(geo, wallTone), { uv: 0.34 });

  // the window, high in the -x wall, and the light it lets in
  const WZ = -2.0;
  const WY = 8.4;
  const ww = 1.1;
  const wh = 1.5;
  // the walls: the back, the right, the left round its window, the front
  // round its doorway
  wall(B(2 * HX + 2 * T, H, T).translate(0, H / 2, -HZ - T / 2));
  wall(B(T, H, 2 * HZ).translate(HX + T / 2, H / 2, 0));
  const lx = -HX - T / 2;
  wall(B(T, WY - wh / 2, 2 * HZ).translate(lx, (WY - wh / 2) / 2, 0));
  wall(B(T, H - WY - wh / 2, 2 * HZ).translate(lx, (H + WY + wh / 2) / 2, 0));
  wall(B(T, wh, WZ - ww / 2 + HZ).translate(lx, WY, (-HZ + WZ - ww / 2) / 2));
  wall(B(T, wh, HZ - WZ - ww / 2).translate(lx, WY, (HZ + WZ + ww / 2) / 2));
  const DA = 1.4;
  const door = dwarfDoor(DA, 3.1, 3.8);
  const front = ext(shapeOf([[-HX - T, 0], ...door, [HX + T, 0], [HX + T, H], [-HX - T, H]]), T);
  wall(front.translate(0, 0, HZ));
  // daylight beyond the window
  bk.add(mats.daylight, new THREE.PlaneGeometry(ww + 0.4, wh + 0.4).rotateY(Math.PI / 2), { p: [-HX - T - 0.05, WY, WZ] });
  // the roof, on beams
  wall(B(2 * HX + 2 * T, 0.6, 2 * HZ + 2 * T).translate(0, H + 0.3, 0));
  for (const z of [-4.6, -1.6, 1.6, 4.6]) bk.add(mats.basalt, B(2 * HX, 0.55, 0.6), { p: [0, H - 0.27, z], uv: 0.3, color: 0x8a8e8a });
  // a plinth round the foot of the walls, a band of runes round them high
  // up, and a stepped cornice under the roof
  for (const [w, x, z, ry] of [[2 * HX, 0, -HZ, 0], [2 * HZ, HX, 0, -Math.PI / 2], [2 * HZ, -HX, 0, Math.PI / 2]]) {
    bk.at([x, 0, z], ry, () => {
      bk.add(mats.basalt, B(w, 0.5, 0.16), { p: [0, 0.25, 0.08], uv: 0.4, color: 0x9a9e9a });
      bk.add(mats.carve, bandBox(w, 0.6, 0.1, 2), { p: [0, 6.9, 0.05] });
      bk.add(mats.basalt, B(w, 0.14, 0.18), { p: [0, 6.53, 0.09], uv: 0.4, color: 0xa0a4a0 });
      for (let k = 0; k < 3; k++) bk.add(mats.basalt, B(w, 0.2, 0.14 + k * 0.12), { p: [0, H - 0.75 + k * 0.2, 0.07 + k * 0.06], uv: 0.4, color: 0x9a9e9a });
    });
  }
  bk.at([0, 0, HZ], Math.PI, () => {
    for (const s of [-1, 1]) bk.add(mats.basalt, B(HX - DA - 0.3, 0.5, 0.16), { p: [s * (DA + 0.3 + (HX - DA - 0.3) / 2), 0.25, 0.08], uv: 0.4, color: 0x9a9e9a });
    bk.add(mats.carve, bandBox(2 * HX, 0.6, 0.1, 2), { p: [0, 6.9, 0.05] });
  });
  // the doorway's frame, inside
  bk.add(mats.basalt, frameGeo(door, 0.3, 0.16), { p: [0, 0, HZ], r: [0, Math.PI, 0], uv: 0.5, color: 0xb8bcb8 });

  // the floor, the well's mouth cut from it
  const WELL = V3(5.0, 0, -5.0);
  const floorShape = shapeOf([[-HX, -HZ], [HX, -HZ], [HX, HZ], [-HX, HZ]]);
  const hole = new THREE.Path();
  hole.absarc(WELL.x, -WELL.z, 0.8, 0, TAU, true);
  floorShape.holes.push(hole);
  const floor = new THREE.ShapeGeometry(floorShape, 20).rotateX(-Math.PI / 2);
  {
    const p = floor.attributes.position;
    const uv = floor.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 8 + 0.5, p.getZ(i) / 8 + 0.5);
  }
  bk.add(mats.paving, floor);

  // columns along the side walls
  const columns = [];
  for (const x of [-HX + 1.0, HX - 1.0]) {
    for (const z of [-4.5, 0, 4.5]) {
      columns.push({ x, z, r: 0.72 });
      const col = [
        octLoft([{ y: 0, half: 0.78, ch: 0.2 }, { y: 0.4, half: 0.78, ch: 0.2 }, { y: 0.4, half: 0.66, ch: 0.16 }, { y: 0.6, half: 0.62, ch: 0.15 }], { top: true }),
        octLoft([{ y: 0.6, half: 0.55, ch: 0.13 }, { y: 8.6, half: 0.55, ch: 0.13 }, { y: 8.75, half: 0.64, ch: 0.16 }, { y: 9.0, half: 0.64, ch: 0.16 }, { y: 9.0, half: 0.6, ch: 0.15 }, { y: H, half: 0.95, ch: 0.25 }]),
      ];
      for (const c of col) bk.add(mats.basalt, tint(c.translate(x, 0, z), (px, py, pz, out) => out.setRGB(0.85, 0.88, 0.86).multiplyScalar(mix(0.6, 1, smooth(0, 1.5, py)))), { uv: 0.4 });
      bk.add(mats.carve, octBand(0.55, 0.13, 2.0, 0.5, 0, 0.03).translate(x, 0, z));
      bk.add(mats.carve, octBand(0.55, 0.13, 7.6, 0.5, 3, 0.03).translate(x, 0, z));
    }
  }

  // Balin's tomb: a plinth, the white block, its lettered top
  const TOMB = { w: 2.8, d: 1.5, h: 1.15, base: 0.3 };
  const tombTop = TOMB.base + TOMB.h;
  bk.add(mats.tomb, roundBox(TOMB.w + 0.8, TOMB.base, TOMB.d + 0.8, 0.04), { p: [0, TOMB.base / 2, 0], uv: 0.5 });
  bk.add(mats.tomb, roundBox(TOMB.w, TOMB.h, TOMB.d, 0.04), { p: [0, TOMB.base + TOMB.h / 2, 0], uv: 0.5 });
  for (const s of [-1, 1]) {
    bk.at([0, TOMB.base + TOMB.h - 0.3, s * (TOMB.d / 2)], s > 0 ? 0 : Math.PI, () => bk.add(mats.tombCarve, bandBox(TOMB.w - 0.2, 0.32, 0.04, 0), { p: [0, 0, 0.02] }));
  }
  bk.add(mats.tombTop, new THREE.PlaneGeometry(TOMB.w - 0.12, TOMB.d - 0.12).rotateX(-Math.PI / 2), { p: [0, tombTop + 0.003, 0] });

  // the well: a ring of blocks, a coping, and the shaft going down black
  const WR0 = 0.8;
  const WR1 = 1.08;
  for (let i = 0; i < 10; i++) {
    const a0 = (i / 10) * TAU + 0.01;
    const a1 = ((i + 1) / 10) * TAU - 0.01;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, WR1, a0, a1, false);
    shape.absarc(0, 0, WR0, a1, a0, true);
    bk.add(mats.basalt, ext(shape, 0.7).rotateX(-Math.PI / 2), { p: [WELL.x, 0, WELL.z], uv: 0.6, color: 0xa4a8a4 });
  }
  bk.add(mats.basalt, lathe([[WR0 - 0.04, 0.7], [WR1 + 0.05, 0.7], [WR1 + 0.06, 0.78], [WR1 + 0.02, 0.84], [WR0 - 0.04, 0.84], [WR0 - 0.05, 0.7]], 24), { p: [WELL.x, 0, WELL.z], uv: 0.6, color: 0xb0b4b0 });
  const shaft = new THREE.CylinderGeometry(WR0, WR0, 5, 18, 4, true);
  shaft.scale(-1, 1, 1);
  tint(shaft, (x, y, z, out) => out.setScalar(0.35 * smooth(-2.5, 2.5, y)));
  bk.add(mats.deep, shaft, { p: [WELL.x, -2.5 + 0.7, WELL.z], uv: 0.5 });
  bk.add(mats.void, new THREE.CircleGeometry(WR0, 18).rotateX(-Math.PI / 2), { p: [WELL.x, -4.2, WELL.z] });
  // a bucket on its chain, left on the coping
  bk.add(mats.oldWood, cyl(0.16, 0.13, 0.3, 10), { p: [WELL.x - 0.95, 1.0, WELL.z + 0.05], uv: 2 });
  bk.add(mats.rustIron, new THREE.TorusGeometry(0.16, 0.012, 4, 12).rotateX(Math.PI / 2), { p: [WELL.x - 0.95, 1.12, WELL.z + 0.05] });

  // Ori's book, open on a ledge on the back wall, his bones beneath it
  const BOOK = V3(-2.8, 1.12, -HZ + 0.32);
  bk.add(mats.basalt, B(1.5, 0.14, 0.6), { p: [BOOK.x, 1.0, -HZ + 0.3], uv: 0.5, color: 0xb0b4b0 });
  for (const s of [-1, 1]) bk.add(mats.basalt, B(0.18, 0.4, 0.4), { p: [BOOK.x + s * 0.55, 0.73, -HZ + 0.2], uv: 0.5, color: 0xa0a4a0 });
  bk.at([BOOK.x, 1.07, BOOK.z], 0.08, () => {
    for (const s of [-1, 1]) {
      bk.add(mats.bookCover, roundBox(0.36, 0.025, 0.5, 0.01), { p: [s * 0.19, 0.012, 0], r: [0, 0, s * 0.05] });
      bk.add(mats.paper, B(0.34, 0.07, 0.46), { p: [s * 0.18, 0.06, 0], r: [0, 0, s * 0.05] });
      bk.add(mats.page, new THREE.PlaneGeometry(0.34, 0.46).rotateX(-Math.PI / 2), { p: [s * 0.18, 0.098 - Math.abs(s) * 0.004, 0], r: [0, 0, s * 0.05] });
    }
  });

  // the dead
  const DEAD = [
    { at: [-4.6, 0, -HZ + 0.25], ry: -Math.PI / 2, o: { seed: 2, lap: [true, true] } },
    { at: [HX - 0.25, 0, -2.3], ry: Math.PI, o: { seed: 3, lap: [false, true], helmet: false } },
    { at: [-HX + 0.25, 0, 2.3], ry: 0, o: { seed: 4, lap: [false, false], knees: 0.8 } },
    { at: [4.0, 0, HZ - 0.25], ry: Math.PI / 2, o: { seed: 5, lap: [true, false] } },
    { at: [-0.9, 0, TOMB.d / 2 + 0.65], ry: -Math.PI / 2, o: { seed: 6, lap: [false, true], knees: 0.5 } },
    { at: [-HX + 0.25, 0, -5.6], ry: 0, o: { seed: 7, lap: [true, true], helmet: false } },
  ];
  for (const { at, ry, o } of DEAD) bk.at(at, ry, () => deadDwarf(bk, K, o));
  {
    const out = V3(-1, 0, 1).normalize();
    const at = WELL.clone().addScaledVector(out, 0.74);
    bk.at([at.x, 0, at.z], Math.atan2(-out.z, out.x), () => deadDwarf(bk, K, { seed: 8, perch: true, helmet: true }));
  }

  // broken weapons and shields over the floor, a few orc arrows stuck in it
  const clear = (x, z) => Math.abs(x) < TOMB.w / 2 + 0.6 && Math.abs(z) < TOMB.d / 2 + 0.6;
  for (let i = 0; i < 22; i++) {
    let x = (r() - 0.5) * 2 * (HX - 1.8);
    let z = (r() - 0.5) * 2 * (HZ - 1.4);
    if (clear(x, z)) x += x < 0 ? -2.2 : 2.2;
    if (Math.hypot(x - WELL.x, z - WELL.z) < 1.4) z += 2;
    if (Math.abs(x) < 1.8 && z > HZ - 2.5) z -= 2.5;
    const kind = i % 6;
    bk.at([x, 0, z], r() * TAU, () => {
      if (kind === 0) bk.at([0, 0.03, 0], [0, 0, 0.04], () => axeParts(bk, K, 0.9, r() < 0.4));
      else if (kind === 1) bk.at([0, 0.02, 0], [Math.PI / 2, 0, 0], () => swordParts(bk, K, 0.72, r() < 0.5 ? 0.3 + r() * 0.3 : 0));
      else if (kind === 2) shieldParts(bk, K, 0.34 + r() * 0.08, r() < 0.5 ? 0.25 + r() * 0.2 : 0);
      else if (kind === 3) bk.add(mats.rustIron, new THREE.SphereGeometry(0.12, 10, 5, 0, TAU, 0, Math.PI / 2), { p: [0, 0.06, 0], r: [1.6 + r(), 0, r()] });
      else if (kind === 4) {
        // a spear's broken shaft
        bk.add(mats.oldWood, cyl(0.02, 0.02, 0.8 + r() * 0.6, 5), { p: [0, 0.02, 0], r: [0, 0, Math.PI / 2], uv: 3 });
      } else {
        for (let k = 0; k < 3; k++) {
          const a = rod(V3((r() - 0.5) * 0.6, -0.1, (r() - 0.5) * 0.6), V3((r() - 0.5) * 0.6 + 0.3, 0.55, (r() - 0.5) * 0.4), 0.008, 0.008, 4);
          bk.add(mats.arrow, a);
        }
      }
    });
  }
  // rubble fallen in the corners
  for (let i = 0; i < 16; i++) {
    const cx = (i % 2 ? 1 : -1) * (HX - 0.5 - r() * 1.5);
    const cz = (i % 4 < 2 ? 1 : -1) * (HZ - 0.5 - r() * 1.2);
    if (Math.abs(cx) < 2) continue;
    const s = 0.12 + r() * 0.3;
    const geo = chunkGeo(700 + i, s, 0.6);
    tf(geo, { p: [cx, s * 0.25, cz], r: [r(), r() * 3, 0] });
    bk.add(mats.basalt, geo, { uv: 1, color: 0x9a9e9a });
  }
  bk.build(g);

  // ── the doors: heavy timber, banded and studded with iron, hinged at the
  // jambs, swinging in
  const doorLeaves = [-1, 1].map((s) => {
    const leaf = new THREE.Group();
    leaf.name = s < 0 ? 'doorL' : 'doorR';
    leaf.position.set(s * DA, 0, HZ - 0.02);
    g.add(leaf);
    const lk = parts();
    // its half of the doorway's outline, a finger's breadth short of the middle
    const side = door.filter(([x]) => s * x > 0);
    const leafGeo = ext(shapeOf([[s * 0.006, 0], ...(s < 0 ? side : side.slice().reverse()), [s * 0.006, door[2][1]]]), 0.2);
    leafGeo.translate(-s * DA, 0, -0.2);
    lk.add(mats.oldWood, leafGeo, { uv: 0.9 });
    for (const y of [0.5, 1.6, 2.7]) lk.add(mats.rustIron, B(DA - 0.1, 0.12, 0.03), { p: [-s * DA * 0.5, y, -0.215] });
    for (const y of [0.5, 1.6, 2.7]) {
      for (let k = 0; k < 4; k++) lk.add(mats.rustIron, new THREE.OctahedronGeometry(0.03, 0), { p: [-s * (0.2 + k * 0.32), y, -0.235] });
    }
    lk.build(leaf);
    return { leaf, s };
  });
  const doors = {
    open(k) {
      const t = clamp01(k);
      for (const { leaf, s } of doorLeaves) leaf.rotation.y = -s * t * 1.75;
    },
  };
  doors.open(1);

  // ── the light: the shaft, where it lands, and the dust in it
  const from = V3(-HX - 0.2, WY, WZ);
  const to = V3(0, tombTop, 0);
  const dir = to.clone().sub(from).normalize();
  const len = -from.y / dir.y;
  const beamInfo = { from, dir, r0: 0.62, r1: 1.25, len };
  const bg = new THREE.Group();
  bg.name = 'daylight';
  g.add(bg);
  const shaftGeo = new THREE.CylinderGeometry(beamInfo.r0, beamInfo.r1, len, 32, 1, true).translate(0, -len / 2, 0);
  shaftGeo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, -1, 0), dir));
  shaftGeo.translate(from.x, from.y, from.z);
  const beamMat = K.shaders.beam(U);
  const shaftMesh = new THREE.Mesh(shaftGeo, beamMat);
  shaftMesh.renderOrder = 4;
  bg.add(shaftMesh);
  const sun = K.shaders.sunlit(U, beamInfo);
  sun.uniforms.uBoxMin.value.set(-TOMB.w / 2, 0, -TOMB.d / 2);
  sun.uniforms.uBoxMax.value.set(TOMB.w / 2, tombTop - 0.01, TOMB.d / 2);
  const pools = [
    new THREE.PlaneGeometry(TOMB.w, TOMB.d).rotateX(-Math.PI / 2).translate(0, tombTop + 0.006, 0),
    new THREE.PlaneGeometry(9, 7).rotateX(-Math.PI / 2).translate(1, 0.012, 0),
    new THREE.PlaneGeometry(TOMB.d, TOMB.h).rotateY(-Math.PI / 2).translate(-TOMB.w / 2 - 0.006, TOMB.base + TOMB.h / 2, 0),
    new THREE.PlaneGeometry(TOMB.d + 0.8, TOMB.base).rotateY(-Math.PI / 2).translate(-TOMB.w / 2 - 0.406, TOMB.base / 2, 0),
    new THREE.PlaneGeometry(TOMB.w + 0.8, TOMB.d + 0.8).rotateX(-Math.PI / 2).translate(0, TOMB.base + 0.006, 0),
  ];
  const poolMesh = new THREE.Mesh(mergeGeometries(pools), sun);
  poolMesh.renderOrder = 3;
  bg.add(poolMesh);
  // the motes
  const NM = 420;
  const mp = new Float32Array(NM * 3);
  const ms = new Float32Array(NM * 4);
  const side = V3(0, 1, 0).cross(dir).normalize();
  const up2 = dir.clone().cross(side).normalize();
  for (let i = 0; i < NM; i++) {
    const t = Math.pow(r(), 0.8) * (len * 0.7);
    const rr = mix(beamInfo.r0, beamInfo.r1, t / len) * Math.sqrt(r()) * 0.85;
    const a = r() * TAU;
    const p = from.clone().addScaledVector(dir, t + 0.4).addScaledVector(side, Math.cos(a) * rr).addScaledVector(up2, Math.sin(a) * rr);
    mp.set([p.x, p.y, p.z], i * 3);
    ms.set([r(), r(), r(), r()], i * 4);
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  dg.setAttribute('aSeed', new THREE.BufferAttribute(ms, 4));
  // (a kit on the node renderer draws its points as sprites, dustPoints: the node renderer's points are a pixel wide)
  const dust = K.shaders.dustPoints ? K.shaders.dustPoints(dg, U, K) : new THREE.Points(dg, K.shaders.dust(U, K));
  dust.frustumCulled = false;
  dust.renderOrder = 5;
  bg.add(dust);
  const beam = {
    group: bg,
    from: from.clone(),
    to: from.clone().addScaledVector(dir, len),
    dir: dir.clone(),
    set(k) {
      const t = clamp01(k);
      beamMat.uniforms.uK.value = t;
      sun.uniforms.uK.value = t;
      dust.material.uniforms.uK.value = t;
      bg.visible = t > 0.001;
    },
  };
  const update = (t) => {
    U.uTime.value = t;
    dust.material.userData.fit();
  };
  update(0);
  return {
    group: g,
    tomb: V3(0, tombTop, 0),
    well: WELL.clone(),
    door: V3(0, 0, HZ + T / 2),
    beam,
    book: BOOK.clone().setY(1.17),
    columns,
    doors,
    update,
    size: { w: 2 * HX, d: 2 * HZ, h: H, wall: T },
  };
}
