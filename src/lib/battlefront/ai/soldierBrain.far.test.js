// A bot sent somewhere one search cannot reach (too far, or the way round is
// too long) gets there down the place's field (navField.js), where a
// straight leg toward it ends at the wall.
import { describe, expect, it } from 'vitest';
import gs from '../../../data/bf2017/gameSettings.json';
import { seeded } from '../../seeded.js';
import { aiOf, classOf, loadRulebook, weaponOf } from '../rulebook.js';
import { buildNav, lineClear, shields } from '../nav.js';
import { buildMask } from '../navMask.js';
import { newSoldier } from '../soldier.js';
import { STEP, THINK } from '../core.js';
import { autoPlayerFor } from './autoPlayer.js';
import { FAR, act, createBrain, think } from './soldierBrain.js';

const rb = loadRulebook();
const ai = aiOf(rb);
// flat ground ±300 m, a wall 580 m long across it at z = 0: its one way round is the east end, past x = 280,
// 140 m from where the bots below stand (a way round one search of the brain's cells does not find)
const bounds = { min: [-300, -300], max: [300, 300] };
const WALL = { x: [-300, 280], z: [-1, 1] };
// and far to the south a wall 60 m long and thinner than a cell, between the cells' middles: the navgrid's
// cells are open through it, and no soldier fits
const THIN = { x: [-230, -170], z: [-200.1, -199.9] };
const inWall = (x, z, r) => [WALL, THIN].some((q) => x > q.x[0] - r && x < q.x[1] + r && z > q.z[0] - r && z < q.z[1] + r);
const mask = buildMask({ bounds, cell: 2, fine: 0.5, heightAt: () => 0, blockedAt: (x, y, z, r) => inWall(x, z, r), topAt: () => 3, capsule: { step: 0.4, height: 1.7, radius: 0.3 } });
const make = () => buildNav({ heightAt: () => 0, bounds, cell: 2, solids: [], cover: ai.cover.constants, mask });
const nav = make();

function bot(at, over = {}) {
  const cls = classOf(rb, 'l-orig-assault');
  const s = newSoldier(cls, { id: 'me', team: 1, at, weapon: weaponOf(rb, cls.weapon), rand: seeded(1) });
  return createBrain(s, { ai, rand: seeded(1), ...over });
}

const world = (task, on = nav) => ({ nav: on, lineClear: (a, b) => lineClear(on, a, b), shields, squad: null, objective: null, task, enemies: [], targets: [], others: [], taken: new Map(), who: () => null, shoot: () => {} });
const postAt = (at) => ({ key: 'post', at, spot: at, role: 'defend', radius: 10, reach: 0, interact: false, stays: true });

// the bot thinks and acts for `seconds`; how near its post it came
function walk(b, w, seconds) {
  let next = 0;
  let nearest = Infinity;
  for (let t = 0; t < seconds - 1e-9; t += STEP) {
    if (t + 1e-9 >= next) {
      b.intent = think(b, w, t);
      next += THINK;
    }
    act(b, b.intent, b.s, STEP, w, t);
    nearest = Math.min(nearest, Math.hypot(b.s.at[0] - w.task.at[0], b.s.at[2] - w.task.at[1]));
  }
  return nearest;
}

describe('a bot sent past a long wall', () => {
  const ap = () => autoPlayerFor(gs, { mode: 'instantAction', difficulty: 'normal', side: 'Enemies' });

  it('farther than one search reaches: it goes round and comes to its post', () => {
    const b = bot([141, 0, -45], { ap: ap() });
    const w = world(postAt([141, 45]));
    expect(90).toBeGreaterThan(FAR);
    expect(walk(b, w, 150)).toBeLessThanOrEqual(10);
  });

  it('near in a line and far by the way round: it comes to its post all the same', () => {
    const b = bot([141, 0, -15], { ap: ap() });
    const w = world(postAt([141, 15]));
    expect(walk(b, w, 150)).toBeLessThanOrEqual(10);
  });

  it('finds the way once for every bot sent there, and keeps none for a place that is not said to stay', () => {
    const own = make();
    walk(bot([141, 0, -45], { ap: ap() }), world(postAt([141, 45]), own), 10);
    walk(bot([120, 0, -30], { ap: ap() }), world(postAt([141, 45]), own), 10);
    expect(own.fields.size).toBe(1);
    // (a walker's place, a crowd's middle: a field made for each place it passes would be made over and over)
    const moving = make();
    walk(bot([141, 0, -45], { ap: ap() }), world({ ...postAt([141, 45]), stays: undefined }, moving), 10);
    expect(moving.fields).toBeUndefined();
  });

  it('sent past a wall thinner than a cell, which one search walks into: it goes round by the field', () => {
    const b = bot([-199, 0, -215], { ap: ap() });
    const w = world(postAt([-199, -185]));
    expect(walk(b, w, 60)).toBeLessThanOrEqual(10);
  });

  it('a bot with no numbers, sent the same way, comes there too', () => {
    const b = bot([141, 0, -45]);
    const w = world({ ...postAt([141, 45]), radius: 0 });
    expect(walk(b, w, 150)).toBeLessThanOrEqual(10);
  });
});
