import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadRulebook, mapOf } from '../../lib/battlefront/rulebook.js';
import { buildMask } from '../../lib/battlefront/navMask.js';
import { addPlayer, createBattle, deploy, step, view } from './battle.js';
import { drawnBolt } from './fx/bolts.js';

const rb = loadRulebook();
const map = mapOf(rb, 'hoth');

// where the player deploys on flat ground, with no mask
function spawnAt() {
  const b = createBattle({ rulebook: rb, bots: { 1: 0, 2: 0 } });
  addPlayer(b, { team: 2 });
  deploy(b, 'player', { classId: 'd-orig-assault' });
  return view(b).player.at.slice();
}

// a wall across the way ahead (+Z, yaw 0), 2 m thick, `gap` metres on
const wallAhead = (at, gap, bounds = map.bounds) => {
  const inWall = (x, z, r) => Math.abs(x - at[0]) < 20 + r && z > at[2] + gap - r && z < at[2] + gap + 2 + r;
  return buildMask({ bounds, cell: 2, fine: 0.5, heightAt: () => 0, blockedAt: (x, y, z, r) => inWall(x, z, r), topAt: () => 3, capsule: { step: 0.4, height: 1.7, radius: 0.3 } });
};

afterEach(() => vi.restoreAllMocks());

describe('the battle on the nav mask', () => {
  it('stops the player at a wall only the mask knows', () => {
    const at = spawnAt();
    const b = createBattle({ rulebook: rb, bots: { 1: 0, 2: 0 }, mask: wallAhead(at, 3) });
    expect(b.nav.mask).not.toBeNull();
    addPlayer(b, { team: 2 });
    deploy(b, 'player', { classId: 'd-orig-assault' });
    for (let i = 0; i < 60; i++) step(b, [{ id: 'player', move: [0, 1], yaw: 0 }]);
    const p = view(b).player.at;
    expect(p[2] - at[2]).toBeGreaterThan(1.5);
    expect(p[2] - at[2]).toBeLessThan(3);
  });

  it('says so and walks on the ground alone when the mask is for another grid', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const at = spawnAt();
    const other = wallAhead(at, 3, { min: [map.bounds.min[0] + 2, map.bounds.min[1]], max: map.bounds.max });
    const b = createBattle({ rulebook: rb, bots: { 1: 0, 2: 0 }, mask: other });
    expect(b.nav.mask).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/nav mask/));
  });

  it('stops the player’s bolts at that wall, the drawn bolt from the gun’s muzzle with them', () => {
    const at = spawnAt();
    const b = createBattle({ rulebook: rb, bots: { 1: 0, 2: 0 }, mask: wallAhead(at, 8) });
    addPlayer(b, { team: 2 });
    deploy(b, 'player', { classId: 'd-orig-assault' });
    const muzzle = [at[0] + 0.3, at[1] + 1.4, at[2] + 0.5];
    let seen = 0;
    let ended = 0;
    for (let i = 0; i < 40; i++) {
      step(b, [{ id: 'player', move: [0, 0], yaw: 0, fire: true }]);
      for (const x of view(b).bolts) {
        seen++;
        expect(x.owner).toBe(b.player.id);
        // (the wall's 8 to 10 m on, grown by the capsule's 0.3 and the 2 m cells)
        expect(x.at[2] - at[2]).toBeLessThan(10.3);
        // (the drawn bolt from the muzzle to where the sim's ended, not past it)
        const { head } = drawnBolt(x, { muzzle, age: 1, first: x.travelled });
        expect(head[2]).toBeCloseTo(x.at[2], 6);
        if (x.ended) ended++;
      }
    }
    // (each stops in its first step: the page still sees it, for the drawing)
    expect(seen).toBeGreaterThan(0);
    expect(ended).toBe(seen);
    // (and let go of once shown: SPENT)
    for (let i = 0; i < 4; i++) step(b, [{ id: 'player', move: [0, 0], yaw: 0 }]);
    expect(view(b).bolts).toEqual([]);
  });
});
