import { describe, expect, it } from 'vitest';
import air from '../../../../data/bf2017/air.json';
import droidMap from '../../../../data/bf2017/maps/sb_droidbattleship.json';
import endorMap from '../../../../data/bf2017/maps/sb_endor.json';
import endorStages from '../../../../data/bf2017/maps/sb_endor.stages.json';
import kaminoMap from '../../../../data/bf2017/maps/sb_kamino.json';
import kaminoStages from '../../../../data/bf2017/maps/sb_kamino.stages.json';
import { FIGHTERS } from '../../../universe/wars';
import { MODELS } from '../../models';
import { levelOf } from './starfighter';
import { SIM, eraOf, heroesOf, kitsOf, playerKit, tuneFor } from './starfighterKits';
import { commandOf, listFor, namer, namesIn } from './starfighterPilots';

const kinds = (kits) => kits.map((k) => k.id);

describe("Starfighter Assault's kits from the game's records", () => {
  it('flies the Original era’s kits over Endor, weighted by the level’s own spawners', () => {
    const lv = levelOf(endorMap, endorStages, air);
    expect(lv.era).toBe('orig');
    expect(kinds(lv.kits[0])).toEqual(['xwing_t65', 'awing', 'ywing']);
    expect(kinds(lv.kits[1])).toEqual(['tiefighter', 'tieinterceptor', 'tiebomber']);
    expect(lv.kits[0].map((k) => k.role)).toEqual(['fighter', 'interceptor', 'bomber']);
    // (the level's AI squadrons: thirteen X-wing and thirteen TIE fighter spawners; its fifty-five TIE bomber spawners are its bomber flights, the plan's waves)
    expect(lv.kits[0][0].weight).toBe(13);
    expect(lv.kits[1][2].weight).toBe(1);
    expect(lv.fighters[0].map((f) => f.kind)).toEqual(['xwing65', 'awing', 'ywing']);
  });

  it('flies ARC-170s and V-wings for the Republic over Kamino, vultures and tri-fighters for the Separatists', () => {
    const lv = levelOf(kaminoMap, kaminoStages, air);
    expect(lv.era).toBe('preq');
    expect(lv.fighters[0].map((f) => f.kind)).toEqual(['arc170', 'vwing', 'ywing']);
    expect(lv.fighters[1].map((f) => f.kind)).toEqual(['vulture', 'trifighter', 'hyena']);
  });

  it("offers a side only the kinds its kit list allows (the droid battleship's Republic: no X-wing, though the level places one)", () => {
    expect(droidMap.rows.vehicleSpawns.some((v) => /XWing_T65/.test(v.blueprint))).toBe(true);
    const kits = kitsOf(air, droidMap, { sides: ['republic', 'separatists'] });
    expect(kinds(kits[0])).toEqual(air.kits.preq.light);
    expect(kinds(kits[0])).not.toContain('xwing_t65');
    expect(kinds(kits[1])).toEqual(air.kits.preq.dark);
    for (const k of kits.flat()) expect(k.weight).toBeGreaterThanOrEqual(1);
  });

  it('every kind it flies is one the galaxy battle flies and draws', () => {
    for (const [id, kind] of Object.entries(SIM)) {
      if (id === 'source') continue;
      expect(FIGHTERS[kind], kind).toBeTruthy();
      expect(MODELS[kind], kind).toBeTruthy();
      expect(air.vehicles[id], id).toBeTruthy();
    }
  });

  it('lists the hero ships apart, none of the sequel’s', () => {
    expect(heroesOf(air, 0)).toContain('millenniumfalcon');
    expect(heroesOf(air, 1)).toContain('slave1');
    expect([...heroesOf(air, 0), ...heroesOf(air, 1)].some((h) => /rz3|_nt|hask|t70/.test(h))).toBe(false);
    expect(air.heroes.atOnce).toBe(3);
    expect(air.heroes.price).toBe(2000);
  });

  it('tunes your ship to your kit as its handling compares with the X-wing’s', () => {
    const x = tuneFor(air.vehicles.xwing_t65, air.vehicles.xwing_t65);
    expect(x.tune).toEqual({ cruise: 1, boost: 1, accel: 1, agility: 1 });
    const i = tuneFor(air.vehicles.tieinterceptor, air.vehicles.xwing_t65).tune;
    expect(i.cruise).toBeGreaterThan(1);
    expect(i.agility).toBeGreaterThan(1);
    const y = tuneFor(air.vehicles.ywing, air.vehicles.xwing_t65);
    expect(y.tune.cruise).toBeLessThan(1);
    expect(y.tune.agility).toBeLessThan(1);
    expect(playerKit(levelOf(endorMap, endorStages, air).kits[1]).id).toBe('tiefighter');
    expect(eraOf({ sides: ['rebel', 'empire'] })).toBe('orig');
  });
});

describe("Starfighter Assault's pilots", () => {
  it("names the bots from the game's lists, the same name for a fighter every time", () => {
    const names = { book: null, air: air.names };
    const empire = listFor(names, 'empire');
    expect(empire[0]).toBe('TK-772');
    const name = namer(empire, 'empire');
    const a = name(7);
    expect(empire).toContain(a);
    expect(name(7)).toBe(a);
    const all = new Set(Array.from({ length: empire.length }, (_, i) => name(100 + i)));
    expect(all.size).toBe(empire.length);
  });

  it("takes the bots lane's names in whichever shape it keeps them", () => {
    expect(namesIn({ spaceBattles: { empire: ['A'] } }, 'empire')).toEqual(['A']);
    expect(namesIn({ empire: { SpaceBattles: ['B'] } }, 'empire')).toEqual(['B']);
    expect(namesIn(null, 'empire')).toBeNull();
  });

  it("reads a battle fighter's step back as the game's command", () => {
    const row = air.vehicles.xwing_t65;
    const dt = 0.1;
    // (the nose swung right at the X-wing's yaw rate at top speed)
    const rate = 100 * 0.85 * (Math.PI / 180) * dt;
    const before = { fwd: { x: 0, y: 0, z: 1 }, speed: 100, shots: 0 };
    const after = { fwd: { x: -Math.sin(rate), y: 0, z: Math.cos(rate) }, speed: 100, shots: 1 };
    const c = commandOf(before, after, dt, row);
    expect(c.yaw).toBeCloseTo(1, 1);
    expect(c.pitch).toBeCloseTo(0, 3);
    expect(c.throttle).toBe(1);
    expect(c.fire).toBe(true);
    expect(Object.keys(c).sort()).toEqual(['boost', 'fire', 'missile', 'pitch', 'roll', 'throttle', 'yaw']);
  });
});
