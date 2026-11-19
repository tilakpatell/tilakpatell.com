// What a scan pulse reaches and what it pays: every system (with its planets
// and its station), and every thing in the loaded sectors' lists, within the
// scanner's reach of the ship (Infinity: the whole sector the ship is in). The
// first scan of each pays into the record's data bank (record.js), by what it
// is, how far from the Core and how rich the region (values.js); a sector
// whose systems are all scanned is Surveyed, once. Pure: the sectors come in
// as the expanse made them, the clock and the area too.
//
// GARGANTUAN_KINDS: the extras kinds a scan reads as a gargantuan
// sweep({ sectors, at, reach, t, record, rowAt, areaOf }) → { systems,
//   things, surveyed, paid }: how many of each the pulse scanned for the first
//   time, and the data it paid into the bank

import { parseSectorKey, sectorAt } from '../../../lib/space/address.js';
import { SURVEYED, worthOf } from './values';

export const GARGANTUAN_KINDS = new Set(['hole', 'arc', 'hulk', 'giant', 'dyson']);
const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const far = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

export function sweep({ sectors, at, reach, t = 0, record, rowAt = (r) => r.at, areaOf }) {
  const out = { systems: 0, things: 0, surveyed: 0, paid: 0 };
  if (!record || !Array.isArray(at)) return out;
  const here = sectorAt(...at);
  const whole = !Number.isFinite(reach);
  const near = (p, cube) => (whole ? same(cube, here) : Array.isArray(p) && far(p, at) <= reach);
  for (const s of sectors ?? []) {
    const cube = parseSectorKey(s?.id ?? '');
    if (!cube) continue;
    if (whole && !same(cube, here)) continue;
    const area = areaOf ? areaOf(cube) : { richness: 0, d: Math.max(...cube.map(Math.abs)) };
    const d = area.d ?? Math.max(...cube.map(Math.abs));
    const rich = area.richness ?? 0;
    for (const sys of s.systems ?? []) {
      if (!near(sys.at, cube)) continue;
      const station = (s.stations ?? []).some((st) => st.i === sys.i);
      const worth = worthOf('system', d, rich) + (sys.planets?.length ?? 0) * worthOf('planet', d, rich) + (station ? worthOf('station', d, rich) : 0);
      const n = record.scanSystem(cube, sys.i, worth);
      if (n) (out.systems++, (out.paid += n));
    }
    for (const rows of Object.values(s.extras ?? {}))
      for (const r of rows ?? []) {
        if (!r?.id || !near(rowAt(r, t), cube)) continue;
        const n = record.scanThing(cube, r.id, worthOf(GARGANTUAN_KINDS.has(r.kind) ? 'gargantuan' : r.kind, d, rich));
        if (n) (out.things++, (out.paid += n));
      }
    const bonus = record.survey(cube, s.systems?.length ?? 0, SURVEYED * worthOf('system', d, rich));
    if (bonus) (out.surveyed++, (out.paid += bonus));
  }
  return out;
}
