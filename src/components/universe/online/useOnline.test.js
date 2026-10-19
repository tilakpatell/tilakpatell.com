import { describe, expect, it, vi } from 'vitest';

// (what useOnline.js reads the ship and the wallet from, stood in for: only
// the chat’s count is tested here, and the real ones bring the crews and the
// wallet, a second’s import)
vi.mock('../EconomyProvider', () => ({ useEconomy: () => ({}) }));
vi.mock('../shipyard/build', () => ({ HULL_KEY: 'hull', readHulls: () => ({}) }));
vi.mock('../../rickmorty/wardrobe/looks', () => ({ LOOK_KEY: 'looks', readLooks: () => ({}) }));
vi.mock('../outfit', () => ({ LOADOUT_KEY: 'loadout', STOCK_LOADOUT: {}, readLoadouts: () => ({}) }));

const { unreadIn } = await import('./useOnline');

const OURS = '0123456789abcdef';
const OLD = 'fedcba9876543210';
// a line as useOnline keeps it: the link’s, stamped with its party, and its key here
const line = (key, party, mine = false) => ({ key, party, mine, from: 'b'.repeat(64), name: 'Bravo', text: 'Over here', at: 1, seen: 1 });

describe('the chat’s unread count', () => {
  it('counts the others’ lines in your party since you last read it', () => {
    const chat = [line(0, OURS), line(1, OURS, true), line(2, OURS), line(3, OURS)];
    expect(unreadIn(chat, OURS, 0)).toBe(3);
    expect(unreadIn(chat, OURS, 3)).toBe(1);
    expect(unreadIn(chat, OURS, 4)).toBe(0);
  });

  it('counts none from a party you were in before, and none out of a party', () => {
    const chat = [line(0, OLD), line(1, OLD), line(2, OURS)];
    expect(unreadIn(chat, OURS, 0)).toBe(1);
    expect(unreadIn(chat, OLD, 0)).toBe(2);
    expect(unreadIn(chat, null, 0)).toBe(0);
  });
});
