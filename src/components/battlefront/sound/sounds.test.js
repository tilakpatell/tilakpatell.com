import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ABILITY_IDS, DIR, NAMES, ROWS, abilityCues, gunOf, pickTake, rowOf, totalBytes, urlOf } from './sounds.js';
import CLASSES from '../../../data/bf2017/classes.json';
import { WORLD_MB } from '../../worlds/worlds.js';

const PUBLIC = new URL('../../../../public', import.meta.url);

describe('the Battlefront world’s sounds', () => {
  it('holds the trooper blasters, the snow steps, the overheat set, the bed, the stems and the loading loop', () => {
    for (const n of ['blaster.e11.close', 'blaster.e11.distant', 'blaster.a280.close', 'blaster.hifi', 'blaster.noise.distant', 'step.walk', 'step.jog', 'step.sprint', 'cloth.land', 'death.scream', 'death.fall', 'hit.hit', 'hit.kill', 'overheat.warning', 'overheat.overheated', 'overheat.reset', 'ambience.bed', 'ambience.wind.gusts', 'music.medium', 'music.high', 'music.tension.loop', 'music.eor.win', 'music.loading.intro', 'music.loading.loop', 'vo.imperial.uplinkActivate']) {
      expect(rowOf(n), n).not.toBeNull();
      expect(rowOf(n).files.length, n).toBeGreaterThan(0);
    }
    expect(rowOf('nothing')).toBeNull();
  });

  it('every file the index names is in public/, the size the index says', () => {
    let bytes = 0;
    for (const [name, row] of Object.entries(ROWS)) {
      for (const f of row.files) {
        const abs = new URL(`${PUBLIC.href}${urlOf(f)}`);
        expect(existsSync(abs), `${name}: ${f}`).toBe(true);
        bytes += statSync(abs).size;
      }
    }
    expect(bytes).toBe(totalBytes());
  });

  it('stays under the world’s download budget (WORLD_MB, src/components/worlds/worlds.js)', () => {
    expect(totalBytes() / 1e6).toBeLessThanOrEqual(WORLD_MB['/battlefront']);
    expect(NAMES.length).toBeGreaterThan(100);
  });

  it('names a take’s path under the game’s audio folder', () => {
    expect(DIR).toBe('/audio/galaxy/bf2017');
    expect(urlOf('blaster-e11-close-01.mp3')).toBe('/audio/galaxy/bf2017/blaster-e11-close-01.mp3');
  });

  it('never plays one of the last three takes again (VariationHistoryCount 3)', () => {
    const row = { files: ['a', 'b', 'c', 'd', 'e', 'f'] };
    const seen = new Set();
    for (let i = 0; i < 200; i++) seen.add(pickTake(row, [0, 1, 2], Math.random));
    expect([...seen].sort()).toEqual([3, 4, 5]);
    expect(pickTake(row, [3, 4, 5, 0, 1], () => 0)).toBe(2);
    expect(pickTake({ files: ['a'] }, [0])).toBe(0);
    // a short set: the history shrinks so something can always play
    expect(pickTake({ files: ['a', 'b'] }, [0, 1, 0], () => 0)).toBe(1);
    expect(pickTake(null)).toBe(0);
  });

  it('picks the blaster set by the weapon, the side’s rifle for one the set lacks', () => {
    expect(gunOf('dlt19')).toBe('dlt19');
    expect(gunOf('a280')).toBe('a280');
    expect(gunOf('tl50', 2)).toBe('e11');
    expect(gunOf(null, 1)).toBe('a280');
    for (const g of ['e11', 'dlt19', 'rk3', 'dlt19x', 'a280', 'rt97c', 'dh17', 'dlt20a']) {
      expect(rowOf(`blaster.${g}.close`), g).not.toBeNull();
      expect(rowOf(`blaster.${g}.distant`), g).not.toBeNull();
    }
  });

  it('knows every ability of Hoth’s eight Orig kits, and each cue it names is in the index', () => {
    for (const id of ['d-orig-assault', 'd-orig-heavy', 'd-orig-officer', 'd-orig-specialist', 'l-orig-assault', 'l-orig-heavy', 'l-orig-officer', 'l-orig-specialist']) {
      for (const a of CLASSES.rows[id].abilities) expect(ABILITY_IDS, `${id}: ${a.id}`).toContain(a.id);
    }
    expect(abilityCues('DefaultAbility_Assault_ThermalDetonator', 'start')).toEqual(['ability.thermal.click', 'ability.thermal.beeps']);
    expect(abilityCues('DefaultAbility_Assault_ThermalDetonator', 'active')).toEqual([]);
    expect(abilityCues('nothing', 'start')).toEqual([]);
    for (const id of ABILITY_IDS) for (const phase of ['start', 'active', 'end']) for (const n of abilityCues(id, phase)) expect(rowOf(n), `${id} ${phase} ${n}`).not.toBeNull();
  });
});
