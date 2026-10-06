import { describe, expect, it } from 'vitest';
import { mouthStep } from './mouth';

const run = (levels, state = { open: 0, peak: 0.02 }) => levels.reduce((s, l) => mouthStep(s, l), state);

describe('a talking mouth', () => {
  it('stays shut in silence', () => {
    expect(run([0, 0, 0]).open).toBe(0);
  });
  it('opens on a loud syllable, quiet blips as much as a full recording', () => {
    expect(run([0.04, 0.04, 0.04]).open).toBeGreaterThan(0.8);
    expect(run([0.3, 0.3, 0.3]).open).toBeGreaterThan(0.8);
  });
  it('opens less for a softer sound after a loud one', () => {
    const loud = run([0.3, 0.3, 0.3]);
    expect(run(Array(10).fill(0.08), loud).open).toBeLessThan(0.5);
  });
  it('snaps open faster than it eases shut', () => {
    const opened = mouthStep({ open: 0, peak: 0.1 }, 0.1).open;
    const shutting = mouthStep({ open: 1, peak: 0.1 }, 0);
    expect(opened).toBeGreaterThan(1 - shutting.open);
    expect(run(Array(30).fill(0), shutting).open).toBe(0);
  });
});
