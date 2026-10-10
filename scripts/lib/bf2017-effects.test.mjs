import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { effectsJson, readEffect, rebaseEffect } from './bf2017-effects.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const extras = JSON.parse(readFileSync(join(HERE, '../fixtures/bf2017/fx/web/maps/levels/mp/fixture_01/fixture_01.extras.json'), 'utf8'));
// Hoth's frame, from lane L's pack on main
const pack = JSON.parse(readFileSync(join(HERE, '../../public/models/galaxy/bf2017/levels/hoth/level.json'), 'utf8'));

describe('readEffect', () => {
  it('the name’s last part, the transform, the scale and autoStart where given', () => {
    expect(readEffect(extras.effects[3])).toEqual({ name: 'FX_Veh_GR75_Engine_Exhaust_01', pos: [180, 370, -1500], quat: [0, 0.7071068, 0, 0.7071068], scale: 2 });
    expect(readEffect(extras.effects[4]).autoStart).toBe(false);
    expect(readEffect(extras.effects[7])).toEqual({ skip: 'unnamed' });
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
  const known = new Set(['FX_Snow_FallingSnow_01_Hoth', 'FX_Veh_GR75_Engine_Exhaust_01', 'FX_Impact_Blaster_Snow_01']);
  const json = effectsJson(extras, pack, { subworlds: extras.subworlds, known });
  it('bins the arena’s effects by the pack’s cells in its frame', () => {
    expect(json).toMatchObject({ format: 1, cell: 128, count: 5, skipped: { sub: 1, unnamed: 1, outside: 1 } });
    expect(json.kinds).toEqual({ FX_Snow_FallingSnow_01_Hoth: 2, FX_Veh_GR75_Engine_Exhaust_01: 1, FX_Impact_Blaster_Snow_01: 1, FX_Steam_Rising_01: 1 });
    expect(json.cells['0,-1'][0]).toEqual({ name: 'FX_Snow_FallingSnow_01_Hoth', pos: [5, 17.7, -5], quat: [0, 0, 0, 1] });
    expect(json.cells['-1,0'].find((e) => e.name === 'FX_Veh_GR75_Engine_Exhaust_01')).toMatchObject({ pos: [-25, 7.7, 40], scale: 2 });
  });
  it('names the effects the level spawns that have no table yet', () => {
    expect(json.unread).toEqual(['FX_Steam_Rising_01']);
  });
});
