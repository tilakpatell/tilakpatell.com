// A bot given the AutoPlayers' numbers (an Instant Action round's): its
// trigger is the line of fire's and its view the tracker's; a bot given none
// is the bot it was.
import { describe, expect, it } from 'vitest';
import gs from '../../../data/bf2017/gameSettings.json';
import { seeded } from '../../seeded.js';
import { aiOf, classOf, loadRulebook, weaponOf } from '../rulebook.js';
import { buildNav, lineClear, shields } from '../nav.js';
import { hothFlatNav } from '../fixtures/hothFlat.js';
import { roundFor, startInstantAction } from '../instantAction.js';
import { newSoldier } from '../soldier.js';
import { STEP } from '../core.js';
import { autoPlayerFor } from './autoPlayer.js';
import { CONE, act, createBrain, think } from './soldierBrain.js';

const rb = loadRulebook();
const ai = aiOf(rb);
const open = buildNav({ heightAt: () => 0, bounds: { min: [-100, -100], max: [100, 100] }, cell: 2, solids: [], cover: ai.cover.constants });

function bot(at, over = {}) {
  const cls = classOf(rb, 'l-orig-assault');
  const s = newSoldier(cls, { id: 'me', team: 1, at, weapon: weaponOf(rb, cls.weapon), rand: seeded(1) });
  const b = createBrain(s, { ai, rand: seeded(1), ...over });
  // (every frame a firing one, so the trigger alone decides)
  b.patterns = [{ bits: [true], delay: 0, intensity: 'High' }];
  b.pattern = b.patterns[0];
  return b;
}

const see = (brain, id, at, visible = true) => {
  brain.me.beliefs[id] = { id, at: { x: at[0], y: at[1], z: at[2] }, vel: { x: 0, y: 0, z: 0 }, confidence: 1, visible, seenAt: 0, hostile: true };
};

function world(extra = {}) {
  const shots = [];
  return { shots, nav: open, lineClear: (a, b) => lineClear(open, a, b), shields, squad: null, objective: null, enemies: [], taken: new Map(), shoot: (s, aim) => shots.push(aim), ...extra };
}

// the bot thinks once, then acts every step for `seconds`; the times of its shots
function run(b, w, seconds, from = 0) {
  const at = [];
  for (let t = from; t < from + seconds - 1e-9; t += STEP) {
    if (t === from) b.intent = think(b, w, t);
    const n = w.shots.length;
    act(b, b.intent, b.s, STEP, w, t);
    if (w.shots.length > n) at.push(Math.round(t * 1000) / 1000);
  }
  return at;
}

describe('a bot on the AutoPlayers’ numbers', () => {
  it('a bot given none carries none', () => {
    const b = bot([0, 0, -50]);
    expect(b.ap).toBeNull();
    expect(b.apAim).toBeNull();
  });

  it('holds its fire for the line of fire’s reaction, then fires', () => {
    const ap = { ...autoPlayerFor(gs, { mode: 'instantAction', difficulty: 'rookie', side: 'Enemies' }), lofReaction: 0.2 };
    const b = bot([0, 0, -50], { ap });
    see(b, 'them', [0, 1.2, -30]);
    const shots = run(b, world(), 1);
    expect(shots.length).toBeGreaterThan(0);
    expect(shots[0]).toBeGreaterThanOrEqual(0.2);
    expect(shots[0]).toBeLessThan(0.5);
  });

  it('keeps firing where the target was for the timeout after the line is lost, then stops', () => {
    const ap = { ...autoPlayerFor(gs, { mode: 'instantAction', difficulty: 'expert', side: 'Enemies' }), lofTimeout: 0.5 };
    const b = bot([0, 0, -50], { ap });
    see(b, 'them', [0, 1.2, -30]);
    const w = world();
    run(b, w, 1);
    // (the target steps out of sight)
    b.me.beliefs.them.visible = false;
    const after = run(b, w, 2, 1);
    expect(after.length).toBeGreaterThan(0);
    expect(after.at(-1)).toBeLessThanOrEqual(1.5 + STEP);
    expect(after.at(-1)).toBeGreaterThanOrEqual(1.3);
  });

  it('a rookie’s view wanders wider than an expert’s', () => {
    const spread = (difficulty) => {
      const b = bot([0, 0, -50], { ap: autoPlayerFor(gs, { mode: 'instantAction', difficulty, side: 'Enemies' }) });
      see(b, 'them', [0, 1.2, -20]);
      const w = world();
      run(b, w, 12);
      // (how far from the target's chest the shots were put, across the line)
      return w.shots.reduce((n, a) => n + Math.abs(a[0]), 0) / Math.max(1, w.shots.length);
    };
    expect(spread('rookie')).toBeGreaterThan(spread('expert') * 1.5);
  });

  it('fires nothing where its mode holds its fire', () => {
    const b = bot([0, 0, -50], { ap: autoPlayerFor(gs, { mode: 'instantAction', difficulty: 'normal', side: 'Enemies' }) });
    see(b, 'them', [0, 1.2, -30]);
    const w = world();
    b.intent = { ...think(b, w, 0), fire: false };
    for (let t = 0; t < 1; t += STEP) act(b, b.intent, b.s, STEP, w, t);
    expect(w.shots).toHaveLength(0);
  });

  it('strafes one way then the other, each for the settings’ time', () => {
    const ap = autoPlayerFor(gs, { mode: 'instantAction', difficulty: 'normal', side: 'Enemies' });
    const b = bot([0, 0, -50], { ap });
    see(b, 'them', [0, 1.2, -30]);
    const w = world();
    const flips = [];
    let was = null;
    for (let t = 0; t < 20; t += 0.25) {
      const i = think(b, w, t);
      expect(i.mode).toBe('attack');
      const side = Math.sign(i.goal[0]);
      if (was !== null && side !== was) flips.push(t);
      was = side;
    }
    expect(flips.length).toBeGreaterThanOrEqual(4);
    const [lo, hi] = ap.strafeInvert;
    for (let k = 1; k < flips.length; k++) {
      expect(flips[k] - flips[k - 1]).toBeGreaterThanOrEqual(lo - 0.25);
      expect(flips[k] - flips[k - 1]).toBeLessThanOrEqual(hi + 0.25);
    }
  });

  it('turns its strafe back from ground it cannot stand on', () => {
    const ap = autoPlayerFor(gs, { mode: 'instantAction', difficulty: 'normal', side: 'Enemies' });
    // (at the grid's edge: the ground to the +x side, the check's 2.5 m off, is outside it)
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const b = bot([98.5, 0, -50], { ap, rand: seeded(seed) });
      b.patterns = [{ bits: [true], delay: 0, intensity: 'High' }];
      see(b, 'them', [98.5, 1.2, -30]);
      const i = think(b, world(), 0);
      expect(i.mode).toBe('attack');
      expect(i.goal[0]).toBeLessThan(98.5);
    }
  });

  it('sees inside the tracker’s field of view, 140°, where a bot with no numbers keeps its own', () => {
    const ap = autoPlayerFor(gs, { mode: 'instantAction', difficulty: 'normal', side: 'Enemies' });
    expect(ap.fov).toBe(140);
    expect(bot([0, 0, 0], { ap }).senses.sight.cone).toBeCloseTo(Math.cos((70 * Math.PI) / 180), 9);
    expect(bot([0, 0, 0]).senses.sight.cone).toBe(CONE);
  });

  it('does not fire past its engaging distance', () => {
    const ap = autoPlayerFor(gs, { mode: 'instantAction', difficulty: 'normal', side: 'Enemies' });
    const b = bot([0, 0, -90], { ap });
    const far = ap.engageScale * (b.preferred ?? b.s.weapon.range) + 10;
    see(b, 'them', [0, 1.2, -90 + far]);
    expect(think(b, world(), 0).fire).toBe(false);
  });
});

describe('an Instant Action round’s bots', () => {
  it('each side’s brains carry its row: the Enemies’ facing the player, the Friendlies’ beside them', () => {
    const { sim, round } = startInstantAction({ rulebook: rb, gs, nav: hothFlatNav(rb), seed: 2, mode: 'galacticAssault', difficulty: 'rookie', bots: { friendly: 2, enemy: 2 } });
    const of = (team) => [...sim.entities.values()].filter((e) => e.bot && e.team === team).map((e) => e.brain.ap);
    expect(of(round.team).every((ap) => ap === round.ap[round.team])).toBe(true);
    expect(of(3 - round.team).every((ap) => ap === round.ap[3 - round.team])).toBe(true);
    expect(round.ap[3 - round.team].sources.sideScale).toBe('AP_AimNoiseScale_Enemies_Rookie_Mode8');
    expect(roundFor(gs, {}).ap[1]).not.toBe(round.ap[1]);
  });
});
