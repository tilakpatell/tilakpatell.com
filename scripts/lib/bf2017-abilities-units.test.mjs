import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fieldHash } from './bf2017-abilities.mjs';
import { UNIT_KIND, affectorRow, docsOf, effectOf } from './bf2017-abilities-units.mjs';

// a root of hand-made records shaped as the export writes them (data/<name>.json, data.tsv)
function rootOf(records) {
  const dir = mkdtempSync(join(tmpdir(), 'bf2017-units-'));
  const rows = [];
  for (const [name, doc] of Object.entries(records)) {
    const file = join(dir, 'data', `${name}.json`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ name, type: doc.objects[0].$type, root: 0, ...doc }));
    rows.push(`${name}\t${doc.objects[0].$type}\tdata/${name}.json\t1`);
  }
  writeFileSync(join(dir, 'data.tsv'), `${rows.join('\n')}\n`);
  return dir;
}

const TL = fieldHash('TargetList');
const records = {
  'Gameplay/Kits/Hero/Test/Ability_Test_Push': { objects: [{ $type: 'CharacterStatePlayerAbilityAsset', Identifier: 7, Blueprint: { $asset: 'Gameplay/Kits/Hero/Test/PF_Push_Test' }, Name: 'Gameplay/Kits/Hero/Test/Ability_Test_Push' }] },
  'Gameplay/Kits/Hero/Test/PF_Push_Test': {
    objects: [
      {
        $type: 'LogicPrefabBlueprint',
        PropertyConnections: [
          { Source: { $ref: 1 }, Target: { $ref: 3 }, SourceFieldId: 1, TargetFieldId: TL },
          { Source: { $ref: 2 }, Target: { $ref: 4 }, SourceFieldId: 1, TargetFieldId: TL },
        ],
      },
      { $type: 'InterfaceDescriptorData' },
      { $type: 'SphereQueryEntityData', Radius: 10, FilteredTypes: 'QueryEntityFilter_Characters' },
      { $type: 'AffectorApplyEntityData', Affector: { $asset: 'Gameplay/Test/Affector_Test_DMGRed' }, Duration: 3, Rank: 0 },
      { $type: 'AffectorApplyEntityData', Affector: { $asset: 'Gameplay/Test/Affector_Damage_Test' }, Duration: 1, Rank: 1 },
    ],
  },
  'Gameplay/Test/Affector_Test_DMGRed': { objects: [{ $type: 'DamageMultiplierAffectorAsset', RankData: [{ DamageMultiplier: 0.92 }, { DamageMultiplier: 0.9 }], DescriptorIds: [1], StackingPolicy: 'AffectorStackingPolicy_ReplaceOld' }] },
  'Gameplay/Test/Affector_Damage_Test': { objects: [{ $type: 'DamageAffectorAsset', RankData: [{ InitialDamage: 90, DamageToDealPerSecond: 0, DamageInterval: 0.5 }, { InitialDamage: 150, DamageToDealPerSecond: 0, DamageInterval: 0.5 }] }] },
};

describe('the unit abilities read from their records', () => {
  const root = rootOf(records);

  it('follows an ability to its prefab', () => {
    expect(docsOf(root, 'Gameplay/Kits/Hero/Test/Ability_Test_Push').map((d) => d.name)).toEqual(['Gameplay/Kits/Hero/Test/Ability_Test_Push', 'Gameplay/Kits/Hero/Test/PF_Push_Test']);
  });

  it('says whom each affector lands on: the user through the interface, else the query', () => {
    const fx = effectOf(root, 'Gameplay/Kits/Hero/Test/Ability_Test_Push', 7);
    expect(fx.spheres).toMatchObject([{ radius: 10, types: 'Characters' }]);
    expect(fx.applies.map((a) => [a.affector.split('/').pop(), a.to, a.duration, a.rank])).toEqual([
      ['Affector_Test_DMGRed', 'self', 3, 0],
      ['Affector_Damage_Test', 'targets', 1, 1],
    ]);
    expect(fx.applies[0]._source).toMatch(/PF_Push_Test#AffectorApplyEntityData\.Duration$/);
  });

  it('reads an affector by rank', () => {
    expect(affectorRow(root, 'Gameplay/Test/Affector_Test_DMGRed')).toMatchObject({ type: 'DamageMultiplierAffectorAsset', stacking: 'ReplaceOld', ranks: [{ multiplier: 0.92 }, { multiplier: 0.9 }] });
    expect(affectorRow(root, 'Gameplay/Test/Affector_Damage_Test').ranks[1]).toEqual({ damage: 150, perSecond: 0, interval: 0.5 });
    expect(affectorRow(root, 'Gameplay/Test/None')).toBeNull();
  });

  it('names a kind for each of Hoth’s hero and reinforcement abilities', () => {
    for (const k of Object.values(UNIT_KIND)) expect(['push', 'repulse', 'rush', 'grenade', 'weapon', 'bubble', 'slam', 'sharpShot', 'pulse', 'barrier', 'pull', 'scan', 'throw', 'buff', 'choke', 'chain', 'aura', 'weaken', 'jumpPack']).toContain(k);
  });
});
