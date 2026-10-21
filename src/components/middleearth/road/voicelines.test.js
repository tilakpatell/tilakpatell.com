import { describe, expect, it } from 'vitest';
import { LINES, SPEAKERS, VOICELINES } from './voicelines';
import { CAST } from './fellowship';

describe('the Road’s voiced lines', () => {
  it('lists every line a beat says, once', () => {
    expect(Object.keys(LINES).length).toBeGreaterThanOrEqual(2);
    for (const [beat, line] of Object.entries(LINES)) expect(VOICELINES, beat).toContainEqual(line);
    expect(new Set(VOICELINES.map((l) => l.text)).size).toBe(VOICELINES.length);
  });

  it('every line short, curly, the site’s own and said by one of the cast, or one met on the road', () => {
    expect(SPEAKERS).toEqual(expect.arrayContaining(CAST));
    for (const { who, text } of VOICELINES) {
      expect(SPEAKERS).toContain(who);
      expect(text.length).toBeLessThan(140);
      expect(text).not.toMatch(/['"]/);
      expect(text).not.toMatch(/!/);
    }
  });

  it('Sam at the field’s edge says it in the site’s words, not the film’s', () => {
    expect(LINES['hobbiton-field-edge'].who).toBe('sam');
    expect(LINES['hobbiton-field-edge'].text).not.toMatch(/farthest/i);
  });

  it('Strider, Boromir and Bilbo reuse lines the site has recorded, word for word', () => {
    expect(LINES['bree-dawn'].text).toBe('Weathertop is six days from here, by the wild ways.');
    expect(LINES['rivendell-boromir'].text).toBe('Minas Tirith is the safer road. You know that.');
    expect(LINES['rivendell-bilbo'].text).toBe('There and Back Again: A Hobbit’s Tale, by Bilbo Baggins.');
  });
});
