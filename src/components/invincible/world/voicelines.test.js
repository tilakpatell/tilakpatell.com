import { describe, expect, it } from 'vitest';
import { voiceOf } from '../../../lib/voiced';
import { LINES as BOUT } from '../thinkmark/rules';
import { VOICELINES as BOUT_LINES } from '../thinkmark/voicelines';
import { CALLS, HERO_LINES, LINES, RINGS_DONE } from './lines';
import { VOICELINES } from './voicelines';

describe('the Graysons’ city, in its people’s voices', () => {
  it('gives every line a voice: the city’s, what’s said in passing, and Think, Mark!’s', () => {
    expect(VOICELINES.length).toBe(Object.values(LINES).flat().length + Object.keys(CALLS).length + 1 + Object.values(HERO_LINES).flat().length);
    // (Dad's words when his rings are done, without the lap's time around them)
    expect(VOICELINES).toContainEqual({ who: 'omniman', text: RINGS_DONE.text });
    expect(BOUT_LINES.length).toBe(Object.keys(BOUT).length);
    for (const l of [...VOICELINES, ...BOUT_LINES]) expect(voiceOf(l.who)).toBe(l.who);
  });
  it('has Dad say his lines as Omni-Man, wherever he says them', () => {
    expect(VOICELINES.find((l) => l.text === 'Think, Mark!').who).toBe('omniman');
    expect(BOUT_LINES.find((l) => l.text === 'Think, Mark!').who).toBe('omniman');
  });
});
