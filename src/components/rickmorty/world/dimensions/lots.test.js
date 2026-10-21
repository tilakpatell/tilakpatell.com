import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { at } from '../kit';
import { BALL } from '../interiors/shell';
import { STYLES, edgeRun, lot, opening, windowPaints } from './lots';

// the room kit's frame as the lots draw in it, recording every part in the world
function fakeRoom() {
  const parts = [];
  const tiled = [];
  const frame = (x, z, turn = 0, { y = 0, list = 'solid' } = {}) => {
    const base = at(x, y, z, turn);
    const put = (m) => base.clone().multiply(m);
    const f = {
      base,
      box(color, u, y0, v, w, h, d, ry = 0, rx = 0, rz = 0) {
        parts.push({ geo: 'box', geoRef: null, list, matrix: put(at(u, y0 + h / 2, v, ry, w, h, d, rx, rz)), unit: new THREE.BoxGeometry(1, 1, 1) });
        return f;
      },
      cbox(color, u, yc, v, w, h, d, ry = 0, rx = 0, rz = 0) {
        parts.push({ geo: 'box', list, matrix: put(at(u, yc, v, ry, w, h, d, rx, rz)), unit: new THREE.BoxGeometry(1, 1, 1) });
        return f;
      },
      cyl(color, u, y0, v, r, h, rx = 0, rz = 0, geo) {
        parts.push({ geo: geo === undefined ? 'CYL16' : 'cyl', geoRef: geo, list, matrix: put(at(u, y0 + (rx || rz ? 0 : h / 2), v, 0, r * 2, h, r * 2, rx, rz)), unit: geo ?? new THREE.CylinderGeometry(0.5, 0.5, 1, 16) });
        return f;
      },
      ball(color, u, yc, v, r, sy = 1, geo) {
        parts.push({ geo: 'ball', geoRef: geo ?? BALL, list, matrix: put(at(u, yc, v, 0, r * 2, r * 2 * sy, r * 2)), unit: geo ?? BALL });
        return f;
      },
      part(geo, color, u, yc, v, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) {
        parts.push({ geo: 'part', geoRef: geo, list, matrix: put(at(u, yc, v, ry, sx, sy, sz, rx, rz)), unit: geo });
        return f;
      },
      glow(geo, color, k, u, yc, v, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) {
        parts.push({ geo: 'glow', geoRef: geo, list: 'glow', matrix: put(at(u, yc, v, ry, sx, sy, sz, rx, rz)), unit: geo });
        return f;
      },
      decal(name) {
        parts.push({ geo: 'decal', name, list });
        return f;
      },
      mat: (u, yc, v, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => put(at(u, yc, v, ry, sx, sy, sz, rx, rz)),
    };
    return f;
  };
  const R = {
    id: 'trial',
    frame,
    fixed: (x, z, turn) => frame(x, z, turn, { list: 'fixed' }),
    tiled: { add: (geo, mat, matrix) => tiled.push({ geo, mat, matrix }) },
    own: (x) => x,
    kit: { mats: { painted: (name, w, h, draw, opts) => ({ name, userData: { tile: opts?.tile ?? 0 }, draw }) } },
  };
  return { R, parts, tiled };
}
// every part's box in the world (the tiled facades too)
function worldBoxes(parts, tiled) {
  const out = [];
  for (const p of parts) {
    if (!p.matrix) continue;
    const g = p.unit.clone().applyMatrix4(p.matrix);
    g.computeBoundingBox();
    out.push(g.boundingBox);
  }
  for (const t of tiled) {
    const g = t.geo.clone().applyMatrix4(t.matrix);
    g.computeBoundingBox();
    out.push(g.boundingBox);
  }
  return out;
}
const LOOK = { walls: [0xe8d8b8, 0xc8b898], roofs: [0x8a5a3a], lit: [0xffe08a], trim: 0x5a4a3a };

describe('the code buildings', () => {
  for (const style of STYLES) {
    it(`draws a ${style} inside its footprint and its height, turned or not`, () => {
      for (const turn of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const { R, parts, tiled } = fakeRoom();
        const L = { x: 100, z: -40, turn, w: 12, d: 9, h: 14, y: 1.5, style };
        lot(R, L, LOOK, { windows: windowPaints(R, LOOK), list: 'fixed' });
        const boxes = worldBoxes(parts, tiled);
        expect(boxes.length, style).toBeGreaterThan(0);
        // (a quarter turn swaps its width and depth)
        const across = Math.abs(Math.sin(turn)) > 0.5;
        const hw = (across ? L.d : L.w) / 2 + 1e-6;
        const hd = (across ? L.w : L.d) / 2 + 1e-6;
        for (const b of boxes) {
          expect(b.min.x, style).toBeGreaterThanOrEqual(L.x - hw);
          expect(b.max.x, style).toBeLessThanOrEqual(L.x + hw);
          expect(b.min.z, style).toBeGreaterThanOrEqual(L.z - hd);
          expect(b.max.z, style).toBeLessThanOrEqual(L.z + hd);
          expect(b.max.y, style).toBeLessThanOrEqual(L.y + L.h + 1e-6);
        }
        // standing on its plinth, the plinth on the ground
        expect(Math.min(...boxes.map((b) => b.min.y))).toBeLessThanOrEqual(0.01);
        // never the round ball: 30 times a box once merged
        expect(parts.some((p) => p.geoRef === BALL), style).toBe(false);
        expect(parts.some((p) => p.geo === 'CYL16'), style).toBe(false);
      }
    });
  }

  it('stands a hangar’s door proud of its front, so the two never flicker in the one plane', () => {
    const { R, parts, tiled } = fakeRoom();
    const L = { x: 0, z: 0, turn: 0, w: 12, d: 9, h: 14, y: 0, style: 'hangar' };
    lot(R, L, LOOK, { windows: windowPaints(R, LOOK), list: 'fixed' });
    const front = Math.max(...worldBoxes([], tiled).map((b) => b.max.z));
    const door = worldBoxes(parts, []).find((b) => Math.abs(b.max.x - b.min.x - L.w * 0.6) < 1e-6 && b.max.z - b.min.z < 0.2);
    expect(door).toBeTruthy();
    expect(door.max.z - front).toBeGreaterThanOrEqual(0.005);
  });

  it('paints its walls with windows that tile in the world, one paint a wall colour', () => {
    const { R, tiled } = fakeRoom();
    const paints = windowPaints(R, LOOK);
    expect(Object.keys(paints)).toHaveLength(LOOK.walls.length);
    lot(R, { x: 0, z: 0, turn: 0, w: 10, d: 10, h: 12, y: 0, style: 'block' }, LOOK, { windows: paints, list: 'fixed' });
    expect(tiled.length).toBeGreaterThan(0);
    for (const t of tiled) expect(Object.values(paints)).toContain(t.mat);
    expect(Object.values(paints)[0].userData.tile).toBeGreaterThan(0);
  });

  it('lights its windows as glows at night, a few a face at most', () => {
    const { R, parts } = fakeRoom();
    lot(R, { x: 0, z: 0, turn: 0, w: 14, d: 10, h: 30, y: 0, style: 'tower' }, { ...LOOK, night: true }, { windows: windowPaints(R, { ...LOOK, night: true }), list: 'fixed' });
    const glows = parts.filter((p) => p.list === 'glow');
    expect(glows.length).toBeGreaterThan(4);
    expect(glows.length).toBeLessThanOrEqual(48);
  });
});

describe('the edge', () => {
  const run = (kind, h) => ({ kind, x0: -35, z0: 10, x1: 35, z1: 10, h, see: ['rail', 'fence', 'barrier'].includes(kind) });
  for (const kind of ['kerb', 'rail', 'fence', 'barrier', 'wall']) {
    it(`draws a ${kind} along its line, no taller than it’s let be`, () => {
      const { R, parts } = fakeRoom();
      const h = kind === 'kerb' ? 0.15 : kind === 'wall' ? 0.9 : 1.2;
      edgeRun(R, run(kind, h), LOOK);
      const boxes = worldBoxes(parts, []);
      expect(boxes.length).toBeGreaterThan(0);
      for (const b of boxes) {
        expect(b.max.y).toBeLessThanOrEqual(h + 1e-6);
        expect(b.min.x).toBeGreaterThanOrEqual(-35.4);
        expect(b.max.x).toBeLessThanOrEqual(35.4);
        expect(Math.abs((b.min.z + b.max.z) / 2 - 10)).toBeLessThan(0.4);
      }
      // the whole length, end to end
      expect(Math.min(...boxes.map((b) => b.min.x))).toBeLessThan(-34.5);
      expect(Math.max(...boxes.map((b) => b.max.x))).toBeGreaterThan(34.5);
    });
  }
});

describe('an opening in a wall', () => {
  it('frames the hole with mullions and paints no view in it', () => {
    const { R, parts } = fakeRoom();
    const f = R.fixed(0, 0, 0);
    opening(f, 5, { v1: 0.1, thick: 0.2 }, { w: 6, y0: 1, h: 3, mullion: 2, frame: 0xffffff });
    expect(parts.some((p) => p.geo === 'decal')).toBe(false);
    const boxes = worldBoxes(parts, []);
    // a frame round the hole and a mullion every 2 m
    expect(boxes.length).toBeGreaterThanOrEqual(4 + 2);
    for (const b of boxes) {
      expect(b.min.x).toBeGreaterThanOrEqual(5 - 3 - 0.2);
      expect(b.max.x).toBeLessThanOrEqual(5 + 3 + 0.2);
      expect(b.min.y).toBeGreaterThanOrEqual(1 - 0.2);
      expect(b.max.y).toBeLessThanOrEqual(4 + 0.2);
    }
  });
});
