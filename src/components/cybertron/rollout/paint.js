// Roll out's textures, painted in code at start: the road for each stage
// (sun-bleached desert asphalt, the city's dark tarmac, Kaon's iron plates),
// the ground beside it, rock strata for the mesas and the canyon, city
// facades with lit windows, Cybertronian spires, signs, insignia decals,
// armour panelling, tyres and the sprites for glow, fire and smoke. Each
// surface paints colour, height (turned into a normal map) and roughness
// together, so the relief and the shine follow what is painted.

import { clamp01, fbm, greyFromField, makeCanvas, makeCells, makeNoise, mix, normalFromField, ramp, rgb, smooth } from '../../../lib/paint';
import { AUTOBOT_PATH, AUTOBOT_VIEWBOX, DECEPTICON_PATH, DECEPTICON_VIEWBOX } from '../../marks';

function surface(w, h = w) {
  return { w, h, col: new Uint8ClampedArray(w * h * 4), hgt: new Float32Array(w * h), rgh: new Float32Array(w * h), emi: null };
}

function toCanvas(s, data) {
  const c = makeCanvas(s.w, s.h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(s.w, s.h);
  img.data.set(data);
  ctx.putImageData(img, 0, 0);
  return c;
}

function finish(s, normal = 2.5) {
  return {
    color: toCanvas(s, s.col),
    normal: normalFromField(s.hgt, s.w, s.h, normal),
    rough: greyFromField(s.rgh, s.w, s.h),
    emissive: s.emi ? toCanvas(s, s.emi) : null,
  };
}

function put(s, i, c, k = 1) {
  s.col[i * 4] = c[0] * k;
  s.col[i * 4 + 1] = c[1] * k;
  s.col[i * 4 + 2] = c[2] * k;
  s.col[i * 4 + 3] = 255;
}
function glow(s, i, c, k = 1) {
  s.emi ??= new Uint8ClampedArray(s.w * s.h * 4).map((_, j) => (j % 4 === 3 ? 255 : 0));
  s.emi[i * 4] = Math.max(s.emi[i * 4], c[0] * k);
  s.emi[i * 4 + 1] = Math.max(s.emi[i * 4 + 1], c[1] * k);
  s.emi[i * 4 + 2] = Math.max(s.emi[i * 4 + 2], c[2] * k);
}

// ── the road: one tile is the full width (13 m) by 13 m along ──

export const ROAD_TILE = 13;

export function paintRoad({ size = 512, seed = 1, kind = 'desert' } = {}) {
  const s = surface(size);
  const n = makeNoise(seed);
  const n2 = makeNoise(seed + 7);
  const cells = makeCells(seed + 3);
  const big = makeCells(seed + 11);
  const S = size;
  const W = ROAD_TILE;
  const kaon = kind === 'kaon';
  const city = kind === 'city';
  const base = kaon ? [[0, rgb('#24262c')], [0.5, rgb('#3a3d45')], [1, rgb('#50535b')]] : city ? [[0, rgb('#1e1f22')], [0.55, rgb('#2c2d31')], [1, rgb('#3c3d41')]] : [[0, rgb('#4a4744')], [0.5, rgb('#605b55')], [1, rgb('#7a746b')]];
  const paint = kind === 'desert' ? rgb('#e9e4d4') : rgb('#f2f2ee');
  const yellow = rgb('#e2b23c');
  const energon = rgb('#ff6a2a');
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const i = py * S + px;
      const u = px / S;
      const v = py / S;
      const X = u * W - W / 2;
      const Z = v * W;
      const macro = fbm(n, u * 6, v * 6, { period: 6, octaves: 4 });
      const grain = n2(u * 220, v * 220, 220);
      let h = 0.5 + (macro - 0.5) * 0.25 + (grain - 0.5) * 0.12;
      let r = 0.86 + (grain - 0.5) * 0.1;
      let col = ramp(base, clamp01(macro * 0.7 + grain * 0.45 - 0.08));
      // aggregate: the odd pale stone
      if (grain > 0.83 && !kaon) {
        col = [col[0] * 1.35, col[1] * 1.33, col[2] * 1.3];
        h += 0.05;
      }
      if (kaon) {
        // iron plates, one per lane per half tile, with seams and rivets
        const sx = Math.abs(((X + 6) % 3 + 3) % 3);
        const sz = Z % 6.5;
        const seam = Math.min(sx, 3 - sx, sz, 6.5 - sz);
        const plate = big(Math.floor((X + 6) / 3) + 0.5, Math.floor(Z / 6.5) + 0.5, 0).id;
        col = col.map((c) => c * (0.85 + plate * 0.3));
        if (seam < 0.06) {
          col = col.map((c) => c * 0.35);
          h -= 0.35;
          r = 0.6;
        } else if (seam < 0.12) h += 0.06;
        const rv = Math.hypot(sx - 0.28, (sz % 1.625) - 0.28);
        if (rv < 0.07) {
          h += 0.25 * (1 - rv / 0.07);
          col = col.map((c) => c * 1.25);
          r = 0.45;
        }
        r = Math.min(r, 0.55 + macro * 0.25);
        // scorch and rust
        const rust = fbm(n2, u * 4 + 3, v * 4, { period: 4, octaves: 3 });
        if (rust > 0.62) col = [mix(col[0], 120, (rust - 0.62) * 1.4), mix(col[1], 60, (rust - 0.62) * 1.4), mix(col[2], 30, (rust - 0.62) * 1.4)];
      } else {
        // cracks across the tarmac, here and there
        const c = cells(u * 5, v * 5, 5);
        const crackMask = smooth(0.45, 0.6, fbm(n, u * 3 + 9, v * 3, { period: 3, octaves: 3 }));
        const crack = smooth(0.05, 0, c.f2 - c.f1) * crackMask;
        if (crack > 0) {
          col = col.map((cc) => cc * (1 - crack * 0.55));
          h -= crack * 0.4;
        }
        // patched-over repairs
        const patch = big(u * 2, v * 2, 2);
        if (patch.id < 0.18 && patch.f1 < 0.32) {
          col = col.map((cc) => cc * (city ? 0.8 : 0.74));
          r -= 0.06;
          h += 0.02;
        }
      }
      // tyre tracks: darker, polished
      if (!kaon) {
        let wear = 0;
        for (const L of [-4.5, -1.5, 1.5, 4.5]) for (const o of [-0.78, 0.78]) wear = Math.max(wear, Math.exp(-(((X - L - o) / 0.32) ** 2)));
        col = col.map((cc) => cc * (1 - wear * 0.16));
        r -= wear * 0.12;
        if (city) r -= wear * 0.08;
      }
      // the lines: dashed between lanes, solid along the edges
      const ax = Math.abs(X);
      const dash = Z % 6.5 < 3.2;
      const wearP = fbm(n2, u * 14, v * 14, { period: 14, octaves: 3 });
      let line = 0;
      let lineCol = paint;
      for (const L of [-3, 0, 3]) if (dash && Math.abs(X - L) < 0.08) line = 1;
      if (Math.abs(ax - 5.9) < 0.1) {
        line = 1;
        if (X < 0 && !kaon) lineCol = yellow;
      }
      if (line && wearP > (kind === 'desert' ? 0.3 : 0.22)) {
        if (kaon) {
          // energon strips: they glow
          const k = 0.75 + 0.25 * wearP;
          col = col.map((c, j) => mix(c, energon[j], 0.6));
          glow(s, i, energon, k);
          r = 0.3;
        } else {
          const k = 0.78 + wearP * 0.22;
          col = col.map((c, j) => mix(c, lineCol[j], k));
          h += 0.08;
          r = 0.55;
        }
      }
      // the shoulders, with rumble strips
      if (ax > 6.05) {
        if (kaon) col = col.map((c) => c * 0.8);
        else col = col.map((c) => c * (kind === 'desert' ? 1.08 : 0.92));
        if (ax < 6.45 && Z % 0.4 < 0.2) h -= 0.12;
        if (kind === 'desert') {
          // drifted sand along the edge
          const drift = smooth(6.1, 6.5, ax) * smooth(0.35, 0.7, fbm(n, u * 8, v * 8 + 3, { period: 8, octaves: 3 }));
          col = col.map((c, j) => mix(c, [200, 160, 110][j], drift * 0.8));
        }
      }
      // oil drips in the middle of lanes
      if (!kaon) {
        const oil = fbm(n, u * 10 + 4, v * 10 + 1, { period: 10, octaves: 3 });
        if (oil > 0.71) {
          const k = smooth(0.71, 0.78, oil);
          col = col.map((c) => c * (1 - k * 0.3));
          r -= k * 0.35;
        }
      }
      put(s, i, col);
      s.hgt[i] = h;
      s.rgh[i] = clamp01(r);
    }
  }
  return finish(s, kaon ? 3 : 2.2);
}

// The markings laid over a real asphalt (or iron) texture: worn lane dashes
// and edge lines, tyre tracks, rumble strips, sand blown onto the shoulder;
// in Kaon, energon strips that glow. Transparent everywhere else.
export function paintLanes({ size = 512, seed = 1, kind = 'desert', glow: lineGlow = '#ff6a2a' } = {}) {
  const S = size;
  const n = makeNoise(seed);
  const col = new Uint8ClampedArray(S * S * 4);
  const emi = kind === 'kaon' ? new Uint8ClampedArray(S * S * 4) : null;
  const W = ROAD_TILE;
  const paint = kind === 'desert' ? rgb('#ece6d2') : rgb('#f4f4f0');
  const yellow = rgb('#e8b53a');
  const energon = rgb(lineGlow);
  const sand = rgb('#c99a64');
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const i = (py * S + px) * 4;
      const u = px / S;
      const v = py / S;
      const X = u * W - W / 2;
      const Z = v * W;
      const ax = Math.abs(X);
      let c = [0, 0, 0];
      let a = 0;
      const over = (cc, aa) => {
        // paint this over what's there
        const k = aa + a * (1 - aa);
        if (k <= 0) return;
        c = c.map((x, j) => (cc[j] * aa + x * a * (1 - aa)) / k);
        a = k;
      };
      if (kind !== 'kaon') {
        // tyre tracks: a darker polish down each lane
        let wear = 0;
        for (const L of [-4.5, -1.5, 1.5, 4.5]) for (const o of [-0.78, 0.78]) wear = Math.max(wear, Math.exp(-(((X - L - o) / 0.3) ** 2)));
        if (wear > 0.02) over([10, 10, 12], wear * (kind === 'city' ? 0.22 : 0.16) * (0.7 + 0.3 * n(u * 30, v * 30, 30)));
        // oil down the middle of each lane
        const oil = fbm(n, u * 10 + 4, v * 10 + 1, { period: 10, octaves: 3 });
        if (oil > 0.7) over([6, 6, 8], smooth(0.7, 0.8, oil) * 0.35);
      }
      // the shoulders: darker, with rumble strips
      if (ax > 6.05) {
        over(kind === 'kaon' ? [10, 8, 8] : [20, 20, 20], 0.18);
        if (ax < 6.45 && Z % 0.4 < 0.18) over([0, 0, 0], 0.35);
        if (kind === 'desert') {
          const drift = smooth(6.1, 6.5, ax) * smooth(0.35, 0.7, fbm(n, u * 8, v * 8 + 3, { period: 8, octaves: 3 }));
          if (drift > 0) over(sand, drift * 0.85);
        }
      } else if (kind === 'desert' && ax > 5) {
        const drift = smooth(0.62, 0.8, fbm(n, u * 6 + 7, v * 6, { period: 6, octaves: 3 })) * smooth(5, 6, ax);
        if (drift > 0) over(sand, drift * 0.7);
      }
      // the lines
      const wearP = fbm(n, u * 14, v * 14, { period: 14, octaves: 3 });
      const fresh = smooth(kind === 'desert' ? 0.28 : 0.2, 0.42, wearP);
      const dash = Z % 6.5 < 3.2;
      let line = 0;
      let lineCol = paint;
      for (const L of [-3, 0, 3]) if (dash) line = Math.max(line, smooth(0.09, 0.06, Math.abs(X - L)));
      const edge = smooth(0.11, 0.08, Math.abs(ax - 5.9));
      if (edge > line) {
        line = edge;
        if (X < 0 && kind !== 'kaon') lineCol = yellow;
      }
      if (line > 0 && fresh > 0) {
        if (kind === 'kaon') {
          over(energon.map((x) => x * 0.8), line * fresh);
          const k = line * fresh;
          emi[i] = energon[0] * k;
          emi[i + 1] = energon[1] * k;
          emi[i + 2] = energon[2] * k;
          emi[i + 3] = 255;
        } else over(lineCol, line * (0.55 + 0.45 * fresh));
      }
      if (emi && emi[i + 3] === 0) emi[i + 3] = 255;
      col[i] = c[0];
      col[i + 1] = c[1];
      col[i + 2] = c[2];
      col[i + 3] = a * 255;
    }
  }
  const s = { w: S, h: S };
  return { color: toCanvas(s, col), emissive: emi ? toCanvas(s, emi) : null };
}

// ── the ground beside the road ──

export function paintSand({ size = 512, seed = 2 } = {}) {
  const s = surface(size);
  const n = makeNoise(seed);
  const c = makeCells(seed + 1);
  const S = size;
  const sand = [[0, rgb('#a87a4c')], [0.45, rgb('#c99a64')], [0.75, rgb('#ddb582')], [1, rgb('#ecc897')]];
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const i = py * S + px;
      const u = px / S;
      const v = py / S;
      const warp = fbm(n, u * 3, v * 3, { period: 3, octaves: 3 });
      const rip = Math.sin((u * 0.6 + v) * Math.PI * 2 * 22 + warp * 9) * 0.5 + 0.5;
      const macro = fbm(n, u * 5 + 7, v * 5, { period: 5, octaves: 5 });
      let col = ramp(sand, clamp01(macro * 0.9 + rip * 0.12));
      let h = rip * 0.22 + macro * 0.5;
      let r = 0.93;
      // pebbles and scrub
      const p = c(u * 40, v * 40, 40);
      if (p.f1 < 0.12 && p.id < 0.35) {
        col = col.map((cc) => cc * (0.55 + p.id));
        h += (0.12 - p.f1) * 2;
        r = 0.8;
      }
      const scrub = fbm(n, u * 9 + 2, v * 9 + 5, { period: 9, octaves: 4 });
      if (scrub > 0.66) {
        const k = smooth(0.66, 0.74, scrub);
        col = col.map((cc, j) => mix(cc, [92, 88, 52][j], k * 0.85));
        h += k * 0.15;
      }
      // dry, cracked hardpan in hollows
      const pan = smooth(0.32, 0.25, macro);
      if (pan > 0) {
        const cr = c(u * 12, v * 12, 12);
        const edge = smooth(0.06, 0, cr.f2 - cr.f1) * pan;
        col = col.map((cc, j) => mix(cc, [210, 180, 140][j], pan * 0.4) * (1 - edge * 0.4));
        h -= edge * 0.2;
      }
      put(s, i, col);
      s.hgt[i] = h;
      s.rgh[i] = r;
    }
  }
  return finish(s, 3);
}

export function paintPavement({ size = 512, seed = 3 } = {}) {
  const s = surface(size);
  const n = makeNoise(seed);
  const S = size;
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const i = py * S + px;
      const u = px / S;
      const v = py / S;
      // 2 m slabs on an 8 m tile
      const gx = (u * 4) % 1;
      const gy = (v * 4) % 1;
      const joint = Math.min(gx, 1 - gx, gy, 1 - gy);
      const slab = makeCellsId(Math.floor(u * 4), Math.floor(v * 4), seed);
      const macro = fbm(n, u * 6, v * 6, { period: 6, octaves: 4 });
      const t = 0.45 + slab * 0.2 + (macro - 0.5) * 0.4;
      let col = [mix(70, 112, t), mix(70, 110, t), mix(74, 112, t)];
      let h = 0.5 + macro * 0.15;
      let r = 0.82;
      if (joint < 0.012) {
        col = col.map((c) => c * 0.45);
        h -= 0.4;
      }
      const stain = fbm(n, u * 12 + 3, v * 12, { period: 12, octaves: 3 });
      if (stain > 0.64) {
        const k = smooth(0.64, 0.75, stain);
        col = col.map((c) => c * (1 - k * 0.35));
        r -= k * 0.25;
      }
      put(s, i, col);
      s.hgt[i] = h;
      s.rgh[i] = r;
    }
  }
  return finish(s, 2);
}
const makeCellsId = (x, y, seed) => {
  let h = Math.imul(x + 31, 0x27d4eb2d) ^ Math.imul(y + 17, 0x165667b1) ^ Math.imul(seed, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

export function paintDeck({ size = 512, seed = 4 } = {}) {
  const s = surface(size);
  const n = makeNoise(seed);
  const S = size;
  const hot = rgb('#ff5a1f');
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const i = py * S + px;
      const u = px / S;
      const v = py / S;
      const gx = (u * 3) % 1;
      const gy = (v * 3) % 1;
      const seam = Math.min(gx, 1 - gx, gy, 1 - gy);
      const id = makeCellsId(Math.floor(u * 3), Math.floor(v * 3), seed);
      const macro = fbm(n, u * 5, v * 5, { period: 5, octaves: 4 });
      const t = 0.3 + id * 0.25 + (macro - 0.5) * 0.35;
      let col = [mix(28, 78, t), mix(30, 80, t), mix(36, 88, t)];
      let h = 0.5 + id * 0.1;
      let r = 0.5 + macro * 0.35;
      // inset panels within each plate
      const ix = (gx * 2) % 1;
      const iy = (gy * 2) % 1;
      const inset = Math.min(ix, 1 - ix, iy, 1 - iy);
      if (inset < 0.04 && id > 0.4) {
        h -= 0.15;
        col = col.map((c) => c * 0.7);
      }
      if (seam < 0.012) {
        col = col.map((c) => c * 0.3);
        h -= 0.5;
        const k = 0.35 + 0.65 * fbm(n, u * 20, v * 20, { period: 20, octaves: 2 });
        if (id > 0.55) glow(s, i, hot, k * 0.9);
      }
      const rust = fbm(n, u * 7 + 2, v * 7 + 9, { period: 7, octaves: 4 });
      if (rust > 0.6) col = col.map((c, j) => mix(c, [96, 52, 30][j], smooth(0.6, 0.8, rust) * 0.7));
      put(s, i, col);
      s.hgt[i] = h;
      s.rgh[i] = clamp01(r);
    }
  }
  return finish(s, 3);
}

// ── rock: the mesas and the canyon walls, in bands ──

export function paintStrata({ size = 512, seed = 5, palette = 'desert' } = {}) {
  const s = surface(size);
  const n = makeNoise(seed);
  const c = makeCells(seed + 2);
  const S = size;
  const bands =
    palette === 'kaon'
      ? [[0, rgb('#2a2224')], [0.3, rgb('#4b3530')], [0.55, rgb('#3a2c2c')], [0.8, rgb('#5e3d2f')], [1, rgb('#2c2324')]]
      : palette === 'city'
        ? [[0, rgb('#3d3a38')], [0.4, rgb('#57524c')], [0.7, rgb('#4a4641')], [1, rgb('#625c54')]]
        : [[0, rgb('#7a3b22')], [0.18, rgb('#a3532c')], [0.32, rgb('#c4774a')], [0.46, rgb('#9a4a2a')], [0.6, rgb('#d39a68')], [0.74, rgb('#b0603a')], [0.88, rgb('#8a4428')], [1, rgb('#7a3b22')]];
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const i = py * S + px;
      const u = px / S;
      const v = py / S;
      const warp = fbm(n, u * 4, v * 2, { period: 4, octaves: 4 });
      const layer = (v * 3 + warp * 0.35) % 1;
      let col = ramp(bands, layer);
      const grain = fbm(n, u * 30, v * 30, { period: 30, octaves: 3 });
      col = col.map((cc) => cc * (0.82 + grain * 0.36));
      let h = Math.sin(layer * Math.PI * 2 * 3) * 0.12 + grain * 0.3;
      // vertical joints and erosion streaks
      const j = c(u * 6, v * 1.5, 6);
      const edge = smooth(0.05, 0, j.f2 - j.f1);
      h -= edge * 0.5;
      col = col.map((cc) => cc * (1 - edge * 0.45));
      const streak = fbm(n, u * 18, v * 1.2, { period: 18, octaves: 3 });
      col = col.map((cc) => cc * (0.9 + streak * 0.2));
      put(s, i, col);
      s.hgt[i] = h + 0.5;
      s.rgh[i] = 0.92 - grain * 0.08;
    }
  }
  return finish(s, 3.5);
}

// The bottom of the canyon under a broken bridge: a river, lava in Kaon, or
// a river of raw energon in Iacon.
export function paintChasm({ size = 256, seed = 6, kind = 'desert' } = {}) {
  const s = surface(size);
  const n = makeNoise(seed);
  const S = size;
  const lava = kind === 'kaon' || kind === 'energon';
  const hot = kind === 'energon' ? [[40, 190, 255], [12, 26, 44], [80, 210, 255]] : [[255, 110, 20], [40, 22, 18], [255, 120, 30]];
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const i = py * S + px;
      const u = px / S;
      const v = py / S;
      const f = fbm(n, u * 4, v * 4, { period: 4, octaves: 5 });
      if (lava) {
        const crust = smooth(0.45, 0.62, f);
        const col = [mix(hot[0][0], hot[1][0], crust), mix(hot[0][1], hot[1][1], crust), mix(hot[0][2], hot[1][2], crust)];
        put(s, i, col);
        glow(s, i, hot[2], 1 - crust);
        s.hgt[i] = crust;
        s.rgh[i] = mix(0.4, 0.95, crust);
      } else {
        const col = kind === 'city' ? [mix(10, 30, f), mix(18, 42, f), mix(30, 60, f)] : [mix(48, 92, f), mix(70, 104, f), mix(70, 90, f)];
        put(s, i, col);
        s.hgt[i] = f * 0.3;
        s.rgh[i] = 0.15 + f * 0.2;
      }
    }
  }
  return finish(s, 2);
}

// ── buildings ──

// A city facade: floors of windows, some lit, on a concrete or glass skin.
// One tile is four windows across and six floors up.
export function paintFacade({ w = 256, h = 384, seed = 7, kind = 'glass' } = {}) {
  const c = makeCanvas(w, h);
  const e = makeCanvas(w, h);
  const x = c.getContext('2d');
  const ex = e.getContext('2d');
  ex.fillStyle = '#000';
  ex.fillRect(0, 0, w, h);
  let r = seed * 9301 + 49297;
  const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const skin = kind === 'glass' ? '#4b5563' : kind === 'brick' ? '#6b3d2e' : '#8a8780';
  x.fillStyle = skin;
  x.fillRect(0, 0, w, h);
  // a little weathering
  for (let i = 0; i < 300; i++) {
    x.fillStyle = `rgba(0,0,0,${rand() * 0.06})`;
    x.fillRect(rand() * w, rand() * h, 1 + rand() * 6, 2 + rand() * 18);
  }
  const cols = 4;
  const rows = 6;
  const cw = w / cols;
  const rh = h / rows;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const wx = i * cw + cw * 0.14;
      const wy = j * rh + rh * 0.2;
      const ww = cw * 0.72;
      const wh = rh * 0.62;
      const lit = rand() < 0.32;
      const gr = x.createLinearGradient(wx, wy, wx + ww, wy + wh);
      gr.addColorStop(0, kind === 'glass' ? '#1d2a3a' : '#141a22');
      gr.addColorStop(0.55, kind === 'glass' ? '#2c4058' : '#1b2430');
      gr.addColorStop(1, '#0d1219');
      x.fillStyle = gr;
      x.fillRect(wx, wy, ww, wh);
      if (lit) {
        const warm = rand() < 0.75;
        const tone = warm ? `rgb(255,${200 + rand() * 40},${120 + rand() * 60})` : `rgb(${170 + rand() * 40},${210 + rand() * 30},255)`;
        x.fillStyle = tone;
        x.globalAlpha = 0.75;
        x.fillRect(wx, wy, ww, wh);
        x.globalAlpha = 1;
        ex.fillStyle = tone;
        ex.globalAlpha = 0.55 + rand() * 0.45;
        ex.fillRect(wx, wy, ww, wh);
        // a blind half down, a silhouette of a plant
        if (rand() < 0.4) {
          const bh = wh * (0.2 + rand() * 0.5);
          x.fillStyle = 'rgba(40,30,20,0.55)';
          x.fillRect(wx, wy, ww, bh);
          ex.fillStyle = '#000';
          ex.globalAlpha = 0.7;
          ex.fillRect(wx, wy, ww, bh);
        }
        ex.globalAlpha = 1;
      } else {
        // the sky in the glass
        x.fillStyle = 'rgba(160,190,230,0.12)';
        x.beginPath();
        x.moveTo(wx, wy + wh);
        x.lineTo(wx + ww * 0.6, wy);
        x.lineTo(wx + ww * 0.8, wy);
        x.lineTo(wx + ww * 0.2, wy + wh);
        x.fill();
      }
      // frame and sill
      x.strokeStyle = kind === 'glass' ? '#9aa4b2' : '#3a3530';
      x.lineWidth = 2;
      x.strokeRect(wx, wy, ww, wh);
      x.beginPath();
      x.moveTo(wx + ww / 2, wy);
      x.lineTo(wx + ww / 2, wy + wh);
      x.stroke();
      x.fillStyle = 'rgba(255,255,255,0.12)';
      x.fillRect(wx - 2, wy + wh, ww + 4, 3);
    }
    // the floor slab between storeys
    x.fillStyle = 'rgba(0,0,0,0.25)';
    x.fillRect(0, j * rh, w, 3);
  }
  return { color: c, emissive: e };
}

// ── small things ──

// Armour panelling for the robots and vehicles: panel lines, rivets and
// scratches, as relief and roughness only (the colour comes from the paint).
export function paintPanels({ size = 256, seed = 9 } = {}) {
  const s = surface(size);
  const n = makeNoise(seed);
  const S = size;
  // a few rectangles subdividing the tile, as on a hull
  const rects = [];
  let r = seed * 48271;
  const rand = () => ((r = (r * 48271) % 2147483647) / 2147483647);
  const split = (x0, y0, x1, y1, d) => {
    if (d > 3 || (d > 1 && rand() < 0.3)) {
      rects.push([x0, y0, x1, y1]);
      return;
    }
    if (x1 - x0 > y1 - y0) {
      const m = x0 + (x1 - x0) * (0.3 + rand() * 0.4);
      split(x0, y0, m, y1, d + 1);
      split(m, y0, x1, y1, d + 1);
    } else {
      const m = y0 + (y1 - y0) * (0.3 + rand() * 0.4);
      split(x0, y0, x1, m, d + 1);
      split(x0, m, x1, y1, d + 1);
    }
  };
  split(0, 0, 1, 1, 0);
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const i = py * S + px;
      const u = px / S;
      const v = py / S;
      let edge = 1;
      for (const [x0, y0, x1, y1] of rects) if (u >= x0 && u < x1 && v >= y0 && v < y1) edge = Math.min(u - x0, x1 - u, v - y0, y1 - v);
      let h = 0.5;
      if (edge < 0.006) h -= 0.35;
      else if (edge < 0.016) h += 0.04;
      const scratch = n(u * 6, v * 90, 0);
      const k = smooth(0.78, 0.82, scratch) * smooth(0.5, 0.7, fbm(n, u * 4, v * 4, { period: 4, octaves: 2 }));
      h -= k * 0.08;
      s.hgt[i] = h;
      s.rgh[i] = 0.42 + k * 0.25 + fbm(n, u * 9, v * 9, { period: 9, octaves: 3 }) * 0.18;
      put(s, i, [255 - k * 40, 255 - k * 40, 255 - k * 40]);
    }
  }
  return finish(s, 4);
}

// Tyre tread around a wheel (u runs round it).
export function paintTread({ w = 256, h = 64 } = {}) {
  const c = makeCanvas(w, h);
  const x = c.getContext('2d');
  x.fillStyle = '#1b1b1d';
  x.fillRect(0, 0, w, h);
  x.fillStyle = '#0c0c0d';
  for (let i = 0; i < 32; i++) {
    const px = (i / 32) * w;
    x.beginPath();
    x.moveTo(px, 0);
    x.lineTo(px + 4, h * 0.45);
    x.lineTo(px, h);
    x.lineTo(px + 3, h);
    x.lineTo(px + 7, h * 0.45);
    x.lineTo(px + 3, 0);
    x.fill();
  }
  x.fillStyle = 'rgba(255,255,255,0.05)';
  x.fillRect(0, h * 0.48, w, 2);
  return c;
}

// A wheel's face: rim, spokes and hub.
export function paintRim({ size = 128, chrome = true } = {}) {
  const c = makeCanvas(size);
  const x = c.getContext('2d');
  const m = size / 2;
  x.fillStyle = '#121214';
  x.fillRect(0, 0, size, size);
  const gr = x.createRadialGradient(m * 0.8, m * 0.8, 2, m, m, m * 0.72);
  gr.addColorStop(0, chrome ? '#f4f6f8' : '#4a4d55');
  gr.addColorStop(0.7, chrome ? '#9aa1aa' : '#2c2e34');
  gr.addColorStop(1, chrome ? '#5d636c' : '#1b1c20');
  x.fillStyle = gr;
  x.beginPath();
  x.arc(m, m, m * 0.7, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#0d0d10';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    x.beginPath();
    x.ellipse(m + Math.cos(a) * m * 0.42, m + Math.sin(a) * m * 0.42, m * 0.16, m * 0.08, a, 0, Math.PI * 2);
    x.fill();
  }
  x.fillStyle = chrome ? '#d9dde2' : '#55585f';
  x.beginPath();
  x.arc(m, m, m * 0.16, 0, Math.PI * 2);
  x.fill();
  return c;
}

// An insignia on a clear background, for decals.
export function paintInsignia(kind = 'autobot', color = '#c8102e', size = 256) {
  const c = makeCanvas(size);
  const x = c.getContext('2d');
  const [vx, vy, vw, vh] = (kind === 'autobot' ? AUTOBOT_VIEWBOX : DECEPTICON_VIEWBOX).split(' ').map(Number);
  const k = (size * 0.9) / Math.max(vw, vh);
  x.translate(size / 2 - (vx + vw / 2) * k, size / 2 - (vy + vh / 2) * k);
  x.scale(k, k);
  x.fillStyle = color;
  x.fill(new Path2D(kind === 'autobot' ? AUTOBOT_PATH : DECEPTICON_PATH), 'evenodd');
  return c;
}

// A road sign: a diamond (warnings) or a panel, with words on it.
export function paintSign({ text = ['ROAD', 'CLOSED'], shape = 'diamond', bg = '#f39c12', fg = '#111', size = 256 } = {}) {
  const c = makeCanvas(size);
  const x = c.getContext('2d');
  x.clearRect(0, 0, size, size);
  const m = size / 2;
  if (shape === 'diamond') {
    x.fillStyle = '#222';
    x.beginPath();
    x.moveTo(m, 4);
    x.lineTo(size - 4, m);
    x.lineTo(m, size - 4);
    x.lineTo(4, m);
    x.closePath();
    x.fill();
    x.fillStyle = bg;
    x.beginPath();
    x.moveTo(m, 14);
    x.lineTo(size - 14, m);
    x.lineTo(m, size - 14);
    x.lineTo(14, m);
    x.closePath();
    x.fill();
  } else {
    x.fillStyle = bg;
    x.fillRect(0, size * 0.18, size, size * 0.64);
    x.strokeStyle = fg;
    x.lineWidth = 6;
    x.strokeRect(8, size * 0.18 + 8, size - 16, size * 0.64 - 16);
  }
  x.fillStyle = fg;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  const fs = size * (text.length > 1 ? 0.13 : 0.16);
  x.font = `800 ${fs}px "Archivo Variable", Arial, sans-serif`;
  text.forEach((t, i) => x.fillText(t, m, m + (i - (text.length - 1) / 2) * fs * 1.15));
  return c;
}

// Red and white stripes, for the sawhorses.
export function paintStripes({ size = 128, a = '#d6262e', b = '#f4f4f0' } = {}) {
  const c = makeCanvas(size);
  const x = c.getContext('2d');
  x.fillStyle = b;
  x.fillRect(0, 0, size, size);
  x.fillStyle = a;
  for (let i = -size; i < size * 2; i += size / 2) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i + size / 4, 0);
    x.lineTo(i + size / 4 - size, size);
    x.lineTo(i - size, size);
    x.fill();
  }
  return c;
}

// Concrete, for the jersey barriers and bridge decks.
export function paintConcrete({ size = 256, seed = 12, tone = 168 } = {}) {
  const s = surface(size);
  const n = makeNoise(seed);
  const S = size;
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const i = py * S + px;
      const u = px / S;
      const v = py / S;
      const f = fbm(n, u * 6, v * 6, { period: 6, octaves: 5 });
      const pit = n(u * 120, v * 120, 120);
      let t = tone * (0.82 + f * 0.3) - (pit > 0.85 ? 30 : 0);
      const stain = smooth(0.55, 0.9, fbm(n, u * 2, v * 3 + 5, { period: 2, octaves: 3 })) * (1 - v * 0.5);
      t *= 1 - stain * 0.3;
      put(s, i, [t, t * 0.99, t * 0.96]);
      s.hgt[i] = f * 0.4 + (pit > 0.85 ? -0.1 : 0);
      s.rgh[i] = 0.9;
    }
  }
  return finish(s, 2);
}

// An energon cube's face: bright edges, a glowing heart.
export function paintEnergon({ size = 128 } = {}) {
  const c = makeCanvas(size);
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size * 0.72);
  gr.addColorStop(0, '#ffe0f4');
  gr.addColorStop(0.35, '#ff5fc8');
  gr.addColorStop(1, '#7a1a6e');
  x.fillStyle = gr;
  x.fillRect(0, 0, size, size);
  x.strokeStyle = '#ffd6f2';
  x.lineWidth = size * 0.07;
  x.strokeRect(size * 0.04, size * 0.04, size * 0.92, size * 0.92);
  x.strokeStyle = 'rgba(255,255,255,0.5)';
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(size * 0.2, size * 0.2);
  x.lineTo(size * 0.8, size * 0.8);
  x.moveTo(size * 0.8, size * 0.2);
  x.lineTo(size * 0.2, size * 0.8);
  x.stroke();
  return c;
}

// ── sprites ──

export function glowSprite(size = 128, inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.35)') {
  const c = makeCanvas(size);
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, inner);
  gr.addColorStop(0.25, mid);
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, size, size);
  return c;
}

export function smokeSprite(size = 128, seed = 13) {
  const c = makeCanvas(size);
  const x = c.getContext('2d');
  const img = x.createImageData(size, size);
  const n = makeNoise(seed);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const u = px / size - 0.5;
      const v = py / size - 0.5;
      const d = Math.hypot(u, v) * 2;
      const f = fbm(n, px / 24, py / 24, { octaves: 4 });
      const a = clamp01((1 - d) * 1.4 - 0.15) * clamp01(f * 1.6 - 0.2);
      const i = (py * size + px) * 4;
      const t = 200 + f * 55;
      img.data[i] = t;
      img.data[i + 1] = t;
      img.data[i + 2] = t;
      img.data[i + 3] = a * 255;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}

export function fireSprite(size = 128, seed = 17) {
  const c = makeCanvas(size);
  const x = c.getContext('2d');
  const img = x.createImageData(size, size);
  const n = makeNoise(seed);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const u = px / size - 0.5;
      const v = py / size - 0.5;
      const d = Math.hypot(u, v) * 2;
      const f = fbm(n, px / 18, py / 18, { octaves: 4 });
      const heat = clamp01(1 - d * (1.1 - f * 0.5));
      const i = (py * size + px) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 90 + heat * 165;
      img.data[i + 2] = 20 + heat * heat * 200;
      // a hard round edge, so a big sprite near the camera never shows its square
      img.data[i + 3] = clamp01(heat * 1.6) * smooth(1, 0.72, d) * 255;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}

// A target ring for where a bomb will land.
export function ringSprite(size = 128) {
  const c = makeCanvas(size);
  const x = c.getContext('2d');
  const m = size / 2;
  x.strokeStyle = '#fff';
  x.lineWidth = size * 0.06;
  x.beginPath();
  x.arc(m, m, m * 0.86, 0, Math.PI * 2);
  x.stroke();
  x.lineWidth = size * 0.03;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    x.beginPath();
    x.moveTo(m + Math.cos(a) * m * 0.45, m + Math.sin(a) * m * 0.45);
    x.lineTo(m + Math.cos(a) * m * 0.72, m + Math.sin(a) * m * 0.72);
    x.stroke();
  }
  return c;
}

// Warning chevrons for a zone on the road (Megatron's aim, Starscream's dive).
export function chevronSprite({ w = 128, h = 512 } = {}) {
  const c = makeCanvas(w, h);
  const x = c.getContext('2d');
  x.clearRect(0, 0, w, h);
  x.fillStyle = 'rgba(255,255,255,0.18)';
  x.fillRect(0, 0, w, h);
  x.fillStyle = '#fff';
  for (let y = 0; y < h; y += w * 0.6) {
    x.beginPath();
    x.moveTo(w * 0.1, y + w * 0.4);
    x.lineTo(w * 0.5, y);
    x.lineTo(w * 0.9, y + w * 0.4);
    x.lineTo(w * 0.9, y + w * 0.55);
    x.lineTo(w * 0.5, y + w * 0.15);
    x.lineTo(w * 0.1, y + w * 0.55);
    x.fill();
  }
  x.fillRect(0, 0, w * 0.05, h);
  x.fillRect(w * 0.95, 0, w * 0.05, h);
  return c;
}

// Clouds for the sky dome: soft, wrapping all the way round.
export function paintClouds({ w = 1024, h = 256, seed = 21, cover = 0.5 } = {}) {
  const c = makeCanvas(w, h);
  const x = c.getContext('2d');
  const img = x.createImageData(w, h);
  const n = makeNoise(seed);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const u = px / w;
      const v = py / h;
      const f = fbm(n, u * 8, v * 4, { period: 8, octaves: 5 });
      const band = smooth(0, 0.35, v) * smooth(1, 0.6, v);
      const a = clamp01((f - (1 - cover)) * 3) * band;
      const i = (py * w + px) * 4;
      const t = 255 - (1 - f) * 60;
      img.data[i] = t;
      img.data[i + 1] = t;
      img.data[i + 2] = t;
      img.data[i + 3] = a * 255;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}
