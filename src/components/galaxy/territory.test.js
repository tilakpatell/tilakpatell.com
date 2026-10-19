import { describe, expect, it } from 'vitest';
import { NEIGHBOURS, WAR_SYSTEMS, seeded, warTable, GCW } from './gcw';
import { CORE, RIM, systemById } from './systems';
import { CELLS, EDGES, bordersOf, capOf, cellsOf, clashOf, contains, linksOf } from './territory';
import { FIT, onView } from './mapView';

const posOf = (id) => systemById(id).pos;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// a crafted table: owners and battles by system, the rest quiet and the Empire's
const tableOf = (owners = {}, battles = {}) => ({
  systems: WAR_SYSTEMS.map((id) => ({ id, owner: owners[id] ?? 'empire', battle: battles[id] ? { attacker: battles[id] } : null })),
});

describe('the war’s territory: a cell round each system, as far as its reach', () => {
  it('has a cell for each system the war is fought over, each round its own system', () => {
    expect(CELLS).toHaveLength(16);
    expect(CELLS.map((c) => c.id).sort()).toEqual([...WAR_SYSTEMS].sort());
    for (const c of CELLS) {
      expect(c.poly.length, c.id).toBeGreaterThanOrEqual(3);
      expect(contains(c, posOf(c.id)), c.id).toBe(true);
    }
  });

  it('gives each point to the nearest system, if it’s within that one’s reach, and to none otherwise', () => {
    const rand = seeded('territory-points');
    // (the reach is a 24-gon in its circle: inside the 24-gon's own circle it's in, past the circle it's out)
    const inner = Math.cos(Math.PI / 24);
    let inCells = 0;
    for (let i = 0; i < 2000; i++) {
      const r = Math.sqrt(rand()) * RIM;
      const a = rand() * Math.PI * 2;
      const p = [CORE[0] + Math.cos(a) * r, CORE[1] + Math.sin(a) * r];
      const byDist = [...WAR_SYSTEMS].sort((x, y) => dist(posOf(x), p) - dist(posOf(y), p));
      const [near, next] = byDist;
      // (too near a tie to call)
      if (Math.abs(dist(posOf(near), p) - dist(posOf(next), p)) < 1e-6) continue;
      const holders = CELLS.filter((c) => contains(c, p)).map((c) => c.id);
      expect(holders.length, `${p}`).toBeLessThanOrEqual(1);
      if (holders.length) expect(holders[0], `${p}`).toBe(near);
      const d = dist(posOf(near), p);
      if (d < capOf(near) * inner - 1e-6) expect(holders, `${p} is within ${near}'s reach`).toEqual([near]);
      if (d > capOf(near) + 1e-6) expect(holders, `${p} is beyond ${near}'s reach`).toEqual([]);
      inCells += holders.length;
    }
    // (and the territory's a fair part of the disc, not slivers)
    expect(inCells).toBeGreaterThan(200);
  });

  it('reaches further from a worthier system, and stays inside the galaxy’s disc, but for a system past it', () => {
    expect(capOf('coruscant')).toBeGreaterThan(capOf('hoth'));
    expect(capOf('hoth')).toBeGreaterThan(capOf('bespin'));
    // (a corner can sit on the disc's edge itself)
    const past = CELLS.filter((c) => dist(posOf(c.id), CORE) > RIM).map((c) => c.id);
    expect(past).toEqual(['kamino']); // (past the rim, where the canon atlas has it: a pocket of its own)
    for (const c of CELLS) if (!past.includes(c.id)) for (const p of c.poly) expect(dist(p, CORE), c.id).toBeLessThanOrEqual(RIM + 1e-9);
    for (const p of CELLS.find((c) => c.id === 'kamino').poly) expect(dist(p, posOf('kamino'))).toBeLessThanOrEqual(capOf('kamino') + 1e-9);
    // (and none of it, the pocket either, off the map: mapView.js's square)
    for (const c of CELLS) for (const p of c.poly) expect(onView(FIT, p, { pad: 0.005 }), `${c.id} ${p}`).toBe(true);
    expect(Math.max(...CELLS.find((c) => c.id === 'kamino').poly.map((p) => dist(p, CORE)))).toBeGreaterThan(RIM + 0.1);
  });

  it('tags each edge with the neighbour it’s shared with (or nobody: the edge of its reach)', () => {
    for (const c of CELLS)
      for (const e of c.edges) {
        expect(e.with).not.toBe(c.id);
        if (e.with === null) continue;
        const mid = [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2];
        expect(Math.abs(dist(mid, posOf(c.id)) - dist(mid, posOf(e.with))), `${c.id}|${e.with}`).toBeLessThan(1e-6);
      }
  });

  it('can be worked out for any systems: two alone split the plane between them', () => {
    const cells = cellsOf([
      { id: 'a', pos: [0, 0], cap: 2 },
      { id: 'b', pos: [2, 0], cap: 2 },
    ], { core: [1, 0], rim: 10 });
    const a = cells.find((c) => c.id === 'a');
    expect(contains(a, [0.9, 0])).toBe(true);
    expect(contains(a, [1.1, 0])).toBe(false);
    expect(a.edges.filter((e) => e.with === 'b')).toHaveLength(1);
    const e = a.edges.find((x) => x.with === 'b');
    expect(e.a[0]).toBeCloseTo(1, 9);
    expect(e.b[0]).toBeCloseTo(1, 9);
  });
});

describe('the borders between powers', () => {
  it('none where one side holds everything', () => {
    expect(bordersOf(Object.fromEntries(WAR_SYSTEMS.map((id) => [id, 'empire'])))).toEqual([]);
  });

  it('a line where two systems of different owners touch, the same from either side, midway between them', () => {
    const owner = Object.fromEntries(WAR_SYSTEMS.map((id) => [id, 'empire']));
    owner.hoth = 'rebel';
    owner.coruscant = 'hutt';
    const borders = bordersOf(owner);
    expect(borders.length).toBeGreaterThan(0);
    for (const b of borders) {
      expect(owner[b.a]).not.toBe(owner[b.b]);
      expect(b.a < b.b).toBe(true);
      const mid = [(b.p[0][0] + b.p[1][0]) / 2, (b.p[0][1] + b.p[1][1]) / 2];
      expect(Math.abs(dist(mid, posOf(b.a)) - dist(mid, posOf(b.b))), `${b.a}|${b.b}`).toBeLessThan(1e-6);
      expect(dist(b.p[0], b.p[1])).toBeGreaterThan(1e-6);
    }
    // (Bespin's next to Hoth on the map, so their cells touch; Coruscant's half the galaxy away)
    expect(borders.some((b) => b.a === 'bespin' && b.b === 'hoth')).toBe(true);
    expect(borders.some((b) => b.a === 'coruscant' && b.b === 'hoth')).toBe(false);
  });

  it('marks a border hot where the two are fighting over one of them', () => {
    const owner = Object.fromEntries(WAR_SYSTEMS.map((id) => [id, 'empire']));
    owner.hoth = 'rebel';
    const hot = clashOf(tableOf(owner, { bespin: 'rebel' }));
    const borders = bordersOf(owner, { hot });
    expect(borders.find((b) => b.a === 'bespin' && b.b === 'hoth').hot).toBe(true);
    expect(borders.find((b) => b.a === 'hoth' && b.b === 'nevarro').hot).toBe(false);
    expect(borders.filter((b) => b.hot)).toHaveLength(1);
  });
});

describe('the war’s links: the hyperspace lanes it runs along', () => {
  it('are the war’s own neighbours, every one once', () => {
    let n = 0;
    for (const id of WAR_SYSTEMS) n += NEIGHBOURS[id].length;
    expect(EDGES).toHaveLength(n / 2);
    expect(EDGES).toHaveLength(29); // (Scarif at the canon atlas's S-15: Tatooine's and Geonosis's now, Lothal joined to Yavin)
    for (const [a, b] of EDGES) {
      expect(a < b).toBe(true);
      expect(NEIGHBOURS[a]).toContain(b);
    }
  });

  it('each held, contested or fought along, on a crafted table', () => {
    const owner = Object.fromEntries(WAR_SYSTEMS.map((id) => [id, 'empire']));
    Object.assign(owner, { hoth: 'rebel', endor: 'rebel', tatooine: 'hutt' });
    // (the Rebellion's after Bespin from Hoth; the Empire's after Endor from Sorgan)
    const links = linksOf(tableOf(owner, { bespin: 'rebel', endor: 'empire' }));
    expect(links).toHaveLength(29);
    const state = (a, b) => links.find((l) => l.a === a && l.b === b).state;
    expect(state('bespin', 'hoth')).toBe('battle');
    expect(state('endor', 'sorgan')).toBe('battle');
    expect(state('endor', 'hoth')).toBe('own');
    expect(state('hoth', 'mustafar')).toBe('contested');
    expect(state('bespin', 'mustafar')).toBe('own');
    expect(state('coruscant', 'tatooine')).toBe('contested');
    // (Bespin's fought from Hoth, the Rebellion's, not from Nevarro: the Empire's own link there just carries its fleets)
    expect(state('bespin', 'nevarro')).toBe('own');
    for (const l of links) {
      expect(l.id).toBe(`${l.a}-${l.b}`);
      expect(l.owner).toBe(l.state === 'own' ? owner[l.a] : null);
    }
  });

  it('on a real war table: every state one of the three, and fighting only along a battle', () => {
    for (const war of ['clone', 'gcw', 'remnant']) {
      const table = warTable(war, GCW.start + 20 * 3600e3);
      const rows = Object.fromEntries(table.systems.map((r) => [r.id, r]));
      for (const l of linksOf(table)) {
        expect(['own', 'contested', 'battle']).toContain(l.state);
        if (l.state === 'battle') expect(Boolean(rows[l.a].battle || rows[l.b].battle)).toBe(true);
        if (l.state === 'own') expect(rows[l.a].owner).toBe(rows[l.b].owner);
      }
    }
  });
});
