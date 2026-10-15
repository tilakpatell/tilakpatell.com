// How the hunters fly and fight, as plain rules: who comes, how many, where
// from, how each one flies its attack, when it fires and where it aims, what
// its lasers hit, and when a pack gives up. Pure (no three.js), so it's
// tested in Node; hunters.js gives each one a model and draws the lasers.
//
// A pack comes in behind you (or ahead of you, an ambush; or out of portals,
// or a hangar) at points that are never inside a planet. Each hunter then
// flies attack runs, as fighters do:
// - 'set': out to a station round you (ahead and off to one side, a little
//   above or below). The station is fixed the moment it's picked, in the
//   map's own directions, so turning on the spot doesn't swing it away from
//   them; and one that can't be reached in a few seconds (you're running)
//   is given up for the run itself, which is then a chase.
// - 'run': at you, leading you, firing once you're in its sights and in
//   range; past you (or about to hit you), it breaks away to the other side.
//   Only so many of a pack are on a run at once (slotsFor): the rest hold
//   off and take their turn, so a big pack is a fight and not a wall.
// - 'tail': the quick ones (an interceptor, Vader, a Rick) sometimes stay on
//   you after a pass instead, sitting behind you and firing for a few
//   seconds, till you turn on them or shake them off.
// A pack hunts as one (lib/ai/squad): its attack runs are tokens (so many
// of a pack on a run at once, one on your tail at a time), and a hunter
// that's waiting for one does something with the wait: swings wide to your
// blind side to come in from behind (a flank, said once: event 'flank'),
// or sits off ahead across the way you're going (a blocker), or holds its
// station, weighed by how fast you're going and where it already is
// (lib/ai/utility). It has nerve: a pack that's lost most of itself breaks
// off together (event 'escaped' with why 'broke'). And it knows you only as
// it perceives you (lib/ai/perception): sent after you, it knows where you
// are; a planet between you hides you, it keeps the truth a couple of
// seconds (intuition), then chases its guess of you, which drifts the way
// you were going and fades, and a pack that has lost you altogether gives
// up. Its shots go to the guess, and a laser stops at a planet as before.
// They fly like fighters: each turns its nose at its own rate (a little
// quicker than yours at the fight's speed, less at its top: turnRateAt) and
// slows into a hard turn (it arcs round; it doesn't stop and come back),
// banks into it, keeps clear of the others in the pack, steers round
// planets, moons, stations and stars, and can't be flown through one. A
// planet between you is cover: they hold their fire, and a laser stops at
// it.
//
// And they fly the fight at your pace (fightSpeed): in the fight (swinging
// out, or on a run) one goes a little faster than you're going, never
// under a floor of its own top speed and never over its top, so at cruise
// a pass takes seconds and a turn-in can be followed, and when you boost
// they open up with you (a TIE a shade slower than your boost, so you can
// outrun one; an interceptor not). Far off they close flat out, so a pack
// still arrives; after prey they fly at the floor.
//
// Everything about you is read in all three dimensions (your nose and the
// way you're really going, climbing and diving too), so their lead is right
// when you loop. Shoot them down, or outrun them: far enough away for long
// enough and they give up and peel away.
//
// The crews' ship powers (shipPowers.js) reach them here: a ship handed to
// update as a `ghost` (Han's corkscrew, Rick mid-portal) isn't hit, the
// lasers flying on past; one with a `magnet` ({ x, y, z }: the RV's) drags
// the ones it holds (pull) toward it, their guns jammed; breakOff sends the
// ones on a run or your tail back out (Han's corkscrew, overshot); swallow
// puts out the lasers at a portal's mouth.
//
// createHunt({ rand, factions, kinds, solids, lasers, nerve }) → { pack(faction, ship, opts) → hunters,
//   update(dt, ship) → events, hit(from, to, damage) → hit or null,
//   damage(id, n) → hit or null, pull(at, r, speed, secs, daze) → how many,
//   breakOff() → how many, swallow(at, r) → how many, clear(), live,
//   lasers, targets, count, active, packs, wire() }
// A hunter is { id, kind, type, pack, pos, vel, prev, hp, mode, bank, grow,
// alive, view (the drawing's to use) }; pos, vel and prev are { x, y, z }.
// `solids` is ship.js's ([{ at: [x, y, z], r }]) or a function giving them.
// Events: { type: 'hunted', faction, kinds, prey, interdict }, { type:
// 'shot', faction } (one fired at you), { type: 'laser', damage, from, bomb, by }
// (and hit: `by` the hunter's id), { type: 'spotlit', faction, id } (a spotlight on you),
// { type: 'flank', faction, id } (one swinging round behind you), { type: 'escaped', faction,
// why: 'lost' | 'broke' }, { type: 'cleared', faction, rescued }.

import { intercept, nose, sweptHit } from './targeting';
import { factionsOf, kindsOf, namesOf } from './sides';
import { PACE } from './ship';
import { belief, createSenses, sense } from '../../lib/ai/perception';
import { confidence, createTokens } from '../../lib/ai/squad';
import { consider, pick } from '../../lib/ai/utility';

// who hunts for whom (sides.js: each side's factions, which kinds come and
// how often each, their ace, their lasers' colour), what each kind is
// (size: its length in map units, nose to tail, or its biggest side for the
// few shipFit.js fits that way (Slave I flies upright); speed: its top speed (a TIE, a
// patrol fighter or a bug is a little slower than you boost, so you can
// outrun one; an interceptor, Vader or a Rick isn't); accel: how hard it
// changes speed, and how quick its nose is; hp: hits it takes; fire: seconds
// between shots; tail: how often it stays on you after a pass; lead: how
// much of the true lead it allows for (1 is a perfect shot); spread: how
// wide its shots scatter (1 is the usual)) and what each is called on the
// targeting bracket. Every side's, so another pilot's hunters, whoever they
// are, fly and draw
export const FACTIONS = factionsOf(null);
export const HUNTER_KINDS = kindsOf(null);
export const NAMES = namesOf(null);

export const LASER = { speed: 34, life: 1.1, damage: 12, length: 0.36 };
// A bomber's bomb: slow, heavy, and it bursts (one that passes within
// `burst` of you counts), so it's dodged by being somewhere else, not by luck
export const BOMB = { speed: 14, life: 2.4, damage: 30, burst: 1.2, slow: 0.6 };
// The ways some kinds fight that the rest don't (a kind's `trait`):
// - 'bomber': a slow straight run (BOMB.slow of the fight's pace), one bomb,
//   and away (a TIE bomber)
// - 'holdoff': never closes under HOLDOFF of you, and fires from further
//   out (a gunboat, a Pollos truck: it pours fire from range)
// - 'quietUntilFired': the pack never fires until one of it has been hit
//   (the Cousins, Krombopulos Michael: they close and sit there)
// - 'flicker': a hit that doesn't down it hides it for FLICKER seconds: off
//   the guns, unhittable, not drawn (a Zigerion simulation ship)
// - 'spotlight': inside SPOTLIGHT of you on a run, it pins you once a run
//   (event 'spotlit': the scene scrambles the HUD a moment; Hank's SUV)
// - 'missile': now and then a homing missile as well as its lasers (MISSILE):
//   it comes round after you, but it only sees ahead of itself, so a hard
//   break close in throws it, and it burns out if you run far enough
// - 'ion': its bolts hardly hurt, but one that lands holds your boost and
//   your pulse drive down a while (ION.slow seconds: the scene's to do)
// - 'rammer': no guns; flat out straight at you, and it bursts on you (RAM)
//   unless it's shot down first
// - 'medic': patches up the most hurt of its pack, a hit at a time (MEDIC)
// - 'sniper': holds off further still and fires from twice as far, slowly
//   and true (SNIPER)
// A kind has one `trait`, or several `traits` (an ace's stage may add one).
export const TRAITS = ['bomber', 'holdoff', 'quietUntilFired', 'flicker', 'spotlight', 'missile', 'ion', 'rammer', 'medic', 'sniper'];
export const traitsOf = (type) => (type.traits ? (type.trait && !type.traits.includes(type.trait) ? [...type.traits, type.trait] : type.traits) : type.trait ? [type.trait] : []);
export const hasTrait = (type, t) => type.trait === t || Boolean(type.traits?.includes(t));
export const HOLDOFF = { near: 8.75, reach: 1.4 }; // map units it keeps off; of FIGHT.range it fires from
export const SNIPER = { near: 15, reach: 2.2, sights: 0.97, lead: 1, spread: 0.25, damage: 20 };
// (a missile's speed at the ship's pace: a little over your boost, so it closes, slowly)
export const MISSILE = { speed: 22 * PACE, life: 4.5 / PACE, seek: 3, sees: 0.26, damage: 24, burst: 0.5, range: 26, sights: 0.75, every: [4.5, 7.5] }; // sees: the cosine it still sees you inside (about 75°)
export const ION = { damage: 5, slow: 2.5 };
export const RAM = { damage: 28, reach: 0.6 };
const MEDIC = { every: 2.5, reach: 20 };
export const FLICKER = 2;
export const LOSE = { far: 48, after: 5 }; // they give up once you're this far away for this long
export const SHIP_R = 0.2; // how close a laser must pass you to hit
export const FIGHT = {
  range: 16, // map units: they fire inside this
  near: 3.5, // and not from closer than this (HOLDOFF.near is 2.5 of it)
  sights: 0.93, // how near its nose must be to you to fire (the cosine: about 21°)
  station: 3.5, // how near its station before it turns in
  setFor: 4.5, // seconds swinging out, at most, before it comes in from wherever it is
  runFor: 7, // seconds on one run, at most
  pass: 1.6, // this close on a run: it breaks away
  past: 9, // inside this and going away again: it's past you
  tailBack: 5, // how far behind you one on your tail sits
  tailFor: [3.5, 6], // seconds it stays there
  tailSpread: 2, // how much wider its shots scatter from there (it's close)
  tailAbove: 4 * PACE, // your speed, under which there's no tail to sit on
  apart: 1.5, // map units the pack keep between them
  clear: 1.2, // and from anything solid, past its surface
  ahead: 1, // seconds ahead they look for something in the way
  lead: 0.7, // of the true lead (a cloud of lasers, not a wall)
  spread: 0.1, // radians a shot may be off, each way (less up and down)
  slow: 0.5, // of its speed it gives up in the hardest turn
  flinch: 0.3, // how often one that's hit (and not down) breaks off its run
  far: 140, // solids further than this from you aren't looked at
  match: 1.15, // of your speed, in the fight (and FIGHT.margin on top)
  margin: 2.5 * PACE, // map units a second over yours
  floor: 0.42, // of its top speed, the least it flies the fight at
  engageAt: 18, // inside this far from you it's wholly at the fight's speed
  closeFrom: 34, // past this it closes flat out (between, in between)
  stiff: 0.4, // of its nose rate gone at its top speed (as yours goes with speed)
  hurry: 0.4, // swinging out, how much its station's distance counts toward closing flat out
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const between = (rand, a, b) => a + rand() * (b - a);

// How quick a kind's nose is, in radians a second, at the fight's speed (a
// little quicker than yours at cruise, which is why you can't just out-turn
// one; its acceleration as it was tuned, before ship.js's PACE)
export const turnRate = (type) => type.turn ?? 1.7 + type.accel / PACE / 16;

// and at `speed`: all of it up to the floor of the fight's speed, FIGHT.stiff
// of it gone by its top (the quick pass is a straight one)
export function turnRateAt(type, speed) {
  const lo = type.speed * FIGHT.floor;
  const k = clamp((speed - lo) / Math.max(1e-6, type.speed - lo), 0, 1);
  return turnRate(type) * (1 - FIGHT.stiff * k);
}

// The speed a kind flies the fight at, against you going at `yourSpeed`,
// `gap` away: a little over yours (FIGHT.match of it and FIGHT.margin on
// top), never under FIGHT.floor of its top and never over its top, out to
// FIGHT.engageAt; flat out from FIGHT.closeFrom; in between, in between
export function fightSpeed(type, yourSpeed, gap) {
  const match = clamp(yourSpeed * FIGHT.match + FIGHT.margin, type.speed * FIGHT.floor, type.speed);
  const k = clamp((gap - FIGHT.engageAt) / (FIGHT.closeFrom - FIGHT.engageAt), 0, 1);
  return match + (type.speed - match) * k;
}

// How near a shot must pass a kind's middle to hit it (a touch more than
// its size: the guns are forgiving). Here, and for the hunters after
// another pilot (online/pilots.js), so a shot counts the same either way
export const hitRadius = (type) => type.size * 0.9 + 0.12;

// How good a pilot is (a pack's `skill`, difficulty.js's tiers): of its
// kind's lead and scatter, of the time between its shots and before its
// first, how readily it breaks off its line when you line up on it (`jink`,
// JINK), how often a hit makes it break off its run, more of the pack on a
// run at once, and how much likelier to sit on your tail. A pack sent with
// no skill flies as its kinds always have.
export const SKILLS = {
  rookie: { lead: 0.75, spread: 1.4, fire: 1.3, react: 1.4, jink: 0.1, flinch: 0.45, slots: 0, tail: 0.6 },
  regular: { lead: 1, spread: 1, fire: 1, react: 1, jink: 0.3, flinch: 0.3, slots: 0, tail: 1 },
  veteran: { lead: 1.2, spread: 0.72, fire: 0.85, react: 0.75, jink: 0.55, flinch: 0.15, slots: 1, tail: 1.35 },
  elite: { lead: 1.38, spread: 0.5, fire: 0.7, react: 0.55, jink: 0.8, flinch: 0.06, slots: 1, tail: 1.7 },
};
const TIER_ORDER = Object.keys(SKILLS);
// lined up on: your nose within `cone` (the cosine: about 10°) of it, inside
// `range`; it breaks `rate`×jink times a second of that, for a moment, then
// can't again for a moment
export const JINK = { range: 26, cone: 0.985, rate: 2.5, for: [0.45, 0.8], cool: [0.8, 1.5], push: 1.6 };

// How many of a pack of `n` may be on an attack run at once
export const slotsFor = (n) => (n >= 5 ? 3 : Math.min(n, 2));
// What a hunter perceives: all round (sensors), a long way, sure of you in
// half a second, hearing a shot from further; the truth kept a couple of
// seconds after a planet hides you, then a guess that fades over a while
export const HUNTER_SENSES = createSenses({ sight: { range: 400, cone: -1, far: 0.5 }, hearing: { range: 300 }, memory: 8, intuition: 2.5 });
// Its nerve: a pack of at least NERVE.pack that's lost most of itself (the
// ratio of what's left of it to what it's lost and what you're worth:
// lib/ai/squad's confidence, binned) breaks off together
const NERVE = { pack: 3, you: 0.4, every: 1 };
// The roles a hunter waiting for a run may take (its station): holding
// off to one side ahead of you, swinging round behind you to come in from
// your blind side, or sitting out across the way you're going
export const ROLES = [
  { id: 'wait', weight: 0.3, considerations: [] },
  { id: 'flank', weight: 1.2, considerations: [(c) => consider(c.yourSpeed, [3 * PACE, 16 * PACE]), (c) => (c.behind ? 1 : 0.6), (c) => (c.holdoff ? 0 : 1)] },
  { id: 'block', weight: 1.0, considerations: [(c) => consider(c.yourSpeed, [8 * PACE, 30 * PACE]), (c) => consider(c.alive, [2, 4]), (c) => (c.holdoff ? 0 : 1)] },
];

// The way you're really going, in the map's space: along your nose at your
// speed, climbing or falling as the ship says it is (ship.js's vy has the
// lift near the ceiling in it)
export function shipVelocity(s, out = [0, 0, 0]) {
  const n = nose(s);
  const v = s.speed || 0;
  out[0] = n[0] * v;
  out[1] = Number.isFinite(s.vy) ? s.vy : n[1] * v;
  out[2] = n[2] * v;
  return out;
}

// Who's in a pack: the kinds, the first of them the ace when there is one.
// More come, and the ace more often, the more trouble you've been making
// (`heat`: what you've shot down lately); the first pack of a visit is a
// small one with no ace. `size` and `ace`, given, are taken as they are.
// `kinds`: exactly who comes; `more`: that many more (or fewer) than it
// would be, never under one, and never more of a pack of one (a bounty
// hunter comes alone).
export function packPlan(f, { size, ace, heat = 0, first = false, rand = Math.random, kinds: given = null, more = 0 } = {}) {
  if (given?.length) return [...given];
  const [lo, hi] = f.size;
  const hot = clamp(heat, 0, 5) / 5;
  const n0 = size ?? (first ? lo : Math.round(lo + (hi - lo) * clamp(rand() * 0.7 + hot * 0.6, 0, 1)));
  const n = more && n0 > 1 && hi > 1 ? Math.max(1, n0 + more) : n0;
  const total = f.kinds.reduce((s, [, w]) => s + w, 0);
  const pick = () => {
    let r = rand() * total;
    for (const [k, w] of f.kinds) if ((r -= w) <= 0) return k;
    return f.kinds[f.kinds.length - 1][0];
  };
  const kinds = Array.from({ length: n }, pick);
  const withAce = ace ?? (!first && rand() < 0.12 + 0.3 * hot);
  if (f.ace && withAce && n > 0) kinds[0] = f.ace;
  return kinds;
}

// a point moved out of anything solid it's inside (or too near): to `gap`
// past the surface, the way it already is from the middle
export function clearOf(p, solids, gap = 2) {
  // (out of one may be into its neighbour: round again, a few times at most)
  for (let pass = 0, moved = true; moved && pass < 4; pass++) {
    moved = false;
    for (const o of solids) {
      const dx = p.x - o.at[0];
      const dy = p.y - o.at[1];
      const dz = p.z - o.at[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const r = o.r + gap;
      if (d >= r - 1e-9) continue;
      moved = true;
      if (d < 1e-6) {
        p.y = o.at[1] + r;
        continue;
      }
      const k = r / d;
      p.x = o.at[0] + dx * k;
      p.y = o.at[1] + dy * k;
      p.z = o.at[2] + dz * k;
    }
  }
  return p;
}

// Where the `i`th of `n` comes in: behind you, spread out, a little above
// and below; `ahead` of you (an ambush, across your way, where you see them
// coming: `lead` further along, where you'll be by the time they have the
// pulse drive down, ship.js's holdReach); out of `portal`s opening ahead of
// you; one after another out of a hangar (`from`: { x, y, z }); or waiting
// round a point (`at`: { x, y, z }, the node you're coming off a lane at,
// or where you've stopped: never in the lane itself). Never inside anything
// solid.
export function entryPoint(ship, i, n, { portal = false, from = null, ahead = false, lead = 0, at = null, rand = Math.random, solids = [] } = {}) {
  const fx = -Math.sin(ship.heading);
  const fz = -Math.cos(ship.heading);
  let p;
  if (at) {
    // (round it, evenly, a little above and below)
    const a = (i / Math.max(1, n)) * Math.PI * 2 + rand() * 0.4;
    const d = 14 + rand() * 8;
    p = { x: at.x + Math.cos(a) * d, y: at.y + (rand() - 0.5) * 6, z: at.z + Math.sin(a) * d };
  } else if (from) p = { x: from.x + (rand() - 0.5) * 3, y: from.y - i * 0.6, z: from.z + (rand() - 0.5) * 3 };
  else if (ahead) {
    const d = 38 + i * 4 + lead;
    const side = (i - (n - 1) / 2) * 5;
    p = { x: ship.x + fx * d - fz * side, y: ship.y + (rand() - 0.5) * 6, z: ship.z + fz * d + fx * side };
  } else if (portal) {
    const a = ship.heading + (i - (n - 1) / 2) * 0.32;
    const d = 9 + i * 1.5;
    p = { x: ship.x - Math.sin(a) * d, y: ship.y + 0.6 + (i % 2 ? 1 : -0.4), z: ship.z - Math.cos(a) * d };
  } else {
    const back = 26 + i * 2.5;
    const side = (i - (n - 1) / 2) * 2.2;
    p = { x: ship.x - fx * back - fz * side, y: ship.y + (rand() - 0.5) * 3, z: ship.z - fz * back + fx * side };
  }
  // (a hangar's mouth is the big ship's own business: it isn't a solid here)
  return from ? p : clearOf(p, solids);
}

// A unit direction `d` turned toward the unit direction `w` by at most
// `max` radians, in place (the short way round; straight back, it goes
// round level, to the `side` given). Returns how far it turned.
export function turnToward(d, w, max, side = 1) {
  const c = clamp(d[0] * w[0] + d[1] * w[1] + d[2] * w[2], -1, 1);
  const ang = Math.acos(c);
  if (ang <= max) {
    d[0] = w[0];
    d[1] = w[1];
    d[2] = w[2];
    return ang;
  }
  const s = Math.sin(ang);
  if (c < 0 && s < 0.02) {
    // dead astern: any way round is as short, so level, to its side
    let px = -d[2] * side;
    let pz = d[0] * side;
    const l = Math.sqrt(px * px + pz * pz);
    if (l < 1e-4) {
      px = side;
      pz = 0;
    } else {
      px /= l;
      pz /= l;
    }
    const cm = Math.cos(max);
    const sm = Math.sin(max);
    d[0] = d[0] * cm + px * sm;
    d[1] = d[1] * cm;
    d[2] = d[2] * cm + pz * sm;
  } else {
    const a = Math.sin(ang - max) / s;
    const b = Math.sin(max) / s;
    d[0] = d[0] * a + w[0] * b;
    d[1] = d[1] * a + w[1] * b;
    d[2] = d[2] * a + w[2] * b;
  }
  const l = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]) || 1;
  d[0] /= l;
  d[1] /= l;
  d[2] /= l;
  return max;
}

// Is the straight way from `a` to `b` (each { x, y, z }) through one of
// these solids?
export function blocked(a, b, solids) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const len2 = dx * dx + dy * dy + dz * dz;
  for (const o of solids) {
    const rx = o.at[0] - a.x;
    const ry = o.at[1] - a.y;
    const rz = o.at[2] - a.z;
    const k = len2 > 1e-9 ? clamp((rx * dx + ry * dy + rz * dz) / len2, 0, 1) : 0;
    const px = rx - dx * k;
    const py = ry - dy * k;
    const pz = rz - dz * k;
    if (px * px + py * py + pz * pz < o.r * o.r) return true;
  }
  return false;
}

// (`factions` and `kinds` are these, unless another map brings its own: the
// galaxy's Separatists and the Imperial remnant, galaxy/hunted.js)
// (`nerve: false` for a hunt whose quarry isn't you: a skirmish's, fought to the end)
export function createHunt({ rand = Math.random, factions = FACTIONS, kinds: KINDS = HUNTER_KINDS, solids = [], lasers: laserCount = 28, firstId = 1, nerve = true } = {}) {
  const allSolids = typeof solids === 'function' ? solids : () => solids;
  const live = []; // hunters in flight
  const packs = []; // { faction, members, lost, said, … }
  let nextId = firstId; // each hunter's own number, for the lock to follow (another hunt, a skirmish's, numbers its own from elsewhere)
  const lasers = Array.from({ length: laserCount }, () => ({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, at: null, faction: null, bomb: false, r: null, damage: null, by: null, seek: 0, missile: false, ion: false }));
  const yourVelObj = { x: 0, y: 0, z: 0 }; // (for the senses)
  const estVel = [0, 0, 0];
  const events = [];
  const later = []; // what happened between frames (an ace hurt into its next stage), told on the next
  const targets = []; // what the guns can lock on to (reused)
  const cover = []; // the solids close enough to matter this frame, but for one you're down inside (they block a shot, and are steered round)

  // you, as of the last frame you were flying
  const you = { x: 0, y: 0, z: 0 };
  const youPrev = { x: 0, y: 0, z: 0 };
  const yourVel = [0, 0, 0];
  let yourNose = [0, 0, -1];
  let known = false; // (whether `you` has ever been set)
  // scratch
  const L = [0, 0, -1];
  const dir = [0, 0, 1];
  const want = [0, 0, 0];
  const wantDir = [0, 0, 1];
  const aim = { x: 0, y: 0, z: 0 };
  const zero = [0, 0, 0];
  const mDir = [0, 0, 1];
  const mTo = [0, 0, 1];

  // a new station for one swinging out: off along the way the target's
  // pointing now (`look`), to the hunter's side, a little above or below
  const restation = (h, look, role = 'wait') => {
    h.mode = 'set';
    h.clock = 0;
    h.role = role;
    // (one that holds off takes its station further out: its run is all
    // range; a flanker's is behind you, to the side; a blocker's well ahead)
    const out = role === 'flank' ? -(8 + rand() * 6) : role === 'block' ? FIGHT.closeFrom : (10 + rand() * 6) * (hasTrait(h.type, 'sniper') ? 2.4 : hasTrait(h.type, 'holdoff') ? 1.7 : 1);
    const wide = (role === 'flank' ? 6 + rand() * 4 : role === 'block' ? 1 + rand() * 2 : 3 + rand() * 5) * h.side;
    const high = (rand() - 0.5) * 3;
    // level, across the way it's pointing (anything pointing straight up has no across: x will do)
    let sx = -look[2];
    let sz = look[0];
    const l = Math.sqrt(sx * sx + sz * sz);
    if (l < 1e-3) {
      sx = 1;
      sz = 0;
    } else {
      sx /= l;
      sz /= l;
    }
    h.off[0] = look[0] * out + sx * wide;
    h.off[1] = look[1] * out + high;
    h.off[2] = look[2] * out + sz * wide;
  };
  const release = (h) => {
    h.pack.tokens.release('run', h.id);
    h.pack.tokens.release('tail', h.id);
    h.slot = false;
    h.pack.attacking = h.pack.tokens.count('run');
  };
  const remove = (h) => {
    release(h);
    h.alive = false;
    const i = live.indexOf(h);
    if (i >= 0) live.splice(i, 1);
  };
  const result = (h, down) => ({ id: h.id, kind: h.kind, at: { x: h.pos.x, y: h.pos.y, z: h.pos.z }, size: h.type.size, down, hunter: h });
  // an ace hurt past one of its stages (its kind's `stages`: hurt to half,
  // say) changes its ways: what the stage says (speed, fire, trait…) takes
  // over its kind's row from here on, it breaks off the run it was on to come
  // at you the new way, and if the stage `summon`s a faction, the event
  // says so (the scene sends them)
  const stage = (h) => {
    const stages = h.type.stages;
    if (!stages) return;
    const i = h.stage ?? 0;
    const next = stages[i];
    if (!next || h.hp / h.type.hp > next.below) return;
    h.stage = i + 1;
    const { below, summon = null, ...over } = next;
    h.type = { ...h.type, ...over, stages };
    release(h);
    h.side = -h.side;
    restation(h, yourNose);
    later.push({ type: 'stage', id: h.id, kind: h.kind, faction: h.pack.faction, stage: h.stage, of: stages.length, below, summon });
  };
  // a hit on one of them, worth `n`: what became of it
  const wound = (h, n) => {
    h.hp -= n;
    h.target.hp = Math.max(0, h.hp);
    h.pack.provoked = true; // (the quiet ones open up now)
    if (h.hp > 0) {
      stage(h);
      if (hasTrait(h.type, 'flicker')) h.hidden = FLICKER;
      // now and then it breaks off the run it was on, the other way (the
      // rest of the time it takes the hit and comes on)
      if (h.mode !== 'set' && !hasTrait(h.type, 'rammer') && rand() < (h.skill?.flinch ?? FIGHT.flinch)) {
        release(h);
        h.side = -h.side;
        restation(h, yourNose);
      }
      return result(h, false);
    }
    const out = result(h, true);
    remove(h);
    return out;
  };

  // the solids worth looking at this frame: near you (or where you last
  // were), but for one you're down inside (a trench: they come in after you)
  const survey = (inside) => {
    cover.length = 0;
    if (!live.length && !lasers.some((m) => m.on)) return;
    for (const o of allSolids()) {
      const dx = o.at[0] - you.x;
      const dy = o.at[1] - you.y;
      const dz = o.at[2] - you.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      const reach = o.r + FIGHT.far;
      if (known && d2 > reach * reach) continue;
      if (inside && d2 < o.r * o.r) continue;
      cover.push(o);
    }
  };

  // steering: the velocity it wants, kept off the others and round what's solid
  const steerClear = (h, speed) => {
    const { pos, vel } = h;
    for (const o of live) {
      if (o === h) continue;
      // the nearest the two come in the next moment, each on the way it's
      // going (two crossing at speed are past each other in a frame or two:
      // it's where they will be that's steered away from)
      const rx = pos.x - o.pos.x;
      const ry = pos.y - o.pos.y;
      const rz = pos.z - o.pos.z;
      if (rx * rx + ry * ry + rz * rz > 30 * 30) continue;
      const ux = vel.x - o.vel.x;
      const uy = vel.y - o.vel.y;
      const uz = vel.z - o.vel.z;
      const u2 = ux * ux + uy * uy + uz * uz;
      const t = u2 > 1e-6 ? clamp(-(rx * ux + ry * uy + rz * uz) / u2, 0, FIGHT.ahead * 0.6) : 0;
      let px = rx + ux * t;
      let py = ry + uy * t;
      let pz = rz + uz * t;
      let d = Math.sqrt(px * px + py * py + pz * pz);
      if (d >= FIGHT.apart) continue;
      if (d < 1e-3) {
        // dead on for each other: apart by their numbers, one up and one down
        px = 0;
        py = h.id > o.id ? 1 : -1;
        pz = 0;
        d = 1;
      }
      const k = (speed * (0.6 + 1.6 * (1 - d / FIGHT.apart))) / d;
      want[0] += px * k;
      want[1] += py * k;
      want[2] += pz * k;
    }
    const v2 = vel.x * vel.x + vel.y * vel.y + vel.z * vel.z;
    for (const o of cover) {
      const R = o.r + FIGHT.clear + h.type.size;
      const rx = pos.x - o.at[0];
      const ry = pos.y - o.at[1];
      const rz = pos.z - o.at[2];
      // the nearest it comes on the way it's going, in the next moment
      const t = v2 > 1e-6 ? clamp(-(rx * vel.x + ry * vel.y + rz * vel.z) / v2, 0, FIGHT.ahead) : 0;
      let px = rx + vel.x * t;
      let py = ry + vel.y * t;
      let pz = rz + vel.z * t;
      let d = Math.sqrt(px * px + py * py + pz * pz);
      if (d >= R) continue;
      if (d < 1e-3) {
        // dead on for its middle: out the way it is from it now
        px = rx;
        py = ry;
        pz = rz;
        d = Math.sqrt(px * px + py * py + pz * pz) || 1;
      }
      const k = (speed * (1.5 + 3 * (1 - d / R))) / d;
      want[0] += px * k;
      want[1] += py * k;
      want[2] += pz * k;
    }
  };

  // never on top of another of them, whatever it wanted
  const keepApart = (h) => {
    const { pos, type } = h;
    for (const o of live) {
      if (o === h) continue;
      const rx = pos.x - o.pos.x;
      const ry = pos.y - o.pos.y;
      const rz = pos.z - o.pos.z;
      const d2 = rx * rx + ry * ry + rz * rz;
      const r = (type.size + o.type.size) * 0.75;
      if (d2 >= r * r) continue;
      const d = Math.sqrt(d2);
      const k = d > 1e-4 ? (r - d) / d : 0;
      pos.x += rx * k;
      pos.y += d > 1e-4 ? ry * k : h.id > o.id ? r : -r;
      pos.z += rz * k;
    }
  };

  // one held in a magnet, this frame: dragged toward it (no faster than the
  // magnet pulls, never past it), tumbling; not flown, so not steered
  const drag = (h, at, dt) => {
    const { pos, vel } = h;
    const dx = at.x - pos.x;
    const dy = at.y - pos.y;
    const dz = at.z - pos.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const k = d < 1e-6 ? 0 : Math.min(1, (h.pullSpeed * dt) / d);
    if (dt > 0) {
      vel.x = (dx * k) / dt;
      vel.y = (dy * k) / dt;
      vel.z = (dz * k) / dt;
    }
    pos.x += dx * k;
    pos.y += dy * k;
    pos.z += dz * k;
    keepApart(h);
    clearOf(pos, cover, h.type.size * 0.5);
    h.bank += dt * 3;
    h.grow = Math.min(1, h.grow + dt * 2.2);
  };
  // the magnet lets go: a moment dazed, then out to swing round again
  const letGo = (h) => {
    h.held = 0;
    h.daze = h.dazeFor;
    h.cool = Math.max(h.cool, h.dazeFor);
    release(h);
    h.side = -h.side;
    restation(h, yourNose);
  };

  const fire = (h, target, targetVel, toPrey, missile = false) => {
    const { pos, vel, type, skill } = h;
    const bomb = !missile && hasTrait(type, 'bomber');
    const sniper = !missile && hasTrait(type, 'sniper');
    const ion = !missile && !bomb && hasTrait(type, 'ion');
    const speed = missile ? MISSILE.speed : bomb ? BOMB.speed : LASER.speed + Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z) * 0.5;
    // where a laser fired now would meet it, most of the way allowed for
    // (the better the pilot, the more of it; a missile finds its own way)
    const meet = intercept(pos, speed, target, targetVel);
    const lead = missile ? 0 : Math.min(1, (sniper ? SNIPER.lead : (type.lead ?? FIGHT.lead)) * (skill?.lead ?? 1));
    const t = (meet ? meet.t : 0) * lead;
    let ax = target.x + targetVel[0] * t - pos.x;
    let ay = target.y + targetVel[1] * t - pos.y;
    let az = target.z + targetVel[2] * t - pos.z;
    let l = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
    // and not quite true
    const wide = missile ? 0 : FIGHT.spread * (sniper ? SNIPER.spread : (type.spread ?? 1)) * (skill?.spread ?? 1) * (h.mode === 'tail' ? FIGHT.tailSpread : 1) * 2;
    ax = ax / l + (rand() - 0.5) * wide;
    ay = ay / l + (rand() - 0.5) * wide * 0.78;
    az = az / l + (rand() - 0.5) * wide;
    l = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
    ax /= l;
    ay /= l;
    az /= l;
    const m = lasers.find((o) => !o.on) ?? lasers[0];
    m.on = true;
    m.x = pos.x + ax * type.size * 0.6;
    m.y = pos.y + ay * type.size * 0.6;
    m.z = pos.z + az * type.size * 0.6;
    m.vx = ax * speed;
    m.vy = ay * speed;
    m.vz = az * speed;
    m.life = missile ? MISSILE.life : bomb ? BOMB.life : LASER.life;
    m.at = toPrey ? 'prey' : 'you';
    m.faction = h.pack.faction;
    m.bomb = bomb;
    m.missile = missile;
    m.seek = missile ? MISSILE.seek : 0;
    m.ion = ion;
    m.r = missile ? MISSILE.burst : bomb ? BOMB.burst : null;
    m.damage = missile ? MISSILE.damage : bomb ? BOMB.damage : ion ? ION.damage : (type.damage ?? (sniper ? SNIPER.damage : null));
    m.by = h.id;
    if (!toPrey) events.push({ type: missile ? 'missile' : 'shot', faction: h.pack.faction, id: h.id });
  };

  return {
    live,
    lasers,

    // a pack of hunters after you (or after `prey`: { at: { x, y, z }, dir(out),
    // alive() }, something else, e.g. a freighter in distress). Returns the
    // hunters (each one's `pos` is where it came in).
    // `skill`: the tier they fly at (SKILLS; none: as their kinds always
    // have), their ace (or a bounty hunter) a tier better and never under a
    // veteran; `kinds`: exactly who comes, in place of the faction's pick;
    // `more`: that many more of them (packPlan)
    pack(faction, ship, { prey = null, size, ace, from = null, ahead = false, lead = 0, at = null, interdict = false, heat = 0, first = false, skill = null, kinds: given = null, more = 0 } = {}) {
      const f = factions[faction];
      if (!f || !ship) return [];
      const kinds = packPlan(f, { size, ace, heat, first, rand, kinds: given?.filter((k) => KINDS[k]), more });
      const n = kinds.length;
      const tier = SKILLS[skill] ? TIER_ORDER.indexOf(skill) : -1;
      const skillOf = (kind) => {
        if (tier < 0) return null;
        const best = kind === f.ace || f.role === 'bounty' || KINDS[kind].stages ? Math.max(tier + 1, TIER_ORDER.indexOf('veteran')) : tier;
        return SKILLS[TIER_ORDER[Math.min(TIER_ORDER.length - 1, best)]];
      };
      const runs = slotsFor(n) + (tier >= 0 ? SKILLS[skill].slots : 0);
      const pack = { faction, skill: tier >= 0 ? skill : null, members: [], lost: 0, fade: 0, prey, wasPrey: Boolean(prey), kinds, interdict, attacking: 0, slots: runs, tokens: createTokens({ pools: { run: runs, tail: 1 }, timeout: 30 }), n0: n, nerve: 'neutral', nerveAt: 0, gone: false, angry: false, said: false, provoked: false };
      const around = allSolids();
      const fx = -Math.sin(ship.heading);
      const fz = -Math.cos(ship.heading);
      kinds.forEach((kind, i) => {
        const type = KINDS[kind];
        const hs = skillOf(kind);
        const pos = entryPoint(ship, i, n, { portal: f.portal && !from && !ahead && !at, from, ahead, lead, at, rand, solids: around });
        const v = type.speed * (ahead ? -0.8 : 0.8); // (an ambush comes at you; the rest come up behind you)
        const h = {
          id: nextId++,
          kind,
          type,
          pack,
          pos,
          prev: { ...pos }, // where it was at the start of the frame (a shot's tested against the whole way)
          vel: { x: fx * v, y: 0, z: fz * v },
          hp: type.hp,
          mode: 'set', // swinging out to come round ('set'), coming at you ('run'), or on your tail ('tail')
          clock: 0, // seconds in this mode
          slot: false, // has one of the pack's places on a run
          closed: false, // has been closing on you, this run
          side: i % 2 ? 1 : -1,
          off: [0, 0, 0],
          tailFor: 0,
          cool: between(rand, 1.2, 2.4) * (hs?.react ?? 1), // a moment before the first shot
          skill: hs, // how good a pilot (SKILLS), or null
          jink: 0, // seconds left breaking off its line (you lined up on it)
          jinkCool: 0,
          jinkDir: [0, 0, 0],
          jinks: 0, // how many times it has
          missileCool: hasTrait(type, 'missile') ? between(rand, 1.5, 3) : 0,
          patchCool: MEDIC.every,
          bank: 0,
          hidden: 0, // seconds it's gone from sight (a flicker, hit)
          held: 0, // seconds it's still held in a magnet (pull), dragged and its guns jammed
          daze: 0, // seconds, once let go, before it fires again
          lit: false, // has pinned you with its spotlight, this run
          bombed: false, // has dropped its bomb, this run
          grow: f.portal ? 0 : 1,
          alive: true,
          view: null,
          role: 'wait',
          flanked: false, // (has said it's flanking)
          // what it knows of you: sent after you, it knows where you are
          me: { pos, dir: null, beliefs: { you: { id: 'you', at: { x: ship.x, y: ship.y, z: ship.z }, vel: { x: 0, y: 0, z: 0 }, seenAt: 0, heardAt: -Infinity, confidence: 1, visible: true, timer: 1, kind: null, hostile: true } }, now: 0 },
          belief: null,
          seesYou: true,
        };
        restation(h, [fx, 0, fz]);
        h.target = { id: h.id, at: h.pos, vel: h.vel, size: type.size, kind, hp: h.hp, hpMax: type.hp, faction, threat: 0 };
        pack.members.push(h);
        live.push(h);
      });
      packs.push(pack);
      return pack.members;
    },

    // ship: yours ({ x, y, z, heading, pitch, speed, vy }) or null (not
    // flying: they all leave)
    update(dt, ship) {
      events.length = 0;
      events.push(...later.splice(0));
      if (ship) {
        if (known) {
          youPrev.x = you.x;
          youPrev.y = you.y;
          youPrev.z = you.z;
        }
        you.x = ship.x;
        you.y = ship.y;
        you.z = ship.z;
        if (!known) {
          youPrev.x = you.x;
          youPrev.y = you.y;
          youPrev.z = you.z;
        }
        known = true;
        yourNose = nose(ship);
        shipVelocity(ship, yourVel);
        yourVelObj.x = yourVel[0];
        yourVelObj.y = yourVel[1];
        yourVelObj.z = yourVel[2];
      }
      const yourSpeed = Math.sqrt(yourVel[0] * yourVel[0] + yourVel[1] * yourVel[1] + yourVel[2] * yourVel[2]);

      for (let i = packs.length - 1; i >= 0; i--) {
        const pack = packs[i];
        // what they were after has gone (the freighter got away): you'll do
        if (pack.prey && !pack.prey.alive()) pack.prey = null;
        if (pack.gone) pack.fade += dt;
        let alive = 0;
        let nearest = Infinity;
        for (const h of pack.members) {
          if (!h.alive) continue;
          alive += 1;
          if (!ship) continue;
          const dx = h.pos.x - you.x;
          const dy = h.pos.y - you.y;
          const dz = h.pos.z - you.z;
          nearest = Math.min(nearest, Math.sqrt(dx * dx + dy * dy + dz * dz));
        }
        if (!alive) {
          if (!pack.gone) events.push({ type: 'cleared', faction: pack.faction, rescued: pack.wasPrey });
          packs.splice(i, 1);
          continue;
        }
        if (!pack.said && ship) {
          pack.said = true;
          events.push({ type: 'hunted', faction: pack.faction, kinds: pack.kinds, prey: pack.wasPrey, interdict: Boolean(pack.interdict) });
        }
        // too far away for long enough (or lost altogether: nobody left in
        // it has any idea where you are), and they give up; and a pack
        // that's lost most of itself loses its nerve and breaks off together
        const blind = ship && !pack.prey && pack.members.every((h) => !h.alive || !h.belief);
        pack.lost = nearest > LOSE.far || blind ? pack.lost + dt : 0;
        let broke = false;
        if (nerve && ship && !pack.gone && !pack.prey && pack.n0 >= NERVE.pack && (pack.nerveAt += dt) >= NERVE.every) {
          pack.nerveAt = 0;
          const members = pack.members.filter((h) => h.alive).map((h) => ({ id: h.id, at: h.pos, side: 'pack', alive: true, hp: h.hp / h.type.hp }));
          const { level } = confidence({ members: members.map((m) => m.id) }, members, [{ id: 'you', at: you, side: 'you', alive: true }], { value: (u) => (u.id === 'you' ? pack.n0 * NERVE.you : u.hp), losses: pack.n0 - members.length });
          pack.nerve = level;
          broke = level === 'panicked';
        }
        if ((pack.lost > LOSE.after || !ship || broke || (pack.prey === null && pack.wasPrey && !pack.angry)) && !pack.gone) {
          pack.gone = true;
          pack.fade = 0;
          for (const h of pack.members) release(h);
          if (ship && !pack.wasPrey) events.push({ type: 'escaped', faction: pack.faction, why: broke ? 'broke' : 'lost' });
        }
        pack.tokens.audit(dt, (id) => pack.members.some((h) => h.id === id && h.alive));
        pack.attacking = pack.tokens.count('run');
      }

      survey(Boolean(ship));

      for (let i = live.length - 1; i >= 0; i--) {
        const h = live[i];
        const { type, pos, vel, pack } = h;
        const trait = type.trait;
        const has = (t) => t === trait || hasTrait(type, t);
        const ram = has('rammer');
        const keepOff = has('sniper') ? SNIPER.near : has('holdoff') ? HOLDOFF.near : 0; // (how far it keeps off you, if it does)
        if (h.hidden > 0) h.hidden = Math.max(0, h.hidden - dt);
        h.prev.x = pos.x;
        h.prev.y = pos.y;
        h.prev.z = pos.z;
        // held in a magnet (and let go of when you stop flying, or the pack gives up)
        if (h.held > 0 && (!ship || pack.gone)) h.held = 0;
        if (h.held > 0) {
          drag(h, ship.magnet ?? h.heldAt, dt);
          h.held -= dt;
          if (h.held <= 0) letGo(h);
          continue;
        }
        if (h.daze > 0) h.daze = Math.max(0, h.daze - dt);
        const gone = pack.gone;
        const onPrey = !gone && pack.prey && !pack.angry;
        // what it knows of you this frame: the truth while it sees you (or
        // for a moment after), its guess while it doesn't
        if (ship) {
          sense(HUNTER_SENSES, h.me, { targets: [{ id: 'you', at: you, vel: yourVelObj, hostile: true }] }, dt, { seesThrough: (a, b) => !blocked(a, b, cover) });
          h.belief = belief(h.me, 'you');
          h.seesYou = Boolean(h.belief?.visible);
        }
        const sure = h.seesYou || (h.belief && h.me.now - h.belief.seenAt <= HUNTER_SENSES.intuition);
        const est = h.belief && !sure ? h.belief.at : you;
        if (h.belief && !sure) {
          estVel[0] = h.belief.vel.x;
          estVel[1] = h.belief.vel.y;
          estVel[2] = h.belief.vel.z;
        }
        const c = onPrey ? pack.prey.at : ship && !gone ? est : null;
        const cVel = onPrey ? zero : sure ? yourVel : estVel;
        let speed = type.speed;
        const s0 = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
        let fightPace = type.speed;
        if (s0 > 1e-4) {
          dir[0] = vel.x / s0;
          dir[1] = vel.y / s0;
          dir[2] = vel.z / s0;
        }
        let gap = Infinity;
        if (c) {
          // the way the target is pointing (your nose, or along the prey's)
          if (onPrey) pack.prey.dir(L);
          else {
            L[0] = yourNose[0];
            L[1] = yourNose[1];
            L[2] = yourNose[2];
          }
          const tx = c.x - pos.x;
          const ty = c.y - pos.y;
          const tz = c.z - pos.z;
          gap = Math.sqrt(tx * tx + ty * ty + tz * tz);
          h.clock += dt;
          // the fight's pace: at yours (pirates at their floor)
          fightPace = fightSpeed(type, onPrey ? 0 : yourSpeed, gap);
          speed = fightPace;
          if (h.mode === 'set') {
            want[0] = c.x + h.off[0] - pos.x;
            want[1] = c.y + h.off[1] - pos.y;
            want[2] = c.z + h.off[2] - pos.z;
            const d = Math.sqrt(want[0] * want[0] + want[1] * want[1] + want[2] * want[2]);
            // (swinging out, it hurries the further its station is: it gets
            // out ahead of you to turn in, and doesn't trail along behind)
            if (!onPrey) {
              fightPace = Math.max(fightPace, fightSpeed(type, yourSpeed, FIGHT.engageAt + d * FIGHT.hurry));
              speed = fightPace;
            }
            if (ram && !onPrey) {
              // (a rammer doesn't wait its turn)
              h.mode = 'run';
              h.clock = 0;
              h.closed = false;
            } else if (d < FIGHT.station || h.clock > FIGHT.setFor) {
              if (pack.tokens.claim('run', h.id)) {
                // its turn: in it comes
                pack.attacking = pack.tokens.count('run');
                h.slot = true;
                h.mode = 'run';
                h.clock = 0;
                h.closed = false;
                h.lit = false;
              } else {
                // the others are on theirs: something to do with the wait,
                // weighed (a flank, a block, or round to the other side)
                h.side = -h.side;
                const behind = gap > 1e-4 && -(L[0] * tx + L[1] * ty + L[2] * tz) / gap < -0.3;
                const alive = pack.members.filter((o) => o.alive).length;
                const role = onPrey ? 'wait' : (pick(ROLES, { yourSpeed, behind, alive, holdoff: keepOff > 0 }, { current: h.role, momentum: 0.2, rand, spread: 0.2 })?.id ?? 'wait');
                if (role === 'flank' && !h.flanked) {
                  h.flanked = true;
                  events.push({ type: 'flank', faction: pack.faction, id: h.id });
                }
                restation(h, L, role);
              }
            }
          }
          if (h.mode === 'run') {
            // at the target, where it'll be by the time it's there
            const lead = Math.min(0.6, gap / type.speed) * 0.5;
            want[0] = tx + cVel[0] * lead;
            want[1] = ty + cVel[1] * lead;
            want[2] = tz + cVel[2] * lead;
            // how nearly its nose is on the target (1: dead on; under 0: going away)
            const onNose = gap > 1e-4 ? (dir[0] * tx + dir[1] * ty + dir[2] * tz) / gap : 1;
            if (onNose > 0) h.closed = true;
            // a bomber comes in slow and straight, to lay its bomb in your way
            if (has('bomber')) speed = fightPace * BOMB.slow;
            // a rammer comes flat out, leading you all the way in
            if (ram && !onPrey) {
              speed = type.speed;
              const meet = intercept(pos, type.speed, c, cVel);
              const lt = meet ? Math.min(meet.t, 2) : 0;
              want[0] = tx + cVel[0] * lt;
              want[1] = ty + cVel[1] * lt;
              want[2] = tz + cVel[2] * lt;
            }
            if (has('spotlight') && !h.lit && !onPrey && gap < FIGHT.range * 0.6) {
              h.lit = true;
              events.push({ type: 'spotlit', faction: pack.faction, id: h.id });
            }
            // (one that holds off breaks away before it's close, allowing for
            // how far it goes in the half-second it takes to turn)
            const held = keepOff > 0 && onNose > 0 && gap < keepOff + s0 * 0.5;
            // past it (or round it, close in, and not coming onto it: it
            // would only circle), or about to hit it, or it's taken too
            // long: away again
            if (ram && !onPrey) {
              // (it doesn't break off: it comes round and in again)
              if (h.clock > FIGHT.runFor) h.clock = 0;
            } else if (held || h.bombed || gap < FIGHT.pass || (gap < FIGHT.past && h.closed && onNose < (h.clock > 1 ? 0.3 : 0)) || h.clock > FIGHT.runFor) {
              h.bombed = false;
              const tail = h.skill ? Math.min(0.9, (type.tail ?? 0) * h.skill.tail) : type.tail;
              if (!held && !has('bomber') && !onPrey && h.closed && tail && yourSpeed > FIGHT.tailAbove && gap < FIGHT.past && rand() < tail && pack.tokens.claim('tail', h.id)) {
                // (this one stays on you: one at a time)
                h.mode = 'tail';
                h.clock = 0;
                h.tailFor = between(rand, FIGHT.tailFor[0], FIGHT.tailFor[1]);
              } else {
                release(h);
                h.side = -h.side;
                restation(h, L);
                want[0] = c.x + h.off[0] - pos.x;
                want[1] = c.y + h.off[1] - pos.y;
                want[2] = c.z + h.off[2] - pos.z;
              }
            }
          } else if (h.mode === 'tail') {
            // behind you, a little above, going your way at your speed
            const bx = c.x - L[0] * FIGHT.tailBack - pos.x;
            const by = c.y - L[1] * FIGHT.tailBack + 0.3 - pos.y;
            const bz = c.z - L[2] * FIGHT.tailBack - pos.z;
            want[0] = cVel[0] + bx * 2;
            want[1] = cVel[1] + by * 2;
            want[2] = cVel[2] + bz * 2;
            speed = clamp(Math.sqrt(want[0] * want[0] + want[1] * want[1] + want[2] * want[2]), 2, type.speed);
            // how far round in front of you it is (you've turned on it)
            const front = gap > 1e-4 ? -(L[0] * tx + L[1] * ty + L[2] * tz) / gap : 0;
            if (h.clock > h.tailFor || front > 0.35 || yourSpeed < FIGHT.tailAbove * 0.5 || gap > 30) {
              release(h);
              h.side = -h.side;
              restation(h, L);
              want[0] = c.x + h.off[0] - pos.x;
              want[1] = c.y + h.off[1] - pos.y;
              want[2] = c.z + h.off[2] - pos.z;
              speed = fightPace;
            }
          }
          const d = Math.sqrt(want[0] * want[0] + want[1] * want[1] + want[2] * want[2]);
          const k = d > 1e-4 ? speed / d : 0;
          want[0] *= k;
          want[1] *= k;
          want[2] *= k;
          // one that holds off is pushed off you, whatever it's doing (on its
          // way out to its station ahead, it would fly straight past you)
          const keep = keepOff * 1.6;
          if (keepOff > 0 && gap < keep && gap > 1e-4) {
            const p = (speed * 3 * (1 - gap / keep)) / gap;
            want[0] -= tx * p;
            want[1] -= ty * p;
            want[2] -= tz * p;
          }
          // a pilot you've lined up on breaks off its line a moment (the
          // better it is, the sooner): across the way you're looking down
          if (h.skill?.jink && !onPrey && !ram && ship) {
            const rx = pos.x - you.x;
            const ry = pos.y - you.y;
            const rz = pos.z - you.z;
            const rd = Math.sqrt(rx * rx + ry * ry + rz * rz);
            if (h.jink > 0) {
              h.jink -= dt;
              want[0] += h.jinkDir[0] * speed * JINK.push;
              want[1] += h.jinkDir[1] * speed * JINK.push;
              want[2] += h.jinkDir[2] * speed * JINK.push;
            } else if ((h.jinkCool -= dt) <= 0 && rd < JINK.range && rd > 1e-3 && (yourNose[0] * rx + yourNose[1] * ry + yourNose[2] * rz) / rd > JINK.cone && rand() < h.skill.jink * JINK.rate * dt) {
              h.jink = between(rand, JINK.for[0], JINK.for[1]);
              h.jinkCool = h.jink + between(rand, JINK.cool[0], JINK.cool[1]);
              h.jinks += 1;
              // any way off the line you're looking down it, more across than up and down
              const ux = rand() - 0.5;
              const uy = (rand() - 0.5) * 0.6;
              const uz = rand() - 0.5;
              const along = (ux * rx + uy * ry + uz * rz) / (rd * rd);
              let jx = ux - rx * along;
              let jy = uy - ry * along;
              let jz = uz - rz * along;
              const jl = Math.sqrt(jx * jx + jy * jy + jz * jz) || 1;
              jx /= jl;
              jy /= jl;
              jz /= jl;
              h.jinkDir[0] = jx;
              h.jinkDir[1] = jy;
              h.jinkDir[2] = jz;
            }
          }
        } else {
          // leaving: on the way it's going, faster, climbing away
          speed = type.speed * 1.2;
          want[0] = dir[0] * speed;
          want[1] = (dir[1] + 0.16) * speed;
          want[2] = dir[2] * speed;
        }
        steerClear(h, speed);
        // the way it wants to go, and how fast: its nose comes round at its
        // own rate, and it slows into a hard turn
        const wl = Math.sqrt(want[0] * want[0] + want[1] * want[1] + want[2] * want[2]);
        if (wl > 1e-4) {
          wantDir[0] = want[0] / wl;
          wantDir[1] = want[1] / wl;
          wantDir[2] = want[2] / wl;
        } else {
          wantDir[0] = dir[0];
          wantDir[1] = dir[1];
          wantDir[2] = dir[2];
        }
        const bx0 = dir[0];
        const bz0 = dir[2];
        const off = Math.acos(clamp(dir[0] * wantDir[0] + dir[1] * wantDir[1] + dir[2] * wantDir[2], -1, 1));
        turnToward(dir, wantDir, turnRateAt(type, s0) * dt, h.side);
        const top = speed * (1 - FIGHT.slow * (off / Math.PI));
        const s1 = s0 + clamp(top - s0, -type.accel * dt, type.accel * dt);
        vel.x = dir[0] * s1;
        vel.y = dir[1] * s1;
        vel.z = dir[2] * s1;
        pos.x += vel.x * dt;
        pos.y += vel.y * dt;
        pos.z += vel.z * dt;
        keepApart(h);
        // and never inside anything solid
        clearOf(pos, cover, type.size * 0.5);
        // banking into the turn
        const yaw = dt > 0 ? (bx0 * dir[2] - bz0 * dir[0]) / dt : 0;
        h.bank += (clamp(yaw * 0.45, -1.1, 1.1) - h.bank) * Math.min(1, dt * 4);
        h.grow = Math.min(1, h.grow + dt * 2.2);
        if (gone) {
          // they've flown off out of sight (or you've stopped flying)
          const dx = pos.x - you.x;
          const dy = pos.y - you.y;
          const dz = pos.z - you.z;
          if (!ship || (pack.fade > 2 && dx * dx + dy * dy + dz * dz > 110 * 110) || pack.fade > 30) remove(h);
          continue;
        }
        // a rammer that reaches you bursts on you (the whole way each of
        // you went this frame: closing at speed, it would be past you)
        if (ram && c && !onPrey && ship && sweptHit(h.prev, pos, youPrev, you, RAM.reach + type.size) !== null) {
          events.push({ type: 'laser', damage: type.ram ?? RAM.damage, from: { x: pos.x, y: pos.y, z: pos.z }, bomb: false, ram: true, by: h.id });
          events.push({ type: 'rammed', id: h.id, kind: h.kind, faction: pack.faction, at: { x: pos.x, y: pos.y, z: pos.z }, size: type.size });
          remove(h); // (and it fires nothing, below: it has no guns)
        }
        // a medic patches up the worst hurt of its pack near it, a hit at a time
        if (has('medic') && (h.patchCool -= dt) <= 0) {
          h.patchCool = MEDIC.every;
          let worst = null;
          for (const o of pack.members) {
            if (o === h || !o.alive || o.hp >= o.type.hp) continue;
            if ((o.pos.x - pos.x) ** 2 + (o.pos.y - pos.y) ** 2 + (o.pos.z - pos.z) ** 2 > MEDIC.reach * MEDIC.reach) continue;
            if (!worst || o.hp / o.type.hp < worst.hp / worst.type.hp) worst = o;
          }
          if (worst) {
            worst.hp += 1;
            worst.target.hp = worst.hp;
            events.push({ type: 'patched', id: worst.id, by: h.id, faction: pack.faction });
          }
        }
        // firing: on a run (or on your tail, or at their prey), with the
        // target in its sights, in range and nothing solid in the way
        h.cool -= dt;
        const quiet = (has('quietUntilFired') && !pack.provoked) || h.hidden > 0 || h.daze > 0;
        const sniper = has('sniper');
        // (a missile now and then as well, from further out and less dead ahead)
        if (c && !onPrey && !quiet && has('missile') && (h.missileCool -= dt) <= 0) {
          const ax = c.x - pos.x;
          const ay = c.y - pos.y;
          const az = c.z - pos.z;
          const reach = Math.sqrt(ax * ax + ay * ay + az * az);
          if (reach < MISSILE.range && reach > FIGHT.near && (dir[0] * ax + dir[1] * ay + dir[2] * az) / reach > MISSILE.sights) {
            if (blocked(pos, c, cover)) h.missileCool = 0.5;
            else {
              h.missileCool = between(rand, MISSILE.every[0], MISSILE.every[1]) * (h.skill?.fire ?? 1);
              fire(h, c, cVel, false, true);
            }
          }
        }
        if (c && !ram && h.cool <= 0 && !quiet && (onPrey || h.mode !== 'set' || sniper)) {
          // (from where it is now, having moved: the same at any frame rate)
          const ax = c.x - pos.x;
          const ay = c.y - pos.y;
          const az = c.z - pos.z;
          const reach = Math.sqrt(ax * ax + ay * ay + az * az);
          const range = FIGHT.range * (sniper ? SNIPER.reach : has('holdoff') ? HOLDOFF.reach : 1);
          if (reach < range && reach > FIGHT.near && (dir[0] * ax + dir[1] * ay + dir[2] * az) / reach > (sniper ? SNIPER.sights : FIGHT.sights)) {
            if (blocked(pos, c, cover)) h.cool = 0.25; // (behind a moon: it looks again in a moment)
            else {
              h.cool = between(rand, type.fire[0], type.fire[1]) * (h.skill?.fire ?? 1);
              fire(h, c, cVel, onPrey);
              if (has('bomber') && h.mode === 'run') h.bombed = true; // (its bomb's away: it breaks off)
            }
          }
        }
      }

      // lasers: on their way, into what's solid, and into you (a laser
      // covers more ground in a frame than you are wide, and you've moved
      // too, so it's the stretch each crossed that counts)
      for (const m of lasers) {
        if (!m.on) continue;
        m.life -= dt;
        if (m.life <= 0) {
          m.on = false;
          continue;
        }
        aim.x = m.x;
        aim.y = m.y;
        aim.z = m.z;
        // a missile comes round after you, while it can still see you
        if (m.seek && ship && m.at === 'you') {
          const sp = Math.sqrt(m.vx * m.vx + m.vy * m.vy + m.vz * m.vz) || 1;
          mDir[0] = m.vx / sp;
          mDir[1] = m.vy / sp;
          mDir[2] = m.vz / sp;
          const tx = you.x - m.x;
          const ty = you.y - m.y;
          const tz = you.z - m.z;
          const tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
          mTo[0] = tx / tl;
          mTo[1] = ty / tl;
          mTo[2] = tz / tl;
          if (mDir[0] * mTo[0] + mDir[1] * mTo[1] + mDir[2] * mTo[2] > MISSILE.sees) {
            turnToward(mDir, mTo, m.seek * dt);
            m.vx = mDir[0] * sp;
            m.vy = mDir[1] * sp;
            m.vz = mDir[2] * sp;
          }
        }
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.z += m.vz * dt;
        if (blocked(aim, m, cover)) {
          m.on = false;
          continue;
        }
        // (a ghost isn't there to hit: the laser flies on past)
        if (ship && !ship.ghost && m.at === 'you' && sweptHit(aim, m, youPrev, you, m.r ?? SHIP_R) !== null) {
          m.on = false;
          const e = { type: 'laser', damage: m.damage ?? LASER.damage, from: { x: m.x, y: m.y, z: m.z }, bomb: m.bomb, by: m.by };
          if (m.missile) e.missile = true;
          if (m.ion) e.ion = true;
          events.push(e);
        }
      }
      return events;
    },

    // a shot of yours from `from` to `to` this frame, worth `damage` hits (a
    // fusion cannon's is worth more): the hunter it hit, if any: { id, kind,
    // at, size, down, hunter } (down: it's destroyed; otherwise it took the
    // hit, breaks off and comes round again). Both moved this frame, so it's
    // the whole way each went that counts, the nearest along the bolt first
    hit(from, to, damage = 1) {
      let h = null;
      let first = Infinity;
      for (const o of live) {
        if (!o.alive || o.pack.gone || o.hidden > 0) continue;
        const k = sweptHit(from, to, o.prev, o.pos, hitRadius(o.type));
        if (k !== null && k < first) {
          first = k;
          h = o;
        }
      }
      if (!h) return null;
      h.pack.angry = true; // pirates turn on you once you shoot at them
      return wound(h, damage);
    },

    // a hit on one of them by its number (another pilot's shot, told to you:
    // online/client.js has checked it could be): the same answer as hit's
    damage(id, n = 1) {
      const h = live.find((o) => o.id === id);
      if (!h || !h.alive || h.pack.gone || h.hidden > 0) return null;
      return wound(h, n);
    },

    // whether one of a faction's (any of `factions`) still in the fight
    // sees you now (its senses: a planet between you hides you), within
    // `range` (the law's eyes, wanted.js)
    sees(factions, range = Infinity) {
      for (const h of live) {
        if (!h.alive || h.pack.gone || !h.seesYou || !factions.includes(h.pack.faction)) continue;
        if ((h.pos.x - you.x) ** 2 + (h.pos.y - you.y) ** 2 + (h.pos.z - you.z) ** 2 <= range * range) return true;
      }
      return false;
    },
    // how many of a faction's are still after you
    strength(faction) {
      let n = 0;
      for (const h of live) if (h.alive && !h.pack.gone && h.pack.faction === faction) n += 1;
      return n;
    },

    // the RV's magnet: every one still in the fight within `r` of `at` is
    // held `secs`, dragged toward the magnet (the `magnet` on the ship update
    // is handed, else `at`) at up to `speed`, its guns jammed and no threat;
    // let go, it's dazed `daze` seconds more before it fires again. Returns
    // how many it caught
    pull(at, r, speed, secs, daze = 1) {
      let n = 0;
      for (const h of live) {
        if (!h.alive || h.pack.gone || h.hidden > 0) continue;
        const dx = h.pos.x - at.x;
        const dy = h.pos.y - at.y;
        const dz = h.pos.z - at.z;
        if (dx * dx + dy * dy + dz * dz > r * r) continue;
        release(h);
        h.mode = 'set';
        h.clock = 0;
        h.held = secs;
        h.daze = 0;
        h.dazeFor = daze;
        h.pullSpeed = speed;
        h.heldAt = { x: at.x, y: at.y, z: at.z };
        n += 1;
      }
      return n;
    },

    // Han's corkscrew: every one on a run at you or on your tail breaks off
    // (it overshoots) to swing round again, holding its fire as it goes.
    // Returns how many
    breakOff() {
      let n = 0;
      for (const h of live) {
        if (!h.alive || h.pack.gone || h.mode === 'set') continue;
        release(h);
        h.side = -h.side;
        restation(h, yourNose);
        h.cool = Math.max(h.cool, 0.6);
        n += 1;
      }
      return n;
    },

    // a portal's mouth: the lasers within `r` of `at` go into it. Returns how many
    swallow(at, r) {
      let n = 0;
      for (const m of lasers) {
        if (!m.on) continue;
        const dx = m.x - at.x;
        const dy = m.y - at.y;
        const dz = m.z - at.z;
        if (dx * dx + dy * dy + dz * dz > r * r) continue;
        m.on = false;
        n += 1;
      }
      return n;
    },

    // every pack gives up and flies off (what they were after is gone), each
    // one removed once it's well away from `ship` as update is given it
    // (`faction`, given: only its packs: the law giving up on you, wanted.js)
    leave(faction = null) {
      for (const p of packs) {
        if (p.gone || (faction && p.faction !== faction)) continue;
        p.gone = true;
        p.fade = 0;
        for (const h of p.members) release(h);
      }
    },

    // everyone gone at once (you were shot down, or changed ship)
    clear() {
      for (const h of live) h.alive = false;
      live.length = 0;
      packs.length = 0;
      for (const m of lasers) m.on = false;
    },

    get count() {
      return live.length;
    },
    // what the guns can lock on to: everyone still in the fight (not the
    // ones flying off), where they are and the way they're going (the same
    // objects frame to frame, kept up to date, and one list); threat is 1
    // for one on a run at you, or on your tail
    get targets() {
      targets.length = 0;
      for (const h of live) {
        if (!h.alive || h.pack.gone || h.hidden > 0) continue;
        h.target.prey = Boolean(h.pack.prey && !h.pack.angry); // (after someone else, not you)
        h.target.held = h.held > 0;
        h.target.threat = h.mode !== 'set' && !h.target.prey && !h.target.held ? 1 : 0;
        targets.push(h.target);
      }
      return targets;
    },
    // a pack still after you (not leaving)
    get active() {
      return packs.some((p) => !p.gone && (!p.prey || p.angry) && p.members.some((h) => h.alive));
    },
    // for checking from a browser
    get packs() {
      return packs.map((p) => ({ faction: p.faction, skill: p.skill, gone: Boolean(p.gone), prey: Boolean(p.prey), attacking: p.tokens.count('run'), nerve: p.nerve, alive: p.members.filter((h) => h.alive).map((h) => h.kind), modes: p.members.filter((h) => h.alive).map((h) => h.mode), roles: p.members.filter((h) => h.alive).map((h) => h.role), sees: p.members.filter((h) => h.alive).map((h) => h.seesYou), held: p.members.filter((h) => h.alive).map((h) => h.held > 0) }));
    },
    // the ones still in the fight, for the other pilots to see (and help
    // with): [id, kind, x, y, z, vx, vy, vz, hits left] each (protocol.js's
    // writePack rounds them)
    wire() {
      const out = [];
      for (const h of live) if (h.alive && !h.pack.gone && !(h.hidden > 0)) out.push([h.id, h.kind, h.pos.x, h.pos.y, h.pos.z, h.vel.x, h.vel.y, h.vel.z, h.hp]);
      return out;
    },
  };
}
