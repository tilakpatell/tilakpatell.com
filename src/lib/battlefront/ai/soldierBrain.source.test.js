// The soldier brain against the game’s AI source (tactics.js has the rules;
// docs/superpowers/evidence/bf-ai-source/README.md the sheet): the tactics’
// order and close combat, what sends a bot to hide and for how long, a hide’s
// fire, the firing patterns.
import { describe, expect, it } from 'vitest';
import { seeded } from '../../seeded.js';
import { aiOf, classOf, loadRulebook, weaponOf } from '../rulebook.js';
import { buildNav, lineClear, shields } from '../nav.js';
import { newSoldier } from '../soldier.js';
import { act, createBrain, think } from './soldierBrain.js';

const rb = loadRulebook();
const ai = aiOf(rb);
const open = buildNav({ heightAt: () => 0, bounds: { min: [-100, -100], max: [100, 100] }, cell: 2, solids: [], cover: ai.cover.constants });

function bot(at, over = {}, cls = 'l-orig-assault') {
  const c = classOf(rb, cls);
  const s = newSoldier(c, { id: 'me', team: 1, at, weapon: weaponOf(rb, c.weapon), rand: seeded(1) });
  return createBrain(s, { ai, rand: seeded(1), ...over });
}

const see = (brain, id, at, visible = true) => {
  brain.me.beliefs[id] = { id, at: { x: at[0], y: at[1], z: at[2] }, vel: { x: 0, y: 0, z: 0 }, confidence: 1, visible, seenAt: 0, hostile: true };
};

const world = (extra = {}) => ({ nav: open, lineClear: (a, b) => lineClear(open, a, b), shields, squad: null, objective: null, enemies: [], taken: new Map(), ...extra });

describe('the tactics’ order and close combat', () => {
  it('closes with an enemy seen 4 m off before it hides, hurt as it is', () => {
    const b = bot([0, 0, 0]);
    b.s.hp = b.s.hpMax * 0.3;
    see(b, 'them', [0, 1.2, 4]);
    expect(think(b, world(), 1).mode).toBe('close');
  });

  it('a Skirmish bot, whose row has no hide, fights on hurt and under fire', () => {
    const b = bot([0, 0, 0], { pve: true });
    b.s.hp = b.s.hpMax * 0.3;
    b.s.suppressed = 1;
    see(b, 'them', [0, 1.2, 30]);
    expect(['attack', 'cover']).toContain(think(b, world(), 1).mode);
  });

  it('holds close combat three seconds, keeps it inside the row’s limit, and leaves it past', () => {
    const b = bot([0, 0, 0]);
    see(b, 'them', [0, 1.2, 4]);
    expect(think(b, world(), 1).mode).toBe('close');
    // (10 m: past the 6 m it is entered at, inside the 12 m it is kept to)
    see(b, 'them', [0, 1.2, 10]);
    expect(think(b, world(), 2).mode).toBe('close');
    expect(think(b, world(), 4.5).mode).toBe('close');
    see(b, 'them', [0, 1.2, 14]);
    expect(think(b, world(), 5).mode).not.toBe('close');
  });

  it('is begun by a bot sidestepping in the open, which the source has standing, and not by one moving away', () => {
    const b = bot([0, 0, 0]);
    see(b, 'them', [0, 1.2, 20]);
    expect(think(b, world(), 1).mode).toBe('attack');
    b.s.vel = [3, 0, 0];
    see(b, 'them', [0, 1.2, 4]);
    expect(think(b, world(), 1.2).mode).toBe('close');
    const c = bot([0, 0, 0]);
    c.s.vel = [0, 0, -3];
    see(c, 'them', [0, 1.2, 4]);
    expect(think(c, world(), 1).mode).not.toBe('close');
  });

  it('does not begin it on an enemy unseen, or one far above', () => {
    const b = bot([0, 0, 0]);
    see(b, 'them', [0, 1.2, 4], false);
    expect(think(b, world(), 1).mode).not.toBe('close');
    const c = bot([0, 0, 0]);
    see(c, 'them', [0, 20, 4]);
    expect(think(c, world(), 1).mode).not.toBe('close');
  });
});

// the source’s one cause for hiding: a target the bot’s AI weapon is not valid against (a shielded walker,
// for a weapon valid against soldiers alone; no AI weapon of the game’s is so made, tactics.js)
const armoured = (b) => {
  b.aiWeapon = { ...b.aiWeapon, validAgainst: 'Soldiers' };
  return b;
};
const walker = (id) => (id === 'them' ? { id, kind: 'walker', shielded: true, alive: true, at: [0, 0, 0] } : null);

describe('what sends a bot to hide, and for how long', () => {
  it('neither suppression nor wounds: a bot whose weapon can hurt its target fights on', () => {
    const b = bot([0, 0, -50]);
    b.s.suppressed = 1;
    b.s.hp = b.s.hpMax * 0.2;
    see(b, 'them', [0, 1.2, -20]);
    expect(['attack', 'cover']).toContain(think(b, world(), 1).mode);
  });

  it('a target its weapon cannot hurt, and it hides the drawn five to ten seconds after', () => {
    const b = armoured(bot([0, 0, -50]));
    see(b, 'them', [0, 1.2, -20]);
    expect(think(b, world({ who: walker }), 1).mode).toBe('hide');
    // (the walker gone, a trooper in its place: hidden still for the hold, then fighting)
    const trooper = (id) => (id === 'them' ? { id, kind: 'soldier', alive: true, at: [0, 0, -20] } : null);
    expect(think(b, world({ who: trooper }), 2).mode).toBe('hide');
    expect(think(b, world({ who: trooper }), 5.9).mode).toBe('hide');
    expect(think(b, world({ who: trooper }), 11.5).mode).not.toBe('hide');
  });
});

describe('a hide’s fire', () => {
  it('fires from its cover once in it, and not on the way there', () => {
    const slot = { at: [0, 0, -10], normal: [0, 1], height: 'stand' };
    const fire = (at) => {
      const b = armoured(bot(at));
      b.cover = slot;
      see(b, 'them', [0, 1.2, 10]);
      return think(b, world({ lineClear: () => true, shields: () => true, taken: new Map([[slot, 'me']]), who: walker }), 1);
    };
    const there = fire([0, 0, -10]);
    expect(there.mode).toBe('hide');
    expect(there.fire).toBe(true);
    const going = fire([5, 0, -15]);
    expect(going.mode).toBe('hide');
    expect(going.fire).toBe(false);
  });
});

describe('the firing patterns', () => {
  // a bot attacking an enemy 20 m off with a clear line: the steps on which it asked its gun for a shot
  const firing = (b, steps, { fire = true, t0 = 0 } = {}) => {
    const asked = [];
    let n = 0;
    const w = { nav: open, lineClear: () => true, shoot: () => ++n > 0 };
    for (let i = 0; i < steps; i++) {
      const before = n;
      act(b, { mode: 'attack', target: 'them', goal: null, stance: 'stand', fire, aim: [0, 1.2, 20] }, b.s, 0.05, w, t0 + i * 0.05);
      asked.push(n > before);
    }
    return asked;
  };

  it('are the AI weapon’s own class: an SMG’s for the rifle’s AI_Rifle', () => {
    const b = bot([0, 0, 0]);
    expect(b.aiWeapon.class).toBe('WeaponClass_SMG');
    expect(new Set(b.patterns.map((p) => p.weapon))).toEqual(new Set(['SMG']));
  });

  it('run a bit a thirtieth of a second, a sim step running the bits that fall in it', () => {
    const b = bot([0, 0, 0]);
    const one = { weapon: 'SMG', bits: [true, false, false], delay: 0, single: true };
    b.patterns = [{ ...one, intensity: 'High' }, { ...one, intensity: 'Medium' }];
    // (a second: 30 bits, a press every third, where a bit a step gave 7)
    expect(firing(b, 20).filter(Boolean).length).toBe(10);
  });

  it('pull once a press when single, and on every held step when automatic, the gun’s rate deciding the shots', () => {
    const held = { weapon: 'SMG', bits: [true, true, true, true, true, true], delay: 6 };
    const single = bot([0, 0, 0]);
    single.patterns = ['High', 'Medium'].map((intensity) => ({ ...held, intensity, single: true }));
    const auto = bot([0, 0, 0]);
    auto.patterns = ['High', 'Medium'].map((intensity) => ({ ...held, intensity, single: false }));
    // (12 bits, 0.4 s, eight steps of 0.05 s: the trigger held over the first four, let go over the rest)
    expect(firing(single, 8)).toEqual([true, false, false, false, false, false, false, false]);
    expect(firing(auto, 8)).toEqual([true, true, true, true, false, false, false, false]);
  });

  it('are drawn High until the bot has fired, then Medium, a fresh one each burst', () => {
    const b = bot([0, 0, 0]);
    const p = (intensity) => ({ weapon: 'SMG', intensity, bits: [true], delay: 2 });
    b.patterns = [p('High'), p('Medium'), p('Low')];
    firing(b, 1);
    expect(b.pattern.intensity).toBe('High');
    firing(b, 4, { t0: 0.05 });
    expect(b.pattern.intensity).toBe('Medium');
  });

  it('end the burst when the bot stops firing, so the next shot opens a fresh pattern', () => {
    const b = bot([0, 0, 0]);
    firing(b, 3);
    expect(b.pattern).not.toBe(null);
    firing(b, 1, { fire: false, t0: 0.15 });
    expect(b.pattern).toBe(null);
    expect(b.frame).toBe(0);
  });
});
