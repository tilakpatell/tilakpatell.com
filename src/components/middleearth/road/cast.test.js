import { describe, expect, it } from 'vitest';
import { HEIGHTS, heightOf } from './cast';
import { CAST } from './fellowship';

describe('the cast’s heights', () => {
  it('stand by kind: hobbits under dwarves under men, wizards tallest', () => {
    expect(heightOf('frodo')).toBe(HEIGHTS.hobbit);
    expect(heightOf('gimli')).toBe(HEIGHTS.dwarf);
    expect(heightOf('aragorn')).toBe(HEIGHTS.man);
    expect(heightOf('legolas')).toBe(HEIGHTS.elf);
    expect(heightOf('gandalfwhite')).toBe(HEIGHTS.wizard);
    expect(HEIGHTS.hobbit).toBeLessThan(HEIGHTS.dwarf);
    expect(HEIGHTS.dwarf).toBeLessThan(HEIGHTS.man);
    for (const id of CAST) expect(heightOf(id)).toBeGreaterThan(1);
  });
});
