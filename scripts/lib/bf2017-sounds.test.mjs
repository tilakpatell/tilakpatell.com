import { describe, expect, it } from 'vitest';
import { GUN_GAINS, GUN_IDS, SET, fileOf, planSet } from './bf2017-sounds.mjs';

const line = (asset, variation, more = {}) => ({ group: 'x', asset: `Sound/${asset}`, variation, status: 'wav', language: '', channels: 2, duration: 1, out: `Sound/${asset}_v${String(variation + 1).padStart(2, '0')}.wav`, ...more });

describe('the Hoth sound set', () => {
  it('names a take’s file by the site’s name and its number', () => {
    expect(fileOf('blaster.e11.close', 0)).toBe('blaster-e11-close-01.mp3');
    expect(fileOf('music.loading.loop', 11)).toBe('music-loading-loop-12.mp3');
  });

  it('has both layers of every Hoth trooper blaster, with the patch’s gains', () => {
    expect(GUN_IDS).toEqual(['e11', 'dlt19', 'rk3', 'dlt19x', 'a280', 'rt97c', 'dh17', 'dlt20a']);
    for (const g of GUN_IDS) {
      expect(SET[`blaster.${g}.close`].asset).toMatch(/Laser_Close/);
      expect(SET[`blaster.${g}.distant`].asset).toMatch(/Laser_Distant/);
    }
    expect(SET['blaster.e11.close'].gain).toBe(GUN_GAINS.e11[0]);
    expect(SET['blaster.dlt19.distant'].gain).toBe(0.7);
    expect(SET['blaster.hifi'].gain).toBe(0.2);
  });

  it('keeps the music stems and the beds stereo and the one-shots mono', () => {
    for (const [name, row] of Object.entries(SET)) {
      if (name.startsWith('music.') || name === 'ambience.bed' || name === 'ambience.cave') expect(row.stereo, name).toBe(true);
      else expect(row.stereo, name).toBeFalsy();
    }
  });

  it('keeps the VO to the English takes', () => {
    for (const [name, row] of Object.entries(SET)) if (name.startsWith('vo.')) expect(row.language, name).toBe('English');
  });

  it('plans the first takes of a name, in variation order, never more than asked', () => {
    const rows = [line(SET['step.walk'].asset, 2), line(SET['step.walk'].asset, 0), ...Array.from({ length: 10 }, (_, i) => line(SET['step.walk'].asset, i + 3)), line(SET['step.walk'].asset, 1)];
    const { plan } = planSet(rows, { 'step.walk': SET['step.walk'] });
    expect(plan).toHaveLength(1);
    expect(plan[0].srcs).toHaveLength(8);
    expect(plan[0].srcs[0]).toMatch(/_v01\.wav$/);
    expect(plan[0].srcs[7]).toMatch(/_v08\.wav$/);
    expect(plan[0].seconds).toBe(8);
  });

  it('takes a segment of a multi-segment variation (the loading loop’s intro and loop)', () => {
    const asset = SET['music.loading.loop'].asset;
    const rows = [line(asset, 0, { segmentOuts: [`Sound/${asset}_v01_s01.wav`, `Sound/${asset}_v01_s02.wav`], segmentLengths: [4.1, 127.1], duration: 131.2 })];
    const { plan } = planSet(rows, { 'music.loading.intro': SET['music.loading.intro'], 'music.loading.loop': SET['music.loading.loop'] });
    expect(plan.map((p) => p.srcs[0])).toEqual([`Sound/${asset}_v01_s01.wav`, `Sound/${asset}_v01_s02.wav`]);
    expect(plan[1].loop).toBe(true);
    expect(plan[1].seconds).toBe(127.1);
  });

  it('keeps only the language asked for, and reports what the manifest lacks', () => {
    const asset = SET['vo.imperial.timeLow'].asset;
    const rows = [line(asset, 0, { language: 'German' }), line(asset, 5, { language: 'English' })];
    const { plan, missing } = planSet(rows, { 'vo.imperial.timeLow': SET['vo.imperial.timeLow'], 'step.jump': SET['step.jump'] });
    expect(plan).toHaveLength(1);
    expect(plan[0].srcs[0]).toMatch(/_v06\.wav$/);
    expect(missing).toEqual([{ name: 'step.jump', asset: SET['step.jump'].asset }]);
  });

  it('joins a set of several assets in order (the two medium stems)', () => {
    const [a, b] = SET['music.medium'].asset;
    const { plan } = planSet([line(b, 0), line(a, 0)], { 'music.medium': SET['music.medium'] });
    expect(plan[0].srcs).toEqual([`Sound/${a}_v01.wav`, `Sound/${b}_v01.wav`]);
  });
});
