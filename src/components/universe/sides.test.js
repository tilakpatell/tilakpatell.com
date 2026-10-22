import { describe, expect, it } from 'vitest';
import { AHEAD_OF, SECTOR_SIDES, SIDES, allKinds, crewAt, factionsOf, kindsOf, namesOf, pick, sideAt, sideFor, sideOf, squadKinds, wingOf } from './sides';
import { SECTORS } from './layout';
import { CREWS } from './crews';
import { TROOPS } from './foot';
import { BUILT_KINDS } from './trafficModels';
import { GLB } from './glbFleet';
import { GUNS } from './gunplay';
import { MESHY } from '../rickmorty/portal/meshyCast';
import { existsSync } from 'node:fs';
import { bodyOf } from '../../lib/cast/bodies';

const seeded = (seed = 7) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const drawable = (kind) => BUILT_KINDS.includes(kind) || Boolean(GLB[kind]);

describe('the sides', () => {
  it('give every crew a side, and nothing else one', () => {
    for (const c of CREWS) expect(sideOf(c.id), c.id).toBeTruthy();
    expect(sideOf('rv')).toBe('breakingbad');
    expect(sideOf('nope')).toBeNull();
    expect(sideFor(null)).toBeNull();
    for (const s of Object.values(SIDES)) for (const c of s.crews) expect(sideOf(c)).toBe(s.id);
  });

  it('each have a universe: enemies of every role, allies, civilians, a leviathan and troops', () => {
    for (const s of Object.values(SIDES)) {
      const roles = Object.values(s.factions).map((f) => f.role);
      expect(roles.filter((r) => r === 'hunt').length, s.id).toBeGreaterThanOrEqual(1);
      expect(roles.includes('bounty'), s.id).toBe(true);
      expect(s.factions[s.distress.pirates], `${s.id} pirates`).toBeTruthy();
      expect(Object.keys(s.allies).length, s.id).toBeGreaterThanOrEqual(1);
      expect(s.civil.length, s.id).toBeGreaterThanOrEqual(1);
      expect(s.civil, s.id).toContain(s.distress.civil);
      expect(s.convoy.escort, s.id).toBeTruthy();
      expect(s.leviathan, s.id).toBeTruthy();
      expect(Object.keys(s.troops).length, s.id).toBeGreaterThanOrEqual(2);
      expect(s.skirmish.faction && s.skirmish.escort && s.skirmish.civil, s.id).toBeTruthy();
      expect(s.factions[s.skirmish.faction], s.id).toBeTruthy();
      expect(s.allies[s.skirmish.escort], s.id).toBeTruthy();
    }
  });

  it('name only ships that can be drawn, with stats and a name for every hunter', () => {
    for (const s of Object.values(SIDES)) {
      const kinds = kindsOf(s.id);
      const names = namesOf(s.id);
      for (const [id, f] of Object.entries(s.factions)) {
        for (const [k] of f.kinds) {
          expect(kinds[k], `${s.id}.${id}.${k}`).toBeTruthy();
          expect(names[k], `${s.id}.${id}.${k}`).toBeTruthy();
          expect(drawable(kinds[k].model ?? k), `${s.id}.${id}.${k}`).toBe(true);
        }
        if (f.ace) {
          expect(kinds[f.ace], `${s.id}.${id}.ace`).toBeTruthy();
          expect(drawable(kinds[f.ace].model ?? f.ace), `${s.id}.${id}.ace`).toBe(true);
        }
        expect(f.laser, `${s.id}.${id}`).toHaveLength(3);
        expect(f.size, `${s.id}.${id}`).toHaveLength(2);
      }
      for (const k of [...Object.keys(s.allies), ...s.civil, ...s.traffic, s.convoy.escort]) expect(drawable(k), `${s.id} ${k}`).toBe(true);
      for (const k of Object.keys(s.ahead)) expect(drawable(k), `${s.id} ahead ${k}`).toBe(true);
      for (const [k, t] of Object.entries(s.troops)) {
        expect(TROOPS[k], `${s.id} troop ${k}`).toBeTruthy();
        expect(t.gun === null || typeof t.gun === 'string', `${s.id} troop ${k}`).toBe(true);
      }
      for (let n = 0; n < 6; n++) for (const k of squadKinds(s, n)) expect(s.troops[k], `${s.id} squad ${n} ${k}`).toBeTruthy();
    }
  });

  it('send each side’s own troops on the ground, with real guns and figures that can be drawn', () => {
    const own = { starwars: ['stormtrooper', 'scout', 'probe'], rickmorty: ['gromflomite', 'cop', 'gazorpian', 'mortyguard'], breakingbad: ['dea', 'cartel', 'jackscrew'] };
    for (const s of Object.values(SIDES)) {
      expect(Object.keys(s.troops).sort(), s.id).toEqual(own[s.id].sort());
      const seen = new Set();
      for (let n = 0; n < 6; n++) for (const k of squadKinds(s, n)) seen.add(k);
      expect([...seen].sort(), `${s.id} squads`).toEqual(own[s.id].sort());
      for (const [k, t] of Object.entries(s.troops)) {
        if (t.gun) expect(GUNS[t.gun], `${s.id} ${k} gun`).toBeTruthy();
        const f = t.figure ?? { meshy: k };
        if (f.meshy) expect(MESHY[f.meshy], `${s.id} ${k} meshy`).toBeTruthy();
        // (a body of the game's draws its light cut, committed; its full one is the bucket's)
        if (f.rig) expect(existsSync(`public${f.url.replace(/\.glb$/, '.lod1.glb')}`), `${s.id} ${k} ${f.url}`).toBe(true);
        else if (f.url) expect(existsSync(`public${f.url}`), `${s.id} ${k} ${f.url}`).toBe(true);
        if (f.built) expect(['stormtrooper', 'scout', 'probe', 'jackscrew'], `${s.id} ${k} built`).toContain(f.built);
        // (one that calls a squad in carries nothing)
        if (TROOPS[k].calls) expect(t.gun, k).toBeNull();
      }
    }
  });

  it('send the Empire’s troops on the game’s bodies, from the one cast table, the probe built', () => {
    const t = SIDES.starwars.troops;
    expect(t.stormtrooper.figure).toMatchObject({ url: bodyOf('stormtrooper').url, rig: 'walrus', built: 'stormtrooper', cuts: { full: true, lod: true } });
    expect(t.scout.figure).toMatchObject({ url: bodyOf('scouttrooper').url, rig: 'walrus', built: 'scout', cuts: { full: true, lod: true } });
    expect(bodyOf('stormtrooper').source).toBe('game');
    expect(bodyOf('scouttrooper').source).toBe('game');
    expect(t.probe.figure).toEqual({ built: 'probe' });
  });

  it('pick a faction by role, and only that role', () => {
    const rand = seeded();
    for (const s of Object.values(SIDES)) {
      for (const role of ['hunt', 'bounty']) {
        for (let i = 0; i < 200; i++) {
          const id = pick(s, role, rand);
          expect(s.factions[id]?.role, `${s.id} ${role}`).toBe(role);
        }
      }
      for (let i = 0; i < 50; i++) expect(s.allies[wingOf(s, rand)], s.id).toBeTruthy();
    }
    expect(pick(SIDES.breakingbad, 'council', rand)).toBeNull();
    expect(SIDES.breakingbad.has('council')).toBe(false);
    expect(SIDES.rickmorty.has('council')).toBe(true);
    expect(SIDES.starwars.has('destroyer')).toBe(true);
    // a side with a capital ship names one that can be drawn, and what it launches
    for (const side of Object.values(SIDES)) {
      if (!side.pieces.includes('destroyer')) continue;
      expect(drawable(side.capitalShip), `${side.id} capitalShip`).toBe(true);
      expect(side.factions[side.capital]?.role, `${side.id} capital`).toBe('capital');
    }
    expect(SIDES.breakingbad.has('roadblock')).toBe(true);
    // the police, for wanted.js: a faction of their own, and a kind of theirs for every unit
    for (const s of Object.values(SIDES)) {
      const f = s.factions[s.police.faction];
      expect(f?.role, s.id).toBe('police');
      for (const u of ['cop', 'enforcer', 'heavy', 'medic']) expect(f.kinds.map(([k]) => k), `${s.id} ${u}`).toContain(s.police.units[u]);
    }
    for (const s of Object.values(SIDES)) for (const need of ['hunt', 'bounty', 'pirates', 'leviathan']) expect(s.has(need), `${s.id} ${need}`).toBe(true);
  });

  it('agree with each other on every kind, and all together are the wire’s', () => {
    const seen = {};
    for (const s of Object.values(SIDES)) {
      for (const [k, row] of Object.entries(kindsOf(s.id))) {
        if (seen[k]) expect(seen[k], k).toEqual(row);
        seen[k] = row;
      }
    }
    expect(new Set(allKinds).size).toBe(allKinds.length);
    expect(Object.keys(kindsOf(null)).sort()).toEqual([...allKinds].sort());
    for (const s of Object.values(SIDES)) for (const id of Object.keys(s.factions)) expect(factionsOf(null)[id]).toBe(s.factions[id]);
    expect(AHEAD_OF(SIDES.starwars).tie).toBeGreaterThan(0);
    expect(AHEAD_OF(null)).toEqual({});
  });
});

describe('whose space it is', () => {
  it('gives the Rick and Morty sector to the Rick and Morty side, whoever flies there, and the main map to the crew’s own', () => {
    for (const s of Object.values(SIDES)) {
      for (const crew of s.crews) {
        expect(sideAt(crew, 'main'), crew).toBe(s);
        expect(sideAt(crew), crew).toBe(s);
        expect(crewAt(crew, 'main')).toBe(crew);
        expect(sideAt(crew, 'rickmorty'), crew).toBe(SIDES.rickmorty);
        expect(sideFor(crewAt(crew, 'rickmorty')), crew).toBe(SIDES.rickmorty);
      }
    }
    // (Rick's own crew stays itself there)
    expect(crewAt('cruiser', 'rickmorty')).toBe('cruiser');
    for (const [sector, side] of Object.entries(SECTOR_SIDES)) {
      expect(SECTORS[sector], sector).toBeTruthy();
      expect(SIDES[side], side).toBeTruthy();
    }
    expect(sideAt(null, 'main')).toBeNull();
  });
});
