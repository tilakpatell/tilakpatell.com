import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { effectsJson, readEffect, rebaseEffect } from './bf2017-effects.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// eight of Hoth's 648 spawns as the game exports them, and its subworlds
const MAP = join(HERE, '../fixtures/bf2017/fx/web/maps/levels/mp/hoth_01');
const extras = JSON.parse(readFileSync(join(MAP, 'hoth_01.extras.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(MAP, 'hoth_01.json'), 'utf8'));
// Hoth's frame, from lane L's pack on main
const pack = JSON.parse(readFileSync(join(HERE, '../../public/models/galaxy/bf2017/levels/hoth/level.json'), 'utf8'));

describe('readEffect', () => {
  it('the name’s last part (the export calls it `effect`), the transform and autoStart', () => {
    expect(readEffect(extras.effects[2])).toEqual({ name: 'FX_EngineExhaust_TransportGR75_Prim', pos: extras.effects[2].position, quat: [0, -0.70711, 0, 0.70711], autoStart: false });
    expect(readEffect({ position: [0, 0, 0] })).toEqual({ skip: 'unnamed' });
    expect(readEffect({ effect: 'FX/A/FX_B', position: [1, 2, 3], scale: [2, 2, 2] })).toMatchObject({ name: 'FX_B', scale: 2 });
  });
});

describe('rebaseEffect', () => {
  it('takes the origin away and turns position and rotation by the yaw', () => {
    const e = rebaseEffect({ name: 'x', pos: [11, 2, 0], quat: [0, 0, 0, 1] }, [1, 0, 0], Math.PI / 2);
    expect(e.pos.map((v) => +v.toFixed(6))).toEqual([0, 2, -10]);
    expect(e.quat.map((v) => +v.toFixed(6))).toEqual([0, 0.707107, 0, 0.707107]);
  });
});

describe('effectsJson', () => {
  const known = new Set(['FX_Snow_FallingSnow_01_Hoth', 'FX_EngineExhaust_TransportGR75_Prim']);
  const json = effectsJson(extras, pack, { subworlds: manifest.subworlds, known });
  it('bins the arena’s effects by the pack’s cells in its frame', () => {
    expect(json).toMatchObject({ format: 1, cell: 128, count: 6, skipped: { sub: 1, outside: 1 } });
    expect(json.kinds).toEqual({ FX_Arctic_Ceiling_FallingSnow: 2, FX_EngineExhaust_TransportGR75_Prim: 2, FX_Snow_FallingSnow_01_Hoth: 2 });
    expect(json.cells['0,-2']).toEqual([{ name: 'FX_Snow_FallingSnow_01_Hoth', pos: [61.45, 12.06, -221.94], quat: [0, 0, 0, 1], autoStart: true }]);
    expect(json.cells['-2,-2'][0]).toMatchObject({ name: 'FX_EngineExhaust_TransportGR75_Prim', quat: [0, -0.7071, 0, 0.7071], autoStart: false });
  });
  it('names the effects the level spawns that have no table yet', () => {
    expect(json.unread).toEqual(['FX_Arctic_Ceiling_FallingSnow']);
  });
});
