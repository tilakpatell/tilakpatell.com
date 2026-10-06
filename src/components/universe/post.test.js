import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { createPost } from './post';

// just enough of a renderer for the composer to be built (nothing is drawn)
const renderer = () => ({
  getPixelRatio: () => 1,
  getSize: (v) => v.set(64, 64),
  getDrawingBufferSize: (v) => v.set(64, 64),
  getContext: () => ({}),
  getRenderTarget: () => null,
  setRenderTarget: vi.fn(),
  setPixelRatio: vi.fn(),
  setSize: vi.fn(),
  capabilities: { isWebGL2: true },
});

const bloomOf = (post) => post.composer.passes.find((p) => p instanceof UnrealBloomPass);
const gradeOf = (post) => post.composer.passes[post.composer.passes.length - 1];

describe('post.lite', () => {
  it('turns bloom off and keeps the grade, the post staying on', () => {
    const post = createPost(renderer(), new THREE.Scene(), new THREE.PerspectiveCamera());
    const bloom = bloomOf(post);
    expect(bloom.enabled).toBe(true);
    post.lite();
    expect(bloom.enabled).toBe(false);
    expect(gradeOf(post).enabled).toBe(true);
    expect(post.on).toBe(true);
    post.lite(); // harmless the second time
    expect(bloom.enabled).toBe(false);
    expect(gradeOf(post).enabled).toBe(true);
    expect(post.on).toBe(true);
  });

  it('leaves flare() nothing to do once bloom is off', () => {
    const post = createPost(renderer(), new THREE.Scene(), new THREE.PerspectiveCamera());
    const bloom = bloomOf(post);
    post.flare(2);
    expect(bloom.strength).toBeCloseTo(1.6);
    post.lite();
    const was = bloom.strength;
    post.flare(3);
    expect(bloom.strength).toBe(was);
  });
});
