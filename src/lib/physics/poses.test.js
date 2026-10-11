import { describe, expect, it } from 'vitest';
import { HEADER, ROW, decodePoses, encodePoses, readPoses } from './poses.js';

const body = (id, p, q = [0, 0, 0, 1], sleeping = false) => ({
  id,
  sleeping,
  position: (out) => Object.assign(out, p),
  quaternion: (out) => Object.assign(out, q),
});

describe('encodePoses and decodePoses', () => {
  it('round-trips a pose a body, keyed by id', () => {
    const out = encodePoses([body(3, [1, 2, 3], [0, 0.6, 0, 0.8]), body(9, [-4, 5.5, 6], [0, 0, 0, 1], true)], new Float32Array(HEADER + ROW * 2));
    const poses = decodePoses(out);
    expect(out[0]).toBe(2);
    expect([...poses.keys()]).toEqual([3, 9]);
    expect(poses.get(3).position).toEqual([1, 2, 3]);
    expect(poses.get(3).quaternion.map((v) => +v.toFixed(6))).toEqual([0, 0.6, 0, 0.8]);
    expect(poses.get(3).sleeping).toBe(false);
    expect(poses.get(9).sleeping).toBe(true);
    expect(poses.get(9).position).toEqual([-4, 5.5, 6]);
  });

  it('grows the buffer when the bodies outnumber its rows, and keeps the header', () => {
    const small = new Float32Array(HEADER + ROW);
    small[1] = 7;
    const many = Array.from({ length: 5 }, (_, i) => body(i + 1, [i, 0, 0]));
    const out = encodePoses(many, small);
    expect(out).not.toBe(small);
    expect(out.length).toBeGreaterThanOrEqual(HEADER + ROW * 5);
    expect(out[0]).toBe(5);
    expect(out[1]).toBe(7);
    expect(decodePoses(out).get(5).position).toEqual([4, 0, 0]);
  });

  it('a body removed before the encode has no row, so nothing reads a stale index', () => {
    const live = new Map([
      [1, body(1, [1, 1, 1])],
      [2, body(2, [2, 2, 2])],
      [3, body(3, [3, 3, 3])],
    ]);
    live.delete(2);
    const poses = decodePoses(encodePoses(live.values(), new Float32Array(64)));
    expect(poses.has(2)).toBe(false);
    expect(poses.get(3).position).toEqual([3, 3, 3]);
  });

  it('readPoses walks the rows without allocating a map', () => {
    const buf = encodePoses([body(4, [1, 0, 0]), body(5, [0, 1, 0])], new Float32Array(64));
    const seen = [];
    readPoses(buf, (id, at, sleeping) => seen.push([id, buf[at], buf[at + 1], sleeping]));
    expect(seen).toEqual([
      [4, 1, 0, false],
      [5, 0, 1, false],
    ]);
  });
});
