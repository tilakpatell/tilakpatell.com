import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LOOKS } from '../../src/components/galaxy/bodies.js';
import { PICTURES, SEQUEL_WORLDS, SKINS, UNPLACED, convertSkin, coveragePng, meanColor, nameOf, planFor, planetNames, sequelWorld, sizesFor, skinsJson } from './bf2017-planets.mjs';

const sharp = createRequire(createRequire(import.meta.url).resolve('ndarray-pixels'))('sharp');
const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'bf2017', 'web', 'textures', 'levels', 'space', 'sb_endor_01', 'planet');
const stand = async () => ({ ktx2: Buffer.from('KTX2 stand-in') });

describe('the planet skins table', () => {
  it('names only planets the site draws, and no sequel world', () => {
    for (const id of [...Object.keys(SKINS), ...Object.keys(PICTURES)]) {
      expect(LOOKS[id], id).toBeTruthy();
      expect(sequelWorld(id), id).toBe(false);
    }
    for (const [id, skin] of Object.entries(SKINS)) {
      for (const w of SEQUEL_WORLDS) expect(JSON.stringify(skin).includes(w), `${id} ${w}`).toBe(false);
      expect(skin.color || skin.rings, id).toBeTruthy();
    }
  });

  it('never lays a picture of a globe on a sphere', () => {
    const named = Object.values(SKINS).flatMap((s) => Object.values(s).filter((v) => typeof v === 'string'));
    for (const pic of Object.values(PICTURES)) expect(named, pic).not.toContain(pic);
  });

  it('sizes each map by tier: none on low, KTX2 for the ultra colour and normal, clouds at half', () => {
    expect(sizesFor('color', 'ultra')).toEqual({ w: 4096, format: 'ktx2' });
    expect(sizesFor('normal', 'high')).toEqual({ w: 2048, format: 'webp' });
    expect(sizesFor('color', 'mid')).toEqual({ w: 1024, format: 'webp' });
    expect(sizesFor('clouds', 'ultra')).toEqual({ w: 2048, format: 'webp' });
    expect(sizesFor('color', 'low')).toBeNull();
  });
});

describe('planFor', () => {
  const dir = 'levels/space/sb_endor_01/planet';
  const have = new Set([`${dir}/t_planet_endor_01_cs`, `${dir}/t_planet_endor_01_n`, `${dir}/t_planet_endor_cloudes_03_c`]);

  it('takes the one name a glob matches, and lists the rest as missing, never throwing', () => {
    const { fetch, missing } = planFor(SKINS.endor, have);
    expect(fetch).toEqual([
      { kind: 'color', name: `${dir}/t_planet_endor_01_cs` },
      { kind: 'normal', name: `${dir}/t_planet_endor_01_n` },
      { kind: 'clouds', name: `${dir}/t_planet_endor_cloudes_03_c` },
    ]);
    expect(missing).toEqual([{ kind: 'atmo', why: 'not in the bucket yet' }]);
    expect(() => planFor(undefined, undefined)).not.toThrow();
  });

  it('reports a glob that matches two names, and falls back to the next', () => {
    const two = new Set(['a/x_cloud_01_c', 'a/x_cloud_02_c', 'b/y_c']);
    expect(planFor({ clouds: 'a/*cloud*' }, two).missing[0].why).toMatch(/^ambiguous: a\/\*cloud\*: 2 names/);
    expect(planFor({ clouds: ['a/*cloud*', '*/y_c'] }, two).fetch).toEqual([{ kind: 'clouds', name: 'b/y_c' }]);
  });

  // (lane E5: the six new systems' rows against the bucket's listing of 2026-10-11)
  it('finds every map of the six new worlds, and leaves Felucia and Kessel to their globes', () => {
    const dir = 'levels/space/sb_fondor_01/planet';
    const have = new Set([
      `${dir}/t_planet_fondor_03_cs`, `${dir}/t_planet_fondor_03_ni`, `${dir}/t_moon_fondor_01_c`, `${dir}/t_dock_cards_01_c`,
      'objects/planets/pillio_alive/t_pillio_alive_01_c', 'objects/planets/pillio_alive/t_pillio_alive_01_ca', 'objects/planets/pillio_dead/t_planetpilliodead_01_c', 'objects/planets/pillio_dead/t_cloudspilliodead_01_ca',
      'objects/planets/sullust/t_planetsullust_01_c', 'objects/planets/sullust/t_cloudssullust_01_ca',
      'objects/planets/vardos_alive/t_planetvardosalive_01_c', 'objects/planets/vardos_alive/t_cloudsvardosalive_01_ca', 'objects/planets/vardos_dead/t_planetvardosdead_01_c', 'objects/planets/vardos_dead/t_cloudsvardosdead_01_ca',
      's8/felucia/objects/planets/felucia/t_planetfrontendfelucia_01_ca', 's3/objects/planets/kessel/t_planetfrontendkessel_01',
    ]);
    expect(planFor(SKINS.fondor, have)).toEqual({ fetch: [{ kind: 'color', name: `${dir}/t_planet_fondor_03_cs` }, { kind: 'normal', name: `${dir}/t_planet_fondor_03_ni` }], missing: [] });
    for (const id of ['pillio', 'sullust', 'vardos']) {
      const { fetch, missing } = planFor(SKINS[id], have);
      expect(fetch.map((f) => f.kind), id).toEqual(['color', 'clouds']);
      // (the world before Operation Cinder, never the burnt one)
      for (const f of fetch) expect(f.name, id).not.toMatch(/dead/);
      expect(missing, id).toEqual([]);
      expect(SKINS[id].cloudsIn, id).toBe('rgb');
    }
    for (const id of ['felucia', 'kessel']) {
      expect(SKINS[id]).toBeUndefined();
      expect(have.has(PICTURES[id]), id).toBe(true);
    }
    // (none of the six is left unplaced; Fondor’s moon still is)
    for (const id of ['felucia', 'kessel', 'sullust', 'pillio', 'vardos', 'fondor']) expect(UNPLACED, id).not.toContain(id);
    expect(UNPLACED).toContain('fondor’s moon');
  });

  it('never takes a sequel world’s map', () => {
    expect(planFor({ color: ['*/t_planet_*_cs'] }, new Set(['levels/space/sb_jakku_01/planet/t_planet_jakku_cs'])).fetch).toEqual([]);
  });
});

describe('the bucket’s list', () => {
  it('reads textures.jsonl’s planet names, lowercased, without the folder or the extension', () => {
    const text = ['{"name":"Levels/Space/SB_Endor_01/Planet/T_Planet_Endor_01_CS"}', '{"path":"web/textures/s2/objects/planets/hoth/t_planetfrontenhoth_01_ca.png"}', '{"name":"Characters/Hero/Luke/T_Luke_CS"}', 'not json', ''].join('\n');
    expect([...planetNames(text)]).toEqual(['levels/space/sb_endor_01/planet/t_planet_endor_01_cs', 's2/objects/planets/hoth/t_planetfrontenhoth_01_ca']);
    expect(nameOf('web/textures/a/b.ktx2')).toBe('a/b');
  });
});

describe('convertSkin', () => {
  it('writes the fixture’s colour and normal at every tier, and its manifest entry', async () => {
    const out = await mkdtemp(join(tmpdir(), 'planets-'));
    try {
      const images = { color: await readFile(join(FIXTURE, 't_planet_endor_01_cs.png')), normal: await readFile(join(FIXTURE, 't_planet_endor_01_n.png')) };
      const encoded = [];
      const encodeKtx2 = async (png, opts) => (encoded.push(opts), stand());
      const { entry, files } = await convertSkin({ id: 'endor', skin: { tiles: 1.5 }, images, outDir: out, encodeKtx2 });
      expect(entry).toEqual({ color: 'textures/galaxy/planets/endor/color', normal: 'textures/galaxy/planets/endor/normal', tiles: 1.5 });
      expect(files.map((f) => f.path)).toEqual(['color-mid.webp', 'color-high.webp', 'color-ultra.ktx2', 'normal-mid.webp', 'normal-high.webp', 'normal-ultra.ktx2'].map((f) => `textures/galaxy/planets/endor/${f}`));
      expect(encoded).toEqual([
        { role: 'color', flipY: true },
        { role: 'normal', flipY: true },
      ]);
      // (never larger than the game drew it; the colour's alpha, smoothness, dropped without seas)
      const color = await sharp(join(out, 'endor', 'color-high.webp')).metadata();
      expect([color.width, color.height, color.hasAlpha]).toEqual([64, 32, false]);
      // (the normal's z rebuilt: a flat-ish normal points out, not at the 200 the fixture's blue held)
      const { data } = await sharp(join(out, 'endor', 'normal-mid.webp')).raw().toBuffer({ resolveWithObject: true });
      expect(data[2]).toBeGreaterThan(230);
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });

  it('keeps the colour’s alpha where it marks the seas', async () => {
    const out = await mkdtemp(join(tmpdir(), 'planets-'));
    try {
      const images = { color: await readFile(join(FIXTURE, 't_planet_endor_01_cs.png')) };
      const { entry } = await convertSkin({ id: 'naboo', skin: { seas: 0.38 }, images, outDir: out, encodeKtx2: stand });
      expect(entry.seas).toBe(0.38);
      expect((await sharp(join(out, 'naboo', 'color-mid.webp')).metadata()).hasAlpha).toBe(true);
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });

  it('writes rings alone at one size, and no entry with neither colour nor rings', async () => {
    const out = await mkdtemp(join(tmpdir(), 'planets-'));
    try {
      const strip = await sharp({ create: { width: 64, height: 32, channels: 4, background: { r: 120, g: 90, b: 60, alpha: 0.3 } } }).png().toBuffer();
      const { entry, files } = await convertSkin({ id: 'geonosis', skin: { ringsAt: [1.35, 2.3] }, images: { rings: strip }, outDir: out, encodeKtx2: stand });
      expect(entry).toEqual({ rings: 'textures/galaxy/planets/geonosis/rings', ringsAt: [1.35, 2.3] });
      expect(files.map((f) => f.path)).toEqual(['textures/galaxy/planets/geonosis/rings-mid.webp']);
      expect((await convertSkin({ id: 'x', images: {}, outDir: out, encodeKtx2: stand })).entry).toBeNull();
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });

  it('reads a cloud map’s coverage from its alpha, or from its brightness when told the alpha is solid', async () => {
    // (a 2 × 1 map: left white with alpha 0, right black with alpha 255)
    const buf = Buffer.from([255, 255, 255, 0, 0, 0, 0, 255]);
    const png = await sharp(buf, { raw: { width: 2, height: 1, channels: 4 } }).png().toBuffer();
    const alpha = await sharp(await coveragePng(png)).toColourspace('b-w').raw().toBuffer();
    expect([...alpha]).toEqual([0, 255]);
    const rgb = await sharp(await coveragePng(png, 'rgb')).toColourspace('b-w').raw().toBuffer();
    expect([...rgb]).toEqual([255, 0]);
  });

  it('reads an atmosphere’s picture as its colour where it has air', async () => {
    const buf = Buffer.alloc(4 * 4 * 4);
    for (let i = 0; i < 16; i++) buf.set(i < 8 ? [0, 0, 0, 0] : [100, 150, 250, 255], i * 4);
    expect(await meanColor(await sharp(buf, { raw: { width: 4, height: 4, channels: 4 } }).png().toBuffer())).toBe('#6496fa');
  });

  it('writes the manifest with its keys sorted', () => {
    expect(skinsJson({ naboo: { color: 'c', atmo: '#fff' }, endor: { color: 'c' } })).toBe('{\n  "endor": {\n    "color": "c"\n  },\n  "naboo": {\n    "atmo": "#fff",\n    "color": "c"\n  }\n}\n');
  });
});
