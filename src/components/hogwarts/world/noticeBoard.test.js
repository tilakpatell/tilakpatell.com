import { describe, expect, it } from 'vitest';
import { newQuests, listFor, objectiveOf } from '../rules/quests';
import { noticesFor } from './noticeBoard';

const viewOf = (week, state = newQuests(), extra = {}) => {
  const ctx = { house: 'hufflepuff', week };
  return { week, label: `Week ${week}`, list: listFor(state, ctx), objective: objectiveOf(state, ctx), christmas: week === 6, leaving: week === 12, feasted: false, ...extra };
};

describe('the notice board', () => {
  it('pins up what is open this week, the next thing with its own pin', () => {
    const board = noticesFor(viewOf(1));
    expect(board.head).toBe('Notices · Week 1');
    expect(board.notes[0]).toEqual({ title: '1. The Sorting', text: 'The Great Hall', kind: 'next' });
    // (nothing that waits on the Sorting is pinned up before it)
    expect(board.notes.some((n) => n.title === '2. Up!')).toBe(false);
  });

  it('never pins up more than six, and brings the Map’s note from the second week', () => {
    const sorted = { ...newQuests(), sorting: { step: 1, got: [], done: false } };
    const board = noticesFor(viewOf(3, sorted));
    expect(board.notes.length).toBeLessThanOrEqual(6);
    expect(board.notes.some((n) => n.title === '2. Up!')).toBe(true);
    expect(board.notes.at(-1).title).toBe('Found');
    expect(noticesFor(viewOf(1, sorted)).notes.some((n) => n.title === 'Found')).toBe(false);
  });

  it('puts up Christmas and the leaving feast in their weeks', () => {
    expect(noticesFor(viewOf(6)).notes[0].title).toBe('Christmas');
    expect(noticesFor(viewOf(12)).notes[0].kind).toBe('feast');
    expect(noticesFor(viewOf(12, newQuests(), { feasted: true })).notes[0].text).toMatch(/Cup is given/);
  });

  it('has something to say before the term begins', () => {
    expect(noticesFor(null).notes).toHaveLength(1);
  });
});
