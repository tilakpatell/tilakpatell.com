import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONE_EMISSION, CONE_HEIGHT, coneShape, readConeEffect, readVolumetric, rebase, volumesJson } from './bf2017-volumes.mjs';

const fx = JSON.parse(readFileSync(new URL('../fixtures/bf2017/maps/hoth.volumes.fixture.json', import.meta.url)));
const em04 = JSON.parse(readFileSync(new URL('../fixtures/bf2017/fx/em_arctic_lightcone_04.json', import.meta.url)));
const shapes = { FX_Arctic_LightCone_04: coneShape(em04) };
const pack = { origin: [205, 362.296875, -1540], yaw: 0, cell: 128, arena: 1024 };

describe('readVolumetric', () => {
  it('a SimpleVolumetrics row: a box at its place, its size, the record’s emission, exponent and scale', () => {
    const v = readVolumetric(fx.volumetrics[0]);
    expect(v.kind).toBe('box');
    expect(v.scale).toEqual([7.204, 7.204, 7.204]);
    expect(v.color).toEqual([0.8952, 1.2139, 1.5]);
    expect(v.emission).toBe(0.2);
    expect(v.exponent).toBe(2);
    // yaw −0.4582 about +Y as a quaternion
    expect(v.quat[1]).toBeCloseTo(Math.sin(-0.4582 / 2));
    expect(v._source).toMatch(/SimpleVolumetricsEntityData/);
  });
});

describe('coneShape', () => {
  it('FX_Arctic_LightCone_04’s quad: 2 m wide, 5 m tall, its grey, its alpha exponent, faded out from 17 m to 20 m', () => {
    expect(shapes.FX_Arctic_LightCone_04).toEqual({ width: 2, height: 5, color: [0.2438, 0.2462, 0.2237], exponent: 2.113, fade: [17, 20], _source: 'fx/lighting/emitters/em_arctic_lightcone_04#EmitterTemplateData' });
    expect(coneShape({ objects: [{ $type: 'EmitterTemplateData', EmittableType: 'EmittableType_Mesh' }] })).toBe(null);
  });
});

describe('readConeEffect', () => {
  it('a light cone spawn with its emitter read: the quad’s size, colour and falloff', () => {
    const c = readConeEffect(fx.effects[0], shapes);
    expect(c).toMatchObject({ kind: 'cone', scale: [2, 5, 2], color: [0.2438, 0.2462, 0.2237], exponent: 2.113, emission: 1, fade: [17, 20], effect: 'FX_Arctic_LightCone_04' });
  });
  it('without its emitter: white at the named glow, a metre wide', () => {
    expect(readConeEffect(fx.effects[1], shapes)).toMatchObject({ scale: [1, CONE_HEIGHT, 1], color: [1, 1, 1], emission: CONE_EMISSION, effect: 'FX_Arctic_LightCone_02' });
  });
  it('any other effect is not a volume', () => {
    expect(readConeEffect(fx.effects[2]).skip).toBe('other');
    expect(readConeEffect({ effect: 'FX/Lighting/FX_Arctic_LightCone_01' }).skip).toBe('unplaced');
  });
});

describe('rebase', () => {
  it('takes the origin away and turns position and orientation by yaw', () => {
    const v = rebase({ pos: [10, 2, 0], quat: [0, 0, 0, 1] }, [0, 0, 0], Math.PI / 2);
    expect(v.pos[0]).toBeCloseTo(0);
    expect(v.pos[2]).toBeCloseTo(-10);
    expect(v.quat[1]).toBeCloseTo(Math.SQRT1_2);
  });
});

describe('volumesJson', () => {
  it('six entries: three boxes and two cones kept, the snow left to lane X', () => {
    const json = volumesJson({ ...fx, shapes }, pack, { subworlds: fx.subworlds });
    expect(json.kinds).toEqual({ box: 3, cone: 2 });
    expect(json.count).toBe(5);
    expect(json.skipped).toEqual({});
    // the first box at (126.80, 317.71, −1191.60): 78.2 m west, 348.4 m north → cell −1,2
    expect(json.cells['-1,2'][0].pos).toEqual([-78.203, -44.584, 348.401]);
    // the cone at the hangar's floor (207.36, 362.427, −1576.96): 2.36 m east, 36.96 m south
    const cone = Object.values(json.cells).flat().find((v) => v.effect === 'FX_Arctic_LightCone_04');
    expect(cone.pos).toEqual([2.36, 0.13, -36.96]);
    expect(cone._source).toMatch(/em_arctic_lightcone_04/);
  });
  it('a cone in a subworld that is not the map is left out and counted', () => {
    const json = volumesJson({ effects: [{ ...fx.effects[0], sub: fx.subworlds.indexOf('Levels/MP/Hoth_01/HeroArena') }] }, pack, { subworlds: fx.subworlds });
    expect(json.skipped).toEqual({ sub: 1 });
  });
  it('an arena leaves out what is beyond it', () => {
    const json = volumesJson(fx, { ...pack, arena: 10, cell: 16 }, { subworlds: fx.subworlds });
    expect(json.skipped.outside).toBeGreaterThan(0);
  });
});
