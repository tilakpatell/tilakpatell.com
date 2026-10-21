// Lane W's `atlases` job (the picture-everywhere design, §7; the plan's
// task 3): the levels' baked Enlighten light, never uploaded, sent to the
// bucket bf2017-assets for lane Q3 (the surfaces design's baked light).
//
// Per lit level the export has a StaticEnlightenData set: the irradiance
// atlas (`*_staticIrradianceTexture`, BC6U or R9G9B9E5: HDR), three
// directional maps (`*_staticDirectionTextureR/G/B`, BC7) and the sky
// visibility (`*_staticSkyVisibilityData`, BC7); 200 sets in the export's
// index. The ledger has every one `not-uploaded` (never queued:
// docs/superpowers/HANDOFF-bf2017-surfaces.md); its owners table gives
// them to surfaces-Q3 once they land.
//
//   - the directional and sky maps: the export's encoder (UASTC, linear,
//     tool/ktx2_encode.py, at most 4,096) and its uploader, as web/<path>.ktx2
//   - the irradiance: HDR, as the panoramas are (texconv's RGBA16F re-wrapped
//     as KTX2, scripts/lib/ktx2-hdr.mjs), at web/hdr/<path>.<width>.ktx2,
//     when the exporter has written its .dds; and the encoder's UASTC of the
//     8-bit PNG beside it either way (clamped to 1: said in the report)
//   - the coverage ledger made again from the uploader's record
//
//   node scripts/desktop/bf2017-atlases.mjs [--dry] [--only hoth] [--limit N] [--no-pr]
//
// What lane Q3 reads of them: docs/superpowers/evidence/bf2017-picture/w/atlases/FORMAT.md.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ddsToKtx2, zstdReady } from '../lib/ktx2-hdr.mjs';
import { isSequel } from '../lib/bf2017-manifest.mjs';
import { encodeAndUpload, jsonLines, ledgerAgain, runCli, step, textureIndexFile, uploadArgs } from './bf2017-desk.mjs';
import { bucketPath, hdrDirs, hdrSource, peakOf, texconvArgs } from './bf2017-panoramas.mjs';

export const MAX = 4096;
const KIND = /_static(IrradianceTexture|DirectionTexture[RGB]|SkyVisibilityData)$/i;

// What a texture is of a set: irradiance, direction (R, G, B) or sky. → kind | null
export function atlasKind(name) {
  const m = String(name).match(KIND);
  if (!m) return null;
  return /^irr/i.test(m[1]) ? 'irradiance' : /^dir/i.test(m[1]) ? `direction${m[1].slice(-1).toUpperCase()}` : 'sky';
}

// The set a texture belongs to (its name less the suffix).
export const setOf = (name) => String(name).replace(KIND, '');

// Every atlas in the index, the sequel era's left out: [{ name, set, kind, file, size, format }]
export function atlases(index) {
  return index
    .filter((t) => atlasKind(t.name) && !isSequel(t.name))
    .map((t) => ({ name: t.name, set: setOf(t.name), kind: atlasKind(t.name), file: t.file, size: `${t.width}×${t.height}`, width: t.width, height: t.height, format: t.format, srgb: t.srgb }))
    .sort((a, b) => (a.name < b.name ? -1 : 1));
}

// A size that fits `max` on its longer side, each side a multiple of 4.
export function fitSize(width, height, max = MAX) {
  const s = Math.min(1, max / Math.max(width, height));
  const four = (n) => Math.max(4, Math.round((n * s) / 4) * 4);
  return { width: s === 1 ? width : four(width), height: s === 1 ? height : four(height) };
}

export const spec = {
  job: 'atlases',
  title: 'The Enlighten atlases in the bucket',
  vram: 2048,
  columns: ['name', 'kind', 'size', 'format'],
  needs: (d) => [
    { name: 'the export', file: d.root, fix: 'set BF2_EXPORT to the export folder (BF2_Extract)' },
    { name: "the export's texture index", file: join(d.web, 'textures.jsonl'), fix: 'the export writes web/textures.jsonl' },
    { name: 'python', cmd: d.python, fix: 'Python 3 on PATH (or set PYTHON)' },
    { name: "the export's encoder", file: join(d.tool, 'ktx2_encode.py'), fix: 'the export keeps tool/ktx2_encode.py' },
    { name: 'texconv (DirectXTex)', cmd: d.texconv, fix: 'winget install Microsoft.DirectXTex (or put texconv.exe on PATH, or set TEXCONV)' },
    { name: "the bucket's keys", keys: true, fix: "R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (R2's S3 keys) in the runner's .env (~\\actions-runner\\.env), then restart the runner" },
  ],
  async plan({ root, d }) {
    const file = textureIndexFile(d, root);
    if (!file) return { items: [], notes: ['no texture index here (web/textures.jsonl): the list is made on the desktop'] };
    const items = atlases(jsonLines(file));
    const sets = new Set(items.map((i) => i.set)).size;
    const mb = jsonLines(file)
      .filter((t) => atlasKind(t.name) && !isSequel(t.name))
      .reduce((n, t) => n + t.bytes, 0);
    return { items, notes: [`${items.length} maps in ${sets} sets (irradiance ${items.filter((i) => i.kind === 'irradiance').length}), ${(mb / 1e9).toFixed(1)} GB of PNG in the export, from ${file}`] };
  },
  async run(items, { root, d, env, log }) {
    // the HDR irradiance first, where the exporter wrote the BC6U as a .dds
    const tmp = join(d.webOpt, '_hdrtmp');
    const hdr = [];
    for (const item of items.filter((i) => i.kind === 'irradiance')) {
      const src = hdrSource(item.file, hdrDirs(d, env));
      if (!src) continue;
      const size = fitSize(item.width, item.height);
      rmSync(tmp, { recursive: true, force: true });
      mkdirSync(tmp, { recursive: true });
      step(d.texconv, texconvArgs(src, tmp, size), { log });
      const dds = readFileSync(join(tmp, `${basename(src).replace(/\.[a-z0-9]+$/i, '')}.dds`));
      const rel = bucketPath(item.file, size.width);
      mkdirSync(dirname(join(d.webOpt, rel)), { recursive: true });
      writeFileSync(join(d.webOpt, rel), ddsToKtx2(dds, { zstd: zstdReady }));
      hdr.push({ name: item.name, rel, ...size, peak: peakOf(dds, dds.readUInt32LE(84) === 0x30315844 ? 148 : 128) });
    }
    rmSync(tmp, { recursive: true, force: true });
    if (hdr.length) {
      const up = join(d.webOpt, '_atlases_hdr_upload.txt');
      writeFileSync(up, `${hdr.map((h) => h.rel).join('\n')}\n`);
      step(process.execPath, uploadArgs(d, up), { env, log });
    }
    // then every map through the export's own encoder and uploader
    const { made, failed } = encodeAndUpload(items, { d, env, log, list: 'atlases', max: MAX });
    const check = ledgerAgain(root, d, { env, log });
    const dir = join(root, 'docs/superpowers/evidence/bf2017-picture/w/atlases');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'made.json'),
      `${JSON.stringify({ _source: "scripts/desktop/bf2017-atlases.mjs on the owner's desktop: the export's encoder and uploader; hdr is texconv's RGBA16F, peak its brightest texel", at: new Date().toISOString(), uploaded: made.map((t) => t.name), failed: failed.map((t) => t.name), hdr }, null, 1)}\n`,
    );
    const report = [
      `Encoded and uploaded ${made.length} of ${items.length}${failed.length ? `; **${failed.length} failed** (made.json lists them; the encoder's log says why)` : ''}.`,
      hdr.length ? `${hdr.length} irradiance atlases HDR (RGBA16F) at \`web/hdr/…\`; their peaks run to ${Math.max(...hdr.map((h) => h.peak))}.` : 'No irradiance .dds found: the irradiance went as UASTC from the 8-bit PNG, clamped to 1. Export the BC6U as .dds under `<export>\\raw\\<the same path>` and run the job again for the HDR copies.',
      check,
    ].join('\n\n');
    return { files: ['docs/superpowers/evidence/bf2017-coverage'], report, failed: failed.length > 0 && !made.length };
  },
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await runCli(spec);
