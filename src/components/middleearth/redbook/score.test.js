import { describe, expect, it } from 'vitest';
import { MOODS, RANGE, eventsOf, loopSeconds, midiOf, moodOf, nextPhrase, notesIn, parse, phraseSeconds } from './score';
import { INSTRUMENTS } from './instruments';
import { PAGES } from './pages';

const IDS = Object.keys(MOODS);

describe('the score', () => {
  it('gives every page, the back pages and the shut book a mood', () => {
    for (const p of PAGES) expect(MOODS[moodOf(p.id)], p.id).toBeTruthy();
    for (const id of ['met', 'kept', null, undefined]) expect(moodOf(id)).toBe('study');
    // (the Shire’s pages share a tune; Moria has its own)
    expect(moodOf('bag-end')).toBe(moodOf('shire-edge'));
    expect(moodOf('moria')).toBe('deep');
  });

  it('reads a line: notes, rests, chords and graces', () => {
    expect(midiOf('A4')).toBe(69);
    expect(midiOf('C#5')).toBe(73);
    expect(midiOf('Bb2')).toBe(46);
    const { notes, length } = parse('D5 2 | r 1 D3+A3 3 B5~ 0.5');
    expect(length).toBe(6.5);
    expect(notes).toEqual([
      { at: 0, midis: [74], dur: 2, grace: false },
      { at: 3, midis: [50, 57], dur: 3, grace: false },
      { at: 6, midis: [83], dur: 0.5, grace: true },
    ]);
    expect(() => parse('D5')).toThrow();
    expect(() => parse('H2 1')).toThrow();
  });

  it.each(IDS)('%s is a loop of half a minute or more, its tracks fitting it', (id) => {
    const m = MOODS[id];
    expect(loopSeconds(id)).toBeGreaterThanOrEqual(30);
    expect(m.units % m.phrase).toBe(0);
    expect(m.units / m.phrase).toBeGreaterThanOrEqual(2);
    for (const t of m.tracks) {
      expect(INSTRUMENTS, t.inst).toContain(t.inst);
      const { length } = parse(t.line);
      const from = t.at ?? 0;
      if (t.repeat) expect((m.units - from) % length, `${id} ${t.inst}`).toBe(0);
      else expect(from + length, `${id} ${t.inst}`).toBeLessThanOrEqual(m.units);
    }
  });

  it.each(IDS)('%s keeps each instrument in its range, neither empty nor a wall of notes', (id) => {
    const ev = eventsOf(id);
    for (const e of ev) {
      const [lo, hi] = RANGE[e.inst];
      expect(e.midi, `${id} ${e.inst}`).toBeGreaterThanOrEqual(lo);
      expect(e.midi, `${id} ${e.inst}`).toBeLessThanOrEqual(hi);
      expect(e.vel).toBeGreaterThan(0);
      expect(e.vel).toBeLessThanOrEqual(1);
      expect(e.dur).toBeGreaterThan(0);
    }
    const perSecond = ev.length / loopSeconds(id);
    expect(perSecond).toBeGreaterThan(0.3);
    expect(perSecond).toBeLessThan(10);
  });

  it('gives the same notes for the same window, in time order', () => {
    const a = notesIn('shire', 3, 11);
    expect(a.length).toBeGreaterThan(5);
    expect(notesIn('shire', 3, 11)).toEqual(a);
    for (let i = 1; i < a.length; i++) expect(a[i].t).toBeGreaterThanOrEqual(a[i - 1].t);
    for (const e of a) {
      expect(e.t).toBeGreaterThanOrEqual(3);
      expect(e.t).toBeLessThan(11);
    }
    expect(notesIn('shire', 5, 5)).toEqual([]);
  });

  it('wraps round the loop without a seam', () => {
    const L = loopSeconds('bree');
    const across = notesIn('bree', L - 2, L + 2);
    const before = notesIn('bree', L - 2, L);
    const after = notesIn('bree', L, L + 2);
    expect(before.length).toBeGreaterThan(0);
    expect(after.length).toBeGreaterThan(0);
    expect(across).toEqual([...before, ...after]);
    // the second time round is the first, a loop later
    const first = notesIn('bree', 0, 2);
    expect(after.map((e) => e.midi)).toEqual(first.map((e) => e.midi));
    after.forEach((e, i) => expect(e.t - L).toBeCloseTo(first[i].t, 9));
    // and many loops on still holds
    expect(notesIn('bree', 7 * L, 7 * L + 2).map((e) => e.midi)).toEqual(notesIn('bree', 0, 2).map((e) => e.midi));
  });

  it('finds the next phrase’s start', () => {
    const p = phraseSeconds('study');
    expect(nextPhrase('study', 0)).toBe(0);
    expect(nextPhrase('study', 0.01)).toBeCloseTo(p);
    expect(nextPhrase('study', p)).toBeCloseTo(p);
    expect(nextPhrase('study', p * 2.5)).toBeCloseTo(p * 3);
  });
});
