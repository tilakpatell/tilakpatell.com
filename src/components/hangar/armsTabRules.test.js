import { describe, expect, it } from 'vitest';
import { STOCK_LOADOUT } from '../universe/shared/hangar';
import { LINE_SLOT, handGuns, shipLines, uniqueArms } from './armsTabRules';

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

describe('the Hangar’s unique weapons', () => {
  it('lists the skill tree’s eight, four for the ship and four for the hand, each from a universe', () => {
    const list = uniqueArms([]);
    expect(list.map((u) => u.id)).toEqual(['seismic', 'darkmatter', 'crystal', 'energon', 'amban', 'particle', 'm60', 'gauntlet']);
    expect(list.filter((u) => u.where === 'ship').map((u) => u.slot)).toEqual(['ordnance', 'secondary', 'ordnance', 'secondary']);
    expect(new Set(list.map((u) => u.from)).size).toBe(4);
    expect(list.every((u) => !u.open)).toBe(true);
    expect(list[0].opens).toBe('Skills · Guns · Seismic charge');
    expect(list[4].opens).toBe('Skills · Ground · Amban phase-pulse rifle');
    expect(list[4].does).toMatch(/^In the hand: one heavy shot/);
  });
  it('opens the ones the tree has taken', () => {
    expect(uniqueArms(['energon', 'm60']).filter((u) => u.open).map((u) => u.id)).toEqual(['energon', 'm60']);
  });
  it('offers a gunman the unique guns once they’re opened, and reads a fitted one on the ship’s lines only then', () => {
    expect(handGuns('han').some((g) => g.unique)).toBe(false);
    const guns = handGuns('han', ['particle']);
    expect(guns.filter((g) => g.unique).map((g) => g.id)).toEqual(['particle']);
    expect(handGuns('luke', ['particle'])).toEqual([]);
    const fitted = { ...STOCK_LOADOUT, ordnance: 'seismic' };
    expect(shipLines('xwing', fitted)[2].weapon).toBe('heavy');
    const open = shipLines('xwing', fitted, { arms: ['seismic'] })[2];
    expect(open).toMatchObject({ weapon: 'seismic', name: 'Seismic charges', rack: { ammo: 2, reload: 10 } });
  });
});
