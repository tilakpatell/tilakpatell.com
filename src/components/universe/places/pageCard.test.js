import { describe, expect, it } from 'vitest';
import { cardRow } from './pageCard';

const id = 'E:1,0,2:0:0';
const dest = { id, generated: true, name: 'Ostra' };
describe('the card a link shows', () => {
  it('waits while a scene loads or looks, and ends the wait when there’s no scene', () => {
    expect(cardRow(null, null, 'live')).toBeNull();
    expect(cardRow(id, null, 'loading')).toEqual({ id, generated: true, pending: true, cube: [1, 2, 0] });
    expect(cardRow(id, null, 'live')).toEqual({ id, generated: true, pending: true, cube: [1, 2, 0] });
    expect(cardRow(id, null, 'flat')).toEqual({ id, generated: true, flat: true, cube: [1, 2, 0] });
    expect(cardRow(id, { id: 'E:5,5:0', dest: {} }, 'flat').flat).toBe(true);
  });
  it('shows what the scene found, or nothing for nothing there', () => {
    expect(cardRow(id, { id, dest }, 'live')).toBe(dest);
    expect(cardRow(id, { id, dest: null }, 'live')).toBeNull();
    expect(cardRow(id, { id, dest }, 'flat')).toBe(dest);
  });
});
