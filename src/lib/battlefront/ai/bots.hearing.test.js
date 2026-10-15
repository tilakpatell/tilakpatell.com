// The bots hear what the mode makes heard (galacticAssault.js `sounds`: a fuel charge's keypad while one holds it):
// an enemy holding it behind a bot, out of its sight, is believed in from the sound, where they stand; past the
// sound's radius from the keypad, nothing is heard.
import { describe, expect, it } from 'vitest';
import { loadRulebook } from '../rulebook.js';
import { hothFlatNav } from '../fixtures/hothFlat.js';
import { createSim, step } from '../sim.js';

const rb = loadRulebook();

describe('a bot’s hearing of the round', () => {
  it('believes in an enemy it cannot see from the keypad’s sound, and in no friend from it', () => {
    const sim = createSim({ rulebook: rb, nav: hothFlatNav(rb), seed: 3, bots: { 1: 2, 2: 2 }, mode: 'galacticAssault' });
    const soldiers = [...sim.entities.values()].filter((e) => e.kind === 'soldier');
    const a = soldiers.find((e) => e.team === sim.ga.attack);
    const mate = soldiers.find((e) => e.team === sim.ga.attack && e !== a);
    const d = soldiers.find((e) => e.team === sim.ga.defend);
    // (the defender 20 m behind the attacker, which faces away from it: out of its sight)
    a.at = [0, a.at[1], -1300];
    a.yaw = 0;
    d.at = [0, a.at[1], -1320];
    const keypad = { x: 0, y: a.at[1] + 1.58, z: -1319 };
    sim.M = { ...sim.M, sounds: () => [{ type: 'keypad', at: keypad, from: d.id, radius: 31.4035 }] };
    for (let i = 0; i < 3 && !a.brain.me.beliefs[d.id]; i++) {
      a.yaw = 0;
      step(sim);
    }
    const b = a.brain.me.beliefs[d.id];
    expect(b).toBeTruthy();
    expect(b.visible).toBe(false);
    expect(b.heardAt).toBeGreaterThan(-Infinity);
    // (believed where the holder stands, beside the keypad that sounds)
    expect(b.at.z).toBeCloseTo(d.at[2], 1);
    // (the sound is the defender's: his own side hears no enemy in it)
    expect(mate.brain.me.beliefs[d.id]).toBeUndefined();
  });

  it('hears nothing past the patch’s attenuation', () => {
    const sim = createSim({ rulebook: rb, nav: hothFlatNav(rb), seed: 3, bots: { 1: 1, 2: 1 }, mode: 'galacticAssault' });
    const [a, d] = [sim.ga.attack, sim.ga.defend].map((t) => [...sim.entities.values()].find((e) => e.kind === 'soldier' && e.team === t));
    a.at = [0, a.at[1], -1300];
    d.at = [0, a.at[1], -1340];
    sim.M = { ...sim.M, sounds: () => [{ type: 'keypad', at: { x: 0, y: a.at[1] + 1.58, z: -1339 }, from: d.id, radius: 31.4035 }] };
    for (let i = 0; i < 3; i++) {
      a.yaw = 0;
      step(sim);
    }
    expect(a.brain.me.beliefs[d.id]?.heardAt ?? -Infinity).toBe(-Infinity);
  });
});
