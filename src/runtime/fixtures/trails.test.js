import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MOVERS, TRAIL, createTrails, trailBand, trailShare } from './trails';

// a picture of w × h, every pixel `bg`, with `paint(x, y) → rgb | null` over it
const picture = (w, h, bg, paint = () => null) => {
  const data = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(paint(x, y) ?? bg, (y * w + x) * 3);
  return { data, info: { width: w, height: h, channels: 3 } };
};

describe('the trail band', () => {
  it('is the strip behind the mover past one frame’s travel, as tall as it, inside the picture', () => {
    // moving right at 4 px a frame, now at x 40…60
    expect(trailBand({ x: 40, y: 10, w: 20, h: 8 }, { dx: 4, dy: 0 }, { width: 100, height: 50 })).toEqual({ x: 16, y: 10, w: 20, h: 8 });
    // (moving left: the band is to its right; clipped at the edge)
    expect(trailBand({ x: 70, y: 0, w: 20, h: 8 }, { dx: -6, dy: 0 }, { width: 100, height: 50 })).toEqual({ x: 96, y: 0, w: 4, h: 8 });
  });
});

describe('trailShare', () => {
  it('counts the band’s pixels within the tolerance of the mover’s colour', () => {
    const red = [200, 20, 20];
    const clean = picture(40, 10, [90, 90, 90]);
    expect(trailShare(clean, { x: 0, y: 0, w: 20, h: 10 }, red)).toBe(0);
    const ghost = picture(40, 10, [90, 90, 90], (x) => (x < 5 ? [190, 30, 25] : null));
    expect(trailShare(ghost, { x: 0, y: 0, w: 20, h: 10 }, red)).toBeCloseTo(0.25, 6);
    // (a faint tint toward it is not its colour)
    const faint = picture(40, 10, [90, 90, 90], () => [120, 75, 75]);
    expect(trailShare(faint, { x: 0, y: 0, w: 20, h: 10 }, red)).toBe(0);
    expect(trailShare(clean, { x: 0, y: 0, w: 0, h: 10 }, red)).toBe(0);
  });
  it('says what fails and why, with its source', () => {
    expect(TRAIL).toMatchObject({ frames: 30, most: 0.02 });
    expect(TRAIL._source).toMatch(/spec/);
  });
});

describe('createTrails', () => {
  it('moves every kind the plan names across a still background, the banner panning its texture in place', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 100);
    const t = createTrails(scene, camera, THREE);
    expect(t.movers.map((m) => m.name)).toEqual(MOVERS.map((m) => m.name));
    expect(MOVERS.map((m) => m.name)).toEqual(['crate', 'figure', 'row', 'card', 'banner']);
    const figure = t.movers.find((m) => m.name === 'figure').object;
    expect(figure.isSkinnedMesh).toBe(true);
    const row = t.movers.find((m) => m.name === 'row').object;
    expect(row.isInstancedMesh).toBe(true);
    const card = t.movers.find((m) => m.name === 'card').object;
    expect(card.material.alphaTest).toBeGreaterThan(0);
    const banner = t.movers.find((m) => m.name === 'banner').object;
    const crate = t.movers.find((m) => m.name === 'crate').object;
    const x0 = crate.position.x;
    const off0 = banner.material.map.offset.x;
    const bone0 = figure.skeleton.bones[0].position.x;
    const m0 = new THREE.Matrix4();
    row.getMatrixAt(0, m0);
    for (let i = 0; i < 10; i++) t.step();
    expect(crate.position.x).toBeGreaterThan(x0);
    // (the figure moves by its bone, its mesh where it was: the skinning's velocity)
    expect(figure.position.x).toBe(0);
    expect(figure.skeleton.bones[0].position.x).toBeGreaterThan(bone0);
    const m1 = new THREE.Matrix4();
    row.getMatrixAt(0, m1);
    expect(m1.elements[12]).toBeGreaterThan(m0.elements[12]);
    expect(banner.position.x).toBe(t.movers.find((m) => m.name === 'banner').object.position.x);
    expect(banner.material.map.offset.x).not.toBe(off0);
    // each geometric mover's screen box and its travel a frame
    camera.position.set(0, 1.5, 6);
    camera.lookAt(0, 1.5, 0);
    camera.updateMatrixWorld();
    const boxes = t.screen({ width: 1600, height: 900 });
    expect(boxes.map((b) => b.name)).toEqual(['crate', 'figure', 'row', 'card']);
    // (the figure's box is drawn where its bone is: bound at the origin)
    figure.updateMatrixWorld(true);
    figure.skeleton.update();
    const v = new THREE.Vector3().fromBufferAttribute(figure.geometry.attributes.position, 0);
    figure.applyBoneTransform(0, v);
    expect(v.x).toBeCloseTo(figure.skeleton.bones[0].position.x + figure.geometry.attributes.position.getX(0), 6);
    for (const b of boxes) {
      expect(b.rect.w).toBeGreaterThan(4);
      expect(b.step.dx).toBeGreaterThan(0);
    }
  });
});
