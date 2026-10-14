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
import { CAPITAL_KITS, SITE_OVER_GAME, headerFile, partName, readHeader, rosterKinds } from './bf2017-hulls.mjs';
import { checkSources } from './bf2017-rulebook.mjs';
import { FIGHTERS, SITE_NAMES, STAND, cutGrid, damageRulebook, gridOf, propertyOf, turretRow } from './bf2017-rulebook-damage.mjs';

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

  it('gives the war’s hull the record the site chose, its numbers the record’s, on the hull parts a hit on it is', () => {
    expect(c.site.hull).toMatchObject({ source: 'site', record: 'Gameplay/Vehicles/Corvette/CorvetteCR90/CorvetteCR90_01', health: [500, 1, 0], properties: [206, 206, null], squad: true, damageMultiplier: 1 });
    expect(c.site.hull._source).toMatch(/CorvetteCR90_01#PartComponentData\[\d+\]\.HealthStates$/);
    expect(c.site.hull.parts).toEqual([partName(CR90, 0, 2), partName(CR90, 1, 2)]);
    // (the hull part each state names: a hit spends the chain only on it; the last state the whole object)
    expect(c.site.hull.states).toEqual(['corvettecr90_01#0', 'corvettecr90_01#0', null]);
    expect(c.site.hull.why).toMatch(/^the site maps the war’s hull to .* because /);
    // (the CR90 has no objective for the war's generators, bridge or reactor: the war keeps its own)
    for (const name of SITE_NAMES.slice(1)) expect(c.site[name]).toMatchObject({ source: 'site', record: null, parts: [] });
  });

  it('names each chain’s source by its object, the record having several', () => {
    expect(c.parts['corvettecr90_01#0']._source).not.toBe(c.parts['corvettecr90_01#1']._source);
  });
});

it('names a record for every number', () => {
  expect(checkSources(book)).toEqual([]);
  expect(book._missing).toEqual([]);
});

it('says what it could not read rather than leave it out', () => {
  const thin = damageRulebook(ROOT, { fighters: {}, kits: { corvette: [CR90] }, turrets: { corvette: ['Gameplay/Vehicles/Corvette/CorvetteCR90/CorvetteCR90_Nowhere'] }, header });
  expect(thin._missing).toContain('turret: Gameplay/Vehicles/Corvette/CorvetteCR90/CorvetteCR90_Nowhere');
  expect(thin.capitals.corvette.turrets).toEqual({});
});

it('says so of a turret that fires nothing, rather than give it no bolts', () => {
  // (the fixture's top turret with its projectile override taken away: no override, no firing function's shot)
  const top = JSON.parse(readFileSync(join(ROOT, 'data', `${TOP}.json`), 'utf8'));
  const unarmed = { ...top, objects: top.objects.map((o) => (o?.$type === 'FireProjectileEntityOverrideData' ? { $type: 'Removed' } : o)) };
  const missing = [];
  expect(turretRow(ROOT, unarmed, { missing })).toBe(null);
  expect(missing).toEqual([`turret: ${top.name} fires no bolt`]);
  expect(turretRow(ROOT, TOP, { missing: [] }).bolts).toHaveLength(1);
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

  it('marks the site’s choices as the site’s, says so in its notes, and says how a blast applies', () => {
    // (by key: what reads them reads them by key)
    expect(Object.keys(damage._notes)).toEqual(['bolt', 'fighter', 'capital', 'chain', 'blast', 'site', 'precedence', 'assumed', 'dropped']);
    expect(damage._notes.site).toMatch(/`site` and `turretParts` blocks are the site’s choices/);
    expect(damage._notes.blast).toMatch(/slot 43/);
    expect(damage._notes.precedence).toMatch(/spends that entry’s chain .* not the part’s own chain/);
    for (const [k, c] of Object.entries(damage.capitals)) {
      for (const name of SITE_NAMES) {
        const s = c.site[name];
        expect(s, `${k} ${name}`).toMatchObject({ source: 'site' });
        expect(s.why, `${k} ${name}`).toMatch(/^(the site maps the war’s .* because |no record of the game’s |the game’s .* has no )/);
        if (s.record !== null) expect(s.health.length, `${k} ${name}`).toBe(s.properties.length);
      }
      if (c.turretParts) expect(c.turretParts.source, k).toBe('site');
    }
  });

  it('gives the war’s objectives the game’s objective records where it has them', () => {
    const { venator, moncal, lucrehulk, destroyer } = damage.capitals;
    expect(venator.site.bridge).toMatchObject({ health: [700, 699, 0], properties: [132, 206, 132], squad: true });
    expect(venator.site.bridge.record).toMatch(/VenatorControlTowerLeft_HealthState$/);
    expect(venator.site.bridge.parts).toContain('venatorstardestroyer_controltower_left#0');
    expect(venator.site.reactor).toMatchObject({ health: [500, 0], properties: [206, 132] });
    expect(venator.site.reactor.parts).toContain('venatorstardestroyer_engine_01');
    expect(moncal.site.reactor).toMatchObject({ health: [251, 250, 0], properties: [132, 206, null] });
    expect(moncal.site.reactor.parts).toContain('mc80_engine_module_01');
    expect(lucrehulk.site.reactor).toMatchObject({ health: [450, 204, 102, 0], parts: ['reactor'] });
    expect(destroyer.site.reactor).toMatchObject({ health: [300, 0], squad: true });
    expect(destroyer.site['gen-port'].parts).toEqual(['stardestroyer_deflectorshield_01#0', 'stardestroyer_deflectorshield_01#1']);
  });

  it('gates a site entry on the part its state names where its record is a kit module, and only there', () => {
    const { venator, moncal, lucrehulk, destroyer } = damage.capitals;
    // (the deflector's base, #1, does not spend the dome's state 0)
    expect(destroyer.site['gen-port'].states).toEqual(['stardestroyer_deflectorshield_01#0', 'stardestroyer_deflectorshield_01#1']);
    expect(moncal.site['gen-port'].states).toEqual(['mc80_largenodule_01#1', 'mc80_largenodule_01#0', 'mc80_largenodule_01#2']);
    // (a site hull's own part, and a level's object outside the kit, take any routed hit)
    expect(lucrehulk.site.reactor.states).toBeUndefined();
    expect(venator.site.bridge.states).toBeUndefined();
    expect(damage._notes.site).toMatch(/one without takes any hit on its `parts`/);
    for (const [k, c] of Object.entries(damage.capitals))
      for (const [id, s] of Object.entries(c.site)) {
        if (!s.states) continue;
        expect(s.states.length, `${k} ${id}`).toBe(s.health.length);
        for (const p of s.states) if (p !== null) expect(s.parts, `${k} ${id} ${p}`).toContain(p);
      }
  });

  it('names, on a game hull, only parts that hull has; on a site hull, the part of the name', () => {
    for (const [k, c] of Object.entries(damage.capitals)) {
      const names = new Set([...Object.keys(c.parts), ...Object.values(c.parts).flatMap((p) => p.states)]);
      for (const [id, s] of Object.entries(c.site))
        for (const p of s.parts) expect(SITE_OVER_GAME[k] ? p === id : names.has(p), `${k} ${id} ${p}`).toBe(true);
      for (const [part, turret] of Object.entries(c.turretParts?.parts ?? {})) {
        expect(c.parts[part], `${k} ${part}`).toBeDefined();
        expect(c.turrets[turret], `${k} ${turret}`).toBeDefined();
      }
    }
  });

  it('leaves out only the parts no bolt can hurt, and says how many', () => {
    const harmless = new Set([0, 34, 131, 132]);
    for (const [k, c] of Object.entries(damage.capitals)) {
      const named = new Set([...Object.values(c.site).flatMap((s) => s.parts), ...Object.keys(c.turretParts?.parts ?? {})]);
      for (const [name, p] of Object.entries(c.parts)) if (p.properties.every((x) => harmless.has(x))) expect(named.has(name), `${k} ${name}`).toBe(true);
    }
    expect(damage._notes.dropped).toMatch(/^\d+ capital parts are left out/);
  });
});
