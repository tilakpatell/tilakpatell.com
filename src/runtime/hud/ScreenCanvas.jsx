import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { device } from '../../lib/device';
import { mayPlay } from '../../lib/bf2017/films';
import { prefersReducedMotion } from '../../lib/hooks';
import { drawList, frameOf, navigables } from '../../lib/bf2017/ui/layout';
import { fitCanvas } from './canvas';
import { activate, buttonStyle, createPainter, filmPlan, frostOf, keyOn, splitGlow } from './screenCanvas';
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
  const uid = useId();
  const root = useRef(null);
  const canvas = useRef(null);
  const glowCanvas = useRef(null);
  // (two painters: the base, and what the game adds onto what is under it, on its own canvas)
  const painters = useRef([]);
  const each = (fn) => painters.current.forEach(fn);
  const media = useRef({});
  const buttons = useRef(new Map());
  const [win, setWin] = useState(startSize);
  const [focus, setFocus] = useState(null);
  const [hover, setHover] = useState(null);
  const frame = frameOf(win);
  const lit = [focus, hover].filter(Boolean).join('|');
  const opened = active.join('|');
  const items = useMemo(() => drawList(layers, { selected: new Set(lit ? lit.split('|') : []), open: new Set(opened ? opened.split('|') : []), values }), [layers, values, lit, opened]);
  const navs = useMemo(() => navigables(layers, { values }), [layers, values]);
  const plan = filmPlan(items, { play: mayPlay({ reduced: prefersReducedMotion(), saveData: Boolean(device().saveData) }) });
  const planKey = JSON.stringify(plan);

  // the painters, made once for the canvases (with the context and fonts they were first given)
  const made = useRef({ contextOf, fonts });
  useEffect(() => {
    painters.current = [canvas.current, glowCanvas.current].map((c) => {
      const ctx = c ? made.current.contextOf(c) : null;
      return ctx ? { c, p: createPainter({ ctx, read: css, fonts: made.current.fonts }) } : null;
    });
    return () => painters.current.forEach((x) => x?.p.destroy());
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
    const { base, glow } = splitGlow(items);
    let ms = 0;
    let missing = 0;
    [base, glow].forEach((list, i) => {
      const x = painters.current[i];
      const fit = x ? fitCanvas(x.c) : null;
      if (!fit) return;
      const r = x.p.draw({ items: list, frame, window: win, ratio: fit.s, media: media.current, frost: true });
      if (!r) return;
      ms += r.ms;
      missing += Object.values(r.skipped).reduce((a, b) => a + b, 0) + r.missing.shapes + r.missing.textures;
    });
    if (canvas.current) Object.assign(canvas.current.dataset, { paintMs: String(Math.round(ms * 100) / 100), missing: String(missing) });
  }); // (every render: the list or the window changed, or the media did)

  // the films: a poster each, a muted looping video each when films may play
  useEffect(() => {
    const { videos, posters } = JSON.parse(planKey);
    const made = [];
    const repaint = () => each((x) => x?.p.repaint());
    const playing = () => {
      const on = made.some((m) => m instanceof HTMLVideoElement && !m.paused && m.readyState >= 2);
      each((x) => x?.p.playing(on));
    };
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
      each((x) => x?.p.playing(false));
      media.current = {};
    };
  }, [planKey]);

  const said = items.filter((i) => i.type === 'text' && i.text && !i.cell).map((i) => i.text);
  // a cell's other words (a tile's description): its button's description
  const about = new Map();
  for (const i of items) if (i.type === 'text' && i.text && i.cell) about.set(i.cell, [...(about.get(i.cell) ?? []), i.text]);
  const describe = navs.map((n, k) => ({ n, id: `${uid}-d${k}`, words: (about.get(n.id) ?? []).filter((t) => t !== n.label) })).filter((d) => d.words.length);
  const describedBy = new Map(describe.map((d) => [d.n.id, d.id]));
  const firsts = new Set();
  return (
    <div ref={root} className={`hud-screen-canvas ${className}`.trim()} role="region" aria-label={label || undefined} data-screen={layers.at(-1)?.name} data-layers={layers.map((l) => l?.name).join(' ')}>
      {/* (what the game blurs behind its panels: the browser's blur, under the canvas) */}
      {frostOf(items, frame).map((f) => (
        <div key={f.id} className="hud-screen-frost" style={f.style} aria-hidden="true" />
      ))}
      <canvas ref={canvas} className="hud-screen-canvas-paint" aria-hidden="true" />
      <canvas ref={glowCanvas} className="hud-screen-canvas-paint hud-screen-canvas-glow" aria-hidden="true" />
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
            aria-describedby={describedBy.get(n.id)}
            aria-disabled={n.coming || undefined}
            data-coming={n.coming || undefined}
            data-tile={n.tile ? ownId(n.id).slice(ownId(n.id).lastIndexOf('/') + 1) : undefined}
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
        {describe.map((d) => (
          <p key={d.id} id={d.id}>
            {d.words.join(' ')}
          </p>
        ))}
      </div>
      {children}
    </div>
  );
}
