// Lane W's `panoramas` job (the picture-everywhere design, §7; the plan's
// task 2): the painted sky panoramas and their fog gradients the worlds'
// light records name (src/data/bf2017/light/<world>.json, each weather's
// `sky.panorama` and `sky.gradient`), re-encoded HDR on the owner's desktop.
//
// The bucket's copies are 2,048 × 512 UASTC from the export's 8-bit PNGs,
// clamped to 0…1, so the sun's disc and everything brighter than white are
// lost (src/lib/three/light/grade.js says so where it reads them). The game's
// own are 8,192 × 2,048 BC6U. This takes each from an HDR source the
// exporter wrote (a .dds of the BC6U, or .hdr or .exr, found by the
// texture's export path under BF2_HDR, <export>/raw, <export>/hdr or
// <export>/web), lets texconv decode, resize and mip it as
// R16G16B16A16_FLOAT, and re-wraps those bytes as a KTX2 (RGBA16F, Zstandard
// when this Node has it: scripts/lib/ktx2-hdr.mjs). A panorama at 4,096 ×
// 1,024 (ultra) and 2,048 × 512 (high), a gradient at its own size. Then:
//
//   - each goes to the bucket bf2017-assets as web/hdr/<its export path>.<width>.ktx2
//     (the export's tool/upload_supabase.py, the desktop's key)
//   - each is copied to public/textures/galaxy/bf2017/hdr/<name>.<width>.ktx2
//     and published to site-assets by hash (scripts/assets-publish.mjs)
//   - every world that names one runs scripts/bf2017-picture.mjs again, so
//     its <world>.picture.json gains the panorama's `hdr` row
//
//   node scripts/desktop/bf2017-panoramas.mjs [--dry] [--only hoth,yavin] [--limit N] [--no-pr]

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ddsToKtx2, fromHalf, zstdReady } from '../lib/ktx2-hdr.mjs';
import { jsonLines, keyState, runCli, step, textureIndexFile } from './bf2017-desk.mjs';

// The sizes made: a panorama's two tiers, a gradient at its own.
const PANORAMA_SIZES = [
  { tier: 'ultra', width: 4096, height: 1024 },
  { tier: 'high', width: 2048, height: 512 },
];
export const SITE_DIR = 'textures/galaxy/bf2017/hdr';
// (the front end's records name a black placeholder for their sky: nothing to paint)
const PLACEHOLDER = /^shaders\/t_default/i;

// Every panorama and gradient the records name, once each, with the worlds
// and weathers that use it. `records`: { world: <world>.json }.
export function skies(records) {
  const out = new Map();
  for (const [world, rec] of Object.entries(records)) {
    for (const [weather, w] of Object.entries(rec.weathers ?? {})) {
      for (const kind of ['panorama', 'gradient']) {
        const name = w.sky?.[kind];
        if (!name || PLACEHOLDER.test(name)) continue;
        const e = out.get(name) ?? { name, kind, slug: slugOf(name), worlds: [], uses: [] };
        if (!e.worlds.includes(world)) e.worlds.push(world);
        e.uses.push(`${world}/${weather}`);
        out.set(name, e);
      }
    }
  }
  return [...out.values()].sort((a, b) => (a.kind === b.kind ? (a.name < b.name ? -1 : 1) : a.kind === 'panorama' ? -1 : 1));
}

export const slugOf = (name) => basename(name).toLowerCase();

// The light records in a checkout: { world: record }.
export function lightRecords(root) {
  const dir = join(root, 'src/data/bf2017/light');
  return Object.fromEntries(
    readdirSync(dir)
      .filter((f) => /^[a-z_0-9]+\.json$/.test(f))
      .map((f) => [f.slice(0, -5), JSON.parse(readFileSync(join(dir, f), 'utf8'))]),
  );
}

// What each sky is in the export's index (its file, size and format), and
// the sizes to make of it.
export function withIndex(items, index) {
  const byName = new Map((index ?? []).map((t) => [t.name.toLowerCase(), t]));
  return items.map((i) => {
    const t = byName.get(i.name.toLowerCase());
    const native = t ? { width: t.width, height: t.height } : null;
    // (never above the source: Endor's foggy sky is 4,096 wide to begin with)
    const sizes = i.kind === 'panorama' ? PANORAMA_SIZES.filter((s) => !native || s.width <= native.width) : [{ tier: 'all', ...(native ?? { width: 512, height: 256 }) }];
    return { ...i, file: t?.file ?? null, format: t?.format ?? null, native: native ? `${native.width}×${native.height}` : null, sizes: sizes.map((s) => `${s.width}×${s.height}`).join(', '), out: sizes };
  });
}

// Where the HDR source of an export file is: the same path under one of the
// folders, as .dds, .hdr or .exr (best first). → path | null
export function hdrSource(file, dirs, exists = existsSync) {
  if (!file) return null;
  const stem = file.replace(/\.[a-z0-9]+$/i, '');
  for (const dir of dirs) for (const ext of ['.dds', '.hdr', '.exr']) if (exists(join(dir, `${stem}${ext}`))) return join(dir, `${stem}${ext}`);
  return null;
}

export const hdrDirs = (d, env = process.env) => [...(env.BF2_HDR ?? '').split(';').filter(Boolean), join(d.root, 'raw'), join(d.root, 'hdr'), d.web];

// texconv's arguments: decoded, resized, every mip, as half floats, to a DDS in `outDir`.
export const texconvArgs = (src, outDir, { width, height }) => ['-nologo', '-y', '-ft', 'dds', '-f', 'R16G16B16A16_FLOAT', '-w', String(width), '-h', String(height), '-m', '0', '-o', outDir, src];

// The bucket's path and the site's for one size of one sky.
export const bucketPath = (file, width) => posix.join('hdr', `${file.replace(/\.[a-z0-9]+$/i, '')}.${width}.ktx2`);
export const sitePath = (slug, width) => `${SITE_DIR}/${slug}.${width}.ktx2`;

// The brightest texel of a DDS's top level, as a float: the proof that what
// was made is HDR (a clamped copy peaks at 1).
export function peakOf(dds, offset) {
  const width = dds.readUInt32LE(16);
  const height = dds.readUInt32LE(12);
  let peak = 0;
  for (let i = 0; i < width * height; i++) {
    for (let c = 0; c < 3; c++) peak = Math.max(peak, fromHalf(dds.readUInt16LE(offset + i * 8 + c * 2)));
  }
  return Number(peak.toFixed(3));
}

export const spec = {
  job: 'panoramas',
  title: 'The HDR sky panoramas',
  vram: 2048,
  columns: ['name', 'kind', 'native', 'sizes', 'uses'],
  needs: (d) => [
    { name: 'the export', file: d.root, fix: 'set BF2_EXPORT to the export folder (BF2_Extract)' },
    { name: "the export's texture index", file: join(d.web, 'textures.jsonl'), fix: 'the export writes web/textures.jsonl' },
    { name: 'texconv (DirectXTex)', cmd: d.texconv, fix: 'winget install Microsoft.DirectXTex (or put texconv.exe on PATH, or set TEXCONV)' },
    { name: 'python', cmd: d.python, fix: 'Python 3 on PATH (or set PYTHON)' },
    { name: "the export's uploader", file: join(d.tool, 'upload_supabase.py'), fix: 'the export keeps tool/upload_supabase.py' },
    { name: "the bucket's keys", keys: true, fix: "SUPABASE_URL and SUPABASE_SERVICE_KEY in the runner's .env (~\\actions-runner\\.env), then restart the runner" },
  ],
  async plan({ root, d }) {
    const all = skies(lightRecords(root));
    const file = textureIndexFile(d, root);
    const items = withIndex(all, file ? jsonLines(file) : null).map((i) => ({ ...i, uses: i.uses.join(' ') }));
    const pan = items.filter((i) => i.kind === 'panorama').length;
    return {
      items,
      notes: [
        `${pan} panoramas and ${items.length - pan} fog gradients, named by ${Object.keys(lightRecords(root)).length} light records (src/data/bf2017/light/*.json; the design counted 8 panoramas before the records were all read)`,
        file ? `sizes and formats from ${file}` : 'no texture index here (web/textures.jsonl): sizes and formats come on the desktop',
        `Zstandard on this Node: ${zstdReady ? 'yes' : 'no (the KTX2 goes plain)'}`,
      ],
    };
  },
  async run(items, { root, d, env, log }) {
    const tmp = join(d.webOpt, '_hdrtmp');
    const dirs = hdrDirs(d, env);
    const made = [];
    const missing = [];
    for (const item of items) {
      const src = hdrSource(item.file, dirs);
      if (!src) {
        missing.push(item);
        log(`missing: ${item.name}: no .dds, .hdr or .exr of ${item.file ?? 'it (not in the index)'} under ${dirs.join(', ')}`);
        continue;
      }
      for (const size of item.out) {
        rmSync(tmp, { recursive: true, force: true });
        mkdirSync(tmp, { recursive: true });
        step(d.texconv, texconvArgs(src, tmp, size), { log });
        const dds = readFileSync(join(tmp, `${basename(src).replace(/\.[a-z0-9]+$/i, '')}.dds`));
        const ktx = ddsToKtx2(dds, { zstd: zstdReady });
        const peak = peakOf(dds, dds.readUInt32LE(84) === 0x30315844 ? 148 : 128);
        const toBucket = join(d.webOpt, bucketPath(item.file, size.width));
        mkdirSync(dirname(toBucket), { recursive: true });
        writeFileSync(toBucket, ktx);
        const site = sitePath(item.slug, size.width);
        mkdirSync(dirname(join(root, 'public', site)), { recursive: true });
        copyFileSync(toBucket, join(root, 'public', site));
        made.push({ name: item.name, kind: item.kind, width: size.width, height: size.height, bytes: ktx.length, peak, rel: bucketPath(item.file, size.width), site, worlds: item.worlds });
        log(`${item.name} ${size.width}×${size.height}: ${(ktx.length / 1048576).toFixed(1)} MB, peak ${peak}`);
      }
    }
    rmSync(tmp, { recursive: true, force: true });
    if (made.length) {
      const list = join(d.webOpt, '_hdr_upload.txt');
      writeFileSync(list, `${made.map((m) => m.rel).join('\n')}\n`);
      step(d.python, [join(d.tool, 'upload_supabase.py'), '--root', d.webOpt, '--list', list, ...(keyState(env).project ? ['--project', keyState(env).project] : []), '--bucket', 'bf2017-assets', '--prefix', 'web/'], { env, log });
      step(process.execPath, ['scripts/assets-publish.mjs', '--only', `${SITE_DIR}/*`], { cwd: root, env, log });
      for (const world of [...new Set(made.flatMap((m) => m.worlds))].sort()) step(process.execPath, ['scripts/bf2017-picture.mjs', world], { cwd: root, env, log });
    }
    mkdirSync(join(root, 'docs/superpowers/evidence/bf2017-picture/w/panoramas'), { recursive: true });
    const evidence = { _source: "scripts/desktop/bf2017-panoramas.mjs on the owner's desktop: texconv's RGBA16F re-wrapped as KTX2; bytes are the files', peak the brightest texel of the top level", at: new Date().toISOString(), made, missing: missing.map((m) => ({ name: m.name, file: m.file })) };
    writeFileSync(join(root, 'docs/superpowers/evidence/bf2017-picture/w/panoramas/made.json'), `${JSON.stringify(evidence, null, 1)}\n`);
    const report = [
      '| sky | size | MB | peak | site |',
      '| --- | --- | --: | --: | --- |',
      ...made.map((m) => `| ${m.name} | ${m.width}×${m.height} | ${(m.bytes / 1048576).toFixed(1)} | ${m.peak} | \`${m.site}\` |`),
      '',
      missing.length ? `**Missing an HDR source** (${missing.length}): ${missing.map((m) => `\`${m.file ?? m.name}\``).join(', ')}. Export each as its BC6U .dds (the exporter's raw texture dump) under \`<export>\\raw\\<the same path>\`, then run the job again.` : 'Every sky had an HDR source.',
    ].join('\n');
    return { files: ['public/textures/galaxy/bf2017', 'src/data/bf2017/light', 'src/data/galaxyAssets.json', '.gitignore'], report, failed: missing.length > 0 && !made.length };
  },
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await runCli(spec);
