// A soldier bot's way to where its brain sends it (`soldierBrain.js`'s act):
// a path planned on the level's navmesh where the battle has one, else the
// place's field for a place that stays, else a search on the navgrid round
// the still bots, in legs for a far goal; walked waypoint to waypoint, and
// planned again when it goes stale or the bot sticks. Split out of
// `soldierBrain.js` as it neared the size rule; its constants are re-exported
// there under the names they had. Pure.
//
//   navigate(brain, world, s, goal, dt, now) → metres moved
//   spotNear(nav, x, z, r, y) → [x, z] | null       NEAR_GOAL, REPLAN, FAR, LEG, SEARCH_CELLS, AVOID

import { findPath, walkable, cellAt, nearestWalkable } from '../nav.js';
import { meshNearest, meshPath } from '../meshNav.js';
import { fieldTo, legAlong } from '../navField.js';
import { move } from '../soldier.js';
import { clock, profile } from '../core.js';

// a walkable spot near a place: on the level's navmesh at the soldier's height where the battle has
// one (the floor it is on, not the one over it: meshNav.js), else the navgrid's
export const spotNear = (nav, x, z, r, y) => (nav?.mesh ? meshNearest(nav, x, z, r, y) : null) ?? nearestWalkable(nav, x, z, r);

export const NEAR_GOAL = 0.8;
export const REPLAN = 1.5; // seconds a path is kept before it is planned again
// A goal further than this is walked to by legs of LEG metres, each its own
// search, so a long walk across a Galactic Assault map never floods A*. By hand.
export const FAR = 80;
export const LEG = 40;
// How near the round of the place it was sent to a bot leaves that place's field for a search of its own, m (by hand).
const SENT_NEAR = 4;
// The cells one of those searches may open before it gives up, by hand.
export const SEARCH_CELLS = 6000;
// A waypoint cell a bot has failed to step into (open on the grid, too
// narrow for its body) is left out of its paths this long, by hand.
export const AVOID = 10;

const flat = (p) => [p[0], p[2]];
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// still bots' cells, which a path routes round (never the goal's own)
function blockedCells(world, s, goal, avoid = null) {
  const out = new Set(avoid ?? []);
  const gc = cellAt(world.nav, goal[0], goal[1]);
  const gi = gc ? gc[1] * world.nav.cols + gc[0] : -1;
  for (const o of world.others ?? []) {
    if (o === s || !o.alive || o.moving) continue;
    if (Math.hypot(o.at[0] - s.at[0], o.at[2] - s.at[2]) > 30) continue;
    const c = cellAt(world.nav, o.at[0], o.at[2]);
    if (!c) continue;
    const i = c[1] * world.nav.cols + c[0];
    if (i !== gi) out.add(i);
  }
  return out;
}

function plan(brain, world, s, goal, now) {
  const t0 = clock();
  const from = flat(s.at);
  const blocked = blockedCells(world, s, goal, now < (brain.avoidUntil ?? -Infinity) ? brain.avoid : null);
  const d = d2(from, goal);
  // (sent to a place that stays, a post or a fixed objective (its order says so), and not yet round it: its way is the place's
  // field first, which goes round what one search does not, a way too long for its cells and a wall thinner
  // than a cell, which the search walks into (a bot sent past either stood at the wall). navField.js: one
  // field for every bot sent there, kept on the navgrid; round the place itself a search of its own is
  // enough. A place that moves, a walker's or a crowd's middle, has no field: one would be made for each
  // place it passes)
  const t = world.task;
  const sent = t?.stays && d2(goal, t.at) <= (t.radius ?? 0) + 2 && d2(from, t.at) > (t.radius ?? 0) + SENT_NEAR ? t.at : null;
  let path = null;
  // (the level's own navmesh where the battle has one: its way, the floors one over another told apart; no
  // way on it, the base shut behind its gates, is a straight leg that the mesh's walls stop)
  const meshed = world.nav?.mesh ? meshPath(world.nav, from, goal, { fromY: s.at[1] }) : undefined;
  if (meshed) path = meshed;
  if (meshed === undefined && sent) {
    const f = fieldTo(world.nav, sent);
    path = f ? legAlong(world.nav, f, from, LEG) : null;
    if (path && path.length < 2) path = null;
  }
  if (meshed === undefined && !path && d <= FAR) path = findPath(world.nav, from, goal, { blocked, max: SEARCH_CELLS });
  // too far for one search, or walled off for now, and no field's way: a leg in a line toward it
  if (meshed === undefined && !path) {
    const k = Math.min(1, LEG / (d || 1));
    const mid = nearestWalkable(world.nav, from[0] + (goal[0] - from[0]) * k, from[1] + (goal[1] - from[1]) * k, 8);
    path = mid ? findPath(world.nav, from, mid, { blocked, max: SEARCH_CELLS }) : null;
  }
  brain.path = path ?? [from, goal];
  brain.pathGoal = goal;
  brain.pathAt = now;
  brain.wp = 1;
  if (profile.on) profile.path += clock() - t0;
}

export function navigate(brain, world, s, goal, dt, now) {
  if (!goal) return move(s, [0, 0], dt, world.nav);
  if (d2(flat(s.at), goal) < NEAR_GOAL) {
    brain.stuck = 0;
    return move(s, [0, 0], dt, world.nav);
  }
  if (!brain.path || !brain.pathGoal || d2(brain.pathGoal, goal) > 2 || now - brain.pathAt > REPLAN || brain.stuck > 1) plan(brain, world, s, goal, now);
  while (brain.wp < brain.path.length - 1 && d2(flat(s.at), brain.path[brain.wp]) < 0.6) brain.wp++;
  const wp = brain.path[Math.min(brain.wp, brain.path.length - 1)];
  const moved = move(s, [wp[0] - s.at[0], wp[1] - s.at[2]], dt, world.nav);
  brain.stuck = moved < 0.01 ? brain.stuck + dt : 0;
  if (brain.stuck > 3) {
    // nothing works: the cell it could not enter is left out a while, and a fresh path somewhere else near
    const wc = cellAt(world.nav, wp[0], wp[1]);
    if (wc) {
      if (now >= (brain.avoidUntil ?? -Infinity)) brain.avoid = new Set();
      brain.avoid.add(wc[1] * world.nav.cols + wc[0]);
      brain.avoidUntil = now + AVOID;
    }
    const a = brain.rand() * Math.PI * 2;
    const spot = spotNear(world.nav, s.at[0] + Math.cos(a) * 6, s.at[2] + Math.sin(a) * 6, 6, s.at[1]);
    const way = world.nav?.mesh && spot ? meshPath(world.nav, flat(s.at), spot, { fromY: s.at[1] }) : undefined;
    if (way) brain.path = way;
    else if (spot && walkable(world.nav, spot[0], spot[1])) brain.path = findPath(world.nav, flat(s.at), spot, { blocked: brain.avoid }) ?? [flat(s.at), spot];
    brain.wp = 1;
    brain.pathGoal = goal;
    brain.pathAt = now;
    brain.stuck = 0;
  }
  return moved;
}
