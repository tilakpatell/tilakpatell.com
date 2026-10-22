import { describe, expect, it } from 'vitest';
import { QUESTS, advance, doneCount, isOpen, listFor, newQuests, objectiveOf, questById } from './quests';

const ctx = { house: 'hufflepuff', week: 12 };

// every event that moves some quest, in the order a term might bring them
const TERM = [
  { type: 'sorted', house: 'hufflepuff' },
  { type: 'enter', room: 'hufflepuff' },
  { type: 'lesson', id: 'flying', done: true },
  { type: 'lesson', id: 'charms', done: true },
  { type: 'lesson-done', id: 'potions' },
  { type: 'lesson', id: 'herbology', done: true },
  { type: 'lesson', id: 'buckbeak', done: true },
  { type: 'willow', frozen: true },
  { type: 'pickup', id: 'willow-book' },
  { type: 'enter', room: 'library' },
  { type: 'lesson', id: 'duel', done: true },
  { type: 'lesson', id: 'boggart', done: true },
  { type: 'pickup', id: 'cloak' },
  { type: 'restricted' },
  { type: 'book', quiet: true },
  { type: 'enter', room: 'hufflepuff' },
  { type: 'learnt', spell: 'patronus' },
  { type: 'driven' },
  { type: 'sweet', id: 'frog' },
  { type: 'butterbeer' },
  { type: 'sweet', id: 'beans' },
  { type: 'enter', room: 'shack' },
  { type: 'sweet', id: 'quill' },
  { type: 'feast' },
];

const SORTED = [{ type: 'sorted', house: 'hufflepuff' }, { type: 'enter', room: 'hufflepuff' }];

const play = (list, c = ctx, state = newQuests()) => {
  const events = [];
  for (const e of list) {
    const r = advance(state, e, c);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
};

describe('the thirteen quests', () => {
  it('are thirteen, numbered in order, each with its steps, its place and its points', () => {
    expect(QUESTS).toHaveLength(13);
    expect(QUESTS.map((q) => q.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(new Set(QUESTS.map((q) => q.id)).size).toBe(13);
    for (const q of QUESTS) {
      expect(q.title.length, q.id).toBeGreaterThan(2);
      expect(q.where.length, q.id).toBeGreaterThan(2);
      expect(q.blurb, q.id).toMatch(/\.$/);
      expect(q.steps.length, q.id).toBeGreaterThan(0);
      expect(q.points, q.id).toBeGreaterThanOrEqual(0);
      for (const id of q.needs.quests) expect(questById(id), `${q.id} needs ${id}`).not.toBeNull();
    }
  });

  it('play through a whole term, every one done, the quests’ own points paid', () => {
    const r = play(TERM);
    expect(doneCount(r.state)).toBe(13);
    const paid = r.events.filter((e) => e.type === 'points');
    expect(paid.map((e) => e.why).sort()).toEqual(['hogsmeade', 'night', 'patronus', 'sorting', 'willow']);
    expect(paid.every((e) => e.house === 'hufflepuff' && e.delta > 0)).toBe(true);
    expect(objectiveOf(r.state, ctx)).toBeNull();
  });

  it('move each only on the events its own step waits for', () => {
    // (for every quest at every step, every event of the term but its own leaves it be)
    for (const q of QUESTS) {
      if (q.any) continue;
      for (let k = 0; k < q.steps.length; k++) {
        const state = { ...newQuests(), ...Object.fromEntries(QUESTS.filter((x) => x.id !== q.id).map((x) => [x.id, { step: x.steps.length, got: [], done: true }])), [q.id]: { step: k, got: [], done: false } };
        for (const e of TERM) {
          const own = q.steps[k].on(e, ctx);
          const r = advance(state, e, ctx);
          if (own) expect(r.state[q.id], `${q.id} step ${k} on ${JSON.stringify(e)}`).not.toEqual(state[q.id]);
          else expect(r.state[q.id], `${q.id} step ${k} on ${JSON.stringify(e)}`).toEqual(state[q.id]);
        }
      }
    }
  });

  it('wait for their week and for the quests before them', () => {
    const early = { house: 'gryffindor', week: 1 };
    const r = play([{ type: 'sorted' }, { type: 'enter', room: 'gryffindor' }, { type: 'lesson', id: 'herbology', done: true }, { type: 'pickup', id: 'cloak' }, { type: 'feast' }], early);
    expect(r.state.sorting.done).toBe(true);
    expect(r.state.mandrakes.done).toBe(false);
    expect(r.state.night.step).toBe(0);
    expect(r.state.cup.done).toBe(false);
    expect(isOpen(r.state, questById('patronus'), { week: 12 })).toBe(false);
    // (the boggart before the Patronus)
    const s = play([{ type: 'lesson', id: 'boggart', done: true }], ctx, r.state).state;
    expect(isOpen(s, questById('patronus'), { week: 7 })).toBe(true);
    expect(isOpen(s, questById('patronus'), { week: 6 })).toBe(false);
  });

  it('send you back to the Restricted Section if you’re caught on the way home', () => {
    const r = play([...SORTED, { type: 'pickup', id: 'cloak' }, { type: 'restricted' }, { type: 'book', quiet: true }, { type: 'caught' }]);
    expect(r.state.night.step).toBe(1);
    expect(r.events[r.events.length - 1]).toEqual(expect.objectContaining({ id: 'night', back: true }));
    // (a book that woke is no read at all)
    const loud = play([...SORTED, { type: 'pickup', id: 'cloak' }, { type: 'restricted' }, { type: 'book', quiet: false }]);
    expect(loud.state.night.step).toBe(2);
  });

  it('take Hogsmeade’s three things in any order, and each sweet once', () => {
    const r = play([...SORTED, { type: 'enter', room: 'shack' }, { type: 'sweet', id: 'frog' }, { type: 'sweet', id: 'frog' }, { type: 'sweet', id: 'beans' }]);
    expect(r.state.hogsmeade.done).toBe(false);
    expect(objectiveOf(r.state, { ...ctx, week: 3 })).not.toBeNull();
    const more = play([{ type: 'sweet', id: 'quill' }, { type: 'butterbeer' }], ctx, r.state);
    expect(more.state.hogsmeade.done).toBe(true);
  });

  it('say what to do next, and list them for the board', () => {
    const fresh = newQuests();
    expect(objectiveOf(fresh, { week: 1 })).toEqual({ id: 'sorting', text: 'Be sorted' });
    const rows = listFor(fresh, { week: 1 });
    expect(rows).toHaveLength(13);
    expect(rows[0]).toEqual(expect.objectContaining({ id: 'sorting', open: true, done: false, locked: null }));
    expect(rows[10].locked).toBe('From week 7');
    expect(rows[1].locked).toBe('Once you’re sorted');
    expect(rows[6].locked).toBe('From week 2');
    expect(listFor(fresh, { week: 2 })[6].locked).toBe('After “The feather”');
  });

  it('open the lessons once you’re sorted, before your common room is found', () => {
    const r = play([{ type: 'sorted', house: 'hufflepuff' }, { type: 'lesson', id: 'flying', done: true }]);
    expect(r.state.sorting.done).toBe(false);
    expect(r.state.flying.done).toBe(true);
    expect(isOpen(r.state, questById('feather'), ctx)).toBe(true);
    expect(isOpen(newQuests(), questById('feather'), ctx)).toBe(false);
  });

  it('ignore what isn’t an event', () => {
    const s = newQuests();
    expect(advance(s, null, ctx).state).toEqual(s);
    expect(advance(s, { type: 'nothing' }, ctx).events).toEqual([]);
  });
});
