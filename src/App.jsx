import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { HashRouter, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { ThemeProvider } from './theme/ThemeProvider';
import { AchievementProvider, useAchievements } from './components/Achievements';
import { FunProvider } from './fun/FunProvider';
import OnlineProvider from './components/universe/online/OnlineProvider';
import EconomyProvider from './components/universe/EconomyProvider';
import ErrorBoundary from './components/ErrorBoundary';
import Nav from './components/Nav';
import Footer from './components/Footer';
import ScrollSaber from './components/ScrollSaber';
import Guide from './components/Guide';
import TourHost from './components/tour/TourHost';
// fetches the 3D jump ahead of time (the intro's, and three.js once a page has it)
import './components/hyperspace3d/load';
import { audioContext } from './lib/audio';
import { local, prefersReducedMotion } from './lib/hooks';
import { VISITED_KEY, addVisited } from './lib/visited';
import { isPaletteKey } from './lib/palette';
import { guideKeyFor } from './components/guide/routes';
import { introPlaying } from './lib/stale';
import { jumpStyle } from './components/jumps/styles';
import WorldGate from './components/worlds/WorldGate';
import Ambience from './components/ambience/Ambience';
import { categoryAt, isFeedMove } from './components/feed/feed';
import SettingsHost from './components/settings/SettingsHost';

// Feed.jsx, named in full: feed.js sits beside it, and a case-blind disk
// (Windows, macOS) would pick that
const Feed = lazy(() => import('./components/feed/Feed.jsx'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const Caribbean = lazy(() => import('./pages/Caribbean'));
const Invincible = lazy(() => import('./pages/Invincible'));
const Terminal = lazy(() => import('./pages/Terminal'));
const DeathStar = lazy(() => import('./pages/DeathStar'));
const DeathStarInside = lazy(() => import('./pages/DeathStarInside'));
const Galaxy = lazy(() => import('./pages/Galaxy'));
const GalaxyMission = lazy(() => import('./pages/GalaxyMission'));
const GalaxySurface = lazy(() => import('./pages/GalaxySurface'));
const Music = lazy(() => import('./pages/Music'));
const MiddleEarth = lazy(() => import('./pages/MiddleEarth'));
const Scranton = lazy(() => import('./pages/Scranton'));
const Avengers = lazy(() => import('./pages/Avengers'));
const Cybertron = lazy(() => import('./pages/Cybertron'));
const Albuquerque = lazy(() => import('./pages/Albuquerque'));
const RickMorty = lazy(() => import('./pages/RickMorty'));
const Citadel = lazy(() => import('./pages/Citadel'));
const RmPlanet = lazy(() => import('./pages/RmPlanet'));
const DotMatrix = lazy(() => import('./pages/DotMatrix'));
const Mario64 = lazy(() => import('./pages/Mario64'));
const Minecraft = lazy(() => import('./pages/Minecraft'));
const Fly = lazy(() => import('./pages/Fly')); // planet flight (scripts/flight-island.mjs removes this row)
const Earth = lazy(() => import('./pages/Earth'));
const Battlefront = lazy(() => import('./pages/Battlefront'));
const Front = lazy(() => import('./pages/Front'));
const Changes = lazy(() => import('./pages/Changes'));
const Worlds = lazy(() => import('./pages/Worlds'));
const Dickansh = lazy(() => import('./pages/Dickansh'));
const NotFound = lazy(() => import('./pages/NotFound'));
const CommandPalette = lazy(() => import('./components/CommandPalette'));
const Hyperspace = lazy(() => import('./components/Hyperspace'));
// and the crews' own ways across the universe map (components/jumps/styles.js)
const PortalJump = lazy(() => import('./components/jumps/PortalJump'));
const BlueSkyJump = lazy(() => import('./components/jumps/BlueSkyJump'));
const JUMPS = { hyper: Hyperspace, portal: PortalJump, bluesky: BlueSkyJump };

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

function ScrollToTop() {
  const location = useLocation();
  const navType = useNavigationType();
  const { pathname, search } = location;
  // the feed (components/feed) moves the address as you scroll: not a new page
  const feed = isFeedMove(location, navType);
  // a link to one role (/experience/aws) lands on that role, not the top
  const top = !feed && !search.includes('role=') && !/^\/(experience|universe)\/[^/]+$/.test(pathname);
  // Both only on a new path, read through a ref: a page's own search params
  // (a filter, a tab) change neither. As dependencies, a filter picked after
  // the feed had moved the address flipped them, which threw the visitor to
  // the top of the feed (the page it started on) and stopped the page's music.
  const now = useRef({ top, feed });
  now.current = { top, feed };
  useEffect(() => {
    if (now.current.top) window.scrollTo(0, 0);
  }, [pathname]);
  // a page's music and lines stop when you leave it
  useEffect(() => {
    if (!now.current.feed) import('./lib/clips').then((c) => c.stopPageClips());
  }, [pathname]);
  // every page shown, the feed's included, for the guide's checklist: the
  // page, and its guide's key when that's another (a place in a world ticks
  // the world's things; a project still ticks its own)
  useEffect(() => {
    // ('/' is the front door, which may be the map or send you to /home: not a visit to the map)
    const key = pathname === '/' ? null : guideKeyFor(pathname);
    let list = addVisited(local.get(VISITED_KEY, []), pathname);
    if (key && key !== pathname) list = addVisited(list, key);
    local.set(VISITED_KEY, list);
  }, [pathname]);
  return null;
}

// ↑ ↑ ↓ ↓ ← → ← → B A — jump to lightspeed. The tp:hyperspace event plays
// the same, or, by the style in its detail (components/jumps/styles.js), a
// crew's own way across the universe map: Rick's portal, Walt and Jesse's
// Blue Sky. With reduced motion every one of them is the site's crossfade.
// A page that changes under the jump says what to do once it's dark (the
// event's onPeak): it's called at the jump's flash, or at its end, or when
// another jump takes its place, whichever is first, and the event is marked
// `taken` so the page knows it will be.
function Lightspeed() {
  const { unlock } = useAchievements();
  const [on, setOn] = useState(0);
  const [style, setStyle] = useState('hyper');
  const seq = useRef([]);
  const waiting = useRef(null); // the page's onPeak, till it's called
  const peak = useCallback(() => {
    const fn = waiting.current;
    waiting.current = null;
    fn?.();
  }, []);
  useEffect(() => {
    const jump = (e) => {
      audioContext(); // inside the key press, so the sound may play
      peak(); // (one jump taking another's place: whoever waited on that one goes now)
      if (typeof e?.detail?.onPeak === 'function') {
        waiting.current = e.detail.onPeak;
        e.detail.taken = true;
      }
      setStyle(prefersReducedMotion() ? 'hyper' : jumpStyle(e?.detail?.style));
      setOn(Date.now());
    };
    const onKey = (e) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      seq.current = [...seq.current, e.key.length === 1 ? e.key.toLowerCase() : e.key].slice(-KONAMI.length);
      if (seq.current.join() === KONAMI.join()) {
        seq.current = [];
        unlock('konami');
        jump();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('tp:hyperspace', jump);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('tp:hyperspace', jump);
    };
  }, [unlock, peak]);
  if (!on) return null;
  const Jump = JUMPS[style] ?? Hyperspace;
  return (
    <Suspense fallback={null}>
      <Jump
        key={on}
        sound
        onPeak={peak}
        onDone={() => {
          peak();
          setOn(0);
        }}
      />
    </Suspense>
  );
}

// A first visit to the site opens on a welcome (what the site is, what the
// intro does, and whose worlds these are; Skip goes straight to the front
// door), then the crawl, then puts you in a cockpit
// (the Falcon first; the X-wing, Rick's cruiser and the RV a click away),
// and the launch comes out at the front door's choice over the universe
// map, where everything is laid out as places to fly to. The inline script
// in index.html decides (and covers the page until it starts). The map and
// the cockpit load during the crawl; the map stays still under the crawl
// and the cockpit (html[data-covered], see lib/three/useScene) and comes on
// at the launch's flash. ⌘K's "Back to the cockpit" plays it again.
const OpeningCrawl = lazy(() => import('./components/experience/OpeningCrawl'));
const Cockpit = lazy(() => import('./components/cockpit/Cockpit'));
const Welcome = lazy(() => import('./components/cockpit/Welcome'));
const cover = (on) => {
  const el = document.documentElement;
  if (on) el.dataset.covered = '';
  else if ('covered' in el.dataset) {
    delete el.dataset.covered;
    window.dispatchEvent(new Event('tp:uncover'));
  }
};
function IntroJump() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [stage, setStage] = useState(() => (document.documentElement.dataset.intro === '1' ? 'welcome' : null));
  const [ride, setRide] = useState(null); // a replay: { vehicle }, or null for the first visit
  useEffect(() => {
    if (!stage) return;
    try {
      window.localStorage.setItem('tp-intro', '1');
    } catch {
      /* storage unavailable */
    }
    if (stage === 'welcome' || stage === 'crawl') {
      import('./components/experience/OpeningCrawl');
      import('./pages/Front');
      import('./components/universe/scene');
      // (the crew, the biggest part, once the crawl's begun: the welcome may yet be skipped)
      import('./components/cockpit/load').then((m) => m.preloadCockpit('falcon', { crew: stage === 'crawl' }));
    }
  }, [stage]);
  useEffect(() => {
    cover(stage === 'welcome' || stage === 'crawl' || stage === 'cockpit');
    return () => cover(false);
  }, [stage]);
  // (a reload for the new build in the middle of a first visit's intro plays it again: lib/stale)
  useEffect(() => introPlaying(Boolean(stage) && !ride), [stage, ride]);
  // ⌘K: back to the cockpit, from anywhere
  useEffect(() => {
    const again = (e) => {
      if (stage) return;
      import('./components/cockpit/load').then((m) => m.preloadCockpit(e.detail?.vehicle));
      setRide({ vehicle: e.detail?.vehicle ?? null });
      setStage('cockpit');
    };
    window.addEventListener('tp:cockpit', again);
    return () => window.removeEventListener('tp:cockpit', again);
  }, [stage]);
  const closeCrawl = useCallback(() => {
    // keep the page covered until the cockpit's first frame
    document.documentElement.dataset.intro = '1';
    setStage('cockpit');
  }, []);
  if (!stage) return null;
  if (stage === 'welcome')
    return (
      <Suspense fallback={null}>
        <Welcome
          onStart={() => setStage('crawl')}
          onSkip={() => {
            setStage(null);
            // to the front door's choice, as the launch would have come out
            requestAnimationFrame(() => document.querySelector('.start-choice button')?.focus({ preventScroll: true }));
          }}
        />
      </Suspense>
    );
  if (stage === 'crawl')
    return (
      <Suspense fallback={null}>
        <OpeningCrawl variant="intro" onClose={closeCrawl} />
      </Suspense>
    );
  return (
    <Suspense fallback={null}>
      <Cockpit
        start={ride?.vehicle ?? undefined}
        onPeak={() => {
          // out into the universe (the front door is it, unless a visitor
          // asked for the home page), flying the ship you launched in
          if (!/^\/(universe(\/|$)|$)/.test(pathname)) navigate('/universe');
          cover(false);
        }}
        onDone={() => {
          setStage(null);
          setRide(null);
        }}
      />
    </Suspense>
  );
}

// The intro has a boundary of its own: a file of it gone after a deploy (the
// cockpit's, asked for as the crawl ends) reloads for the new build
// (ErrorBoundary), and anything else in it puts you in the site, uncovered,
// instead of blanking the page.
function IntroGone() {
  useEffect(() => {
    delete document.documentElement.dataset.intro;
  }, []);
  return null;
}

// ⌘K / Ctrl+K anywhere, or the search button in the nav. Its file is
// fetched the first time it opens: gone after a deploy, that reloads for the
// new build (ErrorBoundary), and anything else wrong in it just closes it,
// so ⌘K can try again, instead of blanking the page.
function Shut({ onClose }) {
  useEffect(() => onClose(), [onClose]);
  return null;
}
function PaletteHost() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    const onKey = (e) => {
      if (isPaletteKey(e)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('tp:palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('tp:palette', onOpen);
    };
  }, []);
  if (!open) return null;
  return (
    <ErrorBoundary fallback={<Shut onClose={close} />}>
      <Suspense fallback={null}>
        <CommandPalette onClose={close} />
      </Suspense>
    </ErrorBoundary>
  );
}

// The universe map is the front door (/) and keeps one page while its URL
// follows the selection (/universe/marvel). Both routes render the same
// element (Front, which holds the map), so React keeps the one map across
// them: picking a planet at /, or the wordmark from /universe/marvel, moves
// the camera instead of building the universe again. Middle-earth's places
// (/middle-earth/moria) keep one page the same way, so its map stays up,
// and so do the galaxy's systems (/galaxy/hoth), so a jump from one to the
// next keeps the one scene (its missions' briefings are pages of their own).
// The portfolio's six pages are one feed (components/feed): reach the end of
// one and the next begins under it, with the address following the scroll, so
// they share a key too.
const pageKey = (pathname) =>
  pathname === '/' || pathname.startsWith('/universe')
    ? '/universe'
    : pathname.startsWith('/middle-earth')
      ? '/middle-earth'
      : /^\/galaxy(\/[a-z0-9-]+)?$/.test(pathname)
        ? '/galaxy'
        : categoryAt(pathname)
          ? '/feed'
          : pathname;

// the core pages, fetched ahead so a click on one opens at once
const fetchPages = () => {
  import('./components/feed/Feed.jsx');
  import('./pages/Home');
  import('./pages/Experience');
  import('./pages/Projects');
  import('./pages/Resume');
  import('./pages/Contact');
  import('./pages/Travel');
  import('./components/Hyperspace');
  // so the first ⌘K opens at once, instead of showing nothing while it loads
  import('./components/CommandPalette');
};
// (at the front door, after this long if nothing's asked for them sooner)
const PAGES_LATER_MS = 20000;

function Shell() {
  const { pathname } = useLocation();
  const page = pageKey(pathname);
  const firstPage = useRef(page);

  useEffect(() => {
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500));
    const cancelIdle = window.cancelIdleCallback || clearTimeout;
    if (firstPage.current !== '/universe') {
      const id = idle(fetchPages);
      return () => cancelIdle(id);
    }
    // At the front door the universe map's own code, maps and models come
    // first (the page is idle in between, so the idle callback came while
    // they were still loading): the pages are fetched once you reach for
    // the nav or ⌘K, or a while later
    let id = null;
    const go = () => {
      stop();
      id = idle(fetchPages);
    };
    const key = (e) => (e.metaKey || e.ctrlKey) && go();
    const reach = (e) => e.target.closest?.('header, nav, a[href]') && go();
    const timer = setTimeout(go, PAGES_LATER_MS);
    const stop = () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', key);
      document.removeEventListener('pointerover', reach);
      document.removeEventListener('focusin', reach);
    };
    window.addEventListener('keydown', key);
    document.addEventListener('pointerover', reach);
    document.addEventListener('focusin', reach);
    return () => {
      stop();
      if (id != null) cancelIdle(id);
    };
  }, []);

  return (
    // (the wallet outside the link to the other pilots: the roster reads it too)
    <EconomyProvider>
    <OnlineProvider>
      <div className="backdrop" aria-hidden="true" />
      <Ambience />
      <ScrollToTop />
      <Nav />
      <main id="main" tabIndex={-1} className="relative z-10 outline-none">
        {/* (every feed page shares a page key, so it's the path that lets the nav's links clear an error) */}
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<div className="min-h-[100svh]" data-fallback />}>
            <div key={page} className="page-enter">
              {/* a world on a phone (or with Data Saver, or short of space) asks before it downloads its 3D */}
              <WorldGate pathname={pathname}>
              <Routes>
                <Route path="/" element={<Front />} />
                {/* the portfolio: six pages, one feed */}
                <Route path="/home" element={<Feed />} />
                <Route path="/experience/:roleId?" element={<Feed />} />
                <Route path="/projects" element={<Feed />} />
                <Route path="/projects/:id" element={<ProjectDetail />} />
                <Route path="/resume" element={<Feed />} />
                <Route path="/contact" element={<Feed />} />
                <Route path="/travel" element={<Feed />} />
                <Route path="/caribbean" element={<Caribbean />} />
                <Route path="/invincible" element={<Invincible />} />
                <Route path="/terminal" element={<Terminal />} />
                <Route path="/deathstar" element={<DeathStar />} />
                <Route path="/deathstar/inside" element={<DeathStarInside />} />
                <Route path="/galaxy/:system?" element={<Galaxy />} />
                <Route path="/galaxy/:system/mission" element={<GalaxyMission />} />
                <Route path="/galaxy/:system/surface" element={<GalaxySurface />} />
                <Route path="/fly/:planet?" element={<Fly />} /> {/* planet flight */}
                <Route path="/music" element={<Music />} />
                <Route path="/middle-earth/:place?" element={<MiddleEarth />} />
                <Route path="/scranton" element={<Scranton />} />
                <Route path="/avengers" element={<Avengers />} />
                <Route path="/cybertron" element={<Cybertron />} />
                <Route path="/albuquerque" element={<Albuquerque />} />
                <Route path="/c-137" element={<RickMorty />} />
                <Route path="/c-137/citadel" element={<Citadel />} />
                <Route path="/c-137/:planet" element={<RmPlanet />} />
                <Route path="/dot-matrix" element={<DotMatrix />} />
                <Route path="/dot-matrix/64" element={<Mario64 />} />
                <Route path="/dot-matrix/minecraft" element={<Minecraft />} />
                <Route path="/earth" element={<Earth />} />
                <Route path="/battlefront/:level?/:mode?" element={<Battlefront />} />
                <Route path="/universe/:id?" element={<Front />} />
                <Route path="/changes" element={<Changes />} />
                <Route path="/worlds" element={<Worlds />} />
                <Route path="/dickansh" element={<Dickansh />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </WorldGate>
            </div>
          </Suspense>
        </ErrorBoundary>
      </main>
      {pathname !== '/terminal' && pathname !== '/deathstar' && pathname !== '/deathstar/inside' && page !== '/universe' && page !== '/galaxy' && !pathname.endsWith('/surface') && !pathname.startsWith('/battlefront') && <Footer />}
      <ScrollSaber />
      <Guide />
      <TourHost />
      <Lightspeed />
      <PaletteHost />
      <SettingsHost />
      <ErrorBoundary fallback={<IntroGone />}>
        <IntroJump />
      </ErrorBoundary>
    </OnlineProvider>
    </EconomyProvider>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ThemeProvider>
        <AchievementProvider>
          <FunProvider>
            <Shell />
          </FunProvider>
        </AchievementProvider>
      </ThemeProvider>
    </HashRouter>
  );
}
