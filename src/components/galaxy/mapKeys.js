// The galaxy map's own keys (HoloMap.jsx) and its find: M closes it, and so
// does Escape, but Escape shuts the innermost open thing first (the find's
// list, which it clears; the films' panel; the key; the layers' switches on
// a phone), the map only when none is open (and on the 3D map an open sector
// before it: HoloMap.jsx); / goes to the find field, J jumps to the course,
// + − 0 zoom, Q and E turn the 3D map; the rest is the page's or the field's.
// Pure, tested.
//
// mapKeyAction({ key, meta, ctrl, alt, repeat }, { typing, canJump, findOpen, filmsOpen, keyOpen, layersOpen }) →
// 'close' | 'clearFind' | 'closeFilms' | 'closeKey' | 'closeLayers' | 'find' | 'jump' | 'zoomIn' | 'zoomOut' | 'fit' | 'turnLeft' |
// 'turnRight' | null
// pickAction(pick, id, current) → what pressing the system `id` does when `pick` is picked and `current` is where you are:
// 'pick' it (plot the course), 'jump' to it (it's picked already), or 'clear' the pick (it's where you are, picked)
// courseOf(pick, current) → the system the course is to: the pick, unless it's where you are, or none
// seedPick(course, current, systems) → the pick the map opens with: the course the page kept, unless it's where you are or no system
// findSystems(q, systems, n = 6) → the systems whose name has `q` in it, the
// ones that start with it first, at most n.
export function mapKeyAction({ key, meta, ctrl, alt, repeat }, { typing = false, canJump = false, findOpen = false, filmsOpen = false, keyOpen = false, layersOpen = false } = {}) {
  if (typeof key !== 'string' || meta || ctrl || alt) return null; // (an autofill's keydown has no key)
  const k = key.length === 1 ? key.toLowerCase() : key;
  if (k === 'Escape') return findOpen ? 'clearFind' : filmsOpen ? 'closeFilms' : keyOpen ? 'closeKey' : layersOpen ? 'closeLayers' : 'close';
  if (typing) return null;
  if (k === 'm') return repeat ? null : 'close'; // (a held M that opened the map mustn't shut it again)
  if (k === '/') return 'find';
  if (k === 'j') return canJump ? 'jump' : null;
  if (k === '+' || k === '=') return 'zoomIn';
  if (k === '-' || k === '_') return 'zoomOut';
  if (k === '0') return 'fit';
  if (k === 'q') return 'turnLeft'; // (the 3D map's: HoloMap.jsx)
  if (k === 'e') return 'turnRight';
  return null;
}

// (a double click is two presses, so it is this twice: the first picks, and the second jumps only if it lands on the system that's
// picked now. The map can have moved under the pointer between them, and the second then picks the one it landed on instead)
export const pickAction = (pick, id, current) => (pick !== id ? 'pick' : id === current ? 'clear' : 'jump');

export const courseOf = (pick, current) => (pick && pick !== current ? pick : null);
export const seedPick = (course, current, systems) => (course && course !== current && systems.some((s) => s.id === course) ? course : null);

export function findSystems(q, systems, n = 6) {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  const hits = systems.filter((s) => s.name.toLowerCase().includes(t));
  const starts = (s) => s.name.toLowerCase().startsWith(t);
  return [...hits.filter(starts), ...hits.filter((s) => !starts(s))].slice(0, n);
}
