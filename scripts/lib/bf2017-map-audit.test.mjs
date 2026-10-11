import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { USABLE, auditMap, checkRows, levelKey, readmeOf, rulebookFile } from './bf2017-map-audit.mjs';

const README = readFileSync(new URL('../fixtures/bf2017/map-audit/hoth.README.md', import.meta.url), 'utf8');
// (Hoth_01's row of the bucket's web/maps/index.json, and its manifest cut to what the audit reads)
const INDEX = {
  level: 'Levels/MP/Hoth_01/Hoth_01',
  kind: 'multiplayer',
  instances: 24532,
  meshes: 602,
  spawns: 31,
  lights: 1234,
  effects: 648,
  decals: 0,
  terrain: [{}],
};
const MANIFEST = {
  subworlds: ['Levels/MP/Hoth_01/Hoth_01', 'Levels/MP/Hoth_01/FantasyBattle', 'Levels/MP/Hoth_01/HeroArena', 'Levels/MP/Hoth_01/TeamDeathmatch', 'Levels/MP/Hoth_01/Mode9', 'Levels/MP/Hoth_01/Mode6'],
  groups: [
    { kind: 'actor', count: 20 },
    { kind: 'actor', count: 8 },
    { kind: 'object', count: 900 },
  ],
  vehicleSpawns: new Array(31).fill({}),
};
const FILES = new Set(['level.json', 'README.md', 'lights.json', 'actors.json', 'vehicles.json', 'decals.json', 'effects.json', 'scatter.json']);
const PACK = {
  world: 'hoth',
  readme: README,
  parts: { 'effects.json': 398 },
  has: (f) => FILES.has(f),
};
const REPORT = { mid: { calls: 122, triangles: 819586 } };
const RULEBOOK = { modes: ['galacticAssault', 'hvv', 'blast'], unplaced: [] };

describe('the maps’ ledger', () => {
  it('lists the fifth design’s 44 usable maps, the sequel era none', () => {
    expect(USABLE).toHaveLength(44);
    expect(new Set(USABLE.map(levelKey)).size).toBe(44);
    expect(USABLE.some((l) => /jakku|takodana|starkiller|crait|resurgent|spacebear/i.test(l))).toBe(false);
  });

  it('names a level and its rulebook file', () => {
    expect(levelKey('Levels/MP/Hoth_01/Hoth_01')).toBe('hoth_01');
    expect(levelKey('Levels/SP/A1/M0LIB/DS02')).toBe('a1_m0lib_ds02');
    expect(levelKey('A3/Levels/SP/M2PIL/DS02')).toBe('a3_m2pil_ds02');
    expect(rulebookFile('hoth_01')).toBe('hoth.json');
    expect(rulebookFile('hoth_02')).toBe('hoth.2.json');
    expect(rulebookFile('sb_droidbattleship_01')).toBe('sb_droidbattleship.json');
    expect(rulebookFile('a1_m0lib_ds02')).toBe('a1_m0lib_ds02.json');
    expect(rulebookFile('frontend')).toBe('frontend.json');
  });

  it('reads a pack’s README: the arena, the cull row, E0’s parts', () => {
    const r = readmeOf(README);
    expect([r.instances, r.horizon]).toEqual([5815, 236]);
    expect(r.cull).toEqual({ low: 120, mid: 40, high: 0 });
    expect(r.parts['lights.json']).toMatchObject({ count: 1234, drawn: true });
    expect(r.parts['effects.json']).toMatchObject({ count: 398, drawn: false });
    expect(r.parts['decals.json']).toMatchObject({ count: 0, drawn: false });
  });

  it('sets the map against Hoth’s pack, per tier', () => {
    const row = auditMap({
      level: INDEX.level,
      index: INDEX,
      manifest: MANIFEST,
      pack: PACK,
      report: REPORT,
      rulebook: RULEBOOK,
      modes: { world: 'hoth', modes: ['galacticAssault', 'hvv', 'blast'] },
      stages: ['galacticAssault'],
    });
    expect(row).toMatchObject({
      key: 'hoth_01',
      kind: 'multiplayer',
      world: 'hoth',
      pack: 'hoth',
      subLevels: { inMap: 6, inPack: 6 },
    });
    expect(row.instances).toMatchObject({
      inMap: 24532,
      inPack: 6051,
      drawn: {
        low: 5695,
        mid: 5775,
        high: 5815,
        ultra: null,
        midFrame: { calls: 122, triangles: 819586 },
      },
    });
    expect(row.lights).toEqual({ inMap: 1234, inPack: 1234, drawn: 1234 });
    expect(row.effects).toEqual({ inMap: 648, inPack: 398, drawn: 0 });
    expect(row.actors).toEqual({ inMap: 28, inPack: 28, drawn: 28 });
    expect(row.vehicles).toEqual({ inMap: 31, inPack: 31, drawn: 31 });
    expect(row.modes).toEqual({
      inRecords: ['galacticAssault', 'hvv', 'blast', 'showdown', 'coop'],
      inModesJson: ['galacticAssault', 'hvv', 'blast'],
      withRulebook: ['galacticAssault', 'hvv', 'blast'],
      withStages: ['galacticAssault'],
    });
    expect(row.terrain).toEqual({ layers: 1, scatter: true });
    expect(row.gaps).toEqual(['mode showdown: in the records, not in the rulebook', 'mode coop: in the records, not in the rulebook']);
    expect(checkRows([row])).toEqual([]);
  });

  it('a map with no pack has its data columns and nothing drawn, and passes the check (Review Focus 1)', () => {
    const row = auditMap({
      level: 'S9_3/Hoth_02/Hoth_02',
      index: {
        ...INDEX,
        level: 'S9_3/Hoth_02/Hoth_02',
        instances: 6868,
        lights: 54,
      },
      manifest: {
        subworlds: ['S9_3/Hoth_02/Mode1'],
        groups: [],
        vehicleSpawns: [],
      },
    });
    expect(row.pack).toBeNull();
    expect(row.instances).toEqual({ inMap: 6868, inPack: null, drawn: null });
    expect(row.lights).toEqual({ inMap: 54, inPack: null, drawn: null });
    expect(row.modes.inRecords).toEqual(['supremacy']);
    expect(row.gaps).toEqual(['no pack', 'no rulebook']);
    expect(checkRows([row])).toEqual([]);
  });

  it('fails a pack whose README claims a part it lacks, a mode without its rulebook, an unplaced count off its header', () => {
    const pack = { ...PACK, has: (f) => f !== 'actors.json' && FILES.has(f) };
    const row = auditMap({
      level: INDEX.level,
      index: INDEX,
      manifest: MANIFEST,
      pack,
      rulebook: {
        modes: ['galacticAssault'],
        unplaced: [{}, {}],
        unplacedCount: 1,
      },
      modes: { modes: ['galacticAssault', 'strike'] },
    });
    expect(checkRows([row])).toEqual(['hoth_01: the pack’s README claims actors.json, which the pack lacks', 'hoth_01: modes.json lists strike, which its rulebook lacks', 'hoth_01: its rulebook has 2 unplaced rows, its header says 1']);
  });

  it('reads Strike from its Domination layer', () => {
    const row = auditMap({
      level: 'Levels/MP/Naboo_01/Naboo_01',
      manifest: { subworlds: ['Domination', 'Mode1', 'FantasyBattle'] },
    });
    expect(row.modes.inRecords).toEqual(['galacticAssault', 'strike', 'supremacy']);
  });
});
