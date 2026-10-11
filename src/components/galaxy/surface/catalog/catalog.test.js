import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import CREDITS from '../../../../data/modelCredits.json';
import PUBLISHED from '../../../../data/galaxyAssets.json';
import { bytesOf as sizeOf } from '../../../../../scripts/lib/asset-manifest.mjs';
import { NATIVE_CAPS } from '../../../../../scripts/lib/bf2017-caps.mjs';
import { ULTRA } from '../../../../../scripts/gen3d/budget.mjs';
import { ULTRA as CUT } from './ultra';
import { GROUPS, SURFACE_MODELS, lodUrlFor, madeKinds, modelUrlFor, surfaceFarUrl, surfaceLodUrl, surfaceUltraUrl, surfaceUrl, wantsLod } from './index';

const file = (kind) => new URL(`../../../../../public${surfaceUrl(kind)}`, import.meta.url);
const README = readFileSync(new URL('../../../../../public/cc0/README.md', import.meta.url), 'utf8');
const MB = 1024 * 1024;
// A file's size, and whether it's there: on disk, or (a game-derived file git
// ignores once published) in the public bucket's manifest, so CI needs no download.
const PUBLIC = new URL('../../../../../public', import.meta.url).pathname;
const bytesOf = (url) => sizeOf(url, { publicDir: PUBLIC, manifest: PUBLISHED });
const has = (url) => existsSync(`${PUBLIC}${url}`) || Boolean(PUBLISHED[url.slice(1)]);

// (the drop's object library, `game:<name>`, by its own urls: bf2017-library.test.js)
const SITE_OWN = Object.entries(SURFACE_MODELS).filter(([, m]) => m.group !== 'library2017');

describe('the surface models', () => {
  it('names each kind once, across the groups (the two Battlefront groups aside: a kind there takes over)', () => {
    const OVER = ['battlefront', 'bf2017', 'bf2017vehicles', 'library2017'];
    const all = Object.entries(GROUPS)
      .filter(([g]) => !OVER.includes(g))
      .flatMap(([, m]) => Object.keys(m));
    expect(new Set(all).size).toBe(all.length);
    for (const kind of [...all, ...Object.keys(GROUPS.battlefront), ...Object.keys(GROUPS.bf2017), ...Object.keys(GROUPS.bf2017vehicles)]) expect(kind, kind).toMatch(/^[a-z0-9]+$/);
    for (const kind of Object.keys(GROUPS.battlefront)) expect(SURFACE_MODELS[kind].group, kind).toBe(GROUPS.bf2017[kind] ? 'bf2017' : 'battlefront');
    for (const kind of Object.keys(GROUPS.bf2017)) expect(SURFACE_MODELS[kind].group, kind).toBe('bf2017');
    // (lane V's vehicles keep a group of their own, which nothing else names)
    for (const kind of Object.keys(GROUPS.bf2017vehicles)) expect(GROUPS.bf2017[kind], kind).toBeUndefined();
    for (const kind of Object.keys(GROUPS.bf2017vehicles)) expect(SURFACE_MODELS[kind].group, kind).toBe('bf2017vehicles');
  });

  it('puts the 2017 groups last, so their kinds win over every other (the library’s `game:` kinds after them)', () => {
    expect(Object.keys(GROUPS).slice(-3)).toEqual(['bf2017', 'bf2017vehicles', 'library2017']);
  });

  it('has each one brought in, small enough, with what the import needs', () => {
    for (const [kind, m] of SITE_OWN) {
      if (m.cluster) continue;
      expect(m.as, kind).toBeTruthy();
      expect(m.metres, kind).toBeGreaterThan(0);
      expect(['x', 'y', 'z', 'max', undefined], kind).toContain(m.along);
      expect(has(surfaceUrl(kind)), `${kind}.glb`).toBe(true);
      // (a native one, the game's own maps, to the native cap: it is served from the bucket)
      expect(bytesOf(surfaceUrl(kind)), `${kind}.glb`).toBeLessThan(m.native ? NATIVE_CAPS.plain : (m.hero ? 4 : 2.5) * MB);
    }
  });

  it('credits each Sketchfab model, and lists each made one', () => {
    const made = madeKinds(README);
    for (const [kind, m] of SITE_OWN) {
      if (m.cluster) continue;
      if (m.made === 'battlefront' || m.made === 'bf2017') {
        // (brought in by scripts/battlefront-import.mjs or bf2017-import.mjs: credited with its permission)
        expect(m.uid, kind).toBeUndefined();
        expect(CREDITS[`surface-${kind}`]?.license, `${kind}'s credit`).toBe('permission');
        expect(CREDITS[`surface-${kind}`]?.permission, `${kind}'s permission`).toBeTruthy();
        // (and a 2017 one names the manifest model it came from, so it can be made again)
        if (m.made === 'bf2017') {
          expect(typeof m.from, `${kind}'s from`).toBe('string');
          expect(m.from.length, `${kind}'s from`).toBeGreaterThan(0);
        }
      } else if (m.made) {
        expect(['meshy', 'quaternius', 'gen3d'], kind).toContain(m.made);
        expect(m.uid, kind).toBeUndefined();
        expect(made.has(kind), `${kind} in public/cc0/README.md`).toBe(true);
      } else {
        expect(m.uid, kind).toMatch(/^[0-9a-f]{32}$/);
        expect(CREDITS[`surface-${kind}`]?.file, `${kind}'s credit`).toBe(surfaceUrl(kind));
      }
    }
  });

  it('has every clip a row names in its file (else the figure sways where it should walk)', () => {
    const glbJson = (buf) => JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
    for (const [kind, m] of SITE_OWN) {
      if (!m.anim || m.cluster) continue;
      const names = (glbJson(readFileSync(file(kind))).animations ?? []).map((a) => a.name);
      for (const [use, clip] of Object.entries(m.anim)) expect(names, `${kind}'s ${use}: ${clip}`).toContain(clip);
    }
  });

  it('makes each cluster of models that are there', () => {
    for (const [kind, m] of SITE_OWN)
      if (m.cluster) {
        expect(m.uid, kind).toBeUndefined();
        for (const [member] of m.cluster) expect(SURFACE_MODELS[member] && !SURFACE_MODELS[member].cluster, `${kind}: ${member}`).toBeTruthy();
      }
  });

  it('reads the made kinds from the README list', () => {
    expect([...madeKinds('x `../models/galaxy/surface/{theed,palace}.glb`: made')]).toEqual(['theed', 'palace']);
    expect(madeKinds('nothing here').size).toBe(0);
  });

  it('reads every list the README has (each lane keeps a line of its own)', () => {
    expect([...madeKinds('`../models/galaxy/surface/{theed}.glb`: made\n`../models/galaxy/surface/{lothdome, sundaridome}.glb`: made')]).toEqual(['theed', 'lothdome', 'sundaridome']);
  });

  it('has a light model beside each one marked lod, and only those (scripts/galaxy-surface-lod.mjs)', () => {
    for (const [kind, m] of SITE_OWN) {
      if (m.cluster) continue;
      expect(has(surfaceLodUrl(kind)), `${kind}.lod1.glb`).toBe(Boolean(m.lod));
      if (m.lod) expect(bytesOf(surfaceLodUrl(kind)), `${kind}.lod1.glb`).toBeLessThan(0.7 * bytesOf(surfaceUrl(kind)));
    }
    const dir = new URL('../../../../../public/models/galaxy/surface/', import.meta.url);
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.lod1.glb'))) expect(SURFACE_MODELS[f.slice(0, -9)]?.lod, f).toBe(true);
  });

  it('has a far cut beside each one marked far, and only those, under a thousand-odd triangles’ bytes (lane V)', () => {
    for (const [kind, m] of SITE_OWN) {
      if (m.cluster) continue;
      expect(has(surfaceFarUrl(kind)), `${kind}.far.glb`).toBe(Boolean(m.far));
      if (m.far) expect(bytesOf(surfaceFarUrl(kind)), `${kind}.far.glb`).toBeLessThan(0.5 * MB);
    }
    const dir = new URL('../../../../../public/models/galaxy/surface/', import.meta.url);
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.far.glb'))) expect(SURFACE_MODELS[f.slice(0, -8)]?.far, f).toBe(true);
  });

  it('has an ultra cut beside each one whose entry says so, and only those, each within the ultra cut’s size', () => {
    for (const [kind, m] of SITE_OWN) {
      if (m.cluster) continue;
      expect(has(surfaceUltraUrl(kind)), `${kind}.ultra.glb`).toBe(Boolean(m.ultra));
      if (!m.ultra) continue;
      // (a native one may be the same mesh as the plain, with the game's maps at their own size, not cut down)
      if (m.native) expect(m.ultra.tris, `${kind}.ultra.tris`).toBeGreaterThanOrEqual(m.tris ?? 0);
      else expect(m.ultra.tris, `${kind}.ultra.tris`).toBeGreaterThan(m.tris ?? 0);
      // (and at most four times the catalogue's cut, where the entry has one: ./ultra.js)
      if (m.tris) expect(m.ultra.tris, `${kind}.ultra.tris`).toBeLessThanOrEqual(CUT.factor * m.tris);
      expect(m.ultra.tex, `${kind}.ultra.tex`).toBeLessThanOrEqual(ULTRA.tex);
      // (a native one to the native cap: it is served from the bucket)
      expect(bytesOf(surfaceUltraUrl(kind)), `${kind}.ultra.glb`).toBeLessThan(m.native ? NATIVE_CAPS.ultra : ULTRA.bytes);
    }
    const dir = new URL('../../../../../public/models/galaxy/surface/', import.meta.url);
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.ultra.glb'))) expect(SURFACE_MODELS[f.slice(0, -10)]?.ultra, f).toBeTruthy();
  });
});

describe('which file a level loads, and whether it swaps to the light one far off', () => {
  const models = { plain: { lod: true }, tall: { lod: true, ultra: { tris: 400000, tex: 8192 } }, small: {} };

  it('loads the ultra cut at ultra where the kind has one, the plain file otherwise', () => {
    expect(modelUrlFor('tall', 'ultra', models)).toBe(surfaceUltraUrl('tall'));
    expect(modelUrlFor('tall', 'high', models)).toBe(surfaceUrl('tall'));
    expect(modelUrlFor('plain', 'ultra', models)).toBe(surfaceUrl('plain'));
    expect(modelUrlFor('nothing', 'ultra', models)).toBe(surfaceUrl('nothing'));
  });

  it('loads a native kind’s light cut alone at low and mid (the phone’s), its plain at high, its ultra at ultra', () => {
    const native = { ship: { native: true, lod: true, ultra: { tris: 80000, tex: 4096 } }, bare: { native: true } };
    expect(modelUrlFor('ship', 'low', native)).toBe(surfaceLodUrl('ship'));
    expect(modelUrlFor('ship', 'mid', native)).toBe(surfaceLodUrl('ship'));
    expect(modelUrlFor('ship', 'high', native)).toBe(surfaceUrl('ship'));
    expect(modelUrlFor('ship', 'ultra', native)).toBe(surfaceUltraUrl('ship'));
    // (one with no light cut has only its plain to give)
    expect(modelUrlFor('bare', 'low', native)).toBe(surfaceUrl('bare'));
    // (and a kind that isn't native keeps its plain at every level below ultra)
    expect(modelUrlFor('plain', 'low', models)).toBe(surfaceUrl('plain'));
  });

  it('never swaps to the light model at ultra, and does below it where the kind has one', () => {
    expect(wantsLod('plain', 'ultra', models)).toBe(false);
    expect(wantsLod('plain', 'high', models)).toBe(true);
    expect(wantsLod('plain', 'low', models)).toBe(true);
    expect(wantsLod('small', 'high', models)).toBe(false);
  });
});

// a book of models outside the galaxy's folder (the Rick and Morty planets')
// names each file by its own url
describe('a model from its own url', () => {
  it('loads the url at every level, its cuts only where it names them', () => {
    expect(modelUrlFor('x', 'high', { x: { url: '/models/c137/rm/x.glb' } })).toBe('/models/c137/rm/x.glb');
    expect(modelUrlFor('x', 'ultra', { x: { url: '/a.glb', ultra: {} } })).toBe('/a.glb');
    expect(modelUrlFor('x', 'ultra', { x: { url: '/a.glb', ultraUrl: '/a.ultra.glb' } })).toBe('/a.ultra.glb');
    expect(modelUrlFor('x', 'high', { x: { url: '/a.glb', ultraUrl: '/a.ultra.glb' } })).toBe('/a.glb');
  });

  it('swaps to a light model far off only where it names one', () => {
    expect(wantsLod('x', 'high', { x: { url: '/a.glb' } })).toBe(false);
    expect(wantsLod('x', 'high', { x: { url: '/a.glb', lod: true } })).toBe(false);
    expect(wantsLod('x', 'high', { x: { url: '/a.glb', lodUrl: '/a.lod1.glb' } })).toBe(true);
    expect(lodUrlFor('x', { x: { url: '/a.glb', lodUrl: '/a.lod1.glb' } })).toBe('/a.lod1.glb');
    expect(lodUrlFor('plain', { plain: { lod: true } })).toBe(surfaceLodUrl('plain'));
  });
});
