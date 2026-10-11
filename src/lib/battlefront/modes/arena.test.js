// The other modes' arenas (lane 6), under `npm run test:ai`: each on its
// map (fixtures/modeArena.js), the game's players a side, bots only, seed 1
// (the twelve-seed tables: `node scripts/battlefront-balance.mjs --mode <id> --runs 12`).
import { describe, expect, it } from 'vitest';
import { loadRulebook } from '../rulebook.js';
import { modeArena } from '../fixtures/modeArena.js';
import { runAssault } from '../assault.js';

const rb = loadRulebook();

describe.each(['strike', 'extraction', 'ewokHunt', 'supremacy'])('%s on its map', (mode) => {
  const arena = modeArena(rb, mode);
  const one = runAssault({ ...arena, seed: 1, minutes: 25, mode });

  it('ends in a result inside 25 minutes, both sides fighting', () => {
    expect(one.result).not.toBe(null);
    expect(one.minutes).toBeLessThan(25);
    expect(one.kills[1] + one.kills[2]).toBeGreaterThan(0);
  });

  it('leaves no bot standing still for 20 s out of cover, and none off the navgrid', () => {
    expect(one.stuck).toBe(0);
    expect(one.offNav).toBe(0);
  });

  it('gives one battle from one seed', () => {
    const again = runAssault({ ...arena, seed: 1, minutes: 25, mode });
    expect(JSON.stringify(again.events)).toBe(JSON.stringify(one.events));
  });
}, 300000);
