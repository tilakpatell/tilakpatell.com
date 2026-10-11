import { describe, expect, it } from 'vitest';
import { seeded } from '../../seeded.js';
import { aiOf, loadRulebook } from '../rulebook.js';
import { GUNNER_SIGHT, createGunner, gunFor } from './vehicleBrain.js';
import { createSim, step } from '../sim.js';
import { hothFlatNav } from '../fixtures/hothFlat.js';

const rb = loadRulebook();
const ai = aiOf(rb);
const walker = (over = {}) => ({ id: 'w1', kind: 'walker', team: 2, alive: true, at: [0, 0, 0], yaw: 0, ...over });
const defender = (id, at) => ({ id, team: 1, alive: true, bot: true, kind: 'soldier', at, hp: 100, hpMax: 100 });

function fire(g, enemies, seconds, { clear = () => true } = {}) {
  const shots = [];
  for (let t = 0; t < seconds; t += 0.05) {
    const s = g.tick(t, { enemies, lineClear: clear });
    if (s) shots.push({ t, ...s });
  }
  return shots;
}

describe('the walkers’ gunners, from the game’s vehicle AI rows', () => {
  it('reads the AT-AT’s row and its chin cannon', () => {
    const g = createGunner(ai.vehicles.ATAT_AI, walker(), { ai, rb, rand: seeded(1) });
    expect(g.range).toBe(Math.min(ai.vehicles.ATAT_AI.WeaponRange, GUNNER_SIGHT));
    expect(g.weapon.damage.start).toBe(175);
    expect(gunFor(rb, 'walker').name).toMatch(/Chin Cannon/);
    expect(g.patterns.every((p) => p.weapon === 'AssaultRifle')).toBe(true);
  });

  it('fires its row’s bursts at a visible defender inside its range, and not beyond', () => {
    const g = createGunner(ai.vehicles.ATAT_AI, walker(), { ai, rb, rand: seeded(1) });
    const near = fire(g, [defender('d1', [0, 0, 80])], 10);
    expect(near.length).toBeGreaterThan(3);
    expect(near.every((s) => s.target === 'd1')).toBe(true);
    // (no faster than the cannon's rate of fire)
    for (let i = 1; i < near.length; i++) expect(near[i].t - near[i - 1].t).toBeGreaterThanOrEqual(60 / g.weapon.firing.rof - 1e-6);
    const far = createGunner(ai.vehicles.ATAT_AI, walker(), { ai, rb, rand: seeded(1) });
    expect(fire(far, [defender('d2', [0, 0, g.range + 20])], 10)).toEqual([]);
  });

  it('holds fire with no line to the defender, and on a dead one', () => {
    const g = createGunner(ai.vehicles.ATAT_AI, walker(), { ai, rb, rand: seeded(1) });
    expect(fire(g, [defender('d1', [0, 0, 80])], 5, { clear: () => false })).toEqual([]);
    expect(fire(g, [{ ...defender('d1', [0, 0, 80]), alive: false }], 5)).toEqual([]);
  });

  it('aims from its turret, high on the walker, at the defender’s chest within its spread', () => {
    const g = createGunner(ai.vehicles.ATAT_AI, walker(), { ai, rb, rand: seeded(1) });
    const [s] = fire(g, [defender('d1', [0, 0, 80])], 5);
    expect(s.from[1]).toBeGreaterThan(10);
    expect(Math.abs(s.aim[0])).toBeLessThan(5);
  });

  it('arms Hoth’s walkers in Galactic Assault: their bolts fly from the turret, owned by the walker', () => {
    const sim = createSim({ rulebook: rb, nav: hothFlatNav(rb), seed: 1, bots: { 1: 10, 2: 10 }, mode: 'galacticAssault' });
    const walkers = [...sim.entities.values()].filter((e) => e.kind === 'walker');
    expect(walkers.length).toBeGreaterThan(0);
    expect(walkers.every((w) => w.gunner)).toBe(true);
    // (put a defender in the first walker's sight, and step)
    const w = walkers[0];
    const d = [...sim.entities.values()].find((e) => e.team !== w.team && e.kind === 'soldier');
    d.at = [w.at[0] + 40, w.at[1], w.at[2] + 40];
    let shots = 0;
    for (let i = 0; i < 200 && !shots; i++) shots += step(sim).filter((e) => e.type === 'shot' && e.by === w.id).length + sim.events.filter((e) => e.type === 'shot' && e.by === w.id).length;
    expect(shots).toBeGreaterThan(0);
  });
});
