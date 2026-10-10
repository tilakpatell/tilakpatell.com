// The block by the side a cut comes in on, headless: a 2017 hero (the
// committed skeleton, walrus.glb, with Luke's committed clip pack) lays the
// game's block measured holding the blade on that side (luke.json's
// `blocks`, by `held`); one with none measured on that side, its pack's own
// block. (A figure on any other rig has no saber to block with: saber.test.js.)
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { beforeAll, describe, expect, it } from 'vitest';
import luke from '../../../data/bf2017/strokes/luke.json';
import { socketsOf } from '../../../lib/three/walrus';
import { createGunplay } from '../../universe/gunplay';
import { BLOCK_CLIP } from './blockSide';
import { createSaber } from './saber';
import { BLOCK_AT } from './saberRules';

const UP = new THREE.Vector3(0, 1, 0);
const FWD = new THREE.Vector3(0, 0, 1);
const parse = async (file) => {
  const buf = readFileSync(file);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return new Promise((r, j) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', r, j));
};

let pack;
beforeAll(async () => {
  await MeshoptDecoder.ready;
  pack = await parse('public/models/galaxy/bf2017/clips-luke.glb');
});
// (what the pack carries, by the game's names)
const packHas = (n) => pack.animations.some((c) => c.userData.source === n);

// (more: clips laid over the pack's, by its names)
async function hero(more = {}) {
  const g = await parse('public/models/galaxy/bf2017/walrus.glb');
  const bones = {};
  g.scene.traverse((o) => o.name && !(o.name in bones) && (bones[o.name] = o));
  const world = new THREE.Scene();
  world.add(g.scene);
  g.scene.updateMatrixWorld(true);
  const clips = { ...Object.fromEntries(pack.animations.map((c) => [c.name, c])), ...more };
  const fig = { model: g.scene, bones, sockets: socketsOf(g.scene), rig: 'walrus', clips };
  const gp = createGunplay(fig, 'saber', { unit: 1 });
  const saber = createSaber(gp, { fig, parent: world, tier: 'low' });
  let now = 0;
  const frame = () => saber.update(1 / 60, (now += 1 / 60), { forward: FWD, up: UP, me: null, targets: [] });
  return { saber, gp, frame };
}


describe('a 2017 hero’s block, by the side a cut comes in on', () => {
  it('meets a cut from its left with the game’s blocks measured there, one a raise in turn', async () => {
    const want = luke.blocks.left.filter(packHas);
    expect(want).toEqual(['A_Luke_Stand_Block_SwingLeft_01', 'A_Luke_Stand_Block_SwingRight_01']);
    const { saber } = await hero();
    const got = [];
    for (let i = 0; i < 4; i++) {
      saber.block(true, 'left');
      got.push(saber.blockClip);
      saber.block(false);
    }
    expect(got).toEqual([0, 1, 2, 3].map((i) => want[i % want.length]));
    for (const n of got) expect(luke.held[n].tip[0]).toBeGreaterThan(0);
  });

  // (held before the cut: up with no side, then the cut's side as it comes)
  it('takes its turn once a raise, held before the cut or raised to it', async () => {
    const want = luke.blocks.left.filter(packHas);
    const { saber } = await hero();
    const got = [];
    for (let i = 0; i < 4; i++) {
      saber.block(true, null);
      saber.block(true, 'left');
      got.push(saber.blockClip);
      saber.block(false);
    }
    expect(got).toEqual([0, 1, 2, 3].map((i) => want[i % want.length]));
  });

  it('from a side with nothing measured on it, or none, the site’s one block', async () => {
    expect(luke.blocks.right).toEqual([]);
    const { saber } = await hero();
    saber.block(true, 'right');
    expect(saber.blockClip).toBe(BLOCK_CLIP);
    saber.block(false);
    saber.block(true, null);
    expect(saber.blockClip).toBe(BLOCK_CLIP);
  });

  // (Obi-Wan's, Anakin's, Maul's and Dooku's packs carry the table's any,
  // the parry's stagger, as their sword.blocked, and laid as the block it
  // held the blade low or behind; Luke's is given one: a clip of his pack's
  // under the any's game name)
  it('keeps the site’s one block with the table’s any in the pack', async () => {
    expect(packHas(luke.blocks.any)).toBe(false);
    const stagger = pack.animations.find((c) => c.name === 'sword.blocked').clone();
    stagger.userData = { ...stagger.userData, source: luke.blocks.any };
    const { saber } = await hero({ 'sword.blocked': stagger });
    for (const side of [null, 'right']) {
      saber.block(true, side);
      expect(saber.blockClip, String(side)).toBe(BLOCK_CLIP);
      saber.block(false);
    }
    saber.block(true, 'left');
    expect(luke.blocks.left).toContain(saber.blockClip);
  });

  it('keeps the block it raised until a cut comes in on the other side', async () => {
    const { saber } = await hero();
    saber.block(true, 'left');
    const a = saber.blockClip;
    saber.block(true, 'left');
    saber.block(true, null);
    expect(saber.blockClip).toBe(a);
    saber.block(true, 'right');
    expect(saber.blockClip).not.toBe(a);
  });

  it('lays the block it chose at the held frame', async () => {
    const { saber, gp, frame } = await hero();
    saber.block(true, 'left');
    const clip = pack.animations.find((c) => c.userData.source === saber.blockClip);
    for (let i = 0; i < 30; i++) frame();
    const track = clip.tracks.find((t) => t.name === 'Wep_Root.quaternion');
    const v = track.createInterpolant().evaluate(clip.duration * BLOCK_AT);
    expect(gp.socket.quaternion.angleTo(new THREE.Quaternion(v[0], v[1], v[2], v[3]))).toBeLessThan(1e-3);
  });

  it('eases over to a block chosen again while it’s up, not in a frame', async () => {
    const { saber, gp, frame } = await hero();
    const heldOf = (n) => {
      const clip = pack.animations.find((c) => c.userData.source === n || c.name === n);
      const v = clip.tracks.find((t) => t.name === 'Wep_Root.quaternion').createInterpolant().evaluate(clip.duration * BLOCK_AT);
      return new THREE.Quaternion(v[0], v[1], v[2], v[3]).normalize();
    };
    saber.block(true, 'left');
    const a = heldOf(saber.blockClip);
    for (let i = 0; i < 30; i++) frame();
    saber.block(true, 'right');
    const b = heldOf(saber.blockClip);
    expect(a.angleTo(b)).toBeGreaterThan(0.1);
    frame();
    const q = gp.socket.quaternion.clone().normalize();
    expect(q.angleTo(a)).toBeGreaterThan(0.01);
    expect(q.angleTo(b)).toBeGreaterThan(0.01);
    for (let i = 0; i < 10; i++) frame();
    expect(gp.socket.quaternion.clone().normalize().angleTo(b)).toBeLessThan(1e-3);
  });
});
