import { describe, expect, it } from 'vitest';
import { BEATS } from './beats';
import { LORE } from './lore';
import { COURT, GATE, floorAt, toStage } from './place';
import { LINES } from '../../voicelines';
import { CLIPS } from '../../../../../lib/clips';
import { RIGS } from '../../director';
import { stageById } from '../index';

const by = Object.fromEntries(BEATS.map((b) => [b.id, b]));

describe('the White City’s beats', () => {
  it('the brief’s moments in order: the field, the causeway, the gate, the Court held for the crowning', () => {
    expect(BEATS.map((b) => b.id)).toEqual(['pelennor', 'causeway', 'gate', 'court']);
    for (let i = 1; i < BEATS.length; i++) expect(BEATS[i].at).toBeGreaterThan(BEATS[i - 1].at);
    for (const b of BEATS) expect(RIGS).toContain(b.rig);
    expect(by.court).toMatchObject({ rig: 'seat', cut: 0, clip: 'kingsArrival', deed: { verb: 'press', clip: 'bowToNoOne' } });
    expect(by.court.hold).toBeGreaterThanOrEqual(20);
    // (the Court holds to the stage's end: the walk is never seen out of it)
    expect(by.court.at + by.court.reach).toBeGreaterThanOrEqual(stageById('minas-tirith').length);
    for (const b of BEATS) for (const l of b.lines ?? []) expect(LINES[l], l).toBeTruthy();
    for (const c of [by.court.clip, by.court.deed.clip]) expect(CLIPS[c], c).toBeTruthy();
    expect(LORE.length).toBeGreaterThanOrEqual(2);
  });

  it('the city faces down the road: its gate on the lane, the causeway climbing to its sill', () => {
    expect(toStage(151, 10, 0)).toEqual([0, 10, GATE]);
    expect(floorAt(0, 20)).toBe(null);
    expect(floorAt(0, 40)).toBe(0);
    expect(floorAt(0, GATE)).toBeCloseTo(10, 6);
    const half = floorAt(0, (GATE + 65) / 2);
    expect(half).toBeGreaterThan(3);
    expect(half).toBeLessThan(7);
    // (off the causeway: the land's)
    expect(floorAt(6, 80)).toBe(null);
  });

  it('the crowning in the Court: the King before the Tree, the four before him between it and the fountain', () => {
    expect(COURT.y).toBe(76);
    expect(COURT.aragorn[1]).toBeLessThan(COURT.tree[2]);
    for (const [x, z] of Object.values(COURT.hobbits)) {
      expect(z).toBeLessThan(COURT.aragorn[1]);
      expect(z).toBeGreaterThan(COURT.fountain[2]);
      expect(Math.abs(x)).toBeLessThan(2);
    }
    // (the camera behind the four, looking at the King)
    expect(COURT.camera[2]).toBeLessThan(COURT.hobbits.frodo[1]);
  });
});
