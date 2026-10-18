import { describe, expect, it, vi } from 'vitest';

// Lane 2 may lift the main map's edge to Infinity. This file gives the chart
// that edge (a mock scoped to this file) and checks the presets stay finite.
vi.mock('../nav', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, CHART_VIEWS: { ...real.CHART_VIEWS, all: { ...real.CHART_VIEWS.all, r: Infinity } } };
});

const { CHART } = await import('./projection');
const { SECTORS } = await import('../layout');
const { openView, presetView } = await import('./marks');

describe('a main map with no edge', () => {
  it('clamps the universe preset and the no-ship opening to the chart’s largest range', () => {
    expect(presetView('all', null).range).toBe(CHART.range.max);
    expect(openView(null).range).toBe(CHART.range.max);
    expect(openView(undefined).range).toBe(CHART.range.max);
  });
  it('leaves the other presets and the openings on a ship as they were', () => {
    expect(presetView('home', null).range).toBeLessThan(CHART.range.max);
    const o = SECTORS.rickmorty.origin;
    expect(openView({ x: o[0] + 900, y: 0, z: o[2] }).range).toBe(SECTORS.rickmorty.edge);
    expect(openView({ x: 1, y: 0, z: 1 }).range).toBe(CHART.range.open);
  });
});
