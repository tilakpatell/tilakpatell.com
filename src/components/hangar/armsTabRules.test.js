import { describe, expect, it } from 'vitest';
import { STOCK_LOADOUT } from '../universe/shared/hangar';
import { LINE_SLOT, handGuns, shipLines } from './armsTabRules';

describe('the Hangar’s arms', () => {
  it('reads the ship’s three lines as fitted', () => {
    const lines = shipLines('xwing', STOCK_LOADOUT);
    expect(lines.map((l) => l.name)).toEqual(['Laser cannons', 'Ion scatter', 'Proton torpedoes']);
    expect(lines.map((l) => l.line)).toEqual(['primary', 'secondary', 'ordnance']);
    expect(lines[2].rack).toEqual({ ammo: 4, reload: 6.5 });
    expect(lines[0].rack).toBe(null);
    expect(lines[0].rate).toBeCloseTo(1 / 0.12);
    expect(lines[1].shots).toBe(5);
  });
  it('sends each line to its shipyard slot', () => {
    expect(LINE_SLOT).toEqual({ primary: 'guns', secondary: 'secondary', ordnance: 'ordnance' });
  });
  it('lists a gunman’s guns, his own first, none twice', () => {
    const guns = handGuns('han');
    expect(guns[0].id).toBe('blaster');
    expect(new Set(guns.map((g) => g.id)).size).toBe(guns.length);
    expect(guns.every((g) => g.name && g.rate > 0 && g.range > 0)).toBe(true);
  });
  it('lists nothing for a Jedi or Artoo', () => {
    expect(handGuns('luke')).toEqual([]);
    expect(handGuns('artoo')).toEqual([]);
  });
});
