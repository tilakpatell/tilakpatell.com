import { describe, expect, it } from 'vitest';
import { destinationById } from './destinations';
import { gameGoal } from './gameGoal';

describe('the map’s marker inside a game', () => {
  it('follows only the game of the task the story’s marked: in the agency, the sewer step’s marker isn’t Spring Jaguar’s key', () => {
    const d = destinationById('agency');
    expect(gameGoal(d, { used: new Set(), task: 'sewer' })).toBe(null);
    expect(gameGoal(d, { used: new Set(), task: 'agency' })).toBe(d.collect.spots[0]);
    // (no task: as it always was)
    expect(gameGoal(d, { used: new Set() })).toBe(d.collect.spots[0]);
  });

  it('points at an escape’s spot once what it waits on is used: Customs’ scanner, with the seeds taken', () => {
    const d = destinationById('customs');
    expect(gameGoal(d, { used: new Set(), task: 'customs' })).toBe(null);
    expect(gameGoal(d, { used: new Set(['seeds']), task: 'customs' })).toBe('scanner');
    expect(gameGoal(d, { used: new Set(['seeds']), task: 'customs', done: ['customs'] })).toBe(null);
  });

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

  it('walks him round Heist-Con’s crew first, then to Heistotron’s plan, then booth by booth; round the crew again after a catch', () => {
    const d = destinationById('heistcon');
    const order = ['heistskull', 'heistbooth', 'heistcars', 'heisthire'];
    const crew = ['heistbadge', 'heister-b1', 'heister-a1'];
    expect(gameGoal(d, { used: new Set(), sequence: { phase: 'idle', order, on: 0 } })).toBe('heistbadge');
    expect(gameGoal(d, { used: new Set(crew.slice(0, 1)), sequence: { phase: 'idle', order, on: 0 } })).toBe('heister-b1');
    expect(gameGoal(d, { used: new Set(crew.slice(0, 2)), sequence: { phase: 'idle', order, on: 0 } })).toBe('heister-a1');
    expect(gameGoal(d, { used: new Set(crew), sequence: { phase: 'idle', order, on: 0 } })).toBe('heistplan');
    expect(gameGoal(d, { used: new Set(crew), sequence: { phase: 'run', order, on: 2 } })).toBe('heistcars');
    // (caught: the crew's spots forgotten, and the badge first again)
    expect(gameGoal(d, { used: new Set(), sequence: { phase: 'idle', order, on: 0 } })).toBe('heistbadge');
    expect(gameGoal(d, { used: new Set(crew), sequence: { phase: 'lost', order, on: 1 } })).toBe(null);
    expect(gameGoal(d, { used: new Set(), done: ['heistcon'], sequence: { phase: 'idle', order, on: 0 } })).toBe(null);
  });

  it('walks him round the Jerrys he’s not heard, never straight to ours', () => {
    const d = destinationById('jerryboree');
    const [a, b] = d.find.items;
    expect(gameGoal(d, { find: { phase: 'idle', heard: [], wrong: [] } })).toBe(a);
    expect(gameGoal(d, { find: { phase: 'run', heard: [a], wrong: [] } })).toBe(b);
    // all heard: no candidate (ours is dealt at random, so the next not ruled
    // out is a guess), and the map rests on the desk, the place's goal
    expect(gameGoal(d, { find: { phase: 'run', heard: [...d.find.items], wrong: [a] } })).toBe(null);
    expect(gameGoal(d, { find: { phase: 'run', heard: [...d.find.items], wrong: [] } })).toBe(null);
    expect(d.goal).toBe('receptionist');
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

describe('the marker on a climb with things to pick up', () => {
  const d = { climb: { task: 'birdworld', top: null, foot: null, spot: null, picks: ['a', 'b', 'c'] } };
  it('points at the first thing not yet picked, and at nothing once it’s done or lost', () => {
    expect(gameGoal(d, { climb: { phase: 'idle', stand: 0, picked: [] } })).toBe('a');
    expect(gameGoal(d, { climb: { phase: 'run', stand: 2, picked: ['a'] } })).toBe('b');
    expect(gameGoal(d, { climb: { phase: 'run', stand: 0, picked: ['a', 'c'] } })).toBe('b');
    expect(gameGoal(d, { climb: { phase: 'lost', stand: 0, picked: ['a'] } })).toBe(null);
    expect(gameGoal(d, { done: ['birdworld'], climb: { phase: 'idle', stand: 0, picked: [] } })).toBe(null);
  });
});
