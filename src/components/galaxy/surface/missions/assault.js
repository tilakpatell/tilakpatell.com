// A galactic assault, as plain numbers (missions/index.js has the maps:
// Hoth's and Geonosis's): two armies on a world, the command posts between
// them, and you one soldier among them. The attackers come for the posts
// of the phase; hold a post with more soldiers than the enemy and its
// meter moves your way, to neutral and then to yours; take every post of
// the phase and the next begins, until the last falls. A soldier down
// comes back at a post of theirs after a while, for a ticket; a side with
// no tickets and nobody standing has lost. Pure and seeded, so it's
// tested; the drawing is assaultScene.js and the surface scene runs it.
//
// Under fire a soldier is suppressed (`suppress`, 0…1, up with every bolt
// that comes its way and fading): kept down, it shoots worse and moves at
// a crouch, and it looks for cover, the far side of the nearest rock,
// crate or wall from whoever's shooting (the world's solids, `env.solids`),
// and holds there a while, where a bolt is less likely to find it. A
// side's reinforcements come back together in waves, the attackers' on a
// staging line short of their objective (forwardOf).
//
// Design: docs/superpowers/specs/2026-10-06-galactic-assault-design.md
//
// The armies fight by squads (lib/ai/squad, the NPC intelligence design):
// each side's soldiers up are grouped by reach every TACTICS.every seconds;
// a squad's confidence (what's left of it against what's facing it, its
// side's recent losses counted) sets its posture: holding, a defending
// squad keeps behind its frontline (TACTICS.buffer short of the nearest
// enemy, so the two armies don't melt into one melee and you can read
// who's where; the attackers' job is to go in, and they do);
// worried, it falls back in halves (the half nearest the enemy goes
// TACTICS.back metres rearward, a defender's to the rear of the post it
// holds, while the rest hold and cover, then the other half); confident,
// it presses, and the soldiers at its lane ends
// go round the enemy's flank. The post each soldier wants stays the
// objective under it (pickPost). The shots at you are tokens
// (RULES.atYouMax at once, each held a shot's time, so they take turns).
// Events: { type: 'posture', side, squad, posture } when a squad's changes.
//
// And in the galaxy's war (gcw.js): the result's `posts` are the posts each
// side took while you were up (once each), which pages/GalaxySurface.jsx
// counts for your side; sideFor(mission, side) is the war's side on this map
// ('attack', 'defend' or null) and warSideOf(mission, k) the other way.
//
// And for the soldiers' bodies (assaultScene.js draws them): soldierBody(b,
// s) reads what a soldier's doing as a brain's step for lib/ai/body's
// bodyFrom (its mode: down, cover, pinned, retreat, covering, flank, fight
// or advance; and what it aims at), BATTLE_BODY says what each mode looks
// like, a `down` event says where the killing shot came `from` ([x, z]) and
// a soldier's shot at another names its `target`. They read the battle and
// never change it.
//
// And your Battle Points (`b.you.points`, kept through your deaths; what a
// deed earns and the spawn screen's prices are ./points.js's), spent by
// deploy(b, post, offer) on whoever the offer is (`b.you.as`, null while down).

import { pushOut, turnToward } from '../walker';
import { canAfford, earnFor, onObjective, whole } from './points';
import { rng } from '../noise';
import { starsFor } from './chase';
import { advance, confidence, createSquads, createTokens, flankers, frontline, posture, withdraw } from '../../../../lib/ai/squad';
import { MODE_BODY } from '../../../../lib/ai/body';

export const RULES = {
  capture: 0.08, // a post's meter, a second, for each soldier of advantage
  advantage: 4, // soldiers of advantage that count, at most
  respawn: 5, // seconds down before a soldier may come back
  wave: 6, // seconds between the attackers' waves: the soldiers down long enough come back together, as a squad
  waveDefend: 6, // and the defenders'
  heal: 2, // hp a second a soldier gets back out of the fight (nothing shooting at it, nobody in range): a hurt squad gets its nerve back
  range: 48, // metres: a soldier fires at an enemy this near
  every: 1.1, // seconds between a soldier's shots (give or take)
  accuracy: [0.55, 0.15], // a shot's chance to hit another soldier, point blank and at the edge of range
  damage: 26, // of a soldier's hp, a hit between soldiers
  yours: 34, // of a soldier's hp, a hit of yours
  atYou: 7, // of your health, a bolt of theirs that passes through you
  hp: 100,
  walk: 3, // m/s
  engaged: 0.65, // of the walk, while firing
  turn: 4, // rad/s
  step: 0.1, // the longest step the rules take at once
  atYouMax: 3, // enemies firing at you at once, at most
  spacing: 1.4, // metres between soldiers
  retarget: 2, // seconds between a soldier's looks at where it should be
  suppress: 0.35, // what a bolt coming its way adds to a soldier's suppression (0…1)
  suppressFade: 0.25, // a second, off again
  suppressed: 0.45, // over this a soldier keeps its head down: half as accurate, at a crouch
  crouch: 0.55, // of the walk, keeping its head down
  coverRange: 16, // metres: how far a soldier under fire looks for cover
  coverHold: 10, // seconds it stays behind it before looking about again
  coverHit: 0.5, // of a hit's chance, on a soldier in cover
  dugIn: 0.65, // and on a defender standing its ground inside a post its side holds (walls, sandbags, the lie of the land: a post is held, not stood on)
  forward: 100, // metres short of their objective the attackers' reinforcements come onto the field (a staging line, just out of range)
  firstWave: 1.5, // and their first wave this many times as far back: the battle opens with their advance
};
// soldiers a side, by the device's tier (lib/device)
export const SOLDIERS = { high: 14, mid: 9, low: 6 };
export const TACTICS = {
  every: 1.5, // seconds between a side's squads being read
  reach: 24, // metres: soldiers within this of one another are a squad
  buffer: 4, // metres a holding squad keeps short of the nearest enemy
  back: 14, // metres a falling-back half goes
  recent: 25, // seconds a loss counts against a side's nerve
  you: 2.5, // what you're worth to the other side's nerve, in soldiers
};

const other = (side) => (side === 'attack' ? 'defend' : 'attack');
const byId = (b, id) => b.soldiers.find((s) => s.id === id);
// its head kept down by the fire coming its way, or hurt: it shoots worse,
// moves at a crouch and looks for cover
const keptDown = (s) => s.suppress > RULES.suppressed || s.hp < RULES.hp * 0.4;
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const inPost = (p, x, z) => dist(p.at[0], p.at[1], x, z) <= p.r;
const livePosts = (b) => b.mission.phases[b.phaseIndex].posts.map((id) => b.posts.find((p) => p.id === id));
const isLive = (b, id) => b.mission.phases[b.phaseIndex].posts.includes(id);
const nearest = (list, x, z) => {
  let best = null;
  let bestD = Infinity;
  for (const p of list) {
    const d = dist(p.at[0], p.at[1], x, z);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
};
// one of a side's kinds, by weight ([[kind, weight], …])
const pickKind = (kinds, r) => {
  const total = kinds.reduce((n, [, w]) => n + w, 0);
  let k = r() * total;
  for (const [kind, w] of kinds) if ((k -= w) < 0) return kind;
  return kinds[kinds.length - 1][0];
};

// A battle laid out: the posts the defenders' (the fixed ones each side's
// own), the soldiers made but not yet on the field, at the choose card.
export function newBattle(mission, { n = SOLDIERS.high, seed = 1 } = {}) {
  const r = rng(seed);
  const kr = rng(7); // (the kinds the same whatever the seed, so a battle again wears the same figures)
  const posts = mission.posts.map((p) => ({ id: p.id, name: p.name, at: p.at, r: p.r, fixed: p.fixed ?? null, owner: p.fixed ?? 'defend', meter: 1, taking: null, inside: { attack: 0, defend: 0 }, youIn: false }));
  const soldiers = [];
  for (const side of ['attack', 'defend'])
    for (let i = 0; i < n; i++) soldiers.push({ id: soldiers.length, side, kind: pickKind(mission.sides[side].kinds, kr), x: 0, z: 0, yaw: 0, hp: RULES.hp, up: false, down: 0, post: null, spot: null, cool: 1 + r() * 2, wait: 0, target: null, move: 0, detour: 0, suppress: 0, cover: null, coverAt: -99, inCover: false, dug: false });
  return { mission, r, t: 0, phase: 'choose', phaseIndex: 0, result: null, posts, soldiers, tickets: { ...mission.tickets }, waveAt: { attack: 0, defend: 0 }, you: { side: null, up: false, x: 0, z: 0, kills: 0, captures: 0, deaths: 0, in: null, state: null, points: 0, as: null }, feed: [], squads: { attack: createSquads({ reach: TACTICS.reach }), defend: createSquads({ reach: TACTICS.reach }) }, tactics: { attack: {}, defend: {} }, losses: { attack: [], defend: [] }, tacticsAt: 0, tokens: createTokens({ pools: { shot: RULES.atYouMax }, timeout: RULES.every }), taken: { attack: new Set(), defend: new Set() } };
}

const feed = (b, kind, text) => {
  b.feed.push({ t: b.t, kind, text });
  if (b.feed.length > 5) b.feed.shift();
};
const sideName = (b, side) => b.mission.sides[side].short;

// where a soldier of a side comes onto the field: the attackers at their
// post nearest the front (the live posts they don't hold), the defenders
// at a live post of theirs that isn't being fought over, or each side's
// fixed post failing those
function spawnPost(b, side) {
  const own = b.posts.filter((p) => p.owner === side);
  if (side === 'attack') {
    const front = livePosts(b).filter((p) => p.owner !== 'attack');
    if (!front.length) return own.find((p) => p.fixed === side) ?? own[0];
    let best = own[0];
    let bestD = Infinity;
    for (const p of own) {
      const d = Math.min(...front.map((f) => dist(p.at[0], p.at[1], f.at[0], f.at[1])));
      if (d < bestD) {
        best = p;
        bestD = d;
      }
    }
    return best;
  }
  const quiet = livePosts(b).filter((p) => p.owner === 'defend' && p.inside.attack === 0);
  if (quiet.length) return quiet[Math.floor(b.r() * quiet.length)];
  return own.find((p) => p.fixed === side) ?? own[0];
}
// Where an attacker comes back onto the field: not at its post, which may
// be a long walk from the fight, but on a staging line RULES.forward metres
// short of its objective along the way there from the post (never past the
// post itself, and spread a little along the line). The defenders come back
// inside their posts. Pure.
export function forwardOf(b, p, objective, r = b.r, times = 1) {
  if (!objective) return spotIn(b, p);
  const dx = objective[0] - p.at[0];
  const dz = objective[1] - p.at[1];
  const d = Math.hypot(dx, dz);
  // (a map may set its own staging distance: Endor's is shorter, its posts far apart through the trees)
  const along = Math.max(0, d - (b.mission.forward ?? RULES.forward) * times);
  if (along <= p.r) return spotIn(b, p);
  const k = along / d;
  // (a few metres across the line, so a wave doesn't come back in a stack)
  const across = (r() - 0.5) * 16;
  return [p.at[0] + dx * k - (dz / d) * across, p.at[1] + dz * k + (dx / d) * across];
}

// a spot inside a post, well in from its edge: anywhere in it, or (given
// where the soldier comes from) on the near side of it, so a side arrives
// on its own side of a post rather than walking through it
const spotIn = (b, p, k = 0.7, from = null) => {
  let a = b.r() * Math.PI * 2;
  if (from) a = Math.atan2(from[1] - p.at[1], from[0] - p.at[0]) + (b.r() - 0.5) * 1.4;
  const d = (from ? 0.45 + 0.55 * Math.sqrt(b.r()) : Math.sqrt(b.r())) * p.r * k;
  return [p.at[0] + Math.cos(a) * d, p.at[1] + Math.sin(a) * d];
};
function place(b, s, p, { forward = 0 } = {}) {
  [s.x, s.z] = spotIn(b, p);
  if (forward && s.side === 'attack') [s.x, s.z] = forwardOf(b, p, objectiveFor(b, 'attack', p.at[0], p.at[1]), b.r, forward);
  const o = objectiveFor(b, s.side, s.x, s.z);
  s.yaw = o ? Math.atan2(o[0] - s.x, o[1] - s.z) : 0;
  s.up = true;
  s.hp = RULES.hp;
  s.down = 0;
  s.post = null;
  s.spot = null;
  s.target = null;
  s.cool = 0.8 + b.r() * 1.5;
  s.suppress = 0;
  s.cover = null;
  s.inCover = false;
}

// Where a side is wanted: the attackers at the nearest live post that isn't
// theirs; the defenders at the nearest live post that's lost, going, or
// has attackers in it, else the nearest of theirs.
export function objectiveFor(b, side, x, z) {
  const live = livePosts(b);
  let list;
  if (side === 'attack') list = live.filter((p) => p.owner !== 'attack');
  else {
    list = live.filter((p) => p.owner !== 'defend' || p.inside.attack > 0);
    if (!list.length) list = live;
  }
  const p = nearest(list.length ? list : live, x, z);
  return p ? [p.at[0], p.at[1]] : null;
}

// A side picked: the battle's on, the defenders inside the live posts, the
// attackers on their staging line short of the front (their post may be a
// long walk from it: Scarif's landing, Endor's village), nobody costing a
// ticket.
export function chooseSide(b, side) {
  b.you.side = side;
  b.phase = 'run';
  const live = livePosts(b);
  let i = 0;
  for (const s of b.soldiers) {
    if (s.side === 'defend') place(b, s, live[i++ % live.length]);
    else place(b, s, spawnPost(b, 'attack'), { forward: RULES.firstWave });
  }
}

// a soldier's next post: spread across the side's objectives, each one
// scoring its distance and 25 m a soldier already sent there
function pickPost(b, s) {
  const live = livePosts(b);
  let list = s.side === 'attack' ? live.filter((p) => p.owner !== 'attack') : live;
  if (!list.length) list = live;
  const sent = {};
  for (const o of b.soldiers) if (o !== s && o.up && o.side === s.side && o.post) sent[o.post] = (sent[o.post] ?? 0) + 1;
  let best = null;
  let bestScore = Infinity;
  for (const p of list) {
    let score = dist(p.at[0], p.at[1], s.x, s.z) + 25 * (sent[p.id] ?? 0);
    if (s.side === 'attack' && p.owner === null && p.taking === 'attack') score -= 30;
    if (s.side === 'defend') {
      if (p.owner !== 'defend') score -= 60;
      if (p.inside.attack > 0) score -= 40;
    }
    if (score < bestScore) {
      best = p;
      bestScore = score;
    }
  }
  if (best && best.id !== s.post) {
    s.post = best.id;
    s.spot = spotIn(b, best, 0.75, [s.x, s.z]);
  }
  s.wait = RULES.retarget * (0.8 + 0.4 * b.r());
}

// Cover from a shooter at (tx, tz): the far side of the nearest solid
// within RULES.coverRange of the soldier (a rock, a crate, a wall's end;
// nothing too big to get round, nothing too small to hide behind), a step
// out from it, or null. Pure.
export function coverFrom(solids, s, tx, tz, range = RULES.coverRange) {
  let best = null;
  let bestD = Infinity;
  for (const sol of solids.near(s.x, s.z, range)) {
    if (sol.off) continue;
    const ext = sol.type === 'circle' ? sol.r : Math.max(sol.hw, sol.hd);
    if (ext < 0.35 || ext > 9) continue;
    const dx = sol.x - tx;
    const dz = sol.z - tz;
    const d = Math.hypot(dx, dz) || 1;
    const x = sol.x + (dx / d) * (ext + 0.9);
    const z = sol.z + (dz / d) * (ext + 0.9);
    const dd = dist(s.x, s.z, x, z);
    if (dd > range || dd >= bestD) continue;
    best = [x, z];
    bestD = dd;
  }
  return best;
}

function hurt(b, s, damage, by, out) {
  if (!s.up) return null;
  s.hp -= damage;
  if (s.hp > 0) return null;
  s.up = false;
  s.down = 0;
  s.target = null;
  s.fallback = null;
  s.flankTo = null;
  s.hold = false;
  b.losses[s.side].push(b.t);
  // (where the shot came from, for the way it falls)
  const ev = { type: 'down', id: s.id, by: by === 'you' ? 'you' : by.id, from: by === 'you' ? [b.you.x, b.you.z] : [by.x, by.z] };
  out.push(ev);
  out.push({ type: 'kill', victim: s.id, side: s.side, by: ev.by });
  if (by === 'you') {
    b.you.kills += 1;
    earnFor(b, 'kill');
    feed(b, 'kill', `You brought one of ${sideName(b, s.side) === 'Empire' ? 'the Empire’s' : `the ${sideName(b, s.side)}’s`} down`);
  }
  return ev;
}

// One of your bolts lands on a soldier: down at the last of its hp (the
// `down` event), yours to count.
export function hitSoldier(b, id, damage = RULES.yours, by = 'you') {
  const s = b.soldiers.find((o) => o.id === id);
  if (!s || !s.up) return null;
  return hurt(b, s, damage, by, []);
}

// What a soldier's doing, as a brain's step for its body (lib/ai/body's
// bodyFrom, through BATTLE_BODY): where it is and faces, and its mode:
// down; behind its cover (cover); kept down in the open (pinned); its
// half falling back (retreat) or holding while the other half goes
// (covering); round the enemy's flank (flank); a target in range (fight);
// else on its way (advance). aim: what it's firing at ({ x, z }: a
// soldier, or you), or null; fire: its next shot is a moment off (one in
// cover comes up for it). Reads, never changes.
const RISE_LEAD = 0.3; // seconds before a shot its body's up for it
export function soldierBody(b, s) {
  const t = s.target === 'you' ? b.you : s.target != null ? byId(b, s.target) : null;
  const aim = s.up && t ? { x: t.x, z: t.z } : null;
  const fire = Boolean(aim) && !s.unarmed && s.cool <= RISE_LEAD;
  let mode = 'advance';
  if (!s.up) mode = 'down';
  else if (s.inCover) mode = 'cover';
  else if (keptDown(s)) mode = 'pinned';
  else if (s.fallback) mode = 'retreat';
  else if (s.hold) mode = 'covering';
  else if (s.flankTo) mode = 'flank';
  else if (aim) mode = 'fight';
  return { x: s.x, z: s.z, yaw: s.yaw, mode, aim, fire, hurt: Math.max(0, Math.min(1, 1 - s.hp / RULES.hp)), down: s.up ? 0 : 1 };
}

// What each of soldierBody's modes looks like (lib/ai/body's MODE_BODY,
// with the battle's own): behind its cover it crouches and comes up to
// fire; the half that covers the other's going does it from a knee; and
// whatever it's doing, its head's on what it's firing at, so a half
// falling back looks back at the enemy as it goes.
export const BATTLE_BODY = {
  ...MODE_BODY,
  down: {},
  cover: { base: 'crouch', rise: true, look: 'aim' },
  pinned: { look: 'aim' },
  retreat: { look: 'aim' },
  covering: { base: 'crouch', look: 'aim' },
  flank: { look: 'aim' },
  fight: { look: 'aim' },
  advance: {},
};

// The galaxy's war's side (sides.js) on this map: 'attack', 'defend' or null
// (a map's sides are the assault's own: its Rebels are 'rebels'), and back.
const WAR_ID = { rebel: 'rebels' };
export const sideFor = (mission, side) => (side ? (['attack', 'defend'].find((k) => mission.sides[k].id === (WAR_ID[side] ?? side)) ?? null) : null);
export const warSideOf = (mission, k) => {
  const id = mission.sides[k]?.id;
  return id ? (Object.keys(WAR_ID).find((w) => WAR_ID[w] === id) ?? id) : null;
};

export function endBattle(b, won, why) {
  if (b.result) return;
  b.result = { won, why, t: b.t, stars: won ? starsFor(b.mission, b.t) : 0, kills: b.you.kills, captures: b.you.captures, side: b.you.side, posts: { attack: b.taken.attack.size, defend: b.taken.defend.size } };
  b.phase = 'end';
}

// Each side's soldiers up, grouped into squads by reach; each squad's
// nerve against what's facing it, and its posture from that: told to
// fall back in halves, to press and flank, or to hold behind its line
function tactics(b, youOn, out) {
  for (const side of ['attack', 'defend']) {
    const opp = other(side);
    b.losses[side] = b.losses[side].filter((t) => b.t - t < TACTICS.recent);
    const mine = b.soldiers.filter((s) => s.side === side && s.up).map((s) => ({ id: s.id, at: { x: s.x, y: 0, z: s.z }, side, alive: true, hp: s.hp / RULES.hp, level: 'neutral' }));
    const foes = b.soldiers.filter((s) => s.side === opp && s.up).map((s) => ({ id: s.id, at: { x: s.x, y: 0, z: s.z }, side: opp, alive: true, hp: s.hp / RULES.hp, level: 'neutral' }));
    if (youOn && b.you.side === opp) foes.push({ id: 'you', at: { x: b.you.x, y: 0, z: b.you.z }, side: opp, alive: true, hp: TACTICS.you, level: 'confident' });
    const squads = b.squads[side].update(mine);
    const fresh = {};
    for (const q of squads) {
      // its enemies: the other side within sight of it (twice its reach), or, with none near, nobody to fear
      const near = foes.filter((e) => dist(e.at.x, e.at.z, q.centre.x, q.centre.z) < RULES.range * 1.5);
      const { level } = confidence(q, mine, near, { value: (u) => u.hp, losses: Math.min(b.losses[side].length, mine.length) * 0.5 });
      const was = b.tactics[side][q.id];
      // (a side with no reinforcements left has nothing to keep back for: it
      // presses, so a battle can't stall with its last soldiers in cover)
      const stance = near.length ? (b.tickets[side] <= 0 ? 'press' : posture(level)) : 'hold';
      const front = near.length ? frontline(q, mine, near, { buffer: TACTICS.buffer, minWidth: RULES.spacing * 2 }) : null;
      const tac = { posture: stance, level, front, members: q.members, phase: was?.posture === stance ? (was.phase ?? 0) + 1 : 0 };
      fresh[q.id] = tac;
      for (const id of q.members) {
        const s = byId(b, id);
        s.squad = q.id;
        s.level = level;
      }
      if (was?.posture !== stance) out.push({ type: 'posture', side, squad: q.id, posture: stance });
      // orders, by posture (the halves alternate each reading)
      const members = mine.filter((m) => q.members.includes(m.id));
      if (stance === 'retreat' && front) {
        const { move, cover } = withdraw(q, members, front);
        const goers = tac.phase % 2 === 0 ? move : cover;
        const stayers = tac.phase % 2 === 0 ? cover : move;
        for (const id of goers) {
          const s = byId(b, id);
          s.hold = false;
          // (a defender falls back to the rear of the post it's holding, never off it: the post is the point)
          const p = side === 'defend' && s.post ? b.posts.find((o) => o.id === s.post) : null;
          s.fallback = p ? [p.at[0] - front.dir.x * p.r * 0.7, p.at[1] - front.dir.z * p.r * 0.7] : [s.x - front.dir.x * TACTICS.back, s.z - front.dir.z * TACTICS.back];
          s.flankTo = null;
        }
        for (const id of stayers) {
          const s = byId(b, id);
          s.hold = true;
          s.fallback = null;
        }
      } else if (stance === 'press' && front) {
        const { move, cover } = advance(q, members, front);
        for (const id of [...move, ...cover]) {
          const s = byId(b, id);
          s.hold = false;
          s.fallback = null;
        }
        for (const f of flankers(q, members, front, near)) byId(b, f.id).flankTo = [f.at.x, f.at.z];
      } else {
        for (const id of q.members) {
          const s = byId(b, id);
          s.hold = false;
          s.fallback = null;
          s.flankTo = null;
        }
      }
    }
    b.tactics[side] = fresh;
  }
}

function step(b, h, you, env, out) {
  b.t += h;
  // (you count on the field only while the scene says where you are)
  const youOn = Boolean(you) && b.you.up;
  if (youOn) {
    b.you.x = you.x;
    b.you.z = you.z;
  }
  // ── the posts: who's in each, and the meters ──
  for (const p of b.posts) {
    p.inside.attack = 0;
    p.inside.defend = 0;
    for (const s of b.soldiers) if (s.up && inPost(p, s.x, s.z)) p.inside[s.side] += 1;
    p.youIn = youOn && inPost(p, b.you.x, b.you.z);
    if (p.youIn) p.inside[b.you.side] += 1;
    if (p.fixed || !isLive(b, p.id)) continue;
    if (p.youIn && onObjective(b, p)) earnFor(b, 'objectiveTick', h);
    const A = p.inside.attack;
    const D = p.inside.defend;
    if (p.owner) {
      const opp = other(p.owner);
      const adv = p.inside[opp] - p.inside[p.owner];
      if (adv > 0) {
        p.meter -= RULES.capture * Math.min(adv, RULES.advantage) * h;
        if (p.meter <= 0) {
          p.meter = 0;
          p.owner = null;
          p.taking = opp;
          out.push({ type: 'neutral', post: p.id, by: opp });
          feed(b, 'neutral', `${p.name}: contested`);
        }
      } else if (adv < 0 && p.meter < 1) p.meter = Math.min(1, p.meter + RULES.capture * Math.min(-adv, RULES.advantage) * h);
    } else if (A !== D) {
      const side = A > D ? 'attack' : 'defend';
      if (p.taking !== side) {
        p.taking = side;
        p.meter = 0;
      }
      p.meter += RULES.capture * Math.min(Math.abs(A - D), RULES.advantage) * h;
      if (p.meter >= 1) {
        p.meter = 1;
        p.owner = side;
        p.taking = null;
        const yours = p.youIn && b.you.side === side;
        if (yours) b.you.captures += 1;
        if (yours) earnFor(b, 'capture');
        // (for the galaxy's war: a post its side took while you were up)
        if (youOn) b.taken[side].add(p.id);
        out.push({ type: 'capture', post: p.id, side, you: yours });
        feed(b, 'capture', `${sideName(b, side) === 'Empire' ? 'The Empire' : `The ${sideName(b, side)}`} took ${p.name.replace(/^The /, 'the ')}`);
      }
    }
  }
  // ── the phase: every post of it the attackers', and the next begins ──
  if (livePosts(b).every((p) => p.owner === 'attack')) {
    if (b.phaseIndex >= b.mission.phases.length - 1) {
      out.push({ type: 'end', won: b.you.side === 'attack', why: 'posts' });
      endBattle(b, b.you.side === 'attack', 'posts');
      return;
    }
    b.phaseIndex += 1;
    const ph = b.mission.phases[b.phaseIndex];
    b.tickets.attack = Math.max(b.tickets.attack, ph.tickets ?? 0);
    for (const s of b.soldiers) s.wait = 0;
    out.push({ type: 'phase', phase: b.phaseIndex, name: ph.name });
    feed(b, 'phase', ph.name);
  }
  // ── the squads: who's with whom, their nerve, their posture ──
  b.tacticsAt -= h;
  if (b.tacticsAt <= 0) {
    b.tacticsAt = TACTICS.every;
    tactics(b, youOn, out);
  }
  // ── who may fire at you: the nearest few, each for a shot's time (tokens) ──
  b.tokens.audit(h, (id) => Boolean(byId(b, id)?.up));
  const atYou = [];
  if (youOn)
    for (const s of b.soldiers.filter((s) => s.up && s.side !== b.you.side && (s.turnAt ?? 0) <= b.t && dist(s.x, s.z, b.you.x, b.you.z) <= RULES.range).sort((p, q) => dist(p.x, p.z, b.you.x, b.you.z) - dist(q.x, q.z, b.you.x, b.you.z)))
      if (b.tokens.held('shot', s.id) || b.tokens.claim('shot', s.id)) atYou.push(s);
  // ── the soldiers ──
  // (a side's wave: everyone of it down long enough comes back now, together)
  const wave = { attack: b.t >= b.waveAt.attack, defend: b.t >= b.waveAt.defend };
  for (const s of b.soldiers) {
    if (!s.up) {
      s.down += h;
      if (s.down >= RULES.respawn && wave[s.side] && b.tickets[s.side] > 0) {
        b.tickets[s.side] -= 1;
        place(b, s, spawnPost(b, s.side), { forward: 1 });
        out.push({ type: 'spawn', id: s.id });
      }
      continue;
    }
    // its nerve coming back, and the cover it took no longer wanted
    s.suppress = Math.max(0, s.suppress - RULES.suppressFade * h);
    if (!s.target && s.suppress === 0 && s.hp < RULES.hp) s.hp = Math.min(RULES.hp, s.hp + RULES.heal * h);
    if (s.cover && (b.t - s.coverAt > RULES.coverHold || !s.target)) {
      s.cover = null;
      s.inCover = false;
    }
    // where it's going: its post (or, under its squad's orders, back a way, or round the flank; or, kept down, its cover)
    s.wait -= h;
    if (!s.frozen && (s.wait <= 0 || !s.post || !isLive(b, s.post))) pickPost(b, s);
    if (s.fallback && dist(s.x, s.z, s.fallback[0], s.fallback[1]) < 1.5) s.fallback = null;
    if (s.flankTo && dist(s.x, s.z, s.flankTo[0], s.flankTo[1]) < 1.5) s.flankTo = null;
    // the enemy it fires at: you, if it's one of the few allowed, else the nearest soldier in range
    let target = null;
    if (atYou.includes(s)) target = { you: true, x: b.you.x, z: b.you.z };
    else {
      let bestD = RULES.range;
      for (const o of b.soldiers) {
        if (!o.up || o.side === s.side) continue;
        const d = dist(s.x, s.z, o.x, o.z);
        if (d < bestD) {
          bestD = d;
          target = o;
        }
      }
    }
    s.target = target ? (target.you ? 'you' : target.id) : null;
    // kept down by the fire coming its way (or hurt), it looks for cover
    const down = keptDown(s);
    if (target && down && !s.cover && !s.frozen) {
      const c = coverFrom(env.solids, s, target.x, target.z);
      if (c) {
        s.cover = c;
        s.coverAt = b.t;
      }
    }
    // on toward its goal (its squad's orders first, then its cover, then
    // its spot), turned to its target if it has one (one told to hold and
    // cover stands where it is, firing)
    const goal = s.fallback ?? s.flankTo ?? s.cover ?? s.spot;
    const crouch = down ? RULES.crouch : 1;
    if (!s.frozen && goal) {
      const d = dist(s.x, s.z, goal[0], goal[1]);
      const want = target ? Math.atan2(target.x - s.x, target.z - s.z) : Math.atan2(goal[0] - s.x, goal[1] - s.z);
      s.yaw = turnToward(s.yaw, want, RULES.turn * h);
      let nx = s.x;
      let nz = s.z;
      s.inCover = Boolean(s.cover) && d <= 1.6;
      if (d > 1.2 && !s.hold) {
        const speed = RULES.walk * (target ? RULES.engaged : 1) * crouch * h;
        let ux = (goal[0] - s.x) / d;
        let uz = (goal[1] - s.z) / d;
        // (holding its ground, a defending squad keeps behind its frontline:
        // no step past it toward the enemy; the attackers' job is to go in)
        const f = b.tactics[s.side][s.squad]?.front;
        if (f && s.side === 'defend' && b.tactics[s.side][s.squad].posture === 'hold' && !s.flankTo) {
          const past = (s.x + ux * speed - f.line.x) * f.dir.x + (s.z + uz * speed - f.line.z) * f.dir.z;
          if (past > 0) {
            // along the line instead
            const along = ux * f.right.x + uz * f.right.z;
            ux = f.right.x * along;
            uz = f.right.z * along;
          }
        }
        nx += ux * speed;
        nz += uz * speed;
        s.move = (target ? 0.65 : 1) * crouch;
        // round what's solid: pushed out of it, and while something's in
        // the way, along its face (the way the pushes point, turned a
        // quarter: a side picked once and kept, swapped if it's got nowhere
        // in a while), each solid settled in turn so a seam between two
        // doesn't catch
        let px = 0;
        let pz = 0;
        const settle = () => {
          for (const sol of env.solids.near(nx, nz, 2)) {
            const push = pushOut(sol, nx, nz, 0.45);
            if (!push) continue;
            nx += push[0];
            nz += push[1];
            px += push[0];
            pz += push[1];
          }
        };
        settle();
        const pl = Math.hypot(px, pz);
        if (pl > 1e-6) {
          if (!s.detour) s.detour = b.r() < 0.5 ? 1 : -1;
          s.stuck = (s.stuck ?? 0) + h;
          if (s.stuck > 8) {
            s.detour = -s.detour;
            s.stuck = 0;
          }
          nx += (-pz / pl) * speed * s.detour;
          nz += (px / pl) * speed * s.detour;
          settle();
        } else {
          s.detour = 0;
          s.stuck = 0;
        }
      } else {
        s.move = 0;
        if (!s.cover && b.r() < h / 8) s.spot = spotIn(b, b.posts.find((p) => p.id === s.post), 0.75);
      }
      // dug in: a defender standing its ground inside a post its side holds
      const held = s.side === 'defend' && s.move === 0 && s.post ? b.posts.find((p) => p.id === s.post) : null;
      s.dug = Boolean(held && held.owner === 'defend' && inPost(held, s.x, s.z));
      // not into each other
      for (const o of b.soldiers) {
        if (o === s || !o.up) continue;
        const dd = dist(nx, nz, o.x, o.z);
        if (dd < RULES.spacing && dd > 1e-6) {
          const k = (RULES.spacing - dd) / dd * 0.5;
          nx += (nx - o.x) * k;
          nz += (nz - o.z) * k;
        }
      }
      const rr = Math.hypot(nx, nz);
      if (env.reach && rr > env.reach) {
        nx *= env.reach / rr;
        nz *= env.reach / rr;
      }
      // not out into water too deep to wade (env.deep, where the world has some): along the shore instead, or stood still
      if (env.deep?.(nx, nz) && !env.deep(s.x, s.z)) {
        if (!env.deep(nx, s.z)) nz = s.z;
        else if (!env.deep(s.x, nz)) nx = s.x;
        else {
          nx = s.x;
          nz = s.z;
        }
      }
      s.x = nx;
      s.z = nz;
    }
    // a shot
    s.cool -= h;
    if (target && s.cool <= 0 && !s.unarmed) {
      s.cool = RULES.every * (0.7 + 0.6 * b.r());
      const d = dist(s.x, s.z, target.x, target.z);
      if (target.you) {
        out.push({ type: 'shot', id: s.id, side: s.side, from: [s.x, s.z], to: [target.x, target.z], atYou: true, hit: null });
        // (its turn taken: the token goes back for another to have)
        b.tokens.release('shot', s.id);
        s.turnAt = b.t + RULES.every * 0.6;
      }
      else {
        const [a0, a1] = RULES.accuracy;
        // (worse with its head down; and a target behind cover is harder to find)
        let chance = a0 + (a1 - a0) * Math.min(1, d / RULES.range);
        if (s.suppress > RULES.suppressed) chance *= 0.5;
        if (target.inCover) chance *= RULES.coverHit;
        else if (target.dug) chance *= RULES.dugIn;
        const hit = b.r() < chance;
        target.suppress = Math.min(1, target.suppress + RULES.suppress);
        out.push({ type: 'shot', id: s.id, side: s.side, from: [s.x, s.z], to: [target.x, target.z], atYou: false, hit, target: target.id });
        if (hit) hurt(b, target, RULES.damage, s, out);
      }
    }
  }
  if (wave.attack) b.waveAt.attack = b.t + RULES.wave;
  if (wave.defend) b.waveAt.defend = b.t + RULES.waveDefend;
  // ── a side out of soldiers and tickets has lost ──
  for (const side of ['attack', 'defend']) {
    if (b.tickets[side] > 0) continue;
    if (b.soldiers.some((s) => s.side === side && s.up)) continue;
    if (b.you.side === side && b.you.up) continue;
    const won = b.you.side !== side;
    out.push({ type: 'end', won, why: 'tickets' });
    endBattle(b, won, 'tickets');
    return;
  }
}

// The battle moved on by dt seconds (in steps of RULES.step at most), with
// you at `you` ({ x, z }, or null); returns what happened.
export function stepBattle(b, dt, you = null, env = { solids: { near: () => [] }, reach: 0 }) {
  const out = [];
  if (b.phase !== 'run' || b.result) return out;
  const n = Math.max(1, Math.ceil(dt / RULES.step - 1e-9));
  for (let i = 0; i < n && !b.result; i++) step(b, dt / n, you, env, out);
  return out;
}

// Whether you may come onto the field at a post: your side's, and no enemy in it
export const canDeploy = (b, p) => Boolean(p && b.you.side && (p.fixed === b.you.side || (p.owner === b.you.side && p.inside[other(b.you.side)] === 0)));

// You, onto the field at a post of yours, for a ticket (and as an offer of
// the spawn screen's, points.js's, for its Battle Points): where you stand
// and which way you face (toward your side's objective), or null
export function deploy(b, postId, offer = null) {
  const p = b.posts.find((o) => o.id === postId);
  if (!canDeploy(b, p) || b.tickets[b.you.side] <= 0 || (offer && !canAfford(b.you.points, offer))) return null;
  b.tickets[b.you.side] -= 1;
  b.you.points -= offer?.cost ?? 0;
  const [x, z] = spotIn(b, p, 0.6);
  const o = objectiveFor(b, b.you.side, x, z);
  const yaw = o ? Math.atan2(o[0] - x, o[1] - z) : 0;
  Object.assign(b.you, { up: true, x, z, as: offer?.id ?? null });
  return { x, z, yaw };
}

export function youDown(b) {
  if (!b.you.up) return;
  b.you.up = false;
  b.you.deaths += 1;
  b.you.as = null;
}

// how a post stands for you, when you're in it
function youState(b, p) {
  const me = b.you.side;
  const opp = other(me);
  if (p.owner === me) return p.inside[opp] > 0 ? (p.meter < 1 ? 'losing' : 'contested') : 'holding';
  if (p.owner === null) return p.taking === me ? 'taking' : p.taking ? 'losing' : 'contested';
  return p.inside[me] > p.inside[opp] ? 'taking' : 'contested';
}

// The battle as the HUD draws it. `key` changes when something the page
// draws changes (not with the meters, nor your Battle Points, whole ones,
// which tick by the second: those come through the feed).
export function battleView(b) {
  let letter = 0;
  const inPostNow = b.you.up ? b.posts.find((p) => p.youIn) : null;
  const you = { side: b.you.side, up: b.you.up, kills: b.you.kills, captures: b.you.captures, deaths: b.you.deaths, in: inPostNow?.id ?? null, state: inPostNow ? youState(b, inPostNow) : null, meter: inPostNow?.meter ?? 0, points: whole(b.you.points), as: b.you.as };
  const posts = b.posts.map((p) => ({ id: p.id, name: p.name, letter: p.fixed ? '' : String.fromCharCode(65 + letter++), owner: p.owner, meter: p.meter, taking: p.taking, inside: { ...p.inside }, live: isLive(b, p.id), fixed: p.fixed, can: canDeploy(b, p) }));
  const ph = b.mission.phases[b.phaseIndex];
  return {
    phase: b.result ? 'end' : b.phase,
    t: b.t,
    phaseIndex: b.phaseIndex,
    phaseCount: b.mission.phases.length,
    phaseName: ph.name,
    posts,
    tickets: { ...b.tickets },
    you,
    feed: b.feed.slice(),
    result: b.result,
    key: [b.result ? 'end' : b.phase, b.phaseIndex, posts.map((p) => `${p.owner?.[0] ?? '-'}${p.taking?.[0] ?? ''}${p.can ? '+' : ''}`).join(''), b.tickets.attack, b.tickets.defend, you.up ? 1 : 0, you.in ?? '', you.state ?? '', b.feed.length, you.kills, you.as ?? '', b.result ? 1 : 0].join('|'),
  };
}
