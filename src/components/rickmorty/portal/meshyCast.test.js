import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { assetUrl, createMeshyCast, cullWithin, FOLDERS, heading } from './meshyCast';
import { meshyRig as fixtureRig, swingClip } from '../../../lib/three/meshyRig.fixture';

// a skinned figure 1.8 m tall, as a Meshy rig arrives: its mesh under a
// node scaled to the rig's centimetres, its positions in those units
function figure() {
  const geo = new THREE.BoxGeometry(50, 180, 30).translate(0, 90, 0);
  const n = geo.attributes.position.count;
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0), 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(n).fill([1, 0, 0, 0]).flat(), 4));
  const root = new THREE.Bone();
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
  const rig = new THREE.Group();
  rig.scale.setScalar(0.01);
  rig.add(root, mesh);
  mesh.bind(new THREE.Skeleton([root]));
  const group = new THREE.Group();
  group.add(rig);
  group.updateMatrixWorld(true);
  return { group, mesh };
}
const frustumAt = (x, z) => {
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  cam.position.set(x, 1.2, z);
  cam.lookAt(x, 1.0, z - 5);
  cam.updateMatrixWorld();
  return new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
};

describe('a Meshy figure’s culling', () => {
  it('culls a skinned figure within a sphere round the whole figure, whatever its rig’s units', () => {
    const { group, mesh } = figure();
    cullWithin(mesh, group, 1.8);
    expect(mesh.frustumCulled).toBe(true);
    const world = mesh.boundingSphere.clone().applyMatrix4(mesh.matrixWorld);
    expect(world.center.y).toBeCloseTo(0.9, 5);
    expect(world.radius).toBeCloseTo(1.8 * 0.8, 5);
  });
  it('is seen in front of the camera, close or off to one side, and not behind it', () => {
    const { group, mesh } = figure();
    cullWithin(mesh, group, 1.8);
    const f = frustumAt(0, 5);
    for (const [x, z, seen] of [
      [0, 0, true],
      [0, 3.6, true],
      [2.2, 1, true],
      [0, 8, false],
    ]) {
      group.position.set(x, 0, z);
      group.updateMatrixWorld(true);
      expect(f.intersectsObject(mesh), `${x},${z}`).toBe(seen);
    }
  });
});

describe('a figure of the site’s own in the cast', () => {
  it('names Portal panic’s cast by name and anyone else by their whole path', () => {
    expect(assetUrl('rick')).toBe('/games/meshy/rick.glb');
    expect(assetUrl('/models/albuquerque/walt.glb')).toBe('/models/albuquerque/walt.glb');
    expect(assetUrl(Object.keys(FOLDERS)[0])).toBe(`${Object.values(FOLDERS)[0]}/${Object.keys(FOLDERS)[0]}.glb`);
  });

  // a rig as Meshy’s come: the hips `hipsY` up under a node scaled to centimetres
  const rig = (hipsY) => {
    const hips = new THREE.Bone();
    hips.name = 'Hips';
    hips.position.y = hipsY;
    const geo = new THREE.BoxGeometry(50, 180, 30).translate(0, 90, 0);
    const n = geo.attributes.position.count;
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0), 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(n).fill([1, 0, 0, 0]).flat(), 4));
    const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial());
    const armature = new THREE.Group();
    armature.scale.setScalar(0.01);
    armature.add(hips, mesh);
    mesh.bind(new THREE.Skeleton([hips]));
    const scene = new THREE.Group();
    scene.add(armature);
    return scene;
  };
  const rickClip = (name) => new THREE.AnimationClip(name, 1, [new THREE.QuaternionKeyframeTrack('Hips.quaternion', [0], [0, 0, 0, 1]), new THREE.VectorKeyframeTrack('Hips.position', [0], [0, 90, 0])]);

  it('loads one by its path and walks it on Rick’s clips, scaled to its hips', async () => {
    const urls = [];
    const loader = {
      async loadAsync(url) {
        urls.push(url);
        return url.includes('/rick-') ? { scene: rig(93.3), animations: [rickClip(url)] } : { scene: rig(98), animations: [] };
      },
    };
    const WALT = '/models/albuquerque/walt.glb';
    const cast = createMeshyCast({ kinds: { walt: { a: WALT, h: 1.79 } }, rigged: new Set([WALT]), loader });
    await cast.load(null, [WALT], { clips: ['idle', 'walk'] });
    expect(urls).toEqual(expect.arrayContaining([WALT, '/games/meshy/rick-idle.glb', '/games/meshy/rick-walk.glb']));
    expect(urls.some((u) => u.includes('walt-'))).toBe(false); // (he has no clips of his own to look for)
    const f = cast.make('walt');
    expect(f.meshy).toBe(true);
    expect(Object.keys(f.act).sort()).toEqual(['idle', 'walk']);
    const hips = f.act.walk.getClip().tracks.find((t) => t.name === 'Hips.position');
    expect(hips.values[1]).toBeCloseTo((90 * 98) / 93.3, 4);
    cast.dispose();
  });
});

// A rig as Meshy's come: the hips 93 up under an armature scaled to
// centimetres, and (with `turn`) turned a quarter over, so its up is no
// longer y in the armature's own space.
function meshyRig(turn = 0) {
  const hips = new THREE.Bone();
  hips.name = 'Hips';
  hips.position.y = 93;
  const geo = new THREE.BoxGeometry(50, 180, 30).translate(0, 90, 0);
  const n = geo.attributes.position.count;
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0), 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(n).fill([1, 0, 0, 0]).flat(), 4));
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial());
  const armature = new THREE.Group();
  armature.scale.setScalar(0.01);
  armature.rotation.x = turn;
  armature.add(hips, mesh);
  mesh.bind(new THREE.Skeleton([hips]));
  const scene = new THREE.Group();
  scene.add(armature);
  return scene;
}
// the up axis in the armature's space, as the cast works it out
const armatureUp = (turn) => new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(turn, 0, 0)).invert());

// A loader that hands out Rick (rick.glb) and his clips (rick-<name>.glb),
// and the shared ones (clips-<name>.glb): each clip a second long, one track,
// the hips turned `twists[name]` about `up` the whole way through. `have`
// says which of Rick's own there are; the rest 404. Every url asked for is
// kept, to count fetches.
function fakeLoader({ turn = 0, have = ['idle', 'walk', 'run'], twists = {} } = {}) {
  const up = armatureUp(turn);
  const urls = [];
  const clip = (name) => {
    const q = new THREE.Quaternion().setFromAxisAngle(up, twists[name] ?? 0).toArray();
    return new THREE.AnimationClip(name, 1, [new THREE.QuaternionKeyframeTrack('Hips.quaternion', [0, 1], [...q, ...q])]);
  };
  return {
    urls,
    async loadAsync(url) {
      urls.push(url);
      const own = url.match(/\/rick-(\w+)\.glb$/);
      if (own && !have.includes(own[1])) throw new Error('404');
      const name = own?.[1] ?? url.match(/\/clips-(\w+)\.glb$/)?.[1];
      if (name) return { scene: meshyRig(), animations: [clip(name)] };
      return { scene: meshyRig(turn), animations: [] };
    },
  };
}
// Rick without his flask, so nothing fidgets in a test's way
const KINDS = { rick: { a: 'rick', h: 2.35 } };
const castOf = async (opts, clips) => {
  const loader = fakeLoader(opts);
  const cast = createMeshyCast({ kinds: KINDS, loader });
  await cast.load(null, ['rick'], { clips });
  return { cast, loader, c: cast.make('rick') };
};
// a clock for one figure: tick(s) runs it s seconds on at 20 frames a second
const clock = (c, move = 0) => {
  let t = 0;
  c.update(t, move, 0);
  return (s) => {
    const end = t + s - 1e-9;
    while (t < end) {
      t += 0.05;
      c.update(t, move, 0);
    }
  };
};

describe('a Meshy figure’s line', () => {
  const inksOf = (c) => {
    const meshes = [];
    const inks = [];
    c.group.traverse((o) => o.isMesh && (o.userData.ink ? inks : meshes).push(o));
    return { meshes, inks };
  };

  it('has a line round it when the cast is asked for one: a hull on its own skeleton, culled with it, freed with it', async () => {
    const cast = createMeshyCast({ kinds: KINDS, loader: fakeLoader(), cull: true, ink: 0.01 });
    await cast.load(null, ['rick']);
    const c = cast.make('rick');
    const { meshes, inks } = inksOf(c);
    expect(meshes.length).toBeGreaterThan(0);
    expect(inks).toHaveLength(meshes.length);
    for (const h of inks) {
      const src = meshes.find((m) => m.geometry === h.geometry);
      expect(src).toBeDefined();
      expect(h.isSkinnedMesh).toBe(src.isSkinnedMesh);
      if (src.isSkinnedMesh) expect(h.skeleton).toBe(src.skeleton);
      expect(h.material.side).toBe(THREE.BackSide);
      expect(h.frustumCulled).toBe(true);
      if (src.isSkinnedMesh) expect(h.boundingSphere.equals(src.boundingSphere)).toBe(true);
    }
    let freed = 0;
    for (const h of inks) h.material.addEventListener('dispose', () => (freed += 1));
    c.release();
    expect(freed).toBe(new Set(inks.map((h) => h.material)).size);
    cast.dispose();
  });

  it('has none unless the cast is asked for one', async () => {
    const { cast, c } = await castOf();
    expect(inksOf(c).inks).toHaveLength(0);
    cast.dispose();
  });
});

describe('a Meshy figure’s one-shots', () => {
  it('replaying the clip that is playing restarts it, never cuts it', async () => {
    const { cast, c } = await castOf();
    const tick = clock(c);
    await c.play('punch');
    tick(0.1);
    const a = c.act.punch;
    const w = a.getEffectiveWeight();
    expect(w).toBeGreaterThan(0);
    await c.play('punch'); // (a punch chain)
    expect(a.time).toBe(0);
    expect(a.getEffectiveWeight()).toBeCloseTo(w, 6);
    tick(0.05);
    expect(a.isRunning()).toBe(true);
    expect(a.getEffectiveWeight()).toBeGreaterThan(0);
    tick(0.3);
    expect(a.isRunning()).toBe(true);
    expect(a.getEffectiveWeight()).toBe(1);
    cast.dispose();
  });

  it('a second clip fades the first out fully, even one cut while still fading', async () => {
    const { cast, c } = await castOf();
    const tick = clock(c);
    await c.play('wave', { loop: true });
    tick(0.1);
    await c.play('cheer', { loop: true });
    tick(0.05);
    await c.play('happy', { loop: true }); // (the wave's still fading out)
    tick(1);
    for (const n of ['wave', 'cheer']) {
      expect(c.act[n].getEffectiveWeight(), n).toBe(0);
      expect(c.act[n].isRunning(), n).toBe(false);
    }
    expect(c.act.happy.getEffectiveWeight()).toBe(1);
    cast.dispose();
  });
});

describe('a Meshy figure’s idle, walk and run', () => {
  const sum = (c) => ['idle', 'walk', 'run'].reduce((s, n) => s + (c.act[n]?.getEffectiveWeight() ?? 0), 0);

  it('weighs its three clips to the whole at any pace', async () => {
    const { cast, c } = await castOf();
    for (const move of [0, 0.2, 0.5, 0.7, 1]) {
      clock(c, move)(0.1);
      expect(sum(c), `move ${move}`).toBeCloseTo(1, 6);
    }
    cast.dispose();
  });

  it('a missing run hands its weight to the walk, played faster', async () => {
    const { cast, c } = await castOf({ have: ['idle', 'walk'] }, ['idle', 'walk', 'run']);
    expect(c.act.run).toBeUndefined();
    clock(c, 1)(0.1);
    expect(sum(c)).toBeCloseTo(1, 6);
    expect(c.act.walk.getEffectiveWeight()).toBeGreaterThanOrEqual(0.99);
    expect(c.act.walk.timeScale).toBeGreaterThan(1.5);
    cast.dispose();
  });

  it('a missing walk hands its weight to the idle', async () => {
    const { cast, c } = await castOf({ have: ['idle'] }, ['idle', 'walk', 'run']);
    clock(c, 0.6)(0.1);
    expect(c.act.idle.getEffectiveWeight()).toBe(1);
    cast.dispose();
  });

  it('update takes an explicit dt, clamped as a frame is', async () => {
    const { cast, c } = await castOf();
    c.update(5, 0, 0, { dt: 0.02 });
    expect(c.mixer.time).toBeCloseTo(0.02, 9);
    c.update(9, 0, 0, { dt: 0.02 }); // (the clock jumped; the frame didn't)
    expect(c.mixer.time).toBeCloseTo(0.04, 9);
    c.update(10, 0, 0, { dt: 1 }); // (a tab come back to)
    expect(c.mixer.time).toBeCloseTo(0.14, 9);
    cast.dispose();
  });
});

describe('a Meshy figure’s clips, asked for', () => {
  const count = (urls, u) => urls.filter((x) => x === u).length;

  it('a later load adds clips to a figure already loaded, fetching the model once', async () => {
    const loader = fakeLoader();
    const cast = createMeshyCast({ kinds: KINDS, loader });
    await cast.load(null, ['rick'], { clips: ['idle'] });
    expect(cast.make('rick').act.run).toBeUndefined();
    await cast.load(null, ['rick'], { clips: ['idle', 'run'] });
    expect(Object.keys(cast.make('rick').act).sort()).toEqual(['idle', 'run']);
    expect(count(loader.urls, '/games/meshy/rick.glb')).toBe(1);
    expect(count(loader.urls, '/games/meshy/rick-idle.glb')).toBe(1);
    cast.dispose();
  });

  it('two asks at once for one figure fetch it once and both get their clips', async () => {
    const loader = fakeLoader();
    const cast = createMeshyCast({ kinds: KINDS, loader });
    await Promise.all([cast.load(null, ['rick'], { clips: ['idle', 'walk'] }), cast.load(null, ['rick'], { clips: ['idle', 'run'] })]);
    expect(Object.keys(cast.make('rick').act).sort()).toEqual(['idle', 'run', 'walk']);
    expect(count(loader.urls, '/games/meshy/rick.glb')).toBe(1);
    expect(count(loader.urls, '/games/meshy/rick-idle.glb')).toBe(1);
    cast.dispose();
  });

  it('a figure that didn’t load is tried again when asked again', async () => {
    let fail = true;
    const inner = fakeLoader();
    const loader = { urls: inner.urls, loadAsync: (url) => (fail && url.endsWith('/rick.glb') ? Promise.reject(new Error('offline')) : inner.loadAsync(url)) };
    const cast = createMeshyCast({ kinds: KINDS, loader });
    await cast.load(null, ['rick'], { clips: ['idle'] });
    expect(cast.make('rick')).toBeNull();
    fail = false;
    await cast.load(null, ['rick'], { clips: ['idle'] });
    expect(cast.make('rick')?.act.idle).toBeTruthy();
    cast.dispose();
  });
});

describe('a Meshy figure’s shared clips', () => {
  it('a shared clip is turned to face where the walk faces', async () => {
    const turn = Math.PI / 2;
    const up = armatureUp(turn);
    const { cast, c } = await castOf({ turn, twists: { walk: 0.3, idle: 1.0, wave: -0.9 } }, ['idle', 'walk']);
    const walk = c.act.walk.getClip();
    const first = (clip) => clip.tracks.find((t) => t.name === 'Hips.quaternion').values.slice(0, 4);
    expect(heading(walk, up)).toBeCloseTo(0.3, 6);
    expect(heading(c.act.idle.getClip(), up)).toBeCloseTo(0.3, 6); // (its own, as ever)
    await c.play('wave');
    const wave = c.act.wave.getClip();
    expect(heading(wave, up)).toBeCloseTo(0.3, 6);
    first(wave).forEach((v, i) => expect(v).toBeCloseTo(first(walk)[i], 6));
    cast.dispose();
  });
});

describe('a Meshy figure on its animator', () => {
  it('has one, and a played clip reaches it', async () => {
    const { cast, c } = await castOf();
    const tick = clock(c);
    expect(c.anim).toBeTruthy();
    expect(c.mixer).toBe(c.anim.mixer);
    expect(await c.play('wave')).toBe(true);
    expect(c.anim.playing('full')).toBe('wave');
    expect(c.act.wave).toBe(c.anim.actions.wave);
    tick(0.1);
    expect(c.act.wave.getEffectiveWeight()).toBeGreaterThan(0);
    expect(await c.play('nonesuch')).toBe(false);
    cast.dispose();
  });

  it('keeps a one-shot on its last frame for its hold, then lets it go', async () => {
    const { cast, c } = await castOf();
    const tick = clock(c);
    await c.play('fall', { hold: 0.5 }); // (a second long)
    tick(1.05);
    await flush(); // (a frame's end: its end heard)
    tick(0.3);
    expect(c.anim.playing('full')).toBe('fall');
    expect(c.act.fall.getEffectiveWeight()).toBe(1);
    tick(0.3);
    expect(c.anim.playing('full')).toBe(null);
    tick(0.5);
    expect(c.act.fall.getEffectiveWeight()).toBe(0);
    cast.dispose();
  });

  it('plays nothing and reacts to nothing when it isn’t rigged, without throwing', async () => {
    const loader = fakeLoader();
    const cast = createMeshyCast({ kinds: { blob: { a: 'cronenberg', h: 0.75 } }, rigged: new Set(), loader });
    await cast.load(null, ['cronenberg']);
    const c = cast.make('blob');
    expect(c.anim).toBe(null);
    expect(c.mixer).toBeUndefined();
    expect(c.react('hit', { t: 1 })).toBe(null);
    expect(await c.play('wave')).toBe(false);
    expect(await c.base('sit')).toBe('cut');
    expect(() => c.look({ x: 1, z: 2 })).not.toThrow();
    expect(() => c.stop()).not.toThrow();
    cast.dispose();
  });
});

// A cast on Meshy's own skeleton (the animator's fixture): Rick's idle, walk
// and run, his sat clip (the legs folded up), and the library's clips made
// on it: a hit that throws the chest back, a talk that does nothing much.
// Each load a fresh copy, as a file's parse is.
function seatLoader() {
  const rig = () => {
    const r = fixtureRig();
    r.model.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.3).translate(0, 0.9, 0), new THREE.MeshStandardMaterial()));
    return r;
  };
  const sat = (n) => (/UpLeg$/.test(n) ? -1.5 : /Leg$/.test(n) ? 1.5 : 0);
  const made = {
    idle: (r) => r.clips.idle,
    walk: (r) => r.clips.walk,
    run: (r) => r.clips.run,
    sit: (r) => swingClip(r, 'sit', 2, sat),
    hit: (r) => swingClip(r, 'hit', 0.8, (n, t) => (n === 'Spine02' ? 0.7 * Math.sin((Math.PI * t) / 0.8) : 0)),
    'hit.chest': (r) => swingClip(r, 'hit.chest', 0.6, (n, t) => (n === 'Spine01' ? 0.5 * Math.sin((Math.PI * t) / 0.6) : 0)),
    talk: (r) => swingClip(r, 'talk', 2, () => 0),
  };
  return {
    async loadAsync(url) {
      const name = url.match(/\/(?:rick|clips|ual)-([\w.]+)\.glb$/)?.[1];
      const r = rig();
      if (!name) return { scene: r.model, animations: [] };
      if (!made[name]) throw new Error('404');
      return { scene: r.model, animations: [made[name](r)] };
    },
  };
}
const flush = () => new Promise((r) => setTimeout(r, 0));
const seated = async () => {
  const cast = createMeshyCast({ kinds: { rick: { a: 'rick', h: 1.8 } }, loader: seatLoader() });
  await cast.load(null, ['rick'], { clips: ['idle', 'walk', 'run', 'sit'] });
  return { cast, c: cast.make('rick') };
};
const valueOf = (clip, bone) => new THREE.Quaternion(...clip.tracks.find((t) => t.name === `${bone}.quaternion`).values.slice(0, 4));
const same = (q, want) => Math.abs(q.dot(want)) / (q.length() * want.length());

describe('a Meshy figure’s strides and clocks', () => {
  it('measures a stride for each height one model stands at', async () => {
    const cast = createMeshyCast({ kinds: { big: { a: 'rick', h: 2.2 }, small: { a: 'rick', h: 1.6 } }, loader: seatLoader() });
    await cast.load(null, ['rick'], { clips: ['idle', 'walk', 'run'] });
    const a = cast.make('big');
    const b = cast.make('small');
    expect(a.anim.loco.strides.walk.speed).toBeGreaterThan(0);
    expect(a.anim.loco.strides.walk.speed / b.anim.loco.strides.walk.speed).toBeCloseTo(2.2 / 1.6, 3);
    cast.dispose();
  });

  it('starts each copy of a figure somewhere of its own in its idle', async () => {
    const { cast } = await seated();
    const [a, b, c] = [cast.make('rick'), cast.make('rick'), cast.make('rick', 0, { seed: 9 })];
    expect(a.act.idle.time).not.toBeCloseTo(b.act.idle.time, 3);
    expect(cast.make('rick', 0, { seed: 9 }).act.idle.time).toBeCloseTo(c.act.idle.time, 9);
    cast.dispose();
  });
});

describe('a Meshy figure sat down', () => {
  it('sits on its own sat clip through base, and a hit on its upper half leaves it sat', async () => {
    const { cast, c } = await seated();
    const tick = clock(c);
    const there = c.base('sit');
    tick(1);
    expect(await there).toBe('done');
    const sit = c.act.sit.getClip();
    expect(c.act.sit.getEffectiveWeight()).toBe(1);
    expect(c.act.idle.getEffectiveWeight()).toBe(0);
    expect(await c.play('hit', { layer: 'upper' })).toBe(true);
    tick(0.4); // (the hit at its height)
    const bone = (n) => c.group.getObjectByName(n);
    expect(c.anim.playing('upper')).toBe('hit');
    expect(c.anim.playing('full')).toBe(null);
    expect(c.act.sit.getEffectiveWeight()).toBe(1);
    expect(same(bone('LeftUpLeg').quaternion, valueOf(sit, 'LeftUpLeg'))).toBeCloseTo(1, 6);
    expect(same(bone('RightLeg').quaternion, valueOf(sit, 'RightLeg'))).toBeCloseTo(1, 6);
    expect(same(bone('Spine02').quaternion, valueOf(sit, 'Spine02'))).toBeLessThan(0.99);
    tick(1);
    expect(c.anim.playing('upper')).toBe(null);
    expect(c.act.sit.getEffectiveWeight()).toBe(1);
    cast.dispose();
  });

  it('reacts on its upper half while it sits, and stands again on its feet', async () => {
    const { cast, c } = await seated();
    const tick = clock(c);
    c.base('sit');
    tick(1);
    const r = c.react('hit', { t: 1 });
    expect(r).toMatchObject({ clip: 'hit.chest', layer: 'upper' });
    await flush(); // (its clip fetched)
    tick(0.3);
    expect(c.anim.playing('upper')).toBe('hit.chest');
    expect(c.act.sit.getEffectiveWeight()).toBe(1);
    expect(c.react('hit', { t: 1 })).toBe(null); // (its cooldown)
    c.base(null);
    tick(1);
    expect(c.act.sit.getEffectiveWeight()).toBe(0);
    expect(['idle', 'walk', 'run'].reduce((s, n) => s + c.act[n].getEffectiveWeight(), 0)).toBeCloseTo(1, 6);
    cast.dispose();
  });

  it('looks at whom it talks to while its line plays, and back again after', async () => {
    const { cast, c } = await seated();
    const tick = clock(c);
    tick(0.5);
    const head = c.group.getObjectByName('Head');
    const before = head.getWorldQuaternion(new THREE.Quaternion());
    const yaw = () => {
      const r = head.getWorldQuaternion(new THREE.Quaternion()).multiply(before.clone().invert());
      return 2 * Math.atan2(r.y, r.w);
    };
    // (someone off to its left, +x, as it faces +z)
    expect(c.react('say', { target: { x: 5, z: 0 }, hold: 1 })).toMatchObject({ clip: 'talk', layer: 'upper', hold: 1 });
    await flush(); // (its clip fetched)
    tick(0.8);
    expect(c.anim.playing('upper')).toBe('talk');
    expect(yaw()).toBeGreaterThan(0.6);
    tick(4);
    expect(c.anim.playing('upper')).toBe(null);
    expect(Math.abs(yaw())).toBeLessThan(0.1);
    cast.dispose();
  });
});

describe('a Meshy figure without a skeleton', () => {
  const blobs = async () => {
    const cast = createMeshyCast({ kinds: { blob: { a: 'cronenberg', h: 0.75 } }, rigged: new Set(), loader: fakeLoader() });
    await cast.load(null, ['cronenberg']);
    return cast;
  };
  // s seconds at 60 frames a second, its group moved `speed` a second along x
  const walk = (c, s, speed) => {
    for (let i = 0; i < Math.round(s * 60); i++) {
      c.group.position.x += speed / 60;
      c.update(0, 0, 0, { dt: 1 / 60 });
    }
  };

  it('lurches with the ground it covers, not the clock', async () => {
    const cast = await blobs();
    const a = cast.make('blob', 0, { seed: 7 });
    const b = cast.make('blob', 0, { seed: 7 });
    a.update(0, 0, 0, { dt: 0 });
    b.update(0, 0, 0, { dt: 0 });
    const heights = [];
    for (let i = 0; i < 120; i++) {
      walk(a, 1 / 60, 0.9);
      heights.push(a.body.position.y);
    }
    walk(b, 1, 1.8); // (as far in half the time)
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.01);
    expect(b.body.position.y).toBeCloseTo(a.body.position.y, 4);
    expect(b.body.rotation.z).toBeCloseTo(a.body.rotation.z, 4);
    cast.dispose();
  });

  it('stands still and breathes, each in its own time', async () => {
    const cast = await blobs();
    const a = cast.make('blob', 0, { seed: 1 });
    const b = cast.make('blob', 0, { seed: 2 });
    const breaths = [];
    for (let i = 0; i < 240; i++) {
      a.update(0, 0, 0, { dt: 1 / 60 });
      b.update(0, 0, 0, { dt: 1 / 60 });
      expect(a.body.position.y).toBe(0);
      breaths.push(a.body.scale.y);
    }
    expect(Math.max(...breaths) - Math.min(...breaths)).toBeGreaterThan(0.01);
    expect(Math.abs(a.body.scale.y - b.body.scale.y)).toBeGreaterThan(1e-3);
    cast.dispose();
  });
});

describe('a figure done with, the cast kept', () => {
  it("frees what was made for that one figure alone (a clone's shirt), and nothing the others share", async () => {
    const loader = {
      async loadAsync() {
        const scene = meshyRig();
        scene.traverse((o) => {
          if (o.isMesh) o.material.map = new THREE.Texture();
        });
        return { scene, animations: [] };
      },
    };
    const cast = createMeshyCast({ kinds: { clone: { a: 'morty', h: 1.95, shirts: [0xf3d84b, 0x7fc77a] } }, rigged: new Set(), loader });
    await cast.load(null, ['morty']);
    const a = cast.make('clone', 0);
    const b = cast.make('clone', 1);
    const shirtOf = (c) => {
      let m = null;
      c.group.traverse((o) => {
        if (o.isMesh) m = o.material;
      });
      return m;
    };
    let freed = [];
    for (const c of [a, b]) shirtOf(c).addEventListener('dispose', (e) => freed.push(e.target));
    a.release();
    expect(freed).toEqual([shirtOf(a)]);
    // (and the cast's own clean-up doesn't free it again)
    freed = [];
    cast.dispose();
    expect(freed).toEqual([shirtOf(b)]);
  });
});
