// The duelling club (quest 8, docs/superpowers/specs/2026-10-21-hogwarts-
// world-design.md §4.7): three rounds against a foe down the platform in
// the Defence classroom, both sides casting on the wand’s cooldowns
// (./spells.js). An Expelliarmus that lands wins the round for its caster;
// a Stupefy that lands loses the round for the one it hits (they go down);
// Protego blocks either, and on the beat (its first part) throws the bolt
// back along its line, which can be thrown back again. The first to two
// rounds has the duel; a win is twenty points.
//
// The platform is a line: you at x = 0, the foe at x = DUEL.gap; a bolt is
// { spell, x, dir (+1 toward the foe), owner, back }. The foe telegraphs
// every cast (its wand comes up `windup` seconds first) and reads yours
// with a reaction that gets quicker each round. Pure and seeded.
//
//   DUEL, newDuel({ seed, foe }), stepDuel(duel, input, dt) → duel (events
//   in duel.ev), result(duel), duelBot(duel) → input, FOE_LINES
//
// Input, this step only: { cast: 'expelliarmus' | 'stupefy' | 'protego' }.

import { seeded } from '../../../lib/seeded';
import { SHIELD, spellById } from './spells';

export const DUEL = {
  gap: 10, // metres down the platform
  toWin: 2, // rounds
  between: 2.5, // seconds between rounds (bows, a word from the teacher)
  reach: 0.5, // a bolt this near a duellist has reached them
  windup: 0.45, // the foe’s wand comes up this long before its bolt goes
  points: 20,
};
export const CASTS = ['expelliarmus', 'stupefy', 'protego'];

// The foe, round by round: seconds between its casts (and a jitter on
// them), the chance it goes for Stupefy, the chance it shields an incoming
// bolt at all, its reaction (how many seconds before a bolt arrives its
// shield comes up: under SHIELD.beat it throws it back), the chance it
// steps out of the way of one it didn’t shield, and how soon its shield is
// ready again (it has practised Protego more than anything else)
export const FOE = [
  { every: 2.3, jitter: 0.7, stun: 0.3, guard: 0.75, react: [0.45, 0.9], dodge: 0.3, shield: 1.1 },
  { every: 2, jitter: 0.6, stun: 0.4, guard: 0.8, react: [0.3, 0.8], dodge: 0.3, shield: 1 },
  { every: 1.7, jitter: 0.5, stun: 0.5, guard: 0.85, react: [0.2, 0.7], dodge: 0.35, shield: 0.9 },
];

// Malfoy’s, in the site’s words
export const FOE_LINES = {
  start: 'Wand up. If you can find it.',
  foeRound: 'That’s one to me. Try not to sulk.',
  youRound: 'That doesn’t count. I slipped.',
  foeWins: 'Run along, then. Mind the step on the way out.',
  youWin: 'Next time I won’t be holding back.',
};

const side = () => ({ ready: {}, shield: null });

export function newDuel({ seed = 1 } = {}) {
  const r = seeded(seed * 104729 + 7);
  return { t: 0, round: 1, wins: { you: 0, foe: 0 }, you: side(), foe: { ...side(), next: 1.5 + r(), windup: null, guard: null }, bolts: [], pause: 0, over: false, winner: null, rand: Math.floor(r() * 2 ** 31), ev: [{ type: 'line', who: 'foe', text: FOE_LINES.start }] };
}

function roll(d) {
  const r = seeded(d.rand);
  const x = r();
  d.rand = Math.floor(r() * 2 ** 31);
  return x;
}
const between = (d, [a, b]) => a + (b - a) * roll(d);

const readyIn = (s, id, t) => Math.max(0, (s.ready[id] ?? 0) - t);
const shieldAt = (s, t) => (s.shield == null || t < s.shield || t >= s.shield + SHIELD.up ? null : t - s.shield < SHIELD.beat ? 'beat' : 'up');

// a duellist casts, if the spell is ready: a bolt, or the shield
function cast(d, who, id, cooldown = spellById(id).cooldown) {
  const s = d[who];
  if (readyIn(s, id, d.t) > 0) return false;
  d[who] = { ...s, ready: { ...s.ready, [id]: d.t + cooldown }, ...(id === 'protego' ? { shield: d.t } : {}) };
  if (id !== 'protego') d.bolts.push({ spell: id, x: who === 'you' ? DUEL.reach : DUEL.gap - DUEL.reach, dir: who === 'you' ? 1 : -1, owner: who, back: false });
  d.ev.push({ type: 'cast', who, spell: id });
  return true;
}

export function stepDuel(d0, input = {}, dt) {
  if (d0.over) return { ...d0, ev: [] };
  const d = { ...d0, t: d0.t + dt, bolts: d0.bolts.map((b) => ({ ...b })), ev: [] };
  if (d.pause > 0) {
    d.pause = Math.max(0, d.pause - dt);
    if (d.pause === 0) d.ev.push({ type: 'round', round: d.round });
    return d;
  }
  const skill = FOE[d.round - 1] ?? FOE[FOE.length - 1];

  // you
  if (input.cast && CASTS.includes(input.cast)) cast(d, 'you', input.cast);

  // the foe: a cast wound up and let go; a shield for a bolt coming at it
  let foe = { ...d.foe };
  d.foe = foe;
  if (foe.windup && d.t >= foe.windup.at) {
    const id = foe.windup.spell;
    foe.windup = null;
    // (a spell still cooling when it came to it: the other one, or nothing)
    if (!cast(d, 'foe', id)) cast(d, 'foe', id === 'stupefy' ? 'expelliarmus' : 'stupefy');
    foe = d.foe;
    foe.next = d.t + skill.every + (roll(d) * 2 - 1) * skill.jitter;
  } else if (!foe.windup && d.t >= foe.next) {
    const id = roll(d) < skill.stun && readyIn(foe, 'stupefy', d.t + DUEL.windup) === 0 ? 'stupefy' : 'expelliarmus';
    foe.windup = { spell: id, at: d.t + DUEL.windup };
    d.ev.push({ type: 'windup', spell: id });
  }
  // (it decides about each of your bolts once, as it sees it go)
  for (const b of d.bolts) {
    if (b.dir !== 1 || b.seen) continue;
    b.seen = true;
    b.dodged = roll(d) < skill.dodge;
    if (roll(d) < skill.guard) {
      const react = between(d, skill.react);
      const arrives = d.t + (DUEL.gap - DUEL.reach - b.x) / spellById(b.spell).bolt.speed;
      const at = arrives - react;
      if (!foe.guard || at < foe.guard) foe.guard = at;
    }
  }
  if (foe.guard != null && d.t >= foe.guard) {
    foe.guard = null;
    cast(d, 'foe', 'protego', skill.shield);
  }

  // the bolts fly and land
  const out = [];
  for (const b0 of d.bolts) {
    const speed = spellById(b0.spell).bolt.speed;
    const b = { ...b0, x: b0.x + b0.dir * speed * dt };
    const target = b.dir === 1 ? 'foe' : 'you';
    const at = b.dir === 1 ? DUEL.gap - DUEL.reach : DUEL.reach;
    if ((b.dir === 1 && b.x < at) || (b.dir === -1 && b.x > at)) {
      out.push(b);
      continue;
    }
    const shield = shieldAt(d[target], d.t);
    if (shield === 'beat') {
      // thrown back along its line, the thrower’s now
      out.push({ ...b, x: at, dir: -b.dir, owner: target, back: true, seen: false });
      d.ev.push({ type: 'back', by: target, spell: b.spell });
    } else if (shield) d.ev.push({ type: 'blocked', by: target, spell: b.spell });
    else if (target === 'foe' && b.dodged) d.ev.push({ type: 'dodged', by: target, spell: b.spell });
    else {
      d.ev.push({ type: 'hit', on: target, spell: b.spell });
      return endRound(d, b.spell === 'expelliarmus' ? b.owner : target === 'you' ? 'foe' : 'you', b.spell);
    }
  }
  d.bolts = out;
  return d;
}

function endRound(d, winner, spell) {
  const wins = { ...d.wins, [winner]: d.wins[winner] + 1 };
  const over = wins[winner] >= DUEL.toWin;
  d.ev.push({ type: 'roundOver', round: d.round, winner, spell, wins });
  // (Stupefy puts the one it hit on the floor: the drawing’s act-knockdown)
  d.ev.push({ type: spell === 'stupefy' ? 'knockdown' : 'disarmed', on: winner === 'you' ? 'foe' : 'you' });
  d.ev.push({ type: 'line', who: 'foe', text: over ? (winner === 'you' ? FOE_LINES.youWin : FOE_LINES.foeWins) : winner === 'you' ? FOE_LINES.youRound : FOE_LINES.foeRound });
  if (over) {
    d.ev.push({ type: 'over', winner });
    return { ...d, wins, bolts: [], over: true, winner };
  }
  return { ...d, wins, round: d.round + 1, bolts: [], pause: DUEL.between, you: side(), foe: { ...side(), next: d.t + DUEL.between + 1 + roll(d), windup: null, guard: null } };
}

export function result(d) {
  if (!d.over) return null;
  const won = d.winner === 'you';
  return { type: 'duel', won, wins: { ...d.wins }, points: won ? DUEL.points : 0 };
}

// A duellist who knows the beat: Protego just before a bolt arrives (so
// it lands in the shield’s first part and goes home), and a spell of its
// own whenever its shield is ready for what comes back: Stupefy when the
// foe’s Protego is cooling (it can’t be blocked), Expelliarmus otherwise.
export function duelBot(d) {
  if (d.over || d.pause > 0) return {};
  const incoming = d.bolts.filter((b) => b.dir === -1).map((b) => (b.x - DUEL.reach) / spellById(b.spell).bolt.speed);
  const soonest = incoming.length ? Math.min(...incoming) : Infinity;
  const shieldReady = readyIn(d.you, 'protego', d.t) === 0;
  if (soonest <= SHIELD.beat * 0.5 && shieldReady && !shieldAt(d.you, d.t)) return { cast: 'protego' };
  // (keep the shield for a bolt about to arrive)
  if (soonest < 0.9 || !shieldReady) return {};
  const foeShieldDown = readyIn(d.foe, 'protego', d.t) > 0.6;
  if (foeShieldDown && readyIn(d.you, 'stupefy', d.t) === 0) return { cast: 'stupefy' };
  if (readyIn(d.you, 'expelliarmus', d.t) === 0) return { cast: 'expelliarmus' };
  return {};
}
