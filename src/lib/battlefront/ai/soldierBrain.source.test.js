// The soldier brain against the game’s AI source (tactics.js has the rules;
// docs/superpowers/evidence/bf-ai-source/README.md the sheet): the tactics’
// order and close combat, a hide’s fire.
import { describe, expect, it } from 'vitest';
import { seeded } from '../../seeded.js';
import { aiOf, classOf, loadRulebook, weaponOf } from '../rulebook.js';
import { buildNav, lineClear, shields } from '../nav.js';
import { newSoldier } from '../soldier.js';
import { createBrain, think } from './soldierBrain.js';

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

describe('a hide’s fire', () => {
  it('fires from its cover once in it, and not on the way there', () => {
    const slot = { at: [0, 0, -10], normal: [0, 1], height: 'stand' };
    const fire = (at) => {
      const b = bot(at);
      b.s.suppressed = 1;
      b.cover = slot;
      see(b, 'them', [0, 1.2, 10]);
      return think(b, world({ lineClear: () => true, shields: () => true, taken: new Map([[slot, 'me']]) }), 1);
    };
    const there = fire([0, 0, -10]);
    expect(there.mode).toBe('hide');
    expect(there.fire).toBe(true);
    const going = fire([5, 0, -15]);
    expect(going.mode).toBe('hide');
    expect(going.fire).toBe(false);
  });
});
