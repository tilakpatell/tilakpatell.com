import { describe, expect, it } from 'vitest';
import { CORE, REGIONS, SYSTEMS, edgeAt } from '../systems';
import { warNow } from '../warState';
import { RINGS, SECTORS, holders, middleOf, outline, rimNames, sectorById, sectorOf } from './sectors';

const TAU = Math.PI * 2;

describe('the holotable’s sectors', () => {
  it('are the regions’ rings and a band of Wild Space, more wedges further out', () => {
    expect(RINGS.map((r) => r.id)).toEqual([...REGIONS.map((r) => r.id), 'wild']);
    expect(RINGS[0]).toMatchObject({ id: 'deep', r0: 0, n: 1 });
    for (let i = 1; i < RINGS.length; i++) {
      expect(RINGS[i].r0, RINGS[i].id).toBe(RINGS[i - 1].r1);
      expect(RINGS[i].n, RINGS[i].id).toBeGreaterThanOrEqual(RINGS[i - 1].n);
    }
    expect(SECTORS).toHaveLength(RINGS.reduce((n, r) => n + r.n, 0));
  });
  it('step: no two rings’ wedges begin at the same angle', () => {
    const starts = RINGS.map((r) => new Set(SECTORS.filter((s) => s.ring === r.id).map((s) => s.a0.toFixed(3))));
    for (let i = 1; i < starts.length; i++) for (const a of starts[i]) expect(starts[i - 1].has(a), `${RINGS[i].id} at ${a}`).toBe(false);
  });
  it('put every system in the sector that holds it, and each sector’s middle in itself', () => {
    for (const s of SYSTEMS) {
      const id = sectorOf(s.pos);
      expect(id, s.id).not.toBeNull();
      const sec = sectorById(id);
      const a = (Math.atan2(s.pos[1] - CORE[1], s.pos[0] - CORE[0]) + TAU) % TAU;
      const d = Math.hypot(s.pos[0] - CORE[0], s.pos[1] - CORE[1]);
      expect(d, s.id).toBeGreaterThanOrEqual(edgeAt(sec.r0, a) - 1e-9);
      expect(d, s.id).toBeLessThan(edgeAt(sec.r1, a) + 1e-9);
    }
    for (const sec of SECTORS) expect(sectorOf(middleOf(sec)), sec.id).toBe(sec.id);
  });
  it('make the Deep Core one sector, and past the rim none', () => {
    expect(sectorOf(CORE)).toBe('deep-0');
    expect(sectorOf([CORE[0] + 14, CORE[1]])).toBeNull();
  });
  it('mark the Unknown Regions out west, and none in the east', () => {
    const unknown = SECTORS.filter((s) => s.unknown);
    expect(unknown.length).toBeGreaterThan(0);
    for (const s of unknown) expect(Math.cos((s.a0 + s.a1) / 2), s.id).toBeLessThan(0);
  });
  it('outline a sector as a closed loop on its two bulged edges', () => {
    const sec = SECTORS.find((s) => s.ring === 'mid');
    const pts = outline(sec, 8);
    expect(pts).toHaveLength(18);
    const r = (p) => Math.hypot(p[0] - CORE[0], p[1] - CORE[1]);
    expect(r(pts[0])).toBeCloseTo(edgeAt(sec.r1, sec.a0));
    expect(r(pts.at(-1))).toBeCloseTo(edgeAt(sec.r0, sec.a0));
  });
});

describe('who holds each sector', () => {
  const table = warNow(Date.UTC(2026, 9, 19, 12), 'gcw');
  const holds = holders(table);
  it('gives a sector with the war’s systems in it to the side holding the most of them', () => {
    for (const row of table.systems) {
      const s = SYSTEMS.find((x) => x.id === row.id);
      const h = holds[sectorOf(s.pos)];
      expect(h.held, row.id).toBe(true);
      const mates = table.systems.filter((r) => sectorOf(SYSTEMS.find((x) => x.id === r.id).pos) === sectorOf(s.pos));
      if (mates.length === 1) expect(h.side, row.id).toBe(row.owner);
    }
  });
  it('lends an empty sector to the nearest of the war’s systems within reach, and none beyond it', () => {
    const lent = Object.values(holds).filter((h) => h.side && !h.held);
    expect(lent.length).toBeGreaterThan(0);
    const none = holders(table, { reach: 0 });
    for (const [id, h] of Object.entries(none)) if (!h.held) expect(h.side, id).toBeNull();
  });
  it('marks a sector with a front, an attack or a battle contested, and who’s pushing there', () => {
    const fights = table.systems.filter((r) => r.attack || r.front || r.battle);
    for (const row of fights) {
      const h = holds[sectorOf(SYSTEMS.find((x) => x.id === row.id).pos)];
      expect(h.contested, row.id).toBe(true);
      if (row.attack) expect([row.attack.by, null]).toContain(h.by);
    }
  });
  it('names each side along the rim over its longest run of the Outer Rim’s sectors', () => {
    const names = rimNames(holds, { least: 0 });
    const sides = new Set(SECTORS.filter((s) => s.ring === 'outer').map((s) => holds[s.id].side).filter(Boolean));
    expect(new Set(names.map((n) => n.side))).toEqual(sides);
    for (const n of names) {
      expect(holds[sectorOf([CORE[0] + Math.cos(n.a) * edgeAt(8, n.a), CORE[1] + Math.sin(n.a) * edgeAt(8, n.a)])].side, n.side).toBe(n.side);
    }
    // (and none where a side's run is shorter than asked)
    expect(rimNames(holds, { least: TAU + 1 })).toEqual([]);
  });
});
