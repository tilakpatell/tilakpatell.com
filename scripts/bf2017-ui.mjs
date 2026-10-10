// The Battlefront II (2017) drop's front end, cut for the site: the films,
// the icons, the open fonts, the strings and the UI bitmaps
// (scripts/lib/bf2017-ui.mjs says which and how; the design is §3 lane M of
// docs/superpowers/specs/2026-10-10-bf2017-every-asset-design.md).
//
//   node scripts/bf2017-ui.mjs films|icons|fonts|strings|bitmaps|all [--dry] [--only '<slug glob>']
//
//   films    each film the site plays, as the drop's WebM untouched, to
//            public/films/bf2017/<slug>.webm (published by
//            scripts/assets-publish.mjs, then out of git), with its poster
//            frame (<slug>.webp, 640 wide, the frame at one second) and a
//            campaign film's subtitles (<slug>.vtt, its English lines)
//            beside it, committed; src/data/bf2017/films.json the table. The
//            one exception is MT_Volcano2, a VP6 texture no browser
//            decodes: it is cut once to VP9 (the same frames, size and rate)
//   icons    one sprite a family, public/ui/bf2017/<family>.svg, and
//            src/data/bf2017/icons.json { [name]: [family, symbol id] }
//   fonts    the open-licence faces to public/fonts/bf2017/ as the drop has
//            them, each licence's text beside them; never the commercial ones
//   strings  src/data/bf2017/strings.json: lane 0's rows and the families
//            the galaxy reads; public/ui/bf2017/strings/<family>.json the
//            whole English table, filed by family
//   bitmaps  public/ui/bf2017/bitmaps/<slug>.webp (portraits, mode and side
//            tiles, the HUD's art) and src/data/bf2017/bitmaps.json
//
// What it reads comes through scripts/bf2017-fetch.mjs into
// lab/assets/bf2017/web/ (run here when missing). SUPABASE_URL and SUPA_KEY
// (or BF2017_KEY) from the environment for that fetch, never printed.

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { globMatch } from './lib/bf2017-paths.mjs';
import { stringHash } from './lib/bf2017-ebx.mjs';
import { SITE_FAMILIES, bitmapWanted, excludedFilms, filmRows, fontAllowed, fontLicence, iconFamily, iconName, isSequelUi, slugOf, spriteOf, stringTables, vttOf } from './lib/bf2017-ui.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const LAB = join(ROOT, 'lab', 'assets', 'bf2017');
const WEB = join(LAB, 'web');
const PUBLIC = join(ROOT, 'public');
const DATA = join(ROOT, 'src', 'data', 'bf2017');
const FROM = { export: 'build 489592', date: '2026-10-10' };
const GAME = 'https://www.ea.com/games/starwars/battlefront/star-wars-battlefront-2';
const LICENCE = 'From EA DICE’s Star Wars Battlefront II (2017), used with permission on this non-commercial fan project; Star Wars and everything in it belong to Lucasfilm.';

const mb = (n) => `${(n / 1e6).toFixed(1)} MB`;
const json = (v) => `${JSON.stringify(v, null, 2)}\n`;
const write = (file, text) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
};
const walk = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)])) : []);

// a file of the drop on disk: the manifests and the bucket's folders can
// differ in case (the export ran on Windows), so matched ignoring it
let lower = null;
export function onDisk(rel) {
  if (existsSync(join(WEB, rel))) return join(WEB, rel);
  lower ??= new Map(walk(WEB).map((f) => [f.slice(WEB.length + 1).toLowerCase(), f]));
  return lower.get(rel.toLowerCase()) ?? null;
}

// the fetch's own commands, for what isn't on disk yet
function fetchWeb(...globs) {
  execFileSync('node', ['scripts/bf2017-fetch.mjs', 'web', ...globs], { cwd: ROOT, stdio: 'inherit', env: { NODE_USE_ENV_PROXY: '1', ...process.env } });
}
function fetchRaw(path) {
  if (onDisk(path)) return;
  execFileSync('node', ['scripts/bf2017-fetch.mjs', '--raw', path], { cwd: ROOT, stdio: 'inherit', env: { NODE_USE_ENV_PROXY: '1', ...process.env } });
}
const readJsonl = (path) => {
  fetchRaw(path);
  return readFileSync(join(WEB, path), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
};
const english = () => {
  fetchRaw('strings/English.json');
  fetchRaw('strings/keys.json');
  return { strings: JSON.parse(readFileSync(join(WEB, 'strings/English.json'), 'utf8')), keys: JSON.parse(readFileSync(join(WEB, 'strings/keys.json'), 'utf8')) };
};

// ---- films ----

function poster(from, to) {
  // (a film shorter than a second gives its first frame)
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '1', '-i', from, '-frames:v', '1', '-vf', 'scale=640:-2', '-c:v', 'libwebp', '-quality', '80', to]);
  if (!existsSync(to) || !statSync(to).size) execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', from, '-frames:v', '1', '-vf', 'scale=640:-2', '-c:v', 'libwebp', '-quality', '80', to]);
}

// MT_Volcano2: VP6 in Matroska, which no browser plays; the same 1024² frames
// at the same rate as VP9, silent (the one film re-encoded, and why)
function transcode(from, to) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', from, '-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', to]);
}

export async function films({ dry = false, only = null, say = console.log } = {}) {
  const misc = readJsonl('misc.jsonl');
  let rows = filmRows(misc);
  const match = only ? globMatch(only) : null;
  const work = match ? rows.filter((r) => match(r.slug)) : rows;
  say(`films: ${rows.length} the site plays (${mb(rows.reduce((s, r) => s + r.bytes, 0))}), ${excludedFilms(misc).length} not; ${work.length} to cut`);
  if (dry) {
    for (const r of work) say(`  ${r.kind.padEnd(8)} ${r.slug}  ${mb(r.bytes)}${r.system ? `  ${r.system}` : ''}${r.level ? `  ${r.level}` : ''}`);
    return rows;
  }
  const { strings } = english();
  const say1 = (key) => strings.strings[stringHash(key)];
  for (const r of work) {
    if (!onDisk(r.src)) fetchRaw(r.src);
    const raw = onDisk(r.src);
    const out = join(PUBLIC, r.path);
    mkdirSync(dirname(out), { recursive: true });
    if (r.transcode) {
      if (!existsSync(out)) transcode(raw, out);
    } else if (!existsSync(out) || statSync(out).size !== statSync(raw).size) copyFileSync(raw, out);
    const pic = join(PUBLIC, r.poster);
    if (!existsSync(pic)) poster(out, pic);
    if (r.subtitles) {
      fetchRaw(r.subtitles);
      const ssa = onDisk(r.subtitles);
      if (ssa) {
        r.captions = r.path.replace(/\.webm$/, '.vtt');
        write(join(PUBLIC, r.captions), vttOf(readFileSync(ssa, 'utf8').replace(/^\uFEFF/, ''), say1));
      }
    }
    say(`  ${r.slug}  ${mb(statSync(out).size)}`);
  }
  // (the table names only what is published, so the site never asks for a
  // film that isn't there: run this again after scripts/assets-publish.mjs)
  const published = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'galaxyAssets.json'), 'utf8'));
  const waiting = rows.filter((r) => !published[r.path]).map((r) => r.slug);
  rows = rows
    .filter((r) => published[r.path])
    .map((r) => {
      const captions = r.path.replace(/\.webm$/, '.vtt');
      // (the bucket's path and the subtitles' script are the cut's, not the site's)
      const keep = { ...r };
      for (const k of ['src', 'subtitles', 'transcode']) delete keep[k];
      keep.bytes = published[r.path].bytes;
      keep._source = r.name;
      return existsSync(join(PUBLIC, captions)) ? { ...keep, captions } : keep;
    });
  if (waiting.length) say(`  ${waiting.length} cut and not published yet (node scripts/assets-publish.mjs --only 'films/**', then this again)`);
  write(join(DATA, 'films.json'), json({ _from: FROM, rows, waiting, excluded: excludedFilms(misc) }));
  credit('bf2017-films', {
    id: 'web/movies (planet loading films, campaign cinematics, menu tiles, tutorials, the logo, MT_Volcano2)',
    name: 'Star Wars Battlefront II (2017): its films',
    use: 'The planets’ loading films on the galaxy’s cards and landing veils, the campaign’s cinematics as the briefings of the worlds they are set on, the menu tiles, tutorials and logo for the game’s world, and Mustafar’s lava (MT_Volcano2): the drop’s WebM as it is (MT_Volcano2 cut from VP6 to VP9), published to site-assets by scripts/assets-publish.mjs, the posters and captions in public/films/bf2017/, by scripts/bf2017-ui.mjs',
  });
  return rows;
}

// ---- icons ----

export function icons({ dry = false, say = console.log } = {}) {
  const misc = readJsonl('misc.jsonl');
  const svgs = misc.filter((r) => r.cat === 'svg');
  if (svgs.some((r) => !onDisk(r.file))) {
    fetchWeb('svg/**');
    lower = null;
  }
  const keep = svgs.filter((r) => !isSequelUi(r.name));
  const seen = new Set();
  const list = keep.map((r) => {
    let name = iconName(r.file);
    // (two files of the same folder and name: the second by its longer path)
    if (seen.has(name)) name = r.file.replace(/^svg\//, '').replace(/\.svg$/i, '').split('/').slice(-3).join('/');
    seen.add(name);
    return { name, family: iconFamily(r.file), text: readFileSync(onDisk(r.file), 'utf8') };
  });
  const { sprites, table } = spriteOf(list);
  say(`icons: ${svgs.length} in the drop, ${svgs.length - keep.length} of the sequel era left out, ${Object.keys(table).length} in ${Object.keys(sprites).length} sprites`);
  if (dry) return table;
  const dir = join(PUBLIC, 'ui', 'bf2017');
  for (const f of walk(dir).filter((f) => f.endsWith('.svg') && dirname(f) === dir)) rmSync(f);
  for (const [fam, text] of Object.entries(sprites)) write(join(dir, `${fam}.svg`), text);
  // (the drop's names, for the coverage ledger)
  const sources = keep.map((r) => r.name).sort();
  write(join(DATA, 'icons.json'), json({ _from: FROM, rows: Object.fromEntries(Object.entries(table).sort(([a], [b]) => (a < b ? -1 : 1))), _source: sources }));
  return table;
}

// ---- fonts ----

const OFL = () => {
  const md = readFileSync(join(PUBLIC, 'fonts', 'aurebesh', 'OFL.md'), 'utf8');
  return md.slice(md.indexOf('Version 1.1 - 26 February 2007')).replace(/^#+\s*/gm, '');
};
const APACHE = () => {
  const t = readFileSync(join(ROOT, 'node_modules', 'playwright-core', 'LICENSE'), 'utf8');
  return t.slice(t.indexOf('Apache License'), t.indexOf('END OF TERMS AND CONDITIONS') + 'END OF TERMS AND CONDITIONS'.length);
};

export function fonts({ dry = false, say = console.log } = {}) {
  const misc = readJsonl('misc.jsonl');
  const all = misc.filter((r) => r.cat === 'fonts');
  const ok = all.filter((r) => fontAllowed(r.file));
  say(`fonts: ${all.length} in the drop; ${ok.length} open-licence ship, ${all.length - ok.length} stay out (licence)`);
  for (const r of all.filter((x) => !fontAllowed(x.file))) say(`  out: ${r.file.split('/').pop()}  (${r.copyright})`);
  if (dry) return ok;
  for (const r of ok) fetchRaw(r.file);
  const dir = join(PUBLIC, 'fonts', 'bf2017');
  mkdirSync(dir, { recursive: true });
  // (nothing but the allowed faces and their licences is ever here)
  for (const f of readdirSync(dir)) if (/\.(ttf|otf|woff2?)$/i.test(f) && !fontAllowed(f)) rmSync(join(dir, f));
  const ofl = [];
  for (const r of ok) {
    const file = r.file.split('/').pop();
    copyFileSync(onDisk(r.file), join(dir, file));
    if (fontLicence(file).licence === 'OFL-1.1' && !ofl.includes(r.copyright)) ofl.push(r.copyright);
  }
  write(join(dir, 'OFL.txt'), `${ofl.join('\n')}\n\nThis Font Software is licensed under the SIL Open Font License, Version 1.1.\nThis license is copied below, and is also available with a FAQ at: https://openfontlicense.org\n\n${OFL()}`);
  write(join(dir, 'LICENSE-Apache-2.0.txt'), `Roboto: Copyright 2011 Google Inc. All Rights Reserved.\nLicensed under the Apache License, Version 2.0.\n\n${APACHE()}\n`);
  write(
    join(DATA, 'fonts.json'),
    json({
      _from: FROM,
      rows: all.map((r) => {
        const l = fontLicence(r.file);
        return { file: r.file.split('/').pop(), face: `${r.nameFamily ?? r.family} ${r.nameStyle ?? ''}`.trim(), copyright: r.copyright, ships: Boolean(l), licence: l?.licence ?? null, ...(l ? { _source: r.name } : {}) };
      }),
    }),
  );
  const lines = ok.map((r) => {
    const l = fontLicence(r.file);
    return `| \`${r.file.split('/').pop()}\` | ${r.nameFamily ?? r.family} ${r.nameStyle ?? ''} | ${l.by} | ${l.licence} | \`${l.file}\` |`;
  });
  write(
    join(dir, 'README.md'),
    `# The 2017 game’s open fonts\n\nThe faces of Star Wars Battlefront II (2017)’s drop that carry an open licence, as the drop has them (scripts/bf2017-ui.mjs fonts). Each file’s own name table states its licence; the licence’s text is beside it. \`src/lib/bf2017/fonts.css\` loads them.\n\n| file | face | by | licence | text |\n| --- | --- | --- | --- | --- |\n${lines.join('\n')}\n\nNot here, and never copied into \`public/\`: Linotype Univers (\`LinotypeUnivers-*\`, \`LT_UniversCond820\`, \`UniversLT-65Bold\`: Linotype and Monotype’s), DFPHSGothic (DynaComware’s), AR Yenti (Arphic’s), News Gothic (Bitstream’s), and RaxusPrimeNumericalMonospace and the game’s Aurebesh (no licence in either file; the Aurebesh is marked restricted, fsType 1). Those are licensed to EA, not to this site. The HUD draws in Cuprum and Roboto in their place, and the site’s own Aurebesh (\`public/fonts/aurebesh/\`, OFL) stands for the game’s.\n`,
  );
  return ok;
}

// ---- strings ----

export function strings({ dry = false, say = console.log } = {}) {
  const { strings: en, keys } = english();
  const { named, families } = stringTables(en, keys);
  const file = join(DATA, 'strings.json');
  const had = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { rows: {} };
  const rows = { ...had.rows };
  for (const [k, v] of Object.entries(named)) if (SITE_FAMILIES.includes(k.match(/^ID_([A-Z0-9]+)/)?.[1])) rows[k] = v;
  const sorted = Object.fromEntries(Object.keys(rows).sort().map((k) => [k, rows[k]]));
  say(`strings: ${Object.keys(en.strings).length} in English, ${Object.keys(named).length} named; ${Object.keys(sorted).length} the galaxy reads (lane 0’s ${Object.keys(had.rows).length} kept); ${Object.keys(families).length} family files`);
  if (dry) return sorted;
  write(file, json({ _from: { ...had._from, ...FROM }, rows: sorted, _source: ['Localization/WSLocalization_English', 'strings/keys.json'] }));
  const dir = join(PUBLIC, 'ui', 'bf2017', 'strings');
  for (const [fam, table] of Object.entries(families)) write(join(dir, `${fam.toLowerCase()}.json`), `${JSON.stringify(Object.fromEntries(Object.keys(table).sort().map((k) => [k, table[k]])))}\n`);
  write(join(dir, 'index.json'), json(Object.fromEntries(Object.entries(families).map(([f, t]) => [f, Object.keys(t).length]).sort())));
  return sorted;
}

// ---- bitmaps ----

export function bitmaps({ dry = false, say = console.log } = {}) {
  const tex = readJsonl('textures.jsonl').filter((r) => bitmapWanted(r.name));
  say(`bitmaps: ${tex.length} the site’s parts name`);
  if (dry) return tex;
  const want = tex.filter((r) => !onDisk(r.file));
  if (want.length) fetchWeb(...[...new Set(want.map((r) => `${dirname(r.file)}/*`))]);
  const table = {};
  lower = null;
  const missing = [];
  for (const r of tex) {
    const from = onDisk(r.file);
    if (!from) {
      missing.push(r.file);
      continue;
    }
    const path = `ui/bf2017/bitmaps/${slugOf(r.name.split('/').slice(-2).join('-'))}.webp`;
    mkdirSync(dirname(join(PUBLIC, path)), { recursive: true });
    if (!existsSync(join(PUBLIC, path))) execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', from, '-c:v', 'libwebp', '-quality', '85', join(PUBLIC, path)]);
    table[r.name] = { path, size: [r.width, r.height] };
  }
  // (on 2026-10-10 the bucket held none of UI/Bitmaps: the desktop's
  // never-queued textures; this cuts them the day they land)
  if (missing.length) say(`  ${missing.length} not in the bucket yet (${missing[0]}…)`);
  write(join(DATA, 'bitmaps.json'), json({ _from: FROM, rows: Object.fromEntries(Object.keys(table).sort().map((k) => [k, table[k]])), missing: missing.length }));
  credit('bf2017-ui', {
    id: 'web/svg, web/fonts (the open-licence faces), web/strings, web/textures/ui/bitmaps',
    name: 'Star Wars Battlefront II (2017): its icons, strings and UI art',
    use: 'The game’s icons as sprites (public/ui/bf2017/*.svg), its English strings (src/data/bf2017/strings.json and public/ui/bf2017/strings/), its portraits and tiles (public/ui/bf2017/bitmaps/), by scripts/bf2017-ui.mjs; its open-licence fonts are their makers’ (public/fonts/bf2017/README.md)',
  });
  return table;
}

function credit(key, { id, name, use }) {
  const file = join(PUBLIC, 'games', 'credits.json');
  const all = JSON.parse(readFileSync(file, 'utf8'));
  all[key] = { source: GAME, id, name, authors: ['EA DICE'], license: LICENCE, use };
  writeFileSync(file, json(all));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [what = 'all'] = args._;
  const dry = Boolean(args.dry);
  const only = typeof args.only === 'string' ? args.only : null;
  const jobs = { films: () => films({ dry, only }), icons: () => icons({ dry }), fonts: () => fonts({ dry }), strings: () => strings({ dry }), bitmaps: () => bitmaps({ dry }) };
  if (what !== 'all' && !jobs[what]) {
    console.error('usage: node scripts/bf2017-ui.mjs films|icons|fonts|strings|bitmaps|all [--dry] [--only <slug glob>]');
    return 2;
  }
  for (const [k, job] of Object.entries(jobs)) if (what === 'all' || what === k) await job();
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error(e.message);
      process.exit(1);
    },
  );
}
