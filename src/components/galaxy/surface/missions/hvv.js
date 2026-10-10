// Heroes vs Villains, as plain numbers (missions/arenas.js has the
// grounds): four heroes of the light against four of the dark in the
// level's hero arena, the 2017 game's thirteen by their lean, you one of
// your side's. Each side has a target, drawn at the start and again each
// time one falls; only a target's death scores, a point to the other side,
// and the first to RULES.points wins. Everyone else down comes back after
// RULES.respawn seconds at the spawn farthest from the enemy; ten seconds
// outside the arena and you're down. Pure and seeded, so it's tested; the
// drawing is hvvScene.js and the surface scene runs it.
//
// The bots: a saber hero fences with a duellist's mind (lib/combat/duel,
// through duellists.js's duelFor: the game's strokes at its cadence) on the
// saber engine (lib/combat/saber2017.js, its own sim of its hero's rules, as
// yours and the quests' duellists have): a strike lunges by its clip's root
// travel (the stroke table's), stopped short of its mark as the saber on
// screen is, and lands what the game's query finds, the game's damage, a
// block met from the front draining the blocker's stamina; a blaster hero
// strafes its mark at a distance (hostiles.js's strafeStep) and fires its own
// gun's bursts at its gun's damage and fall-off (weapons.json, GUNS below),
// a saber hero's raised block turning those that meet its shield from the
// front. A bot's mark is the nearest enemy, the enemy's target weighed
// RULES.pull metres nearer. Hit points are the game's (bf2017Abilities.json,
// abilityRules.js's gameHealth), healing after the game's delay at its rate
// (bf2017/heroes.json's regen).
//
//   RULES, HVV_HEROES, GUNS
//   newHvv(ground, { seed, n, stars })     → b, at the choose card (stars: the mission's, for a win's)
//   chooseSide(b, side, hero)              you on a side ('light' | 'dark') as `hero`
//                                          (null: nobody plays, the bots fight it out)
//   stepHvv(b, dt, you, env)               → events: { type: 'stroke' | 'shot' | 'hit' |
//                                          'block' | 'down' | 'score' | 'target' | 'spawn' |
//                                          'oob' | 'end', … }; you: { x, z, yaw?, swinging?, sim? (your saber's engine) } | null
//   hitFighter(b, id, damage, by)          one of yours lands: → the `down` event, or null
//   canDeploy(b), deploy(b)                → you back on the field: { x, z, yaw } | null
//   youDown(b), endHvv(b, won, why), hvvView(b)
//   hvvMission(world)                      the mission row for a world (missions/index.js)

import { HEROES } from '../../heroes';
import { gameHealth } from '../abilityRules';
import { duelFor } from '../duellists';
import { strafeStep } from '../hostiles';
import { duelStep, onHit, swung } from '../../../../lib/combat/duel';
import { createSaberSim, saberOf, shieldHit } from '../../../../lib/combat/saber2017';
import { strokeTable } from '../../../../data/bf2017/strokes';
import { stanceFor } from '../gameStance';
import { rootAt } from '../saberRoot';
import { CREW } from '../crewList';
import { rng } from '../noise';
import { starsFor } from './chase';
import { pushOut } from '../walker';
import { groundFor, inside, pull, spawnFor } from './arenas';
import GAME_HEROES from '../../../../data/bf2017/heroes.json';

export const RULES = {
  points: 10, // a side's target deaths to win (hand: the game as played)
  respawn: 10, // seconds down before you come back (hand)
  oob: 10, // seconds outside the arena before it puts you down (hand: the game's warning)
  pull: 40, // metres nearer the enemy's target counts, choosing a mark
  look: 1, // seconds between a bot's looks for its mark
  step: 0.1,
  spacing: 1.3, // metres between fighters
  saber: { reach: 2.4, pace: 3.4, guard: 0.5 }, // (hand: where a saber bot stands off, how fast it goes, and how often it holds its block for a strike; what a strike does is the engine's, the game's)
  blaster: { keep: 14, range: 60, pace: 3, strafe: 2.6, every: 1.2, accuracy: [0.75, 0.3] }, // (hand: a bot fires a burst at its gun's rate but no more often than `every` seconds, the guns' trigger rates being a player's)
  yours: 100, // what one of your strokes or bolts takes off a hero (hand)
  heal: { delay: 5, rate: 50 }, // (the game's most common; a hero's own from heroes.json)
};

// The thirteen 2017 heroes (heroes.js's walrus rows), by their lean.
export const HVV_HEROES = HEROES.filter((h) => h.rig === 'walrus' && (h.lean === 'light' || h.lean === 'dark'));

// Each blaster hero's gun, as weapons.json has it (rows leia, hansolo,
// chewbacca, x8nightsniper, boba, v10: firing.rof or burstsPerMinute and
// burst, damage.start/end over startDistance/endDistance). hvv.test.js
// checks these against the rulebook.
export const GUNS = {
  leia: { row: 'leia', perMinute: 200, burst: 2, start: 40, end: 20, near: 20, far: 40 },
  han: { row: 'hansolo', perMinute: 175, burst: 1, start: 80, end: 55, near: 20, far: 50 },
  chewie: { row: 'chewbacca', perMinute: 60, burst: 1, start: 40, end: 35, near: 30, far: 50 },
  lando: { row: 'x8nightsniper', perMinute: 400, burst: 1, start: 40, end: 25, near: 20, far: 50 },
  bobafett: { row: 'boba', perMinute: 120, burst: 3, start: 35, end: 25, near: 20, far: 40 },
  bossk: { row: 'v10', perMinute: 100, burst: 1, start: 55, end: 35, near: 50, far: 100 },
};
// (the site's ids to the rulebook's)
const GAME_ID = { han: 'hansolo', chewie: 'chewbacca', vader: 'darthvader', palpatine: 'emperor' };
const regenOf = (id) => {
  const r = GAME_HEROES.rows[GAME_ID[id] ?? id]?.regen;
  return r?.rate ? { delay: r.delay, rate: r.rate } : RULES.heal;
};
export const damageAt = (gun, d) => (d <= gun.near ? gun.start : d >= gun.far ? gun.end : gun.start + ((gun.end - gun.start) * (d - gun.near)) / (gun.far - gun.near));

const other = (side) => (side === 'light' ? 'dark' : 'light');
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const heroOf = (id) => HEROES.find((h) => h.id === id);
const nameOf = (id) => heroOf(id)?.name ?? id;

function fighter(b, hero, side, you = false) {
  const h = heroOf(hero);
  const max = gameHealth(hero) ?? 700;
  const f = { id: b.fighters.length, hero, side, you, saber: h?.weapon === 'saber', x: 0, z: 0, yaw: 0, hp: max, max, up: false, down: 0, hurtAt: -99, mark: null, lookIn: 0, cool: 1 + b.r() * 2, burst: 0, burstWait: 0, stroke: null, kills: 0, deaths: 0, out: 0, regen: regenOf(hero), mind: null };
  if (f.saber && !you) {
    f.mind = duelFor({ kind: hero, hostile: { reach: RULES.saber.reach, parry: RULES.saber.guard, blade: { stance: h.saber?.stance ?? 'single' } } }, b.seed * 131 + f.id * 7919 + 1);
    f.sim = createSaberSim(saberOf(hero), { id: f.id });
    f.stance = stanceFor(h.saber?.stance ?? 'single', CREW[hero] ?? { rig: 'walrus', pack: hero });
    f.table = strokeTable(CREW[hero]?.pack ?? hero) ?? strokeTable('luke');
  }
  b.fighters.push(f);
  return f;
}

// A battle laid out at the choose card: the ground, nobody on it yet.
export function newHvv(ground, { seed = 1, n = 4, stars = null } = {}) {
  return { ground, seed, stars, r: rng(seed), n, t: 0, phase: 'choose', result: null, fighters: [], score: { light: 0, dark: 0 }, targets: { light: null, dark: null }, you: { side: null, id: null }, feed: [] };
}

const feed = (b, kind, text) => {
  b.feed.push({ t: b.t, kind, text });
  if (b.feed.length > 5) b.feed.shift();
};

function place(b, f, spot) {
  f.x = spot[0];
  f.z = spot[1];
  f.yaw = spot[2] ?? 0;
  f.up = true;
  f.hp = f.max;
  f.down = 0;
  f.out = 0;
  f.stroke = null;
  f.mark = null;
  f.lookIn = 0;
  f.hurtAt = -99;
  if (f.sim) f.sim = createSaberSim(f.sim.rules, { id: f.id });
}

// a side's target drawn: one of its fighters up (not `not`, if another is), else any of them
function draw(b, side, not = null, out = null) {
  const mine = b.fighters.filter((f) => f.side === side);
  let pool = mine.filter((f) => f.up && f.id !== not);
  if (!pool.length) pool = mine.filter((f) => f.id !== not);
  if (!pool.length) pool = mine;
  const f = pool[Math.floor(b.r() * pool.length) % pool.length];
  b.targets[side] = f.id;
  out?.push({ type: 'target', side, id: f.id, you: f.you });
  feed(b, 'target', f.you ? 'You’re the target now' : `${nameOf(f.hero)} is ${side === b.you.side ? 'your' : 'their'} target`);
}

// Sides made and on the field: you (as `hero`, or nobody) and the bots,
// four a side, each side at its own start cluster; the targets drawn.
export function chooseSide(b, side = null, hero = null) {
  b.you.side = side;
  b.phase = 'run';
  for (const s of ['light', 'dark']) {
    const pool = HVV_HEROES.filter((h) => h.lean === s && h.id !== hero).map((h) => h.id);
    // (seeded, so the same seed fields the same heroes)
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(b.r() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const yours = s === side && hero;
    if (yours) b.you.id = fighter(b, hero, s, true).id;
    for (const id of pool.slice(0, b.n - (yours ? 1 : 0))) fighter(b, id, s);
  }
  for (const f of b.fighters) if (!f.you) place(b, f, spawnFor(b.ground, f.side, b.r));
  for (const s of ['light', 'dark']) draw(b, s);
}

export function endHvv(b, won, why = 'points') {
  if (b.result) return;
  const me = b.fighters[b.you.id];
  b.result = { won, why, t: b.t, stars: won && b.stars ? starsFor({ stars: b.stars }, b.t) : 0, side: b.you.side, score: { ...b.score }, kills: me?.kills ?? 0, deaths: me?.deaths ?? 0 };
  b.phase = 'end';
}

// one falls: a point to the other side if it was its side's target
function fall(b, f, by, out) {
  if (!f.up) return null;
  f.up = false;
  f.hp = 0;
  f.down = 0;
  f.deaths += 1;
  f.stroke = null;
  const killer = by != null ? b.fighters[by] : null;
  if (killer) killer.kills += 1;
  const ev = { type: 'down', id: f.id, by: by ?? null, from: killer ? [killer.x, killer.z] : null, target: b.targets[f.side] === f.id };
  out.push(ev);
  if (ev.target) {
    const side = other(f.side);
    b.score[side] += 1;
    out.push({ type: 'score', side, score: { ...b.score } });
    feed(b, 'score', `${nameOf(f.hero)}, ${f.side === b.you.side ? 'your' : 'their'} target, is down: a point to the ${side === 'light' ? 'heroes' : 'villains'}`);
    if (b.score[side] >= RULES.points) {
      const won = b.you.side ? b.you.side === side : null;
      out.push({ type: 'end', won, side });
      endHvv(b, won, 'points');
      return ev;
    }
    draw(b, f.side, f.id, out);
  } else if (killer?.you) feed(b, 'kill', `You brought ${nameOf(f.hero)} down`);
  return ev;
}

function hurt(b, f, damage, by, out) {
  if (!f.up || b.result) return null;
  f.hp -= damage;
  f.hurtAt = b.t;
  if (f.mind && f.hp > 0) onHit(f.mind);
  if (f.hp > 0) return null;
  if (f.mind) onHit(f.mind, { dead: true });
  return fall(b, f, by, out);
}

export function hitFighter(b, id, damage = RULES.yours, by = b.you.id) {
  const f = b.fighters[id];
  if (!f || f.you || !f.up) return null;
  const out = [];
  hurt(b, f, damage, by, out);
  return out.find((e) => e.type === 'down') ?? null;
}

// the enemy a bot goes for: the nearest, their target weighed nearer
function markOf(b, f) {
  let best = null;
  let bestScore = Infinity;
  for (const o of b.fighters) {
    if (!o.up || o.side === f.side) continue;
    const s = dist(f, o) - (b.targets[o.side] === o.id ? RULES.pull : 0);
    if (s < bestScore) {
      best = o;
      bestScore = s;
    }
  }
  return best;
}

// a strike's swing as the other blade's mind reads it (duel.js's `swinging`)
const swingOf = (b, f) => (f.stroke ? { contact: f.stroke.contact, t: b.t - f.stroke.at } : null);
// a fighter as the engine sees it (you: your saber's engine, where the scene hands it)
const asEngine = (t) => ({ id: t.id, x: t.x, z: t.z, yaw: t.yaw, sim: t.sim ?? null, dead: !t.up });

function move(b, f, x, z, env) {
  for (const sol of env.solids?.near(x, z, 2) ?? []) {
    const p = pushOut(sol, x, z, 0.45);
    if (p) {
      x += p[0];
      z += p[1];
    }
  }
  for (const o of b.fighters) {
    if (o === f || !o.up) continue;
    const d = Math.hypot(x - o.x, z - o.z);
    if (d < RULES.spacing && d > 1e-6) {
      const k = ((RULES.spacing - d) / d) * 0.5;
      x += (x - o.x) * k;
      z += (z - o.z) * k;
    }
  }
  // (never out of the arena: back in toward its middle)
  [f.x, f.z] = pull(b.ground.points, b.ground.at, x, z);
}

function saberStep(b, f, m, h, env, out) {
  f.mind.at[0] = f.x;
  f.mind.at[1] = f.z;
  const o = duelStep(f.mind, m && { pos: [m.x, m.z], swinging: m.you ? (m.swinging ?? null) : swingOf(b, m), out: Boolean(m.sim?.state.out), tired: f.sim.state.out }, h);
  if (o.begin && m) {
    // (the hero's strike by its table: its window, how long it holds, its root's travel)
    const k = f.stance?.strokes.find((x) => x.clip === o.stroke) ?? f.stance?.strokes[0];
    const row = f.table?.strikes.find((x) => x.name === o.stroke);
    const contact = k?.contact ?? [0.2, 0.4];
    const dur = f.stance?.cadence?.[o.stroke]?.dur ?? row?.duration ?? 0.6;
    f.yaw = o.face;
    if (f.sim.strike(b.t, { contact, dur })) {
      swung(f.mind, dur);
      f.stroke = { at: b.t, mark: m.id, clip: o.stroke, contact, root: row?.root ?? null, was: [0, 0] };
      out.push({ type: 'stroke', id: f.id, clip: o.stroke, mark: m.id });
    }
  }
  if (f.stroke && !f.sim.state.striking) f.stroke = null;
  // (its block: up for a strike that would reach it, and while it's shot at and not striking, as the game's AI deflects)
  const fired = b.t - (f.firedAt ?? -99) < 1.5;
  f.sim.block(o.block || (fired && !f.stroke), b.t);
  // (the lunge: its clip's root, unscaled, no nearer its mark than the middle of the query's ring: saber.js's)
  const q = f.sim.rules.query;
  if (f.stroke?.root && m?.up) {
    const [x, z] = rootAt(f.stroke.root, b.t - f.stroke.at);
    const lx = x - f.stroke.was[0];
    let lz = z - f.stroke.was[1];
    f.stroke.was = [x, z];
    if (lz > 0) lz = Math.min(lz, Math.max(0, dist(f, m) - ((q.hit.radius + q.hit.near) / 2 + q.anchor)));
    move(b, f, f.x + Math.cos(f.yaw) * lx + Math.sin(f.yaw) * lz, f.z - Math.sin(f.yaw) * lx + Math.cos(f.yaw) * lz, env);
  }
  // what its strike's query finds, the game's: the enemies up
  const foes = b.fighters.filter((x) => x.up && x.side !== f.side).map(asEngine);
  for (const e of f.sim.step(h, b.t, { me: { x: f.x, z: f.z, yaw: f.yaw }, targets: foes })) {
    const t = b.fighters[e.id];
    if (!t?.up) continue;
    if (e.type === 'blocked' || e.type === 'clash') out.push({ type: 'block', id: t.id, by: f.id, clash: e.type === 'clash' });
    else if (e.type === 'hit') {
      if (t.you) out.push({ type: 'hit', id: f.id, you: true, melee: true, damage: e.damage, behind: e.behind, from: [f.x, f.z] });
      else {
        const n = t.sim ? t.sim.taken(e.damage, b.t) : e.damage;
        out.push({ type: 'hit', id: f.id, target: t.id, melee: true, damage: n });
        hurt(b, t, n, f.id, out);
      }
    }
  }
  if (!m) return;
  if (!f.stroke) {
    f.yaw = o.face;
    move(b, f, f.x + o.move[0] * RULES.saber.pace * h, f.z + o.move[1] * RULES.saber.pace * h, env);
  }
}

function blasterStep(b, f, m, h, env, out) {
  if (!m) return;
  const gun = GUNS[f.hero] ?? GUNS.han;
  const d = dist(f, m);
  const R = RULES.blaster;
  if (d > R.keep * 1.4) {
    f.yaw = Math.atan2(m.x - f.x, m.z - f.z);
    move(b, f, f.x + Math.sin(f.yaw) * R.pace * h, f.z + Math.cos(f.yaw) * R.pace * h, env);
  } else {
    const s = strafeStep(f, m, { strafe: { speed: R.strafe, every: 2.2 + (f.id % 3) * 0.4, keep: R.keep } }, h, b.t + f.id * 1.7);
    f.yaw = s.yaw;
    move(b, f, s.x, s.z, env);
  }
  // its gun: a burst at its rate, each bolt rolled
  f.cool -= h;
  if (f.cool <= 0 && d <= R.range && !f.burst) {
    f.burst = gun.burst;
    f.burstWait = 0;
    f.cool = Math.max(60 / gun.perMinute, R.every) * (0.85 + 0.3 * b.r());
  }
  f.burstWait -= h;
  while (f.burst > 0 && f.burstWait <= 0) {
    f.burst -= 1;
    f.burstWait += 0.12;
    const damage = Math.round(damageAt(gun, d));
    if (m.you) {
      out.push({ type: 'shot', id: f.id, from: [f.x, f.z], to: [m.x, m.z], atYou: true, damage });
      continue;
    }
    if (m.saber) m.firedAt = b.t;
    const [a0, a1] = R.accuracy;
    let hit = b.r() < a0 + (a1 - a0) * Math.min(1, d / R.range);
    // (a saber hero's raised block turns what meets its shield from the front: its stamina pays)
    const turned = hit && Boolean(m.sim?.deflecting) && Boolean(shieldHit(m.sim.rules, m, [f.x, 1.3, f.z], [m.x, 1.3, m.z]));
    if (turned) {
      hit = false;
      m.sim.takeBolt(damage, b.t);
    }
    out.push({ type: 'shot', id: f.id, from: [f.x, f.z], to: [m.x, m.z], atYou: false, hit, turned, target: m.id });
    if (hit) hurt(b, m, damage, f.id, out);
  }
}

function step(b, h, you, env, out) {
  b.t += h;
  const me = b.you.id != null ? b.fighters[b.you.id] : null;
  if (me?.up) {
    if (you) {
      me.x = you.x;
      me.z = you.z;
      me.yaw = you.yaw ?? me.yaw;
      me.swinging = you.swinging ?? null;
      me.sim = you.sim ?? null;
    }
    // out of the arena: ten seconds and it's over for you
    if (you && !inside(b.ground.points, me.x, me.z)) {
      me.out += h;
      if (me.out >= RULES.oob) {
        out.push({ type: 'oob', id: me.id });
        me.out = 0;
        fall(b, me, null, out);
        if (b.result) return;
      }
    } else me.out = 0;
  }
  for (const f of b.fighters) {
    if (b.result) return;
    if (!f.up) {
      f.down += h;
      if (!f.you && f.down >= RULES.respawn) {
        place(b, f, spawnFor(b.ground, f.side, b.r, b.fighters.filter((o) => o.up && o.side !== f.side)));
        out.push({ type: 'spawn', id: f.id });
      }
      continue;
    }
    // healing, after a while unhurt (yours is the scene's)
    if (!f.you && b.t - f.hurtAt > f.regen.delay && f.hp < f.max) f.hp = Math.min(f.max, f.hp + f.regen.rate * h);
    if (f.you) continue;
    f.lookIn -= h;
    let m = f.mark != null ? b.fighters[f.mark] : null;
    if (f.lookIn <= 0 || !m?.up) {
      m = markOf(b, f);
      f.mark = m?.id ?? null;
      f.lookIn = RULES.look * (0.8 + 0.4 * b.r());
    }
    if (f.saber) saberStep(b, f, m, h, env, out);
    else blasterStep(b, f, m, h, env, out);
  }
}

// The battle moved on by dt (in steps of RULES.step at most), you at `you`
// ({ x, z, swinging? }, or null while you're off the field).
export function stepHvv(b, dt, you = null, env = {}) {
  const out = [];
  if (b.phase !== 'run' || b.result) return out;
  const n = Math.max(1, Math.ceil(dt / RULES.step - 1e-9));
  for (let i = 0; i < n && !b.result; i++) step(b, dt / n, you, env, out);
  return out;
}

export const canDeploy = (b) => {
  const me = b.fighters[b.you.id];
  return Boolean(me && !me.up && !b.result && (me.deaths === 0 || me.down >= RULES.respawn));
};

// you onto the field: your side's start the first time, then the quietest spawn
export function deploy(b) {
  if (!canDeploy(b)) return null;
  const me = b.fighters[b.you.id];
  const spot = me.deaths === 0 ? spawnFor(b.ground, me.side, b.r) : spawnFor(b.ground, me.side, b.r, b.fighters.filter((o) => o.up && o.side !== me.side));
  place(b, me, spot);
  const yaw = Math.atan2(b.ground.at[0] - spot[0], b.ground.at[1] - spot[1]);
  return { x: spot[0], z: spot[1], yaw };
}

export function youDown(b) {
  const me = b.fighters[b.you.id];
  if (!me?.up) return;
  fall(b, me, null, []);
}

export function hvvView(b) {
  const me = b.you.id != null ? b.fighters[b.you.id] : null;
  const card = (side) => {
    const f = b.targets[side] != null ? b.fighters[b.targets[side]] : null;
    return f ? { id: f.id, hero: f.hero, name: nameOf(f.hero), up: f.up, hp: Math.max(0, Math.round((f.hp / f.max) * 100)), you: f.you } : null;
  };
  const you = { side: b.you.side, hero: me?.hero ?? null, up: Boolean(me?.up), kills: me?.kills ?? 0, deaths: me?.deaths ?? 0, wait: me && !me.up && me.deaths ? Math.max(0, Math.ceil(RULES.respawn - me.down)) : 0, out: me?.out > 0 ? Math.max(0, Math.ceil(RULES.oob - me.out)) : null, target: Boolean(me && b.targets[me.side] === me.id), can: canDeploy(b) };
  const fighters = b.fighters.map((f) => ({ id: f.id, hero: f.hero, name: nameOf(f.hero), side: f.side, up: f.up, you: f.you, target: b.targets[f.side] === f.id }));
  return {
    phase: b.result ? 'end' : b.phase,
    t: b.t,
    score: { ...b.score },
    points: RULES.points,
    targets: { light: card('light'), dark: card('dark') },
    fighters,
    you,
    feed: b.feed.slice(),
    result: b.result,
    key: [b.result ? 'end' : b.phase, b.score.light, b.score.dark, b.targets.light, b.targets.dark, you.up ? 1 : 0, you.wait, you.out ?? '', you.can ? 1 : 0, b.feed.length, you.kills, fighters.map((f) => (f.up ? 1 : 0)).join('')].join('|'),
  };
}

// ── the mission row a world gets (missions/index.js) ──
export const HVV_SIDES = {
  light: { id: 'heroes', name: 'The heroes', short: 'Heroes', colour: '#7fc8ff' },
  dark: { id: 'villains', name: 'The villains', short: 'Villains', colour: '#ff6a5a' },
};
const LINES = {
  start: {
    xwing: [['luke', 'Four of us, four of them. Keep our target alive and find theirs.'], ['r2', '(A determined whistle.)']],
    falcon: [['han', 'Heroes and villains. Guess which one I am today.'], ['chewie', '(A battle roar.)']],
    cruiser: [['rick', 'Space wizards in a ring, Morty. Protect the one with the marker over their head.'], ['morty', 'Wh-which one’s ours?']],
    rv: [['walt', 'Protect our target. Find theirs. Everything else is noise.'], ['jesse', 'Yo, that’s Darth Vader, Mr. White.']],
  },
  won: {
    xwing: [['luke', 'That’s ten. It’s over.'], ['r2', '(A triumphant trill.)']],
    falcon: [['han', 'Ten. Somebody write this down.'], ['chewie', '(A long, victorious howl.)']],
    cruiser: [['rick', 'Ten for ten, Morty. Legends of the arena.']],
    rv: [['walt', 'Ten. We’re done here.'], ['jesse', 'Yeah, science!']],
  },
  lost: {
    xwing: [['luke', 'They got there first. Again.']],
    falcon: [['han', 'Okay. Rematch.']],
    cruiser: [['morty', 'We lost, Rick.'], ['rick', 'Arena rules, Morty. Somebody always loses.']],
    rv: [['walt', 'Again. Protect the target this time.']],
  },
};
export function hvvMission(world) {
  const g = groundFor(world, 'hvv');
  if (!g) return null;
  return {
    id: 'hvv',
    system: world,
    kind: 'hvv',
    name: 'Heroes vs Villains',
    line: 'Four heroes against four villains in the level’s hero arena. Each side has a target: bring theirs down for a point, keep yours alive. First to ten.',
    ride: null,
    start: [g.at[0], g.at[1]],
    yaw: 0,
    stars: [300, 480],
    achievement: 'heroesvsvillains',
    sides: HVV_SIDES,
    ground: g.volume,
    ends: { won: 'The arena is yours', lost: 'The arena is theirs', why: { points: 'The other side brought down ten of your targets first.' } },
    lines: LINES,
  };
}
