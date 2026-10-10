import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { BODY, SOCKETS } from '../../lib/three/walrusRig.js';
import { isGameSkeleton } from '../../lib/physics/boneCapsules';

// The files a 2017 figure asks for: its body (no `.lod1` cut of it here) and
// the humanoid pack, an idle in it; and the library watched, which a 2017
// figure must never reach.
const loader = vi.hoisted(() => ({
  urls: [],
  loadAsync(url) {
    this.urls.push(url);
    return this.load(url);
  },
}));
const fetched = vi.hoisted(() => []);
const level = vi.hoisted(() => ({ now: 'low' }));
vi.mock('../../lib/three/gltf', async (orig) => ({ ...(await orig()), gltfLoader: () => loader }));
vi.mock('../../lib/detail', async (orig) => ({ ...(await orig()), detailLevel: () => level.now }));
vi.mock('../../lib/three/clipLibrary', async (orig) => ({ ...(await orig()), loadClip: (n) => (fetched.push(n), Promise.resolve(null)), forFigure: (n) => (fetched.push(n), Promise.resolve(null)) }));

const body = () => {
  const root = new THREE.Group();
  const hips = new THREE.Bone();
  hips.name = 'Hips';
  root.add(hips);
  for (const n of [...BODY.filter((b) => b !== 'Hips'), 'Neck1', 'HeadEnd', ...Object.values(SOCKETS)]) {
    const b = new THREE.Bone();
    b.name = n;
    b.position.y = n === 'HeadEnd' ? 0.8 : 0;
    hips.add(b);
  }
  root.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.7, 0.3), new THREE.MeshStandardMaterial()));
  return root;
};
const idle = new THREE.AnimationClip('idle', 1, [new THREE.QuaternionKeyframeTrack('Hips.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1])]);
// a pistol stance's clip: the hips turned a quarter, to tell it by
const pistol = (name) => new THREE.AnimationClip(name, 1, [new THREE.QuaternionKeyframeTrack('Hips.quaternion', [0, 1], [0, 0.7071, 0, 0.7071, 0, 0.7071, 0, 0.7071])]);
// an additive clip: the hips turned a quarter about x, by its delta
const additive = (name) => {
  const c = new THREE.AnimationClip(name, 0.5, [new THREE.QuaternionKeyframeTrack('Hips.quaternion', [0, 0.5], [0.7071, 0, 0, 0.7071, 0.7071, 0, 0, 0.7071])]);
  c.userData = { additive: true };
  return c;
};
// (a skinned body, its material named for the cut it came from)
const skinned = (cut) => {
  const root = body();
  const bones = [];
  root.traverse((o) => o.isBone && bones.push(o));
  const geo = new THREE.BoxGeometry(0.5, 1.7, 0.3);
  const n = geo.attributes.position.count;
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4), 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 ? 0 : 1)), 4));
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial({ name: cut }));
  mesh.bind(new THREE.Skeleton(bones));
  root.add(mesh);
  return root;
};
const cuts = vi.hoisted(() => ({ light: false }));
loader.load = async (url) => {
  if (cuts.light && url.includes('/hero.')) return { scene: skinned(url.includes('.lod1.') ? 'light' : 'full'), animations: [] };
  if (url.endsWith('.lod1.glb')) throw new Error('404');
  if (url.includes('clips-humanoid')) return { scene: new THREE.Group(), animations: [idle] };
  if (url.includes('clips-additive')) return { scene: new THREE.Group(), animations: [additive('add.hit.left'), additive('add.aim.up')] };
  if (url.includes('clips-stance-p')) return { scene: new THREE.Group(), animations: [pistol('stance.p.idle'), pistol('stance.p.walk')] };
  if (url.includes('/clips-')) throw new Error('404');
  return { scene: body(), animations: [] };
};

const { loadPartyFigure } = await import('./footScene');

describe('a 2017 hero out on foot', () => {
  const spec = { id: 'luke', name: 'Luke', tall: 1.72, rig: 'walrus', src: { url: '/models/galaxy/bf2017/crew/luke.glb' } };

  it('stands in its full file on a low device when its light cut is missing', async () => {
    const fig = await loadPartyFigure(spec, null);
    expect(fig?.rig).toBe('walrus');
    expect(loader.urls).toContain('/models/galaxy/bf2017/crew/luke.lod1.glb');
    expect(loader.urls).toContain('/models/galaxy/bf2017/crew/luke.glb');
    fig.dispose();
  });

  it('is hit where the game’s capsules say: its bones are the game’s skeleton’s', async () => {
    const fig = await loadPartyFigure(spec, null);
    expect(isGameSkeleton(fig.bones)).toBe(true);
    fig.dispose();
  });

  it('never fetches a library clip for a name its packs lack', async () => {
    const fig = await loadPartyFigure(spec, null);
    fetched.length = 0;
    expect(await fig.play('sword.dash')).toBe(false);
    expect(fig.react('hit', {})).toBeNull();
    fig.base('sit.idle');
    await Promise.resolve();
    expect(fetched).toEqual([]);
    fig.dispose();
  });

  it('stands in its light cut first and puts on the full one as it lands', async () => {
    level.now = 'high';
    cuts.light = true;
    const fig = await loadPartyFigure({ ...spec, id: 'hero', src: { url: '/models/galaxy/bf2017/crew/hero.glb' } }, null);
    const worn = () => {
      const names = [];
      fig.model.traverse((o) => o.isSkinnedMesh && names.push(o.material.name));
      return names;
    };
    expect(worn()).toEqual(['light']);
    await vi.waitFor(() => expect(worn()).toEqual(['full']));
    // (on the figure's own bones: the animator's, the sockets')
    fig.model.traverse((o) => o.isSkinnedMesh && expect(fig.model.getObjectById(o.skeleton.bones[0].id)).toBeTruthy());
    fig.dispose();
    level.now = 'low';
    cuts.light = false;
  });

  it('takes the stance of the weapon it holds up, its idle and walk the pistol’s', async () => {
    level.now = 'high';
    const fig = await loadPartyFigure(spec, null);
    expect(await fig.stance('p')).toBe('p');
    expect(loader.urls).toContain('/models/galaxy/bf2017/clips-stance-p.glb');
    expect(fig.anim.actions.idle.getClip().tracks[0].values[1]).toBeCloseTo(0.7071);
    expect(fig.anim.actions.walk.getClip().tracks[0].values[1]).toBeCloseTo(0.7071);
    // (and back to the humanoid's, with nothing in its hands)
    expect(await fig.stance('humanoid')).toBe('humanoid');
    expect(fig.anim.actions.idle.getClip().tracks[0].values[1]).toBeCloseTo(0);
    fig.dispose();
    level.now = 'low';
  });

  it('keeps the humanoid set when its stance’s pack isn’t there, never a missing clip', async () => {
    level.now = 'high';
    const fig = await loadPartyFigure(spec, null);
    const before = fig.anim.actions.idle;
    expect(await fig.stance('l')).toBe('humanoid');
    expect(fig.anim.actions.idle).toBe(before);
    fig.update(0.1, 0);
    fig.after(0.1);
    fig.dispose();
    level.now = 'low';
  });

  it('fetches nothing past its own packs at a phone’s levels, and keeps the humanoid stance', async () => {
    loader.urls.length = 0;
    const fig = await loadPartyFigure(spec, null);
    expect(loader.urls.some((u) => /clips-(additive|npc|stance)/.test(u))).toBe(false);
    expect(await fig.stance('p')).toBe('humanoid');
    expect(loader.urls.some((u) => /clips-stance/.test(u))).toBe(false);
    fig.dispose();
  });

  it('flinches on top of what it’s doing by the side the bolt came in from', async () => {
    level.now = 'high';
    const fig = await loadPartyFigure(spec, null);
    // (the additive clips are laid, never played: not the animator's)
    expect(fig.anim.actions['add.hit.left']).toBeUndefined();
    expect(fig.react('hit', { side: 'left', moving: true })).toMatchObject({ layer: 'additive' });
    expect(fig.anim.playing('upper')).toBe(null);
    const hips = fig.bones.Hips;
    fig.update(0.1, 0);
    fig.after(0.1);
    expect(Math.abs(hips.quaternion.x)).toBeGreaterThan(0.3);
    expect(fig.aimAt(0.4, 0)).toBe(true);
    fig.dispose();
    level.now = 'low';
  });

  it('aims and flinches with nothing, and leaves its pose be, when the additive pack isn’t there', async () => {
    level.now = 'high';
    const fig = await loadPartyFigure({ ...spec, packs: ['/models/galaxy/bf2017/clips-humanoid.glb'] }, null);
    expect(fig.aimAt(0.5, 0.5)).toBe(false);
    fig.update(0.1, 0);
    fig.after(0.1);
    expect(fig.bones.Hips.quaternion.x).toBeCloseTo(0);
    // (and a hit by its side is the full-body reaction, as before: none in this pack)
    expect(fig.react('hit', { side: 'left' })).toBeNull();
    fig.dispose();
    level.now = 'low';
  });
});
