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

  it('walks him to the booth, then set by set in the running order', () => {
    const d = destinationById('cablestudio');
    const order = ['set-sneezy', 'set-ants', 'set-bits', 'set-field', 'set-legs'];
    expect(gameGoal(d, { sequence: { phase: 'idle', order, on: 0 } })).toBe('cablebooth');
    expect(gameGoal(d, { sequence: { phase: 'run', order, on: 0 } })).toBe('set-sneezy');
    expect(gameGoal(d, { sequence: { phase: 'run', order, on: 2 } })).toBe('set-bits');
    expect(gameGoal(d, { sequence: { phase: 'lost', order, on: 2 } })).toBe(null);
    expect(gameGoal(d, { sequence: { phase: 'run', order, on: 2 }, done: ['cablestudio'] })).toBe(null);
    expect(gameGoal(d, { sequence: { phase: 'won', order, on: 5 } })).toBe(null);
    // (a place with no start spot: the first of the order, from the first)
    expect(gameGoal({ ...d, sequence: { ...d.sequence, start: null } }, { sequence: { phase: 'idle', order, on: 0 } })).toBe('set-sneezy');
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

  it('points at the stairs’ foot, then at the giants once he’s up', () => {
    const d = { id: 'up', climb: { task: 'up', top: 'crown', foot: 'goblins', spot: 'giants' } };
    expect(gameGoal(d, { climb: { phase: 'idle', stand: 0 } })).toBe('goblins');
    expect(gameGoal(d, { climb: { phase: 'run', stand: 0 } })).toBe('goblins');
    expect(gameGoal(d, { climb: { phase: 'run', stand: 2.3 } })).toBe('giants');
    expect(gameGoal(d, { climb: { phase: 'lost', stand: 2.3 } })).toBe(null);
    expect(gameGoal(d, { climb: { phase: 'run', stand: 2.3 }, done: ['up'] })).toBe(null);
    expect(gameGoal(d, {})).toBe(null);
  });

  it('has nothing to say of a place without a game', () => {
    expect(gameGoal(destinationById('customs'), {})).toBe(null);
    expect(gameGoal(null, {})).toBe(null);
  });
});
