import { describe, expect, it } from 'vitest';
import { CROSSFADE, RATE_MAX, RATE_MIN, clipSpeed, deathFor, locoBlend, locoClips, packClip, packFallback, rateFor, relAngle, resolveFamilies, stateFor, strideFromSamples, timeAt, transition } from './locomotion.js';

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

// the humanoid pack's loco clips as the page reads them (clips-humanoid.glb,
// and the rifle stance pack's running strafes): m/s and the stride's seconds
const HUMANOID = ['idle', 'walk', 'walk.right', 'walk.back', 'walk.left', 'run', 'sprint', 'crouch.run'];
const INFO = {
  walk: { pace: 1.91, period: 0.967 },
  'walk.right': { pace: 1.91, period: 0.867 },
  'walk.back': { pace: 1.62, period: 1.133 },
  'walk.left': { pace: 2.01, period: 0.9 },
  run: { pace: 3.94, period: 0.717 },
  sprint: { pace: 5.9, period: 0.583 },
  'crouch.run': { pace: 2.54, period: 0.867 },
  'stance.t.run.right': { pace: 3.71, period: 0.667 },
};
const info = (n) => INFO[n] ?? INFO[n.replace(/^stance\.t\./, '')];
const sum = (w) => Object.values(w).reduce((a, b) => a + b, 0);

describe('the walk as a blend', () => {
  it('reads the velocity’s angle against the facing, clockwise from ahead', () => {
    expect(relAngle(0, [0, 1])).toBeCloseTo(0, 9);
    // (to −X facing +Z is the soldier's right, as dir8Of's 2)
    expect(relAngle(0, [-1, 0])).toBeCloseTo(Math.PI / 2, 9);
    expect(relAngle(0, [0, -1])).toBeCloseTo(Math.PI, 9);
    expect(relAngle(0, [1, 0])).toBeCloseTo((3 * Math.PI) / 2, 9);
    expect(relAngle(Math.PI / 2, [1, 0])).toBeCloseTo(0, 9);
    expect(relAngle(0, [0, 0])).toBe(0);
  });

  it('rings the pack’s clips by gait and direction, a missing side taken from the slower gait, the sprint ahead only', () => {
    const rings = locoClips('stand', { has: (n) => HUMANOID.includes(n) });
    expect(rings.map((r) => r.map((e) => e.name))).toEqual([
      ['walk', 'walk.right', 'walk.back', 'walk.left'],
      ['run', 'walk.right', 'walk.back', 'walk.left'],
      ['sprint', 'walk.right', 'walk.back', 'walk.left'],
    ]);
    expect(rings[0].map((e) => e.angle)).toEqual([0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]);
    // (the held weapon's stance where its pack has the clip)
    const t = locoClips('stand', { key: 't', has: (n) => HUMANOID.includes(n) || n === 'stance.t.run' || n === 'stance.t.run.right' });
    expect(t[1].map((e) => e.name)).toEqual(['stance.t.run', 'stance.t.run.right', 'walk.back', 'walk.left']);
    expect(t[2].map((e) => e.name)).toEqual(['sprint', 'stance.t.run.right', 'walk.back', 'walk.left']);
    // (a gait without its forward clip is left out, its sides still lent on)
    expect(locoClips('stand', { has: (n) => ['run', 'walk.left'].includes(n) }).map((r) => r.map((e) => e.name))).toEqual([['run', 'walk.left']]);
    expect(locoClips('crouch', { has: (n) => HUMANOID.includes(n) }).map((r) => r.map((e) => e.name))).toEqual([['crouch.run']]);
    expect(locoClips('stand', { has: () => false })).toEqual([]);
  });

  it('weights the two nearest directions by the angle, the weights summing to one', () => {
    const rings = locoClips('stand', { has: (n) => HUMANOID.includes(n) });
    // (at a walk: under the walk ring's pace, which across the diagonal is
    // the two clips' travel as vectors, 0.71 of either's)
    const at = (angle, speed = 1.3) => locoBlend({ state: 'walk', speed, angle }, rings, info);
    expect(at(0).weights).toEqual({ walk: 1 });
    const half = at(Math.PI / 4).weights;
    expect(at(Math.PI / 4).pace).toBeCloseTo(1.91 * Math.SQRT1_2, 6);
    expect(half.walk).toBeCloseTo(0.5, 9);
    expect(half['walk.right']).toBeCloseTo(0.5, 9);
    expect(sum(half)).toBeCloseTo(1, 9);
    const back = at(Math.PI * 0.9).weights;
    expect(back['walk.right']).toBeCloseTo(0.2, 9);
    expect(back['walk.back']).toBeCloseTo(0.8, 9);
    // (across the wrap: between the left and ahead)
    const wrap = at((7 * Math.PI) / 4).weights;
    expect(wrap['walk.left']).toBeCloseTo(0.5, 9);
    expect(wrap.walk).toBeCloseTo(0.5, 9);
  });

  it('weights the gaits by speed between the clips’ own paces, and runs the phase at the body’s speed over the blend’s', () => {
    const rings = locoClips('stand', { has: (n) => HUMANOID.includes(n) });
    const at = (speed, state = 'run') => locoBlend({ state, speed, angle: 0 }, rings, info);
    // (under the walk's pace: the walk alone, slowed; the phase in strides a second)
    const slow = at(1.0, 'walk');
    expect(slow.weights).toEqual({ walk: 1 });
    expect(slow.k).toBeCloseTo(1 / 1.91, 9);
    expect(slow.rate).toBeCloseTo(1 / 1.91 / 0.967, 9);
    // (between the walk and the run: both, by where the speed falls)
    const mid = at(2.925);
    expect(mid.weights.walk).toBeCloseTo(0.5, 6);
    expect(mid.weights.run).toBeCloseTo(0.5, 6);
    expect(mid.pace).toBeCloseTo(2.925, 6);
    expect(mid.k).toBeCloseTo(1, 6);
    expect(mid.period).toBeCloseTo((0.967 + 0.717) / 2, 6);
    // (the sim's 3.8: nearly all run; its sprint 5.97: the sprint alone, a touch pushed)
    expect(at(3.8).weights.run).toBeCloseTo((3.8 - 1.91) / (3.94 - 1.91), 6);
    expect(at(3.94).weights).toEqual({ run: 1 });
    expect(at(5.97, 'sprint').weights).toEqual({ sprint: 1 });
    expect(at(5.97, 'sprint').k).toBeCloseTo(5.97 / 5.9, 6);
    // (a run sideways on the humanoid pack: the walk's strafe pushed, at the band's top)
    const side = locoBlend({ state: 'run', speed: 3.8, angle: Math.PI / 2 }, rings, info);
    expect(side.weights).toEqual({ 'walk.right': 1 });
    expect(side.k).toBe(RATE_MAX);
    // (the same clip in two gaits adds up: the right strafe at 45° between the walk and the run)
    const diag = locoBlend({ state: 'run', speed: 2.5, angle: Math.PI / 4 }, rings, info);
    expect(sum(diag.weights)).toBeCloseTo(1, 9);
    expect(diag.weights['walk.right']).toBeGreaterThan(0.49);
    // (the rifle's running strafe where the stance pack has it)
    const t = locoClips('stand', { key: 't', has: (n) => HUMANOID.includes(n) || n === 'stance.t.run.right' });
    expect(locoBlend({ state: 'run', speed: 3.8, angle: Math.PI / 2 }, t, info).weights).toEqual({ 'stance.t.run.right': 1 });
    // (crouched: the one clip)
    const c = locoClips('crouch', { has: (n) => HUMANOID.includes(n) });
    expect(locoBlend({ state: 'crouchWalk', speed: 2.5, angle: 1 }, c, info).weights).toEqual({ 'crouch.run': 1 });
    // (a clip with no pace plays alone as made; no rings, nothing)
    expect(locoBlend({ state: 'run', speed: 3.8, angle: 0 }, [[{ angle: 0, name: 'run' }]], () => ({ period: 1 }))).toMatchObject({ weights: { run: 1 }, k: 1, rate: 1, pace: null });
    expect(locoBlend({ state: 'run', speed: 3.8, angle: 0 }, [], info)).toMatchObject({ weights: {}, rate: 0 });
  });

  it('finds a clip’s strides from the feet’s separation: how many, their period, and where the feet pass with the left going ahead', () => {
    // two strides over 2 s: the left foot's lead a sine, from 0.1 s
    const two = [];
    for (let i = 0; i < 48; i++) {
      const t = (i / 48) * 2;
      two.push([t, 0.1 * Math.cos(2 * Math.PI * (t - 0.1)), 0.4 * Math.sin(2 * Math.PI * (t - 0.1))]);
    }
    const s = strideFromSamples(two, 2);
    expect(s.strides).toBe(2);
    expect(s.period).toBeCloseTo(1, 9);
    expect(s.offset).toBeCloseTo(0.1, 2);
    // (one stride, and a strafe whose feet part across more than ahead)
    const one = [];
    for (let i = 0; i < 24; i++) {
      const t = i / 24;
      one.push([t, 0.3 * Math.sin(2 * Math.PI * (t - 0.25)) - 0.2, 0.02 * Math.sin(2 * Math.PI * t)]);
    }
    expect(strideFromSamples(one, 1)).toMatchObject({ strides: 1, period: 1 });
    expect(strideFromSamples(one, 1).offset).toBeCloseTo(0.25, 2);
    // (feet that never part, or too few samples)
    expect(strideFromSamples(two.map(([t]) => [t, 0, 0]), 2)).toBe(null);
    expect(strideFromSamples(two.slice(0, 3), 2)).toBe(null);
    // the time a phase lands at: a measured stride's offset and period, round the clip
    expect(timeAt(s, 0, 2)).toBeCloseTo(0.1, 2);
    expect(timeAt(s, 1.5, 2)).toBeCloseTo(1.6, 2);
    expect(timeAt(s, 2.25, 2)).toBeCloseTo(0.35, 2);
    // (no stride: the clip one stride long from its start)
    expect(timeAt(null, 0.25, 2)).toBeCloseTo(0.5, 9);
    expect(timeAt(null, 1.25, 2)).toBeCloseTo(0.5, 9);
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
