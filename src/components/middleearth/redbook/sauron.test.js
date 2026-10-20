import { describe, expect, it } from 'vitest';
import { LINES, lineFor } from './sauron';
import { DROP, OPEN } from './stone';

describe('what the Eye says', () => {
  it('begins once the Eye is open and has said everything before the stone falls', () => {
    expect(LINES[0].at).toBeGreaterThan(OPEN);
    expect(LINES.at(-1).at).toBeLessThan(DROP);
    for (let i = 1; i < LINES.length; i++) expect(LINES[i].at, i).toBeGreaterThan(LINES[i - 1].at + 1);
  });

  it('grows louder line by line, in the site’s voice', () => {
    for (let i = 1; i < LINES.length; i++) expect(LINES[i].loud).toBeGreaterThanOrEqual(LINES[i - 1].loud);
    for (const l of LINES) {
      expect(l.text).not.toMatch(/!/);
      expect(l.text).not.toMatch(/['"]/);
    }
  });

  it('says each line once, in its turn, as the gaze goes on', () => {
    let said = 0;
    const heard = [];
    for (let g = 0; g < DROP; g += 0.05) {
      const i = lineFor(g, said);
      if (i >= 0) {
        heard.push(i);
        said += 1;
      }
    }
    expect(heard).toEqual(LINES.map((_, i) => i));
    expect(lineFor(100, LINES.length)).toBe(-1);
    expect(lineFor(0, 0)).toBe(-1);
  });
});
