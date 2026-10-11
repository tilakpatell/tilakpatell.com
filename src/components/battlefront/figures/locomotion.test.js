import { describe, expect, it } from 'vitest';
import { CROSSFADE, RATE_MAX, RATE_MIN, clipSpeed, deathFor, packClip, packFallback, rateFor, resolveFamilies, stateFor, transition } from './locomotion.js';

// a cut of anims.jsonl's names, as the export spells them
const NAMES = ['P_HM_Rifle_StandIdle_01', 'C_HM_Rifle_Walk_Fwd_01', 'C_HM_Rifle_Run_Fwd_01', 'C_HM_Rifle_Walk_Left1_01', 'A_HM_Death_Stand_Front_Upperbody_BlasterFire_01', 'A_HM_Death_Stand_Back_Upperbody_BlasterFire_01', 'A_HM_Death_Stand_Left_Upperbody_BlasterFire_01', 'T_HM_Rifle_RunToStand_Fwd_01', 'Stand_Combat_Flinch01'];

describe('the game’s clips, by family', () => {
  it('gives a state its family, and one with no clip the next in the chain (sprint → run)', () => {
    const f = resolveFamilies(NAMES);
    expect(f.run).toEqual(['C_HM_Rifle_Run_Fwd_01']);
    expect(f.sprint).toEqual(f.run);
    expect(f.idle).toEqual(['P_HM_Rifle_StandIdle_01']);
    // (no crouch in the cut: down the chain to the idle)
    expect(f.crouchIdle).toEqual(f.idle);
    // nothing resolves to an empty family while the idle has one
    for (const [k, v] of Object.entries(f)) expect(v.length, k).toBeGreaterThan(0);
  });

  it('reads a moving, aiming soldier as aiming, with the way they move against the way they face', () => {
    const s = stateFor({ state: 'alive', stance: 'stand', moving: true, aim: true, yaw: 0, vel: [-2, 0] });
    expect(s.state).toBe('aim');
    // moving to −X while facing +Z (+Y up, right-handed) is to the soldier's right: the second of eight, clockwise from ahead
    expect(s.dir8).toBe(2);
    expect(stateFor({ state: 'alive', stance: 'stand', moving: true, aim: true, yaw: 0, vel: [2, 0] }).dir8).toBe(6);
    expect(s.speed).toBeCloseTo(2, 6);
    expect(stateFor({ state: 'alive', stance: 'stand', moving: true, yaw: 0, vel: [0, 7] }).state).toBe('sprint');
    expect(stateFor({ state: 'alive', stance: 'crouch', moving: false, yaw: 0, vel: [0, 0] }).state).toBe('crouchIdle');
    expect(stateFor({ state: 'down', stance: 'stand', yaw: 0, vel: [0, 0] }).state).toBe('death');
  });

  it('plays the game’s transition clip where it has one, else a crossfade', () => {
    expect(transition('run', 'idle', NAMES)).toEqual({ clip: 'T_HM_Rifle_RunToStand_Fwd_01', fade: CROSSFADE });
    expect(transition('idle', 'run', NAMES)).toEqual({ clip: null, fade: CROSSFADE });
  });

  it('picks a death by where the hit came from', () => {
    const f = resolveFamilies(NAMES);
    // a hit from ahead (the bolt travels toward −Z at a soldier facing +Z) throws them back
    expect(deathFor(f, { yaw: 0, hitDir: [0, 0, -1] })).toBe('A_HM_Death_Stand_Front_Upperbody_BlasterFire_01');
    expect(deathFor(f, { yaw: 0, hitDir: [0, 0, 1] })).toBe('A_HM_Death_Stand_Back_Upperbody_BlasterFire_01');
  });

  it('names the humanoid pack’s clip for a state, the strafes by direction', () => {
    expect(packClip({ state: 'aim', speed: 2, dir8: 6 })).toBe('walk.left');
    expect(packClip({ state: 'aim', speed: 0, dir8: 0 })).toBe('aim.rifle');
    expect(packClip({ state: 'run', speed: 4, dir8: 4 })).toBe('walk.back');
    expect(packClip({ state: 'death', side: 'back' })).toBe('die.back');
  });

  it('plays the held weapon’s stance pack where it has the clip: the idle armed, never Luke’s unarmed one', () => {
    expect(packClip({ state: 'idle', speed: 0, dir8: 0 }, { stance: 't' })).toBe('stance.t.idle');
    expect(packClip({ state: 'aim', speed: 0, dir8: 0 }, { stance: 'p' })).toBe('stance.p.aim');
    expect(packClip({ state: 'crouchIdle', speed: 0, dir8: 0 }, { stance: 't' })).toBe('stance.t.crouch');
    expect(packClip({ state: 'crouchWalk', speed: 1, dir8: 0 }, { stance: 'l' })).toBe('stance.l.crouch.run');
    expect(packClip({ state: 'run', speed: 4, dir8: 0 }, { stance: 'l' })).toBe('stance.l.run');
    expect(packClip({ state: 'aim', speed: 2, dir8: 6 }, { stance: 'p' })).toBe('stance.p.walk.left');
    // (the deaths, hits and rolls have no stance clips: the humanoid's)
    expect(packClip({ state: 'death', side: 'front' }, { stance: 't' })).toBe('die.fwd');
    expect(packClip({ state: 'roll', speed: 4, dir8: 0 }, { stance: 'p' })).toBe('dodge.front');
  });

  it('falls back from a stance clip the pack lacks to the humanoid’s armed one', () => {
    // (the idle to a held pose, by the weapon: a pistol's, else a rifle's)
    expect(packFallback('stance.t.idle')).toBe('aim.rifle');
    expect(packFallback('stance.l.idle')).toBe('aim.rifle');
    expect(packFallback('stance.p.idle')).toBe('aim.pistol');
    expect(packFallback('stance.p.aim')).toBe('aim.pistol');
    expect(packFallback('stance.l.aim')).toBe('aim.rifle');
    expect(packFallback('stance.l.crouch')).toBe('crouch');
    expect(packFallback('stance.t.walk.left')).toBe('walk.left');
    expect(packFallback('walk')).toBe(null);
  });
});

// a clip as the pack writes it: its root's travel in its extras (clip.userData)
const rooted = (root, duration = 1) => ({ duration, userData: root ? { root, loop: false } : {} });
// the humanoid pack's paces, read from clips-humanoid.glb (locomotion.js's note)
const PACE = { walk: 1.91, run: 3.94, sprint: 5.9, 'crouch.run': 2.54 };

describe('a clip’s pace against the ground', () => {
  it('reads a clip’s own speed from its root travel: none with no root, or one that goes nowhere', () => {
    expect(clipSpeed(rooted([[0, 0, 0], [1, 0, 2]]))).toBeCloseTo(2, 9);
    // (sideways and back count as far as ahead; a row with no time takes the clip's length)
    expect(clipSpeed(rooted([[0, 0, 0], [1.8, 3.6, 0]], 1.8))).toBeCloseTo(2, 9);
    expect(clipSpeed(rooted([[0, 0, 0], [0, 0, -3]], 2))).toBeCloseTo(1.5, 9);
    expect(clipSpeed(rooted(null))).toBe(null);
    expect(clipSpeed(rooted([[0, 0, 0], [5.3, 0, 0]], 5.3))).toBe(null);
    expect(clipSpeed(null)).toBe(null);
  });

  it('plays a walking clip at the body’s speed over its own, inside the band, and the rest as made', () => {
    expect(rateFor('run', 3.8, 3)).toBeCloseTo(1.2667, 4);
    expect(rateFor('aim', 2.4, 2)).toBeCloseTo(1.2, 9);
    expect(rateFor('crouchWalk', 2.5, 2.5)).toBeCloseTo(1, 9);
    expect(rateFor('walk', 9, 1.9)).toBe(RATE_MAX);
    expect(rateFor('walk', 0.3, 1.9)).toBe(RATE_MIN);
    // (no pace of its own, no speed to match, or not a step over the ground)
    expect(rateFor('run', 3.8, null)).toBe(1);
    expect(rateFor('run', 0, 3)).toBe(1);
    for (const state of ['idle', 'aim', 'death', 'hit', 'roll', 'crouchIdle']) expect(rateFor(state, state === 'aim' ? 0 : 3.8, 3), state).toBe(1);
  });

  it('plays the sim’s speeds on the clips paced nearest them: 3.8 the run, 5.97 the sprint, the crouch’s 2.5 its run', () => {
    const at = (speed, stance = 'stand') => {
      const s = stateFor({ state: 'alive', stance, yaw: 0, vel: [0, speed] });
      const clip = packClip(s);
      return { clip, rate: rateFor(s.state, s.speed, PACE[clip]) };
    };
    expect(at(3.8).clip).toBe('run');
    expect(at(5.97).clip).toBe('sprint');
    expect(at(2.5, 'crouch').clip).toBe('crouch.run');
    // (a soldier slowed under the walk's line walks)
    expect(at(1.5).clip).toBe('walk');
    for (const [speed, stance] of [[3.8], [5.97], [2.5, 'crouch']]) expect(Math.abs(at(speed, stance).rate - 1), `${speed}`).toBeLessThan(0.1);
  });
});

describe('the figures, one an entity', () => {
  it('makes a figure for each soldier, plays the state’s clip and frees it when it leaves the view', async () => {
    const THREE = await import('three');
    const { createFigures } = await import('./figures.js');
    const bodies = [];
    const loadBody = async (url) => {
      bodies.push(url);
      const model = new THREE.Group();
      const bone = new THREE.Bone();
      bone.name = 'Hips';
      model.add(bone);
      const clip = (name) => new THREE.AnimationClip(name, 1, [new THREE.VectorKeyframeTrack('Hips.position', [0, 1], [0, 0, 0, 0, 1, 0])]);
      return { model, clips: { idle: clip('idle'), run: clip('run'), 'die.fwd': clip('die.fwd') } };
    };
    const scene = new THREE.Scene();
    const figs = createFigures({ scene, loadBody });
    const e = { id: 7, team: 2, at: [1, 2, 3], yaw: 0, state: 'alive', stance: 'stand', vel: [0, 4], t: 0 };
    figs.update([e], 0.016);
    await Promise.resolve();
    await Promise.resolve();
    figs.update([e], 0.016);
    expect(bodies).toEqual(['/models/galaxy/bf2017/crew/snowtrooper.lod1.glb']);
    expect(figs.figure(7).clip).toBe('run');
    expect(figs.figure(7).model.position.toArray()).toEqual([1, 2, 3]);
    figs.update([{ ...e, state: 'down', t: 1 }], 0.016);
    expect(figs.figure(7).clip).toBe('die.fwd');
    figs.update([], 0.016);
    expect(figs.count()).toBe(0);
  });
});
