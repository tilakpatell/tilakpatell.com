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
// filmPlan(items, { play }) → { videos: [url], posters: [url] }
// createPainter({ ctx, read, fonts, raf, caf }) → { draw(args), repaint(),
//   playing(on), last(), destroy() }: `args` paint()'s, kept for the repaints

import { fontOf, paint } from '../../lib/bf2017/ui/paint';
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

export function filmPlan(items, { play }) {
  const films = items.filter((i) => i.type === 'video' && i.film);
  const uniq = (xs) => [...new Set(xs.filter(Boolean))];
  return { videos: play ? uniq(films.map((f) => f.film.url)) : [], posters: uniq(films.map((f) => f.film.poster)) };
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
