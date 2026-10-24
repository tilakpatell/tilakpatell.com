import { describe, expect, it } from 'vitest';
import { destinationById } from '../../src/components/rickmorty/world/dimensions/destinations';
import { home, ledgeOf, stand, wayIn } from './places.mjs';

const N = Math.PI / 2;
const near = (got, want) => want.forEach((v, i) => expect(got[i]).toBeCloseTo(v, 6));

// every place's spot the browser check walks Morty up to, by the place
const USED = {
  agency: ['sewer'],
  microverse: ['zeepcells', 'gooble'],
  anatomy: ['mapkiosk', 'mapspleen', 'maprib', 'mapboat'],
  gromflomites: ['fartcell'],
  needful: ['typewriter', 'aftershave', 'cream', 'shopclock'],
  vat: ['vatrim'],
  jerryboree: ['jerrytv', 'jerryreal'],
  gloopynoops: ['shrimply', 'jerrysthings'],
  cablestudio: ['cablebooth', 'set-ants', 'set-legs', 'set-sneezy', 'set-field', 'set-doors', 'set-bits', 'set-shmlo'],
  schwifty: ['mic'],
  fantasy: ['goblins', 'giants'],
  froopyland: ['tommy'],
  pluto: ['claim-growing', 'claim-moons', 'claim-mines', 'claim-planet'],
  gearworld: ['cogs', 'gcog-nw', 'gcog-ne', 'gcog-se', 'gcog-sw'],
  birdworld: ['bcrystal-path', 'bcrystal-trees', 'bcrystal-east', 'bcrystal-west', 'bcrystal-grass'],
  heistcon: ['heistbadge', 'heister-b1', 'heister-a1', 'heistplan', 'heistbooth', 'heisthire', 'heistskull', 'heistcars'],
  vindicators: ['saw'],
};

describe('where the browser check stands Morty', () => {
  it('stands him in front of a spot, on the side he faces it from', () => {
    near(stand({ x: -402, z: 1695 }, N), [-402, 1695.8, N]);
    near(stand({ x: -406.5, z: 1704.5 }, Math.PI), [-405.7, 1704.5, Math.PI]);
    near(stand({ x: -407, z: 1401 }, 0), [-407.8, 1401, 0]);
    near(stand({ x: -400, z: 2687.6 }, -N), [-400, 2686.8, -N]);
    near(stand({ x: -400, z: 4198 }, N, 1.4), [-400, 4199.4, N]);
  });

  it('reads a place’s way in and its portal home from the data', () => {
    expect(wayIn(destinationById('jerryboree'))).toBeCloseTo(1703.4, 6);
    expect(wayIn(destinationById('vat'))).toBeCloseTo(4207.4, 6);
    near(home(destinationById('jerryboree')), [-400, 1705.6, -N]);
    near(home(destinationById('cablestudio')), [-400, 3815.6, -N]);
  });

  it('reads a ledge from the data: where it is, and how high', () => {
    const [x, z, top] = ledgeOf(destinationById('fantasy'), 'landing-1');
    expect(x).toBeCloseTo(-414.3, 2);
    expect(z).toBeCloseTo(1288.88, 2);
    expect(top).toBe(2.3);
    expect(ledgeOf(destinationById('fantasy'), 'beanstalk')[2]).toBe(20.9);
    expect(ledgeOf(destinationById('birdworld'), 'tower-b')[2]).toBe(9.6);
    // (a solid that isn't a ledge, or no solid at all: said so)
    expect(() => ledgeOf(destinationById('fantasy'), 'tavern')).toThrow(/fantasy has no ledge tavern/);
    expect(() => ledgeOf(destinationById('fantasy'), 'nope')).toThrow(/fantasy has no ledge nope/);
  });

  it('finds every spot the check uses in the data', () => {
    for (const [area, ids] of Object.entries(USED)) {
      const spots = destinationById(area).hotspots.map((h) => h.id);
      for (const id of ids) expect(spots, `${area} has no ${id}`).toContain(id);
    }
  });
});
