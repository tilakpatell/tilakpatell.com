import { describe, expect, it } from 'vitest';
import { TITLES } from './cable';
import { destinationById } from './destinations';

// The cable studio's signs (./cable.js) against its running order
// (./rows3.js): the meter names the next set by its spot's label, so the
// set it means has that name painted on it.
describe('the cable studio’s signs', () => {
  const d = destinationById('cablestudio');
  const label = (id) => d.hotspots.find((h) => h.id === id).label;

  it('titles every set in the running order with the name the meter gives it', () => {
    expect(Object.keys(TITLES).sort()).toEqual([...d.sequence.items].sort());
    for (const id of d.sequence.items) expect(label(id).toUpperCase(), id).toContain(TITLES[id]);
  });

  it('paints the legs’ flat as their show, and gives Lil’ Bits and the shmlo show a card each', () => {
    expect([TITLES['set-legs'], TITLES['set-bits'], TITLES['set-shmlo']]).toEqual(['BABY LEGS', 'LIL’ BITS', 'THE SHMLO SHOW']);
    expect(Object.values(TITLES)).not.toContain('PRECINCT');
  });
});
