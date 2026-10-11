import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { patternBits, aiCreatures, aiNames, aiRulebook, aiSquadron } from './bf2017-rulebook-ai.mjs';
import { checkSources } from './bf2017-rulebook.mjs';

const ROOT = join(import.meta.dirname, '..', 'fixtures', 'bf2017', 'data');

describe('the AI rulebook', () => {
  const ai = aiRulebook(ROOT);
  const names = aiNames(ROOT);
  const creatures = aiCreatures(ROOT);

  it('reads a tactics table', () => {
    const t = ai.tactics.AIRebelSoldierTactics;
    expect(t.engage).toMatchObject({ distance: 40, suppression: 0.15 });
    expect(t.suppression).toMatchObject({ value: 0.75, time: 10, area: 5 });
    expect(t.vehicleSuppression).toMatchObject({
      distance: 15,
      reevaluate: 15,
    });
    expect(Object.keys(t.attack).length).toBeGreaterThan(1);
    expect(t.queries).toMatchObject({ 'attack.goalCoverQuery': 'Attack_Rebel_Soldier', 'flee.coverQuery': 'Flee', 'hide.coverQuery': 'Hide' });
  });

  it('reads a soldier template', () => {
    expect(ai.templates.rifleman).toMatchObject({
      targetLostTime: 10,
      alertPropagationSpeed: 2,
      fireHeightOffset: 0,
      tactics: 'Rifleman_Tactics',
    });
  });

  it('reads the cover constants', () => {
    expect(ai.cover.constants).toMatchObject({
      SlotSpacing: 2.2,
      CrouchHeight: 0.94,
      StandHeight: 1.7,
      'VaultOverPathLinkConfig.VaultStartDistance': 1.4,
    });
  });

  it('reads the firing patterns as 64-bit masks', () => {
    // (290482175965396993 is odd: a JSON number rounds it to …397000, so the
    // patterns are read from the record's text)
    expect(ai.patterns).toHaveLength(202);
    expect(ai.patterns.every((p) => /^-?\d+$/.test(p.mask))).toBe(true);
    expect(ai.patterns[0]).toMatchObject({
      id: 1,
      delay: 24,
      weapon: 'AssaultRifle',
      intensity: 'Low',
      single: true,
    });
    expect(ai.patterns[0].bits[0]).toBe(true);
    expect(patternBits('5')).toEqual([true, false, true]);
    expect(patternBits('0')).toEqual([]);
    expect(patternBits('-1')).toHaveLength(64);
  });

  it('reads the AI system: the target scores, the squad’s engagement, the shooting', () => {
    const t = ai.system.targeting;
    expect(t).toMatchObject({
      humanPreferenceScale: 2.5,
      targetVisibleDistScale: 0.5,
      currentTargetDistScale: 0.8,
      lowHealthPercentage: 0.25,
      visibleTargetLimit: 1,
      elevationAboveThreshold: 2,
      enableTargetCoordinator: true,
    });
    expect(t._source).toBe('AI/BattleAI/System/AISystem#TargetingData');
    expect(t.targetDistanceEvaluation).toEqual({
      points: [
        [0, 10],
        [500, 0],
      ],
      min: 0,
      max: 500,
    });
    expect(t.suppressionScore).toMatchObject({ front: 0.5, back: 0.7 });
    expect(ai.system.squadEngageData).toMatchObject({
      engageTime: 7.5,
      findCoverTime: 4,
      cooldownTime: 4,
      secondaryTargetRadius: 12,
      coverFireTargetRadius: 40,
    });
    expect(ai.system.shooting).toMatchObject({
      keepFiringAtPlayerTime: 4,
      keepFiringAtAITime: 2,
    });
    expect(ai.system.areaBookingSettings.enemyTeamBookingRadius).toBe(2.5);
    expect(ai.system.preferredRange).toMatchObject({
      start: 10,
      ideal: 0.5,
      end: 30,
    });
    expect(ai.systemPvE.targeting.humanPreferenceScale).toBe(1);
  });

  it('reads a cover query’s selection, its scores’ curves and weights, and its score asset', () => {
    const q = ai.coverQueries.Hide_CoverQuery;
    expect(q).toMatchObject({
      radius: 10,
      centre: 'ActorPosition',
      defendArea: true,
      common: 'CommonScores_AvoidCoverNearEnemies',
    });
    expect(q.scores).toHaveLength(11);
    const path = q.scores.find((s) => s.type === 'PathDistance');
    expect(path).toMatchObject({
      ref: 'Soldier',
      scale: 1,
      maxY: 3,
      maxSearchDistance: 100,
      curve: {
        points: [
          [0, 3],
          [10, 0],
        ],
        min: 0,
        max: 10,
      },
    });
    // (a score whose curve lives in the score asset, by its guid)
    const near = q.scores.find((s) => s.type === 'DistanceToMultiTargets');
    expect(near).toMatchObject({
      maxDistanceToTarget: 5,
      curve: {
        points: [
          [5, -1],
          [5, 0],
        ],
        min: 0,
        max: 6,
      },
    });
    expect(q.validators).toHaveLength(5);
    expect(q.validators[0]).toMatchObject({
      minTimeToInvalidate: 0.1,
      score: { type: 'AngleToActor' },
    });
    expect(ai.coverScores.CommonScores_AvoidCoverNearEnemies.scores.map((s) => s.type)).toEqual(['DistanceToMultiTargets', 'DistanceToClosestEnemyCover']);
  });

  it('reads the difficulties: their curves with their range, their aim, reaction and damage', () => {
    const rookie = ai.difficulties['multiplayer:rookie'];
    const expert = ai.difficulties['multiplayer:expert'];
    expect(rookie.targeting.firingDelayAfterAquiringTarget).toEqual({
      points: [
        [5, 0.54],
        [100, 2.88],
      ],
      min: 5,
      max: 100,
    });
    expect(expert.targeting.firingDelayAfterAquiringTarget.points[0]).toEqual([5, 0.15]);
    expect(rookie.targeting.accuracyPenaltySettings).toMatchObject({
      sprintMultiplier: 3,
      crouchMultiplier: 2.55,
    });
    expect(expert.targeting.accuracyPenaltySettings.sprintMultiplier).toBe(1.4);
    expect(rookie.bucketDamageAiVsHuman.damageMultiplier).toBe(0.75);
    expect(rookie).toMatchObject({
      difficulty: 'Easy',
      gameType: 'Multiplayer',
      name: 'Rookie',
    });
    expect(rookie._source).toMatch(/^Gameplay\/Settings\/GameDifficultySettings#DifficultyData/);
  });

  it('reads the bots’ names, a faction’s list per mode, the localised ones through the strings', () => {
    expect(names.empire.spaceBattles.names).toHaveLength(20);
    expect(names.empire.spaceBattles.names[0]).toBe('TK-772');
    expect(names.empire.skirmish.names).toContain('TK-118');
    expect(names.empire.skirmish.names.every((n) => /^TK-\d+$/.test(n))).toBe(true);
  });

  it('reads a creature’s settings, its reaction to a player, and the actor that wears them', () => {
    const jawa = creatures.settings.CLS_Jawa;
    expect(jawa.events.HumanPlayer).toMatchObject({
      range: 4,
      probability: 1,
      action: 'Act',
      alignment: 'None',
      cooldown: 4,
      stopDelay: 0,
      alignmentRate: 0.1,
    });
    expect(jawa.speeds.slow.max).toBeGreaterThan(0);
    expect(creatures.actors.Actor_Jawa_01).toMatchObject({
      settings: 'CLS_Jawa',
    });
  });

  it('reads the walkers’ gunner rows', () => {
    expect(ai.vehicles.ATAT_AI).toMatchObject({
      class: 'WeaponClass_AssaultRifle',
      WeaponRange: 1500,
    });
  });

  it('reads a squadron behaviour tree: its typed nodes, their numbers, their children in the record’s order, its weapon rules', () => {
    const sq = aiSquadron(ROOT);
    const t = sq.trees.PF_DogfightBehaviour;
    const root = t.nodes[t.root];
    expect(root.kind).toBe('Selector');
    expect(root.children.map((c) => t.nodes[c].kind)).toEqual(['ProximateAreas', 'EscapeAreas', 'DogfightingEvade', 'DogfightingAttack', 'FollowWaypoints', 'DogfightingFlyForward']);
    const attack = Object.values(t.nodes).find((n) => n.kind === 'DogfightingAttack');
    expect(attack).toMatchObject({ minDistanceForAttack: 100, maxDistanceForAttack: 500, projectileSpeed: 2000 });
    const random = Object.values(t.nodes).find((n) => n.kind === 'Random');
    expect(random.weights).toHaveLength(random.children.length);
    expect(t.rules.map((r) => r.kind).sort()).toEqual(['CannonWeaponRule', 'MissileWeaponRule']);
    expect(t.rules.find((r) => r.kind === 'CannonWeaponRule')).toMatchObject({ maxContinuousFireTime: 2, minTimeBetweenContinuousFire: 1.5 });
    expect(t.rules.find((r) => r.kind === 'MissileWeaponRule').lockOnDelayTime).toBe(3);
    expect(sq.channels).toContain('FollowPath_AIChannel');
    expect(checkSources(sq)).toEqual([]);
  });

  it('names every number’s source', () => {
    expect(checkSources(ai)).toEqual([]);
    expect(checkSources(names)).toEqual([]);
    expect(checkSources(creatures)).toEqual([]);
  });
});
