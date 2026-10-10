import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readFileSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { atIdentity, atRest, makePack, resampleChannel } from './bf2017-clips.mjs';
import { clipOf, measure, rigOf } from './lib/bf2017-strokes.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WALRUS = join(HERE, '..', 'public', 'models', 'galaxy', 'bf2017', 'walrus.glb');

const reader = async () => {
  await MeshoptDecoder.ready;
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
};

// Reference → AITrajectory, and under Reference: Hips → Spine → RightArm →
// RightHand → Wep_Root, Hips → LeftToeBase and RightToeBase
function skeleton(doc) {
  const n = (name, t) => doc.createNode(name).setTranslation(t);
  const ref = n('Reference', [0, 0, 0]);
  const traj = n('AITrajectory', [0, 0, 0]);
  const hips = n('Hips', [0, 0.95, 0]);
  const spine = n('Spine', [0, 0.2, 0]);
  const arm = n('RightArm', [-0.2, 0.3, 0]);
  const hand = n('RightHand', [-0.25, 0, 0]);
  const wep = n('Wep_Root', [0, 0, 0]);
  const ik = n('IK_Joint_RightHand', [0, 0, 0]);
  const lt = n('LeftToeBase', [0.1, -0.93, 0.1]);
  const rt = n('RightToeBase', [-0.1, -0.93, 0.1]);
  ref.addChild(traj).addChild(hips);
  hips.addChild(spine).addChild(lt).addChild(rt);
  spine.addChild(arm);
  arm.addChild(hand);
  hand.addChild(wep).addChild(ik);
  doc.createScene('Walrus_HumanMale').addChild(ref);
  return { ref, traj, hips, spine, arm, hand };
}

// a clip of 10 frames at 30 a second: the arm swung round, the trajectory walked ahead
async function clipFile(file, name) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const { traj, arm, spine } = skeleton(doc);
  const acc = (type, a) => doc.createAccessor().setType(type).setArray(new Float32Array(a)).setBuffer(buffer);
  const times = Array.from({ length: 10 }, (_, i) => i / 30);
  const anim = doc.createAnimation(name).setExtras({ fps: 30, loop: false });
  const add = (node, path, type, values) => {
    const s = doc.createAnimationSampler().setInput(acc('SCALAR', times)).setOutput(acc(type, values)).setInterpolation('LINEAR');
    anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(s));
  };
  add(arm, 'rotation', 'VEC4', times.flatMap((_, i) => [Math.sin(i * 0.15), 0, 0, Math.cos(i * 0.15)]));
  add(traj, 'translation', 'VEC3', times.flatMap((_, i) => [0, 0, i * 0.05]));
  // (the spine holds its rest all through: nothing to send)
  add(spine, 'rotation', 'VEC4', times.flatMap(() => [0, 0, 0, 1]));
  await mkdir(join(file, '..'), { recursive: true });
  await writeFile(file, await new NodeIO().writeBinary(doc));
}

describe('a pack of the game’s clips', () => {
  it('resamples a channel to another rate, the end kept, a constant one as two keys', () => {
    const r = resampleChannel([0, 0.5, 1], [0, 0, 0, 1, 0, 0, 2, 0, 0], 3, 4, 1);
    expect(r.times).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(r.values.filter((_, i) => i % 3 === 0)).toEqual([0, 0.5, 1, 1.5, 2]);
    expect(resampleChannel([0, 1], [1, 2, 3, 1, 2, 3], 3, 24, 1).times).toEqual([0, 1]);
    // (an end between two frames is still the last key: 0.43 s at 24 a second)
    const odd = resampleChannel([0, 0.43], [0, 0, 0, 1, 0, 0], 3, 24, 0.43);
    expect(odd.times.at(-1)).toBeCloseTo(0.43, 9);
    expect(odd.values.slice(-3)).toEqual([1, 0, 0]);
  });

  it('knows an additive channel that adds nothing (the identity turn, no move)', () => {
    expect(atIdentity('rotation', [0, 0, 0, 1, 0, 0, 0, -1])).toBe(true);
    expect(atIdentity('rotation', [0, 0, 0, 1, 0.1, 0, 0, 0.995])).toBe(false);
    expect(atIdentity('translation', [0, 0, 0, 0, 0, 0])).toBe(true);
    expect(atIdentity('translation', [0, 0.01, 0])).toBe(false);
  });
  it('knows a channel that only holds its rest (a turn or its negation)', () => {
    const node = new Document().createNode('x').setRotation([0, 0, 0, 1]);
    expect(atRest(node, 'rotation', [0, 0, 0, 1, 0, 0, 0, -1])).toBe(true);
    expect(atRest(node, 'rotation', [0, 0, 0, 1, 0.1, 0, 0, 0.99])).toBe(false);
  });

  it('packs the named clips under the site’s names, at 24 fps, with contact and root, meshopt-compressed', async () => {
    const root = await mkdtemp(join(tmpdir(), 'bf2017-clips-'));
    const out = join(root, 'out');
    const rows = [
      ['A_Luke_AttackLoop_Strike1', 'anims/walrus_humanmale/a_luke_attackloop_strike1.glb'],
      ['L_Luke_Stand_Idle_01', 'anims/walrus_humanmale/l_luke_stand_idle_01.glb'],
    ];
    for (const [name, file] of rows) await clipFile(join(root, 'web', file), name);
    await writeFile(join(root, 'web', 'anims.jsonl'), rows.map(([name, file]) => JSON.stringify({ name, file, fps: 30, frames: 10, additive: false, skeleton: 'Characters/Rigs/Humanoids/Walrus_HumanMale' })).join('\n'));
    const sk = new Document();
    sk.createBuffer();
    skeleton(sk);
    const skFile = join(root, 'walrus.glb');
    await writeFile(skFile, await new NodeIO().writeBinary(sk));

    const r = await makePack('luke', { only: ['sword.light.a', 'idle'], out, root, skeleton: skFile, log: () => {} });
    expect(r.none).toEqual([]);
    const file = join(out, 'clips-luke.glb');
    expect((await stat(file)).size).toBeLessThan(20 * 1024);
    const doc = await (await reader()).read(file);
    expect(doc.getRoot().listExtensionsUsed().map((e) => e.extensionName)).toContain('EXT_meshopt_compression');
    const anims = doc.getRoot().listAnimations();
    expect(anims.map((a) => a.getName()).sort()).toEqual(['idle', 'sword.light.a']);
    const strike = anims.find((a) => a.getName() === 'sword.light.a');
    const channels = strike.listChannels();
    // (the arm's, at 24 a second over 0.3 s; the trajectory's and the resting spine's gone)
    expect(channels.map((c) => c.getTargetNode().getName())).toEqual(['RightArm']);
    const t = channels[0].getSampler().getInput().getArray();
    expect(t.length).toBe(Math.ceil(0.3 * 24) + 1);
    expect(t[t.length - 1]).toBeCloseTo(0.3, 6);
    const { contact, root: travel, rootHips, source } = strike.getExtras();
    expect(source).toBe('A_Luke_AttackLoop_Strike1');
    expect(contact[0]).toBeGreaterThanOrEqual(0);
    expect(contact[1]).toBeGreaterThan(contact[0]);
    expect(contact[1]).toBeLessThanOrEqual(0.3);
    expect(rootHips).toBeGreaterThan(0);
    expect(travel.at(-1)[2]).toBeCloseTo(0.45, 2);
  });
});

describe('a stroke’s window in the pack', () => {
  // (Luke's first strike, the socket's chain only: the stroke tables' measure
  // lands where the blade crosses the front, as lib/bf2017-strokes.test.mjs
  // has it; ual-bake's rule over the pack's own tip landed on the snap out of
  // the guard, [0.05, 0.101])
  it('is the stroke tables’ own, past the snap out of the guard', async () => {
    const root = await mkdtemp(join(tmpdir(), 'bf2017-clips-'));
    const file = 'anims/walrus_humanmale/a_luke_attackloop_strike1.glb';
    await mkdir(join(root, 'web', 'anims', 'walrus_humanmale'), { recursive: true });
    await copyFile(join(HERE, 'fixtures', 'bf2017', 'web', file), join(root, 'web', file));
    await writeFile(join(root, 'web', 'anims.jsonl'), JSON.stringify({ name: 'A_Luke_AttackLoop_Strike1', file, fps: 24, frames: 39, additive: false, skeleton: 'Characters/Rigs/Humanoids/Walrus_HumanMale' }));
    const r = await makePack('luke', { only: ['sword.light.a'], out: join(root, 'out'), root, skeleton: WALRUS, log: () => {} });
    const strike = (await (await reader()).read(r.file)).getRoot().listAnimations().find((a) => a.getName() === 'sword.light.a');
    const game = await new NodeIO().readBinary(new Uint8Array(readFileSync(join(root, 'web', file))));
    expect(strike.getExtras().contact).toEqual(measure(clipOf(game.getRoot().listAnimations()[0]), rigOf(game)).contact);
    expect(strike.getExtras().contact).toEqual([0.107, 0.293]);
  });

  it('in the committed pack, is its hero’s table’s to a frame', async () => {
    const table = JSON.parse(readFileSync(join(HERE, '..', 'src', 'data', 'bf2017', 'strokes', 'luke.json'), 'utf8'));
    const windows = new Map([...table.strikes, table.dash, table.jump].filter((s) => s?.contact).map((s) => [s.name, s.contact]));
    const pack = await (await reader()).read(join(HERE, '..', 'public', 'models', 'galaxy', 'bf2017', 'clips-luke.glb'));
    const timed = pack.getRoot().listAnimations().filter((a) => windows.has(a.getExtras()?.source));
    expect(timed.length).toBeGreaterThanOrEqual(12);
    for (const a of timed) {
      const { source, contact, fps } = a.getExtras();
      for (const k of [0, 1]) expect(Math.abs(contact[k] - windows.get(source)[k]), `${a.getName()} (${source})`).toBeLessThanOrEqual(1 / fps);
    }
  });
});

describe('an own rig’s pack', () => {
  it('takes clips from that rig’s skeleton alone, and its skeleton from the body', async () => {
    const { skeletonFileFor, skeletonsFor } = await import('./bf2017-clips.mjs');
    expect(skeletonsFor('b1').test('Characters/Rigs/Droids/D_Assault_Preq_01_Ske')).toBe(true);
    expect(skeletonsFor('b1').test('Characters/Rigs/Humanoids/Walrus_HumanMale')).toBe(false);
    expect(skeletonsFor('humanoid').test('Characters/Rigs/Humanoids/Walrus_HumanMale')).toBe(true);
    expect(skeletonFileFor('b1', '/r')).toBe('/r/public/models/galaxy/bf2017/crew/battledroid.lod1.glb');
    expect(skeletonFileFor('luke', '/r')).toBe('/r/public/models/galaxy/bf2017/walrus.glb');
  });
});

describe('the clips’ census', () => {
  const e = (name, skeleton, extra = {}) => [name, { name, skeleton, ...extra }];
  const anims = new Map([
    e('A_Luke_AttackLoop_Strike1', 'Characters/Rigs/Humanoids/Walrus_HumanMale'),
    e('P_Stand_Idle_01', 'Characters/Rigs/Humanoids/Walrus_HumanMale'),
    e('A_TauntaunRider_Walk_01', 'Characters/Rigs/Humanoids/Walrus_HumanMale'),
    e('C_Dewback_Walk_Fwd_01', 'Characters/NPC/Creatures/Dewback/Dewback_01_Ske'),
    e('A_Yoda_Defeated_01', 'Characters/Hero/Yoda/Yoda_01_Ske'),
    e('ATAT_Destruction_01_Leftover_Body_Anim01', 'X/ATAT_Destruction_01_Leftover_Body_Ske'),
    e('BB8_Roll_01', 'Characters/Droids/BB8/BB8_Ske'),
    e('C_Sneep_Walk_01', 'Characters/NPC/Creatures/Sneep/Sneep_01_Ske'),
  ]);
  it('names a clip’s family by its first part', async () => {
    const { familyOf } = await import('./lib/bf2017-clip-census.mjs');
    expect(familyOf('A_Luke_AttackLoop_Strike1')).toBe('A');
    expect(familyOf('P_Stand_Idle_01')).toBe('P');
    expect(familyOf('Cover_Left_Medium_FirePeek')).toBe('Cover');
  });
  it('marks the cast left’s rigs owned and the sequel’s excluded', async () => {
    const { ownerOf } = await import('./lib/bf2017-clip-census.mjs');
    expect(ownerOf(anims.get('C_Dewback_Walk_Fwd_01'))).toEqual({ state: 'owned', by: 'B' });
    expect(ownerOf(anims.get('A_TauntaunRider_Walk_01'))).toEqual({ state: 'owned', by: 'B' });
    expect(ownerOf(anims.get('A_Yoda_Defeated_01'))).toEqual({ state: 'owned', by: 'Y' });
    expect(ownerOf(anims.get('ATAT_Destruction_01_Leftover_Body_Anim01'))).toEqual({ state: 'owned', by: 'W' });
    expect(ownerOf(anims.get('BB8_Roll_01')).state).toBe('excluded');
    expect(ownerOf(anims.get('C_Sneep_Walk_01'))).toBe(null);
  });
  it('counts by skeleton and by the humanoid’s family, a used clip used', async () => {
    const { censusRows } = await import('./lib/bf2017-clip-census.mjs');
    const rows = censusRows(anims, new Set(['A_Luke_AttackLoop_Strike1']));
    expect(rows.totals).toEqual({ used: 1, owned: 4, excluded: 1, unowned: 2 });
    expect(rows.byFamily.A).toEqual({ used: 1, owned: 1, excluded: 0, unowned: 0 });
    expect(rows.bySkeleton.Sneep_01_Ske.unowned).toBe(1);
  });
  it('reads the used clips off the site’s sets, the first spelling the drop has on the right skeleton', async () => {
    const { usedSources } = await import('./bf2017-clips.mjs');
    const used = usedSources(new Map([e('L_Luke_Stand_Unarmed_Idle_01', 'Characters/Rigs/Humanoids/Walrus_HumanMale'), e('C_ATAT_Stand_Idle', 'Gameplay/Vehicles/Ground/AT-AT/ATAT_Ske')]));
    expect(used.has('L_Luke_Stand_Unarmed_Idle_01')).toBe(true);
    expect(used.has('C_ATAT_Stand_Idle')).toBe(true);
  });
});
