import { describe, expect, it } from 'vitest';
import { bloomSize as glslBloomSize } from '../../../universe/post';
import { UNREAL, bloomSize } from './post';

// (the post builds a PostProcessing on a renderer: drawn and compared in a
// browser, against universe/post.js through the same scene, at 52.8 dB)
describe('the surface’s post as nodes', () => {
  it('sizes its bloom as the GLSL post does', () => {
    for (const [w, h, small] of [[1280, 800, false], [390, 844, true], [4000, 2000, false]]) expect(bloomSize(w, h, { small })).toEqual(glslBloomSize(w, h, { small }));
  });

  it('glows as UnrealBloomPass does: its composite is three times the strength', () => {
    expect(UNREAL).toBe(3);
  });
});
