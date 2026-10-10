import { describe, expect, it } from 'vitest';
import map from '../../../../data/bf2017/maps/sb_endor.json';
import stages from '../../../../data/bf2017/maps/sb_endor.stages.json';
import { createBattle } from '../../../universe/battle';
import { createDirector } from '../../../universe/battleDirector';
import { areaSpot, layStarfighter, obstacles } from '../../battles';
import { seeded, teamsOf } from '../../gcw';
import { systemById } from '../../systems';
import { METRES, frameOf, levelOf, shipsClear, starfighterPlan } from './starfighter';
import { STARFIGHTER, starfighterAt } from './starfighterMaps';

const sys = systemById('endor');
const level = levelOf(map, stages);
const on = (seed) => {
  const sides = teamsOf('empire', 'rebel');
  return { id: `sf.endor.${seed}`, war: 'gcw', sys: 'endor', step: 0, seed, attacker: 'empire', defender: 'rebel', sides, attackerTeam: sides.indexOf('empire'), start: 0, fightEnd: 600000, end: 600000, fighting: true };
};
const lay = (seed, tier = 'mid') => {
  const b = on(seed);
  const laid = layStarfighter(sys, b, level, { now: 0, tier });
  const plan = starfighterPlan(level, laid.frame, { id: b.id });
  return { b, laid, plan };
};

describe('Starfighter Assault over Endor, from the game’s level', () => {
  it('reads the level: the Rebels defend the MC80 and its corvettes, the Empire attacks from its Star Destroyer', () => {
    expect(level.attacker).toBe(1);
    expect(level.sides).toEqual(teamsOf('empire', 'rebel'));
    expect(level.sides[level.attacker]).toBe('empire');
    expect(level.ships.map((s) => [s.team, s.kind])).toEqual([
      [0, 'moncal'],
      [0, 'corvette'],
      [0, 'corvette'],
      [0, 'corvette'],
      [1, 'destroyer'],
    ]);
    // (the game's meshes have their bows to +Z: the Star Destroyer, turned half round, faces the MC80)
    const isd = level.ships.find((s) => s.kind === 'destroyer');
    const mc80 = level.ships.find((s) => s.kind === 'moncal');
    expect(isd.fwd[2]).toBeLessThan(-0.9);
    expect(mc80.fwd[2]).toBeGreaterThan(0.9);
    expect(level.spawns[0].length).toBeGreaterThan(0);
    expect(level.spawns[1].length).toBeGreaterThan(0);
  });

  it('follows the level’s phases, stage by stage, its objectives where the level puts them', () => {
    const { laid, plan } = lay(1);
    expect(plan.stages.map((s) => s.id)).toEqual(['corvettes', 'mines', 'top', 'beneath', 'engines']);
    // (the game's three phases, their objectives all there and no more)
    const phases = map.rows.spaceBattle.phases.filter((p) => p.objectives.length);
    expect(plan.stages.flatMap((s) => s.objectives.map((o) => o.id)).sort()).toEqual(phases.flatMap((p) => p.objectives.map((o) => o.name)).sort());
    expect(plan.stages.map((s) => s.opensAt)).toEqual([...plan.stages.map((s) => s.opensAt)].sort((a, b) => a - b));
    expect(plan.stages.at(-1).breaks).toBe(true);
    // a mine at its prefab, in the battle's frame
    const mine = map.rows.prefabs.find((p) => p.id === 'SpaceBattle_ScriptedEvents:17');
    expect(plan.stages[1].objectives[0].on.point).toEqual(laid.frame(mine.at));
    expect(laid.frame(stages.origin)).toEqual(laid.at);
    // the corvettes on their ships, sunk with them
    expect(plan.stages[0].objectives.map((o) => o.on.ship)).toEqual([1, 2, 3]);
    expect(plan.stages[0].objectives.every((o) => o.sinks)).toBe(true);

    // the director takes them down in that order: a stage is never open before the one before it's down
    const d = createDirector({ plan, seed: 'sf.endor.1' });
    let last = 0;
    for (let t = 0; t <= 900; t += 5) {
      const st = d.state(t, () => 0);
      expect(st.stage).toBeGreaterThanOrEqual(last);
      for (let i = 0; i < st.stage; i++) expect(st.stages[i].done).toBe(true);
      last = st.stage;
    }
  });

  it('lays the ships where the level has them, clear of each other and of the planet and the station', () => {
    for (const seed of [1, 2, 3]) {
      const { laid } = lay(seed);
      const battle = createBattle({ ...laid, perSide: 0, rand: seeded(`x${seed}`) });
      expect(shipsClear(battle, laid.avoid)).toEqual([]);
      const mc80 = battle.capitals.find((c) => c.kind === 'moncal');
      const at = laid.frame(level.ships.find((s) => s.kind === 'moncal').at);
      expect(Math.hypot(mc80.pos.x - at[0], mc80.pos.y - at[1], mc80.pos.z - at[2])).toBeLessThan(1e-6);
      // (two kilometres and a bit apart, as in the game)
      const isd = battle.capitals.find((c) => c.kind === 'destroyer');
      expect(Math.hypot(isd.pos.x - mc80.pos.x, isd.pos.z - mc80.pos.z) * METRES).toBeGreaterThan(2000);
      expect(isd.fwd.z).toBeLessThan(-0.9);
    }
  });

  it('a battle nobody flies in ends one way or the other inside twelve minutes, at the mid tier', () => {
    const winners = [];
    for (const seed of [1, 2, 3]) {
      const { b, laid, plan } = lay(seed, 'mid');
      const director = createDirector({ plan, seed: b.id });
      let t = 0;
      let st = director.state(0, () => 0);
      const battle = createBattle({ ...laid, rand: seeded(b.id), plan, director: { state: () => st }, tactics: { push: 480, clock: () => t } });
      const objectives = battle.objectives.length;
      let corvettes = 0;
      while (!battle.over && t < 720) {
        t += 0.25;
        st = director.state(t, () => 0);
        if (st.winner !== null) battle.end(st.winner, st.why);
        for (const e of battle.update(0.25, null)) if (e.type === 'capital' && e.kind === 'corvette') corvettes += 1;
      }
      expect(objectives).toBe(17);
      expect(battle.over).not.toBeNull();
      expect(t).toBeLessThanOrEqual(720);
      // (a corvette's objective down sinks it)
      if (st.stages[0].done) expect(corvettes).toBe(3);
      winners.push(battle.over.winner);
    }
    expect(winners.every((w) => w === 0 || w === 1)).toBe(true);
  }, 120000);

  it('knows which systems have one, and refuses the sequel era’s', () => {
    expect(starfighterAt('endor')).toBe(STARFIGHTER.endor);
    expect(starfighterAt('hoth')).toBeNull();
    expect(starfighterAt('kamino')).toBe(STARFIGHTER.kamino);
    expect(Object.values(STARFIGHTER).some((s) => /resurgent|spacebear/.test(s.level))).toBe(false);
    expect(frameOf(level, [10, 0, 0])(level.origin)).toEqual([10, 0, 0]);
  });
});

describe('Starfighter Assault over Kamino, from the game’s level, in an area of its own over Tipoca City', async () => {
  const kmap = (await import('../../../../data/bf2017/maps/sb_kamino.json')).default;
  const kstages = (await import('../../../../data/bf2017/maps/sb_kamino.stages.json')).default;
  const kamino = levelOf(kmap, kstages);
  const sides = teamsOf('separatists', 'republic');
  const battleOf = (seed) => ({ id: `sf.kamino.${seed}`, war: 'clone', sys: 'kamino', step: 0, seed, attacker: 'separatists', defender: 'republic', sides, attackerTeam: sides.indexOf('separatists'), start: 0, fightEnd: 600000, end: 600000, fighting: true });

  it('the Separatists attack the Republic’s Venators and cruisers, phase by phase as the level has them', () => {
    expect(kamino.sides).toEqual(sides);
    expect(kamino.sides[kamino.attacker]).toBe('separatists');
    // (the two Venators by their order in the sub-level: the one that returns is the flagship)
    const [ret, first] = kamino.ships.filter((s) => s.kind === 'venator');
    expect(ret.role).toBe('flagship');
    expect(Math.hypot(ret.at[0] - first.at[0], ret.at[2] - first.at[2])).toBeGreaterThan(4000);
    expect(kamino.ships.find((s) => s.id === 'cruiser-a').size).toBeCloseTo(318 / METRES, 1);
    const laid = layStarfighter(systemById('kamino'), battleOf(1), kamino, { now: 0, tier: 'mid' });
    const plan = starfighterPlan(kamino, laid.frame, { id: 'k1' });
    expect(plan.stages.map((s) => s.id)).toEqual(['bridges', 'cruisers', 'engines', 'beam']);
    const phases = kmap.rows.spaceBattle.phases.filter((p) => p.objectives.length);
    expect(plan.stages.flatMap((s) => s.objectives.map((o) => o.id)).sort()).toEqual(phases.flatMap((p) => p.objectives.map((o) => o.name)).sort());
    // the bridges on the first Venator, the engines and the beam weapon on the one that returns
    const near = (o, ship) => Math.hypot(...o.at.map((x, k) => x - ship.at[k]));
    for (const o of kamino.stages[0].objectives) expect(near(o, first)).toBeLessThan(near(o, ret));
    for (const o of [...kamino.stages[2].objectives, ...kamino.stages[3].objectives]) expect(near(o, ret)).toBeLessThan(near(o, first));
  });

  it('is laid in its own area: off the planet, clear of what’s built round it, the whole level inside its dome, its sea under the city', () => {
    const sys = systemById('kamino');
    const r = kamino.area.radius / METRES;
    const laid = layStarfighter(sys, battleOf(1), kamino, { now: 0, tier: 'mid' });
    expect(laid.at).toEqual(areaSpot(sys, r));
    for (const o of obstacles(sys)) expect(Math.hypot(laid.at[0] - o.c.x, laid.at[1] - o.c.y, laid.at[2] - o.c.z)).toBeGreaterThan(o.r + r);
    // (every ship, objective and launch point inside the dome, above the sea)
    const sea = laid.frame([0, kamino.area.sea, 0])[1];
    const points = [...kamino.ships.map((s) => s.at), ...kamino.stages.flatMap((st) => st.objectives.map((o) => o.at)), ...kamino.spawns.flat().map((s) => s.at)].map(laid.frame);
    for (const p of points) {
      expect(Math.hypot(p[0] - laid.at[0], p[1] - laid.at[1], p[2] - laid.at[2])).toBeLessThan(r * 0.9);
      expect(p[1]).toBeGreaterThan(sea);
    }
    // (and Endor's, fought in orbit, has no area: where the war's battle would be)
    expect(level.area).toBeNull();
  });

  it('a battle nobody flies in ends inside twelve minutes, its ships clear', () => {
    for (const seed of [1, 2, 3]) {
      const b = battleOf(seed);
      const laid = layStarfighter(systemById('kamino'), b, kamino, { now: 0, tier: 'mid' });
      const plan = starfighterPlan(kamino, laid.frame, { id: b.id });
      const director = createDirector({ plan, seed: b.id });
      let t = 0;
      let st = director.state(0, () => 0);
      const battle = createBattle({ ...laid, rand: seeded(b.id), plan, director: { state: () => st }, tactics: { push: 480, clock: () => t } });
      expect(shipsClear(battle, laid.avoid)).toEqual([]);
      while (!battle.over && t < 720) {
        t += 0.5;
        st = director.state(t, () => 0);
        if (st.winner !== null) battle.end(st.winner, st.why);
        battle.update(0.5, null);
      }
      expect(battle.over).not.toBeNull();
    }
  }, 120000);
});
