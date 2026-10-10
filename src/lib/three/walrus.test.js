import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { clearGLTFCache } from './gltfCache';
import { clipsFor, cutFor, cutsToLoad, loadWalrusBody, loadWalrusPacks, packUrls, richClips, socketsOf, swapBody } from './walrus';
import { BODY, SOCKETS } from './walrusRig.js';

// a body by name: the game's (BODY and the sockets) or Meshy's
function body(names) {
  const root = new THREE.Group();
  let at = root;
  for (const n of names) {
    const b = new THREE.Bone();
    b.name = n;
    at.add(b);
    at = n === 'Hips' ? b : at;
  }
  return root;
}
const clip = (name, tracks, userData = {}) => Object.assign(new THREE.AnimationClip(name, 1, tracks), { userData });
const q = (bone, w = 1) => new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, [0, 1], [0, 0, 0, 1, 0, Math.sqrt(1 - w * w), 0, w]);
// a stand-in loader: a url → a glTF with these clips and that scene's extras
const loaderOf = (packs) => ({ loadAsync: async (url) => (packs[url] ? { scene: Object.assign(new THREE.Group(), { userData: packs[url].userData ?? {} }), animations: packs[url].animations } : null) });

afterEach(() => clearGLTFCache());

describe('a figure on the game’s skeleton', () => {
  it('plays only the tracks its bones take, and drops a clip with none left', () => {
    const b = body([...BODY, 'Wep_Root']);
    const set = clipsFor(b, new Map([
      ['idle', clip('idle', [q('Hips'), q('LeftArm_Phys_01')])],
      ['cape', clip('cape', [q('Cape_Phys_01')])],
    ]));
    expect(Object.keys(set)).toEqual(expect.arrayContaining(['idle']));
    expect(set.cape).toBeUndefined();
    expect(set.idle.tracks.map((t) => t.name)).toEqual(['Hips.quaternion']);
  });

  it('puts a bone another clip moves back to rest in a clip that leaves it alone', () => {
    const b = body(BODY);
    // (a rest of its own, so a track of identity would not pass for it)
    const arm0 = b.getObjectByName('LeftArm');
    arm0.quaternion.set(0.2, 0.1, 0, Math.sqrt(1 - 0.05));
    const set = clipsFor(b, new Map([
      ['walk', clip('walk', [q('Hips'), q('LeftArm', 0.8)])],
      ['idle', clip('idle', [q('Hips')])],
    ]));
    const arm = set.idle.tracks.find((t) => t.name === 'LeftArm.quaternion');
    expect(arm).toBeTruthy();
    for (const [i, v] of arm0.quaternion.toArray().entries()) expect(arm.values[i]).toBeCloseTo(v, 6);
  });

  it('names the fallback for a role the pack lacks, and keeps a clip’s extras', () => {
    const set = clipsFor(body(BODY), new Map([['hit.chest', clip('hit.chest', [q('Spine')], { root: [[0, 0, 0]] })]]));
    expect(set['hit.head'].tracks).toEqual(set['hit.chest'].tracks);
    expect(set['hit.head'].userData.root).toEqual([[0, 0, 0]]);
    expect(set['hit.chest'].userData.root).toEqual([[0, 0, 0]]);
  });

  it('gives a fallback its own clip, so playing it never stops the one it stands in for', () => {
    const b = body(BODY);
    const set = clipsFor(b, new Map([['idle', clip('idle', [q('Hips')])]]));
    expect(set.roll).not.toBe(set.idle);
    expect(set.roll.name).toBe('roll');
    // (the mixer keeps one action a clip: shared, a dodge would stop the idle)
    const mixer = new THREE.AnimationMixer(b);
    expect(mixer.clipAction(set.roll)).not.toBe(mixer.clipAction(set.idle));
  });

  it('finds the sockets by the game’s names', () => {
    const s = socketsOf(body([...BODY, ...Object.values(SOCKETS)]));
    expect(s.weapon.name).toBe('Wep_Root');
    expect(s.handL.name).toBe('IK_Joint_LeftHand');
  });

  it('merges packs, a later one’s clip over an earlier one’s, and makes the aliases', async () => {
    const loader = loaderOf({
      '/a.glb': { animations: [clip('idle', [q('Hips')]), clip('walk', [q('Hips')])] },
      '/b.glb': { animations: [clip('idle', [q('Spine')]), clip('die', [q('Spine')])], userData: { aliases: { 'die.fwd': 'die' } } },
    });
    const m = await loadWalrusPacks(['/a.glb', '/b.glb', '/missing.glb'], { loader });
    expect(m.get('idle').tracks[0].name).toBe('Spine.quaternion');
    expect(m.get('walk')).toBeTruthy();
    expect(m.get('die.fwd').name).toBe('die.fwd');
  });

  it('refuses a body on Meshy’s skeleton, saying what the game’s has', async () => {
    const meshy = body(['Hips', 'Spine', 'Spine01', 'Spine02', 'neck', 'Head']);
    const loader = { loadAsync: async (url) => (url === '/meshy.glb' ? { scene: meshy, animations: [] } : null) };
    await expect(loadWalrusBody('/meshy.glb', { packs: [], loader })).rejects.toThrow(/Spine1/);
  });

  it('refuses a body on the game’s skeleton without its weapon socket, which the saber and gun sit in', async () => {
    const noSocket = body([...BODY, 'IK_Joint_LeftHand', 'IK_Joint_RightHand', 'Wep_Muzzle', 'Wep_Aim']);
    const loader = { loadAsync: async (url) => (url === '/x.glb' ? { scene: noSocket, animations: [] } : null) };
    await expect(loadWalrusBody('/x.glb', { packs: [], loader })).rejects.toThrow(/Wep_Root/);
  });

  it('loads the humanoid pack first and a hero’s over it', () => {
    expect(packUrls('luke')).toEqual(['/models/galaxy/bf2017/clips-humanoid.glb', '/models/galaxy/bf2017/clips-luke.glb', '/models/galaxy/bf2017/clips-emotes-luke.glb', '/models/galaxy/bf2017/clips-additive.glb']);
    expect(packUrls()).toEqual(['/models/galaxy/bf2017/clips-humanoid.glb', '/models/galaxy/bf2017/clips-npc.glb', '/models/galaxy/bf2017/clips-additive.glb']);
    // (a phone's levels: the figure's own alone)
    expect(packUrls('luke', { extras: false })).toEqual(['/models/galaxy/bf2017/clips-humanoid.glb', '/models/galaxy/bf2017/clips-luke.glb']);
    expect(packUrls(null, { extras: false })).toEqual(['/models/galaxy/bf2017/clips-humanoid.glb']);
    expect(richClips('low') || richClips('mid')).toBe(false);
    expect(richClips('high') && richClips('ultra')).toBe(true);
  });

  it('loads the game’s full maps at ultra, the plain figure at high, the light one at low and mid', () => {
    expect(cutFor('/models/galaxy/crew/luke.glb', 'high')).toBe('/models/galaxy/crew/luke.glb');
    expect(cutFor('/models/galaxy/crew/luke.glb', 'ultra')).toBe('/models/galaxy/crew/luke.ultra.glb');
    expect(cutFor('/models/galaxy/crew/luke.glb', 'mid')).toBe('/models/galaxy/crew/luke.lod1.glb');
    expect(cutFor('/models/galaxy/crew/luke.glb', 'low')).toBe('/models/galaxy/crew/luke.lod1.glb');
  });
});

describe('a 2017 figure, light first and its full cut swapped in', () => {
  it('fetches the light cut first where the level wants a bigger one, and only it on a saver connection', () => {
    expect(cutsToLoad('/c/luke.glb', 'high')).toEqual(['/c/luke.lod1.glb', '/c/luke.glb']);
    expect(cutsToLoad('/c/luke.glb', 'ultra')).toEqual(['/c/luke.lod1.glb', '/c/luke.ultra.glb']);
    expect(cutsToLoad('/c/luke.glb', 'mid')).toEqual(['/c/luke.lod1.glb']);
    expect(cutsToLoad('/c/luke.glb', 'ultra', { lowData: true })).toEqual(['/c/luke.lod1.glb']);
  });

  it('puts the full cut’s skinned meshes on the bones already playing, and takes the light ones off', () => {
    const rig = (meshName) => {
      const root = new THREE.Group();
      const hips = new THREE.Bone();
      hips.name = 'Hips';
      const head = new THREE.Bone();
      head.name = 'Head';
      hips.add(head);
      root.add(hips);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
      geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
      const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial());
      mesh.name = meshName;
      root.add(mesh);
      root.updateMatrixWorld(true);
      mesh.bind(new THREE.Skeleton([hips, head]));
      return { root, hips, head, mesh };
    };
    const light = rig('light');
    const full = rig('full');
    const gone = swapBody(light.root, full.root);
    expect(gone).toEqual([light.mesh]);
    const meshes = [];
    light.root.traverse((o) => o.isSkinnedMesh && meshes.push(o));
    expect(meshes.map((m) => m.name)).toEqual(['full']);
    expect(meshes[0].skeleton.bones).toEqual([light.hips, light.head]);
    expect(meshes[0].frustumCulled).toBe(false);
  });
});
