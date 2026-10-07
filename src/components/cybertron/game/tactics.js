// How a Decepticon fights, as actions (lib/ai/action): it holds and looks
// about when it has lost Optimus, advances on him from far off, strafes
// round him in range, takes cover behind something solid when it's hurt,
// goes round to his other side when it can't get a shot in, searches where
// it last guessed he was, and fires only down a clear line with a shot
// token in hand. Which of those it wants is weighed (lib/ai/utility) every
// RETHINK seconds, not every frame: a choice a visitor can't see change
// faster than that costs nothing to hold. The handoff's cover and flank
// postures, which a mode alone couldn't give a body, are what the actor is
// for: the action knows its body (crouched in cover, up to fire), so the
// scene never guesses. Pure, no three.js; rules.js's stepEnemies calls it
// once a step for every Decepticon on its feet.
//
//   ACTIONS: { hold, advance, strafe, cover, flank, search, fire } (each an Action)
//   OPTIONS: utility options over the movement modes (fire is tried every step on its own)
//   step(e, b, player, dt, world, rand, tokens, trace, into?) → { shots, events }
//     (into: arrays to push onto, stepEnemies' own, in place of new ones)
//     e: rules.js's enemy (gains actor, mode, think, cover, flankAt, guess, inCover, body);
//     b: its perception belief of him, or null; tokens: lib/ai/squad's createTokens, or null
//   RETHINK, SHOTS_AT_ONCE

import { createActor, goTo } from '../../../lib/ai/action';
import { candidates, cover as covered, nearTo, pickPlace, visible } from '../../../lib/ai/spatial';
import { consider, curve, pick } from '../../../lib/ai/utility';
// (a cycle: rules.js calls step, and step moves bodies by rules.js's
// geometry; both sides use the other only inside functions, never while
// their module loads, so either can be imported first)
import { ENEMY_KINDS, ENEMY_SENSES, ROBOT, SHOT, overlap, resolve, segmentClear } from './rules';

export const RETHINK = 0.4; // seconds between choices
export const SHOTS_AT_ONCE = 3; // Decepticons firing at Optimus at once, at most (the sim's token pool)
const SEARCH_SCAN = 2; // seconds looking about where it guessed he was
const COVER_RING = 14; // how far round it looks for cover
const RETRY = 0.2; // a blocked shot (or no token free) tried again so soon, not every frame
const LOOK_AGAIN = 1; // seconds before a place that wasn't found is looked for again
const STUCK_COVER = 2; // seconds before cover it couldn't reach is tried again

// cover's two bodies (kept, so a frame's body is a frame's same object)
const CROUCHED = Object.freeze({ base: 'crouch', rise: true });
const RUNNING = Object.freeze({ base: null });

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);
const toward = (from, to, step) => from + clamp(wrap(to - from), -step, step);

// his chest, and a Decepticon's eye
const hisHeight = (p) => (p.mode === 'vehicle' ? 1.5 : ROBOT.height * 0.6);
const eyeOf = (e) => e.y + e.h * 0.75;

// somewhere it could stand: inside the area and not inside anything tall
function standable(world, e) {
  const B = world.bounds;
  return (x, z) => {
    if (x < B.minX + e.r || x > B.maxX - e.r || z < B.minZ + e.r || z > B.maxZ - e.r) return false;
    for (const s of world.near(x, z, e.r)) {
      if (s.base >= e.y + e.h || s.top <= e.y + ROBOT.step) continue;
      if (overlap(s, x, z, e.r)) return false;
    }
    return true;
  };
}

// whether he'd see (and shoot) a Decepticon crouched at p: his chest to its middle
const seesFrom = (ctx) => (t, p) => segmentClear(ctx.world, t.x, t.y + hisHeight(ctx.player), t.z, p.x, (p.y ?? ctx.e.y) + ctx.e.h * 0.5, p.z);
const threatOf = (p) => ({ x: p.x, y: p.y, z: p.z });

// The cover nearest his range that he can't see into, near where it is
// now, keeping the one it has unless another is clearly better
function coverPoint(ctx) {
  const { e, k, player, world } = ctx;
  // (two rings: the wall it's beside, and the one a dash away)
  const walkable = standable(world, e);
  const pts = [...candidates(e, { ring: COVER_RING / 2, n: 8, walkable }), ...candidates(e, { ring: COVER_RING, n: 12, walkable })];
  const threat = threatOf(player);
  const sees = seesFrom(ctx);
  const best = pickPlace(pts, [covered([threat], sees, 2), nearTo(threat, k.range)], { current: e.cover, hysteresis: 0.15 });
  if (!best || sees(threat, best.at)) return null;
  return { x: best.at.x, y: best.at.y, z: best.at.z };
}

// Round to his other side: behind the way he faces (where his guns
// aren't), the shorter way round, somewhere it can see him from
function flankPoint(ctx) {
  const { e, k, player, world, d } = ctx;
  const ring = clamp(d, 20, k.range * 0.7);
  const fx = Math.sin(player.yaw ?? 0);
  const fz = Math.cos(player.yaw ?? 0);
  const behind = candidates(threatOf(player), { ring, n: 16, walkable: standable(world, e), y: e.y }).filter((p) => (p.x - player.x) * fx + (p.z - player.z) * fz < -0.25 * ring);
  const threat = threatOf(player);
  const sees = seesFrom(ctx);
  const best = pickPlace(behind, [nearTo(e, ring * 3), visible(threat, sees, 0.5)], { current: e.flankAt, hysteresis: 0.15 });
  return best ? { x: best.at.x, y: best.at.y, z: best.at.z } : null;
}

// the line from its gun to his chest, where it believes he is
function lineClear(ctx) {
  const { e, player, est, world } = ctx;
  return segmentClear(world, e.x, eyeOf(e), e.z, est.x, player.y + hisHeight(player), est.z);
}

// a walk somewhere, then something else once there (cover's crouch, a search's look about)
function walkThen(pointOf, reach, there) {
  return {
    start(ctx) {
      const walk = goTo(() => pointOf(ctx), { reach, stuck: 2 });
      return { walk, w: walk.start(ctx), there: false, t: 0 };
    },
    step(s, ctx, dt) {
      if (!s.there) {
        const r = s.walk.step(s.w, ctx, dt);
        if (r === 'failed') return 'failed';
        if (r !== 'done') return 'running';
        s.walk.end(s.w, ctx);
        s.there = true;
      }
      ctx.me.to = null;
      return there(s, ctx, dt);
    },
    end(s, ctx) {
      if (s && !s.there) s.walk.end(s.w, ctx);
    },
  };
}

// cover's walk, then down behind it; a place he has walked round so he can
// see into it is no cover: done, and chosen again (or something else is)
const COVER_WALK = walkThen(
  (ctx) => ctx.e.cover,
  1,
  (s, ctx, dt) => {
    ctx.e.inCover = true;
    s.t += dt;
    if (s.t >= RETHINK) {
      s.t = 0;
      // (and cover from a fight that has gone off elsewhere is no use either)
      if (ctx.d > ctx.k.range * 1.2 || seesFrom(ctx)(threatOf(ctx.player), ctx.e.cover)) return 'done';
    }
    return 'running';
  },
);

// the search's walk to its guess (kept on the enemy), then a look about
const SEARCH_WALK = walkThen(
  // (the guess as it drifts the way he went, while there is one)
  (ctx) => {
    if (ctx.b?.at) ctx.e.guess = { x: ctx.b.at.x, z: ctx.b.at.z };
    return ctx.e.guess;
  },
  3,
  (s, ctx, dt) => {
    s.t += dt;
    ctx.e.yaw += Math.sin(s.t * 2.4) * dt * 1.8;
    return s.t >= SEARCH_SCAN ? 'done' : 'running';
  },
);

export const ACTIONS = {
  // lost him: stands where it is and looks about
  hold: {
    start: () => ({}),
    step(s, ctx, dt) {
      const { e } = ctx;
      e.t += dt;
      if (!ctx.est) e.yaw += Math.sin(e.t * 1.5) * dt * 1.2;
      return 'running';
    },
  },
  // straight at where it believes he is
  // (with nothing to go at, a belief faded between rethinks, it fails to hold)
  advance: {
    recover: 'hold',
    step(s, ctx) {
      const { est, e, k, d } = ctx;
      if (!est) return 'failed';
      ctx.vel = { x: ((est.x - e.x) / d) * k.speed, z: ((est.z - e.z) / d) * k.speed };
      return 'running';
    },
  },
  // round him, one way then (now and then) the other, backing off if too close
  strafe: {
    recover: 'hold',
    start: () => ({ t: 0 }),
    step(s, ctx, dt) {
      const { est, e, k, d, rand } = ctx;
      if (!est) return 'failed';
      s.t += dt;
      if (s.t > 2.2) {
        s.t = 0;
        e.dir = rand() < 0.5 ? -1 : 1;
      }
      const dx = est.x - e.x;
      const dz = est.z - e.z;
      const back = d < 18 ? -0.8 : 0;
      ctx.vel = { x: (dz / d) * e.dir * k.speed * 0.6 + (dx / d) * back * k.speed, z: (-dx / d) * e.dir * k.speed * 0.6 + (dz / d) * back * k.speed };
      return 'running';
    },
  },
  // hurt: to the nearest place he can't see into, and down behind it (up to fire)
  cover: {
    recover: 'hold',
    can(ctx) {
      if ((ctx.e.coverStuck ?? 0) > 0) return 'stuck';
      const at = coverPoint(ctx);
      if (!at) {
        // (none round here: not looked for again at once, it costs a dozen sight lines)
        ctx.e.coverStuck = LOOK_AGAIN;
        return 'no cover';
      }
      ctx.e.cover = at;
      return null;
    },
    start: (ctx) => COVER_WALK.start(ctx),
    step: (s, ctx, dt) => COVER_WALK.step(s, ctx, dt),
    end(s, ctx, why) {
      COVER_WALK.end(s, ctx);
      ctx.e.inCover = false;
      if (why === 'failed') {
        ctx.e.coverStuck = STUCK_COVER;
        ctx.e.cover = null;
      }
    },
    // running to it on its feet; crouched once there
    body: (s) => (s?.there ? CROUCHED : RUNNING),
  },
  // to his other side
  flank: {
    recover: 'hold',
    can(ctx) {
      if ((ctx.e.flankStuck ?? 0) > 0) return 'stuck';
      const at = flankPoint(ctx);
      if (!at) {
        ctx.e.flankStuck = LOOK_AGAIN;
        return 'nowhere';
      }
      ctx.e.flankAt = at;
      return null;
    },
    ...walkThen(
      (ctx) => ctx.e.flankAt,
      2,
      () => 'done',
    ),
  },
  // where it guessed he went, then a look about
  search: {
    recover: 'hold',
    can: (ctx) => (ctx.b?.at ? null : 'no guess'),
    start(ctx) {
      ctx.e.guess = { x: ctx.b.at.x, z: ctx.b.at.z };
      return SEARCH_WALK.start(ctx);
    },
    step: (s, ctx, dt) => SEARCH_WALK.step(s, ctx, dt),
    end: (s, ctx) => SEARCH_WALK.end(s, ctx),
  },
  // one shot, down a clear line, with a token: a shot that isn't taken gives its token back
  fire: {
    priority: 1,
    cutBy: 'none',
    can(ctx) {
      const { e, k, tokens } = ctx;
      if (ctx.player.dead) return 'down';
      if (!ctx.sure) return 'unsure';
      if (ctx.d >= k.range) return 'far';
      if (e.cooldown > 0) return 'cooling';
      // (none free: no need to look down the line yet)
      if (!free(ctx)) return 'no token';
      if (!lineClear(ctx)) {
        tokens?.release('shot', e.id);
        return 'blocked';
      }
      if (tokens && !tokens.claim('shot', e.id)) return 'no token';
      return null;
    },
    start: () => ({ shot: false }),
    step(s, ctx) {
      const { e, k, player, est, rand } = ctx;
      const ex = e.x;
      const ey = eyeOf(e);
      const ez = e.z;
      const px = est.x;
      const py = player.y + hisHeight(player);
      const pz = est.z;
      const yaw = Math.atan2(px - ex, pz - ez) + ((rand() - 0.5) * 6 * Math.PI) / 180;
      const pitch = Math.atan2(py - ey, Math.hypot(px - ex, pz - ez)) + ((rand() - 0.5) * 3 * Math.PI) / 180;
      const speed = SHOT.speed * 0.6;
      ctx.out.shots.push({ from: 'enemy', by: e.id, x: ex, y: ey, z: ez, vx: Math.sin(yaw) * Math.cos(pitch) * speed, vy: Math.sin(pitch) * speed, vz: Math.cos(yaw) * Math.cos(pitch) * speed, ttl: 1.6, damage: k.damage });
      ctx.out.events.push({ type: 'enemyFire', id: e.id });
      e.cooldown = k.cooldown * (0.8 + 0.4 * rand());
      s.shot = true;
      ctx.fired = true;
      return 'done';
    },
    end(s, ctx) {
      if (!s?.shot) ctx.tokens?.release('shot', ctx.e.id);
    },
  },
};


// how far off he is as a share of its range: 0 by half its range, 1 past it
const farness = (c) => consider(c.d / c.k.range, [0.5, 1.1], curve.logistic(12, 0.55));
const sure = (c) => (c.sure ? 1 : 0);
// whether it could get a shot in: a token free, or one in hand
const free = (c) => !c.tokens || c.tokens.count('shot') < SHOTS_AT_ONCE || c.tokens.held('shot', c.e.id);
// how squarely he faces it (his guns on it)
const facing = (c) => {
  const p = c.player;
  const dx = c.e.x - p.x;
  const dz = c.e.z - p.z;
  const d = Math.hypot(dx, dz) || 1;
  return consider((Math.sin(p.yaw ?? 0) * dx + Math.cos(p.yaw ?? 0) * dz) / d, [-0.2, 0.7]) * 0.7 + 0.3;
};

// Weighed every RETHINK seconds; the running one gets a little momentum.
// Multiplied, so a zero rules one out: without a belief only hold is left.
export const OPTIONS = [
  { id: 'hold', weight: 0.05, considerations: [] },
  { id: 'search', weight: 0.9, considerations: [(c) => (c.b && !c.sure ? 1 : 0)] },
  { id: 'advance', considerations: [sure, farness] },
  { id: 'strafe', considerations: [sure, (c) => 1 - farness(c), (c) => (free(c) ? 1 : 0.5)] },
  { id: 'cover', weight: 1.4, considerations: [(c) => (c.b ? 1 : 0), (c) => (c.k.boss ? 0 : 1), (c) => (c.d <= c.k.range * 1.2 ? 1 : 0), (c) => consider(c.e.hp / c.k.hp, [0.45, 0.55], curve.inverse)] },
  { id: 'flank', weight: 0.9, considerations: [sure, (c) => (c.k.boss ? 0 : 1), (c) => (c.d <= c.k.range * 1.2 ? 1 : 0), (c) => (free(c) ? 0.15 : 1), facing] },
];

function beliefNote(b) {
  return b ? { at: { x: b.at.x, z: b.at.z }, confidence: b.confidence, visible: Boolean(b.visible) } : null;
}

// Choose (the best the actor will take: cover with none near falls to the next)
function rethink(e, ctx, trace) {
  const chosen = pick(OPTIONS, ctx, { current: e.mode });
  const scores = chosen?.scores ?? {};
  const order = OPTIONS.map((o) => o.id)
    .filter((id) => scores[id] > 0)
    .sort((a, b) => scores[b] - scores[a]);
  for (const id of order) {
    if (e.actor.current() === id) {
      e.mode = id;
      break;
    }
    const r = e.actor.want(id, ctx);
    if (r === 'started' || r === 'busy') {
      e.mode = id;
      break;
    }
  }
  if (trace?.note) trace.note(e.id, e.me.now, { mode: e.mode, action: e.actor.current(), phase: e.actor.current() ? 'running' : 'idle', scores, belief: beliefNote(ctx.b) });
}

const CONTEXTS = new WeakMap(); // enemy → its step's context, one each

export function step(e, b, player, dt, world, rand, tokens, trace, into = null) {
  const out = into ?? { shots: [], events: [] };
  const k = ENEMY_KINDS[e.kind];
  e.me ??= { pos: { x: e.x, y: e.y, z: e.z }, beliefs: {}, now: 0 };
  e.me.pos.x = e.x;
  e.me.pos.y = e.y;
  e.me.pos.z = e.z;
  e.actor ??= createActor({ actions: ACTIONS, id: e.id, trace, now: () => e.me.now });
  e.dir ??= 1;
  e.t ??= 0;
  const sureOf = Boolean(b && (b.visible || (e.me.now ?? 0) - b.seenAt <= ENEMY_SENSES.intuition));
  const est = b ? (sureOf ? player : b.at) : null;
  e.guessed = Boolean(b && !sureOf);
  const d = est ? Math.sqrt((est.x - e.x) ** 2 + (est.z - e.z) ** 2) || 1e-6 : Infinity;
  // (one context an enemy, filled afresh each step: a crowd stepping every frame needn't make garbage)
  // (kept off the enemy: it points back at the enemy, and an enemy is plain data)
  let ctx = CONTEXTS.get(e);
  if (!ctx) CONTEXTS.set(e, (ctx = {}));
  ctx.me = e.me;
  ctx.e = e;
  ctx.k = k;
  ctx.b = b;
  ctx.player = player;
  ctx.world = world;
  ctx.rand = rand;
  ctx.tokens = tokens;
  ctx.est = est;
  ctx.sure = sureOf;
  ctx.d = d;
  ctx.out = out;
  ctx.vel = null;
  ctx.fired = false;
  e.cooldown -= dt;
  if (e.coverStuck > 0) e.coverStuck -= dt;
  if (e.flankStuck > 0) e.flankStuck -= dt;

  // what it wants, now and then (or at once when it has nothing on)
  e.think = (e.think ?? 0) - dt;
  if (e.think <= 0 || !e.actor.current()) {
    e.think = RETHINK;
    rethink(e, ctx, trace);
  }
  // a shot, whenever there's one to take
  // (only asked when there could be one: fire's own can says the rest)
  if (e.cooldown <= 0 && sureOf && d < k.range && !player.dead) {
    const why = e.actor.want('fire', ctx);
    if (why === 'blocked' || why === 'no token') e.cooldown = RETRY;
  }
  let r = e.actor.step(ctx, dt);
  // the shot taken (in one step), back to what it was doing, its body this frame
  if (r.id === 'fire' && !e.actor.current() && e.mode) {
    e.actor.want(e.mode, ctx);
    r = e.actor.step(ctx, 0);
  }

  // moving: where an action steers (a velocity) or walks to (a point)
  let vx = 0;
  let vz = 0;
  if (ctx.vel) {
    vx = ctx.vel.x;
    vz = ctx.vel.z;
  } else if (e.me.to) {
    const dx = e.me.to.x - e.x;
    const dz = e.me.to.z - e.z;
    const m = Math.sqrt(dx * dx + dz * dz);
    if (m > 0.05) {
      // (running to cover or round him; and never past the point in one step)
      const run = e.actor.current() === 'search' ? 1 : 1.3;
      const v = Math.min(k.speed * run, m / Math.max(dt, 1e-6));
      vx = (dx / m) * v;
      vz = (dz / m) * v;
    }
  }
  e.x += vx * dt;
  e.z += vz * dt;
  resolve(world, e, e.r, e.h, ROBOT.step);
  e.y = world.floorAt(e.x, e.z, e.y + 1, ROBOT.step);
  e.me.pos.x = e.x;
  e.me.pos.y = e.y;
  e.me.pos.z = e.z;
  // facing: him, where it believes he is; else the way it goes
  if (est && e.actor.current() !== 'search') e.yaw = toward(e.yaw, Math.atan2(est.x - e.x, est.z - e.z), 4 * dt);
  else if (vx * vx + vz * vz > 0.25) e.yaw = toward(e.yaw, Math.atan2(vx, vz), 4 * dt);

  e.state = e.actor.current() ?? 'hold';
  if (ctx.fired || e.bodyOf !== r.body || !e.body) e.body = r.body ? { ...r.body, fire: ctx.fired } : { fire: ctx.fired };
  e.bodyOf = ctx.fired ? null : r.body;
  return out;
}
