import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CLUTTER_KIT, CLUTTER_KIT_OF, EXOTIC_KIT, FLORA_TRUNKS, LANDMARKS, LANDMARK_MIN, POI_KITS, SITE_PLACES, clutterKitOf, landmarkRowsOf } from './landmarkTables.js';
import { PLANETS, planetSpecOf } from './fixtures/expanse.js';
import { CLUTTER_KINDS } from './leafMesh.js';

const manifest = (pack) => JSON.parse(readFileSync(new URL(`../../../../public/kit/${pack}/index.json`, import.meta.url), 'utf8'));
// the generated places' kinds (variety.js's poiKinds)
const POI_KINDS = ['ruins', 'wreck', 'outpost', 'monolith', 'signal'];
// how tall a clutter kind's code-built shape stands at a row's scale of 1
// (expanse/flight/ground.js's clutterGeometry: a trunk and its crown, a spire)
const SHAPE_HEIGHT = { trunk: 79, spire: 26 };
const kitHas = ({ kit, name }) => {
  const row = manifest(kit).models[name];
  return Boolean(row) && !row.rig;
};

describe('the landmark tables', () => {
  it('gives every POI planetTables doesn’t build a site place or a list of its own, never both', () => {
    let n = 0;
    for (const { id } of PLANETS) {
      const spec = planetSpecOf(id);
      const built = new Set((spec.landmarks ?? []).map((l) => l.at));
      for (const poi of spec.pois) {
        const site = SITE_PLACES[id]?.[poi.id];
        const own = LANDMARKS[id]?.[poi.id];
        if (built.has(poi.id)) expect(Boolean(site || own), `${id}/${poi.id} is lane A's`).toBe(false);
        else expect(Boolean(site) !== Boolean(own), `${id}/${poi.id}`).toBe(true);
        n++;
      }
    }
    expect(n).toBeGreaterThan(80);
  });

  it('names only POIs the planets have', () => {
    for (const table of [SITE_PLACES, LANDMARKS])
      for (const [planet, byPoi] of Object.entries(table)) {
        const ids = new Set(planetSpecOf(planet).pois.map((p) => p.id));
        for (const poi of Object.keys(byPoi)) expect(ids.has(poi), `${planet}/${poi}`).toBe(true);
      }
  });

  it('names only kit models the kits have, and no rig', () => {
    const named = [
      ...Object.values(LANDMARKS).flatMap((byPoi) => Object.values(byPoi).flat()).filter((t) => t.kit).map((t) => t.kit),
      ...Object.values(CLUTTER_KIT).flatMap(Object.values),
      ...Object.values(CLUTTER_KIT_OF).flatMap(Object.values),
      ...Object.values(POI_KITS).flat().filter((t) => t.kit).map((t) => t.kit),
      ...FLORA_TRUNKS,
      ...Object.values(EXOTIC_KIT).flatMap(Object.values),
    ];
    expect(named.length).toBeGreaterThan(5);
    for (const k of named) expect(kitHas(k), `${k.kit}/${k.name}`).toBe(true);
  });

  it('dresses the ground only in trees with green leaves', () => {
    for (const table of [...Object.values(CLUTTER_KIT), ...Object.values(CLUTTER_KIT_OF)])
      for (const { kit, name } of Object.values(table)) {
        const tones = manifest(kit).models[name].tones;
        // (a leafless tree, a rock: no tones, nothing to be green)
        for (const [r, g, b] of tones ?? []) expect(g > r && g > b, `${name}: ${tones}`).toBe(true);
      }
  });

  it('maps only the ground’s clutter kinds, each to a size', () => {
    for (const table of [...Object.values(CLUTTER_KIT), ...Object.values(CLUTTER_KIT_OF), ...Object.values(EXOTIC_KIT), ...FLORA_TRUNKS.map((trunk) => ({ trunk }))])
      for (const [kind, k] of Object.entries(table)) {
        expect(CLUTTER_KINDS).toContain(kind);
        expect(k.size).toBeGreaterThan(0);
      }
  });

  it('gives a planet its own trees over its type’s', () => {
    expect(clutterKitOf({ id: 'yavin', type: 'forest' }).trunk.name).toBe('GiantPine_4');
    expect(clutterKitOf({ id: 'e:1,0:0:0', type: 'forest' }).trunk.name).toBe('GiantPine_2');
    expect(clutterKitOf({ id: 'x', type: 'gas' })).toEqual({});
    expect(clutterKitOf(null)).toEqual({});
  });

  it('stands every generated POI kind on at least LANDMARK_MIN things', () => {
    expect(Object.keys(POI_KITS).sort()).toEqual([...POI_KINDS].sort());
    for (const kind of POI_KINDS) {
      const rows = POI_KITS[kind];
      expect(rows.length, kind).toBeGreaterThanOrEqual(LANDMARK_MIN);
      for (const t of rows) {
        expect(Boolean(t.kind) !== Boolean(t.kit), `${kind}: ${JSON.stringify(t)}`).toBe(true);
        expect([...t.at, t.yaw, t.scale].every(Number.isFinite), kind).toBe(true);
        // (within the smallest r a generated place has: generated.js's SIZE)
        expect(Math.hypot(...t.at), kind).toBeLessThanOrEqual(60);
      }
    }
  });

  it('builds the generated POIs of only the kinds the named ones already use', () => {
    const used = new Set(Object.values(LANDMARKS).flatMap((byPoi) => Object.values(byPoi).flat()).filter((t) => t.kind).map((t) => t.kind));
    for (const [kind, rows] of Object.entries(POI_KITS)) for (const t of rows.filter((r) => r.kind)) expect(used.has(t.kind), `${kind}: ${t.kind}`).toBe(true);
  });

  it('gives a generated planet a tree from its flora, and an exotic one its own', () => {
    const forest = { id: 'e:3,-2:0:1', type: 'forest', flora: { family: 'forest', pick: 0.6 } };
    expect(clutterKitOf(forest).trunk.name).toBe('GiantPine_5');
    expect(clutterKitOf(forest).rock).toEqual(CLUTTER_KIT.forest.rock);
    expect(clutterKitOf({ ...forest, exotic: 'glowing' }).trunk.name).toBe('Tree_Light_1');
    expect(clutterKitOf({ ...forest, flora: { family: 'temperate', pick: 0.1 } }).trunk.name).toBe('GiantPine_2');
    // (a pick of 1 is the last tree, not past it)
    expect(clutterKitOf({ ...forest, flora: { family: 'forest', pick: 1 } }).trunk.name).toBe('CommonTree_3');
    // (an ocean's flora has no trees of its own: its type's kit, as it was)
    expect(clutterKitOf({ id: 'e:3,-2:0:2', type: 'ocean', flora: { family: 'ocean', pick: 0.6 } })).toEqual(CLUTTER_KIT.ocean);
    expect(clutterKitOf({ id: 'e:3,-2:0:3', type: 'rock', exotic: 'spires' }).spire.name).toBe('Tree_Spikes_2');
    expect(clutterKitOf({ id: 'e:3,-2:0:3', type: 'rock', exotic: 'crystal' })).toEqual(CLUTTER_KIT.rock);
    // (a cloud deck has no ground for its trees: generated.js gives it no exotic clutter)
    expect(clutterKitOf({ id: 'e:3,-2:0:4', type: 'gas', exotic: 'glowing' })).toEqual({});
    // (the fifty have neither, and keep theirs)
    for (const id of ['yavin', 'e:1,0:0:1']) expect(clutterKitOf(planetSpecOf(id))).toEqual({ ...CLUTTER_KIT[planetSpecOf(id).type], ...(CLUTTER_KIT_OF[id] ?? {}) });
  });

  it('stands an exotic planet’s trees and spires as tall as the shapes they stand in for', () => {
    for (const [exotic, table] of Object.entries(EXOTIC_KIT))
      for (const [kind, { kit, name, size }] of Object.entries(table)) {
        const tall = manifest(kit).models[name].height * size;
        expect(tall / SHAPE_HEIGHT[kind], `${exotic}: ${name}`).toBeGreaterThan(0.9);
        expect(tall / SHAPE_HEIGHT[kind], `${exotic}: ${name}`).toBeLessThan(1.1);
      }
  });

  it('reads a generated POI’s rows by its kind, a named one by its id', () => {
    expect(landmarkRowsOf({ id: 'e:3,-2:1:0', type: 'rock' }, { id: 'poi-0', kind: 'outpost' })).toBe(POI_KITS.outpost);
    expect(landmarkRowsOf({ id: 'mustafar' }, { id: 'arm' })).toBe(LANDMARKS.mustafar.arm);
    // (a named POI's own list over its kind's)
    expect(landmarkRowsOf({ id: 'mustafar' }, { id: 'arm', kind: 'ruins' })).toBe(LANDMARKS.mustafar.arm);
    expect(landmarkRowsOf({ id: 'hoth' }, { id: 'echo-base' })).toBeUndefined();
    expect(landmarkRowsOf({ id: 'e:3,-2:1:0' }, { id: 'poi-0', kind: 'castle' })).toBeUndefined();
    expect(landmarkRowsOf(null, null)).toBeUndefined();
  });
});
