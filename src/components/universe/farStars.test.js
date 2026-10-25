import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FAR_STARS, brightness, createFarStars, realAt, starK, starPx } from './farStars';
import { MOONS, UNIVERSES } from './universes';
import { SUN } from './layout';
import { FADE, FAR, REAL_REACHES, SPECK_LEAST, discPx, speckBright } from '../expanse/shared/levels';

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

// ── the far layer: hand-made places, generated discs and slots of specks, one draw ──

const slotOf = (centre, pts) => ({
  centre,
  at: Float32Array.from(pts.flatMap((p) => p.at)),
  color: Uint8Array.from(pts.flatMap((p) => p.color)),
  r: Float32Array.from(pts.map((p) => p.r)),
  count: pts.length,
});
const uSlot = (stars) => stars.points.material.uniforms.uSlot.value;
const ONE = { at: [0, 0, 0], color: [255, 255, 255], r: 50 };

describe('round the camera', () => {
  it('sits at the camera, map-local, with each place on the sky from it as today', () => {
    const parent = new THREE.Group();
    parent.position.set(-250, 40, 3000); // (the map, moved)
    parent.updateMatrixWorld(true);
    const cam = [1e9, 2e8, -7e8];
    const local = [cam[0] + 250, cam[1] - 40, cam[2] - 3000];
    const places = [
      { id: 'a', at: [local[0] + 12000, local[1] - 300, local[2] + 5000], reach: 100, color: '#88aaff' },
      { id: 'b', at: [0, 0, 0], reach: 60, color: '#ffffff' },
      { id: 'c', at: [local[0] + 900, local[1] + 30, local[2] - 500], reach: 100, color: '#ffcc66' },
    ];
    const stars = createFarStars(parent, { places, skyFar: 24000 });
    stars.update(camAt(...cam));
    stars.points.position.toArray().forEach((v, j) => expect(Math.abs(v - local[j])).toBeLessThan(1e-6));
    const pos = stars.points.geometry.attributes.position;
    places.forEach((p, i) => {
      const d = p.at.map((v, j) => v - local[j]);
      const dist = Math.hypot(...d);
      const sky = local.map((c, j) => c + d[j] * (24000 / dist)); // (today's sky point, in the map)
      for (let j = 0; j < 3; j++) expect(Math.abs(pos.getComponent(i, j) + stars.points.position.getComponent(j) - sky[j]), `${p.id} ${j}`).toBeLessThan(1e-3);
      expect(stars.kOf(p.id)).toBe(starK(dist, realAt(p)));
    });
    expect(stars.kOf('c')).toBe(0); // (about 1,030 off: real)
    stars.dispose();
  });
});

describe('one draw', () => {
  it('draws places, discs and slots in its one Points', () => {
    const parent = new THREE.Group();
    const stars = createFarStars(parent, { places: [{ id: 'a', at: [0, 0, -10000], reach: 100, color: '#ffffff' }], skyFar: 24000, slots: [4, 4], discs: 2 });
    stars.update(camAt(0, 0, 0));
    stars.setSlot(1, slotOf([0, 0, -100000], [ONE, { ...ONE, at: [500, 0, 0] }]));
    stars.showSlots([1]);
    stars.discs.begin();
    stars.discs.push(0, 0, -20000, 300, 0.4, 0.3, 0.2, 1, 0, 0, 1);
    stars.discs.end();
    stars.update(camAt(0, 0, 0));
    expect(parent.children).toEqual([stars.points]);
    expect(stars.points.isPoints).toBe(true);
    expect(stars.points.geometry.groups).toHaveLength(0);
    expect(stars.points.geometry.attributes.position.count).toBe(1 + 2 + 8);
    stars.dispose();
    expect(parent.children).toHaveLength(0);
  });

  it('draws the discs last, after every speck, so a disc covers the specks behind it', () => {
    // (one draw blends in the vertices' order: a speck adds over what's drawn
    // before it, a disc covers it)
    const stars = createFarStars(new THREE.Group(), { places: [{ id: 'a', at: [0, 0, -10000], reach: 100, color: '#ffffff' }], skyFar: 24000, slots: [4, 3], discs: 2 });
    const { aSlot, aK, position } = stars.points.geometry.attributes;
    expect([...aSlot.array]).toEqual([-2, 0, 0, 0, 0, 1, 1, 1, -1, -1]);
    stars.update(camAt(0, 0, 0));
    stars.discs.begin();
    stars.discs.push(0, 0, -20000, 300, 0.05, 0.05, 0.05, 1, 0, 0, 1);
    stars.discs.end();
    expect(aK.getX(8)).toBe(1);
    expect(position.getZ(8)).toBe(-20000);
    stars.dispose();
  });
});

describe('slots', () => {
  const SLOTS = [400, 400, 400, 400, 400];
  const make = () => createFarStars(new THREE.Group(), { places: [{ id: 'a', at: [0, 0, -10000], reach: 100, color: '#ffffff' }], skyFar: 24000, slots: SLOTS, discs: 4 });
  const start = (i) => 1 + 400 * i; // (the places, then the slots, then the discs)

  it('takes a sector into its slot, uploads only that slot, and keeps it hidden', () => {
    const stars = make();
    stars.update(camAt(0, 0, 0));
    const attrs = stars.points.geometry.attributes;
    const was = Object.fromEntries(['position', 'aColor', 'aSize'].map((k) => [k, attrs[k].updateRanges.length]));
    stars.setSlot(3, slotOf([1e9, 0, 0], [{ at: [10, 20, 30], color: [255, 128, 0], r: 40 }, { at: [-5, 0, 7], color: [0, 0, 255], r: 12 }]));
    for (const [k, size] of [['position', 3], ['aColor', 3], ['aSize', 1]]) {
      expect(attrs[k].updateRanges.length - was[k], k).toBe(1);
      expect(attrs[k].updateRanges.at(-1), k).toEqual({ start: start(3) * size, count: 400 * size });
    }
    expect(uSlot(stars)[3].w).toBe(0);
    expect([...attrs.position.array.slice(start(3) * 3, start(3) * 3 + 6)]).toEqual([10, 20, 30, -5, 0, 7]);
    expect([...attrs.aSize.array.slice(start(3), start(3) + 3)]).toEqual([40, 12, 0]);
    // (its colour as a swatch's hex reads: sRGB bytes into the working space)
    const c = new THREE.Color().setRGB(1, 128 / 255, 0, THREE.SRGBColorSpace);
    expect(attrs.aColor.array[start(3) * 3 + 1]).toBeCloseTo(c.g, 6);
    stars.dispose();
  });

  it('takes every byte of a colour into the working space as a swatch’s hex reads, however many specks a slot holds', () => {
    const pts = Array.from({ length: 256 }, (_, i) => ({ at: [i, 0, 0], color: [i, 255 - i, (i * 7) & 255], r: 10 }));
    const stars = createFarStars(new THREE.Group(), { places: [], skyFar: 24000, slots: [256] });
    stars.setSlot(0, slotOf([0, 0, 0], pts));
    const C = stars.points.geometry.attributes.aColor.array;
    const c = new THREE.Color();
    pts.forEach((p, i) => {
      c.setRGB(p.color[0] / 255, p.color[1] / 255, p.color[2] / 255, THREE.SRGBColorSpace);
      expect(C[i * 3]).toBeCloseTo(c.r, 6);
      expect(C[i * 3 + 1]).toBeCloseTo(c.g, 6);
      expect(C[i * 3 + 2]).toBeCloseTo(c.b, 6);
    });
    stars.dispose();
  });

  it('keeps none of a slot’s old specks, and what fits of too many', () => {
    const stars = createFarStars(new THREE.Group(), { places: [], skyFar: 24000, slots: [3, 3] });
    const R = stars.points.geometry.attributes.aSize.array;
    stars.setSlot(0, slotOf([0, 0, 0], [ONE, { ...ONE, r: 60 }, { ...ONE, r: 70 }]));
    stars.setSlot(0, slotOf([0, 0, 0], [{ ...ONE, r: 9 }]));
    expect([...R.slice(0, 3)]).toEqual([9, 0, 0]);
    const five = [1, 2, 3, 4, 5].map((r) => ({ ...ONE, r }));
    stars.setSlot(1, slotOf([0, 0, 0], five));
    expect([...R.slice(3, 6)]).toEqual([1, 2, 3]);
    // (and no more than it was given, whatever the count says)
    stars.setSlot(1, { ...slotOf([0, 0, 0], [{ ...ONE, r: 8 }]), count: 3 });
    expect([...R.slice(3, 6)]).toEqual([8, 0, 0]);
    stars.dispose();
  });

  it('shows and hides in the call, so a swap is one frame', () => {
    const stars = make();
    stars.update(camAt(0, 0, 0));
    for (const i of [1, 3, 4]) stars.setSlot(i, slotOf([0, 0, -1e5], [ONE]));
    stars.showSlots([1]);
    expect(uSlot(stars)[1].w).toBe(1);
    stars.showSlots([3, 4]);
    expect([uSlot(stars)[3].w, uSlot(stars)[4].w]).toEqual([1, 1]);
    stars.hideSlots([1]);
    expect(uSlot(stars)[1].w).toBe(0);
    // a slot set again is hidden till it's shown
    stars.setSlot(3, slotOf([0, 0, -1e5], [ONE]));
    expect(uSlot(stars)[3].w).toBe(0);
    stars.dispose();
  });

  it('puts a slot round the camera, worked out in doubles', () => {
    const stars = make();
    stars.setSlot(0, slotOf([1e9 + 50000, -2e8, 7], [ONE]));
    stars.update(camAt(1e9, -2e8 + 10, 0));
    expect(uSlot(stars)[0].toArray()).toEqual([50000, -10, 7, 0]);
    stars.dispose();
  });

  it('fades a slot in over the seconds given', () => {
    const stars = make();
    stars.setSlot(2, slotOf([0, 0, -1e5], [ONE]));
    stars.update(camAt(0, 0, 0));
    stars.fadeSlot(2, 0.5);
    stars.update(camAt(0, 0, 0), 0.25);
    expect(uSlot(stars)[2].w).toBeCloseTo(0.5);
    stars.update(camAt(0, 0, 0), 0.25);
    expect(uSlot(stars)[2].w).toBe(1);
    stars.update(camAt(0, 0, 0), 0.25);
    expect(uSlot(stars)[2].w).toBe(1);
    stars.dispose();
  });

  it('uploads a frame only the places’ and the discs’ ranges, never a slot’s', () => {
    const stars = make();
    const attrs = stars.points.geometry.attributes;
    const discAt = start(SLOTS.length);
    const cam = camAt(0, 0, 0);
    stars.update(cam);
    const clear = () => Object.values(attrs).forEach((a) => a.clearUpdateRanges());
    // (each attribute's waiting ranges, as [from, to) in its array)
    const ranges = () => Object.fromEntries(Object.entries(attrs).map(([k, a]) => [k, a.updateRanges.map((r) => [r.start, r.start + r.count]).sort((x, y) => x[0] - y[0])]));
    const frame = (discs) => {
      stars.discs.begin();
      for (let k = 0; k < discs; k++) stars.discs.push(0, 0, -1000 * (k + 2), 10, 1, 1, 1, 0, 0, 0, 1);
      stars.discs.end();
      stars.update(cam);
    };
    const span = (size, from, count) => [from * size, (from + count) * size];
    clear();
    frame(3);
    expect(ranges()).toEqual({
      position: [span(3, 0, 1), span(3, discAt, 3)],
      aSize: [span(1, 0, 1), span(1, discAt, 3)],
      aColor: [span(3, 0, 1), span(3, discAt, 3)],
      aK: [span(1, 0, 1), span(1, discAt, 3)],
      aBright: [span(1, 0, 1)],
      aFocus: [span(1, 0, 1)],
      aLight: [span(3, discAt, 3)],
      aSlot: [],
    });
    // fewer discs the next frame: the ones gone are written too, as nothing
    clear();
    frame(1);
    const r = ranges();
    for (const k of ['aSize', 'aColor', 'aK', 'aLight']) expect(r[k].at(-1), k).toEqual(span(attrs[k].itemSize, discAt, 3));
    expect(r.position.at(-1)).toEqual(span(3, discAt, 1));
    // and nothing over a slot's specks, which only setSlot uploads
    for (const [k, list] of Object.entries(r)) for (const [a, b] of list) expect(b <= start(0) * attrs[k].itemSize || a >= discAt * attrs[k].itemSize, `${k} ${a}…${b}`).toBe(true);
    stars.dispose();
  });

  it('draws every vertex, whatever shows, so the discs after the slots are never cut', () => {
    const stars = make();
    const geo = stars.points.geometry;
    const drawn = () => [geo.drawRange.start, Math.min(geo.drawRange.count, geo.attributes.position.count)];
    const all = [0, start(SLOTS.length) + 4];
    stars.update(camAt(0, 0, 0));
    expect(drawn()).toEqual(all);
    stars.setSlot(3, slotOf([0, 0, -1e5], [ONE]));
    stars.showSlots([3]);
    expect(drawn()).toEqual(all);
    stars.hideSlots([3]);
    stars.setSlot(1, slotOf([0, 0, -1e5], [ONE]));
    stars.fadeSlot(1, 0.5);
    stars.update(camAt(0, 0, 0));
    expect(drawn()).toEqual(all);
    stars.dispose();
  });
});

describe('discs', () => {
  it('draws them far to near, from the camera, keeping the nearest it has room for', () => {
    const stars = createFarStars(new THREE.Group(), { places: [], skyFar: 24000, discs: 3 });
    const { position, aSize, aK, aLight, aColor } = stars.points.geometry.attributes;
    stars.update(camAt(1e9, 0, 0));
    stars.discs.begin();
    for (const d of [1000, 5000, 3000, 20000, 2000]) stars.discs.push(1e9 + d, 0, 0, d / 100, 0.5, 0.25, 1, 0, 1, 0, 0.75);
    stars.discs.end();
    const xs = () => [0, 1, 2].map((i) => position.getX(i));
    expect(xs()).toEqual([3000, 2000, 1000]);
    expect([...aSize.array.slice(0, 3)]).toEqual([30, 20, 10]);
    expect([...aK.array.slice(0, 3)]).toEqual([0.75, 0.75, 0.75]);
    expect([aLight.getX(1), aLight.getY(1), aLight.getZ(1)]).toEqual([0, 1, 0]);
    expect([aColor.getX(2), aColor.getY(2), aColor.getZ(2)]).toEqual([0.5, 0.25, 1]);
    // the camera moves on: they're written from it again
    stars.update(camAt(1e9 + 500, 0, 0));
    expect(xs()).toEqual([2500, 1500, 500]);
    // fewer the next frame: the rest drawn as nothing
    stars.discs.begin();
    stars.discs.push(1e9 + 9000, 0, 0, 5, 1, 1, 1, 0, 0, 0, 0.4);
    stars.discs.end();
    expect([...aK.array.slice(0, 3)]).toEqual([Math.fround(0.4), 0, 0]);
    expect(position.getX(0)).toBe(8500);
    stars.dispose();
  });

  it('takes no disc that is nowhere, so one never stops it keeping the nearest', () => {
    const stars = createFarStars(new THREE.Group(), { places: [], skyFar: 24000, discs: 2 });
    const { position, aK } = stars.points.geometry.attributes;
    stars.update(camAt(0, 0, 0));
    stars.discs.begin();
    stars.discs.push(NaN, 0, 0, 10, 1, 1, 1, 0, 0, 0, 1);
    for (const d of [1000, 2000, 3000]) stars.discs.push(d, 0, 0, 10, 1, 1, 1, 0, 0, 0, 1);
    stars.discs.end();
    expect([position.getX(0), position.getX(1)]).toEqual([2000, 1000]);
    // nor one infinitely far, even with room for it
    stars.discs.begin();
    stars.discs.push(Infinity, 0, 0, 10, 1, 1, 1, 0, 0, 0, 1);
    stars.discs.push(0, -Infinity, 0, 10, 1, 1, 1, 0, 0, 0, 1);
    stars.discs.push(500, 0, 0, 10, 1, 1, 1, 0, 0, 0, 1);
    stars.discs.end();
    expect([...aK.array.slice(0, 2)]).toEqual([1, 0]);
    expect(position.getX(0)).toBe(500);
    expect([...position.array].every(Number.isFinite)).toBe(true);
    stars.dispose();
  });

  it('blends premultiplied: a speck adds, a disc covers what is behind it', () => {
    const stars = createFarStars(new THREE.Group(), { places: [], skyFar: 24000, discs: 3 });
    const m = stars.points.material;
    expect(m.blending).toBe(THREE.CustomBlending);
    expect(m.blendEquation).toBe(THREE.AddEquation);
    expect(m.blendSrc).toBe(THREE.OneFactor);
    expect(m.blendDst).toBe(THREE.OneMinusSrcAlphaFactor);
    expect(m.fragmentShader).toMatch(/gl_FragColor = vec4\(c \* smoothstep\(1\.0, 0\.75, r\) \* vK, 0\.0\)/); // (a star's alpha 0: added)
    expect(m.fragmentShader).toMatch(/gl_FragColor = vec4\(vColor \* lit \* a, a\)/); // (a disc's: over)
    stars.dispose();
  });

  it('writes a disc’s depth where it covers, so a farther mesh drawn after it can’t cover it', () => {
    // (tested against nothing, so nothing of it hides behind the sky or the far plane)
    const m = createFarStars(new THREE.Group(), { places: [], skyFar: 24000, discs: 3 }).points.material;
    expect([m.transparent, m.depthTest, m.depthFunc, m.depthWrite]).toEqual([false, true, THREE.AlwaysDepth, true]);
    // (where it covers at least half the pixel, as a solid edge is drawn; a
    // faint disc, or its rim, lets what's behind it show rather than a hole)
    expect(m.fragmentShader).toMatch(/gl_FragDepth = a >= 0\.5 \? gl_FragCoord\.z : 1\.0;\s*gl_FragColor = vec4\(vColor \* lit \* a, a\)/);
  });

  it('writes a star’s and a speck’s depth as the far plane’s, so it never cuts a mesh in front of it', () => {
    // (it sits at skyFar, inside the far plane, not where it is)
    const f = createFarStars(new THREE.Group(), { places: [], skyFar: 24000 }).points.material.fragmentShader;
    expect(f).toMatch(/gl_FragDepth = 1\.0;\s*gl_FragColor = vec4\(c \* smoothstep\(1\.0, 0\.75, r\) \* vK, 0\.0\)/);
    // (and every fragment not thrown away writes one)
    expect(f.match(/gl_FragDepth =/g)).toHaveLength(f.match(/gl_FragColor =/g).length);
  });

  it('takes its numbers from the levels, so the chip cannot drift from them', () => {
    const v = createFarStars(new THREE.Group(), { places: [], skyFar: 24000 }).points.material.vertexShader;
    expect(v).toContain(String(REAL_REACHES));
    expect(v).toContain(`FADE = ${FADE}`);
    expect(v).toContain(`FAR = ${FAR}`);
    expect(v).toContain(`SPECK_LEAST = ${SPECK_LEAST}`);
  });
});

describe('the edge of what’s loaded', () => {
  it('fades every speck to nothing at the edge it’s given, as the levels’ rings beyond do, and none till it’s given one', () => {
    const stars = createFarStars(new THREE.Group(), { places: [], skyFar: 24000, slots: [4] });
    const u = stars.points.material.uniforms.uEdge;
    expect(u.value).toBeGreaterThan(1e29); // (none: nothing fades)
    stars.setEdge(240000);
    expect(u.value).toBe(240000);
    stars.setEdge(Infinity);
    expect(u.value).toBeGreaterThan(1e29);
    stars.setEdge(-5);
    expect(u.value).toBe(0);
    // (on the chip: a speck's share times the levels' beyondFade, inside(d, uEdge))
    const v = stars.points.material.vertexShader;
    expect(v).toMatch(/vK = aSize > 0\.0 \? slot\.w \* \(1\.0 - inside\(d, FAR\)\) \* inside\(d, uEdge\) : 0\.0;/);
    // (and a disc or a place takes none of it)
    expect(v.match(/uEdge/g)).toHaveLength(2);
    stars.dispose();
  });
});

describe('pops (dev)', () => {
  const H = 1080;
  const stubRenderer = { getRenderTarget: () => null, getDrawingBufferSize: (v) => v.set(1920, H), domElement: { clientHeight: H }, getPixelRatio: () => 1 };

  it('counts a disc that comes in at over half, never one that fades in', () => {
    const stars = createFarStars(new THREE.Group(), { places: [], skyFar: 24000, discs: 4 });
    const cam = camAt(0, 0, 0);
    stars.update(cam);
    stars.points.onBeforeRender(stubRenderer);
    expect(stars.pops()).toEqual({ count: 0, px: 0 }); // (from now)
    const frame = (rows) => {
      stars.discs.begin();
      for (const [id, z, r, a] of rows) stars.discs.push(0, 0, z, r, 1, 1, 1, 0, 0, 0, a, id);
      stars.discs.end();
      stars.update(cam);
    };
    frame([['a', -30000, 200, 0.9]]); // (first frame counted from: what's there was there)
    frame([['a', -30000, 200, 0.9], ['b', -20000, 100, 0.05]]);
    frame([['a', -30000, 200, 0.9], ['b', -20000, 100, 0.3]]);
    expect(stars.pops()).toEqual({ count: 0, px: 0 });
    frame([['a', -30000, 200, 0.9], ['b', -20000, 100, 0.6], ['c', -10000, 80, 0.8]]);
    const p = stars.pops();
    expect(p.count).toBe(1);
    expect(p.px).toBeCloseTo(discPx(10000, 80, { fovY: 34, height: H }), 6);
    expect(stars.pops()).toEqual({ count: 0, px: 0 }); // (each asking reads what's popped since the last)
    stars.dispose();
  });

  it('counts a slot shown out of nothing, but not a swap or a fade', () => {
    const stars = createFarStars(new THREE.Group(), { places: [], skyFar: 24000, slots: [4, 4, 4] });
    const cam = camAt(0, 0, 0);
    stars.update(cam);
    stars.points.onBeforeRender(stubRenderer);
    stars.pops();
    // (slots 0 and 1 hold the same sector, as a centre's swap stages it)
    for (const [i, key] of [[0, 'E:1,0,0'], [1, 'E:1,0,0'], [2, 'E:2,0,0']]) stars.setSlot(i, { ...slotOf([0, 0, -100000], [ONE]), key });
    stars.showSlots([0]);
    stars.update(cam);
    const p = stars.pops();
    expect(p.count).toBe(1);
    expect(p.px).toBeCloseTo(starPx(speckBright(100000, 50)), 5);
    // a swap: shown as another holding the same goes, in one frame
    stars.hideSlots([0]);
    stars.showSlots([1]);
    stars.update(cam);
    // a fade
    stars.fadeSlot(2, 0.5);
    for (let f = 0; f < 40; f++) stars.update(cam, 1 / 60);
    expect(uSlot(stars)[2].w).toBe(1);
    expect(stars.pops()).toEqual({ count: 0, px: 0 });
    // and a slot whose specks are all within the far plane (discs there) shows nothing to pop
    stars.setSlot(0, slotOf([0, 0, -10000], [ONE]));
    stars.showSlots([0]);
    stars.update(cam);
    expect(stars.pops()).toEqual({ count: 0, px: 0 });
    stars.dispose();
  });

  it('counts a slot shown as another goes when it holds something else', () => {
    const stars = createFarStars(new THREE.Group(), { places: [], skyFar: 24000, slots: [4, 4] });
    const cam = camAt(0, 0, 0);
    stars.update(cam);
    stars.points.onBeforeRender(stubRenderer);
    stars.setSlot(0, { ...slotOf([0, 0, -100000], [ONE]), key: 'A' });
    stars.showSlots([0]);
    stars.update(cam);
    stars.pops();
    stars.setSlot(1, { ...slotOf([0, 0, -200000], [{ ...ONE, r: 80 }]), key: 'B' });
    stars.update(cam); // (set, still hidden: nothing)
    expect(stars.pops()).toEqual({ count: 0, px: 0 });
    stars.hideSlots([0]);
    stars.showSlots([1]);
    stars.update(cam);
    const p = stars.pops();
    expect(p.count).toBe(1);
    expect(p.px).toBeCloseTo(starPx(speckBright(200000, 80)), 5);
    // a shown slot set again with something else and shown at once is new too
    stars.setSlot(1, { ...slotOf([0, 0, -100000], [ONE]), key: 'C' });
    stars.showSlots([1]);
    stars.update(cam);
    expect(stars.pops().count).toBe(1);
    // and with what it held, the same: no pop
    stars.setSlot(1, { ...slotOf([0, 0, -100000], [ONE]), key: 'C' });
    stars.showSlots([1]);
    stars.update(cam);
    expect(stars.pops()).toEqual({ count: 0, px: 0 });
    // with no key, nothing's the same as anything
    stars.setSlot(0, slotOf([0, 0, -100000], [ONE]));
    stars.hideSlots([1]);
    stars.showSlots([0]);
    stars.update(cam);
    expect(stars.pops().count).toBe(1);
    // and a slot hidden before it was ever drawn hands nothing on
    stars.setSlot(1, { ...slotOf([0, 0, -100000], [ONE]), key: 'D' });
    stars.showSlots([1]);
    stars.hideSlots([1]);
    stars.setSlot(0, { ...slotOf([0, 0, -100000], [ONE]), key: 'D' });
    stars.showSlots([0]);
    stars.update(cam);
    expect(stars.pops().count).toBe(1);
    stars.dispose();
  });

  it('takes a slot that holds several things as a swap when it shows as another holding any of them goes', () => {
    // (a centre's swap: a sector a ring held comes into a slot of its own, and
    // the ring goes for the next centre's, which holds the same ring's name)
    const stars = createFarStars(new THREE.Group(), { places: [], skyFar: 24000, slots: [4, 4, 4, 4] });
    const cam = camAt(0, 0, 0);
    stars.update(cam);
    stars.points.onBeforeRender(stubRenderer);
    stars.setSlot(0, { ...slotOf([0, 0, -100000], [ONE]), key: ['beyond:1', 'E:2,0', 'E:2,1'] });
    stars.setSlot(1, { ...slotOf([0, 0, -150000], [ONE]), key: 'E:-1,0' });
    stars.showSlots([0, 1]);
    stars.update(cam);
    stars.pops();
    stars.setSlot(2, { ...slotOf([0, 0, -100000], [ONE]), key: 'E:2,0' });
    stars.setSlot(3, { ...slotOf([0, 0, -150000], [ONE]), key: ['beyond:1', 'E:-1,0', 'E:3,0'] });
    stars.hideSlots([0, 1]);
    stars.showSlots([2, 3]);
    stars.update(cam);
    expect(stars.pops()).toEqual({ count: 0, px: 0 });
    // and one holding none of what went is new
    stars.setSlot(0, { ...slotOf([0, 0, -100000], [ONE]), key: ['beyond:2', 'E:9,9'] });
    stars.hideSlots([2]);
    stars.showSlots([0]);
    stars.update(cam);
    expect(stars.pops().count).toBe(1);
    stars.dispose();
  });

  it('counts nothing of a slot past the edge it’s given', () => {
    const stars = createFarStars(new THREE.Group(), { places: [], skyFar: 24000, slots: [4, 4] });
    const cam = camAt(0, 0, 0);
    stars.update(cam);
    stars.points.onBeforeRender(stubRenderer);
    stars.pops();
    stars.setEdge(200000);
    stars.setSlot(0, { ...slotOf([0, 0, -250000], [ONE]), key: 'far' });
    stars.showSlots([0]);
    stars.update(cam);
    expect(stars.pops()).toEqual({ count: 0, px: 0 });
    stars.setSlot(1, { ...slotOf([0, 0, -100000], [ONE]), key: 'near' });
    stars.showSlots([1]);
    stars.update(cam);
    expect(stars.pops().count).toBe(1);
    stars.dispose();
  });
});
