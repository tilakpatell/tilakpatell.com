// The canvas screen's ways (ScreenCanvas.jsx draws, this decides; no React):
// where each invisible button lies over the cell it stands for, the keys
// and the press, the fonts to load, the films to play, and the painter that
// paints when something changed, again when the game's fonts have loaded,
// and every frame only while a film plays.
//
// buttonStyle(nav, frame) → { left, top, width, height } in the window's px
// keyOn(e, nav, navs, { onLink, onAction }) → { focus: navId } | { activated } | null
// activate(nav, { onLink, onAction }): a press (a link goes, else the cell's name)
// fontsOf(items, k, read) → the CSS fonts the texts draw in, once each
// filmPlan(items, { play, pictureOf }) → { videos: [url], posters: [url] }: the
//   films to play, and the pictures to load (the films' posters, the texture
//   boxes' pictures)
// pictureSizes(items, frame, ratio, pictureOf) → { url: [w, h] }: each picture
//   (a texture's, a film's poster) at the largest box it is drawn in, in the
//   device's pixels, so it is decoded and scaled once, not at every paint
// splitGlow(items) → { base, glow }: what the game adds onto what is under it
//   (its additive blend: a tile's line drawing, a glow) goes on a canvas of
//   its own, laid on the page by the browser's screen blend, so its black adds
//   nothing to the frosted panels and the backdrop under the base canvas
// trailOf(items) → { …settings, items } | null: what the CRT trail glows
//   over (the key colour's parts of a trail container), for the glow canvas
// frostOf(items, frame) → [{ id, style }]: a blurring panel under each box the
//   game blurs what is behind (`fill: 'blurred'`), in the window's px
// createPainter({ ctx, read, fonts, raf, caf }) → { draw(args), repaint(),
//   playing(on), last(), destroy() }: `args` paint()'s, kept for the repaints

import { fontOf, paint } from '../../lib/bf2017/ui/paint';
import { pictureOf as pictureOfDefault } from '../../lib/bf2017/ui/textures';
import { screenKey } from './screenKey';

const px = (v) => `${Math.round(v * 100) / 100}px`;

export function buttonStyle(nav, frame) {
  return { left: px(frame.x + nav.x * frame.k), top: px(frame.y + nav.y * frame.k), width: px(nav.w * frame.k), height: px(nav.h * frame.k) };
}

const groupOf = (nav, navs) => navs.filter((n) => n.group === nav.group);
const nameOf = (id) => id.slice(id.lastIndexOf('/') + 1);

export function activate(nav, { onLink = null, onAction = null } = {}) {
  if (nav.coming) return;
  if (nav.link || nav.screen) onLink?.(nav.screen ?? nav.link, nav);
  else onAction?.(nameOf(nav.id), nav);
}

export function keyOn(e, nav, navs, handlers = {}) {
  const cells = groupOf(nav, navs);
  const index = cells.findIndex((n) => n.id === nav.id);
  if ((e.key === 'Enter' || e.key === ' ') && nav.coming) {
    e.preventDefault?.();
    return null;
  }
  // (the kit's own keys: arrows along the group, Home, End, Enter or Space)
  const r = screenKey(e, { index, cells, horizontal: nav.horizontal, onLink: (to, c) => activate(c, handlers), onAction: (id, c) => activate(c, handlers) });
  if (r?.focus !== undefined) return { focus: cells[r.focus].id };
  return r;
}

export function fontsOf(items, k, read) {
  return [...new Set(items.filter((i) => i.type === 'text' && i.text).map((i) => fontOf(i, k, read)))];
}

export function filmPlan(items, { play, pictureOf = pictureOfDefault }) {
  const films = items.filter((i) => i.type === 'video' && i.film);
  const pictures = items.filter((i) => i.type === 'texture').map((i) => pictureOf(i)?.url);
  const uniq = (xs) => [...new Set(xs.filter(Boolean))];
  return { videos: play ? uniq(films.map((f) => f.film.url)) : [], posters: uniq([...films.map((f) => f.film.poster), ...pictures]) };
}

export function pictureSizes(items, frame, ratio, pictureOf = pictureOfDefault) {
  const out = {};
  for (const i of items) {
    const url = i.type === 'texture' ? pictureOf(i)?.url : i.type === 'video' ? i.film?.poster : null;
    if (!url) continue;
    const [w, h] = [i.w, i.h].map((v) => Math.round(v * frame.k * ratio));
    const was = out[url] ?? [0, 0];
    out[url] = [Math.max(was[0], w), Math.max(was[1], h)];
  }
  return out;
}

// The CRT trail's glow (paint.js's trailGlow): the parts of a trail
// container drawn in its key colour (the game's FrontendKeycolorGlow keys
// its palette's yellow: the focused tab's and tile's lines, words and line
// drawing), with the container's settings; null when nothing is keyed.
export function trailOf(items) {
  const keyed = items.filter((i) => i.trail?.keyColour && (i.colour === i.trail.keyColour || i.tint === i.trail.keyColour));
  return keyed.length ? { ...keyed[0].trail, items: keyed } : null;
}

export function splitGlow(items) {
  const base = [];
  const glow = [];
  for (const i of items) (i.blend === 'additive' ? glow : base).push(i);
  return { base, glow };
}

// The game blurs what is behind its panels (WSUIRenderingSettings'
// BackgroundBlurRadius, kernel 7 on its blur's buffer): a blur of 24 px at the
// frame's 1080 (hand: read from the captures), the browser's own, under the
// canvas. Then its blur-lightness pass (the UI shader's blurLightness
// permutation, bf2-re findings/53: out = Lightness · b^Contrast /
// (lum(b)^DynamicCurvature + DynamicLightness), MenuHighlightLightness 0.1,
// 0.9, 2, 10,000 on the scene's nits): whatever is bright behind a panel
// comes out about 0.1 of white whatever its own brightness (the pill lights
// as grey bars) and the dark next to nothing. On the room's display values
// that is about a third of them, the darks near black: `brightness`.
const FROST_PX = 24;
const FROST_LIGHT = 0.35;
export function frostOf(items, frame) {
  return items
    .filter((i) => i.fill === 'blurred' && i.w > 0 && i.h > 0)
    .map((i) => {
      const blur = `blur(${Math.round(FROST_PX * frame.k * 100) / 100}px) brightness(${FROST_LIGHT})`;
      return { id: i.id, style: { ...buttonStyle(i, frame), opacity: i.alpha ?? 1, backdropFilter: blur, WebkitBackdropFilter: blur } };
    });
}

export function createPainter({ ctx, read, fonts = null, raf = (f) => requestAnimationFrame(f), caf = (id) => cancelAnimationFrame(id) }) {
  let args = null;
  let result = null;
  let on = false;
  let frame = null;
  const asked = new Set();
  const repaint = () => {
    if (args) result = paint(ctx, args.items, { ...args, read });
    return result;
  };
  const tick = () => {
    frame = null;
    if (!on) return;
    repaint();
    frame = raf(tick);
  };
  return {
    draw(next) {
      args = next;
      repaint();
      // (a face the canvas has not drawn in yet: loaded, then the screen again)
      for (const f of fontsOf(next.items, next.frame.k, read)) {
        if (asked.has(f) || !fonts?.load) continue;
        asked.add(f);
        Promise.resolve(fonts.load(f))
          .then(() => repaint())
          .catch(() => {});
      }
      return result;
    },
    repaint,
    playing(now) {
      on = Boolean(now);
      if (on && frame === null) frame = raf(tick);
      if (!on && frame !== null) {
        caf(frame);
        frame = null;
      }
    },
    last: () => result,
    destroy() {
      on = false;
      if (frame !== null) caf(frame);
      args = null;
    },
  };
}
