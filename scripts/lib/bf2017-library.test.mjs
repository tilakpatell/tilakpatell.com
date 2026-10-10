import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { biomeOf, countRows, indexRows, setOf, tagsOf } from './bf2017-library.mjs';
import { readManifest } from './bf2017-manifest.mjs';

// thirty-eight rows of the drop's manifest across the sets (cut to the fields the index reads)
const manifest = readManifest(readFileSync(new URL('../fixtures/bf2017/web/library.jsonl', import.meta.url), 'utf8'));
const rows = indexRows(manifest);
const row = (name) => rows.find((r) => r.name === name);

describe('the object library’s index', () => {
  it('files Kamino’s architecture by its set, kind and size', () => {
    expect(row('objects/architecture/kamino/archive/o_kam_archivecenter_01_mesh')).toMatchObject({ kind: 'architecture', set: 'kamino', biome: 'ocean' });
    expect(['small', 'medium', 'large', 'huge']).toContain(row('objects/architecture/kamino/archive/o_kam_archivecenter_01_mesh').size);
  });

  it('gives a nature row its folder’s biome', () => {
    expect(row('objects/nature/volcanic/_volcanicbase/volcanicbase_backdrop_02/volcanicbase_backdrop_02_lavarivers_01_mesh')).toMatchObject({
      kind: 'nature',
      set: 'volcanic',
      biome: 'volcanic',
      size: 'huge',
    });
    expect(biomeOf('objects/nature/arctic/x/x_mesh')).toBe('arctic');
  });

  it('keeps the sequel era out, by name and by set', () => {
    expect(rows.some((r) => r.name.startsWith('s9/paintball/'))).toBe(false);
    expect(rows.some((r) => r.name.includes('/takodana/'))).toBe(false);
    for (const r of rows) expect(['takodana', 'jakku', 'jak', 'starkiller', 'crait', 'firstorder', 'resistance', 'paintball']).not.toContain(r.set);
  });

  it('files Cloud City’s level meshes as architecture, and the backdrop clouds as clouds', () => {
    // (`levels/clouds` is Cloud City's level, not the sky: the spec read it as the sky's)
    expect(row('levels/clouds/clouds_03/objects/architecture/arrivalplaza_custom_left_01_floorgrill_01_mesh')).toMatchObject({
      kind: 'architecture',
      set: 'cloudcity',
      biome: 'clouds',
    });
    expect(row('objects/nature/forest/_forestbase/forestbase_backdropcloud_01/forestbase_backdropcloud_01_a_mesh')).toMatchObject({ kind: 'cloud', set: 'forest' });
  });

  it('makes the living world life, and says which carry a skeleton', () => {
    expect(row('objects/livingworld/geejaw_01/geejaw_01_mesh')).toMatchObject({
      kind: 'life',
      set: 'livingworld',
      rig: false,
    });
    expect(row('objects/props/landmarks/_galacticempire/imperialshuttle_01/imperialshuttle_01_mesh')).toMatchObject({ kind: 'landmark', set: '_galacticempire' });
  });

  it('files the seasons’ objects as the main folders would', () => {
    expect(setOf('s3/objects/kessel/architecture/controlroom/kes_controlroomceiling_01_mesh')).toBe('kessel');
    expect(row('s3/objects/kessel/architecture/controlroom/kes_controlroomceiling_01_mesh').kind).toBe('architecture');
    expect(setOf('s2/objects/props/blanketjabba_01/o_tat_blanketjabba_01_mesh')).toBe('bespin');
    expect(setOf('s5_1/objects/_galacticrepublic/props/barrierclone_01/rep_barrierclone_01_mesh')).toBe('_galacticrepublic');
    expect(setOf('objects/props/objectsets/sullust/atat_parts/atat_body/sul_prop_atat_body_01_mesh')).toBe('sullust');
    expect(setOf('s8/felucia/objects/felucia/props/lamp_01/lamp_01_mesh')).toBe('felucia');
    expect(setOf('s6_2/geonosis_02/objects/_separatists/architecture/wall_01/wall_01_mesh')).toBe('_separatists');
  });

  it('leaves out what is not placeable: the heroes, the front end’s cards are its own kind', () => {
    expect(rows.some((r) => r.name.startsWith('characters/'))).toBe(false);
    expect(row('levels/frontend/objects/cards/starcard_03/starcard_rarity_common_01_mesh').kind).toBe('frontend');
  });

  it('tags a row with its name’s words, and sorts and counts', () => {
    expect(tagsOf('objects/props/objectsets/_galacticempire/box_m_04/box_m_04_mesh')).toEqual(['box']);
    expect(tagsOf('x/lamp_01/lamp_01_mesh', { 'x/lamp_01/lamp_01_mesh': ['Light'] })).toEqual(['lamp', 'light']);
    expect(rows.map((r) => r.name)).toEqual([...rows.map((r) => r.name)].sort());
    const c = countRows(rows);
    expect(Object.values(c.kind).reduce((a, b) => a + b, 0)).toBe(rows.length);
  });
});
