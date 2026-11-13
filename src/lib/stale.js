// After a deploy, the old build's files are gone (GitHub Pages swaps the
// whole site, and every file in /assets is named by its hash), but a page
// that's already open, or an index.html the browser or Pages' cache still
// holds (it keeps one for up to ten minutes), asks for them as it goes: a
// page, a stylesheet, the cockpit. Each of those comes back a 404, and what's
// asked for behind the intro shows only as the intro ends. A page with those
// errors reloads, once, from the new build (components/ErrorBoundary).

// how the browsers (and Vite, for a stylesheet) say a file that was there
// at the last deploy isn't there now
const STALE = /dynamically imported module|Failed to fetch|Loading chunk|Importing a module script failed|Unable to preload CSS/i;

export const isStale = (error) => STALE.test(error?.message || '');

export const STALE_KEY = 'tp-stale-reload'; // (sessionStorage) when it last reloaded for one
export const RETRY_AFTER = 60000; // ms: a reload that didn't help isn't tried again inside this

// Whether to reload now: not again straight after one that didn't help (an
// outage can't loop), but for a later deploy in the same tab, yes. Without
// storage to keep count, never; nor while the browser is offline (a file
// that wouldn't come then is no sign of a deploy, and the reload would only
// swap the page for the browser's offline screen), and then it keeps its turn.
export const browserOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;
export function mayReload(storage, now = Date.now(), online = browserOnline()) {
  if (!online) return false;
  try {
    const last = Number(storage.getItem(STALE_KEY));
    if (last && now - last < RETRY_AFTER) return false;
    storage.setItem(STALE_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

// The address with a query no cache has seen, so the reload gets this
// build's index.html, not the one cached with the old file names
// (`fresh`, tidied away again as the page loads: cleanHref).
const FRESH = 'fresh';
export function freshHref(href, now = Date.now()) {
  const url = new URL(href);
  url.searchParams.set(FRESH, now.toString(36));
  return url.href;
}

// The address without it (path, query and hash), or null if it isn't there.
export function cleanHref(href) {
  const url = new URL(href);
  if (!url.searchParams.has(FRESH)) return null;
  url.searchParams.delete(FRESH);
  return url.pathname + url.search + url.hash;
}

// The front door's launch is playing (components/launch says): a reload in the
// middle of it plays it again, rather than coming back to a visit that has
// "seen" it.
let replayIntro = false;
export const introPlaying = (on) => {
  replayIntro = on;
};

export function reloadFresh() {
  if (replayIntro)
    try {
      window.localStorage.removeItem('tp-intro');
    } catch {
      /* storage unavailable: it comes back without the intro */
    }
  window.location.replace(freshHref(window.location.href));
}

export const session = () => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};
