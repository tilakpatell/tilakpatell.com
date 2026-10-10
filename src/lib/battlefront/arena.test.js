// The arenas (spec section 9), under `npm run test:ai`: twenty bots a side
// on Hoth's arena navgrid, no player: a three-minute skirmish with no mode,
// and a whole Galactic Assault (seed 1; the twenty-seed table is
// `node scripts/battlefront-balance.mjs --assault --runs 20`).
import { describe, expect, it } from 'vitest';
import { loadRulebook } from './rulebook.js';
import { hothFlatNav } from './fixtures/hothFlat.js';
import { runSkirmish } from './skirmish.js';
import { runAssault } from './assault.js';

const rb = loadRulebook();
const nav = hothFlatNav(rb);
const log = (r) => JSON.stringify(r.events);

describe('the skirmish arena', () => {
  const t0 = performance.now();
  const one = runSkirmish({ rulebook: rb, nav, seed: 1, bots: 20, seconds: 180 });
  const ms = performance.now() - t0;

  it('is a fight both sides win kills in', () => {
    // the Empire's 5 on seed 1 since lane 2 opened the uplinks' consoles and walks long goals by legs
    // (docs/superpowers/evidence/battlefront-lane2/balance.md)
    expect(one.kills[1]).toBeGreaterThan(3);
    expect(one.kills[2]).toBeGreaterThan(3);
  });

  it('leaves no bot standing still for 20 s out of cover, and none off the navgrid', () => {
    expect(one.stuck).toBe(0);
    expect(one.offNav).toBe(0);
  });

  it('gives one battle from one seed and another from another', () => {
    const again = runSkirmish({ rulebook: rb, nav, seed: 1, bots: 20, seconds: 180 });
    expect(log(again)).toBe(log(one));
    const other = runSkirmish({ rulebook: rb, nav, seed: 2, bots: 20, seconds: 60 });
    expect(log(other)).not.toBe(JSON.stringify(one.events.filter((e) => e.t <= 60)));
  });

  it('runs inside a minute of Node', () => {
    expect(ms).toBeLessThan(60000);
  });
}, 120000);

describe('Galactic Assault on Hoth', () => {
  const t0 = performance.now();
  const one = runAssault({ rulebook: rb, nav, seed: 1, bots: 20, minutes: 25 });
  const ms = performance.now() - t0;

  it('ends in a result, the walkers having got somewhere', () => {
    expect(one.result).not.toBe(null);
    expect(one.stage).toBeGreaterThanOrEqual(1);
    expect(one.minutes).toBeGreaterThan(8);
    expect(one.minutes).toBeLessThan(25);
  });

  it('leaves no bot standing still for 20 s out of cover, and none off the navgrid', () => {
    expect(one.stuck).toBe(0);
    expect(one.offNav).toBe(0);
  });

  it('gives one battle from one seed', () => {
    const again = runAssault({ rulebook: rb, nav, seed: 1, bots: 20, minutes: 3 });
    expect(log(again)).toBe(JSON.stringify(one.events.filter((e) => e.t <= again.sim.time + 1e-9)));
  });

  it('runs a round inside 90 s of Node', () => {
    expect(ms).toBeLessThan(90000);
  });
}, 120000);
