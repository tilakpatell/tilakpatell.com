import { describe, expect, it } from 'vitest';
import { gained, returnVeil, welcomeFor } from './welcome';

const SEVEN = ['power', 'reality', 'mind', 'soul-clint', 'soul-natasha', 'soul', 'time'];
describe('coming back to the compound', () => {
  it('welcomes you back only with a new stone, naming the next building', () => {
    expect(gained(['power'], ['power', 'soul-clint'])).toEqual(['soul-clint']);
    expect(welcomeFor(['power'], ['power'])).toBe(null);
    expect(welcomeFor([], ['power'])).toBe('Next: Mjolnir');
    expect(welcomeFor(['power'], ['power', 'soul-clint'])).toBe('Next: Mjolnir');
    expect(welcomeFor([], ['time'])).toBe('Next: Tony Stark’s workshop');
    expect(welcomeFor(SEVEN, [...SEVEN, 'space'])).toBe('Every stone is back: walk under the portal over the helipad');
  });
  it('shows the way back as one draw of the compound, and a first visit as flying in', () => {
    const prep = { value: 0.4, step: 'load' };
    expect(returnVeil({ gl: 'on', back: true, prep })).toEqual({ shown: true, progress: 1, step: 'first draw', title: 'Back to the compound' });
    expect(returnVeil({ gl: 'loading', back: true, prep })).toEqual({ shown: true, progress: 0.4, step: 'load', title: 'Flying in to the compound' });
    expect(returnVeil({ gl: 'on', back: false, prep })).toEqual({ shown: false, progress: 0.4, step: 'load', title: 'Flying in to the compound' });
  });
});
