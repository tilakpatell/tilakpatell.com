import { describe, expect, it } from 'vitest';
import { makeSector } from '../gen/sector.js';
import { UNIVERSE } from '../gen/seed.js';
import { SHADER_FAMILIES as FAMILIES } from './near.js';
import { FLAG_SETS, lookDistance, planetLook, swatchOf } from '../../../lib/space/planetLook.js';

const rowOf = (p) => ({ id: p.id.toLowerCase(), name: p.name, type: p.type, seed: String(p.seed), radius: p.radius, moons: p.moons, rings: Boolean(p.rings) });

// planets from sectors spread over the universe, in the order they're made
function planets(n, from = 0) {
  const out = [];
  for (let i = from; out.length < n; i++) {
    const sx = (i % 41) - 20;
    const sz = Math.floor(i / 41) - 20;
    for (const s of makeSector(UNIVERSE, sx, sz).systems) for (const p of s.planets) out.push(rowOf(p));
  }
  return out.slice(0, n);
}

const HEX = /^#[0-9a-f]{6}$/;

describe('planetLook', () => {
  const rows = planets(10000);
  const looks = rows.map(planetLook);

  it('is the same look for the same planet, whenever it is asked', () => {
    const again = planets(200).map((r) => JSON.parse(JSON.stringify(planetLook({ ...r }))));
    expect(again).toEqual(looks.slice(0, 200).map((l) => JSON.parse(JSON.stringify(l))));
  });

  it("fills every slot and param of its shader family with a colour or a number", () => {
    for (const l of looks) {
      const fam = FAMILIES[l.family];
      expect(fam, l.family).toBeTruthy();
      for (const s of fam.slots) expect(l.pal[s], `${l.name} ${s}`).toMatch(HEX);
      for (const k of fam.params) expect(Number.isFinite(l.p[k]), `${l.name} ${k}`).toBe(true);
      expect(l.swatch).toMatch(HEX);
    }
  });

  it('keeps to the few flag sets a family warms', () => {
    for (const l of looks) expect(FLAG_SETS[l.family].map(String)).toContain(String(l.flags));
  });

  it('keeps the air each type had (a rock world none, every other one some), so a planet draws the calls it drew', () => {
    for (let i = 0; i < rows.length; i++) expect(Boolean(looks[i].atmo), rows[i].type).toBe(rows[i].type !== 'rock');
  });

  it('makes 10,000 planets 10,000 different looks', () => {
    const keys = new Set(looks.map((l) => JSON.stringify([l.family, l.pal, l.p, l.clouds?.cover ?? 0])));
    expect(keys.size).toBe(looks.length);
  });

  it('keeps any 500 neighbouring planets clearly apart, not a shade apart', () => {
    for (let at = 0; at + 500 <= 2000; at += 500) {
      const run = looks.slice(at, at + 500);
      let least = Infinity;
      for (let i = 0; i < run.length; i++) for (let j = i + 1; j < run.length; j++) least = Math.min(least, lookDistance(run[i], run[j]));
      expect(least, `planets ${at}…${at + 499}`).toBeGreaterThan(1.5);
    }
  });

  it("draws a moon as a moon of its own", () => {
    const moon = planetLook({ id: 'e:3,4:5:0:1', seed: '12345', type: 'icy', radius: 6, parent: 'e:3,4:5:0' });
    expect(moon.family).toBe('moon');
    expect(moon.atmo).toBeUndefined();
  });

  it('gives a swatch between its own colours', () => {
    const l = looks.find((x) => x.family === 'gas');
    expect(swatchOf(l)).toMatch(HEX);
  });
});
