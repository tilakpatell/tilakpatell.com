import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { DEFAULT_THEME, THEMES, routeTheme } from './themes';
import { CUSTOM_DEFAULT, CUSTOM_KEY, customTokens, isHex } from './custom';
import { usePageActive } from '../lib/page';

const ThemeTransition = lazy(() => import('../components/ThemeTransition'));

// Fan themes bring their own type (see the end of styles/extras.css, and the
// Caribbean’s and Middle-earth’s own sheets beside it). The fonts load the
// first time their theme is on, not before.
const both = (...loaders) => () => Promise.all(loaders.map((l) => l()));
const newsCycle = both(
  () => import('@fontsource/news-cycle/400.css'),
  () => import('@fontsource/news-cycle/700.css'),
);
const cinzel = both(
  () => import('@fontsource/cinzel/600.css'),
  () => import('@fontsource/cinzel/700.css'),
  () => import('@fontsource/cinzel-decorative/700.css'),
);
const pirate = () => import('../components/caribbean/fonts.css');
const orbitron = both(
  () => import('@fontsource/orbitron/600.css'),
  () => import('@fontsource/orbitron/800.css'),
);
const THEME_FONTS = {
  jedi: newsCycle,
  sith: newsCycle,
  stark: () => import('@fontsource/bebas-neue/400.css'),
  dunder: both(
    () => import('@fontsource/courier-prime/400.css'),
    () => import('@fontsource/courier-prime/700.css'),
  ),
  arcade: () => import('@fontsource/press-start-2p/400.css'),
  raga: () => import('@fontsource/yatra-one/400.css'),
  tortuga: pirate,
  pearl: pirate,
  dutchman: pirate,
  shire: cinzel,
  mordor: cinzel,
  optimus: orbitron,
  megatron: orbitron,
  bumblebee: orbitron,
  shockwave: orbitron,
  soundwave: orbitron,
  portal: () => import('@fontsource/luckiest-guy/400.css'),
  morty: () => import('@fontsource/luckiest-guy/400.css'),
  summer: () => import('@fontsource/luckiest-guy/400.css'),
  beth: () => import('@fontsource/luckiest-guy/400.css'),
};

// One active theme re-skins the whole site. It flows on its own — AWS by
// default, the company whose chapter is on screen on the Experience page, and
// each project's own theme on its page — unless the visitor pins a company
// from the dots in the nav. Light or dark mode is remembered.

const PIN_KEY = 'tp-theme-pin';
const SEEN_KEY = 'tp-themes-seen';
const MODE_KEY = 'tp-mode';

const session = {
  get(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value == null) window.sessionStorage.removeItem(key);
      else window.sessionStorage.setItem(key, value);
    } catch {
      /* storage unavailable */
    }
  },
};

const ThemeContext = createContext(null);
// The setter lives in its own context so pages that drive the theme don't
// re-render every time it changes.
const ThemeSetterContext = createContext(() => {});

export function ThemeProvider({ children }) {
  const { pathname } = useLocation();
  const [scrollTheme, setScrollTheme] = useState(null);
  const [pinned, setPinned] = useState(() => {
    const saved = session.get(PIN_KEY);
    return saved && THEMES[saved] ? saved : null;
  });
  const [mode, setMode] = useState(() => (document.documentElement.dataset.mode === 'dark' ? 'dark' : 'light'));
  const [seen, setSeen] = useState(() => {
    try {
      return new Set(JSON.parse(session.get(SEEN_KEY) || '[]'));
    } catch {
      return new Set();
    }
  });

  const active = pinned || scrollTheme || routeTheme(pathname) || DEFAULT_THEME;

  // A new page starts from its own theme until one of its sections takes over.
  useEffect(() => {
    setScrollTheme(null);
  }, [pathname]);

  useEffect(() => {
    THEME_FONTS[active]?.().catch(() => {});
  }, [active]);

  useEffect(() => {
    const root = document.documentElement;
    // Switch instantly: suppress every colour transition for one frame so a
    // theme change is a single restyle, not hundreds of animations.
    root.classList.add('theme-switching');
    root.dataset.theme = active;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
    setSeen((prev) => {
      if (prev.has(active)) return prev;
      const next = new Set(prev).add(active);
      session.set(SEEN_KEY, JSON.stringify([...next]));
      return next;
    });
    return () => cancelAnimationFrame(raf);
  }, [active]);

  // The browser’s bar wears the page’s colour, read from <html> once the new
  // colours have landed (after the two switching frames above); the house
  // paper or night if a colour gives no --bg.
  useEffect(() => {
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || (mode === 'dark' ? '#09090b' : '#fdfdfc'));
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [active, mode]);

  // Until the visitor picks a mode, follow the system's light or dark setting.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return undefined;
    const onChange = (e) => {
      try {
        if (window.localStorage.getItem(MODE_KEY)) return;
      } catch {
        /* storage unavailable */
      }
      const next = e.matches ? 'dark' : 'light';
      document.documentElement.dataset.mode = next;
      setMode(next);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // A theme picked by hand gets its moment: a short scene, a line and a sound.
  const [switching, setSwitching] = useState(null);
  const pinnedRef = useRef(pinned);
  pinnedRef.current = pinned;
  const pin = useCallback((id) => {
    const next = id && THEMES[id] ? id : null;
    if (next && next !== pinnedRef.current) setSwitching({ id: next, key: Date.now() });
    setPinned(next);
    session.set(PIN_KEY, next);
  }, []);

  const toggleMode = useCallback(() => {
    setMode((m) => {
      const next = m === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.mode = next;
      try {
        window.localStorage.setItem(MODE_KEY, next);
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  // The visitor's own colour: kept across visits, applied as CSS variables.
  const [customColor, setCustomColorState] = useState(() => {
    try {
      const saved = window.localStorage.getItem(CUSTOM_KEY);
      return isHex(saved) ? saved : CUSTOM_DEFAULT;
    } catch {
      return CUSTOM_DEFAULT;
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    Object.entries(customTokens(customColor)).forEach(([k, v]) => root.style.setProperty(k, v));
  }, [customColor]);
  const setCustomColor = useCallback(
    (hex) => {
      if (!isHex(hex)) return;
      setCustomColorState(hex);
      try {
        window.localStorage.setItem(CUSTOM_KEY, hex);
      } catch {
        /* storage unavailable */
      }
      pin('custom');
    },
    [pin],
  );

  const value = useMemo(
    () => ({ active, theme: THEMES[active], pinned, pin, setScrollTheme, seen, mode, toggleMode, customColor, setCustomColor }),
    [active, pinned, pin, seen, mode, toggleMode, customColor, setCustomColor],
  );
  return (
    <ThemeSetterContext.Provider value={setScrollTheme}>
      <ThemeContext.Provider value={value}>
        {children}
        {switching && (
          <Suspense fallback={null}>
            <ThemeTransition key={switching.key} id={switching.id} onDone={() => setSwitching(null)} />
          </Suspense>
        )}
      </ThemeContext.Provider>
    </ThemeSetterContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext);

// Auto theming for a page: whichever [data-theme-section] crosses the middle of
// the screen sets the site's colours. Given the page's root, it watches only
// that page's sections; in the feed (components/feed), where several pages are
// mounted at once, only the page on the address watches.
// eslint-disable-next-line react-refresh/only-export-components
export function useSectionThemes(containerRef) {
  const setScrollTheme = useContext(ThemeSetterContext);
  const { pathname } = useLocation();
  const active = usePageActive();
  useEffect(() => {
    if (!active) return undefined;
    const root = containerRef?.current ?? document;
    const sections = [...root.querySelectorAll('[data-theme-section]')];
    if (!sections.length || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setScrollTheme(e.target.dataset.themeSection || null);
      },
      { rootMargin: '-50% 0px -50% 0px' },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [setScrollTheme, pathname, active, containerRef]);
}
