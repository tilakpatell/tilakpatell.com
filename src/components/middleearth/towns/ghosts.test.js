import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ALLY_HALO, GHOST_HALO, createGhosts } from './ghosts';
import { releaseCast, setCastSource, tickCast } from '../cast3d';
import { makePerson } from '../shire/people';
import { meshyRig } from '../../../lib/three/meshyRig.fixture';

// The name cards (and a quick-chat bubble's card and tail) are drawn on a
// canvas; Node has none, so a card that measures and draws nothing stands in
// for it.
beforeAll(() => {
  const pen = { measureText: () => ({ width: 60 }), beginPath() {}, roundRect() {}, fill() {}, fillText() {}, clearRect() {}, moveTo() {}, lineTo() {}, arcTo() {}, closePath() {}, stroke() {} };
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => pen }) });
});
afterAll(() => vi.unstubAllGlobals());

const make = () => ({ group: new THREE.Group(), top: 1.6 });

describe('the ghosts', () => {
  it("a ghost's gait clock runs at the frame's pace whichever way it walks", () => {
    const seen = new Map();
    const animate = vi.fn((f, t, p) => seen.set(p.id, t));
    const ghosts = createGhosts({ make, animate });
    const dt = 1 / 60;
    let t = 0;
    let x = 0;
    const step = (vx) => {
      t += dt;
      x += vx * dt;
      ghosts.update(
        [
          { id: 'abc', name: 'Sam', x, z: 0, face: 0, moving: true },
          { id: 'xyz', name: 'Pip', x: -x, z: 2, face: 0, moving: true },
        ],
        t,
        dt,
      );
    };
    step(0);
    for (const vx of [-3, 3]) {
      const from = seen.get('abc');
      const fromB = seen.get('xyz');
      for (let i = 0; i < 60; i++) step(vx);
      expect(Math.abs(seen.get('abc') - from - 1)).toBeLessThan(0.02);
      expect(Math.abs(seen.get('xyz') - fromB - 1)).toBeLessThan(0.02);
    }
    // two travellers don't step in time with each other
    expect(Math.abs(seen.get('abc') - seen.get('xyz'))).toBeGreaterThan(0.01);
    ghosts.dispose();
  });

  it('hands the world an emote, timed from when it was heard, and how they move', () => {
    const got = [];
    const ghosts = createGhosts({ make, animate: (f, t, p) => got.push(p) });
    const dt = 0.1;
    const motion = { speed: 1.2, side: 0, turn: 0 };
    // their message as it came in (travellers.js): the wave a second on already
    const p = { id: 'abc', name: 'Sam', x: 0, z: 0, face: 0, moving: false, emote: { id: 'wave', age: 1 }, motion };
    ghosts.update([p], 0, dt);
    const first = got.at(-1).emote;
    expect(first).toMatchObject({ id: 'wave' });
    expect(first.t).toBeCloseTo(1, 2);
    expect(got.at(-1).motion).toBe(motion);
    // frames on: the same wave, further in
    ghosts.update([p], 0.1, dt);
    ghosts.update([p], 0.2, dt);
    expect(got.at(-1).emote.at).toBe(first.at);
    expect(got.at(-1).emote.t).toBeCloseTo(1.2, 2);
    // the next message, a moment later: still the same wave
    p.emote = { id: 'wave', age: 1.3 };
    ghosts.update([p], 0.3, dt);
    expect(got.at(-1).emote.at).toBe(first.at);
    // they stop: none
    p.emote = null;
    ghosts.update([p], 0.4, dt);
    expect(got.at(-1).emote).toBeNull();
    ghosts.dispose();
  });

  it('an ally’s ghost wears the ally green, and a stranger’s the pale blue, as the roster changes', () => {
    const ghosts = createGhosts({ make, animate: () => {} });
    const p = { id: 'abc', name: 'Sam', x: 0, z: 0, face: 0, moving: false, ally: false };
    ghosts.update([p], 0, 0.1);
    const halo = ghosts.group.children[0].children.find((o) => o.geometry?.type === 'RingGeometry');
    expect(halo.material.color.getHex()).toBe(GHOST_HALO);
    p.ally = true;
    ghosts.update([p], 0.1, 0.1);
    expect(halo.material.color.getHex()).toBe(ALLY_HALO);
    p.ally = false;
    ghosts.update([p], 0.2, 0.1);
    expect(halo.material.color.getHex()).toBe(GHOST_HALO);
    ghosts.dispose();
  });

  it('a quick-chat line (the row’s quip) shows over the name while they say it, fades with them and goes with them', () => {
    const ghosts = createGhosts({ make, animate: () => {} });
    const p = { id: 'abc', name: 'Sam', x: 0, z: 0, face: 0, moving: false, quip: null };
    ghosts.update([p], 0, 0.1);
    const root = ghosts.group.children[0];
    // (nothing said, nothing made: a town of quiet ghosts draws no bubbles)
    expect(root.getObjectByName('quip')).toBeUndefined();
    p.quip = 'On my way';
    ghosts.update([p], 0.1, 0.1);
    const bubble = root.getObjectByName('quip');
    expect(bubble?.isSprite).toBe(true);
    expect(bubble.visible).toBe(true);
    // over the name card, not on it
    const tag = root.children.find((o) => o.isSprite && o !== bubble);
    expect(bubble.position.y).toBeGreaterThan(tag.position.y + tag.scale.y / 2);
    // as faded in as they are
    expect(bubble.material.opacity).toBeCloseTo(tag.material.opacity / 0.95, 5);
    // a jump: the bubble goes up with the name
    const over = bubble.position.y - tag.position.y;
    const low = tag.position.y;
    p.y = 3;
    for (let i = 0; i < 30; i++) ghosts.update([p], 0.2 + i * 0.1, 0.1);
    expect(tag.position.y).toBeGreaterThan(low + 2);
    expect(bubble.position.y - tag.position.y).toBeCloseTo(over, 5);
    // the line's old: hidden, kept for the next
    p.quip = null;
    ghosts.update([p], 3.5, 0.1);
    expect(root.getObjectByName('quip')).toBe(bubble);
    expect(bubble.visible).toBe(false);
    // they go: it fades with them, then it's let go of with them
    p.quip = 'Bye for now';
    ghosts.update([p], 3.6, 0.1);
    expect(bubble.visible).toBe(true);
    const was = bubble.material.opacity;
    ghosts.update([], 3.7, 0.1);
    expect(bubble.material.opacity).toBeLessThan(was);
    for (let i = 0; i < 20; i++) ghosts.update([], 3.8 + i * 0.1, 0.1);
    expect(ghosts.count).toBe(0);
    expect(bubble.parent).toBeNull();
    ghosts.dispose();
  });

  it('an older traveller’s message, without them, goes to the world as it came', () => {
    const got = [];
    const ghosts = createGhosts({ make, animate: (f, t, p) => got.push(p) });
    const p = { id: 'old', name: 'Pip', x: 0, z: 0, face: 0, moving: true };
    ghosts.update([p], 0, 0.1);
    expect(got[0]).toBe(p);
    expect(got[0]).not.toHaveProperty('emote');
    ghosts.dispose();
  });

  it('a traveller on the cast is pale, drawn here not by the town, and walks by the ground it covers (motion or none)', async () => {
    const rig = meshyRig();
    rig.model.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.3), new THREE.MeshStandardMaterial()));
    const clip = /-(idle|walk|run)\.glb$/;
    setCastSource({ on: true, load: async (url) => (clip.test(url) ? { animations: [rig.clips[clip.exec(url)[1]]] } : { scene: rig.model, animations: [] }) });
    try {
      const scene = new THREE.Scene();
      let made = null;
      const ghosts = createGhosts({ make: () => (made = makePerson('frodo')) });
      scene.add(ghosts.group);
      const p = { id: 'old', name: 'Pip', x: 0, z: 0, face: 0, moving: false };
      ghosts.update([p], 0, 0.05);
      await new Promise((r) => made.cast.onReady(r));
      expect(made.cast.manual).toBe(true);
      const meshes = [];
      made.cast.body.holder.traverse((o) => o.isMesh && meshes.push(o));
      expect(meshes.length).toBeGreaterThan(0);
      expect(meshes.every((m) => m.material.transparent && m.material.depthWrite === false)).toBe(true);
      // an old client's ghost, no motion sent, walking east: its walk goes by the ground
      const walk = made.cast.body.anim.actions.walk;
      for (let i = 1; i <= 90; i++) {
        p.x += 1.2 * 0.02;
        p.moving = true;
        ghosts.update([p], i * 0.02, 0.02);
        tickCast(scene, null, 0.02); // (the town's tick leaves it to the ghosts)
      }
      expect(made.cast.body.m.speed).toBeGreaterThan(0.5);
      expect(walk.getEffectiveWeight() + made.cast.body.anim.actions.run.getEffectiveWeight()).toBeGreaterThan(0.5);
      ghosts.dispose();
      expect(made.cast.disposed).toBe(true);
    } finally {
      releaseCast(null);
      setCastSource({ on: false });
    }
  });
});
