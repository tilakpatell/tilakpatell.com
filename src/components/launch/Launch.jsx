import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ErrorBoundary from '../ErrorBoundary';
import { local, prefersReducedMotion } from '../../lib/hooks';
import { introPlaying } from '../../lib/stale';
import { isMapPath, readStart, saveStart } from '../../lib/view';
import { mapMade, mapState, onMapState } from '../../lib/mapReady';
import { TOUR_KEY, writeProgress } from '../../lib/tour';
import { BRIEF_KEY, sawBrief } from '../tour/brief';
import { after, arrival, covers, visitOf, waysIn } from './rules';
import { FLY_BRIEF } from './cards';
import { useMapState } from './useLaunch';

// The launch: everything between arriving at the front door (/) and flying
// the universe, in one place (rules.js has its rules). index.html decides a
// visit gets one (html[data-intro]: '1' a first visit, 'back' a return, at
// the front door only) and covers the page until it starts. Then:
//
//   welcome → quick tour → opening crawl → cockpit → arrival → the universe
//
// any part skipped (Skip to the universe, Skip the intro, Esc) straight to
// the arrival; a return's welcome offers the universe (or the classic site,
// last picked) with the intro beside it. The whole time the page underneath
// is covered (html[data-covered]): the universe map is made behind the
// cover, a slice at a time in the page's idle moments (universe/
// prepFrame.js), so it isn't drawn, and nothing over it waits on it. The
// arrival keeps a cover up, with the map's bar, until the map is made
// (lib/mapReady), then holds its card over the map's first frame and fades
// off it, so whoever comes out early never sees it half made; the cockpit's
// white holds a while on it first. ⌘K's "Back to the cockpit" plays the
// cockpit again from anywhere, with the arrival after it.

const OpeningCrawl = lazy(() => import('../experience/OpeningCrawl'));
const Cockpit = lazy(() => import('../cockpit/Cockpit'));
const Welcome = lazy(() => import('./Welcome'));
const QuickTour = lazy(() => import('./QuickTour'));
const Arrive = lazy(() => import('./Arrive'));

// (a chunk fetched ahead of need whose failure is nobody's: App.jsx's `ahead`)
const ahead = (p) => p.catch(() => {});

const cover = (on) => {
  const el = document.documentElement;
  if (on) el.dataset.covered = '';
  else if ('covered' in el.dataset) {
    delete el.dataset.covered;
    window.dispatchEvent(new Event('tp:uncover'));
  }
};
// (the page under it has the focus next, as the cockpit's launch gives it)
const focusMain = () => setTimeout(() => document.getElementById('main')?.focus({ preventScroll: true }), 0);
const made = () => mapMade(mapState().state);
// the path as the address has it now: a navigate() moves it at once, the
// location React gives a render later (a pick on the classic site's
// welcome goes to the map in the same click that starts the arrival)
const pathNow = () => window.location.hash.replace(/^#/, '').split('?')[0] || '/';
const UNCOVER_AFTER = 80; // ms: the arrival's card painted before the map under it draws

function Run() {
  const navigate = useNavigate();
  const [visit] = useState(() => visitOf(document.documentElement.dataset.intro));
  const [ways] = useState(() => waysIn({ visit, start: readStart() }));
  const [reduced] = useState(prefersReducedMotion);
  const [stage, setStage] = useState(() => (visit ? 'welcome' : null));
  const [ride, setRide] = useState(null); // ⌘K's replay: { vehicle }, or null for the front door's
  const [peaked, setPeaked] = useState(false); // the cockpit's flash has come: the arrival waits under its white
  const [arriveUp, setArriveUp] = useState(false); // the arrival mounted once it's wanted, and kept for its fade
  const map = useMapState();

  // a visit had: the next one is a return (index.html)
  useEffect(() => {
    if (!stage) return;
    try {
      window.localStorage.setItem('tp-intro', '1');
    } catch {
      /* storage unavailable */
    }
  }, [stage]);
  // what comes next, fetched while this part is up: the map's code behind a
  // welcome that leads to it, the intro's parts once it may be started
  useEffect(() => {
    if (stage === 'welcome' && ways.main !== 'classic') {
      ahead(import('../../pages/Front'));
      ahead(import('../universe/scene'));
    }
    // (the arrival, small, behind every part: whichever is left early needs it)
    if (stage) ahead(import('./Arrive'));
    const intro = stage === 'tour' || stage === 'crawl' || (stage === 'welcome' && ways.main === 'intro');
    if (intro) ahead(import('./QuickTour'));
    if (intro && !reduced) {
      ahead(import('../experience/OpeningCrawl'));
      // (the crew, the biggest part, once the crawl's begun: the tour may yet be skipped)
      ahead(import('../cockpit/load').then((m) => m.preloadCockpit('falcon', { crew: stage === 'crawl' })));
    }
  }, [stage, ways, reduced]);
  useEffect(() => {
    cover(covers(stage));
    if (stage !== 'cockpit') setPeaked(false);
  }, [stage]);
  useEffect(() => () => cover(false), []);
  // (a reload for the new build in the middle of a first visit's launch plays it again: lib/stale)
  useEffect(() => introPlaying(Boolean(stage) && !ride), [stage, ride]);

  // ⌘K: back to the cockpit, from anywhere
  useEffect(() => {
    const again = (e) => {
      if (stage) return;
      ahead(import('../cockpit/load').then((m) => m.preloadCockpit(e.detail?.vehicle)));
      setRide({ vehicle: e.detail?.vehicle ?? null });
      setStage('cockpit');
    };
    window.addEventListener('tp:cockpit', again);
    return () => window.removeEventListener('tp:cockpit', again);
  }, [stage]);

  const finish = useCallback(() => {
    cover(false);
    setStage(null);
    setRide(null);
    focusMain();
  }, []);

  // The arrival (rules.js's `arrival`): uncovered once the map is made, so
  // it draws its first frame under the card; let go once that's drawn (or
  // the visitor isn't on the map). Checked as the map says, and a few times
  // a second for the waits with no word from it.
  useEffect(() => {
    if (stage !== 'arrive') return undefined;
    const since = performance.now();
    let uncoveredAt = null;
    let later = 0;
    let done = false;
    const check = () => {
      if (done) return;
      const now = performance.now();
      const step = arrival({ map: mapState(), since, now, uncoveredAt, onMap: isMapPath(pathNow()) });
      if (step === 'uncover' && uncoveredAt == null) {
        uncoveredAt = now;
        // (a moment after the card's first paint: the map's first frame can
        // hold the page a while on a weak chip, and the card is what shows)
        later = setTimeout(() => cover(false), UNCOVER_AFTER);
      }
      if (step !== 'done') return;
      done = true;
      finish();
    };
    check();
    const off = onMapState(check);
    const t = setInterval(check, 250);
    return () => {
      off();
      clearInterval(t);
      clearTimeout(later);
    };
  }, [stage, finish]);

  // the welcome's ways in (rules.js's waysIn): each is the front door's
  // choice too, kept (lib/view's saveStart), so a return opens on it
  const pick = (way) => {
    if (way === 'classic') {
      saveStart('home');
      cover(false);
      setStage(null);
      if (pathNow() !== '/home') navigate('/home', { replace: true });
      focusMain();
      return;
    }
    saveStart('universe');
    // (the front door may have sent a kept classic pick on to /home under the welcome)
    if (!isMapPath(pathNow())) navigate('/', { replace: true });
    setStage(way === 'intro' ? 'tour' : 'arrive');
  };
  // the quick tour seen (finished or skipped part way): the map's offer of a
  // longer tour isn't made over it as well (the guide has them)
  const toured = () => local.set(TOUR_KEY, writeProgress(local.get(TOUR_KEY, null), {}));
  // its flying card stands in for the map's first-flight basics
  const onCard = (card) => card.id === 'fly' && local.set(BRIEF_KEY, sawBrief(local.get(BRIEF_KEY, []), FLY_BRIEF));
  const closeCrawl = useCallback(() => {
    // keep the page covered until the cockpit's first frame (index.html's cover)
    document.documentElement.dataset.intro = '1';
    setStage('cockpit');
  }, []);

  const arriving = stage === 'arrive' || (stage === 'cockpit' && peaked && !made());
  useEffect(() => {
    if (arriving) setArriveUp(true);
  }, [arriving]);
  return (
    <>
      {stage === 'welcome' && (
        <Suspense fallback={null}>
          <Welcome visit={visit} ways={ways} reduced={reduced} map={map} onPick={pick} />
        </Suspense>
      )}
      {stage === 'tour' && (
        <Suspense fallback={null}>
          <QuickTour
            next={after('tour', { reduced })}
            map={map}
            onCard={onCard}
            onDone={() => {
              toured();
              setStage(after('tour', { reduced }));
            }}
            onSkipIntro={() => {
              toured();
              setStage('arrive');
            }}
          />
        </Suspense>
      )}
      {stage === 'crawl' && (
        <Suspense fallback={null}>
          <OpeningCrawl variant="intro" onClose={closeCrawl} />
        </Suspense>
      )}
      {stage === 'cockpit' && (
        <Suspense fallback={null}>
          <Cockpit
            start={ride?.vehicle ?? undefined}
            // (uncovered under the flash only with the map made: else the arrival takes it)
            onReveal={() => made() && cover(false)}
            onPeak={() => {
              // out into the universe (the front door is it, unless a visitor
              // asked for the home page), flying the ship you launched in
              if (!/^\/(universe(\/|$)|$)/.test(pathNow())) navigate('/universe');
              setPeaked(true);
              if (made()) cover(false);
            }}
            onDone={() => (made() ? finish() : setStage('arrive'))}
          />
        </Suspense>
      )}
      {/* (mounted with the launch, drawing nothing till it's wanted, so it's there the moment it is) */}
      {(stage || arriveUp) && (
        <Suspense fallback={null}>
          <Arrive shown={arriving} map={map} onSkip={finish} />
        </Suspense>
      )}
    </>
  );
}

// The launch has a boundary of its own: a file of it gone after a deploy (the
// cockpit's, asked for as the crawl ends) reloads for the new build
// (ErrorBoundary), and anything else in it puts you in the site, uncovered,
// instead of blanking the page.
function Gone() {
  useEffect(() => {
    delete document.documentElement.dataset.intro;
    cover(false);
  }, []);
  return null;
}

export default function Launch() {
  return (
    <ErrorBoundary fallback={<Gone />}>
      <Run />
    </ErrorBoundary>
  );
}
