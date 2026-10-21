import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RiArrowLeftLine, RiArrowRightLine, RiCheckLine } from 'react-icons/ri';
import { textOf } from './steps';
import { rowsFor } from './briefs';
import { KeyTable } from '../guide/KeyTable';
import { useAchievements } from '../Achievements';
import { categoryAt } from '../feed/feed';
import { THINGS_TO_DO, isDone } from '../../data/todo';
import { chapterReady, clearOf, litBox, placeCard, resolveChapter, resolveSteps, waitUntil } from '../../lib/tour';
import { isPaletteKey, shortcutLabel } from '../../lib/palette';
import { local, prefersReducedMotion } from '../../lib/hooks';
import { VISITED_KEY, storedKey } from '../../lib/visited';
import { isMapPath } from '../../lib/view';
import { WORLD_MB } from '../worlds/worlds';
import './tour.css';

// The tour itself: the page dimmed, one thing lit at a time (a box over its
// target, the dim as the box's shadow), and a card beside it saying what it
// is. Back, Next and Skip, or ← → Enter and Esc. It's a modal dialog: focus
// stays in the card, the page under it takes no clicks or keys (the universe
// doesn't fly), and focus goes back where it was at the end. Loaded the first
// time a tour starts (TourHost); the stops are in steps.js, and a world's
// basics (kind 'brief', the same cards with its keys on them) in briefs.js.
//
// An audience's tour is chapters, each on one page. Arriving at a chapter
// on another page, it asks TourHost to open it, and the card waits in the
// middle ("One moment…") until the router has the page, nothing covers it
// and the feed's page has its code; then the chapter's stops whose target
// isn't on this screen drop out, as the view's tour's always have. Eight
// seconds at most, then the chapter's cards show in the middle; but a
// chapter marked `world` (the player's walk through the worlds) waits for
// its world's download gate as long as it asks, the veil lifted so the
// visitor can answer it, and says so on the card. A stop marked
// `wait` waits (eight seconds too) for a target that mounts late. A stop's
// `actions` leave for a place, a link or another tour; a stop's `release`
// lets ? or the palette's shortcut through, with the veil down, so you can
// try them.

const PAD = 6; // round the lit box's target
// more than this many chapters or stops (the whole tour has twenty-odd) and
// the row of dots is a slim bar instead
const MAX_DOTS = 12;

// a target counts if it's showing: not busy loading, not faded out
const showing = (el) => {
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return false;
  const css = getComputedStyle(el);
  return css.visibility !== 'hidden' && css.opacity !== '0' && !el.closest('[aria-busy="true"]');
};

// the first element marked for a stop that's showing (the guide's "?" is the
// corner button on most pages, the panel's own on the map)
function targetOf(name) {
  for (const el of document.querySelectorAll(`[data-tour~="${name}"]`)) if (showing(el)) return el;
  return null;
}
const has = (at) => Boolean(targetOf(at));

const inView = (el) => {
  const r = el.getBoundingClientRect();
  return r.top >= 0 && r.bottom <= window.innerHeight;
};

// the page behind, out of reach of a keyboard and a screen reader while it
// runs (again on each page the tour opens: a new page brings its own footer)
function inertBehind() {
  const behind = [document.getElementById('main'), document.querySelector('.site-nav'), document.querySelector('.guide-btn'), ...document.querySelectorAll('footer')];
  const set = behind.filter((el) => el && !el.inert);
  set.forEach((el) => (el.inert = true));
  return () => set.forEach((el) => (el.inert = false));
}

// nothing over the page but this tour (lib/tour's clearOf, on the document)
const clear = () =>
  clearOf({
    dataset: document.documentElement.dataset,
    modals: [...document.querySelectorAll('[aria-modal="true"]')].map((el) => el.classList.contains('tour-card')),
    gate: Boolean(document.querySelector('.world-gate')),
  });
// something the visitor opened at a release stop: the guide, the palette
const opened = () => !clear() || Boolean(document.getElementById('guide-panel'));

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const coarse = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;
const timers = {
  tick: (fn) => setTimeout(fn, 120),
  now: () => performance.now(),
};

const WORDS = {
  tour: { count: 'Tour', skip: 'Skip the tour', done: 'Done' },
  brief: { count: 'The basics', skip: 'Skip the basics', done: 'Let’s go' },
};

const noop = () => {};

export default function Tour({ list, chapters, start, kind = 'tour', pathname, onEnd, onProgress = noop, onNavigate = noop, onAction = noop, onBriefSeen = noop }) {
  const crosses = Boolean(chapters?.length);
  const [touch] = useState(coarse);
  const words = WORDS[kind] ?? WORDS.tour;
  // the chapter asked for ({ c, stop?, dir }: a new object each time), and
  // the one shown once its page is ready ({ c, stops, lost })
  const [want, setWant] = useState(() => ({
    c: start?.c ?? 0,
    stop: start?.stop,
    dir: 1,
  }));
  const [shownCh, setCh] = useState(() => (crosses ? null : { c: 0, stops: resolveSteps(list, has, kind === 'brief') }));
  const [s, setS] = useState(0);
  const [late, setLate] = useState(false); // a `wait` stop's target not there yet
  const [asking, setAsking] = useState(false); // a world chapter's gate up, waiting on the visitor
  const [light, setLight] = useState(false); // the world chapter's 3D kept off (the gate's pill)
  const [box, setBox] = useState(null); // the lit box, or null for a card in the middle
  const [pos, setPos] = useState(null); // the card's { side, top, left }
  const [over, setOver] = useState(false); // the guide or the palette open over a release stop
  const card = useRef(null);
  const body = useRef(null); // the card's words, which scroll on a short window
  const next = useRef(null);
  const ids = useId();
  const here = useRef(pathname);
  here.current = pathname;
  const frees = useRef([]);
  // what the effects below read live: they start on a new chapter or stop, not on a new callback
  const live = useRef({});

  // (the chapter shown is the one asked for: the frame between Next and the
  // wait for its page mustn't show the last chapter's stop under the new count)
  const ch = shownCh && (!crosses || shownCh.c === want.c) ? shownCh : null;
  const chapter = crosses ? chapters[want.c] : null;
  const stops = ch?.stops ?? [];
  const waiting = !ch || late;
  const step = ch ? stops[Math.min(s, stops.length - 1)] : null;
  const lastChapter = !crosses || want.c === chapters.length - 1;
  const last = Boolean(ch) && lastChapter && s === stops.length - 1;
  // what a stop's words may turn on: this device's palette key, a touch
  // screen, the ship you fly, what a place downloads
  const ctx = { key: shortcutLabel(), touch, ship: local.get('tp-universe-ship', null), mb: WORLD_MB };
  // (over the map the card wears the map's dark glass, as the panel it points at does)
  const onMap = isMapPath(pathname);
  const release = Boolean(step?.release?.length) && !waiting;
  // html[data-touring]: 'release' only where ? goes through (the guide takes ? on that word alone), 'keys' where only the palette's does
  const touringAs = !release ? '' : step.release.includes('?') ? 'release' : 'keys';

  const seenBrief = () => chapter?.brief && onBriefSeen(chapter.brief);
  const finish = (how) => {
    // (the basics shown as a chapter are seen once you've reached their end)
    if (ch && s === stops.length - 1) seenBrief();
    onEnd(how);
  };
  const forward = () => {
    if (waiting) return;
    if (s < stops.length - 1) return setS(s + 1);
    if (lastChapter) return finish('done');
    seenBrief();
    setWant({ c: want.c + 1, dir: 1 });
  };
  const back = () => {
    if (waiting) return;
    if (s > 0) return setS(s - 1);
    if (crosses && want.c > 0) setWant({ c: want.c - 1, dir: -1 });
  };
  live.current = { chapters, chapter, onProgress, onNavigate, onEnd };
  const act = useRef({});
  act.current = {
    forward,
    back,
    skip: () => finish('skipped'),
    release: release ? step.release : null,
    asking,
  };

  // On: html[data-touring] (it brings the nav and the guide's button back if
  // they're tucked away, and holds the guide's ? key), the page behind put
  // out of reach, focus into the card. Off: all of it back.
  useLayoutEffect(() => {
    const html = document.documentElement;
    const from = document.activeElement;
    html.dataset.touring = '';
    frees.current.push(inertBehind());
    const into = requestAnimationFrame(() => next.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(into);
      frees.current.forEach((free) => free());
      frees.current = [];
      delete html.dataset.touring;
      if ('tourStill' in html.dataset) {
        delete html.dataset.tourStill;
        window.dispatchEvent(new Event('tp:uncover'));
      }
      // (what started it may be gone: the guide's panel closes as the tour opens)
      const back = from instanceof HTMLElement && from.isConnected && from !== document.body ? from : document.getElementById('main');
      back?.focus({ preventScroll: true });
    };
  }, []);

  // A chapter: its page opened unless the router has it already (or the feed
  // has it under a neighbour's address), then, once it's ready, its stops
  // for this screen; none left, the next chapter on the way you're going.
  useEffect(() => {
    if (!crosses) return undefined;
    const { chapters, onProgress, onNavigate, onEnd } = live.current;
    const target = chapters[want.c];
    setCh(null);
    setLate(false);
    onProgress(target, null);
    const at = () => ({
      pathname: here.current,
      path: target.path,
      feedTo: categoryAt(here.current)?.to,
    });
    // the page's code still coming: the route's own (no page under #main yet,
    // or one held hidden while its code loads) or, on the feed, its page's
    const loading = () => {
      const page = document.querySelector('#main .page-enter');
      if (!page || getComputedStyle(page).display === 'none') return true;
      if (!categoryAt(target.path)) return false;
      return !document.querySelector('.feed-page[data-active]') || Boolean(document.querySelector('.feed-page[data-active] .feed-loading'));
    };
    if (!chapterReady({ ...at(), clear: true, loading: false })) onNavigate(target.path);
    let off = false;
    const gate = () => Boolean(target.world && document.querySelector('.world-gate'));
    const ready = () => {
      const up = gate();
      setAsking(up);
      if (up) return 'hold';
      return chapterReady({ ...at(), clear: clear(), loading: loading() }) ? 'ready' : null;
    };
    waitUntil(ready, { ...timers, cancelled: () => off }).then((how) => {
      if (off || how === 'cancelled') return;
      setAsking(false);
      setLight(Boolean(target.world && document.querySelector('.world-gate-pill')));
      const got = how === 'ready' ? resolveChapter(target.stops, has, Boolean(target.brief)) : resolveChapter(target.stops, () => false, true);
      if (!got.length) {
        const to = want.c + want.dir;
        if (to >= chapters.length) return onEnd('done');
        return setWant({ c: Math.max(to, 0), dir: to < 0 ? 1 : want.dir });
      }
      const named = want.stop ? got.findIndex((x) => x.id === want.stop) : -1;
      frees.current.push(inertBehind());
      setS(named >= 0 ? named : want.dir < 0 ? got.length - 1 : 0);
      setCh({ c: want.c, stops: got, lost: how !== 'ready' });
      requestAnimationFrame(() => next.current?.focus({ preventScroll: true }));
    });
    return () => {
      off = true;
    };
  }, [want, crosses]);

  // a stop told to wait for a target that mounts late (a lazy section)
  useEffect(() => {
    if (!step?.wait || !step.at || ch?.lost || has(step.at)) return undefined;
    setLate(true);
    let off = false;
    waitUntil(() => (has(step.at) ? 'ready' : null), {
      ...timers,
      cancelled: () => off,
    }).then(() => {
      if (off) return;
      setLate(false);
      // (Next was disabled while it waited, which dropped the focus)
      requestAnimationFrame(() => next.current?.focus({ preventScroll: true }));
    });
    return () => {
      off = true;
    };
  }, [step, ch]);

  // each stop's words from their top (the scroller is one element for the run)
  useLayoutEffect(() => {
    if (body.current) body.current.scrollTop = 0;
  }, [step, waiting]);

  // where it's got to, each stop
  useEffect(() => {
    if (crosses && step && !late) live.current.onProgress(live.current.chapter, step);
  }, [step, late, crosses]);

  // A stop that asks you to try ? or the palette: the veil down, the guide's
  // button in reach, and html[data-touring="release"] for the guide (which
  // hears ? before the tour does). While what it opened is up, the card
  // steps under it.
  useEffect(() => {
    const html = document.documentElement;
    if (!('touring' in html.dataset)) return undefined;
    html.dataset.touring = touringAs;
    if (!touringAs) return undefined;
    const btn = document.querySelector('.guide-btn');
    const was = btn?.inert;
    if (btn) btn.inert = false;
    const watch = setInterval(() => setOver(opened()), 250);
    return () => {
      clearInterval(watch);
      setOver(false);
      // (only while the tour's still up: ending, it has already freed the page)
      if (btn && was && 'touring' in html.dataset) btn.inert = true;
      if ('touring' in html.dataset) html.dataset.touring = '';
    };
  }, [touringAs]);

  // The keys, before the page's own (captured, and stopped there): the
  // arrows, Enter and Escape drive the tour, Tab stays in the card, and no
  // other key gets through to the page under it; but at a release stop its
  // keys go through, and every key while what they opened is up. Up, Down,
  // Page Up and Page Down scroll the card's words when a short window has
  // made them scroll (focus is on Next, below them).
  useEffect(() => {
    const onKey = (e) => {
      const free = act.current.release;
      if (free && (opened() || (e.key === '?' && free.includes('?')) || (isPaletteKey(e) && free.includes('palette')))) return;
      if (act.current.asking) return; // (a world's gate has the keys while it asks)
      e.stopImmediatePropagation();
      if (e.key === 'Tab') {
        const els = [...(card.current?.querySelectorAll('button:not(:disabled), a[href]') ?? [])];
        const at = els.indexOf(document.activeElement);
        const to = e.shiftKey ? (at <= 0 ? els.length - 1 : at - 1) : at === els.length - 1 ? 0 : at + 1;
        e.preventDefault();
        els[to]?.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        act.current.skip();
      } else if (e.key === 'ArrowRight' || (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement))) {
        e.preventDefault();
        act.current.forward();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        act.current.back();
      } else if (/^(Arrow(Up|Down)|Page(Up|Down))$/.test(e.key)) {
        const b = body.current;
        if (!b || b.scrollHeight <= b.clientHeight) return;
        e.preventDefault();
        const by = e.key.startsWith('Page') ? b.clientHeight - 40 : 40;
        b.scrollBy({ top: e.key.endsWith('Up') ? -by : by, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // The lit box and the card follow the target, a frame at a time (the nav
  // slides back in, the page scrolls, the window changes size), setting
  // state only when something's moved. A target out of view (the ships, low
  // in the panel) is scrolled to first.
  useLayoutEffect(() => {
    const at = step?.at && !waiting ? step.at : null;
    let el = at ? targetOf(at) : null;
    if (el && !inView(el))
      el.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
    let frame = 0;
    let was = null;
    const measure = () => {
      if (at && !el?.isConnected) el = targetOf(at);
      const r = el?.getBoundingClientRect();
      const view = {
        w: document.documentElement.clientWidth,
        h: window.innerHeight,
      };
      const lit = r && r.width >= 1 ? litBox(r, view, PAD) : null;
      const c = card.current;
      if (c) {
        const p = placeCard(
          lit && {
            ...lit,
            right: lit.left + lit.width,
            bottom: lit.top + lit.height,
          },
          { w: c.offsetWidth, h: c.offsetHeight },
          view,
        );
        const now = {
          lit,
          at: { ...p, top: Math.round(p.top), left: Math.round(p.left) },
        };
        if (!same(now, was)) {
          was = now;
          setBox(now.lit);
          setPos(now.at);
        }
      }
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [step, waiting]);

  // A card in the middle, nothing lit: the 3D under it holds still (as under
  // the intro's cover; lib/three/useScene), and draws again once a stop
  // lights something.
  const still = !box;
  useEffect(() => {
    const html = document.documentElement;
    if (still) html.dataset.tourStill = '';
    else if ('tourStill' in html.dataset) {
      delete html.dataset.tourStill;
      window.dispatchEvent(new Event('tp:uncover'));
    }
  }, [still]);

  // a stop showing a thing to do says so when it's done (spec 3.2)
  const { unlocked } = useAchievements();
  const thing = step?.todo && !waiting ? THINGS_TO_DO.find((t) => t.id === step.todo) : null;
  const ticked = thing
    ? isDone(thing, {
        unlocked,
        visited: local.get(VISITED_KEY, []),
        stored: storedKey,
      })
    : false;

  const title = waiting ? (chapter?.title ?? '') : step.title;
  const text = waiting ? (asking ? 'This device asks before downloading a world’s 3D. Answer it below: the tour carries on either way.' : 'One moment…') : textOf(step, ctx);
  const notice = !waiting && light && chapter?.world && s === 0 ? 'This world is in its light version on this device; the 3D loads from the button at the bottom any time.' : null;
  // (keys and touch are the key table's rows)
  const shown = waiting ? null : rowsFor(step, touch);
  const rows = Array.isArray(shown) ? shown : null;
  const actions = waiting ? [] : (step.actions ?? []).slice(0, 4);
  const count = crosses ? `Chapter ${want.c + 1} of ${chapters.length}${ch ? ` · ${s + 1} of ${stops.length}` : ''}` : `${words.count} · ${s + 1} of ${stops.length}`;
  // an audience's dots are its chapters; a view's tour's and the basics', their stops
  const dots = crosses ? chapters.map((c, n) => ({ key: c.id, n })) : stops.map((x, n) => ({ key: x.id, n }));
  const dot = crosses ? want.c : s;

  return createPortal(
    <div className="tour" data-kind={kind} data-lit={box ? '' : undefined} data-waiting={waiting ? '' : undefined} data-asking={asking ? '' : undefined} data-release={release ? '' : undefined} data-over={over ? '' : undefined}>
      {/* the clicks on the page under it stop here */}
      <div className="tour-veil" aria-hidden="true" />
      {box && <div className="tour-spot" aria-hidden="true" style={box} />}
      <div
        ref={card}
        className={`tour-card card dialog${onMap ? ' dark-scope' : ''}`}
        data-map={onMap ? '' : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ids}-title`}
        aria-describedby={`${ids}-text`}
        data-side={pos?.side}
        style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
      >
        {/* (the words scroll on a window too short for them; the buttons below never do) */}
        <div ref={body} className="tour-body">
          <p className="tour-count">
            {count}
            {ticked && (
              <span className="tour-ticked">
                {' '}
                · <RiCheckLine className="inline h-3.5 w-3.5" aria-hidden="true" /> Done
              </span>
            )}
          </p>
          <h2 id={`${ids}-title`} className="tour-title">
            {title}
          </h2>
          <p id={`${ids}-text`} className="tour-text">
            {text}
          </p>
          {notice && <p className="tour-notice">{notice}</p>}
          {rows && <KeyTable rows={rows} className="guide-keys tour-keys" />}
          {actions.length > 0 && (
            <div className="tour-actions">
              {actions.map((a) => {
                // (a label may say a size: a function of ctx, as a stop's text may be)
                const label = typeof a.label === 'function' ? a.label(ctx) : a.label;
                const cls = `btn ${a.primary ? 'btn-primary' : 'btn-ghost'} btn-sm`;
                return a.href ? (
                  <a key={label} className={cls} href={a.href} download={a.download || undefined} target={a.download ? undefined : '_blank'} rel={a.download ? undefined : 'noopener noreferrer'}>
                    {label}
                  </a>
                ) : (
                  <button key={label} type="button" className={cls} onClick={() => onAction(a, { last })}>
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="tour-foot">
          {dots.length > MAX_DOTS ? (
            <div className="tour-progress" aria-hidden="true">
              <span style={{ transform: `scaleX(${(dot + 1) / dots.length})` }} />
            </div>
          ) : (
            <ol className="tour-dots" aria-hidden="true">
              {dots.map((d) => (
                <li key={d.key} data-on={d.n === dot ? '' : undefined} data-past={d.n < dot ? '' : undefined} />
              ))}
            </ol>
          )}
          <div className="tour-buttons">
            {!last && (
              <button type="button" className="tour-skip" onClick={() => finish('skipped')}>
                {words.skip}
              </button>
            )}
            {(s > 0 || (crosses && want.c > 0)) && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={back} aria-label="Back" disabled={waiting}>
                <RiArrowLeftLine className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <button ref={next} type="button" className="btn btn-primary btn-sm" onClick={forward} disabled={waiting}>
              {last ? (
                <>
                  <RiCheckLine className="h-4 w-4" aria-hidden="true" /> {words.done}
                </>
              ) : (
                <>
                  Next <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </div>
        {/* each stop said aloud as it comes (focus stays on Next); the wait once */}
        <p className="sr-only" aria-live="polite">
          {waiting ? `${title}. ${asking ? text : 'One moment…'}` : (s > 0 || crosses) && `${s + 1} of ${stops.length}. ${step.title}. ${text}`}
        </p>
      </div>
    </div>,
    document.body,
  );
}
