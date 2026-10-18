// Middle-earth painted as an old map, for the backdrop behind the page: the
// same coasts, rivers, forests, ranges and road as the drawn map
// (./mapData.js), inked on aged parchment. And the same sheet as heights,
// so the mountains stand up a little when a light crosses them.

import { fbm, makeCanvas, makeNoise, paintPixels } from '../../lib/paint';
import { FORESTS, LAKES, MARSHES, PLACES, RANGES, REGIONS, RIVERS, ROADS, SEAS, SHEET, hatch, nameAt, peaks, stopNameAt, trees } from './mapData';
import { placeAt } from './sheet';
import { STOPS } from './road';

const INK = '#4a3520';
const serif = (px, weight = 600) => `${weight} ${px}px Cinzel, Georgia, serif`;

// Cinzel is the page's own font; a canvas can only write in it once it is in.
export async function mapFont() {
  try {
    await Promise.race([document.fonts.load(serif(16)), new Promise((done) => setTimeout(done, 1200))]);
  } catch {
    /* Georgia will do */
  }
}

export function paintMap(width = 2048) {
  const k = width / SHEET.w;
  const c = makeCanvas(width, Math.round(SHEET.h * k));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#eadbb2';
  ctx.fillRect(0, 0, c.width, c.height);

  // the sheet's age: mottled, a little foxed, darker towards its edges
  const n = makeNoise(11);
  const mottle = paintPixels(makeCanvas(256, 180), (u, v, out) => {
    const a = fbm(n, u * 6, v * 4.2, { octaves: 5 });
    const spot = fbm(n, u * 22 + 5, v * 16, { octaves: 2 });
    const s = 168 + a * 92 - Math.max(0, spot - 0.66) * 160;
    out[0] = s;
    out[1] = s * 0.94;
    out[2] = s * 0.8;
  });
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(mottle, 0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'source-over';

  ctx.save();
  ctx.scale(k, k);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // the sea, with the coast inked and a few lines of water
  for (const d of SEAS) {
    const sea = new Path2D(d);
    ctx.fillStyle = 'rgba(88, 118, 124, 0.3)';
    ctx.fill(sea);
    ctx.save();
    ctx.clip(sea);
    ctx.strokeStyle = 'rgba(60, 86, 96, 0.35)';
    ctx.lineWidth = 0.6;
    for (let y = 8; y < SHEET.h; y += 9) {
      ctx.beginPath();
      for (let x = (y * 7) % 23; x < SHEET.w; x += 23) {
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 4, y - 2, x + 9, y);
      }
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(74, 53, 32, 0.75)';
    ctx.lineWidth = 1.1;
    ctx.stroke(sea);
  }

  // the lakes, Evendim to Núrnen, as still water with a shore
  for (const { at, rx, ry } of LAKES) {
    ctx.beginPath();
    ctx.ellipse(at[0], at[1], Math.max(1.5, rx), Math.max(1.2, ry), 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(88, 118, 124, 0.38)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(74, 53, 32, 0.6)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  // the marshes, hatched as old maps hatch them: short level strokes of ink
  ctx.strokeStyle = 'rgba(74, 53, 32, 0.35)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (const m of MARSHES) {
    for (const [x0, y, x1] of hatch(m)) {
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
    }
  }
  ctx.stroke();

  for (const [d, thin] of RIVERS) {
    ctx.strokeStyle = 'rgba(62, 92, 112, 0.8)';
    ctx.lineWidth = thin ? 1.2 : 2;
    ctx.stroke(new Path2D(d));
  }

  // the other roads, faint and dotted under the Ring's
  ctx.strokeStyle = 'rgba(74, 53, 32, 0.25)';
  ctx.lineWidth = 1;
  ctx.setLineDash([1.5, 3]);
  for (const d of ROADS) ctx.stroke(new Path2D(d));
  ctx.setLineDash([]);

  // the woods, a tree at a time
  for (const [shape, seed, count, kind] of FORESTS) {
    const fill = kind === 'gold' ? 'rgba(160, 128, 42, 0.55)' : kind === 'dark' ? 'rgba(44, 62, 40, 0.62)' : 'rgba(78, 104, 56, 0.55)';
    for (const [x, y, r] of trees(shape, seed, count)) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(52, 44, 26, 0.5)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(x, y, r, Math.PI * 0.9, Math.PI * 2.1);
      ctx.stroke();
    }
  }

  // the mountains: each peak inked, its eastern side in shadow
  for (const [line, dark] of RANGES) {
    for (const [x, y, s] of peaks(line, 11, 12)) {
      ctx.fillStyle = dark ? 'rgba(58, 34, 26, 0.6)' : 'rgba(104, 84, 58, 0.45)';
      ctx.beginPath();
      ctx.moveTo(x, y - s / 2);
      ctx.lineTo(x + s / 2, y + s / 3);
      ctx.lineTo(x + s * 0.08, y + s / 3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = dark ? '#3a2018' : INK;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(x - s / 2, y + s / 3);
      ctx.lineTo(x, y - s / 2);
      ctx.lineTo(x + s / 2, y + s / 3);
      ctx.stroke();
    }
  }
  // Mount Doom, burning, and the dark tower
  const [dx, dy] = placeAt('mount-doom');
  const [bx, by] = placeAt('barad-dur');
  ctx.fillStyle = '#5a2a1a';
  ctx.beginPath();
  ctx.moveTo(dx - 16, dy + 14);
  ctx.lineTo(dx, dy - 16);
  ctx.lineTo(dx + 16, dy + 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c2410c';
  ctx.beginPath();
  ctx.arc(dx, dy - 17, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a1a14';
  ctx.fillRect(bx - 4, by - 22, 8, 26);
  ctx.fillStyle = '#c2410c';
  ctx.beginPath();
  ctx.ellipse(bx, by - 27, 5, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // the names
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(96, 66, 32, 0.5)';
  ctx.font = serif(15);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '5px';
  for (const [t, x, y] of REGIONS) ctx.fillText(t, x, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.font = serif(8.5);
  for (const [t, x, y, side] of PLACES) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
    const [tx, ty, align] = nameAt(x, y, side);
    ctx.textAlign = align;
    ctx.fillText(t, tx, ty);
  }

  // the road the Ring took, in red ink
  ctx.strokeStyle = '#8a2f1a';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  STOPS.forEach((s, i) => (i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y)));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = serif(9);
  for (const s of STOPS) {
    ctx.fillStyle = '#8a2f1a';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a2414';
    const [tx, ty, align] = stopNameAt(s);
    ctx.textAlign = align;
    ctx.fillText(s.name, tx, ty);
  }
  ctx.textAlign = 'left';

  // a compass rose, and whose map it is
  ctx.save();
  ctx.translate(742, 78);
  ctx.strokeStyle = INK;
  ctx.fillStyle = 'rgba(74, 53, 32, 0.7)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (const [a, r] of [
    [0, 26],
    [Math.PI / 2, 20],
    [Math.PI, 20],
    [-Math.PI / 2, 20],
  ]) {
    ctx.moveTo(Math.sin(a) * r, -Math.cos(a) * r);
    ctx.lineTo(Math.sin(a + 1.57) * 4, -Math.cos(a + 1.57) * 4);
    ctx.lineTo(Math.sin(a - 1.57) * 4, -Math.cos(a - 1.57) * 4);
    ctx.closePath();
  }
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.font = serif(10);
  ctx.fillText('N', 0, -30);
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(74, 53, 32, 0.6)';
  ctx.font = serif(11);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
  ctx.fillText('MIDDLE-EARTH · THE THIRD AGE', 168, 540);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.restore();

  // worn at the edges (the torn edge, ./mapRoom.js, is its frame: a ruled
  // one would fall in the tear and survive only in pieces)
  const edge = ctx.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.42, c.width / 2, c.height / 2, c.width * 0.62);
  edge.addColorStop(0, 'rgba(120, 84, 40, 0)');
  edge.addColorStop(1, 'rgba(96, 62, 26, 0.6)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

// The sheet as heights (white is high): the ranges as soft ridges, Mount
// Doom, and the grain of the paper.
export function paintRelief(width = 1024) {
  const k = width / SHEET.w;
  const c = makeCanvas(width, Math.round(SHEET.h * k));
  const ctx = c.getContext('2d');
  const n = makeNoise(3);
  const grain = paintPixels(makeCanvas(256, 180), (u, v, out) => {
    const g = 26 + fbm(n, u * 40, v * 28, { octaves: 3 }) * 34;
    out[0] = out[1] = out[2] = g;
  });
  ctx.drawImage(grain, 0, 0, c.width, c.height);
  ctx.scale(k, k);
  const hill = (x, y, r, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255, 255, 255, ${a})`);
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  for (const [line] of RANGES) for (const [x, y] of peaks(line, 11, 12)) hill(x, y, 11, 0.85);
  const [dx, dy] = placeAt('mount-doom');
  hill(dx, dy - 2, 20, 1);
  return c;
}

// The sheet’s torn edge, as an alpha mask the size of the sheet (white is
// paper, black is gone): the tear wanders 6 to 14 sheet units in from the
// border, and foxing spots near it eat into it, so the paper looks worn
// through where it was weakest. The spots are grey, not black: under the
// material’s alphaTest of 0.5 they bite only where the tear already thins
// the paper, never as holes in the middle of the map.
export function paintEdge(width = 1024) {
  const k = width / SHEET.w;
  const c = makeCanvas(width, Math.round(SHEET.h * k));
  const tear = makeNoise(29);
  const fox = makeNoise(41);
  return paintPixels(c, (u, v, out) => {
    const sx = u * SHEET.w;
    const sy = v * SHEET.h;
    const d = Math.min(sx, sy, SHEET.w - sx, SHEET.h - sy);
    // the middle of the sheet is whole, and painting it noise-free keeps this quick
    if (d > 40) {
      out[0] = out[1] = out[2] = 255;
      return;
    }
    // slow wander and fine jags, kept within the 6 to 14 units
    const wander = Math.min(1, Math.max(0, (fbm(tear, sx * 0.04, sy * 0.04, { octaves: 3 }) - 0.3) / 0.4));
    const jag = tear(sx * 0.7 + 17, sy * 0.7) - 0.5;
    const e = Math.min(14, Math.max(6, 6 + wander * 8 + jag * 1.6));
    let a = Math.min(1, Math.max(0, (d - e) / 1.5 + 0.5));
    const spot = Math.max(0, fbm(fox, sx * 0.11 + 3, sy * 0.11, { octaves: 2 }) - 0.6) * 4;
    a -= Math.min(0.45, spot) * Math.max(0, 1 - (d - e) / 22);
    out[0] = out[1] = out[2] = Math.round(Math.max(0, a) * 255);
  });
}
