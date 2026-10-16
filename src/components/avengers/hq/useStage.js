// A game's 3D view, made only when it's needed. A page has several games
// (the compound, each building's game, Titan; Invincible's world, its game
// and its viewer) and the runtime one renderer, which draws one world at a
// time: so there is one live view on the page at a time (useLive, below),
// the one most on screen once the scrolling settles, mounted on the runtime
// (useStage, through runtime/useWorld). It draws only while it's on screen;
// the others wait with their menus over a dark screen, their code fetched
// ahead as they come near.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useWorld } from '../../../runtime/useWorld';
import { runtime } from '../../../runtime/index';

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
// (with no view live, the first is picked at once: the settling is for
// not building one view after another as the page scrolls past them, and
// a page opening on its world waited it out for nothing)
const schedule = () => {
  clearTimeout(timer);
  timer = setTimeout(pick, current ? SETTLE : 0);
};
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__LIVE__ = { stages, get current() { return current; } };
}

// `active`: this one is the page's live 3D view; `visible`: it's on screen
export function useLive(ref, { id, enabled = true, warm }) {
  const [active, setActive] = useState(false);
  const [visible, setVisible] = useState(false);
  const warmRef = useRef(warm);
  warmRef.current = warm;
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return undefined;
    const key = `${id}:${Math.random().toString(36).slice(2)}`;
    const st = { ratio: 0, set: setActive };
    stages.set(key, st);
    // (no observer: every one as good as on screen, and still one at a time,
    // the first asked for)
    if (typeof IntersectionObserver === 'undefined') {
      st.ratio = 1;
      setVisible(true);
      schedule();
      return () => {
        stages.delete(key);
        if (current === key) {
          current = null;
          schedule();
        }
        setActive(false);
      };
    }
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

// A game's world module (./module.js) on the runtime, while it's the page's
// live view: { wrap (useLive's box), host (the screen the runtime's canvas
// goes in), view (the scene, while it's the runtime's world), status (idle |
// loading | on | failed | slow | lost), near, visible, retry, frame, rt,
// progress (its prepare's, for a loading screen) }.
// A view that failed, or was too slow (past the governor's floor, unless
// 3D was switched on outright), stays down until a retry; a lost one is the
// runtime's to bring back once (useWorld), and down after that.
export function useStage(module, { enabled, id, forced = false, options = null, props: more = null }) {
  const wrap = useRef(null);
  const frame = useRef(null); // the page's frame, run by the world's draw (useStageFrame)
  const [down, setDown] = useState(null); // failed | slow: down until a retry
  const [attempt, setAttempt] = useState(0);
  const forcedRef = useRef(forced);
  forcedRef.current = forced;

  // the page's live 3D view (make it), and on screen (draw it)
  const { active: near, visible } = useLive(wrap, { id, enabled: enabled && !down, warm: module.warm });
  // (what the world is made with: the page's frame, the scene's options, and
  // what a module's `first` reads; read as it's made)
  const moreRef = useRef(more);
  moreRef.current = more;
  const props = useMemo(() => ({ ...(moreRef.current ?? {}), frame, options }), [options]);
  const onEvent = useCallback((e) => {
    if (e.type === 'slow' && !forcedRef.current) setDown('slow');
  }, []);
  const mounting = Boolean(enabled && near && !down);
  const hostOf = useRef(null); // useWorld's ref to the box
  // (the box measured before the world is mounted: its start's sharpness
  // is the tier's pixels over it, ./module.js; this runs before useWorld's)
  useEffect(() => {
    const r = hostOf.current?.current?.getBoundingClientRect?.();
    if (mounting && r) module.measure?.(r.width, r.height);
  }, [mounting, module]);
  const world = useWorld(module, { props, enabled: mounting, onEvent, attempt });
  hostOf.current = world.host;
  const rt = world.rt;
  const mine = rt?.current?.module === module;
  useEffect(() => {
    if (world.status === 'failed' && rt?.failure?.world === module.id) setDown('failed');
  }, [world.status, rt, module]);
  let status = 'idle';
  if (down) status = down;
  else if (enabled && near) {
    if (world.status === 'on' && mine) status = 'on';
    else if (world.status === 'lost' && rt?.lostModule === module.id && !rt.recoverable) status = 'lost';
    else status = 'loading';
  }
  // the scene, while it's the runtime's world
  const view = useMemo(
    () => ({
      get current() {
        const c = typeof window !== 'undefined' ? runtime().current : null;
        return c?.module === module ? (c.world.view ?? null) : null;
      },
    }),
    [module],
  );
  const retry = useCallback(() => {
    setDown(null);
    setAttempt((n) => n + 1);
  }, []);
  return { wrap, host: world.host, view, status, near, visible, retry, frame, rt, progress: world.progress };
}

// The page's frame, run each frame by the world while `active` (the
// runtime's loop draws only while the world wants frames: none while the
// page's isn't drawing). `once(fn)`: one frame now, for a page that draws
// only when something changes (reduced motion).
export function useStageFrame(stage, tick, active) {
  const rt = stage.rt;
  // (set as each render is committed, never from a render React may drop)
  useLayoutEffect(() => {
    stage.frame.current = active ? tick : null;
  });
  useEffect(() => {
    if (active) rt?.invalidate();
  }, [active, rt]);
}
export function drawOnce(stage, fn) {
  stage.frame.once = fn;
  stage.rt?.invalidate();
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
