// A game's 3D view, made only when it's needed. The page has seven games, the
// map of the compound and Titan, and a phone (or a laptop) can't hold nine
// WebGL contexts, or build two while you scroll: so there is one live view on
// the page at a time (useLive, below), the one most on screen once the scrolling
// settles. It draws only while it's on screen; the others wait with their
// menus over a dark screen, their code fetched ahead as they come near.
import { useCallback, useEffect, useRef, useState } from 'react';
import { settle } from '../../../lib/settle';

// ── one live 3D view on the page ──
const SETTLE = 240; // ms of quiet scrolling before a view is built
const stages = new Map(); // key → { ratio, set(active) }
let current = null;
let timer = 0;

function pick() {
  timer = 0;
  let best = null;
  let bestR = 0;
  for (const [k, st] of stages) {
    if (st.ratio > bestR) {
      best = k;
      bestR = st.ratio;
    }
  }
  const cur = current && stages.get(current);
  // the live view keeps it while it's still well in sight, unless another is clearly more so
  if (cur && cur.ratio >= 0.2 && bestR < Math.max(0.5, cur.ratio + 0.15)) return;
  if (!best || bestR < 0.3 || best === current) return;
  cur?.set(false);
  current = best;
  stages.get(best).set(true);
}
const schedule = () => {
  clearTimeout(timer);
  timer = setTimeout(pick, SETTLE);
};
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__LIVE__ = { stages, get current() { return current; } };
}

// A view's pictures sent, its shaders linked and everything drawn once
// before its first frame (hq/engine's prepare, a slice at a time), so drawing
// it doesn't stall the page; twelve seconds at most (a view without it: its
// shaders, four), never a failure, and cut short once `alive()` says it's
// been left, or the twelve seconds are up (so it never runs on alongside the
// game's own frames).
export const warmed = async (v, alive = () => true) => {
  if (!v?.engine?.prepare) return settle(v?.engine?.precompile?.(), 4000);
  let capped = false;
  await settle(v.engine.prepare(null, { alive: () => !capped && alive() }), 12000);
  capped = true;
};

// `active`: this one is the page's live 3D view; `visible`: it's on screen
export function useLive(ref, { id, enabled = true, warm }) {
  const [active, setActive] = useState(false);
  const [visible, setVisible] = useState(false);
  const warmRef = useRef(warm);
  warmRef.current = warm;
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setActive(true);
      setVisible(true);
      return undefined;
    }
    const key = `${id}:${Math.random().toString(36).slice(2)}`;
    const st = { ratio: 0, set: setActive };
    stages.set(key, st);
    const seen = new IntersectionObserver(
      ([e]) => {
        st.ratio = e.isIntersecting ? e.intersectionRatio : 0;
        setVisible(e.intersectionRatio >= 0.12);
        schedule();
      },
      { threshold: [0, 0.12, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] },
    );
    // its code, fetched as it comes within a screen (not built)
    let warmed = false;
    const near = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || warmed) return;
        warmed = true;
        warmRef.current?.()?.catch?.(() => {});
      },
      { rootMargin: '100% 0px 100% 0px' },
    );
    seen.observe(el);
    near.observe(el);
    return () => {
      seen.disconnect();
      near.disconnect();
      stages.delete(key);
      if (current === key) {
        current = null;
        schedule();
      }
      setActive(false);
    };
  }, [ref, id, enabled]);
  return { active: enabled && active, visible };
}

export function useStage(load, { enabled, id, forced = false }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const view = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | loading | on | failed | slow | lost
  const [attempt, setAttempt] = useState(0);
  const failed = useRef(false); // a view that failed stays failed until a retry
  const loadRef = useRef(load);
  loadRef.current = load;
  // a visitor who switched 3D on keeps it on, however slow: quality drops instead
  const forcedRef = useRef(forced);
  forcedRef.current = forced;

  // the page's live 3D view (make it), and on screen (draw it)
  const { active: near, visible } = useLive(wrap, { id, enabled, warm: load });

  useEffect(() => {
    if (!enabled || !near || failed.current) {
      setStatus((s) => (s === 'on' || s === 'loading' ? 'idle' : s));
      return undefined;
    }
    let dead = false;
    const drop = (why) => {
      view.current?.dispose();
      view.current = null;
      failed.current = true;
      if (!dead) setStatus(why);
    };
    setStatus('loading');
    loadRef
      .current()
      .then(async (mod) => {
        if (dead || !canvas.current) return;
        try {
          const v = await mod.create(canvas.current, { onLost: () => drop('lost'), onSlow: () => !forcedRef.current && drop('slow') });
          if (dead) {
            v.dispose();
            return;
          }
          await warmed(v, () => !dead);
          if (dead || failed.current) {
            v.dispose();
            return;
          }
          view.current = v;
          const r = wrap.current?.querySelector('.hq-screen')?.getBoundingClientRect();
          if (r) v.resize(r.width, r.height);
          setStatus('on');
        } catch (err) {
          if (import.meta.env.DEV) console.error(`[${id}] 3D failed`, err);
          drop('failed');
        }
      })
      .catch(() => drop('failed'));
    return () => {
      dead = true;
      view.current?.dispose();
      view.current = null;
    };
  }, [enabled, near, attempt, id]);

  // keep the view the size of its screen
  useEffect(() => {
    const el = wrap.current?.querySelector('.hq-screen');
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => view.current?.resize(e.contentRect.width, e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [status]);

  const retry = useCallback(() => {
    failed.current = false;
    setStatus('idle');
    setAttempt((n) => n + 1);
  }, []);

  return { wrap, canvas, view, status, near, visible, retry };
}

// For the browser checks: each game, its state and its view, in development.
export function register(id, api) {
  if (!import.meta.env.DEV || typeof window === 'undefined') return () => {};
  window.__HQ__ = window.__HQ__ ?? {};
  window.__HQ__[id] = api;
  return () => {
    if (window.__HQ__?.[id] === api) delete window.__HQ__[id];
  };
}
