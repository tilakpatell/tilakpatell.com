// The village’s painted words and windows (in a browser): every hanging
// sign and every fascia in one atlas each, lettered here in the site’s own
// hand (Cinzel in gilt on the shop’s own paint, a lined border, the board a
// little weathered), and the shop windows’ insides, one cell a shop, the
// goods on their shelves in the lamplight: jars of sweets, quills and ink,
// hats on stands, books, teacups, brooms, a pub’s bottles.
//
//   CELLS: the order of the atlases’ cells (the buildings’ ids, then 'arch')
//   cellOf(id) → { col, row, u0, v0, u1, v1 } in a 4 × 4 atlas
//   signAtlas(entries) → canvas   entries: [{ id, sign, paint }]
//   fasciaAtlas(entries) → canvas (sixteen rows, one a shop)   fasciaRow(id) → { v0, v1 }
//   goodsAtlas(ids) → canvas

import { makeCanvas } from '../../../../lib/paint';
import { BUILDINGS } from '../../rules/hogsmeade';

export const CELLS = [...BUILDINGS.map((b) => b.id), 'shack', 'arch'];

export function cellOf(id) {
  const i = Math.max(0, CELLS.indexOf(id));
  const col = i % 4;
  const row = Math.floor(i / 4);
  // (v up from the canvas’s foot, as a texture reads it)
  return { col, row, u0: col / 4, u1: (col + 1) / 4, v0: 1 - (row + 1) / 4, v1: 1 - row / 4 };
}

export const fasciaRow = (id) => {
  const i = Math.max(0, CELLS.indexOf(id));
  return { v0: 1 - (i + 1) / 16, v1: 1 - i / 16 };
};

const GILT = '#e9c66c';
const GILT_DARK = '#8a6a2a';

function speckle(g, x, y, w, h, seed, k = 0.12) {
  let s = seed * 9301 + 49297;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < (w * h) / 60; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${k * r()})` : `rgba(255,240,210,${k * 0.6 * r()})`;
    g.fillRect(x + r() * w, y + r() * h, 1 + r() * 3, 1 + r() * 2);
  }
}

// words fitted to a box: one line if it fits at a good size, else two
function letter(g, text, cx, cy, w, h, { size = 64, font = 'Cinzel, Georgia, serif', weight = 700 } = {}) {
  const words = String(text).split(' ');
  let px = size;
  const fits = (lines, p) => {
    g.font = `${weight} ${p}px ${font}`;
    return lines.every((l) => g.measureText(l).width <= w) && lines.length * p * 1.08 <= h;
  };
  let lines = [text];
  while (px > 18 && !fits(lines, px)) {
    if (lines.length === 1 && words.length > 1 && px < size * 0.8) {
      // (split at the middle word)
      const mid = Math.ceil(words.length / 2);
      lines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
      px = size;
      continue;
    }
    px -= 2;
  }
  g.font = `${weight} ${px}px ${font}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const lh = px * 1.08;
  lines.forEach((l, i) => {
    const y = cy + (i - (lines.length - 1) / 2) * lh;
    // (gilt over a dark edge, so it reads on any paint)
    g.fillStyle = 'rgba(20,12,4,0.55)';
    g.fillText(l, cx + 2, y + 3);
    g.fillStyle = GILT;
    g.fillText(l, cx, y);
  });
}

export function signAtlas(entries) {
  const W = 512;
  const H = 256;
  const c = makeCanvas(W * 4, H * 4);
  const g = c.getContext('2d');
  g.fillStyle = '#2a1d12';
  g.fillRect(0, 0, c.width, c.height);
  for (const e of entries) {
    const { col, row } = cellOf(e.id);
    const x = col * W;
    const y = row * H;
    // the board: its paint, a raised moulding, a gilt line inside it
    g.fillStyle = '#20170e';
    g.fillRect(x, y, W, H);
    g.fillStyle = e.paint;
    g.fillRect(x + 10, y + 10, W - 20, H - 20);
    g.strokeStyle = 'rgba(255,255,255,0.12)';
    g.lineWidth = 4;
    g.strokeRect(x + 14, y + 14, W - 28, H - 28);
    g.strokeStyle = GILT_DARK;
    g.lineWidth = 3;
    g.strokeRect(x + 28, y + 28, W - 56, H - 56);
    // (little gilt corners)
    g.fillStyle = GILT;
    for (const [cx, cy] of [[x + 28, y + 28], [x + W - 28, y + 28], [x + 28, y + H - 28], [x + W - 28, y + H - 28]]) {
      g.beginPath();
      g.arc(cx, cy, 7, 0, Math.PI * 2);
      g.fill();
    }
    letter(g, e.sign, x + W / 2, y + H / 2 + 4, W - 90, H - 80, { size: 72 });
    speckle(g, x + 10, y + 10, W - 20, H - 20, e.id.length * 13 + col + row * 4, 0.16);
  }
  return c;
}

export function fasciaAtlas(entries) {
  const W = 1024;
  const H = 64;
  const c = makeCanvas(W, H * 16);
  const g = c.getContext('2d');
  g.fillStyle = '#20170e';
  g.fillRect(0, 0, W, c.height);
  for (const e of entries) {
    const i = Math.max(0, CELLS.indexOf(e.id));
    const y = i * H;
    g.fillStyle = e.paint;
    g.fillRect(0, y + 4, W, H - 8);
    g.fillStyle = 'rgba(255,255,255,0.1)';
    g.fillRect(0, y + 4, W, 3);
    letter(g, e.sign, W / 2, y + H / 2 + 2, W - 60, H - 14, { size: 46 });
    speckle(g, 0, y + 4, W, H - 8, i * 7 + 3, 0.14);
  }
  return c;
}

// ── the windows’ insides ──

const pick = (seed) => {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
};

function shelves(g, x, y, S, n = 3, wood = '#3a2414') {
  for (let i = 1; i <= n; i++) {
    g.fillStyle = wood;
    g.fillRect(x + 6, y + (S * i) / (n + 1) + 10, S - 12, 7);
  }
}

const GOODS = {
  honeydukes: (g, x, y, S, r) => {
    shelves(g, x, y, S, 3);
    // jars of sweets on the shelves, glass catching the light, the sweets heaped in them
    const sweets = ['#d84a86', '#6ab84e', '#e0b83a', '#9a5ad8', '#e07a3a', '#4aa8d8', '#e8dcc8'];
    for (let s = 0; s < 3; s++)
      for (let i = 0; i < 7; i++) {
        const jw = 18 + r() * 6;
        const jh = 22 + r() * 12;
        const jx = x + 12 + i * ((S - 24) / 7);
        const jy = y + (S * (s + 1)) / 4 + 10;
        g.fillStyle = 'rgba(40,24,12,0.5)';
        g.fillRect(jx + 2, jy - jh + 2, jw, jh);
        g.fillStyle = sweets[Math.floor(r() * sweets.length)];
        g.beginPath();
        g.ellipse(jx + jw / 2, jy - jh * 0.38, jw / 2 - 2, jh * 0.38, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(255,240,220,0.55)';
        g.lineWidth = 1.5;
        g.strokeRect(jx, jy - jh, jw, jh);
        g.fillStyle = 'rgba(255,250,240,0.5)';
        g.fillRect(jx + 3, jy - jh + 3, 2, jh - 6);
        g.fillStyle = '#b08a48';
        g.fillRect(jx - 1, jy - jh - 4, jw + 2, 4);
      }
    // (and boxes of Chocolate Frogs stacked at the front)
    for (let i = 0; i < 5; i++) {
      g.fillStyle = i % 2 ? '#5a3a8a' : '#7a4a2a';
      g.fillRect(x + 20 + i * 44, y + S - 34, 36, 24);
      g.fillStyle = '#e8c86a';
      g.fillRect(x + 24 + i * 44, y + S - 28, 28, 4);
    }
  },
  post: (g, x, y, S, r) => {
    shelves(g, x, y, S, 2);
    for (let i = 0; i < 5; i++) {
      const cx = x + 20 + i * 46;
      g.strokeStyle = '#c8a050';
      g.lineWidth = 2;
      for (let k = 0; k < 6; k++) g.strokeRect(cx + k * 6, y + S / 3 - 40, 1, 40);
      g.fillStyle = '#d8d0c0';
      g.beginPath();
      g.arc(cx + 15, y + S / 3 - 18, 9, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 6; i++) {
      g.fillStyle = r() > 0.5 ? '#a07848' : '#8a6438';
      g.fillRect(x + 14 + i * 38, y + (S * 2) / 3 - 30, 30, 30);
      g.fillStyle = '#e8dcc0';
      g.fillRect(x + 28 + i * 38, y + (S * 2) / 3 - 30, 2, 30);
    }
  },
  scrivenshaft: (g, x, y, S, r) => {
    shelves(g, x, y, S, 2);
    for (let i = 0; i < 9; i++) {
      const cx = x + 18 + i * 26;
      g.fillStyle = '#1a1a2a';
      g.fillRect(cx, y + S / 3 - 18, 14, 18);
      g.strokeStyle = ['#f4f0e0', '#e04040', '#4080e0', '#40c060'][i % 4];
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(cx + 7, y + S / 3 - 18);
      g.quadraticCurveTo(cx + 18 + r() * 6, y + S / 3 - 50, cx + 4, y + S / 3 - 70);
      g.stroke();
    }
    for (let i = 0; i < 8; i++) {
      g.fillStyle = '#e8dcc0';
      g.fillRect(x + 16 + i * 29, y + (S * 2) / 3 - 26, 24, 26);
    }
  },
  gladrags: (g, x, y, S, r) => {
    for (let i = 0; i < 4; i++) {
      const cx = x + 32 + i * 60;
      g.fillStyle = ['#5a2a6e', '#2a4a7a', '#7a2a2a', '#2a6a3a'][i];
      g.beginPath();
      g.moveTo(cx - 22, y + S * 0.9);
      g.lineTo(cx - 14, y + S * 0.45);
      g.lineTo(cx + 14, y + S * 0.45);
      g.lineTo(cx + 22, y + S * 0.9);
      g.fill();
      g.beginPath();
      g.moveTo(cx - 20, y + S * 0.38);
      g.lineTo(cx + 6 * (r() - 0.5), y + S * 0.12);
      g.lineTo(cx + 20, y + S * 0.38);
      g.fill();
      g.fillRect(cx - 26, y + S * 0.37, 52, 5);
    }
  },
  zonkos: (g, x, y, S, r) => {
    shelves(g, x, y, S, 3);
    const box = ['#ff3c3c', '#ffd23c', '#3cff7a', '#3ca0ff', '#ff3cf0'];
    for (let s = 0; s < 3; s++)
      for (let i = 0; i < 5; i++) {
        g.fillStyle = box[Math.floor(r() * box.length)];
        const bx = x + 16 + i * 46;
        const by = y + (S * (s + 1)) / 4 - 22;
        g.fillRect(bx, by, 34, 30);
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(bx + 17, by + 15, 6, 0, Math.PI * 2);
        g.fill();
      }
  },
  dervish: (g, x, y, S, r) => {
    shelves(g, x, y, S, 2, '#2a1a10');
    g.strokeStyle = '#d8a848';
    g.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const cx = x + 40 + i * 58;
      const cy = y + S / 3 - 34;
      g.beginPath();
      g.arc(cx, cy, 22, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.ellipse(cx, cy, 28, 9, r(), 0, Math.PI * 2);
      g.stroke();
    }
    for (let i = 0; i < 5; i++) {
      g.fillStyle = '#b08838';
      g.fillRect(x + 20 + i * 46, y + (S * 2) / 3 - 10, 36, 8);
    }
  },
  tomes: (g, x, y, S, r) => {
    shelves(g, x, y, S, 3);
    for (let s = 0; s < 3; s++) {
      let bx = x + 10;
      while (bx < x + S - 20) {
        const w = 8 + r() * 10;
        const h = 28 + r() * 14;
        g.fillStyle = ['#6a1e1e', '#1e3a6a', '#2a5a2a', '#6a4a1e', '#3a1e5a', '#7a6a4a'][Math.floor(r() * 6)];
        g.fillRect(bx, y + (S * (s + 1)) / 4 + 10 - h, w, h);
        bx += w + 1;
      }
    }
  },
  puddifoot: (g, x, y, S, r) => {
    g.fillStyle = 'rgba(255,200,220,0.5)';
    g.fillRect(x, y, S, S * 0.22);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = '#ffd8e8';
      g.beginPath();
      g.arc(x + 16 + i * 31, y + S * 0.22, 14, 0, Math.PI);
      g.fill();
    }
    g.fillStyle = '#f4e8f0';
    for (let i = 0; i < 4; i++) {
      g.fillRect(x + 20 + i * 58, y + S * 0.62, 34, 22);
      g.fillStyle = '#e88ab0';
      g.fillRect(x + 20 + i * 58, y + S * 0.62, 34, 5);
      g.fillStyle = '#f4e8f0';
    }
    g.fillStyle = '#ff6a9a';
    for (let i = 0; i < 3; i++) {
      const hx = x + 50 + i * 70 + r() * 10;
      const hy = y + S * 0.4;
      g.beginPath();
      g.arc(hx - 6, hy, 7, 0, Math.PI * 2);
      g.arc(hx + 6, hy, 7, 0, Math.PI * 2);
      g.moveTo(hx - 13, hy + 2);
      g.lineTo(hx, hy + 16);
      g.lineTo(hx + 13, hy + 2);
      g.fill();
    }
  },
  spintwitches: (g, x, y, S) => {
    g.strokeStyle = '#8a5a2a';
    g.lineWidth = 6;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo(x + 30 + i * 55, y + S * 0.15);
      g.lineTo(x + 50 + i * 55, y + S * 0.85);
      g.stroke();
      g.fillStyle = '#b89048';
      g.beginPath();
      g.moveTo(x + 44 + i * 55, y + S * 0.7);
      g.lineTo(x + 34 + i * 55, y + S * 0.92);
      g.lineTo(x + 66 + i * 55, y + S * 0.92);
      g.closePath();
      g.fill();
    }
    g.fillStyle = '#ffd84a';
    g.beginPath();
    g.arc(x + S * 0.5, y + S * 0.3, 9, 0, Math.PI * 2);
    g.fill();
  },
  pub: (g, x, y, S, r) => {
    shelves(g, x, y, S, 2, '#2a1808');
    for (let s = 0; s < 2; s++)
      for (let i = 0; i < 10; i++) {
        g.fillStyle = ['#2a5a2a', '#6a3a1a', '#c8a050', '#3a2a5a'][Math.floor(r() * 4)];
        const bx = x + 12 + i * 23;
        const by = y + (S * (s + 1)) / 3 + 10;
        g.fillRect(bx, by - 30, 12, 30);
        g.fillRect(bx + 4, by - 40, 4, 10);
      }
    g.fillStyle = 'rgba(40,20,8,0.8)';
    g.fillRect(x, y + S * 0.8, S, S * 0.2);
  },
  plain: (g, x, y, S) => {
    g.fillStyle = 'rgba(120,40,30,0.75)';
    g.fillRect(x, y, S * 0.3, S);
    g.fillRect(x + S * 0.7, y, S * 0.3, S);
    g.fillStyle = '#ffd890';
    g.beginPath();
    g.arc(x + S / 2, y + S * 0.55, 14, 0, Math.PI * 2);
    g.fill();
  },
};
const KIND = { honeydukes: 'honeydukes', post: 'post', scrivenshaft: 'scrivenshaft', gladrags: 'gladrags', zonkos: 'zonkos', dervish: 'dervish', tomes: 'tomes', puddifoot: 'puddifoot', spintwitches: 'spintwitches', broomsticks: 'pub', hogshead: 'pub', founders: 'plain' };

export function goodsAtlas() {
  const S = 256;
  const c = makeCanvas(S * 4, S * 4);
  const g = c.getContext('2d');
  CELLS.forEach((id, i) => {
    const x = (i % 4) * S;
    const y = Math.floor(i / 4) * S;
    // the room behind the glass: lamplit from above, darker below
    const grad = g.createLinearGradient(0, y, 0, y + S);
    const dim = id === 'hogshead' ? 0.45 : 1;
    grad.addColorStop(0, `rgba(${255 * dim},${200 * dim},${120 * dim},1)`);
    grad.addColorStop(0.55, `rgba(${170 * dim},${100 * dim},${50 * dim},1)`);
    grad.addColorStop(1, `rgba(${60 * dim},${30 * dim},${14 * dim},1)`);
    g.fillStyle = grad;
    g.fillRect(x, y, S, S);
    (GOODS[KIND[id]] ?? GOODS.plain)(g, x, y, S, pick(i * 101 + 7));
    // (the Hog’s Head’s glass hasn’t been cleaned in years)
    if (id === 'hogshead') {
      g.fillStyle = 'rgba(60,54,40,0.55)';
      g.fillRect(x, y, S, S);
    }
  });
  return c;
}
