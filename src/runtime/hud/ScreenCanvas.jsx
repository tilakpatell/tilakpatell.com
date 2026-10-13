import { useEffect, useMemo, useRef, useState } from 'react';
import { device } from '../../lib/device';
import { mayPlay } from '../../lib/bf2017/films';
import { prefersReducedMotion } from '../../lib/hooks';
import { drawList, frameOf, navigables } from '../../lib/bf2017/ui/layout';
import { fitCanvas } from './canvas';
import { activate, buttonStyle, createPainter, filmPlan, keyOn } from './screenCanvas';
import './screenCanvas.css';

// One or more of the 2017 game's screens painted on one canvas (the
// 2026-10-13 canvas design): `layers`, trees screen() resolved at the
// game's 1920 × 1080, drawn in order (the main menu's header over its page)
// in the frame fitted to the window; an invisible button over each cell to
// press, walk with the keys and read with a screen reader, its focus and
// hover the cell's highlight as the game draws it. `values(box, path)`
// fills what the game's code fills; `active` are cells drawn selected
// without the focus (the open tab). `onLink(screen, cell)` when a linked
// cell is pressed, `onAction(name, cell)` for one without. The ways are
// ./screenCanvas.js's; this file only holds the canvas, the buttons and
// the films.
//
// <ScreenCanvas layers={[tree, …]} label values active onLink onAction />

const ownId = (id) => id.slice(id.indexOf(':') + 1);
const css = (name) => (typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(name));
const startSize = () => (typeof window === 'undefined' ? { width: 1920, height: 1080 } : { width: window.innerWidth || 1920, height: window.innerHeight || 1080 });

export default function ScreenCanvas({ layers, label = '', values = null, active = [], onLink = null, onAction = null, contextOf = (c) => c.getContext?.('2d') ?? null, fonts = typeof document === 'undefined' ? null : document.fonts, className = '', children = null }) {
  const root = useRef(null);
  const canvas = useRef(null);
  const painter = useRef(null);
  const media = useRef({});
  const buttons = useRef(new Map());
  const [win, setWin] = useState(startSize);
  const [focus, setFocus] = useState(null);
  const [hover, setHover] = useState(null);
  const frame = frameOf(win);
  const lit = [...active, focus, hover].filter(Boolean).join('|');
  const items = useMemo(() => drawList(layers, { selected: new Set(lit ? lit.split('|') : []), values }), [layers, values, lit]);
  const navs = useMemo(() => navigables(layers, { values }), [layers, values]);
  const plan = filmPlan(items, { play: mayPlay({ reduced: prefersReducedMotion(), saveData: Boolean(device().saveData) }) });
  const planKey = JSON.stringify(plan);

  // the painter, made once for the canvas (with the context and fonts it was first given)
  const made = useRef({ contextOf, fonts });
  useEffect(() => {
    const ctx = canvas.current ? made.current.contextOf(canvas.current) : null;
    if (ctx) painter.current = createPainter({ ctx, read: css, fonts: made.current.fonts });
    return () => painter.current?.destroy();
  }, []);

  // the box it fills, as it changes
  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const measure = () => setWin((w) => (el.clientWidth && el.clientHeight && (w.width !== el.clientWidth || w.height !== el.clientHeight) ? { width: el.clientWidth, height: el.clientHeight } : w));
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // a paint whenever what is drawn or where changed
  useEffect(() => {
    const c = canvas.current;
    const fit = c ? fitCanvas(c) : null;
    if (!painter.current || !fit) return;
    const r = painter.current.draw({ items, frame, window: win, ratio: fit.s, media: media.current });
    if (r) {
      c.dataset.paintMs = String(Math.round(r.ms * 100) / 100);
      c.dataset.missing = String(Object.values(r.skipped).reduce((a, b) => a + b, 0) + r.missing.shapes);
    }
  }); // (every render: the list or the window changed, or the media did)

  // the films: a poster each, a muted looping video each when films may play
  useEffect(() => {
    const { videos, posters } = JSON.parse(planKey);
    const made = [];
    const repaint = () => painter.current?.repaint();
    const playing = () => painter.current?.playing(made.some((m) => m instanceof HTMLVideoElement && !m.paused && m.readyState >= 2));
    for (const url of posters) {
      const img = new Image();
      img.decoding = 'async';
      img.onload = repaint;
      img.src = url;
      media.current[url] = img;
      made.push(img);
    }
    for (const url of videos) {
      const v = document.createElement('video');
      Object.assign(v, { muted: true, loop: true, playsInline: true, autoplay: true, preload: 'auto', crossOrigin: 'anonymous', src: url });
      v.addEventListener('playing', playing);
      v.addEventListener('pause', playing);
      v.play?.().catch(() => {});
      media.current[url] = v;
      made.push(v);
    }
    return () => {
      for (const m of made) {
        if (m instanceof HTMLVideoElement) {
          m.pause();
          m.removeAttribute('src');
          m.load();
        }
        m.onload = null;
      }
      painter.current?.playing(false);
      media.current = {};
    };
  }, [planKey]);

  const said = items.filter((i) => i.type === 'text' && i.text && !i.cell).map((i) => i.text);
  const firsts = new Set();
  return (
    <div ref={root} className={`hud-screen-canvas ${className}`.trim()} role="region" aria-label={label || undefined} data-screen={layers.at(-1)?.name}>
      <canvas ref={canvas} className="hud-screen-canvas-paint" aria-hidden="true" />
      {navs.map((n) => {
        const first = !firsts.has(n.group) && (firsts.add(n.group), true);
        return (
          <button
            key={n.id}
            ref={(el) => (el ? buttons.current.set(n.id, el) : buttons.current.delete(n.id))}
            type="button"
            className="hud-screen-hit"
            aria-label={n.label}
            data-id={ownId(n.id)}
            data-link={n.link ?? undefined}
            aria-disabled={n.coming || undefined}
            tabIndex={first ? 0 : -1}
            style={buttonStyle(n, frame)}
            onFocus={() => setFocus(n.id)}
            onBlur={() => setFocus((f) => (f === n.id ? null : f))}
            onPointerEnter={() => setHover(n.id)}
            onPointerLeave={() => setHover((h) => (h === n.id ? null : h))}
            onClick={() => activate(n, { onLink, onAction })}
            onKeyDown={(e) => {
              const r = keyOn(e, n, navs, { onLink, onAction });
              if (r?.focus) buttons.current.get(r.focus)?.focus();
            }}
          />
        );
      })}
      <div className="sr-only">
        {said.map((t, i) => (
          <p key={i}>{t}</p>
        ))}
      </div>
      {children}
    </div>
  );
}
