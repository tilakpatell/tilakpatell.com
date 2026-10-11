import { describe, expect, it, vi } from 'vitest';
import { createJitter, halton, jitterAt } from './jitter';

describe('the reference shots’ sub-pixel offsets', () => {
  it('walks Halton’s base 2 and base 3 sequences from their first point', () => {
    expect([1, 2, 3, 4].map((i) => halton(i, 2))).toEqual([0.5, 0.25, 0.75, 0.125]);
    expect([1, 2, 3].map((i) => halton(i, 3)).map((x) => +x.toFixed(6))).toEqual([0.333333, 0.666667, 0.111111]);
  });

  it('centres each offset on the pixel: shot i is Halton(2, 3)[i + 1] − ½', () => {
    const near = (got, want) => want.forEach((w, k) => expect(got[k]).toBeCloseTo(w, 12));
    near(jitterAt(0), [0, -1 / 6]);
    near(jitterAt(1), [-0.25, 1 / 6]);
    for (let i = 0; i < 8; i++) for (const v of jitterAt(i)) expect(Math.abs(v)).toBeLessThan(0.5);
  });
});

// a renderer as three's shows itself to the hook: render, its target and its drawing buffer
function fakeRenderer() {
  const seen = [];
  const renderer = {
    target: null,
    getRenderTarget: () => renderer.target,
    getDrawingBufferSize: (v) => v.set(800, 450),
    render: vi.fn((scene, camera) => seen.push(camera.view ? { ...camera.view } : null)),
  };
  return { renderer, seen };
}
const perspective = () => {
  const cam = { isPerspectiveCamera: true, view: null, setViewOffset: vi.fn((fw, fh, x, y, w, h) => (cam.view = { fullWidth: fw, fullHeight: fh, offsetX: x, offsetY: y, width: w, height: h })), clearViewOffset: vi.fn(() => (cam.view = null)) };
  return cam;
};

describe('the jitter hook on the renderer', () => {
  it('offsets a perspective camera drawn at the screen’s size by the shot’s offset, and puts it back after', () => {
    const { renderer, seen } = fakeRenderer();
    const j = createJitter(renderer);
    const cam = perspective();
    j.set(1);
    renderer.render('scene', cam);
    expect(seen[0]).toMatchObject({ fullWidth: 800, fullHeight: 450, offsetX: -0.25, width: 800, height: 450 });
    expect(seen[0].offsetY).toBeCloseTo(1 / 6, 12);
    expect(cam.view).toBeNull();
    // (a post chain’s scene pass draws into a target of the screen’s size: jittered too)
    renderer.target = { width: 800, height: 450 };
    renderer.render('scene', cam);
    expect(seen[1].offsetX).toBe(-0.25);
  });

  it('leaves alone a shadow map’s camera, the chain’s quad and everything once it is off', () => {
    const { renderer, seen } = fakeRenderer();
    const j = createJitter(renderer);
    j.set(2);
    renderer.target = { width: 2048, height: 2048 };
    renderer.render('scene', perspective());
    renderer.target = null;
    renderer.render('quad', { isOrthographicCamera: true });
    j.set(null);
    renderer.render('scene', perspective());
    expect(seen).toEqual([null, null, null]);
  });

  it('keeps a camera’s own view offset under the shot’s, and gives it back', () => {
    const { renderer, seen } = fakeRenderer();
    const j = createJitter(renderer);
    const cam = perspective();
    cam.setViewOffset(800, 450, 10, 20, 800, 450);
    j.set(0);
    renderer.render('scene', cam);
    expect(seen[0].offsetX).toBe(10);
    expect(seen[0].offsetY).toBeCloseTo(20 - 1 / 6, 12);
    expect(cam.view).toMatchObject({ offsetX: 10, offsetY: 20 });
  });

  it('dispose gives the renderer its own render back', () => {
    const { renderer } = fakeRenderer();
    const own = renderer.render;
    createJitter(renderer).dispose();
    expect(renderer.render).toBe(own);
  });
});
