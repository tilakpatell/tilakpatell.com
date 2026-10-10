import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { figureLoaderFor } from '../../components/galaxy/surface/crewList';
import { clearGLTFCache } from './gltfCache';
import { loadWalrusBody } from './walrus';
import { clipsFor, loadOwnRigBody, loadOwnRigFigure, ownPackUrl, paceOf, pickBase } from './ownRig';
import { RIG_SET } from './rigSets';

// a walker's body as the loader gets it: a skinned box on a two-bone leg,
// the game's names on its bones
function body({ root = 'Hips' } = {}) {
  const hips = new THREE.Bone();
  hips.name = root;
  const foot = new THREE.Bone();
  foot.name = 'LeftFrontFoot';
  foot.position.y = -1;
  hips.add(foot);
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const n = geo.attributes.position.count;
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4), 4));
  geo.setAttribute(
    'skinWeight',
    new THREE.Float32BufferAttribute(
      new Float32Array(n * 4).map((_, i) => (i % 4 ? 0 : 1)),
      4,
    ),
  );
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
  const scene = new THREE.Group();
  scene.add(hips, mesh);
  mesh.bind(new THREE.Skeleton([hips, foot]));
  return { scene, animations: [] };
}

// a pack: the AT-AT's clips by the game's names, one track on a bone the
// body hasn't (the pack's skeleton is the rig's whole, a body may be less)
function pack() {
  const clip = (name, extra = {}) => {
    const c = new THREE.AnimationClip(name, 2, [new THREE.VectorKeyframeTrack('Hips.position', [0, 2], [0, 0, 0, 0, 0.1, 0]), new THREE.QuaternionKeyframeTrack('Spine.quaternion', [0, 2], [0, 0, 0, 1, 0, 0, 0, 1])]);
    c.userData = { travel: 0, duration: 2, ...extra };
    return c;
  };
  const set = RIG_SET('atat');
  return {
    animations: [clip(set.idle), clip(set.walk, { travel: 4 }), clip(set['walk.back'], { travel: 4 }), clip(set.die), clip(set['die.cable'])],
  };
}

const opts = (more = {}) => ({
  rig: 'atat',
  packs: ['clips-atat.glb'],
  load: async () => body(more),
  loadPack: async () => pack(),
});

describe('a figure on a rig of its own', () => {
  it('keeps only the tracks for bones the body has', () => {
    const [c] = clipsFor(pack().animations, (b) => b === 'Hips');
    expect(c.tracks.map((t) => t.name)).toEqual(['Hips.position']);
    expect(c.userData.duration).toBe(2);
  });

  it('walks forward, walks back, stands', () => {
    const set = RIG_SET('atat');
    expect(pickBase({ speed: 1.2 }, 0, set)).toBe('walk');
    expect(pickBase({ speed: -0.5 }, 0, set)).toBe('walk.back');
    expect(pickBase({ speed: 0.01 }, 0, set)).toBe('idle');
    expect(pickBase(null, 0.6, set)).toBe('walk');
  });

  it('paces a walk to the ground it covers, so its feet stay planted', () => {
    const clip = { duration: 2, userData: { travel: 4, duration: 2 } };
    expect(paceOf(2, clip)).toBeCloseTo(1);
    expect(paceOf(1, clip)).toBeCloseTo(0.5);
    expect(paceOf(100, clip)).toBe(2);
    expect(paceOf(1, { duration: 1, userData: {} })).toBe(1);
  });

  it('refuses a body without the bone its row hangs it from, and says which', async () => {
    await expect(loadOwnRigFigure('atat.glb', opts({ root: 'Pelvis' }))).rejects.toThrow(/Hips/);
  });

  it('is a figure in crew.js’s shape, on its own rig', async () => {
    const fig = await loadOwnRigFigure('atat.glb', opts());
    for (const k of ['model', 'tall', 'anim', 'bones', 'play', 'stop', 'base', 'update', 'look', 'react', 'dispose']) expect(fig[k], k).toBeDefined();
    expect(fig.rig).toBe('own');
    expect(fig.bones.Hips.isBone).toBe(true);
    fig.update(0.1, 0, { speed: 2 });
    expect(fig.anim.mixer.existingAction(fig.anim.clips.find((c) => c.name === RIG_SET('atat').walk)).isRunning()).toBe(true);
    fig.dispose();
  });

  it('falls by the tow cable’s death when the cable brought it down, and stays down', async () => {
    const fig = await loadOwnRigFigure('atat.glb', opts());
    expect(fig.react('down', { cable: true })).toEqual({ clip: 'die.cable' });
    expect(fig.react('down', {})).toBeNull();
    expect(await fig.play('walk')).toBe(false);
    fig.dispose();
  });

  it('fires by the rig’s own shot where it has one, and says when it hasn’t', async () => {
    const atat = await loadOwnRigFigure('atat.glb', opts());
    expect(atat.react('fire', {})).toBe(false);
    atat.dispose();
    const droid = { ...opts(), rig: 'droideka', loadPack: async () => ({ animations: [new THREE.AnimationClip(RIG_SET('droideka').idle, 1, []), new THREE.AnimationClip(RIG_SET('droideka').fire, 0.6, [new THREE.VectorKeyframeTrack('Hips.position', [0, 0.6], [0, 0, 0, 0, 0.1, 0])])] }) };
    const fig = await loadOwnRigFigure('droideka.glb', droid);
    expect(fig.react('fire', {})).toBe(true);
    fig.dispose();
  });
});

// ── a crew kind's body on its own rig ──

// a droid's skeleton: Root → Pelvis → Spine → Head, and Pelvis → LeftLeg
function droidBody() {
  const scene = new THREE.Group();
  const bone = (name, parent) => {
    const b = Object.assign(new THREE.Bone(), { name });
    parent.add(b);
    return b;
  };
  const root = bone('Root', scene);
  const pelvis = bone('Pelvis', root);
  bone('Head', bone('Spine', pelvis));
  bone('LeftLeg', pelvis);
  return scene;
}
const q = (bone) => new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, [0, 1], [0, 0, 0, 1, 0, 0.1, 0, 0.995]);
const loaderOfFiles = (files) => ({ loadAsync: async (url) => files[url] ?? null });

afterEach(() => clearGLTFCache());

describe('a 2017 figure on a skeleton of its own', () => {
  const files = {
    '/b1.glb': { scene: droidBody(), animations: [] },
    [ownPackUrl('b1')]: { scene: new THREE.Group(), animations: [new THREE.AnimationClip('walk', 1, [q('Pelvis'), q('Tail')]), new THREE.AnimationClip('idle', 1, [q('Head')])] },
  };

  it('plays its rig’s pack, filtered to the bones it has, and finds its bones by the row’s names', async () => {
    const { clips, bones, model } = await loadOwnRigBody('/b1.glb', { rig: 'b1', bones: { hips: 'Pelvis' }, loader: loaderOfFiles(files) });
    expect(Object.keys(clips)).toEqual(expect.arrayContaining(['idle', 'walk']));
    expect(clips.walk.tracks.map((t) => t.name)).toContain('Pelvis.quaternion');
    expect(clips.walk.tracks.map((t) => t.name)).not.toContain('Tail.quaternion');
    expect(bones.hips.name).toBe('Pelvis');
    expect(bones.hips).toBe(model.getObjectByName('Pelvis'));
  });

  it('refuses a body without a bone its row names, naming it', async () => {
    await expect(loadOwnRigBody('/b1.glb', { rig: 'b1', bones: { hips: 'Hips' }, loader: loaderOfFiles(files) })).rejects.toThrow(/Hips/);
  });

  it('refuses a rig with no pack, and a statue', async () => {
    await expect(loadOwnRigBody('/b1.glb', { rig: 'nobody', loader: loaderOfFiles(files) })).rejects.toThrow(/no pack/);
    const statue = { '/rock.glb': { scene: new THREE.Group().add(new THREE.Mesh()), animations: [] }, [ownPackUrl('b1')]: files[ownPackUrl('b1')] };
    await expect(loadOwnRigBody('/rock.glb', { rig: 'b1', loader: loaderOfFiles(statue) })).rejects.toThrow(/no skeleton/);
  });

  it('refuses a rig whose pack isn’t there yet, so the kind is skipped, never a statue in its bind pose (Review Focus 5)', async () => {
    const body = { '/sneep.glb': { scene: droidBody(), animations: [] } };
    await expect(loadOwnRigBody('/sneep.glb', { rig: 'sneep', loader: loaderOfFiles(body) })).rejects.toThrow(/no clips/);
  });

  it('is handed the droids the walrus loader refuses: a row says which', async () => {
    // (the game's humanoid loader will not take a body without Wep_Root and the rest)
    await expect(loadWalrusBody('/b1.glb', { packs: [], loader: loaderOfFiles(files) })).rejects.toThrow(/not on the game's skeleton/);
    expect(figureLoaderFor({ rig: 'own' })).toBe('own');
    expect(figureLoaderFor({ rig: 'walrus' })).toBe('walrus');
  });
});
