import { describe, expect, it } from 'vitest';
import { CHATTER, COMPANY, NAMES, nameOf, nextLine, saidFor } from './talk';
import { TALES } from './stages/tales';
import { STAGES } from './stages/index';
import { walkers } from './fellowship';
import { sOf } from './line';

describe('a word with the company', () => {
  it('every stage has its tale, and lines said by someone who walks there', () => {
    for (const st of STAGES) {
      expect(TALES[st.id], st.id).toMatch(/\.$/);
      const lines = CHATTER[st.id] ?? [];
      expect(lines.length, st.id).toBeGreaterThanOrEqual(3);
      // (who walks at some point in the stage)
      const here = new Set();
      for (let m = 0; m <= st.length; m += 5) for (const w of walkers(STAGES, sOf(STAGES, st.id, m))) here.add(w.id);
      for (const l of lines) expect(here.has(l.who), `${st.id}: ${l.who}`).toBe(true);
    }
  });

  it('every line is the house’s: curly quotes, a name for every speaker, nothing too long to read', () => {
    const all = [...Object.values(CHATTER).flat().map((l) => [l.who, l.text]), ...Object.entries(COMPANY).flatMap(([who, ts]) => ts.map((t) => [who, t])), ...Object.values(TALES).map((t) => ['frodo', t])];
    for (const [who, text] of all) {
      expect(NAMES[who], who).toBeTruthy();
      expect(text, text).not.toMatch(/'/);
      expect(text.length, text).toBeLessThanOrEqual(150);
      expect(saidFor(text)).toBeLessThanOrEqual(9000);
    }
  });

  it('the next line is the stage’s own first, by someone walking, never the same twice; then anyone’s', () => {
    const said = new Set();
    const first = nextLine('bree', ['frodo', 'sam'], said);
    expect(first).toMatchObject({ who: 'frodo', id: 'bree:0' });
    said.add(first.id);
    expect(nextLine('bree', ['frodo', 'sam'], said)).toMatchObject({ who: 'sam', id: 'bree:1' });
    // (none of the stage's left for who's here: theirs from anywhere)
    for (let i = 0; i < CHATTER.bree.length; i++) said.add(`bree:${i}`);
    expect(nextLine('bree', ['frodo'], said)).toMatchObject({ who: 'frodo', id: 'any:frodo:0' });
    expect(nextLine('bree', [], said)).toBe(null);
  });

  it('Aragorn is Strider until Rivendell', () => {
    expect(nameOf('aragorn', 'bree')).toBe('Strider');
    expect(nameOf('aragorn', 'rivendell')).toBe('Aragorn');
    expect(nameOf('butterbur', 'bree')).toBe('Barliman Butterbur');
  });
});
