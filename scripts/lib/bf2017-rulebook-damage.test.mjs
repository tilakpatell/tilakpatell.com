// The damage rulebook (the hulls plan's Task 7, findings/62) on fixtures cut
// from the export by `node scripts/bf2017-data.mjs damage --root <export>
// --fixtures`: SB_Endor_01's material grid (the rows and columns of the
// properties space uses), the X-wing's blueprint, weapons layer and bolt, the
// CR90 with its prefab and top turret, the squad bonus's prefab, the
// difficulty settings' multiplayer Normal row and the CR90's physics header.
// No export needed. The last block reads the written src/data/bf2017/damage.json.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readHull } from '../../src/lib/physics/shapesBin.js';
import { CAPITAL_KITS, headerFile, partName, readHeader, rosterKinds } from './bf2017-hulls.mjs';
import { checkSources } from './bf2017-rulebook.mjs';
import { FIGHTERS, SITE_NAMES, STAND, cutGrid, damageRulebook, gridOf, propertyOf } from './bf2017-rulebook-damage.mjs';

const ROOT = join(import.meta.dirname, '..', 'fixtures', 'bf2017', 'damage');
const header = (res) => {
  try {
    return readHeader(readFileSync(join(ROOT, 'headers', headerFile(res))));
  } catch {
    return null;
  }
};
const CR90 = 'models/gameplay/vehicles/corvette/corvettecr90/corvettecr90_01_mesh.glb';
const TOP = 'Gameplay/Vehicles/Corvette/CorvetteCR90/CorvetteCR90_LargeTurretTop';
const book = damageRulebook(ROOT, { fighters: { xwing: FIGHTERS.xwing }, kits: { corvette: [CR90] }, turrets: { corvette: [TOP] }, header });

describe('the material grid', () => {
  it('reads a cell as the attacker’s row and the target’s column, each through the grid’s own index map', () => {
    expect(book.grid[216][68]).toMatchObject({ multiplier: 1.25, threshold: 0 });
    expect(book.grid[216][132]).toMatchObject({ multiplier: 0, threshold: 2 });
    expect(book.grid[61][68]).toMatchObject({ multiplier: 4, threshold: 0 });
    expect(book.grid[216][206]).toMatchObject({ multiplier: 0.01, threshold: 0.02 });
    expect(book.grid[216][129].collision).toEqual({ multiplier: 1, threshold: 30 });
  });

  it('gives a pair with no relation the (default, default) relation: 0× under 2, not 1×', () => {
    expect(book.grid[216][34]).toMatchObject({ multiplier: 0, threshold: 2, none: true });
    expect(book.noRelation).toMatchObject({ multiplier: 0, threshold: 2 });
  });

  it('takes a property from a Packed’s bits 22–31, the grid’s default without its valid bit', () => {
    expect(propertyOf(0x1100e820)).toBe(68);
    expect(propertyOf(0x00000800)).toBe(0);
    expect(propertyOf(0x0000e000)).toBe(0);
  });

  it('cuts a grid to the properties named and keeps their cells', () => {
    const grid = JSON.parse(readFileSync(join(ROOT, 'data', 'levels/space/sb_endor_01/sb_endor_01/materialgrid_win32.json'), 'utf8'));
    const cut = cutGrid(grid, [216, 68]);
    expect(gridOf(cut)(216, 68)).toMatchObject({ multiplier: 1.25, threshold: 0 });
    expect(cut.objects.length).toBeLessThan(grid.objects.length);
  });
});

describe('a fighter', () => {
  const x = book.fighters.xwing;

  it('fires the X-wing’s bolt', () => {
    expect(x.bolt).toMatchObject({ damage: 75, damageFar: 65, falloff: [400, 600], speed: 2000, life: 0.45, property: 216 });
    expect(x.bolt.blast).toMatchObject({ damage: 22.5, radius: 5, property: 116 });
    expect(x.bolt.speed_source).toMatch(/_Weapons#FireProjectileEntityOverrideData\.FireProjectileData\.Speed$/);
  });

  it('is judged by its VehicleEntityData.MaterialPair (findings/62 §2), at multiplayer Normal’s modifier', () => {
    expect(x.property).toBe(68);
    expect(x.property_source).toMatch(/Vehicle_Air_XWing_T65#VehicleEntityData\.MaterialPair$/);
    expect(x.vehicleDamageModifier).toBe(1);
  });

  it('holds its hit points, regeneration and ram', () => {
    expect(x).toMatchObject({ hp: 1200, regenDelay: 6, regenRate: 250 });
    expect(x.ram).toMatchObject({ angle: 65, glancing: 6, friend: 20, enemy: 25 });
  });
});

describe('a capital', () => {
  const c = book.capitals.corvette;

  it('names its parts as its hull does and spends each down its states', () => {
    expect(Object.keys(c.parts).sort()).toEqual([partName(CR90, 0, 2), partName(CR90, 1, 2)]);
    expect(c.parts['corvettecr90_01#0']).toMatchObject({ health: [500, 1, 0], states: ['corvettecr90_01#0', 'corvettecr90_01#0', null], property: 206, damageMultiplier: 1 });
    expect(c.parts['corvettecr90_01#1']).toMatchObject({ health: [450, 1, 0], property: 206 });
  });

  it('records the squad bonus where a prefab links it, not folded in', () => {
    expect(c.parts['corvettecr90_01#0'].squad).toBe(true);
    expect(c.parts['corvettecr90_01#0'].squad_source).toMatch(/PF_CorvetteCR90_01#/);
    expect(book.squadBonus).toMatchObject({ perMate: 0.02, cooldown: 5, eachMate: false });
  });

  it('fires its turrets’ own bolts', () => {
    const t = c.turrets.CorvetteCR90_LargeTurretTop;
    expect(t).toMatchObject({ hp: 12000, property: 129 });
    expect(t.bolts[0]).toMatchObject({ projectile: 'Projectile_CR90_LargeTurret', damage: 100, speed: 600, property: 61 });
  });

  it('maps the war’s part names onto its own', () => {
    expect(c.site.hull.part).toBe('corvettecr90_01#0');
    for (const name of SITE_NAMES) expect(c.site[name]).toBeDefined();
  });
});

it('names a record for every number', () => {
  expect(checkSources(book)).toEqual([]);
  expect(book._missing).toEqual([]);
});

describe('src/data/bf2017/damage.json', () => {
  const damage = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'src', 'data', 'bf2017', 'damage.json'), 'utf8'));

  it('names a record for every number', () => {
    expect(checkSources(damage)).toEqual([]);
    expect(damage._missing).toEqual([]);
  });

  it('holds every roster kind as a fighter, a capital or a stand-in', async () => {
    const kinds = await rosterKinds();
    const missing = kinds.filter((k) => !damage.fighters[k] && !damage.capitals[k] && !damage.stand[k]);
    expect(missing).toEqual([]);
    for (const k of Object.keys(CAPITAL_KITS).filter((k) => !k.startsWith('hq/'))) expect(damage.capitals[k], k).toBeDefined();
    // (the TIE interceptor is the game's ship, on a site hull)
    expect(damage.fighters.interceptor.hp).toBe(800);
    expect(damage.stand.interceptor).toBeUndefined();
  }, 30000);

  it('stands each kind the game never had in for a game kind it holds, and says why', () => {
    expect(Object.keys(damage.stand).sort()).toEqual(Object.keys(STAND).sort());
    for (const [k, s] of Object.entries(damage.stand)) {
      if (s.as !== null) expect(damage.fighters[s.as] ?? damage.capitals[s.as], k).toBeDefined();
      expect(s.why.length, k).toBeGreaterThan(20);
    }
    expect(damage.stand.bwing.as).toBe('ywing');
    expect(damage.stand.executor.as).toBe('destroyer');
    expect(damage.stand.munificent.as).toBe('providence');
  });

  it('names the Star Destroyer’s parts as its hull does (the hulls’ fixture of its hull, shield and reactor)', () => {
    const b = readFileSync(join(import.meta.dirname, '..', 'fixtures', 'bf2017', 'physics', 'destroyer-hull.bin'));
    const hull = readHull(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    const parts = damage.capitals.destroyer.parts;
    expect(parts['stardestroyer_deflectorshield_01#0']).toMatchObject({ health: [30000, 0], property: 130 });
    expect(parts['stardestroyer_solarionizationreactor_01#0']).toMatchObject({ health: [300, 0], property: 206, squad: true });
    // (the heavy turbolaser's second gun nested under its first: destroyed with it)
    expect(parts['stardestroyer_heavyturbolaser_01#0'].children).toEqual(['stardestroyer_heavyturbolaser_01#2']);
    for (const p of hull.parts) if (parts[p.name]) expect(parts[p.name].property, p.name).toBe(p.property);
    expect(hull.parts.filter((p) => parts[p.name]).length).toBeGreaterThan(6);
  });

  it('holds the extractor’s table: the MC80’s nodules and the CR90’s hull', () => {
    expect(damage.capitals.moncal.parts['mc80_largenodule_01#1'].health).toEqual([201, 200, 0]);
    expect(damage.capitals.corvette.parts['corvettecr90_01#0'].health).toEqual([500, 1, 0]);
  });

  it('maps the war’s part names onto parts each capital holds', () => {
    for (const [k, c] of Object.entries(damage.capitals))
      for (const name of SITE_NAMES) {
        expect(c.site[name], `${k} ${name}`).toBeDefined();
        if (c.site[name].part !== null) expect(c.parts[c.site[name].part], `${k} ${name}`).toBeDefined();
      }
  });
});
