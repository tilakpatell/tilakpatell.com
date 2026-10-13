// The painter of the game's screens on the canvas (the 2026-10-13 canvas
// design): a draw list (./layout.js's drawList) on a 2D context, in the
// game's frame, by the rules the DOM screens (runtime/hud/Screen.jsx) drew
// with, so the move changes no look but the frame's. No React: the kit's
// ScreenCanvas holds the canvas and calls this when something changed.
//
// paint(ctx, items, { frame, window, ratio, read, media, makePath }) →
//   { ms, drawn, skipped: { [type]: n }, missing: { shapes: n } }
//   frame   frameOf(window); ratio the device's pixels a CSS pixel
//   read    (name) → a CSS custom property's value (the fonts' variables)
//   media   by URL: a <video> (drawn once it has a frame) or an Image (a
//           film's poster)
//   makePath (d) → Path2D (a test gives its own)
// resolveFamily(value, read) → the family list with every var() put in
// fontOf(item, k, read) → the item's CSS font, never under 0.7 rem in the window

import { shape as shapeOf } from './shapes';

const MIN_PX = 11.2; // 0.7 rem: nothing a player reads is smaller (RULES.md, the worlds' HUDs)
const LINE = 1.25; // a wrapped text's lines (the DOM screens': hand)
const INK = '#f6f3ea';
const WHITE = 'rgb(255 255 255)';
const VAR = /var\((--[\w-]+)\)/g;

export function resolveFamily(value, read) {
  let v = String(value ?? '');
  for (let i = 0; i < 8 && VAR.test(v); i++) v = v.replace(VAR, (_, name) => String(read(name) ?? '').trim());
  return v;
}

const r2 = (v) => Math.round(v * 100) / 100;

export function fontOf(item, k, read) {
  const f = item.font ?? {};
  return `${f.weight ?? 400} ${r2(Math.max(f.size ?? 18, MIN_PX / k))}px ${resolveFamily(f.family ?? 'sans-serif', read)}`;
}

const H_ALIGN = { left: 'left', center: 'center', right: 'right', startofreadingdirection: 'left', endofreadingdirection: 'right' };
const V_ALIGN = { top: 'top', center: 'middle', bottom: 'bottom' };

// a box's words broken at spaces to its width
function linesOf(ctx, text, w) {
  const out = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > w) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

function text(ctx, it, k, read) {
  if (!it.text) return false;
  const size = Math.max(it.font?.size ?? 18, MIN_PX / k);
  const [h = 'left', v = 'center'] = it.align ?? [];
  const align = H_ALIGN[h] ?? 'left';
  const base = V_ALIGN[v] ?? 'middle';
  ctx.font = fontOf(it, k, read);
  ctx.fillStyle = it.colour ?? INK;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  const x = align === 'center' ? it.x + it.w / 2 : align === 'right' ? it.x + it.w : it.x;
  const lines = it.wrap ? linesOf(ctx, it.text, it.w) : [String(it.text)];
  const step = size * LINE;
  const top = base === 'top' ? it.y : base === 'bottom' ? it.y + it.h - (lines.length - 1) * step : it.y + it.h / 2 - ((lines.length - 1) * step) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, top + i * step));
  return true;
}

// the item's box, or the window's whole rect in frame px for one that bleeds
const rectOf = (it, frame, win) => (it.bleed ? { x: (0 - frame.x) / frame.k, y: (0 - frame.y) / frame.k, w: win.width / frame.k, h: win.height / frame.k } : it);

function rect(ctx, it, r, k, skipped) {
  if (it.fill === 'blurred') return (skipped.blurred = (skipped.blurred ?? 0) + 1), false;
  if (it.fill !== 'none' && it.colour) {
    ctx.fillStyle = it.colour;
    if (it.type === 'circle') {
      ctx.beginPath();
      ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else ctx.fillRect(r.x, r.y, r.w, r.h);
    return true;
  }
  if (it.line && it.colour) {
    const lw = Math.max(1 / k, it.line);
    ctx.strokeStyle = it.colour;
    ctx.lineWidth = lw;
    if (it.type === 'circle') {
      ctx.beginPath();
      ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, Math.max(0, r.w / 2 - lw / 2), Math.max(0, r.h / 2 - lw / 2), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else ctx.strokeRect(r.x + lw / 2, r.y + lw / 2, r.w - lw, r.h - lw);
    return true;
  }
  return false;
}

const paths = new Map();
function vector(ctx, it, makePath, missing) {
  const s = shapeOf(it.shape);
  if (!s) return (missing.shapes += 1), false;
  const [vx, vy, vw, vh] = s.viewBox.split(' ').map(Number);
  if (!vw || !vh) return false;
  const scale = Math.min(it.w / vw, it.h / vh);
  ctx.save();
  ctx.translate(it.x + (it.w - vw * scale) / 2 - vx * scale, it.y + (it.h - vh * scale) / 2 - vy * scale);
  ctx.scale(scale, scale);
  s.paths.forEach((p, i) => {
    const key = `${it.shape}#${i}`;
    if (!paths.has(key) || paths.get(key).maker !== makePath) paths.set(key, { maker: makePath, path: makePath(p.d) });
    const path = paths.get(key).path;
    const own = it.colour && it.colour !== WHITE ? it.colour : null;
    ctx.globalAlpha = it.alpha * (p.opacity ?? 1);
    if (p.stroke) {
      ctx.strokeStyle = own ?? p.stroke;
      ctx.lineWidth = p.strokeWidth;
      ctx.lineCap = p.strokeLinecap;
      ctx.stroke(path);
    } else {
      ctx.fillStyle = own ?? p.fill;
      ctx.fill(path, p.fillRule === 'evenodd' ? 'evenodd' : 'nonzero');
    }
  });
  ctx.restore();
  return true;
}

// a picture drawn to cover its box, its middle kept
function cover(ctx, src, sw, sh, r) {
  const s = Math.max(r.w / sw, r.h / sh);
  const cw = r.w / s;
  const ch = r.h / s;
  ctx.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, r.x, r.y, r.w, r.h);
}

function film(ctx, it, r, media) {
  const v = it.film ? media[it.film.url] : null;
  if (v && v.readyState >= 2 && v.videoWidth) return cover(ctx, v, v.videoWidth, v.videoHeight, r), true;
  const p = it.film ? media[it.film.poster] : null;
  if (p && p.complete && p.naturalWidth) return cover(ctx, p, p.naturalWidth, p.naturalHeight, r), true;
  return false;
}

const now = () => (typeof performance === 'undefined' ? Date.now() : performance.now());

export function paint(ctx, items, { frame, window: win, ratio = 1, read = () => '', media = {}, makePath = (d) => new Path2D(d) }) {
  const start = now();
  const skipped = {};
  const missing = { shapes: 0 };
  let drawn = 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, win.width * ratio, win.height * ratio);
  ctx.setTransform(ratio * frame.k, 0, 0, ratio * frame.k, ratio * frame.x, ratio * frame.y);
  for (const it of items) {
    ctx.globalAlpha = it.alpha ?? 1;
    const r = rectOf(it, frame, win);
    let did = false;
    if (it.type === 'rectangle' || it.type === 'fill' || it.type === 'circle') did = rect(ctx, it, r, frame.k, skipped);
    else if (it.type === 'text') did = text(ctx, it, frame.k, read);
    else if (it.type === 'vectorShape') did = it.shape ? vector(ctx, it, makePath, missing) : false;
    else if (it.type === 'video') did = film(ctx, it, r, media);
    else skipped[it.type] = (skipped[it.type] ?? 0) + 1;
    if (did) drawn += 1;
  }
  ctx.globalAlpha = 1;
  const end = now();
  try {
    performance.measure('bf-ui-paint', { start, end });
  } catch {
    // (an older browser's measure takes marks only: the time is still returned)
  }
  return { ms: end - start, drawn, skipped, missing };
}
