import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bloomSize as glslBloomSize } from '../../universe/post';
import { LOOK } from '../look';
import { bloomSize, createPost } from './post';

// (drawn and compared in a browser against universe/post.js's createPost:
// scripts/twin-parity/cases/galaxy-post.js, with the cockpit over it and without)
const fakeRenderer = () => ({
  getPixelRatio: () => 1,
  getDrawingBufferSize: (v) => v.set(256, 256),
  drawn: 0,
  render() {
    this.drawn++;
  },
});
const make = (bloom = LOOK.bloom) => {
  const renderer = fakeRenderer();
  const post = createPost(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), { bloom });
  return { renderer, post };
};

describe('the galaxy’s post as nodes', () => {
  it('sizes its bloom as the GLSL post does', () => {
    for (const [w, h, small, cap] of [[1280, 800, false, 960], [390, 844, true, 640], [4000, 2000, false, 960]]) expect(bloomSize(w, h, { small, cap })).toEqual(glslBloomSize(w, h, { small, cap }));
  });

  it('has every member the galaxy’s scene reads', () => {
    const { post } = make();
    for (const k of ['bloom', 'dispose', 'flare', 'hit', 'lite', 'on', 'overlay', 'ratio', 'render', 'rush', 'sharpness', 'target']) expect(post).toHaveProperty(k);
    for (const k of ['dispose', 'flare', 'hit', 'lite', 'overlay', 'render', 'rush']) expect(typeof post[k]).toBe('function');
    // (the node renderer compiles a pass by drawing it)
    expect(post.composer).toBeNull();
    expect(post.on).toBe(true);
    expect(post.target).toBe(post.scenePass.renderTarget);
  });

  it('keeps the galaxy’s bloom: its soft knee, its falloff and its flare', () => {
    const { post } = make();
    expect(post.bloom.knee).toBe(0.5);
    post.bloom.knee = 0.3;
    expect(post.bloom.knee).toBe(0.3);
    expect(post.bloom.threshold).toBe(1.4);
    // (the falloff through the mips' tints: three's factors times the tint)
    const three = [1, 0.8, 0.6, 0.4, 0.2];
    post.bloomNode.bloomTintColors.forEach((t, i) => expect(t.x * three[i]).toBeCloseTo(LOOK.bloom.falloff[i]));
    post.flare(9);
    expect(post.bloomNode.strength.value).toBeCloseTo(LOOK.bloom.strength * 3 * LOOK.bloom.flareMax);
    // (a look with no knee has none to read)
    expect(make({ threshold: 1, strength: 0.4, radius: 0.2 }).post.bloom.knee).toBeUndefined();
  });

  it('draws the overlay only while there is one', () => {
    const { renderer, post } = make();
    const frame = { renderer };
    post.overPass.updateBefore(frame);
    expect(renderer.drawn).toBe(0);
    const cab = new THREE.Scene();
    const seat = new THREE.PerspectiveCamera();
    post.overlay(cab, seat);
    expect(post.overPass.scene).toBe(cab);
    expect(post.overPass.camera).toBe(seat);
    expect(post.uniforms.uOver.value).toBe(1);
    post.overlay(null);
    expect(post.uniforms.uOver.value).toBe(0);
    post.overPass.updateBefore(frame);
    expect(renderer.drawn).toBe(0);
  });

  it('skips the bloom once it is lite', () => {
    const { renderer, post } = make();
    post.lite();
    post.bloomNode.updateBefore({ renderer });
    expect(renderer.drawn).toBe(0);
    expect(post.uniforms.uGlow.value).toBe(0);
    post.flare(1.2);
    expect(post.bloomNode.strength.value).toBeCloseTo(LOOK.bloom.strength * 3);
  });
});
