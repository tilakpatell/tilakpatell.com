import { describe, expect, it } from 'vitest';
import { groundInMap, rebaseCells, toMap } from './packFrame.js';
import { toPack } from './level.js';

const PACK = { origin: [205, 362.3, -1540], yaw: 0, cell: 128 };
const near = (a, b) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));

describe('a pack file’s rows in the export’s frame', () => {
  it('puts a pack point back where the map has it, the inverse of toPack', () => {
    near(toMap(PACK, [-78.203, -44.584, 348.401]), [126.797, 317.716, -1191.599]);
    const turned = { ...PACK, yaw: 0.7 };
    const at = [300, 10, -1400];
    const p = toPack(turned, at);
    near(toMap(turned, [p[0], at[1] - turned.origin[1], p[1]]), at);
  });

  it('moves every row of a cells file and bins it again by the cell, its quaternion turned with the pack', () => {
    const json = { format: 1, cell: 128, count: 2, cells: { '-1,2': [{ name: 'a', pos: [-78.203, -44.584, 348.401], quat: [0, 0, 0, 1] }], '0,0': [{ name: 'b', pos: [1, 0, 1] }] } };
    const out = rebaseCells(json, PACK);
    expect(out.count).toBe(2);
    expect(Object.keys(out.cells).sort()).toEqual(['0,-10', '1,-13']);
    near(out.cells['0,-10'][0].pos, [126.797, 317.716, -1191.599]);
    expect(out.cells['1,-13'][0].name).toBe('b');
    // (the source is left as it was)
    expect(json.cells['0,0'][0].pos).toEqual([1, 0, 1]);
    const turned = rebaseCells(json, { ...PACK, yaw: Math.PI / 2 });
    const q = turned.cells[Object.keys(turned.cells).find((k) => turned.cells[k][0].name === 'a')][0].quat;
    near(q, [0, -Math.SQRT1_2, 0, Math.SQRT1_2]);
  });

  it('moves the ground’s masks by the origin, and gives none for a turned pack', () => {
    const g = { world: 'hoth', masks: { png: 'ground/masks.png', minX: -1280, minZ: -1280, metresPerPixel: 2, w: 1281, h: 1281 } };
    expect(groundInMap(g, PACK).masks).toMatchObject({ minX: -1075, minZ: -2820, w: 1281 });
    expect(g.masks.minX).toBe(-1280);
    expect(groundInMap(g, { ...PACK, yaw: 0.2 })).toBeNull();
    expect(groundInMap({ world: 'x' }, PACK)).toEqual({ world: 'x' });
  });
});
