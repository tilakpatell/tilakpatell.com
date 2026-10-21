import { describe, expect, it } from 'vitest';
import { BEATS } from './beats';
import { sweepBeats } from '../fixtures/beats';
import { CHANGES } from '../../fellowship';
import { modeAt, stageById } from '../index';
import { LANDMARKS } from '../ranges';
import { MOUNT } from './place';

describe('Gorgoroth’s beats', () => {
  sweepBeats('gorgoroth', BEATS);

  it('the brief’s moments: the plain, the column, the beam, the wind, the carry, the Cracks held, the eruption, the Eagles', () => {
    expect(BEATS.map((b) => b.id)).toEqual(['plain', 'column', 'beam', 'wind', 'carry', 'cracks', 'eruption', 'eagles']);
    const by = Object.fromEntries(BEATS.map((b) => [b.id, b]));
    expect(by.beam).toMatchObject({ rig: 'wide', cut: 0 });
    // (Sam's line once the visitor has carried Frodo up: the deed's)
    expect(by.carry).toMatchObject({ rig: 'side', deed: { verb: 'rhythm', clip: 'carryYou' } });
    expect(by.cracks.deed).toMatchObject({ verb: 'hold' });
    expect(by.cracks.deed.at).toBeLessThan(by.cracks.hold);
    expect(by.cracks).toMatchObject({ rig: 'seat', cut: 0, clip: 'myPrecious' });
    expect(by.cracks.hold).toBeGreaterThanOrEqual(20);
    expect(by.eruption).toMatchObject({ rig: 'wide', clip: 'oneRing' });
    // (the eruption looks between the Mountain and the Tower, so both are in its frame)
    const [cx, , cz] = by.eruption.params.at;
    const [lx, , lz] = by.eruption.params.lookAt;
    const bearing = (x, z) => (Math.atan2(x - cx, z - cz) * 180) / Math.PI;
    const tower = LANDMARKS.gorgoroth.find((m) => m.kind === 'tower');
    const towerAt = [Math.sin((tower.az * Math.PI) / 180) * tower.dist, Math.cos((tower.az * Math.PI) / 180) * tower.dist];
    const look = bearing(lx, lz);
    expect(look).toBeGreaterThan(bearing(MOUNT.at[0], MOUNT.at[2]));
    expect(look).toBeLessThan(bearing(...towerAt));
    expect(bearing(...towerAt) - bearing(MOUNT.at[0], MOUNT.at[2])).toBeLessThan(50);
    expect(by.eagles).toMatchObject({ rig: 'crane' });
    // (out of Mordor by a cut, the black at the beat's end: the White City's land is never beside it)
    expect(by.eagles.fx).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'black' })]));
    expect(stageById('minas-tirith').cut).toBe(true);
  });

  it('walked, then carried from the carry’s mark, on foot at the Cracks, and on the Eagles at theirs', () => {
    const st = stageById('gorgoroth');
    const by = Object.fromEntries(BEATS.map((b) => [b.id, b]));
    expect(modeAt(st, by.wind.at)).toBe('walk');
    expect(modeAt(st, by.carry.at)).toBe('carried');
    expect(modeAt(st, by.cracks.at)).toBe('walk');
    expect(modeAt(st, by.eagles.at)).toBe('eagle');
    // (the fellowship as the beats have them: carried from the carry; Gollum gone after the Cracks; lying on the rock by the Eagles)
    const of = (local) => CHANGES.find((c) => c.stage === 'gorgoroth' && c.local === local);
    expect(of(by.carry.at).state).toMatchObject({ sam: 'carrying', frodo: 'carried' });
    const gone = CHANGES.find((c) => c.stage === 'gorgoroth' && c.remove?.includes('gollum'));
    expect(gone.local).toBeGreaterThan(by.cracks.at);
    expect(gone.local).toBeLessThan(by.eruption.at);
    const lying = CHANGES.find((c) => c.stage === 'gorgoroth' && c.state?.frodo === 'lying');
    expect(lying.local).toBeGreaterThan(by.eruption.at);
    expect(lying.local).toBeLessThan(by.eagles.at);
  });
});
