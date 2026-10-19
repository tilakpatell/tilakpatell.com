import { isMapPath } from './view';

// The tour of the site (components/tour): which one a page gets, when a
// first arrival is offered it, which of its stops show on this screen, and
// where its card goes beside the thing it's pointing at; and the audience
// tours (the hiring tour, the player's, the whole one) that cross pages:
// their plan, what they remember, the link that starts one, and when a stop
// on a page just opened is ready to show. See
// docs/superpowers/specs/2026-10-07-site-tour-design.md and
// docs/superpowers/specs/2026-10-07-audience-tours-and-ui-audit-design.md.

export const TOUR_KEY = 'tp-tour'; // what readProgress reads; unset until the offer's made
export const TOUR_EVENT = 'tp:tour';
export const AUDIENCES = ['recruiter', 'player', 'mixed'];
// what each is called wherever it's offered, and how long it takes (spec 3.1;
// the minutes are steps.test.js's reading times rounded: 268, 596 and 725 s)
export const TOUR_NAMES = { recruiter: 'The hiring tour', player: 'The player’s tour', mixed: 'The whole tour' };
export const TOUR_MINUTES = { recruiter: 5, player: 10, mixed: 12 };
export const TOUR_TIMES = Object.fromEntries(AUDIENCES.map((a) => [a, `About ${TOUR_MINUTES[a]} minutes`]));

// Starts a tour from anywhere: ⌘K, the guide, the terminal, the offer, the
// checklist. With no detail, the tour of the view you're in, as before; with
// { audience, chapter?, stop?, todo?, to?, only? }, that audience's, from
// there. Anything but a plain object is no detail: openTour is handed
// straight to onClick, which passes it the click.
export const plainDetail = (detail) => (detail && Object.getPrototypeOf(detail) === Object.prototype ? detail : null);
export const openTour = (detail = null) => {
  const d = plainDetail(detail);
  window.dispatchEvent(new CustomEvent(TOUR_EVENT, d ? { detail: d } : undefined));
};

// What tp-tour holds: { offered, audience?, chapter?, stop?, done: [...] },
// where to carry on from and the tours finished ('view' for the old one).
// Visits before the audience tours kept a word ('offered', 'done',
// 'skipped'); those still read. Unset reads as null, which is what makes
// the offer; anything else unreadable reads as offered, so a bad value
// never offers it again and again.
export function readProgress(raw) {
  if (raw == null) return null;
  if (raw === 'done') return { offered: true, done: ['view'] };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { offered: true, done: [] };
  const done = Array.isArray(raw.done) ? raw.done.filter((d) => typeof d === 'string') : [];
  const p = { offered: true };
  if (AUDIENCES.includes(raw.audience)) {
    p.audience = raw.audience;
    if (typeof raw.chapter === 'string') p.chapter = raw.chapter;
    if (typeof raw.stop === 'string') p.stop = raw.stop;
  }
  p.done = done;
  return p;
}

// The progress after `patch`: a stop written over the last, a finished tour
// added once; an undefined field in the patch forgets it.
export function writeProgress(prev, patch) {
  const was = readProgress(prev) ?? { offered: true, done: [] };
  const next = { ...was, ...patch, offered: true, done: [...new Set([...was.done, ...(patch.done ?? [])])] };
  for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
  return readProgress(next);
}

// The audience tour left part way, for the guide's "Carry on…", or null.
// (Finishing forgets where it was, so one kept is part way, even of a tour
// finished once before.)
export const unfinished = (p) => (p?.audience && p.chapter ? { audience: p.audience, chapter: p.chapter } : null);

// ?tour=hiring|player|all[&chapter=id] on any page: the owner's links (the
// résumé's says hiring). A visitor never types "mixed", so the link says
// "all"; "recruiter" still reads.
const LINKED = { hiring: 'recruiter', recruiter: 'recruiter', player: 'player', all: 'mixed' };
export function parseTourLink(search) {
  const q = new URLSearchParams(search ?? '');
  const audience = LINKED[q.get('tour')];
  if (!audience) return null;
  const chapter = q.get('chapter');
  return chapter ? { audience, chapter } : { audience };
}

// Whether you're on a chapter's page: the page itself, or, the feed's pages
// being one long page that moves the address as it settles, any of them for
// another. A project is its own page, not the projects page; a place on the
// map isn't the map (the tour opens /universe itself).
const FEED_PAGE = /^\/(home|experience(\/[^/]+)?|projects|resume|contact|travel)$/;
export const samePage = (pathname, path) => pathname === path || (FEED_PAGE.test(pathname) && FEED_PAGE.test(path));

// The pages an audience tour may take you to by itself: quick to open and
// always the same. Not the front door (it may send you on, or ask which
// view), a place on the map (the camera flies there), a role (the feed
// lands part way down) or a world (a download, and a gate on a phone): a
// tour offers those with a button and ends there.
export const LIGHT_ROUTES = /^\/(home|experience|projects(\/[^/]+)?|resume|contact|travel|terminal|changes|universe)$/;
export const isLightRoute = (pathname) => LIGHT_ROUTES.test(pathname ?? '');
// A chapter marked `world` is the exception: the player's tour walks into a
// world (its `path`) and waits for it, its download gate included, since a
// phone takes the whole tour too; a world kept light is toured as it is.

// The universe's on the map; the classic site's everywhere else, since the
// nav, the guide and the switch it shows are on every page.
export const tourFor = (pathname) => (isMapPath(pathname) ? 'universe' : 'classic');

// The pages a first arrival lands on: the map, and the feed's pages. Not a
// world (it has its own first hint and the guide's note), a project, or the
// terminal.
const FEED = /^\/(home|experience(\/[^/]+)?|projects|resume|contact|travel)$/;

export const offerHere = (pathname, progress) => progress == null && (isMapPath(pathname) || FEED.test(pathname));

// The shell's stops an audience tour opens with (the view's tour, cut down):
// the hiring tour's way round each view, and the player's (whose map stops,
// the panel, the ships and the nav map, belong to its Flying chapter). Not
// the view tour's own hello and goodbye, which say "under a minute": an
// audience opens with its own hello. The nav's stops and the menu's stand in
// for each other by screen width; whichever isn't showing is dropped.
export const SHELL_STOPS = {
  recruiter: { classic: ['pages', 'view', 'search', 'menu', 'guide', 'resume'], universe: ['panel', 'view', 'search', 'menu', 'guide', 'resume'] },
  player: ['view', 'search', 'menu', 'resume'],
};
// (`shell`: the audience's shell stops if steps.js gives its own, as
// chapters/shared.js does; this file's otherwise)
export const shellStopsFor = (audience, view, shell = SHELL_STOPS) => {
  const keep = shell[audience] ?? shell.recruiter ?? SHELL_STOPS.recruiter;
  return Array.isArray(keep) ? keep : (keep[view] ?? keep.classic);
};

// A tour's chapters: the shell of the view you're in first, opening on the
// audience's hello if there is one, then the audience's own. The shell's
// page is the map in the universe; in the classic site, the page you're on
// if a tour may stand on it, else Home. A chapter with no page (an end
// card) stays on the one before; a heavy one (the map, on a phone) gives way
// on a coarse pointer to its `phone` chapters, each on a page of its own.
export function planFor(tours, audience, view, here, { coarse = false, shell, hello } = {}) {
  const own = tours[audience];
  if (!own?.length) return [];
  const keep = shellStopsFor(audience, view, shell);
  const universe = view === 'universe';
  const path = universe ? '/universe' : isLightRoute(here) && here !== '/universe' ? here : '/home';
  const stops = (tours[universe ? 'universe' : 'classic'] ?? []).filter((s) => keep.includes(s.id));
  const first = hello?.[audience] ?? hello?.recruiter;
  let at = path;
  return [{ id: 'shell', title: 'Getting about', path, stops: first ? [first, ...stops] : stops }, ...own]
    .flatMap((c) => (c.heavy && coarse && Array.isArray(c.phone) ? c.phone.map((p) => ({ ...p, from: c.id })) : [c]))
    .map((c) => {
      at = c.path ?? at;
      return c.path === at ? c : { ...c, path: at };
    });
}

// A tour made of others' chapters, by id, never by place: [name, from, to]
// takes that tour's chapters from the one called `from` to the one called
// `to`; a chapter itself (the shared end card) goes in as it is. Stored
// lists never hold the shell: planFor adds it to every tour.
export function compose(tours, recipe) {
  return recipe.flatMap((item) => {
    if (!Array.isArray(item)) return [item];
    const [name, from, to] = item;
    const list = tours[name];
    if (!list) throw new Error(`compose: no tour “${name}”`);
    const a = list.findIndex((c) => c.id === from);
    const b = list.findIndex((c) => c.id === to);
    if (a < 0 || b < a) throw new Error(`compose: “${name}” has no chapters from “${from}” to “${to}”`);
    return list.slice(a, b + 1);
  });
}

// Where a tour starts: a chapter (and a stop in it, by id), the chapter
// whose stop shows a thing to do, or the start with nothing asked; null when
// what's asked isn't in it.
export function startAt(chapters, { chapter, stop, todo } = {}) {
  if (todo) {
    const c = chapters.findIndex((ch) => ch.stops?.some((s) => s.todo === todo));
    return c < 0 ? null : { c, stop: chapters[c].stops.find((s) => s.todo === todo).id };
  }
  if (!chapter) return { c: 0 };
  // (a heavy chapter's id finds the first of its phone versions)
  const c = chapters.findIndex((ch) => ch.id === chapter || ch.from === chapter);
  return c < 0 ? null : { c, stop };
}

// Nothing over the page but the tour itself: not the intro, the cockpit or
// the phone menu (html's dataset), no dialog but the tour's own card (the
// card is a modal dialog too, and mustn't hold up its own tour), and no
// world asking before it downloads. `modals` says, for each modal open,
// whether it's the tour's card.
export const clearOf = ({ dataset = {}, modals = [], gate = false }) => !['covered', 'intro', 'menu'].some((k) => k in dataset) && modals.every(Boolean) && !gate;

// A chapter's page is ready once the router has it (the feed's own page for
// a feed path: the feed may have moved the address on as it settled),
// nothing's over it, and the feed's page has its code.
export const chapterReady = ({ pathname, path, feedTo, clear, loading }) => (pathname === path || (feedTo != null && feedTo === path)) && clear && !loading;

// A chapter's stops once its page is ready: those whose target isn't on
// this screen dropped (the nav's on a phone, where the menu's stands in), as
// the view's tour always has; a stop marked `wait` kept, to wait for a target
// that mounts late. A world's basics (`keep`, and a chapter that is one)
// keep every stop, in the middle where its target isn't showing.
export const resolveChapter = (stops, has, keep = false) =>
  keep ? stops.map((s) => (!s.at || has(s.at) ? s : { ...s, at: undefined })) : stops.filter((s) => !s.at || s.wait || has(s.at));

// Eight seconds at most for a page, or a late target: then the card in the
// middle, so a tour never hangs.
export const WAIT_MS = 8000;

// Asks `check` each tick until it answers, `timeout` passes, or the wait is
// called off. A check that answers 'hold' (a world asking whether to download
// its 3D: the visitor's to answer, however long they take) keeps waiting and
// starts the clock again. The clock and the ticks come in, so a test needs
// none.
export function waitUntil(check, { tick, now, timeout = WAIT_MS, cancelled = () => false }) {
  let from = now();
  return new Promise((resolve) => {
    const step = () => {
      if (cancelled()) return resolve('cancelled');
      const got = check(now() - from);
      if (got === 'hold') {
        from = now();
        return tick(step);
      }
      if (got) return resolve(got);
      if (now() - from >= timeout) return resolve('timeout');
      tick(step);
    };
    step();
  });
}

// The stops whose target is on this screen (`has(name)`), and the cards that
// point at nothing. A phone folds the nav's links, search and colours into
// the menu, so their stops drop out and the menu's comes in. A world's
// basics (`keep`) say everything at every stop, so one whose target isn't
// showing stays, as a card in the middle.
export const resolveSteps = (steps, has, keep = false) =>
  keep ? steps.map((s) => (!s.at || has(s.at) ? s : { ...s, at: undefined })) : steps.filter((s) => !s.at || has(s.at));

// The box lit round a target: `pad` off it all round, kept 2px inside the
// window (a phone's sheet of ships runs on past the bottom), or null when
// none of it is on the screen. Whole pixels, so a still target doesn't
// redraw the box every frame.
export function litBox(rect, view, pad) {
  const left = Math.round(Math.max(rect.left - pad, 2));
  const top = Math.round(Math.max(rect.top - pad, 2));
  const right = Math.round(Math.min(rect.right + pad, view.w - 2));
  const bottom = Math.round(Math.min(rect.bottom + pad, view.h - 2));
  return right - left < 1 || bottom - top < 1 ? null : { left, top, width: right - left, height: bottom - top };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, Math.max(lo, hi)));

// Where the card goes: below its target, else above, else to the right or
// the left, whichever it fits; with no room anywhere, the side with the most
// (over the target, but on the screen). With no target, the middle. Rects
// are the page's (getBoundingClientRect); `card` and `view` are { w, h }.
export function placeCard(target, card, view, { gap = 14, margin = 16 } = {}) {
  const inX = (left) => clamp(left, margin, view.w - card.w - margin);
  const inY = (top) => clamp(top, margin, view.h - card.h - margin);
  if (!target) return { side: 'center', top: inY((view.h - card.h) / 2), left: inX((view.w - card.w) / 2) };
  const room = { bottom: view.h - target.bottom, top: target.top, right: view.w - target.right, left: target.left };
  const fits = {
    bottom: room.bottom >= card.h + gap + margin,
    top: room.top >= card.h + gap + margin,
    right: room.right >= card.w + gap + margin,
    left: room.left >= card.w + gap + margin,
  };
  const side = ['bottom', 'top', 'right', 'left'].find((s) => fits[s]) ?? (room.top > room.bottom ? 'top' : 'bottom');
  const midX = target.left + target.width / 2 - card.w / 2;
  const midY = target.top + target.height / 2 - card.h / 2;
  if (side === 'bottom') return { side, top: inY(target.bottom + gap), left: inX(midX) };
  if (side === 'top') return { side, top: inY(target.top - gap - card.h), left: inX(midX) };
  if (side === 'right') return { side, top: inY(midY), left: inX(target.right + gap) };
  return { side, top: inY(midY), left: inX(target.left - gap - card.w) };
}
