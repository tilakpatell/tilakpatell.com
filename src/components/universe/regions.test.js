import { describe, expect, it } from 'vitest';
import { HUB_LIFT, LINK, REGIONS, REGION_COUNT, regionAt, regionById } from './regions';
import { PLACES } from './deep';
import { HOME_RADIUS, ORDER, POSITIONS, mapSectorOf as sectorOf } from './layout'; // (the Curve's or the main map's)
import { SOLIDS } from './ship';
import { byId } from './universes';
import { NEIGHBOURHOODS } from './neighbourhoods';

const main = PLACES.filter((p) => p.kind !== 'station' && sectorOf(...p.at) === 'main');
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('the regions (regions.js)', () => {
  it('has the home system first, then a region per neighbourhood, then the Core’s', () => {
    expect(REGIONS[0].id).toBe('home');
    expect(REGIONS[0].name).toBe('The home system');
    const rest = REGIONS.slice(1);
    expect(rest.length).toBe(REGION_COUNT);
    expect(rest.length).toBeGreaterThanOrEqual(6);
    expect(rest.length).toBeLessThanOrEqual(10);
    for (const n of NEIGHBOURHOODS) expect(rest.filter((r) => r.neighbourhood === n.id).map((r) => r.name), n.id).toEqual([n.name]);
    for (const r of rest.filter((x) => !x.neighbourhood)) expect(r.name.startsWith('Near ')).toBe(true);
  });

  it('puts every planet and wonder of the main sector in exactly one, and the stations in the home system', () => {
    for (const p of main) expect(REGIONS.filter((r) => r.members.includes(p.id)).length, p.id).toBe(1);
    for (const id of ORDER.filter((x) => byId(x).kind === 'core')) expect(REGIONS[0].members, id).toContain(id);
    // (nothing from the Rick and Morty sector: it's through the portal)
    for (const r of REGIONS) for (const id of r.members) expect(sectorOf(...PLACES.find((p) => p.id === id).at), id).toBe('main');
  });

  it('names a region for its biggest member', () => {
    for (const r of REGIONS.slice(1)) {
      const reaches = r.members.map((id) => PLACES.find((p) => p.id === id).reach);
      expect(PLACES.find((p) => p.id === r.id).reach).toBe(Math.max(...reaches));
      expect(r.members).toContain(r.id);
    }
  });

  it('orders the neighbourhoods by the angle of their hubs round the home sun', () => {
    const angles = REGIONS.slice(1).map((r) => Math.atan2(r.hub[2], r.hub[0]));
    expect([...angles].sort((a, b) => a - b)).toEqual(angles);
  });

  // (Review Focus 2: the Veil is 700 across, and a star's planets reach far)
  it('keeps every hub clear: out of 1.5 reaches of every place and out of everything solid', () => {
    for (const r of REGIONS) {
      for (const p of PLACES) if (sectorOf(...p.at) === 'main' && p.kind !== 'station') expect(dist(r.hub, p.at), `${r.id} hub and ${p.id}`).toBeGreaterThan(1.5 * p.reach);
      for (const o of SOLIDS) expect(dist(r.hub, o.at), `${r.id} hub and ${o.id}`).toBeGreaterThan(o.reach + 2);
      expect(Math.hypot(r.hub[0], r.hub[2]), r.id).toBeGreaterThan(HOME_RADIUS);
    }
  });

  it('lifts the hubs off the disc', () => {
    const rest = REGIONS.slice(1);
    for (const r of rest) {
      // (the members' middle, each weighted by its reach, as the hub is)
      const ms = r.members.map((id) => PLACES.find((p) => p.id === id));
      const mid = ms.reduce((s, p) => s + p.at[1] * p.reach, 0) / ms.reduce((s, p) => s + p.reach, 0);
      expect(Math.abs(r.hub[1] - mid), r.id).toBeGreaterThan(HUB_LIFT * 0.5);
    }
  });

  it('says which region a point is in, and null out in the void', () => {
    for (const r of REGIONS.slice(1)) for (const id of r.members) expect(regionAt(...PLACES.find((p) => p.id === id).at)?.id, id).toBe(r.id);
    expect(regionAt(0, 0, 0)?.id).toBe('home');
    expect(regionAt(0, 0, HOME_RADIUS + 100)?.id).toBe('home');
    // (a point more than LINK from every member: found from the data, half way out to the first fandom)
    const void_ = [0, 0, 4000];
    for (const p of main) expect(dist(void_, p.at)).toBeGreaterThan(LINK);
    expect(regionAt(...void_)).toBeNull();
    // and the Rick and Morty sector's not in any of them
    expect(regionAt(...POSITIONS.gazorpazorp)).toBeNull();
  });

  it('finds a region by its id', () => {
    for (const r of REGIONS) expect(regionById(r.id)).toBe(r);
    expect(regionById('nowhere')).toBeNull();
  });
});
