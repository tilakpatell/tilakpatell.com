import { describe, expect, it } from 'vitest';
import { loadRulebook } from './rulebook.js';
import { field } from './fixtures/field.js';
import { buildNav } from './nav.js';
import { addPlayer, createSim, step } from './sim.js';
import { state } from './abilities.js';
import { hurt, speedOf } from './soldier.js';
import { KIT, PRESENCE_COOLING, kitRow, kitWeapon, slotsOf } from './kit.js';
import { GRENADES, THROW } from './grenades.js';

const rb = loadRulebook();
const nav = () => buildNav(field());
const SLOT = { left: 1, middle: 2, right: 3 };
const idle = (id) => ({ id, move: [0, 0] });

function pair(cls = 'assault', { gap = 20, facing = Math.PI } = {}) {
  const sim = createSim({ rulebook: rb, nav: nav(), seed: 2 });
  const me = addPlayer(sim, { team: 1, classId: `l-orig-${cls}`, at: [0, 0, -40], yaw: 0 });
  const them = addPlayer(sim, { team: 2, classId: 'd-orig-assault', at: [0, 0, -40 + gap], yaw: facing });
  const s = sim.entities.get(me);
  const t = sim.entities.get(them);
  for (const e of [s, t]) e.bot = false;
  sim.brains.brains.clear();
  return { sim, s, t, me, them };
}
const run = (sim, inputs, n) => {
  const out = [];
  for (let i = 0; i < n; i++) out.push(...step(sim, inputs(i)));
  return out;
};
const aimAt = (s, t) => [t.at[0], t.at[1] + 1.2, t.at[2]];
// level with the eye, far ahead: the reticle on the horizon
const level = (s) => [s.at[0], s.at[1] + 1.55, s.at[2] + 100];
// the ground a few metres ahead: a short lob
const feet = (s, d) => [s.at[0], 0.2, s.at[2] + d];
const of = (ev, type) => ev.filter((e) => e.type === type);

describe('the kit (finding 33)', () => {
  it('gives every row the kit’s fields: the infinite actives, the toggles, the blocks', () => {
    const sentry = kitRow({ id: 'DefaultAbility_Heavy_Sentry', activation: 0, recharge: 30 });
    expect(sentry.active).toBe(Infinity);
    expect(sentry.activation).toBe(0.9);
    const shield = kitRow({ id: 'DefaultAbility_Heavy_CombatShield', recharge: 30 });
    expect(shield.retrigger).toEqual({ count: 1, cooldown: 2 });
    expect(shield.kit.shield.health).toBe(250);
    const nade = kitRow({ id: 'DefaultAbility_Assault_ThermalDetonator', activation: 0.32, active: 0.7, recharge: 35 });
    expect(nade.blocks).toEqual(['DefaultAbility_Assault_Vanguard', 'DefaultAbility_Assault_ScanDart']);
    expect(kitRow({ id: 'other' })).toEqual({ id: 'other' });
    expect(kitWeapon('sentry').firing).toMatchObject({ rof: 900, preFire: 1 });
    expect(kitWeapon('sentry').heat.perBullet).toBe(0.0035);
    expect(kitWeapon('turret').lock.time).toBe(1);
    expect(kitWeapon('turret').damage).toMatchObject({ start: 25, end: 15 });
    expect(kitWeapon('turret').damageAP).toMatchObject({ start: 8.3333, end: 5 });
    expect(KIT.roll).toMatchObject({ taken: 0.8, seconds: 2 });
  });

  it('throws the thermal detonator at the pull’s end on a tap, 28 m on flat ground, and it blasts 200 inside 2 m', () => {
    const { sim, s, t, me } = pair('assault', { gap: 28 });
    const ev = run(sim, (i) => [{ id: me, move: [0, 0], aim: level(s), ability: i === 0 ? SLOT.left : 0 }], 12);
    const thrown = of(ev, 'throw')[0];
    expect(thrown.kind).toBe('thermal');
    // (pressed at 0.05, pulled 0.32: the first step past 0.37)
    expect(thrown.t).toBeCloseTo(0.4, 6);
    // (the throw's 0.7 s: active to 1.07, the middle and the right blocked meanwhile)
    expect(state(s.abilities, SLOT.left)).toBe('active');
    expect(state(s.abilities, SLOT.middle)).toBe('blocked');
    const more = run(sim, () => [idle(me)], 80);
    expect(of(more, 'ability').find((e) => e.phase === 'end').t).toBeCloseTo(1.1, 6);
    expect(state(s.abilities, SLOT.left)).toBe('recharge');
    expect(state(s.abilities, SLOT.middle)).toBe('ready');
    const boom = of(more, 'explosion')[0];
    expect(boom.kind).toBe('thermal');
    expect(Math.hypot(boom.at[0] - s.at[0], boom.at[2] - s.at[2])).toBeGreaterThan(27);
    expect(Math.hypot(boom.at[0] - s.at[0], boom.at[2] - s.at[2])).toBeLessThan(29.5);
    expect(boom.radius).toBeCloseTo(6 * 0.84, 9);
    const hit = more.find((e) => e.type === 'hit' && e.part === 'blast');
    expect(hit.damage).toBeGreaterThan(190);
    expect(t.alive).toBe(false);
    expect(of(more, 'kill')[0]).toMatchObject({ by: me, target: t.id, part: 'blast' });
    expect(sim.kit.grenades).toHaveLength(0);
  });

  it('holds the grenade while the key stays down: thrown on its release, or 3.2 s after the press', () => {
    const early = pair('assault', { gap: 15 });
    const e1 = run(early.sim, (i) => [{ id: early.me, move: [0, 0], aim: level(early.s), ability: i === 0 ? SLOT.left : 0, abilityHeld: i < 20 ? SLOT.left : 0 }], 30);
    // (the key up on the twenty-first step: 1.05 s)
    expect(of(e1, 'throw')[0].t).toBeCloseTo(1.05, 6);
    const { sim, s, me } = pair('assault', { gap: 15 });
    const ev = run(sim, (i) => [{ id: me, move: [0, 0], aim: level(s), ability: i === 0 ? SLOT.left : 0, abilityHeld: SLOT.left }], 60);
    expect(of(ev, 'throw')).toHaveLength(0);
    // (past its 0.7 s the ability is still active: the grenade is in the hand)
    expect(state(s.abilities, SLOT.left)).toBe('active');
    const late = run(sim, () => [{ id: me, move: [0, 0], aim: level(s), abilityHeld: SLOT.left }], 10);
    expect(of(late, 'throw')[0].t - 0.05).toBeCloseTo(THROW.hold[1], 6);
    expect(state(s.abilities, SLOT.left)).toBe('recharge');
  });

  it('blocks the middle and the right while the grenade is in the hand', () => {
    const { sim, s, t, me } = pair('assault', { gap: 15 });
    step(sim, [{ id: me, move: [0, 0], aim: aimAt(s, t), ability: SLOT.left, abilityHeld: SLOT.left }]);
    expect(state(s.abilities, SLOT.middle)).toBe('blocked');
    expect(slotsOf(s).map((x) => x.state)).toEqual(['activating', 'blocked', 'blocked']);
  });

  it('drops the grenade at 0.34 of the throw when its holder is killed', () => {
    const { sim, s, me } = pair('assault', { gap: 40 });
    run(sim, (i) => [{ id: me, move: [0, 0], aim: level(s), ability: i === 0 ? SLOT.left : 0, abilityHeld: SLOT.left }], 12);
    hurt(s, { damage: 1e4, now: sim.time });
    const ev = step(sim, []);
    expect(of(ev, 'throw')).toHaveLength(1);
    expect(Math.hypot(...sim.kit.grenades[0].vel)).toBeLessThan(25.24 * THROW.killedPower + 0.6);
    expect(sim.kit.armed.size).toBe(0);
  });

  it('deploys the sentry in 0.9 s, spins it up for 1 s, fires 900 rpm and ends by its heat after 286 bolts in 19 s', () => {
    const { sim, s, t, me } = pair('heavy', { gap: 30 });
    const ev = run(sim, (i) => [{ id: me, move: [0, 0], aim: aimAt(s, t), ability: i === 0 ? SLOT.middle : 0, fire: i > 0 }], 440);
    const ended = of(ev, 'ability').find((e) => e.phase === 'end');
    // (the rifle comes back after it: its shots are not the sentry's)
    const shots = ev.filter((e) => e.type === 'shot' && e.by === me && e.t < ended.t);
    // (pressed at 0.05: up at 0.95, the first bolt a second on)
    expect(shots[0].t).toBeCloseTo(1.95, 6);
    expect(shots.filter((e) => e.t < 2.95 - 1e-9)).toHaveLength(15);
    expect(shots).toHaveLength(286);
    expect(shots.at(-1).t - shots[0].t).toBeCloseTo(19, 1);
    expect(ended.why).toBe('heat');
    expect(s.gun.row.id).not.toBe('sentry');
    expect(s.gunBase).toBe(null);
    expect(state(s.abilities, SLOT.middle)).toBe('recharge');
  });

  it('walks the sentry at 1.22 m/s and tightens its cone a tenth of a degree a bolt, from 1° to 0.5°', () => {
    const { sim, s, t, me } = pair('heavy', { gap: 30 });
    run(sim, (i) => [{ id: me, move: [0, 0], aim: aimAt(s, t), ability: i === 0 ? SLOT.middle : 0 }], 20);
    expect(s.gun.row.id).toBe('sentry');
    expect(speedOf(s)).toBe(1.22);
    expect(s.gun.spread).toBe(0);
    run(sim, () => [{ id: me, move: [0, 0], aim: aimAt(s, t), fire: true }], 21);
    // (the first bolt: 0.1° off the cone)
    expect(s.gun.spread).toBeCloseTo(-0.1, 9);
    run(sim, () => [{ id: me, move: [0, 0], aim: aimAt(s, t), fire: true }], 8);
    expect(s.gun.spread).toBeCloseTo(-0.5, 9);
  });

  it('raises the combat shield with 250 health that takes the shots from the front, and lowers it on a second press after 2 s', () => {
    const { sim, s, t, me, them } = pair('heavy', { gap: 20 });
    step(sim, [{ id: me, move: [0, 0], ability: SLOT.right }]);
    expect(s.shield).toMatchObject({ hp: 250, max: 250 });
    // (the sentry shares its channel: blocked while the shield is up)
    expect(state(s.abilities, SLOT.middle)).toBe('blocked');
    const before = s.hp;
    run(sim, () => [idle(me), { id: them, move: [0, 0], fire: true, aim: aimAt(t, s) }], 20);
    expect(s.hp).toBe(before);
    expect(s.shield.hp).toBeLessThan(250);
    // the rifle is lowered behind it
    expect(run(sim, () => [{ id: me, move: [0, 0], fire: true, aim: aimAt(s, t) }], 4).filter((e) => e.type === 'shot' && e.by === me)).toHaveLength(0);
    // (a second press before the 2 s: nothing)
    expect(step(sim, [{ id: me, move: [0, 0], ability: SLOT.right }]).some((e) => e.type === 'ability' && e.phase === 'end')).toBe(false);
    run(sim, () => [idle(me)], 40);
    const ev = step(sim, [{ id: me, move: [0, 0], ability: SLOT.right }]);
    expect(ev.find((e) => e.type === 'ability' && e.phase === 'end')?.why).toBe('retrigger');
    expect(s.shield).toBe(null);
    expect(state(s.abilities, SLOT.right)).toBe('recharge');
  });

  it('ends the shield when its 250 health is gone, and the rest of that shot reaches the heavy', () => {
    const { sim, s, me } = pair('heavy', { gap: 20 });
    step(sim, [{ id: me, move: [0, 0], ability: SLOT.right }]);
    s.shield.hp = 10;
    s.over = null;
    const before = s.hp;
    // (a blast from the front: the shield's 10, then the body)
    sim.kit.blasts.push({ by: 'x', team: 2, at: [0, 1.2, -39.2], row: { ...GRENADES.impact, owner: false }, multiplier: 1 });
    step(sim, [idle(me)]);
    expect(s.shield).toBe(null);
    expect(before - s.hp).toBeCloseTo(110, 0);
    expect(of(step(sim, [idle(me)]), 'ability').some((e) => e.phase === 'end' && e.why === 'health')).toBe(true);
  });

  it('places the officer’s turret, which locks a target in 1 s and fires 5-bolt bursts of 25, and dies to its 250 health with a blast', () => {
    const { sim, s, t, me } = pair('officer', { gap: 12 });
    run(sim, (i) => [{ id: me, move: [0, 0], ability: i === 0 ? SLOT.right : 0 }], 10);
    const turret = [...sim.entities.values()].find((e) => e.kind === 'turret');
    expect(turret).toBeTruthy();
    expect(turret.hp).toBe(250);
    // (pressed at 0.05, placed after its 0.4 s; 2 m ahead of the officer)
    expect(turret.born).toBeCloseTo(0.45, 6);
    expect(turret.at[2] - s.at[2]).toBeCloseTo(2, 6);
    // (the presence can be pressed beside the standing turret)
    expect(state(s.abilities, SLOT.middle)).toBe('ready');
    const ev = run(sim, () => [idle(me)], 60);
    const shots = ev.filter((e) => e.type === 'shot' && e.by === turret.id);
    expect(shots[0].t - turret.born).toBeCloseTo(1, 6);
    // (340 rpm: five bolts in 0.75 s, then the magazine's sixth a second after the burst began, then the 2 s reload)
    expect(shots.filter((e) => e.t < shots[0].t + 0.8)).toHaveLength(5);
    expect(shots.filter((e) => e.t < shots[0].t + 2.9)).toHaveLength(6);
    const hits = ev.filter((e) => e.type === 'hit' && e.by === turret.id);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].damage).toBeCloseTo(25, 1);
    expect(state(s.abilities, SLOT.right)).toBe('active');
    turret.hp = 1;
    t.hp = t.hpMax;
    const down = run(sim, () => [idle(me), { id: t.id, move: [0, 0], fire: true, aim: [turret.at[0], turret.at[1] + 0.6, turret.at[2]] }], 20);
    expect(down.some((e) => e.type === 'turretDown')).toBe(true);
    expect(sim.entities.has(turret.id)).toBe(false);
    expect(state(s.abilities, SLOT.right)).toBe('recharge');
    expect(of(down, 'ability').find((e) => e.phase === 'end').why).toBe('destroyed');
  });

  it('picks the turret up on a second press after 2 s, and gives a bot’s turret the AutoPlayer’s bolt', () => {
    const { sim, s, me } = pair('officer', { gap: 80 });
    run(sim, (i) => [{ id: me, move: [0, 0], ability: i === 0 ? SLOT.right : 0 }], 50);
    const ev = step(sim, [{ id: me, move: [0, 0], ability: SLOT.right }]);
    expect(of(ev, 'turretGone')[0]).toMatchObject({ why: 'removed' });
    expect([...sim.entities.values()].some((e) => e.kind === 'turret')).toBe(false);
    expect(state(s.abilities, SLOT.right)).toBe('recharge');
    const bot = pair('officer', { gap: 80 });
    bot.s.bot = true;
    run(bot.sim, (i) => [{ id: bot.me, move: [0, 0], ability: i === 0 ? SLOT.right : 0 }], 10);
    expect([...bot.sim.entities.values()].find((e) => e.kind === 'turret').weapon.damage.start).toBe(8.3333);
  });

  it('gives the officer’s presence +100 overhealth to friendlies within 13 m, taken before the health, and faster cooling for 10 s', () => {
    const { sim, s, t, me, them } = pair('officer', { gap: 12 });
    const mateId = addPlayer(sim, { team: 1, classId: 'l-orig-assault', at: [5, 0, -40], yaw: 0 });
    const farId = addPlayer(sim, { team: 1, classId: 'l-orig-assault', at: [30, 0, -40], yaw: 0 });
    const mate = sim.entities.get(mateId);
    const far = sim.entities.get(farId);
    mate.bot = far.bot = false;
    sim.brains.brains.clear();
    run(sim, (i) => [{ id: me, move: [0, 0], ability: i === 0 ? SLOT.middle : 0 }], 12);
    expect(s.over.hp).toBe(100);
    expect(mate.over.hp).toBe(100);
    expect(far.over).toBeUndefined();
    expect(t.over).toBeUndefined();
    expect(s.gun.coolMul).toBe(PRESENCE_COOLING);
    run(sim, () => [idle(me), { id: them, move: [0, 0], fire: true, aim: aimAt(t, s) }], 10);
    expect(s.hp).toBe(s.hpMax);
    expect(s.over.hp).toBeLessThan(100);
    run(sim, () => [idle(me)], 240);
    expect(s.over).toBe(null);
    expect(s.gun.coolMul).toBe(1);
  });

  it('runs the vanguard’s scattergun of 21 pellets for 12.5 s and infiltration’s EE-4 for 16.7 s, sprinting 1.3 times as fast, then gives the rifle back', () => {
    const { sim, s, t, me } = pair('assault', { gap: 8 });
    const base = s.gun.row.id;
    const ev = run(sim, (i) => [{ id: me, move: [0, 0], aim: aimAt(s, t), ability: i === 0 ? SLOT.middle : 0, fire: i === 2 }], 4);
    expect(s.gun.row.id).toBe('hunter');
    expect(ev.filter((e) => e.type === 'shot' && e.by === me)).toHaveLength(21);
    const walk = speedOf(s);
    s.sprint = true;
    const sprint = speedOf(s);
    s.sprint = false;
    const more = run(sim, () => [idle(me)], 260);
    // (pressed at 0.05: over at 12.55, told the step after)
    expect(of(more, 'ability').find((e) => e.phase === 'end').t).toBeCloseTo(12.6, 6);
    expect(s.gun.row.id).toBe(base);
    expect(state(s.abilities, SLOT.middle)).toBe('recharge');
    s.sprint = true;
    expect(sprint / speedOf(s)).toBeCloseTo(1.3, 9);
    s.sprint = false;
    expect(speedOf(s)).toBe(walk);
    const spec = pair('specialist', { gap: 20 });
    const first = run(spec.sim, (i) => [{ id: spec.me, move: [0, 0], aim: aimAt(spec.s, spec.t), ability: i === 0 ? SLOT.middle : 0, fire: true }], 40).filter((e) => e.type === 'shot' && e.by === spec.me && e.t > 0.06);
    expect(spec.s.gun.row.id).toBe('ee4');
    expect(spec.s.hidden).toBe(true);
    // (the EE-4's own DeployTime 1.4: pressed at 0.05, its first burst at 1.45)
    expect(first[0].t).toBeCloseTo(1.45, 6);
    const rest = run(spec.sim, () => [idle(spec.me)], 300);
    expect(of(rest, 'ability').find((e) => e.phase === 'end').t).toBeCloseTo(16.8, 6);
    expect(spec.s.gun.row.id).not.toBe('ee4');
    expect(spec.s.hidden).toBe(false);
  });

  it('fires the scan dart 0.6 s after the press, which marks the enemies near where it sticks', () => {
    const { sim, s, t, me } = pair('assault', { gap: 20 });
    const ev = run(sim, (i) => [{ id: me, move: [0, 0], aim: feet(s, 18), ability: i === 0 ? SLOT.right : 0 }], 40);
    expect(of(ev, 'throw')[0]).toMatchObject({ kind: 'dart' });
    expect(of(ev, 'throw')[0].t).toBeCloseTo(0.65, 6);
    expect(of(ev, 'ability').find((e) => e.phase === 'end').why).toBe('fired');
    expect(t.markedUntil).toBeGreaterThan(sim.time);
    expect(state(s.abilities, SLOT.right)).toBe('recharge');
  });

  it('marks what the binoculars see for 10 s', () => {
    const spec = pair('specialist', { gap: 30 });
    run(spec.sim, (i) => [{ id: spec.me, move: [0, 0], ability: i === 0 ? SLOT.right : 0 }], 20);
    // (up 0.8 s after the press; each look marks for 10 s)
    expect(spec.t.markedUntil - spec.sim.time).toBeGreaterThan(9.9);
    expect(spec.t.markedUntil - spec.sim.time).toBeLessThanOrEqual(10);
    expect(state(spec.s.abilities, SLOT.right)).toBe('active');
  });

  it('splits the flash 3 s after it lands into five that blind an enemy facing them within 10 m for 5 s, not one facing away, not a friend', () => {
    const flashed = (facing) => {
      const off = pair('officer', { gap: 17, facing });
      const ev = run(off.sim, (i) => [{ id: off.me, move: [0, 0], aim: feet(off.s, 6), ability: i === 0 ? SLOT.left : 0 }], 120);
      return { ...off, ev };
    };
    const a = flashed(Math.PI);
    const split = of(a.ev, 'split')[0];
    const landed = a.ev.find((e) => e.type === 'throw').t;
    expect(split.t - landed).toBeGreaterThan(3);
    expect(split.t - landed).toBeLessThan(3.6);
    expect(of(a.ev, 'explosion').filter((e) => e.kind === 'flashSub')).toHaveLength(5);
    const flash = of(a.ev, 'explosion')[0];
    expect(a.t.flashedUntil - flash.t).toBeCloseTo(5, 6);
    expect(a.s.flashedUntil).toBeUndefined();
    expect(flashed(0).t.flashedUntil).toBeUndefined();
  });

  it('goes off 1.2 s after the shock grenade rests for 30, then stuns and burns 2 m at 10 a second for 3.7 s', () => {
    const sh = pair('specialist', { gap: 13 });
    const ev = run(sh.sim, (i) => [{ id: sh.me, move: [0, 0], aim: feet(sh.s, 6), ability: i === 0 ? SLOT.left : 0 }], 140);
    const boom = of(ev, 'explosion')[0];
    expect(boom.kind).toBe('shock');
    expect(ev.find((e) => e.type === 'hit' && e.part === 'blast').damage).toBeCloseTo(30, 6);
    expect(sh.t.stunnedUntil).toBeGreaterThan(boom.t);
    // (the blast's 30, then 37 ticks of 1: 3.7 s at 10 a second)
    expect(sh.t.hpMax - sh.t.hp).toBeGreaterThan(30 + 30);
    expect(sh.t.hpMax - sh.t.hp).toBeLessThanOrEqual(30 + 38);
    expect(GRENADES.shock.field.perSecond).toBe(10);
  });

  it('takes 0.8 of the damage for 2 s after a roll', () => {
    const { sim, s, me } = pair('assault');
    step(sim, [{ id: me, move: [0, 1], roll: true }]);
    expect(s.stack.entries.find((e) => e.id === 'Evading')).toMatchObject({ property: 'ArmorMultiplier', op: 'mul', value: 0.8 });
    const before = s.hp;
    hurt(s, { damage: 50, now: sim.time });
    expect(before - s.hp).toBeCloseTo(40, 9);
    run(sim, () => [idle(me)], 41);
    expect(s.stack.entries.find((e) => e.id === 'Evading')).toBeUndefined();
  });
});
