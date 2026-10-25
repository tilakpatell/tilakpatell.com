import { describe, expect, it } from 'vitest';
import { keptOver } from './kept';

describe('a list kept over what another tab has kept since', () => {
  it('keeps what’s stored first, then this page’s and the new, once each, the ones that are valid', () => {
    expect(keptOver(['a', 'x'], ['a'], ['y'])).toEqual(['a', 'x', 'y']);
    expect(keptOver(['a'], ['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
    expect(keptOver('junk', ['a'], ['b'])).toEqual(['a', 'b']);
    expect(keptOver(['a', 'gone', 'a'], [], ['b'], (id) => id !== 'gone')).toEqual(['a', 'b']);
  });
});
