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

// The third pull request's rules: the trigger, what a bot keeps of a target out of sight, flee, the aim, cover.
const grenade = (at, team = 2) => ({ at, team, collided: true, dead: false, row: { radius: 6 } });
const lost = (brain, id, at, ago) => {
  see(brain, id, at, false);
  brain.me.now = 10;
  brain.me.beliefs[id].seenAt = 10 - ago;
};

describe('the trigger', () => {
  it('fires on at a target out of sight for the keep-firing time while the bot stands, and not on the move', () => {
    const b = bot([0, 0, 0]);
    lost(b, 'them', [0, 1.2, 20], 3);
    expect(think(b, world(), 1).fire).toBe(true);
    const c = bot([0, 0, 0]);
    lost(c, 'them', [0, 1.2, 20], 5);
    expect(think(c, world(), 1).fire).toBe(false);
    // (advancing on one past the engage distance: moving, it fires only in sight; a sidestep in the open counts
    // as standing, as the source has that bot standing)
    const d = bot([0, 0, 0]);
    d.s.vel = [3, 0, 0];
    lost(d, 'them', [0, 1.2, 60], 1);
    const i = think(d, world(), 1);
    expect(i.mode).toBe('advance');
    expect(i.fire).toBe(false);
  });

  it('is held past the AI weapon’s range, not the gun’s: AI_Rifle’s 250 m', () => {
    const b = bot([0, 0, 0]);
    expect(b.s.weapon.range).toBe(200);
    see(b, 'them', [0, 1.2, 220]);
    expect(think(b, world(), 1).fire).toBe(true);
    const c = bot([0, 0, 0]);
    see(c, 'them', [0, 1.2, 260]);
    expect(think(c, world(), 1).fire).toBe(false);
  });

  it('waits the difficulty’s reacquire time for a target spotted again away from where it was lost', () => {
    const b = bot([0, 0, 0], { difficulty: { reaction: () => 0, reacquire: () => 0.5, settle: () => 1, aim: {}, row: { targeting: { reaquireTargetDistanceThreshold: 1 } } } });
    see(b, 'them', [0, 1.2, 20]);
    expect(think(b, world(), 1).fire).toBe(true);
    b.me.beliefs.them.visible = false;
    think(b, world(), 1.2);
    see(b, 'them', [4, 1.2, 20]);
    expect(think(b, world(), 1.4).fire).toBe(false);
    expect(think(b, world(), 2).fire).toBe(true);
  });
});

describe('a target out of sight', () => {
  it('is held where it was last seen, not followed', () => {
    const b = bot([0, 0, 0]);
    see(b, 'them', [0, 1.2, 20]);
    think(b, world(), 1);
    // (the senses would move it; the brain keeps the place it was seen)
    Object.assign(b.me.beliefs.them, { visible: false, at: { x: 6, y: 1.2, z: 24 } });
    think(b, world(), 1.2);
    expect(b.me.beliefs.them.at).toEqual({ x: 0, y: 1.2, z: 20 });
  });
});

describe('flee', () => {
  it('is a panic’s: an enemy grenade come down beside the bot, after the drawn moment, and not its squad’s retreat', () => {
    const b = bot([0, 0, -50]);
    see(b, 'them', [0, 1.2, -20]);
    expect(think(b, world({ squad: { centre: [0, -50], posture: 'retreat' } }), 1).mode).not.toBe('flee');
    const w = world({ grenades: [grenade([2, 0, -50])] });
    expect(think(b, w, 2).mode).not.toBe('flee');
    expect(think(b, w, 2.3).mode).toBe('flee');
    // (a friend's grenade, or one still in the air, is nothing to it)
    const c = bot([0, 0, -50]);
    see(c, 'them', [0, 1.2, -20]);
    think(c, world({ grenades: [grenade([2, 0, -50], 1), { ...grenade([1, 0, -50]), collided: false }] }), 2);
    expect(think(c, world(), 2.3).mode).not.toBe('flee');
  });

  it('goes on past the panic until the bot has been in its flee cover over 2 s, then it hides there', () => {
    const b = bot([0, 0, -50]);
    see(b, 'them', [0, 1.2, -20]);
    think(b, world({ grenades: [grenade([2, 0, -50])] }), 1);
    expect(think(b, world(), 1.3).mode).toBe('flee');
    // (the panic over at 3 s; the flee is not)
    expect(think(b, world(), 3.5).mode).toBe('flee');
    // (there: where its flee led it, it waits two seconds, then hides)
    const goal = b.intent.goal;
    b.s.at = [goal[0], 0, goal[1]];
    expect(['flee', 'hide']).toContain(think(b, world(), 4).mode);
    expect(think(b, world(), 6.2).mode).toBe('hide');
  });

  it('fires on the way only where its flee row’s move settings say so: the Skirmish heavy’s, inside 30 m', () => {
    const fleeing = (b) => {
      see(b, 'them', [0, 1.2, -25]);
      const w = world({ grenades: [grenade([2, 0, -50])] });
      think(b, w, 1);
      return think(b, w, 1.3);
    };
    const heavy = fleeing(bot([0, 0, -50], { pve: true }, 'd-orig-heavy'));
    expect(heavy.mode).toBe('flee');
    expect(heavy.fire).toBe(true);
    const rifle = fleeing(bot([0, 0, -50]));
    expect(rifle.mode).toBe('flee');
    expect(rifle.fire).toBe(false);
  });
});

describe('the aim', () => {
  it('is the target’s eye less a quarter metre, with no lead on a mover', () => {
    const b = bot([0, 0, 0], { aimScale: 0 });
    see(b, 'them', [0, 1.26, 30]);
    b.me.beliefs.them.vel = { x: 5, y: 0, z: 0 };
    const target = { id: 'them', kind: 'soldier', alive: true, at: [0, 0, 30], stance: 'stand', vel: [5, 0, 0], yaw: 0 };
    const i = think(b, world({ who: (id) => (id === 'them' ? target : null) }), 1);
    expect(i.aim[0]).toBeCloseTo(0, 6);
    expect(i.aim[2]).toBeCloseTo(30, 6);
    expect(i.aim[1]).toBeGreaterThan(1.26);
  });
});

describe('cover', () => {
  const slot = { at: [0, 0, -10], normal: [0, 1], height: 'stand' };
  const inCover = (target) => {
    const b = bot([0, 0, -10]);
    b.cover = slot;
    see(b, 'them', target);
    return { b, w: world({ taken: new Map([[slot, 'me']]) }) };
  };

  it('an attacking bot keeps a cover inside its weapon’s range of a target it sees, however long', () => {
    const { b, w } = inCover([0, 1.2, -40]);
    expect(think(b, w, 1).mode).toBe('cover');
    expect(think(b, w, 5).mode).toBe('cover');
    expect(think(b, w, 30).mode).toBe('cover');
  });

  it('asks for another once the target is out of its weapon’s preferred range, past its time there', () => {
    const { b, w } = inCover([0, 1.2, -40]);
    // (a weapon whose preferred range ends at 20 m, the target 30 m off)
    b.preferred = { Start: 0, Ideal: 0.5, End: 20 };
    expect(think(b, w, 1).mode).toBe('cover');
    // (the open field has no other: it fights in the open)
    expect(think(b, w, 5).mode).toBe('attack');
  });
});
