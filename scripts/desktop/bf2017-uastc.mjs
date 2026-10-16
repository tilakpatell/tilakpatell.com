// Lane W's `uastc` job (the picture-everywhere design, §7; the plan's task
// 5; the surfaces design's Q5): the level packs' colour maps at ultra as
// UASTC, where the site serves the export's ETC1S (about 40 dB) at every
// tier. On the owner's desktop, for each colour map a pack binds (its
// level.json `tex` rows named `_c` or `_cs`):
//
//   - the export's master (the BC7 decoded to web/<file>.png) encoded UASTC
//     quality 4, Zstandard, mipped, at 2,048 (or the master's own size):
//     toktx, to web_opt/ultra/<file>.<size>.uastc.ktx2
//   - measured: PSNR over RGB of the UASTC's top level and of the served
//     ETC1S's (web_opt/<file>.ktx2) against the master at each one's size
//     (scripts/lib/ktx2-psnr.mjs)
//   - kept when it earns its bytes: at least MIN_GAIN dB over the ETC1S
//     (Q5's rule: 3 dB; UASTC is about 3.4 times the bytes), as the pack's
//     tex/<slug>.<size>.uastc.ktx2, its tex row gaining `ultra: '<size>.uastc'`
//     (levelPack.js's tierTexture then asks for that file on ultra), published
//     to site-assets by hash and sent to the bucket under web/ultra/
//
//   node scripts/desktop/bf2017-uastc.mjs [--dry] [--only hoth] [--limit N] [--no-pr]
//
// UASTC_MIN_GAIN (dB) and UASTC_QUALITY (0 to 4) override the rule and the level.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeKtx2, masterRgba, psnr } from '../lib/ktx2-psnr.mjs';
import { jsonLines, keyState, runCli, step, textureIndexFile } from './bf2017-desk.mjs';

export const LEVELS = 'public/models/galaxy/bf2017/levels';
export const SIZE = 2048;
const MIN_GAIN = 3; // dB: the surfaces design's Q5, "if UASTC colour is over 3 dB better"

export const isColour = (slug) => /_cs?$/.test(slug) && !slug.includes('__');

// The packs in a checkout: [{ pack, tex }] (tex: level.json's rows by slug).
export function packs(root) {
  const dir = join(root, LEVELS);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((p) => existsSync(join(dir, p, 'level.json')))
    .sort()
    .map((pack) => ({ pack, tex: JSON.parse(readFileSync(join(dir, pack, 'level.json'), 'utf8')).tex ?? {} }));
}

// One item a colour map a pack binds, with its master in the export's index
// when the index has one by that name (the slug is the file's base name).
export function colourMaps(list, index) {
  const byBase = new Map();
  for (const t of index ?? []) {
    const base = basename(t.file).replace(/\.png$/i, '');
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push(t);
  }
  return list.flatMap(({ pack, tex }) =>
    Object.keys(tex)
      .filter(isColour)
      .map((slug) => {
        const hits = byBase.get(slug) ?? [];
        const t = hits[0];
        const size = t ? Math.min(SIZE, Math.max(t.width, t.height)) : SIZE;
        return { name: `${pack}/${slug}`, pack, slug, file: t?.file ?? null, size, master: t ? `${t.width}×${t.height}` : null, also: hits.length > 1 ? hits.length - 1 : 0 };
      }),
  );
}

// toktx's arguments: UASTC at `quality`, Zstandard 18, every mip, sRGB, at `size` on the longer side.
export const toktxArgs = (src, out, { width, height, quality = 4 }) => ['--t2', '--encode', 'uastc', '--uastc_quality', String(quality), '--zcmp', '18', '--genmipmap', '--assign_oetf', 'srgb', '--resize', `${width}x${height}`, out, src];

// The size to encode at: the master's, scaled so its longer side is at most SIZE.
export function sizeFor(w, h, max = SIZE) {
  const s = Math.min(1, max / Math.max(w, h));
  return { width: Math.round(w * s), height: Math.round(h * s) };
}

// The pack's tex row with its ultra file named. → a new row
export const withUltra = (row, size) => ({ ...row, ultra: `${size}.uastc` });

export const spec = {
  job: 'uastc',
  title: 'The ultra colour row in UASTC',
  vram: 2048,
  columns: ['name', 'master', 'size', 'file'],
  needs: (d) => [
    { name: 'the export', file: d.root, fix: 'set BF2_EXPORT to the export folder (BF2_Extract)' },
    { name: "the export's texture index", file: join(d.web, 'textures.jsonl'), fix: 'the export writes web/textures.jsonl' },
    { name: 'toktx (KTX-Software)', cmd: process.env.TOKTX ?? 'toktx', fix: 'winget install KhronosGroup.KTX-Software (toktx on PATH), or set TOKTX' },
    { name: 'python', cmd: d.python, fix: 'Python 3 on PATH (or set PYTHON)' },
    { name: "the export's uploader", file: join(d.tool, 'upload_supabase.py'), fix: 'the export keeps tool/upload_supabase.py' },
    { name: "the bucket's keys", keys: true, fix: "SUPABASE_URL and SUPABASE_SERVICE_KEY in the runner's .env (~\\actions-runner\\.env), then restart the runner" },
  ],
  async plan({ root, d }) {
    const file = textureIndexFile(d, root);
    const list = packs(root);
    const items = colourMaps(list, file ? jsonLines(file) : null);
    return {
      items,
      notes: [
        `${items.length} colour maps over ${list.length} packs (${LEVELS}/*/level.json \`tex\`, slugs ending _c or _cs)`,
        file ? `${items.filter((i) => i.file).length} with a master in the index; ${items.filter((i) => !i.file).length} without; ${items.filter((i) => i.also).length} with more than one file of that name (the first taken)` : 'no texture index here (web/textures.jsonl): the masters are found on the desktop',
        `kept when UASTC beats the served ETC1S by ${Number(process.env.UASTC_MIN_GAIN ?? MIN_GAIN)} dB or more`,
      ],
    };
  },
  async run(items, { root, d, env, log }) {
    const gain = Number(env.UASTC_MIN_GAIN ?? MIN_GAIN);
    const quality = Number(env.UASTC_QUALITY ?? 4);
    const toktx = env.TOKTX ?? 'toktx';
    const rows = [];
    for (const item of items) {
      if (!item.file) {
        rows.push({ name: item.name, skipped: 'no master in the index' });
        continue;
      }
      const master = join(d.web, item.file);
      const served = join(d.webOpt, item.file.replace(/\.png$/i, '.ktx2'));
      if (!existsSync(master) || !existsSync(served)) {
        rows.push({ name: item.name, skipped: !existsSync(master) ? `no master at ${master}` : `no served copy at ${served}` });
        continue;
      }
      const png = readFileSync(master);
      const { default: sharp } = await import('sharp');
      const meta = await sharp(png).metadata();
      const size = sizeFor(meta.width, meta.height);
      const rel = join('ultra', item.file.replace(/\.png$/i, `.${size.width}.uastc.ktx2`));
      mkdirSync(dirname(join(d.webOpt, rel)), { recursive: true });
      step(toktx, toktxArgs(master, join(d.webOpt, rel), { ...size, quality }), { log });
      const u = await decodeKtx2(readFileSync(join(d.webOpt, rel)));
      const e = await decodeKtx2(readFileSync(served));
      const pu = psnr(u.rgba, await masterRgba(png, u.width, u.height));
      const pe = psnr(e.rgba, await masterRgba(png, e.width, e.height));
      const row = { name: item.name, pack: item.pack, slug: item.slug, size: size.width, uastc: pu, etc1s: pe, gain: Number((pu - pe).toFixed(2)), bytes: readFileSync(join(d.webOpt, rel)).length, servedBytes: readFileSync(served).length, rel };
      row.kept = row.gain >= gain;
      rows.push(row);
      log(`${item.name}: UASTC ${pu} dB, ETC1S ${pe} dB, ${row.kept ? 'kept' : 'not kept'}`);
    }
    const kept = rows.filter((r) => r.kept);
    for (const pack of [...new Set(kept.map((r) => r.pack))]) {
      const file = join(root, LEVELS, pack, 'level.json');
      const level = JSON.parse(readFileSync(file, 'utf8'));
      for (const r of kept.filter((k) => k.pack === pack)) {
        mkdirSync(join(root, LEVELS, pack, 'tex'), { recursive: true });
        copyFileSync(join(d.webOpt, r.rel), join(root, LEVELS, pack, 'tex', `${r.slug}.${r.size}.uastc.ktx2`));
        level.tex[r.slug] = withUltra(level.tex[r.slug], r.size);
      }
      writeFileSync(file, JSON.stringify(level));
    }
    if (kept.length) {
      const up = join(d.webOpt, '_uastc_upload.txt');
      writeFileSync(up, `${kept.map((r) => r.rel.split('\\').join('/')).join('\n')}\n`);
      const project = keyState(env).project;
      step(d.python, [join(d.tool, 'upload_supabase.py'), '--root', d.webOpt, '--list', up, ...(project ? ['--project', project] : []), '--bucket', 'bf2017-assets', '--prefix', 'web/'], { env, log });
      step(process.execPath, ['scripts/assets-publish.mjs', '--only', `models/galaxy/bf2017/levels/*/tex/*.uastc.ktx2`], { cwd: root, env, log });
    }
    const dir = join(root, 'docs/superpowers/evidence/bf2017-picture/w/uastc');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'psnr.json'), `${JSON.stringify({ _source: `scripts/desktop/bf2017-uastc.mjs on the owner's desktop: PSNR over RGB of each top level against the export's master (web/<file>.png, the BC7 decoded) at the same size; UASTC quality ${quality} by toktx, ETC1S the bucket's served copy; kept at ${gain} dB or more`, at: new Date().toISOString(), rows }, null, 1)}\n`);
    const measured = rows.filter((r) => r.uastc != null);
    const mean = (k) => (measured.length ? (measured.reduce((n, r) => n + (Number.isFinite(r[k]) ? r[k] : 60), 0) / measured.length).toFixed(2) : '–');
    const report = [
      `Measured ${measured.length} of ${items.length}: UASTC ${mean('uastc')} dB, ETC1S ${mean('etc1s')} dB on average; kept ${kept.length} (gain ${gain} dB or more), ${(kept.reduce((n, r) => n + r.bytes, 0) / 1048576).toFixed(1)} MB against the ETC1S's ${(kept.reduce((n, r) => n + r.servedBytes, 0) / 1048576).toFixed(1)} MB.`,
      '',
      '| map | UASTC dB | ETC1S dB | gain | kept |',
      '| --- | --: | --: | --: | --- |',
      ...measured.slice(0, 60).map((r) => `| ${r.name} | ${r.uastc} | ${r.etc1s} | ${r.gain} | ${r.kept ? 'yes' : 'no'} |`),
    ].join('\n');
    return { files: [LEVELS, 'src/data/galaxyAssets.json', '.gitignore'], report, failed: !measured.length && items.length > 0 };
  },
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await runCli(spec);
