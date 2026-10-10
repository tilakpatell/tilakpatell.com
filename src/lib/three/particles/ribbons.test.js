import { describe, expect, it } from 'vitest';
import TIE from '../../../data/bf2017/fx/FX_ConTrail_TieFighter.json';
import EXHAUST from '../../../data/bf2017/fx/FX_EngineExhaust_TransportGR75_Prim.json';
import SNOW from '../../../data/bf2017/fx/FX_Snow_FallingSnow_01_Hoth.json';
import { evalCurve } from './curves.js';
import { createEffects } from './effects.js';
import { createTrails, MAX_OWNERS, OWNER, stepTrails, trailPoint } from './emitter.js';
import { createSim } from './gpu.js';
import { createRibbonMesh, createShared, createSpriteMesh } from './sprites.js';

// the TIE's contrail: the game's one ribbon emitter in these tables
const trailEm = TIE.emitters[0];
const owners = (x, y = 0, z = 0) => {
  const a = new Float32Array(MAX_OWNERS * OWNER);
  a.set([x, y, z, 1, 0, 0, 0, 1], 0);
  return a;
};

describe('trails', () => {
  it('the head rides the owner; a point is frozen every metre (the ribbon’s segment)', () => {
    expect(trailEm).toMatchObject({ kind: 'ribbon', maxCount: 150, lifetime: 1.5, ribbon: { segment: 1 } });
    const tr = createTrails(trailEm, 2);
    for (let f = 0; f <= 10; f++) stepTrails(tr, 1 / 60, owners(f * 0.5), [0]);
    expect([0, 1, 2, 3, 4].map((k) => tr.pos[trailPoint(tr, 0, k) * 3])).toEqual([5, 5, 4, 3, 2]);
    expect(tr.age[trailPoint(tr, 0, 2)]).toBeCloseTo(2 / 60, 6);
  });
  it('by the rate where a record gives one, and ages out once it stops', () => {
    const tr = createTrails({ ...trailEm, spawn: { ...trailEm.spawn, rate: 20 }, ribbon: { segment: Infinity } }, 1);
    for (let f = 0; f < 60; f++) stepTrails(tr, 1 / 60, owners(0), [0]);
    let live = 0;
    for (let k = 0; k < tr.m; k++) if (tr.age[k] < tr.life) live++;
    expect(live).toBeGreaterThanOrEqual(20);
    expect(live).toBeLessThanOrEqual(22);
    for (let f = 0; f < 200; f++) stepTrails(tr, 1 / 60, owners(0), []);
    expect(tr.on[0]).toBe(0);
    expect([...tr.age].every((a) => a >= tr.life)).toBe(true);
  });
  it('a fresh trail puts every point on its owner, so a dead wedge has no area', () => {
    const tr = createTrails(trailEm, 1);
    stepTrails(tr, 1 / 60, owners(7, 2, 3), [0]);
    for (let k = 0; k < tr.m; k++) expect([tr.pos[k * 3], tr.pos[k * 3 + 1], tr.pos[k * 3 + 2]]).toEqual([7, 2, 3]);
  });
});

describe('the ribbon mesh', () => {
  it('a camera-facing strip, as wide as the size curves say, dead points at width 0', async () => {
    const tr = createTrails(trailEm, 1);
    for (let f = 0; f <= 12; f++) stepTrails(tr, 1 / 60, owners(f * 0.5), [0]);
    const rib = await createRibbonMesh(trailEm, tr, { shared: await createShared() });
    rib.update({ position: { x: 3, y: 0, z: 10 } });
    const P = rib.mesh.geometry.attributes.position.array;
    // the newest point: across the trail (x) and the camera line → along y,
    // the spawn size's mean times UpdateSizeYData's curve at birth
    expect(Math.abs(P[1] - P[4])).toBeCloseTo(evalCurve(trailEm.spawn.size, 0, 0.5) * evalCurve(trailEm.sizeY, 0), 3);
    expect(P[0]).toBeCloseTo(6, 3);
    const L = rib.mesh.geometry.attributes.ribbonLife.array;
    expect(L[1]).toBe(1);
    expect(L[(tr.m - 1) * 4 + 1]).toBe(0);
    expect(rib.mesh.geometry.index.count).toBe((tr.m - 1) * 6);
  });
});

describe('mesh emittables', () => {
  it("the hangar's falling debris: the pool as instances of a mesh, lit", async () => {
    const em = SNOW.emitters.find((e) => e.kind === 'mesh');
    const sim = await createSim(em, 16, { mode: 'cpu' });
    const mesh = await createSpriteMesh(em, sim, { shared: await createShared() });
    expect(mesh.count).toBe(16);
    expect(mesh.material.isMeshStandardNodeMaterial).toBe(true);
    expect(mesh.geometry.type).toBe('IcosahedronGeometry');
  });
});

describe('trails that follow their ship', () => {
  it('spawn(name, { parent }): a GR-75’s glow rides it, a TIE’s contrail lies behind it', async () => {
    const { Object3D } = await import('three');
    const gr75 = new Object3D();
    const tie = new Object3D();
    const kids = [];
    const fx = createEffects({ add: (m) => kids.push(m) }, null, { tier: 'ultra', defs: { [EXHAUST.name]: EXHAUST, [TIE.name]: TIE } });
    fx.spawn(EXHAUST.name, [0, 0, -4], [0, 0, 0, 1], 1, { parent: gr75 });
    fx.spawn(TIE.name, [0, 0, -2], [0, 0, 0, 1], 1, { parent: tie });
    await Promise.all([fx.ready(EXHAUST.name), fx.ready(TIE.name)]);
    const ribbon = kids.find((m) => m.name === 'fx-ribbon:em_tiefighter_contrail_ribbon');
    expect(ribbon).toBeTruthy();
    const cam = { position: { x: 0, y: 5, z: 0 } };
    for (let f = 0; f < 60; f++) {
      gr75.position.z = f * 0.5;
      tie.position.set(20, 0, f * 0.5); // 30 m/s along +z
      gr75.updateMatrixWorld(true);
      tie.updateMatrixWorld(true);
      fx.update(1 / 60, cam);
    }
    expect(fx.stats.drawn).toBe(4);
    // the trail's points run back along the path, the newest at the engine
    const P = ribbon.geometry.attributes.position.array;
    expect((P[2] + P[5]) / 2).toBeCloseTo(29.5 - 2, 1);
    expect((P[8] + P[11]) / 2).toBeLessThan(28);
  });
  it("a killed ship's slot rests, and its trail is cut, before another takes it", async () => {
    const { Object3D } = await import('three');
    const a = new Object3D();
    const b = new Object3D();
    b.position.set(500, 0, 0);
    const kids = [];
    const fx = createEffects({ add: (m) => kids.push(m) }, null, { tier: 'ultra', defs: { [TIE.name]: TIE } });
    const ha = fx.spawn(TIE.name, [0, 0, 0], [0, 0, 0, 1], 1, { parent: a });
    await fx.ready(TIE.name);
    const cam = { position: { x: 0, y: 5, z: 0 } };
    for (let f = 0; f < 10; f++) {
      a.position.z = f;
      a.updateMatrixWorld(true);
      fx.update(1 / 60, cam);
    }
    ha.kill();
    b.updateMatrixWorld(true);
    fx.spawn(TIE.name, [0, 0, 0], [0, 0, 0, 1], 1, { parent: b });
    fx.update(1 / 60, cam);
    fx.update(1 / 60, cam);
    // the new ship's trail starts on it: no strip back to the old ship
    const P = kids[0].geometry.attributes.position.array;
    const L = kids[0].geometry.attributes.ribbonLife.array;
    const m = trailEm.maxCount;
    for (let s = 0; s < MAX_OWNERS; s++) {
      for (let k = 0; k < m; k++) {
        const v = (s * m + k) * 2;
        if (L[v * 2 + 1] && Math.abs(P[v * 3] - 500) < 50) for (let j = 1; j < 3 && k + j < m; j++) expect(Math.abs(P[(v + 2 * j) * 3] - 500)).toBeLessThan(50);
      }
    }
  });
  it('every running instance spawns, up to the record’s 30 (one batch each)', async () => {
    const fx = createEffects({ add() {} }, null, { tier: 'ultra', defs: { [EXHAUST.name]: EXHAUST } });
    for (let i = 0; i < 32; i++) fx.spawn(EXHAUST.name, [i, 0, 0]);
    await fx.ready(EXHAUST.name);
    for (let f = 0; f < 30; f++) fx.update(1 / 60, { position: { x: 0, y: 0, z: 0 } });
    expect(fx.stats.running).toBe(30);
  });
});
