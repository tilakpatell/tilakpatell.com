import { describe, expect, it, vi } from 'vitest';

// Lane 2 may lift the main map's edge to Infinity. This file gives the chart
// that edge, and a Curve and a home view with out-of-range ranges, in a mock
// scoped to this file (layout's sectors stay real, so a ship is still in the
// Curve), and checks every preset and opening is clamped to what can be drawn.
vi.mock('../nav', async (importOriginal) => {
  const real = await importOriginal();
  const v = real.CHART_VIEWS;
  return {
    ...real,
    CHART_VIEWS: {
      ...v,
      all: { ...v.all, r: Infinity },
      home: { ...v.home, r: 1 },
      rickmorty: { ...v.rickmorty, r: Infinity },
    },
  };
});

const { CHART } = await import('./projection');
const { SECTORS } = await import('../layout');
const { liveMarks, openView, presetView } = await import('./marks');

describe('a main map with no edge, and ranges out of bounds', () => {
  it('clamps the universe preset and the no-ship opening to the chart’s largest range', () => {
    expect(presetView('all', null).range).toBe(CHART.range.max);
    expect(openView(null).range).toBe(CHART.range.max);
    expect(openView(undefined).range).toBe(CHART.range.max);
  });
  it('clamps a too-large Curve range on opening there, and a too-small home range up', () => {
    const o = SECTORS.rickmorty.origin;
    expect(openView({ x: o[0] + 900, y: 0, z: o[2] }).range).toBe(CHART.range.max);
    expect(presetView('rickmorty', null).range).toBe(CHART.range.max);
    expect(presetView('home', null).range).toBe(CHART.range.min);
  });
  it('leaves an ordinary opening as it was', () => {
    expect(openView({ x: 1, y: 0, z: 1 }).range).toBe(CHART.range.open);
  });
});

describe('a far fight with no label', () => {
  it('has an empty name, not undefined', () => {
    const [fight] = liveMarks({ ship: { x: 0, y: 0, z: 0 }, farFights: [{ id: 'f9', x: 5, z: 5 }] });
    expect(fight).toMatchObject({ id: 'fight:f9', name: '' });
  });
});
