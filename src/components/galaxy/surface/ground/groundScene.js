// The ground war on a world, composed: who holds which turf (turf.js), the
// soldiers made round you cell by cell (population.js), each stepped by the
// fight (fight.js) on its own body (groundFigures.js); their bolts at each
// other fired into the scene's one pool (blaster.js, lib/combat/bolt.js's
// step) and landing where they land, a fight past 60 m settled by the same
// aim without them (farExchange), their bolts at you handed back to the
// scene for blaster.enemy (so the dodge, the saber and the shield are yours
// as ever); the director's raids, posts and hunts
// (director.js) as news for the HUD; and what you can shoot at in the same
// shape as the quests' targets. scene.js makes one and updates it each
// frame. The design:
// docs/superpowers/specs/2026-10-08-ground-factions-design.md, sections 4
// to 7 and 10.
//
// createGround({ parent, world, site, effects, tier, kit, warm, blaster, sparks,
//   standable, seesThrough, rand }) → { posts, turfs, landed(covertAt),
//   targets, update(dt, you, t, { mate, camera }) → shots at you ({ from,
//   to: [x, z], spread, damage, who }), news() → the director's events
//   since, hit(t, damage, { push, at }), near(t), passed(from, to) (your
//   shot's line: near on each it went by), bodies() (the soldiers as the
//   bolts see them), bolt(e) (a step's event on a soldier's bolt or at a
//   soldier: a hit lands, a wall sparks), parry(t), knock(t, v),
//   stagger(t, secs), ms, debug(), dispose() }

import { createTokens } from '../../../../lib/ai/squad';
import { liveCount, lodPick } from '../../../../lib/three/lodPick';
import { pushOut } from '../walker';
import { scatter } from '../../../../lib/combat/accuracy';
import { NEAR, bodyOf as boltBody, farExchange, nearBy } from './bolts';
import { createDirector } from './director';
import { aimError, fightStep, grudge, indexBodies, squadsOf, suppress } from './fight';
import { createFigures } from './groundFigures';
import { createPopulation } from './population';
import { standingOf } from './standing';
import { BURST, burstOf, damageOf, hurt } from './troops';
import { turfsOf } from './turf';
import { weaponOf } from '../weaponRules';

export const BRAINS = 120; // metres from you past which nobody is stepped (its cell holds it)
export const BOLTS = 60; // metres from you within which soldiers' bolts fly; past it, farExchange
export const YOURS = 34; // a soldier's hp a point of your gun's damage is worth (the assault's)
const RAGDOLL = 40; // metres from you within which the dead fall as ragdolls (high and ultra)
const SQUADS = 0.5; // seconds between the squads' looks at their nerve, and the far fights' exchanges
const AIM = 2.5; // how wide blaster.enemy's spread is to the fight's aim error
const SPEED = 90; // m/s, a soldier's bolt
const BOLT = { empire: '#ff3b30', remnant: '#ff3b30', rebel: '#ff7a3a', newrepublic: '#ff7a3a', republic: '#4aa8ff', separatists: '#ff5a2a', hutt: '#ffb34a' };
const SHOTS = { shot: 3, melee: 1 };
const SCALE = { ultra: 1, high: 1, mid: 0.67, low: 0.67 }; // (the difficulty: every pool at once)
const RAGDOLLS = new Set(['high', 'ultra']);

const inert = { posts: [], turfs: [], targets: [], ms: 0, landed() {}, update: () => [], news: () => [], hit() {}, near() {}, passed() {}, bodies: () => [], bolt() {}, parry: () => ({ parried: false, broke: false }), knock() {}, stagger() {}, debug: () => [], posted: () => [], dispose() {} };

export function createGround({ parent, world, site, effects, tier = 'high', kit = null, warm, blaster = null, sparks = null, standable = () => true, seesThrough = null, rand = Math.random }) {
  if (!effects?.owner || !site?.land?.at || site.noGround) return inert;
  const turfs = turfsOf(site, effects, { standable, height: world.heightAt });
  const figures = createFigures({ parent, world, warm, kit, tier, only: site.cast === 'models', uniforms: site.uniforms ?? null });
  const tokens = createTokens({ pools: SHOTS, scale: SCALE[tier] ?? 1, timeout: 0.9 });
  const director = createDirector({ turfs, effects, tier, rand });
  let pop = null;
  let squads = null;
  let covertAt = null;
  let clock = 0;
  let squadAt = 0;
  let lastYou = null;
  let news = [];
  // (the frame's buffers, kept from frame to frame)
  const lod = new Map();
  const items = [];
  const bodies = [];
  const struckBy = [];
  const roll = [];
  const settle = new Map(); // squad → the squad it's at, for the fights past BOLTS
  const kept = new Map(); // id → its body object, reused
  const fw = { t: 0, war: effects.war, bodies, seesThrough, tokens, squads: null, index: null, indexOf: null };
  let frame = 0;
  let targetsAt = -1;
  const targets = [];
  const bodyOf = (id) => {
    let b = kept.get(id);
    if (!b) kept.set(id, (b = { id }));
    return b;
  };

  const population = () => {
    if (pop) return pop;
    pop = createPopulation({ site, turfs, effects: { ...effects, covertAt }, tier, seed: site.ground?.seed ?? 1, rand, standable });
    squads = squadsOf(pop.soldiers, { reach: 18, war: effects.war });
    return pop;
  };
  const down = (t, push = null, damage = 30) => {
    const near = lastYou && Math.hypot(t.soldier.b.x - lastYou.x, t.soldier.b.z - lastYou.z) <= RAGDOLL;
    figures.fell(t, { push, from: lastYou, ragdoll: near && RAGDOLLS.has(tier), speed: damage / 10 + 3 });
    pop?.died(t.id);
    squads?.died(t.id);
  };
  const struck = (t, damage, push, at = null) => {
    const r = hurt(t.soldier, damage);
    if (r === 'down') down(t, push, damage);
    else figures.flinch(t, at);
  };
  // (the walk it took, slid along what's solid and never into the water)
  const moved = (s, x, z) => {
    for (const sol of world.solids?.near?.(x, z, 1) ?? []) {
      const p = pushOut(sol, x, z, 0.4);
      if (p) {
        x += p[0];
        z += p[1];
      }
    }
    return standable([x, z]) ? [x, z] : [s.b.x, s.b.z];
  };
  // a shot at a soldier or your mate: a bolt into the scene's pool, at the
  // aim (fight.js leads a mover), scattered by the aim's error
  const loose = (s, from, aim, spread, dist) => {
    if (!blaster) return;
    const dir = scatter([aim.x - from[0], aim.y - from[1], aim.z - from[2]], spread, rand);
    blaster.shoot({ from, dir, speed: SPEED, side: s.side, owner: s.id, damage: damageOf(s.weapon, dist), range: weaponOf(s.weapon).range, colour: BOLT[s.side] ?? '#ff3b30', deflect: true, tag: { ground: true, near: new Set(), last: [...from] } });
  };
  const capsules = [];

  const api = {
    posts: turfs[0]?.posts ?? [],
    turfs,
    // where a covert landing put you (nobody's made within 25 m of it)
    landed(at) {
      if (!pop) covertAt = at;
    },
    // (worked out once a frame: scene.js asks several times)
    get targets() {
      if (targetsAt === frame) return targets;
      targetsAt = frame;
      targets.length = 0;
      for (const t of figures.all()) if (!t.down && t.fig && t.soldier.alive) targets.push(t);
      return targets;
    },
    // your shot: on the troops' scale, and a grudge from its squad
    hit(t, damage = 1, { push = null, at = null } = {}) {
      if (t.down || !t.soldier.alive) return;
      if (squads) grudge(t.soldier, squads, clock, lastYou);
      struck(t, damage * YOURS, push, at);
    },
    // your shot passing close: it keeps its head down, and its squad has a grudge
    near(t) {
      if (t.down || !t.soldier.alive) return;
      suppress(t.soldier, clock);
      if (squads) grudge(t.soldier, squads, clock, lastYou);
    },
    // your shot's line, from where to where it stopped: a near miss on each soldier it went within 2 m of
    passed(from, to) {
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      const l2 = dx * dx + dz * dz || 1;
      for (const t of figures.all()) {
        if (t.down) continue;
        const k = Math.max(0, Math.min(1, ((t.soldier.b.x - from.x) * dx + (t.soldier.b.z - from.z) * dz) / l2));
        if (Math.hypot(from.x + dx * k - t.soldier.b.x, from.z + dz * k - t.soldier.b.z) < NEAR) api.near(t);
      }
    },
    // the soldiers as the bolts see them (the scene's step: yours, theirs, everyone's)
    bodies() {
      capsules.length = 0;
      for (const t of api.targets) capsules.push(boltBody({ id: t.id, x: t.soldier.b.x, y: t.holder.position.y, z: t.soldier.b.z, r: 0.45, h: t.fig?.tall ?? 1.8, side: t.soldier.side, ref: t }));
      return capsules;
    },
    // a step's event: a bolt (not yours: the scene has those) into a
    // soldier lands; a soldier's bolt at a wall sparks
    bolt(e) {
      const t = e.body?.ref;
      if (e.type === 'hit' && t?.ground === api && !t.down && e.bolt.side !== 'you') struck(t, e.bolt.damage, { x: e.bolt.dir[0], z: e.bolt.dir[2] }, { y: e.at[1] });
      else if (e.type === 'solid' && e.bolt.tag?.ground) sparks?.(e.at, BOLT[e.bolt.side] ?? '#ffffff');
    },
    parry: () => ({ parried: false, broke: false }),
    knock(t, v) {
      t.soldier.staggerUntil = clock + 1.4;
      if (v) {
        t.soldier.b.x += v.vx * 0.15;
        t.soldier.b.z += v.vz * 0.15;
      }
      figures.flinch(t);
    },
    stagger(t, secs) {
      t.soldier.staggerUntil = clock + secs;
      figures.flinch(t);
    },
    news() {
      const out = news;
      news = [];
      return out;
    },
    // (what an update costs, in milliseconds, smoothed: scripts/galaxy-check.mjs reads it)
    ms: 0,
    update(dt, you, time, opts = {}) {
      const t0 = performance.now();
      const shots = step(dt, you, time, opts);
      api.ms += (performance.now() - t0 - api.ms) * 0.05;
      return shots;
    },
    // (for the QA scripts: who's out, where, doing what; the director's posts)
    debug: () => [...figures.all()].map((t) => ({ id: t.id, kind: t.soldier.kind, side: t.soldier.side, role: t.soldier.role, hp: t.soldier.hp, down: t.down > 0, rag: Boolean(t.rag), fig: Boolean(t.fig), at: [+t.soldier.b.x.toFixed(1), +t.soldier.b.z.toFixed(1)], mode: t.soldier.head?.mind?.mode ?? null, target: t.soldier.target ?? null, mark: t.pose?.mark ?? null })),
    posted: () => [...director.posts.values()].map((p) => ({ key: p.key, holder: p.holder, lost: p.lost })),
    dispose() {
      figures.dispose();
    },
  };

  function step(dt, you, time, { mate = null, camera = null } = {}) {
    clock = time;
    frame++;
    figures.frame();
    const shots = [];
    if (!you) return shots;
    lastYou = { x: you.x, z: you.z };
    const p = population();
    const speed = Math.hypot(you.vx ?? 0, you.vz ?? 0);
    const { make, drop } = p.update({ x: you.x, z: you.z, heading: speed > 0.5 ? [Math.sign(you.vx) || 0, Math.sign(you.vz) || 0] : null });
    for (const id of drop) figures.remove(id);
    for (const s of make) figures.add(s).ground = api;
    const far = time - squadAt >= SQUADS;
    if (far) squads.update(time - squadAt);
    bodies.length = 0;
    for (const s of p.soldiers.values()) if (s.alive) bodies.push(Object.assign(bodyOf(s.id), { x: s.b.x, z: s.b.z, vel: s.vel ?? null, side: s.side, kind: s.kind, squad: s.squad, firingAt: time - (s.firedAt ?? -9) < 1 ? s.firingAt : null }));
    bodies.push(Object.assign(bodyOf('you'), { x: you.x, z: you.z, vel: [you.vx ?? 0, you.vz ?? 0], side: effects.side ?? null, kind: 'you', you: true }));
    if (mate) bodies.push(Object.assign(bodyOf('mate'), { x: mate.x, z: mate.z, vel: [mate.vx ?? 0, mate.vz ?? 0], side: effects.side ?? null, kind: 'mate', you: true }));
    if (far) for (const id of kept.keys()) if (id !== 'you' && id !== 'mate' && !p.soldiers.get(id)?.alive) kept.delete(id);
    fw.t = time;
    fw.squads = squads;
    fw.index = indexBodies(bodies);
    fw.indexOf = bodies;
    // who's live, still and hidden by where the camera stands
    items.length = 0;
    for (const t of figures.all()) items.push({ id: t.id, x: t.soldier.b.x, y: t.holder.position.y, z: t.soldier.b.z, falling: t.down > 0 && !t.rag?.settled });
    const eye = camera?.position ?? { x: you.x, y: you.y ?? 0, z: you.z };
    lodPick(items, eye, { count: liveCount(tier), far: BRAINS }, lod);
    let seen = false;
    settle.clear();
    roll.length = 0;
    for (const t of figures.all()) roll.push(t);
    for (const t of roll) {
      const s = t.soldier;
      if (t.fig) t.fig.model.visible = lod.get(t.id) !== 'hidden';
      if (t.down) {
        if (figures.dying(t, dt)) figures.remove(t.id);
        continue;
      }
      // (one a world that takes models only had no model for: never there, never firing)
      if (t.faceless) continue;
      const d = Math.hypot(s.b.x - you.x, s.b.z - you.z);
      if (d > BRAINS) continue;
      const was = { x: s.b.x, z: s.b.z };
      const out = (s.staggerUntil ?? 0) > time ? { x: s.b.x, z: s.b.z, yaw: s.b.yaw, mode: 'hold', moving: 0, aim: null, fire: false, target: null } : fightStep(s, fw, dt, rand);
      const [x, z] = moved(s, out.x, out.z);
      s.b.x = x;
      s.b.z = z;
      s.b.yaw = out.yaw;
      s.vel = [(x - was.x) / Math.max(dt, 1e-3), (z - was.z) / Math.max(dt, 1e-3)];
      t.aim = out.target ? out.aim : null;
      t.watchesYou = out.target === 'you';
      t.hostile = t.watchesYou || out.target === 'mate'; // (your mate's foe: one that's at you or it)
      if (t.watchesYou && !out.guessed && standingOf(s.side, { side: effects.side, war: effects.war }) === 'enemy') seen = true;
      figures.body(t, { ...out, x, z, belief: out.target ? (s.me?.beliefs?.[out.target] ?? null) : null, sees: Boolean(out.target) && !out.guessed }, dt, time, { you, camera, live: lod.get(t.id) === 'live' });
      // a fight out past BOLTS, between soldiers: settled by farExchange, no bolts
      const foe = out.target && out.target !== 'you' && out.target !== 'mate' ? p.soldiers.get(out.target) : null;
      if (foe && d > BOLTS && Math.hypot(foe.b.x - you.x, foe.b.z - you.z) > BOLTS) {
        settle.set(s.squad, foe.squad);
        continue;
      }
      // its gun: bursts while the fight says fire
      s.cool = (s.cool ?? 0) - dt;
      if (out.fire && s.cool <= 0 && !(s.burst > 0)) s.burst = burstOf(s.weapon);
      if (!(s.burst > 0 && s.cool <= 0 && out.aim)) continue;
      s.burst -= 1;
      s.cool = s.burst > 0 ? Math.max(BURST.gap, weaponOf(s.weapon).every) : BURST.pause[0] + rand() * (BURST.pause[1] - BURST.pause[0]);
      const body = bodies.find((b) => b.id === out.target);
      const dist = Math.hypot(out.aim.x - x, out.aim.z - z);
      const spread = aimError(s, body ?? { vel: null }, dist, { first: s.burst === burstOf(s.weapon) - 1, now: time }) * AIM;
      const from = figures.fire(t, time);
      s.firedAt = time;
      s.firingAt = out.target;
      if (out.target === 'you') shots.push({ from, to: [out.aim.x, out.aim.z], spread, damage: damageOf(s.weapon, dist), who: t, guessed: Boolean(out.guessed) });
      else {
        const v = out.target === 'mate' ? null : figures.get(out.target);
        const y = out.target === 'mate' ? (mate?.y ?? 0) + 1.1 : (v?.holder.position.y ?? from[1] - 1.2) + 1.1;
        loose(s, from, { x: out.aim.x, y, z: out.aim.z }, spread, dist);
      }
    }
    // the soldiers' bolts in flight going close by: heads down (the hits
    // and the walls are the scene's step's events: bolt(e))
    struckBy.length = 0;
    for (const t of figures.all()) if (!t.down && t.soldier.alive) struckBy.push({ id: t.id, x: t.soldier.b.x, z: t.soldier.b.z });
    for (const b of blaster?.bolts.live() ?? []) {
      if (!b.tag?.ground) continue;
      for (const id of nearBy(b.tag.last, b.pos, struckBy, b.tag.near, b.owner)) {
        const v = figures.get(id);
        if (v && !v.down) suppress(v.soldier, time);
      }
      b.tag.last = b.pos.slice();
    }
    // the fights past BOLTS, settled every so often by the same aim
    if (far) {
      const squadOf = (q) => [...p.soldiers.values()].filter((s) => s.squad === q && s.alive);
      const done = new Set();
      for (const [a, b] of settle) {
        const key = [a, b].sort().join('|');
        if (done.has(key)) continue;
        done.add(key);
        for (const h of farExchange(squadOf(a), squadOf(b), time - squadAt, rand, { aimError, damageOf }).hits) {
          const v = figures.get(h.to);
          if (v && !v.down) struck(v, h.damage, null);
        }
      }
      squadAt = time;
    }
    news.push(...director.update(dt, { you, population: p, seen }));
    tokens.audit(dt, (who) => Boolean(p.soldiers.get(who)?.alive));
    return shots;
  }
  return api;
}
