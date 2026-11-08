// The launch: what a visit to the front door (/) goes through before the
// universe is shown, as pure rules (Launch.jsx plays them). Every visit opens
// on the welcome; a first one's main way in is the intro (a quick tour of
// the site, the opening crawl, a cockpit), a return's the universe itself,
// or the classic site for a visitor who last picked it. Behind all of it the
// universe map gets ready (its code, pictures and shaders: lib/mapReady), so
// whoever comes out of the welcome, the tour or the cockpit finds it drawing.
// If they come out before it is, the arrival keeps a full-page cover up, with
// the map's bar, till it is: never the map half made, never its loading
// screen over a black page.
//
// Stages: 'welcome' → 'tour' → 'crawl' → 'cockpit' → 'arrive', any of them
// skipped to the arrival; with reduced motion the tour goes straight to it.

// index.html's verdict, html[data-intro]: '1' a first visit, 'back' a return
// (each only at the front door), anything else no launch
export const visitOf = (intro) => (intro === '1' ? 'first' : intro === 'back' ? 'back' : null);

// The welcome's ways in: the main button, the second beside it and the line
// under them. A first visit is offered the intro; a return goes back to
// whichever view it last picked, the intro beside it.
export function waysIn({ visit, start }) {
  if (visit !== 'back') return { main: 'intro', second: 'universe', alt: 'classic' };
  if (start === 'home') return { main: 'classic', second: 'universe', alt: 'intro' };
  return { main: 'universe', second: 'intro', alt: 'classic' };
}

// What each way in says, by visit
export const WAY_LABELS = {
  first: { intro: 'Start the intro', universe: 'Skip to the universe', classic: 'Go to the classic site' },
  back: { intro: 'Replay the intro', universe: 'Enter the universe', classic: 'Open the classic site' },
};
export const wayLabel = (visit, way) => (WAY_LABELS[visit] ?? WAY_LABELS.first)[way];

// Esc on the welcome: a first visit skips to the universe (as it always
// has); a return takes its main way in
export const escapeWay = (visit, ways) => (visit === 'back' ? ways.main : 'universe');

// The stage after this one. With reduced motion the crawl and the cockpit
// are left out: the tour ends in the universe.
export function after(stage, { reduced = false } = {}) {
  if (stage === 'welcome') return 'tour';
  if (stage === 'tour') return reduced ? 'arrive' : 'crawl';
  if (stage === 'crawl') return 'cockpit';
  if (stage === 'cockpit') return 'arrive';
  return null;
}

// The stages that cover the whole page (html[data-covered]): all of them
export const covers = (stage) => stage === 'welcome' || stage === 'tour' || stage === 'crawl' || stage === 'cockpit' || stage === 'arrive';

// The arrival, step by step (lib/mapReady's states): 'wait' under the cover;
// 'uncover' once the map is made (or no map at all has come for
// ARRIVE_GRACE ms: the universe's page itself slow to come), so it draws
// its first frame under the arrival's card; 'done' once that frame is drawn
// (or FIRST_DRAW_WAIT after uncovering, or there's no map to draw), and the
// card fades off it. Off the map (the classic site), 'done' at once.
export const ARRIVE_GRACE = 4000;
export const FIRST_DRAW_WAIT = 4000;
export function arrival({ map, since, now, uncoveredAt = null, onMap = true }) {
  if (!onMap) return 'done';
  const state = map?.state ?? 'none';
  if (uncoveredAt == null) {
    if (state === 'ready' || state === 'drawing' || (state === 'none' && now - since >= ARRIVE_GRACE)) return 'uncover';
    return 'wait';
  }
  if (state === 'drawing' || state === 'none' || now - uncoveredAt >= FIRST_DRAW_WAIT) return 'done';
  return 'uncover';
}

// How the universe is getting on behind the welcome and the tour: a line
// under their buttons ('' with no map coming)
export function readyLine(map) {
  if (map?.state === 'ready' || map?.state === 'drawing') return 'The universe is ready';
  if (map?.state === 'loading') return `Getting the universe ready · ${Math.round(Math.min(1, Math.max(0, map.value || 0)) * 100)}%`;
  return '';
}

// The intro's parts as the welcome lists them
export function routeOf({ reduced = false } = {}) {
  const tour = { id: 'tour', title: 'A quick tour', text: 'How the site works, in five cards' };
  const universe = { id: 'universe', title: 'The universe', text: 'Fly a ship to my pages and worlds' };
  if (reduced) return [tour, universe];
  return [tour, { id: 'crawl', title: 'Opening crawl', text: 'Half a minute, Star Wars style' }, { id: 'cockpit', title: 'A cockpit', text: 'Pick a ride, then launch' }, universe];
}
