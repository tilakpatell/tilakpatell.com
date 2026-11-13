import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FAR_STARS, brightness, createFarStars, realAt, starK, starPx } from './farStars';
import { MOONS, UNIVERSES } from './universes';
import { SUN } from './layout';

// a camera at a point, looking down -z, its world matrix up to date
const camAt = (x, y, z) => {
  const c = new THREE.PerspectiveCamera(34, 1, 1, 30000);
  c.position.set(x, y, z);
  c.updateMatrixWorld(true);
  return c;
};
const alphaOf = (stars, i) => stars.points.geometry.attributes.aK.getX(i);

describe('the rules', () => {
  it('is real within twenty reaches, never under 1500', () => {
    expect(realAt({ reach: 100 })).toBe(2000);
    expect(realAt({ reach: 322 })).toBe(6440);
    expect(realAt({ reach: 10 })).toBe(1500);
    expect(realAt({ r: 120 })).toBe(2400); // (no reach: its radius)
  });

  it('crossfades over the last fifth', () => {
    expect(starK(1500, 2000)).toBe(0);
    expect(starK(1600, 2000)).toBe(0);
    expect(starK(2000, 2000)).toBe(1);
    expect(starK(1800, 2000)).toBeCloseTo(0.5, 1);
    expect(starK(1e6, 2000)).toBe(1);
  });

  it('is brighter and bigger nearer', () => {
    expect(brightness(8000, 2000)).toBe(1);
    expect(brightness(40000, 2000)).toBeCloseTo(0.2);
    expect(brightness(1e6, 2000)).toBe(0.12);
    expect(starPx(1)).toBe(20);
    expect(starPx(0)).toBe(7);
  });
});

describe('the places', () => {
  it('lists every world and moon, in its sector, and the stations as stations', () => {
    const by = new Map(FAR_STARS.map((p) => [p.id, p]));
    for (const u of UNIVERSES.filter((x) => x.kind !== 'core')) expect(by.get(u.id)?.sector, u.id).toBe('main');
    for (const m of MOONS) expect(by.get(m.id)?.sector, m.id).toBe('rickmorty');
    for (const u of UNIVERSES.filter((x) => x.kind === 'core')) expect(by.get(u.id)?.station, u.id).toBe(true);
    for (const p of FAR_STARS) {
      expect(p.color, p.id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.reach, p.id).toBeGreaterThan(0);
    }
  });
});

describe('drawn', () => {
  const group = () => new THREE.Group();

  it('is a star far off, the real thing near, and hides only what it hid', () => {
    const parent = new THREE.Group();
    const g = group();
    const stars = createFarStars(parent, { places: [{ id: 'a', at: [0, 0, -10000], reach: 100, color: '#88aaff', sector: 'main', group: g }], skyFar: 24000 });
    stars.update(camAt(0, 0, 0), 1 / 60, { sector: 'main' });
    expect(alphaOf(stars, 0)).toBe(1);
    expect(stars.kOf('a')).toBe(1);
    expect(g.visible).toBe(false);
    stars.update(camAt(0, 0, -9000), 1 / 60, { sector: 'main' });
    expect(alphaOf(stars, 0)).toBe(0);
    expect(stars.kOf('a')).toBe(0);
    expect(g.visible).toBe(true);
    stars.update(camAt(0, 0, 0), 1 / 60, { sector: 'main' });
    stars.dispose();
    expect(g.visible).toBe(true);
    expect(parent.children).toHaveLength(0);
  });

  it('hides the other sector: no star, nothing real, its name off', () => {
    const gMain = group();
    const gRm = group();
    const stars = createFarStars(new THREE.Group(), {
      places: [
        { id: 'm', at: [0, 0, -10000], reach: 100, color: '#ffffff', sector: 'main', group: gMain },
        { id: 'r', at: [0, 0, -1000], reach: 100, color: '#7dff9a', sector: 'rickmorty', group: gRm },
      ],
      skyFar: 24000,
    });
    stars.update(camAt(0, 0, 0), 1 / 60, { sector: 'main' });
    expect(alphaOf(stars, 0)).toBe(1);
    expect(alphaOf(stars, 1)).toBe(0);
    expect(gRm.visible).toBe(false);
    expect(stars.kOf('r')).toBe(1);
    // with no sector given (the Expanse's), nothing's filtered
    stars.update(camAt(0, 0, 0), 1 / 60);
    expect(gRm.visible).toBe(true);
    stars.dispose();
  });

  it('folds the stations into home: real near the sun, nothing at all past 2,500 of it', () => {
    const g = group();
    const stars = createFarStars(new THREE.Group(), { places: [{ id: 's', at: [SUN.at[0] + 140, 0, SUN.at[2]], reach: 25, color: '#ffffff', sector: 'main', station: true, group: g }], skyFar: 24000 });
    stars.update(camAt(0, 0, 2000), 1 / 60, { sector: 'main' });
    expect(g.visible).toBe(true);
    expect(stars.kOf('s')).toBe(0);
    stars.update(camAt(0, 0, 3000), 1 / 60, { sector: 'main' });
    expect(g.visible).toBe(false);
    expect(alphaOf(stars, 0)).toBe(0);
    expect(stars.kOf('s')).toBe(1);
    stars.dispose();
  });

  it('pulses the one in focus', () => {
    const stars = createFarStars(new THREE.Group(), { places: [{ id: 'a', at: [0, 0, -10000], reach: 100, color: '#ffffff', sector: 'main' }, { id: 'b', at: [0, 0, 10000], reach: 100, color: '#ffffff', sector: 'main' }], skyFar: 24000 });
    stars.update(camAt(0, 0, 0), 1 / 60, { sector: 'main', focus: 'b' });
    const f = stars.points.geometry.attributes.aFocus;
    expect([f.getX(0), f.getX(1)]).toEqual([0, 1]);
    stars.dispose();
  });
});

describe('on foot', () => {
  it('is never cut by the far plane (on foot it is the landing sky, well short of the stars)', () => {
    const stars = createFarStars(new THREE.Group(), { places: [], skyFar: 24000 });
    expect(stars.points.material.vertexShader).toMatch(/gl_Position\.z = min\(gl_Position\.z, gl_Position\.w \* 0\.999999\)/);
    stars.dispose();
  });
});

describe('a star’s size in the frame’s pixels', () => {
  it('reads the canvas’s height once and again only when it is resized, not on every draw (a read forces the page’s layout)', () => {
    const was = globalThis.ResizeObserver;
    const seen = [];
    globalThis.ResizeObserver = class {
      constructor(fn) {
        this.fn = fn;
        seen.push(this);
      }
      observe() {}
      disconnect() {}
    };
    try {
      let reads = 0;
      let height = 800;
      const domElement = {
        get clientHeight() {
          reads += 1;
          return height;
        },
      };
      let buffer = 1600;
      const renderer = { domElement, getRenderTarget: () => null, getDrawingBufferSize: (v) => v.set(2560, buffer), getPixelRatio: () => 2 };
      const stars = createFarStars(new THREE.Group(), { places: [], skyFar: 24000 });
      const dpr = () => stars.points.material.uniforms.uDpr.value;
      for (let i = 0; i < 10; i++) stars.points.onBeforeRender(renderer);
      expect(dpr()).toBe(2);
      expect(reads).toBe(1);
      // resized: the canvas half as tall on the page, the buffer as it was
      height = 400;
      for (const o of seen) o.fn([]);
      for (let i = 0; i < 10; i++) stars.points.onBeforeRender(renderer);
      expect(dpr()).toBe(4);
      expect(reads).toBe(2);
      // the buffer drawn at another ratio is read from the renderer, as before
      buffer = 800;
      stars.points.onBeforeRender(renderer);
      expect(dpr()).toBe(2);
      stars.dispose();
    } finally {
      globalThis.ResizeObserver = was;
    }
  });
});

describe('the far layer of the endless space', () => {
  const SKY = 24000;
  const make = (opts = {}) => createFarStars(new THREE.Group(), { places: [{ id: 'a', at: [0, 0, -10000], reach: 100, color: '#88aaff' }], skyFar: SKY, slots: 4, slotSize: 8, discs: 3, ...opts });
  const sector = (count, color = [255, 128, 0]) => ({
    centre: [1.2e8, 0, -3e7],
    at: Float32Array.from({ length: count * 3 }, (_, i) => (i % 3 === 0 ? 1000 * (i / 3) : 0)),
    color: Uint8Array.from({ length: count * 3 }, (_, i) => color[i % 3]),
    r: new Float32Array(count).fill(40),
    count,
  });

  it('sits at the camera, its places written from it, where they were on the sky', () => {
    const stars = make();
    const cam = camAt(500, -200, 3000);
    stars.update(cam, 1 / 60);
    expect(stars.points.position.toArray()).toEqual([500, -200, 3000]);
    const p = stars.points.geometry.attributes.position;
    const d = Math.hypot(-500, 200, -13000);
    const want = [500 + (-500 * SKY) / d, -200 + (200 * SKY) / d, 3000 + (-13000 * SKY) / d];
    [p.getX(0) + 500, p.getY(0) - 200, p.getZ(0) + 3000].forEach((v, i) => expect(v).toBeCloseTo(want[i], 2)); // (32 bits at the sky's distance)
    stars.dispose();
  });

  it('is one draw, whatever it holds', () => {
    const parent = new THREE.Group();
    const stars = createFarStars(parent, { places: [], skyFar: SKY, slots: 2, slotSize: 4, discs: 2 });
    stars.update(camAt(0, 0, 0));
    stars.setSlot(0, sector(3));
    stars.showSlots([0]);
    stars.discs.begin();
    stars.discs.push(0, 0, -900, 10, 1, 1, 1, 1, 0, 0, 1);
    stars.discs.end();
    stars.update(camAt(0, 0, 0));
    expect(parent.children).toHaveLength(1);
    expect(parent.children[0]).toBe(stars.points);
    stars.dispose();
  });

  it('uploads a sector into its slot alone, hidden, and flips slots in one call', () => {
    const stars = make();
    const geo = stars.points.geometry;
    geo.attributes.aK.clearUpdateRanges();
    stars.setSlot(3, sector(5));
    expect(stars.points.material.uniforms.uSlot.value[3].w).toBe(0);
    expect(geo.attributes.aK.updateRanges).toEqual([{ start: 1 + 3 * 8, count: 8 }]);
    expect(geo.attributes.aK.array.slice(1 + 3 * 8, 1 + 4 * 8)).toEqual(Float32Array.from([1, 1, 1, 1, 1, 0, 0, 0]));
    expect(geo.attributes.aColor.getX(1 + 3 * 8)).toBe(1);
    stars.setSlot(2, sector(2));
    stars.showSlots([3, 2]);
    stars.update(camAt(0, 0, 0));
    expect([stars.slotShown(2), stars.slotShown(3)]).toEqual([1, 1]);
    stars.showSlots([1]);
    stars.hideSlots([3]);
    stars.update(camAt(0, 0, 0));
    expect([stars.slotShown(1), stars.slotShown(3)]).toEqual([1, 0]);
    stars.dispose();
  });

  it('takes each slot’s centre from the camera in doubles, so a sector 10^8 out is where it is', () => {
    const stars = make();
    stars.setSlot(0, sector(1));
    stars.showSlots([0]);
    stars.update(camAt(1.2e8 - 5000, 3, -3e7 + 7));
    const u = stars.points.material.uniforms.uSlot.value[0];
    expect(u.toArray()).toEqual([5000, -3, -7, 1]);
    stars.dispose();
  });

  it('fades a new place in over the time asked', () => {
    const stars = make();
    stars.setSlot(1, sector(2));
    stars.fadeSlot(1, 0.5);
    stars.update(camAt(0, 0, 0), 0.25);
    expect(stars.slotShown(1)).toBeCloseTo(0.5, 9);
    stars.update(camAt(0, 0, 0), 0.25);
    expect(stars.slotShown(1)).toBe(1);
    stars.dispose();
  });

  it('draws discs far to near, keeps the nearest past its room, from the camera', () => {
    const stars = make();
    stars.update(camAt(100, 0, 0));
    stars.discs.begin();
    for (const z of [-500, -4000, -2000, -9000, -1000]) stars.discs.push(100, 0, z, 10, 0.5, 0.5, 0.5, 0, 1, 0, 1);
    stars.discs.push(100, 0, -50, 10, 1, 1, 1, 0, 0, 0, 0); // (nothing of it shown: not drawn)
    stars.discs.end();
    const p = stars.points.geometry.attributes.position;
    const at = (i) => p.getZ(1 + 4 * 8 + i);
    expect([at(0), at(1), at(2)]).toEqual([-2000, -1000, -500]);
    expect(p.getX(1 + 4 * 8)).toBe(0); // (100 less the camera's 100)
    expect(stars.discs.count()).toBe(3);
    stars.update(camAt(100, 0, 0));
    expect(stars.points.geometry.drawRange.count).toBe(1 + 4 * 8 + 3);
    stars.dispose();
  });

  it('counts a disc that comes from nothing to whole in one frame as a pop', () => {
    const stars = make();
    stars.update(camAt(0, 0, 0));
    const frame = (alpha) => {
      stars.discs.begin();
      stars.discs.push(0, 0, -2000, 40, 1, 1, 1, 0, 0, 0, alpha, 7);
      stars.discs.end();
    };
    frame(0.2);
    frame(0.4);
    expect(stars.pops().count).toBe(0);
    frame(0);
    frame(0.9);
    const pop = stars.pops();
    expect(pop.count).toBe(1);
    expect(pop.px).toBeGreaterThan(30);
    expect(stars.pops().count).toBe(0); // (since last asked)
    stars.dispose();
  });

  it('adds a star’s light and draws a disc over, by premultiplied blending, from the same rules', () => {
    const m = make().points.material;
    expect([m.blending, m.blendSrc, m.blendDst]).toEqual([THREE.CustomBlending, THREE.OneFactor, THREE.OneMinusSrcAlphaFactor]);
    expect(m.vertexShader).toContain('* 20.0'); // (REAL_REACHES)
    expect(m.vertexShader).toContain('uFar * 0.80'); // (the last fifth, FADE)
    expect(m.fragmentShader).toMatch(/vK, 0\.0\);/); // (a star: alpha nought, so it adds)
  });
});
