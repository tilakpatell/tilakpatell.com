// Lothlórien’s painted textures: the mallorns’ silver bark, the elves’
// pale wood, the gold leaf cards, weathered stone, a halo, the sky in the
// Mirror and what it shows of the Shire. Moved out of props.js as they were.

import { clamp01, fbm, makeCanvas, makeCells, makeNoise, mix, paintPixels, smooth } from '../../../../lib/paint';
import { rng } from '../../shire/build';
import { TAU, wrapAt } from './helpers';

// ── painted textures ──

// Mallorn bark: smooth and silver-grey, like a beech's but paler, faintly
// striated up the trunk (v), mottled in broad soft patches, with faint dark
// lenticels across it and here and there the eye a fallen branch left.
// Pale, so the trunk's vertex colours tint it.
export function barkCanvas(S) {
  const n = makeNoise(17);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out) => {
    const m = fbm(n, u * 4, v * 4, { period: 4, octaves: 4 });
    const fine = n(u * 64, v * 64, 64);
    const t = 0.9 + (m - 0.5) * 0.16 + (fine - 0.5) * 0.035;
    out[0] = 230 * t;
    out[1] = 234 * t;
    out[2] = 234 * t;
  });
  const x = c.getContext('2d');
  const r = rng(19);
  x.lineCap = 'round';
  // long faint lines up the trunk, wandering a little
  for (let i = 0; i < 300; i++) {
    const x0 = r() * S;
    const amp = 0.4 + r() * 1.8;
    const ph = r() * TAU;
    const y0 = r() * S;
    const len = S * (0.25 + r() * 0.75);
    const light = r() < 0.5;
    x.strokeStyle = light ? `rgba(246,248,248,${0.05 + r() * 0.12})` : `rgba(92,98,98,${0.05 + r() * 0.1})`;
    x.lineWidth = 0.5 + r() * 1.3;
    for (const dx of [-S, 0, S]) {
      for (const dy of [-S, 0, S]) {
        x.beginPath();
        for (let k = 0; k <= len; k += 4) {
          const yy = y0 + k + dy;
          const xx = x0 + dx + Math.sin((yy / S) * TAU * 2 + ph) * amp;
          if (k) x.lineTo(xx, yy);
          else x.moveTo(xx, yy);
        }
        x.stroke();
      }
    }
  }
  // lenticels: short dark dashes across
  for (let i = 0; i < 70; i++) {
    const px = r() * S;
    const py = r() * S;
    const l = 2 + r() * 6;
    x.strokeStyle = `rgba(70,74,72,${0.12 + r() * 0.2})`;
    x.lineWidth = 0.8 + r() * 0.6;
    wrapAt(S, px, py, l, (qx, qy) => {
      x.beginPath();
      x.moveTo(qx - l / 2, qy);
      x.lineTo(qx + l / 2, qy + (r() - 0.5));
      x.stroke();
    });
  }
  // the eyes of old branches: a dark lid over a paler hollow
  for (let i = 0; i < 1; i++) {
    const px = r() * S;
    const py = r() * S;
    const w = 6 + r() * 6;
    wrapAt(S, px, py, w * 2, (qx, qy) => {
      x.fillStyle = 'rgba(232,236,234,0.2)';
      x.beginPath();
      x.ellipse(qx, qy + 2, w * 0.7, w * 0.35, 0, 0, TAU);
      x.fill();
      x.strokeStyle = 'rgba(60,64,62,0.22)';
      x.lineWidth = 1.4;
      x.beginPath();
      x.moveTo(qx - w * 1.6, qy + w * 0.5);
      x.quadraticCurveTo(qx, qy - w * 0.6, qx + w * 1.6, qy + w * 0.5);
      x.stroke();
    });
  }
  return c;
}

// Elven wood, pale grey-white: a fine flowing grain along u, in four
// boards across v with the faintest seams between, and here and there a
// soft knot.
export function woodCanvas(S) {
  const n = makeNoise(23);
  const r = rng(23);
  const c = makeCanvas(S);
  const shade = [0, 1, 2, 3].map(() => 0.94 + r() * 0.06);
  paintPixels(c, (u, v, out) => {
    const b = Math.floor(v * 4);
    const fv = v * 4 - b;
    let k = shade[b] * (0.92 + fbm(n, u * 6, v * 6, { period: 6, octaves: 3 }) * 0.1);
    k *= 0.72 + 0.28 * smooth(0, 0.03, Math.min(fv, 1 - fv));
    out[0] = 240 * k;
    out[1] = 238 * k;
    out[2] = 232 * k;
  });
  const x = c.getContext('2d');
  for (let b = 0; b < 4; b++) {
    for (let i = 0; i < 18; i++) {
      const y0 = (b + 0.08 + r() * 0.84) * (S / 4);
      const amp = 0.6 + r() * 2.2;
      const fq = 1 + Math.floor(r() * 3);
      const ph = r() * TAU;
      x.strokeStyle = `rgba(150,146,136,${0.1 + r() * 0.16})`;
      x.lineWidth = 0.5 + r() * 1.0;
      x.beginPath();
      for (let px = 0; px <= S; px += 4) {
        const yy = y0 + Math.sin((px / S) * TAU * fq + ph) * amp;
        if (px) x.lineTo(px, yy);
        else x.moveTo(px, yy);
      }
      x.stroke();
    }
    const kx = r() * S;
    const ky = (b + 0.5) * (S / 4);
    for (let k = 3; k > 0; k--) {
      x.strokeStyle = `rgba(140,134,124,${0.1 + k * 0.05})`;
      x.lineWidth = 1;
      wrapAt(S, kx, ky, 14, (qx, qy) => {
        x.beginPath();
        x.ellipse(qx, qy, k * 4, k * 1.6, 0, 0, TAU);
        x.stroke();
      });
    }
  }
  return c;
}

// A spray of mallorn leaves for a crown's cards: slender pointed leaves,
// pale cream to white so the cards' vertex colours give their gold, the
// darker ones behind, thick in the middle and thinning to a ragged edge
// within a round, so no card shows its corners.
export function leafCardCanvas(S = 256) {
  const c = makeCanvas(S);
  const x = c.getContext('2d');
  const r = rng(29);
  x.clearRect(0, 0, S, S);
  const leaves = [];
  for (let i = 0; i < 150; i++) {
    const a = r() * TAU;
    const d = Math.pow(r(), 0.7) * S * 0.4;
    leaves.push({ a, d, k: r() });
  }
  leaves.sort((p, q) => p.k - q.k);
  x.lineCap = 'round';
  for (const { a, d, k } of leaves) {
    const px = S / 2 + Math.cos(a) * d;
    const py = S / 2 + Math.sin(a) * d;
    const ang = a + (r() - 0.5) * 1.6;
    const L = S * (0.07 + r() * 0.05);
    const W = L * (0.3 + r() * 0.1);
    const t = 0.66 + k * 0.34;
    x.save();
    x.translate(px, py);
    x.rotate(ang);
    x.beginPath();
    x.moveTo(-L / 2, 0);
    x.quadraticCurveTo(-L * 0.05, -W, L / 2, 0);
    x.quadraticCurveTo(-L * 0.05, W, -L / 2, 0);
    x.fillStyle = `rgb(${Math.round(255 * t)},${Math.round(250 * t)},${Math.round(232 * t)})`;
    x.fill();
    x.strokeStyle = 'rgba(96,84,56,0.4)';
    x.lineWidth = 0.8;
    x.stroke();
    x.beginPath();
    x.moveTo(-L / 2, 0);
    x.lineTo(L / 2, 0);
    x.strokeStyle = 'rgba(255,255,250,0.5)';
    x.stroke();
    x.restore();
  }
  return c;
}

// Old weathered stone, pale so the vertex colours give its grey-green: a
// grain, shallow pits, a web of hairline cracks, rain streaks down it,
// and crusts and rings of lichen. With its relief.
export function weatheredCanvas(S, seed) {
  const n = makeNoise(seed);
  const cells = makeCells(seed + 3);
  const pits = makeCells(seed + 7);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const big = fbm(n, u * 4, v * 4, { period: 4, octaves: 5 });
    const grain = n(u * 128, v * 128, 128);
    const k = cells(u * 4, v * 4, 4);
    const crack = (1 - smooth(0, 0.025, k.f2 - k.f1)) * smooth(0.55, 0.68, fbm(n, u * 3 + 7, v * 3, { period: 3, octaves: 2 })) * 0.6;
    const q = pits(u * 20, v * 20, 20);
    const pit = q.id < 0.3 ? 1 - smooth(0.05, 0.18, q.f1) : 0;
    const streak = (n(u * 40, 2.5, 40) - 0.5) * smooth(0.35, 0.7, fbm(n, u * 2 + 1, v * 2, { period: 2, octaves: 2 }));
    field[py * S + px] = clamp01(0.4 + big * 0.4 + grain * 0.15 - crack * 0.45 - pit * 0.25);
    const t = 0.8 + big * 0.22 + (grain - 0.5) * 0.12 - crack * 0.32 - pit * 0.12 - streak * 0.24;
    let rr = 232 * t;
    let gg = 234 * t;
    let bb = 226 * t;
    const l1 = smooth(0.62, 0.7, fbm(n, u * 6 + 3, v * 6 + 1, { period: 6, octaves: 4 }));
    rr = mix(rr, 220, l1 * 0.5);
    gg = mix(gg, 218, l1 * 0.5);
    bb = mix(bb, 160, l1 * 0.5);
    const ring = q.id > 0.88 ? smooth(0.1, 0.18, q.f1) * (1 - smooth(0.22, 0.3, q.f1)) : 0;
    rr = mix(rr, 246, ring * 0.4);
    gg = mix(gg, 246, ring * 0.4);
    bb = mix(bb, 238, ring * 0.4);
    out[0] = rr;
    out[1] = gg;
    out[2] = bb;
  });
  return { c, field };
}

// A soft round glow, white, for the lamps' halos.
export function haloCanvas() {
  const c = makeCanvas(64);
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.45)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return c;
}

// What polished silver shows of the wood round it: pale gold light above,
// silver trunks and gold leaves about the horizon, dark green below.
export function skyCanvas() {
  const c = makeCanvas(256, 128);
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#f6f6f0');
  g.addColorStop(0.22, '#e8dca8');
  g.addColorStop(0.4, '#a89858');
  g.addColorStop(0.5, '#5a6048');
  g.addColorStop(0.62, '#2e3426');
  g.addColorStop(1, '#14160f');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 128);
  const r = rng(5);
  // silver trunks round the horizon, gold leaves above
  for (let i = 0; i < 16; i++) {
    x.fillStyle = `rgba(214,220,224,${0.35 + r() * 0.35})`;
    x.fillRect(r() * 256, 38 + r() * 12, 2 + r() * 5, 60);
  }
  for (let i = 0; i < 22; i++) {
    x.fillStyle = `rgba(255,222,120,${0.2 + r() * 0.25})`;
    x.beginPath();
    x.arc(r() * 256, 12 + r() * 34, 5 + r() * 12, 0, TAU);
    x.fill();
  }
  return c;
}

// The Shire burning, as the Mirror shows it to Frodo, painted simply: a
// sky of black smoke lit orange from beneath, the Hill with its round
// doors aflame, the mill burning by the Water, and along the ridge in front
// a line of hobbits in chains, black against the fire, driven by an orc
// with a whip.
export function shireVisionCanvas(S = 512) {
  const c = makeCanvas(S);
  const x = c.getContext('2d');
  const r = rng(41);
  let g = x.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, '#0e0a08');
  g.addColorStop(0.3, '#2a160e');
  g.addColorStop(0.5, '#8a3416');
  g.addColorStop(0.6, '#d8702a');
  g.addColorStop(0.68, '#5a2410');
  g.addColorStop(1, '#100a06');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  // billows of smoke, some lit from beneath
  for (let i = 0; i < 90; i++) {
    const px = r() * S;
    const py = S * (0.04 + r() * 0.46);
    const rad = S * (0.04 + r() * 0.11);
    const lit = r() < 0.3 && py > S * 0.25;
    const rg = x.createRadialGradient(px, py, 0, px, py, rad);
    rg.addColorStop(0, lit ? 'rgba(140,60,24,0.55)' : 'rgba(18,14,12,0.62)');
    rg.addColorStop(1, 'rgba(18,12,10,0)');
    x.fillStyle = rg;
    x.beginPath();
    x.arc(px, py, rad, 0, TAU);
    x.fill();
  }
  const flame = (px, py, h, w, col) => {
    x.fillStyle = col;
    x.beginPath();
    x.moveTo(px - w, py);
    x.bezierCurveTo(px - w, py - h * 0.45, px - w * 0.15, py - h * 0.55, px + (r() - 0.5) * w * 0.6, py - h);
    x.bezierCurveTo(px + w * 0.15, py - h * 0.55, px + w, py - h * 0.45, px + w, py);
    x.closePath();
    x.fill();
  };
  const fire = (px, py, s) => {
    x.save();
    x.globalCompositeOperation = 'lighter';
    const rg = x.createRadialGradient(px, py - s * 0.6, 0, px, py - s * 0.6, s * 2.4);
    rg.addColorStop(0, 'rgba(255,140,40,0.55)');
    rg.addColorStop(1, 'rgba(255,90,20,0)');
    x.fillStyle = rg;
    x.fillRect(px - s * 3, py - s * 3.2, s * 6, s * 6);
    x.restore();
    for (let k = 0; k < 4; k++) flame(px + (r() - 0.5) * s * 0.9, py, s * (1.2 + r() * 1.2), s * (0.35 + r() * 0.25), '#d8461a');
    for (let k = 0; k < 3; k++) flame(px + (r() - 0.5) * s * 0.6, py, s * (0.8 + r() * 0.8), s * (0.22 + r() * 0.15), '#f89a2c');
    for (let k = 0; k < 2; k++) flame(px + (r() - 0.5) * s * 0.4, py, s * (0.5 + r() * 0.5), s * 0.13, '#ffe28a');
  };
  // the far hills, then the Hill
  x.fillStyle = '#24160e';
  x.beginPath();
  x.moveTo(0, S * 0.6);
  for (let px = 0; px <= S; px += 16) x.lineTo(px, S * (0.58 + Math.sin(px * 0.013 + 1) * 0.03));
  x.lineTo(S, S);
  x.lineTo(0, S);
  x.fill();
  x.fillStyle = '#16100a';
  x.beginPath();
  x.moveTo(0, S * 0.72);
  x.quadraticCurveTo(S * 0.3, S * 0.5, S * 0.55, S * 0.6);
  x.quadraticCurveTo(S * 0.8, S * 0.68, S, S * 0.66);
  x.lineTo(S, S);
  x.lineTo(0, S);
  x.fill();
  // round doors and windows in the Hill, burning
  for (const [px, py, rr] of [[0.2, 0.66, 0.03], [0.33, 0.6, 0.035], [0.47, 0.6, 0.028], [0.62, 0.65, 0.03], [0.4, 0.66, 0.018], [0.26, 0.64, 0.016]]) {
    const rg = x.createRadialGradient(px * S, py * S, 0, px * S, py * S, rr * S);
    rg.addColorStop(0, '#ffe08a');
    rg.addColorStop(0.6, '#f07a20');
    rg.addColorStop(1, '#6a2008');
    x.fillStyle = rg;
    x.beginPath();
    x.arc(px * S, py * S, rr * S, 0, TAU);
    x.fill();
    fire(px * S, (py - rr * 0.8) * S, rr * S * 1.4);
  }
  // the mill by the Water, its wheel black against the flames
  x.fillStyle = '#0c0806';
  x.fillRect(S * 0.74, S * 0.5, S * 0.12, S * 0.14);
  x.beginPath();
  x.moveTo(S * 0.72, S * 0.5);
  x.lineTo(S * 0.8, S * 0.42);
  x.lineTo(S * 0.88, S * 0.5);
  x.fill();
  x.lineWidth = S * 0.008;
  x.strokeStyle = '#0c0806';
  x.beginPath();
  x.arc(S * 0.72, S * 0.6, S * 0.05, 0, TAU);
  x.stroke();
  fire(S * 0.8, S * 0.46, S * 0.06);
  fire(S * 0.86, S * 0.52, S * 0.04);
  // a field burning behind the ridge in front, so what stands on it is
  // black against the fire
  x.save();
  x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const px = S * (0.05 + i * 0.11 + r() * 0.04);
    const py = S * (0.73 + r() * 0.03);
    const rg = x.createRadialGradient(px, py, 0, px, py, S * 0.16);
    rg.addColorStop(0, 'rgba(255,150,50,0.75)');
    rg.addColorStop(0.5, 'rgba(220,80,20,0.35)');
    rg.addColorStop(1, 'rgba(160,40,10,0)');
    x.fillStyle = rg;
    x.fillRect(px - S * 0.16, py - S * 0.16, S * 0.32, S * 0.32);
  }
  x.restore();
  for (let i = 0; i < 10; i++) {
    const px = S * (0.04 + i * 0.1 + r() * 0.03);
    for (let k = 0; k < 3; k++) flame(px + (r() - 0.5) * S * 0.04, S * 0.79, S * (0.03 + r() * 0.04), S * (0.012 + r() * 0.01), k ? '#f8a030' : '#d8461a');
  }
  const ridge = (px) => {
    const t = px / S;
    return S * ((1 - t) * (1 - t) * 0.82 + 2 * (1 - t) * t * 0.77 + t * t * 0.81);
  };
  x.fillStyle = '#070403';
  x.beginPath();
  x.moveTo(0, ridge(0));
  for (let px = 0; px <= S; px += 8) x.lineTo(px, ridge(px));
  x.lineTo(S, S);
  x.lineTo(0, S);
  x.fill();
  const hands = [];
  for (let i = 0; i < 5; i++) {
    const px = S * (0.14 + i * 0.12);
    const py = ridge(px) + 1;
    const h = S * 0.11;
    const lean = 0.15 + r() * 0.1;
    x.fillStyle = '#060403';
    // a hunched body, a round head, curly hair, bare feet
    x.beginPath();
    x.ellipse(px, py - h * 0.42, h * 0.2, h * 0.32, lean, 0, TAU);
    x.fill();
    x.beginPath();
    x.arc(px + h * 0.12, py - h * 0.82, h * 0.14, 0, TAU);
    x.fill();
    for (let k = 0; k < 6; k++) {
      x.beginPath();
      x.arc(px + h * (0.02 + r() * 0.2), py - h * (0.88 + r() * 0.1), h * 0.06, 0, TAU);
      x.fill();
    }
    x.fillRect(px - h * 0.12, py - h * 0.14, h * 0.08, h * 0.14);
    x.fillRect(px + h * 0.04, py - h * 0.14, h * 0.08, h * 0.14);
    hands.push([px + h * 0.14, py - h * 0.42]);
  }
  // the chain from wrist to wrist, its links catching the firelight
  x.strokeStyle = '#d07a3a';
  x.lineWidth = 2;
  for (let i = 0; i < hands.length - 1; i++) {
    const [ax, ay] = hands[i];
    const [bx, by] = hands[i + 1];
    for (let k = 0; k <= 9; k++) {
      const t = k / 9;
      const lx = mix(ax, bx, t);
      const ly = mix(ay, by, t) + Math.sin(t * Math.PI) * S * 0.018;
      x.beginPath();
      x.ellipse(lx, ly, 3, 1.8, k % 2 ? 0.4 : -0.4, 0, TAU);
      x.stroke();
    }
  }
  // the orc driving them, the whip raised
  const ox = S * 0.82;
  const oy = ridge(ox) + 1;
  const oh = S * 0.17;
  x.fillStyle = '#050302';
  x.beginPath();
  x.ellipse(ox, oy - oh * 0.48, oh * 0.18, oh * 0.32, -0.25, 0, TAU);
  x.fill();
  x.beginPath();
  x.arc(ox - oh * 0.08, oy - oh * 0.86, oh * 0.11, 0, TAU);
  x.fill();
  for (let k = 0; k < 4; k++) {
    x.beginPath();
    x.moveTo(ox - oh * 0.16 + k * oh * 0.08, oy - oh * 0.92);
    x.lineTo(ox - oh * 0.12 + k * oh * 0.08, oy - oh * 1.06);
    x.lineTo(ox - oh * 0.08 + k * oh * 0.08, oy - oh * 0.9);
    x.fill();
  }
  x.fillRect(ox - oh * 0.12, oy - oh * 0.2, oh * 0.09, oh * 0.2);
  x.fillRect(ox + oh * 0.04, oy - oh * 0.2, oh * 0.09, oh * 0.2);
  x.lineWidth = 4;
  x.strokeStyle = '#050302';
  x.beginPath();
  x.moveTo(ox + oh * 0.1, oy - oh * 0.62);
  x.lineTo(ox + oh * 0.28, oy - oh * 1.0);
  x.stroke();
  x.lineWidth = 1.8;
  x.beginPath();
  x.moveTo(ox + oh * 0.28, oy - oh * 1.0);
  x.bezierCurveTo(ox - oh * 0.2, oy - oh * 1.5, ox - oh * 0.9, oy - oh * 1.0, ox - oh * 1.3, oy - oh * 0.75);
  x.stroke();
  // embers in the air
  x.save();
  x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 140; i++) {
    x.fillStyle = `rgba(255,${120 + Math.floor(r() * 100)},40,${0.3 + r() * 0.5})`;
    x.fillRect(r() * S, S * (0.15 + r() * 0.6), 1.5, 1.5);
  }
  x.restore();
  // darker round the edge
  g = x.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.75)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  return c;
}
