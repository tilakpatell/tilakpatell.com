// Which kinds of thing a set of sectors holds, and the nearest of a kind:
// for the dev hooks that force each one, the endless check's sweep and the
// tests that every kind is somewhere near. Pure (no three.js).
//
// kindsIn(sectors) → Map<kind, number>: systems (as `system`, and those with companions as
//   `binary` or `trinary` too), stations, the lattice's kinds, every list's and the legacy
//   wonders'. sectors: any iterable (a caller holding a Map passes map.values()).
// nearestOfKind(sectors, kind, at, t = 0) → { id, kind, at, sector } | null: the nearest row of
//   that kind where it is at t (rowAt); `binary` and `trinary` name systems, `gargantuan` any form

import { companionsOf } from './companions';
import { rowAt } from './paths';
import { THING_KINDS, thingRow } from './things';

const bump = (m, k, n = 1) => m.set(k, (m.get(k) ?? 0) + n);
const pairs = (n) => (n === 1 ? 'binary' : n === 2 ? 'trinary' : null);

export function kindsIn(sectors) {
  const m = new Map();
  for (const s of sectors) {
    for (const sys of s.systems ?? []) {
      bump(m, 'system');
      const p = pairs(companionsOf(sys).length);
      if (p) bump(m, p);
    }
    if (s.stations?.length) bump(m, 'station', s.stations.length);
    const t = s.things;
    for (let i = 0; i < (t?.count ?? 0); i++) bump(m, THING_KINDS[t.kind[i]].kind);
    for (const rows of Object.values(s.extras ?? {})) for (const r of rows) bump(m, r.kind);
    for (const w of s.wonders ?? []) bump(m, w.kind);
  }
  return m;
}

function* rowsOf(s, kind) {
  if (kind === 'system' || kind === 'binary' || kind === 'trinary') {
    for (const sys of s.systems ?? []) if (kind === 'system' || pairs(companionsOf(sys).length) === kind) yield sys;
    return;
  }
  if (kind === 'station') {
    yield* s.stations ?? [];
    return;
  }
  const lattice = THING_KINDS.findIndex((k) => k.kind === kind);
  if (lattice >= 0) {
    const t = s.things;
    for (let i = 0; i < (t?.count ?? 0); i++) if (t.kind[i] === lattice) yield thingRow(s, i);
    return;
  }
  for (const rows of Object.values(s.extras ?? {})) for (const r of rows) if (r.kind === kind || (kind === 'gargantuan' && r.gargantuan)) yield r;
  for (const w of s.wonders ?? []) if (w.kind === kind) yield w;
}

export function nearestOfKind(sectors, kind, at, t = 0) {
  let best = null;
  let bestD = Infinity;
  for (const s of sectors)
    for (const r of rowsOf(s, kind)) {
      const p = rowAt(r, t);
      const d = (p[0] - at[0]) ** 2 + (p[1] - at[1]) ** 2 + (p[2] - at[2]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { id: r.id, kind: r.kind ?? kind, at: p, sector: s.id };
      }
    }
  return best;
}
