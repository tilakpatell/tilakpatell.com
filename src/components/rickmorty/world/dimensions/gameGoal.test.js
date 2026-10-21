import { describe, expect, it } from 'vitest';
import { destinationById } from './destinations';
import { gameGoal } from './gameGoal';

describe('the map’s marker inside a game', () => {
  it('follows a collect to the next piece not yet found, and stops once it’s done', () => {
    const d = destinationById('anatomy');
    expect(gameGoal(d, { used: new Set() })).toBe(d.collect.spots[0]);
    expect(gameGoal(d, { used: new Set(d.collect.spots.slice(0, 2)) })).toBe(d.collect.spots[2]);
    expect(gameGoal(d, { used: new Set(d.collect.spots) })).toBe(null);
    expect(gameGoal(d, { used: new Set(), done: [d.collect.task] })).toBe(null);
  });

  it('sends him to the cells, then to where they go, by what he’s carrying', () => {
    const d = destinationById('microverse');
    expect(gameGoal(d, { power: { phase: 'run', carrying: false } })).toBe(d.power.from);
    expect(gameGoal(d, { power: { phase: 'run', carrying: true } })).toBe(d.power.to);
    expect(gameGoal(d, { power: { phase: 'lost', carrying: true } })).toBe(null);
    expect(gameGoal(d, { power: { phase: 'run', carrying: true }, done: [d.power.task] })).toBe(null);
  });

  it('walks him round the Jerrys he’s not heard, never straight to ours', () => {
    const d = destinationById('jerryboree');
    const [a, b] = d.find.items;
    expect(gameGoal(d, { find: { phase: 'idle', heard: [], wrong: [] } })).toBe(a);
    expect(gameGoal(d, { find: { phase: 'run', heard: [a], wrong: [] } })).toBe(b);
    // all heard: the first not ruled out
    expect(gameGoal(d, { find: { phase: 'run', heard: [...d.find.items], wrong: [a] } })).toBe(b);
  });

  it('points at a thing found clean to take, else the next not looked over', () => {
    const d = destinationById('needful');
    const [a, b, c] = d.deal.items;
    expect(gameGoal(d, { deal: { phase: 'idle', seen: {}, taken: [] } })).toBe(a);
    expect(gameGoal(d, { deal: { phase: 'run', seen: { [a]: 'bad' }, taken: [] } })).toBe(b);
    expect(gameGoal(d, { deal: { phase: 'run', seen: { [a]: 'bad', [b]: 'bad', [c]: 'good' }, taken: [] } })).toBe(c);
  });

  it('has nothing to say of a place without a game', () => {
    expect(gameGoal(destinationById('customs'), {})).toBe(null);
    expect(gameGoal(null, {})).toBe(null);
  });
});
