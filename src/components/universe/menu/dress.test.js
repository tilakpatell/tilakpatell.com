import { describe, expect, it } from 'vitest';
import { CREWS } from '../crews';
import { DRESSES, MENU_KEYS, MENU_TABS, dressFor, readMenuTab } from './dress';

describe('the flight menu’s rules', () => {
  it('dresses the menu as the crew flying, and in the house glass with no ship', () => {
    for (const c of CREWS) expect(dressFor(c.id)).toBe(c.id);
    expect(dressFor(null)).toBe('house');
    expect(dressFor('tie')).toBe('house');
    // (every crew has its dress, and every dress is one of them or the house's)
    expect(DRESSES.sort()).toEqual([...CREWS.map((c) => c.id), 'house'].sort());
  });

  it('has the six tabs in order, each with an element’s two letters for the lab', () => {
    expect(MENU_TABS.map((t) => t.id)).toEqual(['ship', 'cargo', 'map', 'settings', 'help', 'site']);
    for (const t of MENU_TABS) expect(t.mark).toMatch(/^[A-Z][a-z]$/);
  });

  it('opens on Cargo from I and on Settings from O, and on no tab it hasn’t got', () => {
    expect(MENU_KEYS).toEqual({ i: 'cargo', o: 'settings' });
    for (const tab of Object.values(MENU_KEYS)) expect(MENU_TABS.some((t) => t.id === tab)).toBe(true);
  });

  it('keeps the tab last open, and the Ship tab for anything else', () => {
    expect(readMenuTab('help')).toBe('help');
    expect(readMenuTab('shipyard')).toBe('ship');
    expect(readMenuTab(undefined)).toBe('ship');
  });
});
