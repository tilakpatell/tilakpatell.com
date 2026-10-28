import { describe, expect, it } from 'vitest';
import golden from './fixtures/health.json';
import { differs, fixed } from './fixtures/golden.js';
import { E11, E11_AI, TICK, falloffDamage } from './blasterWeapon.js';
import { ASSAULT, HEALTH_STATE, RELATION, SKIRMISH_BOT, TROOPER, alive, createHealth, hit, reset, update } from './soldierHealth.js';

// bf2-web's health driver (WebPort/physics/player/soldier-health-driver.cpp) played through the JavaScript: bolts every
// 6 ticks (300 rpm) from tick 0 until the soldier dies or n are fired, then the ticks run on
const DEFAULT_CELL = { multiplier: 1, penetration: 1, threshold: 2 };
const bolt = (weapon, distance, relation) => ({ damage: falloffDamage(weapon, distance), relation, bullet: true });

function shoot(name, config, weapon, distance, relation, bolts, ticks) {
  const h = createHealth(config);
  const hits = [];
  let fired = 0;
  let killTick = -1;
  let goneTick = -1;
  let regenTick = -1;
  let fullTick = -1;
  for (let t = 0; t < ticks; t++) {
    if (fired < bolts && t % 6 === 0 && alive(h)) {
      const r = hit(h, bolt(weapon, distance, relation));
      hits.push([t, fixed(r.relationDamage, 4), fixed(r.damage, 4), fixed(h.health, 4), r.applied, r.killed]);
      fired++;
      if (r.killed) killTick = t;
    }
    if (update(h, TICK)) goneTick = t;
    if (regenTick < 0 && h.regenerating) regenTick = t;
    if (regenTick >= 0 && fullTick < 0 && alive(h) && h.health >= h.config.maxHealth) fullTick = t;
  }
  return { scenario: name, max: fixed(h.config.maxHealth, 4), hits, killTick, goneTick, regenTick, fullTick, health: fixed(h.health, 4), state: h.state };
}

const SCENARIOS = {
  'bot-body': () => shoot('bot-body', SKIRMISH_BOT, E11, 15, RELATION.body, 10, 400),
  'bot-head': () => shoot('bot-head', SKIRMISH_BOT, E11, 10, RELATION.head, 10, 400),
  'bot-30m': () => shoot('bot-30m', SKIRMISH_BOT, E11, 30, RELATION.body, 10, 60),
  'bot-50m': () => shoot('bot-50m', SKIRMISH_BOT, E11, 50, RELATION.body, 20, 120),
  'assault-body': () => shoot('assault-body', ASSAULT, E11, 15, RELATION.body, 10, 60),
  'assault-head': () => shoot('assault-head', ASSAULT, E11, 15, RELATION.head, 10, 60),
  'ai-on-assault': () => shoot('ai-on-assault', ASSAULT, E11_AI, 15, RELATION.body, 20, 120),
  'assault-regen': () => shoot('assault-regen', ASSAULT, E11_AI, 15, RELATION.body, 1, 360),
  'trooper-regen': () => shoot('trooper-regen', TROOPER, E11, 15, RELATION.body, 1, 600),
  'bot-regen': () => shoot('bot-regen', SKIRMISH_BOT, E11, 15, RELATION.body, 1, 900),
  threshold() {
    const h = createHealth(TROOPER);
    const a = hit(h, { damage: 1.5, relation: DEFAULT_CELL, bullet: true });
    const b = hit(h, { damage: 2, relation: DEFAULT_CELL, bullet: true });
    const c = hit(h, { ...bolt(E11, 5, RELATION.body), friendly: true });
    const afterFriendly = h.health;
    const d = hit(h, { ...bolt(E11, 5, RELATION.body), self: true });
    return {
      scenario: 'threshold', below: [a.applied, fixed(a.damage, 4)], at: [b.applied, fixed(b.damage, 4)],
      friendly: [c.applied, fixed(c.damage, 4), fixed(afterFriendly, 4)], self: [d.applied, fixed(d.damage, 4), fixed(h.health, 4)],
    };
  },
  respawn() {
    const h = createHealth(SKIRMISH_BOT);
    for (let i = 0; i < 3; i++) hit(h, bolt(E11, 10, RELATION.body));
    const late = hit(h, bolt(E11, 10, RELATION.head));
    const dead = h.state;
    reset(h, SKIRMISH_BOT);
    return { scenario: 'respawn', deadState: dead, lateApplied: late.applied, lateDamage: fixed(late.damage, 4), health: fixed(h.health, 4), alive: alive(h) };
  },
};

const run = (name) => SCENARIOS[name]();

describe('the soldier’s health, against bf2-web', () => {
  for (const [name, { records }] of Object.entries(golden.scenarios)) {
    it(`${name}: what the native driver printed`, () => {
      expect(differs(records[0], run(name))).toBeNull();
    });
  }
});

// bf2-web's gate's checks (WebPort/tests/soldier-health.mjs), read off the JavaScript
describe('the soldier’s health, as bf2-web’s gate reads it', () => {
  it('takes three body bolts or two head bolts to kill a Skirmish bot', () => {
    expect(run('bot-body').hits).toHaveLength(3);
    expect(run('bot-head').hits).toHaveLength(2);
  });

  it('takes five body bolts or three head bolts to kill the Assault, and nine of the AI’s', () => {
    expect(run('assault-body')).toMatchObject({ max: 150, killTick: 24 });
    expect(run('assault-body').hits[3][3]).toBe(6);
    expect(run('assault-head')).toMatchObject({ killTick: 12 });
    expect(run('ai-on-assault')).toMatchObject({ killTick: 48 });
    expect(run('ai-on-assault').hits[0][1]).toBe(18);
  });

  it('regenerates the trooper 5/s after 10 s, and never the Skirmish bot', () => {
    const t = run('trooper-regen');
    expect(t.regenTick).toBeGreaterThanOrEqual(299);
    expect(t.regenTick).toBeLessThanOrEqual(301);
    expect(t.fullTick - t.regenTick).toBeGreaterThanOrEqual(215);
    expect(run('bot-regen')).toMatchObject({ regenTick: -1, health: 64 });
  });

  it('takes nothing below a cell’s threshold, nothing from a friend, and a corpse takes nothing', () => {
    const t = run('threshold');
    expect(t.below).toEqual([false, 0]);
    expect(t.at[0]).toBe(true);
    expect(t.friendly[1]).toBe(0);
    expect(run('respawn')).toMatchObject({ deadState: HEALTH_STATE.corpse, lateApplied: true, lateDamage: 0, health: 100, alive: true });
  });
});
