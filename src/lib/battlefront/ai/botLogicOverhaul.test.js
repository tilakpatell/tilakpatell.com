// The Instant Action Overhaul V2's bot logic: objectives dealt to a side's
// bots all at once, by the mod's fixed table (its own records, read
// 2026-10-13: NOTES.md, "The Overhaul's bot logic").
import { describe, expect, it } from 'vitest';
import { DEAL, POST_RADIUS, RESPAWN, SPREAD, TABLE, createDealer, dealFor, nextFor, ownerChanged, slotOrder, stepDealer } from './botLogicOverhaul.js';

// the owners of posts A to E by team (0 no one's), from the local slots a side holds
const holding = (team, slots) => {
  const owners = [0, 0, 0, 0, 0];
  for (const k of slots) owners[slotOrder(team)[k - 1]] = team;
  return owners;
};
// how many of a deal's bots go to each of the side's own slots 1 to 5
const split = (team, slots, bots) => {
  const d = createDealer();
  const to = dealFor(d, team, holding(team, slots), bots);
  return [1, 2, 3, 4, 5].map((k) => to.filter((post) => post === slotOrder(team)[k - 1]).length);
};

describe('the mod’s numbers', () => {
  it('are its table of twelve, its times and its radius', () => {
    expect(TABLE.join(' ')).toBe('X Y M M Y X M X Y F M M');
    expect(DEAL).toEqual({ hold: 8, every: 25, limit: 5, lag: 0.1 });
    expect(POST_RADIUS).toBe(10);
    expect(RESPAWN).toBe(6);
    expect(SPREAD.every).toBe(15);
    expect(SPREAD.scales).toEqual([0.15, 0.3, 0.6, 0.8, 1, 1.1, 1.35, 1.55, 1.95, 2.5]);
  });

  it('a side’s slots are its near posts first: team 2’s are team 1’s the other way round', () => {
    expect(slotOrder(1)).toEqual([0, 1, 2, 3, 4]);
    expect(slotOrder(2)).toEqual([4, 3, 2, 1, 0]);
  });
});

// (the study's own run of the table as read, the switches wrapping past their last output)
describe('a deal', () => {
  it('sends a side that holds nothing to its two near posts and the middle', () => {
    expect(split(1, [], 12)).toEqual([3, 3, 5, 0, 1]);
  });

  it('sends a side that holds its near posts to the middle first, then the far ones', () => {
    expect(split(1, [1, 2], 12)).toEqual([0, 0, 7, 2, 3]);
    expect(split(1, [1, 2], 20)).toEqual([0, 0, 13, 3, 4]);
  });

  it('sends a side that holds the middle too to the far posts', () => {
    expect(split(1, [1, 2, 3], 12)).toEqual([0, 0, 0, 5, 7]);
    expect(split(1, [1, 2, 3], 20)).toEqual([0, 0, 0, 9, 11]);
  });

  it('sends some back for a near post it has lost', () => {
    expect(split(1, [2, 3], 12)).toEqual([3, 0, 0, 4, 5]);
    expect(split(1, [2, 3], 20)).toEqual([5, 0, 0, 7, 8]);
  });

  it('is the same for team 2 on its own slots, mirrored on the ground', () => {
    expect(split(2, [1, 2], 12)).toEqual([0, 0, 7, 2, 3]);
    const d = createDealer();
    // (team 2 holds nothing: its near posts are E and D)
    const to = dealFor(d, 2, [0, 0, 0, 0, 0], 12);
    expect([0, 1, 2, 3, 4].map((post) => to.filter((p) => p === post).length)).toEqual([1, 0, 5, 3, 3]);
  });

  it('never sends a bot to its side’s own slot 1, 2 or 3: every way to them is tested', () => {
    for (const held of [[1], [2], [3], [1, 3], [2, 4], [1, 2, 4], [3, 4, 5], [1, 2, 3, 4, 5]]) {
      const owners = holding(1, held);
      for (const post of dealFor(createDealer(), 1, owners, 24)) if (post <= 2) expect(owners[post]).not.toBe(1);
    }
  });

  it('does send bots to the far posts it holds: an entry’s last way tests nothing', () => {
    // (M's third way and F's both: slots 4 and 5, held or not)
    expect(split(1, [3, 4, 5], 12)).toEqual([3, 3, 0, 3, 3]);
    expect(split(1, [1, 2, 3, 4, 5], 12)).toEqual([0, 0, 0, 6, 6]);
  });

  it('starts the table and its turns again each time', () => {
    const d = createDealer();
    const owners = holding(1, [1, 2]);
    const first = dealFor(d, 1, owners, 7);
    expect(dealFor(d, 1, owners, 7)).toEqual(first);
  });

  it('a bot that comes in after it takes the table’s next entry', () => {
    const d = createDealer();
    dealFor(d, 1, [0, 0, 0, 0, 0], 3);
    // (X, Y, M were dealt: the next is M, the middle; then Y, the first near post)
    expect(nextFor(d, 1, [0, 0, 0, 0, 0])).toBe(2);
    expect(nextFor(d, 1, [0, 0, 0, 0, 0])).toBe(0);
  });
});

describe('when a deal is made', () => {
  const run = (d, until, events = {}) => {
    const at = [];
    for (let k = 0; k * 0.05 < until; k++) {
      const t = Math.round(k * 0.05 * 100) / 100;
      if (events[t]) ownerChanged(d, t);
      if (stepDealer(d, t)) at.push(t);
    }
    return at;
  };

  it('is eight seconds and two tenths after the start, then every twenty-five', () => {
    expect(run(createDealer(), 60)).toEqual([8.2, 33.2, 58.2]);
  });

  it('is also when a post changes hands, a tenth of a second after', () => {
    expect(run(createDealer(), 30, { 20: true })).toEqual([8.2, 20.1]);
  });

  it('is not more than once in five seconds: what is asked meanwhile is held to their end, once', () => {
    expect(run(createDealer(), 32, { 20: true, 21: true, 22: true, 23.5: true })).toEqual([8.2, 20.1, 25.1]);
  });

  it('is not before the start, whatever changes hands', () => {
    expect(run(createDealer(), 9, { 2: true, 5: true })).toEqual([8.2]);
  });
});
