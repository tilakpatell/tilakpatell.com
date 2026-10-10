import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetDevice } from '../../../../lib/device';
import USED from '../../../../data/bf2017/library-used.json';
import { createPlacer } from '../placer';
import { MODELS, gameKind, gameModel, gameUrl, isGame, rowFor, slugOf } from './bf2017-library';
import { GROUPS, lodUrlFor, modelUrlFor } from './index';

const NAME = 'objects/props/objectsets/_galacticempire/box_m_04/box_m_04_mesh';
const INDEX = { [NAME]: { set: '_galacticempire', kind: 'prop', size: 'medium', tris: 448, rig: false, as: 'an Imperial crate', metres: 0.5 } };
const published = (...cuts) => Object.fromEntries(cuts.map((c) => [gameUrl(NAME, c).slice(1), { hash: 'x', bytes: 1 }]));

describe('the drop’s object library, placeable by name', () => {
  it('names a library object `game:<name>`, its files letters and digits by a slug of the whole name', () => {
    expect(gameKind(NAME)).toBe(`game:${NAME}`);
    expect(isGame(gameKind(NAME))).toBe(true);
    expect(isGame('kit:naturemega/Fern_1')).toBe(false);
    expect(slugOf(NAME)).toMatch(/^boxm04[a-z0-9]{7}$/);
    // (two sets with the same last segment are two files)
    expect(slugOf('a/x/crate_01_mesh')).not.toBe(slugOf('b/x/crate_01_mesh'));
    expect(gameUrl(NAME, 'lod1')).toBe(`/models/galaxy/surface/game/${slugOf(NAME)}.lod1.glb`);
  });

  it('makes no row for an object in the index whose import has not run (Review Focus 1)', () => {
    expect(rowFor(NAME, INDEX, {})).toBeNull();
    expect(rowFor('objects/not/in/the/index_mesh', INDEX, published(null))).toBeNull();
  });

  it('makes a row from the index and the published cuts, naming only the cuts there are', () => {
    const row = rowFor(NAME, INDEX, published(null, 'lod1'));
    expect(row).toMatchObject({ url: gameUrl(NAME), lodUrl: gameUrl(NAME, 'lod1'), native: true, made: 'bf2017', as: 'an Imperial crate', from: NAME, credit: `surface-game-${slugOf(NAME)}` });
    expect(row.farUrl).toBeUndefined();
    // (a phone draws a native one's light cut alone; high its plain one)
    const models = { [gameKind(NAME)]: row };
    expect(modelUrlFor(gameKind(NAME), 'low', models)).toBe(gameUrl(NAME, 'lod1'));
    expect(modelUrlFor(gameKind(NAME), 'high', models)).toBe(gameUrl(NAME));
    expect(lodUrlFor(gameKind(NAME), models)).toBe(gameUrl(NAME, 'lod1'));
  });

  it('is the catalogue’s last group, every row of it a used object that is published', () => {
    expect(Object.keys(GROUPS).at(-1)).toBe('library2017');
    for (const [kind, row] of Object.entries(MODELS)) {
      expect(isGame(kind), kind).toBe(true);
      expect(USED[row.from], kind).toBeTruthy();
    }
  });

  it('says once that an object is not drawn, unpublished or rigged, and never throws', () => {
    const said = new Set();
    const warn = vi.fn();
    expect(gameModel(gameKind(NAME), {}, said, warn)).toBeNull();
    expect(gameModel(gameKind(NAME), {}, said, warn)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(gameModel('game:tree', { 'game:tree': { rig: true } }, said, warn)).toBeNull();
    expect(warn.mock.calls[1][0]).toMatch(/rigged/);
    expect(gameModel('game:crate', { 'game:crate': { url: '/x.glb' } }, said, warn)).toBe('game:crate');
  });
});

describe('a placer asked for a library object that is not there', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetDevice();
  });
  const at = (quality) => {
    vi.stubGlobal('window', { location: { search: `?quality=${quality}`, hash: '' }, localStorage: { getItem: () => null } });
    resetDevice();
  };
  const world = () => ({ heightAt: () => 0, solids: { box: vi.fn(), circle: vi.fn() }, floors: [] });

  it('draws nothing, put or scattered, and says so once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const placer = createPlacer({ parent: new THREE.Group(), kit: null, world: world(), models: {} });
    expect(await placer.put({ kind: 'crate', model: gameKind(NAME), at: [0, 0] })).toBeNull();
    expect(await placer.scatter('crate', [{ at: [0, 0] }, { at: [3, 0] }], { model: gameKind(NAME) })).toBeNull();
    await placer.ready;
    expect(placer.group.children).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('scatters a row that only adds one (kind `game`) on high and up, never on the phones’ tiers', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const quality of ['low', 'mid']) {
      at(quality);
      const placer = createPlacer({ parent: new THREE.Group(), kit: null, world: world(), models: { [gameKind(NAME)]: { url: '/x.glb' } } });
      expect(await placer.scatter('game', [{ at: [0, 0] }], { model: gameKind(NAME) })).toBeNull();
      expect(placer.group.children).toHaveLength(0);
    }
    expect(warn).not.toHaveBeenCalled();
  });
});
