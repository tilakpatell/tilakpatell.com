import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GAME_CLIPS, faceOf, gameClip, poseOf } from './gameBody';
import { ALIAS, PRELOAD } from './figures';

// what a 2017 figure's packs have (lib/three/walrusClips.js's humanoid set and a hero's)
const HUMANOID = ['idle', 'walk', 'run', 'idle.patrol', 'aim.pistol', 'aim.rifle', 'hit.chest', 'hit.head', 'hit.back', 'stagger', 'die', 'die.back', 'die.fwd', 'die.blown', 'crouch', 'crouch.run', 'talk'];
const has = (list) => (n) => list.includes(n);

describe('the station’s clip names on the game’s bodies', () => {
  it('turns the rules’ flinches, falls and stances into the game’s own', () => {
    const h = has(HUMANOID);
    expect(gameClip(ALIAS.hit, h)).toEqual({ clip: 'hit.chest' });
    expect(gameClip('hit.stomach', h)).toEqual({ clip: 'hit.back' });
    expect(gameClip('hit.shoulder.l', h)).toEqual({ clip: 'hit.chest' });
    expect(gameClip('hit.knock', h)).toEqual({ clip: 'stagger' });
    expect(gameClip(ALIAS.dieFwd, h)).toEqual({ clip: 'die.fwd' });
    expect(gameClip('idle.calm', h)).toEqual({ clip: 'idle.patrol' });
    expect(gameClip('talk', h)).toEqual({ clip: 'talk' });
    expect(gameClip('crouch.walk', h)).toEqual({ clip: 'crouch.run' });
  });

  it('aims a rifle in the rifle’s pose and anything else in the pistol’s', () => {
    const h = has(HUMANOID);
    expect(gameClip('aim.pistol', h)).toEqual({ clip: 'aim.pistol' });
    expect(gameClip('shoot.pistol', h, { rifle: true })).toEqual({ clip: 'aim.rifle' });
  });

  it('takes the first of the Force’s clips the figure has', () => {
    expect(gameClip('cast', has(['force.choke', 'force.lightning']))).toEqual({ clip: 'force.choke' });
    expect(gameClip('cast.double', has(['force.lightning']))).toEqual({ clip: 'force.lightning' });
    expect(gameClip('cast', has(HUMANOID))).toBe(null);
  });

  it('holds a frame for the poses the game has no clip of, from a pack of its own where it must', () => {
    expect(gameClip('crouch', has(HUMANOID))).toMatchObject({ clip: 'crouch', pose: true });
    expect(gameClip('kneel', has(HUMANOID))).toMatchObject({ clip: 'cover.low.idle', pack: 'npc', pose: true });
    expect(gameClip('sit.idle', has(HUMANOID))).toMatchObject({ clip: 'deploy.lambda.wait', pack: 'vehicles' });
    expect(gameClip('lie', has(HUMANOID))).toMatchObject({ clip: 'cover.prone', pack: 'npc', pose: true });
  });

  it('is a still for a name the figure has nothing near, never the library’s clip', () => {
    const h = has(HUMANOID);
    for (const n of ['counter.idle', 'walk.injured', 'taunt.trooper', 'sit.enter', null]) expect(gameClip(n, h), n).toBe(null);
    // (every name the rules fetch up front is either the game's or a still)
    for (const n of PRELOAD) {
      const got = gameClip(n, h);
      if (got) expect(typeof got.clip, n).toBe('string');
    }
    expect(Object.isFrozen(GAME_CLIPS)).toBe(true);
  });
});

describe('a held pose', () => {
  it('is the clip at that moment, the same at every time it plays', () => {
    const track = new THREE.VectorKeyframeTrack('Hips.position', [0, 2], [0, 1, 0, 0, 0, 0]);
    const pose = poseOf(new THREE.AnimationClip('crouch', 2, [track]), 2, 'kneel');
    expect(pose.name).toBe('kneel');
    expect(pose.userData.pose).toBe(true);
    const at = (t) => [...pose.tracks[0].createInterpolant().evaluate(t)];
    expect(at(0)).toEqual([0, 0, 0]);
    expect(at(0.5)).toEqual([0, 0, 0]);
  });
});

describe('how far a pose turns a body', () => {
  it('reads the chest’s turn about the up axis from where it faced at rest', () => {
    const model = new THREE.Group();
    const chest = new THREE.Bone();
    model.add(chest);
    model.updateMatrixWorld(true);
    const rest = { bone: chest, forward: new THREE.Vector3(0, 0, 1) };
    expect(faceOf(model, rest)).toBeCloseTo(0);
    chest.rotation.y = Math.PI / 2;
    expect(faceOf(model, rest)).toBeCloseTo(Math.PI / 2);
    expect(faceOf(model, null)).toBe(0);
  });
});
