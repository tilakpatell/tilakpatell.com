import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { compileSlices, drawables, fence, picturesIn, prepareScene, textureBytes, uploaded, uploadSlices } from './gpuWork';
import { fakeGl, fakeRenderer, now } from './gpuFake.fixture';

const picture = (w = 64, h = 64) => {
  const t = new THREE.Texture({ width: w, height: h });
  t.needsUpdate = true;
  return t;
};
const mesh = (material = new THREE.MeshStandardMaterial()) => new THREE.Mesh(new THREE.BoxGeometry(), material);

describe('fence', () => {
  it('resolves only once the graphics chip has caught up', async () => {
    const gl = fakeGl({ signalAfter: 3 });
    await fence(fakeRenderer({ gl }), { frame: now });
    expect(gl.polls).toBe(3);
    expect(gl.deleted).toBe(1);
  });

  it('waits two frames where there are no fences (WebGL 1)', async () => {
    let frames = 0;
    await fence(fakeRenderer({ gl: fakeGl({ fences: false }) }), { frame: () => Promise.resolve(frames++) });
    expect(frames).toBe(2);
  });

  it('gives up on a lost context rather than waiting forever', async () => {
    const gl = fakeGl({ signalAfter: Infinity });
    gl.lost = true;
    await expect(fence(fakeRenderer({ gl }), { frame: now })).resolves.toBeUndefined();
  });

  it('never throws, whatever the context does', async () => {
    const gl = fakeGl();
    gl.fenceSync = () => {
      throw new Error('gone');
    };
    await expect(fence(fakeRenderer({ gl }), { frame: now })).resolves.toBeUndefined();
  });
});

describe('uploaded', () => {
  const r = fakeRenderer();
  it('is false for a picture never sent, true once sent', () => {
    const t = picture();
    expect(uploaded(r, t)).toBe(false);
    r.initTexture(t);
    expect(uploaded(r, t)).toBe(true);
  });
  it('stays true for a picture sent once and changed since (a canvas, every frame)', () => {
    const t = picture();
    r.initTexture(t);
    t.needsUpdate = true;
    expect(uploaded(r, t)).toBe(true);
  });
  it('is true for what never waits on an upload: no data yet, a render target, a video', () => {
    expect(uploaded(r, new THREE.Texture())).toBe(true);
    const rt = picture();
    rt.isRenderTargetTexture = true;
    expect(uploaded(r, rt)).toBe(true);
    const v = picture();
    v.isVideoTexture = true;
    expect(uploaded(r, v)).toBe(true);
  });
});

describe('textureBytes', () => {
  it('is width × height × 4 for a picture, its data for a compressed one', () => {
    expect(textureBytes(picture(256, 128))).toBe(256 * 128 * 4);
    const c = new THREE.CompressedTexture([{ data: new Uint8Array(100) }, { data: new Uint8Array(25) }], 16, 16);
    expect(textureBytes(c)).toBe(125);
  });
});

describe('picturesIn', () => {
  it('finds a patch’s pictures kept out of sight on a material (the canopy’s wind noise)', () => {
    const m = new THREE.MeshStandardMaterial({ map: picture() });
    const noise = picture(8, 8);
    Object.defineProperty(m.userData, 'canopy', { value: { uWindNoise: { value: noise }, uWindTime: { value: 0 } }, enumerable: false, configurable: true });
    expect(picturesIn(m)).toEqual([m.map, noise]);
    // (and it stays out of sight: a copy doesn't take it)
    expect(picturesIn(m.clone())).toEqual([m.map]);
  });
});

describe('uploadSlices', () => {
  it("sends what isn't up, smallest first, with a fence after each slice", async () => {
    const gl = fakeGl({ signalAfter: 1 });
    const r = fakeRenderer({ gl });
    const big = picture(2048, 2048); // 16 MB
    const small = picture(64, 64);
    const done = picture(64, 64);
    r.initTexture(done);
    r.uploads.length = 0;
    const sent = await uploadSlices(r, [big, small, done, big], { sliceMB: 8, frame: now });
    expect(sent).toBe(2);
    expect(r.uploads).toEqual([small, big]);
    expect(gl.syncs).toBeGreaterThanOrEqual(1);
  });
});

describe('drawables', () => {
  it('keeps one object per material and kind of mesh, hidden ones too', () => {
    const shared = new THREE.MeshStandardMaterial();
    const a = mesh(shared);
    const b = mesh(shared);
    b.visible = false;
    const skinned = new THREE.SkinnedMesh(new THREE.BoxGeometry(), shared);
    const other = mesh();
    const root = new THREE.Group().add(a, b, skinned, other);
    root.add(new THREE.Object3D());
    expect(drawables([root])).toEqual([a, skinned, other]);
  });
});

describe('compileSlices', () => {
  it('compiles every material once, with a fence after each batch, and waits for the links', async () => {
    const gl = fakeGl({ signalAfter: 1 });
    const r = fakeRenderer({ gl, linkAfter: 2 });
    const scene = new THREE.Scene();
    const meshes = Array.from({ length: 12 }, () => mesh());
    scene.add(...meshes);
    const steps = [];
    const mats = await compileSlices(r, [scene], new THREE.PerspectiveCamera(), scene, { batch: 5, frame: now, onStep: (f) => steps.push(f) });
    expect(mats.size).toBe(12);
    expect(r.compiled.length).toBe(12);
    expect(gl.syncs).toBeGreaterThanOrEqual(3);
    expect(steps.at(-1)).toBe(1);
    for (const m of mats) expect(r.properties.get(m).currentProgram.isReady()).toBe(true);
  });

  it('stops when its world is gone', async () => {
    const r = fakeRenderer({ linkAfter: Infinity });
    const scene = new THREE.Scene().add(mesh());
    let alive = true;
    const p = compileSlices(r, [scene], new THREE.PerspectiveCamera(), scene, {
      frame: () => {
        alive = false;
        return Promise.resolve();
      },
      alive: () => alive,
    });
    await expect(p).resolves.toBeInstanceOf(Set);
  });
});

describe('prepareScene', () => {
  it('sends the pictures, compiles, draws once, and reports its way to 1', async () => {
    const r = fakeRenderer({ gl: fakeGl({ signalAfter: 1 }) });
    const scene = new THREE.Scene();
    const m = new THREE.MeshStandardMaterial({ map: picture() });
    const hidden = mesh(m);
    hidden.visible = false;
    scene.add(hidden, mesh());
    const seen = [];
    let drawn = 0;
    await prepareScene({
      renderer: r,
      roots: [scene],
      scene,
      camera: new THREE.PerspectiveCamera(),
      render: () => {
        drawn += 1;
        expect(hidden.visible).toBe(true); // everything shown for the warm draw
      },
      onProgress: (value, step) => seen.push([value, step]),
      frame: now,
    });
    expect(r.uploads).toEqual([m.map]);
    expect(r.compiled.length).toBe(2);
    expect(drawn).toBe(1);
    expect(hidden.visible).toBe(false);
    const values = seen.map(([v]) => v);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(values.at(-1)).toBe(1);
    expect(new Set(seen.map(([, s]) => s))).toEqual(new Set(['pictures', 'shaders', 'first draw']));
  });

  it('stops early when its world is gone', async () => {
    const r = fakeRenderer();
    const scene = new THREE.Scene().add(mesh());
    let drawn = 0;
    await prepareScene({ renderer: r, roots: [scene], scene, camera: new THREE.PerspectiveCamera(), render: () => (drawn += 1), frame: now, alive: () => false });
    expect(drawn).toBe(0);
    expect(r.compiled.length).toBe(0);
  });
});

describe('a frame in a tab that gets none', () => {
  it('comes anyway, after FRAME_WAIT: a background tab never holds a prepare', async () => {
    const { nextFrame, FRAME_WAIT } = await import('./gpuWork');
    const was = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = () => 0; // (never fires, as in a hidden tab)
    try {
      const t0 = Date.now();
      await nextFrame();
      expect(Date.now() - t0).toBeGreaterThanOrEqual(FRAME_WAIT - 5);
      expect(Date.now() - t0).toBeLessThan(FRAME_WAIT * 5);
    } finally {
      if (was) globalThis.requestAnimationFrame = was;
      else delete globalThis.requestAnimationFrame;
    }
  });
});
