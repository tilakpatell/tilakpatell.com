import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { aiMeleeOf, cameraOf, costsOf, damageOf, deflectOf, evadeOf, evadingOf, HEROES, queryOf, saberRow, staggerOf } from './bf2017-rulebook-saber.mjs';

// (Luke's records, cut to what the rulebook reads: scripts/fixtures/bf2017/data)
const ROOT = join(import.meta.dirname, '..', 'fixtures', 'bf2017', 'data');

describe('the saber rulebook from the records', () => {
  it('reads the hit query: a 3 m sphere round a point 1.5 m back, out of 1.5 m within 35°, inside the 45° gate from 5 m ahead, behind within 70°', () => {
    const q = queryOf(ROOT);
    expect(q.anchor).toBe(-1.5);
    expect(q.hit).toMatchObject({ radius: 3, near: 1.5, cone: 35, apex: 5, gate: 45, behind: 70 });
    expect(q.hit.cone_source).toMatch(/PF_Lightsaber_Gameplay_Physical#DynamicQueryFilterEntityData\[\d+\]\.InputData\.FilterOutAngle/);
  });

  it('reads the lunge: 8 m (2 m out of stamina), out of 1.8 m within 60°, the 45° gate from 8.5 m, the best within 40°', () => {
    const l = queryOf(ROOT).lunge;
    expect(l).toMatchObject({ radius: 8, tired: 2, near: 1.8, nearCone: 60, apex: 8.5, gate: 45, pick: 40, lift: 1.3 });
    expect(l.weights).toMatchObject({ distance: 0.2, angle: 2 });
  });

  it('reads Luke’s damage: 130 after 0.09 s, 30 more from behind, on the attacking state (17)', () => {
    const d = damageOf(ROOT, HEROES.luke.saber);
    expect(d.hit).toMatchObject({ damage: 130, delay: 0.09, gate: 17 });
    expect(d.behind).toMatchObject({ damage: 30, delay: 0.09 });
    expect(d.hit.damage_source).toBe('Gameplay/Prefabs/Affectors/States/Affector_Damage_Lightsaber_Luke#DamageAffectorAsset.RankData.0.InitialDamage');
  });

  it('reads Luke’s deflect: the 1.2 m shield 0.45 m ahead, its shell in front, a 100 stamina pool', () => {
    const d = deflectOf(ROOT, HEROES.luke.deflect);
    expect(d.shield).toMatchObject({ radius: 1.2, offset: 0.45 });
    expect(d.shield.box.min[2]).toBeCloseTo(-0.53, 2);
    expect(d.shield.box.max[1]).toBeCloseTo(2.03, 2);
    expect(d.stamina).toMatchObject({ max: 100, out: 1 });
  });

  it('reads Luke’s stamina costs from the battlepoint unit costs', () => {
    expect(costsOf(ROOT, 'LUKE')).toMatchObject({ strike: 10, blocked: 10, bolt: 4, standardBolt: 45, regen: 33.3, delay: 1, spread: 0.45 });
  });

  it('reads the dodge, the evading multiplier, the stagger, the camera and the AI’s melee', () => {
    expect(evadeOf(ROOT, HEROES.luke.evade)).toMatchObject({ cost: 0.5, charges: 2, active: 0.4, recharge: 2.2 });
    expect(evadingOf(ROOT).taken).toBe(0.8);
    expect(staggerOf(ROOT)).toMatchObject({ blocked: 0.5, flash: 0.1 });
    expect(cameraOf(ROOT, HEROES.luke.camera)).toMatchObject({ arm: 2.25, a: -0.1, b: 0.45, c: -0.6 });
    expect(aiMeleeOf(ROOT)).toMatchObject({ damage: 75, speed: 150, life: 0.1 });
  });

  it('makes Luke’s row, every number with its source', () => {
    const row = saberRow(ROOT, 'luke');
    const bare = [];
    const walk = (v, path) => {
      if (Array.isArray(v) || !v || typeof v !== 'object') return;
      for (const [k, x] of Object.entries(v)) {
        if (typeof x === 'number' && !(`${k}_source` in v) && !('_source' in v)) bare.push(`${path}.${k}`);
        walk(x, `${path}.${k}`);
      }
    };
    walk(row, 'luke');
    expect(bare).toEqual([]);
  });
});
