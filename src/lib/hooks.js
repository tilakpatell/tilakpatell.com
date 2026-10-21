import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePageActive } from './page';

const matches = (query) => typeof window !== 'undefined' && (window.matchMedia?.(query).matches ?? false);

// Motion is calmed when the system asks, or when the visitor asks on the
// site: Settings, Motion: Reduced puts html[data-motion='reduced'] (and the
// page's first script puts it back on a return visit, before anything reads it).
const askedOnSite = () => typeof document !== 'undefined' && document.documentElement?.dataset?.motion === 'reduced';
export const prefersReducedMotion = () => matches('(prefers-reduced-motion: reduce)') || askedOnSite();

// Whether a media query matches, kept up to date as it changes.
export function useMediaQuery(query) {
  const [on, setOn] = useState(() => matches(query));
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return undefined;
    const update = () => setOn(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, [query]);
  return on;
}

// One watcher on <html> for every component that asks, made with the first
// and let go with the last.
const askers = new Set();
let watcher = null;
export function watchAskedOnSite(fn) {
  askers.add(fn);
  if (!watcher && typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
    watcher = new MutationObserver(() => askers.forEach((f) => f()));
    watcher.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  }
  return () => {
    askers.delete(fn);
    if (!askers.size && watcher) {
      watcher.disconnect();
      watcher = null;
    }
  };
}

// Whether motion is calmed, kept up to date as either setting changes.
export function useReducedMotion() {
  const system = useMediaQuery('(prefers-reduced-motion: reduce)');
  const site = useSyncExternalStore(watchAskedOnSite, askedOnSite, () => false);
  return system || site;
}

// Whether the page is showing (not in a hidden tab): onChange(showing) now
// and on every change; returns the way to stop watching.
export function watchVisible(doc, onChange) {
  const update = () => onChange(!doc.hidden);
  update();
  doc.addEventListener('visibilitychange', update);
  return () => doc.removeEventListener('visibilitychange', update);
}
export function usePageVisible() {
  const [showing, setShowing] = useState(() => typeof document === 'undefined' || !document.hidden);
  useEffect(() => watchVisible(document, setShowing), []);
  return showing;
}

// Visible-in-viewport flag. `once` keeps it true after the first sighting.
export function useInView({ once = false, rootMargin = '0px 0px -10% 0px', threshold = 0 } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { rootMargin, threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, rootMargin, threshold]);
  return [ref, inView];
}

// Dims the arrow of a sideways-scrolling row that has nowhere left to go: the
// "earlier" arrow while the row's first item is in full view, the "more" arrow
// while its last one is. It watches those two items against the row itself, so
// nothing runs while the row scrolls, and it writes aria-disabled straight to
// the buttons, so reaching an end costs no React re-render of the row.
export function useRowEnds(row, earlier, more) {
  useEffect(() => {
    const el = row.current;
    const first = el?.firstElementChild;
    const last = el?.lastElementChild;
    if (!first || first === last || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) (e.target === first ? earlier : more).current?.setAttribute('aria-disabled', String(e.intersectionRatio >= 0.9));
      },
      { root: el, threshold: 0.9 },
    );
    io.observe(first);
    io.observe(last);
    return () => io.disconnect();
  }, [row, earlier, more]);
}

// In the feed (components/feed) several pages are mounted at once; only the
// one on the address sets the tab's title.
export function useDocumentTitle(title) {
  const active = usePageActive();
  useEffect(() => {
    if (active) document.title = title ? `${title} | Tilak Patel` : 'Tilak Patel | TPM & Software Engineer';
  }, [title, active]);
}

// Runs `tick(dt, now)` every animation frame while `active`; pauses when the tab is hidden.
export function useFrameLoop(tick, active) {
  const tickRef = useRef(tick);
  tickRef.current = tick;
  useEffect(() => {
    if (!active) return undefined;
    let raf = 0;
    let last = 0;
    const loop = (now) => {
      const dt = last ? Math.min(50, now - last) : 16;
      last = now;
      tickRef.current(dt, now);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!raf && !document.hidden) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVis = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [active]);
}

// Steps through a scripted sequence on a timer while `active` (for the project stages).
export function useScript(steps, active, { loop = true } = {}) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const step = steps[index];
    if (!step) return undefined;
    const t = setTimeout(() => {
      setIndex((i) => (i + 1 < steps.length ? i + 1 : loop ? 0 : i));
    }, step.ms);
    return () => clearTimeout(t);
  }, [index, active, steps, loop]);
  return [index, setIndex];
}

export const storage = {
  get(key, fallback = null) {
    try {
      const v = window.sessionStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
  },
};

// Like `storage`, but kept across visits.
export const local = {
  get(key, fallback = null) {
    try {
      const v = window.localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
  },
};
