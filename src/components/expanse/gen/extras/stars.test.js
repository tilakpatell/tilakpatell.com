import { beforeAll, describe, expect, it } from 'vitest';
import { KEEP_OUTS, clearOfKeepOuts } from '../keepOuts';
import { beaconsOf } from '../sector';
import { UNIVERSE, sectorSeedOf, universeOf } from '../seed';
import { fullSector } from '../space';
import { wormholeExit } from './stars';

const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const CUBE = [];
for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if (x || y || z) CUBE.push([x, y, z]);
const sectors = [];
beforeAll(() => {
  for (const [x, y, z] of CUBE) sectors.push(fullSector(UNIVERSE, x, y, z, { lattice: false }));
});

describe('dead stars, young stars and wormholes', () => {
  it('puts a wormhole in every sector round home, one to three pulsars and as many forming stars', () => {
    for (const s of sectors) {
      expect(s.extras.wormhole, s.id).toHaveLength(1);
      expect(s.extras.pulsar.length, s.id).toBeGreaterThanOrEqual(1);
      expect(s.extras.pulsar.length).toBeLessThanOrEqual(3);
      expect(s.extras.protostar.length, s.id).toBeGreaterThanOrEqual(1);
      expect(s.extras.protostar.length).toBeLessThanOrEqual(3);
    }
    const all = sectors.flatMap((s) => s.extras.pulsar);
    const mag = all.filter((p) => p.kind === 'magnetar').length / all.length;
    expect(mag).toBeGreaterThanOrEqual(0.15);
    expect(mag).toBeLessThanOrEqual(0.45);
    for (const p of all) expect(clearOfKeepOuts(p.at, 9 * p.size + 25 * p.size, KEEP_OUTS)).toBe(true);
    expect(fullSector(UNIVERSE, 0, 0, 0, { lattice: false }).extras.wormhole).toEqual([]);
  });
  it('throws you 30 to 80 sectors, inside one of that sector’s beacons, the same every time', () => {
    const marble = universeOf('marble');
    for (const s of sectors) {
      const w = s.extras.wormhole[0];
      const e = wormholeExit(w, UNIVERSE);
      const d = Math.hypot(e.sector[0] - s.sx, e.sector[1] - s.sy, e.sector[2] - s.sz);
      expect(d).toBeGreaterThanOrEqual(29.5);
      expect(d).toBeLessThanOrEqual(80.5);
      expect(e.sector.some((v) => v !== 0)).toBe(true);
      const b = beaconsOf(e.sector[0], e.sector[2], sectorSeedOf(UNIVERSE, ...e.sector), e.sector[1])[e.side];
      expect(len(e.at, b.at)).toBeCloseTo(150, 6);
      expect(wormholeExit(w, UNIVERSE)).toEqual(e);
      const m = fullSector(marble, s.sx, s.sy, s.sz, { lattice: false }).extras.wormhole[0];
      if (m) expect(wormholeExit(m, marble).key).not.toBe(e.key);
    }
  });
  it('numbers them at their low ids, as plain data', () => {
    const s = sectors.find((x) => x.id === 'E:1,0');
    expect(s.extras.wormhole[0].id).toBe('E:1,0:w8');
    expect(s.extras.pulsar[0].id).toBe('E:1,0:w12');
    expect(s.extras.protostar[0].id).toBe('E:1,0:w15');
    for (const l of ['wormhole', 'pulsar', 'protostar']) expect(structuredClone(s.extras[l])).toEqual(s.extras[l]);
  });
});
