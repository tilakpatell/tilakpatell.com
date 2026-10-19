// Moria’s painted textures: basalt, rock, ashlar, the hall’s floor, the
// carved bands, the holly’s sprigs, a glow and a tiling noise. Moved out of
// props.js as they were.

import { clamp01, fbm, makeCanvas, makeCells, makeNoise, mix, paintPixels, smooth } from '../../../../lib/paint';
import { rng } from '../../shire/build';
import { cutRunes, TAU } from './helpers';

// ── painted textures ──

// Polished stone of the deeps, nearly white so the material and the vertex
// colours give its hue: a fine dark grain of crystals, clouding, a few
// hairline veins, and worn patches where the polish has gone. With its
// height, for the normal map, and its roughness, low where it shines.
export function basaltCanvas(S, seed) {
  const n = makeNoise(seed);
  const grains = makeCells(seed + 5);
  const field = new Float32Array(S * S);
  const rough = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const cloud = fbm(n, u * 4, v * 4, { period: 4, octaves: 5 });
    const k = grains(u * 40, v * 40, 40);
    const crystal = (k.id - 0.5) * 0.7 - (1 - smooth(0, 0.08, k.f2 - k.f1)) * 0.25;
    const fine = n(u * 128, v * 128, 128);
    const vq = fbm(n, u * 2 + 5.3, v * 2 + 1.7, { period: 2, octaves: 5 });
    const vein = (1 - smooth(0, 0.016, Math.abs(vq - 0.5))) * smooth(0.42, 0.62, fbm(n, u * 3 + 11, v * 3, { period: 3, octaves: 2 }));
    const worn = smooth(0.56, 0.78, fbm(n, u * 6 + 2, v * 6 + 8, { period: 6, octaves: 4 }));
    const t = 0.64 + (cloud - 0.5) * 0.4 + crystal * 0.12 + (fine - 0.5) * 0.08 + vein * 0.1 + worn * 0.05;
    out[0] = 232 * t;
    out[1] = 236 * t;
    out[2] = 234 * t;
    field[py * S + px] = clamp01(0.5 + (fine - 0.5) * 0.12 + crystal * 0.04 - vein * 0.18);
    rough[py * S + px] = clamp01(0.3 + worn * 0.42 + (fine - 0.5) * 0.08 + vein * 0.12);
  });
  return { c, field, rough };
}

// Rough rock, the mountain's own: a coarse grain, a few sharp fractures,
// dark streaks where water has run down it, faint bedding; nearly white
// for the vertex colours. With its relief.
export function rockCanvas(S, seed) {
  const n = makeNoise(seed);
  const cells = makeCells(seed + 3);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const big = fbm(n, u * 4, v * 4, { period: 4, octaves: 5 });
    const mid = fbm(n, u * 16 + 3, v * 16, { period: 16, octaves: 3 });
    const grain = n(u * 128, v * 128, 128);
    const k = cells(u * 4, v * 4, 4);
    const crack = (1 - smooth(0, 0.018, k.f2 - k.f1)) * smooth(0.55, 0.66, fbm(n, u * 3 + 7, v * 3, { period: 3, octaves: 2 }));
    const streak = smooth(0.5, 0.85, n(u * 24, 3.5, 24)) * smooth(0.35, 0.7, fbm(n, u * 4, v * 4 + 7, { period: 4, octaves: 2 }));
    const bed = Math.sin((v * 6 + big * 1.2) * TAU) * 0.5 + 0.5;
    const t = 0.72 + (big - 0.5) * 0.36 + (mid - 0.5) * 0.22 - crack * 0.5 + (grain - 0.5) * 0.2 + (bed - 0.5) * 0.05 - streak * 0.26;
    out[0] = 230 * t;
    out[1] = 230 * t;
    out[2] = 228 * t;
    field[py * S + px] = clamp01(0.4 + big * 0.25 + mid * 0.25 + grain * 0.16 - crack * 0.5);
  });
  return { c, field };
}

// Dressed blocks for walls, in courses: big squared stones with fine
// joints, each its own shade, tooled faintly across its face, chipped at
// the arrises in places. One tile is two courses, the joints staggered.
export function ashlarCanvas(S, seed) {
  const n = makeNoise(seed);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  const JOINTS = [[0, 0.56], [0.24, 0.8]];
  paintPixels(c, (u, v, out, px, py) => {
    const row = v < 0.5 ? 0 : 1;
    const fv = (v * 2) % 1;
    const js = JOINTS[row];
    let du = 1;
    let blk = 0;
    for (let i = 0; i < js.length; i++) {
      const d = Math.abs(u - js[i]);
      du = Math.min(du, d, 1 - d);
      if (u >= js[i]) blk = i;
    }
    const dv = Math.min(fv, 1 - fv) / 2;
    const d = Math.min(du, dv);
    const chip = smooth(0.62, 0.8, fbm(n, u * 16, v * 16, { period: 16, octaves: 2 })) * 0.01;
    const joint = 1 - smooth(0.002, 0.007 + chip, d);
    const tone = n(row * 7.3 + blk * 3.1, 4.4) - 0.5;
    const cloud = fbm(n, u * 4, v * 4, { period: 4, octaves: 4 });
    const tool = Math.sin((u * 64 + v * 32) * TAU) * 0.5 + 0.5;
    const t = 0.66 + tone * 0.22 + (cloud - 0.5) * 0.3 + tool * 0.03 - joint * 0.5;
    out[0] = 230 * t;
    out[1] = 236 * t;
    out[2] = 232 * t;
    field[py * S + px] = clamp01(0.62 + cloud * 0.12 + tool * 0.03 - joint * 0.6);
  });
  return { c, field };
}

// The great hall's floor, one bay of it between four pillars (they stand at
// the corners): long dark slabs in a band along each side, edged with a pale
// inlaid line; inside, nine big slabs, the middle one inlaid with a stepped
// lozenge. Each slab its own shade. With its relief.
export function floorCanvas(S, seed) {
  const n = makeNoise(seed);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  const hash = (a, b) => {
    const h = Math.sin(a * 127.1 + b * 311.7 + seed) * 43758.5453;
    return h - Math.floor(h);
  };
  const B0 = 0.07; // the band's half width, either side of the line between pillars
  paintPixels(c, (u, v, out, px, py) => {
    // distance to the band lines (u, v = 0 or 1)
    const eu = Math.min(u, 1 - u);
    const ev = Math.min(v, 1 - v);
    const inBand = eu < B0 || ev < B0;
    let joint;
    let tone;
    let inlay = 0;
    if (inBand) {
      // the band's slabs, long ways along it, 4 to a side
      const alongU = ev < B0 && eu >= B0;
      const t = alongU ? u : v;
      const across = alongU ? ev : eu;
      const f = (t * 4) % 1;
      const corner = eu < B0 && ev < B0;
      joint = corner ? Math.min(Math.abs(eu - B0), Math.abs(ev - B0)) : Math.min(Math.min(f, 1 - f) / 4, Math.abs(across - B0), across);
      tone = 0.55 + (hash(Math.floor(t * 4), alongU ? 1 : 2) - 0.5) * 0.12;
      inlay = 1 - smooth(0.004, 0.007, Math.abs(across - B0 + 0.012));
    } else {
      const x = (u - B0) / (1 - 2 * B0);
      const y = (v - B0) / (1 - 2 * B0);
      const fx = (x * 3) % 1;
      const fy = (y * 3) % 1;
      joint = Math.min(Math.min(fx, 1 - fx), Math.min(fy, 1 - fy)) / 3.5;
      const ix = Math.floor(x * 3);
      const iy = Math.floor(y * 3);
      tone = 0.8 + (hash(ix, iy) - 0.5) * 0.18;
      if (ix === 1 && iy === 1) {
        // the stepped lozenge: rings of squares, turned 45°
        const qx = Math.abs(fx - 0.5);
        const qy = Math.abs(fy - 0.5);
        const dd = qx + qy;
        const step = Math.max(Math.floor(qx * 12), Math.floor(qy * 12)) / 12;
        const ring = (r) => 1 - smooth(0.006, 0.012, Math.abs(Math.max(dd, step * 0.8) - r));
        inlay = Math.max(ring(0.36), ring(0.24), dd < 0.1 ? 1 : 0);
      }
    }
    const cloud = fbm(n, u * 6, v * 6, { period: 6, octaves: 4 });
    const scuff = smooth(0.55, 0.8, fbm(n, u * 12 + 3, v * 12, { period: 12, octaves: 3 }));
    const j = 1 - smooth(0.0015, 0.004, joint);
    let t = tone + (cloud - 0.5) * 0.18 + scuff * 0.06 - j * 0.42;
    t = mix(t, 1.05, inlay * 0.75);
    out[0] = 220 * t;
    out[1] = 232 * t;
    out[2] = 226 * t;
    field[py * S + px] = clamp01(0.6 + cloud * 0.1 - j * 0.5 - inlay * 0.05);
  });
  return { c, field };
}

// Dwarf carving for bands and friezes, four kinds stacked one above the
// other (each repeating along its band): 0 nested chevrons; 1 a stepped
// key, running on; 2 runes cut in a raised panel between lozenges; 3
// stepped pyramids, up and down, locked together. The relief, for the
// normal map, and a picture of it (the stone darker down in the cuts).
export const BANDS = 4;
export function carvingCanvas(W = 512, H = 512) {
  const draw = makeCanvas(W, H);
  const g = draw.getContext('2d');
  const bh = H / BANDS;
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  const grey = (k) => {
    const v = Math.round(k * 255);
    return `rgb(${v},${v},${v})`;
  };
  g.lineJoin = 'miter';
  g.lineCap = 'butt';
  for (let b = 0; b < BANDS; b++) {
    const y0 = b * bh;
    g.save();
    g.beginPath();
    g.rect(0, y0, W, bh);
    g.clip();
    // the face, and raised fillets along its top and foot
    g.fillStyle = grey(0.45);
    g.fillRect(0, y0, W, bh);
    g.fillStyle = grey(0.85);
    g.fillRect(0, y0, W, bh * 0.1);
    g.fillRect(0, y0 + bh * 0.9, W, bh * 0.1);
    g.fillStyle = grey(0.2);
    g.fillRect(0, y0 + bh * 0.1, W, bh * 0.025);
    g.fillRect(0, y0 + bh * 0.875, W, bh * 0.025);
    const m0 = y0 + bh * 0.16;
    const m1 = y0 + bh * 0.84;
    const mh = m1 - m0;
    for (const dx of [-W, 0, W]) {
      g.save();
      g.translate(dx, 0);
      if (b === 0) {
        // nested chevrons: three raised zigzags, V-cut between
        const per = W / 8;
        for (let k = 0; k < 3; k++) {
          g.strokeStyle = grey(0.95 - k * 0.08);
          g.lineWidth = mh * 0.11;
          g.beginPath();
          for (let i = -1; i <= 9; i++) {
            const x = i * per;
            const yA = m0 + mh * (0.12 + k * 0.28);
            g.lineTo(x, yA);
            g.lineTo(x + per / 2, yA + mh * 0.24);
          }
          g.stroke();
          g.strokeStyle = grey(0.1);
          g.lineWidth = mh * 0.04;
          g.beginPath();
          for (let i = -1; i <= 9; i++) {
            const x = i * per;
            const yA = m0 + mh * (0.12 + k * 0.28) + mh * 0.11;
            g.lineTo(x, yA);
            g.lineTo(x + per / 2, yA + mh * 0.24);
          }
          g.stroke();
        }
      } else if (b === 1) {
        // a stepped key: a square spiral hooking into the next, cut deep round it
        const per = W / 6;
        g.fillStyle = grey(0.12);
        g.fillRect(0, m0, W, mh);
        g.strokeStyle = grey(0.92);
        g.lineWidth = mh * 0.12;
        for (let i = -1; i <= 7; i++) {
          const x = i * per;
          const s = mh / 6;
          const pts = [[0, 5.4], [0, 0.6], [4.6, 0.6], [4.6, 4.2], [1.6, 4.2], [1.6, 2.2], [3.0, 2.2]];
          g.beginPath();
          pts.forEach(([px, py], j) => (j ? g.lineTo(x + px * s * (per / (6 * s)), m0 + py * s) : g.moveTo(x + px * s * (per / (6 * s)), m0 + py * s)));
          g.stroke();
          g.beginPath();
          g.moveTo(x, m0 + 5.4 * s);
          g.lineTo(x + per, m0 + 5.4 * s);
          g.stroke();
        }
      } else if (b === 2) {
        // runes in a raised panel, lozenges between the words
        g.fillStyle = grey(0.7);
        g.fillRect(0, m0 + mh * 0.06, W, mh * 0.88);
        g.strokeStyle = grey(0.08);
        g.fillStyle = grey(0.08);
        g.lineWidth = mh * 0.07;
        g.lineCap = 'round';
        const words = ['DURIN', 'KHAZAD', 'DUM', 'BARUK'];
        let x = 6;
        for (const w of words) {
          x = cutRunes(g, w, x, m0 + mh * 0.2, mh * 0.6, { gap: 0.5 });
          // a lozenge between
          g.beginPath();
          const cx = x + mh * 0.18;
          const cy = m0 + mh * 0.5;
          g.moveTo(cx, cy - mh * 0.22);
          g.lineTo(cx + mh * 0.13, cy);
          g.lineTo(cx, cy + mh * 0.22);
          g.lineTo(cx - mh * 0.13, cy);
          g.closePath();
          g.fill();
          x = cx + mh * 0.3;
        }
        g.lineCap = 'butt';
      } else {
        // stepped pyramids, pointing up and down by turns, cut round
        const per = W / 6;
        g.fillStyle = grey(0.14);
        g.fillRect(0, m0, W, mh);
        for (let i = -1; i <= 7; i++) {
          for (const up of [1, -1]) {
            const cx = i * per + (up > 0 ? 0 : per / 2);
            g.fillStyle = grey(up > 0 ? 0.9 : 0.72);
            for (let s = 0; s < 4; s++) {
              const w = per * 0.46 * (1 - s / 4);
              const h = mh * 0.22;
              const y = up > 0 ? m1 - mh * 0.06 - (s + 1) * h : m0 + mh * 0.06 + s * h;
              g.fillRect(cx - w, y, w * 2, h - 1);
            }
          }
        }
      }
      g.restore();
    }
    g.restore();
  }
  // soften the cuts a little, for the relief
  const field = new Float32Array(W * H);
  const d = g.getImageData(0, 0, W, H).data;
  for (let i = 0; i < W * H; i++) field[i] = d[i * 4] / 255;
  const soft = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let k = -1; k <= 1; k++) s += field[y * W + ((x + k + W) % W)] + field[Math.min(H - 1, Math.max(0, y + k)) * W + x];
      soft[y * W + x] = s / 6;
    }
  }
  const n = makeNoise(31);
  const c = makeCanvas(W, H);
  paintPixels(c, (u, v, out, px, py) => {
    const h = soft[py * W + px];
    const t = (0.5 + h * 0.5 + (n(u * 64, v * 64, 64) - 0.5) * 0.08) * 255;
    out[0] = t * 0.97;
    out[1] = t;
    out[2] = t * 0.98;
  });
  return { c, field: soft, W, H };
}

// A sprig of holly: glossy leaves, spined along their wavy edges and
// shining along their midribs, round a twig, and a few berries. On a clear
// ground, for leaf cards.
export function hollyCanvas(S = 128) {
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  const r = rng(77);
  g.strokeStyle = '#3a3020';
  g.lineWidth = S * 0.03;
  g.beginPath();
  g.moveTo(S * 0.5, S * 0.98);
  g.lineTo(S * 0.5, S * 0.1);
  g.stroke();
  const leafAt = (x, y, ang, len) => {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    const wid = len * 0.34;
    const pts = [];
    const spines = 4;
    for (let i = 0; i <= spines * 2; i++) {
      const t = i / (spines * 2);
      const w = Math.sin(Math.PI * Math.min(1, t * 1.15)) * wid * (i % 2 ? 0.68 : 1.18);
      pts.push([t * len, w]);
    }
    const grad = g.createLinearGradient(0, -wid, 0, wid);
    grad.addColorStop(0, '#4f8a3e');
    grad.addColorStop(0.42, '#3a7030');
    grad.addColorStop(0.55, '#2c5a26');
    grad.addColorStop(1, '#1a3a18');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, 0);
    for (const [px, py] of pts) g.lineTo(px, -py);
    for (let i = pts.length - 1; i >= 0; i--) g.lineTo(pts[i][0], pts[i][1] * 0.9);
    g.closePath();
    g.fill();
    // the wax's shine either side of the midrib
    g.fillStyle = 'rgba(190,220,170,0.35)';
    g.beginPath();
    g.ellipse(len * 0.45, -wid * 0.28, len * 0.3, wid * 0.16, 0, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(200,225,170,0.7)';
    g.lineWidth = 1.3;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(len * 0.95, 0);
    g.stroke();
    g.restore();
  };
  for (let i = 0; i < 8; i++) {
    const y = S * (0.22 + (i / 8) * 0.72);
    const side = i % 2 ? 1 : -1;
    leafAt(S * 0.5, y, (side > 0 ? -0.45 : Math.PI + 0.45) + (r() - 0.5) * 0.4, S * (0.4 + r() * 0.08));
  }
  leafAt(S * 0.5, S * 0.18, -Math.PI / 2 + (r() - 0.5) * 0.3, S * 0.36);
  for (let i = 0; i < 5; i++) {
    g.fillStyle = '#b8201a';
    g.beginPath();
    g.arc(S * (0.44 + r() * 0.12), S * (0.3 + r() * 0.42), S * 0.032, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,200,190,0.8)';
    g.beginPath();
    g.arc(S * 0.5, S * 0.5, 0, 0, TAU);
    g.fill();
  }
  return c;
}

// A soft round glow: the staff's light, a flame's halo.
export function glowCanvas(S = 128) {
  const c = makeCanvas(S);
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.12, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.28)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.07)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grd;
  x.fillRect(0, 0, S, S);
  return c;
}

// Smooth noise in three channels, tiling, for the shaders (fire, heat,
// smoke, the shimmer of ithildin).
export function noiseCanvas(S = 128) {
  const n1 = makeNoise(3);
  const n2 = makeNoise(17);
  const n3 = makeNoise(29);
  return paintPixels(makeCanvas(S), (u, v, out) => {
    out[0] = fbm(n1, u * 4, v * 4, { period: 4, octaves: 4 }) * 255;
    out[1] = fbm(n2, u * 8, v * 8, { period: 8, octaves: 3 }) * 255;
    out[2] = fbm(n3, u * 2, v * 2, { period: 2, octaves: 5 }) * 255;
  });
}
