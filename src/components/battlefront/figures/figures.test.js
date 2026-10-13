import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { skeleton } from '../../../lib/three/fixtures/gameSkeleton.js';
import { AITRAJECTORY_TURN } from './facing.js';
import { BODIES, BODY_MIDDLE, BODY_REACH, UNIT_KINDS, createFigures, cullBy, kindOf, preloadBody } from './figures.js';
import { createHeld, weaponUrl } from './held.js';

const settle = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};
const clip = (name) => new THREE.AnimationClip(name, 1, [new THREE.VectorKeyframeTrack('Hips.position', [0, 1], [0, 0, 0, 0, 1, 0])]);

// a stand-in body: the game's root, hips and weapon socket, the humanoid's names
function body() {
  const model = new THREE.Group();
  const traj = new THREE.Object3D();
  traj.name = 'AITrajectory';
  const hips = new THREE.Bone();
  hips.name = 'Hips';
  const socket = new THREE.Bone();
  socket.name = 'Wep_Root';
  socket.position.set(0.3, 1.3, 0);
  hips.add(socket);
  traj.add(hips);
  model.add(traj);
  const clips = Object.fromEntries(['idle', 'aim.rifle', 'aim.pistol', 'walk', 'run', 'die.fwd'].map((n) => [n, clip(n)]));
  return { model, clips, sockets: { weapon: socket } };
}

function setup() {
  const guns = [];
  const stances = [];
  const waits = [];
  const held = createHeld({
    load: (url) => {
      guns.push(url);
      return Promise.resolve({ scene: new THREE.Group(), animations: [] });
    },
  });
  // (a stance pack lands when the test says)
  const loadStance = (key) => {
    stances.push(key);
    return new Promise((resolve) => waits.push(() => resolve(new Map([[`stance.${key}.idle`, clip(`stance.${key}.idle`)]]))));
  };
  const scene = new THREE.Scene();
  const figs = createFigures({ scene, loadBody: async () => body(), held, loadStance });
  return { figs, guns, stances, land: () => waits.shift()() };
}

const soldier = { id: 3, team: 2, at: [5, 0, 1], yaw: 0, state: 'alive', stance: 'stand', vel: [0, 0], t: 0, weapon: 'e11' };

describe('a soldier’s figure with its weapon', () => {
  it('turns the body to the sim’s facing (the clips’ AITrajectory turn put back)', async () => {
    const { figs } = setup();
    figs.update([soldier], 0.016);
    await settle();
    figs.update([soldier], 0.016);
    expect(figs.figure(3).model.getObjectByName('AITrajectory').quaternion.toArray()).toEqual(AITRAJECTORY_TURN);
    expect(figs.figure(3).model.rotation.y).toBe(0);
  });

  it('arms it with the class weapon and gives its muzzle in the world', async () => {
    const { figs, guns } = setup();
    figs.update([soldier], 0.016);
    await settle();
    figs.update([soldier], 0.016);
    await settle();
    expect(guns).toEqual([weaponUrl('e11')]);
    const out = new THREE.Vector3();
    expect(figs.muzzleOf(3, out)).toBe(out);
    // (the stand-in's socket under the turned AITrajectory: its +x is the
    // world's +z, its +z the world's −x; the hips a frame into the clip's rise)
    const hipsY = figs.figure(3).model.getObjectByName('Hips').position.y;
    expect(out.x).toBeCloseTo(5 - 0.298969, 6);
    expect(out.y).toBeCloseTo(hipsY + 1.3 + 0.049385, 6);
    expect(out.z).toBeCloseTo(1 + 0.3, 6);
    expect(figs.muzzleOf(99, out)).toBe(null);
    // (a new weapon: the gun swapped)
    figs.update([{ ...soldier, weapon: 'dh17', t: 1 }], 0.016);
    await settle();
    expect(guns).toEqual([weaponUrl('e11'), weaponUrl('dh17')]);
  });

  it('stands armed: a held pose until the stance pack lands, then the pack’s idle', async () => {
    const { figs, stances, land } = setup();
    figs.update([soldier], 0.016);
    await settle();
    figs.update([soldier], 0.016);
    expect(stances).toEqual(['t']);
    expect(figs.figure(3).clip).toBe('aim.rifle');
    land();
    await settle();
    figs.update([soldier], 0.016);
    expect(figs.figure(3).clip).toBe('stance.t.idle');
    // (a pistol's pose while its pack comes)
    figs.update([{ ...soldier, weapon: 'rk3', t: 1 }], 0.016);
    expect(stances).toEqual(['t', 'p']);
    expect(figs.figure(3).clip).toBe('aim.pistol');
  });

  it('takes the gun off a figure that leaves the view', async () => {
    const { figs } = setup();
    figs.update([soldier], 0.016);
    await settle();
    figs.update([soldier], 0.016);
    await settle();
    const socket = figs.figure(3).sockets.weapon;
    expect(socket.children.length).toBe(1);
    figs.update([], 0.016);
    expect(socket.children.length).toBe(0);
  });
});

// a body on the game's skeleton with no clips, loaded at once
const gameBody = async () => {
  const model = new THREE.Group();
  model.add(skeleton().Hips.parent);
  return { model, clips: {} };
};
const tick = () => new Promise((r) => setTimeout(r, 0));
const trooper = (over = {}) => ({ id: 'a', team: 2, kind: 'soldier', at: [1, 0, 2], yaw: 0, state: 'alive', t: 0, vel: [0, 0], fall: null, ...over });

// a stand-in for ragdolls.js: it takes every fall and has the body at once
function fakeRagdolls() {
  const handed = new Set();
  return {
    fall: vi.fn((id) => {
      handed.add(id);
      return true;
    }),
    handed: (id) => handed.has(id),
    drop: vi.fn((id) => handed.delete(id)),
  };
}

describe('the figures and the ragdolls', () => {
  it('hands a fallen soldier to the ragdolls with how it fell, then stops placing it', async () => {
    const ragdolls = fakeRagdolls();
    const figs = createFigures({ scene: new THREE.Scene(), loadBody: gameBody, ragdolls });
    figs.update([trooper()], 0.05);
    await tick();
    figs.update([trooper()], 0.05);
    expect(ragdolls.fall).not.toHaveBeenCalled();
    const fall = { part: 'head', dir: [0, 0, 1], at: [1, 1.6, 2], weapon: 'e11' };
    const eye = [0, 2, 0];
    figs.update([trooper({ state: 'dying', fall, t: 0.05 })], 0.05, 1, eye);
    expect(ragdolls.fall).toHaveBeenCalledTimes(1);
    expect(ragdolls.fall.mock.calls[0][0]).toBe('a');
    expect(ragdolls.fall.mock.calls[0][2]).toMatchObject({ fall, eye });
    const model = figs.figure('a').model;
    figs.update([trooper({ state: 'down', fall, at: [9, 0, 9], t: 0.1 })], 0.05, 1, eye);
    expect(model.position.x).toBeCloseTo(1, 9);
    expect(ragdolls.fall).toHaveBeenCalledTimes(1);
  });

  it('drops the ragdoll when the sim takes the soldier away, or it stands again', async () => {
    const ragdolls = fakeRagdolls();
    const figs = createFigures({ scene: new THREE.Scene(), loadBody: gameBody, ragdolls });
    figs.update([trooper(), trooper({ id: 'b' })], 0.05);
    await tick();
    figs.update([trooper({ state: 'dying' }), trooper({ id: 'b', state: 'dying' })], 0.05);
    figs.update([trooper({ state: 'alive', t: 1 })], 0.05);
    expect(ragdolls.drop).toHaveBeenCalledWith('b');
    expect(ragdolls.drop).toHaveBeenCalledWith('a');
    expect(figs.figure('a').model.visible).toBe(true);
    figs.update([trooper({ state: 'alive', at: [5, 0, 5], t: 2 })], 0.05);
    expect(figs.figure('a').model.position.x).toBeCloseTo(5, 9);
  });

  it('asks the ragdolls once per death: a refused body keeps its death clip and is not offered again', async () => {
    const ragdolls = fakeRagdolls();
    ragdolls.fall.mockImplementation(() => false);
    const figs = createFigures({ scene: new THREE.Scene(), loadBody: gameBody, ragdolls });
    figs.update([trooper()], 0.05);
    await tick();
    for (let i = 0; i < 20; i++) figs.update([trooper({ state: i < 2 ? 'dying' : 'down', at: [3, 0, 3], t: 1 + i })], 0.05);
    expect(ragdolls.fall).toHaveBeenCalledTimes(1);
    expect(ragdolls.drop).not.toHaveBeenCalled();
    expect(figs.figure('a').model.position.x).toBeCloseTo(3, 9);
    // (up again, then a new death: asked again)
    figs.update([trooper({ state: 'alive', t: 30 })], 0.05);
    expect(ragdolls.drop).not.toHaveBeenCalled();
    figs.update([trooper({ state: 'dying', t: 31 })], 0.05);
    expect(ragdolls.fall).toHaveBeenCalledTimes(2);
  });

  it('draws a soldier up again under the same id at its new place, not sliding from the corpse', async () => {
    const ragdolls = fakeRagdolls();
    const figs = createFigures({ scene: new THREE.Scene(), loadBody: gameBody, ragdolls });
    figs.update([trooper()], 0.05);
    await tick();
    figs.update([trooper({ state: 'dying', at: [3, 0, 3], t: 1 })], 0.05);
    // (deployed between steps: the same step time, a new place)
    figs.update([trooper({ state: 'alive', at: [40, 0, 40], t: 1 })], 0.05, 0);
    expect(figs.figure('a').model.position.x).toBeCloseTo(40, 9);
  });

  it('draws as before with no ragdolls', async () => {
    const figs = createFigures({ scene: new THREE.Scene(), loadBody: gameBody });
    figs.update([trooper()], 0.05);
    await tick();
    figs.update([trooper({ state: 'down', at: [3, 0, 3], t: 1 })], 0.05);
    expect(figs.figure('a').model.position.x).toBeCloseTo(3, 9);
  });
});

describe('the gun when the ragdoll has the body', () => {
  it('leaves the hand, so no bolt comes from a fallen soldier, and comes back if it stands', async () => {
    const ragdolls = fakeRagdolls();
    const guns = [];
    const held = createHeld({
      load: (url) => {
        guns.push(url);
        return Promise.resolve({ scene: new THREE.Group(), animations: [] });
      },
    });
    const figs = createFigures({ scene: new THREE.Scene(), loadBody: async () => body(), held, loadStance: async () => new Map(), ragdolls });
    figs.update([soldier], 0.016);
    await settle();
    figs.update([soldier], 0.016);
    await settle();
    const socket = figs.figure(3).sockets.weapon;
    expect(socket.children.length).toBe(1);
    figs.update([{ ...soldier, state: 'dying', t: 1 }], 0.016);
    expect(socket.children.length).toBe(0);
    expect(figs.muzzleOf(3, new THREE.Vector3())).toBe(null);
    figs.update([{ ...soldier, t: 2 }], 0.016);
    await settle();
    expect(socket.children.length).toBe(1);
    expect(guns).toEqual([weaponUrl('e11'), weaponUrl('e11')]);
  });
});

// a clip that walks: its root `metres` along (+z ahead, +x left) over its second, as the pack writes it
const walking = (name, [dx, dz]) => Object.assign(clip(name), { userData: { root: [[0, 0, 0], [1, dx, dz]], loop: false } });

describe('a soldier’s stride against the ground', () => {
  const paced = (clips) => createFigures({ scene: new THREE.Scene(), loadBody: async () => ({ ...body(), clips }) });
  // (unarmed: no gun or stance pack to fetch)
  const runner = (over = {}) => ({ ...soldier, id: 4, weapon: null, ...over });

  it('plays the run clip at the body’s speed over the clip’s own, kept so as the speed changes under it', async () => {
    const run = walking('run', [0, 3]);
    const figs = paced({ idle: clip('idle'), run, 'walk.left': walking('walk.left', [2, 0]) });
    figs.update([runner({ vel: [0, 3.8] })], 0.1);
    await settle();
    figs.update([runner({ vel: [0, 3.8] })], 0.1);
    const f = figs.figure(4);
    const a = f.actions.get('run');
    expect(f.clip).toBe('run');
    expect(a.timeScale).toBeCloseTo(3.8 / 3, 6);
    // (the feet a tenth of a second on, at the ground's pace)
    expect(a.time).toBeCloseTo(0.1 * (3.8 / 3), 6);
    expect(f.speeds.get('run')).toBeCloseTo(3, 9);
    figs.update([runner({ vel: [0, 3], t: 1 })], 0.1);
    expect(f.clip).toBe('run');
    expect(a.timeScale).toBeCloseTo(1, 6);
    // (a strafe, aiming to the left, is paced as the run is)
    figs.update([runner({ vel: [2.4, 0], aim: true, t: 2 })], 0.1);
    expect(f.clip).toBe('walk.left');
    expect(f.actions.get('walk.left').timeScale).toBeCloseTo(1.2, 6);
    // (stood still: the idle as made)
    figs.update([runner({ t: 3 })], 0.1);
    expect(f.clip).toBe('idle');
    expect(f.actions.get('idle').timeScale).toBe(1);
  });

  it('blends the nearest directions and gaits on one phase: a turn or a speed change moves weights, never cuts a clip', async () => {
    const clips = { idle: clip('idle'), walk: walking('walk', [0, 2]), 'walk.right': walking('walk.right', [-2, 0]), 'walk.back': walking('walk.back', [0, -1.6]), 'walk.left': walking('walk.left', [2, 0]), run: walking('run', [0, 4]) };
    const figs = paced(clips);
    figs.update([runner({ vel: [0, 2] })], 0.1);
    await settle();
    // ahead at the walk's pace: the walk alone, every loco action made and in step
    figs.update([runner({ vel: [0, 2] })], 0.1);
    const f = figs.figure(4);
    expect(f.clip).toBe('walk');
    expect([...f.loco].sort()).toEqual(['run', 'walk', 'walk.back', 'walk.left', 'walk.right']);
    const w = (n) => f.weights.get(n) ?? 0;
    expect(w('walk')).toBeCloseTo(1, 9);
    for (const n of f.loco) expect(f.actions.get(n).timeScale, n).toBeCloseTo(1, 9);
    expect(f.phase).toBeCloseTo(0.1, 9);
    // a step to the right-ahead at the walk's diagonal pace: half the walk, half the right strafe, eased over CROSSFADE, the sum one
    const diag = [-1, 1];
    figs.update([runner({ vel: diag, t: 1 })], 0.05);
    expect(w('walk')).toBeCloseTo(1 - 0.05 / 0.15, 6);
    expect(w('walk.right')).toBeCloseTo(0.05 / 0.15, 6);
    figs.update([runner({ vel: diag, t: 2 })], 0.05);
    figs.update([runner({ vel: diag, t: 3 })], 0.05);
    expect(w('walk')).toBeCloseTo(0.5, 6);
    expect(w('walk.right')).toBeCloseTo(0.5, 6);
    expect([...f.weights.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    // (the walk kept running through it: never stopped or restarted)
    expect(f.actions.get('walk').isRunning()).toBe(true);
    expect(f.actions.get('walk').time).toBeCloseTo(0.1 + 0.15, 6);
    // faster, ahead: the run comes in by speed, the phase runs on at the body's speed over the blend's pace
    figs.update([runner({ vel: [0, 3], t: 4 })], 0.1);
    const run = f.actions.get('run');
    expect(run.timeScale).toBeGreaterThan(0);
    expect(f.actions.get('walk').timeScale).toBeCloseTo(run.timeScale, 9);
    expect(f.phase).toBeGreaterThan(0.25);
    // stood still: the idle, the loco actions held
    figs.update([runner({ t: 5 })], 0.1);
    expect(f.clip).toBe('idle');
    expect(run.timeScale).toBe(0);
    expect(f.walking).toBe(false);
    // off again: from the feet passing (phase 0), every loco action seated there
    figs.update([runner({ vel: [0, 2], t: 6 })], 0.1);
    expect(f.walking).toBe(true);
    expect(f.phase).toBeCloseTo(0.1, 9);
    expect(f.actions.get('walk').time).toBeCloseTo(0.1, 9);
  });

  it('plays a run clip with no root travel at its own pace', async () => {
    const figs = paced({ idle: clip('idle'), run: clip('run') });
    figs.update([runner({ vel: [0, 3.8] })], 0.1);
    await settle();
    figs.update([runner({ vel: [0, 3.8] })], 0.1);
    const f = figs.figure(4);
    expect(f.clip).toBe('run');
    expect(f.speeds.get('run')).toBe(null);
    expect(f.actions.get('run').timeScale).toBe(1);
  });
});

describe('cullBy', () => {
  const part = (size, y) => {
    const g = new THREE.BoxGeometry(size, size, size);
    g.translate(0, y, 0);
    const m = new THREE.SkinnedMesh(g, new THREE.MeshStandardMaterial());
    m.frustumCulled = false;
    return m;
  };
  it('culls every part of a body by one sphere round the body, carried into each part’s own frame', () => {
    const model = new THREE.Group();
    const glove = part(0.2, 1.2);
    const torso = part(0.8, 1);
    // (a part on a node in centimetres, off to one side)
    const holder = new THREE.Group();
    holder.scale.setScalar(0.01);
    holder.position.set(0.5, 0, 0);
    const cape = part(80, 100);
    holder.add(cape);
    model.add(glove, torso, holder);
    const whole = cullBy(model);
    expect(whole.radius).toBe(BODY_REACH);
    expect(whole.center.toArray()).toEqual(BODY_MIDDLE);
    for (const o of [glove, torso, cape]) expect(o.frustumCulled).toBe(true);
    expect(glove.boundingSphere.radius).toBe(BODY_REACH);
    expect(glove.boundingSphere.center.toArray()).toEqual(BODY_MIDDLE);
    expect(cape.boundingSphere.radius).toBeCloseTo(BODY_REACH * 100, 6);
    expect(cape.boundingSphere.center.toArray().map((v) => Math.round(v))).toEqual([-50, 100, 0]);
    // (the same sphere in the world, whichever part asks)
    const s = cape.boundingSphere.clone().applyMatrix4(cape.matrixWorld);
    expect(s.center.toArray().map((v) => +v.toFixed(6))).toEqual(BODY_MIDDLE);
    expect(s.radius).toBeCloseTo(BODY_REACH, 6);
  });
  it('scales with a body drawn larger, and leaves a body with no skinned part alone', () => {
    const model = new THREE.Group();
    model.scale.setScalar(2);
    model.add(part(1, 1));
    expect(cullBy(model).radius).toBeCloseTo(BODY_REACH * 2, 6);
    const bare = new THREE.Group();
    bare.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    expect(cullBy(bare)).toBeNull();
  });
});

describe('a soldier’s cut by its distance from the eye', () => {
  const run = async (eye) => {
    const asked = [];
    const cuts = { of: (kind) => (kind === 'snowtrooper' ? { lod: true, far: true, full: true, fullMB: 1, fullDL: 1 } : null), level: 'high', lowData: false, load: (u) => (asked.push(u), Promise.resolve(null)) };
    const figs = createFigures({ scene: new THREE.Scene(), loadBody: async () => body(), held: createHeld({ load: () => Promise.resolve({ scene: new THREE.Group(), animations: [] }) }), loadStance: () => Promise.resolve(new Map()), cuts });
    figs.update([soldier], 0.016, 1, eye);
    await settle();
    figs.update([{ ...soldier, t: 1 }], 0.016, 1, eye);
    await settle();
    return asked;
  };

  it('asks for the game’s LOD0 near and the far cut past the level’s mid', async () => {
    expect(await run(new THREE.Vector3(5, 1.6, 3))).toEqual([BODIES.snowtrooper.url]);
    expect(await run(new THREE.Vector3(500, 1.6, 1))).toEqual([BODIES.snowtrooper.url.replace(/\.glb$/, '.far.glb')]);
  });

  it('asks nothing without an eye or a row', async () => {
    expect(await run(null)).toEqual([]);
  });
});

describe('the body a unit wears', () => {
  it('is the hero’s or the reinforcement’s own, else the side’s trooper', () => {
    expect(kindOf({ team: 2, unitId: 'darthvader' })).toBe('vader');
    expect(kindOf({ team: 1, unitId: 'hansolo' })).toBe('han');
    expect(kindOf({ team: 2, unitId: 'DeathTrooper' })).toBe('deathtrooper');
    // (one with no body here yet, and a class)
    expect(kindOf({ team: 1, unitId: 'yoda' })).toBe('hothtrooper');
    expect(kindOf({ team: 2, unitId: null })).toBe('snowtrooper');
    for (const kind of Object.values(UNIT_KINDS)) expect(BODIES[kind]).toBeTruthy();
  });

  it('loads a hero on its light cut with its own clips, and builds the figure again when the id comes back as another unit', async () => {
    const loads = [];
    const figs = createFigures({ scene: new THREE.Scene(), loadBody: async (url, kind) => (loads.push([url, kind]), body()), held: createHeld({ load: () => Promise.resolve({ scene: new THREE.Group(), animations: [] }) }), loadStance: () => Promise.resolve(new Map()) });
    figs.update([soldier], 0.016);
    await settle();
    const trooper = figs.figure(3);
    figs.update([{ ...soldier, unitId: 'darthvader', t: 1 }], 0.016);
    await settle();
    expect(loads).toEqual([
      ['/models/galaxy/bf2017/crew/snowtrooper.lod1.glb', 'snowtrooper'],
      ['/models/galaxy/bf2017/crew/vader.lod1.glb', 'vader'],
    ]);
    expect(figs.figure(3)).not.toBe(trooper);
    expect(figs.figure(3).kind).toBe('vader');
    expect(trooper.model.parent).toBe(null);
  });
});

describe('the near body fetched ahead', () => {
  const cutsAt = (level, asked) => ({ of: (kind) => (kind === 'snowtrooper' ? { lod: true, far: true, full: true, fullMB: 1, fullDL: 1 } : null), level, lowData: false, load: (u) => (asked.push(u), Promise.resolve({})) });
  it('asks for the kind’s LOD0 on a level that draws it near, and nothing on one that never does', async () => {
    const asked = [];
    await preloadBody('snowtrooper', cutsAt('high', asked));
    expect(asked).toEqual([BODIES.snowtrooper.url]);
    expect(preloadBody('snowtrooper', cutsAt('low', asked))).toBe(null);
    expect(preloadBody('hothtrooper', cutsAt('high', asked))).toBe(null);
    expect(asked).toHaveLength(1);
  });
});
