import { describe, expect, it } from 'vitest';
import { BEATS } from './beats';
import { LORE } from './lore';
import { DECK, FAREWELL, QUAY, SAIL, SHIP, STAYING, WATER, floorAt, shipAt } from './place';
import { LINES } from '../../voicelines';
import { CLIPS } from '../../../../../lib/clips';
import { RIGS } from '../../director';
import { modeAt, stageById } from '../index';

const by = Object.fromEntries(BEATS.map((b) => [b.id, b]));
const STAGE = stageById('havens');

describe('the Grey Havens’ beats', () => {
  it('the brief’s moments in order: the Gulf, the quay, the farewell held for the deed, the sailing, away', () => {
    expect(BEATS.map((b) => b.id)).toEqual(['gulf', 'quay', 'farewell', 'sail', 'away']);
    for (let i = 1; i < BEATS.length; i++) expect(BEATS[i].at).toBeGreaterThan(BEATS[i - 1].at);
    for (const b of BEATS) expect(RIGS).toContain(b.rig);
    expect(by.farewell).toMatchObject({ rig: 'seat', cut: 0, deed: { verb: 'press' } });
    expect(by.sail).toMatchObject({ at: SAIL, rig: 'lead', clip: 'lotr' });
    expect(CLIPS.lotr).toBeTruthy();
    for (const b of BEATS) for (const l of [...(b.lines ?? []), ...(b.deed?.lines ?? [])]) expect(LINES[l], l).toBeTruthy();
    // (the last beat holds to the ride's end)
    expect(by.away.at + by.away.reach).toBeGreaterThanOrEqual(STAGE.length);
    expect(modeAt(STAGE, SAIL + 1)).toBe('ship');
    expect(modeAt(STAGE, SAIL - 1)).toBe('walk');
    expect(LORE.length).toBeGreaterThanOrEqual(2);
  });

  it('the quay carries the walkers over the water, the ramp up to it from the beach', () => {
    expect(floorAt(0, (QUAY.z[0] + QUAY.z[1]) / 2)).toBe(QUAY.top);
    expect(floorAt(QUAY.x + 1, 100)).toBe(null);
    expect(floorAt(0, QUAY.from - 1)).toBe(null);
    const mid = floorAt(0, (QUAY.from + QUAY.z[0]) / 2);
    expect(mid).toBeGreaterThan(WATER);
    expect(mid).toBeLessThan(QUAY.top);
    expect(QUAY.top).toBeGreaterThan(WATER);
  });

  it('the ship moored by the quay’s end, then out onto the lane carrying those aboard, never back', () => {
    const moored = shipAt(SAIL - 10);
    expect(moored.x).toBeCloseTo(SHIP.moor[0], 6);
    expect(moored.x - SHIP.beam / 2).toBeGreaterThan(QUAY.x);
    const out = shipAt(SAIL + 30);
    expect(out.x).toBeCloseTo(0, 6);
    expect(floorAt(-0.45, SAIL + 30 + 2, SAIL + 30)).toBe(SHIP.deck);
    let z = -Infinity;
    for (let m = SAIL - 20; m < STAGE.length; m += 5) {
      const s = shipAt(m);
      expect(s.z).toBeGreaterThanOrEqual(z);
      z = s.z;
    }
    // (the places aboard on her deck; the farewell and the three on the quay)
    for (const [x, dz] of Object.values(DECK)) {
      expect(Math.abs(x)).toBeLessThan(SHIP.beam / 2);
      expect(Math.abs(dz)).toBeLessThan(SHIP.length / 2);
    }
    for (const [x, z2] of [...Object.values(FAREWELL), ...Object.values(STAYING)]) expect(floorAt(x, z2)).toBe(QUAY.top);
  });
});
