// The Marauder’s Map’s ink (the design’s §4.8): the castle and the grounds
// drawn on a 2D canvas as the Map draws them, north up, from
// rules/atlas.js, and on them every person in the world as a pair of
// footprints with a name in a banner, moving as they move. No React and no
// three: hud/MaraudersMap.jsx holds the canvases and the clock, this draws.
//
//   INK: the inks   SCALES: { castle, grounds } px a metre
//   drawPaper(ctx, w, h) → the parchment, for a canvas with no paper under it (the disc)
//   drawInk(ctx, view, { reveal, night }) → everything that stands still, in view
//   createTrails() → { lay(people, view, now), prints(id) } the footprints each figure has left
//   drawLife(ctx, view, { people, me, trails, now, night, banners }) → the footprints, the
//     banners, Filch’s lantern and the cat’s look after curfew
//   placeName(x, z) → the name of where a point is, for the disc’s caption

import { AREAS, BRIDGES, CASTLE, COURTYARD, CRAG, GROUNDS, LABELS, PATHS, ROAD, ROOMS, corridors, lakeOutline, project, trees, village } from '../rules/atlas';
import { SIGHT } from '../rules/curfew';
import { SPOTS } from '../rules/paths';

export const INK = {
  ink: '#3a2314',
  soft: 'rgba(58, 35, 20, 0.62)',
  faint: 'rgba(58, 35, 20, 0.26)',
  wash: 'rgba(96, 70, 38, 0.10)',
  water: 'rgba(70, 64, 58, 0.13)',
  ghost: 'rgba(92, 96, 112, 0.5)',
  you: '#8f1d24',
  paper: '#ecdcb6',
  lantern: 'rgba(196, 120, 30, 0.16)',
};
export const SCALES = { castle: 2.6, near: 0.85, grounds: 0.42, disc: 1.15 };

const TAU = Math.PI * 2;
const HAND = (px, weight = 'italic 600') => `${weight} ${px}px Georgia, 'Times New Roman', serif`;
const TITLE = (px) => `700 ${px}px Cinzel, Georgia, serif`;

// what of the Map is in view, with a margin
const inView = (v, x, z, r = 0) => {
  const [px, py] = project(v, x, z);
  const m = r * v.scale + 40;
  return px > -m && py > -m && px < v.w + m && py < v.h + m;
};

// a box of the castle’s plan’s kind (its turn as the plan reads it) as four corners on screen
function corners(v, b) {
  const c = Math.cos(b.turn ?? 0);
  const s = Math.sin(b.turn ?? 0);
  const hw = b.w / 2;
  const hd = b.d / 2;
  return [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ].map(([u, w]) => project(v, b.at[0] + u * c + w * s, b.at[1] - u * s + w * c));
}

function poly(ctx, pts, close = true) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (close) ctx.closePath();
}

function line(ctx, v, pts) {
  ctx.beginPath();
  pts.forEach(([x, z], i) => {
    const [px, py] = project(v, x, z);
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  });
}

// A parchment for a canvas with nothing under it: the cream, a few stains
// and the edges darkened, as old paper goes
export function drawPaper(ctx, w, h) {
  ctx.fillStyle = INK.paper;
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.2, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(255, 250, 232, 0.35)');
  g.addColorStop(1, 'rgba(120, 82, 36, 0.32)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// ── what stands still ──

function drawLake(ctx, v) {
  const pts = lakeOutline().map(([x, z]) => project(v, x, z));
  poly(ctx, pts);
  ctx.fillStyle = INK.water;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // (the water as the Map draws it: rows of little waves)
  ctx.strokeStyle = INK.faint;
  ctx.lineWidth = 0.8;
  const step = Math.max(9, 26 * v.scale);
  const off = (v.cz * v.scale) % step;
  for (let y = -off; y < v.h + step; y += step) {
    ctx.beginPath();
    for (let x = ((y / step) % 2) * 9 - 20; x < v.w + 20; x += 18) {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 3, y - 2.5, x + 6, y);
      ctx.quadraticCurveTo(x + 9, y + 2.5, x + 12, y);
    }
    ctx.stroke();
  }
  ctx.restore();
  poly(ctx, pts);
  ctx.strokeStyle = INK.ink;
  ctx.lineWidth = 1.3;
  ctx.stroke();
}

// the castle’s rock: hachures down its cliffs to the lake on the south and west
function drawCrag(ctx, v) {
  const { at, rx, rz, turn } = CRAG;
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  ctx.strokeStyle = INK.soft;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * TAU;
    const ex = Math.cos(a) * rx;
    const ez = Math.sin(a) * rz;
    // (the cliffs face the lake: the south and the west; the rest falls gently)
    const cliff = ez > -rz * 0.2 || ex < -rx * 0.55;
    if (!cliff) continue;
    const x = at[0] + ex * c + ez * s;
    const z = at[1] - ex * s + ez * c;
    const nx = (Math.cos(a) / rx) * c + (Math.sin(a) / rz) * s;
    const nz = -(Math.cos(a) / rx) * s + (Math.sin(a) / rz) * c;
    const nl = Math.hypot(nx, nz) || 1;
    const len = (i % 2 ? 7 : 11) / Math.max(1, v.scale);
    const [x0, y0] = project(v, x, z);
    const [x1, y1] = project(v, x + (nx / nl) * len, z + (nz / nl) * len);
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
  }
  ctx.stroke();
}

function drawTrees(ctx, v) {
  ctx.strokeStyle = INK.soft;
  ctx.fillStyle = INK.wash;
  ctx.lineWidth = 0.9;
  const k = Math.min(1.6, Math.max(0.7, v.scale * 1.4));
  ctx.beginPath();
  for (const [x, z, size] of trees()) {
    if (!inView(v, x, z, 10)) continue;
    const [px, py] = project(v, x, z);
    const r = 3.4 * size * k;
    // (a pine as the Map draws one: a little crown and a stroke of a trunk)
    ctx.moveTo(px - r, py + r * 0.4);
    ctx.lineTo(px, py - r * 1.3);
    ctx.lineTo(px + r, py + r * 0.4);
    ctx.moveTo(px, py + r * 0.4);
    ctx.lineTo(px, py + r * 1.1);
  }
  ctx.stroke();
}

function drawPaths(ctx, v) {
  ctx.strokeStyle = INK.faint;
  ctx.lineWidth = 1.1;
  ctx.setLineDash([4, 4]);
  for (const p of PATHS) {
    line(ctx, v, p.points);
    ctx.stroke();
  }
  // (the carriages’ road: a double line, its ruts)
  ctx.setLineDash([]);
  ctx.strokeStyle = INK.soft;
  for (const off of [-1.6, 1.6]) {
    ctx.beginPath();
    ROAD.points.forEach(([x, z], i) => {
      const [px, py] = project(v, x, z);
      if (i) ctx.lineTo(px + off, py + off * 0.5);
      else ctx.moveTo(px + off, py + off * 0.5);
    });
    ctx.stroke();
  }
}

function drawCastle(ctx, v, close) {
  // (the courtyard, open to the sky: a broken ring)
  const [cx, cy] = project(v, COURTYARD.at[0], COURTYARD.at[1]);
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = INK.faint;
  ctx.beginPath();
  ctx.arc(cx, cy, COURTYARD.r * v.scale, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const b of BRIDGES) {
    const [ax, ay] = project(v, b.from[0], b.from[1]);
    const [bx, by] = project(v, b.to[0], b.to[1]);
    const l = Math.hypot(bx - ax, by - ay) || 1;
    const nx = (-(by - ay) / l) * Math.max(1.2, (b.width / 2) * v.scale);
    const ny = ((bx - ax) / l) * Math.max(1.2, (b.width / 2) * v.scale);
    ctx.strokeStyle = INK.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax + nx, ay + ny);
    ctx.lineTo(bx + nx, by + ny);
    ctx.moveTo(ax - nx, ay - ny);
    ctx.lineTo(bx - nx, by - ny);
    ctx.stroke();
  }
  ctx.lineWidth = close ? 1.5 : 1.1;
  for (const p of CASTLE) {
    ctx.strokeStyle = INK.ink;
    ctx.fillStyle = 'rgba(236, 220, 182, 0.9)';
    if (p.kind === 'box') {
      poly(ctx, corners(v, p));
      ctx.fill();
      ctx.stroke();
      if (close) {
        // (the Map’s walls are thick: a second line inside)
        const inner = corners(v, { ...p, w: Math.max(1, p.w - 2.4), d: Math.max(1, p.d - 2.4) });
        poly(ctx, inner);
        ctx.strokeStyle = INK.faint;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.lineWidth = 1.5;
      }
    } else if (p.kind === 'ring') {
      const [px, py] = project(v, p.at[0], p.at[1]);
      ctx.beginPath();
      ctx.arc(px, py, Math.max(1.5, p.r * v.scale), 0, TAU);
      ctx.fill();
      ctx.stroke();
    } else if (p.kind === 'wall') {
      line(ctx, v, [p.from, p.to]);
      ctx.stroke();
    }
  }
}

// inside, at the castle’s zoom: the passages as double lines (broken below
// stairs) between the buildings, drawn first so a room’s floor covers its
// own stretch of them
function drawPassages(ctx, v) {
  for (const c of corridors()) {
    const [ax, ay] = project(v, c.from[0], c.from[1]);
    const [bx, by] = project(v, c.to[0], c.to[1]);
    const l = Math.hypot(bx - ax, by - ay) || 1;
    const half = 1.4 * v.scale;
    const nx = (-(by - ay) / l) * half;
    const ny = ((bx - ax) / l) * half;
    ctx.setLineDash(c.below ? [3, 3] : []);
    ctx.strokeStyle = INK.soft;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(ax + nx, ay + ny);
    ctx.lineTo(bx + nx, by + ny);
    ctx.moveTo(ax - nx, ay - ny);
    ctx.lineTo(bx - nx, by - ny);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

// and every room’s name, over its floor
function drawRooms(ctx, v) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = HAND(Math.min(12, 4 * v.scale));
  for (const r of ROOMS) {
    if (!inView(v, r.at[0], r.at[1])) continue;
    const [px, py] = project(v, r.at[0], r.at[1]);
    ctx.fillStyle = r.below ? INK.soft : INK.ink;
    ctx.fillText(r.text, px, py);
  }
}

function drawGrounds(ctx, v) {
  ctx.strokeStyle = INK.ink;
  ctx.lineWidth = 1.1;
  const { pitch, hut, paddock, pumpkins, willow, circle, station, endRock } = GROUNDS;
  // the pitch: its oval, its middle and three hoops at each end
  const [px, py] = project(v, pitch.at[0], pitch.at[1]);
  ctx.beginPath();
  ctx.ellipse(px, py, pitch.rx * v.scale, pitch.rz * v.scale, 0, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(px, py, Math.max(1.5, 6 * v.scale), 0, TAU);
  ctx.moveTo(px - pitch.rx * v.scale, py);
  ctx.lineTo(px + pitch.rx * v.scale, py);
  ctx.strokeStyle = INK.faint;
  ctx.stroke();
  ctx.strokeStyle = INK.ink;
  for (const end of [-1, 1])
    for (const k of [-1, 0, 1]) {
      ctx.beginPath();
      ctx.arc(px + k * 6 * v.scale, py + end * (pitch.rz - 8) * v.scale, Math.max(1, 1.6 * v.scale), 0, TAU);
      ctx.stroke();
    }
  // the hut: eight sides; the pumpkins; the paddock’s fence
  const [hx, hy] = project(v, hut.at[0], hut.at[1]);
  ctx.beginPath();
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    const r = Math.max(2.5, hut.r * v.scale);
    if (i) ctx.lineTo(hx + Math.cos(a) * r, hy + Math.sin(a) * r);
    else ctx.moveTo(hx + Math.cos(a) * r, hy + Math.sin(a) * r);
  }
  ctx.stroke();
  const [kx, ky] = project(v, pumpkins.at[0], pumpkins.at[1]);
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(kx + Math.cos(i * 2.1) * pumpkins.r * v.scale * 0.6, ky + Math.sin(i * 2.1) * pumpkins.r * v.scale * 0.6, Math.max(1, 1.2 * v.scale), 0, TAU);
    ctx.stroke();
  }
  ctx.setLineDash([2, 3]);
  poly(ctx, corners(v, paddock));
  ctx.stroke();
  ctx.setLineDash([]);
  // the Willow: a wild crown of limbs
  const [wx, wy] = project(v, willow.at[0], willow.at[1]);
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    const r = Math.max(5, willow.r * v.scale);
    ctx.moveTo(wx, wy);
    ctx.quadraticCurveTo(wx + Math.cos(a + 0.6) * r * 0.7, wy + Math.sin(a + 0.6) * r * 0.7, wx + Math.cos(a) * r, wy + Math.sin(a) * r);
  }
  ctx.stroke();
  // the stone circle
  const [sx, sy] = project(v, circle.at[0], circle.at[1]);
  ctx.fillStyle = INK.ink;
  for (let i = 0; i < circle.stones; i++) {
    const a = (i / circle.stones) * TAU;
    ctx.beginPath();
    ctx.arc(sx + Math.cos(a) * circle.r * v.scale, sy + Math.sin(a) * circle.r * v.scale, Math.max(0.9, 0.9 * v.scale), 0, TAU);
    ctx.fill();
  }
  // the station’s platform, and the end rock
  poly(ctx, corners(v, { ...station, at: station.at }));
  ctx.stroke();
  const [ex, ey] = project(v, endRock.at[0], endRock.at[1]);
  ctx.beginPath();
  ctx.arc(ex, ey, Math.max(1.5, endRock.r * v.scale), 0, TAU);
  ctx.fillStyle = INK.wash;
  ctx.fill();
  ctx.stroke();
}

function drawVillage(ctx, v) {
  const vil = village();
  const [a, b] = vil.street;
  if (!inView(v, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 120)) return;
  ctx.strokeStyle = INK.soft;
  ctx.lineWidth = 0.9;
  const [ax, ay] = project(v, a[0], a[1]);
  const [bx, by] = project(v, b[0], b[1]);
  const l = Math.hypot(bx - ax, by - ay) || 1;
  const nx = (-(by - ay) / l) * (vil.width / 2) * v.scale;
  const ny = ((bx - ax) / l) * (vil.width / 2) * v.scale;
  ctx.beginPath();
  ctx.moveTo(ax + nx, ay + ny);
  ctx.lineTo(bx + nx, by + ny);
  ctx.moveTo(ax - nx, ay - ny);
  ctx.lineTo(bx - nx, by - ny);
  ctx.stroke();
  ctx.strokeStyle = INK.ink;
  ctx.fillStyle = 'rgba(236, 220, 182, 0.9)';
  ctx.lineWidth = 1;
  for (const h of vil.buildings) {
    poly(ctx, corners(v, h));
    ctx.fill();
    ctx.stroke();
  }
  // the Shack on its hill, crooked, and the fence nobody climbs
  const shack = corners(v, { at: vil.shack, w: 11, d: 9, turn: 0.18 });
  poly(ctx, shack);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([2, 3]);
  line(ctx, v, vil.fence);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawLabels(ctx, v) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const l of LABELS) {
    if (v.scale < l.zoom[0] || v.scale > l.zoom[1] || !inView(v, l.at[0], l.at[1])) continue;
    const [px, py] = project(v, l.at[0], l.at[1]);
    ctx.fillStyle = INK.ink;
    ctx.font = l.size === 'big' ? TITLE(Math.round(Math.min(22, 11 + v.scale * 6))) : l.size === 'mid' ? HAND(12) : HAND(10.5);
    ctx.fillText(l.text, px, py);
  }
}

// Everything that stands still. `reveal` (0…1): the ink spreading out from
// the middle as the Map is opened, as if from the wand’s tip
export function drawInk(ctx, v, { reveal = 1 } = {}) {
  const close = v.scale >= 1.4;
  drawLake(ctx, v);
  drawCrag(ctx, v);
  drawTrees(ctx, v);
  drawPaths(ctx, v);
  drawGrounds(ctx, v);
  drawVillage(ctx, v);
  if (close) drawPassages(ctx, v);
  drawCastle(ctx, v, close);
  if (close) drawRooms(ctx, v);
  drawLabels(ctx, v);
  if (reveal < 1) {
    const r = Math.hypot(v.w, v.h) * 0.6 * reveal;
    const g = ctx.createRadialGradient(v.w / 2, v.h / 2, Math.max(0, r - 60), v.w / 2, v.h / 2, Math.max(1, r));
    g.addColorStop(0, 'rgba(0, 0, 0, 1)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, v.w, v.h);
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ── what moves ──

export const STRIDE = 7; // px on the Map between two prints
export const FADE = 1.6; // s a print takes to fade

// The footprints each figure has left: a print laid every STRIDE px of the
// Map it walks, left and right by turns, each fading away
export function createTrails() {
  const trails = new Map();
  return {
    lay(people, v, now) {
      const stride = STRIDE / Math.max(0.05, v.scale);
      for (const p of people) {
        let t = trails.get(p.id);
        if (!t) trails.set(p.id, (t = { x: p.x, z: p.z, side: 1, prints: [] }));
        const d = Math.hypot(p.x - t.x, p.z - t.z);
        // (a figure that went far between two looks, slept through or set down: no trail across the gap)
        if (d > stride * 12) {
          t.x = p.x;
          t.z = p.z;
          t.prints.length = 0;
        } else if (p.moving && d >= stride) {
          t.side = -t.side;
          t.prints.push({ x: p.x, z: p.z, dx: (p.x - t.x) / d, dz: (p.z - t.z) / d, side: t.side, t: now, ride: Boolean(p.ride) });
          t.x = p.x;
          t.z = p.z;
        }
        while (t.prints.length && now - t.prints[0].t > FADE) t.prints.shift();
      }
    },
    prints: (id) => trails.get(id)?.prints ?? [],
    clear: () => trails.clear(),
  };
}

// one print: a sole and a heel, along the way it was going
function print(ctx, x, y, a, side, k) {
  const ox = Math.cos(a + Math.PI / 2) * side * 1.9 * k;
  const oy = Math.sin(a + Math.PI / 2) * side * 1.9 * k;
  ctx.save();
  ctx.translate(x + ox, y + oy);
  ctx.rotate(a + Math.PI / 2);
  ctx.beginPath();
  ctx.ellipse(0, -1.1 * k, 1.35 * k, 2.1 * k, 0, 0, TAU);
  ctx.ellipse(0, 2.05 * k, 1.0 * k, 1.05 * k, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// a name on a little scroll, its ends cut in a fork
function banner(ctx, x, y, text, ink) {
  ctx.font = HAND(10);
  const w = ctx.measureText(text).width + 10;
  const h = 13;
  const l = x - w / 2;
  const t = y - h;
  ctx.beginPath();
  ctx.moveTo(l - 4, t);
  ctx.lineTo(l + w + 4, t);
  ctx.lineTo(l + w + 1, t + h / 2);
  ctx.lineTo(l + w + 4, t + h);
  ctx.lineTo(l - 4, t + h);
  ctx.lineTo(l - 1, t + h / 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(240, 226, 192, 0.94)';
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, t + h / 2 + 0.5);
  return [l - 4, t, w + 8, h];
}

const overlaps = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];

// a watcher’s reach after curfew, as a faint wedge before them
function wedge(ctx, v, p, range, cone, fill) {
  const [px, py] = project(v, p.x, p.z);
  const a = Math.atan2(p.dz ?? 1, p.dx ?? 0);
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.arc(px, py, range * v.scale, a - cone, a + cone);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

// The footprints and the names: everyone where they are, the ghosts pale,
// you in your house’s ink, the carriages as wheel ruts; banners laid so no
// two overlap (yours first, then Filch’s and his cat’s, then the nearest)
export function drawLife(ctx, v, { people = [], me = null, trails, now = 0, night = false, banners = true } = {}) {
  const k = Math.min(1.7, Math.max(0.85, v.scale * 0.55));
  const all = me ? [...people, me] : people;
  trails?.lay(all, v, now);
  if (night)
    for (const p of people) {
      if (!inView(v, p.x, p.z, 12)) continue;
      if (p.id === 'filch') wedge(ctx, v, p, SIGHT.filch.range, SIGHT.filch.cone, INK.lantern);
      else if (p.id === 'norris') wedge(ctx, v, p, SIGHT.cat.range, SIGHT.cat.cone, 'rgba(58, 35, 20, 0.07)');
    }
  const shown = [];
  for (const p of all) {
    if (!inView(v, p.x, p.z, 4)) continue;
    const ink = p === me ? INK.you : p.ghost ? INK.ghost : INK.ink;
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    for (const f of trails?.prints(p.id) ?? []) {
      const age = (now - f.t) / FADE;
      ctx.globalAlpha = Math.max(0, 1 - age) * (p.ghost ? 0.6 : 0.85);
      const [x, y] = project(v, f.x, f.z);
      const a = Math.atan2(f.dz, f.dx);
      if (f.ride) {
        // (the carriages: a pair of wheel ruts)
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const s of [-1, 1]) {
          const ox = Math.cos(a + Math.PI / 2) * s * 2.6 * k;
          const oy = Math.sin(a + Math.PI / 2) * s * 2.6 * k;
          ctx.moveTo(x + ox - Math.cos(a) * 3 * k, y + oy - Math.sin(a) * 3 * k);
          ctx.lineTo(x + ox + Math.cos(a) * 3 * k, y + oy + Math.sin(a) * 3 * k);
        }
        ctx.stroke();
      } else print(ctx, x, y, a, f.side, k);
    }
    ctx.globalAlpha = p.ghost ? 0.6 : 1;
    // (standing: both feet together, the way they face)
    if (!p.moving || !(trails?.prints(p.id).length > 0)) {
      const [x, y] = project(v, p.x, p.z);
      const a = Math.atan2(p.dz ?? 1, p.dx ?? 0);
      print(ctx, x, y, a, 1, k);
      print(ctx, x, y, a, -1, k);
    }
    ctx.globalAlpha = 1;
    if (!banners) continue;
    shown.push(p);
  }
  if (!banners) return;
  // the banners, most wanted first, none on another
  const rank = (p) => (p === me ? 0 : p.id === 'filch' || p.id === 'norris' ? 1 : p.ghost ? 3 : 2);
  shown.sort((a, b) => rank(a) - rank(b));
  const taken = [];
  for (const p of shown) {
    const [x, y] = project(v, p.x, p.z);
    ctx.font = HAND(10);
    const w = ctx.measureText(p.name).width + 18;
    const box = [x - w / 2, y - 23, w, 13];
    if (taken.some((t) => overlaps(t, box))) continue;
    ctx.globalAlpha = p.ghost ? 0.7 : 1;
    taken.push(banner(ctx, x, y - 9, p.name, p === me ? INK.you : p.ghost ? INK.ghost : INK.ink));
    ctx.globalAlpha = 1;
  }
}

// the name of where a point is: the spot it stands in (or very near), else
// the wider place it’s in (the smallest), else the grounds
export function placeName(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const s of SPOTS) {
    const d = Math.hypot(x - s.at[0], z - s.at[1]) - s.r;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  if (best && bestD < 8) return best.name;
  const area = AREAS.filter((a) => Math.hypot(x - a.at[0], z - a.at[1]) < a.r).sort((a, b) => a.r - b.r)[0];
  return area?.name ?? (best && bestD < 40 ? best.name : 'The grounds');
}
