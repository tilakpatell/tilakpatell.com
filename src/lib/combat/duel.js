// A duellist's mind: a small state machine that fences on the 2017 game's
// rules. It closes to its reach, circles you there a moment, strikes,
// recovers; when you start a strike whose query would reach it (your lunge's
// or your strike's: lib/combat/saber2017.js), it rolls to hold its block (its
// `guard` rate) as long as its stamina lasts, and lets it down once your
// contact has passed; when your stamina is spent it comes at you at once. The
// game has no parry: a block met from the front simply holds (the engine
// drains it and stops your stroke). Pure: numbers in, numbers out, so the same
// seed fences the same way. What it decides is drawn by
// galaxy/surface/duellists.js on a saber (saber.js), whose engine lands it.
//
//   DUEL                 the timings: circle [min, max] s, recover [min, max] s, attack (a strike's seconds until swung
//                        says), combo (the chance it strikes again at once), jump (metres you may move in a strike before
//                        it's at air), near (how far past its reach it guards): the site's own, the records having none
//                        for the AI's sabers; stagger { hit (HitByLightSaber's), broken (the rulebook's hand.broken) }
//   createDuellist({ reach, guard, stance, strokes, cadence, seed }) → d (d.at = [x, z]: the caller keeps it);
//                        cadence { stroke: { dur, back } } (the stroke table's, stanceFromTable.js's): a strike held
//                        `dur` (whatever swung says), and the recovery after it its return's `back` seconds
//   duelStep(d, you, dt, rng = d's own) → { state, move: [dx, dz] (0…1 of its pace, world axes), face (yaw to you),
//                        stroke (the clip while it attacks, else null), begin (the frame a strike starts), block }
//     you: { pos: [x, z], swinging: { contact: [t0, t1], t, speed?, reaches? } | null (your strike, t seconds into its
//            clip; reaches: whether its query would find this one), out? (your stamina spent), tired? (its own),
//            dist?, dead? } or null; states approach | circle | attack | recover | block | stagger | dead
//   swung(d, secs)       how long the strike it began takes (its clip's, at its speed)
//   guarding(d)          'block' | null: what meets your strike now
//   onHit(d, { heavy, dead }), onGuardBroken(d) (its block broken at no stamina),
//   onStagger(d, secs, next) (shoved, struck hard: reeling `secs`, then `next` or approach)

import BOOK from '../../data/bf2017/saber.json';

export const DUEL = {
  circle: [1, 2],
  recover: [0.35, 0.6],
  attack: 0.9,
  combo: 0.3,
  jump: 6,
  near: 1.5,
  stagger: { hit: BOOK.heroes.luke.react.hit, broken: BOOK.hand.broken },
};

// (the pack's strokes, by name, when none are given: a stroke table gives the game's)
const STROKES = ['sword.light.a', 'sword.light.b', 'sword.light.c', 'sword.a'];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const within = ([a, b], k) => a + (b - a) * k;
// a repeatable roll of its own (Park–Miller), for a duellist given a seed and no rng
const roller = (seed) => {
  let s = Math.abs(Math.round(seed)) % 2147483646 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
};

export function createDuellist({ reach = 2.2, guard = 0.6, stance = 'single', strokes = null, cadence = null, seed = 1 } = {}) {
  return {
    reach,
    guard,
    stance,
    strokes: strokes?.length ? strokes : STROKES,
    cadence, // { stroke: { dur, back } }: the game's, where its strokes are (null: DUEL's)
    at: [0, 0],
    state: 'approach',
    timer: 0,
    i: 0, // the next stroke of the table
    side: 1, // which way it circles
    face: 0,
    stroke: null, // the clip it's in
    youAt: null, // where you were when its stroke began
    next: null, // what a stagger gives way to
    plan: null, // for your strike: 'block' | null
    seen: -1, // your stroke's clip time last frame (a smaller one is a new stroke)
    rng: roller(seed),
  };
}

const out = (d, move, extra = {}) => ({ state: d.state, move, face: d.face, stroke: d.stroke, begin: false, block: d.state === 'block', ...extra });
const STILL = [0, 0];

function attack(d, you) {
  d.state = 'attack';
  d.stroke = d.strokes[d.i % d.strokes.length];
  d.i++;
  d.timer = d.cadence?.[d.stroke]?.dur ?? DUEL.attack;
  d.youAt = you ? [...you.pos] : null;
}
function enter(d, state, timer = 0) {
  d.state = state;
  d.timer = timer;
  d.stroke = null;
}

export function duelStep(d, you, dt, rng = d.rng) {
  if (d.state === 'dead') return out(d, STILL);
  // nobody to fight: whatever it was in, it stands down (Review Focus 5)
  if (!you || you.dead) {
    if (d.state !== 'stagger') enter(d, 'approach');
    d.plan = null;
    d.seen = -1;
    return out(d, STILL);
  }
  const dx = you.pos[0] - d.at[0];
  const dz = you.pos[1] - d.at[1];
  const dist = you.dist ?? Math.hypot(dx, dz);
  const ux = dist > 1e-6 ? dx / dist : 0;
  const uz = dist > 1e-6 ? dz / dist : 1;
  d.face = Math.atan2(dx, dz);
  const toward = [ux, uz];

  if (d.state === 'stagger') {
    d.timer -= dt;
    if (d.timer > 0) return out(d, STILL);
    const next = d.next ?? 'approach';
    d.next = null;
    if (next === 'attack') {
      attack(d, you);
      return out(d, STILL, { begin: true });
    }
    enter(d, 'approach');
  }

  // your strike: seen as it starts (a clip time smaller than last frame's is a new one)
  const sw = you.swinging;
  if (!sw) d.seen = -1;
  else {
    const fresh = d.seen < 0 || sw.t < d.seen - 1e-6;
    d.seen = sw.t;
    const free = d.state === 'approach' || d.state === 'circle' || d.state === 'recover';
    // (the game's deflect: up for a strike that would reach it, while its stamina lasts)
    if (fresh) d.plan = free && !you.tired && (sw.reaches ?? dist <= d.reach + DUEL.near) && rng() < d.guard ? 'block' : null;
    const past = sw.t > sw.contact[1];
    if (d.plan === 'block' && !past && !you.tired && d.state !== 'block') enter(d, 'block');
  }
  // the block let down once your contact's passed, or its stamina's gone
  if (d.state === 'block' && (!sw || sw.t > sw.contact[1] || you.tired)) {
    d.plan = null;
    enter(d, 'circle', within(DUEL.circle, rng()) * 0.4);
  }
  if (d.state === 'block') return out(d, STILL);
  // (your stamina spent: it comes at you now)
  if (you.out && (d.state === 'circle' || d.state === 'recover') && dist <= d.reach * 1.3) {
    attack(d, you);
    return out(d, STILL, { begin: true });
  }

  if (d.state === 'attack') {
    // you went somewhere it can't follow inside a stroke: it's at air, so it stops
    if (d.youAt && Math.hypot(you.pos[0] - d.youAt[0], you.pos[1] - d.youAt[1]) > DUEL.jump) {
      enter(d, 'approach');
      return out(d, toward);
    }
    d.timer -= dt;
    if (d.timer > 0) return out(d, STILL);
    if (dist <= d.reach * 1.3 && rng() < DUEL.combo) {
      attack(d, you);
      return out(d, STILL, { begin: true });
    }
    // (after the game's strike it's open as long as its way back to the guard takes: the punish window)
    const back = d.cadence?.[d.stroke]?.back;
    enter(d, 'recover', back ?? within(DUEL.recover, rng()));
  }
  if (d.state === 'recover') {
    d.timer -= dt;
    if (d.timer > 0) return out(d, [-ux * 0.3, -uz * 0.3]);
    enter(d, 'circle', within(DUEL.circle, rng()));
    d.side = rng() < 0.5 ? -1 : 1;
  }
  if (d.state === 'approach') {
    if (dist > d.reach) return out(d, toward);
    enter(d, 'circle', within(DUEL.circle, rng()));
    d.side = rng() < 0.5 ? -1 : 1;
  }
  // circling: across the line to you, held at its reach
  if (dist > d.reach * 1.6) {
    enter(d, 'approach');
    return out(d, toward);
  }
  d.timer -= dt;
  if (d.timer <= 0) {
    attack(d, you);
    return out(d, STILL, { begin: true });
  }
  const radial = clamp((dist - d.reach) / d.reach, -1, 1);
  const side = [uz * d.side * 0.5, -ux * d.side * 0.5];
  return out(d, [side[0] + ux * radial, side[1] + uz * radial]);
}

export function swung(d, secs) {
  // (a 2017 hero's strike is over when its blade rests, though its clip holds the pose on)
  if (d.state === 'attack' && secs > 0) d.timer = d.cadence?.[d.stroke]?.dur ?? secs;
}

export const guarding = (d) => (d.state === 'block' ? 'block' : null);

export function onHit(d, { heavy = false, dead = false } = {}) {
  if (d.state === 'dead') return;
  if (dead) {
    enter(d, 'dead');
    return;
  }
  // (a hit doesn't stop a strike it's in; a heavy one does)
  if (d.state === 'attack' && !heavy) return;
  onStagger(d, DUEL.stagger.hit);
}

export function onStagger(d, secs, next = null) {
  if (d.state === 'dead') return;
  enter(d, 'stagger', secs);
  d.next = next;
  d.plan = null;
}

export const onGuardBroken = (d) => onStagger(d, DUEL.stagger.broken);
