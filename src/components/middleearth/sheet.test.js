import { describe, expect, it } from 'vitest';
import { place } from './geography';
import { STOPS } from './road';
import { FORESTS, LAKES, MARSHES, RANGES, REGIONS, RIVERS, ROADS, SEAS, SHEET, lineAt, pathOf, placeAt, project, roadFraction, unproject } from './sheet';

// The relations the research note’s §5 lists as wrong on the hand-drawn
// sheet, each held here (docs/research/2026-10-18-middle-earth-map-geography.md).
const miles = (a, b) => Math.hypot(place(a).east - place(b).east, place(a).south - place(b).south);
const units = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// where a polyline is at a row y (the first segment that spans it), as x
const xAtRow = (pts, y) => {
  for (let i = 1; i < pts.length; i++) {
    const [[x0, y0], [x1, y1]] = [pts[i - 1], pts[i]];
    if ((y - y0) * (y - y1) <= 0 && y0 !== y1) return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
  }
  return null;
};
const toSegment = (p, a, b) => {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return units(p, [a[0] + dx * u, a[1] + dy * u]);
};
const toLine = (p, pts) => Math.min(...pts.slice(1).map((b, i) => toSegment(p, pts[i], b)));
const crosses = (a, b, c, d) => {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
};
const on = ([x, y]) => x >= 0 && x <= SHEET.w && y >= 0 && y <= SHEET.h;

describe('the projection', () => {
  it('puts Hobbiton at (210, 165), two miles a unit, north up', () => {
    expect(SHEET).toEqual({ w: 800, h: 560 });
    expect(project(0, 0)).toEqual([210, 165]);
    expect(project(675, 600)).toEqual([547.5, 465]);
    expect(placeAt('minas-tirith')).toEqual([547.5, 465]);
    for (const [e, s] of [[0, 0], [-160, 5], [1180, 790], [33.3, -77.7]]) {
      const [e2, s2] = unproject(...project(e, s));
      expect(e2).toBeCloseTo(e, 9);
      expect(s2).toBeCloseTo(s, 9);
    }
  });
  it('throws on a place it does not know', () => {
    expect(() => placeAt('narnia')).toThrow();
  });
  it('measures the road by Fonstad’s miles', () => {
    expect(roadFraction('hobbiton')).toBe(0);
    expect(roadFraction('mount-doom')).toBe(1);
    expect(Math.abs(roadFraction('rivendell') - 0.257)).toBeLessThan(0.01);
    expect(Math.abs(roadFraction('lorien') - 0.52)).toBeLessThan(0.01);
    expect(Math.abs(roadFraction('amon-hen') - 0.74)).toBeLessThan(0.01);
    expect(Math.abs(roadFraction('black-gate') - 0.83)).toBeLessThan(0.01);
  });
  it('draws a smooth path through every point, closed when asked', () => {
    expect(pathOf([[0, 0], [10, 0]])).toBe('M0 0 C1.7 0 8.3 0 10 0');
    const d = pathOf([[0, 0], [10, 0], [10, 10]], { closed: true });
    expect(d.startsWith('M0 0 C')).toBe(true);
    expect(d.endsWith('0 0 Z')).toBe(true);
    expect(d.match(/C/g)).toHaveLength(3);
  });
});

describe('the derived sheet', () => {
  it('keeps every land and lake on the sheet', () => {
    for (const [name, x, y] of REGIONS) expect(on([x, y]), name).toBe(true);
    for (const l of [...LAKES, ...MARSHES]) expect(on(l.at)).toBe(true);
  });
  it('closes each sea on the sheet’s edge, so the painter fills water and not land', () => {
    expect(SEAS).toHaveLength(2);
    for (const d of SEAS) {
      expect(d.startsWith('M')).toBe(true);
      expect(d.endsWith('Z')).toBe(true);
      const [x, y] = d.slice(1).split(/[ C]/).map(Number);
      expect(x === 0 || y === 0 || x === SHEET.w || y === SHEET.h, d.slice(0, 20)).toBe(true);
    }
  });
  it('gives rivers, ranges, roads and forests in the painters’ shapes', () => {
    expect(RIVERS.length).toBeGreaterThanOrEqual(15);
    for (const [d, thin] of RIVERS) {
      expect(d).toMatch(/^M[\d.]+ [\d.]+ C/);
      expect(typeof thin).toBe('boolean');
    }
    for (const [pts, dark] of RANGES) {
      expect(pts.length).toBeGreaterThanOrEqual(2);
      expect(typeof dark).toBe('boolean');
    }
    expect(ROADS).toHaveLength(5);
    for (const [s, seed, count, kind] of FORESTS) {
      expect(Boolean(s.points) || (s.rx > 0 && s.ry > 0)).toBe(true);
      expect(Number.isInteger(seed) && count >= 5).toBe(true);
      expect(['', 'gold', 'dark']).toContain(kind);
    }
    expect(new Set(FORESTS.map((f) => f[1])).size).toBe(FORESTS.length);
  });
});

describe('the relations made true (the note’s §5)', () => {
  const anduin = lineAt('anduin');
  it('puts Minas Tirith on the Anduin’s west bank, Osgiliath astride it, the Mouths nearly due south', () => {
    const [mx, my] = placeAt('minas-tirith');
    expect(mx).toBeLessThan(xAtRow(anduin, my));
    expect(toLine(placeAt('osgiliath'), anduin)).toBeLessThan(1);
    const [ex, ey] = placeAt('ethir-anduin');
    expect(ey).toBeGreaterThan(my);
    expect(Math.abs(ex - mx) / (ey - my)).toBeLessThan(Math.tan((15 * Math.PI) / 180));
    expect(anduin.at(-1)).toEqual([ex, ey]);
  });
  it('puts Weathertop about a third of the way from Bree to Rivendell', () => {
    const [b, w, r] = ['bree', 'weathertop', 'rivendell'].map(placeAt);
    const u = ((w[0] - b[0]) * (r[0] - b[0]) + (w[1] - b[1]) * (r[1] - b[1])) / units(b, r) ** 2;
    // the note’s points put it 78 straight miles out of 275 (0.28): a third, as
    // the text has it, and not the two-thirds the hand-drawn sheet had
    expect(Math.abs(u - 1 / 3)).toBeLessThan(0.06);
    expect(Math.abs(miles('hobbiton', 'bree') - 100) / 100).toBeLessThan(0.08);
  });
  it('puts Rivendell in the Misty Mountains’ western foothills, the High Pass north-east of it', () => {
    const [rx, ry] = placeAt('rivendell');
    expect(rx).toBeLessThan(xAtRow(lineAt('misty-mountains'), ry));
    const [hx, hy] = placeAt('high-pass');
    expect(hx).toBeGreaterThan(rx);
    expect(hy).toBeLessThan(ry);
  });
  it('makes the Misty Mountains an arc, Gundabad to Methedras', () => {
    const m = lineAt('misty-mountains');
    expect(m[0]).toEqual(placeAt('gundabad'));
    expect(m.at(-1)).toEqual(placeAt('methedras'));
    expect(Math.max(...m.map((p) => toSegment(p, m[0], m.at(-1))))).toBeGreaterThan(20);
  });
  it('runs the upper Anduin 25 to 55 miles west of Mirkwood, Lórien on the river, Dol Guldur across from it', () => {
    const wood = FORESTS.find((f) => f[3] === 'dark')[0].points;
    const west = wood.filter((p, i) => i >= 6 && i <= 8).concat([wood[0]]);
    for (let y = placeAt('carrock')[1]; y <= placeAt('gladden-fields')[1] + 60; y += 10) {
      // the forest’s west eaves run from Dol Guldur north to the Forest Gate and on to its corner
      const edgeX = xAtRow([wood[6], wood[7], wood[8], wood[0]], y);
      const gap = (edgeX - xAtRow(anduin, y)) * 2;
      expect(gap, String(y)).toBeGreaterThanOrEqual(25);
      expect(gap, String(y)).toBeLessThanOrEqual(55);
    }
    expect(west.length).toBe(4);
    const lorien = FORESTS.find((f) => f[3] === 'gold')[0];
    expect(Math.abs(lorien.at[0] + lorien.rx - xAtRow(anduin, lorien.at[1]))).toBeLessThan(5);
    const [dx, dy] = placeAt('dol-guldur');
    expect(dx).toBeGreaterThan(xAtRow(anduin, dy));
    expect(Math.abs(dy - placeAt('lorien')[1])).toBeLessThan(8);
  });
  it('sends the Isen through the Gap and across Enedwaith to the sea, never through the White Mountains', () => {
    const isen = lineAt('isen');
    for (const r of ['white-mountains', 'thrihyrne']) {
      const m = lineAt(r);
      for (let i = 1; i < isen.length; i++) for (let j = 1; j < m.length; j++) expect(crosses(isen[i - 1], isen[i], m[j - 1], m[j]), r).toBe(false);
    }
    expect(isen.at(-1)).toEqual(lineAt('coast').find((p) => units(p, isen.at(-1)) < 0.01));
    expect(toLine(placeAt('fords-of-isen'), isen)).toBeLessThan(1);
  });
  it('swings the coast east below Lindon, the Gulf of Lune a gulf, Lond Daer and Andrast on it', () => {
    const coast = lineAt('coast');
    expect(toLine(placeAt('grey-havens'), coast)).toBeLessThan(1);
    expect(toLine(placeAt('lond-daer'), coast)).toBeLessThan(1);
    expect(toLine(placeAt('andrast'), coast)).toBeLessThan(1);
    // the gulf: the Havens a hundred and twenty miles in from its mouth
    expect(placeAt('grey-havens')[0] - Math.min(...coast.slice(0, 8).map((p) => p[0]))).toBeGreaterThan(60);
    // below Lindon it runs east: the Ethir far east of Lindon’s shore
    expect(placeAt('ethir-anduin')[0] - coast[2][0]).toBeGreaterThan(300);
  });
  it('builds Mordor’s box about 400 by 240 miles, Orodruin west of Barad-dûr, about 145 and 180 from the city', () => {
    const walls = RANGES.filter((r) => r[1]).flatMap((r) => r[0]).map((p) => unproject(...p));
    const w = Math.max(...walls.map((p) => p[0])) - Math.min(...walls.map((p) => p[0]));
    const h = Math.max(...walls.map((p) => p[1])) - Math.min(...walls.map((p) => p[1]));
    expect(Math.abs(w - 400) / 400).toBeLessThan(0.1);
    expect(Math.abs(h - 240) / 240).toBeLessThan(0.1);
    expect(placeAt('mount-doom')[0]).toBeLessThan(placeAt('barad-dur')[0]);
    expect(Math.abs(miles('minas-tirith', 'mount-doom') - 145) / 145).toBeLessThan(0.08);
    expect(Math.abs(miles('minas-tirith', 'barad-dur') - 180) / 180).toBeLessThan(0.08);
  });
  it('puts Cirith Ungol in the Ephel Dúath above Minas Morgul, Orodruin about 47 miles on', () => {
    const ephel = lineAt('ephel-duath');
    expect(toLine(placeAt('cirith-ungol'), ephel)).toBeLessThan(10);
    expect(toLine(placeAt('mount-doom'), ephel)).toBeLessThan(25);
    expect(placeAt('cirith-ungol')[0]).toBeGreaterThan(placeAt('minas-morgul')[0]);
    expect(Math.abs(miles('cirith-ungol', 'mount-doom') - 47) / 47).toBeLessThan(0.08);
  });
  it('puts the Dead Marshes north-west of the Morannon, between the Emyn Muil and Dagorlad', () => {
    const [mx, my] = placeAt('dead-marshes');
    const [gx, gy] = placeAt('black-gate');
    expect(mx).toBeLessThan(gx);
    expect(my).toBeLessThan(gy);
    expect(mx).toBeGreaterThan(placeAt('emyn-muil')[0]);
    expect(mx).toBeLessThan(placeAt('dagorlad')[0]);
  });
  it('stands Edoras, Helm’s Deep and Isengard at the ranges’ feet', () => {
    expect(toLine(placeAt('helms-deep'), lineAt('thrihyrne'))).toBeLessThan(8);
    expect(units(placeAt('isengard'), lineAt('misty-mountains').at(-1))).toBeLessThan(10);
    const [ex, ey] = placeAt('edoras');
    expect(ey).toBeLessThan(xAtRow(lineAt('white-mountains').map(([x, y]) => [y, x]), ex));
    expect(toLine([ex, ey], lineAt('white-mountains'))).toBeLessThan(20);
  });
  it('runs the Brandywine from Lake Evendim to the sea', () => {
    const b = lineAt('brandywine');
    expect(b[0]).toEqual(placeAt('evendim'));
    expect(lineAt('coast').some((p) => units(p, b.at(-1)) < 0.01)).toBe(true);
  });
  it('writes MORDOR inside Mordor', () => {
    const walls = RANGES.filter((r) => r[1]).flatMap((r) => r[0]);
    const [, x, y] = REGIONS.find((r) => r[0] === 'MORDOR');
    expect(x).toBeGreaterThan(Math.min(...walls.map((p) => p[0])));
    expect(x).toBeLessThan(Math.max(...walls.map((p) => p[0])));
    expect(y).toBeGreaterThan(Math.min(...walls.map((p) => p[1])));
    expect(y).toBeLessThan(Math.max(...walls.map((p) => p[1])));
  });
  it('spaces the road’s legs as the note’s straight miles, each within 8 %', () => {
    // the note’s table, fitted against true straight miles; the walk out of
    // Moria is measured from the East-gate, forty miles of it being underground
    const legs = [
      ['hobbiton', 'bree', 100],
      ['bree', 'weathertop', 78],
      ['weathertop', 'rivendell', 197],
      ['rivendell', 'moria', 175],
      ['east-gate', 'lorien', 55],
      ['lorien', 'amon-hen', 265],
      ['amon-hen', 'dead-marshes', 75],
      ['dead-marshes', 'black-gate', 62],
      ['black-gate', 'cirith-ungol', 97],
      ['cirith-ungol', 'mount-doom', 47],
    ];
    for (const [a, b, m] of legs) expect(Math.abs(units(placeAt(a), placeAt(b)) * 2 - m) / m, `${a}–${b}`).toBeLessThan(0.08);
  });
  it('stands every stop of the road on its place', () => {
    for (const s of STOPS) expect([s.x, s.y], s.id).toEqual(placeAt(s.id));
  });
});
