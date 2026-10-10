import { describe, expect, it, vi } from 'vitest';
import { EFFECT_TIERS, VOLUME_TIERS, createWorldEffects, levelVolumes } from './passes.js';

const PACK = { origin: [205, 362.3, -1540], yaw: 0 };
const EFFECTS = { format: 1, cell: 128, count: 2, cells: { '0,-1': [{ name: 'FX_Arctic_Ceiling_FallingSnow', pos: [4.09, 0.53, -37.99], quat: [0, 0, 0, 1] }], '1,0': [{ name: 'FX_Snow_FallingSnow_01_Hoth', pos: [130, 2, 10] }] } };
const VOLUMES = { format: 1, cell: 128, count: 1, cells: { '-1,2': [{ kind: 'box', pos: [-78.203, -44.584, 348.401], quat: [0, 0, 0, 1], scale: [7, 7, 7] }] } };

// the level as the world holds it: its pack, and its files by name
const levelOf = (files) => ({ pack: PACK, file: vi.fn(async (name) => files[name] ?? null) });

function fakeEffects() {
  const seen = { made: null, placed: null, entered: [], updates: 0, disposed: 0 };
  const make = (scene, renderer, opts) => {
    seen.made = { scene, renderer, opts };
    return {
      place(json) {
        seen.placed = json;
        return { enter: (k) => seen.entered.push(k), leave() {}, dispose() {} };
      },
      update: () => seen.updates++,
      stats: { running: 0 },
      dispose: () => seen.disposed++,
    };
  };
  return { seen, make };
}

describe('the effects and the volumes on the game’s world', () => {
  it('runs the level’s effects at high and ultra, every spawn in the map’s frame', async () => {
    expect(EFFECT_TIERS).toEqual(['high', 'ultra']);
    const { seen, make } = fakeEffects();
    const fx = await createWorldEffects({ scene: 'scene', renderer: 'r', tier: 'high', level: levelOf({ 'effects.json': EFFECTS }), light: { shadowTerm: 'shadow' }, deps: { createEffects: make, sheets: async () => null } });
    expect(seen.made.opts).toMatchObject({ tier: 'high', light: { shadowTerm: 'shadow' } });
    // (X's sprites take the sun's shadow as a function of the corner; the
    // stack's term reads the fragment's own place)
    expect(seen.made.opts.shadow([1, 2, 3])).toBe('shadow');
    expect(typeof seen.made.opts.load).toBe('function');
    const all = Object.values(seen.placed.cells).flat();
    expect(all.map((e) => e.name).sort()).toEqual(['FX_Arctic_Ceiling_FallingSnow', 'FX_Snow_FallingSnow_01_Hoth']);
    expect(all.find((e) => e.name === 'FX_Arctic_Ceiling_FallingSnow').pos.map((v) => +v.toFixed(2))).toEqual([209.09, 362.83, -1577.99]);
    // (every cell entered: X's culling distances decide what runs)
    expect(seen.entered.sort()).toEqual(Object.keys(seen.placed.cells).sort());
    fx.update(1 / 60, {}, [0, 0, 5]);
    expect(seen.updates).toBe(1);
    fx.dispose();
    expect(seen.disposed).toBe(1);
  });

  it('runs none below high, and asks for no file', async () => {
    const { seen, make } = fakeEffects();
    const level = levelOf({ 'effects.json': EFFECTS });
    for (const tier of ['low', 'mid']) expect(await createWorldEffects({ scene: 's', renderer: 'r', tier, level, light: null, deps: { createEffects: make } })).toBeNull();
    expect(level.file).not.toHaveBeenCalled();
    expect(seen.made).toBeNull();
  });

  it('skips a pack without effects.json with one line, never an error', async () => {
    const { seen, make } = fakeEffects();
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    expect(await createWorldEffects({ scene: 's', renderer: 'r', tier: 'ultra', level: levelOf({}), light: null, deps: { createEffects: make } })).toBeNull();
    expect(seen.made).toBeNull();
    expect(info).toHaveBeenCalledTimes(1);
    info.mockRestore();
  });

  it('hands the light stack the level’s volumes in the map’s frame, at high and ultra', async () => {
    expect(VOLUME_TIERS).toEqual(['high', 'ultra']);
    const v = await levelVolumes(levelOf({ 'volumes.json': VOLUMES }), 'ultra');
    const [box] = Object.values(v.cells).flat();
    expect(box.pos.map((x) => +x.toFixed(3))).toEqual([126.797, 317.716, -1191.599]);
    expect(Object.keys(v.cells)).toEqual(['0,-10']);
    const level = levelOf({ 'volumes.json': VOLUMES });
    expect(await levelVolumes(level, 'mid')).toBeNull();
    expect(level.file).not.toHaveBeenCalled();
  });
});
