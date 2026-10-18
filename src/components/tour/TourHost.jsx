import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { IconGo, IconTour } from '../icons';
import { CloseButton } from '../ui';
import { useAchievements } from '../Achievements';
import { local, storage } from '../../lib/hooks';
import { TOUR_EVENT, TOUR_KEY, TOUR_MINUTES, TOUR_NAMES, TOUR_TIMES, isLightRoute, offerHere, openTour, parseTourLink, readProgress, samePage, startAt, tourFor, unfinished, writeProgress } from '../../lib/tour';
import { planOf } from './plan';
import { BRIEF_EVENT, BRIEF_KEY, briefHere, briefKeyFor, sawBrief } from './brief';
import { guideKeyFor } from '../guide/routes';
import { isMapPath } from '../../lib/view';
import './offer.css';

// Always in the shell, and small: starts a tour of the site when asked
// (openTour: ⌘K, the guide, the terminal, the checklist, a ?tour= link),
// and offers one on a first arrival; and a world's basics, the first time
// you arrive in it (before you're dropped in) or when the guide asks
// (openBrief). The tour (Tour.jsx) and what each says load the first time
// one's offered or started.
//
// Two sorts of tour: the view's (the shell of the universe or the classic
// site, on the page you're on) and an audience's (the hiring tour, the
// player's, the whole one): chapters, each on its own page, which it opens
// itself. It remembers where it's got to, and ends if you go Back or follow
// a link off its page. A stop's action to another light page is an
// excursion: the tour stops there and a note offers to carry on.
const loadTour = () => import('./Tour');
const Tour = lazy(loadTour);

// An audience's chapters for the view and page you're in, a chapter that's a
// world's basics given its cards. Empty when they aren't written yet. The
// shell's stops and each audience's hello come from steps.js too, when it
// gives them (chapters/shared.js).
async function chaptersFor(audience, view, here) {
  const plan = planOf(await import('./steps'), audience, view, here);
  if (!plan.some((c) => c.brief)) return plan;
  const { BRIEFS } = await import('./briefs');
  return plan.map((c) => (c.brief ? { ...c, stops: BRIEFS[c.brief] ?? [] } : c));
}

// what a run shows: a world's basics, the view's tour, or an audience's
// chapters (one alone, `only`, when the guide's list asks for one) and where
// in them to start; `view` when an audience has none written yet, and the
// view's tour stands in
async function loadRun(run) {
  if (run.kind === 'brief') return { list: (await import('./briefs')).BRIEFS[run.name] };
  const { TOURS } = await import('./steps');
  if (!run.audience) return { list: TOURS[run.name] };
  const plan = await chaptersFor(run.audience, run.view, run.here);
  if (!plan.length) return run.todo ? { none: true } : { view: true };
  if (run.only) {
    const one = plan.filter((c) => c.id === run.chapter);
    return one.length ? { chapters: one, start: { c: 0 } } : { none: true };
  }
  const start = startAt(plan, run);
  return start ? { chapters: plan, start } : { none: true };
}

// nothing covering the page or asking over it: the intro, the cockpit, the
// phone menu, a tour, a dialog, a world asking before it downloads
const busy = () => {
  const html = document.documentElement;
  return ['covered', 'intro', 'menu', 'touring'].some((k) => k in html.dataset) || Boolean(document.querySelector('[aria-modal="true"], .world-gate'));
};

const BOTH = { mixed: ['recruiter', 'player'] };
const PRIZE = { recruiter: 'tourRecruiter', player: 'tourPlayer' };
const NUDGED = 'tp-tour-nudged'; // (session) the carry-on note's been shown this visit
const lower = (name) => name.replace(/^The /, 'the ');
// the offer's three ways round, each with how long it takes; the two folded
// together leads, as the primary button did
const PICKS = [
  { audience: 'recruiter', label: 'To hire' },
  { audience: 'player', label: 'To play' },
  { audience: 'mixed', label: 'Both', main: true },
];

export default function TourHost() {
  const location = useLocation();
  const { pathname, search } = location;
  const navType = useNavigationType();
  const navigate = useNavigate();
  const { unlock } = useAchievements();
  // the one running: { kind: 'tour', name: 'universe' | 'classic' }, an
  // audience's { kind: 'tour', name, audience, view, here, chapter?, stop?,
  // todo?, to?, only? }, or { kind: 'brief', name: a world's key, page: the
  // guide's key it's on}; `n` counts starts, so starting again starts over
  const [run, setRun] = useState(null);
  const [asked, setAsked] = useState(null); // a page's own basics, waiting to show the first time: { key, page }
  const [loaded, setLoaded] = useState(null); // { run, list | chapters, start }
  const [offer, setOffer] = useState(false);
  // the note offering to carry on a tour left part way: { audience, chapter, stop, n, of, after: 'excursion' | 'arrival' }
  const [nudge, setNudge] = useState(null);
  const where = useRef(pathname);
  where.current = pathname;
  // the page an audience tour is on, or opening: a push anywhere else ends it
  const expected = useRef(null);
  const starts = useRef(0);

  useEffect(() => {
    const onStart = (e) => {
      setOffer(false);
      setNudge(null);
      const d = e.detail;
      const view = tourFor(where.current);
      expected.current = null;
      starts.current += 1;
      setRun(
        d?.audience
          ? {
              kind: 'tour',
              name: d.audience,
              audience: d.audience,
              chapter: d.chapter,
              stop: d.stop,
              todo: d.todo,
              to: d.to,
              only: d.only,
              view,
              here: where.current,
              n: starts.current,
            }
          : { kind: 'tour', name: view, n: starts.current },
      );
    };
    const onBrief = (e) => {
      const name = e.detail?.key ?? briefKeyFor(where.current);
      if (!name) return;
      if (e.detail?.first) setAsked({ key: name, page: guideKeyFor(where.current) });
      else setRun({ kind: 'brief', name, page: guideKeyFor(where.current) });
    };
    window.addEventListener(TOUR_EVENT, onStart);
    window.addEventListener(BRIEF_EVENT, onBrief);
    return () => {
      window.removeEventListener(TOUR_EVENT, onStart);
      window.removeEventListener(BRIEF_EVENT, onBrief);
    };
  }, []);

  const remember = (patch) => local.set(TOUR_KEY, writeProgress(local.get(TOUR_KEY, null), patch));

  // A link that starts a tour (/#/home?tour=hiring): marked offered before
  // the offer's first check, so the two don't both show; the parameter taken
  // off the address at once, so the feed (which puts a page's own search
  // back as you scroll back to it) can't start it again.
  useEffect(() => {
    const link = parseTourLink(search);
    if (!link) return;
    local.set(TOUR_KEY, writeProgress(local.get(TOUR_KEY, null), {}));
    const rest = new URLSearchParams(search);
    rest.delete('tour');
    rest.delete('chapter');
    const q = rest.toString();
    navigate({ pathname, search: q ? `?${q}` : '' }, { replace: true });
    openTour(link);
  }, [search, pathname, navigate]);

  useEffect(() => {
    if (!run) return undefined;
    let live = true;
    loadRun(run).then((got) => {
      if (!live) return;
      // the view's tour standing in is the view's tour: its prizes, its
      // ending when the view changes, not the audience's
      if (got.view) return setRun({ kind: 'tour', name: run.view, n: run.n });
      // nothing to show for what was asked: a thing to do with no stop of
      // its own is still a place to go
      if (got.none) {
        setRun(null);
        if (run.to) navigate(run.to);
        return;
      }
      setLoaded({ run, ...got });
    });
    return () => {
      live = false;
    };
  }, [run, navigate]);
  const ready = loaded?.run === run ? loaded : null;

  // A page with another tour (back to the map from the feed, out of a
  // world) ends the view's tour (and a page's own basics not shown yet);
  // the feed moving the address as you scroll doesn't, nor picking a place
  // on the map. An audience's tour ends on Back, or a push off its chapter's
  // page; the feed's own moves (replaces) never end it.
  const kind = tourFor(pathname);
  const page = guideKeyFor(pathname);
  useEffect(() => setRun((r) => (r && (r.kind === 'brief' ? r.page !== page : !r.audience && r.name !== kind) ? null : r)), [kind, page]);
  useEffect(() => {
    if (!expected.current) return;
    if (navType === 'POP' || (navType === 'PUSH' && !samePage(pathname, expected.current))) {
      expected.current = null;
      setRun((r) => (r?.audience ? null : r));
    }
  }, [location.key, pathname, navType]);

  // A world's basics, the first time you're in it (or a page's own, the
  // first time it asks): once nothing's covering it for two checks running,
  // before you've had the chance to be dropped in. Remembered as soon as
  // they show; the guide shows a world's again.
  const briefKey = asked?.page === page ? asked.key : briefKeyFor(pathname);
  useEffect(() => {
    if (!briefKey || !briefHere(briefKey, local.get(BRIEF_KEY, []), navigator.webdriver)) return undefined;
    loadTour();
    let calm = 0;
    const check = setInterval(() => {
      calm = busy() ? 0 : calm + 1;
      if (calm < 2) return;
      clearInterval(check);
      local.set(BRIEF_KEY, sawBrief(local.get(BRIEF_KEY, []), briefKey));
      setRun(
        (r) =>
          r ?? {
            kind: 'brief',
            name: briefKey,
            page: guideKeyFor(where.current),
          },
      );
    }, 700);
    return () => clearInterval(check);
  }, [briefKey]);

  // The offer, on a first arrival at the map or the feed: once nothing's
  // covering the page (the intro, the front door's choice, the phone menu,
  // any dialog) for two checks running. Made once: it's remembered as soon
  // as it shows, and a link that started a tour counts. Choosing a place on
  // the map, or scrolling the feed on to its next page, keeps it up;
  // leaving for a world takes it down.
  const here = offerHere(pathname, null) ? kind : null;
  useEffect(() => {
    setOffer(false);
    const unset = () => readProgress(local.get(TOUR_KEY, null)) == null;
    if (!here || !unset()) return undefined;
    let calm = 0;
    const check = setInterval(() => {
      if (!unset()) return clearInterval(check);
      calm = busy() ? 0 : calm + 1;
      if (calm < 2) return;
      clearInterval(check);
      local.set(TOUR_KEY, writeProgress(null, {}));
      loadTour(); // (it's likely to be started next)
      setOffer(true);
    }, 1200);
    return () => clearInterval(check);
  }, [here]);

  // The note offering to carry on: after an excursion, and, once a visit,
  // on arriving at a light page with a tour left part way.
  const carryOn = async (p, after) => {
    const plan = await chaptersFor(p.audience, tourFor(where.current), where.current);
    const n = plan.findIndex((c) => c.id === p.chapter) + 1;
    if (n > 0) setNudge({ ...p, n, of: plan.length, after });
  };
  const carry = useRef(carryOn);
  carry.current = carryOn;
  const light = isLightRoute(pathname) && !run && !offer;
  // (the note is for the light pages: off one, into a world, it goes)
  useEffect(() => {
    if (!isLightRoute(pathname)) setNudge(null);
  }, [pathname]);
  useEffect(() => {
    if (!light || storage.get(NUDGED, false)) return undefined;
    const p = readProgress(local.get(TOUR_KEY, null));
    const left = unfinished(p);
    if (!left) return undefined;
    let calm = 0;
    const check = setInterval(() => {
      calm = busy() ? 0 : calm + 1;
      if (calm < 2) return;
      clearInterval(check);
      storage.set(NUDGED, true);
      carry.current({ ...left, stop: p.stop }, 'arrival');
    }, 1200);
    return () => clearInterval(check);
  }, [light]);

  // how: 'done', 'skipped', 'left' (Back, a link, a place it offered),
  // 'excursion'. Only finishing forgets where an audience's tour had got to;
  // the guide and the note offer to carry on from there otherwise.
  const end = (how) => {
    const was = run;
    expected.current = null;
    setRun(null);
    if (was?.kind !== 'tour' || how !== 'done') {
      if (was?.kind === 'tour') remember({});
      // (just stopped, it's not a moment to be asked to carry on)
      if (was?.audience) storage.set(NUDGED, true);
      return;
    }
    // (one chapter alone is a chapter seen, not the tour taken)
    if (was.only) return remember({});
    unlock('tour');
    if (!was.audience) return remember({ done: ['view'] });
    const done = BOTH[was.audience] ?? [was.audience];
    done.forEach((a) => PRIZE[a] && unlock(PRIZE[a]));
    remember({
      done: [...done, was.audience],
      audience: undefined,
      chapter: undefined,
      stop: undefined,
    });
  };
  const notNow = () => {
    setOffer(false);
    remember({});
  };
  const start = (audience) => () => openTour({ audience });
  // (over the map, the notes wear its dark glass, as the panel beside them does)
  const onMap = isMapPath(pathname);

  // where an audience's tour has got to: remembered, so a reload, the guide
  // or the note can carry on
  const onProgress = (chapter, stop) => {
    expected.current = chapter.path;
    // (one chapter alone isn't the tour: where the tour itself got to stays)
    if (run.only) return;
    remember({ audience: run.audience, chapter: chapter.id, stop: stop?.id });
  };
  const onNavigate = (path) => {
    expected.current = path;
    // (the address moves at once, the page a moment later: asked twice
    // before it's drawn, it's one page, not two in the history)
    if (window.location.hash.replace(/^#/, '').split('?')[0] !== path) navigate(path);
  };
  // A stop's action: another tour (the end card's "Take the player's
  // tour"), or a place. A light page is an excursion: the tour stops there,
  // remembered, and the note offers to carry on. A world or the galaxy ends
  // it: the tour never loads one by itself.
  const onAction = (a, { last }) => {
    const was = run;
    if (a.tour) {
      end(last ? 'done' : 'left');
      openTour({ audience: a.tour });
      return;
    }
    if (!a.to) return;
    const p = readProgress(local.get(TOUR_KEY, null));
    end(isLightRoute(a.to) ? 'excursion' : 'left');
    navigate(a.to);
    if (isLightRoute(a.to) && was?.audience && !was.only && p?.chapter) {
      storage.set(NUDGED, true); // (this note is the visit's: the arrival one doesn't follow it)
      carryOn({ audience: was.audience, chapter: p.chapter, stop: p.stop }, 'excursion');
    }
  };
  const onBriefSeen = (key) => local.set(BRIEF_KEY, sawBrief(local.get(BRIEF_KEY, []), key));

  return (
    <>
      {offer && !run && (
        <div className={`tour-offer notice${onMap ? ' dark-scope' : ''}`} data-map={onMap ? '' : undefined} role="status">
          <div className="tour-offer-head">
            <IconTour className="tour-offer-icon" aria-hidden="true" />
            <p className="tour-offer-title">New here? I’ll show you round</p>
            <CloseButton label="Not now" className="tour-offer-x" onClick={notNow} />
          </div>
          <p className="tour-offer-text">Here to hire, to play or both?</p>
          <div className="tour-offer-picks">
            {PICKS.map((p) => (
              <button
                key={p.audience}
                type="button"
                className="tour-offer-pick"
                data-main={p.main ? '' : undefined}
                aria-label={`${TOUR_NAMES[p.audience]}, ${TOUR_TIMES[p.audience].toLowerCase()}`}
                onClick={start(p.audience)}
              >
                <span className="tour-offer-pick-label">{p.label}</span>
                <span className="tour-offer-pick-time">{TOUR_MINUTES[p.audience]} min</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {nudge && !run && !offer && (
        <div className={`tour-offer notice${onMap ? ' dark-scope' : ''}`} data-map={onMap ? '' : undefined} role="status">
          <div className="tour-offer-head">
            <IconTour className="tour-offer-icon" aria-hidden="true" />
            <p className="tour-offer-title">Carry on {lower(TOUR_NAMES[nudge.audience])}</p>
            <CloseButton
              label={nudge.after === 'excursion' ? 'Stop' : 'Not now'}
              className="tour-offer-x"
              onClick={() => {
                setNudge(null);
                // Stop, after an excursion, means stop: no note again
                if (nudge.after === 'excursion')
                  remember({
                    audience: undefined,
                    chapter: undefined,
                    stop: undefined,
                  });
              }}
            />
          </div>
          <div className="tour-offer-row">
            <p className="tour-offer-text">
              Chapter {nudge.n} of {nudge.of}
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() =>
                openTour({
                  audience: nudge.audience,
                  chapter: nudge.chapter,
                  stop: nudge.stop,
                })
              }
            >
              Carry on <IconGo className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
      {run && ready && (
        <Suspense fallback={null}>
          <Tour
            key={`${run.kind}:${run.name}:${run.n ?? 0}`}
            list={ready.list}
            chapters={ready.chapters}
            start={ready.start}
            kind={run.kind}
            pathname={pathname}
            onEnd={end}
            onProgress={onProgress}
            onNavigate={onNavigate}
            onAction={onAction}
            onBriefSeen={onBriefSeen}
          />
        </Suspense>
      )}
    </>
  );
}
