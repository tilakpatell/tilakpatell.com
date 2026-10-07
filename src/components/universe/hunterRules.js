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
// createHunt({ rand, factions, kinds, solids, lasers, nerve, trace }) → { pack(faction, ship, opts) → hunters,
//   update(dt, ship, { due, done, t }) → events, hit(from, to, damage) → hit or null,
//   damage(id, n) → hit or null, clear(), live, lasers, targets, count,
//   active, packs, wire() }
// A hunter is { id, kind, type, pack, pos, vel, prev, hp, mode, bank, grow,
// alive, view (the drawing's to use) }; pos, vel and prev are { x, y, z }.
// On a schedule (hunters.js's), `due` names the hunters that sense and
// choose this frame (null: all of them); one not due flies on its last
// choice (`steer`) and still keeps clear, fires and leaves, and when it's
// next due it's given the time it missed. Each choice is noted in `trace`
// (lib/ai/trace) under its id: { mode, action (its role), belief }.
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
// (size: its biggest dimension in map units; speed: its top speed (a TIE, a
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
export const TRAITS = ['bomber', 'holdoff', 'quietUntilFired', 'flicker', 'spotlight'];
export const HOLDOFF = { near: 8.75, reach: 1.4 }; // map units it keeps off; of FIGHT.range it fires from
export const FLICKER = 2;
// the most time one step of sensing or choosing stands for, in seconds,
// unless the schedule's step for it is longer (a quarter-rate one's 0.4 s):
// one paused a while comes back with this much, not the whole pause
const CATCH_UP = 0.25;
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

// How many of a pack of `n` may be on an attack run at once
export const slotsFor = (n) => (n >= 5 ? 3 : Math.min(n, 2));
// What a hunter perceives: all round (sensors), a long way, sure of you in
// half a second, hearing a shot from further; the truth kept a couple of
// seconds after a planet hides you, then a guess that fades over a while
export const HUNTER_SENSES = createSenses({ sight: { range: 400, cone: -1, far: 0.5 }, hearing: { range: 300 }, memory: 8, intuition: 2.5 });
// Its nerve: a pack of at least NERVE.pack that's lost most of itself (the
// ratio of what's left of it to what it's lost and what you're worth:
// lib/ai/squad's confidence, binned) breaks off together
export const NERVE = { pack: 3, you: 0.4, every: 1 };
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
export function packPlan(f, { size, ace, heat = 0, first = false, rand = Math.random } = {}) {
  const [lo, hi] = f.size;
  const hot = clamp(heat, 0, 5) / 5;
  const n = size ?? (first ? lo : Math.round(lo + (hi - lo) * clamp(rand() * 0.7 + hot * 0.6, 0, 1)));
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
// you; or one after another out of a hangar (`from`: { x, y, z }). Never
// inside anything solid.
export function entryPoint(ship, i, n, { portal = false, from = null, ahead = false, lead = 0, rand = Math.random, solids = [] } = {}) {
  const fx = -Math.sin(ship.heading);
  const fz = -Math.cos(ship.heading);
  let p;
  if (from) p = { x: from.x + (rand() - 0.5) * 3, y: from.y - i * 0.6, z: from.z + (rand() - 0.5) * 3 };
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

// which of a frame's lanes are due for one (all of them, with no schedule)
const ALL = { sense: true, think: true };
export function dueOf(due, id) {
  if (!due) return ALL;
  if (due instanceof Map) {
    const e = due.get(id);
    return e === undefined ? null : e && typeof e === 'object' ? e : ALL;
  }
  return due.has(id) ? ALL : null;
}

// (`factions` and `kinds` are these, unless another map brings its own: the
// galaxy's Separatists and the Imperial remnant, galaxy/hunted.js)
// (`nerve: false` for a hunt whose quarry isn't you: a skirmish's, fought to the end)
export function createHunt({ rand = Math.random, factions = FACTIONS, kinds: KINDS = HUNTER_KINDS, solids = [], lasers: laserCount = 28, firstId = 1, nerve = true, trace = null } = {}) {
  const allSolids = typeof solids === 'function' ? solids : () => solids;
  const live = []; // hunters in flight
  const packs = []; // { faction, members, lost, said, … }
  let nextId = firstId; // each hunter's own number, for the lock to follow (another hunt, a skirmish's, numbers its own from elsewhere)
  const lasers = Array.from({ length: laserCount }, () => ({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, at: null, faction: null, bomb: false, r: null, damage: null, by: null }));
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

  // a new station for one swinging out: off along the way the target's
  // pointing now (`look`), to the hunter's side, a little above or below
  const restation = (h, look, role = 'wait') => {
    h.mode = 'set';
    h.clock = 0;
    h.role = role;
    // (one that holds off takes its station further out: its run is all
    // range; a flanker's is behind you, to the side; a blocker's well ahead)
    const out = role === 'flank' ? -(8 + rand() * 6) : role === 'block' ? FIGHT.closeFrom : (10 + rand() * 6) * (h.type.trait === 'holdoff' ? 1.7 : 1);
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
    trace?.clear(h.id); // (its ring with it, or the trace grows with every pack)
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
      if (h.type.trait === 'flicker') h.hidden = FLICKER;
      // now and then it breaks off the run it was on, the other way (the
      // rest of the time it takes the hit and comes on)
      if (h.mode !== 'set' && rand() < FIGHT.flinch) {
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

  const fire = (h, target, targetVel, toPrey) => {
    const { pos, vel, type } = h;
    const bomb = type.trait === 'bomber';
    const speed = bomb ? BOMB.speed : LASER.speed + Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z) * 0.5;
    // where a laser fired now would meet it, most of the way allowed for
    const meet = intercept(pos, speed, target, targetVel);
    const t = (meet ? meet.t : 0) * (type.lead ?? FIGHT.lead);
    let ax = target.x + targetVel[0] * t - pos.x;
    let ay = target.y + targetVel[1] * t - pos.y;
    let az = target.z + targetVel[2] * t - pos.z;
    let l = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
    // and not quite true
    const wide = FIGHT.spread * (type.spread ?? 1) * (h.mode === 'tail' ? FIGHT.tailSpread : 1) * 2;
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
    m.life = bomb ? BOMB.life : LASER.life;
    m.at = toPrey ? 'prey' : 'you';
    m.faction = h.pack.faction;
    m.bomb = bomb;
    m.r = bomb ? BOMB.burst : null;
    m.damage = bomb ? BOMB.damage : null;
    m.by = h.id;
    if (!toPrey) events.push({ type: 'shot', faction: h.pack.faction });
  };

  return {
    live,
    lasers,

    // a pack of hunters after you (or after `prey`: { at: { x, y, z }, dir(out),
    // alive() }, something else, e.g. a freighter in distress). Returns the
    // hunters (each one's `pos` is where it came in).
    pack(faction, ship, { prey = null, size, ace, from = null, ahead = false, lead = 0, interdict = false, heat = 0, first = false } = {}) {
      const f = factions[faction];
      if (!f || !ship) return [];
      const kinds = packPlan(f, { size, ace, heat, first, rand });
      const n = kinds.length;
      const pack = { faction, members: [], lost: 0, fade: 0, prey, wasPrey: Boolean(prey), kinds, interdict, attacking: 0, slots: slotsFor(n), tokens: createTokens({ pools: { run: slotsFor(n), tail: 1 }, timeout: 30 }), n0: n, nerve: 'neutral', nerveAt: 0, gone: false, angry: false, said: false, provoked: false };
      const around = allSolids();
      const fx = -Math.sin(ship.heading);
      const fz = -Math.cos(ship.heading);
      kinds.forEach((kind, i) => {
        const type = KINDS[kind];
        const pos = entryPoint(ship, i, n, { portal: f.portal && !from && !ahead, from, ahead, lead, rand, solids: around });
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
          cool: between(rand, 1.2, 2.4), // a moment before the first shot
          bank: 0,
          hidden: 0, // seconds it's gone from sight (a flicker, hit)
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
          steer: null, // the velocity it last chose (flown on between its choices)
          steerSpeed: 0,
          unsensed: 0, // seconds since it last sensed, and chose
          unthought: 0,
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
    // due: the hunters that sense and choose this frame (a Set of ids, or a
    // Map of id → { sense, think }: the schedule's), or null for all of
    // them; done(h) is told after each due one's frame; t, the world's time, for the trace
    update(dt, ship, { due = null, done = null, t = null } = {}) {
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

      // one hunter's frame: it senses and chooses its way if it's due, and
      // flies, keeps clear and fires every frame
      const flyOne = (h, entry) => {
        const { type, pos, vel, pack } = h;
        const trait = type.trait;
        if (h.hidden > 0) h.hidden = Math.max(0, h.hidden - dt);
        h.prev.x = pos.x;
        h.prev.y = pos.y;
        h.prev.z = pos.z;
        const gone = pack.gone;
        const onPrey = !gone && pack.prey && !pack.angry;
        // what it knows of you this frame: the truth while it sees you (or
        // for a moment after), its guess while it doesn't
        // (on a schedule, only when it's due, with all the time since it last did)
        // (no more than the schedule's step for it, or CATCH_UP if that's
        // less: one paused a while comes back with a step's worth, not one
        // glimpse that makes it certain, nor a mode clock that jumps past
        // every timer)
        h.unsensed += dt;
        h.unthought += dt;
        const most = Math.max(CATCH_UP, entry?.dt ?? 0);
        if (ship && entry?.sense) {
          sense(HUNTER_SENSES, h.me, { targets: [{ id: 'you', at: you, vel: yourVelObj, hostile: true }] }, Math.min(most, h.unsensed), { seesThrough: (a, b) => !blocked(a, b, cover) });
          h.unsensed = 0;
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
        // a hunter not due to think flies on the way it last chose (kept
        // off the others and round what's solid every frame, below)
        const thinks = Boolean(entry?.think) || !h.steer;
        const tdt = Math.min(most, h.unthought);
        if (thinks) h.unthought = 0;
        if (!thinks) {
          want[0] = h.steer[0];
          want[1] = h.steer[1];
          want[2] = h.steer[2];
          speed = h.steerSpeed;
        } else if (c) {
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
          h.clock += tdt;
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
            if (d < FIGHT.station || h.clock > FIGHT.setFor) {
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
                const role = onPrey ? 'wait' : (pick(ROLES, { yourSpeed, behind, alive, holdoff: trait === 'holdoff' }, { current: h.role, momentum: 0.2, rand, spread: 0.2 })?.id ?? 'wait');
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
            if (trait === 'bomber') speed = fightPace * BOMB.slow;
            if (trait === 'spotlight' && !h.lit && !onPrey && gap < FIGHT.range * 0.6) {
              h.lit = true;
              events.push({ type: 'spotlit', faction: pack.faction, id: h.id });
            }
            // (one that holds off breaks away before it's close, allowing for
            // how far it goes in the half-second it takes to turn)
            const held = trait === 'holdoff' && onNose > 0 && gap < HOLDOFF.near + s0 * 0.5;
            // past it (or round it, close in, and not coming onto it: it
            // would only circle), or about to hit it, or it's taken too
            // long: away again
            if (held || h.bombed || gap < FIGHT.pass || (gap < FIGHT.past && h.closed && onNose < (h.clock > 1 ? 0.3 : 0)) || h.clock > FIGHT.runFor) {
              h.bombed = false;
              if (!held && trait !== 'bomber' && !onPrey && h.closed && type.tail && yourSpeed > FIGHT.tailAbove && gap < FIGHT.past && rand() < type.tail && pack.tokens.claim('tail', h.id)) {
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
          const keep = HOLDOFF.near * 1.6;
          if (trait === 'holdoff' && gap < keep && gap > 1e-4) {
            const p = (speed * 3 * (1 - gap / keep)) / gap;
            want[0] -= tx * p;
            want[1] -= ty * p;
            want[2] -= tz * p;
          }
        } else {
          // leaving: on the way it's going, faster, climbing away
          speed = type.speed * 1.2;
          want[0] = dir[0] * speed;
          want[1] = (dir[1] + 0.16) * speed;
          want[2] = dir[2] * speed;
        }
        if (thinks) {
          h.steer ??= [0, 0, 0];
          h.steer[0] = want[0];
          h.steer[1] = want[1];
          h.steer[2] = want[2];
          h.steerSpeed = speed;
          trace?.note(h.id, t ?? h.me.now, { mode: h.mode, action: h.role, belief: h.belief ? { at: { x: h.belief.at.x, y: h.belief.at.y, z: h.belief.at.z }, confidence: h.belief.confidence, visible: Boolean(h.belief.visible) } : null });
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
        // never on top of another of them, whatever it wanted
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
          pos.y += d > 1e-4 ? ry * k : (h.id > o.id ? r : -r);
          pos.z += rz * k;
        }
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
          return;
        }
        // firing: on a run (or on your tail, or at their prey), with the
        // target in its sights, in range and nothing solid in the way
        h.cool -= dt;
        const quiet = (trait === 'quietUntilFired' && !pack.provoked) || h.hidden > 0;
        if (c && h.cool <= 0 && !quiet && (onPrey || h.mode !== 'set')) {
          // (from where it is now, having moved: the same at any frame rate)
          const ax = c.x - pos.x;
          const ay = c.y - pos.y;
          const az = c.z - pos.z;
          const reach = Math.sqrt(ax * ax + ay * ay + az * az);
          if (reach < FIGHT.range * (trait === 'holdoff' ? HOLDOFF.reach : 1) && reach > FIGHT.near && (dir[0] * ax + dir[1] * ay + dir[2] * az) / reach > FIGHT.sights) {
            if (blocked(pos, c, cover)) h.cool = 0.25; // (behind a moon: it looks again in a moment)
            else {
              h.cool = between(rand, type.fire[0], type.fire[1]);
              fire(h, c, cVel, onPrey);
              if (trait === 'bomber' && h.mode === 'run') h.bombed = true; // (its bomb's away: it breaks off)
            }
          }
        }
      };
      for (let i = live.length - 1; i >= 0; i--) {
        const h = live[i];
        const entry = dueOf(due, h.id);
        flyOne(h, entry);
        if (entry && done) done(h);
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
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.z += m.vz * dt;
        if (blocked(aim, m, cover)) {
          m.on = false;
          continue;
        }
        if (ship && m.at === 'you' && sweptHit(aim, m, youPrev, you, m.r ?? SHIP_R) !== null) {
          m.on = false;
          events.push({ type: 'laser', damage: m.damage ?? LASER.damage, from: { x: m.x, y: m.y, z: m.z }, bomb: m.bomb, by: m.by });
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

    // every pack gives up and flies off (what they were after is gone), each
    // one removed once it's well away from `ship` as update is given it
    leave() {
      for (const p of packs) {
        if (p.gone) continue;
        p.gone = true;
        p.fade = 0;
        for (const h of p.members) release(h);
      }
    },

    // everyone gone at once (you were shot down, or changed ship)
    clear() {
      for (const h of live) {
        h.alive = false;
        trace?.clear(h.id);
      }
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
        h.target.threat = h.mode !== 'set' && !h.target.prey ? 1 : 0;
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
      return packs.map((p) => ({ faction: p.faction, gone: Boolean(p.gone), prey: Boolean(p.prey), attacking: p.tokens.count('run'), nerve: p.nerve, alive: p.members.filter((h) => h.alive).map((h) => h.kind), modes: p.members.filter((h) => h.alive).map((h) => h.mode), roles: p.members.filter((h) => h.alive).map((h) => h.role), sees: p.members.filter((h) => h.alive).map((h) => h.seesYou) }));
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
