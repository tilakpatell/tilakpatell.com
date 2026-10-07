// Looking for someone who's got away. Rich Welsh's two-phase search
// (Crysis, Crackdown): phase 1, narrow, go to the last place they were
// seen (a cautious search sends one, the rest cover; an aggressive one up
// to three); phase 2, broad (aggressive only), a coordinator makes spots
// that could hide them (the caller's: cover hidden from the last known
// position, a town's doorways, the far sides of the planets) and hands
// each searcher the best unsearched one, scored near the estimate, near
// the searcher and a little near the truth (intuition); any spot a
// searcher can see on the way is searched for everyone; it ends by spots
// or by time, and lets the searchers go one at a time, never all at once.
// And Dishonored 2's flood for a chase's destination on a cell grid: heat
// from the last known cell with a barrier behind the last known direction,
// stopping in a wide room (give up, search slowly) but running on down a
// corridor. Pure, and seeded when no rand is given (lib/ai draws nothing unseeded).
//
//   createSearch({ rand, spots(belief) → [{ x, y, z }], narrow: { cautious, aggressive }, time, stagger })
//     → { start(belief, { aggressive, truth }), claim(id, at) → { at, phase } | null, arrive(id),
//         sweep(id, at, seesThrough), done(id) → bool, release(id), update(dt), state, active }
//   flood(grid, from, dir, { hot, perStep, steps }) → { x, z } | null
//     grid: { cell, walkable(x, z) → bool }; from: { x, z }; dir: { x, z } (the last known way, or null)

import { seeded } from '../seeded';
import { apart } from './vec';

export function createSearch({ rand = seeded(1), spots = () => [], narrow = { cautious: 1, aggressive: 3 }, time = 40, stagger = 2 } = {}) {
  const state = { active: false, aggressive: false, phase: 0, estimate: null, truth: null, clock: 0, spots: [], claims: {}, arrived: new Set(), released: [], releaseAt: 0 };
  const out = {
    state,
    get active() {
      return state.active;
    },
    start(b, { aggressive = false, truth = null } = {}) {
      state.active = true;
      state.aggressive = aggressive;
      state.phase = 1;
      state.estimate = { x: b.at.x, y: b.at.y ?? 0, z: b.at.z };
      state.truth = truth ? { x: truth.x, y: truth.y ?? 0, z: truth.z } : null;
      state.clock = 0;
      state.spots = [];
      state.claims = {};
      state.arrived = new Set();
      state.released = [];
      state.releaseAt = 0;
    },
    claim(id, at) {
      if (!state.active || state.released.includes(id)) return null;
      if (state.claims[id]) return state.claims[id];
      if (state.phase === 1) {
        const n = Object.values(state.claims).filter((c) => c.phase === 1).length;
        if (n >= (state.aggressive ? narrow.aggressive : narrow.cautious)) return null;
        return (state.claims[id] = { at: { ...state.estimate }, phase: 1 });
      }
      let best = null;
      let bestScore = Infinity;
      for (const s of state.spots) {
        if (s.searched || s.claimed) continue;
        const score = 2 * apart(s.at, state.estimate) + apart(s.at, at) + (state.truth ? 0.3 * apart(s.at, state.truth) : 0);
        if (score < bestScore) {
          bestScore = score;
          best = s;
        }
      }
      if (!best) return null;
      best.claimed = id;
      return (state.claims[id] = { at: { ...best.at }, phase: 2, spot: best });
    },
    // the claimant has reached its spot: searched; the first arrival at the
    // last known position moves an aggressive search on to the broad phase
    arrive(id) {
      const c = state.claims[id];
      if (!c) return;
      delete state.claims[id];
      if (c.phase === 1) {
        state.arrived.add(id);
        if (state.aggressive && state.phase === 1) {
          state.phase = 2;
          state.spots = spots({ at: state.estimate }).map((p) => ({ at: { x: p.x, y: p.y ?? 0, z: p.z }, searched: false, claimed: null }));
          for (const k of Object.keys(state.claims)) delete state.claims[k];
        } else if (!state.aggressive) state.phase = 3;
      } else if (c.spot) {
        c.spot.searched = true;
        c.spot.claimed = null;
      }
    },
    sweep(id, at, seesThrough = null) {
      if (state.phase !== 2) return 0;
      let n = 0;
      for (const s of state.spots) {
        if (s.searched || s.claimed === id) continue;
        if (seesThrough && !seesThrough(at, s.at)) continue;
        s.searched = true;
        n += 1;
        if (s.claimed) {
          delete state.claims[s.claimed];
          s.claimed = null;
        }
      }
      return n;
    },
    // whether this searcher is let go: the search is over (no spots left, or
    // out of time, or a cautious one looked) and its turn has come
    done(id) {
      if (!state.active) return true;
      if (state.released.includes(id)) return true;
      const over = state.phase === 3 || state.clock > time || (state.phase === 2 && !state.spots.some((s) => !s.searched));
      if (!over) return false;
      if (state.clock < state.releaseAt) return false;
      state.released.push(id);
      state.releaseAt = state.clock + stagger * (0.7 + 0.6 * rand());
      delete state.claims[id];
      return true;
    },
    release(id) {
      const c = state.claims[id];
      if (c?.spot) c.spot.claimed = null;
      delete state.claims[id];
    },
    update(dt) {
      if (state.active) state.clock += dt;
    },
    stop() {
      state.active = false;
    },
  };
  return out;
}

export function flood(grid, from, dir, { hot = 20, perStep = 25, steps = 30 } = {}) {
  const cell = grid.cell ?? 1;
  const key = (i, j) => `${i},${j}`;
  const walk = (i, j) => grid.walkable(i * cell, j * cell);
  const i0 = Math.round(from.x / cell);
  const j0 = Math.round(from.z / cell);
  if (!walk(i0, j0)) return null;
  const heat = new Map(); // key → value
  const barrier = new Set();
  const back = dir && (dir.x || dir.z) ? { x: -dir.x, z: -dir.z } : null;
  const behind = (i, j, bi, bj) => back && (i - bi) * back.x + (j - bj) * back.z > 0;
  heat.set(key(i0, j0), hot);
  let front = [[i0, j0]];
  let wall = [];
  if (back) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (behind(i0 + di, j0 + dj, i0, j0)) {
    barrier.add(key(i0 + di, j0 + dj));
    wall.push([i0 + di, j0 + dj]);
  }
  for (let s = 0; s < steps && front.length; s++) {
    const next = [];
    for (const [i, j] of front)
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = key(i + di, j + dj);
        if (heat.has(k) || barrier.has(k) || !walk(i + di, j + dj)) continue;
        heat.set(k, hot);
        next.push([i + di, j + dj]);
      }
    const fresh = new Set(next.map(([i, j]) => key(i, j)));
    for (const [k, v] of heat) if (!fresh.has(k) && v > 0) heat.set(k, v - 1);
    // the barrier grows with the flood, in the half-plane behind the way they went
    const nextWall = [];
    for (const [bi, bj] of wall)
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = key(bi + di, bj + dj);
        if (barrier.has(k) || heat.has(k) || !behind(bi + di, bj + dj, i0, j0)) continue;
        barrier.add(k);
        nextWall.push([bi + di, bj + dj]);
      }
    wall = nextWall;
    front = next;
    if (next.length > perStep) break;
  }
  let sx = 0;
  let sz = 0;
  let sw = 0;
  let bestK = null;
  let bestV = -1;
  for (const [k, v] of heat) {
    if (v <= 0) continue;
    const [i, j] = k.split(',').map(Number);
    sx += i * v;
    sz += j * v;
    sw += v;
    if (v > bestV) {
      bestV = v;
      bestK = [i, j];
    }
  }
  if (!sw) return { x: i0 * cell, z: j0 * cell };
  const ci = sx / sw;
  const cj = sz / sw;
  // the centroid where it's walkable and warm; else the warmest cell nearest it
  const ri = Math.round(ci);
  const rj = Math.round(cj);
  if ((heat.get(key(ri, rj)) ?? 0) > 0) return { x: ri * cell, z: rj * cell };
  let near = bestK;
  let nd = Infinity;
  for (const [k, v] of heat) {
    if (v <= 0) continue;
    const [i, j] = k.split(',').map(Number);
    const d = Math.hypot(i - ci, j - cj);
    if (d < nd) {
      nd = d;
      near = [i, j];
    }
  }
  return { x: near[0] * cell, z: near[1] * cell };
}
