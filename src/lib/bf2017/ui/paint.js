// The painter of the game's screens on the canvas (the 2026-10-13 canvas
// design): a draw list (./layout.js's drawList) on a 2D context, in the
// game's frame, by the rules the DOM screens (runtime/hud/Screen.jsx) drew
// with, so the move changes no look but the frame's. No React: the kit's
// ScreenCanvas holds the canvas and calls this when something changed.
//
// paint(ctx, items, { frame, window, ratio, read, media, makePath, pictureOf }) →
//   { ms, drawn, skipped: { [type]: n }, missing: { shapes: n, textures: n } }
//   frame   frameOf(window); ratio the device's pixels a CSS pixel
//   read    (name) → a CSS custom property's value (the fonts' variables)
//   media   by URL: a <video> (drawn once it has a frame) or an Image (a
//           film's poster, a texture's picture)
//   pictureOf (item) → { url } | null: a texture box's picture (./textures.js)
//   frost   true where the blurred backings are drawn under the canvas (the
//           kit's frosted panels): they are not counted as skipped
//   makeCanvas (w, h) → a scratch canvas (an OffscreenCanvas where there is
//           one): a film's tint and the trail are drawn on them; with none,
//           a film is drawn untinted and the trail not at all
//   trail   { items, colour, scale, alpha, scanlines } | null: the CRT
//           trail's glow over what the key colour picks (trailGlow below)
// Items: rectangles (rounded by `corners`), texts, vector shapes, films
// (`tint`ed), textures, single-pixel lines and lines (`points`, `cap`,
// `relative`; `follow` a text's width, a tile's top line its title's).
// A box's blend (the game's additive, multiplicative, subtractive) is the
// context's composite operation while it is drawn.
//   makePath (d) → Path2D (a test gives its own)
// resolveFamily(value, read) → the family list with every var() put in
// fontOf(item, k, read) → the item's CSS font, never under 0.7 rem in the window

import { shape as shapeOf } from './shapes';
import { pictureOf as pictureOfDefault } from './textures';

const BLEND = { additive: 'lighter', multiplicative: 'multiply', subtractive: 'difference' };

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

// the lines each text item was last broken into, for the trail's copy of it
// (a scratch canvas may measure in another face before the game's has loaded there)
const broken = new WeakMap();

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
  // (a copy drawn elsewhere, the trail's, keeps the lines the screen's paint broke it into)
  const lines = it.lines ?? (it.wrap ? linesOf(ctx, it.text, it.w) : [String(it.text)]);
  broken.set(it, lines);
  const step = size * LINE;
  const top = base === 'top' ? it.y : base === 'bottom' ? it.y + it.h - (lines.length - 1) * step : it.y + it.h / 2 - ((lines.length - 1) * step) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, top + i * step));
  return true;
}

// the item's box, or the window's whole rect in frame px for one that bleeds
const rectOf = (it, frame, win) => (it.bleed ? { x: (0 - frame.x) / frame.k, y: (0 - frame.y) / frame.k, w: win.width / frame.k, h: win.height / frame.k } : it);

// a rectangle's path with its corners rounded ([top-left, top-right,
// bottom-right, bottom-left] radii, the record's CornerRoundness)
function roundedPath(ctx, x, y, w, h, c) {
  const m = Math.min(w, h) / 2;
  const [tl, tr, br, bl] = c.map((v) => Math.max(0, Math.min(v, m)));
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  if (tr) ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  if (br) ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  if (bl) ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl);
  if (tl) ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}
const rounded = (it) => Array.isArray(it.corners) && it.corners.some((v) => v > 0);

// a fill's alpha as the game blends it, in linear light (GameRenderSettings'
// UIShadeInLinearSpaceEnabled), over the dark it lies on: the 8-bit value of
// that much light
const linearAlpha = (a) => (a >= 1 ? 1 : a <= 0.0031308 ? 12.92 * a : 1.055 * a ** (1 / 2.4) - 0.055);

function rect(ctx, it, r, k, skipped, frost) {
  if (it.fill === 'blurred') return frost ? false : ((skipped.blurred = (skipped.blurred ?? 0) + 1), false);
  if (it.fill !== 'none' && it.colour) {
    if (it.linear && (it.alpha ?? 1) < 1) ctx.globalAlpha = linearAlpha(it.alpha);
    ctx.fillStyle = it.colour;
    if (it.type === 'circle') {
      ctx.beginPath();
      ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (rounded(it)) {
      roundedPath(ctx, r.x, r.y, r.w, r.h, it.corners);
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
    } else if (rounded(it)) {
      roundedPath(ctx, r.x + lw / 2, r.y + lw / 2, r.w - lw, r.h - lw, it.corners);
      ctx.stroke();
    } else ctx.strokeRect(r.x + lw / 2, r.y + lw / 2, r.w - lw, r.h - lw);
    return true;
  }
  return false;
}

// A line through its points, in its box's pixels (or parts of the box, a
// relative one), its width the record's (at least a pixel), its caps round
// where the record says. One that follows a text (a tile's top line, as long
// as its title's words: the BasicTileWidget's Points from the title's
// TextSize) runs from its start the width of that text.
function polyline(ctx, it, k, read, lengthOf) {
  if (!it.colour || !it.points?.length) return false;
  let pts = it.points.map(([x, y]) => (it.relative ? [x * it.w, y * it.h] : [x, y]));
  const len = it.follow ? lengthOf(it) : null;
  if (len !== null && len !== undefined) pts = [pts[0] ?? [0, 0], [(pts[0]?.[0] ?? 0) + len, pts[0]?.[1] ?? 0]];
  ctx.strokeStyle = it.colour;
  ctx.lineWidth = Math.max(1 / k, it.line ?? 1);
  ctx.lineCap = it.cap === 'round' ? 'round' : 'butt';
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(it.x + x, it.y + y) : ctx.moveTo(it.x + x, it.y + y)));
  ctx.stroke();
  return true;
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

// a film's picture now: the playing video's frame, else its poster
function frameOf(it, media) {
  const v = it.film ? media[it.film.url] : null;
  if (v && v.readyState >= 2 && v.videoWidth) return [v, v.videoWidth, v.videoHeight];
  const p = it.film ? media[it.film.poster] : null;
  const pw = p?.naturalWidth ?? p?.width;
  if (p && p.complete !== false && pw) return [p, pw, p.naturalHeight ?? p.height];
  return null;
}

// Scratch canvases, one a use, kept between paints (a film's tint, the
// trail), a set for each maker of them.
const pools = new WeakMap();
function scratch(key, w, h, makeCanvas) {
  if (typeof makeCanvas !== 'function') return null;
  if (!pools.has(makeCanvas)) pools.set(makeCanvas, new Map());
  const pool = pools.get(makeCanvas);
  let c = pool.get(key);
  if (!c) {
    c = makeCanvas(w, h) ?? null;
    if (!c) return null;
    pool.set(key, c);
  }
  if (c.width !== w) c.width = w;
  if (c.height !== h) c.height = h;
  return c;
}
const offscreen = (w, h) => (typeof OffscreenCanvas === 'undefined' ? null : new OffscreenCanvas(w, h));

// A film, covering its box. One the logic colours (`tint`: a Play tile's
// line drawing, white, turned the state's colour, yellow on the focused
// tile) is multiplied by its colour first, at the size it is drawn: the
// films are opaque, their black stays black.
function film(ctx, it, r, media, env) {
  const f = frameOf(it, media);
  if (!f) return false;
  const [src, sw, sh] = f;
  if (!it.tint || it.tint === WHITE) return cover(ctx, src, sw, sh, r), true;
  const s = env.scale;
  const w = Math.max(1, Math.round(r.w * s));
  const h = Math.max(1, Math.round(r.h * s));
  const c = scratch(`tint:${it.id}`, w, h, env.makeCanvas);
  const t = c?.getContext('2d');
  if (!t) return cover(ctx, src, sw, sh, r), true;
  t.globalCompositeOperation = 'source-over';
  cover(t, src, sw, sh, { x: 0, y: 0, w, h });
  t.globalCompositeOperation = 'multiply';
  t.fillStyle = it.tint;
  t.fillRect(0, 0, w, h);
  t.globalCompositeOperation = 'source-over';
  ctx.drawImage(c, 0, 0, w, h, r.x, r.y, r.w, r.h);
  return true;
}

// a single-pixel line: along the box's long side, one pixel of the window
// thick, through the box's middle (hand: where in its box the game draws it
// is its renderer's; the captures' rule under a tile's title sits there)
function pixelLine(ctx, it, k) {
  if (!it.colour) return false;
  const t = 1 / k;
  ctx.fillStyle = it.colour;
  if (it.w >= it.h) ctx.fillRect(it.x, it.y + (it.h - t) / 2, it.w, t);
  else ctx.fillRect(it.x + (it.w - t) / 2, it.y, t, it.h);
  return true;
}

// a texture box's picture, stretched over the box from its UV rectangle
function picture(ctx, it, r, media, pictureOf, missing) {
  const p = pictureOf(it);
  if (!p) return (missing.textures += 1), false;
  const img = media[p.url];
  // (an Image once loaded, or an ImageBitmap made ready at the size it is drawn)
  const w = img?.naturalWidth ?? img?.width;
  const h = img?.naturalHeight ?? img?.height;
  if (!img || img.complete === false || !w) return false;
  const [u0, v0, u1, v1] = it.texture?.uv ?? [0, 0, 1, 1];
  ctx.drawImage(img, u0 * w, v0 * h, (u1 - u0) * w, (v1 - v0) * h, r.x, r.y, r.w, r.h);
  return true;
}

const now = () => (typeof performance === 'undefined' ? Date.now() : performance.now());

// one item on a context already in the frame's transform
function drawItem(ctx, it, env) {
  const { frame, win, read, media, makePath, pictureOf, frost, skipped, missing } = env;
  const r = rectOf(it, frame, win);
  if (it.type === 'rectangle' || it.type === 'fill' || it.type === 'circle') return rect(ctx, it, r, frame.k, skipped, frost);
  if (it.type === 'text') return text(ctx, it, frame.k, read);
  if (it.type === 'vectorShape') return it.shape ? vector(ctx, it, makePath, missing) : false;
  if (it.type === 'video') return film(ctx, it, r, media, env);
  if (it.type === 'texture') return picture(ctx, it, r, media, pictureOf, missing);
  if (it.type === 'singlePixelLine') return pixelLine(ctx, it, frame.k);
  if (it.type === 'line') return polyline(ctx, it, frame.k, read, env.lengthOf);
  skipped[it.type] = (skipped[it.type] ?? 0) + 1;
  return false;
}

// a followed text's width (a tile's title, measured in its own face), by
// the item that follows it: the text of that name in the same cell
function measurer(ctx, items, k, read) {
  return (it) => {
    const t = items.find((x) => x.type === 'text' && x.cell === it.cell && x.text && x.id.endsWith(`/${it.follow}`));
    if (!t) return null;
    ctx.save();
    ctx.font = fontOf(t, k, read);
    const lines = t.wrap ? linesOf(ctx, t.text, t.w) : [String(t.text)];
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width));
    ctx.restore();
    return w;
  };
}

// The CRT trail's glow (`trail`: a container's CrtTrailSettings, the
// FrontendKeycolorGlow on the front end's screens; bf2-re findings/53, the
// UI shader's crtTrail permutations). The game keeps, at half resolution,
// trail = 0.97 · box3x3(trail) − 0.003 + 0.05 · key(UI) each frame, and adds
// it over the screen in the container's TrailColor with its scanlines. Its
// steady state, worked out in float by the recurrence, is the key-coloured
// parts blurred by about 2.5 of its pixels (5 of the frame's at 1080) at a
// gain of about 1.2 (the bias trims the faint edge): what is drawn here, once
// a paint, from the parts the key colour picks (`trail.items`).
const TRAIL_SIGMA = 5;
const TRAIL_GAIN = 1.2;
const mul = (css, [r, g, b]) => {
  const m = String(css).match(/rgb\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/);
  return m ? `rgb(${Math.round(m[1] * r)} ${Math.round(m[2] * g)} ${Math.round(m[3] * b)})` : css;
};
function trailGlow(ctx, trail, env) {
  const { frame, win, ratio } = env;
  if (!trail?.items?.length) return false;
  const s = (trail.scale ?? 0.5) * ratio;
  const W = Math.max(1, Math.ceil(win.width * s));
  const H = Math.max(1, Math.ceil(win.height * s));
  const a = scratch('trail:keyed', W, H, env.makeCanvas);
  const b = scratch('trail:blur', Math.ceil(win.width * ratio), Math.ceil(win.height * ratio), env.makeCanvas);
  const ac = a?.getContext('2d');
  const bc = b?.getContext('2d');
  if (!ac || !bc || !('filter' in bc)) return false;
  ac.setTransform(1, 0, 0, 1, 0, 0);
  ac.clearRect(0, 0, W, H);
  ac.setTransform(s * frame.k, 0, 0, s * frame.k, s * frame.x, s * frame.y);
  const tint = trail.colour ?? [1, 1, 1];
  for (const it of trail.items) {
    ac.globalAlpha = it.alpha ?? 1;
    drawItem(ac, { ...it, blend: undefined, colour: it.colour ? mul(it.colour, tint) : it.colour, tint: it.tint ? mul(it.tint, tint) : undefined, lines: broken.get(it) }, { ...env, scale: s * frame.k });
  }
  ac.globalAlpha = 1;
  bc.setTransform(1, 0, 0, 1, 0, 0);
  bc.clearRect(0, 0, b.width, b.height);
  bc.filter = `blur(${Math.round(TRAIL_SIGMA * frame.k * ratio * 100) / 100}px)`;
  bc.drawImage(a, 0, 0, W, H, 0, 0, b.width, b.height);
  bc.filter = 'none';
  // (the scanlines: every row of the screen's `width + spacing` but the first `width` is set off)
  const sl = trail.scanlines;
  if (sl) {
    bc.globalCompositeOperation = 'destination-out';
    bc.fillStyle = `rgb(0 0 0 / ${Math.round((1 - SCAN_KEEP) * 100) / 100})`;
    const period = Math.max(2, Math.round((sl.width + sl.spacing) * ratio));
    for (let y = Math.round(sl.width * ratio); y < b.height; y += period) bc.fillRect(0, y, b.width, Math.max(1, Math.round(sl.spacing * ratio)));
    bc.globalCompositeOperation = 'source-over';
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, (trail.alpha ?? 1) * TRAIL_GAIN);
  ctx.drawImage(b, 0, 0);
  if (TRAIL_GAIN > 1) {
    ctx.globalAlpha = (trail.alpha ?? 1) * (TRAIL_GAIN - 1);
    ctx.drawImage(b, 0, 0);
  }
  ctx.restore();
  return true;
}
// (the composite raises a set-off row to the power 1 + (1 − ScanlinesOffAlpha)
// = 1.25: for the trail's usual 0.3 to 0.7 about 0.82 of it)
const SCAN_KEEP = 0.82;

export function paint(ctx, items, { frame, window: win, ratio = 1, read = () => '', media = {}, makePath = (d) => new Path2D(d), pictureOf = pictureOfDefault, frost = false, makeCanvas = offscreen, trail = null }) {
  const start = now();
  const skipped = {};
  const missing = { shapes: 0, textures: 0 };
  let drawn = 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, win.width * ratio, win.height * ratio);
  ctx.setTransform(ratio * frame.k, 0, 0, ratio * frame.k, ratio * frame.x, ratio * frame.y);
  const env = { frame, win, ratio, read, media, makePath, pictureOf, frost, skipped, missing, makeCanvas, scale: ratio * frame.k, lengthOf: measurer(ctx, items, frame.k, read) };
  for (const it of items) {
    ctx.globalAlpha = it.alpha ?? 1;
    ctx.globalCompositeOperation = BLEND[it.blend] ?? 'source-over';
    if (drawItem(ctx, it, env)) drawn += 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
  if (trail && trailGlow(ctx, trail, env)) drawn += 1;
  ctx.setTransform(ratio * frame.k, 0, 0, ratio * frame.k, ratio * frame.x, ratio * frame.y);
  const end = now();
  try {
    performance.measure('bf-ui-paint', { start, end });
  } catch {
    // (an older browser's measure takes marks only: the time is still returned)
  }
  return { ms: end - start, drawn, skipped, missing };
}
