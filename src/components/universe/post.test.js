import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { guard } from '../../lib/three/frameGuard';
import { MAP_LENS, RCAS_STOPS, aberrationFor, bloomSize, createPost, drawnRatio, edgeWeight, samplesAt, toe, upscaling } from './post';

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

describe('a scene’s own bloom', () => {
  it('is the map’s when a scene names none', () => {
    const bloom = bloomOf(createPost(renderer(), new THREE.Scene(), new THREE.PerspectiveCamera()));
    expect([bloom.threshold, bloom.strength, bloom.radius]).toEqual([1.7, 0.8, 0.55]);
    expect(bloom.compositeMaterial.uniforms.bloomFactors.value).toEqual([1, 0.8, 0.6, 0.4, 0.2]);
    expect(bloom.materialHighPassFilter.fragmentShader).not.toContain('uKnee');
  });

  it('takes the scene’s numbers, its knee and how fast the wide glow falls off', () => {
    const look = { threshold: 1.4, knee: 0.5, strength: 0.5, radius: 0, falloff: [1, 0.6, 0.3, 0.12, 0.04] };
    const post = createPost(renderer(), new THREE.Scene(), new THREE.PerspectiveCamera(), { bloom: look });
    const bloom = bloomOf(post);
    expect([bloom.threshold, bloom.strength, bloom.radius]).toEqual([1.4, 0.5, 0]);
    expect(bloom.compositeMaterial.uniforms.bloomFactors.value).toEqual([1, 0.6, 0.3, 0.12, 0.04]);
    const bright = bloom.materialHighPassFilter;
    expect(bright.fragmentShader).toContain('uKnee');
    expect(bright.fragmentShader).toContain('finite(');
    expect(bright.uniforms.uKnee.value).toBe(0.5);
    expect(post.bloom.knee).toBe(0.5);
    post.bloom.knee = 0.3;
    expect(bright.uniforms.uKnee.value).toBe(0.3);
  });

  it('flares from the scene’s strength, never past its most', () => {
    const post = createPost(renderer(), new THREE.Scene(), new THREE.PerspectiveCamera(), { bloom: { threshold: 1.4, strength: 0.5, radius: 0, flareMax: 1.25 } });
    const bloom = bloomOf(post);
    post.flare(2);
    expect(bloom.strength).toBeCloseTo(0.625);
    post.flare(1);
    expect(bloom.strength).toBeCloseTo(0.5);
    post.bloom.strength = 0.4; // (the ?debug panel)
    post.flare(1.2);
    expect(bloom.strength).toBeCloseTo(0.48);
  });

  it('keeps one scene’s panel from moving another’s', () => {
    const a = createPost(renderer(), new THREE.Scene(), new THREE.PerspectiveCamera());
    const b = createPost(renderer(), new THREE.Scene(), new THREE.PerspectiveCamera());
    a.bloom.strength = 0.3;
    b.flare(1);
    expect(bloomOf(b).strength).toBeCloseTo(0.8);
  });
});

describe('the finished render', () => {
  it('dithers in the final pass, and grains only when asked (the galaxy keeps its picture)', () => {
    const post = createPost(renderer(), new THREE.Scene(), new THREE.PerspectiveCamera());
    const u = gradeOf(post).uniforms;
    expect(u.tNoise.value).toBeTruthy();
    expect(u.uGrain.value).toBe(0);
    post.grain(0.03);
    expect(u.uGrain.value).toBeCloseTo(0.03);
    post.grain(0);
    expect(u.uGrain.value).toBe(0);
  });

  it('draws the bloom at half the target, capped', () => {
    expect(bloomSize(2560, 1440)).toEqual([640, 360]);
    expect(bloomSize(1280, 720)).toEqual([640, 360]);
    expect(bloomSize(800, 600, { small: true })).toEqual([200, 150]);
    expect(bloomSize(100, 80, { small: true })).toEqual([64, 64]);
  });

  it('aberration is off on low and grows with the rush and a hit', () => {
    expect(aberrationFor({ rush: 1, hit: 1, tier: 'low' })).toBe(0);
    expect(aberrationFor({})).toBeCloseTo(0.0006);
    expect(aberrationFor({ rush: 1 })).toBeCloseTo(0.006);
    expect(aberrationFor({ hit: 1 })).toBeCloseTo(0.004);
  });

  it('opens the exposure where it is asked, 1 by default', () => {
    const post = createPost(renderer(), new THREE.Scene(), new THREE.PerspectiveCamera());
    expect(gradeOf(post).uniforms.uExposure.value).toBe(1);
    post.exposure(1.2);
    expect(gradeOf(post).uniforms.uExposure.value).toBeCloseTo(1.2);
  });

  it('drops the flare at pace step 2 and the aberration at 3, and brings them back', () => {
    const post = createPost(renderer(), new THREE.Scene(), new THREE.PerspectiveCamera());
    const u = gradeOf(post).uniforms;
    post.aberration(0.004);
    expect(post.flareOn).toBe(true);
    post.setLevel(2);
    expect(post.flareOn).toBe(false);
    expect(u.uAberration.value).toBeCloseTo(0.004);
    post.setLevel(3);
    expect(u.uAberration.value).toBe(0);
    post.aberration(0.004); // (held off while the pace is down there)
    expect(u.uAberration.value).toBe(0);
    post.setLevel(0);
    expect(post.flareOn).toBe(true);
    post.aberration(0.004);
    expect(u.uAberration.value).toBeCloseTo(0.004);
  });

  it("draws the passes softer at a lower sharpness, the renderer's own ratio and the canvas left as they are", () => {
    const r = { ...renderer(), getPixelRatio: () => 1.5 };
    const post = createPost(r, new THREE.Scene(), new THREE.PerspectiveCamera());
    post.composer.render = () => {};
    const setRatio = vi.spyOn(post.composer, 'setPixelRatio');
    post.render(800, 600);
    expect(setRatio).toHaveBeenLastCalledWith(1.5);
    post.sharpness = 0.72;
    post.render(800, 600);
    expect(setRatio).toHaveBeenLastCalledWith(1.5 * 0.72);
    expect(post.ratio).toBeCloseTo(1.08);
    expect(r.setPixelRatio).not.toHaveBeenCalled();
    expect(r.setSize).not.toHaveBeenCalled();
  });

  it('resizes the bloom target instead of making a new one', () => {
    const post = createPost(renderer(), new THREE.Scene(), new THREE.PerspectiveCamera());
    const bloom = bloomOf(post);
    post.composer.render = () => {};
    post.render(800, 600);
    post.render(1200, 700);
    expect(bloomOf(post)).toBe(bloom);
  });
});

describe('the finish (the map’s: FSR 1 up to a canvas of the screen’s pixels)', () => {
  it('multisamples by the sharpness drawn at: none where a stair is too small to see, more as it grows, under the visitor’s cap', () => {
    expect(samplesAt(2)).toBe(0);
    expect(samplesAt(1.75)).toBe(0);
    expect(samplesAt(1.5)).toBe(2);
    expect(samplesAt(1.25)).toBe(2);
    expect(samplesAt(1.08)).toBe(4);
    expect(samplesAt(0.75)).toBe(4);
    expect(samplesAt(0.75, { small: true })).toBe(2);
    expect(samplesAt(0.75, { cap: 2 })).toBe(2);
    expect(samplesAt(1.5, { cap: 0 })).toBe(0);
  });

  it('draws at a share of the most it may, never under the softest, never over the most', () => {
    expect(drawnRatio(1.5, 1)).toBe(1.5);
    expect(drawnRatio(1.5, 0.6)).toBeCloseTo(0.9);
    expect(drawnRatio(1, 0.5)).toBe(0.6);
    expect(drawnRatio(0.5, 1)).toBe(0.5); // (a render resolution picked under the softest)
    expect(upscaling(0.9, 1)).toBe(true);
    expect(upscaling(1.5, 1)).toBe(false);
    expect(upscaling(1 - 1e-6, 1)).toBe(false);
  });

  it('is off by default: the galaxy’s last pass is the plain grade, as it was', () => {
    const post = createPost(renderer(), new THREE.Scene(), new THREE.PerspectiveCamera());
    expect(gradeOf(post).easu).toBeUndefined();
    expect(post.finish.up).toBe(false);
  });

  it('draws sharper than the canvas at the top, folded down by the grade, and brings a softer one up through EASU and RCAS', () => {
    const r = { ...renderer(), getPixelRatio: () => 1 };
    const post = createPost(r, new THREE.Scene(), new THREE.PerspectiveCamera(), { upscale: true, ratio: 1.5, top: () => 1.5 });
    post.composer.render = () => {};
    const grade = gradeOf(post);
    expect(grade.easu.fragmentShader).toContain('lanczos');
    expect(grade.rcas.uniforms.uSharp.value).toBeCloseTo(2 ** -RCAS_STOPS);
    post.render(800, 600);
    expect(post.ratio).toBe(1.5);
    expect(post.finish).toEqual({ up: false, samples: 2, cap: Infinity });
    post.sharpness = 0.6;
    post.render(800, 600);
    expect(post.ratio).toBeCloseTo(0.9);
    expect(post.finish).toEqual({ up: true, samples: 4, cap: Infinity });
    expect([grade.up.graded.width, grade.up.graded.height]).toEqual([720, 540]);
    expect([grade.up.wide.width, grade.up.wide.height]).toEqual([64, 64]); // (the renderer's drawing buffer)
    post.sharpness = 1;
    post.render(800, 600);
    expect(post.finish.up).toBe(false);
    expect(r.setPixelRatio).not.toHaveBeenCalled();
  });

  it('takes the visitor’s cap on samples at the next frame', () => {
    const post = createPost({ ...renderer(), getPixelRatio: () => 1 }, new THREE.Scene(), new THREE.PerspectiveCamera(), { upscale: true, top: () => 1 });
    post.composer.render = () => {};
    post.render(400, 300);
    expect(post.finish.samples).toBe(4);
    post.maxSamples(0);
    post.render(400, 300);
    expect(post.finish.samples).toBe(0);
    post.maxSamples(Infinity);
    post.render(400, 300);
    expect(post.finish.samples).toBe(4);
  });

  it('follows the most it may draw at as the visitor moves it', () => {
    let most = 1;
    const post = createPost({ ...renderer(), getPixelRatio: () => 1 }, new THREE.Scene(), new THREE.PerspectiveCamera(), { upscale: true, top: () => most });
    post.composer.render = () => {};
    post.render(400, 300);
    expect(post.ratio).toBe(1);
    most = 2;
    post.render(400, 300);
    expect(post.ratio).toBe(2);
    expect(post.finish.samples).toBe(0);
  });

  it('names its buffers the frame’s to the renderer’s frame guard, whatever their size, and lets go on dispose', () => {
    const r = renderer();
    const g = guard(r);
    const frames = vi.spyOn(g, 'frames');
    const post = createPost(r, new THREE.Scene(), new THREE.PerspectiveCamera(), { upscale: true, top: () => 1.5 });
    const [isFrame] = frames.mock.calls[0];
    expect(isFrame(post.composer.renderTarget1)).toBe(true);
    expect(isFrame(post.composer.renderTarget2)).toBe(true);
    expect(isFrame(new THREE.WebGLRenderTarget(4, 4))).toBe(false);
    const undo = frames.mock.results[0].value;
    expect(typeof undo).toBe('function');
    // (the galaxy's, without the finish, names none, as it never has)
    frames.mockClear();
    createPost(r, new THREE.Scene(), new THREE.PerspectiveCamera());
    expect(frames).not.toHaveBeenCalled();
  });

  it('turns its bloom off and back for the video settings', () => {
    const post = createPost(renderer(), new THREE.Scene(), new THREE.PerspectiveCamera(), { upscale: true });
    const bloom = bloomOf(post);
    post.glowing(false);
    expect(bloom.enabled).toBe(false);
    post.flare(2);
    expect(bloom.strength).toBeCloseTo(0.8);
    post.glowing(true);
    expect(bloom.enabled).toBe(true);
    post.flare(2);
    expect(bloom.strength).toBeCloseTo(1.6);
  });
});

describe('the toe', () => {
  it('takes what is under 0.02 to black and leaves 0.08 and over as drawn', () => {
    expect(toe(0.02, 0.02, 0.08)).toBe(0);
    expect(toe(0.01, 0.02, 0.08)).toBe(0);
    expect(toe(0.08, 0.02, 0.08)).toBeCloseTo(0.08, 4);
    expect(Math.abs(toe(0.08, 0.02, 0.08) - 0.08) / 0.08).toBeLessThan(0.01);
    expect(toe(0.5, 0.02, 0.08)).toBe(0.5);
  });

  it('is monotone', () => {
    let last = -1;
    for (let l = 0; l <= 0.2; l += 0.001) {
      const v = toe(l, 0.02, 0.08);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });

  it('is off by default (the galaxy keeps its picture), and the universe map turns it on with its contrast', () => {
    const post = createPost(renderer(), new THREE.Scene(), new THREE.PerspectiveCamera());
    const u = gradeOf(post).uniforms;
    expect(u.uToe.value.toArray()).toEqual([0, 0]);
    expect(u.uContrast.value).toBe(0.07);
    post.setToe(0.02, 0.08);
    post.contrast(0.18);
    expect(u.uToe.value.toArray()).toEqual([0.02, 0.08]);
    expect(u.uContrast.value).toBe(0.18);
  });
});

describe('the soft edge', () => {
  it('is nothing at the centre and whole at a corner, at any aspect', () => {
    for (const aspect of [16 / 9, 1, 9 / 16]) {
      expect(edgeWeight([0.5, 0.5], aspect)).toBe(0);
      expect(edgeWeight([0.6, 0.55], aspect)).toBe(0);
      expect(edgeWeight([0, 0], aspect)).toBe(1);
      expect(edgeWeight([1, 1], aspect)).toBe(1);
    }
  });

  it('is off by default, held off from pace step 3, and kept by lite()', () => {
    const post = createPost(renderer(), new THREE.Scene(), new THREE.PerspectiveCamera());
    const u = gradeOf(post).uniforms;
    expect(u.uDefocus.value).toBe(0);
    post.defocus(1);
    expect(u.uDefocus.value).toBe(1);
    post.lite();
    expect(u.uDefocus.value).toBe(1);
    post.setLevel(3);
    expect(u.uDefocus.value).toBe(0);
    post.setLevel(1);
    expect(u.uDefocus.value).toBe(1);
  });
});

// the map's own lens: the toe takes only the black between the stars. A
// rock or a ship in shadow, a planet's night side, sit at 0.01 to 0.08
// linear (10 to 30 % grey on screen) and must come through as drawn
describe("the map's lens", () => {
  const [lo, hi] = MAP_LENS.toe;
  it('blacks out the empty sky', () => {
    expect(toe(0.001, lo, hi)).toBe(0);
  });
  it('leaves a dim lit surface and a night side as they are', () => {
    for (const l of [0.012, 0.02, 0.05, 0.08]) expect(toe(l, lo, hi)).toBe(l);
    expect(toe(0.008, lo, hi) / 0.008).toBeGreaterThan(0.6);
  });
  it('keeps the contrast gentle', () => {
    expect(MAP_LENS.contrast).toBeLessThanOrEqual(0.1);
  });
});

describe('a game’s grade', () => {
  it('samples its LUT in the final pass, the house’s contrast and saturation stepping aside, and gives them back', () => {
    const post = createPost(renderer(), new THREE.Scene(), new THREE.PerspectiveCamera());
    const u = gradeOf(post).uniforms;
    expect(u.uLutMix.value).toBe(0);
    const lut = new THREE.Data3DTexture(new Uint8Array(17 * 17 * 17 * 4), 17, 17, 17);
    post.grading({ lut, size: 17 });
    expect(u.tLut.value).toBe(lut);
    expect(u.uLutSize.value).toBe(17);
    expect(u.uLutMix.value).toBe(1);
    expect(u.uContrast.value).toBe(0);
    expect(u.uSat.value).toBe(1);
    expect(gradeOf(post).material.fragmentShader).toContain('tLut');
    post.grading(null);
    expect(u.uLutMix.value).toBe(0);
    expect(u.tLut.value).toBeNull();
    expect(u.uContrast.value).toBeCloseTo(0.07);
    expect(u.uSat.value).toBeCloseTo(1.06);
  });
});
