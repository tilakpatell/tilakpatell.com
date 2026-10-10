// How the worlds' enemies fight, beyond standing and shooting (activity.js
// runs these on its targets each frame; the site's spawn says which, in
// `hostile`): bursts of fire, strafing round you, a shield that soaks hits
// before any land (a blade's spawn fences instead: duellists.js). Pure, so
// it's tested in Node.
//
//   hostile.burst   { n, gap }: n shots, `gap` seconds apart, each time it fires
//   hostile.strafe  { speed, every, keep }: it circles you at `speed` m/s, turning about every `every` seconds, holding about `keep` metres off
//   hostile.shield  n: hits it soaks before it's hurt (a droideka's bubble)
//
//   startBurst(hostile) → the shots left and the wait: { left, wait }
//   stepBurst(burst, dt) → how many shots fall due this frame (the burst
//     counted down; 0 once it's spent)
//   strafeStep(b, you, hostile, dt, time) → the new { x, z, yaw } (yaw: facing you)
//   absorb(t, damage) → { shield, hp } after a hit: the shield first, then the body

export const startBurst = (hostile) => ({ left: Math.max(1, hostile?.burst?.n ?? 1), wait: 0 });

export function stepBurst(burst, dt, gap = 0.12) {
  if (!burst || burst.left <= 0) return 0;
  burst.wait -= dt;
  let n = 0;
  while (burst.wait <= 0 && burst.left > 0) {
    n++;
    burst.left--;
    burst.wait += gap;
  }
  return n;
}

export function strafeStep(b, you, hostile, dt, time) {
  const s = hostile.strafe;
  const dx = you.x - b.x;
  const dz = you.z - b.z;
  const d = Math.hypot(dx, dz) || 1e-6;
  const yaw = Math.atan2(dx, dz);
  // across the line to you, one way then the other
  const side = Math.floor(time / (s.every ?? 2.2)) % 2 === 0 ? 1 : -1;
  const tx = -dz / d;
  const tz = dx / d;
  // and in or out, to hold the distance it likes
  const keep = s.keep ?? 10;
  const radial = d > keep * 1.25 ? 1 : d < keep * 0.75 ? -1 : 0;
  const step = (s.speed ?? 2.5) * dt;
  return { x: b.x + (tx * side + (dx / d) * radial * 0.6) * step, z: b.z + (tz * side + (dz / d) * radial * 0.6) * step, yaw };
}

export function absorb(t, damage) {
  const shield = Math.max(0, (t.shield ?? 0) - damage);
  const through = Math.max(0, damage - (t.shield ?? 0));
  return { shield, hp: t.hp - through };
}


// ── An enemy's head (lib/ai) ──
//
// What an enemy knows of you is what it perceives (lib/ai/perception): a
// cone and a range from its spawn's `hostile` (range × 1.3 to see, the
// range to hear a shot), a detection timer quick up close and slow at the
// edge, the truth kept a couple of seconds after it loses sight of you,
// then a guess that fades. It weighs what to do (lib/ai/utility) every
// STEP.rethink seconds: with you in sight and in range, a shooter holds
// its ground and fires, strafes if its spawn says so, backs off if you're
// too close, and, when it has no shot token (world.tokens: so many fire at
// once, the rest move) or it's hurt, takes cover from your line of fire
// (lib/ai/spatial) or flanks round to a spot off your side; one that comes
// for you (chase: a rancor, a duellist) closes to arm's reach, and a
// duellist stays where you can see it. Lost sight of you, it goes to look
// where it last had you; its guess gone, it joins the group's search
// (world.search, lib/ai/search's coordinator: spots that could hide you,
// shared), and gives up back to its wander. Never further from its home
// than its leash. Pure.
//
//   sensesFor(hostile) → lib/ai/perception's senses
//   hostileStep(t, world, dt, r) → { x, z, yaw, mode, moving, aim: { x, z } | null }
//     t: { b: { x, z, yaw, to, wait }, hostile, spec, home: [x, z], hp, hpMax, flinch, me?, mind?, belief?, sees? }
//     world: { you: { x, z } | null, allies: [{ x, z }], seesThrough(a, b) | null, tokens?, who?, search?, stims?, options? }
//     (who: this one's id for the tokens and the search)

import { lead } from '../../../lib/combat/accuracy';
import { BOLT_SPEED } from '../../../lib/combat/bolt';
import { belief, createSenses, sense } from '../../../lib/ai/perception';
import { consider, pick, runtime } from '../../../lib/ai/utility';
import { apart as awayFromAll, candidates, cover, nearTo, offLine, pickPlace, visible } from '../../../lib/ai/spatial';

export const STEP = {
  rethink: 0.4, // seconds between an enemy's choices
  keep: 10, // metres a shooter likes to keep, with no strafe to say otherwise
  pace: 1.6, // of its walk, moving to cover or round a flank
  look: 1.5, // metres from where it last had you: looked
  ring: 7, // metres out, the spots it weighs for cover or a flank
};

// (a shooter looks ahead, a wide cone; one that comes for you, a rancor, a duellist, smells and hears you all round)
export const sensesFor = (h = {}) => createSenses({ sight: { range: (h.range ?? 20) * 1.3, cone: h.cone ?? (h.chase || h.melee ? -1 : 0.3), far: h.far ?? 1.6 }, hearing: { range: h.range ?? 20 }, smell: { range: h.smell ?? 0 }, memory: h.memory ?? 7, intuition: 2.5 });

const P = (x, z) => ({ x, y: 0, z });
const OPTIONS = [
  { id: 'hold', weight: 0.5, considerations: [(c) => (c.near ? 1 : 0)] },
  { id: 'strafe', weight: 1.0, considerations: [(c) => (c.near && c.strafe ? 1 : 0)] },
  { id: 'close', weight: 1.2, considerations: [(c) => (c.chase && c.has ? 1 : 0), (c) => (c.d > c.reach * 0.8 ? 1 : 0)] },
  { id: 'back', weight: 0.9, considerations: [(c) => (c.near && !c.chase ? 1 : 0), (c) => consider(c.d, [c.keep * 0.6, c.keep * 0.3])] },
  { id: 'cover', weight: 1.3, considerations: [(c) => (c.near && !c.chase && !c.blade ? 1 : 0), (c) => (c.noShot ? 1 : 0.25) * (0.6 + 0.4 * consider(c.hp, [1, 0.4]))] },
  { id: 'flank', weight: 0.7, considerations: [(c) => (c.near && !c.chase && !c.blade ? 1 : 0), (c) => (c.noShot ? 0.9 : 0.15)] },
  { id: 'look', weight: 1.4, considerations: [(c) => (c.lost ? 1 : 0)] },
  { id: 'search', weight: 1.3, considerations: [(c) => (c.searching ? 1 : 0)] },
];

const leashed = (t, x, z) => {
  const leash = t.spec?.leash ?? (t.spec?.roam ?? 8) + (t.hostile?.strafe ? 10 : 0);
  return Math.hypot(x - t.home[0], z - t.home[1]) <= leash;
};
export const walkTo = (b, goal, pace, dt, turn = 4) => {
  const dx = goal.x - b.x;
  const dz = goal.z - b.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.3) return { x: b.x, z: b.z, yaw: b.yaw, moving: 0, there: true };
  const yaw = turnToward(b.yaw, Math.atan2(dx, dz), turn * dt);
  const step = Math.min(d, pace * dt);
  return { x: b.x + (dx / d) * step, z: b.z + (dz / d) * step, yaw, moving: 1, there: false };
};
export const turnToward = (from, to, max) => {
  let d = to - from;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return from + Math.max(-max, Math.min(max, d));
};

export function hostileStep(t, world, dt, r = Math.random) {
  const b = t.b;
  const h = t.hostile ?? {};
  const s = t.spec ?? {};
  const m = (t.mind ??= { mode: 'wander', goal: null, thinkAt: 0, clock: 0 });
  m.clock += dt;
  // perceiving
  t.senses ??= sensesFor(h);
  t.me ??= { pos: P(b.x, b.z), dir: null, beliefs: {}, now: 0 };
  t.me.pos.x = b.x;
  t.me.pos.z = b.z;
  t.me.dir = { x: Math.sin(b.yaw), y: 0, z: Math.cos(b.yaw) };
  const you = world.you ?? null;
  sense(t.senses, t.me, { targets: you ? [{ id: 'you', at: P(you.x, you.z), vel: you.vel ? { x: you.vel.x, y: 0, z: you.vel.z } : null, hostile: true }] : [], stims: world.stims }, dt, { seesThrough: world.seesThrough ?? null });
  const bel = belief(t.me, 'you');
  t.belief = bel;
  t.sees = Boolean(bel?.visible);
  const sure = Boolean(bel && (bel.visible || t.me.now - bel.seenAt <= t.senses.intuition));
  const target = bel ? (sure && you ? { x: you.x, z: you.z } : { x: bel.at.x, z: bel.at.z }) : null;
  const lost = Boolean(bel && !sure);
  if (bel) m.last = { x: bel.at.x, z: bel.at.z };
  // the group's search: joined when the guess has gone, left when it's done
  const search = world.search ?? null;
  const who = world.who ?? t;
  if (!bel && m.hadBelief && search && !search.active && m.last) search.start({ at: P(m.last.x, m.last.z) }, { aggressive: true });
  m.hadBelief = Boolean(bel);
  const searching = Boolean(!bel && search?.active && !search.done(who));
  const d = target ? Math.hypot(target.x - b.x, target.z - b.z) : Infinity;
  const near = Boolean(target) && d < (h.range ?? 0) * (sure ? 1 : 1.1);
  const noShot = Boolean(world.tokens) && !world.tokens.held('shot', who);
  const ctx = { has: Boolean(target), near, d, strafe: Boolean(h.strafe), chase: Boolean(h.chase), reach: h.reach ?? 2, keep: h.strafe?.keep ?? STEP.keep, blade: Boolean(h.blade), noShot, hp: (t.hp ?? 1) / Math.max(1, t.hpMax ?? t.hp ?? 1), lost, searching };
  // a choice, every so often (sooner when what it was doing is done)
  if (m.clock >= m.thinkAt || m.done) {
    m.thinkAt = m.clock + STEP.rethink;
    m.done = false;
    // (world.options: only these, a squad's posture's gate: ground/fight.js)
    const choice = pick(world.options ? OPTIONS.filter((o) => world.options.includes(o.id)) : OPTIONS, ctx, { current: m.mode, momentum: 0.2, rand: r, spread: 0.1 });
    const mode = choice?.id ?? 'wander';
    if (mode !== m.mode) m.since = m.clock;
    m.mode = mode;
    const seesThrough = world.seesThrough ?? (() => true);
    const allies = (world.allies ?? []).map((a) => P(a.x, a.z));
    const home = P(t.home[0], t.home[1]);
    const leash = s.leash ?? (s.roam ?? 8) + 10;
    if (mode === 'cover' && target) {
      const pts = candidates(P(b.x, b.z), { ring: STEP.ring, n: 10, walkable: (x, z) => leashed(t, x, z) });
      const best = pickPlace(pts, [cover([P(target.x, target.z)], seesThrough, 2), nearTo(home, leash, 0.5), awayFromAll(allies, 1.5, 0.5), nearTo(P(b.x, b.z), STEP.ring * 2, 0.3)], { current: m.goal ? P(m.goal.x, m.goal.z) : null, hysteresis: 0.2 });
      m.goal = best && best.score > 1.2 ? { x: best.at.x, z: best.at.z } : null;
      if (!m.goal) m.mode = 'hold';
    } else if (mode === 'flank' && target) {
      const pts = candidates(P(target.x, target.z), { ring: ctx.keep, n: 12, walkable: (x, z) => leashed(t, x, z) });
      const best = pickPlace(pts, [visible(P(target.x, target.z), seesThrough, 1), offLine(allies, P(target.x, target.z), 1.5, 1), awayFromAll(allies, 2, 0.5), nearTo(P(b.x, b.z), ctx.keep * 2, 0.6)], { current: m.goal ? P(m.goal.x, m.goal.z) : null, hysteresis: 0.2, bias: (p) => (p.x > target.x ? 0.02 : 0) });
      m.goal = best ? { x: best.at.x, z: best.at.z } : null;
      if (!m.goal) m.mode = 'hold';
    } else if (mode === 'look') m.goal = { ...m.last };
    else if (mode === 'search') {
      const claim = search.claim(who, P(b.x, b.z));
      m.goal = claim ? { x: claim.at.x, z: claim.at.z } : null;
      if (!m.goal) m.mode = 'wander';
    } else m.goal = null;
  }
  const pace = (h.strafe?.speed ?? s.speed ?? 1.4) * STEP.pace;
  let out = { x: b.x, z: b.z, yaw: b.yaw, moving: 0 };
  const face = (p) => turnToward(b.yaw, Math.atan2(p.x - b.x, p.z - b.z), 3 * dt);
  // (what it was closing on, backing from or circling has gone from its mind
  // since the last choice, a mark that died or slipped out of sight: it thinks again)
  if (!target && (m.mode === 'close' || m.mode === 'back' || m.mode === 'strafe')) {
    m.mode = 'wander';
    m.done = true;
  }
  switch (m.mode) {
    case 'hold':
      out.yaw = target ? face(target) : b.yaw;
      break;
    case 'strafe': {
      const next = strafeStep(b, target, h, dt, m.clock);
      if (leashed(t, next.x, next.z)) out = { x: next.x, z: next.z, yaw: turnToward(b.yaw, next.yaw, 4 * dt), moving: 1 };
      else out.yaw = face(target);
      break;
    }
    case 'close': {
      const yaw = turnToward(b.yaw, Math.atan2(target.x - b.x, target.z - b.z), 2.2 * dt);
      if (d > ctx.reach * 0.8) {
        const nx = b.x + Math.sin(yaw) * h.chase * dt;
        const nz = b.z + Math.cos(yaw) * h.chase * dt;
        if (leashed(t, nx, nz)) out = { x: nx, z: nz, yaw, moving: 1 };
        else out.yaw = yaw;
      } else {
        out.yaw = yaw;
        m.done = true;
      }
      break;
    }
    case 'back': {
      const ax = b.x - target.x;
      const az = b.z - target.z;
      const l = Math.hypot(ax, az) || 1;
      const nx = b.x + (ax / l) * pace * 0.7 * dt;
      const nz = b.z + (az / l) * pace * 0.7 * dt;
      if (leashed(t, nx, nz)) out = { x: nx, z: nz, yaw: face(target), moving: 1 };
      else out.yaw = face(target);
      if (d >= ctx.keep * 0.6) m.done = true;
      break;
    }
    case 'cover':
    case 'flank':
    case 'look':
    case 'search': {
      if (!m.goal) break;
      const w = walkTo(b, m.goal, pace, dt);
      out = { x: w.x, z: w.z, yaw: w.yaw, moving: w.moving };
      if (w.there || runtime(m.clock - (m.since ?? m.clock), [0, 12]) <= 0) {
        if (m.mode === 'search') search.arrive(who);
        m.done = true;
      }
      // (in cover, and the way to you clear again: that's the shot; walking, it still faces you when close)
      if (target && d < 6 && m.mode !== 'search' && m.mode !== 'look') out.yaw = face(target);
      if (m.mode === 'search') search.sweep(who, P(out.x, out.z), world.seesThrough ?? null);
      break;
    }
    default: {
      // about its business: a wander near its home (as actors.js's), or standing still
      if (s.still) break;
      if (!b.to) {
        b.wait = (b.wait ?? 0) - dt;
        if (b.wait <= 0) {
          const a = r() * Math.PI * 2;
          b.to = [t.home[0] + Math.cos(a) * (s.roam ?? 8) * r(), t.home[1] + Math.sin(a) * (s.roam ?? 8) * r()];
        }
      } else {
        const w = walkTo(b, { x: b.to[0], z: b.to[1] }, s.speed ?? 1.4, dt, 5);
        if (w.there) {
          b.to = null;
          b.wait = 0.5 + r() * 2;
        } else out = { x: w.x, z: w.z, yaw: w.yaw, moving: w.moving };
      }
    }
  }
  out.mode = m.mode;
  // (you in sight and moving: led, where you'll be when its bolt gets there)
  const led = target && near && t.sees && you?.vel ? lead([target.x, 0, target.z], [you.vel.x ?? 0, 0, you.vel.z ?? 0], [out.x, 0, out.z], BOLT_SPEED) : null;
  out.aim = led ? { x: led[0], z: led[2] } : target && near ? { x: target.x, z: target.z } : null;
  out.guessed = lost;
  return out;
}

// ── An enemy's body (lib/ai/body) ──
//
// What a step of its head looks like on its figure (activity.js draws it).
// The motion comes from the step itself, so its feet go with the ground it
// covers: a strafer's hips turn toward its travel while its chest stays on
// you (locomotion.js does that from the motion's `side`). Its head goes
// where its mode says (HOSTILE_BODY): on its mark while it holds, strafes,
// backs off or crouches; on where it thinks you are while it closes or
// goes to look; sweeping across its way while it searches. In cover it
// crouches only once it's stopped there a moment, and stands to fire (a
// crouch is a base state in place of the walk: crouched feet that moved
// would slide). Its gun is up while it has a mark in range or is about to
// fire, and down while it crouches. Over its head: '?' while it looks for
// you, '!' for a moment when it has you again after a while without you
// (and `alert` that frame, for the start it gives). Pure, so it's tested
// in Node.
//
//   HOSTILE_BODY: lib/ai/body's MODE_BODY with the hostiles' own modes
//   createPosture({ seed }) → what a figure's body carries from frame to
//     frame (one each; seed: where in its sweep its head starts)
//   hostileBody(posture, step, dt, { t, firing, table }) → { motion, look, base,
//     clip (the game's for that base, its row's: a figure with it plays it, bodyClip),
//     action, scan, aim (0 or 1: the gun down or up), mark ('?' | '!' |
//     null), alert (it has just seen you) }
//     step: hostileStep's, plus `belief` (its belief of you, t.belief) and
//     `sees` (whether it sees you now, t.sees); t: seconds (the world's
//     clock); firing: it's about to fire, or just has
//   ALERT_CLIP, bodyClip(fig, game, site) → the game's clip where fig has it, else the site's
//   whereHit(y, ground, tall) → 'head' | 'chest': where a hit at height y lands
//   fallOf({ push, from, at, yaw }) → { x, z }: the way it goes down, along
//     the ground: the way the shot went (push), else away from where it
//     came from (from → at), else backward from its facing

import { MODE_BODY, bodyFrom } from '../../../lib/ai/body';
import { seeded } from '../../../lib/seeded';

export const HOSTILE_BODY = {
  ...MODE_BODY,
  // crouched behind it: the game's cover idle where the figure has the
  // soldiers' set (lib/three/walrusSets/npc.js), else the site's crouch
  cover: { ...MODE_BODY.cover, clip: 'cover.low.idle' },
  // holding its ground, its eyes on its mark
  hold: { look: 'aim' },
  // coming for you (a rancor, a duellist, a brawler): its eyes on where it thinks you are
  close: { look: 'belief' },
  // round your side, watching you as it goes
  flank: { look: 'belief' },
  // to where it last had you, staring there
  look: { look: 'belief' },
  // about its business
  wander: {},
};

// the head's sweep while it searches: so far either side of its way
// (radians), at so many radians a second, on a spot this far out (metres)
export const SCAN = { yaw: 0.95, rate: 1.4, far: 6 };
const STILL = 0.25; // m/s: under this it's stopped (for the crouch)
const SETTLE = 0.25; // seconds stopped in cover before it crouches
const SPRINT = 9; // m/s: a step faster than this is a jump (a knock, a put back), not feet
const STARTLE = 1.2; // seconds the '!' stays up
const AGAIN = 3; // seconds out of its sight before it starts at you again (so a glimpse at the edge of its cone doesn't keep starting it)

export const createPosture = ({ seed = 0 } = {}) => ({ prev: null, still: 0, seenAt: -Infinity, startAt: -Infinity, phase: seeded(seed)() * Math.PI * 2 });

export function hostileBody(posture, step, dt, { t = 0, firing = false, table = HOSTILE_BODY } = {}) {
  const prev = posture.prev;
  const body = bodyFrom(prev, { ...step, fire: firing }, dt, { table });
  posture.prev = { x: step.x, z: step.z, yaw: step.yaw };
  const motion = body.motion;
  let speed = Math.hypot(motion.speed, motion.side);
  if (speed > SPRINT) {
    motion.speed = 0;
    motion.side = 0;
    speed = 0;
  }
  posture.still = speed < STILL ? posture.still + dt : 0;
  // crouched only stopped in cover a moment, and not to fire
  const base = body.base === 'crouch' ? (posture.still >= SETTLE ? 'crouch' : null) : body.base;
  // searching: the head swept across its way, out ahead of it
  let look = body.look;
  if (body.scan) {
    const a = step.yaw + SCAN.yaw * Math.sin(t * SCAN.rate + posture.phase);
    look = { x: step.x + Math.sin(a) * SCAN.far, z: step.z + Math.cos(a) * SCAN.far };
  }
  const aim = (step.aim || firing) && base !== 'crouch' ? 1 : 0;
  // it has you again: a start, and a '!' for a moment
  const sees = step.sees ?? Boolean(step.aim && !step.guessed);
  const alert = sees && t - posture.seenAt > AGAIN;
  if (sees) posture.seenAt = t;
  if (alert) posture.startAt = t;
  const hunting = step.mode === 'look' || step.mode === 'search';
  const mark = t - posture.startAt < STARTLE ? '!' : hunting ? '?' : null;
  const clip = base ? (table[step.mode]?.clip ?? null) : null;
  return { motion, look, base, clip, action: body.action, scan: body.scan, aim, mark, alert };
}

// the game's start on seeing you, for a figure with the soldiers' set
export const ALERT_CLIP = 'aware.alert';

// the game's clip for the moment where the figure has it (its `clips`), else the site's
export const bodyClip = (fig, game, site) => (game && fig?.clips?.[game] ? game : site);

export const whereHit = (y, ground, tall) => (Number.isFinite(y) && y - ground > tall * 0.82 ? 'head' : 'chest');

export function fallOf({ push = null, from = null, at = null, yaw = 0 } = {}) {
  const flat = (x, z) => {
    const l = Math.hypot(x, z);
    return l > 1e-6 ? { x: x / l, z: z / l } : null;
  };
  return (push && flat(push.x, push.z)) ?? (from && at && flat(at.x - from.x, at.z - from.z)) ?? { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}
