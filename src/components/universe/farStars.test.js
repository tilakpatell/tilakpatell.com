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
