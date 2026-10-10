import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { playScene, scenePath } from './scenePlayer';

// a figure with a Hips bone and an animator that plays what it's given
const figure = () => {
  const model = new THREE.Group();
  const hips = new THREE.Bone();
  hips.name = 'Hips';
  model.add(hips);
  const got = new Map();
  const played = [];
  let finish = null;
  const anim = {
    add: (name, clip) => (got.set(name, clip), true),
    play: (name, opts) => (played.push([name, opts.layer]), new Promise((r) => (finish = r))),
    stop: () => played.push(['stop']),
  };
  return { fig: { model, anim, rig: 'walrus' }, got, played, done: () => finish?.('done') };
};
const clip = (name) => new THREE.AnimationClip(name, 2, [new THREE.QuaternionKeyframeTrack('Hips.quaternion', [0, 2], [0, 0, 0, 1, 0, 0.7071, 0, 0.7071])]);

describe('the scene player', () => {
  it('names a scene’s file', () => {
    expect(scenePath('hoth-outro')).toBe('/models/galaxy/bf2017/scenes/hoth-outro.glb');
  });
  it('plays each track on the cast member of its role, whole-body, and ends when they have', async () => {
    const a = figure();
    const b = figure();
    let ended = 0;
    const s = playScene({ id: 'x', tracks: { e1: clip('e1'), e2: clip('e2') } }, { e1: a.fig, e2: b.fig }, { onEnd: () => ended++ });
    expect(s.roles).toEqual(['e1', 'e2']);
    expect(a.played[0]).toEqual(['scene.x.e1', 'full']);
    expect(a.got.has('scene.x.e1')).toBe(true);
    a.done();
    b.done();
    await s.done;
    expect(ended).toBe(1);
  });
  it('skips a track whose role the cast lacks and plays the rest (Review Focus 3)', async () => {
    const leia = figure();
    let ended = 0;
    const s = playScene({ id: 'y', tracks: { han: clip('han'), leia: clip('leia') } }, { leia: leia.fig }, { onEnd: () => ended++ });
    expect(s.roles).toEqual(['leia']);
    leia.done();
    await s.done;
    expect(ended).toBe(1);
  });
  it('skips a cast member on another skeleton (no bone of the track’s), and ends at once with nobody', async () => {
    const droid = figure();
    droid.fig.model.children[0].name = 'B2_Pelvis';
    let ended = 0;
    const s = playScene({ id: 'z', tracks: { e1: clip('e1') } }, { e1: droid.fig }, { onEnd: () => ended++ });
    expect(s.roles).toEqual([]);
    await s.done;
    expect(ended).toBe(1);
    expect(droid.played).toEqual([]);
  });
  it('skips a figure on Meshy’s rig, which shares the hips and limbs’ names but is another skeleton', async () => {
    const meshy = figure();
    meshy.fig.rig = null;
    const s = playScene({ id: 'm', tracks: { e1: clip('e1') } }, { e1: meshy.fig });
    expect(s.roles).toEqual([]);
    expect(meshy.played).toEqual([]);
  });
  it('lets everyone go when stopped', () => {
    const a = figure();
    const s = playScene({ id: 'w', tracks: { e1: clip('e1') } }, { e1: a.fig });
    s.stop();
    expect(a.played.at(-1)).toEqual(['stop']);
  });
});
