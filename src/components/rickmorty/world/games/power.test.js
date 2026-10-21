import { describe, expect, it } from 'vitest';
import { TUNING, newPower, powerNews, powerReadout, stepPower } from './power';

// steps with these inputs, one a frame
const run = (g, inputs, dt = 1 / 60) => inputs.reduce((s, input) => stepPower(s, input, dt), g);

describe('the power kind: Zeep’s cells to the gooble boxes', () => {
  it('waits, at full charge, till the first cell is taken', () => {
    const g = newPower();
    expect(g).toMatchObject({ phase: 'idle', need: TUNING.need, delivered: 0, carrying: false, charge: TUNING.charge, max: TUNING.charge, told: false });
    const later = run(g, Array(600).fill({}));
    expect(later.phase).toBe('idle');
    expect(later.charge).toBe(TUNING.charge);
  });

  it('starts the run, and the drain, with the first cell taken', () => {
    const g = stepPower(newPower(), { take: true });
    expect(g).toMatchObject({ phase: 'run', carrying: true });
    expect(g.events).toEqual([{ type: 'take' }]);
    const next = stepPower(g, {}, 1);
    expect(next.charge).toBeCloseTo(TUNING.charge - 0.1, 5); // (a step is at most a tenth of a second)
  });

  it('carries one cell at a time, and a give with nothing in hand is nothing', () => {
    let g = stepPower(newPower(), { take: true });
    g = stepPower(g, { take: true });
    expect(g).toMatchObject({ carrying: true, delivered: 0 });
    expect(g.events).toEqual([]);
    g = stepPower(g, { give: true });
    expect(g).toMatchObject({ carrying: false, delivered: 1 });
    expect(g.events).toEqual([{ type: 'give' }]);
    g = stepPower(g, { give: true });
    expect(g).toMatchObject({ carrying: false, delivered: 1 });
    expect(g.events).toEqual([]);
  });

  it('is won at the last cell given', () => {
    let g = newPower();
    for (let i = 0; i < TUNING.need; i++) g = run(g, [{ take: true }, { give: true }]);
    expect(g.phase).toBe('won');
    expect(g.delivered).toBe(TUNING.need);
    expect(g.events).toEqual([{ type: 'give' }, { type: 'won' }]);
  });

  it('is lost when the charge runs out, a cell in hand or not', () => {
    const g = run(stepPower(newPower(), { take: true }), Array(Math.ceil(TUNING.charge / 0.1) + 1).fill({}), 0.1);
    expect(g.phase).toBe('lost');
    expect(g.charge).toBe(0);
  });

  it('changes nothing once it’s over', () => {
    const lost = { ...newPower(), phase: 'lost', charge: 0 };
    const after = stepPower(lost, { take: true, give: true }, 0.5);
    expect(after).toEqual({ ...lost, events: [] });
  });

  it('takes perks and, until the shop decides what they do here, reads none', () => {
    expect(newPower({ perks: { laser: 3 } })).toEqual(newPower());
  });

  it('tells the place what to say: the win till it’s kept, the loss once and not in a fade', () => {
    const won = { ...newPower(), phase: 'won' };
    expect(powerNews(won, { done: false, fading: false })).toBe('done');
    expect(powerNews(won, { done: true, fading: false })).toBe(null);
    const lost = { ...newPower(), phase: 'lost' };
    expect(powerNews(lost, { done: false, fading: false })).toBe('caught');
    expect(powerNews(lost, { done: false, fading: true })).toBe(null);
    expect(powerNews({ ...lost, told: true }, { done: false, fading: false })).toBe(null);
    expect(powerNews(newPower(), { done: false, fading: false })).toBe(null);
  });

  it('reads out for the HUD only while the run’s on', () => {
    const g = { ...stepPower(newPower(), { take: true }), delivered: 2 };
    expect(powerReadout(g)).toEqual({ on: true, vitals: { value: 100, max: 100, low: false }, line: 'Cells 2 of 4, one in hand' });
    const low = { ...g, carrying: false, charge: TUNING.charge * 0.2 };
    expect(powerReadout(low)).toEqual({ on: true, vitals: { value: 20, max: 100, low: true }, line: 'Cells 2 of 4' });
    expect(powerReadout(newPower())).toEqual({ on: false, vitals: null, line: '' });
    expect(powerReadout(null)).toEqual({ on: false, vitals: null, line: '' });
  });
});
