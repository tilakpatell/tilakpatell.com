import { describe, expect, it } from 'vitest';
import { CELL, bboxOf, cellOf, cellsAround, diffCells, entityToRow, rowToEntity } from './entities';

describe('the entity grid', () => {
  it('is 2048 m a cell, floored, so a point on a line belongs to the cell it starts', () => {
    expect(CELL).toBe(2048);
    expect(cellOf(-1, 2048)).toEqual([-1, 1]);
    expect(cellOf(0, 0)).toEqual([0, 0]);
    expect(cellOf(2047.9, -0.1)).toEqual([0, -1]);
  });

  it('names the nine cells round one, its own first, then the sides, then the corners', () => {
    const keys = cellsAround(0, 0);
    expect(keys).toHaveLength(9);
    expect(keys[0]).toBe('0,0');
    expect(new Set(keys.slice(1, 5))).toEqual(new Set(['1,0', '-1,0', '0,1', '0,-1']));
    expect(new Set(keys.slice(5))).toEqual(new Set(['1,1', '-1,1', '1,-1', '-1,-1']));
    expect(cellsAround(3, -2, 2)).toHaveLength(25);
    expect(cellsAround(3, -2, 0)).toEqual(['3,-2']);
  });

  it('gives a cell its envelope in metres, one cell exactly', () => {
    expect(bboxOf(1, -1)).toEqual({ minX: 2048, maxX: 4096, minZ: -2048, maxZ: 0 });
  });

  it('says which cells went and which came', () => {
    expect(diffCells(['a', 'b'], ['b', 'c'])).toEqual({ gone: ['a'], came: ['c'] });
    expect(diffCells([], ['a'])).toEqual({ gone: [], came: ['a'] });
  });
});

describe('an entity and its row', () => {
  const e = { planetId: 'hoth', type: 'turret', x: 1, y: 2, z: -3, rot: [0, 1.5, 0], scale: 2, hp: 80, metadata: { colour: 'red' } };

  it('round-trips what the client may set', () => {
    const back = rowToEntity(entityToRow(e));
    for (const k of Object.keys(e)) expect(back[k]).toEqual(e[k]);
  });

  it('never sends what the database sets', () => {
    const row = entityToRow({ ...e, id: 'x', owner: 'o', version: 3, updatedAt: 't', createdAt: 't' });
    for (const k of ['id', 'owner', 'version', 'created_at', 'updated_at', 'geom']) expect(row).not.toHaveProperty(k);
    expect(row).toMatchObject({ planet_id: 'hoth', entity_type: 'turret', rot_x: 0, rot_y: 1.5, rot_z: 0 });
  });

  it('leaves out what the entity does not say, so the database’s defaults apply', () => {
    expect(entityToRow({ planetId: 'hoth', type: 'beacon', x: 0, y: 0, z: 0 })).toEqual({ planet_id: 'hoth', entity_type: 'beacon', x: 0, y: 0, z: 0 });
  });

  it('reads a row the database sent', () => {
    const row = { id: 'u', planet_id: 'hoth', entity_type: 'wreck', owner: 'o', x: 5, y: 6, z: 7, rot_x: 0.1, rot_y: 0.2, rot_z: 0.3, scale: 1, hp: 100, metadata: {}, version: 2, created_at: 'c', updated_at: 'u2', geom: 'g' };
    expect(rowToEntity(row)).toEqual({ id: 'u', planetId: 'hoth', type: 'wreck', owner: 'o', x: 5, y: 6, z: 7, rot: [0.1, 0.2, 0.3], scale: 1, hp: 100, metadata: {}, version: 2, updatedAt: 'u2' });
  });
});
