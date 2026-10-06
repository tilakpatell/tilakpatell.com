// Reference pictures for the galaxy's worlds' models: film stills,
// production paintings and game renders of a place, from Wookieepedia
// (starwars.fandom.com, through its MediaWiki API), to judge a model
// against and to make one from (scripts/meshy-galaxy-buildings.mjs takes a
// picture as its input). The pictures are Lucasfilm's and the wiki's: they
// stay in lab/refs/ (git-ignored), never in the site; only their file names
// are kept, in the tasks file, so a model says what it was made from.
//
//   NODE_USE_ENV_PROXY=1 node scripts/galaxy-refs.mjs refs <kind> "<page>" ["<page>" …]
//     every picture on those pages (bigger than 500 px), numbered on a
//     contact sheet: lab/refs/img/<kind>/sheet.jpg (and list.json)
//   NODE_USE_ENV_PROXY=1 node scripts/galaxy-refs.mjs ref <kind> "File:<name>"
//     one picture, full size: lab/refs/<kind>.jpg

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const REFS = join(ROOT, 'lab', 'refs');
const API = 'https://starwars.fandom.com/api.php';
const UA = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36' };
const SKIP = /icon|logo|symbol|emblem|crest|insignia|portrait|_mug|sigil/i;

const query = async (params) => {
  const r = await fetch(`${API}?${new URLSearchParams({ format: 'json', ...params })}`, { headers: UA });
  if (!r.ok) throw new Error(`wiki: ${r.status}`);
  return r.json();
};
const bytes = async (url) => {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
};

// a file's URL (and a thumbnail's, `width` wide) and size
async function info(titles, width = 360) {
  const out = [];
  for (let i = 0; i < titles.length; i += 40) {
    const j = await query({ action: 'query', titles: titles.slice(i, i + 40).join('|'), prop: 'imageinfo', iiprop: 'url|size', iiurlwidth: String(width) });
    for (const p of Object.values(j.query?.pages ?? {})) {
      const ii = p.imageinfo?.[0];
      if (ii) out.push({ title: p.title, url: ii.url, thumb: ii.thumburl, w: ii.width, h: ii.height });
    }
  }
  return out;
}

// one picture, full size, as a Buffer (JPEG)
export async function fetchRef(title) {
  const [im] = await info([title.startsWith('File:') ? title : `File:${title}`]);
  if (!im) throw new Error(`no picture ${title}`);
  return sharp(await bytes(im.url)).flatten({ background: '#ffffff' }).jpeg({ quality: 92 }).toBuffer();
}

async function sheet(kind, pages) {
  const dir = join(REFS, 'img', kind);
  await mkdir(dir, { recursive: true });
  const files = new Set();
  for (const page of pages) {
    const j = await query({ action: 'query', titles: page, prop: 'images', imlimit: '200', redirects: '1' });
    for (const p of Object.values(j.query?.pages ?? {})) for (const im of p.images ?? []) files.add(im.title);
  }
  const list = (await info([...files].filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && !SKIP.test(f)))).filter((im) => im.w >= 500);
  const tiles = [];
  for (const [n, im] of list.entries()) {
    const label = Buffer.from(`<svg width="360" height="240"><rect width="44" height="26" fill="#000"/><text x="4" y="20" font-size="20" fill="#ff0" font-family="sans-serif">${n}</text><text x="4" y="234" font-size="12" fill="#fff" font-family="sans-serif">${im.w}x${im.h}</text></svg>`);
    try {
      const t = await sharp(await bytes(im.thumb)).resize(360, 240, { fit: 'contain', background: '#222' }).toBuffer();
      tiles.push(await sharp(t).composite([{ input: label }]).jpeg().toBuffer());
    } catch {
      tiles.push(await sharp({ create: { width: 360, height: 240, channels: 3, background: '#400' } }).composite([{ input: label }]).jpeg().toBuffer());
    }
  }
  await writeFile(join(dir, 'list.json'), `${JSON.stringify(list, null, 1)}\n`);
  const cols = 5;
  if (tiles.length)
    await sharp({ create: { width: 360 * cols, height: 240 * Math.ceil(tiles.length / cols), channels: 3, background: '#111' } })
      .composite(tiles.map((input, i) => ({ input, left: (i % cols) * 360, top: Math.floor(i / cols) * 240 })))
      .jpeg({ quality: 80 })
      .toFile(join(dir, 'sheet.jpg'));
  console.log(`${kind}: ${list.length} pictures → ${join(dir, 'sheet.jpg')}`);
}

async function main() {
  const [cmd, kind, ...rest] = process.argv.slice(2);
  if (cmd === 'refs' && kind && rest.length) return sheet(kind, rest);
  if (cmd === 'ref' && kind && rest[0]) {
    await mkdir(REFS, { recursive: true });
    const to = join(REFS, `${kind}.jpg`);
    await writeFile(to, await fetchRef(rest[0]));
    return console.log(`${kind}: ${rest[0]} → ${to}`);
  }
  throw new Error('refs <kind> <page…> | ref <kind> <File:…>');
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
