import { describe, expect, it } from 'vitest';
import { CREWS } from './crews';
import { PARTS, STOCK_LOADOUT } from './outfit';
import { buildModules } from './modules';
import { ENGINES } from './shipModels';

const SHIPS = CREWS.map((c) => c.id);
const meshes = (g) => {
  let n = 0;
  g.traverse((o) => (n += o.isMesh ? 1 : 0));
  return n;
};

describe('the parts bolted on', () => {
  it('are nothing at all as the ship comes', () => {
    for (const kind of SHIPS) {
      const m = buildModules(kind, STOCK_LOADOUT, ENGINES[kind]);
      expect(meshes(m.group)).toBe(0);
      expect(m.nozzles).toEqual([]);
      expect(m.muzzles).toEqual([]);
      expect(m.flame).toBe(1);
      m.dispose();
    }
  });

  it('build every part on every ship, inside the ship’s own size', () => {
    for (const kind of SHIPS) {
      for (const p of PARTS.filter((q) => q.id !== 'stock')) {
        const m = buildModules(kind, { ...STOCK_LOADOUT, [p.slot]: p.id }, ENGINES[kind]);
        expect(meshes(m.group), `${kind} ${p.id}`).toBeGreaterThan(0);
        for (const at of [...m.nozzles, ...m.muzzles]) for (const v of at) expect(Math.abs(v), `${kind} ${p.id}`).toBeLessThan(0.3);
        m.update(1 / 60, { throttle: 1, boost: true, turn: 1, climb: -1 });
        m.dispose();
      }
    }
  });

  it('draws a part that borrows another’s look the way that one is drawn', () => {
    for (const p of PARTS.filter((q) => q.look)) {
      const own = buildModules('falcon', { ...STOCK_LOADOUT, [p.slot]: p.id }, ENGINES.falcon);
      const looks = buildModules('falcon', { ...STOCK_LOADOUT, [p.slot]: p.look }, ENGINES.falcon);
      expect(meshes(own.group), p.id).toBe(meshes(looks.group));
      expect(own.muzzles, p.id).toEqual(looks.muzzles);
      expect(own.nozzles, p.id).toEqual(looks.nozzles);
      expect(own.boosterColor, p.id).toBe(looks.boosterColor);
      own.dispose();
      looks.dispose();
    }
  });

  it('lights the boosters’ exhaust from a nozzle each side, and fires the guns from their barrels', () => {
    const srb = buildModules('xwing', { ...STOCK_LOADOUT, booster: 'srb' }, ENGINES.xwing);
    expect(srb.nozzles).toHaveLength(2);
    expect(srb.nozzles[0][0]).toBeCloseTo(-srb.nozzles[1][0], 6); // (a mirror pair)
    expect(srb.boosterColor).toBeTruthy();
    expect(buildModules('falcon', { ...STOCK_LOADOUT, booster: 'afterburner' }, ENGINES.falcon).flame).toBeGreaterThan(1);
    expect(buildModules('rv', { ...STOCK_LOADOUT, guns: 'twin' }, ENGINES.rv).muzzles).toHaveLength(2);
    const fusion = buildModules('cruiser', { ...STOCK_LOADOUT, guns: 'fusion' }, ENGINES.cruiser);
    expect(fusion.muzzles).toHaveLength(1);
    expect(fusion.muzzles[0][2]).toBeLessThan(0); // (out front: the nose is −z)
  });
});

describe('the tiers that show on the hull', () => {
  const holder = (m, name) => m.group.children.find((c) => c.name === name) ?? null;
  it('wears nothing for a tier under Mk III', () => {
    for (const kind of SHIPS) {
      const m = buildModules(kind, STOCK_LOADOUT, ENGINES[kind], { tiers: { hold: 2, scanner: 2 } });
      expect(meshes(m.group)).toBe(0);
      m.dispose();
    }
  });

  it('wears cargo pods from the hold’s Mk III and a dish from the scanner’s, on every ship', () => {
    for (const kind of SHIPS) {
      const m = buildModules(kind, STOCK_LOADOUT, ENGINES[kind], { tiers: { hold: 3, scanner: 3 } });
      expect(meshes(holder(m, 'cargo')), kind).toBe(2);
      expect(meshes(holder(m, 'scanner')), kind).toBe(2);
      m.dispose();
    }
  });

  it('grows them at Mk V, and turns the dish as it flies', () => {
    const size = (tier) => {
      const m = buildModules('falcon', STOCK_LOADOUT, ENGINES.falcon, { tiers: { hold: tier, scanner: tier } });
      const g = holder(m, 'cargo').children[0].geometry;
      g.computeBoundingBox();
      const dish = holder(m, 'scanner').children[1];
      const before = dish.rotation.y;
      m.update(0.5, {});
      const turned = dish.rotation.y !== before;
      m.dispose();
      return { len: g.boundingBox.max.z - g.boundingBox.min.z, turned };
    };
    expect(size(5).len).toBeCloseTo(size(3).len * 1.4, 5);
    expect(size(3).turned).toBe(true);
  });
});
