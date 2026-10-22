import { describe, expect, it } from 'vitest';
import { createSaves } from '../../../runtime/saves';
import { SAVE_KEY, createSchool, readSave, writeSave } from './school';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
};
const savesOf = () => createSaves({ local: memory(), session: memory() });

function school(opts = {}) {
  const said = [];
  const s = createSchool({ saves: opts.saves ?? savesOf(), house: 'ravenclaw', tell: (type, data) => said.push({ type, ...data }), ...opts });
  return { s, said, of: (type) => said.filter((e) => e.type === type) };
}

describe('the term in the world', () => {
  it('keeps its keys in the one save beside the Sorting’s, touching nothing else', () => {
    const saves = savesOf();
    saves.set(SAVE_KEY, { house: 'ravenclaw', wand: { wood: 'yew' }, arrived: 1 });
    writeSave(saves, { term: { week: 4 } });
    expect(readSave(saves)).toEqual({ house: 'ravenclaw', wand: { wood: 'yew' }, arrived: 1, term: { week: 4 } });
  });

  it('counts every point, moves a week for a lesson and pays a quest’s own points', () => {
    const { s, of } = school();
    s.hear('sorted', { house: 'ravenclaw' });
    s.hear('enter', { room: 'ravenclaw' });
    expect(s.view().done).toBe(1);
    expect(of('toast').at(-1).text).toBe('The Sorting, done: ten points to Ravenclaw.');
    s.hear('points', { type: 'points', house: 'ravenclaw', delta: 10, why: 'charms' });
    s.hear('lesson', { type: 'lesson', id: 'charms', done: true });
    expect(s.week).toBe(2);
    expect(of('toast').at(-1).text).toBe('Week 2 · September, and the term goes on.');
    expect(s.view().done).toBe(2);
    expect(s.view().totals.ravenclaw).toBe(16 + 20);
    expect(of('achievement').map((e) => e.id)).toEqual(['hp-sorted']);
  });

  it('runs the weeks on with the world’s clock, three days a week', () => {
    const { s } = school();
    for (let h = 0; h < 24 * 7; h += 1) s.step(1, h);
    expect(s.week).toBe(3);
  });

  it('remembers the term across a visit, and a ?week= visit doesn’t write over it', () => {
    const saves = savesOf();
    const a = school({ saves }).s;
    a.hear('sorted');
    a.hear('lesson', { id: 'flying', done: true });
    const b = school({ saves }).s;
    expect(b.week).toBe(2);
    expect(b.view().list[0].done).toBe(false);
    const c = school({ saves, week: 9 }).s;
    expect(c.week).toBe(9);
    c.hear('points', { type: 'points', house: 'ravenclaw', delta: 5 });
    expect(readSave(saves).term.week).toBe(2);
  });

  it('plays a whole term through to the Cup, and the head of house’s achievement with it', () => {
    const { s, of } = school({ week: 12 });
    const events = [
      ['sorted', {}],
      ['enter', { room: 'ravenclaw' }],
      ...['flying', 'charms', 'potions', 'herbology', 'buckbeak', 'duel', 'boggart'].map((id) => ['lesson', { id, done: true }]),
      ['willow', { frozen: true }],
      ['pickup', { id: 'willow-book' }],
      ['enter', { room: 'library' }],
      ['pickup', { id: 'cloak' }],
      ['restricted', {}],
      ['book', { quiet: true }],
      ['enter', { room: 'ravenclaw' }],
      ['learnt', { spell: 'patronus' }],
      ['driven', {}],
      ['butterbeer', {}],
      ['sweet', { id: 'frog' }],
      ['sweet', { id: 'beans' }],
      ['sweet', { id: 'quill' }],
      ['enter', { room: 'shack' }],
    ];
    for (const [type, data] of events) s.hear(type, data);
    // (the lessons pay their own: as the lessons would)
    for (const p of [10, 10, 10, 10, 10, 20, 10]) s.hear('points', { type: 'points', house: 'ravenclaw', delta: p });
    expect(s.view().done).toBe(12);
    const cup = s.feast();
    expect(cup.winner).toBe('ravenclaw');
    expect(s.view().done).toBe(13);
    expect(of('achievement').map((e) => e.id)).toEqual(expect.arrayContaining(['hp-sorted', 'hp-patronus', 'hp-head']));
    expect(s.knows('patronus')).toBe(true);
    expect(s.cloak).toBe(true);
  });

  it('holds the leaving feast only in the last week, and begins the next year after it', () => {
    const early = school({ week: 5 }).s;
    expect(early.feast()).toBeNull();
    const saves = savesOf();
    const late = school({ saves }).s;
    for (let i = 0; i < 11; i++) late.sleep(i + 1);
    expect(late.week).toBe(12);
    expect(late.feast().standings).toHaveLength(4);
    late.nextYear(20);
    expect(late.week).toBe(1);
    expect(late.view().year).toBe(2);
  });

  it('sends the cloak at Christmas if it hasn’t been found, once', () => {
    const { s, of } = school({ week: 6 });
    s.hear('sorted', { house: 'ravenclaw' });
    s.step(1 / 60, 0);
    s.step(1 / 60, 0.1);
    expect(s.cloak).toBe(true);
    expect(of('toast').filter((e) => /parcel/.test(e.text))).toHaveLength(1);
    expect(s.view().list.find((q) => q.id === 'night').done).toBe(false);
    expect(school({ week: 5 }).s.cloak).toBe(false);
  });

  it('moves the week on for a night in your four-poster', () => {
    const { s } = school();
    s.hear('sleep', { house: 'ravenclaw' });
    expect(s.week).toBe(2);
  });

  it('doesn’t count a common room you were marched to as found', () => {
    const { s } = school();
    s.hear('sorted', { house: 'ravenclaw' });
    s.hear('led', {});
    s.hear('room', { id: 'ravenclaw', name: 'The Ravenclaw common room' });
    expect(s.view().list[0].done).toBe(false);
    s.hear('room', { id: 'ravenclaw', name: 'The Ravenclaw common room' });
    expect(s.view().list[0].done).toBe(true);
  });

  it('keeps the cards found, each once', () => {
    const { s, of } = school();
    s.hear('pickup', { id: 'card', card: 'merlin' });
    s.hear('pickup', { id: 'card', card: 'merlin' });
    expect(s.cards).toEqual(['merlin']);
    expect(of('card')).toHaveLength(1);
  });
});
