// The nav map's browser checks' own sums and steps (navmap.mjs): the ship's
// sector in the readout's words, the jump's wonder picked by name, boxes that
// meet or sit inside another, and shipOnChart's open, read and shut, on a
// stand-in for Playwright's page.
import { describe, expect, it } from 'vitest';
import { CURVE_EDGE, insideCircle, jumpGoal, levelOnOpen, meet, sectorWords, shipOnChart, shipSector, within } from './navmap.mjs';

describe('the ship’s sector, as the readout says it', () => {
  it('is each axis over 120,000, rounded, with no minus zero', () => {
    expect(shipSector({ x: 250000, y: 1000, z: 0 })).toEqual([2, 0, 0]);
    expect(shipSector({ x: -1, y: -59999, z: -60001 })).toEqual([0, 0, -1]);
    expect(Object.is(shipSector({ x: -1, y: 0, z: 0 })[0], 0)).toBe(true);
  });

  it('writes a minus as one, and ends where the height begins', () => {
    expect(sectorWords({ x: 250000, y: 0, z: -130000 })).toBe('Sector 2, 0, −1 · ');
    expect(sectorWords({ x: 0, y: 0, z: 0 })).toBe('Sector 0, 0, 0 · ');
  });
});

describe('the level the chart opens on', () => {
  const citadel = { at: [0, 0, -66000] };
  it('is the system’s in the Curve, round the Citadel at its middle', () => {
    expect(levelOnOpen({ x: 100, y: 0, z: -66000 + CURVE_EDGE - 1 }, citadel)).toBe('system');
  });

  it('is the neighbourhood’s anywhere else, or with no Citadel to measure from', () => {
    expect(levelOnOpen({ x: 0, y: 0, z: -66000 + CURVE_EDGE + 1 }, citadel)).toBe('neighbourhood');
    expect(levelOnOpen({ x: 1000, y: 0, z: 4000 }, null)).toBe('neighbourhood');
  });
});

describe('the jump’s wonder, picked by name', () => {
  const wonders = [
    { id: 'aurelia', name: 'Aurelia', at: [-5000, 135, -6000], reach: 150 },
    { id: 'ember', name: 'Ember', at: [2300, 305, 9200], reach: 120 },
    { id: 'halcyon', name: 'Halcyon', at: [-9500, -370, 4000], reach: 100 },
  ];

  it('is Ember, with its place and how near counts as there', () => {
    expect(jumpGoal(wonders, { x: 0, z: 0 })).toEqual({ name: 'Ember', gx: 2300, gz: 9200, near: 720 });
  });

  it('is Halcyon when the ship starts by Ember, across the disc', () => {
    expect(jumpGoal(wonders, { x: 2300 + 500, z: 9200 + 400 })?.name).toBe('Halcyon');
  });

  it('is Ember from just past its reach and 600', () => {
    expect(jumpGoal(wonders, { x: 2300 + 721, z: 9200 })?.name).toBe('Ember');
  });

  it('is null when neither is listed', () => {
    expect(jumpGoal(wonders.slice(0, 1), { x: 0, z: 0 })).toBeNull();
    expect(jumpGoal(undefined, { x: 0, z: 0 })).toBeNull();
  });
});

describe('boxes', () => {
  const box = (left, top, width, height) => ({ left, top, width, height });
  it('meet when they overlap, not when they only touch', () => {
    expect(meet(box(0, 0, 10, 10), box(9, 9, 10, 10))).toBe(true);
    expect(meet(box(0, 0, 10, 10), box(10, 0, 10, 10))).toBe(false);
  });

  it('sit within another, give or take a pixel', () => {
    expect(within(box(0, 0, 10, 10), box(0, 0, 10, 10))).toBe(true);
    expect(within(box(-0.5, 0, 10, 10.5), box(0, 0, 10, 10))).toBe(true);
    expect(within(box(0, 0, 12, 10), box(0, 0, 10, 10))).toBe(false);
  });

  it('a centre is inside a circle out to 2 px past its rim', () => {
    const chart = box(100, 100, 200, 200); // (its centre at 200, 200, its radius 100)
    expect(insideCircle(chart, { x: 200 + 101.9, y: 200 })).toBe(true);
    expect(insideCircle(chart, { x: 200 + 72, y: 200 + 72 })).toBe(true);
    expect(insideCircle(chart, { x: 200 + 103, y: 200 })).toBe(false);
    expect(insideCircle(box(0, 0, 0, 0), { x: 0, y: 0 })).toBe(false); // (a chart with no size: hidden)
  });
});

// a page as shipOnChart uses it: whether the map is open, whether the ship's
// marker turns up, what the page measures, and every key and wait it's asked for
function stand({ open = false, drawn = true, read = {} } = {}) {
  const calls = [];
  let shown = open;
  return {
    calls,
    $: async (sel) => (sel === '.navmap' && shown ? {} : null),
    keyboard: {
      press: async (key) => {
        calls.push(key);
        if (key === 'm') shown = !shown;
        if (key === 'Escape') shown = false;
      },
    },
    waitForSelector: async (sel, opts = {}) => {
      calls.push(`${sel} ${opts.state ?? 'visible'}`);
      if (sel === '.navmap-ship' && !drawn) throw new Error('Timeout');
      if (sel === '.navmap' && (opts.state === 'detached') === shown) throw new Error('Timeout');
      return {};
    },
    evaluate: async () => ({ chart: { left: 0, top: 0, width: 600, height: 600 }, ship: { left: 284, top: 284, width: 32, height: 32 }, edge: false, readout: 'Sector 0, 0, 0 · Level with the disc', ...read }),
  };
}

describe('shipOnChart', () => {
  it('opens a shut map with M, reads the ship’s marker, and shuts it again', async () => {
    const page = stand();
    expect(await shipOnChart(page, { timeout: 10 })).toEqual({ drawn: true, inside: true, edge: false, readout: 'Sector 0, 0, 0 · Level with the disc' });
    expect(page.calls.filter((c) => c === 'm' || c === 'Escape')).toEqual(['m', 'Escape']);
    expect(page.calls).toContain('.navmap detached');
  });

  it('leaves a map it found open as it was', async () => {
    const page = stand({ open: true });
    await shipOnChart(page, { timeout: 10 });
    expect(page.calls.filter((c) => c === 'm' || c === 'Escape')).toEqual([]);
  });

  it('says a marker pinned to the rim is at the edge, and one past the circle isn’t inside', async () => {
    const pinned = await shipOnChart(stand({ read: { ship: { left: 568, top: 284, width: 32, height: 32 }, edge: true } }), { timeout: 10 });
    expect(pinned).toMatchObject({ drawn: true, inside: true, edge: true });
    const out = await shipOnChart(stand({ read: { ship: { left: 600, top: 284, width: 32, height: 32 } } }), { timeout: 10 });
    expect(out.inside).toBe(false);
  });

  it('a marker that never turns up is not drawn, and the map it opened is shut again', async () => {
    const page = stand({ drawn: false });
    expect(await shipOnChart(page, { timeout: 10 })).toEqual({ drawn: false, inside: false, edge: false, readout: null });
    expect(page.calls.at(-2)).toBe('Escape');
  });
});
