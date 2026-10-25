import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import PUBLISHED from '../../../data/galaxyAssets.json';
import { bytesOf, onSite } from '../../../../scripts/lib/asset-manifest.mjs';
import { PLANETS, planetSpecOf } from './planets';
import { WORLD_MB } from '../../worlds/worlds';
import { PACK } from './pack';
import { landmarkFiles } from './landmarkFiles';
import { EXOTIC_KIT, POI_KITS } from '../../../lib/land/flight/landmarkTables';
import { chartOf } from '../../../lib/land/flight/sphere';

const pub = (u) => new URL(`../../../../public${u}`, import.meta.url);
const kits = Object.fromEntries(['naturemega', 'space'].map((p) => [p, JSON.parse(readFileSync(pub(`/kit/${p}/index.json`), 'utf8'))]));
// (on disk, or published to the bucket and out of git: src/data/galaxyAssets.json)
const PUBLIC = { publicDir: fileURLToPath(pub('')), manifest: PUBLISHED };
const mb = (urls) => urls.reduce((n, u) => n + bytesOf(u, PUBLIC), 0) / 1e6;
// what the flight fetches besides its landmarks (worlds.js's own line): the scans and Coruscant's models
const BASE_MB = 5;

describe('landmarkFiles', () => {
  it('names only files that are there', () => {
    for (const { id } of PLANETS) for (const u of landmarkFiles(planetSpecOf(id), { kits })) expect(onSite(u, PUBLIC), `${id}: ${u}`).toBe(true);
  });

  it('keeps the flight’s download over the heaviest planet’s, measured', () => {
    const heaviest = Math.max(...PLANETS.map(({ id }) => mb(landmarkFiles(planetSpecOf(id), { kits }))));
    expect(heaviest).toBeGreaterThan(1);
    expect(WORLD_MB['/fly']).toBeGreaterThanOrEqual(BASE_MB + heaviest);
    // (and not far over it: a figure that's grown stale says so)
    expect(WORLD_MB['/fly']).toBeLessThan(BASE_MB + heaviest + 2);
  });

  it('lists every file in the install’s pack, at every level', () => {
    const listed = new Set(PACK.urls);
    for (const { id } of PLANETS) for (const level of ['low', 'mid', 'high']) for (const u of landmarkFiles(planetSpecOf(id), { kits, level })) expect(listed.has(u), `${id} ${level}: ${u}`).toBe(true);
  });

  it('lists a generated planet’s places and its exotic trees in the install’s pack', () => {
    const listed = new Set(PACK.urls);
    // (a generated forest: every kind of place on it, and each exotic)
    const forest = planetSpecOf('e:3,-2:4:0');
    expect(forest).toMatchObject({ type: 'forest', buildable: false });
    const { toDir } = chartOf(forest.round.at, forest.round.radius);
    const pois = Object.keys(POI_KITS).map((kind, i) => ({ id: `poi-${i}`, name: kind, kind, dir: toDir(i * 600, 0), at: [i * 600, 0], r: 60, edge: 80 }));
    const seen = new Set();
    for (const exotic of [null, ...Object.keys(EXOTIC_KIT)])
      for (const level of ['low', 'mid', 'high'])
        for (const u of landmarkFiles({ ...forest, pois, exotic }, { kits, level })) {
          expect(listed.has(u), `${exotic} ${level}: ${u}`).toBe(true);
          seen.add(u);
        }
    expect([...seen]).toEqual(expect.arrayContaining(['/kit/space/spaceship.glb', '/kit/space/tree.glb']));
  });

  it('leaves the kit clutter out on low', () => {
    const low = landmarkFiles(planetSpecOf('endor'), { kits, level: 'low' });
    expect(low.some((u) => u.endsWith('giantpine.glb'))).toBe(false);
    expect(landmarkFiles(planetSpecOf('endor'), { kits }).some((u) => u.endsWith('giantpine.glb'))).toBe(true);
  });
});
