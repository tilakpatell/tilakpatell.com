import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readMap } from './bf2017-level.mjs';
import { SUBS, UNIT, clusters, kindOf, piecesOf, rotate, trackOf } from './bf2017-space.mjs';

// SB_Endor_01 trimmed to 28 instances (a Star Destroyer and six of its parts
// in SpaceBattle, the hull and the same parts again in Mode7, the MC80's hull
// and three parts, a corvette, four pieces of the Death Star's debris, the
// moon, a debris field, a sequel-era decal, an X-wing of an outro and a
// collision stand-in)
const dir = new URL('../fixtures/bf2017/web/maps/levels/space/sb_endor_01/', import.meta.url);
const map = readMap(JSON.parse(readFileSync(new URL('sb_endor_01.json', dir))), readFileSync(new URL('sb_endor_01.bin', dir)));

describe('the space levels as set pieces', () => {
  it('reads the fixture', () => {
    expect(map.instances.count).toBe(28);
  });

  it('gathers a capital’s kit round its hull, one model in the hull’s frame', () => {
    const { models, pieces } = piecesOf(map, { system: 'endor' });
    const isd = pieces.filter((p) => p.model === 'endor-isd');
    expect(isd).toHaveLength(1);
    expect(isd[0].kind).toBe('capital');
    const m = models['endor-isd'];
    expect(m.parts).toHaveLength(7);
    // (the hull at the model's origin, its parts about it)
    const hull = m.parts.find((p) => /hull_01_sb_endor/.test(p.file));
    expect(hull.at).toEqual([0, 0, 0]);
    expect(hull.quaternion.map((v) => Math.round(v * 1000) / 1000)).toEqual([0, 0, 0, 1]);
    expect(m.size).toBeGreaterThan(1500);
    expect(models['endor-mc80'].parts).toHaveLength(4);
  });

  it('keeps the scenery and the starfighter assault, never the lobby, the outros or another mode', () => {
    const { models, pieces, dropped } = piecesOf(map, { system: 'endor' });
    const files = Object.values(models).flatMap((m) => m.parts.map((p) => p.file));
    expect(files.some((f) => /xwing/.test(f))).toBe(false);
    expect(files.some((f) => /moon_endor/.test(f))).toBe(false); // (the site's own planet)
    expect(files.some((f) => /resurgent/.test(f))).toBe(false); // (the era rule)
    expect(files.some((f) => /collision/.test(f))).toBe(false);
    expect(dropped.sub).toBeGreaterThan(0);
    expect(pieces.filter((p) => p.kind === 'rock')).toHaveLength(4);
    expect(pieces.find((p) => p.model === 'debrisfield-02').kind).toBe('backdrop');
    expect(pieces.find((p) => p.model === 'corvettecr90-01').kind).toBe('capital');
  });

  it('places a second hull of the same parts with the first one’s model', () => {
    const { models, pieces } = piecesOf(map, { system: 'endor', subs: [...SUBS, 'mode7'] });
    const isd = pieces.filter((p) => p.model.startsWith('endor-isd'));
    expect(isd).toHaveLength(2);
    expect(new Set(isd.map((p) => p.model)).size).toBe(1);
    expect(Object.keys(models).filter((k) => k.startsWith('endor-isd'))).toHaveLength(1);
  });

  it('puts the pieces in the space layer’s units about the fleet’s middle', () => {
    const { centre, pieces, radius } = piecesOf(map, { system: 'endor' });
    const isd = pieces.find((p) => p.model === 'endor-isd');
    const at = [47.5, 1842.7, 451.5].map((v, k) => (v - centre[k]) * UNIT);
    isd.at.forEach((v, k) => expect(v).toBeCloseTo(at[k], 1));
    expect(isd.scale.every((s) => Math.abs(s - UNIT) < 1e-6)).toBe(true);
    expect(radius).toBeGreaterThan(10);
    expect(radius).toBeLessThan(200);
  });

  it('turns each rock on the game’s asteroid track for its size', () => {
    const { pieces } = piecesOf(map, { system: 'endor' });
    for (const p of pieces.filter((x) => x.kind === 'rock')) expect(['large', 'medium', 'small']).toContain(p.track);
    expect([trackOf(300), trackOf(100), trackOf(20)]).toEqual(['large', 'medium', 'small']);
  });

  it('tells a model’s kind by its path', () => {
    expect(kindOf('models/objects/architecture/_galacticempire/deathstar_debris/debris_beam_xl_01_mesh.glb')).toBe('rock');
    expect(kindOf('models/gameplay/vehicles/capital/providenceclassdreadnaught/providenceclassdreadnaught_01_mesh.glb')).toBe('capital');
    expect(kindOf('models/gameplay/vehicles/capital/cinder_satellite_small_03/cinder_satellite_small_02_mesh.glb')).toBe('station');
    expect(kindOf('models/levels/space/sb_endor_01/planet/debrisfield_02_mesh.glb')).toBe('backdrop');
    expect(kindOf('models/levels/space/sb_droidbattleship_01/planet/planet_ryloth_01_mesh.glb')).toBe(null);
    expect(kindOf('models/gameplay/vehicles/capital/resurgentclass_stardestroyer/instances/x_mesh.glb')).toBe(null);
    expect(kindOf('models/objects/props/landmarks/_galacticempire/stardestroyer_01/x_mesh.glb')).toBe(null); // (a kit's, not a model of its own)
  });

  it('splits an area kit into lots, and turns a vector by a quaternion', () => {
    const at = (x) => ({ at: [x, 0, 0] });
    const lots = clusters([at(0), at(100), at(150), at(5000), at(5050)], 200);
    expect(lots.map((l) => l.length)).toEqual([3, 2]);
    const q = [0, Math.SQRT1_2, 0, Math.SQRT1_2]; // (a quarter turn about y)
    rotate(q, [1, 0, 0]).forEach((v, k) => expect(v).toBeCloseTo([0, 0, -1][k], 6));
  });
});
