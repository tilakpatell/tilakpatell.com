import { describe, expect, it } from 'vitest';
import { KNOCKER, RIDDLES, answer, knock, riddleFor, rightAnswer } from './riddles';

const byId = (id) => RIDDLES.find((r) => r.id === id);

describe('the Ravenclaw knocker', () => {
  it('has twelve riddles, each a question with answers that count', () => {
    expect(RIDDLES).toHaveLength(12);
    expect(new Set(RIDDLES.map((r) => r.id)).size).toBe(12);
    for (const r of RIDDLES) {
      expect(r.ask).toMatch(/\?$/);
      expect(r.ask).not.toMatch(/['"]/);
      expect(r.answers.length).toBeGreaterThan(0);
      // (its own first answer counts, as said plainly)
      expect(rightAnswer(r, r.answers[0])).toBe(true);
    }
  });

  it('takes the right answer however it is put', () => {
    const clock = byId('clock');
    for (const said of ['clock', 'A clock', 'the clock.', 'Is it a clock?', 'it’s a CLOCK', 'I think it is the clock']) expect(rightAnswer(clock, said), said).toBe(true);
    for (const said of ['', 'a cloak', 'clockwork', 'owl']) expect(rightAnswer(clock, said), said).toBe(false);
    expect(rightAnswer(byId('tomorrow'), 'the future')).toBe(true);
  });

  it('says “Well reasoned” to the right answer and opens', () => {
    const r = answer(knock(byId('fire')), 'Fire');
    expect(r).toMatchObject({ ok: true, open: true, line: 'Well reasoned.' });
  });

  it('says “Hm. Think again” twice, and lets you in on the third try', () => {
    let st = knock(byId('echo'));
    let r = answer(st, 'a bat');
    expect(r).toMatchObject({ ok: false, open: false, line: 'Hm. Think again.' });
    r = answer(r.state, 'a ghost');
    expect(r).toMatchObject({ ok: false, open: false, line: KNOCKER.wrong });
    r = answer(r.state, 'Peeves');
    expect(r).toMatchObject({ ok: false, open: true, line: KNOCKER.third });
    // (the right answer on the second try is still well reasoned)
    st = knock(byId('echo'));
    r = answer(answer(st, 'a bat').state, 'an echo');
    expect(r).toMatchObject({ ok: true, open: true, line: KNOCKER.right });
  });

  it('asks the same riddle for the same seed, and all twelve across seeds', () => {
    expect(riddleFor(5)).toBe(riddleFor(5));
    expect(new Set(Array.from({ length: 12 }, (_, i) => riddleFor(i).id)).size).toBe(12);
  });
});
