// Fondor's shipyard and the droid battleship over Ryloth (the sixth design's
// lane fighters, task 5): each level read, laid in an area of its own off the
// system it's entered from, its ships clear, and fought to an end inside
// twelve minutes with nobody flying, on the game's kits.
import { describe, expect, it } from 'vitest';
import air from '../../../../data/bf2017/air.json';
import { createBattle } from '../../../universe/battle';
import { createDirector } from '../../../universe/battleDirector';
import { areaSpot, layStarfighter, obstacles } from '../../battles';
import { seeded, teamsOf } from '../../gcw';
import { systemById } from '../../systems';
import { METRES, levelOf, shipsClear, starfighterPlan } from './starfighter';
import { STARFIGHTER, starfighterAt } from './starfighterMaps';

const LEVELS = {
  fondor: { sys: 'coruscant', sides: ['rebel', 'empire'], war: 'gcw', stages: ['cruisers', 'shields', 'clamps', 'reactor'], light: ['xwing65', 'awing', 'ywing'] },
  droidbattleship: { sys: 'naboo', sides: ['republic', 'separatists'], war: 'clone', stages: ['tractors', 'generators', 'towers', 'core'], light: ['arc170', 'vwing', 'ywing'] },
};

for (const [name, want] of Object.entries(LEVELS)) {
  describe(`Starfighter Assault: ${name}, in an area of its own`, async () => {
    const map = (await import(`../../../../data/bf2017/maps/sb_${name}.json`)).default;
    const stages = (await import(`../../../../data/bf2017/maps/sb_${name}.stages.json`)).default;
    const level = levelOf(map, stages, air);
    const sys = systemById(want.sys);
    const sides = teamsOf(...want.sides);
    const attacker = level.sides[level.attacker];
    const battleOf = (seed) => ({ id: `sf.${name}.${seed}`, war: want.war, sys: want.sys, step: 0, seed, attacker, defender: level.sides[level.defender], sides, attackerTeam: sides.indexOf(attacker), start: 0, fightEnd: 600000, end: 600000, fighting: true });

    it('reads the level: the light side attacks, phase by phase as the level has them', () => {
      expect(starfighterAt(want.sys)).toBe(STARFIGHTER[want.sys]);
      expect(STARFIGHTER[want.sys].level).toBe(`sb_${name}_01`);
      expect(level.sides).toEqual(sides);
      expect(level.attacker).toBe(0);
      const laid = layStarfighter(sys, battleOf(1), level, { now: 0, tier: 'mid' });
      const plan = starfighterPlan(level, laid.frame, { id: 'p' });
      expect(plan.stages.map((s) => s.id)).toEqual(want.stages);
      const phases = map.rows.spaceBattle.phases.filter((p) => p.objectives.length);
      expect(plan.stages.flatMap((s) => s.objectives.map((o) => o.id)).sort()).toEqual(phases.flatMap((p) => p.objectives.map((o) => o.name)).sort());
      expect(level.fighters[0].map((f) => f.kind)).toEqual(want.light);
    });

    it('is laid off the planet, clear of what’s built round it, the whole battle inside its dome', () => {
      const r = level.area.radius / METRES;
      const laid = layStarfighter(sys, battleOf(1), level, { now: 0, tier: 'mid' });
      expect(laid.at).toEqual(areaSpot(sys, r));
      for (const o of obstacles(sys)) expect(Math.hypot(laid.at[0] - o.c.x, laid.at[1] - o.c.y, laid.at[2] - o.c.z)).toBeGreaterThan(o.r + r);
      const points = [...level.ships.map((s) => s.at), ...level.stages.flatMap((st) => st.objectives.map((o) => o.at)), ...level.spawns.flat().map((s) => s.at)].map(laid.frame);
      for (const p of points) expect(Math.hypot(p[0] - laid.at[0], p[1] - laid.at[1], p[2] - laid.at[2])).toBeLessThan(r * 0.9);
      expect(level.area.sea).toBeNull();
      expect(level.area.sky.full).toBe(true);
    });

    it('a battle nobody flies in ends inside twelve minutes, its ships clear', () => {
      for (const seed of [1, 2, 3]) {
        const b = battleOf(seed);
        const laid = layStarfighter(sys, b, level, { now: 0, tier: 'mid' });
        const plan = starfighterPlan(level, laid.frame, { id: b.id });
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
        expect(battle.over, `seed ${seed}`).not.toBeNull();
      }
    }, 120000);
  });
}
