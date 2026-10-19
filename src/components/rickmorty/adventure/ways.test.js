import { describe, expect, it } from 'vitest';
import { GARAGE_BACK } from '../world/dimensions/place';
import { HOME, arriveAt, citadelOut, homeLink } from './ways';

describe('the ways home', () => {
  it('offers a planet landed on from the map a way home to C-137’s garage', () => {
    expect(HOME).toBe('Home to C-137');
    expect(homeLink({ id: 'squanch' })).toEqual({ to: '/c-137', label: 'Home to C-137', state: { arrive: 'garage' } });
    expect(homeLink(null)).toBe(null);
  });

  it('starts Morty by the garage portal when he’s come home that way', () => {
    expect(arriveAt({ arrive: 'garage' })).toEqual({ area: 'garage', ...GARAGE_BACK });
    for (const s of [null, undefined, {}, { arrive: 'street' }, { from: 'universe' }]) expect(arriveAt(s)).toBe(null);
  });

  it('sends the Citadel’s way out back where the visitor came from', () => {
    expect(citadelOut({ from: 'universe' })).toEqual({ to: '/universe/citadel', state: undefined, label: 'Back to space' });
    for (const s of [null, undefined, { from: 'c137' }]) expect(citadelOut(s)).toEqual({ to: '/c-137', state: { arrive: 'garage' }, label: 'Back to C-137' });
  });
});
