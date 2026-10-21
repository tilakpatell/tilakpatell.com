// The doors' games, fetched ahead (spec 2026-10-18-avengers-hq-fix-and-hub-
// design, §5): within WARM_R of a door, its game's code and its scene's are
// fetched and warmed, so going in opens the game at once, with no "Opening
// the door…". The imports are the ones Place.jsx lazy-loads, so the chunks
// are shared.
import { nearPlace } from './rules';

// about two seconds' run from a door, so its game is fetched before he's at it
export const WARM_R = 15;

export const doorNear = (x, z) => nearPlace(x, z, WARM_R)?.id ?? null;

export const LOADERS = {
  stark: () => Promise.all([import('./Place'), import('../repulsor/RepulsorRange'), import('../repulsor/module')]),
  thor: () => Promise.all([import('./Place'), import('../lawn/HoldTheLawn'), import('../lawn/module')]),
  cap: () => Promise.all([import('./Place'), import('../ricochet/Ricochet'), import('../ricochet/module')]),
  hawkeye: () => Promise.all([import('./Place'), import('../trickshot/TrickShot'), import('../trickshot/module')]),
  widow: () => Promise.all([import('./Place'), import('../widow/Infiltration'), import('../widow/module')]),
  banner: () => Promise.all([import('./Place'), import('../smash/SmashRun'), import('../smash/module')]),
  spidey: () => Promise.all([import('./Place'), import('../thwip/Thwip'), import('../thwip/module')]),
  vault: () => Promise.all([import('./Place'), import('../tesseract/TesseractRun'), import('../tesseract/module')]),
};

// each door warms at most once a page
const WARMED = new Set();

// One fetch a door, with its module's warm() after it; a fetch that failed
// leaves the door to try again. → the fetch, or null when there's nothing to do
export function warmDoor(id, { loaders = LOADERS, warmed = WARMED } = {}) {
  const load = loaders[id];
  if (!load || warmed.has(id)) return null;
  warmed.add(id);
  return load()
    .then(([, , mod]) => mod?.default?.warm?.())
    .catch(() => {
      warmed.delete(id);
    });
}
