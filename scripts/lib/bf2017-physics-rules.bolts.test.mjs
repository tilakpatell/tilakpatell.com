// Lane P2's builders in bf2017-physics-rules.mjs, against cuts of the export
// under scripts/fixtures/bf2017/data (lane P1 tests its soldier beside this).
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BONE_SET_ROOTS, boneSetRow, checkSources, loadAsset, physicsRulebooks, projectileRow, projectileRulebook, ragdollRow, refused, shareBodies } from './bf2017-physics-rules.mjs';

const ROOT = fileURLToPath(new URL('../fixtures/bf2017', import.meta.url));
const STUN = 'Gameplay/Equipment/Shared/Projectiles/BlasterProjectile_Pistol_Sidearm_StunAltFire';
const IMPACT = 'Gameplay/Equipment/Grenades/Impact/Impact_Projectile';
const RIFLE = 'Gameplay/Equipment/Shared/Projectiles/BlasterProjectile_BlasterRifle_A295';

describe('the projectile rulebook', () => {
  it('reads the stun shot as a missile with its blast', () => {
    const r = projectileRow(loadAsset(ROOT, STUN));
    expect(r.kind).toBe('missile');
    expect(r.speed).toBe(8000);
    expect(r.maxSpeed).toBe(1000);
    expect(r.gravity).toBe(0);
    expect(r.ttl).toBe(3);
    expect(r.impactImpulse).toBe(50);
    expect(r.blast).toMatchObject({ inner: 1, radius: 2, impulse: 500, shockRadius: 5, shockImpulse: 500, occlusionRadius: 0.5, occlusion: true });
    expect(r.body.mass).toBe(1);
    expect(r.detonate).toMatchObject({ onCollision: true, onTimeout: true, nearTarget: null });
    expect(r._source).toBe(STUN);
    expect(r.speed_source).toBe('#WSMissileEntityData.InitialSpeed');
    expect(checkSources(r)).toEqual([]);
  });

  it('reads the impact grenade: falling, bouncing, its blast; no body in its record', () => {
    const r = projectileRow(loadAsset(ROOT, IMPACT));
    expect(r.kind).toBe('grenade');
    expect(r.gravity).toBe(-9.8);
    expect(r.ttl).toBe(20);
    expect(r.bounce.speedMultiplier).toBe(0.25);
    expect(r.blast).toMatchObject({ inner: 1, radius: 5, impulse: 1000, damage: 120, shockRadius: 5.1, shockImpulse: 200 });
    // (the grenade's blueprint carries no RigidBodyData: its mass is the world's, NOTES.md)
    expect(r.body).toBe(null);
    expect(checkSources(r)).toEqual([]);
  });

  it('reads a rifle’s bolt from its container', () => {
    const r = projectileRow(loadAsset(ROOT, RIFLE));
    expect(r).toMatchObject({ id: 'blasterprojectile_blasterrifle_a295', kind: 'bolt', speed: 350, gravity: 0, ttl: 3, damage: 33, blast: null });
    expect(r.falloff).toMatchObject({ end: 19, from: 20, to: 40 });
    expect(r.detonate.onCollision).toBe(true);
    expect(checkSources(r)).toEqual([]);
  });

  it('walks a root for every projectile and refuses the sequel era', () => {
    const book = projectileRulebook(ROOT);
    expect(book.rows.map((r) => r.id).sort()).toEqual(['blasterprojectile_blasterrifle_a295', 'blasterprojectile_pistol_sidearm_stunaltfire', 'impact_projectile']);
    expect(refused('Gameplay/Kits/Hero/KyloRen/Projectile_X')).toBe(true);
    expect(refused('Gameplay/Teams/MP/NewEra/Team_Light_NewEra_JA')).toBe(true);
    expect(refused(IMPACT)).toBe(false);
  });

  it('is null for what is not a projectile', () => {
    expect(projectileRow(loadAsset(ROOT, 'Gameplay/Characters/DefaultSoldierBoneCollision'))).toBe(null);
    expect(loadAsset(ROOT, 'Gameplay/Nothing/Here')).toBe(null);
  });
});

describe('the bone capsules', () => {
  const set = boneSetRow(loadAsset(ROOT, 'Gameplay/Characters/DefaultSoldierBoneCollision'));

  it('reads the head capsule', () => {
    const head = set.bones.find((b) => b.bone === 'Head' && b.hiLod);
    expect(head).toMatchObject({ radius: 0.16, length: 0.045, axis: 0, axisName: 'x', reaction: 'HRT_Head', offset: [-0.01, 0.01, 0] });
    expect(set.skeleton).toBe('Characters/Rigs/Humanoids/Walrus_HumanMale');
  });

  it('has fewer low-LOD capsules than hi', () => {
    expect(set.bones.filter((b) => b.lowLod).length).toBeLessThan(set.bones.filter((b) => b.hiLod).length);
    expect(set.aimAssist.length).toBeGreaterThan(0);
  });

  it('sources every number', () => {
    expect(checkSources(set)).toEqual([]);
  });

  // (the tauntaun's set sits beside its own records, not under Gameplay/Characters/)
  it('reads a creature’s set from its own folder', () => {
    const tauntaun = boneSetRow(loadAsset(ROOT, 'Characters/NPC/Creatures/Tauntaun/Tauntaun_01/TauntaunBoneCollision'));
    expect(tauntaun.skeleton).toBe('Characters/NPC/Creatures/Tauntaun/Tauntaun_01/Tauntaun_01_Ske');
    expect(tauntaun.bones.map((b) => b.bone)).toEqual(['Spine', 'Neck1', 'Head', 'LeftLeg', 'RightLeg', 'LeftForeArm', 'RightForeArm', 'Tail2']);
    expect(checkSources(tauntaun)).toEqual([]);
  });

  it('gathers the sets from every folder the game keeps them in', () => {
    const { bones } = physicsRulebooks(ROOT);
    expect(bones.sets.map((s) => s.id)).toEqual(expect.arrayContaining(['defaultsoldierbonecollision', 'tauntaunbonecollision']));
    expect(BONE_SET_ROOTS).toContain('Characters/');
  });
});

describe('the ragdoll', () => {
  const row = ragdollRow(loadAsset(ROOT, 'Gameplay/Characters/StormTrooperShared'), (n) => loadAsset(ROOT, n));

  it('reads fifteen bodies and the impulse cap', () => {
    expect(row.bodies).toHaveLength(15);
    expect(row.maxImpulse).toBe(1000);
    expect(row.impulseLifetime).toBe(10);
    expect(row.dismemberment.enabled).toBe(false);
  });

  it('names each body’s bone, parent, mass and capsule from the ragdoll blueprint', () => {
    const by = Object.fromEntries(row.bodies.map((b) => [b.bone, b]));
    expect(by.Hips).toMatchObject({ index: 1, parent: null, mass: 20 });
    expect(by.Spine).toMatchObject({ parent: 'Hips', mass: 22 });
    expect(by.Head.parent).toBe('Spine');
    expect(by.Head.mass).toBeCloseTo(7, 4);
    expect(by.LeftForeArm.parent).toBe('LeftArm');
    expect(by.RightFoot.parent).toBe('RightLeg');
    expect(by.LeftUpLeg.radius).toBeCloseTo(0.079, 3);
    expect(by.LeftUpLeg.length).toBeCloseTo(0.34, 2);
    expect(by.Head.rest[1]).toBeCloseTo(1.634, 3);
    expect(by.LeftArm.limits.cone).toBeCloseTo(43.1, 1);
    const total = row.bodies.reduce((s, b) => s + b.mass, 0);
    expect(total).toBeGreaterThan(80);
    expect(checkSources(row)).toEqual([]);
  });

  it('shares a later row’s bodies with an earlier identical one', () => {
    const a = { id: 'a', bodies: [{ bone: 'Hips', mass: 20, mass_source: '#x' }] };
    const b = { id: 'b', bodies: [{ bone: 'Hips', mass: 20, mass_source: '#y' }] };
    const c = { id: 'c', bodies: [{ bone: 'Hips', mass: 21, mass_source: '#y' }] };
    shareBodies([a, b, c]);
    expect(a.bodies).toHaveLength(1);
    expect(b).toEqual({ id: 'b', bodiesOf: 'a' });
    expect(c.bodies).toHaveLength(1);
  });

  it('without the blueprint still names the bodies', () => {
    const bare = ragdollRow(loadAsset(ROOT, 'Gameplay/Characters/StormTrooperShared'));
    expect(bare.bodies.map((b) => b.bone)).toContain('RightHand');
    expect(bare.bodies[0].mass).toBeUndefined();
  });
});
