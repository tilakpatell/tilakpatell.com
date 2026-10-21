// The HUD's canvases: the compass strip and the round map, drawn straight
// into their 2D contexts by InvWorld.jsx's frame loop (no React state a
// frame). Moved here from InvWorld.jsx as they were, so that file stays
// under the size rule; nothing drawn changed.
import { COMPASS, fitCanvas, layoutCompass } from '../../../runtime/hud';
import { BEACH, CITY, COAST, HILLS, RIVER, SUBURB, WORLD } from './map';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));


// ── the HUD's canvases (the kit's fitCanvas: sharp on a 2× screen): the
// compass drawn in CSS pixels, so its type is the size it says on a phone
// too, and the map in 180ths of its width, its look at any size ──
export function fitHud(H, map) {
  H.mapBox = fitCanvas(map, 180);
  const box = fitCanvas(H.compass);
  if (box) {
    // where the HUD's other things still sit over the strip (the title, the
    // goal): nothing of the compass is drawn there (by more than a sliver:
    // the title's box runs a little below its letters)
    const r = H.compass.getBoundingClientRect();
    box.block = [];
    for (const el of [H.tools, ...(H.brand?.children ?? [])]) {
      const b = el?.getBoundingClientRect();
      if (b?.width && Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top) > 6 && b.right > r.left && b.left < r.right) box.block.push([b.left - r.left - 6, b.right - r.left + 6]);
    }
  }
  H.compassBox = box;
}

// ── the compass: a strip of headings, the places marked on it ──
const DIRS = [
  [0, 'S'],
  [Math.PI / 2, 'E'],
  [Math.PI, 'N'],
  [-Math.PI / 2, 'W'],
];
export function drawCompass(c, box, yaw, h, places, marks = []) {
  const x = c.getContext('2d');
  const { w: W, h: H } = box;
  const u = H / 60; // (laid out for a strip 60 high: names, headings, ticks, dots, a second row of names)
  x.setTransform(box.s, 0, 0, box.s, 0, 0);
  x.clearRect(0, 0, W, H);
  const span = COMPASS.span; // what the strip shows
  const at = (a) => W / 2 + (wrap(yaw - a) / span) * W; // (yaw grows to the left)
  x.font = `700 ${20 * u}px system-ui, sans-serif`;
  x.textAlign = 'center';
  x.fillStyle = 'rgba(255,255,255,0.9)';
  const headings = [];
  for (const [a, n] of DIRS) {
    const px = at(a);
    if (px < 10 * u || px > W - 10 * u) continue;
    x.fillText(n, px, 19 * u);
    headings.push(px);
  }
  x.fillStyle = 'rgba(255,255,255,0.35)';
  for (let k = 0; k < 24; k++) {
    const px = at((k / 24) * Math.PI * 2);
    if (px > 0 && px < W) x.fillRect(px - 0.5, 24 * u, 1, (k % 6 === 0 ? 8 : 5) * u);
  }
  // the places: a dot each
  const near = [];
  x.fillStyle = '#ffd23a';
  for (const p of places) {
    const a = Math.atan2(p.x - h.p[0], p.z - h.p[2]);
    const px = at(a);
    const d = Math.hypot(p.x - h.p[0], p.z - h.p[2]);
    if (px >= 8 * u && px <= W - 8 * u) {
      x.beginPath();
      x.arc(px, 36 * u, 4 * u, 0, Math.PI * 2);
      x.fill();
    }
    if (d < 1800) near.push({ id: p.id, label: p.name.replace(/^The /, ''), bearing: wrap(yaw - a), d });
  }
  // and the nearest's names, laid out by ./hud.js: clear of the headings
  // and of each other (a second row under the dots for the ones that would
  // touch), none under the buttons where they overlap the strip's end
  const end = box.block.filter(([, q]) => q >= W - 8).reduce((m, [p]) => Math.min(m, p), W);
  const laid = layoutCompass(near.sort((a, b) => a.d - b.d), W, { span, gap: COMPASS.gap, reserve: W - end, taken: headings });
  x.font = `600 ${14 * u}px system-ui, sans-serif`;
  for (const n of laid) {
    if (n.clipped) continue;
    const half = x.measureText(n.label).width / 2 + 3 * u;
    const lx = clamp(n.x, half, W - half);
    // (and not under anything else of the HUD's over the strip: the title, the goal)
    if (box.block.some(([p, q]) => lx + half > p && lx - half < q)) continue;
    x.fillText(n.label, lx, n.row === 0 ? 12 * u : 54 * u);
  }
  for (const m of marks) {
    const px = at(Math.atan2(m.x - h.p[0], m.z - h.p[2]));
    const cx = Math.max(10 * u, Math.min(W - 10 * u, px));
    x.fillStyle = m.color;
    x.beginPath();
    x.moveTo(cx, 26 * u);
    x.lineTo(cx + 7 * u, 40 * u);
    x.lineTo(cx - 7 * u, 40 * u);
    x.closePath();
    x.fill();
  }
  x.fillStyle = '#ffd23a';
  x.fillRect(W / 2 - u, 22 * u, 2 * u, 18 * u);
  for (const [p, q] of box.block) x.clearRect(p, 0, q - p, H);
}

// ── the map: north up, round him, further out the higher he is ──
let base = null;
function mapBase() {
  if (base) return base;
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const k = S / (WORLD.half * 2);
  const P = (v) => (v + WORLD.half) * k;
  x.fillStyle = '#3b4a2e';
  x.fillRect(0, 0, S, S);
  // the hills
  x.fillStyle = '#4a5236';
  x.fillRect(0, 0, S, P(HILLS));
  // the city's blocks, the suburbs, the water
  x.fillStyle = '#5b5d61';
  x.fillRect(P(CITY.x0), P(CITY.z0), (CITY.x1 - CITY.x0) * k, (CITY.z1 - CITY.z0) * k);
  x.fillStyle = '#4f6b3a';
  x.fillRect(P(SUBURB.x0), P(HILLS + 80), (SUBURB.x1 - SUBURB.x0) * k, (COAST - BEACH - HILLS - 120) * k);
  x.fillStyle = '#c9b98d';
  x.fillRect(0, P(COAST - BEACH), S, BEACH * k);
  x.fillStyle = '#21506a';
  x.fillRect(0, P(COAST - 20), S, S);
  x.fillRect(P(RIVER.x0), 0, (RIVER.x1 - RIVER.x0) * k, P(COAST));
  base = { c, k, P };
  return base;
}
export function drawMap(c, box, h, yaw, alt, world, marks = []) {
  const x = c.getContext('2d');
  const W = box.w;
  x.setTransform(box.s, 0, 0, box.s, 0, 0);
  const b = mapBase();
  if (!b.towers) {
    // the towers and houses, once
    const bx = b.c.getContext('2d');
    bx.fillStyle = '#8b8d92';
    for (const t of world.buildings) bx.fillRect(b.P(t.x - t.w / 2), b.P(t.z - t.d / 2), Math.max(1, t.w * b.k), Math.max(1, t.d * b.k));
    bx.fillStyle = '#a99a84';
    for (const t of world.houses) bx.fillRect(b.P(t.x - t.w / 2), b.P(t.z - t.d / 2), Math.max(1, t.w * b.k), Math.max(1, t.d * b.k));
    b.towers = true;
  }
  const span = clamp(500 + alt * 1.6, 500, WORLD.half * 2); // metres across
  const px = span * b.k;
  x.save();
  x.clearRect(0, 0, W, W);
  x.beginPath();
  x.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
  x.clip();
  x.drawImage(b.c, b.P(h.p[0]) - px / 2, b.P(h.p[2]) - px / 2, px, px, 0, 0, W, W);
  // the places
  for (const p of world.places) {
    const mx = W / 2 + ((p.x - h.p[0]) / span) * W;
    const my = W / 2 + ((p.z - h.p[2]) / span) * W;
    const r = Math.hypot(mx - W / 2, my - W / 2);
    const q = r > W / 2 - 10 ? (W / 2 - 10) / r : 1;
    x.fillStyle = '#ffd23a';
    x.strokeStyle = '#0e1a33';
    x.lineWidth = 2;
    x.beginPath();
    x.arc(W / 2 + (mx - W / 2) * q, W / 2 + (my - W / 2) * q, 5, 0, Math.PI * 2);
    x.fill();
    x.stroke();
  }
  for (const m of marks) {
    const mx = W / 2 + ((m.x - h.p[0]) / span) * W;
    const my = W / 2 + ((m.z - h.p[2]) / span) * W;
    const r = Math.hypot(mx - W / 2, my - W / 2);
    const q = r > W / 2 - 10 ? (W / 2 - 10) / r : 1;
    x.fillStyle = m.color;
    x.strokeStyle = '#000';
    x.lineWidth = 2;
    x.beginPath();
    x.arc(W / 2 + (mx - W / 2) * q, W / 2 + (my - W / 2) * q, 6, 0, Math.PI * 2);
    x.fill();
    x.stroke();
  }
  // him, pointing where he's looking
  x.translate(W / 2, W / 2);
  x.rotate(-yaw + Math.PI);
  x.fillStyle = '#5fc8ff';
  x.strokeStyle = '#08121f';
  x.beginPath();
  x.moveTo(0, -9);
  x.lineTo(6, 7);
  x.lineTo(0, 3);
  x.lineTo(-6, 7);
  x.closePath();
  x.fill();
  x.stroke();
  x.restore();
  x.strokeStyle = 'rgba(255,210,58,0.6)';
  x.lineWidth = 2;
  x.beginPath();
  x.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
  x.stroke();
}
