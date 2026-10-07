// The visit's seed, so the universe's characters, hunters and wing draw the
// same numbers for a whole visit and a bug seen once can be seen again: the
// address's `?seed=N` first (lib/ai/inspect.js's flags: the check scripts
// and a bug report pin it), else the one this visit made on its first ask
// and kept in sessionStorage 'tp-visit-seed', so a reload is the same visit.
// Where there's no session to keep it in (a private window, Node) it's kept
// for the page instead.
//
//   seedOf({ search, session } = {}) → an int
//     search: an address's query (the page's own when left out)
//     session: a Storage-like (window.sessionStorage when left out)
import { flags } from '../../lib/ai/inspect';

const KEY = 'tp-visit-seed';
let page = null; // the seed when there's nowhere to keep one

const sessionOf = () => {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null; // (blocked site data throws on access)
  }
};

export function seedOf({ search, session } = {}) {
  const pinned = (search === undefined ? flags() : flags({ search })).seed;
  if (pinned !== null) return pinned | 0;
  const store = session === undefined ? sessionOf() : session;
  try {
    const kept = store?.getItem(KEY);
    if (kept !== null && kept !== undefined && kept !== '' && Number.isFinite(Number(kept))) return Number(kept) | 0;
  } catch {
    /* blocked: the page's own, below */
  }
  page ??= Date.now() | 0;
  try {
    store?.setItem(KEY, String(page));
  } catch {
    /* blocked: kept for the page alone */
  }
  return page;
}
