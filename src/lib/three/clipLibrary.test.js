import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CLIPS, RICK_HIPS, borrowClips, faceAhead, faceForward, forFigure, heading, loadClip, preload, retarget } from './clipLibrary';
import { SHARED_CLIPS } from '../../components/rickmorty/portal/meshyCast';

const Y = new THREE.Vector3(0, 1, 0);
// a clip whose hips turn about y by `a` (radians), and a few other tracks a Meshy clip has
const clip = (a, name = 'idle') => {
  const q = new THREE.Quaternion().setFromAxisAngle(Y, a);
  return new THREE.AnimationClip(name, 1, [
    new THREE.QuaternionKeyframeTrack('Hips.quaternion', [0, 1], [...q.toArray(), ...q.toArray()]),
    new THREE.VectorKeyframeTrack('Hips.position', [0, 1], [0, 90, 1, 2, 88, 3]),
    new THREE.QuaternionKeyframeTrack('Spine.quaternion', [0], [0, 0, 0, 1]),
    new THREE.VectorKeyframeTrack('Spine.position', [0], [0, 10, 0]),
    new THREE.VectorKeyframeTrack('Hips.scale', [0], [1, 1, 1]),
  ]);
};
// a GLB's scene, with the hips standing `y` high
const sceneWithHips = (y) => {
  const hips = new THREE.Bone();
  hips.name = 'Hips';
  hips.position.y = y;
  const scene = new THREE.Group();
  scene.add(hips);
  return scene;
};
// a loader that hands out a clip per URL (turned `turns[url]` about y), counting its fetches
const fakeLoader = (turns = {}, hipsY = 93.3) => ({
  loadAsync: vi.fn(async (url) => ({ scene: sceneWithHips(hipsY), animations: [clip(turns[url] ?? 0, url)] })),
});

describe('borrowing Rick’s clips', () => {
  it('keeps the bones’ turns and scales only the hips’ height to the figure’s', () => {
    const c = clip(0.3);
    const r = retarget(c, RICK_HIPS * 2);
    expect(r.tracks.map((t) => t.name)).toEqual(['Hips.quaternion', 'Hips.position', 'Spine.quaternion']);
    expect([...r.tracks[1].values]).toEqual([0, 180, 2, 4, 176, 6]);
    expect([...c.tracks[1].values]).toEqual([0, 90, 1, 2, 88, 3]); // (Rick’s own left as it was: it’s shared)
    expect(r.duration).toBe(1);
    expect(retarget(null, 90)).toBeNull();
  });

  it('scales from the hips the clip was made on, where it says', () => {
    const r = retarget(clip(0), 100, 50);
    expect(r.tracks[1].values[1]).toBe(180);
  });

  it('retarget scales a mixamorig:Hips translation (the hips by role, any family)', () => {
    const q = [0, 0, 0, 1];
    const c = new THREE.AnimationClip('walk', 1, [
      new THREE.VectorKeyframeTrack('mixamorig:Hips.position', [0], [1, 90, 2]),
      new THREE.QuaternionKeyframeTrack('mixamorig:Hips.quaternion', [0], q),
      new THREE.VectorKeyframeTrack('mixamorig:Spine.position', [0], [0, 10, 0]),
      // Character Creator's hip holds the pelvis: the role's first name wins, the pelvis isn't scaled twice
      new THREE.VectorKeyframeTrack('CC_Base_Pelvis.position', [0], [0, 5, 0]),
    ]);
    const r = retarget(c, 180, 90);
    expect(r.tracks.map((t) => t.name)).toEqual(['mixamorig:Hips.position', 'mixamorig:Hips.quaternion']);
    expect([...r.tracks[0].values]).toEqual([2, 180, 4]);
    const cc = retarget(new THREE.AnimationClip('cc', 1, [new THREE.VectorKeyframeTrack('CC_Base_Hip.position', [0], [0, 50, 0]), new THREE.VectorKeyframeTrack('CC_Base_Pelvis.position', [0], [0, 5, 0])]), 100, 50);
    expect(cc.tracks.map((t) => [t.name, t.values[1]])).toEqual([['CC_Base_Hip.position', 100]]);
  });

  it('turns a clip’s hips so it faces where the walk does', () => {
    const idle = clip(0.9);
    expect(heading(idle, Y)).toBeCloseTo(0.9, 5);
    faceForward(idle, Y, -0.2);
    expect(heading(idle, Y)).toBeCloseTo(-0.2, 5);
    const clips = { idle: clip(1.1), walk: clip(0.25, 'walk'), run: clip(-0.4, 'run'), sit: null };
    faceAhead(clips, Y);
    for (const n of ['idle', 'walk', 'run']) expect(heading(clips[n], Y), n).toBeCloseTo(0.25, 5);
    expect(heading(new THREE.AnimationClip('x', 1, []), Y)).toBeNull();
  });

  it('fetches each of Rick’s clips once, whoever borrows it, noting the hips it was made on', async () => {
    const loader = fakeLoader();
    const a = await borrowClips(['jump', 'crawl'], { loader });
    const b = await borrowClips(['crawl'], { loader });
    expect(loader.loadAsync.mock.calls.map(([u]) => u)).toEqual(['/games/meshy/rick-jump.glb', '/games/meshy/rick-crawl.glb']);
    expect(b.crawl).toBe(a.crawl);
    expect(a.jump.userData.hips).toBe(93.3);
    const none = { loadAsync: vi.fn(async () => Promise.reject(new Error('404'))) };
    expect((await borrowClips(['swim'], { loader: none })).swim).toBeNull();
  });
});

describe('the clip library', () => {
  it('names every shared clip meshyCast plays, Rick’s four and the troopers’', () => {
    expect(SHARED_CLIPS.every((n) => CLIPS[n]?.url === `/games/meshy/clips-${n}.glb`)).toBe(true);
    for (const n of ['idle', 'walk', 'run', 'sit']) expect(CLIPS[n].url).toBe(`/games/meshy/rick-${n}.glb`);
    for (const n of ['die.back', 'die.fwd', 'die.blown', 'kneel', 'taunt.trooper', 'hit.trooper']) expect(CLIPS[n].url, n).toMatch(/^\/models\/galaxy\/troops\/clip-\w+\.glb$/);
  });

  it('has a file on disk for every clip it names', () => {
    for (const [n, c] of Object.entries(CLIPS)) expect(existsSync(`public${c.url}`), n).toBe(true);
  });

  it('loadClip fetches once and keeps the hips height', async () => {
    const loader = fakeLoader();
    const [a, b] = await Promise.all([loadClip('wave', { loader }), loadClip('wave', { loader })]);
    const c = await loadClip('wave', { loader });
    expect(loader.loadAsync.mock.calls.map(([u]) => u)).toEqual(['/games/meshy/clips-wave.glb']);
    expect(a).toBe(b);
    expect(c).toBe(a);
    expect(a.userData.hips).toBe(93.3);
    expect(await loadClip('no.such.clip', { loader })).toBeNull();
    // Rick’s own, fetched once whether borrowed or loaded by name
    const idle = await loadClip('idle', { loader });
    expect((await borrowClips(['idle'], { loader })).idle).toBe(idle);
    expect(loader.loadAsync.mock.calls.filter(([u]) => u === '/games/meshy/rick-idle.glb')).toHaveLength(1);
    // a file that won't load is null, not a throw
    const none = { loadAsync: vi.fn(async () => Promise.reject(new Error('404'))) };
    expect(await loadClip('cheer', { loader: none })).toBeNull();
  });

  it('takes a clip by name from a file that carries several, and the hips the entry says', async () => {
    const two = { scene: sceneWithHips(80), animations: [clip(0, 'A'), clip(0, 'B')] };
    const loader = { loadAsync: vi.fn(async () => two) };
    CLIPS['test.b'] = { url: '/test/two.glb', take: 'B' };
    CLIPS['test.a'] = { url: '/test/two.glb', take: 'A', hips: 70 };
    try {
      const [b, a] = await Promise.all([loadClip('test.b', { loader }), loadClip('test.a', { loader })]);
      expect(b.name).toBe('B');
      expect(b.userData.hips).toBe(80);
      expect(a.name).toBe('A');
      expect(a.userData.hips).toBe(70);
      expect(loader.loadAsync).toHaveBeenCalledTimes(1);
    } finally {
      delete CLIPS['test.b'];
      delete CLIPS['test.a'];
    }
  });

  it('forFigure scales the hips to the figure and caches per key', async () => {
    const loader = fakeLoader({ '/games/meshy/clips-cheer.glb': 1.1, '/games/meshy/rick-walk.glb': 0.25 }, 90);
    const tall = await forFigure('cheer', { hipsY: 180, up: Y, key: 'tall', loader });
    expect([...tall.tracks.find((t) => t.name === 'Hips.position').values]).toEqual([0, 180, 2, 4, 176, 6]);
    expect(tall.tracks.some((t) => t.name === 'Spine.position')).toBe(false);
    expect(heading(tall, Y)).toBeCloseTo(0.25, 5); // (turned to where the walk faces)
    const lib = await loadClip('cheer', { loader });
    expect(heading(lib, Y)).toBeCloseTo(1.1, 5); // (the library’s own left as it was)
    expect(lib.tracks.find((t) => t.name === 'Hips.position').values[1]).toBe(90);
    // the same template gets the same copy; another gets its own
    expect(await forFigure('cheer', { hipsY: 180, up: Y, key: 'tall', loader })).toBe(tall);
    const short = await forFigure('cheer', { hipsY: 45, up: Y, key: 'short', loader });
    expect(short).not.toBe(tall);
    expect(short.tracks.find((t) => t.name === 'Hips.position').values[1]).toBe(45);
    // faced where a figure says its own walk faces
    expect(heading(await forFigure('cheer', { hipsY: 90, up: Y, key: 'own', ahead: -0.5, loader }), Y)).toBeCloseTo(-0.5, 5);
    expect(await forFigure('no.such.clip', { hipsY: 90, up: Y, key: 'tall', loader })).toBeNull();
  });

  it('preload fetches every clip a world names, once', async () => {
    const loader = fakeLoader();
    expect(await preload(['drink', 'happy', 'drink'], { loader })).toBeUndefined();
    expect(loader.loadAsync.mock.calls.map(([u]) => u).sort()).toEqual(['/games/meshy/clips-drink.glb', '/games/meshy/clips-happy.glb']);
    await loadClip('happy', { loader });
    expect(loader.loadAsync).toHaveBeenCalledTimes(2);
  });
});

describe('Quaternius’s clips, baked', () => {
  // UAL's clip → ours (scripts/ual-bake.mjs's `life` set)
  const UAL = {
    Idle_Talking_Loop: 'talk',
    Sitting_Enter: 'sit.enter',
    Sitting_Idle_Loop: 'sit.idle',
    Sitting_Talking_Loop: 'sit.talk',
    Sitting_Exit: 'sit.exit',
    Crouch_Idle_Loop: 'crouch',
    Crouch_Fwd_Loop: 'crouch.walk',
    Interact: 'interact',
    PickUp_Table: 'pickup',
    Fixing_Kneeling: 'kneel.fix',
    Hit_Chest: 'hit.chest',
    Hit_Head: 'hit.head',
    Death01: 'die',
    Pistol_Aim_Neutral: 'aim.pistol',
    Pistol_Aim_Up: 'aim.pistol.up',
    Pistol_Aim_Down: 'aim.pistol.down',
    Pistol_Shoot: 'shoot.pistol',
    Pistol_Reload: 'reload',
    Punch_Jab: 'jab',
    Punch_Cross: 'cross',
    Roll: 'roll',
    Jump_Start: 'jump.start',
    Jump_Loop: 'jump.loop',
    Jump_Land: 'jump.land',
    Push_Loop: 'push',
    Spell_Simple_Enter: 'cast.enter',
    Spell_Simple_Idle_Loop: 'cast.idle',
    Spell_Simple_Shoot: 'cast',
    Sprint_Loop: 'sprint',
    Walk_Formal_Loop: 'walk.formal',
    Idle_Torch_Loop: 'torch',
    Dance_Loop: 'dance.ual',
    Swim_Fwd_Loop: 'swim',
    Swim_Idle_Loop: 'swim.idle',
    Driving_Loop: 'drive',
    Idle_Loop: 'idle.calm',
  };
  const ual = Object.entries(CLIPS).filter(([, c]) => c.url.startsWith('/games/meshy/ual-'));
  // a GLB's JSON chunk
  const glbJson = (buf) => JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));

  it('names every clip the bake makes, each in its own file, looping where UAL’s does', () => {
    expect(ual.map(([n]) => n).sort()).toEqual(Object.values(UAL).sort());
    for (const [from, n] of Object.entries(UAL)) {
      expect(CLIPS[n].url, n).toBe(`/games/meshy/ual-${n}.glb`);
      expect(CLIPS[n].loop === true, n).toBe(from.endsWith('_Loop'));
    }
  });

  it('has every UAL clip’s file, the whole body in it, and the hips it was made on', () => {
    for (const [n, c] of ual) {
      expect(existsSync(`public${c.url}`), n).toBe(true);
      const json = glbJson(readFileSync(`public${c.url}`));
      expect(json.animations, n).toHaveLength(1);
      const [anim] = json.animations;
      const moved = new Set(anim.channels.map((ch) => json.nodes[ch.target.node].name));
      for (const b of ['Hips', 'Spine02', 'Head', 'LeftArm', 'RightHand', 'LeftToeBase']) expect(moved.has(b), `${n} ${b}`).toBe(true);
      // (loadClip reads the hips off the Hips node: the same height the bake says)
      expect(anim.extras.hips, n).toBeCloseTo(json.nodes.find((o) => o.name === 'Hips').translation[1], 3);
    }
  });

  it('leaves the saber’s bake as it was', () => {
    const hash = createHash('sha256').update(readFileSync('public/games/meshy/ual-saber.glb')).digest('hex');
    expect(hash).toBe('0022d4c5d17db0250eb66c3aeb2ae4a2ec4d57a3c9f9400bfc6cb114b2022891');
  });
});
