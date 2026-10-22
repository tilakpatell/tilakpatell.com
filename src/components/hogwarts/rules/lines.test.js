import { describe, expect, it } from 'vitest';
import { LINES, NAMES, linesOf, say } from './lines';

// what a film or book said, word for word, that the site must not
const COPIED = [/yer a wizard/i, /nitwit/i, /foolish wand-waving/i, /ickle firsties/i, /no more’n four/i, /difficult\. very difficult/i, /not slytherin/i];

describe('the castle’s voices', () => {
  it('writes two lines at least for the Hat, McGonagall, Hagrid, Snape and Peeves', () => {
    for (const who of ['hat', 'mcgonagall', 'hagrid', 'snape', 'peeves']) expect(linesOf(who).length, who).toBeGreaterThanOrEqual(2);
  });

  it('names every voice', () => {
    for (const who of Object.keys(LINES)) expect(NAMES[who], who).toBeTruthy();
  });

  it('keeps every line short, curly-quoted, the site’s own and never shouting twice', () => {
    for (const [who, lines] of Object.entries(LINES))
      for (const [key, text] of Object.entries(lines)) {
        const at = `${who}.${key}`;
        expect(text, at).not.toMatch(/['"]/);
        expect(text, at).not.toMatch(/!{2}|!\s*!/);
        expect(text.length, at).toBeLessThan(170);
        expect(text, at).toMatch(/^[A-Z…]/);
        for (const c of COPIED) expect(text, at).not.toMatch(c);
      }
  });

  it('says a line by its key and refuses one that isn’t written', () => {
    expect(say('hagrid', 'boats')).toEqual({ who: 'hagrid', name: 'Hagrid', text: LINES.hagrid.boats });
    expect(say('mcgonagall', 'wait').text).toMatch(/^Wait here\./);
    expect(() => say('hagrid', 'nope')).toThrow();
    expect(() => say('voldemort', 'hello')).toThrow();
  });

  it('writes British, not American', () => {
    const all = Object.values(LINES).flatMap((l) => Object.values(l)).join(' ');
    expect(all).not.toMatch(/\b(color|favorite|center|realize|gray|mom)\b/i);
  });
});
