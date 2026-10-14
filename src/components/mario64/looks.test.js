import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { makeLook as composerLook } from './glsl.js';
import { LOOK } from './look.js';
import { LOOK_NAMES, makeLook, passesFor } from './looks.js';

// The look’s chain (the runtime’s node post: rt.gfx.post) against the
// EffectComposer it replaces (./glsl.js’s makeLook): the same passes in the
// same order and the same bloom, now read from the look.

// (the composer reads only its size and ratio off the renderer when it is made)
const stubRenderer = () => ({ getSize: (v) => v.set(1280, 800), getPixelRatio: () => 1 });

// a fake rt.gfx.post: each chain it builds, ready when the test says
function fakePost() {
  const built = [];
  const post = (passes) => {
    let ready;
    const chain = { passes, ready: new Promise((r) => (ready = r)), render: vi.fn(), setSize: vi.fn(), dispose: vi.fn(), done: () => ready() };
    built.push(chain);
    return chain;
  };
  return { post, built };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('the look’s chain', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();

  it('is the composer’s passes: the scene, its bloom, the output', () => {
    const composer = composerLook(stubRenderer(), scene, camera).composer;
    expect(composer.passes.map((p) => p.constructor.name)).toEqual(['RenderPass', 'UnrealBloomPass', 'OutputPass']);
    expect(passesFor(scene, camera, true).map((p) => p.kind)).toEqual(['render', 'bloom', 'output']);
    expect(passesFor(scene, camera, true)[0]).toMatchObject({ scene, camera });
  });

  it('blooms with the composer’s three numbers, read from the look', () => {
    const glow = composerLook(stubRenderer(), scene, camera).composer.passes[1];
    const bloom = passesFor(scene, camera, true)[1];
    expect(bloom).toEqual({ kind: 'bloom', ...LOOK.bloom });
    expect(bloom.strength).toBe(glow.strength);
    expect(bloom.radius).toBe(glow.radius);
    expect(bloom.threshold).toBe(glow.threshold);
  });

  it('leaves the bloom out where the composer turned it off (a small screen, a lowered quality)', () => {
    const glsl = composerLook(stubRenderer(), scene, camera, { bloom: false });
    expect(glsl.composer.passes[1].enabled).toBe(false);
    const { post, built } = fakePost();
    makeLook(post, scene, camera, { bloom: false });
    expect(built[0].passes.map((p) => p.kind)).toEqual(['render', 'output']);
  });

  it('draws through the chain, and the old chain until a new one is built', async () => {
    const { post, built } = fakePost();
    const look = makeLook(post, scene, camera);
    look.render();
    expect(built[0].render).toHaveBeenCalledTimes(1);
    look.setBloom(false);
    expect(built[1].passes.map((p) => p.kind)).toEqual(['render', 'output']);
    look.render();
    expect(built[0].render).toHaveBeenCalledTimes(2);
    built[1].done();
    await settle();
    expect(built[0].dispose).toHaveBeenCalled();
    look.render();
    expect(built[1].render).toHaveBeenCalledTimes(1);
    expect(look.passes).toBe(built[1].passes);
    look.setBloom(false); // (no change: nothing built)
    expect(built).toHaveLength(2);
  });

  it('lets a chain still being built go when the bloom turns back, and both on leaving', async () => {
    const { post, built } = fakePost();
    const look = makeLook(post, scene, camera);
    look.setBloom(false);
    look.setBloom(true);
    expect(built[1].dispose).toHaveBeenCalled();
    built[1].done();
    await settle();
    look.render();
    expect(built[2].render).not.toHaveBeenCalled();
    built[2].done();
    await settle();
    look.render();
    expect(built[2].render).toHaveBeenCalledTimes(1);
    look.setBloom(false);
    look.dispose();
    expect(built[2].dispose).toHaveBeenCalled();
    expect(built[3].dispose).toHaveBeenCalled();
  });

  it('keeps the composer’s picks: modern until the looks slice', () => {
    const { post } = fakePost();
    const look = makeLook(post, scene, camera);
    const glsl = composerLook(stubRenderer(), scene, camera);
    for (const name of [...LOOK_NAMES, 'nope']) expect(look.setLook(name)).toBe(glsl.setLook(name));
    expect(look.look).toBe(glsl.look);
  });
});
