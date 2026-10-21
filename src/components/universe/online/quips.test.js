import { describe, expect, it } from 'vitest';
import { QUIPS, QUIP_MS, quipText } from './quips';

describe('QUIPS', () => {
  it('is the twenty set lines, in order', () => {
    expect(QUIPS).toEqual(['Hello', 'Bye for now', 'On my way', 'Follow me', 'Wait for me', 'Over here', 'Look at this', 'Nice one', 'Thanks', 'Sorry', 'Yes', 'No', 'Ready?', 'Let’s go', 'Need a hand?', 'Watch out', 'Well played', 'Good game', 'Back in a bit', 'See you at the map']);
  });
  it('says each line once, with a curly apostrophe, short enough for a bubble', () => {
    expect(new Set(QUIPS).size).toBe(QUIPS.length);
    expect(QUIPS.join(' ')).not.toMatch(/'/);
    for (const q of QUIPS) expect(q.length).toBeLessThanOrEqual(20);
  });
  it('cannot be changed by whoever imports it', () => {
    expect(Object.isFrozen(QUIPS)).toBe(true);
  });
  it('shows one for six seconds', () => {
    expect(QUIP_MS).toBe(6000);
  });
});

describe('quipText', () => {
  it('reads an index as its line', () => {
    expect(quipText(0)).toBe('Hello');
    expect(quipText(13)).toBe('Let’s go');
    expect(quipText(QUIPS.length - 1)).toBe('See you at the map');
  });
  it('is null for anything that is not an index of one', () => {
    for (const i of [-1, QUIPS.length, 1.5, '0', 'length', 'constructor', null, undefined, NaN, {}, []]) expect(quipText(i)).toBeNull();
  });
});
