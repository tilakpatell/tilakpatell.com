import { describe, expect, it } from 'vitest';
import { makeSector } from '../gen/sector.js';
import { UNIVERSE } from '../gen/seed.js';
import { GOODS } from '../../universe/market/goods.js';
import { planetRowOf } from '../../../lib/space/planetLook.js';
import { ANOMALIES, HAZARDS, RARE, SECRETS, traitsOfPlanet } from '../../../lib/space/traits.js';

function rows(n) {
  const out = [];
  for (let i = 0; out.length < n; i++) for (const s of makeSector(UNIVERSE, (i % 31) - 15, Math.floor(i / 31) - 15).systems) for (const p of s.planets) out.push({ ...planetRowOf(p), system: { hazard: s.hazard } });
  return out.slice(0, n);
}

describe('a planet’s traits', () => {
  const all = rows(4000);
  const traits = all.map((r) => traitsOfPlanet(r));

  it('are the same whenever they’re asked for', () => {
    expect(all.slice(0, 100).map((r) => traitsOfPlanet({ ...r }))).toEqual(traits.slice(0, 100));
  });

  it('name only goods the market knows', () => {
    const known = new Set(Object.keys(GOODS));
    for (const t of traits) {
      expect(t.resources.length).toBeGreaterThanOrEqual(1);
      expect(t.resources.length).toBeLessThanOrEqual(3);
      for (const r of t.resources) {
        expect(known.has(r.id) || r.id === 'organics', r.id).toBe(true);
        expect(r.amount).toBeGreaterThanOrEqual(0.2);
        expect(r.amount).toBeLessThanOrEqual(1);
      }
      if (t.rare) expect(known.has(t.rare.id), t.rare.id).toBe(true);
    }
  });

  it('give each kind of trait its share, so most stops have something and few have everything', () => {
    const share = (f) => traits.filter(f).length / traits.length;
    expect(share((t) => t.hazard)).toBeGreaterThan(0.3);
    expect(share((t) => t.rare)).toBeGreaterThan(RARE.least / 2);
    expect(share((t) => t.anomaly)).toBeGreaterThan(0.02);
    expect(share((t) => t.anomaly)).toBeLessThan(0.12);
    expect(share((t) => t.secret)).toBeGreaterThan(0.03);
    expect(share((t) => t.tags.length > 0)).toBeGreaterThan(0.5);
    expect(share((t) => t.tags.length >= 5)).toBeLessThan(0.02);
  });

  it('keep to their tables, and a secret to a moon the planet has', () => {
    for (let i = 0; i < all.length; i++) {
      const t = traits[i];
      if (t.hazard && t.hazard.id !== 'pirates') expect(HAZARDS[all[i].type]).toContain(t.hazard.id);
      if (t.anomaly) expect(ANOMALIES).toContain(t.anomaly.id);
      if (t.secret) {
        expect(SECRETS).toContain(t.secret.kind);
        expect(t.secret.moon).toBeLessThan(all[i].moons);
      }
    }
  });

  it('find rare goods more often further out', () => {
    const at = (d) => all.filter((r) => traitsOfPlanet(r, { d }).rare).length;
    expect(at(30)).toBeGreaterThan(at(0));
  });
});
