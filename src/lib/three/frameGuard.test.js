import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { guard, heldBack, holdNone } from './frameGuard';
import { markLinked, warmDraw } from './gpuWork';
import { fakeGl, fakeRenderer, now } from './gpuFake.fixture';
import { wear } from './core';

const picture = () => {
  const t = new THREE.Texture({ width: 64, height: 64 });
  t.needsUpdate = true;
  return t;
};
const camera = new THREE.PerspectiveCamera();
// a frame: the draw, then the guard's work after it (a microtask), then
// the fence's frame
const frames = async (r, scene, n = 1) => {
  for (let i = 0; i < n; i++) {
    r.draws.length = 0;
    r.render(scene, camera);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};
const setup = (opts = {}) => {
  const r = fakeRenderer({ gl: fakeGl({ signalAfter: 1 }), ...opts });
  const g = guard(r, { frame: now, ...opts.guard });
  const scene = new THREE.Scene();
  return { r, g, scene };
};

describe('frameGuard', () => {
  it('holdNone stops every guard holding anything back, so a measured frame is the whole world', async () => {
    const { r, g, scene } = setup({ linkAfter: 50 });
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: 2 })));
    await frames(r, scene);
    expect(r.draws.length).toBe(0);
    holdNone();
    expect(g.enabled).toBe(false);
    await frames(r, scene);
    expect(r.draws.length).toBe(1);
    g.dispose();
  });

  it('heldBack counts what every guard is still readying, and forgets one disposed', async () => {
    const { r, g, scene } = setup({ linkAfter: 1 });
    const was = heldBack() - g.pending();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    await frames(r, scene);
    expect(g.pending()).toBeGreaterThan(0);
    expect(heldBack()).toBe(was + g.pending());
    await frames(r, scene, 3);
    expect(heldBack()).toBe(was);
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: 1 })));
    await frames(r, scene);
    g.dispose();
    expect(heldBack()).toBe(was);
  });

  it('draws what three draws for the scene from outside it (its background box) as it is, and never holds it', async () => {
    const { r, g, scene } = setup({ linkAfter: 1 });
    // (three's background: a mesh of its own, drawn in the scene's frame but in no scene)
    const sky = new THREE.ShaderMaterial();
    const box = new THREE.Mesh(new THREE.BoxGeometry(), sky);
    const walk = scene.traverseVisible.bind(scene);
    scene.traverseVisible = (fn) => {
      fn(box);
      walk(fn);
    };
    for (let i = 0; i < 3; i++) {
      await frames(r, scene);
      expect(r.draws).toContain(sky);
    }
    expect(g.pending()).toBe(0);
  });

  it('leaves a never-compiled material out of the frame, and draws it once it has linked', async () => {
    const { r, scene } = setup({ linkAfter: 1 });
    const m = new THREE.MeshStandardMaterial();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
    await frames(r, scene);
    expect(r.draws).toEqual([]);
    expect(r.compiled).toEqual([m]); // compiled after the frame, not in it
    await frames(r, scene, 3);
    expect(r.draws).toEqual([m]);
  });

  it('draws at once what was readied before (a prepared world)', async () => {
    const { r, scene } = setup();
    const m = new THREE.MeshStandardMaterial({ map: picture() });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), m);
    scene.add(mesh);
    r.compile(mesh);
    markLinked(r.properties.get(m).currentProgram);
    r.initTexture(m.map);
    await frames(r, scene);
    expect(r.draws).toEqual([m]);
  });

  it('keeps drawing what three drew while the frame went ungated, once the frame is gated', async () => {
    const { r, g, scene } = setup({ linkAfter: 5 });
    const m = new THREE.MeshStandardMaterial({ map: picture() });
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
    // switched off (or a renderer's first frame, drawn whole: below), so
    // three draws it all as it is
    g.enabled = false;
    await frames(r, scene, 2);
    expect(r.draws).toEqual([m]);
    r.initTexture(m.map); // (three sent it with that first draw)
    // gated again: what's on screen stays on it
    g.enabled = true;
    for (let i = 0; i < 3; i++) {
      await frames(r, scene);
      expect(r.draws).toEqual([m]);
    }
    expect(g.pending()).toBe(0);
  });

  it("draws a renderer's first frame whole when asked (a world not prepared), and holds back what's late from then on", async () => {
    const { r, g, scene } = setup({ linkAfter: 5, guard: { firstWhole: true } });
    const m = new THREE.MeshStandardMaterial({ map: picture() });
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
    await frames(r, scene);
    expect(r.draws).toEqual([m]); // compiled in the frame, as three does unguarded
    r.initTexture(m.map); // (three sent it with that draw)
    const late = new THREE.MeshStandardMaterial({ color: 0x334455 });
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), late));
    await frames(r, scene);
    expect(r.draws).toEqual([m]);
    expect(g.pending()).toBe(1);
    await frames(r, scene, 8);
    expect(r.draws).toEqual([m, late]);
  });

  it("draws a warm draw whole (gpuWork's warmDraw: there to send everything before it's seen), and what it drew at once after", async () => {
    const { r, g, scene } = setup({ linkAfter: 5 });
    const m = new THREE.MeshStandardMaterial();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
    await warmDraw(r, () => r.render(scene, camera), [scene], { frame: now });
    expect(r.draws).toEqual([m]);
    await frames(r, scene);
    expect(r.draws).toEqual([m]);
    expect(g.pending()).toBe(0);
  });

  it("holds back a material whose shader was made but isn't known to have linked", async () => {
    const { r, scene } = setup({ linkAfter: 1 });
    const m = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), m);
    scene.add(mesh);
    r.compile(mesh);
    await frames(r, scene);
    expect(r.draws).toEqual([]);
    await frames(r, scene, 3);
    expect(r.draws).toEqual([m]);
  });

  it('sends a new picture after the frame, then draws with it', async () => {
    const { r, scene } = setup();
    const m = new THREE.MeshStandardMaterial({ map: picture() });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), m);
    scene.add(mesh);
    r.compile(mesh);
    await frames(r, scene);
    expect(r.draws).toEqual([]);
    expect(r.uploads).toEqual([m.map]);
    await frames(r, scene, 2);
    expect(r.draws).toEqual([m]);
  });

  it("compiles for where the scene is drawn (a composer's buffer), then puts the target back", async () => {
    const { r, scene } = setup();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    const buffer = { width: 100, height: 100 };
    r.target = buffer;
    r.render(scene, camera);
    r.target = null;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(r.compiledInto).toEqual([buffer]);
    expect(r.target).toBe(null);
  });

  it("gates a composer's buffer at any pixel ratio: 1470 wide at 1.75 is 2572.5, the canvas's 2572 in whole pixels", async () => {
    const { r, scene } = setup({ linkAfter: 1 });
    const m = new THREE.MeshStandardMaterial();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
    r.target = { width: 100.5, height: 100.75 };
    await frames(r, scene);
    expect(r.draws).toEqual([]);
    expect(r.compiled).toEqual([m]); // compiled after the frame, not in it
    await frames(r, scene, 3);
    expect(r.draws).toEqual([m]);
  });

  it("leaves a buffer alone that's a pixel short of the canvas once truncated (99.5 is 99)", () => {
    const { r, scene } = setup();
    const m = new THREE.MeshStandardMaterial();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
    r.target = { width: 99.5, height: 100 };
    r.render(scene, camera);
    expect(r.draws).toEqual([m]);
  });

  it("leaves a world's own drawings alone: a bake's override material, a buffer of its own size", () => {
    const { r, scene } = setup();
    const m = new THREE.MeshStandardMaterial();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
    scene.overrideMaterial = m;
    r.render(scene, camera);
    expect(r.draws).toEqual([m]);
    scene.overrideMaterial = null;
    r.draws.length = 0;
    r.target = { width: 1024, height: 1024 };
    r.render(scene, camera);
    expect(r.draws).toEqual([m]);
  });

  it('gates a buffer its owner says is the frame’s, smaller than the canvas (a composer drawn softer)', async () => {
    const buffer = { width: 50, height: 30 };
    const { r, g, scene } = setup({ linkAfter: 1, guard: { frames: (t) => t === buffer } });
    const m = new THREE.MeshStandardMaterial();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
    r.target = buffer;
    await frames(r, scene);
    expect(r.draws).toEqual([]);
    await frames(r, scene, 3);
    expect(r.draws).toEqual([m]);
    expect(g.pending()).toBe(0);
  });

  it('never gates the shadow pass', () => {
    const { r, scene } = setup();
    const m = new THREE.MeshStandardMaterial();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
    r.shadow(scene, camera);
    expect(r.draws).toEqual([m]);
  });

  it('keeps drawing a material three bumps every frame (transparent, both sides)', async () => {
    const { r, scene } = setup();
    const m = new THREE.MeshStandardMaterial({ transparent: true, side: THREE.DoubleSide });
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
    await frames(r, scene, 3);
    for (let i = 0; i < 3; i++) {
      m.needsUpdate = true;
      await frames(r, scene);
      expect(r.draws).toEqual([m]);
    }
  });

  it('readies a ready material again, behind the frame, when it changes into another shader (a look put on late)', async () => {
    const { r, scene } = setup();
    const m = new THREE.MeshStandardMaterial();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
    await frames(r, scene, 3);
    expect(r.draws).toEqual([m]);
    r.compiled.length = 0;
    // (as lib/three/house's adopt does it)
    m.onBeforeCompile = () => {};
    m.customProgramCacheKey = () => '|house';
    m.needsUpdate = true;
    await frames(r, scene);
    expect(r.draws).toEqual([]);
    expect(r.compiled).toEqual([m]); // made after the frame, not in it
    await frames(r, scene, 3);
    expect(r.draws).toEqual([m]);
    expect(r.compiled).toEqual([m]);
  });

  it('readies a ready material again when a map is taken off it (a scan worn instead)', async () => {
    const { r, scene } = setup();
    const m = new THREE.MeshStandardMaterial({ map: picture() });
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
    await frames(r, scene, 4);
    expect(r.draws).toEqual([m]);
    r.compiled.length = 0;
    m.map = null;
    m.needsUpdate = true;
    await frames(r, scene);
    expect(r.draws).toEqual([]);
    await frames(r, scene, 3);
    expect(r.draws).toEqual([m]);
    expect(r.compiled).toEqual([m]);
  });

  it('readies a ready material again, behind the frame, once it has been freed and is drawn again (a kit kept for the page)', async () => {
    const { r, scene } = setup();
    const m = new THREE.MeshStandardMaterial();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
    await frames(r, scene, 3);
    expect(r.draws).toEqual([m]);
    r.compiled.length = 0;
    m.dispose();
    await frames(r, scene);
    expect(r.draws).toEqual([]);
    expect(r.compiled).toEqual([m]); // made after the frame, not in it
    await frames(r, scene, 3);
    expect(r.draws).toEqual([m]);
    expect(r.compiled).toEqual([m]);
  });

  it('lets go of a material freed while it was being readied', async () => {
    const { r, g, scene } = setup({ linkAfter: 50 });
    const m = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), m);
    scene.add(mesh);
    await frames(r, scene);
    expect(g.pending()).toBeGreaterThan(0);
    scene.remove(mesh);
    m.dispose();
    await frames(r, scene, 2);
    expect(g.pending()).toBe(0);
  });

  it("keeps drawing a ready material marked changed in a way its shader doesn't care about", async () => {
    const { r, scene } = setup();
    const m = new THREE.MeshStandardMaterial();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
    await frames(r, scene, 3);
    for (let i = 0; i < 3; i++) {
      m.color.setHex(0x112233 * (i + 1));
      m.needsUpdate = true;
      await frames(r, scene);
      expect(r.draws).toEqual([m]);
    }
  });

  it("sends a scan's pictures (lib/three/core's wear) before drawing what wears it", async () => {
    const { r, scene } = setup();
    const m = new THREE.MeshStandardMaterial();
    const scan = { map: picture(), normalMap: picture() };
    wear(m, scan);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), m);
    scene.add(mesh);
    r.compile(mesh);
    markLinked(r.properties.get(m).currentProgram);
    await frames(r, scene);
    expect(r.draws).toEqual([]);
    expect(r.uploads).toEqual(expect.arrayContaining([scan.map, scan.normalMap]));
    await frames(r, scene, 2);
    expect(r.draws).toEqual([m]);
  });

  it('never holds back a picture redrawn every frame once it is up (a canvas)', async () => {
    const { r, scene } = setup();
    const m = new THREE.MeshBasicMaterial({ map: picture() });
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
    await frames(r, scene, 3);
    m.map.needsUpdate = true;
    await frames(r, scene);
    expect(r.draws).toEqual([m]);
  });

  it("puts a world's look on a late thing before compiling it", async () => {
    const order = [];
    const { r, g, scene } = setup();
    const compile = r.compile;
    r.compile = (root, ...rest) => {
      order.push('compile');
      return compile(root, ...rest);
    };
    g.adopt(scene, (object) => order.push(`adopt ${object.name}`));
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    mesh.name = 'hunter';
    scene.add(mesh);
    await frames(r, scene);
    expect(order).toEqual(['adopt hunter', 'compile']);
  });

  it("doesn't hide a material forever when its compile throws", async () => {
    const { r, scene } = setup();
    r.compile = () => {
      throw new Error('bad shader');
    };
    const m = new THREE.MeshStandardMaterial();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
    await frames(r, scene, 3);
    expect(r.draws).toEqual([m]);
  });

  it("leaves a post pass's quad alone (it isn't a scene)", async () => {
    const { r } = setup();
    const m = new THREE.ShaderMaterial();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m);
    r.render(quad, camera);
    expect(r.draws).toEqual([m]);
  });

  it('can be switched off', async () => {
    const { r, g, scene } = setup();
    g.enabled = false;
    const m = new THREE.MeshStandardMaterial();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
    await frames(r, scene);
    expect(r.draws).toEqual([m]);
  });

  it('is installed once per renderer', () => {
    const { r, g } = setup();
    expect(guard(r)).toBe(g);
  });
});
