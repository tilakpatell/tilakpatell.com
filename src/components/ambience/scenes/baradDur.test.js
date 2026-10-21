import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildBaradDur, EYE_Y, HEAT_MAX, WINDOW_U } from './baradDur';

const tris = (g) => g.attributes.position.count / 3;
// (the uv is stored as 32-bit floats)
const isWindow = (u) => Math.abs(u - WINDOW_U) < 1e-6;

describe('buildBaradDur', () => {
  it('is the same tower from the same seed', () => {
    const a = buildBaradDur(THREE, { seed: 7 }).geometry.attributes;
    const b = buildBaradDur(THREE, { seed: 7 }).geometry.attributes;
    for (const name of ['position', 'normal', 'color', 'uv']) expect(Array.from(a[name].array)).toEqual(Array.from(b[name].array));
    const c = buildBaradDur(THREE, { seed: 8 }).geometry.attributes;
    expect(Array.from(c.color.array)).not.toEqual(Array.from(a.color.array));
  });

  it('keeps to its triangle budget at each detail', () => {
    const full = tris(buildBaradDur(THREE, { detail: 1 }).geometry);
    const half = tris(buildBaradDur(THREE, { detail: 0.5 }).geometry);
    expect(full).toBeLessThan(40000);
    expect(half).toBeLessThan(16000);
    // and the cut-down tower really is smaller
    expect(half).toBeLessThan(full * 0.8);
  });

  it('stands a unit high with its foot on the ground', () => {
    const { geometry, height } = buildBaradDur(THREE);
    const box = geometry.boundingBox;
    expect(box.min.y).toBeCloseTo(0, 5);
    expect(box.max.y).toBeGreaterThan(0.97);
    expect(box.max.y).toBeLessThan(1.04);
    expect(height).toBeCloseTo(box.max.y, 6);
    // slender: never wider than it is high
    expect(box.max.x - box.min.x).toBeLessThan(0.75);
  });

  it('holds the Eye between the horns, under their tips', () => {
    const { geometry, eyeAt } = buildBaradDur(THREE);
    expect(eyeAt.y).toBeCloseTo(EYE_Y, 6);
    expect(eyeAt.x).toBe(0);
    const p = geometry.attributes.position;
    // the horns at the Eye’s height: stone either side of it, none on it
    let left = 0;
    let right = 0;
    let onIt = 0;
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(p.getY(i) - eyeAt.y) > 0.015) continue;
      const x = p.getX(i);
      if (x < -0.035) left++;
      else if (x > 0.035) right++;
      else if (Math.abs(p.getZ(i)) < 0.02) onIt++;
    }
    expect(left).toBeGreaterThan(0);
    expect(right).toBeGreaterThan(0);
    expect(onIt).toBe(0);
    expect(geometry.boundingBox.max.y).toBeGreaterThan(eyeAt.y + 0.05);
  });

  it('gives every triangle a unit normal, a colour and the heat it is lit by', () => {
    const { geometry } = buildBaradDur(THREE, { detail: 0.5 });
    const { normal, color, uv } = geometry.attributes;
    for (let i = 0; i < normal.count; i += 7) {
      expect(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i))).toBeCloseTo(1, 4);
      expect(color.getX(i)).toBeGreaterThanOrEqual(0);
      expect(color.getX(i)).toBeLessThan(0.5);
      const u = uv.getX(i);
      expect(u <= HEAT_MAX || isWindow(u)).toBe(true);
    }
    // the stone by the Eye is warmer than the stone at the foot
    const p = geometry.attributes.position;
    let top = 0;
    let foot = 0;
    for (let i = 0; i < p.count; i++) {
      if (isWindow(uv.getX(i))) continue;
      if (p.getY(i) > 0.85) top = Math.max(top, uv.getX(i));
      if (p.getY(i) < 0.2) foot = Math.max(foot, uv.getX(i));
    }
    expect(top).toBeGreaterThan(0.4);
    expect(foot).toBeLessThan(0.01);
  });
});
