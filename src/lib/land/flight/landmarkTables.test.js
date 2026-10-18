import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CLUTTER_KIT, CLUTTER_KIT_OF, EXOTIC_KIT, FLORA_TRUNKS, LANDMARKS, LANDMARK_MIN, POI_KITS, SITE_PLACES, clutterKitOf, landmarkRowsOf } from './landmarkTables.js';
import { PLANETS, planetSpecOf } from './fixtures/expanse.js';
import { CLUTTER_KINDS } from './leafMesh.js';

// (read once a pack: the manifests are big, and this runs for every model named)
const manifests = {};
const manifest = (pack) => (manifests[pack] ??= JSON.parse(readFileSync(new URL(`../../../../public/kit/${pack}/index.json`, import.meta.url), 'utf8')));
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
      ...FLORA_TRUNKS.map(({ kit, name }) => ({ kit, name })),
      ...Object.values(EXOTIC_KIT).flatMap(Object.values).filter((v) => v.kit),
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
    for (const table of [...Object.values(CLUTTER_KIT), ...Object.values(CLUTTER_KIT_OF)])
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
    expect(Object.keys(POI_KITS).sort()).toEqual(['monolith', 'outpost', 'ruins', 'signal', 'wreck']);
    for (const [kind, rows] of Object.entries(POI_KITS)) expect(rows.length, kind).toBeGreaterThanOrEqual(LANDMARK_MIN);
  });

  it('gives a generated planet a tree from its flora, and an exotic one its own', () => {
    const spec = { id: 'e:3,-2:0:1', type: 'forest', flora: { family: 'forest', pick: 0.6 } };
    expect(clutterKitOf(spec).trunk.name).toBe('GiantPine_5');
    expect(clutterKitOf({ ...spec, exotic: 'glowing' }).trunk.name).toBe('Tree_Light_1');
    expect(clutterKitOf({ ...spec, exotic: 'spires' }).spire.name).toBe('Tree_Spikes_2');
  });

  it('reads a generated POI’s rows by its kind, a named one by its id', () => {
    expect(landmarkRowsOf({ id: 'e:3,-2:1:0' }, { id: 'poi-0', kind: 'wreck' })).toBe(POI_KITS.wreck);
    expect(landmarkRowsOf({ id: 'lothal' }, { id: 'temple', kind: 'ruins' })).toBe(LANDMARKS.lothal.temple);
    expect(landmarkRowsOf(null, null)).toBeUndefined();
  });
});
