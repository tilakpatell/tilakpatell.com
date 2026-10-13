// A hero or a villain on the sim, between its input and its body: the saber
// (lib/combat/saber2017.js, the game's strike query, block and stamina) in
// the game's strike chain (heroKit.json's `strike`: the next strike from
// 0.5 s, the kill window 0.42–0.58 s, at rest by 1.83 s, six in a chain),
// the lunge toward the strike's pick, the block held on the aim button
// (walking at the Blocking drive's 2.4 m/s) that turns bolts from the front
// back at their shooter as the game's 350 m/s deflected round, the
// Emperor's held lightning, the Force jump (the state machine's eased
// rise, the fall's gravity, the landing's penalty), the dodge, and the
// three abilities' events handed to heroAbilities.js. The shoves the
// abilities give are carried here on whoever took them. Pure: requests in
// the kit's `blast` shape come out for the sim to apply.
//
//   createHero(s, id) → s.hero       (s: a soldier deployed from hero.js's heroClass)
//   heroInput(sim, s, { fire, aiming, jump }, now)   (a player's buttons, or a bot's: ai/heroBrain.js)
//   jump(sim, s, now) → bool    heroRoll(s, now)   (the dodge's damage taken, Affector_Evading_DMGMultiplier)
//   onHeroAbility(sim, s, e) → requests            (an ability event from the soldier's tick)
//   stepHeroes(sim) → requests                     (every hero's saber, beam, jump and effects; every shove)
//   deflect(sim, target, hit) → bool               (a bolt turned on the block: no damage, the round sent back)
//   heroTakes(sim, target, hit, damage) → bool     (a bolt a block turned or a Squad Shield took: gone, burst and all)
//   burstAt(sim, hit, { shooter, scale, grace })   (a round that bursts where it lands, under the rules its bolt obeyed)
//   viewHero(e, s, now)                            (the view's entity: its act, when it was struck, its lift, whether smoke hides it)
//   actOf(s, now) → { strike, strikeT, blocking, ability, abilityT, slot, air, thrown, lift } | null   (the view's, for the figures)

import KIT from '../../data/bf2017/heroKit.json';
import FX from '../../data/bf2017Abilities.json';
import { createSaberSim, saberOf } from '../combat/saber2017.js';
import { end as endAbility } from './abilities.js';
import { apply } from './affectors.js';
import { fire as fireBolt } from './bolts.js';
import { heightAt } from './nav.js';
import { chestOf } from './soldier.js';
import { STEP } from './core.js';
import { AI_DAMAGE_SCALE, damageAt } from './weapons.js';
import { aimYaw, enemiesOf, fireAbility, inReach, slide, startAbility, stepEffects } from './heroAbilities.js';
import { domed, dropBlaster, onBlaster, pressBlaster, stepBlaster } from './heroBlaster.js';

export { domed };
// (the hero's class row and abilities, and its star cards, for the sim: one door to the hero's files)
export { heroAbilities, heroClass } from './hero.js';
export { cardsFor, equip } from './cards.js';

const T = KIT.strike;
const D = KIT.deflect;
const DEG = Math.PI / 180;
// the round a block sends back (BlasterProjectile_SaberDeflect)
const DEFLECTED = { id: 'saberDeflect', family: 'hero', range: 200, firing: { speed: D.speed }, damage: { start: D.start, end: D.end, startDistance: D.startDistance, endDistance: D.endDistance, timeToLive: D.ttl, min: 1, max: 1 } };
const BEAM = FX.heroes.palpatine.abilities.find((a) => a.kind === 'lightning');

export function createHero(s, id) {
  const k = KIT.heroes[id];
  s.unit = 'hero';
  s.unitId = id;
  s.hero = {
    id,
    kit: k,
    saber: k?.saber ? createSaberSim(saberOf(k.saber), { id: s.id }) : null,
    lightning: Boolean(k?.lightning),
    strike: null, // { i, t0 }: the chain's strike in hand
    queued: false,
    air: null, // { vy, t0 }: off the ground
    act: null, // the last ability pressed, for the figure
    beam: null,
    rush: null,
    thrown: null,
    choke: null,
    rage: null,
    aura: null,
    // (a blaster hero's: its rockets still to fly, its Squad Shield, its mines: heroBlaster.js)
    barrage: null,
    dome: null,
    mines: [],
    flurry: null,
    stunned: false,
  };
  return s.hero;
}

const stopped = (s, now) => (s.stunnedUntil ?? -Infinity) > now;

// a strike of the chain: the next of it once 0.5 s of the last has gone (a press before then waits),
// the first again once the last is at rest
function strike(sim, s, now) {
  const H = s.hero;
  if (!H.saber || H.thrown) return false;
  if (H.strike && now - H.strike.t0 < T.next - 1e-9) {
    H.queued = true;
    return false;
  }
  const i = H.strike && now - H.strike.t0 < T.rest ? (H.strike.i + 1) % T.chain : 0;
  if (!H.saber.strike(now, { contact: T.contact, dur: T.contact[1] + 0.05 })) return false;
  H.strike = { i, t0: now };
  H.queued = false;
  sim.out?.push({ t: now, type: 'strike', by: s.id, i });
  return true;
}

export function heroInput(sim, s, { fire = false, aiming = false, jump: up = false } = {}, now = sim.time) {
  const H = s.hero;
  if (!H || !s.alive) return;
  const held = stopped(s, now);
  if (H.saber) {
    if (fire && !held) strike(sim, s, now);
    H.saber.block(Boolean(aiming) && !fire && !held && !H.thrown, now);
    s.blocking = H.saber.state.blocking;
  }
  if (H.lightning) H.beam = fire && !held ? (H.beam ?? { next: now }) : null;
  if (up && !held) jump(sim, s, now);
}

export function jump(sim, s, now) {
  const H = s.hero;
  const j = s.cls.jump;
  if (!H || !j || H.air || !s.alive) return false;
  // (Yoda's record gives a height: the rise that reaches it under his fall)
  H.air = { vy: j.height ? Math.sqrt(-2 * j.gravity * j.height) : 0, t0: now };
  s.blocking = false;
  H.saber?.block(false, now);
  sim.out?.push({ t: now, type: 'jump', by: s.id });
  return true;
}

// the dodge: Ability_Evade_CharacterState's damage taken while it lasts (no invulnerability)
export function heroRoll(s, now) {
  const e = s.abilities.list.find((a) => a.slot === 0)?.row;
  apply(s.stack, { id: 'Evading', property: 'ArmorMultiplier', op: 'mul', value: e?.hero?.taken ?? 0.8, until: now + (e?.active ?? 0.4) });
}

export function onHeroAbility(sim, s, e) {
  const a = s.abilities.list.find((x) => x.row.id === e.id);
  const fx = a?.row.hero;
  if (!fx?.kind || fx.kind === 'evade') return [];
  const now = sim.time;
  if (e.phase === 'start') {
    a.fired = false;
    startAbility(sim, s, a, now);
    return [];
  }
  // (a blaster hero's kinds: heroBlaster.js)
  const blaster = onBlaster(sim, s, a, e);
  if (blaster) return blaster;
  if (a.fired || (e.phase === 'end' && e.why)) return [];
  if (e.phase !== 'active' && e.phase !== 'end') return [];
  a.fired = true;
  const out = fireAbility(sim, s, a, now);
  // (a thrown thing the record holds active for ever, Leia's detonator: done once it leaves the hand)
  if (e.phase === 'active' && (a.row.active ?? 0) > 60) endAbility(s.abilities, a.slot, now, 'thrown');
  return out;
}

function stepAir(sim, s, now, dt) {
  const H = s.hero;
  const A = H.air;
  const j = s.cls.jump;
  if (now - A.t0 < (j.hold ?? 0)) A.vy += (j.vy - A.vy) * (1 - Math.pow(1 - j.weight, dt * 30));
  else A.vy += j.gravity * dt;
  s.at[1] += A.vy * dt;
  const ground = sim.nav ? heightAt(sim.nav, s.at[0], s.at[2]) : 0;
  if (s.at[1] <= ground && A.vy <= 0) {
    s.at[1] = ground;
    H.air = null;
    if (j.penalty !== false) apply(s.stack, { id: 'landing', property: 'speed', op: 'mul', value: KIT.jumps.landing.factor, until: now + KIT.jumps.landing.seconds });
    sim.out?.push({ t: now, type: 'land', by: s.id });
  }
}

// the nearest of the targets within `range` and `cone` degrees of the facing
function nearest(targets, s, range, cone) {
  let best = null;
  let bd = Infinity;
  for (const t of targets) {
    const dx = t.x - s.at[0];
    const dz = t.z - s.at[2];
    const d = Math.hypot(dx, dz);
    if (d > range || d >= bd) continue;
    const off = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - s.yaw), Math.cos(Math.atan2(dx, dz) - s.yaw)));
    if (off > cone * DEG) continue;
    best = t;
    bd = d;
  }
  return best;
}

function stepSaber(sim, s, now, dt, out) {
  const H = s.hero;
  const sab = H.saber;
  // (the rage's endless stamina: Affector_RemoveAffector_InfiniteMeleeStamina)
  if (H.rage) sab.state.stamina = sab.rules.stamina.max;
  if (H.queued && H.strike && now - H.strike.t0 >= T.next - 1e-9) strike(sim, s, now);
  const me = { x: s.at[0], z: s.at[2], yaw: s.yaw, y: s.at[1] };
  const targets = [];
  for (const o of enemiesOf(sim, s)) if (Math.hypot(o.at[0] - s.at[0], o.at[2] - s.at[2]) < 10) targets.push({ id: o.id, x: o.at[0], z: o.at[2], yaw: o.yaw, y: o.at[1], sim: o.hero?.saber ?? null });
  for (const ev of sab.step(dt, now, { me, targets, aim: aimYaw(s) })) {
    if (ev.type === 'hit') {
      const o = sim.entities.get(ev.id);
      if (!o?.alive) continue;
      const d = [o.at[0] - s.at[0], 0, o.at[2] - s.at[2]];
      const L = Math.hypot(d[0], d[2]) || 1;
      out.push({ type: 'blast', part: 'saber', kind: 'saber', by: s.id, team: s.team, at: chestOf(o), hits: [{ id: o.id, damage: ev.damage, dir: [d[0] / L, 0, d[2] / L] }] });
      o.hitReactAt = now;
    } else if (ev.type === 'blocked' || ev.type === 'clash' || ev.type === 'broken') sim.out?.push({ t: now, type: 'saber', how: ev.type, by: s.id, target: ev.id ?? null });
  }
  // the lunge: the strike's clip warped onto its pick (Physics_WarpAttackMiss
  // with an external target), closed on before the kill window opens, to
  // where the query reaches it; one already in reach (the lunge's 1.8 m
  // filter) is squared up to and stepped onto the same way
  const into = now - (H.strike?.t0 ?? -Infinity);
  if (H.strike && into < T.contact[0]) {
    const pick = sab.state.lunge ?? nearest(targets, s, 1.8 + 0.5, 60);
    if (pick) {
      const dx = pick.x - s.at[0];
      const dz = pick.z - s.at[2];
      const d = Math.hypot(dx, dz);
      s.yaw = Math.atan2(dx, dz);
      const gap = d - KIT.hand.lunge.stop;
      const speed = Math.min(KIT.hand.lunge.max, Math.max(KIT.drives.attack.speed, gap / Math.max(dt, T.contact[0] - into)));
      if (gap > 0) slide(sim.nav, s, (dx / d) * Math.min(gap, speed * dt), (dz / d) * Math.min(gap, speed * dt));
    }
  }
  s.blocking = sab.state.blocking;
}

function stepBeam(sim, s, now, out) {
  const H = s.hero;
  if (!H.beam || now < H.beam.next) return;
  H.beam.next = now + KIT.hand.lightning.tick;
  const yaw = aimYaw(s);
  const hits = enemiesOf(sim, s)
    .filter((o) => inReach(sim, s, o, { range: BEAM.range, cone: BEAM.cone, yaw }))
    .map((o) => {
      const d = [o.at[0] - s.at[0], 0, o.at[2] - s.at[2]];
      const L = Math.hypot(d[0], d[2]) || 1;
      return { id: o.id, damage: BEAM.damage, dir: [d[0] / L, 0, d[2] / L] };
    });
  if (hits.length) out.push({ type: 'blast', part: 'force', kind: 'lightning', by: s.id, team: s.team, at: chestOf(s), hits });
}

export function stepHeroes(sim) {
  const now = sim.time;
  const dt = STEP;
  const out = [];
  for (const s of sim.entities.values()) {
    if (s.kind !== 'soldier') continue;
    // (a shove carries whoever took it, hero or trooper)
    if (s.knock) {
      if (now >= s.knock.until || !s.alive) s.knock = null;
      else slide(sim.nav, s, s.knock.v[0] * dt, s.knock.v[1] * dt);
    }
    const H = s.hero;
    if (!H) continue;
    if (!s.alive) {
      // (what a fallen hero left out goes with it, once)
      if (!H.dropped) dropBlaster(sim, s);
      H.dropped = true;
      continue;
    }
    if (H.air) stepAir(sim, s, now, dt);
    if (H.saber) stepSaber(sim, s, now, dt, out);
    if (H.lightning) stepBeam(sim, s, now, out);
    for (const r of stepEffects(sim, s, now, dt)) out.push(r);
    for (const r of stepBlaster(sim, s, now)) out.push(r);
  }
  return out;
}

// a press an active ability takes for itself (Leia's next detonator): the abilities' own press is skipped
export const heroPress = (sim, s, slot, now = sim.time) => Boolean(s.hero) && pressBlaster(sim, s, slot, now);

export function deflect(sim, t, hit) {
  const H = t.hero;
  if (!H?.saber?.deflecting) return false;
  // (a bolt coming at the front: the shield sits ahead of the hero)
  const d = hit.dir;
  if (d[0] * Math.sin(t.yaw) + d[2] * Math.cos(t.yaw) >= 0) return false;
  const damage = damageAt(hit.bolt.weapon, hit.dist);
  // (out of stamina: the block breaks and the bolt lands)
  if (!H.saber.takeBolt(damage, sim.time)) return false;
  const from = chestOf(t);
  const shooter = sim.entities.get(hit.bolt.owner);
  let dir = [-d[0], -d[1], -d[2]];
  if (shooter?.alive) {
    const c = chestOf(shooter);
    const v = [c[0] - from[0], c[1] - from[1], c[2] - from[2]];
    const L = Math.hypot(...v) || 1;
    dir = v.map((x) => x / L);
  }
  // (the hero's spread of the return: LIGHTSABER_COSTS_SPREAD, read as degrees)
  const spread = (H.saber.rules.stamina.spread ?? 0) * DEG;
  if (spread > 0) {
    const yaw = Math.atan2(dir[0], dir[2]) + (sim.rand() - 0.5) * 2 * spread;
    const pitch = Math.asin(Math.max(-1, Math.min(1, dir[1]))) + (sim.rand() - 0.5) * 2 * spread;
    dir = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  }
  fireBolt(sim.bolts, { from, dir, speed: D.speed, range: DEFLECTED.range, ttl: D.ttl, team: t.team, owner: t.id, weapon: DEFLECTED, colour: hit.bolt.colour, now: sim.time });
  sim.out?.push({ t: sim.time, type: 'deflect', by: t.id, target: hit.bolt.owner ?? null, at: hit.at ? [...hit.at] : null });
  return true;
}

export function actOf(s, now) {
  const H = s.hero;
  if (!H) return null;
  const st = H.strike && now - H.strike.t0 < T.rest ? H.strike : null;
  return {
    strike: st ? st.i : null,
    strikeT: st ? now - st.t0 : null,
    blocking: Boolean(s.blocking),
    ability: H.act?.kind ?? null,
    abilityId: H.act?.id ?? null,
    abilityT: H.act ? now - H.act.since : null,
    slot: H.act?.slot ?? null,
    air: Boolean(H.air),
    beam: Boolean(H.beam),
    thrown: H.thrown ? H.thrown.at : null,
    rush: Boolean(H.rush),
  };
}

// a bolt a saber hero's block turned, or a Squad Shield took from outside it: that bolt is gone
export const heroTakes = (sim, target, hit, damage) => Boolean((target.hero && deflect(sim, target, hit)) || domed(sim, target, hit.bolt, damage));

// A round that bursts where it lands (the bowcaster's bolt, a micro-grenade, the pulse cannon's): its blast is the
// kit's to apply, by the factor its bolt had: a bot's half (the AI's bolt), the difficulty's scale on a human, and
// nothing at all while the buckets' grace holds the bolt itself to nothing.
export function burstAt(sim, hit, { shooter = null, scale = 1, grace = true } = {}) {
  const blast = hit.bolt.weapon?.damage?.blast;
  const k = grace ? (shooter?.bot && !hit.bolt.weapon.aiDamage ? AI_DAMAGE_SCALE : 1) * scale : 0;
  if (!(blast?.damage > 0) || !(k > 0)) return;
  sim.kit.blasts.push({ by: hit.bolt.owner, team: hit.bolt.team, at: hit.at.slice(), row: { id: 'bolt', inner: blast.inner, damage: blast.damage * k, radius: blast.radius, multiplier: 1 } });
}

export function viewHero(e, s, now) {
  e.act = s.hero ? actOf(s, now) : null;
  e.struckAt = s.hitReactAt ?? null;
  e.lift = s.lift ?? 0;
  // (inside Lando's smoke, of either side: kit.js's field sets it while the smoke stands)
  e.smoked = (s.hiddenUntil ?? -Infinity) > now;
}
