// Aiming at a star and jumping to it, the galaxy's way. Pure, tested in
// Node; scene.js reads it each frame.
//
// From anywhere on the map the other places are stars (farStars.js) or
// landmarks (landmarks.js); put the nose on one, within AIM_CONE, and it's
// the aim: its name shows with J to jump. A jump then comes round onto it
// first (`align`, as the galaxy's does: the ship turns until it's pointing
// true, or JUMP.align seconds have gone), then spools up and goes; the stick
// in the meantime calls it off.
//
// aimTargets(sector, at) → [{ id, at }]: everywhere in that sector there is
//   to jump to (somewhere the autopilot can go: the home sun is home, the
//   Twins are one place), not `at`, the place you're at
// aimFrom(from, nose, targets, keep) → { id, angle } | null: the one nearest
//   the nose within the cone (the galaxy's starAhead), of those far enough
//   off to be stars (past farStars.js's realAt: one nearer is somewhere to
//   fly to); `keep`, the one it had, is kept a little longer, so the aim
//   doesn't flick between two close ones
// jumpPhase(jump, { aligned, age, input }) → 'align' | 'spool' | 'cancel'
// nameShows({ k, station, picked, viewAll, onFoot, noseDot }) → whether a
//   place's name shows: all of them with the whole map in view (or no
//   ship); else one that's itself (k < 1: farStars.js's kOf), picked, aimed
//   at or gone to; else, flying, a star within NAME_CONE of the nose
//   (noseDot: the cosine to it), but never a far station (out there it's
//   not drawn at all: home is the sun)

import { FAR_STARS, realAt } from './farStars';
import { LANDMARKS } from './landmarks';
import { SUN } from './layout';
import { isGoal } from './ship';
import { WONDERS, reachOf } from './deep';
import { starAhead } from '../galaxy/systems';

const AIM_CONE = 0.06; // radians either side of the nose
const STICK = 0.012; // how much nearer another must be to take the aim
export const JUMP = { align: 4.5, aligned: 0.996 };
export const NAME_CONE = 0.14; // radians (8°): a far star's name shows this near the nose

const wonder = (id) => WONDERS.find((w) => w.id === id) ?? null;
const ALL = [
  ...FAR_STARS.filter((p) => !p.station).map((p) => ({ id: p.id, at: p.at, reach: p.reach, sector: p.sector })),
  ...[...new Map(LANDMARKS.map((l) => [l.id, l])).values()].map((l) =>
    l.id === 'sun' ? { id: 'home', at: SUN.at, reach: SUN.r, sector: l.sector } : { id: l.id, at: wonder(l.id)?.at ?? null, reach: wonder(l.id) ? reachOf(wonder(l.id)) : null, sector: l.sector },
  ),
].filter((t) => t.at && isGoal(t.id));

// (the map asks every frame: each sector's list, without the place you're
// at, made once and kept; read, never written)
const targetLists = new Map(); // sector → (the place you're at → list)
export const aimTargets = (sector, at) => {
  let bySector = targetLists.get(sector);
  if (!bySector) targetLists.set(sector, (bySector = new Map()));
  let list = bySector.get(at);
  if (!list) bySector.set(at, (list = ALL.filter((t) => t.sector === sector && t.id !== at).map(({ id, at: where, reach }) => ({ id, at: where, reach }))));
  return list;
};

// (the ways to each, written over from call to call: starAhead reads them
// and keeps none, and they were a record and a list a place every frame)
const dirs = [];
const pool = [];
const realArg = { reach: 0 }; // (realAt's question, kept)
export function aimFrom(from, nose, targets, keep = null) {
  let n = 0;
  for (const t of targets) {
    const dx = t.at[0] - from[0];
    const dy = t.at[1] - from[1];
    const dz = t.at[2] - from[2];
    const l = Math.hypot(dx, dy, dz) || 1;
    // (only a star: a place near enough to be itself is somewhere to fly to)
    if (t.reach != null) {
      realArg.reach = t.reach;
      if (l < realAt(realArg)) continue;
    }
    const d = pool[n] ?? (pool[n] = { id: null, dir: [0, 0, 0] });
    d.id = t.id;
    d.dir[0] = dx / l;
    d.dir[1] = dy / l;
    d.dir[2] = dz / l;
    dirs[n++] = d;
  }
  dirs.length = n;
  return starAhead(null, nose, { within: AIM_CONE, keep, stick: STICK, dirs });
}

export function jumpPhase(jump, { aligned, age, input }) {
  if (jump.phase !== 'align') return jump.phase;
  if (input) return 'cancel';
  return aligned > JUMP.aligned || age > JUMP.align ? 'spool' : 'align';
}

export function nameShows({ k, station, picked, viewAll, onFoot, noseDot }) {
  if (viewAll || picked || k < 1) return true;
  if (station || onFoot) return false;
  return noseDot > Math.cos(NAME_CONE);
}
